-- =============================================================================
-- SEKİZ — 0079: SAYFA SAYISI DÜZENLEMEDE HER ZAMAN DEĞİŞTİRİLEBİLİR
--
-- Öğretmenin isteği: "Öğrencilerin gönderebileceği çözüm sayfa sayısı
-- süresi dolmayan ödevler için de geçerli olsun. Ya da düzenleme yaparken
-- sayfa sayılarını da düzenleyebilelim… ödevi gönderdikten sonra."
--
-- Öğretmenin kararları (sorulup alındı):
--   • Eski ödev DÜZENLENİNCE yeni kurala geçer: sayfa sayısı yazılıp
--     kaydedilen ödev "her sayfa zorunlu" olur. Hiçbir ödev kendiliğinden
--     değişmez (bu dosya veri GÜNCELLEMİYOR).
--   • Gönderim yapılmış ödevde de sayı değişebilir. Gönderilmiş çözümler ve
--     puanlar OLDUĞU GİBİ kalır; yeni sayı henüz göndermeyenler için
--     geçerli. Eksik sayfa göndermiş öğrenci gerekirse "Gönderimi yeniden
--     aç" (0056) ile yeniden gönderime açılır.
--
-- NE DEĞİŞİYOR
--   1. `odev_guncelle`: 0078'deki "gönderim varken sayfa sayısı kilitli"
--      kuralı kalktı; `p_sayfa_limiti` geldiyse `tum_sayfalar = true`.
--   2. `odev_kardeslere_yay`: gönderimi olan kardeşte eski sayfa kuralını
--      geri yazan blok kalktı; sayı ve bayrak bütün kardeşlere taşınır.
--
-- Görüntüleyiciler gönderimin sayfalarını gönderimin kendi ek sayfa
-- dizisinden okuyor; sayı küçülse de gönderilmiş sayfalar görünür.
--
-- Fonksiyon gövdeleri 0078'den MEKANİK kopya; yalnız işaretli satırlar
-- değişti. İmzalar ve yetkiler değişmedi.
--
-- Bu dosya tekrar çalıştırılabilir. Ön koşul: 0078.
-- =============================================================================

do $$
begin
  if to_regprocedure('public.odev_sayfa_kurali(text,uuid)') is null then
    raise exception '0079: önce 0078 çalıştırılmalı';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. odev_guncelle — gönderim varken de sayfa sayısı değişir; sayı yazılan
--    ödev her sayfa zorunlu kurala geçer (gövde: 0078)
-- -----------------------------------------------------------------------------
create or replace function public.odev_guncelle(
  p_token text,
  p_id uuid,
  p_baslik text,
  p_aciklama text,
  p_sinif_id uuid,
  p_son_tarih date,
  p_soru_sayisi integer default null,
  p_cevap_anahtari jsonb default null,
  p_anahtar_yolu text default null,
  p_odev_yolu text default null,
  -- DİKKAT — burada varsayılan `null`, `true` DEĞİL.
  --
  -- Oluşturmada varsayılan `true` doğru: yeni ödev açık başlar. Ama
  -- güncellemede `true` olsaydı, parametreyi göndermeyen HERHANGİ bir çağrı
  -- öğretmenin kapattığı bir ödevi sessizce yeniden açardı. Ayarı "ödev
  -- verildikten sonra da değiştirebilmek" ancak değişikliğin kalıcı olmasıyla
  -- bir anlam taşır. `null` = "dokunma", aşağıdaki coalesce mevcut değeri
  -- koruyor — `p_sik_sayisi` ile aynı davranış.
  p_gec_teslim boolean default null,
  p_sik_sayisi smallint default null,
  -- NULL = DEĞİŞTİRME (p_gec_teslim ile aynı tuzak). Konuları temizlemek
  -- için boş nesne gönderilir: '{}'.
  p_konular jsonb default null,
  -- 0054 — NULL = DEĞİŞTİRME (p_gec_teslim ile aynı tuzak). Sınırı
  -- düşürmek yapılmış gönderimlere dokunmaz: gönderim değiştirilemez,
  -- sınır yalnız bundan sonraki gönderimleri bağlar.
  p_sayfa_limiti smallint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  d           public.odevler;
  yeni_sayi   integer;
  yeni_anahtar jsonb;
  anahtar_degisti boolean;
  g           record;
  yeni        record;
  rapor       jsonb := '[]'::jsonb;
  v_ogretmen  uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  perform public._odev_sahibi(v_ogretmen, p_id);

  select * into d from public.odevler where id = p_id;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  if p_baslik is null or btrim(p_baslik) = '' then
    raise exception 'Başlık boş olamaz.' using errcode = '22023';
  end if;
  if p_sinif_id is null or p_son_tarih is null then
    raise exception 'Sınıf ve son tarih zorunludur.' using errcode = '22023';
  end if;
  -- 0055: ödev yalnız öğretmenin KENDİ sınıfına taşınabilir. Önceden hiç
  -- denetlenmiyordu; sınıf öğretmeni yöneticinin ödevini düzenleyebildiği
  -- için artık gerekli. Sınıf değişmiyorsa aranmıyor.
  if p_sinif_id is distinct from d.sinif_id
     and not public._ogretmenin_sinifi(v_ogretmen, p_sinif_id) then
    raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
  end if;
  if p_sayfa_limiti is not null and p_sayfa_limiti not between 1 and 40 then
    raise exception 'Sayfa sayısı 1 ile 40 arasında olmalı.' using errcode = '22023';
  end if;
  -- 0079: gönderim yapılmış ödevde de sayfa sayısı DEĞİŞEBİLİR (öğretmenin
  -- kararı). Gönderilmiş çözümler ve puanlar değişmez; yeni sayı henüz
  -- göndermeyenler için geçerli. 0078'deki kilit kalktı.

  if d.tur = 'test' then
    yeni_sayi := coalesce(p_soru_sayisi, d.soru_sayisi);
    if yeni_sayi is null or yeni_sayi < 1 or yeni_sayi > 200 then
      raise exception 'Soru sayısı 1 ile 200 arasında olmalı.' using errcode = '22023';
    end if;

    -- Soru sayısı küçüldüyse anahtarı kırp: aksi hâlde artık var olmayan
    -- sorulara ait cevaplar kayıtta kalır ve puanlamayı bulandırır.
    yeni_anahtar := coalesce(p_cevap_anahtari, d.cevap_anahtari, '{}'::jsonb);
    select coalesce(jsonb_object_agg(k, yeni_anahtar -> k), '{}'::jsonb)
      into yeni_anahtar
    from jsonb_object_keys(yeni_anahtar) k
    where (k ~ '^\d+$') and k::integer between 1 and yeni_sayi;

    anahtar_degisti := (yeni_anahtar is distinct from coalesce(d.cevap_anahtari, '{}'::jsonb))
                       or (yeni_sayi is distinct from d.soru_sayisi);
  else
    yeni_sayi := null;
    yeni_anahtar := null;
    anahtar_degisti := false;
  end if;

  update public.odevler
     set baslik      = btrim(p_baslik),
         aciklama    = nullif(btrim(coalesce(p_aciklama, '')), ''),
         sinif_id    = p_sinif_id,
         son_tarih   = p_son_tarih,
         soru_sayisi = yeni_sayi,
         cevap_anahtari = yeni_anahtar,
         anahtar_url = nullif(btrim(coalesce(p_anahtar_yolu, '')), ''),
         odev_url    = nullif(btrim(coalesce(p_odev_yolu, '')), ''),
         gec_teslim  = coalesce(p_gec_teslim, d.gec_teslim),
         sik_sayisi  = case when p_sik_sayisi = 4 then 4
                            when p_sik_sayisi = 5 then 5
                            else d.sik_sayisi end,
         -- Konular da soru sayısına göre kırpılıyor: anahtarda uygulanan
         -- kuralın aynısı, yoksa artık olmayan soruların konusu kayıtta kalır.
         konular     = public._konu_temizle(coalesce(p_konular, d.konular), yeni_sayi),
         sayfa_limiti = coalesce(p_sayfa_limiti, d.sayfa_limiti),
         -- 0079: sayfa sayısı yazılan ödev "her sayfa zorunlu" kurala geçer
         -- (eski ödev de). Sayı gönderilmediyse bayrak olduğu gibi kalır.
         tum_sayfalar = (d.tum_sayfalar or p_sayfa_limiti is not null)
   where id = p_id;

  perform public._denetim('odev_guncellendi', 'odevler', p_id, public._aktor(v_ogretmen),
                          to_jsonb(d), (select to_jsonb(o) from public.odevler o where o.id = p_id));

  -- ---------------------------------------------------------------------
  -- YENİDEN PUANLAMA
  -- ---------------------------------------------------------------------
  if anahtar_degisti then
    for g in
      select gn.id, gn.ogrenci_id, gn.cevaplar, gn.puan, gn.dogru, gn.yanlis, gn.bos,
             o.ad as ogrenci_ad
      from public.gonderimler gn
      join public.ogrenciler o on o.id = gn.ogrenci_id
      where gn.odev_id = p_id
    loop
      select * into yeni
      from public._puanla(yeni_anahtar, coalesce(g.cevaplar, '{}'::jsonb), yeni_sayi);

      if yeni.puan is distinct from g.puan then
        update public.gonderimler
           set dogru = yeni.dogru, yanlis = yeni.yanlis,
               bos = yeni.bos, puan = yeni.puan
         where id = g.id;

        -- Not değişikliği HER ZAMAN iz bırakır (Part XLIII).
        perform public._denetim(
          'yeniden_puanlandi', 'gonderimler', g.id, public._aktor(v_ogretmen),
          jsonb_build_object('puan', g.puan, 'dogru', g.dogru,
                             'yanlis', g.yanlis, 'bos', g.bos),
          jsonb_build_object('puan', yeni.puan, 'dogru', yeni.dogru,
                             'yanlis', yeni.yanlis, 'bos', yeni.bos));

        rapor := rapor || jsonb_build_object(
          'ogrenci', g.ogrenci_ad,
          'eski_puan', g.puan,
          'yeni_puan', yeni.puan);
      end if;
    end loop;
  end if;

  return jsonb_build_object('durum', 'tamam', 'yeniden_puanlanan', rapor);
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. odev_kardeslere_yay — sayfa kuralı gönderimi olan kardeşe de taşınır
--    (gövde: 0078)
-- -----------------------------------------------------------------------------
create or replace function public.odev_kardeslere_yay(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  d       public.odevler;   -- kaynak
  k       record;           -- kardeş
  eski    public.odevler;   -- kardeşin yayma ÖNCESİ hâli (denetim izi için)
  g       record;
  yeni    record;
  anahtar_degisti boolean;
  rapor   jsonb := '[]'::jsonb;
  puanlar jsonb;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  -- Kardeşlere yayma NOT DEĞİŞTİRİYOR: kaynağın sahibi olmayan
  -- kimse başlatamaz.
  perform public._odev_sahibi(v_ogretmen, p_id);

  select * into d from public.odevler where id = p_id;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  -- 0055: YAYMA YALNIZ ÖDEVİ VERENE. Yöneticinin birden çok sınıfa
  -- verdiği bir ödevi o sınıflardan birinin öğretmeni de açabiliyor; ama
  -- kardeşler BAŞKA öğretmenlerin sınıflarında. Yayabilseydi onların
  -- öğrencilerinin notunu değiştirirdi.
  if d.ogretmen_id <> v_ogretmen then
    raise exception 'Bu ödevi kardeş sınıflara yalnız ödevi veren öğretmen yayabilir.'
      using errcode = '42501';
  end if;

  -- SESSİZ "TAMAM" YOK. Kardeşi olmayan bir ödevde hiçbir şey yapmayıp
  -- başarı dönmek, öğretmene yayıldığını sandırırdı.
  if d.grup_id is null then
    raise exception 'Bu ödev tek sınıfa verilmiş; yayılacak kardeş ödev yok.'
      using errcode = '22023';
  end if;

  for k in
    select d2.id, d2.sinif_id, s2.ad as sinif_ad
      from public.odevler d2
      join public.siniflar s2 on s2.id = d2.sinif_id
     where d2.grup_id = d.grup_id and d2.id <> p_id
     order by s2.seviye, s2.sube
  loop
    -- ARŞİVDEKİ SINIF ATLANIYOR (0016 kuralı).
    -- Arşivdeki sınıf öğretmenin hiçbir listesinde görünmüyor; görünmeyen bir
    -- sınıfın notunu sessizce değiştirmek o kuralı delerdi. Atlandığı raporda
    -- yazıyor — sessiz atlama da yok.
    if public._sinif_arsivde(k.sinif_id) then
      rapor := rapor || jsonb_build_object(
        'sinif', k.sinif_ad, 'odev_id', k.id,
        'yeniden_puanlanan', '[]'::jsonb, 'atlandi', 'arsiv');
      continue;
    end if;

    select * into eski from public.odevler where id = k.id;

    -- Anahtar bu kardeş için gerçekten değişiyor mu? Yalnız test ödevinde
    -- anlamlı; açık uçluda anahtar da soru sayısı da null.
    anahtar_degisti := eski.tur = 'test'
      and ((d.cevap_anahtari is distinct from eski.cevap_anahtari)
        or (d.soru_sayisi is distinct from eski.soru_sayisi));

    -- TAŞINAN ALANLAR — öğretmenin kararı, birebir.
    -- sinif_id, son_tarih, gec_teslim, yayinda ve grup_id BİLEREK YOK.
    update public.odevler
       set baslik         = d.baslik,
           aciklama       = d.aciklama,
           soru_sayisi    = d.soru_sayisi,
           cevap_anahtari = d.cevap_anahtari,
           sik_sayisi     = d.sik_sayisi,
           -- 0054: sayfa sınırı da ödevin İÇERİĞİ — aynı çözüm her sınıfta
           -- aynı sayıda sayfa tutar. Şık sayısı gibi taşınıyor; geç teslim
           -- gibi sınıfa özgü bir ayar DEĞİL.
           sayfa_limiti   = d.sayfa_limiti,
           -- 0078: "her sayfa zorunlu" bayrağı da içerik. 0079: gönderimi
           -- olan kardeşe de taşınıyor (odev_guncelle'deki kilit kalktı);
           -- gönderilmiş çözümler değişmez.
           tum_sayfalar   = d.tum_sayfalar,
           konular        = public._konu_temizle(d.konular, d.soru_sayisi),
           anahtar_url    = d.anahtar_url,
           odev_url       = d.odev_url
     where id = k.id;

    perform public._denetim('kardeslere_yayildi', 'odevler', k.id, public._aktor(v_ogretmen),
                            to_jsonb(eski),
                            (select to_jsonb(o) from public.odevler o where o.id = k.id));

    -- -------------------------------------------------------------------
    -- YENİDEN PUANLAMA — gövde odev_guncelle'den (0020) BİREBİR kopyalandı.
    -- Ezberden yazmak 0016'da iki hataya yol açmıştı; o adım atlanmıyor.
    -- -------------------------------------------------------------------
    puanlar := '[]'::jsonb;
    if anahtar_degisti then
      for g in
        select gn.id, gn.ogrenci_id, gn.cevaplar, gn.puan, gn.dogru, gn.yanlis, gn.bos,
               o.ad as ogrenci_ad
          from public.gonderimler gn
          join public.ogrenciler o on o.id = gn.ogrenci_id
         where gn.odev_id = k.id
      loop
        select * into yeni
        from public._puanla(coalesce(d.cevap_anahtari, '{}'::jsonb),
                            coalesce(g.cevaplar, '{}'::jsonb),
                            d.soru_sayisi);

        if yeni.puan is distinct from g.puan then
          update public.gonderimler
             set dogru = yeni.dogru, yanlis = yeni.yanlis,
                 bos = yeni.bos, puan = yeni.puan
           where id = g.id;

          -- Not değişikliği HER ZAMAN iz bırakır (Part XLIII).
          perform public._denetim(
            'yeniden_puanlandi', 'gonderimler', g.id, public._aktor(v_ogretmen),
            jsonb_build_object('puan', g.puan, 'dogru', g.dogru,
                               'yanlis', g.yanlis, 'bos', g.bos),
            jsonb_build_object('puan', yeni.puan, 'dogru', yeni.dogru,
                               'yanlis', yeni.yanlis, 'bos', yeni.bos));

          puanlar := puanlar || jsonb_build_object(
            'ogrenci', g.ogrenci_ad,
            'eski_puan', g.puan,
            'yeni_puan', yeni.puan);
        end if;
      end loop;
    end if;

    rapor := rapor || jsonb_build_object(
      'sinif', k.sinif_ad, 'odev_id', k.id,
      'yeniden_puanlanan', puanlar, 'atlandi', null);
  end loop;

  return rapor;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Kendi kendini doğrulama
-- -----------------------------------------------------------------------------
do $$
begin
  if pg_get_functiondef('public.odev_guncelle'::regproc) like '%sayfa sayısı artık değiştirilemez%' then
    raise exception '0079: odev_guncelle kilidi duruyor';
  end if;
  if pg_get_functiondef('public.odev_guncelle'::regproc) not like '%tum_sayfalar = (d.tum_sayfalar or p_sayfa_limiti is not null)%' then
    raise exception '0079: odev_guncelle bayrağı yazmıyor';
  end if;
  if pg_get_functiondef('public.odev_kardeslere_yay(text, uuid)'::regprocedure) like '%set sayfa_limiti = eski.sayfa_limiti%' then
    raise exception '0079: odev_kardeslere_yay kardeş koruması duruyor';
  end if;
end $$;

select public._migration_kaydet('0079');
