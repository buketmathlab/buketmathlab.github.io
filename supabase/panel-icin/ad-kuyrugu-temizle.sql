-- SEKİZ — ADIN SONUNA YAPIŞMIŞ SÜTUNLARI TEMİZLE
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
--
-- NE OLDU: e-Okul sınıf listesinde addan sonra sütunlar geliyor — önce
-- CİNSİYET, okulda pansiyon varsa sonra YATILILIK DURUMU. Ayrıştırıcı
-- "cinsiyet satırın sonunda" varsayıyordu; arkasına bir sütun daha
-- gelince kesemedi ve ikisi birden adın içinde kaldı:
--
--   PDF'te:   AYŞE SARI
--   SEKİZ'de: Ayşe Sarı Kız Yatılı
--
-- Pansiyon sütunu YALNIZ yatılı öğrencilerde dolu olduğu için otuz
-- kişilik bir listede tek çocukta göründü. Bu dosya, daha önce aktarılmış
-- bütün sınıflarda aynı kuyruğu arayıp temizliyor.
--
-- ## İKİ ADIMDA ÇALIŞIR
--
-- 1. OLDUĞU GİBİ ÇALIŞTIRIN. `sadece_bak = true` — HİÇBİR ŞEY
--    DEĞİŞMEZ. Yalnız "şu ad → şu ada dönecek" listesini gösterir.
-- 2. Listeyi okuyun. Doğruysa `sadece_bak` satırını `false` yapıp
--    tekrar çalıştırın; düzeltme o zaman yazılır.
--
-- ## BİR ÖNERİYİ İSTEMİYORSANIZ
--
-- Soyadı gerçekten "Erkek" olan bir öğrenci varsa bu dosya onu da kuyruk
-- sanar — satıra bakarak ayırt etmek mümkün değil, ikisi de aynı kelime.
-- O yüzden ÖNCE BAKIYORSUNUZ. İstemediğiniz satırın okul numarasını
-- `atlanacak_numaralar` listesine yazın:
--
--   array['615', '627']::text[]
--
-- Değişiklik DENETİM İZİNE düşüyor: eski ad ve yeni ad birlikte saklanıyor.
-- Yalnız ADI değiştiriyor — giriş kodu, okul numarası, ödevler, notlar ve
-- veli yazışması olduğu gibi kalıyor.
--
-- Panelde yalnız SON ifadenin sonucu görünüyor; dosya tek bir ifade ve
-- satır satır bir tabloyla bitiyor. İlk satır özet.

with
girdi as (
  select
    -- ↓↓↓ DOLDURULACAK ALANLAR ↓↓↓
    true::boolean   as sadece_bak,
    '{}'::text[]    as atlanacak_numaralar
    -- ↑↑↑ DOLDURULACAK ALANLAR ↑↑↑
),
-- AD OLMAYAN SÜTUN DEĞERLERİ, Türkçe küçük harfle.
--
-- Ayrıştırıcıdaki listenin aynısı. Bu onarım dosyası kendi kopyasını
-- BİLEREK taşıyor: migration'ların hangi sürümde olduğuna bakmadan
-- çalışabilmeli.
kuyruk as (
  select array[
    'kız', 'erkek',
    'yatılı', 'gündüzlü', 'pansiyonlu', 'pansiyon',
    'parasız', 'paralı', 'burslu', 'taşımalı'
  ]::text[] as sozler
),
ogr as (
  select
    o.id, o.ad, o.ogrenci_no,
    coalesce(s.ad, '(sınıfsız)') as sinif,
    regexp_split_to_array(btrim(o.ad), '\s+') as p
  from public.ogrenciler o
  left join public.siniflar s on s.id = o.sinif_id
  where o.aktif
),
-- SON GERÇEK KELİMENİN SIRASI.
--
-- Adı kelimelere bölüp, sütun değeri OLMAYAN en son kelimenin sırasını
-- buluyoruz; ondan sonrası kuyruktur. Kelime kelime çalışıyor, dizgi
-- kırpmayla değil: "Kızılkaya" gibi bir soyadı, içinde "kız" geçtiği
-- için kırpılmasın.
--
-- TÜRKÇE HARFLER ELLE ÇEVRİLİYOR: `lower()` veritabanının diline bağlı ve
-- "İ" harfini bozabiliyor; `lower(x, 'tr')` diye bir şey de yok.
kes as (
  select
    g.*,
    coalesce((
      select max(i)
      from unnest(g.p) with ordinality u(k, i)
      -- `all (select unnest(...))` biçimi: `all ((select dizi))` yazılırsa
      -- PostgreSQL bunu "alt sorgu" sanıp satırları dizi olarak okuyor ve
      -- "operator does not exist: text <> text[]" diyor.
      where lower(translate(k, 'İIĞÜŞÖÇ', 'iığüşöç'))
            <> all (select unnest(q.sozler) from kuyruk q)
    ), 0) as son
  from ogr g
),
aday as (
  select
    k.id, k.ad, k.ogrenci_no, k.sinif,
    array_to_string(k.p[1:k.son], ' ') as yeni_ad
  from kes k, girdi g
  where
    -- Adın TAMAMI sütun değeri olamaz: geriye bir şey kalmıyorsa
    -- dokunmuyoruz. Böyle bir kayıt varsa onu elle bakmak gerekir.
    k.son > 0
    -- Kırpılacak bir şey var mı.
    and k.son < coalesce(array_length(k.p, 1), 0)
    -- Öğretmenin hariç tuttukları.
    and not (coalesce(k.ogrenci_no, '') = any (g.atlanacak_numaralar))
),
guncel as (
  update public.ogrenciler o
     set ad = a.yeni_ad
    from aday a, girdi g
   where o.id = a.id
     and g.sadece_bak = false
  returning o.id, o.ad
),
-- İZ BIRAKIYOR (Part XLIII): "bu çocuğun adı neden değişti" sorusu
-- sonradan sorulacak.
iz as (
  insert into public.denetim_izi (islem, tablo, kayit_id, aktor, eski, yeni)
  select 'ogrenci_adi_duzeltildi', 'ogrenciler', u.id, 'ogretmen',
         jsonb_build_object('ad', a.ad), jsonb_build_object('ad', u.ad)
  from guncel u join aday a on a.id = u.id
  returning 1
)
select
  '0 · ÖZET'   as bolum,
  null::text   as sinif,
  null::text   as numara,
  null::text   as eski_ad,
  null::text   as yeni_ad,
  case
    when (select sadece_bak from girdi) then
      format('%s adda kuyruk bulundu · HİÇBİR ŞEY DEĞİŞMEDİ — düzeltmek için sadece_bak satırını false yapıp tekrar çalıştırın',
             (select count(*) from aday))
    else
      format('%s adda kuyruk bulundu · %s tanesi düzeltildi · %s iz yazıldı',
             (select count(*) from aday),
             (select count(*) from guncel),
             (select count(*) from iz))
  end          as aciklama
union all
select
  '1 · AD',
  a.sinif,
  coalesce(a.ogrenci_no, '—'),
  a.ad,
  a.yeni_ad,
  case when (select sadece_bak from girdi) then 'dönecek' else 'döndü' end
from aday a
order by 1, 2, 4;
