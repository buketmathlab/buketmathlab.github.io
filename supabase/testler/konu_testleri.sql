-- =============================================================================
-- SEKİZ — 0020 KONU ANALİZİ TESTLERİ
--
-- Üç asıl soru:
--   1. Analiz PUANLA ÇELİŞİYOR MU? (100 alan öğrenciye "eksiğin var" demek
--      ürünü güvenilmez kılar)
--   2. VELİYE ANAHTAR SIZIYOR MU? Veli konu analizini görecek ama cevap
--      anahtarını asla (Kural 6).
--   3. Soru sayısı küçülünce eski konular kayıtta kalıyor mu?
--
-- İZOLASYON: kendi sınıfımızı (6K) kuruyoruz.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text; jo text; jv text;
  v_sinif uuid; v_a uuid; v_b uuid; v_odev uuid;
  v jsonb; e jsonb; n integer; s text;
  g_dogru integer; g_yanlis integer; g_bos integer;
  t_dogru integer; t_yanlis integer; t_bos integer;
begin
  update public.ayarlar
     set ogretmen_pin_hash = extensions.crypt('Konu!2026', extensions.gen_salt('bf', 10))
   where id = 1;
  jt := (public.giris('Konu!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (6, 'K')
    on conflict (seviye, sube) do update set arsiv = false
    returning id into v_sinif;

  v_a := (public.ogrenci_ekle(jt, 'Kaan Konulu', 'okul', v_sinif))->>'id';
  v_b := (public.ogrenci_ekle(jt, 'Lale Konulu', 'okul', v_sinif))->>'id';
  jo := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_a and rol = 'ogrenci')))->>'token';
  jv := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_a and rol = 'veli')))->>'token';

  -- 6 soru: 1-3 Türev, 4-6 Limit
  v_odev := (public.odev_olustur(jt, 'Konu testi', null, v_sinif, 'test',
      (current_date + 3)::date, 6,
      '{"1":"A","2":"B","3":"C","4":"D","5":"E","6":"A"}'::jsonb,
      'odev/anahtar.pdf', 'odev/soru.pdf', true, 5::smallint,
      '{"1":"Türev","2":"Türev","3":"Türev","4":"Limit","5":"Limit","6":"Limit"}'::jsonb
    ))->>'id';
  perform public.odev_yayinla(jt, v_odev);

  -- ---------------------------------------------------------------------------
  -- 1 — Konular kaydediliyor ve öğretmene geri dönüyor
  -- ---------------------------------------------------------------------------
  v := public.odev_detay(jt, v_odev);
  if v->'konular'->>'1' <> 'Türev' or v->'konular'->>'6' <> 'Limit' then
    raise exception '1a: konular odev_detay''dan dönmüyor: %', v->'konular';
  end if;

  raise notice '1 OK — konular kaydediliyor, düzenleme formuna geri dönüyor';

  -- ---------------------------------------------------------------------------
  -- 2 — ANALİZ PUANLA ÇELİŞMİYOR
  --
  -- Kaan: Türev'de 3/3 doğru; Limit'te 1 doğru, 1 yanlış, 1 boş.
  -- Yani 4 doğru / 6 soru = 66.67 puan.
  -- ---------------------------------------------------------------------------
  perform public.odev_gonder(jo, v_odev,
    'cozum/' || v_odev::text || '/' || v_a::text || '.jpg',
    '{"1":"A","2":"B","3":"C","4":"D","5":"A"}'::jsonb);  -- 6 boş, 5 yanlış

  -- SAKLANAN puanı okuyoruz, yeniden hesaplamıyoruz: karşılaştırmanın
  -- anlamı, analizin öğrencinin GERÇEKTEN gördüğü puanla tutması.
  select g.dogru, g.yanlis, g.bos into g_dogru, g_yanlis, g_bos
  from public.gonderimler g
  where g.odev_id = v_odev and g.ogrenci_id = v_a;

  if g_dogru <> 4 or g_yanlis <> 1 or g_bos <> 1 then
    raise exception '2a: kurulum beklendiği gibi değil: % doğru % yanlış % boş',
      g_dogru, g_yanlis, g_bos;
  end if;

  v := public.ogrenci_odevleri(jo);
  select e2 into e from jsonb_array_elements(v->'odevler') o,
       lateral jsonb_array_elements(o->'konu_analizi') e2
   where (o->>'id')::uuid = v_odev and e2->>'konu' = 'Türev';
  if (e->>'dogru')::int <> 3 or (e->>'yanlis')::int <> 0 or (e->>'bos')::int <> 0 then
    raise exception '2b: Türev 3/0/0 olmalıydı: %', e;
  end if;

  select e2 into e from jsonb_array_elements(v->'odevler') o,
       lateral jsonb_array_elements(o->'konu_analizi') e2
   where (o->>'id')::uuid = v_odev and e2->>'konu' = 'Limit';
  if (e->>'dogru')::int <> 1 or (e->>'yanlis')::int <> 1 or (e->>'bos')::int <> 1 then
    raise exception '2c: Limit 1/1/1 olmalıydı: %', e;
  end if;

  -- Toplamlar puanla birebir tutmalı
  select sum((x->>'dogru')::int), sum((x->>'yanlis')::int), sum((x->>'bos')::int)
    into t_dogru, t_yanlis, t_bos
  from jsonb_array_elements(v->'odevler') o,
       lateral jsonb_array_elements(o->'konu_analizi') x
   where (o->>'id')::uuid = v_odev;
  -- Analiz toplamı, gönderimde SAKLANAN sayılarla birebir aynı olmalı.
  if t_dogru <> g_dogru or t_yanlis <> g_yanlis or t_bos <> g_bos then
    raise exception '2d: analiz (%/%/%) saklanan puanla (%/%/%) çelişiyor',
      t_dogru, t_yanlis, t_bos, g_dogru, g_yanlis, g_bos;
  end if;

  raise notice '2 OK — konu analizi _puanla ile birebir tutuyor (boş yanlış sayılmıyor)';

  -- ---------------------------------------------------------------------------
  -- 3 — En zayıf konu ÜSTTE (öğrenci neye çalışacağını ilk satırda görsün)
  -- ---------------------------------------------------------------------------
  select o->'konu_analizi'->0->>'konu' into s
  from jsonb_array_elements(v->'odevler') o where (o->>'id')::uuid = v_odev;
  if s <> 'Limit' then
    raise exception '3a: en zayıf konu üstte değil, ilk sırada %', s;
  end if;

  raise notice '3 OK — en çok eksik olan konu listenin başında';

  -- ---------------------------------------------------------------------------
  -- 4 — TESLİMDEN ÖNCE analiz YOK (anahtara doğru bir adım olurdu)
  -- ---------------------------------------------------------------------------
  v := public.ogrenci_odevleri(
        (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_b and rol = 'ogrenci')))->>'token');
  select jsonb_array_length(o->'konu_analizi') into n
  from jsonb_array_elements(v->'odevler') o where (o->>'id')::uuid = v_odev;
  if n <> 0 then
    raise exception '4a: teslim etmemiş öğrenci konu analizini görüyor (% kayıt)', n;
  end if;

  raise notice '4 OK — teslim etmeden konu analizi görünmüyor';

  -- ---------------------------------------------------------------------------
  -- 5 — VELİ KONUYU GÖRÜYOR, ANAHTARI GÖRMÜYOR (Kural 6)
  --
  -- Bu turun en kritik testi: konu analizini veliye açmak, anahtarı da
  -- açmanın bahanesi olamaz.
  -- ---------------------------------------------------------------------------
  v := public.veli_paneli(jv);
  select e2 into e from jsonb_array_elements(v->'odevler') o,
       lateral jsonb_array_elements(o->'konu_analizi') e2
   where e2->>'konu' = 'Limit';
  if e is null or (e->>'dogru')::int <> 1 then
    raise exception '5a: veli konu analizini görmüyor: %', v->'odevler';
  end if;

  s := v::text;
  if s ilike '%cevap_anahtari%' or s ilike '%anahtar_yolu%' or s ilike '%anahtar_url%' then
    raise exception '5b: veli panelinde anahtar ALANI var';
  end if;
  if s ilike '%odev/anahtar.pdf%' then
    raise exception '5c: veli panelinde anahtar dosya yolu var';
  end if;
  -- Anahtarın içeriği de sızmasın: soru→şık eşlemesi hiçbir biçimde geçmemeli
  if s like '%"5": "E"%' or s like '%"5":"E"%' then
    raise exception '5d: veli panelinde anahtarın içeriği var';
  end if;
  if public.dosya_erisim_izni(jv, 'odev/anahtar.pdf') then
    raise exception '5e: veli anahtar PDF''ini açabiliyor';
  end if;

  raise notice '5 OK — veli konuyu görüyor, anahtarı hiçbir biçimde görmüyor';

  -- ---------------------------------------------------------------------------
  -- 6 — SINIF KONU ÖZETİ öğretmende
  -- ---------------------------------------------------------------------------
  v := public.odev_gonderimleri(jt, v_odev);
  select e2 into e from jsonb_array_elements(v->'konu_ozeti') e2 where e2->>'konu' = 'Limit';
  if (e->>'yanlis')::int <> 1 or (e->>'bos')::int <> 1 then
    raise exception '6a: sınıf özeti yanlış: %', v->'konu_ozeti';
  end if;
  if (v->'konu_ozeti'->0->>'konu') <> 'Limit' then
    raise exception '6b: sınıfın en zayıf konusu başta değil';
  end if;

  raise notice '6 OK — sınıfın konu özeti doğru, en zayıf konu başta';

  -- ---------------------------------------------------------------------------
  -- 7 — SORU SAYISI KÜÇÜLÜNCE konular kırpılıyor
  -- ---------------------------------------------------------------------------
  perform public.odev_guncelle(jt, v_odev, 'Konu testi', null, v_sinif,
    (current_date + 3)::date, 3, '{"1":"A","2":"B","3":"C"}'::jsonb,
    'odev/anahtar.pdf', 'odev/soru.pdf', null, null, null);

  v := public.odev_detay(jt, v_odev);
  if v->'konular' ? '4' or v->'konular' ? '6' then
    raise exception '7a: soru sayısı 3''e inince 4-6''nın konusu kayıtta kaldı: %',
      v->'konular';
  end if;
  if v->'konular'->>'1' <> 'Türev' then
    raise exception '7b: kalan konular bozuldu';
  end if;

  raise notice '7 OK — soru sayısı küçülünce fazla konular kırpılıyor';

  -- ---------------------------------------------------------------------------
  -- 8 — p_konular NULL = DEĞİŞTİRME (p_gec_teslim tuzağının aynısı)
  --
  -- Başlık değiştiren bir güncelleme konuları SİLMEMELİ.
  -- ---------------------------------------------------------------------------
  perform public.odev_guncelle(jt, v_odev, 'Yeni başlık', null, v_sinif,
    (current_date + 3)::date, 3, '{"1":"A","2":"B","3":"C"}'::jsonb,
    'odev/anahtar.pdf', 'odev/soru.pdf', null, null, null);

  v := public.odev_detay(jt, v_odev);
  if v->'konular'->>'1' <> 'Türev' then
    raise exception '8a: başlık güncellemesi konuları sildi: %', v->'konular';
  end if;

  -- Boş nesne ile TEMİZLENEBİLMELİ
  perform public.odev_guncelle(jt, v_odev, 'Yeni başlık', null, v_sinif,
    (current_date + 3)::date, 3, '{"1":"A","2":"B","3":"C"}'::jsonb,
    'odev/anahtar.pdf', 'odev/soru.pdf', null, null, '{}'::jsonb);

  v := public.odev_detay(jt, v_odev);
  if v->'konular' <> '{}'::jsonb then
    raise exception '8b: boş nesneyle konular temizlenmedi: %', v->'konular';
  end if;

  raise notice '8 OK — NULL değiştirmiyor, boş nesne temizliyor';

  -- ---------------------------------------------------------------------------
  -- 9 — KONUSUZ ödev bugünkü gibi çalışıyor (geriye dönük uyum)
  -- ---------------------------------------------------------------------------
  v := public.ogrenci_odevleri(jo);
  select jsonb_array_length(o->'konu_analizi') into n
  from jsonb_array_elements(v->'odevler') o where (o->>'id')::uuid = v_odev;
  if n <> 0 then
    raise exception '9a: konusuz ödevde analiz çıkıyor (% kayıt)', n;
  end if;

  raise notice '9 OK — konusu girilmemiş ödev eskisi gibi çalışıyor';

  -- ---------------------------------------------------------------------------
  -- 10 — Öğrenci ve veli konu önerilerini alamaz, eski imzalar düştü
  -- ---------------------------------------------------------------------------
  begin
    perform public.konu_onerileri(jo);
    raise exception '10a: ÖĞRENCİ konu önerilerini aldı';
  exception when sqlstate '42501' then null;
  end;

  if to_regprocedure('public.odev_olustur(text,text,text,uuid,text,date,integer,jsonb,text,text,boolean,smallint)') is not null then
    raise exception '10b: eski odev_olustur imzası ayakta';
  end if;

  select count(*) into n from pg_proc p2
    join pg_namespace ns on ns.oid = p2.pronamespace
   where ns.nspname = 'public' and p2.proname in ('odev_olustur', 'odev_guncelle');
  if n <> 2 then
    raise exception '10c: iki uçtan % imza var, aşırı yükleme oluşmuş', n;
  end if;

  if has_function_privilege('anon', 'public._konu_analizi(jsonb,jsonb,jsonb,integer)', 'execute') then
    raise exception '10d: dahili _konu_analizi anon''a açık';
  end if;

  raise notice '10 OK — tek imza, dahili yardımcı kapalı, öğrenci öneri alamıyor';

  -- ---------------------------------------------------------------------------
  -- 11 — HANGİ SORULAR YANLIŞ: öğretmen numaraları görüyor
  --
  -- Yukarıdaki ödevin soru sayısı 7. grupta 3'e indirildi ve konuları 8'de
  -- temizlendi; bu yüzden yeni ve TEMİZ bir ödev kuruluyor. Aksi hâlde test
  -- kendinden önceki grupların artığına dayanırdı.
  --
  -- 5 soru, anahtar A B C D E. Kaan: 1 doğru, 2 yanlış (Z geçersiz şık),
  -- 3 boş bırakılmış, 4 doğru, 5 hiç gönderilmemiş.
  -- Beklenen: yanlış [2], boş [3, 5].
  -- ---------------------------------------------------------------------------
  v_odev := (public.odev_olustur(jt, 'Soru dökümü testi', null, v_sinif, 'test',
      (current_date + 3)::date, 5,
      '{"1":"A","2":"B","3":"C","4":"D","5":"E"}'::jsonb,
      'odev/anahtar2.pdf', 'odev/soru2.pdf', true, 5::smallint,
      '{"1":"Türev","2":"Türev","3":"Limit","4":"Limit","5":"Limit"}'::jsonb
    ))->>'id';
  perform public.odev_yayinla(jt, v_odev);

  perform public.odev_gonder(jo, v_odev,
    'cozum/' || v_odev::text || '/' || v_a::text || '.jpg',
    '{"1":"A","2":"Z","3":"","4":"D"}'::jsonb);

  v := public.odev_gonderimleri(jt, v_odev);

  select e2 into e from jsonb_array_elements(v->'satirlar') e2
   where (e2->>'ogrenci_id')::uuid = v_a;
  if e->'yanlis_sorular' <> '[2]'::jsonb then
    raise exception '11a: yanlış soru numaraları [2] olmalıydı: %', e->'yanlis_sorular';
  end if;
  if e->'bos_sorular' <> '[3, 5]'::jsonb then
    raise exception '11b: boş soru numaraları [3,5] olmalıydı: %', e->'bos_sorular';
  end if;

  -- Numaralar SAYILARLA tutmalı: "3 yanlış" deyip iki numara göstermek,
  -- öğretmenin ekranda gördüğü iki sayıyı birbiriyle çelişkiye düşürürdü.
  if jsonb_array_length(e->'yanlis_sorular') <> (e->>'yanlis')::int
     or jsonb_array_length(e->'bos_sorular') <> (e->>'bos')::int then
    raise exception '11c: numara adedi (%/%) sayılarla (%/%) çelişiyor',
      jsonb_array_length(e->'yanlis_sorular'), jsonb_array_length(e->'bos_sorular'),
      (e->>'yanlis')::int, (e->>'bos')::int;
  end if;

  -- Göndermeyen öğrencinin satırı BOŞ dizi olmalı, "hepsi yanlış" değil.
  select e2 into e from jsonb_array_elements(v->'satirlar') e2
   where (e2->>'ogrenci_id')::uuid = v_b;
  if (e->>'gonderdi')::boolean
     or e->'yanlis_sorular' <> '[]'::jsonb or e->'bos_sorular' <> '[]'::jsonb then
    raise exception '11d: göndermeyen öğrenciye soru numarası atanmış: %', e;
  end if;

  raise notice '11 OK — öğretmen hangi soruların yanlış/boş olduğunu numarayla görüyor';

  -- ---------------------------------------------------------------------------
  -- 12 — VELİ NUMARAYI GÖRÜYOR, ŞIKKI GÖRMÜYOR (Kural 6)
  --
  -- Bu turun sınırı: "hangi soruda takıldı" velinin işine yarar; "çocuğun C
  -- dedi, doğrusu B" dört şıklı bir soruda anahtara doğru atılmış bir adımdır.
  -- Numara gider, şık gitmez.
  -- ---------------------------------------------------------------------------
  v := public.veli_paneli(jv);
  select o into e from jsonb_array_elements(v->'odevler') o
   where o->>'baslik' = 'Soru dökümü testi';
  if e->'yanlis_sorular' <> '[2]'::jsonb or e->'bos_sorular' <> '[3, 5]'::jsonb then
    raise exception '12a: veli soru numaralarını görmüyor: %', e;
  end if;

  s := v::text;
  -- Ne öğrencinin verdiği şık ne de doğru şık yanıtta olmalı. 'Z' yalnız
  -- öğrencinin cevabında, 'E' yalnız anahtarda geçiyor — ikisi de bu
  -- ödevde başka hiçbir alanda bulunmuyor, yani arama kesin ayırt ediyor.
  if s like '%"Z"%' then
    raise exception '12b: veli panelinde ÖĞRENCİNİN verdiği şık var';
  end if;
  if s like '%"E"%' then
    raise exception '12c: veli panelinde ANAHTARIN şıkkı var';
  end if;
  if s ilike '%cevaplar%' or s ilike '%cevap_anahtari%' then
    raise exception '12d: veli panelinde cevap alanı var';
  end if;

  -- Açık uçlu ödevde numara dökümü ANLAMSIZ: anahtar yok, her soru "boş"
  -- görünürdü. Boş dizi dönmeli.
  v_odev := (public.odev_olustur(jt, 'Açık uçlu döküm', null, v_sinif, 'acik',
      (current_date + 3)::date, 4, null,
      null, 'odev/soru3.pdf', true, 5::smallint, null))->>'id';
  perform public.odev_yayinla(jt, v_odev);
  perform public.odev_gonder(jo, v_odev,
    'cozum/' || v_odev::text || '/' || v_a::text || '.jpg', null);

  v := public.odev_gonderimleri(jt, v_odev);
  select e2 into e from jsonb_array_elements(v->'satirlar') e2
   where (e2->>'ogrenci_id')::uuid = v_a;
  if e->'yanlis_sorular' <> '[]'::jsonb or e->'bos_sorular' <> '[]'::jsonb then
    raise exception '12e: açık uçlu ödevde soru numarası üretildi: %', e;
  end if;

  raise notice '12 OK — veliye numara gidiyor, şık gitmiyor; açık uçluda döküm yok';

  raise notice '';
  raise notice 'KONU ANALİZİ TESTLERİ: 12 GRUP GEÇTİ';
end $$;
