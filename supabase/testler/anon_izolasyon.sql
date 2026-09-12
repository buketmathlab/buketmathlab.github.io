-- =============================================================================
-- SEKİZ — anon rolü izolasyon testleri
--
-- Bu dosya, dışarıdan (tarayıcıdan) erişilebilen `anon` rolünün NE
-- YAPAMAYACAĞINI doğrular. Faz 1'de burada gerçek bir açık yakalandı:
-- PostgreSQL yeni fonksiyonlara PUBLIC üzerinden EXECUTE veriyordu ve
-- `_oturum_ac('ogretmen', null)` dışarıdan çağrılabiliyordu — PIN bilmeden
-- öğretmen jetonu üretmek mümkündü. 0005 bunu kapattı; bu test nöbette.
--
-- ## ELLE LİSTE KALDIRILDI — NEDEN
--
-- Bu test, dahili fonksiyonları ELLE YAZILMIŞ bir diziden sınıyordu ve
-- dizi geride kalmıştı: depodaki 29 dahili fonksiyonun **14'ü** hiç
-- süpürülmüyordu (`_denetim`, `_oturum`, `_konu_analizi`, `_soru_dokumu`,
-- `_aktor`, 0040'ta eklenen `_konu_esikleri`/`_konu_durumu`, …).
--
-- Hiçbiri açık değildi — ayrıca ölçüldü. Kusur açık olmaları değil,
-- **yeniden açılsalar hiçbir testin yakalamayacak olmasıydı.** Nöbetçi,
-- kapının yarısını hiç görmüyordu.
--
-- Bu, 0041 turunun konusuyla aynı hastalık: elle tutulan kayıt kayar.
-- Onun için liste kaldırıldı, yerine KATALOGDAN SAYIM kondu. Artık yeni
-- bir dahili fonksiyon ya da tablo eklemek, onu kendiliğinden nöbete
-- sokuyor; kimsenin bir listeye ekleme yapması gerekmiyor.
--
-- Sayım `has_*_privilege` ile yapılıyor: yetkinin KENDİSİNİ soruyor,
-- çağırmayı denemiyor. Çağırarak sınamak her fonksiyon için doğru
-- argüman tipi bilmeyi gerektirirdi — listenin en baştaki sebebi de buydu.
-- Çağrılı sınama yine de duruyor (aşağıda, temsilciler üzerinde): katalog
-- iddiasının çalışma anındaki davranışla örtüştüğü görülsün.
-- =============================================================================

\set ON_ERROR_STOP on

do $$
declare
  r         record;
  sonuc     text;
  acik      text[] := '{}';
  sayi      integer;
  temsilci  text[] := array[
    -- POZİTİF KONTROL DEĞİL, ÖRTÜŞME KONTROLÜ: katalog "kapalı" diyor,
    -- gerçekten çağrılamıyor mu. Elle tutulan tek liste bu kaldı ve
    -- eksik kalması kapsamı daraltmıyor — tam süpürme yukarıda.
    '_oturum_ac(''ogretmen'',null)',
    '_yeni_kod()',
    '_token_hash(''x'')',
    '_yonetici(''x'')',
    '_gecerli_onam_surumu()',
    '_konu_esikleri()',
    '_migration_kaydet(''0000'')'
  ];
  f text;
begin
  -- ---------------------------------------------------------------------------
  -- 1. TABLOLAR — public şemasındaki HEPSİ
  --
  -- Erişim yalnız `security definer` fonksiyonlardan olmalı; anon hiçbir
  -- tabloya doğrudan dokunamamalı.
  -- ---------------------------------------------------------------------------
  sayi := 0;
  for r in
    select c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
     order by c.relname
  loop
    sayi := sayi + 1;
    if has_table_privilege('anon', format('public.%I', r.relname), 'select')
       or has_table_privilege('anon', format('public.%I', r.relname), 'insert')
       or has_table_privilege('anon', format('public.%I', r.relname), 'update')
       or has_table_privilege('anon', format('public.%I', r.relname), 'delete') then
      acik := acik || r.relname;
    end if;
  end loop;

  if array_length(acik, 1) is not null then
    raise exception 'KRİTİK: anon şu tablolara erişebiliyor: %',
      array_to_string(acik, ', ');
  end if;
  if sayi < 18 then
    -- Sayım çökerse (şema adı değişir, sorgu bozulur) test sessizce
    -- "hepsi kapalı" derdi. Alt sınır, boş süpürmeyi ihbar ediyor.
    raise exception 'Tablo sayımı beklenenden az: % — süpürme bozulmuş olabilir', sayi;
  end if;
  raise notice '    % tablonun tamamı anon''a kapalı: OK', sayi;

  -- ---------------------------------------------------------------------------
  -- 2. DAHİLİ FONKSİYONLAR — `_` ile başlayan HEPSİ
  --
  -- Kural istisnasız: depoda `grant execute … public._` hiç yok. Bu yüzden
  -- sayım güvenli — bir gün bilerek bir istisna gerekirse bu test kırmızı
  -- yanar ve istisna TARTIŞILARAK eklenir; sessizce sızmaz.
  -- ---------------------------------------------------------------------------
  acik := '{}';
  sayi := 0;
  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as imza
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     -- `like '_%'` OLMAZ: LIKE'da `_` tek karakter jokeri, yani HER
     -- fonksiyonu eşlerdi ve süpürme sessizce genişlerdi. Baştaki
     -- karaktere doğrudan bakmak hem doğru hem tartışmasız.
     where n.nspname = 'public' and left(p.proname, 1) = '_'
     order by p.proname
  loop
    sayi := sayi + 1;
    if has_function_privilege('anon', r.oid, 'execute') then
      acik := acik || format('%s(%s)', r.proname, r.imza);
    end if;
  end loop;

  if array_length(acik, 1) is not null then
    raise exception 'KRİTİK: anon şu dahili fonksiyonları çağırabiliyor: %',
      array_to_string(acik, ', ');
  end if;
  if sayi < 29 then
    raise exception 'Dahili fonksiyon sayımı beklenenden az: % — süpürme bozulmuş olabilir', sayi;
  end if;
  raise notice '    % dahili fonksiyonun tamamı anon''a kapalı: OK', sayi;

  -- ---------------------------------------------------------------------------
  -- 3. ÖRTÜŞME — katalog "kapalı" diyor, gerçekten de çağrılamıyor
  --
  -- 2. grup yetkiyi SORUYOR. Bu grup ÇAĞIRIYOR. İkisi ayrışırsa (örneğin
  -- bir gün fonksiyonlar başka bir yoldan erişilebilir olursa) burada
  -- görülür.
  -- ---------------------------------------------------------------------------
  foreach f in array temsilci loop
    begin
      execute format('set local role anon');
      execute format('select public.%s', f);
      reset role;
      raise exception 'KRİTİK: anon public.% fonksiyonunu çağırabiliyor!', f;
    exception
      when insufficient_privilege then
        reset role;
      when others then
        reset role;
        if sqlerrm like 'KRİTİK%' then raise; end if;
    end;
  end loop;
  raise notice '    % temsilci çağrı da reddedildi (katalogla örtüşüyor): OK',
    array_length(temsilci, 1);

  -- ---------------------------------------------------------------------------
  -- 4. AÇIK RPC ÇALIŞMAYA DEVAM ETMELİ
  --
  -- POZİTİF KONTROL. Bu olmadan yukarıdakilerin hepsi, anon rolü tamamen
  -- kilitli olsa da (yani uygulama hiç çalışmasa da) yeşil kalırdı.
  -- ---------------------------------------------------------------------------
  set local role anon;
  select (public.giris('GECERSIZKOD')) ->> 'rol' into sonuc;
  reset role;
  assert sonuc in ('yok', 'kurulum'), 'Açık giris() fonksiyonu çalışmalı';
  raise notice '    giris() anon tarafından çağrılabiliyor: OK';

  raise notice '';
  raise notice 'ANON İZOLASYON TESTLERİ GEÇTİ';
end;
$$;
