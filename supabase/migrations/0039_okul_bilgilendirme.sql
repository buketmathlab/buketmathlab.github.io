-- =============================================================================
-- 0039 — OKUL YÖNETİMİ BİLGİLENDİRMESİ İÇİN CANLI SAYILAR
--
-- NE İSTENDİ
-- `docs/kvkk-notlari.md`'nin dikkat listesinde en başta duran madde:
-- "Okul yönetimine sistemin varlığını ve barındırma bölgesini bildirin."
-- Bugüne kadar metni yoktu. Öğretmen bu turda yapılmasını istedi.
--
-- NEDEN BU UÇ VAR — BELGE BAYATLAMASIN DİYE
-- Böyle bir belgenin en olası bozulma biçimi, yazıldığı gün doğru olup
-- altı ay sonra yanlış olmasıdır. `docs/kvkk-notlari.md`'nin başına tam
-- olarak bu geldi: bir ay boyunca "çözüm fotoğrafları korumasız" dedi,
-- oysa o açık kapanmıştı. Okula verilen bir kâğıtta aynı şey olursa
-- daha kötü.
--
-- Çözüm: belgenin METNİ depoda kilitli (`app/src/lib/okul-bilgilendirme.ts`,
-- ölçümleri var), SAYILARI ise buradan canlı geliyor. Kaç öğretmen, kaç
-- sınıf, kaç öğrenci, kaç veli onam vermiş — hiçbiri kâğıda elle
-- yazılmıyor. `okul-bilgilendirme.test.ts` metinde sabit bir sayı
-- BULUNMADIĞINI ayrıca ölçüyor.
--
-- YALNIZ SAHİP
-- Okul yönetimiyle konuşan kişi platformun sahibi. Bir öğretmenin bütün
-- okulun sayılarını çıkarabilmesi, 0033'ün kapsam kuralını sessizce
-- delerdi — `_yonetici` kapısı o yüzden.
--
-- KİŞİSEL VERİ YOK. Bu uç TEK BİR öğrencinin, velinin ya da öğretmenin
-- adını döndürmüyor; yalnız sayılar ve sahibin kendi adı. Belge okul
-- yönetimine gidiyor, öğrenci listesi değil.
-- =============================================================================

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

    -- Aktif öğretmen sayısı. "Dört" diye yazmıyoruz: onam metninde tam da
    -- o hatayı yaptık ve öğretmen yakaladı.
    'ogretmen_sayisi', (select count(*)::integer from public.ogretmenler
                         where aktif),
    'sinif_sayisi',    (select count(*)::integer from public.siniflar
                         where not arsiv),
    'ogrenci_sayisi',  (select count(*)::integer from public.ogrenciler
                         where aktif),

    -- Onam tablosu: kaç velinin GEÇERLİ SÜRÜMDE onayı var. Belge "veliler
    -- bilgilendiriliyor" diyorsa, bunun sayısı da kâğıtta olmalı — yoksa
    -- iddia denetlenemez kalır.
    'onam_veren', (select count(*)::integer
                     from public.ogrenciler o
                     join public.veli_onaylari v
                       on v.ogrenci_id = o.id and v.metin_surumu = v_surum
                    where o.aktif),

    -- Sistem ne zamandan beri kullanılıyor: en eski öğrenci kaydı.
    'ilk_kayit', (select min(o.created_at) from public.ogrenciler o)
  );
end;
$$;

revoke all on function public.okul_bilgilendirme(text) from public, anon, authenticated;
grant execute on function public.okul_bilgilendirme(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- KENDİ KENDİNİ DOĞRULAMA
-- -----------------------------------------------------------------------------
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

  -- SAHİPLİK KAPISI GERÇEKTEN GÖVDEDE Mİ. `_yonetici` çağrısı düşerse uç
  -- bütün okulun sayılarını her öğretmene açar; bu satır onu yakalar.
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
