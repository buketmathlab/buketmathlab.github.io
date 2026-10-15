-- =============================================================================
-- SEKİZ — 0076/0077 ANONİM ANKET TESTLERİ
--
--  1. Kapalıyken: durum "açık değil", yanıt reddediliyor.
--  2. Yanıt: doğrulama (eksik madde, aralık dışı, 300+ karakter); tek seferlik.
--  3. ANONİMLİK: yanıt satırında kimlik ve saat yok; özet kimliği taşımıyor.
--  4. Kim: onamsız veli reddediliyor; müdür yanıtlayamıyor; deneme hesabı
--     yanıtlıyor ama KAYIT YOK.
--  5. Sonuçlar: sahip ve müdür görür, öğretmen/öğrenci görmez. 0077: ALT
--     SINIR YOK — tek yanıtta da dağılım ve görüş görünüyor; dağılım doğru;
--     yanıtı olmayan grup "yeterli değil" ve boş.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text; jo text; jm text; jv text; jd text;
  s_a uuid; r jsonb; dn jsonb; v jsonb;
  tok text[] := '{}';
  ids uuid[] := '{}';
  ek text := substr(md5(random()::text), 1, 6);
  i integer;
  ogr jsonb;
  dag jsonb;
begin
  raise notice '--- Kurulum ---';
  update public.ogretmenler
     set pin_hash = extensions.crypt('Deneme!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Deneme!2026'))->>'token';
  if not exists (select 1 from public.ogretmenler where ad = 'Anket Öğretmeni') then
    perform public.ogretmen_ekle(jt, 'Anket Öğretmeni', 'AnketOgr!26');
  end if;
  jo := (public.giris('AnketOgr!26'))->>'token';
  if not exists (select 1 from public.ogretmenler where ad = 'Anket Müdürü') then
    perform public.mudur_ekle(jt, 'Anket Müdürü', 'AnketMudur!26');
  end if;
  jm := (public.giris('AnketMudur!26'))->>'token';
  s_a := (public.sinif_ekle(jt, 10::smallint, 'AK'))->>'id';
  update public.siniflar set arsiv = false where id = s_a;
  for i in 1 .. 6 loop
    r := public.ogrenci_ekle(jt, 'Anket Öğrenci ' || i || ' ' || ek, 'okul', s_a);
    ids := ids || (r->>'id')::uuid;
    tok := tok || ((public.giris(r->>'ogrenci_kodu'))->>'token');
    if i = 1 then jv := (public.giris(r->>'veli_kodu'))->>'token'; end if;
  end loop;
  -- Temiz başlangıç: bu testin anketi.
  delete from public.anketler where kod = 'test-anket';
  insert into public.anketler (kod, baslik) values ('test-anket', 'Test');
  update public.anketler set acik = false;

  -- ===========================================================================
  raise notice '--- 1. Kapalı anket ---';
  if (public.anket_durumu(tok[1])->>'acik')::boolean then raise exception '1a: kapalı anket açık görünüyor'; end if;
  begin perform public.anket_yanitla(tok[1], '{"m1":5}'::jsonb);
    raise exception '1b: KAPALI ANKETE YANIT ALINDI';
  exception when no_data_found then null; end;
  begin perform public.anket_ac_kapat(jo, 'test-anket', true);
    raise exception '1c: SIRADAN ÖĞRETMEN ANKETİ AÇTI';
  exception when insufficient_privilege then null; end;
  perform public.anket_ac_kapat(jt, 'test-anket', true);
  if public.anket_durumu(tok[1])->>'anket' <> 'test-anket' or (public.anket_durumu(tok[1])->>'madde_sayisi')::int <> 7 then
    raise exception '1d: açılan anket öğrenciye görünmüyor';
  end if;
  raise notice '    kapalıyken yanıt yok; yalnız sahip açar: OK';

  -- ===========================================================================
  raise notice '--- 2. Doğrulama ve tek seferlik ---';
  begin perform public.anket_yanitla(tok[1], '{"m1":5,"m2":5}'::jsonb);
    raise exception '2a: EKSİK YANIT ALINDI';
  exception when invalid_parameter_value then null; end;
  begin perform public.anket_yanitla(tok[1], '{"m1":6,"m2":5,"m3":5,"m4":5,"m5":5,"m6":5,"m7":5}'::jsonb);
    raise exception '2b: ARALIK DIŞI YANIT ALINDI';
  exception when invalid_parameter_value then null; end;
  begin perform public.anket_yanitla(tok[1], jsonb_build_object('m1',5,'m2',5,'m3',5,'m4',5,'m5',5,'m6',5,'m7',5,'acik', repeat('a', 301)));
    raise exception '2c: 300+ KARAKTER ALINDI';
  exception when invalid_parameter_value then null; end;
  v := public.anket_yanitla(tok[1], '{"m1":5,"m2":4,"m3":5,"m4":3,"m5":5,"m6":4,"m7":5,"acik":"  Çok iyi  ","fazla":"x"}'::jsonb);
  if not (v->>'kaydedildi')::boolean then raise exception '2d: yanıt kaydedilmedi'; end if;
  if not (public.anket_durumu(tok[1])->>'katildi')::boolean then raise exception '2e: katıldı görünmüyor'; end if;
  begin perform public.anket_yanitla(tok[1], '{"m1":1,"m2":1,"m3":1,"m4":1,"m5":1,"m6":1,"m7":1}'::jsonb);
    raise exception '2f: İKİNCİ YANIT ALINDI';
  exception when unique_violation then null; end;
  raise notice '    eksik, aralık dışı ve uzun yanıt reddedildi; tek seferlik: OK';

  -- ===========================================================================
  raise notice '--- 3. Anonimlik ---';
  if exists (select 1 from public.anket_yanitlari y where y.anket = 'test-anket'
              and (y.cevaplar::text like '%' || ids[1]::text || '%' or y.cevaplar ? 'fazla')) then
    raise exception '3a: yanıtta kimlik ya da fazladan anahtar var';
  end if;
  if (select cevaplar->>'acik' from public.anket_yanitlari where anket = 'test-anket') <> 'Çok iyi' then
    raise exception '3b: görüş temizlenmedi';
  end if;
  if exists (select 1 from public.anket_katilimlari k where k.anket = 'test-anket'
              and k.kisi_ozeti like '%' || replace(ids[1]::text, '-', '') || '%') then
    raise exception '3c: özet kimliği taşıyor';
  end if;
  if (select hafta from public.anket_yanitlari where anket = 'test-anket')
     <> date_trunc('week', (now() at time zone 'Europe/Istanbul'))::date then
    raise exception '3d: hafta yerine saat tutuluyor';
  end if;
  raise notice '    yanıtta kimlik ve saat yok; özet kimlik taşımıyor: OK';

  -- ===========================================================================
  raise notice '--- 4. Kim yanıtlar ---';
  begin perform public.anket_durumu(jv);
    raise exception '4a: ONAMSIZ VELİ ANKETE ULAŞTI';
  exception when insufficient_privilege then null; end;
  perform public.onam_ver(jv, public._gecerli_onam_surumu(), 'Anket Velisi');
  if (public.anket_durumu(jv)->>'madde_sayisi')::int <> 5 then raise exception '4b: veli madde sayısı'; end if;
  begin perform public.anket_durumu(jm);
    raise exception '4c: MÜDÜR ANKET YANITLAYABİLİYOR';
  exception when insufficient_privilege then null; end;
  dn := (public.deneme_hesabi_olustur(jt, s_a))->0;
  jd := (public.giris(dn->>'ogrenci_kodu'))->>'token';
  v := public.anket_yanitla(jd, '{"m1":1,"m2":1,"m3":1,"m4":1,"m5":1,"m6":1,"m7":1}'::jsonb);
  if (v->>'kaydedildi')::boolean or (select count(*) from public.anket_yanitlari where anket = 'test-anket') <> 1 then
    raise exception '4d: DENEME YANITI KAYDEDİLDİ';
  end if;
  perform public.deneme_hesabi_sil(jt, (dn->>'id')::uuid);
  raise notice '    onamsız veli ve müdür reddedildi; deneme kaydedilmedi: OK';

  -- ===========================================================================
  raise notice '--- 5. Sonuçlar (0077: alt sınır yok) ---';
  begin perform public.anket_sonuclari(jo);
    raise exception '5a: ÖĞRETMEN SONUÇLARI GÖRDÜ';
  exception when insufficient_privilege then null; end;
  begin perform public.anket_sonuclari(tok[2]);
    raise exception '5b: ÖĞRENCİ SONUÇLARI GÖRDÜ';
  exception when insufficient_privilege then null; end;
  select g into ogr from jsonb_array_elements(public.anket_sonuclari(jm)) a,
         jsonb_array_elements(a->'gruplar') g
   where a->>'anket' = 'test-anket' and g->>'rol' = 'ogrenci';
  -- TEK yanıt: dağılım ve görüş görünmeli (öğretmenin kararı: 4 öğretmenli
  -- okulda eşik 5 olsaydı öğretmen anketi hiç görünmezdi).
  if not (ogr->>'yeterli')::boolean or jsonb_array_length(ogr->'maddeler') <> 7
     or ogr->'gorusler' <> '["Çok iyi"]'::jsonb or (ogr->>'yanit')::int <> 1
     or ogr->'maddeler'->0->'dagilim' <> '[0,0,0,0,1]'::jsonb then
    raise exception '5c: tek yanıtta sonuç gösterilmedi: %', ogr;
  end if;
  select g into ogr from jsonb_array_elements(public.anket_sonuclari(jm)) a,
         jsonb_array_elements(a->'gruplar') g
   where a->>'anket' = 'test-anket' and g->>'rol' = 'ogretmen';
  if (ogr->>'yeterli')::boolean or jsonb_array_length(ogr->'maddeler') <> 0 then
    raise exception '5c: yanıtsız grupta sonuç var: %', ogr;
  end if;
  for i in 2 .. 5 loop
    perform public.anket_yanitla(tok[i], jsonb_build_object('m1', i, 'm2',3,'m3',3,'m4',3,'m5',3,'m6',3,'m7',3));
  end loop;
  select g into ogr from jsonb_array_elements(public.anket_sonuclari(jt)) a,
         jsonb_array_elements(a->'gruplar') g
   where a->>'anket' = 'test-anket' and g->>'rol' = 'ogrenci';
  dag := ogr->'maddeler'->0->'dagilim';
  -- m1: 5, 2, 3, 4, 5 → dağılım [0,1,1,1,2], ortalama 3,8
  if not (ogr->>'yeterli')::boolean or dag <> '[0,1,1,1,2]'::jsonb
     or (ogr->'maddeler'->0->>'ortalama')::numeric <> 3.80
     or (ogr->>'katilim')::int <> 5 or ogr->'gorusler' <> '["Çok iyi"]'::jsonb then
    raise exception '5d: beş yanıtta sonuçlar yanlış: %', ogr;
  end if;
  raise notice '    yalnız sahip ve müdür; tek yanıt da görünüyor; dağılım doğru: OK';

  -- Temizlik
  delete from public.anketler where kod = 'test-anket';
  update public.ogrenciler set aktif = false where id = any(ids);

  raise notice '';
  raise notice 'ANKET TESTLERİ GEÇTİ';
end;
$$;
