-- SEKİZ — 0036: Onam metni sürüm 5
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Beklenen sonuç: "Success. No rows returned."
-- Açıklamalı tam sürüm: supabase/migrations/0036_onam_metni_v5.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Yedek)
-- ÖNCE SİTE YAYINA ALINMIŞ OLMALI.
--
-- NE DÜZELTİLDİ: metin "okulun adı hiçbir yerde saklanmıyor" diyordu ama
-- okulun adı giriş ekranında ve mührün alt metninde yazılı. Yanlış bir
-- cümleydi. Metin artık ikisini ayırıyor: okul adı ÇOCUĞUN KAYDINA
-- yazılmıyor, ama uygulamanın giriş ekranında zaten görünüyor.
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
  select '2026-09-5'::text;
$$;

do $$
declare
  eksik text[] := '{}';
begin
  if public._gecerli_onam_surumu() <> '2026-09-5' then
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
    raise exception '0036 EKSİK KALDI: %', array_to_string(eksik, ' | ');
  end if;

  raise notice '0036 tamam — onam metni sürümü %; bu sürümü onaylamamış '
               'veliler metni bir kez daha görecek.', public._gecerli_onam_surumu();
end;
$$;
