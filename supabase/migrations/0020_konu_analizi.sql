-- =============================================================================
-- SEKİZ — 0020 KONU EŞLEMESİ VE KONU ANALİZİ
--
-- ÖĞRETMENİN İSTEĞİ:
--   "Puanı hesaplanan öğrencinin yanlışı üzerinden hangi konuda eksiği
--    olduğu bildirilmeli. Yani hangi konuya çalışması gerektiği."
--
-- Bunun için bugün olmayan bir bilgi gerekiyor: HANGİ SORU HANGİ KONUYA
-- AİT. Cevap anahtarı yalnız {"1":"A","2":"B"} tutuyor.
--
-- KONU AI İLE TAHMİN EDİLMİYOR (Kural 5). Soru metninden konu çıkarmak
-- cazip ama yanlış konu, çocuğa yanlış çalışma yönü demek. Eşleme
-- öğretmenden geliyor; arayüz bunu soru aralığıyla girdiriyor ki her
-- ödevde tek tek uğraşmasın.
--
-- ANALİZ SUNUCUDA HESAPLANIYOR — bu bir tercih değil zorunluluk:
-- veli de konu analizini görecek (öğretmenin kararı) ama veliye cevap
-- anahtarı HİÇBİR koşulda gitmez (Kural 6). Tarayıcıda hesaplasaydık
-- anahtarı göndermek gerekirdi.
--
-- PUANLAMAYLA ÇELİŞMEZ: `_konu_analizi` `_puanla` ile BİREBİR aynı kuralları
-- uyguluyor — boş cevap yanlış değil boş sayılır, anahtarı olmayan soru
-- öğrenciyi cezalandırmaz. İki yerde iki farklı kural olsaydı öğrenci 100
-- alıp "şu konuda eksiğin var" uyarısı görebilirdi.
--
-- Bu dosya tekrar çalıştırılabilir.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Sütun: soru numarası → konu adı
--
-- Şekil: {"1":"Türev","2":"Türev","3":"Limit"}. Aralıkla girilir, soru
-- başına saklanır: hesaplama böyle basit kalıyor ve tek bir sorunun konusu
-- sonradan değiştirilebiliyor.
--
-- NULL serbest: konusu girilmemiş ödev bugünkü gibi çalışır, analiz çıkmaz.
-- -----------------------------------------------------------------------------
alter table public.odevler add column if not exists konular jsonb;

-- -----------------------------------------------------------------------------
-- 2. _konu_temizle — kayıtta çöp bırakma
--
-- Soru sayısı küçüldüyse artık var olmayan soruların konusu silinir;
-- cevap anahtarında uygulanan kuralın aynısı. Boş sonuç NULL'a dönüyor ki
-- "konu girilmemiş" ile "hepsi silinmiş" aynı şeye gelsin.
-- -----------------------------------------------------------------------------
create or replace function public._konu_temizle(p_konular jsonb, p_soru_sayisi integer)
returns jsonb
language sql
immutable
as $$
  select nullif(coalesce((
    select jsonb_object_agg(k, p_konular -> k)
    from jsonb_object_keys(coalesce(p_konular, '{}'::jsonb)) k
    where k ~ '^\d+$'
      and k::integer between 1 and coalesce(p_soru_sayisi, 0)
      and btrim(coalesce(p_konular ->> k, '')) <> ''
  ), '{}'::jsonb), '{}'::jsonb);
$$;

-- -----------------------------------------------------------------------------
-- 3. _konu_analizi — konu başına doğru/yanlış/boş
--
-- `_puanla` ile AYNI dallanma (0004): boş cevap boş, anahtarsız soru boş,
-- eşleşme doğru, gerisi yanlış. Bu kopya bilinçli — iki yerde iki farklı
-- kural puanla analizi çelişkiye düşürürdü.
--
-- "Çalışılacak konu" = doğru yapılamayan (yanlış + boş). Boşu dışarıda
-- bırakmak, soruyu hiç yapamayan öğrencinin en büyük eksiğini gizlerdi.
-- -----------------------------------------------------------------------------
create or replace function public._konu_analizi(
  p_konular jsonb, p_anahtar jsonb, p_cevaplar jsonb, p_soru_sayisi integer
)
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'konu', konu, 'toplam', toplam,
           'dogru', dogru, 'yanlis', yanlis, 'bos', bos)
         order by (toplam - dogru) desc, konu), '[]'::jsonb)
  from (
    select p_konular ->> k as konu,
           count(*)::integer as toplam,
           count(*) filter (where a <> '' and c <> '' and c = a)::integer as dogru,
           count(*) filter (where a <> '' and c <> '' and c <> a)::integer as yanlis,
           count(*) filter (where c = '' or a = '')::integer as bos
    from jsonb_object_keys(coalesce(p_konular, '{}'::jsonb)) k
    cross join lateral (
      select upper(btrim(coalesce(p_anahtar  ->> k, ''))) as a,
             upper(btrim(coalesce(p_cevaplar ->> k, ''))) as c
    ) s
    where k ~ '^\d+$'
      and k::integer between 1 and coalesce(p_soru_sayisi, 0)
      and btrim(coalesce(p_konular ->> k, '')) <> ''
    group by p_konular ->> k
  ) t;
$$;

-- -----------------------------------------------------------------------------
-- 3b. _soru_dokumu — HANGİ SORULAR yanlış, hangileri boş
--
-- ÖĞRETMENİN İSTEĞİ:
--   "Öğretmen de öğrencinin puanıyla birlikte hangi soru/soruları yanlış
--    yaptığını görsün. Veli de görebilsin."
--
-- Konu analizi "hangi KONUDA eksik" der; bu "hangi SORUDA takıldı" der.
-- İkisi ayrı sorulardır: konusu girilmemiş bir ödevde bile öğretmen soru
-- numarasını görebilmeli.
--
-- YALNIZ NUMARA DÖNÜYOR. Öğrencinin işaretlediği şık da, doğru şık da bu
-- fonksiyondan çıkmıyor. Öğretmen anahtarı zaten başka uçtan görüyor;
-- veliye ise numara gider, şık GİTMEZ (Kural 6) — dört şıklı bir soruda
-- "öğrencin C dedi" demek anahtara doğru atılmış bir adımdır.
--
-- Dallanma `_puanla` ile BİREBİR aynı (0004:37): boş cevap boş, anahtarsız
-- soru boş, gerisi yanlış. Ayrışsalardı öğrenci 3 yanlış görüp puanı 4
-- yanlışa göre hesaplanmış olabilirdi.
-- -----------------------------------------------------------------------------
create or replace function public._soru_dokumu(
  p_anahtar jsonb, p_cevaplar jsonb, p_soru_sayisi integer
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'yanlis', coalesce(jsonb_agg(n order by n)
                filter (where a <> '' and c <> '' and c <> a), '[]'::jsonb),
    'bos',    coalesce(jsonb_agg(n order by n)
                filter (where c = '' or a = ''), '[]'::jsonb)
  )
  from generate_series(1, coalesce(p_soru_sayisi, 0)) n
  cross join lateral (
    select upper(btrim(coalesce(p_anahtar  ->> n::text, ''))) as a,
           upper(btrim(coalesce(p_cevaplar ->> n::text, ''))) as c
  ) s;
$$;

revoke all on function public._konu_temizle(jsonb, integer) from public, anon, authenticated;
revoke all on function public._konu_analizi(jsonb, jsonb, jsonb, integer)
  from public, anon, authenticated;
revoke all on function public._soru_dokumu(jsonb, jsonb, integer)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. ESKİ İMZALAR DÜŞÜYOR (0007 tuzağı)
--
-- Parametre eklemek YENİ bir fonksiyon üretir; eski imza EXECUTE yetkisiyle
-- birlikte ayakta kalır ve arayüz farkında olmadan eski davranışı çağırmayı
-- sürdürebilir. Bu tuzağa bu projede iki kez düşüldü; açıkça düşürüyoruz.
-- -----------------------------------------------------------------------------
drop function if exists public.odev_olustur(text,text,text,uuid,text,date,integer,jsonb,text,text,boolean,smallint);
drop function if exists public.odev_guncelle(text,uuid,text,text,uuid,date,integer,jsonb,text,text,boolean,smallint);

-- -----------------------------------------------------------------------------
-- 5. odev_olustur — gövde 0010'dan BİREBİR, tek ekleme p_konular
-- -----------------------------------------------------------------------------
create or replace function public.odev_olustur(
  p_token text,
  p_baslik text,
  p_aciklama text,
  p_sinif_id uuid,
  p_tur text,
  p_son_tarih date,
  p_soru_sayisi integer default null,
  p_cevap_anahtari jsonb default null,
  p_anahtar_yolu text default null,
  p_odev_yolu text default null,
  p_gec_teslim boolean default true,
  p_sik_sayisi smallint default 5,
  p_konular jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  yeni_id uuid;
begin
  perform public._ogretmen(p_token);

  insert into public.odevler
    (baslik, aciklama, sinif_id, tur, son_tarih, soru_sayisi,
     cevap_anahtari, anahtar_url, odev_url, gec_teslim, sik_sayisi, konular, yayinda)
  values
    (btrim(p_baslik), nullif(btrim(coalesce(p_aciklama, '')), ''), p_sinif_id,
     p_tur, p_son_tarih, p_soru_sayisi, p_cevap_anahtari,
     nullif(btrim(coalesce(p_anahtar_yolu, '')), ''),
     nullif(btrim(coalesce(p_odev_yolu, '')), ''),
     coalesce(p_gec_teslim, true),
     case when coalesce(p_sik_sayisi, 5) = 4 then 4 else 5 end,
     public._konu_temizle(p_konular, p_soru_sayisi),
     false)  -- Taslak olarak başlar; öğretmen onaylamadan öğrenciye düşmez.
  returning id into yeni_id;

  perform public._denetim('odev_olusturuldu', 'odevler', yeni_id, 'ogretmen');
  return jsonb_build_object('id', yeni_id, 'yayinda', false);
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. odev_guncelle — gövde 0010'dan BİREBİR, tek ekleme p_konular
--
-- `p_konular` NULL = DEĞİŞTİRME. `p_gec_teslim` ile aynı tuzak: varsayılanı
-- boş nesne yapsaydık, konularla ilgisi olmayan bir düzenleme (başlık
-- değişikliği) sessizce bütün konu eşlemesini silerdi.
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
  p_konular jsonb default null
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
begin
  perform public._ogretmen(p_token);

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
         konular     = public._konu_temizle(coalesce(p_konular, d.konular), yeni_sayi)
   where id = p_id;

  perform public._denetim('odev_guncellendi', 'odevler', p_id, 'ogretmen',
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
          'yeniden_puanlandi', 'gonderimler', g.id, 'ogretmen',
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
-- 7. odev_detay — düzenleme formu konuları geri okusun
-- -----------------------------------------------------------------------------
create or replace function public.odev_detay(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  d public.odevler;
  s public.siniflar;
begin
  perform public._ogretmen(p_token);

  select * into d from public.odevler where id = p_id;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;
  select * into s from public.siniflar where id = d.sinif_id;

  return jsonb_build_object(
    'id', d.id,
    'baslik', d.baslik,
    'aciklama', d.aciklama,
    'tur', d.tur,
    'sinif_id', d.sinif_id,
    'sinif', s.ad,
    'son_tarih', d.son_tarih,
    'soru_sayisi', d.soru_sayisi,
    'gec_teslim', d.gec_teslim,
    'konular', coalesce(d.konular, '{}'::jsonb),
    'sik_sayisi', d.sik_sayisi,
    'cevap_anahtari', coalesce(d.cevap_anahtari, '{}'::jsonb),
    'anahtar_yolu', d.anahtar_url,
    'odev_yolu', d.odev_url,
    'yayinda', d.yayinda,
    'gonderim_sayisi', (select count(*) from public.gonderimler g where g.odev_id = d.id),
    'gec_gonderim_sayisi', (
      select count(*) from public.gonderimler g
      where g.odev_id = d.id and public._gecikmeli(g.created_at, d.son_tarih)
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. ogrenci_odevleri — öğrencinin konu analizi
-- -----------------------------------------------------------------------------
create or replace function public.ogrenci_odevleri(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  ogr record;
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'ogrenci' then
    raise exception 'Bu bölüm yalnızca öğrenciler içindir.' using errcode = '42501';
  end if;

  select ogr2.id, ogr2.ad, ogr2.tur, s.ad as sinif, ogr2.sinif_id,
         coalesce(s.arsiv, false) as sinif_arsiv
    into ogr
  from public.ogrenciler ogr2
  left join public.siniflar s on s.id = ogr2.sinif_id
  where ogr2.id = o.ogrenci_id;

  return jsonb_build_object(
    'ogrenci', jsonb_build_object('id', ogr.id, 'ad', ogr.ad, 'sinif', ogr.sinif),
    'odevler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'baslik', d.baslik,
        'aciklama', d.aciklama,
        'tur', d.tur,
        'son_tarih', d.son_tarih,
        'soru_sayisi', d.soru_sayisi,
        'gec_teslim', d.gec_teslim,
        'sik_sayisi', d.sik_sayisi,
        -- Sınıf kapalıysa gönderim yok; arayüz nedenini yazsın diye burada.
        'sinif_arsiv', ogr.sinif_arsiv,
        -- Soru PDF'i: teslimden bağımsız, her zaman.
        'odev_yolu', d.odev_url,
        'gonderim', case when g.id is null then null else jsonb_build_object(
          'id', g.id, 'zaman', g.created_at, 'durum', g.durum,
          'dogru', g.dogru, 'yanlis', g.yanlis, 'bos', g.bos,
          'puan', g.puan, 'ogretmen_puan', g.ogretmen_puan,
          'ogretmen_yorum', g.ogretmen_yorum,
          'cevaplar', coalesce(g.cevaplar, '{}'::jsonb),
          -- Öğrenci de kendi gecikmesini görüyor. Öğretmene görünen bir
          -- şeyin öğrenciden saklanması için bir sebep yok; üstelik geç
          -- gönderdiğini bilmesi işin yarısı.
          'gecikmeli', public._gecikmeli(g.created_at, d.son_tarih)
        ) end,
        -- Anahtar YALNIZ teslim varsa eklenir. Teslim yoksa alan hiç yok.
        -- Konu analizi de YALNIZ teslimden sonra: öncesinde hangi konuda
        -- kaç soru olduğunu bilmek anahtara doğru bir adım olurdu.
        'konu_analizi', case when g.id is not null
          then public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
          else '[]'::jsonb end,
        'cevap_anahtari', case when g.id is not null then d.cevap_anahtari else null end,
        'anahtar_yolu',   case when g.id is not null then d.anahtar_url    else null end
      ) order by d.son_tarih)
      from public.odevler d
      left join public.gonderimler g
        on g.odev_id = d.id and g.ogrenci_id = ogr.id
      where d.yayinda and d.sinif_id = ogr.sinif_id
    ), '[]'::jsonb),
    'dersler', coalesce((
      select jsonb_agg(jsonb_build_object('zaman', l.zaman, 'mod', l.mod, 'link', l.link)
                       order by l.zaman)
      from public.dersler l
      where l.ogrenci_id = ogr.id and l.zaman > now()
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 8b. veli_paneli — VELİYE KONU GİDER, ANAHTAR GİTMEZ
-- -----------------------------------------------------------------------------
create or replace function public.veli_paneli(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  ogr record;
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'veli' then
    raise exception 'Bu bölüm yalnızca veliler içindir.' using errcode = '42501';
  end if;

  select ogr2.id, ogr2.ad, ogr2.tur, s.ad as sinif, ogr2.sinif_id into ogr
  from public.ogrenciler ogr2
  left join public.siniflar s on s.id = ogr2.sinif_id
  where ogr2.id = o.ogrenci_id;

  return jsonb_build_object(
    'ogrenci', jsonb_build_object('ad', ogr.ad, 'sinif', ogr.sinif, 'tur', ogr.tur),
    'odevler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'baslik', d.baslik,
        'son_tarih', d.son_tarih,
        'olusturma', d.created_at,
        'gonderildi', (g.id is not null),
        'gonderim_zamani', g.created_at,
        'puan', coalesce(g.ogretmen_puan, g.puan),
        'durum', g.durum,
        -- VELİYE KONU GİDİYOR, ANAHTAR GİTMİYOR. Konu adı ve kaç soruda
        -- takıldığı velinin işine yarar; cevap anahtarı hiçbir koşulda
        -- gitmez (Kural 6). Analiz SUNUCUDA hesaplanıyor, tam da bu yüzden:
        -- veliye anahtarı gönderip tarayıcıda hesaplasaydık kural çiğnenirdi.
        'konu_analizi', case when g.id is not null
          then public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
          else '[]'::jsonb end,
        -- VELİYE YALNIZ NUMARA. Öğretmenin isteği ("veli de görebilsin")
        -- burada karşılanıyor ama sınır aynen duruyor: numara "hangi soruda
        -- takıldı" der, şık göndermek anahtara doğru bir adım olurdu
        -- (Kural 6). Öğrencinin işaretlediği şık da doğru şık da yanıtta yok.
        'yanlis_sorular', case when g.id is not null and d.tur = 'test'
          then public._soru_dokumu(d.cevap_anahtari, g.cevaplar, d.soru_sayisi) -> 'yanlis'
          else '[]'::jsonb end,
        'bos_sorular', case when g.id is not null and d.tur = 'test'
          then public._soru_dokumu(d.cevap_anahtari, g.cevaplar, d.soru_sayisi) -> 'bos'
          else '[]'::jsonb end
      ) order by d.son_tarih desc)
      from public.odevler d
      left join public.gonderimler g
        on g.odev_id = d.id and g.ogrenci_id = ogr.id
      where d.yayinda and d.sinif_id = ogr.sinif_id
    ), '[]'::jsonb),
    'mesajlar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kimden', m.kimden, 'metin', m.metin, 'zaman', m.created_at)
             order by m.created_at)
      from public.mesajlar m where m.ogrenci_id = ogr.id
    ), '[]'::jsonb),
    'odemeler', case when ogr.tur = 'ozel' then coalesce((
      select jsonb_agg(jsonb_build_object('tutar', p.tutar, 'tarih', p.tarih, 'odendi', p.odendi)
                       order by p.tarih desc)
      from public.odemeler p where p.ogrenci_id = ogr.id
    ), '[]'::jsonb) else '[]'::jsonb end,
    -- ROL SÜZGECİ ŞART (0019): `okundu`'nun birincil anahtarı artık
    -- (ogrenci_id, rol). Süzgeçsiz alt sorgu üç satır döner ve fonksiyon
    -- "more than one row returned by a subquery" ile çöker. Veli paneli
    -- velinin kendi son görülmesini ister.
    'son_gorulme', (select k.zaman from public.okundu k
                     where k.ogrenci_id = ogr.id and k.rol = 'veli')
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. odev_gonderimleri — sınıfın konu özeti
-- -----------------------------------------------------------------------------
create or replace function public.odev_gonderimleri(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  d public.odevler;
  s public.siniflar;
begin
  perform public._ogretmen(p_token);

  select * into d from public.odevler where id = p_id;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;
  select * into s from public.siniflar where id = d.sinif_id;

  return jsonb_build_object(
    'odev', jsonb_build_object(
      'id', d.id,
      'baslik', d.baslik,
      'tur', d.tur,
      'sinif', s.ad,
      'son_tarih', d.son_tarih,
      'soru_sayisi', d.soru_sayisi,
      'gec_teslim', d.gec_teslim,
      'yayinda', d.yayinda
    ),
    'ozet', jsonb_build_object(
      'mevcut', (select count(*) from public.ogrenciler o
                  where o.sinif_id = d.sinif_id and o.aktif),
      'gonderen', (select count(*) from public.gonderimler g
                    where g.odev_id = d.id),
      'gecikmeli', (select count(*) from public.gonderimler g
                     where g.odev_id = d.id
                       and public._gecikmeli(g.created_at, d.son_tarih)),
      'puan_bekleyen', (select count(*) from public.gonderimler g
                         where g.odev_id = d.id and g.durum = 'incelemede')
    ),
    -- SINIF KONU ÖZETİ: "bu sınıf en çok hangi konuda takıldı?"
    -- Öğretmenin bir sonraki dersini planlarken bakacağı sayı bu. Tek tek
    -- öğrencilerin analizini toplamak yerine sunucuda toplanıyor; aksi hâlde
    -- otuz öğrencinin cevapları tarayıcıya inerdi.
    'konu_ozeti', coalesce((
      select jsonb_agg(jsonb_build_object(
               'konu', t.konu, 'toplam', t.toplam,
               'dogru', t.dogru, 'yanlis', t.yanlis, 'bos', t.bos)
             order by (t.toplam - t.dogru) desc, t.konu)
      from (
        select e->>'konu' as konu,
               sum((e->>'toplam')::integer)::integer as toplam,
               sum((e->>'dogru')::integer)::integer  as dogru,
               sum((e->>'yanlis')::integer)::integer as yanlis,
               sum((e->>'bos')::integer)::integer    as bos
        from public.gonderimler g
        cross join lateral jsonb_array_elements(
          public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
        ) e
        where g.odev_id = d.id
        group by e->>'konu'
      ) t
    ), '[]'::jsonb),
    'satirlar', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ogrenci_id', o.id,
        'ogrenci', o.ad,
        'gonderim_id', g.id,
        'gonderdi', (g.id is not null),
        'zaman', g.created_at,
        'gecikmeli', case when g.id is null then false
                     else public._gecikmeli(g.created_at, d.son_tarih) end,
        'durum', g.durum,
        'dogru', g.dogru,
        'yanlis', g.yanlis,
        'bos', g.bos,
        'puan', g.puan,
        'ogretmen_puan', g.ogretmen_puan,
        'ogretmen_yorum', g.ogretmen_yorum,
        -- HANGİ SORULAR YANLIŞ: sayı değil, numara. "5 yanlış" öğretmene
        -- ne yapacağını söylemez; "3, 7 ve 9 yanlış" söyler. Yalnız test
        -- ödevinde anlamlı — açık uçluda anahtar yok, her soru "boş"
        -- görünür ve bu bilgi gürültüden ibaret olurdu.
        'yanlis_sorular', case when g.id is not null and d.tur = 'test'
          then public._soru_dokumu(d.cevap_anahtari, g.cevaplar, d.soru_sayisi) -> 'yanlis'
          else '[]'::jsonb end,
        'bos_sorular', case when g.id is not null and d.tur = 'test'
          then public._soru_dokumu(d.cevap_anahtari, g.cevaplar, d.soru_sayisi) -> 'bos'
          else '[]'::jsonb end,
        'foto_var', (g.foto_yolu is not null)
      ) order by o.ad)
      from public.ogrenciler o
      left join public.gonderimler g
        on g.odev_id = d.id and g.ogrenci_id = o.id
      where o.sinif_id = d.sinif_id and o.aktif
    ), '[]'::jsonb)
  );
end;
$$;


-- -----------------------------------------------------------------------------
-- 10. konu_onerileri — daha önce kullanılan konu adları
--
-- Otomatik tamamlama için. Aynı konunun "Türev" ve "türev" diye iki ayrı
-- kayda düşmesi analizi böler; öneri listesi bunu kendiliğinden engelliyor.
-- Ayrı bir konu tablosu ve yönetim ekranı açmaya gerek yok: kaynak zaten
-- öğretmenin geçmiş ödevleri.
-- -----------------------------------------------------------------------------
create or replace function public.konu_onerileri(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public._ogretmen(p_token);
  return coalesce((
    select jsonb_agg(konu order by adet desc, konu)
    from (
      select v.value #>> '{}' as konu, count(*) as adet
      from public.odevler d
      cross join lateral jsonb_each(coalesce(d.konular, '{}'::jsonb)) v
      where btrim(v.value #>> '{}') <> ''
      group by v.value #>> '{}'
      limit 100
    ) t
  ), '[]'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. YETKİLER (0005 deseni)
-- -----------------------------------------------------------------------------
revoke all on function public.konu_onerileri(text) from public, anon, authenticated;
grant execute on function public.konu_onerileri(text) to anon, authenticated;

grant execute on function public.odev_olustur(text,text,text,uuid,text,date,integer,jsonb,text,text,boolean,smallint,jsonb)
  to anon, authenticated;
grant execute on function public.odev_guncelle(text,uuid,text,text,uuid,date,integer,jsonb,text,text,boolean,smallint,jsonb)
  to anon, authenticated;
grant execute on function public.odev_detay(text, uuid)          to anon, authenticated;
grant execute on function public.ogrenci_odevleri(text)          to anon, authenticated;
grant execute on function public.veli_paneli(text)               to anon, authenticated;
grant execute on function public.odev_gonderimleri(text, uuid)   to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 12. KENDİ KENDİNİ DENETLEME
-- -----------------------------------------------------------------------------
do $$
declare
  v jsonb;
begin
  -- Eski imzalar gerçekten düştü mü
  if to_regprocedure('public.odev_olustur(text,text,text,uuid,text,date,integer,jsonb,text,text,boolean,smallint)') is not null then
    raise exception 'Eski odev_olustur imzası hâlâ ayakta.';
  end if;
  if to_regprocedure('public.odev_guncelle(text,uuid,text,text,uuid,date,integer,jsonb,text,text,boolean,smallint)') is not null then
    raise exception 'Eski odev_guncelle imzası hâlâ ayakta.';
  end if;

  -- Analiz `_puanla` ile aynı kuralı uyguluyor mu: 3 soru, 1 doğru 1 yanlış 1 boş
  v := public._konu_analizi(
         '{"1":"Türev","2":"Türev","3":"Türev"}'::jsonb,
         '{"1":"A","2":"B","3":"C"}'::jsonb,
         '{"1":"A","2":"D"}'::jsonb, 3);
  if (v->0->>'dogru')::int <> 1 or (v->0->>'yanlis')::int <> 1 or (v->0->>'bos')::int <> 1 then
    raise exception 'Konu analizi _puanla ile uyuşmuyor: %', v;
  end if;

  -- Soru dökümü aynı olayı aynı şekilde sınıflandırıyor mu: 2 yanlış, 3 boş
  -- (3 cevapsız, 5 anahtarsız), 1 ve 4 doğru
  v := public._soru_dokumu(
         '{"1":"A","2":"B","3":"C","4":"D"}'::jsonb,
         '{"1":"A","2":"E","4":"D","5":"A"}'::jsonb, 5);
  if v->'yanlis' <> '[2]'::jsonb or v->'bos' <> '[3, 5]'::jsonb then
    raise exception 'Soru dökümü _puanla ile uyuşmuyor: %', v;
  end if;

  raise notice 'Konu eşlemesi, analiz ve soru dökümü hazır.';
end $$;
