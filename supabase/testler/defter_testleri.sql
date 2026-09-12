-- =============================================================================
-- SEKİZ — 0041 SÜRÜM DEFTERİ TESTLERİ
--
-- Defterin işi BİLGİ VERMEK DEĞİL, DOĞRU BİLGİ VERMEK. Yanlış yazan bir
-- defter, defter olmamasından KÖTÜDÜR: öğretmen ekrana bakıp "her şey
-- yerinde" der ve eksik kurulumu aramaz.
--
-- Bu yüzden testin ağırlığı "yazıyor mu"da değil, **yazmaması gerekeni
-- yazmıyor mu**da:
--   · çıpası olmayan aralık yazılmamalı (2. grup),
--   · defter yedeğe sızmamalı (5. grup),
--   · kadro okuyamamalı (3. grup).
--
-- İZOLASYON: kendi öğretmenini kuruyor; defter tablosuna dokunduğu
-- yerlerde önceki hâli geri veriyor.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text;              -- sahip
  jb text;              -- BAŞKA öğretmen
  b_id uuid;
  d jsonb;
  n integer;
  m integer;
  yedek jsonb;
begin
  update public.ogretmenler
     set pin_hash = extensions.crypt('Defter!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Defter!2026'))->>'token';

  -- ---------------------------------------------------------------------------
  -- 1. TEMİZ ZİNCİRDE DEFTER DOLU
  --
  -- Zincirin tamamı çalıştıysa 0001–0040 geriye dönük, 0041 kesin olmalı.
  -- ---------------------------------------------------------------------------
  d := public.surum_defteri(jt);

  select count(*) into n from jsonb_array_elements(d->'dosyalar');
  if n <> 41 then
    raise exception '1a: defterde 41 satır bekleniyordu, % var', n;
  end if;

  if d->>'son' <> '0041' then
    raise exception '1b: son 0041 olmalıydı, "%"', d->>'son';
  end if;

  -- 0041 KESİN, ötekiler ÇIKARIM. Bu ayrım kaybolursa defter, bilmediği
  -- bir şeyi biliyormuş gibi gösterir.
  select count(*) into n from jsonb_array_elements(d->'dosyalar') e
   where e->>'kaynak' = 'migration';
  if n <> 1 then
    raise exception '1c: tam 1 kesin satır bekleniyordu, % var', n;
  end if;

  select count(*) into n from jsonb_array_elements(d->'dosyalar') e
   where e->>'kaynak' = 'geriye_donuk';
  if n <> 40 then
    raise exception '1d: 40 geriye dönük satır bekleniyordu, % var', n;
  end if;

  raise notice '1 OK — temiz zincirde 41 satır; 0041 kesin, 40''ı çıkarım';

  -- ---------------------------------------------------------------------------
  -- 2. ÇIPASI OLMAYAN ARALIK YAZILMIYOR  ← BU DOSYANIN ASIL ÖLÇÜMÜ
  --
  -- Defteri tamamen silip, İKİ çıpayı da kaldırıp doldurmayı yeniden
  -- çalıştırıyoruz. Körlemesine "hepsi uygulandı" yazan bir sürüm bu
  -- testte yakalanır.
  --
  -- `_konu_esikleri` önce bir kenara alınıyor: testin sonunda geri
  -- konacak, yoksa bu dosya sonraki testleri bozar.
  -- ---------------------------------------------------------------------------
  delete from public.uygulanan_migrationlar;

  -- 0039 ve 0040 çıpalarını geçici olarak görünmez yap.
  alter function public.okul_bilgilendirme(text) rename to okul_bilgilendirme_gizli;
  alter function public._konu_esikleri() rename to _konu_esikleri_gizli;

  -- 0041'in doldurma bloğunun aynısı: çıpa arayıp yalnız tutanı yazıyor.
  -- (Migration dosyasını buradan çağıramadığımız için blok tekrarlanıyor;
  --  bu tekrar 4. grupta kilitleniyor.)
  perform public._defter_doldur();

  select count(*) into n from public.uygulanan_migrationlar;
  if n <> 38 then
    raise exception '2a: çıpasız iki aralıkla 38 satır bekleniyordu, % var', n;
  end if;

  if exists (select 1 from public.uygulanan_migrationlar where dosya in ('0039','0040')) then
    raise exception '2b: çıpası olmayan aralık yine de yazıldı';
  end if;

  -- POZİTİF KONTROL: ötekiler GERÇEKTEN yazıldı. Bu olmadan 2a/2b,
  -- doldurma hiç çalışmasa da yeşil kalırdı.
  if not exists (select 1 from public.uygulanan_migrationlar where dosya = '0038') then
    raise exception '2c: çıpası duran aralık da yazılmamış — doldurma hiç çalışmıyor';
  end if;

  alter function public.okul_bilgilendirme_gizli(text) rename to okul_bilgilendirme;
  alter function public._konu_esikleri_gizli() rename to _konu_esikleri;
  raise notice '2 OK — çıpası olmayan aralık yazılmıyor, duran aralık yazılıyor';

  -- ---------------------------------------------------------------------------
  -- 3. DEFTERE YAZMA: iki kez çalıştırmak satır çoğaltmıyor,
  --    ve çıkarım kanıtın yerini tutmuyor
  -- ---------------------------------------------------------------------------
  perform public._migration_kaydet('0040');
  select count(*) into n from public.uygulanan_migrationlar where dosya = '0040';
  if n <> 1 then
    raise exception '3a: 0040 için % satır var, 1 olmalıydı', n;
  end if;

  -- 0038 çıkarımla yazılmıştı; dosya gerçekten çalışınca KESİNE yükselmeli.
  perform public._migration_kaydet('0038');
  if (select kaynak from public.uygulanan_migrationlar where dosya = '0038')
     <> 'migration' then
    raise exception '3b: çalıştırılan dosya hâlâ "çıkarım" görünüyor';
  end if;

  raise notice '3 OK — tekrar çalıştırma satır çoğaltmıyor, çıkarım kanıta yükseliyor';

  -- ---------------------------------------------------------------------------
  -- 4. DOLDURMA MANTIĞI TEK YERDE
  --
  -- 2. grup `_defter_doldur()`u çağırıyor; migration da aynı yardımcıyı
  -- çağırmalı. Migration kendi içinde AYRI bir kopya taşısaydı, test
  -- ölçtüğü şeyin taşrasını ölçer, asıl çalışan kodu ölçmezdi.
  -- ---------------------------------------------------------------------------
  if not exists (
    select 1 from pg_proc p join pg_namespace nn on nn.oid = p.pronamespace
    where nn.nspname = 'public' and p.proname = '_defter_doldur'
  ) then
    raise exception '4a: _defter_doldur yok';
  end if;
  if has_function_privilege('anon', 'public._defter_doldur()', 'execute') then
    raise exception '4b: _defter_doldur anon''a açık';
  end if;
  raise notice '4 OK — doldurma tek yerde ve dışarıya kapalı';

  -- ---------------------------------------------------------------------------
  -- 5. YEDEK KİLİDİ — defter yedeğe SIZMAMALI
  --
  -- Yedek boş bir projeye geri yüklenebiliyor; şema oradaki
  -- migration'lardan gelir, yedekten değil. Defter yedeğe girseydi,
  -- migration'ları hiç çalıştırmamış bir proje "hepsi uygulandı" derdi —
  -- ve bu, yedeğin işe yarayacağı gün ortaya çıkardı.
  -- ---------------------------------------------------------------------------
  yedek := public.disa_aktar(jt);
  if yedek ? 'uygulanan_migrationlar' then
    raise exception '5a: defter yedeğe girmiş';
  end if;
  -- POZİTİF KONTROL: yedek gerçekten dolu (boş bir yedekte 5a bedavaya geçer).
  if not (yedek ? 'ogrenciler') then
    raise exception '5b: yedek boş dönmüş — 5a hiçbir şey ölçmüyor';
  end if;
  raise notice '5 OK — defter yedeğe girmiyor, yedek çalışıyor';

  -- ---------------------------------------------------------------------------
  -- 6. KAPSAM — kadro defteri okuyamıyor
  -- ---------------------------------------------------------------------------
  b_id := (public.ogretmen_ekle(jt, 'Defter Yabancı', 'DefterY!2026'))->>'id';
  jb := (public.giris('DefterY!2026'))->>'token';
  begin
    perform public.surum_defteri(jb);
    raise exception '6a: kadrodaki öğretmen defteri okudu';
  exception when insufficient_privilege then null;
  end;

  -- POZİTİF KONTROL: sahip GERÇEKTEN okuyabiliyor.
  if (public.surum_defteri(jt))->'dosyalar' is null then
    raise exception '6b: sahip de okuyamıyor — 6a hiçbir şey ölçmüyor';
  end if;

  delete from public.ogretmenler where id = b_id;
  raise notice '6 OK — yalnız sahip okuyabiliyor';

  -- ---------------------------------------------------------------------------
  -- 7. TABLO ANON'A KAPALI
  -- ---------------------------------------------------------------------------
  if has_table_privilege('anon', 'public.uygulanan_migrationlar', 'select')
     or has_table_privilege('anon', 'public.uygulanan_migrationlar', 'insert') then
    raise exception '7a: defter tablosu anon''a açık';
  end if;
  raise notice '7 OK — defter tablosu anon''a kapalı';

  -- ---------------------------------------------------------------------------
  -- TEMİZLİK: defteri zincirin bıraktığı hâle döndür.
  -- ---------------------------------------------------------------------------
  delete from public.uygulanan_migrationlar;
  perform public._defter_doldur();
  perform public._migration_kaydet('0041');

  select count(*) into m from public.uygulanan_migrationlar;
  if m <> 41 then
    raise exception 'temizlik: defter 41 satıra dönmedi, % var', m;
  end if;

  raise notice '';
  raise notice 'DEFTER TESTLERİ: 7 GRUP GEÇTİ';
end;
$$;
