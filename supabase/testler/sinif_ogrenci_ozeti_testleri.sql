-- =============================================================================
-- SEKİZ — 0051 SINIF ÖĞRENCİ ÖZETİ TESTLERİ
--
-- Bu turun tehlikesi ARİTMETİK. Uç bir sayı döndürür ve o sayı yanlışsa
-- hiçbir şey çökmez: öğretmen "48,5" görür, doğrusu "31,2"dir ve bunu
-- anlamasının hiçbir yolu yoktur. Bu yüzden dünya ELLE HESAPLANABİLİR
-- kuruluyor ve beklenen değerler yorumlarda yazılı.
--
-- ZAMAN ÇİZGİSİ
--   Ö1 (test, 10 soru) — son tarih GEÇMİŞ
--   Ö2 (test, 10 soru) — son tarih GEÇMİŞ
--   Ö3 (test,  5 soru) — son tarih GELECEK  → hiçbir hesaba girmemeli
--
-- Ö1'in konuları BİLEREK dengesiz:
--   1-6  "Turev"    → 4 doğru, 2 yanlış   (toplam 6, eksik 2)
--   7-9  "Integral" → 0 doğru, 3 yanlış   (toplam 3, eksik 3)
--   10   "Limit"    → 1 doğru             (toplam 1, eksik 0)
--
-- ALT SINIR TAM BURADA ÖLÇÜLÜYOR: eksik sayısı en yüksek konu
-- "Integral" (3) ama toplam 3 soru, yani 5'in altında. Alt sınır
-- çalışıyorsa cevap "Turev" olmalı. Alt sınır kaldırılırsa "Integral"
-- çıkar ve 5. grup kırılır.
--
-- İZOLASYON: kendi sınıfını kuruyor (12Z).
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text;
  v_ben uuid;
  s_12z uuid;
  zeynep uuid; ali uuid; berk uuid;
  o1 uuid; o2 uuid; o3 uuid;
  kod text; jz text; ja text;
  v jsonb; satir jsonb;
  adlar text[];
  karne jsonb;
begin
  -- ---------------------------------------------------------------------------
  -- Hazırlık
  -- ---------------------------------------------------------------------------
  update public.ogretmenler
     set pin_hash = extensions.crypt('Ozet!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Ozet!2026'))->>'token';
  select id into v_ben from public.ogretmenler where yonetici;

  insert into public.siniflar (seviye, sube) values (12, 'Z')
    on conflict (seviye, sube) do update set arsiv = false returning id into s_12z;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    values (v_ben, s_12z) on conflict do nothing;

  -- DÜNYAYI ÖNCE TEMİZLİYOR — test AYNI VERİTABANINDA İKİ KEZ koşabilmeli.
  --
  -- İlk yazımda bu yoktu ve `calistir.sh` her koşuda sıfır bir veritabanı
  -- kurduğu için hiç fark edilmedi. Kusur provalarında ortaya çıktı:
  -- testi arka arkaya koşunca sınıfta ödevler birikiyor, Zeynep'in
  -- ortalaması 25,00 yerine 12,50 çıkıyor ve ÜÇ PROVA BİRDEN "başka grup
  -- kırıldı" diyordu. Kusur üründe değil, testin kendisindeydi.
  delete from public.odevler   where sinif_id = s_12z;  -- gönderimler cascade
  delete from public.ogrenciler where sinif_id = s_12z;  -- kodlar, mesajlar cascade

  -- NUMARA SIRASI İLE ALFABETİK SIRA BİLEREK FARKLI:
  --   numara:     Zeynep(1), Ali(2), Berk(numarasız)
  --   alfabetik:  Ali, Berk, Zeynep
  -- İkisi aynı olsaydı 7. grup hiçbir şey ayırt etmezdi.
  zeynep := (public.ogrenci_ekle(jt, 'Zeynep Ozet', 'okul', s_12z, '1'))->>'id';
  ali    := (public.ogrenci_ekle(jt, 'Ali Ozet',    'okul', s_12z, '2'))->>'id';
  berk   := (public.ogrenci_ekle(jt, 'Berk Ozet',   'okul', s_12z))->>'id';

  o1 := (public.odev_olustur(jt, 'Ozet Odev Bir', null, s_12z, 'test',
          (current_date + 30), 10,
          '{"1":"A","2":"A","3":"A","4":"A","5":"A","6":"A","7":"A","8":"A","9":"A","10":"A"}'::jsonb,
          null, null, true, 5::smallint,
          '{"1":"Turev","2":"Turev","3":"Turev","4":"Turev","5":"Turev","6":"Turev",
            "7":"Integral","8":"Integral","9":"Integral","10":"Limit"}'::jsonb))->>'id';
  o2 := (public.odev_olustur(jt, 'Ozet Odev Iki', null, s_12z, 'test',
          (current_date + 30), 10,
          '{"1":"A","2":"A","3":"A","4":"A","5":"A","6":"A","7":"A","8":"A","9":"A","10":"A"}'::jsonb,
          null, null, true, 5::smallint,
          '{"1":"Turev","2":"Turev","3":"Turev","4":"Turev","5":"Turev",
            "6":"Turev","7":"Turev","8":"Turev","9":"Turev","10":"Turev"}'::jsonb))->>'id';
  o3 := (public.odev_olustur(jt, 'Ozet Odev Uc', null, s_12z, 'test',
          (current_date + 30), 5,
          '{"1":"A","2":"A","3":"A","4":"A","5":"A"}'::jsonb,
          null, null, true, 5::smallint,
          '{"1":"Turev","2":"Turev","3":"Turev","4":"Turev","5":"Turev"}'::jsonb))->>'id';

  perform public.odev_yayinla(jt, o1);
  perform public.odev_yayinla(jt, o2);
  perform public.odev_yayinla(jt, o3);

  -- GÖNDERİMLER YAPILDIKTAN SONRA tarih geriye çekiliyor: `odev_gonder`
  -- süresi geçmiş ödevi reddedebilir, oysa test edilen şey teslim kuralı
  -- değil ORTALAMA. Önce gönder, sonra süreyi doldur.
  kod := (select k.kod from public.giris_kodlari k
           where k.ogrenci_id = zeynep and k.rol = 'ogrenci');
  jz := (public.giris(kod))->>'token';
  kod := (select k.kod from public.giris_kodlari k
           where k.ogrenci_id = ali and k.rol = 'ogrenci');
  ja := (public.giris(kod))->>'token';

  -- Zeynep, Ö1: Turev 4 doğru 2 yanlış · Integral 3 yanlış · Limit 1 doğru
  -- → 5 doğru / 10 → puan 50
  perform public.odev_gonder(jz, o1, 'cozum/' || o1 || '/' || zeynep || '.jpg',
    '{"1":"A","2":"A","3":"A","4":"A","5":"B","6":"B",
      "7":"B","8":"B","9":"B","10":"A"}'::jsonb);
  -- Zeynep Ö2'yi GÖNDERMİYOR → 0 sayılacak.

  -- Ali, Ö2: hepsi doğru → 100. Ö1'i göndermiyor → 0.
  perform public.odev_gonder(ja, o2, 'cozum/' || o2 || '/' || ali || '.jpg',
    '{"1":"A","2":"A","3":"A","4":"A","5":"A","6":"A","7":"A","8":"A","9":"A","10":"A"}'::jsonb);

  -- Berk hiçbir şey göndermiyor.

  update public.odevler set son_tarih = current_date - 3 where id in (o1, o2);
  -- Ö3 GELECEKTE kalıyor.

  -- ---------------------------------------------------------------------------
  -- 1. ORTALAMA ELLE HESAPLANANLA BİREBİR
  --
  --   Zeynep: (50 + 0) / 2 = 25,00
  --   Ali:    (0 + 100) / 2 = 50,00
  --   Berk:   (0 + 0) / 2   =  0,00
  -- ---------------------------------------------------------------------------
  v := public.sinif_ogrenci_ozeti(jt, s_12z);

  select e into satir from jsonb_array_elements(v->'ogrenciler') e
   where e->>'id' = zeynep::text;
  if (satir->>'ortalama')::numeric <> 25.00 then
    raise exception '1a: Zeynep ortalaması %, 25.00 olmalı', satir->>'ortalama';
  end if;
  select e into satir from jsonb_array_elements(v->'ogrenciler') e
   where e->>'id' = ali::text;
  if (satir->>'ortalama')::numeric <> 50.00 then
    raise exception '1b: Ali ortalaması %, 50.00 olmalı', satir->>'ortalama';
  end if;
  select e into satir from jsonb_array_elements(v->'ogrenciler') e
   where e->>'id' = berk::text;
  if (satir->>'ortalama')::numeric <> 0.00 then
    raise exception '1c: Berk ortalaması %, 0.00 olmalı (hiç göndermedi)',
      satir->>'ortalama';
  end if;
  raise notice '1 OK — üç ortalama da elle hesaplananla aynı (25 / 50 / 0)';

  -- ---------------------------------------------------------------------------
  -- 2. SÜRESİ DEVAM EDEN ÖDEV HESABA GİRMİYOR (öğretmenin 1. kararı)
  --
  -- Ö3 yayında ve kimse göndermedi. Hesaba girseydi Ali'nin ortalaması
  -- (0 + 100 + 0)/3 = 33,33 olurdu.
  -- ---------------------------------------------------------------------------
  select e into satir from jsonb_array_elements(v->'ogrenciler') e
   where e->>'id' = ali::text;
  if (satir->>'odev_sayisi')::int <> 2 then
    raise exception '2a: ödev sayısı %, 2 olmalı (Ö3 süresi devam ediyor)',
      satir->>'odev_sayisi';
  end if;
  raise notice '2 OK — süresi devam eden ödev ne sayıya ne ortalamaya giriyor';

  -- ---------------------------------------------------------------------------
  -- 3. ÖĞRETMEN PUANI OTOMATİK PUANI EZİYOR
  -- ---------------------------------------------------------------------------
  update public.gonderimler set ogretmen_puan = 90
   where odev_id = o1 and ogrenci_id = zeynep;

  v := public.sinif_ogrenci_ozeti(jt, s_12z);
  select e into satir from jsonb_array_elements(v->'ogrenciler') e
   where e->>'id' = zeynep::text;
  if (satir->>'ortalama')::numeric <> 45.00 then
    raise exception '3: öğretmen puanından sonra ortalama %, 45.00 olmalı',
      satir->>'ortalama';
  end if;
  raise notice '3 OK — öğretmen puanı kullanılıyor ((90+0)/2 = 45)';

  -- ---------------------------------------------------------------------------
  -- 4. EN EKSİK KONU, `konu_karnesi` İLE AYNI ŞEYİ SÖYLÜYOR
  --
  -- İki ölçüt ayrışırsa öğretmen aynı öğrenci için iki ekranda iki konu
  -- görür. 0030'un dersi.
  -- ---------------------------------------------------------------------------
  if (satir->>'en_eksik_konu') <> 'Turev' then
    raise exception '4a: en eksik konu %, Turev olmalı', satir->>'en_eksik_konu';
  end if;

  -- İKİ EKRAN AYNI VERİYİ OKUYOR AMA AYNI CÜMLEYİ KURMUYOR — ve bu
  -- bilinçli. `konu_karnesi` ALT SINIRSIZ: orada "Integral 3/3 yanlış"
  -- satırını görmek öğretmenin işine yarıyor. Özet ekranı ise TEK bir
  -- konu adı yazıyor ve öğretmenin kararıyla 5 soru alt sınırı var.
  --
  -- Bu yüzden iddia "ilk satır aynı" DEĞİL — o iddia ilk yazımda
  -- kullanıldı ve haklı olarak kırıldı. Doğru iddia: özetin söylediği
  -- konu, karnenin ALT SINIRI GEÇEN konuları arasındaki İLK konu olmalı.
  -- Böylece iki uç aynı veriyi ve aynı sıralamayı kullanmaya devam
  -- ediyor, yalnız özet listeyi daha erken kesiyor.
  karne := public.konu_karnesi(jt, null, zeynep);
  declare karne_ilk text;
  begin
    select k->>'konu' into karne_ilk
      from jsonb_array_elements(karne->'konular') with ordinality t(k, ord)
     where (k->>'toplam')::int >= 5
     order by ord
     limit 1;
    if karne_ilk is distinct from (satir->>'en_eksik_konu') then
      raise exception '4b: karnenin alt sınırı geçen ilk konusu %, özet % diyor',
        karne_ilk, satir->>'en_eksik_konu';
    end if;
  end;
  raise notice '4 OK — özet, karnenin alt sınırı geçen ilk konusuyla aynı (%)',
    satir->>'en_eksik_konu';

  -- ---------------------------------------------------------------------------
  -- 5. ALT SINIR ISIRIYOR (öğretmenin 3. kararı: en az 5 soru)
  --
  -- "Integral" konusunda 3 soru var ve ÜÇÜ DE YANLIŞ — eksik sayısı
  -- Turev'inkinden (2) fazla. Alt sınır olmasaydı cevap Integral olurdu.
  -- 4. grup zaten Turev diyor; burada Integral'in gerçekten daha eksik
  -- olduğu ayrıca doğrulanıyor, yoksa ölçüm boşa geçerdi.
  -- ---------------------------------------------------------------------------
  declare integral_eksik integer; turev_eksik integer;
  begin
    select ((k->>'toplam')::int - (k->>'dogru')::int) into integral_eksik
      from jsonb_array_elements(karne->'konular') k where k->>'konu' = 'Integral';
    select ((k->>'toplam')::int - (k->>'dogru')::int) into turev_eksik
      from jsonb_array_elements(karne->'konular') k where k->>'konu' = 'Turev';
    if integral_eksik is null or turev_eksik is null then
      raise exception '5a: kurulum bozuk — konular karnede yok';
    end if;
    if integral_eksik <= turev_eksik then
      raise exception '5b: ölçüm boş — Integral (%) Turev''den (%) daha eksik olmalıydı',
        integral_eksik, turev_eksik;
    end if;
    raise notice '5 OK — Integral daha eksik (% > %) ama 3 soruyla alt sınırın altında, seçilmedi',
      integral_eksik, turev_eksik;
  end;

  -- ---------------------------------------------------------------------------
  -- 6. HİÇ YANLIŞI OLMAYAN ÖĞRENCİYE KONU YAZILMIYOR
  --
  -- Ali Ö2'nin onunu da doğru yaptı. "En eksik konu: Turev" yazmak
  -- olmayan bir eksiği isimlendirmek olurdu (öğretmenin dil kuralı:
  -- ÖĞRENCİYİ ETİKETLEME).
  -- ---------------------------------------------------------------------------
  select e into satir from jsonb_array_elements(v->'ogrenciler') e
   where e->>'id' = ali::text;
  if satir->>'en_eksik_konu' is not null then
    raise exception '6a: hiç yanlışı olmayan öğrenciye konu yazıldı (%)',
      satir->>'en_eksik_konu';
  end if;

  select e into satir from jsonb_array_elements(v->'ogrenciler') e
   where e->>'id' = berk::text;
  if satir->>'en_eksik_konu' is not null then
    raise exception '6b: hiç göndermeyen öğrenciye konu yazıldı (%)',
      satir->>'en_eksik_konu';
  end if;
  raise notice '6 OK — yanlışı olmayan ve hiç göndermeyen öğrencide konu boş';

  -- ---------------------------------------------------------------------------
  -- 7. SIRA: SINIF LİSTESİ (okul numarası), numarasız sonda
  -- ---------------------------------------------------------------------------
  select array_agg(e->>'ad' order by ord) into adlar
    from jsonb_array_elements(v->'ogrenciler') with ordinality t(e, ord);
  if adlar <> array['Zeynep Ozet', 'Ali Ozet', 'Berk Ozet'] then
    raise exception '7: sıra %, numaraya göre olmalı', adlar;
  end if;
  raise notice '7 OK — sıra okul numarasına göre, numarasız sonda (%)',
    array_to_string(adlar, ', ');

  -- ---------------------------------------------------------------------------
  -- 8. KAPILAR
  -- ---------------------------------------------------------------------------
  declare patladi boolean; s_bos uuid;
  begin
    patladi := false;
    begin
      perform public.sinif_ogrenci_ozeti(jz, s_12z);   -- öğrenci jetonu
    exception when others then patladi := true;
    end;
    if not patladi then
      raise exception '8a: öğrenci jetonu kabul edildi';
    end if;
    raise notice '8a OK — öğrenci jetonu reddediliyor';

    -- Öğretmenin OLMADIĞI bir sınıf.
    insert into public.siniflar (seviye, sube) values (12, 'Y')
      on conflict (seviye, sube) do update set arsiv = false returning id into s_bos;
    delete from public.ogretmen_siniflari where sinif_id = s_bos;
    patladi := false;
    begin
      perform public.sinif_ogrenci_ozeti(jt, s_bos);
    exception when others then patladi := true;
    end;
    if not patladi then
      raise exception '8b: kapsam dışı sınıf kabul edildi';
    end if;
    raise notice '8b OK — kendi sınıfı olmayan sınıf reddediliyor (42501)';

    -- Arşivdeki sınıf (0016 kuralı).
    insert into public.ogretmen_siniflari (ogretmen_id, sinif_id) values (v_ben, s_bos);
    update public.siniflar set arsiv = true where id = s_bos;
    patladi := false;
    begin
      perform public.sinif_ogrenci_ozeti(jt, s_bos);
    exception when others then patladi := true;
    end;
    if not patladi then
      raise exception '8c: arşivdeki sınıf kabul edildi';
    end if;
    raise notice '8c OK — arşivdeki sınıf reddediliyor';
  end;

  raise notice '';
  raise notice 'SINIF ÖĞRENCİ ÖZETİ TESTLERİ: 8 GRUP GEÇTİ';
end $$;
