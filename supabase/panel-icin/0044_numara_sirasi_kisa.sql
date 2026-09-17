-- SEKİZ — 0044: Listeler okul numarasına göre
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Açıklamalı tam sürüm: supabase/migrations/0044_numara_sirasi.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Yedek)
-- ÖNCE SİTE YAYINA ALINMIŞ OLMALI.
--
-- NE YAPIYOR: Sınıfa tıklayınca açılan liste, Kodlar ve Kod fişleri artık
-- okul numarasına göre KÜÇÜKTEN BÜYÜĞE sıralanıyor. Numarası olmayan
-- öğrenciler (özel ders) en sonda, kendi aralarında ada göre.
--
-- NUMARA SAYI GİBİ SIRALANIYOR: numara metin olarak saklanıyor (baştaki
-- sıfır korunsun diye) ve düz metin sıralaması "10"u "9"dan önce koyardı.
--
-- ÖĞRENCİLER EKRANI ADA GÖRE KALIYOR: orada sınıf seçmeden bakarken
-- farklı sınıfların aynı numaraları iç içe geçerdi.
--
-- Veri değişmiyor; yalnız listelerin sırası.

-- -----------------------------------------------------------------------------
-- 1. SIRALAMA ANAHTARI — TEK YERDE
--
-- Numara METİN (0042 kararı: "0601" ile "601" farklı kayıtlar, başındaki
-- sıfır korunmalı). Ama düz metin sıralaması "10"u "9"dan ÖNCE koyar:
--
--   metin sırası : '10', '2', '9'
--   istenen      : '2', '9', '10'
--
-- Bu yüzden yalnız rakamdan oluşan numaralar sabit genişliğe sıfırla
-- doldurularak karşılaştırılıyor. Rakam dışı karakter taşıyan bir numara
-- (varsa) sayısal olanlardan SONRA ama numarasızlardan ÖNCE geliyor.
--
-- İKİ UÇ DA BU YARDIMCIYI ÇAĞIRIYOR. Sıralama kuralının iki kopyası
-- olsaydı bir gün aynı sınıf iki ekranda iki farklı sırada görünürdü.
-- -----------------------------------------------------------------------------
create or replace function public._numara_sira(p_no text)
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select case
    when p_no is null or btrim(p_no) = '' then null
    when btrim(p_no) ~ '^[0-9]+$' then lpad(btrim(p_no), 12, '0')
    else 'Z' || btrim(p_no)
  end;
$$;

-- -----------------------------------------------------------------------------
-- 2. UÇLAR
--
-- GÖVDELER 0042'DEN BETİKLE ALINDI, elle yeniden yazılmadı. 0042'de
-- `ogrenci_ekle` hatırdan yazılmıştı ve üç davranış sessizce kaybolmuştu
-- (sahiplik kapısı, özel ders sınıf seçimi, dönüş alanları). Değişen tek
-- şey sıralama.
--
-- `ogrenciler_listesi`e `p_sirala` ekleniyor: 'ad' (varsayılan, bugünkü
-- davranış) ya da 'numara'. Sıra HEM iç sayfalama sorgusunda HEM dıştaki
-- `jsonb_agg` içinde uygulanıyor — biri değişip öteki kalsaydı sayfanın
-- içi ile sayfalar arası sıra ayrışırdı ve bu, ancak ikinci sayfaya
-- bakınca fark edilirdi.
--
-- 0007 TUZAĞI GERÇEK: varsayılanlı yeni parametre YENİ bir imza yaratıyor.
-- Eski 5 parametreli imza aşağıda açıkça düşürülüyor ve düştüğü sınanıyor.
-- -----------------------------------------------------------------------------
create or replace function public.sinif_ogrencileri(p_token text, p_sinif_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  s public.siniflar;
  bugun_tr date := (now() at time zone 'Europe/Istanbul')::date;
  v_odev_sayisi integer;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  if not public._ogretmenin_sinifi(v_ogretmen, p_sinif_id) then
    raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
  end if;

  select * into s from public.siniflar where id = p_sinif_id;
  if not found then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;

  -- Bu sınıfa verilmiş, yayınlanmış ve süresi dolmuş ödev sayısı.
  select count(*) into v_odev_sayisi
  from public.odevler d
  where d.sinif_id = p_sinif_id and d.yayinda and d.son_tarih < bugun_tr
    and d.ogretmen_id = v_ogretmen;

  return jsonb_build_object(
    'sinif', jsonb_build_object(
      'id', s.id, 'ad', s.ad, 'ozel', s.ozel, 'arsiv', s.arsiv
    ),
    -- Öğretmen "kaç ödev üzerinden konuşuyoruz" sorusunu görmeden
    -- ortalamayı yorumlayamaz.
    'degerlendirilen_odev', v_odev_sayisi,
    'ogrenciler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id,
        'ad', o.ad,
        'ogrenci_no', o.ogrenci_no,
        'tur', o.tur,
        'yapti', i.yapti,
        'yapmadi', v_odev_sayisi - i.yapti,
        'ortalama_yapan', i.ortalama_yapan,
        'ortalama_tum', i.ortalama_tum
      -- SIRALAMA: OKUL NUMARASINA GÖRE (0044). Anahtar tek yerde
      -- (`_numara_sira`); numarasızlar sonda, kendi aralarında ada göre.
      --
      -- `nulls last` PostgreSQL'de ASC için ZATEN varsayılan; kaldırıldığında
      -- hiçbir ölçüm kırılmıyor (denendi). Yine de yazılı duruyor: bir gün
      -- sıra DESC'e çevrilirse varsayılan tersine döner ve numarasızlar
      -- listenin başına geçerdi.
      ) order by public._numara_sira(o.ogrenci_no) nulls last, o.ad)
      from public.ogrenciler o
      cross join lateral (
        select
          count(g.id)::integer as yapti,
          round(avg(coalesce(g.ogretmen_puan, g.puan))
                filter (where g.id is not null), 1) as ortalama_yapan,
          case when v_odev_sayisi > 0 then
            round(sum(coalesce(g.ogretmen_puan, g.puan, 0)) / v_odev_sayisi, 1)
          end as ortalama_tum
        from public.odevler d
        left join public.gonderimler g
          on g.odev_id = d.id and g.ogrenci_id = o.id
        where d.sinif_id = p_sinif_id
          and d.yayinda
          and d.son_tarih < bugun_tr
      ) i
      where o.sinif_id = p_sinif_id and o.aktif
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.ogrenciler_listesi(
  p_token text,
  p_arama text default null,
  p_sinif_id uuid default null,
  p_sayfa integer default 1,
  p_boyut integer default 25,
  -- 0044: 'ad' (varsayılan, eski davranış) ya da 'numara'.
  p_sirala text default 'ad'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  toplam integer;
  satirlar jsonb;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  p_boyut := least(greatest(coalesce(p_boyut, 25), 1), 100);
  p_sayfa := greatest(coalesce(p_sayfa, 1), 1);

  if p_sirala is null or p_sirala not in ('ad', 'numara') then
    raise exception 'Sıralama ''ad'' ya da ''numara'' olmalı.' using errcode = '22023';
  end if;

  select count(*) into toplam
  from public.ogrenciler o
  where o.aktif
    and public._ogretmenin_ogrencisi(v_ogretmen, o.id)
    and not public._sinif_arsivde(o.sinif_id)
    and (p_sinif_id is null or o.sinif_id = p_sinif_id)
    and (p_arama is null or o.ad ilike '%' || p_arama || '%');

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', o.id, 'ad', o.ad, 'ogrenci_no', o.ogrenci_no, 'tur', o.tur, 'sinif', s.ad
         ) order by case when p_sirala = 'numara'
             then public._numara_sira(o.ogrenci_no) end nulls last, o.ad), '[]'::jsonb) into satirlar
  from (
    select o.* from public.ogrenciler o
    where o.aktif
      and public._ogretmenin_ogrencisi(v_ogretmen, o.id)
      and not public._sinif_arsivde(o.sinif_id)
      and (p_sinif_id is null or o.sinif_id = p_sinif_id)
      and (p_arama is null or o.ad ilike '%' || p_arama || '%')
    order by case when p_sirala = 'numara'
             then public._numara_sira(o.ogrenci_no) end nulls last, o.ad
    limit p_boyut offset (p_sayfa - 1) * p_boyut
  ) o
  left join public.siniflar s on s.id = o.sinif_id;

  return jsonb_build_object(
    'toplam', toplam,
    'sayfa', p_sayfa,
    'toplam_sayfa', greatest(ceil(toplam::numeric / p_boyut)::int, 1),
    'kayitlar', satirlar
  );
end;
$$;

-- ESKİ İMZAYI DÜŞÜR. Kalsaydı PostgREST `p_sirala` taşımayan çağrıyı ona
-- yönlendirebilir ve sıralama seçeneği hiç çalışmazdı.
drop function if exists public.ogrenciler_listesi(text, text, uuid, integer, integer);

-- -----------------------------------------------------------------------------
-- 3. YETKİLER (0005 deseni)
--
-- `create or replace` yetkileri korur, ama YENİ imza ve yeni yardımcı
-- PUBLIC üzerinden anon'a AÇIK doğar.
-- -----------------------------------------------------------------------------
revoke all on function public._numara_sira(text) from public, anon, authenticated;

revoke all on function public.ogrenciler_listesi(text, text, uuid, integer, integer, text)
  from public, anon, authenticated;
grant execute on function public.ogrenciler_listesi(text, text, uuid, integer, integer, text)
  to anon, authenticated;

-- =============================================================================
-- KENDİ KENDİNİ DOĞRULAMA
-- =============================================================================
do $$
declare
  eksik text[] := '{}';
begin
  -- SIRALAMA ANAHTARI SAYISAL MI. Bu tek satır bozulursa "10" yine "9"dan
  -- önce gelir ve kimse hata almaz — yalnız sıra yanlış olur.
  if public._numara_sira('9') >= public._numara_sira('10') then
    eksik := eksik || '_numara_sira sayısal sıralamıyor'::text;
  end if;
  if public._numara_sira('0601') is distinct from public._numara_sira('601') then
    eksik := eksik || '_numara_sira baştaki sıfırı ayrı sayıyor'::text;
  end if;
  if public._numara_sira(null) is not null or public._numara_sira('  ') is not null then
    eksik := eksik || '_numara_sira boş numarayı null yapmıyor'::text;
  end if;
  -- Rakam dışı numara, sayısal olanlardan SONRA gelmeli.
  if public._numara_sira('A1') <= public._numara_sira('999999999999') then
    eksik := eksik || '_numara_sira rakam dışı numarayı öne alıyor'::text;
  end if;

  -- 0007 TUZAĞI: eski imza gerçekten düştü mü. Tür listesi
  -- `oidvectortypes` ile okunuyor; `pg_get_function_identity_arguments`
  -- parametre ADLARINI da döndürdüğü için onunla karşılaştırmak asla
  -- tutmayan bir ölçüm olurdu (0042'de öyle yazılmıştı).
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'ogrenciler_listesi'
      and pg_catalog.oidvectortypes(p.proargtypes) = 'text, text, uuid, integer, integer'
  ) then
    eksik := eksik || 'eski 5 parametreli ogrenciler_listesi hâlâ duruyor'::text;
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'ogrenciler_listesi') <> 1 then
    eksik := eksik || 'ogrenciler_listesi tek imza değil'::text;
  end if;

  -- VARSAYILAN 'ad' OLMALI: geride kalmış bir arayüz sürümü sessizce
  -- sırayı değiştirmesin.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'ogrenciler_listesi'
      and pg_get_function_arguments(p.oid) like '%p_sirala text DEFAULT ''ad''%'
  ) then
    eksik := eksik || 'p_sirala varsayılanı ''ad'' değil'::text;
  end if;

  -- SINIF DETAYI SIRALAMAYI KULLANIYOR MU.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'sinif_ogrencileri'
      and pg_get_functiondef(p.oid) like '%_numara_sira%'
  ) then
    eksik := eksik || 'sinif_ogrencileri numara sırasını kullanmıyor'::text;
  end if;

  if has_function_privilege('anon', 'public._numara_sira(text)', 'execute') then
    eksik := eksik || '_numara_sira anon''a açık kalmış'::text;
  end if;
  if not has_function_privilege(
       'anon', 'public.ogrenciler_listesi(text, text, uuid, integer, integer, text)',
       'execute') then
    eksik := eksik || 'ogrenciler_listesi anon''a kapalı'::text;
  end if;

  if array_length(eksik, 1) is not null then
    raise exception '0044 EKSİK KALDI: %', array_to_string(eksik, ' | ');
  end if;

  raise notice '0044 tamam — listeler okul numarasına göre sıralanabiliyor.';
end;
$$;

select public._migration_kaydet('0044');

-- Panelde YALNIZ SON İFADENİN SONUCU görünüyor. Bu dosya okunabilir bir
-- satırla bitiyor — aşağıdaki tabloyu görüyorsanız tamamdır.
select
  '0044 tamam — listeler okul numarasına göre sıralanıyor.'      as sonuc,
  (select count(*) from public.uygulanan_migrationlar)           as defterdeki_dosya,
  (select max(dosya) from public.uygulanan_migrationlar)         as son_dosya;
