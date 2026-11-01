-- =============================================================================
-- SEKİZ — ÖDEV SİLME İZİ VE YEDEK EKSİKSİZLİĞİ TESTLERİ (0089)
--
-- Öğretmenin bildirimi: "Öğrenciler daha önceden gönderdikleri ödevleri
-- gönderilmemiş olarak görüyorlar. Göndermişler, hatta puanlandırılmış."
--
-- BU DOSYANIN ASIL SORUSU: bir ödev silinince o ödevin puanları GERİ
-- GETİRİLEBİLİR mi? 0089 öncesi cevap HAYIRDI — `gonderimler.odev_id`
-- `on delete cascade` olduğu için gönderimler sessizce gidiyor ve denetim
-- izine onlar için tek bir satır bile yazılmıyordu.
--
-- 3. ve 4. gruplar bunu ölçüyor: ödev silindikten SONRA izden puanı
-- okuyabiliyor muyuz? Okuyabiliyorsak kayıp geri alınabilir demektir.
--
-- İKİNCİ SORU YEDEK. `disa_aktar` 0034'ten beri güncellenmemişti; öğretmenin
-- gerçek yedeği ölçüldüğünde 13 tablonun eksik olduğu görüldü. 7–9. gruplar
-- yeni tabloların girdiğini, ESKİLERİN KAYBOLMADIĞINI ve sızmaması
-- gerekenlerin (oturum jetonu, pin_hash) sızmadığını ölçüyor.
--
-- NOT: hiçbir blokta `exception when others` YOK — böyle bir yakalayıcı
-- kendinden önceki grupların hatalarını yutar (0022'de yapılan hata).
--
-- SAYILAR FARK OLARAK ÖLÇÜLÜYOR; süit bütün dosyaları aynı veritabanında
-- koşturuyor ve mutlak sayı varsayımı 0022'de kırılmıştı.
--
-- İZOLASYON: 9SL ve 9SM bu dosyaya ait; başka test bu şubeleri kullanmıyor.
--
-- KUSUR PROVALARI (0089). Yedisi de zincir baştan uygulanarak ölçüldü:
--   A.  Sebep kapısı `false and` ile atlatıldı      → 2a düştü.
--   B.  Gönderim döngüsü hiç dönmedi                → 3d düştü (iz yok).
--   C.  İz `to_jsonb(g)` yerine yalnız kimlik aldı  → 3e düştü (puan yok).
--   D.  Yedekteki denetim izi boş geldi             → 9a düştü.
--   E.  Yedeğe `oturumlar` eklendi                  → ÖZ-DENETİM yakaladı.
--   E2. Aynı sızıntı `public."oturumlar"` yazımıyla öz-denetimi atlattı
--       → 8b düştü. Yani çalışma zamanı kapısı tek başına da tutuyor.
--   F.  Kopya `veli_onaylari`yi düşürdü             → ÖZ-DENETİM yakaladı.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt        text;
  v_a uuid; v_b uuid;
  d_bos uuid; d_dolu uuid; d_sahip uuid;
  ogr_a uuid; ogr_b uuid;
  g_a uuid;
  y         jsonb;
  z         jsonb;
  n integer; n_once integer;
  v_puan numeric;
begin
  update public.ogretmenler
     set pin_hash = extensions.crypt('Silme!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Silme!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (9, 'SL')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_a;
  insert into public.siniflar (seviye, sube) values (9, 'SM')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_b;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    select g.id, s from public.ogretmenler g, unnest(array[v_a, v_b]) s
    where g.yonetici on conflict do nothing;

  -- `ekleyen_id` 0033'ten beri NOT NULL; öğrenciyi ekleyen öğretmen yazılıyor.
  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id)
    select 'Silme Deneği A', 'okul', v_a, g.id from public.ogretmenler g
     where g.yonetici returning id into ogr_a;
  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id)
    select 'Silme Deneği B', 'okul', v_a, g.id from public.ogretmenler g
     where g.yonetici returning id into ogr_b;

  -- ===========================================================================
  raise notice '--- 1. Gönderimi OLMAYAN ödev sebepsiz silinebiliyor ---';
  -- ===========================================================================
  -- Eski davranış korunuyor: `p_neden` varsayılanı null olduğu için
  -- önbellekteki eski istemcinin iki argümanlı çağrısı da bu yoldan geçer.
  d_bos := (public.odev_olustur(jt, 'Boş ödev 0089', null, v_a, 'acik',
              current_date + 5, null, null, null, null, true, null, null,
              1::smallint)) ->> 'id';
  y := public.odev_sil(jt, d_bos);
  if (y ->> 'durum') <> 'tamam' or (y ->> 'silinen_gonderim') <> '0' then
    raise exception '1a BAŞARISIZ — boş ödev silinemedi: %', y::text;
  end if;
  if exists (select 1 from public.odevler where id = d_bos) then
    raise exception '1b BAŞARISIZ — ödev hâlâ duruyor';
  end if;
  raise notice '1 OK — gönderimsiz ödev sebepsiz silindi (eski davranış)';

  -- ===========================================================================
  raise notice '--- 2. Gönderimi OLAN ödev SEBEPSİZ silinemiyor ---';
  -- ===========================================================================
  d_dolu := (public.odev_olustur(jt, 'Dolu ödev 0089', null, v_a, 'test',
              current_date + 5, 2, '{"1":"A","2":"B"}'::jsonb,
              null, null, true, 5::smallint, null, 1::smallint)) ->> 'id';
  perform public.odev_yayinla(jt, d_dolu);
  insert into public.gonderimler (odev_id, ogrenci_id, foto_yolu, cevaplar,
                                  dogru, yanlis, bos, puan, durum)
    values (d_dolu, ogr_a, 'cozum/x/a.jpg', '{"1":"A","2":"B"}'::jsonb,
            2, 0, 0, 100, 'puanlandi')
    returning id into g_a;
  insert into public.gonderimler (odev_id, ogrenci_id, foto_yolu, cevaplar,
                                  dogru, yanlis, bos, puan, durum)
    values (d_dolu, ogr_b, 'cozum/x/b.jpg', '{"1":"A","2":"C"}'::jsonb,
            1, 1, 0, 50, 'puanlandi');

  begin
    perform public.odev_sil(jt, d_dolu);
    raise exception '2a BAŞARISIZ — gönderimli ödev SEBEPSİZ silindi';
  exception when sqlstate '22023' then
    null;
  end;
  -- Üç harften kısa sebep de reddedilmeli.
  begin
    perform public.odev_sil(jt, d_dolu, 'ab');
    raise exception '2b BAŞARISIZ — iki harflik sebep kabul edildi';
  exception when sqlstate '22023' then
    null;
  end;
  if not exists (select 1 from public.odevler where id = d_dolu) then
    raise exception '2c BAŞARISIZ — reddedilen çağrı ödevi yine de sildi';
  end if;
  if (select count(*) from public.gonderimler where odev_id = d_dolu) <> 2 then
    raise exception '2d BAŞARISIZ — reddedilen çağrı gönderimleri bozdu';
  end if;
  raise notice '2 OK — sebepsiz ve kısa sebepli silme reddedildi, veri yerinde';

  -- ===========================================================================
  raise notice '--- 3. Sebeple silinince PUAN İZDE OKUNABİLİYOR ---';
  -- ===========================================================================
  -- 0089'un bütün meselesi bu grup. Silme gerçekleşiyor ama puan kayıp
  -- değil: izden okunabiliyor, yani geri getirilebilir.
  select count(*) into n_once from public.denetim_izi
   where islem = 'gonderim_odevle_silindi';

  y := public.odev_sil(jt, d_dolu, 'Yanlış sınıfa verilmiş, yeniden verilecek');

  if (y ->> 'silinen_gonderim') <> '2' then
    raise exception '3a BAŞARISIZ — silinen gönderim sayısı yanlış: %', y::text;
  end if;
  if exists (select 1 from public.odevler where id = d_dolu) then
    raise exception '3b BAŞARISIZ — ödev silinmedi';
  end if;
  if exists (select 1 from public.gonderimler where odev_id = d_dolu) then
    raise exception '3c BAŞARISIZ — gönderimler silinmedi';
  end if;

  select count(*) into n from public.denetim_izi
   where islem = 'gonderim_odevle_silindi';
  if n - n_once <> 2 then
    raise exception '3d BAŞARISIZ — ize 2 satır yazılmadı (fark %)', n - n_once;
  end if;

  -- ASIL ÖLÇÜM: puan izden okunabiliyor mu?
  select (eski ->> 'puan')::numeric into v_puan
    from public.denetim_izi
   where islem = 'gonderim_odevle_silindi' and kayit_id = g_a;
  if v_puan is distinct from 100 then
    raise exception '3e BAŞARISIZ — silinen gönderimin puanı izde yok: %', v_puan;
  end if;
  raise notice '3 OK — ödev ve gönderimler silindi, PUAN (%) izde duruyor', v_puan;

  -- ===========================================================================
  raise notice '--- 4. İz TAM SATIRI taşıyor (geri yükleme mümkün) ---';
  -- ===========================================================================
  select eski into z from public.denetim_izi
   where islem = 'gonderim_odevle_silindi' and kayit_id = g_a;
  if (z ->> 'ogrenci_id')::uuid <> ogr_a then
    raise exception '4a BAŞARISIZ — izde öğrenci yok';
  end if;
  if (z ->> 'foto_yolu') <> 'cozum/x/a.jpg' then
    raise exception '4b BAŞARISIZ — izde çözüm fotoğrafının yolu yok: %', z::text;
  end if;
  if (z -> 'cevaplar') <> '{"1":"A","2":"B"}'::jsonb then
    raise exception '4c BAŞARISIZ — izde cevaplar yok';
  end if;
  if (z ->> 'durum') <> 'puanlandi' or (z ->> 'dogru') <> '2' then
    raise exception '4d BAŞARISIZ — izde durum/doğru sayısı yok: %', z::text;
  end if;
  -- `yeni` tarafı: hangi ödev, hangi sebep.
  select yeni into z from public.denetim_izi
   where islem = 'gonderim_odevle_silindi' and kayit_id = g_a;
  if (z ->> 'odev') <> 'Dolu ödev 0089'
     or (z ->> 'neden') <> 'Yanlış sınıfa verilmiş, yeniden verilecek' then
    raise exception '4e BAŞARISIZ — izde ödev adı ya da sebep yok: %', z::text;
  end if;
  raise notice '4 OK — iz tam satırı taşıyor: öğrenci, fotoğraf, cevaplar, sebep';

  -- ===========================================================================
  raise notice '--- 5. odev_silindi satırı sebebi ve sayıyı taşıyor ---';
  -- ===========================================================================
  select yeni into z from public.denetim_izi
   where islem = 'odev_silindi' and kayit_id = d_dolu;
  if (z ->> 'gonderim_sayisi') <> '2' then
    raise exception '5a BAŞARISIZ — odev_silindi gönderim sayısını söylemiyor: %', z::text;
  end if;
  if (z ->> 'neden') is null then
    raise exception '5b BAŞARISIZ — odev_silindi sebebi söylemiyor';
  end if;
  -- Gönderimsiz silmede sebep null olabilir ama satır yine yazılmalı.
  if not exists (select 1 from public.denetim_izi
                  where islem = 'odev_silindi' and kayit_id = d_bos) then
    raise exception '5c BAŞARISIZ — gönderimsiz silme ize yazılmadı';
  end if;
  raise notice '5 OK — odev_silindi sebebi ve gönderim sayısını taşıyor';

  -- ===========================================================================
  raise notice '--- 6. Sahiplik kapısı duruyor ---';
  -- ===========================================================================
  d_sahip := (public.odev_olustur(jt, 'Sahip ödevi 0089', null, v_b, 'acik',
                current_date + 5, null, null, null, null, true, null, null,
                1::smallint)) ->> 'id';
  declare
    jt2 text;
    o2  uuid;
  begin
    insert into public.ogretmenler (ad, pin_hash, yonetici)
      values ('Silme Yabancı 0089',
              extensions.crypt('Yabanci!2026', extensions.gen_salt('bf', 10)), false)
      returning id into o2;
    jt2 := (public.giris('Yabanci!2026'))->>'token';
    begin
      perform public.odev_sil(jt2, d_sahip, 'Benim değil ama silmek istiyorum');
      raise exception '6a BAŞARISIZ — başka öğretmen ödevi sildi';
    exception when sqlstate '42501' then
      null;
    end;
  end;
  if not exists (select 1 from public.odevler where id = d_sahip) then
    raise exception '6b BAŞARISIZ — ödev yine de silindi';
  end if;
  raise notice '6 OK — ödevi yalnız sahibi silebiliyor';

  -- ===========================================================================
  raise notice '--- 7. YEDEK yeni tabloların hepsini alıyor ---';
  -- ===========================================================================
  y := public.disa_aktar(jt);
  foreach z in array array['"denetim_izi"'::jsonb, '"odev_ek_sure"'::jsonb,
                           '"duyurular"'::jsonb, '"duyuru_siniflari"'::jsonb,
                           '"duyuru_okundu"'::jsonb, '"anketler"'::jsonb,
                           '"anket_yanitlari"'::jsonb, '"anket_katilimlari"'::jsonb,
                           '"okundu"'::jsonb, '"ayarlar"'::jsonb]
  loop
    if not (y ? (z #>> '{}')) then
      raise exception '7a BAŞARISIZ — yedekte % yok', z #>> '{}';
    end if;
  end loop;
  raise notice '7 OK — on yeni tablo da yedekte';

  -- ===========================================================================
  raise notice '--- 8. YEDEK eski tabloları KAYBETMEDİ, sızıntı da yok ---';
  -- ===========================================================================
  -- 0088''in dersi: gövde kopyalamak eski bir alanı sessizce geri alabilir.
  foreach z in array array['"ogretmenler"'::jsonb, '"ogretmen_siniflari"'::jsonb,
                           '"siniflar"'::jsonb, '"ogrenciler"'::jsonb,
                           '"giris_kodlari"'::jsonb, '"veli_onaylari"'::jsonb,
                           '"odevler"'::jsonb, '"gonderimler"'::jsonb,
                           '"mesajlar"'::jsonb, '"dersler"'::jsonb,
                           '"odemeler"'::jsonb, '"ewalu_mesajlari"'::jsonb]
  loop
    if not (y ? (z #>> '{}')) then
      raise exception '8a BAŞARISIZ — yedek eski tablosunu kaybetti: %', z #>> '{}';
    end if;
  end loop;
  -- SIZMAMASI GEREKENLER.
  if y ? 'oturumlar' then
    raise exception '8b BAŞARISIZ — yedek oturum jetonlarını taşıyor';
  end if;
  if y::text like '%pin_hash%' then
    raise exception '8c BAŞARISIZ — yedek pin_hash sızdırıyor';
  end if;
  if y ? 'giris_denemeleri' then
    raise exception '8d BAŞARISIZ — yedek hız sınırı günlüğünü taşıyor';
  end if;
  raise notice '8 OK — on iki eski tablo yerinde; oturum, pin_hash ve günlük yok';

  -- ===========================================================================
  raise notice '--- 9. Denetim izi yedekte ve KESİLME bayrağı doğru ---';
  -- ===========================================================================
  if jsonb_array_length(y -> 'denetim_izi') = 0 then
    raise exception '9a BAŞARISIZ — denetim izi boş geldi';
  end if;
  if (y ->> 'denetim_izi_toplam')::bigint
     <> (select count(*) from public.denetim_izi) then
    raise exception '9b BAŞARISIZ — denetim izi toplamı yanlış';
  end if;
  -- Bu veritabanı 50 000 satırın altında: bayrak false olmalı ve bütün
  -- satırlar gelmeli. Bayrak sabit true/false yazılsaydı burada düşerdi.
  if (y ->> 'denetim_izi_kesildi')::boolean <> false then
    raise exception '9c BAŞARISIZ — kesilmediği hâlde "kesildi" dedi';
  end if;
  if jsonb_array_length(y -> 'denetim_izi')
     <> (select count(*) from public.denetim_izi) then
    raise exception '9d BAŞARISIZ — sınır altındayken satır eksik geldi';
  end if;
  -- Silinen gönderimin izi YEDEKTE de okunabiliyor olmalı: yedeğin asıl
  -- değeri bu.
  if not exists (
    select 1 from jsonb_array_elements(y -> 'denetim_izi') e
     where e ->> 'islem' = 'gonderim_odevle_silindi'
  ) then
    raise exception '9e BAŞARISIZ — silinen gönderimin izi yedeğe girmedi';
  end if;
  raise notice '9 OK — denetim izi yedekte, toplam ve kesilme bayrağı doğru';

  -- ===========================================================================
  raise notice '--- 10. Zincirin sonu ---';
  -- ===========================================================================
  select count(*) into n from public.uygulanan_migrationlar where dosya = '0089';
  if n <> 1 then
    raise exception '10 BAŞARISIZ — 0089 kaydı yok';
  end if;
  raise notice '10 OK — zincir 0089''da';

  raise notice '=== 0089 silme izi ve yedek: 10 grubun hepsi geçti ===';
end $$;
