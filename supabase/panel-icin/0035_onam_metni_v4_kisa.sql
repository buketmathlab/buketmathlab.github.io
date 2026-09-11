-- SEKİZ — 0035: Onam metni sürüm 4
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Beklenen sonuç: "Success. No rows returned."
-- Açıklamalı tam sürüm: supabase/migrations/0035_onam_metni_v4.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Yedek)
--
-- NE YAPIYOR: onam metninin sürümünü yükseltiyor ve ŞU AN AÇIK OLAN BİR
-- PENCEREYİ KAPATIYOR. Site yeni metni gösteriyor ama veritabanı hâlâ
-- eskisini bekliyor; bu yüzden onam vermemiş veliler şu an onay
-- veremiyor. Bu dosya çalıştığı an ikisi eşitleniyor.
--
-- METİNDE NE DEĞİŞTİ:
--   * Fotoğraf cümlesi yeniden yazıldı. "60 saniye" rakamı çıktı; metin
--     artık bunun BAĞLANTININ ÖMRÜ olduğunu, öğretmenin bakma süresiyle
--     ilgisi olmadığını açıkça söylüyor.
--   * (Bir önceki turda) özel derse ait ders planı/ödeme satırı, cevap
--     anahtarı cümlesi ve yapay zekâ bölümü kaldırıldı; "kim görebiliyor"
--     kısmı düzeltildi.
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
  select '2026-09-4'::text;
$$;

do $$
declare
  eksik text[] := '{}';
begin
  if public._gecerli_onam_surumu() <> '2026-09-4' then
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
    raise exception '0035 EKSİK KALDI: %', array_to_string(eksik, ' | ');
  end if;

  raise notice '0035 tamam — onam metni sürümü %; bu sürümü onaylamamış '
               'veliler metni bir kez daha görecek.', public._gecerli_onam_surumu();
end;
$$;
