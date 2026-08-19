-- =============================================================================
-- SEKİZ — 0019 VELİLER VE MESAJLAŞMA TESTLERİ
--
-- İki asıl soru:
--   1. Mesajlaşma gerçekten çalışıyor mu (yazılan yerine ulaşıyor mu,
--      okunmamış sayısı doğru mu)?
--   2. KURAL 6 — veliye cevap anahtarı HİÇBİR koşulda gitmiyor mu?
--
-- İZOLASYON: kendi sınıfımızı (7V) kuruyoruz, toplam sayılara bakmıyoruz.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text;
  jv text;
  jv2 text;
  jo text;
  v_sinif uuid;
  v_a uuid;
  v_b uuid;
  v_odev uuid;
  v jsonb;
  n integer;
  s text;
  -- ZAMANI TEST KENDİSİ KURUYOR.
  -- PostgreSQL'de now() İŞLEM BAŞLANGIÇ zamanıdır; bu DO bloğunun tamamı tek
  -- işlem olduğu için gönderilen mesaj ile okuma damgası aynı ana düşer ve
  -- "okuduktan sonra gelen mesaj" hiç oluşmaz. Üretimde her RPC ayrı işlem,
  -- orada sorun yok — ama test bu tesadüfe yaslanmamalı. Her adımdan sonra
  -- ilgili satırın zamanını açıkça ileri alıyoruz.
  t0 timestamptz := clock_timestamp() - interval '1 day';
  adim integer := 0;
begin
  -- ---------------------------------------------------------------------------
  -- Hazırlık
  -- ---------------------------------------------------------------------------
  update public.ayarlar
     set ogretmen_pin_hash = extensions.crypt('Veli!2026', extensions.gen_salt('bf', 10))
   where id = 1;
  jt := (public.giris('Veli!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (7, 'V')
    on conflict (seviye, sube) do update set arsiv = false
    returning id into v_sinif;

  v_a := (public.ogrenci_ekle(jt, 'Ada Veliçocuğu', 'okul', v_sinif))->>'id';
  v_b := (public.ogrenci_ekle(jt, 'Bora Veliçocuğu', 'okul', v_sinif))->>'id';

  jv  := (public.giris((select kod from public.giris_kodlari
                         where ogrenci_id = v_a and rol = 'veli')))->>'token';
  jv2 := (public.giris((select kod from public.giris_kodlari
                         where ogrenci_id = v_b and rol = 'veli')))->>'token';
  jo  := (public.giris((select kod from public.giris_kodlari
                         where ogrenci_id = v_a and rol = 'ogrenci')))->>'token';

  -- Cevap anahtarlı, süresi dolmuş, teslim EDİLMEMİŞ bir ödev: Kural 6 testi
  -- için en sert durum (öğrenci teslim etseydi anahtar zaten açılırdı).
  v_odev := (public.odev_olustur(jt, 'Veli testi ödevi', null, v_sinif, 'test',
      (current_date - 2)::date, 2, '{"1":"A","2":"B"}'::jsonb, 'odev/anahtar.pdf',
      'odev/soru.pdf', true, 5::smallint))->>'id';
  perform public.odev_yayinla(jt, v_odev);

  -- ---------------------------------------------------------------------------
  -- 1 — okundu tablosu artık rol başına ayrı satır tutuyor
  --
  -- Eski hâlde birincil anahtar yalnız ogrenci_id'ydi; veli okuduğunda
  -- öğrencinin kaydı eziliyordu ve öğretmene hiç yer yoktu.
  -- ---------------------------------------------------------------------------
  perform public.okundu_isaretle(jv);   -- veli okudu
  perform public.okundu_isaretle(jo);   -- öğrenci okudu
  perform public.ogretmen_okudu(jt, v_a);
  -- Bu okuma HER ŞEYDEN ÖNCE olmuş sayılsın; sonraki gruplar kendi
  -- zamanlarını kuruyor.
  update public.okundu set zaman = t0 where ogrenci_id = v_a and rol = 'ogretmen';

  select count(*) into n from public.okundu where ogrenci_id = v_a;
  if n <> 3 then
    raise exception '1a: üç rolün üç ayrı satırı olmalıydı, % satır var', n;
  end if;

  select count(*) into n from public.okundu
   where ogrenci_id = v_a and rol in ('veli', 'ogrenci', 'ogretmen');
  if n <> 3 then raise exception '1b: roller doğru yazılmamış'; end if;

  raise notice '1 OK — okundu rol başına ayrı satır tutuyor';

  -- ---------------------------------------------------------------------------
  -- 2 — Veli mesaj yazıyor, öğretmen görüyor ve OKUNMAMIŞ sayılıyor
  -- ---------------------------------------------------------------------------
  adim := adim + 1;
  perform public.mesaj_gonder(jv, 'Merhaba, Ada''nın ödevini soracaktım.');
  update public.mesajlar set created_at = t0 + (adim * interval '1 minute')
   where ogrenci_id = v_a and created_at = now();

  adim := adim + 1;
  perform public.mesaj_gonder(jv, 'Bir de sınav tarihi ne zaman?');
  update public.mesajlar set created_at = t0 + (adim * interval '1 minute')
   where ogrenci_id = v_a and created_at = now();

  v := public.veliler_listesi(jt);
  if (v->>'toplam_okunmamis')::integer <> 2 then
    raise exception '2a: 2 okunmamış beklenirken %', v->>'toplam_okunmamis';
  end if;

  select count(*) into n from jsonb_array_elements(v->'yanit_bekleyen') e
   where (e->>'ogrenci_id')::uuid = v_a and (e->>'okunmamis')::integer = 2;
  if n <> 1 then raise exception '2b: Ada yanıt bekleyenlerde 2 mesajla görünmüyor'; end if;

  -- Mesaj METNİ listede OLMAMALI: ortak ekranda bütün velilerin yazdıkları
  -- yan yana görünmesin.
  if v::text ilike '%sınav tarihi%' or v::text ilike '%Merhaba%' then
    raise exception '2c: veliler_listesi mesaj metni taşıyor';
  end if;

  raise notice '2 OK — veli mesajı okunmamış sayılıyor, metin listede yok';

  -- ---------------------------------------------------------------------------
  -- 3 — Öğretmen okuyunca okunmamış SIFIRLANIYOR, yeni mesaj yine sayılıyor
  -- ---------------------------------------------------------------------------
  v := public.mesajlar_ogretmen(jt, v_a);
  if jsonb_array_length(v->'mesajlar') <> 2 then
    raise exception '3a: yazışmada 2 mesaj beklenirken %', jsonb_array_length(v->'mesajlar');
  end if;
  if v->'ogrenci'->>'ad' <> 'Ada Veliçocuğu' then
    raise exception '3b: yazışma başlığında öğrencinin adı yok';
  end if;

  adim := adim + 1;
  perform public.ogretmen_okudu(jt, v_a);
  update public.okundu set zaman = t0 + (adim * interval '1 minute')
   where ogrenci_id = v_a and rol = 'ogretmen';

  v := public.veliler_listesi(jt);
  if (v->>'toplam_okunmamis')::integer <> 0 then
    raise exception '3c: okuduktan sonra 0 beklenirken %', v->>'toplam_okunmamis';
  end if;

  adim := adim + 1;
  perform public.mesaj_gonder(jv, 'Teşekkür ederim.');
  update public.mesajlar set created_at = t0 + (adim * interval '1 minute')
   where ogrenci_id = v_a and created_at = now();
  v := public.veliler_listesi(jt);
  if (v->>'toplam_okunmamis')::integer <> 1 then
    raise exception '3d: yeni mesaj sonrası 1 beklenirken %', v->>'toplam_okunmamis';
  end if;

  raise notice '3 OK — okuma sıfırlıyor, sonraki mesaj yeniden sayılıyor';

  -- ---------------------------------------------------------------------------
  -- 4 — Öğretmenin yazdığı mesaj OKUNMAMIŞ SAYILMIYOR
  --
  -- Kendi yazdığını okunmamış saymak sayacı anlamsız kılardı.
  -- ---------------------------------------------------------------------------
  adim := adim + 1;
  perform public.ogretmen_okudu(jt, v_a);
  update public.okundu set zaman = t0 + (adim * interval '1 minute')
   where ogrenci_id = v_a and rol = 'ogretmen';

  adim := adim + 1;
  perform public.mesaj_gonder(jt, 'Sınav 20 Mayıs''ta.', v_a);
  update public.mesajlar set created_at = t0 + (adim * interval '1 minute')
   where ogrenci_id = v_a and created_at = now();

  v := public.veliler_listesi(jt);
  if (v->>'toplam_okunmamis')::integer <> 0 then
    raise exception '4a: öğretmenin kendi mesajı okunmamış sayıldı (%)',
      v->>'toplam_okunmamis';
  end if;

  -- Veli öğretmenin mesajını görüyor mu
  v := public.veli_paneli(jv);
  select count(*) into n from jsonb_array_elements(v->'mesajlar') e
   where e->>'kimden' = 'ogretmen' and e->>'metin' like 'Sınav%';
  if n <> 1 then raise exception '4b: veli öğretmenin mesajını görmüyor'; end if;

  raise notice '4 OK — öğretmenin kendi mesajı sayılmıyor, veliye ulaşıyor';

  -- ---------------------------------------------------------------------------
  -- 5 — VELİ BAŞKA BİR VELİNİN YAZIŞMASINI GÖREMEZ
  --
  -- Bora'nın velisi Ada'nın mesajlarını hiçbir yoldan görmemeli.
  -- ---------------------------------------------------------------------------
  v := public.veli_paneli(jv2);
  if v::text ilike '%sınav tarihi%' or v::text ilike '%Merhaba%' then
    raise exception '5a: BAŞKA velinin mesajları görünüyor';
  end if;
  if jsonb_array_length(v->'mesajlar') <> 0 then
    raise exception '5b: Bora''nın velisinde % mesaj var, 0 olmalı',
      jsonb_array_length(v->'mesajlar');
  end if;

  -- Veli öğretmen uçlarını çağıramaz
  begin
    perform public.veliler_listesi(jv);
    raise exception '5c: VELİ veliler_listesi''ni çağırdı';
  exception when sqlstate '42501' then null;
  end;

  begin
    perform public.mesajlar_ogretmen(jv, v_b);
    raise exception '5d: VELİ başkasının yazışmasını okudu';
  exception when sqlstate '42501' then null;
  end;

  begin
    perform public.sinif_velileri(jv, v_sinif);
    raise exception '5e: VELİ sınıfın veli listesini aldı';
  exception when sqlstate '42501' then null;
  end;

  begin
    perform public.ogretmen_okudu(jv, v_a);
    raise exception '5f: VELİ öğretmen okuma kaydı yazdı';
  exception when sqlstate '42501' then null;
  end;

  raise notice '5 OK — veli ne başka veliyi ne öğretmen uçlarını görebiliyor';

  -- ---------------------------------------------------------------------------
  -- 6 — VELİ BAŞKASI ADINA MESAJ YAZAMAZ
  --
  -- `mesaj_gonder` velide p_ogrenci_id'yi yok sayıyor; bunu ölçüyoruz.
  -- ---------------------------------------------------------------------------
  perform public.mesaj_gonder(jv, 'Bora adına yazmayı deniyorum.', v_b);

  select count(*) into n from public.mesajlar
   where ogrenci_id = v_b and metin like 'Bora adına%';
  if n <> 0 then raise exception '6a: veli BAŞKA öğrencinin adına mesaj yazdı'; end if;

  select count(*) into n from public.mesajlar
   where ogrenci_id = v_a and metin like 'Bora adına%';
  if n <> 1 then raise exception '6b: mesaj velinin kendi çocuğuna yazılmadı'; end if;

  raise notice '6 OK — veli parametreyle başkasının yazışmasına giremiyor';

  -- ---------------------------------------------------------------------------
  -- 7 — KURAL 6: VELİYE CEVAP ANAHTARI HİÇBİR KOŞULDA GİTMEZ
  --
  -- En sert durum: ödev yayında, süresi dolmuş, öğrenci TESLİM ETMEMİŞ.
  -- ---------------------------------------------------------------------------
  s := public.veli_paneli(jv)::text;

  if s ilike '%cevap_anahtari%' or s ilike '%anahtar_url%' or s ilike '%anahtar_yolu%' then
    raise exception '7a: veli panelinde anahtar ALANI var';
  end if;
  if s ilike '%odev/anahtar.pdf%' then
    raise exception '7b: veli panelinde anahtar DOSYA YOLU var';
  end if;
  -- Anahtarın kendi içeriği de sızmasın
  if s like '%"1": "A"%' or s like '%{"1":"A"%' then
    raise exception '7c: veli panelinde anahtarın içeriği var';
  end if;

  -- Denetimin gerçekten çalıştığı: aynı arama ÖĞRETMEN ucunda bulmalı
  if public.odev_detay(jt, v_odev)::text not ilike '%cevap_anahtari%' then
    raise exception '7d: denetim işe yaramıyor — öğretmen ucunda bile anahtar bulunamadı';
  end if;

  -- Veli dosya erişimi de isteyememeli
  if public.dosya_erisim_izni(jv, 'odev/anahtar.pdf') then
    raise exception '7e: VELİ anahtar PDF''ini açabiliyor';
  end if;

  raise notice '7 OK — veliye anahtar hiçbir biçimde gitmiyor (alan, yol, içerik, dosya)';

  -- ---------------------------------------------------------------------------
  -- 8 — Sınıf listesi ve sınıfın velileri
  -- ---------------------------------------------------------------------------
  v := public.veliler_listesi(jt);
  select count(*) into n from jsonb_array_elements(v->'gruplar') e
   where e->>'sinif' = '7V' and (e->>'veli_sayisi')::integer = 2;
  if n <> 1 then raise exception '8a: 7V grubunda 2 veli görünmüyor'; end if;

  v := public.sinif_velileri(jt, v_sinif);
  if jsonb_array_length(v->'veliler') <> 2 then
    raise exception '8b: sınıfın veli listesinde 2 kayıt olmalı';
  end if;
  select count(*) into n from jsonb_array_elements(v->'veliler') e
   where (e->>'veli_kodu_var')::boolean;
  if n <> 2 then raise exception '8c: veli kodu bayrağı yanlış'; end if;

  -- Bu liste de mesaj metni taşımamalı
  if v::text ilike '%Merhaba%' or v::text ilike '%Teşekkür%' then
    raise exception '8d: sinif_velileri mesaj metni taşıyor';
  end if;

  raise notice '8 OK — sınıf grupları ve sınıf veli listesi doğru, metin taşımıyor';

  -- ---------------------------------------------------------------------------
  -- 9 — ARŞİVDEKİ sınıf veli listesinde yok (0016 kuralı)
  -- ---------------------------------------------------------------------------
  perform public.sinif_arsivle(jt, v_sinif, true);

  v := public.veliler_listesi(jt);
  select count(*) into n from jsonb_array_elements(v->'gruplar') e
   where e->>'sinif' = '7V';
  if n <> 0 then raise exception '9a: arşivdeki sınıf veli listesinde duruyor'; end if;

  perform public.sinif_arsivle(jt, v_sinif, false);
  v := public.veliler_listesi(jt);
  select count(*) into n from jsonb_array_elements(v->'gruplar') e
   where e->>'sinif' = '7V';
  if n <> 1 then raise exception '9b: geri alınca sınıf dönmedi'; end if;

  raise notice '9 OK — arşiv kuralı veli listesinde de geçerli';

  -- ---------------------------------------------------------------------------
  -- 10 — Boş mesaj reddediliyor, öğretmen hedefsiz yazamıyor
  -- ---------------------------------------------------------------------------
  begin
    perform public.mesaj_gonder(jv, '   ');
    raise exception '10a: boşluktan ibaret mesaj kabul edildi';
  exception when sqlstate '22023' then null;
  end;

  begin
    perform public.mesaj_gonder(jt, 'Kime gittiği belirsiz.');
    raise exception '10b: öğretmen hedefsiz mesaj gönderdi';
  exception when sqlstate '22023' then null;
  end;

  -- 0025'TE DEĞİŞEN KURAL. Öğrenci artık yazabiliyor (kendi yazışmasına),
  -- ama yazdığı şey VELİ yazışmasına düşmüyor. Burada ölçülen tam olarak
  -- bu sınır: bu dosya veli tarafını koruyor, sızıntının kendisi
  -- `iki_yazisma_testleri.sql`'de ölçülüyor.
  perform public.mesaj_gonder(jo, 'Öğrencinin kendi kanalına yazdığı.');

  select count(*) into n from public.mesajlar
   where ogrenci_id = v_a and kanal = 'ogrenci' and kimden = 'ogrenci';
  if n <> 1 then raise exception '10c: öğrencinin mesajı kendi kanalına düşmedi'; end if;

  select count(*) into n from public.mesajlar
   where ogrenci_id = v_a and kanal = 'veli' and kimden = 'ogrenci';
  if n <> 0 then raise exception '10d: öğrencinin mesajı VELİ yazışmasına düştü'; end if;

  -- Velinin yazışma ekranında öğrencinin cümlesi hiç geçmemeli.
  v := public.mesajlar_ogretmen(jt, v_a, 'veli');
  if v::text like '%kendi kanalına yazdığı%' then
    raise exception '10e: öğrencinin cümlesi veli yazışmasında görünüyor';
  end if;

  raise notice '10 OK — boş ve hedefsiz mesaj reddediliyor, öğrencinin mesajı veli yazışmasına karışmıyor';

  raise notice '';
  raise notice 'VELİLER VE MESAJLAŞMA TESTLERİ: 10 GRUP GEÇTİ';
end $$;
