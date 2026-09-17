-- SEKİZ — "SIRA NEDEN NUMARAYA GÖRE DEĞİL?" TEŞHİSİ
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
--
-- BU DOSYA HİÇBİR ŞEYİ DEĞİŞTİRMEZ. Yalnız bakar.
--
-- Sınıf listesinin sırasını YALNIZ veritabanı belirliyor; ekran geldiği
-- sırayla çiziyor. Sıra beklediğiniz gibi değilse üç sebepten biri olur ve
-- bu sorgu üçünü de tek satırda gösteriyor:
--
--   1. ogrenci        → sınıfta kaç aktif öğrenci var
--   2. numarali       → kaçının OKUL NUMARASI var
--                       Numarası olmayan öğrenciler sıralanacak bir şey
--                       taşımaz; hepsi numarasızsa liste ada göre görünür
--                       ve bu DOĞRU davranıştır.
--   3. sinif_ucu_guncel → 0044 gerçekten bu uca işlemiş mi (1 olmalı)
--   4. sunucunun_sirasi → sunucunun döndüreceği SIRA, olduğu gibi
--                       Ekranda gördüğünüz sıra bundan farklıysa sebep
--                       ekrandadır; aynıysa sebep veridedir.

-- ↓↓↓ DOLDURULACAK ALANLAR ↓↓↓
with girdi as (select '9A'::text as sinif)
-- ↑↑↑ DOLDURULACAK ALANLAR ↑↑↑
select
  (select count(*)
     from public.ogrenciler o join public.siniflar s on s.id = o.sinif_id
    where s.ad = (select sinif from girdi) and o.aktif)              as ogrenci,

  (select count(*)
     from public.ogrenciler o join public.siniflar s on s.id = o.sinif_id
    where s.ad = (select sinif from girdi) and o.aktif
      and o.ogrenci_no is not null)                                  as numarali,

  -- 0044 bu uca işlemiş mi. Sürüm defterinde "0044" yazması dosyanın
  -- SONUNA kadar çalıştığını söyler; bu satır ucun GÖVDESİNE bakıyor.
  (select count(*)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'sinif_ogrencileri'
      and pg_get_functiondef(p.oid) like '%_numara_sira%')           as sinif_ucu_guncel,

  -- Sunucunun döndüreceği sıra. Ekrandakiyle karşılaştırın.
  (select string_agg(coalesce(o.ogrenci_no, '—') || ' ' || o.ad, ' · '
            order by public._numara_sira(o.ogrenci_no) nulls last, o.ad)
     from public.ogrenciler o join public.siniflar s on s.id = o.sinif_id
    where s.ad = (select sinif from girdi) and o.aktif)              as sunucunun_sirasi;
