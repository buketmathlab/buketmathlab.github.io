-- SEKİZ — 0037: Onam metni sürüm 6
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Beklenen sonuç: "Success. No rows returned."
-- Açıklamalı tam sürüm: supabase/migrations/0037_onam_metni_v6.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Yedek)
-- ÖNCE SİTE YAYINA ALINMIŞ OLMALI.
--
-- 0036'YI ÇALIŞTIRDIYSANIZ DA ÇALIŞTIRMADIYSANIZ DA yalnız BU dosyayı
-- çalıştırın; ikisini birden çalıştırmanıza gerek yok. Sunucu sürümü
-- nereden gelirse gelsin bu dosya onu doğru değere getiriyor.
--
-- NE DEĞİŞTİ: okul adı maddesinin sonundaki "çocuğunuza ait bir kayıt
-- değil" kuyruğu kaldırıldı. Madde artık şöyle:
--   "Okulun adı çocuğunuzun kaydına yazılmıyor; kayıtta yalnız sınıfı
--    var. Okulun adı ve arması uygulamanın giriş ekranında zaten yazılı."
--
-- ÇALIŞTIRDIĞINIZ AN: önceki metni onaylamış veliler onam ekranını BİR
-- KEZ DAHA görür ve yeni metni onaylar. Eski onay kayıtları silinmiyor.
--
-- Yeni tablo, yeni yetki, yeni kapı YOK.

create or replace function public._gecerli_onam_surumu()
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select '2026-09-6'::text;
$$;

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
