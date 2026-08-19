-- =============================================================================
-- SEKİZ — 0025 İKİ AYRI YAZIŞMA TESTLERİ
--
-- Öğretmenin kuralı: "Mesajlar kısmında öğrenci öğretmenle, veli öğretmenle
-- olacak şekilde."
--
-- Bu dosyanın ASIL SORUSU tek bir şey: çocuk, velisinin öğretmenle
-- yazdıklarını okuyabiliyor mu? ("Ali son zamanlarda çok tembelleşti, ne
-- yapmalıyız?" cümlesini bir çocuğun okuması geri alınamaz bir şey.)
--
-- ÖLÇME BİÇİMİ — alan adı denetimi DEĞİL, GERÇEK METİN. Cevap anahtarı
-- testindeki desenin aynısı: yanıtın tamamı metne çevrilip içinde karşı
-- tarafın cümlesi aranıyor. Alan adına bakmak, metnin başka bir alanda
-- (örneğin 'son_mesaj') sızmasını kaçırırdı.
--
-- VE DENETİMİN İŞE YARADIĞININ KANITI: aynı cümle ÖĞRETMENİN doğru
-- kanalında BULUNUYOR. Bulunmasaydı test, veri hiç yazılmadığı için de
-- geçerdi ve hiçbir şey ölçmezdi.
--
-- İZOLASYON: kendi sınıfımızı (5Y) kuruyoruz. Süit tek veritabanında
-- çalışıyor; toplam sayılara değil, KENDİ ÖĞRENCİMİZİN sayılarına ve
-- delta'lara bakıyoruz.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text;      -- öğretmen
  jv text;      -- Ada'nın velisi
  jo text;      -- Ada (öğrenci)
  jo2 text;     -- Bora (başka bir öğrenci)
  v_sinif uuid;
  v_a uuid;     -- Ada
  v_b uuid;     -- Bora
  v jsonb;
  n integer;
  n0 integer;
  -- Zamanı test kendisi kuruyor: now() işlem başlangıç zamanıdır ve bu DO
  -- bloğunun tamamı tek işlem. Okuma damgasıyla mesaj aynı ana düşerse
  -- "okuduktan sonra gelen mesaj" hiç oluşmaz (0019'da öğrenilen tuzak).
  t0 timestamptz := clock_timestamp() - interval '1 day';
  adim integer := 0;

  -- İki ayırt edici cümle. Kısa ve başka hiçbir testte geçmeyen kelimeler
  -- seçildi ki metin aramasında yanlış eşleşme olmasın.
  c_veli    text := 'VELIDENGELEN kalemtiras meselesi';
  c_ogrenci text := 'OGRENCIDENGELEN zeytinagaci meselesi';
begin
  -- ---------------------------------------------------------------------------
  -- Hazırlık
  -- ---------------------------------------------------------------------------
  update public.ayarlar
     set ogretmen_pin_hash = extensions.crypt('Kanal!2026', extensions.gen_salt('bf', 10))
   where id = 1;
  jt := (public.giris('Kanal!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (5, 'Y')
    on conflict (seviye, sube) do update set arsiv = false
    returning id into v_sinif;

  v_a := (public.ogrenci_ekle(jt, 'Ada Kanalcı', 'okul', v_sinif))->>'id';
  v_b := (public.ogrenci_ekle(jt, 'Bora Kanalcı', 'okul', v_sinif))->>'id';

  jv  := (public.giris((select kod from public.giris_kodlari
                         where ogrenci_id = v_a and rol = 'veli')))->>'token';
  jo  := (public.giris((select kod from public.giris_kodlari
                         where ogrenci_id = v_a and rol = 'ogrenci')))->>'token';
  jo2 := (public.giris((select kod from public.giris_kodlari
                         where ogrenci_id = v_b and rol = 'ogrenci')))->>'token';

  -- ---------------------------------------------------------------------------
  -- 1 — Öğrenci artık YAZABİLİYOR, ve yazdığı kendi kanalına düşüyor
  --
  -- 0019'a kadar `mesaj_gonder` öğrenciyi 42501 ile reddediyordu. Bu turun
  -- açtığı kapı bu; açıldığını ölçmeden sızıntıyı ölçmenin anlamı yok.
  -- ---------------------------------------------------------------------------
  adim := adim + 1;
  perform public.mesaj_gonder(jo, c_ogrenci);
  update public.mesajlar set created_at = t0 + (adim * interval '1 minute')
   where ogrenci_id = v_a and created_at = now();

  adim := adim + 1;
  perform public.mesaj_gonder(jv, c_veli);
  update public.mesajlar set created_at = t0 + (adim * interval '1 minute')
   where ogrenci_id = v_a and created_at = now();

  select count(*) into n from public.mesajlar
   where ogrenci_id = v_a and kanal = 'ogrenci' and kimden = 'ogrenci';
  if n <> 1 then raise exception '1a: öğrencinin mesajı kendi kanalına yazılmadı'; end if;

  select count(*) into n from public.mesajlar
   where ogrenci_id = v_a and kanal = 'veli' and kimden = 'veli';
  if n <> 1 then raise exception '1b: velinin mesajı veli kanalına yazılmadı'; end if;

  raise notice '1 OK — öğrenci yazabiliyor, iki mesaj iki ayrı kanala düştü';

  -- ---------------------------------------------------------------------------
  -- 2 — SIZINTI. Bu dosyanın varlık sebebi.
  -- ---------------------------------------------------------------------------

  -- 2a — ÖĞRENCİ velinin cümlesini HİÇBİR yerinde görmüyor
  v := public.ogrenci_mesajlari(jo);
  if v::text like '%' || c_veli || '%' then
    raise exception '2a: ÖĞRENCİ velisinin öğretmene yazdığını okuyabiliyor';
  end if;
  -- Kendi cümlesini ise görüyor olmalı; görmüyorsa 2a boş veriyle geçerdi.
  if v::text not like '%' || c_ogrenci || '%' then
    raise exception '2b: öğrenci kendi mesajını göremiyor — 2a hiçbir şey ölçmedi';
  end if;

  -- 2c — Öğrencinin ödev ekranı da (rozet sayısı taşıyor) metin sızdırmıyor
  v := public.ogrenci_odevleri(jo);
  if v::text like '%' || c_veli || '%' then
    raise exception '2c: veli mesajı öğrencinin ödev ekranına sızıyor';
  end if;

  -- 2d — VELİ öğrencinin cümlesini görmüyor
  v := public.veli_paneli(jv);
  if v::text like '%' || c_ogrenci || '%' then
    raise exception '2d: VELİ çocuğunun öğretmene yazdığını okuyabiliyor';
  end if;
  if v::text not like '%' || c_veli || '%' then
    raise exception '2e: veli kendi mesajını göremiyor — 2d hiçbir şey ölçmedi';
  end if;

  -- 2f — DENETİMİN İŞE YARADIĞI KANITI: iki cümle de ÖĞRETMENDE, ama
  -- her biri yalnız KENDİ kanalında. Veri hiç yazılmasaydı 2a ve 2d de
  -- geçerdi; bu blok o ihtimali kapatıyor.
  v := public.mesajlar_ogretmen(jt, v_a, 'veli');
  if v::text not like '%' || c_veli || '%' then
    raise exception '2f: velinin mesajı öğretmenin veli kanalında yok';
  end if;
  if v::text like '%' || c_ogrenci || '%' then
    raise exception '2g: öğrencinin mesajı öğretmenin VELİ kanalında görünüyor';
  end if;

  v := public.mesajlar_ogretmen(jt, v_a, 'ogrenci');
  if v::text not like '%' || c_ogrenci || '%' then
    raise exception '2h: öğrencinin mesajı öğretmenin öğrenci kanalında yok';
  end if;
  if v::text like '%' || c_veli || '%' then
    raise exception '2i: velinin mesajı öğretmenin ÖĞRENCİ kanalında görünüyor';
  end if;

  raise notice '2 OK — SIZINTI YOK: iki cümle de yalnız kendi kanalında, öğretmende ikisi de var';

  -- ---------------------------------------------------------------------------
  -- 3 — Rol kanalı belirliyor: parametreyle karşı kanala geçilemiyor
  --
  -- Veli `p_kanal='ogrenci'` diyerek çocuğunun yazışmasına giremez; öğrenci
  -- de velisininkine. Sunucu parametreyi YOK SAYIYOR (hata vermiyor: veli
  -- zaten böyle bir istekte bulunmuyor, bulunsa da doğru yere yazılıyor).
  -- ---------------------------------------------------------------------------
  adim := adim + 1;
  perform public.mesaj_gonder(jv, 'Veli kanal atlamayi deniyor.', v_b, 'ogrenci');
  update public.mesajlar set created_at = t0 + (adim * interval '1 minute')
   where ogrenci_id = v_a and created_at = now();

  select count(*) into n from public.mesajlar
   where ogrenci_id = v_a and kanal = 'ogrenci' and metin like 'Veli kanal%';
  if n <> 0 then raise exception '3a: veli parametreyle öğrenci kanalına yazabildi'; end if;
  select count(*) into n from public.mesajlar
   where ogrenci_id = v_a and kanal = 'veli' and metin like 'Veli kanal%';
  if n <> 1 then raise exception '3b: velinin mesajı kendi kanalına yazılmadı'; end if;

  -- Aynı çağrıda `p_ogrenci_id = v_b` da verildi: veli BAŞKA bir öğrencinin
  -- yazışmasına da geçememeli.
  select count(*) into n from public.mesajlar where ogrenci_id = v_b;
  if n <> 0 then raise exception '3c: veli başka öğrencinin yazışmasına yazabildi'; end if;

  adim := adim + 1;
  perform public.mesaj_gonder(jo, 'Ogrenci kanal atlamayi deniyor.', v_b, 'veli');
  update public.mesajlar set created_at = t0 + (adim * interval '1 minute')
   where ogrenci_id = v_a and created_at = now();

  select count(*) into n from public.mesajlar
   where ogrenci_id = v_a and kanal = 'veli' and metin like 'Ogrenci kanal%';
  if n <> 0 then raise exception '3d: öğrenci parametreyle veli kanalına yazabildi'; end if;
  select count(*) into n from public.mesajlar
   where ogrenci_id = v_a and kanal = 'ogrenci' and metin like 'Ogrenci kanal%';
  if n <> 1 then raise exception '3e: öğrencinin mesajı kendi kanalına yazılmadı'; end if;

  -- Öğretmen ise geçersiz kanal veremiyor — o seçebildiği için denetleniyor.
  begin
    perform public.mesaj_gonder(jt, 'Gecersiz kanal.', v_a, 'mudur');
    raise exception '3f: öğretmen geçersiz kanala yazabildi';
  exception when sqlstate '22023' then null;
  end;

  raise notice '3 OK — rol kanalı belirliyor, parametre karşı kanala geçirmiyor';

  -- ---------------------------------------------------------------------------
  -- 4 — OKUMA İŞARETİ KANAL BAŞINA
  --
  -- `okundu` anahtarına `kanal` eklenmesinin ASIL SEBEBİ bu. Tek satır
  -- kalsaydı öğretmen veli yazışmasını okuduğunda öğrencinin mesajı da
  -- okunmuş sayılırdı ve ÇOCUĞUN MESAJI SESSİZCE KAYBOLURDU.
  -- ---------------------------------------------------------------------------
  select count(*) into n from jsonb_array_elements(
      public.ogrenci_yazismalari(jt)->'yanit_bekleyen') e
   where (e->>'ogrenci_id')::uuid = v_a;
  if n <> 1 then raise exception '4a: öğrencinin mesajı yanıt bekleyenlerde yok'; end if;

  -- Öğretmen YALNIZ veli yazışmasını okuyor.
  adim := adim + 1;
  perform public.ogretmen_okudu(jt, v_a, 'veli');
  update public.okundu set zaman = t0 + (adim * interval '1 minute')
   where ogrenci_id = v_a and rol = 'ogretmen' and kanal = 'veli';

  select count(*) into n from jsonb_array_elements(
      public.veliler_listesi(jt)->'yanit_bekleyen') e
   where (e->>'ogrenci_id')::uuid = v_a;
  if n <> 0 then raise exception '4b: veli yazışması okundu ama hâlâ bekliyor'; end if;

  -- ASIL ÖLÇÜM: öğrenci yazışması OKUNMAMIŞ kalmalı.
  select count(*) into n from jsonb_array_elements(
      public.ogrenci_yazismalari(jt)->'yanit_bekleyen') e
   where (e->>'ogrenci_id')::uuid = v_a;
  if n <> 1 then
    raise exception '4c: veli yazışmasını okumak ÖĞRENCİ yazışmasını da okunmuş saydı';
  end if;

  -- Şimdi öğrenci yazışması da okunuyor: ikisi de düşmeli.
  adim := adim + 1;
  perform public.ogretmen_okudu(jt, v_a, 'ogrenci');
  update public.okundu set zaman = t0 + (adim * interval '1 minute')
   where ogrenci_id = v_a and rol = 'ogretmen' and kanal = 'ogrenci';

  select count(*) into n from jsonb_array_elements(
      public.ogrenci_yazismalari(jt)->'yanit_bekleyen') e
   where (e->>'ogrenci_id')::uuid = v_a;
  if n <> 0 then raise exception '4d: öğrenci yazışması okundu ama hâlâ bekliyor'; end if;

  -- Öğretmenin bu öğrenci için İKİ ayrı okuma satırı olmalı.
  select count(*) into n from public.okundu
   where ogrenci_id = v_a and rol = 'ogretmen';
  if n <> 2 then
    raise exception '4e: öğretmenin iki kanal için iki satırı olmalıydı, % satır var', n;
  end if;

  raise notice '4 OK — okuma işareti kanal başına; bir kanalı okumak diğerini okunmuş saymıyor';

  -- ---------------------------------------------------------------------------
  -- 5 — Veli ve öğrencinin kendi okuma işaretleri de ayrı
  --
  -- `okundu_isaretle` imzası değişmedi; kanalı ROLDEN türetiyor. Aynı
  -- öğrenci için veli satırı ve öğrenci satırı birbirini ezmemeli.
  -- ---------------------------------------------------------------------------
  adim := adim + 1;
  perform public.okundu_isaretle(jv);
  perform public.okundu_isaretle(jo);
  -- OKUMA DAMGASI DA KENDİ ZAMAN ÇİZGİMİZE ÇEKİLMELİ. `okundu_isaretle`
  -- now() yazıyor; now() işlem BAŞLANGIÇ zamanı olduğu için t0'dan bir gün
  -- ileride kalıyor ve sonraki gruplarda gönderilen mesaj "okumadan önce
  -- gelmiş" sayılıp okunmamış listesine hiç girmiyor. (6c bu yüzden bir kez
  -- kırıldı — testin kendi hatasıydı, ürünün değil.)
  update public.okundu set zaman = t0 + (adim * interval '1 minute')
   where ogrenci_id = v_a and rol in ('veli', 'ogrenci');

  select count(*) into n from public.okundu
   where ogrenci_id = v_a and rol = 'veli' and kanal = 'veli';
  if n <> 1 then raise exception '5a: velinin okuma satırı yok'; end if;
  select count(*) into n from public.okundu
   where ogrenci_id = v_a and rol = 'ogrenci' and kanal = 'ogrenci';
  if n <> 1 then raise exception '5b: öğrencinin okuma satırı yok'; end if;

  -- Veli okuma satırı öğrenci kanalına düşmemeli (ve tersi).
  select count(*) into n from public.okundu
   where ogrenci_id = v_a and rol = 'veli' and kanal = 'ogrenci';
  if n <> 0 then raise exception '5c: velinin okuması öğrenci kanalına yazıldı'; end if;

  raise notice '5 OK — veli ve öğrencinin okuma işaretleri ayrı satırlarda';

  -- ---------------------------------------------------------------------------
  -- 6 — Öğretmenin yazdığı iki mesaj, iki ayrı tarafa
  -- ---------------------------------------------------------------------------
  adim := adim + 1;
  perform public.mesaj_gonder(jt, 'Veliye ozel not.', v_a, 'veli');
  update public.mesajlar set created_at = t0 + (adim * interval '1 minute')
   where ogrenci_id = v_a and created_at = now();

  adim := adim + 1;
  perform public.mesaj_gonder(jt, 'Ogrenciye ozel not.', v_a, 'ogrenci');
  update public.mesajlar set created_at = t0 + (adim * interval '1 minute')
   where ogrenci_id = v_a and created_at = now();

  v := public.veli_paneli(jv);
  if v::text not like '%Veliye ozel not%' then
    raise exception '6a: öğretmenin veliye yazdığı veliye ulaşmadı';
  end if;
  if v::text like '%Ogrenciye ozel not%' then
    raise exception '6b: öğretmenin öğrenciye yazdığı VELİYE de gitti';
  end if;
  if (v->>'okunmamis_mesaj')::int <> 1 then
    raise exception '6c: velinin okunmamış sayısı 1 olmalıydı, %', v->>'okunmamis_mesaj';
  end if;

  v := public.ogrenci_mesajlari(jo);
  if v::text not like '%Ogrenciye ozel not%' then
    raise exception '6d: öğretmenin öğrenciye yazdığı öğrenciye ulaşmadı';
  end if;
  if v::text like '%Veliye ozel not%' then
    raise exception '6e: öğretmenin veliye yazdığı ÖĞRENCİYE de gitti';
  end if;
  if (public.ogrenci_odevleri(jo)->>'okunmamis_mesaj')::int <> 1 then
    raise exception '6f: öğrencinin okunmamış rozeti 1 olmalıydı';
  end if;

  raise notice '6 OK — öğretmenin iki mesajı iki ayrı tarafa gitti, karışmadı';

  -- ---------------------------------------------------------------------------
  -- 7 — Öğrenci başkasının yazışmasına giremiyor
  -- ---------------------------------------------------------------------------
  v := public.ogrenci_mesajlari(jo2);   -- Bora
  if v::text like '%' || c_ogrenci || '%' or v::text like '%ozel not%' then
    raise exception '7a: öğrenci başka öğrencinin yazışmasını görüyor';
  end if;
  if jsonb_array_length(v->'mesajlar') <> 0 then
    raise exception '7b: hiç mesajı olmayan öğrencide mesaj göründü';
  end if;

  raise notice '7 OK — öğrenci yalnız kendi yazışmasını görüyor';

  -- ---------------------------------------------------------------------------
  -- 8 — ÖĞRETMEN UÇLARI ÖĞRENCİ VE VELİYE KAPALI
  -- ---------------------------------------------------------------------------
  begin
    perform public.ogrenci_yazismalari(jo);
    raise exception '8a: öğrenci ogrenci_yazismalari çağırabildi';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.ogrenci_yazismalari(jv);
    raise exception '8b: veli ogrenci_yazismalari çağırabildi';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.mesajlar_ogretmen(jo, v_a, 'ogrenci');
    raise exception '8c: öğrenci mesajlar_ogretmen çağırabildi';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.ogretmen_okudu(jv, v_a, 'veli');
    raise exception '8d: veli ogretmen_okudu çağırabildi';
  exception when sqlstate '42501' then null;
  end;
  -- Veli ve öğretmen `ogrenci_mesajlari`'nı çağıramıyor: uç yalnız öğrenci
  -- rolüne açık.
  begin
    perform public.ogrenci_mesajlari(jv);
    raise exception '8e: veli ogrenci_mesajlari çağırabildi';
  exception when sqlstate '42501' then null;
  end;

  raise notice '8 OK — öğretmen uçları öğrenci ve veliye kapalı, öğrenci ucu de veliye';

  -- ---------------------------------------------------------------------------
  -- 9 — ogrenci_yazismalari MESAJ METNİ TAŞIMIYOR
  --
  -- Kod listesindeki ve veli listesindeki kuralın aynısı: ortak bir ekranda
  -- bütün öğrencilerin yazdıkları yan yana görünmesin.
  -- ---------------------------------------------------------------------------
  -- Önce yeniden okunmamış duruma getir ki liste dolu olsun.
  adim := adim + 1;
  perform public.mesaj_gonder(jo, 'Listede gorunmemesi gereken cumle.');
  update public.mesajlar set created_at = t0 + (adim * interval '1 minute')
   where ogrenci_id = v_a and created_at = now();

  v := public.ogrenci_yazismalari(jt);
  if v::text like '%gorunmemesi gereken%' or v::text like '%' || c_ogrenci || '%' then
    raise exception '9a: ogrenci_yazismalari mesaj metni taşıyor';
  end if;
  select count(*) into n from jsonb_array_elements(v->'yanit_bekleyen') e
   where (e->>'ogrenci_id')::uuid = v_a and (e->>'okunmamis')::integer = 1;
  if n <> 1 then raise exception '9b: öğrenci 1 okunmamışla listede değil'; end if;

  raise notice '9 OK — öğretmenin öğrenci listesi sayı taşıyor, metin taşımıyor';

  -- ---------------------------------------------------------------------------
  -- 10 — bildirim_sayilari İKİ KANALI DA sayıyor
  --
  -- Tek rozet, iki yazışma (öğretmenin kararı). Delta ölçülüyor: süit tek
  -- veritabanında çalışıyor, mutlak sayı başka dosyaların verisini de
  -- kapsar.
  -- ---------------------------------------------------------------------------
  n0 := (public.bildirim_sayilari(jt)->>'okunmamis_mesaj')::int;

  adim := adim + 1;
  perform public.mesaj_gonder(jv, 'Veliden yeni bir mesaj.');
  update public.mesajlar set created_at = t0 + (adim * interval '1 minute')
   where ogrenci_id = v_a and created_at = now();

  n := (public.bildirim_sayilari(jt)->>'okunmamis_mesaj')::int;
  if n <> n0 + 1 then
    raise exception '10a: veli mesajı rozeti artırmadı (% → %)', n0, n;
  end if;

  -- Öğretmen veli kanalını okuyunca YALNIZ o düşmeli; öğrenci kanalındaki
  -- (9'daki) mesaj rozette kalmalı.
  adim := adim + 1;
  perform public.ogretmen_okudu(jt, v_a, 'veli');
  update public.okundu set zaman = t0 + (adim * interval '1 minute')
   where ogrenci_id = v_a and rol = 'ogretmen' and kanal = 'veli';

  n := (public.bildirim_sayilari(jt)->>'okunmamis_mesaj')::int;
  if n <> n0 then
    raise exception '10b: veli kanalı okunduktan sonra rozet %0 olmalıydı, %', n0, n;
  end if;

  -- Öğrenci kanalı da okununca 9'daki mesaj da düşmeli.
  adim := adim + 1;
  perform public.ogretmen_okudu(jt, v_a, 'ogrenci');
  update public.okundu set zaman = t0 + (adim * interval '1 minute')
   where ogrenci_id = v_a and rol = 'ogretmen' and kanal = 'ogrenci';

  n := (public.bildirim_sayilari(jt)->>'okunmamis_mesaj')::int;
  if n <> n0 - 1 then
    raise exception '10c: öğrenci kanalı okununca rozet düşmedi (% beklenirken %)',
      n0 - 1, n;
  end if;

  raise notice '10 OK — rozet iki kanalı da sayıyor, kanal başına düşüyor';

  raise notice '';
  raise notice 'İKİ AYRI YAZIŞMA TESTLERİ: 10 GRUP GEÇTİ';
end $$;

-- =============================================================================
-- 11 — ESKİ İMZALAR GERÇEKTEN DÜŞTÜ MÜ (0007 TUZAĞI)
--
-- PostgreSQL'de parametre eklemek YENİ bir fonksiyon üretir; eski imza
-- EXECUTE yetkisiyle birlikte ayakta kalır. Kanalsız `mesaj_gonder` ayakta
-- kalsaydı, arayüz onu çağırdığında mesaj VARSAYILAN kanala düşerdi —
-- öğrencinin yazdığı, velisinin yazışmasına.
-- =============================================================================
do $$
begin
  if to_regprocedure('public.mesaj_gonder(text, text, uuid)') is not null then
    raise exception '11a: kanalsız mesaj_gonder imzası hâlâ ayakta';
  end if;
  if to_regprocedure('public.ogretmen_okudu(text, uuid)') is not null then
    raise exception '11b: kanalsız ogretmen_okudu imzası hâlâ ayakta';
  end if;
  if to_regprocedure('public.mesajlar_ogretmen(text, uuid)') is not null then
    raise exception '11c: kanalsız mesajlar_ogretmen imzası hâlâ ayakta';
  end if;

  -- Yenileri gerçekten var mı
  if to_regprocedure('public.mesaj_gonder(text, text, uuid, text)') is null then
    raise exception '11d: yeni mesaj_gonder yok';
  end if;
  if to_regprocedure('public.ogrenci_mesajlari(text)') is null then
    raise exception '11e: ogrenci_mesajlari yok';
  end if;
  if to_regprocedure('public.ogrenci_yazismalari(text)') is null then
    raise exception '11f: ogrenci_yazismalari yok';
  end if;

  raise notice '11 OK — eski üç imza düştü, yeni uçlar yerinde';
end $$;

-- =============================================================================
-- 12 — ŞEMA GARANTİSİ
--
-- Sınır arayüzde değil TABLODA. Bu grup onu doğruluyor.
-- =============================================================================
do $$
declare n integer;
begin
  -- `okundu` birincil anahtarı üç sütunlu olmalı
  select count(*) into n
    from pg_constraint c
   where c.conrelid = 'public.okundu'::regclass and c.contype = 'p'
     and (select count(*) from unnest(c.conkey)) = 3;
  if n <> 1 then
    raise exception '12a: okundu birincil anahtarı üç sütunlu değil';
  end if;

  -- `kanal` kısıtı iki değerle sınırlı
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.mesajlar'::regclass
                    and conname = 'mesajlar_kanal_check') then
    raise exception '12b: mesajlar_kanal_check yok';
  end if;

  -- Doğrudan yazma denemesi: geçersiz kanal şema tarafından reddedilmeli.
  -- Fonksiyon denetimi kalksa bile bu duvar duruyor mu, ölçülen bu.
  begin
    insert into public.mesajlar (ogrenci_id, kimden, metin, kanal)
    select id, 'ogretmen', 'sema denemesi', 'mudur'
      from public.ogrenciler limit 1;
    raise exception '12c: geçersiz kanal şemaya yazılabildi';
  exception when check_violation then null;
  end;

  -- `kimden` artık öğrenciyi de kabul ediyor olmalı
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.mesajlar'::regclass
                    and conname = 'mesajlar_kimden_check'
                    and pg_get_constraintdef(oid) like '%ogrenci%') then
    raise exception '12d: kimden kısıtı öğrenciyi kapsamıyor';
  end if;

  -- Hiçbir mesaj kanalsız kalmamalı
  if exists (select 1 from public.mesajlar where kanal is null) then
    raise exception '12e: kanalsız mesaj var';
  end if;

  raise notice '12 OK — sınır şemada: üç sütunlu anahtar, kanal kısıtı, kanalsız satır yok';
end $$;

-- =============================================================================
-- 13 — YEDEK HER İKİ YAZIŞMAYI DA TAŞIYOR
--
-- `disa_aktar` satırın tamamını `to_jsonb(m)` ile alıyor, yani `kanal`
-- kendiliğinden yedeğe giriyor. "Kendiliğinden" bir iddiadır; ölçülüyor.
-- Yedek eksik olsaydı geri yükleme iki yazışmayı tek yığına indirirdi.
-- =============================================================================
do $$
declare
  jt text;
  y jsonb;
begin
  jt := (public.giris('Kanal!2026'))->>'token';
  y := public.disa_aktar(jt);

  if not (y::text like '%"kanal": "ogrenci"%' or y::text like '%"kanal":"ogrenci"%') then
    raise exception '13a: yedekte öğrenci kanalı yok';
  end if;
  if not (y::text like '%"kanal": "veli"%' or y::text like '%"kanal":"veli"%') then
    raise exception '13b: yedekte veli kanalı yok';
  end if;

  raise notice '13 OK — yedek iki yazışmayı da kanal bilgisiyle taşıyor';
end $$;

-- =============================================================================
-- 14 — İKİNCİ KATMAN: LİSTELER `kimden`'e DEĞİL `kanal`'a BAKIYOR
--
-- NEDEN AYRI BİR GRUP GEREKTİ. Geri alma denemesinde `veliler_listesi`'nin
-- `and m.kanal = 'veli'` süzgecini kaldırdım ve HİÇBİR test kırılmadı.
-- Sebep ölçüldü: alt sorguda zaten `m.kimden = 'veli'` var ve `mesaj_gonder`
-- veliyi her zaman veli kanalına yazdırdığı için bugün ikisi hep birlikte
-- geliyor. Yani süzgeç bugünkü veriyle ÖLÇÜLEMİYOR.
--
-- Ama redundant değil: (kimden, kanal) ikilisini şema BAĞLAMIYOR. Yedekten
-- geri yükleme, elle bir düzeltme ya da ileride yazılacak bir uç eşleşmeyen
-- satır üretebilir. O gün `mesaj_gonder`'deki tek kapı düşerse, bu süzgeç
-- ikinci duvar oluyor.
--
-- Bu yüzden bozuk veriyi TEST KENDİSİ üretiyor (0023'te `d.tur = 'test'`
-- süzgeci için kullanılan yöntemin aynısı) ve ölçüm bittiğinde temizliyor.
-- =============================================================================
do $$
declare
  jt text;
  v_a uuid;
  n0 integer; n integer;
begin
  jt := (public.giris('Kanal!2026'))->>'token';
  select id into v_a from public.ogrenciler
   where ad = 'Ada Kanalcı' order by created_at desc limit 1;

  n0 := (public.veliler_listesi(jt)->>'toplam_okunmamis')::int;

  -- ŞEMANIN İZİN VERDİĞİ ama uçların üretmediği satır: veliden gelmiş
  -- görünen, ama ÖĞRENCİ yazışmasında duran bir mesaj.
  insert into public.mesajlar (ogrenci_id, kimden, metin, kanal)
  values (v_a, 'veli', 'Eslesmeyen satir denemesi.', 'ogrenci');

  n := (public.veliler_listesi(jt)->>'toplam_okunmamis')::int;
  if n <> n0 then
    raise exception '14a: öğrenci kanalındaki satır VELİ listesinde sayıldı (% → %)', n0, n;
  end if;

  -- Aynı satır velinin kendi panelinde de görünmemeli.
  if public.veli_paneli((public.giris((select kod from public.giris_kodlari
        where ogrenci_id = v_a and rol = 'veli')))->>'token')::text
     like '%Eslesmeyen satir%' then
    raise exception '14b: eşleşmeyen satır veli paneline sızdı';
  end if;

  delete from public.mesajlar
   where ogrenci_id = v_a and metin = 'Eslesmeyen satir denemesi.';

  raise notice '14 OK — listeler kanala bakıyor; eşleşmeyen satır veli tarafına geçmiyor';
end $$;
