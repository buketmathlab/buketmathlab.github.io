-- =============================================================================
-- 0067 — OKUL ÖDEVLERİ: şube şube verilen ödevler ve cevap anahtarları
--
-- Öğretmenin isteği: "Genel sekmesinde yayınlanan ödeve tıkladığımız zaman
-- sınıflara göre verilen ödevler ve cevap anahtarları görülebilsin."
--
-- Öğretmenin kararı (sorulup seçildi): müdür bütün okulu görür; her
-- öğretmen yalnız derse girdiği şubeleri (sahip hepsine atanmış olduğu için
-- hepsini). Diğer öğretmenler meslektaşlarının cevap anahtarlarını görmez.
--
-- okul_odevleri(p_token, p_onizleme) — yeni hesap YOK: her şube için
-- `sinif_not_cizelgesi(...)->'odevler'` (0064). Ödev satırının kuralları
-- (öğretmenin erişebildiği ödevler, sınıf listesi esas, cevap anahtarı,
-- dosya yolları) oradan geliyor; kapı da (`_sinif_okuyucusu`).
--
-- Kapsam: arşivde olmayan, özel olmayan şubeler.
--   müdür                         → hepsi
--   sahip + p_onizleme            → hepsi (müdür önizlemesi, 0062)
--   öğretmen                      → `_ogretmenin_sinifi` olanlar
--
-- Bu dosya tekrar çalıştırılabilir. Ön koşul: 0066.
-- =============================================================================

create or replace function public.okul_odevleri(p_token text, p_onizleme boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_rol      text;
  v_ogretmen uuid;
  v_hepsi    boolean := false;
begin
  select o.rol into v_rol from public._oturum(p_token) o;
  if v_rol = 'mudur' then
    perform public._mudur(p_token);
    v_hepsi := true;
  elsif p_onizleme then
    -- Yalnız sahip, kendi hesabındayken (`_yonetici` vekâleti reddeder).
    perform public._yonetici(p_token);
    v_hepsi := true;
  else
    v_ogretmen := public._ogretmen(p_token);
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'sinif_id', x.id, 'sinif', x.ad, 'seviye', x.seviye, 'odevler', x.odevler)
           order by x.seviye, x.sube, x.ad)
      from (
        select s.id, s.ad, s.seviye, s.sube,
               public.sinif_not_cizelgesi(p_token, s.id, p_onizleme and v_hepsi)->'odevler' as odevler
          from public.siniflar s
         where not s.arsiv and not s.ozel
           and (v_hepsi or public._ogretmenin_sinifi(v_ogretmen, s.id))
      ) x
     where jsonb_array_length(coalesce(x.odevler, '[]'::jsonb)) > 0
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.okul_odevleri(text, boolean) from public, anon, authenticated;
grant execute on function public.okul_odevleri(text, boolean) to anon, authenticated;

do $$
begin
  if to_regprocedure('public.sinif_not_cizelgesi(text, uuid, boolean)') is null then
    raise exception '0067: sinif_not_cizelgesi yok (0063/0064 çalıştırılmalı)';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'okul_geneli'
                    and pg_get_functiondef(p.oid) like '%kontrol_edilen_soru%') then
    raise exception '0067: önce 0066 çalıştırılmalı';
  end if;
  if has_function_privilege('anon', 'public.okul_odevleri(text, boolean)', 'execute') is not true then
    raise exception '0067: okul_odevleri istemciye açılmamış';
  end if;
end $$;

select public._migration_kaydet('0067');
