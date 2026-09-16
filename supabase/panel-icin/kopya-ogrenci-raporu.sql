-- SEKİZ — KOPYA ÖĞRENCİ RAPORU
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
--
-- BU DOSYA HİÇBİR ŞEYİ SİLMEZ, DEĞİŞTİRMEZ. Yalnız bakar ve bir tablo
-- döndürür. Silme dosyasını çalıştırmadan ÖNCE bunu okuyun.
--
-- NE OLDU: Öğrenciler önce numarasız eklendi; sonra aynı liste
-- numaralarla yeniden yüklenince her öğrenci İKİ kez kaydoldu — biri
-- numarasız (eski), biri numaralı (yeni).
--
-- NE YAPACAĞIZ: numarasız kopyaları sileceğiz, numaralı olanları
-- tutacağız. Ama YALNIZ hiç kullanılmamış olanları: bir kopyaya ödev,
-- not, mesaj, ödeme ya da veli onayı bağlanmışsa ona DOKUNULMAYACAK ve
-- aşağıda "KORUNACAK" diye listelenecek. Kararı siz verirsiniz.
--
-- ## Neden tek bir sorgu
--
-- Supabase panelinde yalnız SON ifadenin sonucu görünüyor. Raporu dört
-- ayrı `select` olarak yazsaydık siz yalnız sonuncuyu görürdünüz —
-- 0041/0042'de "NULL" görmenizin sebebi de buydu. Bu yüzden her şey tek
-- tabloda, `bolum` sütunuyla ayrılmış hâlde dönüyor.
--
-- İLK SATIRDAN BAŞLAYIN: `0 · ÖZET` tek cümlede ne olacağını söylüyor.
-- Altındaki bölümler sınıf sınıf ayrıntı:
--   1 · SINIF DURUMU · 2 · SİLİNECEK · 3 · KORUNACAK (kullanılmış)

with
-- Ad normalleştirmesi: "ALİ  YILMAZ" ile "Ali Yılmaz" aynı kişi sayılsın.
--
-- TÜRKÇE HARFLER ELLE ÇEVRİLİYOR. `lower()` veritabanının diline bağlı ve
-- "İ" harfini bozabiliyor; `translate` ile önce Türkçe büyük harfler
-- karşılıklarına çevriliyor, kalan ASCII'yi `lower()` hallediyor. Böylece
-- sonuç dil ayarından bağımsız.
ogr as (
  select
    o.id, o.ad, o.sinif_id, o.ogrenci_no,
    regexp_replace(
      lower(translate(btrim(o.ad), 'İIĞÜŞÖÇ', 'iığüşöç')), '\s+', ' ', 'g'
    ) as anahtar
  from public.ogrenciler o
  where o.aktif
),
-- Bir öğrenci KULLANILMIŞ mı: ona bağlı gerçek bir kayıt var mı.
--
-- `giris_kodlari` BİLEREK sayılmıyor: her öğrenciyle birlikte
-- kendiliğinden üretiliyor, "kullanıldı" demek değil.
kullanim as (
  select
    o.id,
    (select count(*) from public.gonderimler   x where x.ogrenci_id = o.id) as gonderim,
    (select count(*) from public.mesajlar      x where x.ogrenci_id = o.id) as mesaj,
    (select count(*) from public.dersler       x where x.ogrenci_id = o.id) as ders,
    (select count(*) from public.odemeler      x where x.ogrenci_id = o.id) as odeme,
    (select count(*) from public.okundu        x where x.ogrenci_id = o.id) as okundu,
    (select count(*) from public.veli_onaylari x where x.ogrenci_id = o.id) as onam,
    (select count(*) from public.oturumlar     x where x.ogrenci_id = o.id) as oturum
  from ogr o
),
kopya as (
  select o.*,
    (k.gonderim + k.mesaj + k.ders + k.odeme + k.okundu + k.onam + k.oturum) as kullanim_sayisi
  from ogr o
  join kullanim k on k.id = o.id
  where o.ogrenci_no is null
    and exists (
      select 1 from ogr t
      where t.sinif_id is not distinct from o.sinif_id
        and t.ogrenci_no is not null
        and t.anahtar = o.anahtar
    )
),
sinif_durum as (
  select
    '1 · SINIF DURUMU' as bolum,
    coalesce(s.ad, '(sınıfsız)') as sinif,
    null::text as ogrenci,
    format('toplam %s · numaralı %s · numarasız %s',
           count(*),
           count(*) filter (where o.ogrenci_no is not null),
           count(*) filter (where o.ogrenci_no is null)) as aciklama
  from ogr o
  left join public.siniflar s on s.id = o.sinif_id
  group by s.ad
),
silinecek as (
  select
    '2 · SİLİNECEK' as bolum,
    coalesce(s.ad, '(sınıfsız)') as sinif,
    null::text as ogrenci,
    format('%s kopya (numarasız, ikizi var, hiç kullanılmamış)', count(*)) as aciklama
  from kopya k
  left join public.siniflar s on s.id = k.sinif_id
  where k.kullanim_sayisi = 0
  group by s.ad
),
korunacak as (
  select
    '3 · KORUNACAK (kullanılmış)' as bolum,
    coalesce(s.ad, '(sınıfsız)') as sinif,
    k.ad as ogrenci,
    format('%s bağlı kayıt var — DOKUNULMAYACAK', k.kullanim_sayisi) as aciklama
  from kopya k
  left join public.siniflar s on s.id = k.sinif_id
  where k.kullanim_sayisi > 0
),
ozet as (
  select
    -- ÖZET EN BAŞTA: sınıf sayısı çoksa tablo uzuyor, en önemli satırın
    -- aşağıda kaybolmaması için `0` ile başlıyor.
    '0 · ÖZET' as bolum,
    null::text as sinif,
    null::text as ogrenci,
    format('şimdi %s aktif · silinecek %s · korunacak %s · sonra %s aktif',
           (select count(*) from ogr),
           (select count(*) from kopya where kullanim_sayisi = 0),
           (select count(*) from kopya where kullanim_sayisi > 0),
           (select count(*) from ogr) - (select count(*) from kopya where kullanim_sayisi = 0)
    ) as aciklama
)
select * from ozet
union all select * from sinif_durum
union all select * from silinecek
union all select * from korunacak
order by 1, 2 nulls last, 3 nulls last;
