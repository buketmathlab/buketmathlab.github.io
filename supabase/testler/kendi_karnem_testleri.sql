-- =============================================================================
-- SEKİZ — 0026 KENDİ KONU KARNEM TESTLERİ
--
-- Öğretmenin isteği: "öğrenci ve veli kendi konu karnesini görsün."
--
-- BU DOSYANIN ASIL SORUSU: çocuğa ve veliye giden karnede, gitmemesi
-- gereken bir şey var mı?
--
-- Dört ayrı sızıntı ölçülüyor ve dördü de ALAN ADI DEĞİL GERÇEK DEĞER
-- arayarak:
--   1. cevap anahtarı (Kural 6)
--   2. başka öğrencinin verisi (ad ve puan)
--   3. sınıf mevcudu / ortalaması — kıyas çağrıştıran her şey
--   4. ödeme (öğretmenin kalıcı kuralı)
--
-- VE DENETİMİN İŞE YARADIĞININ KANITI: aynı değerler ÖĞRETMENİN
-- `konu_karnesi` yanıtında BULUNUYOR. Bulunmasaydı testler, veri hiç
-- yazılmadığı için de geçerdi ve hiçbir şey ölçmezlerdi.
--
-- İZOLASYON: kendi sınıfımızı (6Y) kuruyoruz; toplam sayılara değil kendi
-- öğrencimizin sayılarına bakıyoruz.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text;      -- öğretmen
  jo text;      -- Ada (öğrenci)
  jv text;      -- Ada'nın velisi
  jo2 text;     -- Bora (BAŞKA bir öğrenci)
  v_sinif uuid;
  v_a uuid;     -- Ada
  v_b uuid;     -- Bora
  v_odev uuid;
  v_acik uuid;
  v jsonb;
  vt jsonb;
  n integer;

  -- Anahtarın gerçek şıkları. Karnede BU HARFLER geçmemeli.
  -- Alışılmadık bir dizi seçildi ki metinde tesadüfen bulunmasın.
  c_anahtar jsonb := '{"1":"D","2":"E","3":"D","4":"E"}'::jsonb;

  -- Bora'nın adı ve puanı: Ada'nın karnesinde ikisi de geçmemeli.
  c_bora text := 'Bora Karnesiz';
begin
  -- ---------------------------------------------------------------------------
  -- Hazırlık
  -- ---------------------------------------------------------------------------
  update public.ayarlar
     set ogretmen_pin_hash = extensions.crypt('Karne!2026', extensions.gen_salt('bf', 10))
   where id = 1;
  jt := (public.giris('Karne!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (6, 'Y')
    on conflict (seviye, sube) do update set arsiv = false
    returning id into v_sinif;

  -- ---------------------------------------------------------------------------
  -- ÖNCE TEMİZLİK — DOSYA TEKRAR ÇALIŞTIRILABİLİR OLMALI
  --
  -- Bu satırlar olmadan her koşu 6Y'ye iki ödev daha ekliyordu ve
  -- `odev_sayisi` 2 → 4 → 6 diye büyüyordu. İlk koşu geçiyor, ikincisi
  -- 1b'de kırılıyordu.
  --
  -- BU BENİ BİR KEZ YANILTTI: geri alma kanıtında altı zayıflatmanın
  -- ALTISI DA "yakalandı" göründü, ama hepsi AYNI hatayla (1b) düşüyordu —
  -- yani denetimler değil, biriken veri kırıyordu. Sayım testi ancak temiz
  -- bir zeminde bir şey ölçer.
  delete from public.gonderimler
   where odev_id in (select id from public.odevler where sinif_id = v_sinif);
  delete from public.odevler where sinif_id = v_sinif;

  v_a := (public.ogrenci_ekle(jt, 'Ada Karneli', 'okul', v_sinif))->>'id';
  v_b := (public.ogrenci_ekle(jt, c_bora, 'okul', v_sinif))->>'id';

  jo  := (public.giris((select kod from public.giris_kodlari
                         where ogrenci_id = v_a and rol = 'ogrenci')))->>'token';
  jv  := (public.giris((select kod from public.giris_kodlari
                         where ogrenci_id = v_a and rol = 'veli')))->>'token';
  jo2 := (public.giris((select kod from public.giris_kodlari
                         where ogrenci_id = v_b and rol = 'ogrenci')))->>'token';

  -- SÜRESİ DOLMUŞ, KONULU bir test ödevi. Ada 2 doğru 2 yanlış yapıyor;
  -- Bora hepsini doğru yapıyor (100). İki sayı birbirinden ayrılsın diye.
  v_odev := (public.odev_olustur(jt, 'Kesirler denemesi', null, v_sinif, 'test',
      (current_date - 3)::date, 4, c_anahtar, 'odev/anahtar.pdf',
      'odev/soru.pdf', true, 5::smallint,
      '{"1":"Kesirler","2":"Kesirler","3":"Oran","4":"Oran"}'::jsonb))->>'id';
  perform public.odev_yayinla(jt, v_odev);

  -- İmza: (token, odev, FOTO YOLU, cevaplar) — yol cevaplardan ÖNCE.
  perform public.odev_gonder(jo,  v_odev,
                             'cozum/' || v_odev || '/' || v_a || '.jpg',
                             '{"1":"D","2":"E","3":"A","4":"A"}'::jsonb);
  perform public.odev_gonder(jo2, v_odev,
                             'cozum/' || v_odev || '/' || v_b || '.jpg',
                             c_anahtar);

  -- AÇIK UÇLU bir ödev de olsun: gelişimde görünmeli, konularda görünmemeli.
  v_acik := (public.odev_olustur(jt, 'Kesirler yazılı', null, v_sinif, 'acik',
      (current_date - 2)::date, null, null, null,
      'odev/soru2.pdf', true, null))->>'id';
  perform public.odev_yayinla(jt, v_acik);
  perform public.odev_gonder(jo, v_acik,
                             'cozum/' || v_acik || '/' || v_a || '.jpg', null);
  perform public.acik_puanla(jt, (select id from public.gonderimler
                                   where odev_id = v_acik and ogrenci_id = v_a),
                             70, 'Eline sağlık.');

  -- Özel ders ödemesi: para sızıntısını en sert durumda ölçmek için.
  -- (Ada okul öğrencisi; ödeme okul öğrencisine açılamıyor, o yüzden
  --  ödeme sızıntısı ayrıca 4. grupta alan adıyla ölçülüyor.)

  -- ---------------------------------------------------------------------------
  -- 1 — Öğrenci ve veli KENDİ karnesini görebiliyor
  -- ---------------------------------------------------------------------------
  v := public.kendi_karnem(jo);
  if v->'kapsam'->>'ad' <> 'Ada Karneli' then
    raise exception '1a: karne kendi adıyla gelmedi (%)', v->'kapsam'->>'ad';
  end if;
  if (v->>'odev_sayisi')::integer <> 2 then
    raise exception '1b: 2 değerlendirilmiş ödev beklenirken %', v->>'odev_sayisi';
  end if;
  if jsonb_array_length(v->'konular') <> 2 then
    raise exception '1c: 2 konu beklenirken %', jsonb_array_length(v->'konular');
  end if;

  -- EN ZAYIF KONU BAŞTA. Ada Oran'da 0/2, Kesirler'de 2/2.
  if v->'konular'->0->>'konu' <> 'Oran' then
    raise exception '1d: en zayıf konu başta değil (%)', v->'konular'->0->>'konu';
  end if;

  -- Veli AYNI karneyi görüyor (aynı çocuk).
  if public.kendi_karnem(jv)::text <> v::text then
    raise exception '1e: velinin gördüğü karne öğrencininkinden farklı';
  end if;

  raise notice '1 OK — öğrenci ve veli kendi karnesini görüyor, en zayıf konu başta';

  -- ---------------------------------------------------------------------------
  -- 2 — SIZINTI: CEVAP ANAHTARI (Kural 6)
  --
  -- Alan adı DA gerçek şık DEĞERİ de aranıyor. Anahtar `{"1":"D",…}`
  -- biçiminde; karnede ne bu nesne ne de alan adları geçmeli.
  -- ---------------------------------------------------------------------------
  if v::text ilike '%cevap_anahtari%' or v::text ilike '%anahtar_yolu%' then
    raise exception '2a: karnede cevap anahtarı ALAN ADI geçiyor';
  end if;
  if v::text like '%' || c_anahtar::text || '%' then
    raise exception '2b: karnede anahtarın kendisi geçiyor';
  end if;
  -- Öğrencinin verdiği şıklar da gitmemeli: karne konu dökümüdür, çözüm
  -- karşılaştırması değil (o zaten teslim ekranında var).
  if v::text ilike '%"cevaplar"%' then
    raise exception '2c: karnede cevaplar geçiyor';
  end if;

  -- KANIT: anahtar ÖĞRETMENİN ucunda var mı? `odev_detay` anahtarı
  -- döndürüyor; aramanın çalıştığı böyle gösteriliyor.
  if public.odev_detay(jt, v_odev)::text not like '%' || c_anahtar::text || '%' then
    raise exception '2d: KANIT KIRIK — anahtar öğretmenin ucunda da bulunamadı';
  end if;

  raise notice '2 OK — cevap anahtarı karnede yok, arama çalışıyor (öğretmende var)';

  -- ---------------------------------------------------------------------------
  -- 3 — SIZINTI: BAŞKA ÖĞRENCİNİN VERİSİ VE KIYAS
  --
  -- Bora'nın adı da 100 puanı da Ada'nın karnesinde geçmemeli. Sınıf
  -- mevcudu ve ortalaması da yok: kıyasın en küçük tohumu bile
  -- gönderilmiyor.
  -- ---------------------------------------------------------------------------
  if v::text like '%' || c_bora || '%' then
    raise exception '3a: başka öğrencinin ADI karnede geçiyor';
  end if;
  if v::text ilike '%mevcut%' or v::text ilike '%gonderen%' then
    raise exception '3b: karnede sınıf mevcudu/gönderen sayısı geçiyor';
  end if;
  if v::text ilike '%ortalama%' or v::text ilike '%siralama%' then
    raise exception '3c: karnede ortalama/sıralama geçiyor';
  end if;

  -- Ada'nın kendi puanı 50 (4 sorunun 2'si doğru); Bora'nın 100.
  -- Gelişimde Ada'nın değeri olmalı, Bora'nınki OLMAMALI.
  select count(*) into n from jsonb_array_elements(v->'gelisim') e
   where e->>'odev' = 'Kesirler denemesi' and (e->>'deger')::numeric = 50;
  if n <> 1 then raise exception '3d: kendi puanı gelişimde 50 olarak yok'; end if;

  select count(*) into n from jsonb_array_elements(v->'gelisim') e
   where (e->>'deger')::numeric = 100;
  if n <> 0 then raise exception '3e: başka öğrencinin puanı karneye sızmış'; end if;

  -- Bora kendi karnesine baktığında 100 GÖRÜYOR — yani 3e boş veriyle
  -- geçmedi, sayı gerçekten var ama Ada'nın karnesinde değil.
  select count(*) into n from jsonb_array_elements(public.kendi_karnem(jo2)->'gelisim') e
   where (e->>'deger')::numeric = 100;
  if n <> 1 then
    raise exception '3f: KANIT KIRIK — Bora kendi 100 puanını da görmüyor';
  end if;

  raise notice '3 OK — başka öğrencinin adı/puanı yok, kıyas alanı yok, kanıt sağlam';

  -- ---------------------------------------------------------------------------
  -- 4 — SIZINTI: ÖDEME (öğretmenin kalıcı kuralı)
  -- ---------------------------------------------------------------------------
  if v::text ~* '\m(tutar|odendi|odemeler)\M' then
    raise exception '4a: karnede ödeme alanı geçiyor';
  end if;

  raise notice '4 OK — karnede ödeme bilgisi yok';

  -- ---------------------------------------------------------------------------
  -- 5 — TUTARLILIK: öğretmenin gördüğü karneyle AYNI sayılar
  --
  -- Ayrışırlarsa öğretmen bir çocukla konuşurken ekranında başka bir sayı
  -- görür. İki uç ölçütleri kopyaladığı için bu eşitlik testle bağlanıyor
  -- (0022/0023'teki desen).
  -- ---------------------------------------------------------------------------
  vt := public.konu_karnesi(jt, null, v_a);

  if v->'konular'::text <> vt->'konular'::text then
    raise exception '5a: konu dökümü öğretmeninkinden farklı';
  end if;
  if (v->>'odev_sayisi') <> (vt->>'odev_sayisi') then
    raise exception '5b: ödev sayısı öğretmeninkinden farklı (% / %)',
      v->>'odev_sayisi', vt->>'odev_sayisi';
  end if;

  -- Gelişimde ortak alanlar aynı olmalı; öğretmeninki fazladan `gonderen`
  -- ve `mevcut` taşıyor, o yüzden tamamı değil ortak alanlar ölçülüyor.
  select count(*) into n
    from jsonb_array_elements(v->'gelisim') a,
         jsonb_array_elements(vt->'gelisim') b
   where a->>'odev' = b->>'odev'
     and coalesce(a->>'deger','-') = coalesce(b->>'deger','-')
     and a->>'tarih' = b->>'tarih';
  if n <> jsonb_array_length(v->'gelisim') then
    raise exception '5c: gelişim satırları öğretmeninkiyle eşleşmiyor';
  end if;

  raise notice '5 OK — öğrencinin ve öğretmenin gördüğü sayılar birebir aynı';

  -- ---------------------------------------------------------------------------
  -- 6 — Açık uçlu ödev: gelişimde VAR, konularda YOK
  -- ---------------------------------------------------------------------------
  select count(*) into n from jsonb_array_elements(v->'gelisim') e
   where e->>'odev' = 'Kesirler yazılı' and (e->>'deger')::numeric = 70;
  if n <> 1 then raise exception '6a: açık uçlu ödev gelişimde yok'; end if;

  -- `d.tur = 'test'` SÜZGECİ NORMAL VERİYLE ÖLÇÜLEMİYOR — ölçüldü.
  -- `odev_olustur` açık uçluda `soru_sayisi`'nı null bırakıyor,
  -- `_konu_temizle` de konuları siliyor; yani açık uçlu bir ödev normal
  -- yoldan konu TAŞIYAMIYOR ve süzgeç kaldırılsa bile hiçbir şey değişmiyor.
  -- (Geri alma denemesinde bu süzgeci kaldırdım ve test kırılmadı.)
  --
  -- 0023'te aynı durumda kullanılan yöntem: bozuk veriyi TEST KENDİSİ
  -- üretiyor. Aşağıdaki satır `odev_olustur`'un üretemeyeceği bir kaydı
  -- doğrudan yazıyor; süzgeç kalkarsa 'AcikKonu' dökümde belirir.
  update public.odevler
     set konular = '{"1":"AcikKonu","2":"AcikKonu"}'::jsonb,
         soru_sayisi = 2,
         cevap_anahtari = '{"1":"A","2":"B"}'::jsonb
   where id = v_acik;
  update public.gonderimler set cevaplar = '{"1":"A","2":"C"}'::jsonb
   where odev_id = v_acik and ogrenci_id = v_a;

  v := public.kendi_karnem(jo);
  select count(*) into n from jsonb_array_elements(v->'konular') e
   where e->>'konu' = 'AcikKonu';
  if n <> 0 then
    raise exception '6b: açık uçlu ödevin konusu dökümde belirdi';
  end if;

  -- Ve gelişimde hâlâ var: süzgeç yalnız KONULARI kısıtlıyor, ödevi değil.
  select count(*) into n from jsonb_array_elements(v->'gelisim') e
   where e->>'odev' = 'Kesirler yazılı';
  if n <> 1 then raise exception '6c: açık uçlu ödev gelişimden düştü'; end if;

  raise notice '6 OK — açık uçlu ödev gelişimde var, konu dökümünde yok (bozuk veriyle de)';

  -- ---------------------------------------------------------------------------
  -- 7 — ÖĞRETMEN bu ucu ÇAĞIRAMIYOR
  --
  -- Onun ucu `konu_karnesi`; burada seçilecek bir şey yok ve iki yol
  -- birbirine karışmamalı.
  -- ---------------------------------------------------------------------------
  -- YALNIZ SQLSTATE'E BAKMAK KÖR — ölçüldü. Rol şartını kaldırdığımda
  -- öğretmen bu kez `ogrenci_id is null` duvarına takılıyor ve yine 42501
  -- dönüyordu; test farkı göremiyordu. Türkçe MESAJ da ölçülüyor, çünkü
  -- öğretmene giden şey o (0024'te öğrenilen aynı ders).
  declare mesaj text;
  begin
    begin
      perform public.kendi_karnem(jt);
      raise exception '7a: öğretmen kendi_karnem çağırabildi';
    exception when sqlstate '42501' then
      get stacked diagnostics mesaj = message_text;
      if mesaj not like '%öğrenci ve veli içindir%' then
        raise exception '7b: rol şartı değil başka bir duvar reddetti (%)', mesaj;
      end if;
    end;
  end;

  raise notice '7 OK — öğretmen rol şartıyla reddediliyor (mesaj da doğrulandı)';

  raise notice '';
  raise notice 'KENDİ KONU KARNEM TESTLERİ: 7 GRUP GEÇTİ';
end $$;

-- =============================================================================
-- 8 — KİMLİK ALAN BİR İMZA YOK (yapı gereği güvence)
--
-- `kendi_karnem` bilerek parametresiz. Biri ileride `p_ogrenci_id` eklerse,
-- "başkasının karnesi istenemez" güvencesi YAPIDAN DENETİME düşer — ve o
-- denetim bir gün bir düzenlemede sessizce kaybolabilir. Bu grup o kapıyı
-- kapalı tutuyor (0007 tuzağının kardeşi).
-- =============================================================================
do $$
begin
  if to_regprocedure('public.kendi_karnem(text)') is null then
    raise exception '8a: kendi_karnem yok';
  end if;
  if to_regprocedure('public.kendi_karnem(text, uuid)') is not null then
    raise exception '8b: kimlik alan bir kendi_karnem imzası açılmış';
  end if;

  -- Öğretmenin ucu 0023'teki gibi duruyor mu: imzası değişseydi
  -- 5. gruptaki karşılaştırma sessizce başka bir şeyi ölçerdi.
  if to_regprocedure('public.konu_karnesi(text, uuid, uuid)') is null then
    raise exception '8c: konu_karnesi imzası değişmiş';
  end if;

  raise notice '8 OK — parametresiz tek imza, öğretmenin ucu yerinde';
end $$;
