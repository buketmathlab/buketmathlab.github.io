-- =============================================================================
-- SEKİZ — 0067: OKUL ÖDEVLERİ (şube şube ödevler ve cevap anahtarları)
--
--  1. Müdür: iki şube de listede, cevap anahtarı ve soru dosyası yolu var;
--     özel ders grubu yok.
--  2. Öğretmen: yalnız derse girdiği şube (12OA); 12OB yok. Satırlar
--     `sinif_not_cizelgesi` satırlarıyla birebir aynı.
--  3. Önizleme yalnız sahipte: öğretmen `p_onizleme` ile kapsamını
--     genişletemiyor (42501); sahip önizlemede iki şubeyi de görüyor.
--  4. Öğrenci ve veli 42501.
--  5. Ödevi olmayan şube listeye girmiyor; arşivdeki şube girmiyor.
--
-- İZOLASYON: kendi sınıflarını (12OA, 12OB, 12OC) kuruyor; tekrar
-- çalıştırılınca önceki koşunun ödevleri yayın dışı.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text; jx text; jm text; jo text; jv text;
  s_a uuid; s_b uuid; s_c uuid; s_ozel uuid; v_x uuid; o1 uuid;
  h_a uuid; h_b uuid;
  v jsonb; sat jsonb; hata text;
  ek text := to_char(clock_timestamp(), 'HH24MISSUS');
  bul jsonb;
begin
  update public.ogretmenler
     set pin_hash = extensions.crypt('OkulOdev!Sahip26', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('OkulOdev!Sahip26'))->>'token';

  if not exists (select 1 from public.ogretmenler where ad = 'Okul Ödev Öğretmeni') then
    perform public.ogretmen_ekle(jt, 'Okul Ödev Öğretmeni', 'OkulOdevOgr!26');
  end if;
  select id into v_x from public.ogretmenler where ad = 'Okul Ödev Öğretmeni';
  jx := (public.giris('OkulOdevOgr!26'))->>'token';
  if not exists (select 1 from public.ogretmenler where ad = 'Okul Ödev Müdürü') then
    perform public.mudur_ekle(jt, 'Okul Ödev Müdürü', 'OkulOdevMudur!26');
  end if;
  jm := (public.giris('OkulOdevMudur!26'))->>'token';

  s_a := (public.sinif_ekle(jt, 12::smallint, 'OA'))->>'id';
  s_b := (public.sinif_ekle(jt, 12::smallint, 'OB'))->>'id';
  s_c := (public.sinif_ekle(jt, 12::smallint, 'OC'))->>'id';
  update public.siniflar set arsiv = false where id in (s_a, s_b, s_c);
  update public.odevler set yayinda = false where sinif_id in (s_a, s_b, s_c);
  select id into s_ozel from public.siniflar where ozel limit 1;
  perform public.ogretmen_sinif_ata(jt, v_x, jsonb_build_array(s_a::text));

  o1 := (public.ogrenci_ekle(jt, 'Okul Ödev Öğrencisi ' || ek, 'okul', s_a))->>'id';
  jo := (public.giris((select kod from public.giris_kodlari where ogrenci_id = o1 and rol = 'ogrenci')))->>'token';
  jv := (public.giris((select kod from public.giris_kodlari where ogrenci_id = o1 and rol = 'veli')))->>'token';
  perform public.onam_ver(jv, public._gecerli_onam_surumu(), 'Test Velisi');

  h_a := (public.odev_olustur(jt, 'Okul ödevi A ' || ek, null, s_a, 'test', (current_date + 3)::date, 3,
          '{"1":"A","2":"B","3":"C"}'::jsonb))->>'id';
  perform public.odev_yayinla(jt, h_a);
  update public.odevler set odev_url = 'odev/' || h_a || '/sorular.pdf' where id = h_a;
  h_b := (public.odev_olustur(jt, 'Okul ödevi B ' || ek, null, s_b, 'test', (current_date + 3)::date, 2,
          '{"1":"D","2":"E"}'::jsonb))->>'id';
  perform public.odev_yayinla(jt, h_b);
  -- 12OC: ödev yok. Özel grup: bir ödev (hiçbir listede çıkmamalı).
  perform public.odev_yayinla(jt, ((public.odev_olustur(jt, 'Özel ödev ' || ek, null, s_ozel, 'test',
          (current_date + 3)::date, 1, '{"1":"A"}'::jsonb))->>'id')::uuid);

  -- ---------------------------------------------------------------------------
  -- 1. Müdür
  -- ---------------------------------------------------------------------------
  v := public.okul_odevleri(jm);
  bul := (select x from jsonb_array_elements(v) x where x->>'sinif_id' = s_a::text);
  sat := (select o from jsonb_array_elements(bul->'odevler') o where o->>'id' = h_a::text);
  if sat is null or sat->'cevap_anahtari' <> '{"1":"A","2":"B","3":"C"}'::jsonb
     or sat->>'odev_yolu' <> 'odev/' || h_a || '/sorular.pdf' then
    raise exception '1a: müdür 12OA ödevini/anahtarını görmüyor: %', sat;
  end if;
  if not exists (select 1 from jsonb_array_elements(v) x where x->>'sinif_id' = s_b::text) then
    raise exception '1b: müdür 12OB görmüyor';
  end if;
  if exists (select 1 from jsonb_array_elements(v) x where x->>'sinif_id' = s_ozel::text) then
    raise exception '1c: müdüre özel ders grubu gitti';
  end if;
  raise notice '1 OK — müdür: iki şube, cevap anahtarı ve soru dosyası; özel ders yok';

  -- ---------------------------------------------------------------------------
  -- 2. Öğretmen: yalnız kendi şubesi
  -- ---------------------------------------------------------------------------
  v := public.okul_odevleri(jx);
  if exists (select 1 from jsonb_array_elements(v) x where x->>'sinif_id' in (s_b::text, s_ozel::text)) then
    raise exception '2a: öğretmen derse girmediği şubeyi gördü: %', v;
  end if;
  bul := (select x from jsonb_array_elements(v) x where x->>'sinif_id' = s_a::text);
  if bul is null or bul->'odevler' <> public.sinif_not_cizelgesi(jx, s_a)->'odevler' then
    raise exception '2b: öğretmenin 12OA satırları sınıf sayfasıyla aynı değil';
  end if;
  raise notice '2 OK — öğretmen yalnız derse girdiği şube; satırlar sınıf sayfasıyla aynı';

  -- ---------------------------------------------------------------------------
  -- 3. Önizleme yalnız sahipte
  -- ---------------------------------------------------------------------------
  begin
    perform public.okul_odevleri(jx, true);
    raise exception '3a: öğretmen önizlemeyle kapsamı genişletti';
  exception when insufficient_privilege then null;
  end;
  v := public.okul_odevleri(jt, true);
  if not exists (select 1 from jsonb_array_elements(v) x where x->>'sinif_id' = s_b::text)
     or exists (select 1 from jsonb_array_elements(v) x where x->>'sinif_id' = s_ozel::text) then
    raise exception '3b: sahip önizlemesi yanlış';
  end if;
  raise notice '3 OK — önizleme yalnız sahipte; sahip iki şubeyi görüyor, özel yok';

  -- ---------------------------------------------------------------------------
  -- 4. Öğrenci ve veli
  -- ---------------------------------------------------------------------------
  foreach hata in array array[jo, jv] loop
    begin
      perform public.okul_odevleri(hata);
      raise exception '4: öğrenci/veli okul ödevlerini okudu';
    exception when insufficient_privilege then null;
    end;
  end loop;
  raise notice '4 OK — öğrenci ve veli 42501';

  -- ---------------------------------------------------------------------------
  -- 5. Ödevsiz ve arşivdeki şube yok
  -- ---------------------------------------------------------------------------
  v := public.okul_odevleri(jm);
  if exists (select 1 from jsonb_array_elements(v) x where x->>'sinif_id' = s_c::text) then
    raise exception '5a: ödevsiz şube listede';
  end if;
  update public.siniflar set arsiv = true where id = s_b;
  if exists (select 1 from jsonb_array_elements(public.okul_odevleri(jm)) x where x->>'sinif_id' = s_b::text) then
    raise exception '5b: arşivdeki şube listede';
  end if;
  update public.siniflar set arsiv = false where id = s_b;
  raise notice '5 OK — ödevsiz ve arşivdeki şube listede yok';
end $$;

select 'OKUL ÖDEVLERİ TESTLERİ GEÇTİ';
