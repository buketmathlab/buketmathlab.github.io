-- SEKİZ — 0059: soru kağıdı ve cevap anahtarı için 20 MB
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Açıklamalı tam sürüm: supabase/migrations/0059_odev_pdf_20mb.sql
--
-- 0058 ÇALIŞMIŞ OLMALI. Edge Function DEĞİŞMİYOR.
--
-- NE YAPIYOR: dosya deposunun sınırını 10 MB'tan 20 MB'a çıkarır.
-- Soru kağıdı ve cevap anahtarı PDF'leri 20 MB'a kadar yüklenebilir.
-- Öğrencinin yüklediği çözüm fotoğrafları 10 MB'ta kalır.
--
-- Veri DEĞİŞMİYOR, SİLİNMİYOR.
--
-- Beklenen sonuç: en altta tek satırlık bir tablo (_migration_kaydet → 0059).
-- =============================================================================

update storage.buckets
   set file_size_limit = 20971520          -- 20 MB
 where id = 'odev-dosyalari';

do $$
begin
  if (select file_size_limit from storage.buckets where id = 'odev-dosyalari')
     is distinct from 20971520 then
    raise exception '0059: odev-dosyalari sınırı 20 MB olmadı';
  end if;
  if (select public from storage.buckets where id = 'odev-dosyalari') then
    raise exception '0059: odev-dosyalari herkese açık olmamalı';
  end if;
end $$;

select public._migration_kaydet('0059');
