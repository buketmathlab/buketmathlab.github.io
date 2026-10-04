-- SEKİZ — 0068: boş sınıfı silme
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Açıklamalı tam sürüm: supabase/migrations/0068_bos_sinif_sil.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Ayarlar → Verinizin yedeği)
-- 0067 ÇALIŞMIŞ OLMALI. Edge Function DEĞİŞMİYOR.
--
-- NE YAPIYOR: Platform sahibi, hiç öğrencisi ve hiç ödevi olmayan sınıfı
-- (ör. yanlışlıkla açılan 9D) silebilir. Öğrencisi ya da ödevi olan sınıf
-- silinmez, yalnız arşivlenir. Özel ders grubu silinmez.
--
-- Mevcut veri DEĞİŞMİYOR; yalnız bir fonksiyon ekleniyor.
--
-- Beklenen sonuç: en altta tek satırlık bir tablo (_migration_kaydet → 0068).
-- =============================================================================

create or replace function public.sinif_sil(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o       record;
  v_id    uuid;
  s       record;
  v_ogr   integer;
  v_odev  integer;
begin
  v_id := public._yonetici(p_token);
  select * into o from public._oturum(p_token);
  if o.vekil_id is not null then
    raise exception 'Başka bir öğretmenin hesabındayken sınıf silinemez. Kendi hesabınıza dönün.'
      using errcode = '42501';
  end if;

  select si.id, si.ad, si.seviye, si.sube, si.ozel into s
    from public.siniflar si where si.id = p_id;
  if not found then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;
  if s.ozel then
    raise exception 'Özel ders grubu silinemez.' using errcode = '42501';
  end if;

  -- Pasif öğrenci de sayılıyor: ödev geçmişi bu sınıfa bağlı.
  select count(*)::integer into v_ogr from public.ogrenciler g where g.sinif_id = p_id;
  if v_ogr > 0 then
    raise exception '% sınıfında öğrenci kaydı var (%). Silinemez; arşivleyebilirsiniz.', s.ad, v_ogr
      using errcode = '22023';
  end if;
  -- Taslak da sayılıyor: öğretmenin hazırladığı iş.
  select count(*)::integer into v_odev from public.odevler d where d.sinif_id = p_id;
  if v_odev > 0 then
    raise exception '% sınıfında ödev var (%). Silinemez; arşivleyebilirsiniz.', s.ad, v_odev
      using errcode = '22023';
  end if;

  delete from public.siniflar where id = p_id;
  perform public._denetim('sinif_silindi', 'siniflar', p_id, public._aktor(v_id),
                          jsonb_build_object('ad', s.ad, 'seviye', s.seviye, 'sube', s.sube), null);
  return jsonb_build_object('durum', 'tamam', 'ad', s.ad);
end;
$$;

revoke all on function public.sinif_sil(text, uuid) from public, anon, authenticated;
grant execute on function public.sinif_sil(text, uuid) to anon, authenticated;

do $$
begin
  if to_regprocedure('public.okul_odevleri(text, boolean)') is null then
    raise exception '0068: önce 0067 çalıştırılmalı';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'sinif_sil'
                    and pg_get_functiondef(p.oid) like '%public.ogrenciler%'
                    and pg_get_functiondef(p.oid) like '%public.odevler%') then
    raise exception '0068: sinif_sil öğrenci ve ödev kontrolü yapmıyor';
  end if;
end $$;

select public._migration_kaydet('0068');
