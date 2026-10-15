-- =============================================================================
-- SEKİZ — 0075 PROJE RAPORU TESTLERİ
--
-- İzleme-değerlendirme komisyonuna gösterilecek sayılar: yanlış bir sayı
-- dosyanın tamamını şüpheli kılar. Bu yüzden her alan bilinen bir fikstürle
-- ÖNCE/SONRA farkı olarak ölçülüyor (test veritabanında başka testlerin
-- verisi de var; mutlak değer değil, fark sabit).
--
--  1. Yetki: sahip ve müdür okur; sıradan öğretmen, öğrenci, veli 42501.
--  2. Kayıt: öğrenci, giriş yapan öğrenci ve veli, veli onamı.
--  3. Ödev: aynı ödevin iki şube kopyası = 1 hazırlanan, 2 ulaşan; soru,
--     test, çözümlü anahtar, soru dosyası, konu etiketi.
--  4. Gönderim: toplam, kontrol edilen ve otomatik puanlanan soru, doğru/
--     yanlış/boş, çözüme ulaşan.
--  5. Deneme hesabı (0073) hiçbir sayıya girmiyor.
--  6. Okul geneliyle tutarlılık: kontrol edilen soru `okul_geneli` ile aynı.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text; jo text; jm text; jg1 text; jg2 text; jv1 text; jd text; jvd text;
  s_a uuid; s_b uuid;
  d1 uuid; d2 uuid; g uuid;
  o1 uuid; o2 uuid; o3 uuid;
  r jsonb; once jsonb; sonra jsonb; dn jsonb;
  ek text := substr(md5(random()::text), 1, 6);
  fark integer;
  beklenen jsonb;
  k text;
begin
  raise notice '--- Kurulum ---';
  update public.ogretmenler
     set pin_hash = extensions.crypt('Deneme!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Deneme!2026'))->>'token';
  if not exists (select 1 from public.ogretmenler where ad = 'Rapor Öğretmeni') then
    perform public.ogretmen_ekle(jt, 'Rapor Öğretmeni', 'RaporOgr!26');
  end if;
  jo := (public.giris('RaporOgr!26'))->>'token';
  if not exists (select 1 from public.ogretmenler where ad = 'Rapor Müdürü') then
    perform public.mudur_ekle(jt, 'Rapor Müdürü', 'RaporMudur!26');
  end if;
  jm := (public.giris('RaporMudur!26'))->>'token';

  s_a := (public.sinif_ekle(jt, 9::smallint, 'RA'))->>'id';
  s_b := (public.sinif_ekle(jt, 9::smallint, 'RB'))->>'id';
  update public.siniflar set arsiv = false where id in (s_a, s_b);
  -- Önceki koşulardan kalanlar fikstürü bozmasın.
  update public.ogrenciler set aktif = false where sinif_id in (s_a, s_b);
  for dn in select * from jsonb_array_elements(public.deneme_hesaplari(jt)) loop
    perform public.deneme_hesabi_sil(jt, (dn->>'id')::uuid);
  end loop;

  once := public.proje_raporu(jt);

  -- Fikstür: RA'da 2, RB'de 1 öğrenci.
  r := public.ogrenci_ekle(jt, 'Rapor Ali ' || ek, 'okul', s_a);
  o1 := (r->>'id')::uuid; jg1 := (public.giris(r->>'ogrenci_kodu'))->>'token';
  jv1 := (public.giris(r->>'veli_kodu'))->>'token';
  r := public.ogrenci_ekle(jt, 'Rapor Ece ' || ek, 'okul', s_a);
  o2 := (r->>'id')::uuid; jg2 := (public.giris(r->>'ogrenci_kodu'))->>'token';
  r := public.ogrenci_ekle(jt, 'Rapor Can ' || ek, 'okul', s_b);
  o3 := (r->>'id')::uuid;

  -- Aynı 4 soruluk test iki şubeye: iki satır, tek grup. Biri çözümlü anahtarlı.
  r := public.odev_olustur(jt, 'Rapor Testi ' || ek, null, s_a, 'test', current_date + 3, 4,
                           '{"1":"A","2":"B","3":"C","4":"D"}'::jsonb, null, null, true);
  d1 := (r->>'id')::uuid;
  r := public.odev_olustur(jt, 'Rapor Testi ' || ek, null, s_b, 'test', current_date + 3, 4,
                           '{"1":"A","2":"B","3":"C","4":"D"}'::jsonb, null, null, true);
  d2 := (r->>'id')::uuid;
  g := gen_random_uuid();
  update public.odevler
     set grup_id = g, anahtar_url = 'anahtar/' || g || '.pdf', odev_url = 'odev/' || g || '.pdf',
         konular = '{"1":"Kümeler","2":"Kümeler","3":"Mantık","4":"Mantık"}'::jsonb
   where id in (d1, d2);
  perform public.odev_yayinla(jt, d1);
  perform public.odev_yayinla(jt, d2);

  perform public.odev_gonder(jg1, d1, 'cozum/' || d1 || '/' || o1 || '.jpg', '{"1":"A","2":"B","3":"C","4":"D"}'::jsonb);
  perform public.odev_gonder(jg2, d1, 'cozum/' || d1 || '/' || o2 || '.jpg', '{"1":"A","2":"A"}'::jsonb);
  perform public.onam_ver(jv1, public._gecerli_onam_surumu(), 'Rapor Velisi');

  -- DENEME hesabı aynı şubede: giriyor, gönderiyor, velisi onam veriyor.
  dn := (public.deneme_hesabi_olustur(jt, s_a))->0;
  jd := (public.giris(dn->>'ogrenci_kodu'))->>'token';
  jvd := (public.giris(dn->>'veli_kodu'))->>'token';
  perform public.odev_gonder(jd, d1, 'cozum/' || d1 || '/' || (dn->>'id') || '.jpg', '{"1":"D"}'::jsonb);
  perform public.onam_ver(jvd, public._gecerli_onam_surumu(), 'Deneme Veli');

  sonra := public.proje_raporu(jt);

  -- ===========================================================================
  raise notice '--- 1. Yetki ---';
  -- ===========================================================================
  if (public.proje_raporu(jm)->'odev'->>'hazirlanan') is distinct from (sonra->'odev'->>'hazirlanan') then
    raise exception '1a: müdür sahip ile aynı raporu görmüyor';
  end if;
  begin perform public.proje_raporu(jo);
    raise exception '1b: SIRADAN ÖĞRETMEN PROJE RAPORUNU GÖRDÜ';
  exception when insufficient_privilege then null; end;
  begin perform public.proje_raporu(jg1);
    raise exception '1c: ÖĞRENCİ PROJE RAPORUNU GÖRDÜ';
  exception when insufficient_privilege then null; end;
  begin perform public.proje_raporu(jv1);
    raise exception '1d: VELİ PROJE RAPORUNU GÖRDÜ';
  exception when insufficient_privilege then null; end;
  if sonra::text like '%Rapor Ali%' or sonra::text like '%Deneme Öğrenci%' then
    raise exception '1e: raporda öğrenci adı var';
  end if;
  raise notice '    sahip ve müdür okuyor; öğretmen, öğrenci, veli reddedildi; ad yok: OK';

  -- ===========================================================================
  raise notice '--- 2–4. Sayılar (fark) — 5. deneme hariç ---';
  -- ===========================================================================
  beklenen := jsonb_build_object(
    'kayit.ogrenci_sayisi', 3,          -- deneme sayılmadı
    'kayit.giris_yapan_ogrenci', 2,     -- deneme girdi ve gönderdi ama sayılmadı
    'kayit.giris_yapan_veli', 1,
    'kayit.veli_onami', 1,              -- deneme velinin onamı sayılmadı
    'odev.hazirlanan', 1,
    'odev.subeye_ulasan', 2,
    'odev.hazirlanan_soru', 4,
    'odev.subeye_ulasan_soru', 8,
    'odev.test', 1,
    'odev.cozumlu_anahtar', 1,
    'odev.soru_dosyasi', 1,
    'odev.konu_etiketli', 1,
    'gonderim.toplam', 2,               -- deneme gönderimi sayılmadı
    'gonderim.gonderen_ogrenci', 2,
    'gonderim.kontrol_edilen_soru', 8,
    'gonderim.otomatik_puanlanan_soru', 8,
    'gonderim.dogru', 5,
    'gonderim.yanlis', 1,
    'gonderim.bos', 2,
    'gonderim.cozume_ulasan', 2);
  for k in select jsonb_object_keys(beklenen) loop
    fark := coalesce((sonra #>> string_to_array(k, '.'))::integer, 0)
          - coalesce((once  #>> string_to_array(k, '.'))::integer, 0);
    if fark <> (beklenen->>k)::integer then
      raise exception '%: fark % (beklenen %)', k, fark, beklenen->>k;
    end if;
  end loop;
  raise notice '    % alan birebir; deneme hesabı hiçbirine girmedi: OK',
    (select count(*) from jsonb_object_keys(beklenen));

  -- Bu ayın satırı da aynı farkla.
  if ((sonra->'aylar'->-1->>'gonderim')::integer - (once->'aylar'->-1->>'gonderim')::integer) <> 2
     or ((sonra->'aylar'->-1->>'hazirlanan')::integer - (once->'aylar'->-1->>'hazirlanan')::integer) <> 1 then
    raise exception '4b: aylık satır farkı yanlış';
  end if;
  -- Düzey satırı (9).
  if ((select (e->>'ogrenci_sayisi')::integer from jsonb_array_elements(sonra->'seviyeler') e where e->>'seviye' = '9')
      - (select (e->>'ogrenci_sayisi')::integer from jsonb_array_elements(once->'seviyeler') e where e->>'seviye' = '9')) <> 3 then
    raise exception '4c: düzey satırı farkı yanlış';
  end if;
  raise notice '    aylık ve düzey satırları tutarlı: OK';

  -- ===========================================================================
  raise notice '--- 6. Okul geneliyle tutarlılık ---';
  -- ===========================================================================
  if (sonra->'gonderim'->>'kontrol_edilen_soru')::integer
     <> (public.okul_geneli(jt)->'okul'->>'kontrol_edilen_soru')::integer then
    raise exception '6a: kontrol edilen soru Genel sayfasıyla farklı';
  end if;
  if (sonra->'kayit'->>'ogrenci_sayisi')::integer
     <> (public.okul_geneli(jt)->'okul'->>'ogrenci_sayisi')::integer then
    raise exception '6b: öğrenci sayısı Genel sayfasıyla farklı';
  end if;
  raise notice '    kontrol edilen soru ve öğrenci sayısı Genel ile aynı: OK';

  -- Temizlik
  perform public.deneme_hesabi_sil(jt, (dn->>'id')::uuid);
  update public.ogrenciler set aktif = false where id in (o1, o2, o3);

  raise notice '';
  raise notice 'PROJE RAPORU TESTLERİ GEÇTİ';
end;
$$;
