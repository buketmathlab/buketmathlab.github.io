-- SEKİZ — 0078: Ödevin her sayfası zorunlu
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Açıklamalı tam sürüm: supabase/migrations/0078_tum_sayfalar_zorunlu.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Ayarlar → Verinizin yedeği)
-- 0077 ÇALIŞMIŞ OLMALI. Edge Function DEĞİŞMİYOR.
--
-- NE YAPIYOR: Bundan sonra oluşturulan ödevlerde öğrenci, ödev kaç
-- sayfaysa TAM o kadar sayfa gönderir; eksik ya da fazla sayfa kabul
-- edilmez. Sayfa sayısı en çok 40 olabilir. Gönderim başladıktan sonra bir
-- ödevin sayfa sayısı değiştirilemez.
--
-- MEVCUT ÖDEVLER VE GÖNDERİMLER DEĞİŞMEZ: daha önce verilmiş ödevler eski
-- kuralla (en fazla N sayfa) sürer.
--
-- Beklenen sonuç: en altta tek satırlık bir tablo (_migration_kaydet → 0078).
-- =============================================================================

do $$
begin
  if to_regprocedure('public.anket_sonuclari(text)') is null then
    raise exception '0078: önce 0077 çalıştırılmalı';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. Şema
-- -----------------------------------------------------------------------------
alter table public.odevler
  add column if not exists tum_sayfalar boolean not null default false;

comment on column public.odevler.tum_sayfalar is
  'true: öğrenci TAM sayfa_limiti kadar sayfa gönderir (her sayfa zorunlu). false: eski kural, en az 1 en fazla sayfa_limiti. (0078)';
comment on column public.odevler.sayfa_limiti is
  'Ödevin sayfa sayısı / öğrencinin göndereceği çözüm sayfası (1–40). (0054; 0078: 40)';

alter table public.odevler drop constraint if exists odevler_sayfa_limiti_araligi;
alter table public.odevler
  add constraint odevler_sayfa_limiti_araligi check (sayfa_limiti between 1 and 40);

alter table public.gonderimler drop constraint if exists gonderimler_ek_sayfa_sayisi;
alter table public.gonderimler
  add constraint gonderimler_ek_sayfa_sayisi
  check (ek_sayfa_yollari is null or cardinality(ek_sayfa_yollari) between 1 and 39);

-- -----------------------------------------------------------------------------
-- 2. _cozum_yolu_gecerli — yol kalıbı 2..40 (gövde: 0054)
-- -----------------------------------------------------------------------------
create or replace function public._cozum_yolu_gecerli(
  p_ogrenci_id uuid,
  p_yol text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_odev_id uuid;
  v_parca   text[];
  v_sayfa   integer;
begin
  -- Beklenen: cozum/<uuid>/<uuid>.<uzanti>          (1. sayfa — 0009'dan beri)
  --       ya: cozum/<uuid>/<uuid>-<2..40>.<uzanti>  (ek sayfa — 0054; 0078: 40'a kadar)
  v_parca := regexp_match(
    p_yol,
    '^cozum/([0-9a-f-]{36})/([0-9a-f-]{36})(?:-([2-9]|[1-3][0-9]|40))?\.(jpg|jpeg|png|webp)$'
  );
  if v_parca is null then
    return false;
  end if;

  -- Yoldaki öğrenci kimliği jetondan gelenle AYNI olmalı. Başka öğrencinin
  -- yoluna yükleme denemesi burada düşer.
  if v_parca[2] <> p_ogrenci_id::text then
    return false;
  end if;

  v_odev_id := v_parca[1]::uuid;
  -- Eksiz yol 1. sayfa. `-1` diye bir ek YOK: kalıp yalnız 2–8'i tanıyor,
  -- yani 1. sayfanın iki farklı yazımı olamaz.
  v_sayfa   := coalesce(v_parca[3]::integer, 1);

  -- Ödev yayında ve öğrencinin sınıfına ait mi?
  return exists (
    select 1
    from public.odevler d
    join public.ogrenciler o on o.id = p_ogrenci_id
    where d.id = v_odev_id
      and d.yayinda
      and d.sinif_id = o.sinif_id
      and o.aktif
      -- 0054: sayfa numarası ödevin sınırını aşamaz. Sınır YÜKLEME
      -- anında da aranıyor, yalnız gönderimde değil: sınırı 2 olan ödevde
      -- öğrenci 3. sayfa için yükleme adresi bile alamaz. Depoya sınırın
      -- ötesinde dosya bırakmanın yolu burada kapanıyor.
      and v_sayfa <= d.sayfa_limiti
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. odev_olustur — yeni ödev tum_sayfalar = true, sınır 40 (gövde: 0054)
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
  p_konular jsonb default null,
  -- 0054: öğrencinin bu ödevde yükleyebileceği görsel sayısı.
  p_sayfa_limiti smallint default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  yeni_id uuid;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  -- Öğretmen yalnız KENDİ sınıfına ödev verebilir.
  if not public._ogretmenin_sinifi(v_ogretmen, p_sinif_id) then
    raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
  end if;

  -- 0054: 1–8. Tablo kısıtı da yakalar, ama kısıtın ham adını öğretmene
  -- göstermemek için burada Türkçe söylüyoruz.
  -- 0078: 1–40 (ödevin sayfa sayısı).
  if coalesce(p_sayfa_limiti, 1) not between 1 and 40 then
    raise exception 'Sayfa sayısı 1 ile 40 arasında olmalı.' using errcode = '22023';
  end if;

  insert into public.odevler
    (baslik, aciklama, sinif_id, tur, son_tarih, soru_sayisi,
     cevap_anahtari, anahtar_url, odev_url, gec_teslim, sik_sayisi, konular, yayinda,
     ogretmen_id, sayfa_limiti, tum_sayfalar)
  values
    (btrim(p_baslik), nullif(btrim(coalesce(p_aciklama, '')), ''), p_sinif_id,
     p_tur, p_son_tarih, p_soru_sayisi, p_cevap_anahtari,
     nullif(btrim(coalesce(p_anahtar_yolu, '')), ''),
     nullif(btrim(coalesce(p_odev_yolu, '')), ''),
     coalesce(p_gec_teslim, true),
     case when coalesce(p_sik_sayisi, 5) = 4 then 4 else 5 end,
     public._konu_temizle(p_konular, p_soru_sayisi),
     false,  -- Taslak olarak başlar; öğretmen onaylamadan öğrenciye düşmez.
     v_ogretmen,
     coalesce(p_sayfa_limiti, 1),
     -- 0078: YENİ ÖDEVDE HER SAYFA ZORUNLU. Öğrenci tam sayfa_limiti kadar
     -- sayfa gönderir; eksik de fazla da kabul edilmez (odev_gonder).
     true)
  returning id into yeni_id;

  perform public._denetim('odev_olusturuldu', 'odevler', yeni_id, public._aktor(v_ogretmen));
  return jsonb_build_object('id', yeni_id, 'yayinda', false);
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. odev_gonder — her sayfa zorunlu (gövde: 0074)
-- -----------------------------------------------------------------------------
create or replace function public.odev_gonder(
  p_token text,
  p_odev uuid,
  p_foto_yolu text,
  p_cevaplar jsonb default null,
  -- 0054: 2. ve sonraki sayfaların yolları, SIRAYLA. null ya da boş dizi
  -- = tek sayfa; bugünkü çağrılar bu parametreyi hiç göndermiyor.
  p_ek_sayfa_yollari text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  d public.odevler;
  s record;
  yeni_id uuid;
  v_ek      text[];
  v_ek_sayi integer;
  i         integer;
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'ogrenci' then
    raise exception 'Yalnızca öğrenci ödev gönderebilir.' using errcode = '42501';
  end if;

  select * into d from public.odevler where id = p_odev and yayinda;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.ogrenciler ogr
    where ogr.id = o.ogrenci_id and ogr.sinif_id = d.sinif_id
  ) then
    raise exception 'Bu ödev sizin sınıfınıza ait değil.' using errcode = '42501';
  end if;

  -- Sınıf arşivdeyse ödev öğretmenin hiçbir ekranında görünmüyor; gönderim
  -- kabul etmek görünmeyen bir iş üretmek olurdu.
  if public._sinif_arsivde(d.sinif_id) then
    raise exception 'Bu sınıf kapatılmış. Öğretmeniniz açana kadar ödev gönderemezsiniz.'
      using errcode = '22023';
  end if;

  -- Geç teslim kapalıysa son tarihten sonra gönderim yok.
  --
  -- 0056: YENİDEN AÇILAN GÖNDERİM İSTİSNA. Platform sahibi bu öğrencinin bu
  -- ödevdeki gönderimini yeniden açtıysa (`gonderimi_yeniden_ac`) öğrenci
  -- süre dolmuş olsa da gönderebilir: yeniden açmanın amacı öğrencinin
  -- mağdur olmaması. Gönderim yine "gecikmeli" görünür — dürüst kayıt.
  if not d.gec_teslim
     and (now() at time zone 'Europe/Istanbul')::date > d.son_tarih
     and not public._gonderim_yeniden_acildi(p_odev, o.ogrenci_id)
     -- 0074: deneme hesabı süresi geçmiş ödeve de gönderebilir (öğretmen
     -- öğrencinin yaşadığını sonradan da deneyebilsin). Kayıt yine dürüst:
     -- gönderim `gecikmeli` görünür.
     and not public._deneme_mi(o.ogrenci_id) then
    raise exception 'Bu ödevin süresi doldu. Öğretmeniniz geç teslime izin vermiyor.'
      using errcode = '22023';
  end if;

  if p_foto_yolu is null or btrim(p_foto_yolu) = '' then
    raise exception 'Çözüm fotoğrafı olmadan ödev gönderilemez.' using errcode = '22023';
  end if;

  -- Yol kendi kimliğini ve bu ödevi taşımalı.
  --
  -- 0054: 1. SAYFA EKSİZ OLMALI. 0054'ten önce `_cozum_yolu_gecerli`
  -- yalnız eksiz yolu tanıdığı için `like` yetiyordu. Artık `-2` gibi ek
  -- sayfa yolları da geçerli ve `like` onları da kabul ederdi. `foto_yolu`
  -- her zaman 1. sayfa — onu okuyan her yer (öğretmen, veli) buna güveniyor.
  if not public._cozum_yolu_gecerli(o.ogrenci_id, btrim(p_foto_yolu))
     or btrim(p_foto_yolu) !~ ('^cozum/' || p_odev::text || '/' || o.ogrenci_id::text
                              || '\.(jpg|jpeg|png|webp)$') then
    raise exception 'Geçersiz dosya yolu.' using errcode = '42501';
  end if;

  -- EK SAYFALAR (0054).
  --
  -- SINIR ÖNCE, YOL SONRA. Öğretmen sınırı öğrenci sayfaları hazırladıktan
  -- sonra düşürmüş olabilir; o zaman fazla sayfanın yolu da geçersizdir ama
  -- öğrenciye söylenecek doğru şey "geçersiz yol" değil, "fazla sayfa".
  v_ek := coalesce(p_ek_sayfa_yollari, '{}'::text[]);
  v_ek_sayi := coalesce(array_length(v_ek, 1), 0);

  if 1 + v_ek_sayi > d.sayfa_limiti then
    raise exception 'Bu ödevde en fazla % sayfa gönderilebilir. Fazla sayfaları çıkarıp tekrar deneyin.',
      d.sayfa_limiti using errcode = '22023';
  end if;

  -- 0078: HER SAYFA ZORUNLU (yeni ödevler). Öğretmenin isteği: "ödev kaç
  -- sayfaysa öğrenci o kadar sayfa göndersin; her sayfayı göndermek
  -- zorunda". Eski ödevlerde (`tum_sayfalar` false) kural değişmedi: en az
  -- 1, en fazla sayfa_limiti.
  if d.tum_sayfalar and 1 + v_ek_sayi < d.sayfa_limiti then
    raise exception 'Bu ödev % sayfa; her sayfanın çözümünü eklemelisin (% sayfa eksik).',
      d.sayfa_limiti, d.sayfa_limiti - 1 - v_ek_sayi using errcode = '22023';
  end if;

  -- SIRA BOŞLUKSUZ: i. ek sayfa TAM OLARAK `-(i+1)` ekini taşımalı.
  -- Böylece aynı sayfa iki kez yazılamaz, sayfa atlanamaz ve öğretmenin
  -- gördüğü sıra öğrencinin gönderdiği sırayla aynıdır.
  for i in 1 .. v_ek_sayi loop
    if v_ek[i] is null
       or btrim(v_ek[i]) !~ ('^cozum/' || p_odev::text || '/' || o.ogrenci_id::text
                            || '-' || (i + 1)::text || '\.(jpg|jpeg|png|webp)$')
       or not public._cozum_yolu_gecerli(o.ogrenci_id, btrim(v_ek[i])) then
      raise exception 'Geçersiz dosya yolu.' using errcode = '42501';
    end if;
    v_ek[i] := btrim(v_ek[i]);
  end loop;

  if d.tur = 'test' then
    select * into s from public._puanla(d.cevap_anahtari, coalesce(p_cevaplar, '{}'::jsonb), d.soru_sayisi);

    insert into public.gonderimler
      (odev_id, ogrenci_id, cevaplar, foto_yolu, ek_sayfa_yollari, dogru, yanlis, bos, puan, durum)
    values
      (p_odev, o.ogrenci_id, p_cevaplar, btrim(p_foto_yolu), nullif(v_ek, '{}'::text[]),
       s.dogru, s.yanlis, s.bos, s.puan, 'puanlandi')
    returning id into yeni_id;

    perform public._denetim('odev_gonderildi', 'gonderimler', yeni_id,
                            'ogrenci:' || o.ogrenci_id);

    return jsonb_build_object(
      'id', yeni_id, 'dogru', s.dogru, 'yanlis', s.yanlis,
      'bos', s.bos, 'puan', s.puan
    );
  else
    insert into public.gonderimler
      (odev_id, ogrenci_id, foto_yolu, ek_sayfa_yollari, durum)
    values
      (p_odev, o.ogrenci_id, btrim(p_foto_yolu), nullif(v_ek, '{}'::text[]), 'incelemede')
    returning id into yeni_id;

    perform public._denetim('odev_gonderildi', 'gonderimler', yeni_id,
                            'ogrenci:' || o.ogrenci_id);

    return jsonb_build_object('id', yeni_id, 'durum', 'incelemede');
  end if;

exception
  when unique_violation then
    raise exception 'Bu ödevi zaten gönderdiniz. Gönderim değiştirilemez.'
      using errcode = '23505';
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. odev_guncelle — sınır 40, gönderim varken sayfa sayısı kilitli (gövde: 0055)
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
  -- 0078: HER SAYFASI ZORUNLU ödevde gönderim başladıktan sonra sayfa
  -- sayısı değişmez. Değişseydi öğrencilerin bir kısmı 6, bir kısmı 8 sayfa
  -- göndermiş olurdu — aynı ödevde iki farklı kural.
  if d.tum_sayfalar and p_sayfa_limiti is not null and p_sayfa_limiti <> d.sayfa_limiti
     and exists (select 1 from public.gonderimler g0 where g0.odev_id = p_id) then
    raise exception 'Bu ödeve gönderim yapıldı; sayfa sayısı artık değiştirilemez.'
      using errcode = '22023';
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
         konular     = public._konu_temizle(coalesce(p_konular, d.konular), yeni_sayi),
         sayfa_limiti = coalesce(p_sayfa_limiti, d.sayfa_limiti)
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
-- 6. odev_kardeslere_yay — bayrak taşınır, gönderimi olan kardeşte korunur (gövde: 0055)
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
           -- 0078: "her sayfa zorunlu" bayrağı da içerik. AMA kardeşte
           -- gönderim varsa ve bayraklardan biri açıksa sayfa kuralı o
           -- kardeşte KORUNUYOR: gönderen öğrencilerle gönderecekler aynı
           -- kurala tabi kalsın (odev_guncelle'deki kilidin aynısı).
           tum_sayfalar   = d.tum_sayfalar,
           konular        = public._konu_temizle(d.konular, d.soru_sayisi),
           anahtar_url    = d.anahtar_url,
           odev_url       = d.odev_url
     where id = k.id;

    if (eski.tum_sayfalar or d.tum_sayfalar)
       and (eski.sayfa_limiti <> d.sayfa_limiti or eski.tum_sayfalar <> d.tum_sayfalar)
       and exists (select 1 from public.gonderimler g0 where g0.odev_id = k.id) then
      update public.odevler
         set sayfa_limiti = eski.sayfa_limiti,
             tum_sayfalar = eski.tum_sayfalar
       where id = k.id;
    end if;

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
-- 7. odev_detay — tum_sayfalar döner (gövde: 0073)
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
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  perform public._odev_sahibi(v_ogretmen, p_id);

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
    'sayfa_limiti', d.sayfa_limiti,
    'tum_sayfalar', d.tum_sayfalar,
    'cevap_anahtari', coalesce(d.cevap_anahtari, '{}'::jsonb),
    'anahtar_yolu', d.anahtar_url,
    'odev_yolu', d.odev_url,
    'yayinda', d.yayinda,
    'kardesler', case when d.grup_id is not null and d.ogretmen_id = v_ogretmen then (
      select coalesce(jsonb_agg(s2.ad order by s2.seviye, s2.sube), '[]'::jsonb)
        from public.odevler d2
        join public.siniflar s2 on s2.id = d2.sinif_id
       where d2.grup_id = d.grup_id and d2.id <> d.id
    ) end,
    'kardes_detay', case when d.grup_id is not null and d.ogretmen_id = v_ogretmen then (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', d2.id,
               'sinif', s2.ad,
               'gonderim_sayisi', (select count(*) from public.gonderimler g
                                    where g.odev_id = d2.id
                                      and not public._deneme_mi(g.ogrenci_id)),
               'anahtar_ayni', (d2.cevap_anahtari is not distinct from d.cevap_anahtari),
               'arsiv', public._sinif_arsivde(d2.sinif_id)
             ) order by s2.seviye, s2.sube), '[]'::jsonb)
        from public.odevler d2
        join public.siniflar s2 on s2.id = d2.sinif_id
       where d2.grup_id = d.grup_id and d2.id <> d.id
    ) end,
    'gonderim_sayisi', (select count(*) from public.gonderimler g where g.odev_id = d.id
                          and not public._deneme_mi(g.ogrenci_id)),
    'gec_gonderim_sayisi', (
      select count(*) from public.gonderimler g
      where g.odev_id = d.id and public._gecikmeli(g.created_at, d.son_tarih)
        and not public._deneme_mi(g.ogrenci_id)
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. odev_sayfa_kurali — öğrenci için {sayfa, tum_sayfalar} (gövde: odev_sayfa_siniri 0054)
-- -----------------------------------------------------------------------------
create or replace function public.odev_sayfa_kurali(p_token text, p_odev_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  d public.odevler;
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'ogrenci' then
    raise exception 'Bu bilgi yalnız öğrenciye açık.' using errcode = '42501';
  end if;

  select * into d from public.odevler where id = p_odev_id and yayinda;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.ogrenciler ogr
    where ogr.id = o.ogrenci_id and ogr.sinif_id = d.sinif_id
  ) then
    raise exception 'Bu ödev sizin sınıfınıza ait değil.' using errcode = '42501';
  end if;

  return jsonb_build_object('sayfa', d.sayfa_limiti, 'tum_sayfalar', d.tum_sayfalar);
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Yetkiler (imzalar değişmedi; yeni uç öğrenciye açık, yetkisini kendisi denetliyor)
-- -----------------------------------------------------------------------------
revoke all on function public._cozum_yolu_gecerli(uuid, text) from public, anon, authenticated;
revoke all on function public.odev_sayfa_kurali(text, uuid) from public, anon, authenticated;
grant execute on function public.odev_sayfa_kurali(text, uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 10. Kendi kendini doğrulama
-- -----------------------------------------------------------------------------
do $$
declare f text;
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'odevler' and column_name = 'tum_sayfalar') then
    raise exception '0078: odevler.tum_sayfalar yok';
  end if;
  if pg_get_constraintdef((select oid from pg_constraint where conname = 'odevler_sayfa_limiti_araligi'))
       not like '%40%' then
    raise exception '0078: sayfa sınırı kısıtı 40 değil';
  end if;
  foreach f in array array['odev_olustur', 'odev_gonder', 'odev_guncelle', 'odev_kardeslere_yay',
                           'odev_detay', 'odev_sayfa_kurali'] loop
    if not exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = f
         and pg_get_functiondef(p.oid) like '%tum_sayfalar%'
    ) then
      raise exception '0078: % gövdesi güncellenmemiş', f;
    end if;
  end loop;
  if pg_get_functiondef('public._cozum_yolu_gecerli(uuid, text)'::regprocedure) not like '%[1-3][0-9]|40%' then
    raise exception '0078: _cozum_yolu_gecerli yol kalıbı 40''a çıkmamış';
  end if;
  if has_function_privilege('anon', 'public._cozum_yolu_gecerli(uuid, text)', 'execute') then
    raise exception '0078: _cozum_yolu_gecerli anon''a açık';
  end if;
end $$;

select public._migration_kaydet('0078');
