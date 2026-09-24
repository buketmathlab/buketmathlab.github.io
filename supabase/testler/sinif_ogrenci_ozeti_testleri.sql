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
  -- 0053: alan artık bir DİZİ. Ekran ilkini gösteriyor, kâğıt hepsini;
  -- bu grup ilk elemanı ölçüyor, yani 0052'nin davranışı korunuyor mu.
  if (satir->'eksik_konular'->>0) <> 'Turev' then
    raise exception '4a: ilk eksik konu %, Turev olmalı', satir->'eksik_konular'->>0;
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
    if karne_ilk is distinct from (satir->'eksik_konular'->>0) then
      raise exception '4b: karnenin alt sınırı geçen ilk konusu %, özet % diyor',
        karne_ilk, satir->'eksik_konular'->>0;
    end if;
  end;
  raise notice '4 OK — özet, karnenin alt sınırı geçen ilk konusuyla aynı (%)',
    satir->'eksik_konular'->>0;

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
  -- 0053: "konu yok" artık BOŞ DİZİ, null değil. `jsonb_array_length`
  -- ile sayılıyor — `is not null` yazsaydık boş dizi de "var" sayılır ve
  -- ölçüm ölürdü.
  if jsonb_array_length(satir->'eksik_konular') <> 0 then
    raise exception '6a: hiç yanlışı olmayan öğrenciye konu yazıldı (%)',
      satir->>'eksik_konular';
  end if;

  select e into satir from jsonb_array_elements(v->'ogrenciler') e
   where e->>'id' = berk::text;
  if jsonb_array_length(satir->'eksik_konular') <> 0 then
    raise exception '6b: hiç göndermeyen öğrenciye konu yazıldı (%)',
      satir->>'eksik_konular';
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

  -- ---------------------------------------------------------------------------
  -- 9. YAPILAN / YAPILMAYAN (0052)
  --
  -- Öğretmenin isteği: "verilen kaç tane ödevi yaptıklarını, kaç tanesini
  -- yapmadıkları… göstersin."
  --
  -- Dünyada süresi dolmuş İKİ ödev var (Ö1, Ö2); Ö3 gelecekte ve hiçbir
  -- sayıya girmemeli.
  --   Zeynep: Ö1 gönderdi, Ö2 göndermedi  → 1 yapıldı / 1 yapılmadı
  --   Ali:    Ö2 gönderdi, Ö1 göndermedi  → 1 yapıldı / 1 yapılmadı
  --   Berk:   hiçbirini göndermedi        → 0 yapıldı / 2 yapılmadı
  --
  -- BERK BU GRUBUN AYIRT EDİCİ SATIRI: ikisi yer değiştirse (yapilan ile
  -- yapilmayan karışsa) Zeynep ve Ali'de 1/1 olduğu için hiçbir şey
  -- görünmezdi. 0/2 tersine dönerse görünür.
  --
  -- Zeynep'in Ö1 gönderimi 3. grupta öğretmen puanı aldı; SAYIM PUANA
  -- BAKMIYOR — sıfır alan da ödevi yapmıştır.
  -- ---------------------------------------------------------------------------
  v := public.sinif_ogrenci_ozeti(jt, s_12z);

  select e into satir from jsonb_array_elements(v->'ogrenciler') e
   where e->>'id' = zeynep::text;
  if (satir->>'yapilan')::int <> 1 or (satir->>'yapilmayan')::int <> 1 then
    raise exception '9a: Zeynep % yaptı / % yapmadı, 1/1 olmalı',
      satir->>'yapilan', satir->>'yapilmayan';
  end if;

  select e into satir from jsonb_array_elements(v->'ogrenciler') e
   where e->>'id' = berk::text;
  if (satir->>'yapilan')::int <> 0 or (satir->>'yapilmayan')::int <> 2 then
    raise exception '9b: Berk % yaptı / % yapmadı, 0/2 olmalı',
      satir->>'yapilan', satir->>'yapilmayan';
  end if;
  raise notice '9a OK — yapılan ve yapılmayan elle sayılanla aynı (1/1, 0/2)';

  -- SIFIR ALAN DA ÖDEVİ YAPMIŞTIR — sayım PUANA BAKMIYOR.
  --
  -- BU SATIR BİR PROVA YÜZÜNDEN YAZILDI. "Sayım puana baksın" kusuru
  -- ISIRMADI, çünkü dünyadaki iki gönderimin ikisi de sıfırdan büyük puan
  -- almıştı (90 ve 100). Yani ürünün vaadi ölçülmüyordu: ölçüm ölüydü.
  -- Ali'nin puanı sıfıra çekiliyor; gönderimi duruyor, sayısı değişmemeli.
  --
  -- Ölçmenin ötesinde bir ürün kararı da: sıfır alan çocuğa "yapmadın"
  -- demek gerçeği çarpıtmak olurdu — yaptı, sonucu sıfır çıktı. İkisi
  -- ayrı şey ve ekran ikisini ayrı gösteriyor.
  update public.gonderimler set ogretmen_puan = 0
   where odev_id = o2 and ogrenci_id = ali;

  v := public.sinif_ogrenci_ozeti(jt, s_12z);
  select e into satir from jsonb_array_elements(v->'ogrenciler') e
   where e->>'id' = ali::text;
  if (satir->>'yapilan')::int <> 1 or (satir->>'yapilmayan')::int <> 1 then
    raise exception '9b: sıfır puan alan Ali % yaptı / % yapmadı, 1/1 olmalı',
      satir->>'yapilan', satir->>'yapilmayan';
  end if;
  if (satir->>'ortalama')::numeric <> 0.00 then
    raise exception '9b: Ali ortalaması %, 0.00 olmalı (sıfır aldı)', satir->>'ortalama';
  end if;
  raise notice '9b OK — sıfır alan öğrenci ödevi YAPMIŞ sayılıyor (1/1, ortalama 0)';

  -- TOPLAM TUTUYOR. Ekran üç sayıyı yan yana gösteriyor; biri öbür ikisiyle
  -- toplanmıyorsa öğretmen okuyamaz. Süre kapısı bir gün yalnız birinde
  -- değişirse bu iddia kırılır — asıl işi o.
  declare bozuk text;
  begin
    select string_agg(e->>'ad', ', ') into bozuk
      from jsonb_array_elements(v->'ogrenciler') e
     where (e->>'yapilan')::int + (e->>'yapilmayan')::int <> (e->>'odev_sayisi')::int;
    if bozuk is not null then
      raise exception '9c: yapilan + yapilmayan <> odev_sayisi — %', bozuk;
    end if;
  end;
  raise notice '9c OK — her satırda yapılan + yapılmayan = ödev sayısı';

  -- SÜRESİ DEVAM EDEN ÖDEV "YAPILMADI" SAYILMIYOR. Ö3 sayılsaydı Berk'in
  -- yapılmayanı 3 olurdu ve teslim tarihi gelmemiş bir ödev yüzünden
  -- çocuk bugünden eksik görünürdü.
  select e into satir from jsonb_array_elements(v->'ogrenciler') e
   where e->>'id' = berk::text;
  if (satir->>'yapilmayan')::int <> (satir->>'odev_sayisi')::int then
    raise exception '9d: hiç göndermeyende yapılmayan %, ödev sayısı % olmalı',
      satir->>'yapilmayan', satir->>'odev_sayisi';
  end if;
  raise notice '9d OK — süresi devam eden ödev yapılmadı sayılmıyor';

  -- ---------------------------------------------------------------------------
  -- 10. EKSİK KONULAR LİSTESİ (0053): sıra doğru, tavan 3
  --
  -- Öğretmenin isteği (yazdırma turu): veliye verilen fişte "eksik olduğu
  -- konu BAŞLIKLARI" yazsın — çoğul.
  --
  -- DÜNYAYA DÖRDÜNCÜ BİR ÖDEV EKLENİYOR. Sebebi ölçülebilirlik: o ana
  -- kadar Zeynep'in alt sınırı geçen TEK konusu var (Turev). Tek elemanlı
  -- bir listeyle ne sıralama ne de "en fazla 3" ölçülebilirdi — iddia
  -- kırılamazdı, yani hiçbir şey kanıtlamazdı.
  --
  -- Ö4: 20 soru, dört konu, her konuda 5 soru. Zeynep'in yanlışları
  -- bilerek kademeli:
  --   Yamuk Alani  5 yanlış    Oran Oranti   4 yanlış
  --   Bolunebilme  3 yanlış    Asal Sayilar  2 yanlış
  -- Turev zaten 2 eksikte. Sıra: Yamuk(5) > Oran(4) > Bolunebilme(3)
  -- > {Asal, Turev}(2). Tavan 3 çalışıyorsa ilk üçü gelir.
  --
  -- KONU ADLARI BİLEREK ALFABETİK SIRAYA TERS. İlk yazımda adlar
  -- Carpanlar/Denklem/Esitsizlik idi ve eksik sırası ile alfabetik sıra
  -- AYNI düşüyordu; "sıralama ada göre yapılsın" kusuru ISIRMADI, yani
  -- sıralama hiç ölçülmüyordu. 7. gruptaki numara/alfabe ayrımının
  -- aynı gerekçesi.
  -- ---------------------------------------------------------------------------
  declare o4 uuid; konular text[]; aday integer;
  begin
    o4 := (public.odev_olustur(jt, 'Ozet Odev Dort', null, s_12z, 'test',
            (current_date + 30), 20,
            ('{' || (select string_agg(format('"%s":"A"', i), ',')
                       from generate_series(1, 20) i) || '}')::jsonb,
            null, null, true, 5::smallint,
            '{"1":"Yamuk Alani","2":"Yamuk Alani","3":"Yamuk Alani","4":"Yamuk Alani","5":"Yamuk Alani",
              "6":"Oran Oranti","7":"Oran Oranti","8":"Oran Oranti","9":"Oran Oranti","10":"Oran Oranti",
              "11":"Bolunebilme","12":"Bolunebilme","13":"Bolunebilme","14":"Bolunebilme","15":"Bolunebilme",
              "16":"Asal Sayilar","17":"Asal Sayilar","18":"Asal Sayilar","19":"Asal Sayilar","20":"Asal Sayilar"}'::jsonb
          ))->>'id';
    perform public.odev_yayinla(jt, o4);

    -- Önce gönder, sonra süreyi doldur (dünyanın kurulumundaki gerekçe).
    perform public.odev_gonder(jz, o4, 'cozum/' || o4 || '/' || zeynep || '.jpg',
      '{"1":"B","2":"B","3":"B","4":"B","5":"B",
        "6":"B","7":"B","8":"B","9":"B","10":"A",
        "11":"B","12":"B","13":"B","14":"A","15":"A",
        "16":"B","17":"B","18":"A","19":"A","20":"A"}'::jsonb);
    update public.odevler set son_tarih = current_date - 3 where id = o4;

    v := public.sinif_ogrenci_ozeti(jt, s_12z);
    select e into satir from jsonb_array_elements(v->'ogrenciler') e
     where e->>'id' = zeynep::text;

    select array_agg(k #>> '{}' order by ord) into konular
      from jsonb_array_elements(satir->'eksik_konular') with ordinality t(k, ord);

    -- Alfabetik sıra bunun TERSİ olurdu (Asal, Bolunebilme, Oran) — iddia
    -- hem seçimi hem sırayı ölçüyor.
    if konular <> array['Yamuk Alani', 'Oran Oranti', 'Bolunebilme'] then
      raise exception '10a: eksik konular %, {Yamuk Alani,Oran Oranti,Bolunebilme} olmalı', konular;
    end if;
    raise notice '10a OK — konular en eksikten sıralı (%)', array_to_string(konular, ', ');

    -- TAVANIN GERÇEKTEN ISIRDIĞININ KANITI: alt sınırı geçen ve yanlışı
    -- olan konu sayısı 3'ten FAZLA olmalı. Olmasaydı "3 tane döndü"
    -- sonucu tavandan değil, adayların azlığından gelirdi ve ölçüm boş
    -- geçerdi (5. grubun deseninin aynısı).
    karne := public.konu_karnesi(jt, null, zeynep);
    select count(*) into aday
      from jsonb_array_elements(karne->'konular') k
     where (k->>'toplam')::int >= 5
       and ((k->>'toplam')::int - (k->>'dogru')::int) > 0;
    if aday <= 3 then
      raise exception '10b: ölçüm boş — aday konu sayısı %, 3''ten fazla olmalıydı', aday;
    end if;
    raise notice '10b OK — % aday konu var, liste 3''te kesiliyor', aday;
  end;

  raise notice '';
  raise notice 'SINIF ÖĞRENCİ ÖZETİ TESTLERİ: 10 GRUP GEÇTİ';
end $$;
