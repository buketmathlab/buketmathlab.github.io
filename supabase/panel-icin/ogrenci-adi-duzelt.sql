-- SEKİZ — BİR ÖĞRENCİNİN ADINI DÜZELT
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
--
-- NEDEN PANELDEN: uygulamada kaydedilmiş bir öğrencinin adını değiştiren
-- bir ekran HENÜZ YOK. Bu dosya o boşluğu geçici olarak kapatıyor.
--
-- PASİFLEŞTİRİP YENİDEN EKLEMEYİN. O yolda çocuğun giriş kodu değişir
-- (dağıttığınız kâğıt geçersiz olur) ve ödev/not kayıtları eski, görünmez
-- kayda bağlı kalır. Bu dosya SADECE adı değiştiriyor: kod, numara,
-- ödevler, notlar, veli yazışması — hepsi olduğu gibi kalıyor.
--
-- ## YAPACAĞINIZ TEK ŞEY
--
-- Aşağıdaki `girdi` bloğundaki alanları doldurun. Gerisine dokunmayın.
--
-- Normalde ÜÇÜ yeter: sinif · ogrenci_no · yeni_ad.
-- `eski_ad` yalnız öğrencinin numarası yoksa gerekiyor.
--
--   sinif       → sınıfın adı, tırnak içinde:  '9A'
--   ogrenci_no  → öğrencinin OKUL NUMARASI:    '601'
--                 (numarası yoksa null yazın ve `eski_ad`ı doldurun)
--   eski_ad     → yalnız numara yoksa gerekli: şu an kayıtlı olan yanlış ad
--   yeni_ad     → DOĞRU yazılışı
--
-- ## GÜVENLİK AĞI
--
-- Eşleşme TAM OLARAK BİR öğrenci bulmazsa HİÇBİR ŞEY yazılmaz:
--   · hiç bulunmazsa  → "BULUNAMADI"
--   · birden fazlaysa → "BELİRSİZ"
-- İkisinde de sonuç satırı sınıftaki bütün öğrencileri numaralarıyla
-- listeliyor; aradığınızı oradan bulup numarayı düzeltin.
--
-- Değişiklik DENETİM İZİNE düşüyor: eski ad ve yeni ad birlikte saklanıyor.
--
-- Panelde yalnız SON ifadenin sonucu görünüyor; bu yüzden dosya tek bir
-- ifade ve bir özet satırıyla bitiyor. Ne olduğunu ORADAN okuyun.

with
girdi as (
  select
    -- ↓↓↓ DOLDURULACAK ALANLAR ↓↓↓
    '9A'::text        as sinif,
    '601'::text       as ogrenci_no,
    null::text        as eski_ad,
    'Doğru Ad'::text  as yeni_ad
    -- ↑↑↑ DOLDURULACAK ALANLAR ↑↑↑
),
-- Ad normalleştirmesi: "ALİ  YILMAZ" ile "Ali Yılmaz" aynı kişi sayılsın.
--
-- TÜRKÇE HARFLER ELLE ÇEVRİLİYOR; `lower()` veritabanının diline bağlı ve
-- "İ" harfini bozabiliyor. 0043'teki `_ad_anahtari` de aynı şeyi yapıyor;
-- buradaki kopya BİLEREK: bu onarım dosyası, migration'ların hangi
-- sürümde olduğuna bakmadan çalışabilmeli.
sinifin_ogrencileri as (
  select
    o.id, o.ad, o.ogrenci_no,
    regexp_replace(
      lower(translate(btrim(o.ad), 'İIĞÜŞÖÇ', 'iığüşöç')), '\s+', ' ', 'g'
    ) as anahtar
  from public.ogrenciler o
  join public.siniflar s on s.id = o.sinif_id
  where o.aktif and s.ad = (select sinif from girdi)
),
hedef as (
  select k.*
  from sinifin_ogrencileri k, girdi g
  where
    -- Numara verildiyse numaraya, verilmediyse eski ada bakılıyor.
    case
      when g.ogrenci_no is not null then k.ogrenci_no = g.ogrenci_no
      else k.anahtar = regexp_replace(
             lower(translate(btrim(coalesce(g.eski_ad, '')), 'İIĞÜŞÖÇ', 'iığüşöç')),
             '\s+', ' ', 'g')
    end
    -- Boş ya da aşırı uzun ad yazılmasın: uygulamadaki kuralın aynısı.
    and btrim(coalesce(g.yeni_ad, '')) <> ''
    and length(btrim(g.yeni_ad)) <= 100
),
-- TEK EŞLEŞME ŞARTI. Birden fazla satır eşleşiyorsa hangisinin adı
-- değişeceği belirsiz; belirsizken tahmin etmek YANLIŞ ÇOCUĞUN kaydını
-- değiştirmek demek. O yüzden bu CTE boş kalıyor ve hiçbir şey yazılmıyor.
tekil as (
  select * from hedef where (select count(*) from hedef) = 1
),
guncel as (
  update public.ogrenciler o
     set ad = btrim((select yeni_ad from girdi))
    from tekil t
   where o.id = t.id
  returning o.id, o.ad
),
-- İZ BIRAKIYOR (Part XLIII): "bu çocuğun adı neden değişti" sorusu
-- sonradan sorulacak. Eski ve yeni ad birlikte saklanıyor.
iz as (
  insert into public.denetim_izi (islem, tablo, kayit_id, aktor, eski, yeni)
  select 'ogrenci_adi_duzeltildi', 'ogrenciler', g.id, 'ogretmen',
         jsonb_build_object('ad', t.ad), jsonb_build_object('ad', g.ad)
  from guncel g join tekil t on t.id = g.id
  returning 1
)
select
  case
    when btrim(coalesce((select yeni_ad from girdi), '')) = ''
      then 'BOŞ AD — yeni_ad doldurulmadı, hiçbir şey değişmedi'
    when length(btrim((select yeni_ad from girdi))) > 100
      then 'AD ÇOK UZUN — 100 karakteri aşıyor, hiçbir şey değişmedi'
    when (select count(*) from sinifin_ogrencileri) = 0
      then 'SINIF BULUNAMADI — sınıf adını kontrol edin (örn. 9A)'
    when (select count(*) from hedef) = 0
      then 'ÖĞRENCİ BULUNAMADI — numara/ad eşleşmedi, hiçbir şey değişmedi'
    when (select count(*) from hedef) > 1
      then 'BELİRSİZ — birden fazla öğrenci eşleşti, hiçbir şey değişmedi'
    when (select count(*) from guncel) = 1 then 'DÜZELTİLDİ'
    else 'DEĞİŞMEDİ'
  end                                                        as sonuc,
  (select sinif from girdi)                                  as sinif,
  (select string_agg(ad, ' · ' order by ad) from hedef)      as eski_ad,
  (select string_agg(ad, ' · ' order by ad) from guncel)     as yeni_ad,
  (select count(*) from iz)                                  as iz_yazildi,
  -- BULUNAMADI/BELİRSİZ hâlinde işe yarayan tek şey bu: sınıfta kim var,
  -- numarası ne. Aradığınızı buradan bulup yukarıyı düzeltin.
  (select string_agg(coalesce(ogrenci_no, '—') || ' ' || ad, ' · ' order by ad)
     from sinifin_ogrencileri)                               as siniftakiler;
