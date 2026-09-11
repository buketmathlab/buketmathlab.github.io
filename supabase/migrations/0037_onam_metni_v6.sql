-- =============================================================================
-- 0037 — ONAM METNİ SÜRÜM 6
--
-- NE DEĞİŞTİ
-- Öğretmenin isteği: okul adı maddesinin sonundaki "çocuğunuza ait bir
-- kayıt değil" kuyruğu kalksın. Cümle zaten "kaydına yazılmıyor" diye
-- başlıyordu; kuyruk aynı şeyi ikinci kez söylüyordu.
--
-- Maddenin son hâli:
--   "Okulun adı çocuğunuzun kaydına yazılmıyor; kayıtta yalnız sınıfı
--    var. Okulun adı ve arması uygulamanın giriş ekranında zaten yazılı."
--
-- NEDEN YENİ DOSYA — VE NEDEN 0036'YI ÇALIŞTIRIP ÇALIŞTIRMADIĞINIZ
-- ÖNEMLİ DEĞİL
-- Bu dosyanın tek yaptığı, sürüm sabitini `create or replace` ile
-- yazmak. Sunucu sürümü nereden gelirse gelsin (0034, 0035 ya da 0036),
-- bu dosya çalıştığında `2026-09-6` oluyor. Yani 0036 çalıştırılmış da
-- olsa çalıştırılmamış da olsa TEK BU DOSYAYI çalıştırmak yeterli.
--
-- 0036 düzenlenmedi çünkü canlıda çalışmış OLABİLİR; çalışmış bir
-- migration düzenlenmez (dosyayla veritabanı arasında sessiz bir ayrışma
-- bırakır). Emin olunamayan durumda doğru hamle, eskiye dokunmayıp yeni
-- dosya yazmak.
--
-- BU MIGRATION ÇALIŞTIĞI AN
-- Önceki sürümü onaylamış veliler onam ekranını BİR KEZ DAHA görür ve
-- yeni metni onaylar. Eski onay satırları SİLİNMİYOR.
--
-- YAYIN SIRASI: ÖNCE SİTE, SONRA BU DOSYA.
--
-- Yeni tablo, yeni yetki, yeni kapı YOK.
-- =============================================================================

create or replace function public._gecerli_onam_surumu()
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select '2026-09-6'::text;
$$;

-- -----------------------------------------------------------------------------
-- KENDİ KENDİNİ DOĞRULAMA
-- -----------------------------------------------------------------------------
do $$
declare
  eksik text[] := '{}';
begin
  if public._gecerli_onam_surumu() <> '2026-09-6' then
    eksik := eksik || ('sürüm hâlâ ' || public._gecerli_onam_surumu())::text;
  end if;

  if to_regclass('public.veli_onaylari') is null then
    eksik := eksik || 'veli_onaylari yok — önce 0034 çalıştırılmalı'::text;
  end if;
  if not has_function_privilege('anon', 'public.onam_ver(text, text)', 'execute') then
    eksik := eksik || 'onam_ver anon''a kapalı'::text;
  end if;
  if has_function_privilege('anon', 'public._gecerli_onam_surumu()', 'execute') then
    eksik := eksik || '_gecerli_onam_surumu anon''a açık kalmış'::text;
  end if;

  if array_length(eksik, 1) is not null then
    raise exception '0037 EKSİK KALDI: %', array_to_string(eksik, ' | ');
  end if;

  raise notice '0037 tamam — onam metni sürümü %; bu sürümü onaylamamış '
               'veliler metni bir kez daha görecek.', public._gecerli_onam_surumu();
end;
$$;
