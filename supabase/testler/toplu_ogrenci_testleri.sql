-- =============================================================================
-- SEKİZ — TOPLU ÖĞRENCİ EKLEME TESTLERİ (0024)
--
-- Asıl soru ATOMİKLİK: partinin ortasında geçersiz bir ad varsa HİÇBİR
-- satır yazılmıyor mu? Yarım içe aktarma, öğretmeni "hangisi girdi?" diye
-- elle sayı saymaya iter ve bu ucun bütün varlık sebebini yok eder.
--
-- İkinci soru KODLAR: her öğrenciye iki kod üretiliyor mu, hepsi AYRI mı,
-- ve dönen değerler `giris_kodlari` ile birebir eşleşiyor mu? Kodsuz ya da
-- çakışan kodlu bir öğrenci sisteme hiç giremez.
--
-- NOT: hiçbir blokta `exception when others` YOK — böyle bir yakalayıcı
-- kendinden önceki grupların hatalarını yutar (0022'de yapılan hata).
--
-- SAYILAR FARK OLARAK ÖLÇÜLÜYOR. Süit bütün test dosyalarını AYNI
-- veritabanında koşturuyor; mutlak sayı varsayımı 0022'de kırılmıştı.
--
-- İZOLASYON: kendi sınıfımızı (5T) kuruyoruz. 5Z, 6K, 6N, 6R, 6Z, 7R, 7V,
-- 7Z, 8K, 8Z başka dosyalara ait.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text;
  v_s uuid; v_ozel uuid;
  v jsonb; kayit jsonb;
  n0 integer; n integer; k0 integer; k integer;
  adlar jsonb;
begin
  update public.ayarlar
     set ogretmen_pin_hash = extensions.crypt('Toplu!2026', extensions.gen_salt('bf', 10))
   where id = 1;
  jt := (public.giris('Toplu!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (5, 'T')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_s;

  -- ---------------------------------------------------------------------------
  -- 1 — 30 AD TEK ÇAĞRIDA: 30 öğrenci, 60 kod
  -- ---------------------------------------------------------------------------
  select jsonb_agg('Toplu Öğrenci ' || i) into adlar from generate_series(1, 30) i;

  select count(*) into n0 from public.ogrenciler where sinif_id = v_s;
  select count(*) into k0 from public.giris_kodlari g
    join public.ogrenciler o on o.id = g.ogrenci_id where o.sinif_id = v_s;

  v := public.ogrenciler_toplu_ekle(jt, 'okul', v_s, adlar);

  if (v->>'adet')::int <> 30 then
    raise exception '1a: 30 beklenirken % döndü', v->>'adet';
  end if;

  select count(*) into n from public.ogrenciler where sinif_id = v_s;
  if n <> n0 + 30 then raise exception '1b: %  öğrenci yazıldı, 30 bekleniyordu', n - n0; end if;

  select count(*) into k from public.giris_kodlari g
    join public.ogrenciler o on o.id = g.ogrenci_id where o.sinif_id = v_s;
  if k <> k0 + 60 then raise exception '1c: % kod yazıldı, 60 bekleniyordu', k - k0; end if;

  raise notice '1 OK — 30 ad tek çağrıda 30 öğrenci ve 60 kod üretti';

  -- ---------------------------------------------------------------------------
  -- 2 — DÖNEN KODLAR GERÇEK VE HEPSİ AYRI
  --
  -- Uç kendi kod üretmiyor, `_yeni_kod`'u çağırıyor. Bu grup o güvenin
  -- karşılığını ölçüyor: dönen değer kayıtla eşleşmezse öğretmen çalışmayan
  -- bir kod dağıtırdı ve bunu ancak öğrenci giremeyince öğrenirdi.
  -- ---------------------------------------------------------------------------
  for kayit in select jsonb_array_elements(v->'eklenen') loop
    if not exists (select 1 from public.giris_kodlari g
                    where g.ogrenci_id = (kayit->>'id')::uuid
                      and g.rol = 'ogrenci' and g.kod = kayit->>'ogrenci_kodu') then
      raise exception '2a: dönen öğrenci kodu kayıtla eşleşmiyor: %', kayit;
    end if;
    if not exists (select 1 from public.giris_kodlari g
                    where g.ogrenci_id = (kayit->>'id')::uuid
                      and g.rol = 'veli' and g.kod = kayit->>'veli_kodu') then
      raise exception '2b: dönen veli kodu kayıtla eşleşmiyor: %', kayit;
    end if;
  end loop;

  -- 60 kodun hepsi ayrı olmalı
  select count(distinct kod) into n from (
    select x.value->>'ogrenci_kodu' as kod from jsonb_array_elements(v->'eklenen') x
    union all
    select x.value->>'veli_kodu' from jsonb_array_elements(v->'eklenen') x
  ) t;
  if n <> 60 then raise exception '2c: 60 kod arasında çakışma var (% ayrı)', n; end if;

  raise notice '2 OK — dönen 60 kod kayıtla birebir eşleşiyor ve hepsi ayrı';

  -- ---------------------------------------------------------------------------
  -- 4 — SINIRLAR
  -- ---------------------------------------------------------------------------
  begin
    perform public.ogrenciler_toplu_ekle(jt, 'okul', v_s, '[]'::jsonb);
    raise exception '4a: boş liste kabul edildi';
  exception when sqlstate '22023' then null;
  end;

  -- 4b — DİZİ OLMAYAN GİRDİ: sqlstate YETMİYOR, mesaj da ölçülüyor.
  --
  -- İlk yazımda yalnız `22023` bekliyordum ve test denetimin varlığını
  -- ÖLÇMÜYORDU: denetimi kaldırdığımda `jsonb_array_length` bir skalere
  -- uygulandığı için PostgreSQL'in kendi hatası da `22023` dönüyor ve test
  -- yine geçiyordu. Ölçülerek bulundu (0024 geri alma turu).
  --
  -- Fark öğretmenin gördüğü şeyde: bizim denetimimiz Türkçe konuşuyor,
  -- PostgreSQL'inki "cannot get array length of a scalar" diyor.
  declare mesaj text;
  begin
    begin
      perform public.ogrenciler_toplu_ekle(jt, 'okul', v_s, '"Ali"'::jsonb);
      raise exception '4b: dizi olmayan girdi kabul edildi';
    exception when sqlstate '22023' then
      get stacked diagnostics mesaj = message_text;
    end;
    if mesaj is null or mesaj not like '%dizi olmalı%' then
      raise exception '4b: Türkçe mesaj gelmedi, ham veritabanı hatası sızdı: %', mesaj;
    end if;
  end;

  select jsonb_agg('Sınır ' || i) into adlar from generate_series(1, 201) i;
  begin
    perform public.ogrenciler_toplu_ekle(jt, 'okul', v_s, adlar);
    raise exception '4c: 201 ad kabul edildi';
  exception when sqlstate '22023' then null;
  end;

  -- Okul öğrencisi sınıfsız olamaz (ogrenci_ekle ile aynı kural)
  begin
    perform public.ogrenciler_toplu_ekle(jt, 'okul', null, '["Sınıfsız Ali"]'::jsonb);
    raise exception '4d: sınıfsız okul öğrencisi kabul edildi';
  exception when sqlstate '22023' then null;
  end;

  begin
    perform public.ogrenciler_toplu_ekle(jt, 'yanlis', v_s, '["Ali"]'::jsonb);
    raise exception '4e: geçersiz tür kabul edildi';
  exception when sqlstate '22023' then null;
  end;

  raise notice '4 OK — boş liste, dizi olmayan girdi, 201 ad, sınıfsız okul ve geçersiz tür reddediliyor';

  -- ---------------------------------------------------------------------------
  -- 5 — MÜKERRER AD KABUL EDİLİYOR (kural bu)
  --
  -- Şemada `ad` üzerinde UNIQUE yok ve olmamalı: bir okulda aynı adda iki
  -- öğrenci gerçekten olur. Reddetseydik öğretmen gerçek bir öğrenciyi
  -- sisteme hiç ekleyemezdi. Uyarı ARAYÜZDE.
  -- ---------------------------------------------------------------------------
  v := public.ogrenciler_toplu_ekle(jt, 'okul', v_s,
         '["Aynı Adlı Öğrenci", "Aynı Adlı Öğrenci"]'::jsonb);
  if (v->>'adet')::int <> 2 then
    raise exception '5a: mükerrer ad reddedildi (% eklendi)', v->>'adet';
  end if;
  -- İki ayrı öğrenci, dört ayrı kod
  if (v->'eklenen'->0->>'id') = (v->'eklenen'->1->>'id')
     or (v->'eklenen'->0->>'ogrenci_kodu') = (v->'eklenen'->1->>'ogrenci_kodu') then
    raise exception '5b: aynı adlı iki öğrenci aynı kaydı/kodu paylaşıyor';
  end if;

  raise notice '5 OK — aynı adlı iki öğrenci ayrı kayıt ve ayrı kod alıyor';

  -- ---------------------------------------------------------------------------
  -- 6 — BAŞTA/SONDA BOŞLUK KIRPILIYOR
  -- ---------------------------------------------------------------------------
  v := public.ogrenciler_toplu_ekle(jt, 'okul', v_s, '["   Boşluklu Ad   "]'::jsonb);
  if v->'eklenen'->0->>'ad' <> 'Boşluklu Ad' then
    raise exception '6a: boşluk kırpılmadı: %', v->'eklenen'->0->>'ad';
  end if;
  if not exists (select 1 from public.ogrenciler where ad = 'Boşluklu Ad') then
    raise exception '6b: kayıtta kırpılmamış';
  end if;
  raise notice '6 OK — baştaki ve sondaki boşluk kırpılıyor';

  -- ---------------------------------------------------------------------------
  -- 7 — DENETİM İZİ: toplu iş de iz bırakıyor
  -- ---------------------------------------------------------------------------
  select count(*) into n0 from public.denetim_izi where islem = 'ogrenci_eklendi';
  perform public.ogrenciler_toplu_ekle(jt, 'okul', v_s,
    '["İzli Bir", "İzli İki", "İzli Üç"]'::jsonb);
  select count(*) into n from public.denetim_izi where islem = 'ogrenci_eklendi';
  if n <> n0 + 3 then
    raise exception '7a: 3 öğrenci için % denetim kaydı yazıldı', n - n0;
  end if;
  raise notice '7 OK — her öğrenci için ayrı denetim kaydı yazılıyor';

  -- ---------------------------------------------------------------------------
  -- 8 — ÖZEL DERS ÖĞRENCİSİ DE TOPLU EKLENEBİLİYOR
  -- ---------------------------------------------------------------------------
  select id into v_ozel from public.siniflar where ozel limit 1;
  v := public.ogrenciler_toplu_ekle(jt, 'ozel', v_ozel, '["Toplu Özel Bir"]'::jsonb);
  if (v->>'adet')::int <> 1 then raise exception '8a: özel ders öğrencisi eklenemedi'; end if;
  if not exists (select 1 from public.ogrenciler
                  where ad = 'Toplu Özel Bir' and tur = 'ozel') then
    raise exception '8b: tür ozel olarak kaydedilmedi';
  end if;
  raise notice '8 OK — özel ders öğrencisi de toplu eklenebiliyor';
end $$;

-- =============================================================================
-- 3 — ATOMİKLİK: partinin ortasında geçersiz ad varsa HİÇBİR satır yazılmıyor
--
-- BU GRUP `do` BLOĞUNUN DIŞINDA, VE BU ZORUNLU.
--
-- İlk yazımda denetimi bir `begin … exception when sqlstate '22023'` bloğuna
-- koymuştum. Yanlıştı ve HİÇBİR ŞEY ÖLÇMÜYORDU: PL/pgSQL'de `exception`
-- taşıyan her blok kendi ALT İŞLEMİNİ açar; hata yakalandığında o bloktaki
-- her şey — çağrılan fonksiyonun yazdığı satırlar dahil — zaten geri alınır.
-- Yani test, fonksiyonun atomikliğini değil PostgreSQL'in kendi geri alma
-- davranışını ölçüyordu ve fonksiyon yarım yazsa bile GEÇERDİ.
--
-- Aşağıdaki çağrı psql'de tek başına bir ifade. psql her ifadeyi kendi
-- işleminde çalıştırıyor — PostgREST'in bir isteği çalıştırdığı düzenin
-- aynısı. Hata alıp geri alınıyor, sonraki blok TEMİZ bir işlemde sayıyor.
-- =============================================================================
\set ON_ERROR_STOP off
select public.ogrenciler_toplu_ekle(
  (public.giris('Toplu!2026'))->>'token',
  'okul',
  (select id from public.siniflar where seviye = 5 and sube = 'T'),
  '["Atomik Bir", "Atomik İki", "   ", "Atomik Üç"]'::jsonb);
\set ON_ERROR_STOP on

do $$
declare n integer;
begin
  select count(*) into n from public.ogrenciler where ad like 'Atomik %';
  if n <> 0 then
    raise exception '3a: REDDEDİLEN partiden % satır kaldı — atomik değil', n;
  end if;
  raise notice '3 OK — geçersiz ad bütün partiyi reddediyor, tek satır bile kalmıyor';
end $$;

-- 3b — uzun ad da bütün partiyi reddediyor (aynı gerekçe, ayrı ifade)
\set ON_ERROR_STOP off
select public.ogrenciler_toplu_ekle(
  (public.giris('Toplu!2026'))->>'token',
  'okul',
  (select id from public.siniflar where seviye = 5 and sube = 'T'),
  jsonb_build_array('Uzunlu Kısa Ad', repeat('A', 101)));
\set ON_ERROR_STOP on

do $$
declare n integer;
begin
  select count(*) into n from public.ogrenciler where ad = 'Uzunlu Kısa Ad';
  if n <> 0 then
    raise exception '3b: 100 karakterden uzun ad içeren parti yarım yazıldı';
  end if;
  raise notice '3b OK — 100 karakterden uzun ad da bütün partiyi reddediyor';
end $$;

-- 9 — ÖĞRENCİ VE VELİ ÇAĞIRAMIYOR
do $$
declare
  jo text; jv text; v_s uuid;
begin
  select id into v_s from public.siniflar where seviye = 5 and sube = 'T';

  jo := (public.giris((select gk.kod from public.giris_kodlari gk
                        join public.ogrenciler o on o.id = gk.ogrenci_id
                       where gk.rol = 'ogrenci' and o.aktif limit 1)))->>'token';
  begin
    perform public.ogrenciler_toplu_ekle(jo, 'okul', v_s, '["Sızma Denemesi"]'::jsonb);
    raise exception '9a: ÖĞRENCİ toplu öğrenci ekleyebildi';
  exception when sqlstate '42501' then null;
  end;

  jv := (public.giris((select gk.kod from public.giris_kodlari gk
                        join public.ogrenciler o on o.id = gk.ogrenci_id
                       where gk.rol = 'veli' and o.aktif limit 1)))->>'token';
  begin
    perform public.ogrenciler_toplu_ekle(jv, 'okul', v_s, '["Sızma Denemesi"]'::jsonb);
    raise exception '9b: VELİ toplu öğrenci ekleyebildi';
  exception when sqlstate '42501' then null;
  end;

  if exists (select 1 from public.ogrenciler where ad = 'Sızma Denemesi') then
    raise exception '9c: reddedilen çağrıdan kayıt oluşmuş';
  end if;

  raise notice '9 OK — öğrenci ve veli çağıramıyor, reddedilen çağrıdan kayıt kalmıyor';
  raise notice '';
  raise notice 'TOPLU ÖĞRENCİ TESTLERİ: 9 GRUP GEÇTİ';
end $$;
