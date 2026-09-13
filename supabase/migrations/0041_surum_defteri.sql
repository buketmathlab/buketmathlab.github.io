-- =============================================================================
-- 0041 — SÜRÜM DEFTERİ: HANGİ MIGRATION CANLIDA ÇALIŞTI
--
-- NE İSTENDİ
-- Öğretmen: "Hangi SQL dosyasının canlıda çalıştığını tutan bir kayıt yok;
-- her seferinde benim hatırlamama kalıyor."
--
-- BU BELİRSİZLİK ZATEN BİR TURLUK FAZLADAN İŞ OLARAK FATURALANDI. Onam
-- metni sürüm 5 turunda 0035'in çalışıp çalışmadığı bilinmiyordu; emin
-- olunamadığı için "çalışmış da olsa çalışmamış da olsa doğru sonucu
-- versin" diye FAZLADAN bir dosya (0036) yazıldı. Yani hatırlamaya
-- dayanmak, doğrudan iş demek.
--
-- NEDEN DIŞARIDAN YOKLAMA YETMEDİ. Önce "uçları dışarıdan yoklayıp rapor
-- veren bir betik" düşünüldü. Ölçüldü: yoklama 40 migration'ın yalnız
-- 29'unu ayırt edebiliyor. Kalan 11'i yeni bir uç eklemiyor, var olan bir
-- fonksiyonun GÖVDESİNİ değiştiriyor — dışarıdan hiçbir iz bırakmıyorlar.
-- Ve o 11'in içinde 0035, 0036, 0037 var: yani tam da soruyu doğuran
-- dosyalar. Bir ölçüm, asıl sorulan soruyu cevaplayamıyorsa çözüm değil.
--
-- ASIL KAZANÇ GELECEKTE. Bu dosyadan sonra her migration, çalışırken
-- KENDİ ADINI deftere yazıyor. Geçmiş için elimizde çıkarım var, gelecek
-- için kesin kayıt — ve zaten canını sıkan hep "az önce yazdığın dosyayı
-- çalıştırdım mı" sorusu.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. DEFTER
--
-- `kaynak` ALANI ÖNEMLİ: bir satırın NASIL bilindiğini söylüyor.
--   'migration'     → dosya çalışırken kendi satırını yazdı. KESİN.
--   'geriye_donuk'  → 0041 kurulurken çıpa nesnelerine bakılarak
--                     çıkarıldı. Çıkarım, kesin değil.
-- İkisini tek bir listede karıştırıp hepsine "uygulandı" demek, bilmediğimiz
-- bir şeyi biliyormuş gibi göstermek olurdu. Ekran da bu ayrımı gösteriyor.
-- -----------------------------------------------------------------------------
create table if not exists public.uygulanan_migrationlar (
  dosya      text primary key check (btrim(dosya) <> ''),
  uygulandi  timestamptz not null default now(),
  kaynak     text not null check (kaynak in ('migration', 'geriye_donuk'))
);

alter table public.uygulanan_migrationlar enable row level security;
alter table public.uygulanan_migrationlar force row level security;

-- Politika YOK: erişim yalnız `security definer` fonksiyonlardan.
revoke all on table public.uygulanan_migrationlar from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. DEFTERE YAZMA YARDIMCISI
--
-- Bundan sonraki her migration tek satırla kendini kaydediyor:
--     select public._migration_kaydet('0042_falanca.sql');
--
-- `on conflict do update`: aynı dosya iki kez çalıştırılırsa satır
-- çoğalmıyor, zamanı tazeleniyor. Migration'lar `create or replace` ile
-- yazıldığı için iki kez çalıştırmak zaten zararsız; defter de aynı
-- şekilde davranmalı ki öğretmen "yanlışlıkla iki kez çalıştırdım" diye
-- endişelenmesin.
--
-- Bir kez 'geriye_donuk' yazılmış satır, dosya GERÇEKTEN çalıştığında
-- 'migration'a yükseliyor — çıkarım, kanıtın yerini tutmaz.
-- -----------------------------------------------------------------------------
create or replace function public._migration_kaydet(p_dosya text)
returns void
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  insert into public.uygulanan_migrationlar (dosya, kaynak)
  values (btrim(p_dosya), 'migration')
  on conflict (dosya) do update
    set uygulandi = now(), kaynak = 'migration';
$$;

-- -----------------------------------------------------------------------------
-- 3. GERİYE DÖNÜK DOLDURMA — UYDURMADAN
--
-- 0001–0040 zaten çalıştı ama kimse yazmadı. Buraya körlemesine
-- "hepsi uygulandı" yazmak defteri ilk gününde yalancı yapardı: eksik
-- kurulmuş bir veritabanında da aynı şeyi yazardı ve öğretmen ekrana bakıp
-- her şeyin yerinde olduğunu sanırdı.
--
-- Onun yerine ÇIPA nesneleri aranıyor. Her çıpa bir dosya aralığını
-- temsil ediyor; yalnız çıpası TUTAN aralık deftere yazılıyor. Çıpası
-- olmayan aralık yazılmıyor ve ekranda "çalıştırılmamış" diye görünüyor —
-- yani eksik kurulum kendini ihbar ediyor.
--
-- Aralıklar bir ÇIKARIM: "`disa_aktar` varsa 0004–0019 çalışmıştır."
-- Doğru bir çıkarım, ama kanıt değil; `kaynak='geriye_donuk'` tam olarak
-- bunu söylüyor.
-- -----------------------------------------------------------------------------
-- FONKSİYON, `do $$` BLOĞU DEĞİL. Anonim blok olsaydı testler aynı
-- mantığın bir KOPYASINI çalıştırmak zorunda kalır, yani ölçüm asıl
-- çalışan kodu değil taşrasını ölçerdi. Testin gerçek kodu çağırabilmesi
-- için doldurma bir fonksiyon.
create or replace function public._defter_doldur()
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  cipalar jsonb := jsonb_build_array(
    jsonb_build_object('bas', 1,  'bit', 3,  'tur', 'tablo', 'ad', 'ogrenciler'),
    jsonb_build_object('bas', 4,  'bit', 19, 'tur', 'fn',    'ad', 'disa_aktar'),
    jsonb_build_object('bas', 20, 'bit', 22, 'tur', 'fn',    'ad', '_konu_analizi'),
    jsonb_build_object('bas', 23, 'bit', 31, 'tur', 'fn',    'ad', 'konu_karnesi'),
    jsonb_build_object('bas', 32, 'bit', 32, 'tur', 'tablo', 'ad', 'ewalu_mesajlari'),
    jsonb_build_object('bas', 33, 'bit', 33, 'tur', 'tablo', 'ad', 'ogretmen_siniflari'),
    jsonb_build_object('bas', 34, 'bit', 37, 'tur', 'tablo', 'ad', 'veli_onaylari'),
    jsonb_build_object('bas', 38, 'bit', 38, 'tur', 'sutun', 'ad', 'veli_onaylari.veli_adi'),
    jsonb_build_object('bas', 39, 'bit', 39, 'tur', 'fn',    'ad', 'okul_bilgilendirme'),
    jsonb_build_object('bas', 40, 'bit', 40, 'tur', 'fn',    'ad', '_konu_esikleri')
  );
  c        jsonb;
  var      boolean;
  i        integer;
  yazilan  integer := 0;
  atlanan  text[]  := '{}';
begin
  for c in select * from jsonb_array_elements(cipalar) loop
    var := case c->>'tur'
      when 'tablo' then exists (
        select 1 from pg_class k join pg_namespace n on n.oid = k.relnamespace
        where n.nspname = 'public' and k.relname = c->>'ad' and k.relkind = 'r')
      when 'fn' then exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = c->>'ad')
      when 'sutun' then exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name  = split_part(c->>'ad', '.', 1)
          and column_name = split_part(c->>'ad', '.', 2))
    end;

    if var then
      for i in (c->>'bas')::integer .. (c->>'bit')::integer loop
        -- Dosya adının TAMAMI değil, numarası yazılıyor: depodaki ad
        -- (`0020_konu_analizi.sql`) buradan bilinemez ve uydurulursa
        -- ekrandaki karşılaştırma tutmaz. Ekran numara üzerinden eşliyor.
        insert into public.uygulanan_migrationlar (dosya, kaynak)
        values (lpad(i::text, 4, '0'), 'geriye_donuk')
        on conflict (dosya) do nothing;
        yazilan := yazilan + 1;
      end loop;
    else
      atlanan := atlanan || format('%s-%s (%s yok)',
        lpad((c->>'bas')::text, 4, '0'), lpad((c->>'bit')::text, 4, '0'), c->>'ad');
    end if;
  end loop;

  raise notice 'Defter geriye dönük dolduruldu: % dosya.', yazilan;
  if array_length(atlanan, 1) is not null then
    raise notice 'YAZILMAYAN ARALIKLAR (çıpası bulunamadı): %',
      array_to_string(atlanan, ' | ');
  end if;
end;
$fn$;

select public._defter_doldur();

-- 0041'in kendi satırı: buradan itibaren kayıt KESİN.
select public._migration_kaydet('0041');

-- -----------------------------------------------------------------------------
-- 4. OKUMA UCU — YALNIZ SAHİP
--
-- Kadronun hangi migration'ların çalıştığını bilmesine gerek yok; bu
-- kurulum bilgisi, ders bilgisi değil. 0033'ün kapsam kuralıyla tutarlı.
-- -----------------------------------------------------------------------------
create or replace function public.surum_defteri(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid;
begin
  v_id := public._yonetici(p_token);

  return jsonb_build_object(
    'alindi', now(),
    'dosyalar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'dosya', u.dosya,
               'uygulandi', u.uygulandi,
               'kaynak', u.kaynak)
             order by u.dosya)
        from public.uygulanan_migrationlar u), '[]'::jsonb),
    -- `son`: defterdeki en büyük numara. Ekran "veritabanınız 0041'de"
    -- derken bunu yazıyor.
    'son', (select max(u.dosya) from public.uygulanan_migrationlar u)
  );
end;
$$;

revoke all on function public._migration_kaydet(text) from public, anon, authenticated;
revoke all on function public._defter_doldur() from public, anon, authenticated;
revoke all on function public.surum_defteri(text) from public, anon, authenticated;
grant execute on function public.surum_defteri(text) to anon, authenticated;

-- =============================================================================
-- KENDİ KENDİNİ DOĞRULAMA
-- =============================================================================
do $$
declare
  eksik text[] := '{}';
  v_adet integer;
begin
  if (select count(*) from pg_class k join pg_namespace n on n.oid = k.relnamespace
       where n.nspname = 'public' and k.relname = 'uygulanan_migrationlar') <> 1 then
    eksik := eksik || 'uygulanan_migrationlar tablosu yok'::text;
  end if;

  if not has_function_privilege('anon', 'public.surum_defteri(text)', 'execute') then
    eksik := eksik || 'surum_defteri anon''a kapalı'::text;
  end if;
  if has_function_privilege('anon', 'public._migration_kaydet(text)', 'execute') then
    eksik := eksik || '_migration_kaydet anon''a açık kalmış'::text;
  end if;
  if has_function_privilege('anon', 'public._defter_doldur()', 'execute') then
    eksik := eksik || '_defter_doldur anon''a açık kalmış'::text;
  end if;
  if has_table_privilege('anon', 'public.uygulanan_migrationlar', 'select') then
    eksik := eksik || 'defter tablosu anon''a açık kalmış'::text;
  end if;

  -- SAHİPLİK KAPISI GÖVDEDE Mİ. Düşerse kadrodaki herhangi bir öğretmen
  -- kurulum defterini okur.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'surum_defteri'
      and pg_get_functiondef(p.oid) like '%_yonetici%'
  ) then
    eksik := eksik || 'surum_defteri sahiplik kapısı taşımıyor'::text;
  end if;

  -- 0041 KENDİ SATIRINI YAZMIŞ MI, ve 'migration' olarak mı.
  if not exists (
    select 1 from public.uygulanan_migrationlar
    where dosya = '0041' and kaynak = 'migration'
  ) then
    eksik := eksik || '0041 kendi satırını yazmamış'::text;
  end if;

  -- DEFTER YEDEĞE SIZMASIN. Yedek boş bir projeye geri yüklenebiliyor;
  -- şema oradaki migration'lardan gelir, yedekten değil. Defter yedeğe
  -- girseydi, migration'ları hiç çalıştırmamış bir proje "hepsi uygulandı"
  -- diye böbürlenirdi — ve bu, yedeğin işe yarayacağı gün ortaya çıkardı.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'disa_aktar'
      and pg_get_functiondef(p.oid) like '%uygulanan_migrationlar%'
  ) then
    eksik := eksik || 'defter yedeğe girmiş (disa_aktar)'::text;
  end if;

  if array_length(eksik, 1) is not null then
    raise exception '0041 EKSİK KALDI: %', array_to_string(eksik, ' | ');
  end if;

  select count(*) into v_adet from public.uygulanan_migrationlar;
  raise notice '0041 tamam — sürüm defteri hazır, % satır.', v_adet;
end;
$$;
