-- SEKİZ — KOPYA ÖĞRENCİLERİ SİL
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Yedek)
-- ÖNCE `kopya-ogrenci-raporu.sql` DOSYASINI ÇALIŞTIRIP OKUYUN.
--
-- BU DOSYA SİLER. Geri alma yolu yedektir.
--
-- ## Neyi siler, neyi ASLA silmez
--
-- Bir kaydı yalnız ÜÇ ŞART BİRDEN tutuyorsa siler:
--
--   1. Numarası YOK (`ogrenci_no is null`) — yani eski, numarasız kayıt.
--   2. Aynı sınıfta, aynı adda, NUMARALI ve aktif bir ikizi var.
--   3. HİÇ KULLANILMAMIŞ: ödev gönderimi, mesaj, ders, ödeme, okundu
--      işareti, veli onayı ve oturum kaydı — hiçbirinde tek satırı yok.
--
-- ÜÇÜNCÜ ŞART GÜVENLİK AĞIDIR. "Kullanılmadı" bilgisine değil, ölçüme
-- dayanıyor: kullanılmış bir kopya varsa ona DOKUNULMUYOR. Öyle bir satır
-- varsa rapor dosyası onu "KORUNACAK" diye gösterir ve karar sizindir.
--
-- `giris_kodlari` KULLANIM SAYILMIYOR: her öğrenciyle birlikte
-- kendiliğinden üretiliyor. Silinen öğrencinin kodları da onunla birlikte
-- gider (şemadaki `on delete cascade`), başkasınınki durur.
--
-- TEKRAR ÇALIŞTIRMAK ZARARSIZ: ikinci çalıştırmada silinecek bir şey
-- kalmaz ve özet "0 silindi" der.
--
-- ## Neden tek bir sorguyla bitiyor
--
-- Supabase panelinde yalnız SON ifadenin sonucu görünür. Bu yüzden dosya
-- bir özet tablosuyla bitiyor — ne olduğunu ORADAN okuyun.

-- Silinenleri ve sonuçları aynı ifade içinde toplayıp özet döndürüyoruz:
-- ayrı `delete` + ayrı `select` yazsaydık, silme ile özet arasında
-- veritabanı değişebilir ve özet olanı anlatmazdı.
with
ogr as (
  select
    o.id, o.ad, o.sinif_id, o.ogrenci_no,
    -- Türkçe harfler elle çevriliyor; `lower()` veritabanının diline bağlı
    -- ve "İ" harfini bozabiliyor.
    regexp_replace(
      lower(translate(btrim(o.ad), 'İIĞÜŞÖÇ', 'iığüşöç')), '\s+', ' ', 'g'
    ) as anahtar
  from public.ogrenciler o
  where o.aktif
),
silinecek as (
  select o.id, o.sinif_id
  from ogr o
  where o.ogrenci_no is null
    -- 2. şart: numaralı ikizi var
    and exists (
      select 1 from ogr t
      where t.sinif_id is not distinct from o.sinif_id
        and t.ogrenci_no is not null
        and t.anahtar = o.anahtar
    )
    -- 3. şart: hiç kullanılmamış
    and not exists (select 1 from public.gonderimler   x where x.ogrenci_id = o.id)
    and not exists (select 1 from public.mesajlar      x where x.ogrenci_id = o.id)
    and not exists (select 1 from public.dersler       x where x.ogrenci_id = o.id)
    and not exists (select 1 from public.odemeler      x where x.ogrenci_id = o.id)
    and not exists (select 1 from public.okundu        x where x.ogrenci_id = o.id)
    and not exists (select 1 from public.veli_onaylari x where x.ogrenci_id = o.id)
    and not exists (select 1 from public.oturumlar     x where x.ogrenci_id = o.id)
),
silinen as (
  delete from public.ogrenciler o
  using silinecek s
  where o.id = s.id
  returning o.id, o.sinif_id
),
-- İZ BIRAKIYOR (Part XLIII). Toplu bir temizlik de denetim izine geçmeli;
-- "sınıf mevcudu neden değişti" sorusu sonradan sorulacak.
iz as (
  insert into public.denetim_izi (islem, tablo, kayit_id, aktor)
  select 'ogrenci_kopya_silindi', 'ogrenciler', s.id, 'ogretmen'
  from silinen s
  returning 1
)
select
  (select count(*) from silinen)                        as silindi,
  (select count(*) from iz)                             as iz_yazildi,
  (select count(*) from public.ogrenciler where aktif)
    - (select count(*) from silinen)                    as kalan_aktif,
  coalesce((
    select string_agg(format('%s: %s', sn.ad, x.adet), ' · ' order by sn.ad)
    from (select sinif_id, count(*) as adet from silinen group by sinif_id) x
    left join public.siniflar sn on sn.id = x.sinif_id
  ), 'hiçbir şey silinmedi')                            as sinif_kirilimi;
