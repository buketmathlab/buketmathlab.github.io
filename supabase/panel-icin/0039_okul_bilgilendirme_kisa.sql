-- SEKİZ — 0039: Okul yönetimi bilgilendirmesi için canlı sayılar
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Beklenen sonuç: "Success. No rows returned."
-- Açıklamalı tam sürüm: supabase/migrations/0039_okul_bilgilendirme.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Yedek)
-- ÖNCE SİTE YAYINA ALINMIŞ OLMALI.
-- ÖNCE 0038 ÇALIŞTIRILMIŞ OLMALI.
--
-- NE YAPIYOR: Ayarlar → "Okul yönetimi bilgilendirmesi" ekranının
-- ihtiyacı olan CANLI SAYILARI veren bir uç ekliyor — kaç öğretmen, kaç
-- sınıf, kaç öğrenci, kaç veli onam vermiş.
--
-- NEDEN CANLI: belgenin metni depoda kilitli ve içinde HİÇ SAYI YOK.
-- Sayı elle yazılsaydı belge zamanla yanlışa döner, siz de fark
-- etmezdiniz — bu depoda iki kez yaşandı.
--
-- YALNIZ SİZ: uç sahiplik kapısının arkasında. Diğer öğretmenler bütün
-- okulun sayılarını alamıyor.
--
-- Onam metni, kapı ya da veli akışı DEĞİŞMİYOR. Yeni tablo yok.

create or replace function public.okul_bilgilendirme(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id    uuid;
  v_surum text := public._gecerli_onam_surumu();
begin
  v_id := public._yonetici(p_token);

  return jsonb_build_object(
    'alindi', now(),
    'alan', (select g.ad from public.ogretmenler g where g.id = v_id),
    'surum', v_surum,

    'ogretmen_sayisi', (select count(*)::integer from public.ogretmenler
                         where aktif),
    'sinif_sayisi',    (select count(*)::integer from public.siniflar
                         where not arsiv),
    'ogrenci_sayisi',  (select count(*)::integer from public.ogrenciler
                         where aktif),

    'onam_veren', (select count(*)::integer
                     from public.ogrenciler o
                     join public.veli_onaylari v
                       on v.ogrenci_id = o.id and v.metin_surumu = v_surum
                    where o.aktif),

    'ilk_kayit', (select min(o.created_at) from public.ogrenciler o)
  );
end;
$$;

revoke all on function public.okul_bilgilendirme(text) from public, anon, authenticated;
grant execute on function public.okul_bilgilendirme(text) to anon, authenticated;

do $$
declare
  eksik text[] := '{}';
begin
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'okul_bilgilendirme') <> 1 then
    eksik := eksik || 'okul_bilgilendirme yok'::text;
  end if;
  if not has_function_privilege('anon', 'public.okul_bilgilendirme(text)', 'execute') then
    eksik := eksik || 'okul_bilgilendirme anon''a kapalı'::text;
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'okul_bilgilendirme'
      and pg_get_functiondef(p.oid) like '%_yonetici%'
  ) then
    eksik := eksik || 'okul_bilgilendirme sahiplik kapısı taşımıyor'::text;
  end if;

  if array_length(eksik, 1) is not null then
    raise exception '0039 EKSİK KALDI: %', array_to_string(eksik, ' | ');
  end if;

  raise notice '0039 tamam — okul yönetimi bilgilendirmesinin canlı sayıları hazır.';
end;
$$;
