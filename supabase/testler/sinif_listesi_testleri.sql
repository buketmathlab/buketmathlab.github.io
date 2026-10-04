-- =============================================================================
-- SEKİZ — 0064: SINIF LİSTESİ ESAS
--
--  1. Önizleme: kalan, yeni, başka şubeden taşınan ve çıkarılacak doğru;
--     önizleme HİÇBİR ŞEYİ değiştirmiyor.
--  2. Uygulama: aynı plan yazılıyor. Çıkarılan pasif ve kodları iptal (kaydı
--     ve gönderimi duruyor); taşınanın kodları aynı, geliş günü bugün; yeni
--     öğrencinin kodları var.
--  3. Ortalamalar HEMEN güncel: giden öğrencinin 0'ı sınıf ortalamasından
--     düştü; sonradan gelen ve taşınana gelmeden önceki ödev sayılmıyor
--     (ne "yapmadı" ne 0); öğrenci ekranında o ödev yok; geldikten sonra
--     verilen ödev sayılıyor.
--  4. Belirsiz ad (iki sınıfta adaş) reddediliyor; numara verilirse doğru
--     kişi taşınıyor.
--  5. Hatalar: boş liste, özel ders grubu, sahip olmayan öğretmen; hatalı
--     tek satır HİÇBİR şey yazdırmıyor (tek işlem).
--  6. Mevcut öğrenci (geliş günü boş) için hesap DEĞİŞMEDİ.
--  7. pano_detay kapsamı: öğretmen başka öğretmenin sınıfındaki öğrenciyi
--     "göndermeyenler" listesinde görmüyor.
--
-- İZOLASYON: kendi sınıflarını (11LA, 11LB, 11LC) kuruyor; tekrar
-- çalıştırılınca önceki koşunun öğrencileri pasif, ödevleri yayın dışı.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text; jl text;
  s_a uuid; s_b uuid; s_c uuid; s_ozel uuid;
  o_ali uuid; o_ayse uuid; o_can uuid; o_deniz uuid; o_ece uuid;
  h1 uuid; h2 uuid;
  v jsonb; sat jsonb; t jsonb;
  ek text := to_char(clock_timestamp(), 'HH24MISSUS');
  kod_deniz text; patladi boolean;
  v_liste uuid;
begin
  update public.ogretmenler
     set pin_hash = extensions.crypt('Liste!Sahip26', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Liste!Sahip26'))->>'token';

  if not exists (select 1 from public.ogretmenler where ad = 'Liste Öğretmeni') then
    perform public.ogretmen_ekle(jt, 'Liste Öğretmeni', 'ListeOgr!26');
  end if;
  select id into v_liste from public.ogretmenler where ad = 'Liste Öğretmeni';
  jl := (public.giris('ListeOgr!26'))->>'token';

  s_a := (public.sinif_ekle(jt, 11::smallint, 'LA'))->>'id';
  s_b := (public.sinif_ekle(jt, 11::smallint, 'LB'))->>'id';
  s_c := (public.sinif_ekle(jt, 11::smallint, 'LC'))->>'id';
  update public.ogrenciler set aktif = false where sinif_id in (s_a, s_b, s_c);
  update public.odevler set yayinda = false where sinif_id in (s_a, s_b, s_c);
  select id into s_ozel from public.siniflar where ozel limit 1;

  o_ali   := (public.ogrenci_ekle(jt, 'Ali Bir ' || ek,  'okul', s_a, '101'))->>'id';
  o_ayse  := (public.ogrenci_ekle(jt, 'Ayşe İki ' || ek, 'okul', s_a, '102'))->>'id';
  o_can   := (public.ogrenci_ekle(jt, 'Can Üç ' || ek,   'okul', s_a, '103'))->>'id';
  o_deniz := (public.ogrenci_ekle(jt, 'Deniz Dört ' || ek, 'okul', s_b, '201'))->>'id';
  -- "Başından beri sınıfta": geliş günü boş (0064 öncesi kayıtlar böyle).
  update public.ogrenciler set sinif_giris = null where id in (o_ali, o_ayse, o_can, o_deniz);

  -- H1: 10 gün önce verilmiş, 5 gün önce dolmuş. Ali 80, Ayşe 60, Can göndermedi.
  h1 := (public.odev_olustur(jt, 'Liste ödevi 1', null, s_a, 'test', (current_date + 3)::date, 5,
          '{"1":"A","2":"B","3":"C","4":"D","5":"E"}'::jsonb))->>'id';
  perform public.odev_yayinla(jt, h1);
  perform public.odev_gonder((public.giris((select kod from public.giris_kodlari
            where ogrenci_id = o_ali and rol = 'ogrenci')))->>'token', h1,
            'cozum/' || h1 || '/' || o_ali || '.jpg', '{"1":"A","2":"B","3":"C","4":"D","5":"A"}'::jsonb);
  perform public.odev_gonder((public.giris((select kod from public.giris_kodlari
            where ogrenci_id = o_ayse and rol = 'ogrenci')))->>'token', h1,
            'cozum/' || h1 || '/' || o_ayse || '.jpg', '{"1":"A","2":"B","3":"C","4":"A","5":"A"}'::jsonb);
  update public.odevler set son_tarih = current_date - 5, created_at = now() - interval '10 days'
   where id = h1;

  -- Önce: mevcut 3, sınıfın tamamı (80+60+0)/3 = 46.7
  select x into sat from jsonb_array_elements(public.odevler_listesi(jt, s_a)) x where x->>'id' = h1::text;
  if (sat->>'sinif_mevcudu')::int <> 3 or (sat->>'ortalama_tum')::numeric <> 46.7 then
    raise exception '0: başlangıç sayıları beklenmedik: %', sat;
  end if;

  select kod into kod_deniz from public.giris_kodlari where ogrenci_id = o_deniz and rol = 'ogrenci';

  -- ---------------------------------------------------------------------------
  -- 1. ÖNİZLEME
  -- ---------------------------------------------------------------------------
  v := public.siniflari_esitle(jt, jsonb_build_array(jsonb_build_object(
         'sinif_id', s_a,
         'adlar', jsonb_build_array(
           jsonb_build_object('ad', 'ALİ BİR ' || ek, 'no', '101'),
           jsonb_build_object('ad', 'Ayşe İki ' || ek, 'no', '102'),
           jsonb_build_object('ad', 'Deniz Dört ' || ek, 'no', '201'),
           jsonb_build_object('ad', 'Ece Beş ' || ek, 'no', '105')))), false);
  sat := v->'siniflar'->0;
  if (v->>'uygulandi')::boolean
     or (sat->>'kalan')::int <> 2
     or jsonb_array_length(sat->'yeni') <> 1 or sat->'yeni'->0->>'ad' <> 'Ece Beş ' || ek
     or jsonb_array_length(sat->'tasinan') <> 1 or sat->'tasinan'->0->>'eski_sinif' <> '11LB'
     or jsonb_array_length(sat->'cikarilan') <> 1 or sat->'cikarilan'->0->>'ad' <> 'Can Üç ' || ek then
    raise exception '1a: önizleme yanlış: %', v;
  end if;
  if not (select aktif from public.ogrenciler where id = o_can)
     or (select sinif_id from public.ogrenciler where id = o_deniz) <> s_b
     or exists (select 1 from public.ogrenciler where ad = 'Ece Beş ' || ek) then
    raise exception '1b: önizleme veriyi değiştirdi';
  end if;
  raise notice '1 OK — önizleme: 2 kalan, 1 yeni, 1 taşınan (11LB), 1 çıkarılacak; hiçbir şey yazılmadı';

  -- ---------------------------------------------------------------------------
  -- 2. UYGULAMA
  -- ---------------------------------------------------------------------------
  t := public.siniflari_esitle(jt, jsonb_build_array(jsonb_build_object(
         'sinif_id', s_a,
         'adlar', jsonb_build_array(
           jsonb_build_object('ad', 'ALİ BİR ' || ek, 'no', '101'),
           jsonb_build_object('ad', 'Ayşe İki ' || ek, 'no', '102'),
           jsonb_build_object('ad', 'Deniz Dört ' || ek, 'no', '201'),
           jsonb_build_object('ad', 'Ece Beş ' || ek, 'no', '105')))), true);
  if t->'siniflar' <> v->'siniflar' then
    raise exception '2a: uygulanan plan önizlemeden farklı';
  end if;
  if (t->>'eklendi')::int <> 1 or (t->>'tasindi')::int <> 1 or (t->>'degismedi')::int <> 2
     or (t->>'cikarildi')::int <> 1 then
    raise exception '2b: sayaçlar yanlış: %', t;
  end if;
  if (select aktif from public.ogrenciler where id = o_can)
     or exists (select 1 from public.giris_kodlari where ogrenci_id = o_can)
     or not exists (select 1 from public.gonderimler where ogrenci_id = o_ali) then
    raise exception '2c: çıkarma yanlış (pasif değil, kodu duruyor ya da veri silindi)';
  end if;
  if (select sinif_id from public.ogrenciler where id = o_deniz) <> s_a
     or (select sinif_giris from public.ogrenciler where id = o_deniz) <> (now() at time zone 'Europe/Istanbul')::date
     or (select kod from public.giris_kodlari where ogrenci_id = o_deniz and rol = 'ogrenci') <> kod_deniz then
    raise exception '2d: taşıma yanlış (sınıf, geliş günü ya da kod)';
  end if;
  select id into o_ece from public.ogrenciler where ad = 'Ece Beş ' || ek and aktif;
  if o_ece is null or (select count(*) from public.giris_kodlari where ogrenci_id = o_ece) <> 2
     or (select sinif_giris from public.ogrenciler where id = o_ece) <> (now() at time zone 'Europe/Istanbul')::date then
    raise exception '2e: yeni öğrenci yanlış';
  end if;
  if not exists (select 1 from public.denetim_izi where islem = 'ogrenci_tasindi' and kayit_id = o_deniz)
     or not exists (select 1 from public.denetim_izi where islem = 'ogrenci_pasiflestirildi' and kayit_id = o_can) then
    raise exception '2f: denetim izi eksik';
  end if;
  raise notice '2 OK — uygulandı: plan aynı; Can pasif (verisi duruyor), Deniz kodlarıyla taşındı, Ece eklendi; denetim izi var';

  -- ---------------------------------------------------------------------------
  -- 3. ORTALAMALAR HEMEN GÜNCEL
  -- ---------------------------------------------------------------------------
  select x into sat from jsonb_array_elements(public.odevler_listesi(jt, s_a)) x where x->>'id' = h1::text;
  if (sat->>'sinif_mevcudu')::int <> 2 or (sat->>'gonderim_sayisi')::int <> 2
     or (sat->>'ortalama_tum')::numeric <> 70 or (sat->>'ortalama_yapan')::numeric <> 70 then
    raise exception '3a: H1 sayıları güncellenmedi: %', sat;
  end if;
  t := public.sinif_ogrencileri(jt, s_a);
  select x into sat from jsonb_array_elements(t->'ogrenciler') x where x->>'id' = o_deniz::text;
  if (sat->>'yapti')::int <> 0 or (sat->>'yapmadi')::int <> 0 or sat->>'ortalama_tum' is not null then
    raise exception '3b: taşınan öğrenciye gelmeden önceki ödev sayıldı: %', sat;
  end if;
  select x into sat from jsonb_array_elements(t->'ogrenciler') x where x->>'id' = o_ece::text;
  if (sat->>'yapmadi')::int <> 0 then
    raise exception '3c: yeni öğrenciye gelmeden önceki ödev sayıldı: %', sat;
  end if;
  select x into sat from jsonb_array_elements(public.sinif_not_cizelgesi(jt, s_a)->'ogrenciler') x
   where x->>'id' = o_deniz::text;
  if (select p->>'durum' from jsonb_array_elements(sat->'puanlar') p where p->>'odev_id' = h1::text) <> 'kapsam_disi' then
    raise exception '3d: çizelgede gelmeden önceki ödev "kapsam_disi" değil: %', sat->'puanlar';
  end if;
  select x into sat from jsonb_array_elements(public.sinif_not_cizelgesi(jt, s_a)->'odevler') x
   where x->>'id' = h1::text;
  if (sat->>'beklenen')::int <> 2 or (sat->>'gonderim')::int <> 2 then
    raise exception '3e: çizelgede ödevin beklenen/gönderen sayısı: %', sat;
  end if;
  if exists (select 1 from jsonb_array_elements(public.ogrenci_odevleri(
               (public.giris(kod_deniz))->>'token')->'odevler') x where x->>'id' = h1::text) then
    raise exception '3f: taşınan öğrenci gelmeden önceki ödevi kendi listesinde görüyor';
  end if;
  -- Geldikten SONRA verilen ödev sayılıyor ve listede görünüyor.
  h2 := (public.odev_olustur(jt, 'Liste ödevi 2', null, s_a, 'acik', (current_date + 3)::date))->>'id';
  perform public.odev_yayinla(jt, h2);
  if not exists (select 1 from jsonb_array_elements(public.ogrenci_odevleri(
                   (public.giris(kod_deniz))->>'token')->'odevler') x where x->>'id' = h2::text) then
    raise exception '3g: geldikten sonra verilen ödev öğrencinin listesinde yok';
  end if;
  update public.odevler set son_tarih = current_date - 1 where id = h2;
  t := public.sinif_ogrencileri(jt, s_a);
  select x into sat from jsonb_array_elements(t->'ogrenciler') x where x->>'id' = o_deniz::text;
  if (sat->>'yapmadi')::int <> 1 then
    raise exception '3h: geldikten sonra verilen, süresi dolan ödev sayılmadı: %', sat;
  end if;
  update public.odevler set yayinda = false where id = h2;
  raise notice '3 OK — giden öğrenci ortalamadan hemen düştü (46,7 → 70); sonradan gelene önceki ödev sayılmıyor, sonraki sayılıyor';

  -- ---------------------------------------------------------------------------
  -- 4. BELİRSİZ AD
  -- ---------------------------------------------------------------------------
  perform public.ogrenci_ekle(jt, 'Fatma Altı ' || ek, 'okul', s_b, '301');
  perform public.ogrenci_ekle(jt, 'Fatma Altı ' || ek, 'okul', s_c, '302');
  patladi := false;
  begin
    perform public.siniflari_esitle(jt, jsonb_build_array(jsonb_build_object(
      'sinif_id', s_a, 'adlar', jsonb_build_array(
        jsonb_build_object('ad', 'Ali Bir ' || ek), jsonb_build_object('ad', 'Fatma Altı ' || ek)))), false);
  exception when sqlstate '22023' then patladi := true;
  end;
  if not patladi then raise exception '4a: iki sınıfta adaş varken tahmin edildi'; end if;
  v := public.siniflari_esitle(jt, jsonb_build_array(jsonb_build_object(
      'sinif_id', s_a, 'adlar', jsonb_build_array(
        jsonb_build_object('ad', 'Ali Bir ' || ek, 'no', '101'),
        jsonb_build_object('ad', 'Ayşe İki ' || ek, 'no', '102'),
        jsonb_build_object('ad', 'Deniz Dört ' || ek, 'no', '201'),
        jsonb_build_object('ad', 'Ece Beş ' || ek, 'no', '105'),
        jsonb_build_object('ad', 'Fatma Altı ' || ek, 'no', '302')))), false);
  if v->'siniflar'->0->'tasinan'->0->>'eski_sinif' <> '11LC'
     or jsonb_array_length(v->'siniflar'->0->'cikarilan') <> 0 then
    raise exception '4b: numarayla doğru kişi seçilmedi: %', v;
  end if;
  raise notice '4 OK — adaş belirsizse reddediliyor; numara verilince doğru kişi (11LC) taşınıyor';

  -- ---------------------------------------------------------------------------
  -- 5. HATALAR VE TEK İŞLEM
  -- ---------------------------------------------------------------------------
  patladi := false;
  begin
    perform public.siniflari_esitle(jt, jsonb_build_array(jsonb_build_object('sinif_id', s_a, 'adlar', '[]'::jsonb)), true);
  exception when sqlstate '22023' then patladi := true;
  end;
  if not patladi then raise exception '5a: boş liste kabul edildi'; end if;
  patladi := false;
  begin
    perform public.siniflari_esitle(jt, jsonb_build_array(jsonb_build_object(
      'sinif_id', s_ozel, 'adlar', jsonb_build_array('Biri'))), true);
  exception when sqlstate '22023' then patladi := true;
  end;
  if not patladi then raise exception '5b: özel ders grubu eşitlendi'; end if;
  patladi := false;
  begin
    perform public.siniflari_esitle(jl, jsonb_build_array(jsonb_build_object(
      'sinif_id', s_a, 'adlar', jsonb_build_array('Biri'))), true);
  exception when sqlstate '42501' then patladi := true;
  end;
  if not patladi then raise exception '5c: sahip olmayan öğretmen eşitledi'; end if;
  patladi := false;
  begin
    -- 11LB geçerli, 11LA'nın ikinci satırı bozuk → hiçbiri yazılmamalı.
    perform public.siniflari_esitle(jt, jsonb_build_array(
      jsonb_build_object('sinif_id', s_b, 'adlar', jsonb_build_array('Yeni Biri ' || ek)),
      jsonb_build_object('sinif_id', s_a, 'adlar', jsonb_build_array('Ali Bir ' || ek, ''))), true);
  exception when sqlstate '22023' then patladi := true;
  end;
  if not patladi or exists (select 1 from public.ogrenciler where ad = 'Yeni Biri ' || ek) then
    raise exception '5d: hatalı liste kısmen yazıldı';
  end if;
  raise notice '5 OK — boş liste, özel ders ve öğretmen reddediliyor; hatalı satır hiçbir şeyi yazdırmıyor';

  -- ---------------------------------------------------------------------------
  -- 6. MEVCUT ÖĞRENCİ (geliş günü boş): hesap değişmedi
  -- ---------------------------------------------------------------------------
  update public.odevler set yayinda = true where id = h2;
  t := public.sinif_ogrencileri(jt, s_a);
  select x into sat from jsonb_array_elements(t->'ogrenciler') x where x->>'id' = o_ali::text;
  if (sat->>'yapti')::int <> 1 or (sat->>'yapmadi')::int <> 1 or (sat->>'ortalama_tum')::numeric <> 40 then
    raise exception '6: mevcut öğrencinin hesabı değişti: %', sat;   -- H1 80 + H2 göndermedi 0 → 40
  end if;
  raise notice '6 OK — başından beri sınıftaki öğrencinin hesabı aynı kuralla';

  -- ---------------------------------------------------------------------------
  -- 7. pano_detay KAPSAMI
  -- ---------------------------------------------------------------------------
  update public.odevler set yayinda = true where id = h2;
  if exists (select 1 from jsonb_array_elements(public.pano_detay(jl, 'gondermeyen')->'gruplar') g
              where g->>'sinif' = '11LA') then
    raise exception '7a: öğretmen başka öğretmenin sınıfını "göndermeyenler"de görüyor';
  end if;
  if not exists (select 1 from jsonb_array_elements(public.pano_detay(jt, 'gondermeyen')->'gruplar') g
                  where g->>'sinif' = '11LA') then
    raise exception '7b: sahip kendi sınıfını göremiyor';
  end if;
  update public.odevler set yayinda = false where id in (h1, h2);
  raise notice '7 OK — pano_detay öğretmenin kendi sınıflarıyla sınırlı';
end $$;

select 'SINIF LİSTESİ TESTLERİ GEÇTİ' as sonuc;
