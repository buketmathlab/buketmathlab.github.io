-- =============================================================================
-- SEKİZ — ÖĞRENCİ ADI DÜZELTME TESTLERİ
--
-- `panel-icin/ogrenci-adi-duzelt.sql` bir öğrencinin ADINI değiştiriyor.
-- Bu dosyanın ağırlığı "adı değiştiriyor mu"da değil, **BAŞKA HİÇBİR ŞEYE
-- DOKUNMUYOR MU**da (3. grup): giriş kodu, okul numarası, ödev gönderimi
-- ve kaydın kimliği olduğu gibi kalmalı. Kod değişseydi öğrencinin ve
-- velinin elindeki kâğıt sessizce geçersiz olurdu; kimlik değişseydi
-- ödevleri görünmez bir kayda bağlı kalırdı.
--
-- İkinci ağırlık BELİRSİZLİK (5. grup): birden fazla öğrenci eşleşiyorsa
-- hiçbir şey yazılmamalı. Belirsizken tahmin etmek, YANLIŞ ÇOCUĞUN adını
-- değiştirmek demek.
--
-- ## ÖLÇÜLEN ŞEY, ÖĞRETMENİN YAPIŞTIRACAĞI DOSYANIN KENDİSİ
--
-- Test kendi sorgusunu TAŞIMIYOR. Panel dosyasının metnini diskten okuyup
-- yalnız `girdi` bloğundaki üç satırı değiştirerek çalıştırıyor; alttaki
-- bütün mantık dosyanın kendisi. Değiştirmenin GERÇEKTEN olduğu da
-- ölçülüyor (0. grup) — yoksa test, dosyanın varsayılan değerleriyle
-- sessizce boşa dönerdi.
--
-- Dosya depo kökünden okunuyor; `calistir.sh` `SEKIZ_KOK`u veriyor.
-- =============================================================================
\set ON_ERROR_STOP on

\set duzelt_sql `sed 's/;[[:space:]]*$//' "${SEKIZ_KOK:-.}/supabase/panel-icin/ogrenci-adi-duzelt.sql"`

select set_config('sekiz.duzelt_sql', :'duzelt_sql', false) is not null as okundu;

do $$
declare
  dosya  text := coalesce(current_setting('sekiz.duzelt_sql', true), '');
  v_ogr  uuid;
  v_s    uuid;
  v_s2   uuid;
  v_odev uuid;
  ali    uuid;
  ayse   uuid;
  adas_a uuid;
  adas_b uuid;
  komsu  uuid;
  kod_once text;
begin
  if position('ogrenci_adi_duzeltildi' in dosya) = 0 then
    raise exception '0a: panel dosyası okunamadı (% karakter) — SEKIZ_KOK doğru mu?',
      length(dosya);
  end if;

  select id into v_ogr from public.ogretmenler where yonetici;

  insert into public.siniflar (seviye, sube) values (4, 'M')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_s;
  insert into public.siniflar (seviye, sube) values (4, 'N')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_s2;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
  values (v_ogr, v_s), (v_ogr, v_s2) on conflict do nothing;

  delete from public.ogrenciler where sinif_id in (v_s, v_s2);

  -- 4M: adı YANLIŞ girilmiş öğrenci (düzeltilecek), bir numarasız öğrenci,
  -- ve aynı numarayı taşıyan iki adaş (belirsizlik ölçümü için).
  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, ogrenci_no)
  values ('Yanliş Yazilmiş', 'okul', v_s, v_ogr, '401') returning id into ali;
  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, ogrenci_no)
  values ('NUMARASIZ  ÖĞRENCİ', 'okul', v_s, v_ogr, null) returning id into ayse;
  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, ogrenci_no)
  values ('Adaş Biri', 'okul', v_s, v_ogr, '409') returning id into adas_a;
  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, ogrenci_no)
  values ('Adaş Öteki', 'okul', v_s, v_ogr, '409') returning id into adas_b;

  -- 4N'de AYNI numarayı taşıyan başka bir öğrenci: sınıf şartı düşerse
  -- bu çocuğun adı değişir.
  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, ogrenci_no)
  values ('Komşu Sınıftaki', 'okul', v_s2, v_ogr, '401') returning id into komsu;

  insert into public.giris_kodlari (kod, ogrenci_id, rol)
  values ('ADDUZ001', ali, 'ogrenci'), ('ADDUZ002', ali, 'veli');
  select kod into kod_once from public.giris_kodlari
   where ogrenci_id = ali and rol = 'ogrenci';

  -- Düzeltilecek öğrenciye gerçek bir kayıt: gönderimi kaybolmamalı.
  insert into public.odevler (ogretmen_id, sinif_id, baslik, tur, son_tarih, yayinda)
  values (v_ogr, v_s, 'Ad Düzeltme Denemesi', 'acik',
          (now() at time zone 'Europe/Istanbul')::date + 1, true)
  returning id into v_odev;
  insert into public.gonderimler (odev_id, ogrenci_id, foto_yolu)
  values (v_odev, ali, 'test/ad.jpg');

  -- ---------------------------------------------------------------------------
  -- 0. GİRDİ BLOĞU GERÇEKTEN DEĞİŞTİRİLEBİLİYOR MU
  --
  -- Bu olmadan aşağıdaki bütün gruplar dosyanın VARSAYILAN değerleriyle
  -- ('9A', '601') çalışır, hiçbir şey eşleşmez ve "değişmedi" ölçümleri
  -- bedavaya yeşil yanardı. Ölçümün en tehlikeli hâli, ölçmeden geçmesidir.
  -- ---------------------------------------------------------------------------
  if position('-- ↓↓↓ DOLDURULACAK ÜÇ SATIR ↓↓↓' in dosya) = 0
     or position('-- ↑↑↑ DOLDURULACAK ÜÇ SATIR ↑↑↑' in dosya) = 0 then
    raise exception '0b: girdi bloğunun işaretleri bulunamadı — dosya değişmiş';
  end if;
  raise notice '0 OK — panel dosyası okundu, girdi bloğu bulundu';
end $$;

-- Panel dosyasını verilen girdiyle çalıştıran yardımcı.
--
-- FONKSİYON OLARAK YAZILIYOR, blok içinde tekrar tekrar kopyalanmıyor:
-- on bir grubun hepsi AYNI yoldan geçsin, biri ötekinden ayrışmasın.
create or replace function pg_temp._duzelt(
  p_sinif text, p_no text, p_eski_ad text, p_yeni_ad text
) returns record language plpgsql as $$
declare
  dosya text := coalesce(current_setting('sekiz.duzelt_sql', true), '');
  sorgu text;
  r record;
begin
  sorgu := regexp_replace(
    dosya,
    '(-- ↓↓↓ DOLDURULACAK ÜÇ SATIR ↓↓↓).*?(-- ↑↑↑ DOLDURULACAK ÜÇ SATIR ↑↑↑)',
    E'\\1\n' || format(
      '%L::text as sinif, %L::text as ogrenci_no, %L::text as eski_ad, %L::text as yeni_ad',
      p_sinif, p_no, p_eski_ad, p_yeni_ad
    ) || E'\n\\2',
    'sg'
  );
  -- DEĞİŞTİRME GERÇEKTEN OLDU MU. Olmadıysa dosyanın varsayılanları
  -- çalışır ve test yanlış bir şeyi ölçer.
  if position(p_yeni_ad in sorgu) = 0 then
    raise exception 'girdi bloğu değiştirilemedi — panel dosyasının işaretleri mi değişti?';
  end if;
  execute sorgu into r;
  return r;
end;
$$;

do $$
declare
  v_s uuid; v_s2 uuid;
  ali uuid; ayse uuid; adas_a uuid; komsu uuid;
  r record;
  -- `eski`/`yeni` diye değişken TANIMLANMIYOR: `denetim_izi`nin sütunları
  -- da öyle adlanıyor ve plpgsql "column reference is ambiguous" diyor.
  n integer; t text;
begin
  select id into v_s  from public.siniflar where seviye = 4 and sube = 'M';
  select id into v_s2 from public.siniflar where seviye = 4 and sube = 'N';
  select id into ali    from public.ogrenciler where sinif_id = v_s and ogrenci_no = '401';
  select id into ayse   from public.ogrenciler where sinif_id = v_s and ogrenci_no is null;
  select id into adas_a from public.ogrenciler where sinif_id = v_s and ad = 'Adaş Biri';
  select id into komsu  from public.ogrenciler where sinif_id = v_s2;

  -- ---------------------------------------------------------------------------
  -- 1. BAŞLANGIÇ (pozitif kontrol)
  -- ---------------------------------------------------------------------------
  select count(*) into n from public.ogrenciler where sinif_id = v_s and aktif;
  if n <> 4 then raise exception '1a: 4M''de 4 öğrenci bekleniyordu, %', n; end if;
  if (select ad from public.ogrenciler where id = ali) is distinct from 'Yanliş Yazilmiş' then
    raise exception '1b: kurulum yanlış';
  end if;
  raise notice '1 OK — dünya kuruldu';

  -- ---------------------------------------------------------------------------
  -- 2. NUMARAYLA DÜZELTME
  -- ---------------------------------------------------------------------------
  select * into r from pg_temp._duzelt('4M', '401', null, 'Yanlış Yazılmış')
    as (sonuc text, sinif text, eski_ad text, yeni_ad text, iz_yazildi bigint,
        siniftakiler text);
  if r.sonuc is distinct from 'DÜZELTİLDİ' then
    raise exception '2a: sonuç "%" — DÜZELTİLDİ bekleniyordu', r.sonuc;
  end if;
  select ad into t from public.ogrenciler where id = ali;
  if t <> 'Yanlış Yazılmış' then
    raise exception '2b: ad düzelmedi: %', t;
  end if;
  -- `is distinct from`, `<>` DEĞİL: bu alanlar NULL olabilir ve
  -- `NULL <> 'x'` TRUE değil NULL döner — yani `<>` ile yazılmış bir
  -- kontrol, alan boş geldiğinde SESSİZCE geçer.
  if r.eski_ad is distinct from 'Yanliş Yazilmiş'
     or r.yeni_ad is distinct from 'Yanlış Yazılmış' then
    raise exception '2c: özet eski/yeni adı doğru söylemiyor: % → %', r.eski_ad, r.yeni_ad;
  end if;
  raise notice '2 OK — ad numarayla bulunup düzeltildi, özet doğru';

  -- ---------------------------------------------------------------------------
  -- 3. BAŞKA HİÇBİR ŞEY DEĞİŞMEDİ  ← BU DOSYANIN ASIL ÖLÇÜMÜ
  -- ---------------------------------------------------------------------------
  if not exists (select 1 from public.giris_kodlari
                  where ogrenci_id = ali and rol = 'ogrenci' and kod = 'ADDUZ001') then
    raise exception '3a: GİRİŞ KODU değişti — dağıtılmış kâğıt geçersiz olurdu';
  end if;
  select count(*) into n from public.giris_kodlari where ogrenci_id = ali;
  if n <> 2 then raise exception '3b: kod sayısı % oldu', n; end if;
  -- BURADA `<>` YETMİYOR ve bu ölçülerek bulundu: güncelleme numarayı
  -- NULL'a çekecek şekilde bozulduğunda `NULL <> '401'` NULL döndü,
  -- kontrol hiç ateşlemedi ve kusuru başka bir grup yakaladı. Bir ölçüm,
  -- yakalaması gereken kusuru başkasına bırakıyorsa kendi işini görmüyor.
  if (select ogrenci_no from public.ogrenciler where id = ali)
     is distinct from '401' then
    raise exception '3c: okul numarası değişti';
  end if;
  if not exists (select 1 from public.gonderimler where ogrenci_id = ali) then
    raise exception '3d: ödev gönderimi koptu';
  end if;
  if not exists (select 1 from public.ogrenciler where id = ali and aktif) then
    raise exception '3e: kayıt pasifleşmiş ya da kimliği değişmiş';
  end if;
  raise notice '3 OK — kod, numara, gönderim ve kimlik olduğu gibi';

  -- ---------------------------------------------------------------------------
  -- 4. DENETİM İZİ (Part XLIII) — eski ve yeni adla
  -- ---------------------------------------------------------------------------
  if not exists (
    select 1 from public.denetim_izi
    where islem = 'ogrenci_adi_duzeltildi' and kayit_id = ali
      and eski->>'ad' = 'Yanliş Yazilmiş' and yeni->>'ad' = 'Yanlış Yazılmış'
  ) then
    raise exception '4a: düzeltme denetim izine eski/yeni adla yazılmadı';
  end if;
  raise notice '4 OK — düzeltme izde, eski ve yeni adıyla';

  -- ---------------------------------------------------------------------------
  -- 5. BELİRSİZ EŞLEŞME — HİÇBİR ŞEY YAZILMIYOR
  -- ---------------------------------------------------------------------------
  select * into r from pg_temp._duzelt('4M', '409', null, 'Olmamalı')
    as (sonuc text, sinif text, eski_ad text, yeni_ad text, iz_yazildi bigint,
        siniftakiler text);
  if r.sonuc not like 'BELİRSİZ%' then
    raise exception '5a: sonuç "%" — BELİRSİZ bekleniyordu', r.sonuc;
  end if;
  if exists (select 1 from public.ogrenciler where sinif_id = v_s and ad = 'Olmamalı') then
    raise exception '5b: belirsiz eşleşmede ad yazılmış';
  end if;
  if r.iz_yazildi <> 0 then raise exception '5c: belirsizken iz yazılmış'; end if;
  raise notice '5 OK — iki adaşta hiçbir şey değişmedi';

  -- ---------------------------------------------------------------------------
  -- 6. BULUNAMADI — ve sınıf dökümü yardıma geliyor
  -- ---------------------------------------------------------------------------
  select * into r from pg_temp._duzelt('4M', '999', null, 'Olmamalı')
    as (sonuc text, sinif text, eski_ad text, yeni_ad text, iz_yazildi bigint,
        siniftakiler text);
  if r.sonuc not like 'ÖĞRENCİ BULUNAMADI%' then
    raise exception '6a: sonuç "%"', r.sonuc;
  end if;
  -- Öğretmenin elinde kalan tek şey bu döküm: aradığını oradan bulacak.
  if r.siniftakiler is null or position('401' in r.siniftakiler) = 0 then
    raise exception '6b: sınıf dökümü gelmedi ya da eksik: %', r.siniftakiler;
  end if;
  raise notice '6 OK — bulunamayınca sınıfta kim var, numarasıyla yazılıyor';

  -- ---------------------------------------------------------------------------
  -- 7. NUMARASIZ ÖĞRENCİ, ESKİ ADIYLA BULUNUYOR (Türkçe büyük harf)
  -- ---------------------------------------------------------------------------
  select * into r from pg_temp._duzelt('4M', null, 'numarasız öğrenci', 'Numarasız Öğrenci')
    as (sonuc text, sinif text, eski_ad text, yeni_ad text, iz_yazildi bigint,
        siniftakiler text);
  if r.sonuc is distinct from 'DÜZELTİLDİ' then
    raise exception '7a: sonuç "%" — numarasız öğrenci adıyla bulunmalıydı', r.sonuc;
  end if;
  if (select ad from public.ogrenciler where id = ayse) is distinct from 'Numarasız Öğrenci' then
    raise exception '7b: numarasız öğrencinin adı düzelmedi';
  end if;
  raise notice '7 OK — numarasız öğrenci eski adıyla bulundu (büyük harf ve çift boşluk sorun değil)';

  -- ---------------------------------------------------------------------------
  -- 8. KOMŞU SINIFA DOKUNULMADI
  --
  -- 4N'de de 401 numaralı bir öğrenci var; sınıf şartı düşseydi onun adı
  -- değişirdi.
  -- ---------------------------------------------------------------------------
  if (select ad from public.ogrenciler where id = komsu) is distinct from 'Komşu Sınıftaki' then
    raise exception '8a: komşu sınıftaki aynı numaralı öğrencinin adı değişti';
  end if;
  raise notice '8 OK — komşu sınıftaki aynı numaralı öğrenciye dokunulmadı';

  -- ---------------------------------------------------------------------------
  -- 9. BOŞ VE AŞIRI UZUN AD REDDEDİLİYOR
  -- ---------------------------------------------------------------------------
  select * into r from pg_temp._duzelt('4M', '401', null, '   ')
    as (sonuc text, sinif text, eski_ad text, yeni_ad text, iz_yazildi bigint,
        siniftakiler text);
  if r.sonuc not like 'BOŞ AD%' then raise exception '9a: sonuç "%"', r.sonuc; end if;
  if (select ad from public.ogrenciler where id = ali) is distinct from 'Yanlış Yazılmış' then
    raise exception '9b: boş ad yazılmış';
  end if;

  select * into r from pg_temp._duzelt('4M', '401', null, repeat('A', 101))
    as (sonuc text, sinif text, eski_ad text, yeni_ad text, iz_yazildi bigint,
        siniftakiler text);
  if r.sonuc not like 'AD ÇOK UZUN%' then raise exception '9c: sonuç "%"', r.sonuc; end if;
  if (select ad from public.ogrenciler where id = ali) is distinct from 'Yanlış Yazılmış' then
    raise exception '9d: 101 karakterlik ad yazılmış';
  end if;
  raise notice '9 OK — boş ve 100''den uzun ad reddedildi, kayıt değişmedi';

  -- ---------------------------------------------------------------------------
  -- 10. YANLIŞ SINIF ADI — anlaşılır bir cevap
  -- ---------------------------------------------------------------------------
  select * into r from pg_temp._duzelt('4X', '401', null, 'Olmamalı')
    as (sonuc text, sinif text, eski_ad text, yeni_ad text, iz_yazildi bigint,
        siniftakiler text);
  if r.sonuc not like 'SINIF BULUNAMADI%' then
    raise exception '10a: sonuç "%" — sınıf yokken açık bir cevap bekleniyordu', r.sonuc;
  end if;
  raise notice '10 OK — olmayan sınıf için anlaşılır cevap';

  -- ---------------------------------------------------------------------------
  -- 11. AYNI DOSYAYI TEKRAR ÇALIŞTIRMAK ZARARSIZ
  -- ---------------------------------------------------------------------------
  select * into r from pg_temp._duzelt('4M', '401', null, 'Yanlış Yazılmış')
    as (sonuc text, sinif text, eski_ad text, yeni_ad text, iz_yazildi bigint,
        siniftakiler text);
  if (select ad from public.ogrenciler where id = ali) is distinct from 'Yanlış Yazılmış' then
    raise exception '11a: ikinci çalıştırma adı bozdu';
  end if;
  select count(*) into n from public.ogrenciler where sinif_id = v_s and aktif;
  if n <> 4 then raise exception '11b: öğrenci sayısı değişti: %', n; end if;
  raise notice '11 OK — aynı düzeltme ikinci kez zararsız';

  -- TEMİZLİK
  delete from public.gonderimler g using public.ogrenciler o
    where g.ogrenci_id = o.id and o.sinif_id in (v_s, v_s2);
  delete from public.odevler where sinif_id = v_s;
  delete from public.ogrenciler where sinif_id in (v_s, v_s2);
  delete from public.denetim_izi where islem = 'ogrenci_adi_duzeltildi';

  raise notice '';
  raise notice 'AD DÜZELTME TESTLERİ: 11 GRUP GEÇTİ';
end $$;
