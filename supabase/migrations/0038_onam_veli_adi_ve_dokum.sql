-- =============================================================================
-- 0038 — ONAMA VELİNİN ADI, VE SINIF BAŞINA ONAM DÖKÜMÜ
--
-- NE İSTENDİ
-- Öğretmen: "Velilerin onay verdiklerini PDF olarak, her sınıfın velisinin
-- onayını toplu bir şekilde alabilmeliyim" ve "veli onay verirken onay
-- sayfasında adını soyadını yazıp onaylayabilsin; ben de hem öğrencinin
-- hem onay veren velisinin adını göreyim."
--
-- Bu ikisi birlikte, onamı bir "evet/hayır" işaretinden GERÇEK BİR KAYDA
-- dönüştürüyor: kim, ne zaman, hangi metne, hangi çocuk için.
--
-- DÜRÜST SINIR: buradaki ad, velinin KENDİ BEYANI. Kimlik doğrulaması
-- değil — veli koduyla giren kişi oraya ne yazarsa o kaydedilir. Belge
-- bunu gizlemiyor; döküm ekranı da aynı cümleyi taşıyor.
--
-- İMZA DEĞİŞİYOR — 0007 TUZAĞI
-- `onam_ver` artık üç parametre alıyor. PostgreSQL'de imza değişikliği
-- YENİ BİR FONKSİYON demektir; eskisi kendiliğinden kalkmaz. Eski iki
-- parametreli sürüm bırakılsaydı, adı yazmadan onay vermenin bir yolu
-- açık kalırdı. Bu yüzden ÖNCE DÜŞÜRÜLÜYOR, sonra yenisi kuruluyor ve
-- yetkisi veriliyor. `onam_testleri.sql` eskisinin gerçekten gittiğini
-- ayrıca ölçüyor.
--
-- SÜRÜM NEDEN YÜKSELİYOR (2026-09-6 → 2026-09-7)
-- Onam ekranı artık velinin adını istiyor ve metin bunu söylüyor. Yani
-- velinin okuduğu ve yaptığı şey değişti. Sürüm yükselmeseydi, adsız
-- verilmiş eski onaylar yeni akışta adlıymış gibi görünürdü; döküm de
-- boş isimlerle çıkardı. Yükseltince herkes metni bir kez daha görüp
-- adını yazarak onaylıyor — ve döküm baştan eksiksiz oluyor.
--
-- ESKİ ONAY SATIRLARI SİLİNMİYOR. `veli_adi` yeni sütun ve NULL
-- olabiliyor: 0038 öncesi satırlar "ad kaydedilmemiş" olarak duruyor,
-- tarihleriyle birlikte. Geçmişi silmek, kaydın kendisini bozmak olurdu.
--
-- YEDEK KENDİLİĞİNDEN TAŞIYOR: `disa_aktar` bu tabloyu `to_jsonb(v)` ile
-- alıyor, `geri-yukle.sql` sütunları şemadan okuyor. Yeni sütun için ikisi
-- de değiştirilmedi — ve felaket provası bunu ölçüyor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. VELİNİN ADI
-- -----------------------------------------------------------------------------
alter table public.veli_onaylari
  add column if not exists veli_adi text;

-- Boş dizge bir ad değil: ya gerçek bir ad olsun ya NULL (eski kayıt).
alter table public.veli_onaylari
  drop constraint if exists veli_onaylari_ad_bos_degil;
alter table public.veli_onaylari
  add constraint veli_onaylari_ad_bos_degil
  check (veli_adi is null or length(btrim(veli_adi)) between 2 and 120);

-- -----------------------------------------------------------------------------
-- 2. SÜRÜM
-- -----------------------------------------------------------------------------
create or replace function public._gecerli_onam_surumu()
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select '2026-09-7'::text;
$$;

-- -----------------------------------------------------------------------------
-- 3. ONAM VERME — artık adla
--
-- Eski imza ÖNCE düşüyor (yukarıdaki nota bakın).
-- -----------------------------------------------------------------------------
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

  -- BOŞLUK KIRPILIYOR (0027'nin kuralı): "  Ayşe  " ile "Ayşe" aynı ad.
  v_ad := btrim(coalesce(p_veli_adi, ''));
  if length(v_ad) < 2 then
    raise exception 'Onaylamak için adınızı ve soyadınızı yazın.'
      using errcode = '22023';
  end if;
  if length(v_ad) > 120 then
    raise exception 'Ad en fazla 120 karakter olabilir.' using errcode = '22023';
  end if;

  -- İLK ONAY KAZANIR. İki kez basmak ikinci satır açmıyor ve ilk onayın
  -- zamanını/adını değiştirmiyor — kayıt, verildiği andaki hâliyle kalmalı.
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

-- -----------------------------------------------------------------------------
-- 4. SINIF BAŞINA ONAM DÖKÜMÜ
--
-- Öğretmenin yazdırıp PDF olarak saklayacağı belgenin verisi. KAPSAM
-- KURALI AYNEN: `_ogretmenin_sinifi` — bir öğretmen başka bir öğretmenin
-- sınıfının onam dökümünü alamıyor. Sahip hepsini alabiliyor, çünkü
-- kapsam yardımcısı onu zaten kapsıyor.
--
-- BELGE KENDİ KENDİNİ ANLATSIN: yanıt yalnız satırları değil, dökümü
-- ALANIN ADINI, ALINMA ZAMANINI ve GEÇERLİ SÜRÜMÜ de taşıyor. Bunlar
-- olmadan çıktı, tarihsiz bir isim listesinden ibaret kalırdı.
--
-- ONAM VERMEMİŞLER DE LİSTEDE: belge hem kayıt hem takip listesi.
-- Satırda `onam_var` false ise tarih ve ad boş geliyor.
-- -----------------------------------------------------------------------------
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
               -- GEÇERLİ SÜRÜMÜN onayı aranıyor. Eski bir sürüme verilmiş
               -- onay bu belgede "onam bekliyor" sayılır: veli bugünkü
               -- metni onaylamış değildir ve belge bunu gizlememeli.
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

-- =============================================================================
-- 5. KENDİ KENDİNİ DOĞRULAMA
-- =============================================================================
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

  -- ESKİ İMZA GERÇEKTEN GİTTİ Mİ. Kalsaydı adsız onay vermenin yolu
  -- açık kalırdı.
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
