-- =============================================================================
-- SEKİZ — TOPLU EKLEMEDE EŞLEŞTİRME TESTLERİ (0043)
--
-- NEDEN VAR: öğretmen sınıfları önce numarasız eklemişti; aynı listeleri
-- numaralarla yeniden yükleyince her sınıf iki katına çıktı. 0043 bunu
-- kapatıyor — sınıfta zaten duran öğrenciyi tanıyıp numarasını yazıyor.
--
-- BU DOSYANIN ASIL ÖLÇÜMÜ: eşleşen öğrencinin **GİRİŞ KODU DEĞİŞMİYOR**
-- (3. grup). Numarayı yazarken kod da yenilenseydi, öğrencinin ve velinin
-- elindeki kâğıt sessizce geçersiz olurdu — ve bu, kimse giriş yapmayı
-- denemeden fark edilmezdi.
--
-- İkinci ağırlık BELİRSİZLİK (6. grup): sınıfta aynı adda iki aktif
-- öğrenci varsa hangisinin numarası yazılacağı bilinmiyor. Tahmin etmek,
-- YANLIŞ ÇOCUĞUN kaydını değiştirmek demek.
--
-- NOT: hiçbir blokta `exception when others` YOK — böyle bir yakalayıcı
-- kendinden önceki grupların hatalarını yutar (0022'de yapılan hata).
--
-- SAYILAR FARK OLARAK ÖLÇÜLÜYOR. Süit bütün test dosyalarını AYNI
-- veritabanında koşturuyor.
--
-- İZOLASYON: kendi sınıfımızı (5U) kuruyoruz.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text;
  v_s uuid;
  v jsonb; kayit jsonb;
  n integer; n0 integer; k0 integer;
  mevcut_id uuid; ikinci_id uuid;
  kod_once text; kod_sonra text;
  veli_once text;
  mesaj text;
begin
  update public.ogretmenler
     set pin_hash = extensions.crypt('Eslestir!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Eslestir!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (5, 'U')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_s;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    select g.id, v_s from public.ogretmenler g where g.yonetici
    on conflict do nothing;

  -- Temiz başlangıç: bu sınıf yalnız bu dosyanın.
  delete from public.ogrenciler where sinif_id = v_s;

  -- ---------------------------------------------------------------------------
  -- 1. BAYRAK KAPALIYKEN BUGÜNKÜ DAVRANIŞ AYNEN SÜRÜYOR
  --
  -- Geriye uyumluluk ölçümü: bir arayüz sürümü geride kalırsa sessizce
  -- kayıt güncellemeye başlamamalı. Kapalı bayrakla aynı ad iki kayıt
  -- üretiyor — bu, düzeltilen kusurun ta kendisi, ama VARSAYILAN davranış
  -- değişmedi ve değişmediği ölçülüyor.
  -- ---------------------------------------------------------------------------
  v := public.ogrenciler_toplu_ekle(
         jt, 'okul', v_s, '[{"ad":"Eski Kayıt","no":null}]'::jsonb);
  select count(*) into n0 from public.ogrenciler where sinif_id = v_s and aktif;
  if n0 <> 1 then raise exception '1a: kurulumda 1 öğrenci bekleniyordu, %', n0; end if;

  v := public.ogrenciler_toplu_ekle(
         jt, 'okul', v_s, '[{"ad":"Eski Kayıt","no":"501"}]'::jsonb);
  select count(*) into n from public.ogrenciler where sinif_id = v_s and aktif;
  if n <> 2 then
    raise exception '1b: bayrak kapalıyken yeni kayıt açılmalıydı, % var', n;
  end if;
  if (v->'eklenen'->0->>'durum') is distinct from 'eklendi' then
    raise exception '1c: durum ''eklendi'' olmalıydı: %', v->'eklenen'->0->>'durum';
  end if;
  if (v->>'eklendi')::int <> 1 or (v->>'guncellendi')::int <> 0 then
    raise exception '1d: sayaçlar yanlış: %', v;
  end if;
  raise notice '1 OK — bayrak kapalıyken eski davranış aynen sürüyor';

  -- Sahneyi kur: tek bir numarasız öğrenci kalsın.
  delete from public.ogrenciler where sinif_id = v_s;
  v := public.ogrenciler_toplu_ekle(
         jt, 'okul', v_s, '["Eşleşen Öğrenci"]'::jsonb);
  mevcut_id := (v->'eklenen'->0->>'id')::uuid;
  kod_once  := v->'eklenen'->0->>'ogrenci_kodu';
  veli_once := v->'eklenen'->0->>'veli_kodu';
  select count(*) into k0 from public.giris_kodlari where ogrenci_id = mevcut_id;
  if k0 <> 2 then raise exception '1e: kurulumda 2 kod bekleniyordu, %', k0; end if;

  -- ---------------------------------------------------------------------------
  -- 2. BAYRAK AÇIKKEN: NUMARA YAZILIYOR, YENİ KAYIT AÇILMIYOR
  -- ---------------------------------------------------------------------------
  v := public.ogrenciler_toplu_ekle(
         jt, 'okul', v_s, '[{"ad":"EŞLEŞEN  ÖĞRENCİ","no":"502"}]'::jsonb, true);

  select count(*) into n from public.ogrenciler where sinif_id = v_s and aktif;
  if n <> 1 then
    raise exception '2a: yeni kayıt açılmış — sınıfta % öğrenci var', n;
  end if;
  select ogrenci_no into mesaj from public.ogrenciler where id = mevcut_id;
  if mesaj is distinct from '502' then
    raise exception '2b: numara yazılmadı: %', coalesce(mesaj, '(boş)');
  end if;
  if (v->'eklenen'->0->>'id')::uuid <> mevcut_id then
    raise exception '2c: dönen kayıt mevcut öğrenci değil';
  end if;
  if (v->'eklenen'->0->>'durum') is distinct from 'guncellendi' then
    raise exception '2d: durum ''guncellendi'' olmalıydı: %', v->'eklenen'->0->>'durum';
  end if;
  if (v->>'guncellendi')::int <> 1 or (v->>'eklendi')::int <> 0 then
    raise exception '2e: sayaçlar yanlış: %', v;
  end if;
  raise notice '2 OK — eşleşen öğrencinin numarası yazıldı, yeni kayıt açılmadı';

  -- ---------------------------------------------------------------------------
  -- 3. GİRİŞ KODU DEĞİŞMEDİ  ← BU DOSYANIN ASIL ÖLÇÜMÜ
  --
  -- Kod yenilenseydi, dağıtılmış kâğıtlar sessizce geçersiz olurdu ve bu
  -- ancak biri giriş yapmayı deneyince anlaşılırdı.
  -- ---------------------------------------------------------------------------
  select count(*) into n from public.giris_kodlari where ogrenci_id = mevcut_id;
  if n <> 2 then
    raise exception '3a: kod sayısı % oldu — yeni kod üretilmiş', n;
  end if;
  select kod into kod_sonra from public.giris_kodlari
   where ogrenci_id = mevcut_id and rol = 'ogrenci';
  if kod_sonra is distinct from kod_once then
    raise exception '3b: öğrenci kodu DEĞİŞTİ (% → %)', kod_once, kod_sonra;
  end if;
  select kod into mesaj from public.giris_kodlari
   where ogrenci_id = mevcut_id and rol = 'veli';
  if mesaj is distinct from veli_once then
    raise exception '3c: veli kodu DEĞİŞTİ (% → %)', veli_once, mesaj;
  end if;
  -- Dönen satır uydurulmuş bir kod değil, kayıttaki kod olmalı: öğretmen
  -- bu listeden kod dağıtıyor.
  if (v->'eklenen'->0->>'ogrenci_kodu') is distinct from kod_once then
    raise exception '3d: dönen kod kayıttakiyle eşleşmiyor: %',
      v->'eklenen'->0->>'ogrenci_kodu';
  end if;
  raise notice '3 OK — eşleşen öğrencinin kodları AYNI kaldı, dönen liste kayıtla eşleşiyor';

  -- ---------------------------------------------------------------------------
  -- 4. TÜRKÇE BÜYÜK HARF EŞLEŞTİ, KAYITLI AD DEĞİŞMEDİ
  --
  -- e-Okul listeleri adları BÜYÜK HARFLE veriyor. `_ad_anahtari`
  -- bozulursa hiçbir ad eşleşmez ve kopyalar yeniden üremeye başlar —
  -- üstelik sessizce.
  -- ---------------------------------------------------------------------------
  select ad into mesaj from public.ogrenciler where id = mevcut_id;
  if mesaj is distinct from 'Eşleşen Öğrenci' then
    raise exception '4a: kayıtlı ad ezilmiş: %', mesaj;
  end if;
  if (v->'eklenen'->0->>'ad') is distinct from 'Eşleşen Öğrenci' then
    raise exception '4b: dönen ad kayıttaki ad değil: %', v->'eklenen'->0->>'ad';
  end if;
  -- Anahtarın kendisi de ölçülüyor: "I" ve "İ" ayrı harfler.
  -- (Panel temizlik dosyalarındaki ayrı kopya `kopya_temizlik_testleri.sql`
  --  içinde, dosyanın kendisi çalıştırılarak ölçülüyor.)
  if public._ad_anahtari('ALİ  IŞIK') is distinct from 'ali ışık'
     or public._ad_anahtari('  Ali Işık ') is distinct from 'ali ışık'
     or public._ad_anahtari('ÇĞÖŞÜ') is distinct from 'çğöşü' then
    raise exception '4c: _ad_anahtari Türkçeyi bozuyor: %',
      public._ad_anahtari('ALİ  IŞIK');
  end if;
  raise notice '4 OK — büyük harfli liste eşleşti, kayıtlı ad olduğu gibi kaldı';

  -- ---------------------------------------------------------------------------
  -- 5. EŞLEŞMEYEN EKLENİYOR, KARIŞIK LİSTE DOĞRU AYRILIYOR
  -- ---------------------------------------------------------------------------
  v := public.ogrenciler_toplu_ekle(jt, 'okul', v_s,
         '[{"ad":"Eşleşen Öğrenci","no":"502"},{"ad":"Yeni Öğrenci","no":"503"}]'::jsonb,
         true);
  select count(*) into n from public.ogrenciler where sinif_id = v_s and aktif;
  if n <> 2 then raise exception '5a: 2 öğrenci bekleniyordu, %', n; end if;
  if (v->>'eklendi')::int <> 1 or (v->>'degismedi')::int <> 1
     or (v->>'guncellendi')::int <> 0 then
    raise exception '5b: sayaçlar yanlış — beklenen 1 eklendi / 1 değişmedi: %', v;
  end if;
  -- Numarası zaten aynı olana "güncellendi" demek yalan olurdu.
  if (v->'eklenen'->0->>'durum') is distinct from 'degismedi' then
    raise exception '5c: aynı numara için durum ''degismedi'' olmalıydı: %',
      v->'eklenen'->0->>'durum';
  end if;
  if (v->'eklenen'->1->>'durum') is distinct from 'eklendi' then
    raise exception '5d: yeni ad için durum ''eklendi'' olmalıydı: %',
      v->'eklenen'->1->>'durum';
  end if;
  -- Yeni öğrenciye kod üretilmeli.
  if (select count(*) from public.giris_kodlari
       where ogrenci_id = (v->'eklenen'->1->>'id')::uuid) <> 2 then
    raise exception '5e: yeni öğrenciye iki kod üretilmedi';
  end if;
  raise notice '5 OK — karışık liste ayrıldı: 1 eklendi, 1 değişmedi';

  -- ---------------------------------------------------------------------------
  -- 6. SINIFTA AYNI ADDA İKİ ÖĞRENCİ VARSA: HATA, VE HİÇBİR ŞEY YAZILMIYOR
  --
  -- Belirsizken tahmin etmek, yanlış çocuğun kaydını değiştirmek demek.
  -- ---------------------------------------------------------------------------
  -- Bilerek bir adaş üretiliyor (bayrak kapalı, yani kopya açılıyor).
  v := public.ogrenciler_toplu_ekle(
         jt, 'okul', v_s, '[{"ad":"Eşleşen Öğrenci","no":"504"}]'::jsonb);
  ikinci_id := (v->'eklenen'->0->>'id')::uuid;
  select count(*) into n0 from public.ogrenciler where sinif_id = v_s and aktif;
  if n0 <> 3 then raise exception '6a: adaş kurulamadı, % öğrenci var', n0; end if;

  begin
    -- Listede ÖNCE geçerli yeni bir ad var: belirsizlik yüzünden o da
    -- yazılmamalı. "Önce denetle, sonra yaz" bunun için.
    perform public.ogrenciler_toplu_ekle(jt, 'okul', v_s,
      '[{"ad":"Yazılmamalı","no":"505"},{"ad":"Eşleşen Öğrenci","no":"506"}]'::jsonb,
      true);
    raise exception '6b: belirsiz eşleşme kabul edildi';
  exception when sqlstate '22023' then
    get stacked diagnostics mesaj = message_text;
  end;

  if mesaj is null or mesaj not like '%Eşleşen Öğrenci%' then
    raise exception '6c: hata adı söylemiyor, öğretmen hangi satır olduğunu bilemez: %',
      coalesce(mesaj, '(mesaj yok)');
  end if;
  select count(*) into n from public.ogrenciler where sinif_id = v_s and aktif;
  if n <> n0 then
    raise exception '6d: hataya rağmen kayıt yazılmış (% → %)', n0, n;
  end if;
  if exists (select 1 from public.ogrenciler
              where sinif_id = v_s and ad = 'Yazılmamalı') then
    raise exception '6e: hatadan önceki satır yazılmış';
  end if;
  raise notice '6 OK — belirsiz eşleşmede hata verildi, hiçbir şey yazılmadı';

  -- ---------------------------------------------------------------------------
  -- 7. LİSTEDE AYNI AD İKİ KEZ: BİRİNCİ, İKİNCİYİ EZMİYOR
  --
  -- Bir sınıfta gerçek adaşlar olabilir. Bu şart olmasaydı ikinci satır,
  -- az önce eklenen birinciyi "mevcut öğrenci" sanıp onun numarasını ezer
  -- ve iki çocuktan biri kayıt dışı kalırdı.
  -- ---------------------------------------------------------------------------
  delete from public.ogrenciler where sinif_id = v_s;
  v := public.ogrenciler_toplu_ekle(jt, 'okul', v_s,
         '[{"ad":"İkiz Kardeş","no":"601"},{"ad":"İKİZ KARDEŞ","no":"602"}]'::jsonb,
         true);
  select count(*) into n from public.ogrenciler where sinif_id = v_s and aktif;
  if n <> 2 then
    raise exception '7a: iki adaş için 2 kayıt bekleniyordu, % var', n;
  end if;
  select count(distinct ogrenci_no) into n
    from public.ogrenciler where sinif_id = v_s and aktif;
  if n <> 2 then
    raise exception '7b: numaralardan biri ezilmiş — % ayrı numara var', n;
  end if;
  if (v->>'eklendi')::int <> 2 then
    raise exception '7c: ikisi de eklenmeliydi: %', v;
  end if;
  raise notice '7 OK — listedeki adaşlar ayrı kayıt oldu, numara ezilmedi';

  -- ---------------------------------------------------------------------------
  -- 8. NUMARASIZ SATIR, MEVCUT NUMARAYI SİLMİYOR
  --
  -- Düz ad listesi yapıştıran öğretmen, daha önce girilmiş numaraları
  -- kaybetmemeli.
  -- ---------------------------------------------------------------------------
  delete from public.ogrenciler where sinif_id = v_s;
  v := public.ogrenciler_toplu_ekle(
         jt, 'okul', v_s, '[{"ad":"Numaralı Öğrenci","no":"701"}]'::jsonb);
  mevcut_id := (v->'eklenen'->0->>'id')::uuid;

  v := public.ogrenciler_toplu_ekle(
         jt, 'okul', v_s, '["Numaralı Öğrenci"]'::jsonb, true);
  select ogrenci_no into mesaj from public.ogrenciler where id = mevcut_id;
  if mesaj is distinct from '701' then
    raise exception '8a: mevcut numara silindi: %', coalesce(mesaj, '(boş)');
  end if;
  if (v->'eklenen'->0->>'durum') is distinct from 'degismedi' then
    raise exception '8b: durum ''degismedi'' olmalıydı: %', v->'eklenen'->0->>'durum';
  end if;
  select count(*) into n from public.ogrenciler where sinif_id = v_s and aktif;
  if n <> 1 then raise exception '8c: yeni kayıt açılmış, % var', n; end if;
  raise notice '8 OK — numarasız satır mevcut numarayı silmedi, kopya da açmadı';

  -- ---------------------------------------------------------------------------
  -- 9. DENETİM İZİ (Part XLIII) — eski ve yeni numarayla
  -- ---------------------------------------------------------------------------
  v := public.ogrenciler_toplu_ekle(
         jt, 'okul', v_s, '[{"ad":"Numaralı Öğrenci","no":"702"}]'::jsonb, true);
  if not exists (
    select 1 from public.denetim_izi
    where islem = 'ogrenci_no_guncellendi' and kayit_id = mevcut_id
      and eski->>'ogrenci_no' = '701' and yeni->>'ogrenci_no' = '702'
  ) then
    raise exception '9a: numara güncellemesi denetim izine eski/yeni ile yazılmadı';
  end if;
  raise notice '9 OK — numara güncellemesi izde, eski ve yeni değeriyle';

  -- ---------------------------------------------------------------------------
  -- 10. ESKİ İMZA DÜŞTÜ (0007) VE BAYRAK VARSAYILAN OLARAK KAPALI
  --
  -- Eski 4 parametreli imza kalsaydı, PostgREST bayraksız çağrıyı ona
  -- yönlendirebilir ve eşleştirme HİÇ çalışmazdı: öğretmen seçeneği
  -- işaretler, kopyalar yine üretilirdi.
  -- ---------------------------------------------------------------------------
  -- TÜR LİSTESİ `oidvectortypes` İLE. `pg_get_function_identity_arguments`
  -- parametre ADLARINI da döndürüyor (`p_token text, ...`); onunla
  -- karşılaştırmak hiçbir zaman tutmayan, yani asla kalamayan bir ölçüm
  -- olurdu — 0042'de tam olarak öyle yazılmış.
  if exists (
    select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = 'ogrenciler_toplu_ekle'
      and pg_catalog.oidvectortypes(p.proargtypes) = 'text, text, uuid, jsonb'
  ) then
    raise exception '10a: eski 4 parametreli imza hâlâ duruyor';
  end if;
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'ogrenciler_toplu_ekle';
  if n <> 1 then raise exception '10b: ogrenciler_toplu_ekle % imzalı', n; end if;

  -- Yardımcı anon'a kapalı olmalı (0005 deseni).
  if has_function_privilege('anon', 'public._ad_anahtari(text)', 'execute') then
    raise exception '10c: _ad_anahtari anon''a açık';
  end if;
  raise notice '10 OK — tek imza, eski imza düştü, yardımcı anon''a kapalı';

  -- TEMİZLİK
  delete from public.ogrenciler where sinif_id = v_s;
  delete from public.denetim_izi where islem = 'ogrenci_no_guncellendi';

  raise notice '';
  raise notice 'TOPLU EŞLEŞTİRME TESTLERİ: 10 GRUP GEÇTİ';
end $$;
