-- =============================================================================
-- SEKİZ — 0018 sinif_kodlari KALDIRILIYOR
--
-- ÖĞRETMENİN İSTEĞİ:
--   "Kodları göster dediğimde tüm öğrencilerin kodları açık olmasın. O
--    sınıftaki tüm öğrencilerin isimleri yazılı olsun, hangi öğrencinin /
--    velinin kodunu istiyorsam öğrencinin üzerine tıklayayım, gözüksün. Bir
--    öğrenciye kodunu gösterirken diğer öğrencilerin kodunu göremesin."
--
-- 0017'de yazdığım `sinif_kodlari` bir SINIFIN TÜM KODLARINI tek yanıtta
-- döndürüyordu. Bu istekle birlikte o uç yalnız gereksiz değil, YANLIŞ:
-- ekranda tek öğrenciyi gösterip diğerlerini gizleseydim kodlar yine
-- tarayıcıya inmiş, ağ yanıtında durmuş olurdu. Geliştirici araçlarını açan
-- ya da öğretmenin omzundan bakan biri hepsini görebilirdi.
--
-- Bu, cevap anahtarında en baştan reddettiğimiz desenin aynısı (Part XXI):
-- gizleme arayüzde yapılmaz, veri hiç gönderilmez.
--
-- ÇÖZÜM YENİ KOD DEĞİL, VAR OLAN UÇ: `ogrenci_kodlari(p_token, p_id)`
-- (0004'ten beri var). Arayüz öğrenciye dokunulduğunda yalnız O ÖĞRENCİ için
-- çağırıyor. Diğerlerinin kodu sunucudan hiç çıkmıyor.
--
-- Kullanılmayan bir ucu ayakta bırakmıyoruz: bir sınıfın tüm kimlik
-- bilgilerini döndüren, hiçbir ekranın çağırmadığı bir fonksiyon yalnızca
-- saldırı yüzeyidir.
--
-- Bu dosya tekrar çalıştırılabilir.
-- =============================================================================

drop function if exists public.sinif_kodlari(text, uuid);

do $$
begin
  if to_regprocedure('public.sinif_kodlari(text, uuid)') is not null then
    raise exception 'sinif_kodlari hâlâ duruyor; kaldırılamadı.';
  end if;
  -- Yerine geçen uç yerinde mi (yanlışlıkla ikisini birden kaldırmayalım)
  if to_regprocedure('public.ogrenci_kodlari(text, uuid)') is null then
    raise exception 'ogrenci_kodlari yok; kod gösterecek uç kalmadı.';
  end if;
  raise notice 'sinif_kodlari kaldırıldı; kodlar artık yalnız ogrenci_kodlari ile, tek tek.';
end $$;
