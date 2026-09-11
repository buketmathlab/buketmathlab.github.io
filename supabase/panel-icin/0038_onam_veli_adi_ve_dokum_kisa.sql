-- SEKİZ — 0038: Onama velinin adı + sınıf başına onam dökümü
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Beklenen sonuç: "Success. No rows returned."
-- Açıklamalı tam sürüm: supabase/migrations/0038_onam_veli_adi_ve_dokum.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Yedek)
-- ÖNCE SİTE YAYINA ALINMIŞ OLMALI.
--
-- ÖNCEKİ DOSYALARI (0035/0036/0037) ÇALIŞTIRDIYSANIZ DA ÇALIŞTIRMADIYSANIZ
-- DA yalnız BU dosyayı çalıştırmanız yeterli; sürümü doğru değere getiriyor.
--
-- NE YAPIYOR:
--   * Veli onay verirken ADINI SOYADINI yazıyor; ad, onay tarihiyle
--     birlikte kaydediliyor.
--   * Veliler → bir sınıf → "Onam dökümü" ekranı açılıyor: öğrenci adı,
--     onaylayan velinin adı, onay zamanı ve sonda metnin tamamı. Yazdır
--     deyip "PDF olarak kaydet" seçiyorsunuz.
--   * Onam metninin sürümü yükseliyor: önceki metni onaylamış veliler
--     metni bir kez daha görüp ADLARINI YAZARAK onaylayacak. Böylece
--     döküm baştan eksiksiz oluyor. Eski onay kayıtları silinmiyor.
--
-- KAPSAM AYNEN: bir öğretmen yalnız KENDİ sınıfının dökümünü alabiliyor.
--
-- DÜRÜST SINIR: buradaki ad velinin kendi beyanıdır, kimlik doğrulaması
-- değildir. Döküm kâğıdında da bu cümle yazılı.

alter table public.veli_onaylari
  add column if not exists veli_adi text;

alter table public.veli_onaylari
  drop constraint if exists veli_onaylari_ad_bos_degil;
alter table public.veli_onaylari
  add constraint veli_onaylari_ad_bos_degil
  check (veli_adi is null or length(btrim(veli_adi)) between 2 and 120);

create or replace function public._gecerli_onam_surumu()
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select '2026-09-7'::text;
$$;

drop function if exists public.onam_ver(text, text);

create or replace function public.onam_ver(p_token text, p_surum text, p_veli_adi text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o     record;
  v_ad  text;
begin
  select * into o from public._oturum(p_token);

  if o.rol <> 'veli' then
    raise exception 'Bu işlem yalnızca veliler içindir.' using errcode = '42501';
  end if;
  if o.ogrenci_id is null then
    raise exception 'Geçersiz oturum.' using errcode = '42501';
  end if;

  if coalesce(btrim(p_surum), '') <> public._gecerli_onam_surumu() then
    raise exception 'Onam metni güncellenmiş. Sayfayı yenileyip yeniden okuyun.'
      using errcode = '22023';
  end if;

  v_ad := btrim(coalesce(p_veli_adi, ''));
  if length(v_ad) < 2 then
    raise exception 'Onaylamak için adınızı ve soyadınızı yazın.'
      using errcode = '22023';
  end if;
  if length(v_ad) > 120 then
    raise exception 'Ad en fazla 120 karakter olabilir.' using errcode = '22023';
  end if;

  insert into public.veli_onaylari (ogrenci_id, metin_surumu, veli_adi)
  values (o.ogrenci_id, public._gecerli_onam_surumu(), v_ad)
  on conflict (ogrenci_id, metin_surumu) do nothing;

  perform public._denetim(
    'onam_verildi', 'veli_onaylari', o.ogrenci_id, 'veli',
    null, jsonb_build_object('surum', public._gecerli_onam_surumu(), 'veli_adi', v_ad)
  );

  return jsonb_build_object('onayli', true, 'surum', public._gecerli_onam_surumu());
end;
$$;

revoke all on function public.onam_ver(text, text, text) from public, anon, authenticated;
grant execute on function public.onam_ver(text, text, text) to anon, authenticated;

create or replace function public.onam_dokumu(p_token text, p_sinif_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ogretmen uuid;
  v_sinif    record;
  v_surum    text := public._gecerli_onam_surumu();
begin
  v_ogretmen := public._ogretmen(p_token);

  if not public._ogretmenin_sinifi(v_ogretmen, p_sinif_id) then
    raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
  end if;

  select s.id, s.ad into v_sinif from public.siniflar s where s.id = p_sinif_id;
  if not found then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'sinif', jsonb_build_object('id', v_sinif.id, 'ad', v_sinif.ad),
    'surum', v_surum,
    'alindi', now(),
    'alan', (select g.ad from public.ogretmenler g where g.id = v_ogretmen),
    'satirlar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ogrenci_id', o.id,
               'ogrenci', o.ad,
               'onam_var', (v.id is not null),
               'veli_adi', v.veli_adi,
               'onay_zamani', v.onay_zamani
             ) order by o.ad)
      from public.ogrenciler o
      left join public.veli_onaylari v
        on v.ogrenci_id = o.id and v.metin_surumu = v_surum
      where o.sinif_id = p_sinif_id and o.aktif
    ), '[]'::jsonb),
    'toplam', (select count(*)::integer from public.ogrenciler o
                where o.sinif_id = p_sinif_id and o.aktif),
    'onayli', (select count(*)::integer
                 from public.ogrenciler o
                 join public.veli_onaylari v
                   on v.ogrenci_id = o.id and v.metin_surumu = v_surum
                where o.sinif_id = p_sinif_id and o.aktif)
  );
end;
$$;

revoke all on function public.onam_dokumu(text, uuid) from public, anon, authenticated;
grant execute on function public.onam_dokumu(text, uuid) to anon, authenticated;

do $$
declare
  eksik text[] := '{}';
begin
  if public._gecerli_onam_surumu() <> '2026-09-7' then
    eksik := eksik || ('sürüm hâlâ ' || public._gecerli_onam_surumu())::text;
  end if;

  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'veli_onaylari'
                    and column_name = 'veli_adi') then
    eksik := eksik || 'veli_adi sütunu yok'::text;
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'onam_ver'
      and pg_get_function_identity_arguments(p.oid) = 'text, text'
  ) then
    eksik := eksik || 'eski onam_ver(text, text) hâlâ duruyor'::text;
  end if;

  if not has_function_privilege('anon', 'public.onam_ver(text, text, text)', 'execute') then
    eksik := eksik || 'yeni onam_ver anon''a kapalı'::text;
  end if;
  if not has_function_privilege('anon', 'public.onam_dokumu(text, uuid)', 'execute') then
    eksik := eksik || 'onam_dokumu anon''a kapalı'::text;
  end if;
  if has_function_privilege('anon', 'public._gecerli_onam_surumu()', 'execute') then
    eksik := eksik || '_gecerli_onam_surumu anon''a açık kalmış'::text;
  end if;

  if array_length(eksik, 1) is not null then
    raise exception '0038 EKSİK KALDI: %', array_to_string(eksik, ' | ');
  end if;

  raise notice '0038 tamam — onam artık velinin adıyla kaydediliyor, sürüm %; '
               'sınıf başına onam dökümü hazır.', public._gecerli_onam_surumu();
end;
$$;
