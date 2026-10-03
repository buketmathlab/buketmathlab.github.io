-- =============================================================================
-- 0059 — SORU KAĞIDI VE CEVAP ANAHTARI İÇİN 20 MB
--
-- Öğretmenin isteği: "Soru kağıdı ve cevap anahtarı olarak 20 MB
-- yükleyebileyim." Taranmış çok sayfalı PDF'ler 10 MB'ı aşıyordu ve
-- yükleme reddediliyordu.
--
-- Depoda TEK bucket var (`odev-dosyalari`, 0002) ve sınırı 10 MB'tı.
-- Sınır 20 MB'a çıkıyor. ÖĞRENCİNİN yüklediği çözüm fotoğrafları için
-- istemci 10 MB'ta kalıyor (`services/dosya.ts` → `EN_BUYUK_BOYUT`): o
-- dosyalar cihazda zaten sıkıştırılıyor ve öğrenci çoğu zaman mobil
-- veriyle yüklüyor. 20 MB yalnız öğretmenin ödev PDF'lerine uygulanıyor
-- (`ODEV_PDF_EN_BUYUK`).
--
-- DİKKAT — 0002 TEKRAR ÇALIŞTIRILIRSA sınırı 10 MB'a geri çeker (orada
-- `on conflict ... set file_size_limit = excluded...`). Zincir sırayla
-- koştuğu için 0059 her zaman sonra gelir ve sonuç 20 MB olur.
--
-- Supabase'in GENEL yükleme sınırı (Storage → Settings, ücretsiz planda
-- varsayılan 50 MB) bucket sınırından küçük olamaz; 20 MB onun altında.
--
-- Veri değişmiyor. Bu dosya tekrar çalıştırılabilir.
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
