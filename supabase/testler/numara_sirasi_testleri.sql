-- =============================================================================
-- SEKİZ — OKUL NUMARASINA GÖRE SIRALAMA TESTLERİ (0044)
--
-- Öğretmen istedi: sınıfa tıklayınca öğrenciler okul numarasına göre
-- küçükten büyüğe sıralansın.
--
-- ASIL ÖLÇÜM SAYISAL SIRA (2. grup). Numara METİN olarak saklanıyor
-- (0042: "0601" ile "601" farklı, baştaki sıfır korunmalı) ve düz metin
-- sıralaması "10"u "9"dan ÖNCE koyar. Bu kusur hata vermez, ekran açılır,
-- hiçbir şey kırmızı yanmaz — yalnız sıra yanlış olur ve öğretmen
-- yoklama alırken fark eder.
--
-- İKİNCİ AĞIRLIK SAYFALAMA (6. grup): sıra hem iç sayfalama sorgusunda
-- hem dıştaki `jsonb_agg` içinde uygulanmalı. Biri değişip öteki kalırsa
-- sayfanın İÇİ doğru sıralanır ama sayfalar arası karışır — ancak ikinci
-- sayfaya bakınca fark edilir.
--
-- ADLAR BİLEREK ASCII: sıralamanın beraberlik hâlinde `o.ad`a düşmesi
-- gerekiyor ve Türkçe harflerin sırası veritabanının collation ayarına
-- bağlı. Ölçüm, kurulumun ayarına bağlı olmamalı.
--
-- İZOLASYON: kendi sınıfımızı (2S) kuruyoruz.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text;
  v_ogr uuid;
  v_s uuid;
  v jsonb;
  sira text;
  n integer;
  mesaj text;
begin
  update public.ogretmenler
     set pin_hash = extensions.crypt('Sira!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Sira!2026'))->>'token';
  select id into v_ogr from public.ogretmenler where yonetici;

  insert into public.siniflar (seviye, sube) values (2, 'S')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_s;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
  values (v_ogr, v_s) on conflict do nothing;
  delete from public.ogrenciler where sinif_id = v_s;

  -- KURULAN DÜNYA — sırası metin sıralamasıyla ÇAKIŞACAK şekilde seçildi.
  --
  --   '2'    → metinde de sayıda da başta
  --   '9'    → METİNDE '10'dan SONRA gelir; sayıda ÖNCE
  --   '10'   → tuzağın kendisi
  --   '0601' ve '601' → aynı sayı, baştaki sıfır korunuyor; beraberlik
  --                     ada göre çözülmeli (Ada < Berk)
  --   'A1'   → rakam dışı: sayısallardan sonra, numarasızlardan önce
  --   null   → en sonda, kendi aralarında ada göre (Ayla < Zeki)
  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, ogrenci_no) values
    ('Cem Iki',        'okul', v_s, v_ogr, '2'),
    ('Deniz Dokuz',    'okul', v_s, v_ogr, '9'),
    ('Ela On',         'okul', v_s, v_ogr, '10'),
    ('Ada Sifirli',    'okul', v_s, v_ogr, '0601'),
    ('Berk Altiyuz',   'okul', v_s, v_ogr, '601'),
    ('Kaan Harfli',    'okul', v_s, v_ogr, 'A1'),
    ('Ayla Numarasiz', 'okul', v_s, v_ogr, null),
    ('Zeki Numarasiz', 'okul', v_s, v_ogr, null);

  -- ---------------------------------------------------------------------------
  -- 1. BAŞLANGIÇ (pozitif kontrol)
  -- ---------------------------------------------------------------------------
  select count(*) into n from public.ogrenciler where sinif_id = v_s and aktif;
  if n <> 8 then raise exception '1a: 2S''de 8 öğrenci bekleniyordu, %', n; end if;
  raise notice '1 OK — dünya kuruldu: 8 öğrenci, numaralar metin sırasıyla çakışıyor';

  -- ---------------------------------------------------------------------------
  -- 2. SINIF DETAYI NUMARA SIRASINDA  ← BU DOSYANIN ASIL ÖLÇÜMÜ
  -- ---------------------------------------------------------------------------
  v := public.sinif_ogrencileri(jt, v_s);
  select string_agg(x.value->>'ad', ' | ') into sira
  from jsonb_array_elements(v->'ogrenciler') with ordinality x(value, i);

  if sira is distinct from
     'Cem Iki | Deniz Dokuz | Ela On | Ada Sifirli | Berk Altiyuz | '
     'Kaan Harfli | Ayla Numarasiz | Zeki Numarasiz' then
    raise exception '2a: sınıf detayı sırası yanlış: %', sira;
  end if;
  raise notice '2 OK — sınıf detayı numaraya göre: 2, 9, 10, 0601, 601, A1, numarasızlar';

  -- ---------------------------------------------------------------------------
  -- 3. METİN SIRALAMASI TUZAĞI AÇIKÇA
  --
  -- Bu ayrı bir grup olarak duruyor ki kusur çıktığında mesaj sebebi
  -- söylesin: "sıra yanlış" değil, "9, 10'dan sonra geldi".
  -- ---------------------------------------------------------------------------
  select string_agg(x.value->>'ogrenci_no', ',') into sira
  from jsonb_array_elements(v->'ogrenciler') with ordinality x(value, i)
  where x.value->>'ogrenci_no' in ('9', '10');
  if sira is distinct from '9,10' then
    raise exception '3a: sayısal sıra tutmuyor — metin sıralaması mı yapılıyor? (%)', sira;
  end if;
  raise notice '3 OK — 9, 10''dan önce geliyor';

  -- ---------------------------------------------------------------------------
  -- 4. ÖĞRENCİ LİSTESİ p_sirala = 'numara'
  -- ---------------------------------------------------------------------------
  v := public.ogrenciler_listesi(jt, null, v_s, 1, 100, 'numara');
  select string_agg(x.value->>'ad', ' | ') into sira
  from jsonb_array_elements(v->'kayitlar') with ordinality x(value, i);
  if sira is distinct from
     'Cem Iki | Deniz Dokuz | Ela On | Ada Sifirli | Berk Altiyuz | '
     'Kaan Harfli | Ayla Numarasiz | Zeki Numarasiz' then
    raise exception '4a: liste sırası yanlış: %', sira;
  end if;
  raise notice '4 OK — öğrenci listesi ''numara'' kipinde aynı sırada';

  -- ---------------------------------------------------------------------------
  -- 5. VARSAYILAN 'ad' — ESKİ DAVRANIŞ AYNEN SÜRÜYOR
  --
  -- Geride kalmış bir arayüz sürümü `p_sirala` göndermezse sıra
  -- DEĞİŞMEMELİ. Varsayılan sessizce 'numara' olsaydı, hiç istenmeyen bir
  -- ekranda da sıra değişirdi.
  -- ---------------------------------------------------------------------------
  v := public.ogrenciler_listesi(jt, null, v_s, 1, 100);
  select string_agg(x.value->>'ad', ' | ') into sira
  from jsonb_array_elements(v->'kayitlar') with ordinality x(value, i);
  if sira is distinct from
     'Ada Sifirli | Ayla Numarasiz | Berk Altiyuz | Cem Iki | Deniz Dokuz | '
     'Ela On | Kaan Harfli | Zeki Numarasiz' then
    raise exception '5a: varsayılan sıra ada göre değil: %', sira;
  end if;
  raise notice '5 OK — p_sirala verilmediğinde eski (ad) sırası';

  -- ---------------------------------------------------------------------------
  -- 6. SAYFALAMA İLE SIRA TUTARLI
  --
  -- İç sayfalama sorgusu ile dıştaki `jsonb_agg` ayrı ayrı sıralanıyor.
  -- Biri numaraya, öteki ada göre kalsaydı sayfanın içi doğru görünür ama
  -- sayfalar arası karışırdı — ve bu ancak ikinci sayfaya bakınca
  -- anlaşılırdı.
  -- ---------------------------------------------------------------------------
  sira := '';
  for n in 1..3 loop
    v := public.ogrenciler_listesi(jt, null, v_s, n, 3, 'numara');
    sira := sira || coalesce((
      select string_agg(x.value->>'ad', ' | ')
      from jsonb_array_elements(v->'kayitlar') with ordinality x(value, i)
    ), '') || case when n < 3 then ' | ' else '' end;
  end loop;
  if sira is distinct from
     'Cem Iki | Deniz Dokuz | Ela On | Ada Sifirli | Berk Altiyuz | '
     'Kaan Harfli | Ayla Numarasiz | Zeki Numarasiz' then
    raise exception '6a: sayfalar birleştirilince sıra bozuluyor: %', sira;
  end if;
  raise notice '6 OK — üç sayfa birleşince sıra kesintisiz';

  -- ---------------------------------------------------------------------------
  -- 7. NUMARASIZLAR SONDA, KENDİ ARALARINDA ADA GÖRE
  --
  -- Özel ders öğrencisinin okul numarası yok; listenin başına düşerse
  -- numara sırası hiçbir işe yaramaz.
  -- ---------------------------------------------------------------------------
  v := public.sinif_ogrencileri(jt, v_s);
  select string_agg(x.value->>'ad', ' | ' order by x.i) into sira
  from jsonb_array_elements(v->'ogrenciler') with ordinality x(value, i)
  where x.i > 6;
  if sira is distinct from 'Ayla Numarasiz | Zeki Numarasiz' then
    raise exception '7a: numarasızlar sonda ve ada göre değil: %', sira;
  end if;
  raise notice '7 OK — numarasızlar en sonda, ada göre';

  -- ---------------------------------------------------------------------------
  -- 8. GEÇERSİZ SIRALAMA REDDEDİLİYOR, TÜRKÇE KONUŞARAK
  -- ---------------------------------------------------------------------------
  begin
    perform public.ogrenciler_listesi(jt, null, v_s, 1, 100, 'soyad');
    raise exception '8a: geçersiz sıralama kabul edildi';
  exception when sqlstate '22023' then
    get stacked diagnostics mesaj = message_text;
  end;
  if mesaj is null or mesaj not like '%Sıralama%' then
    raise exception '8b: Türkçe mesaj gelmedi, ham veritabanı hatası sızdı: %', mesaj;
  end if;
  raise notice '8 OK — geçersiz sıralama Türkçe mesajla reddedildi';

  -- ---------------------------------------------------------------------------
  -- 9. ESKİ İMZA DÜŞTÜ (0007)
  -- ---------------------------------------------------------------------------
  if exists (
    select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = 'ogrenciler_listesi'
      and pg_catalog.oidvectortypes(p.proargtypes) = 'text, text, uuid, integer, integer'
  ) then
    raise exception '9a: eski 5 parametreli imza hâlâ duruyor';
  end if;
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'ogrenciler_listesi';
  if n <> 1 then raise exception '9b: ogrenciler_listesi % imzalı', n; end if;
  if has_function_privilege('anon', 'public._numara_sira(text)', 'execute') then
    raise exception '9c: _numara_sira anon''a açık';
  end if;
  raise notice '9 OK — tek imza, eski imza düştü, yardımcı anon''a kapalı';

  -- TEMİZLİK
  delete from public.ogrenciler where sinif_id = v_s;

  raise notice '';
  raise notice 'NUMARA SIRASI TESTLERİ: 9 GRUP GEÇTİ';
end $$;
