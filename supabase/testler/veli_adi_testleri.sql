-- =============================================================================
-- SEKİZ — 0057: VELİ ADI LİSTELERDE
--
-- Öğretmenin isteği: Veliler → sınıf listesinde ve Mesajlar'da öğrencinin
-- yanında velinin adı; ad, velinin onam verirken KENDİ yazdığı ad.
--
--  1. Onam veren velinin adı üç uçta da görünüyor.
--  2. Onam vermemiş velide ad null (uydurulmuyor).
--  3. Adsız eski satır + adlı yeni satır: en son yazılan ad.
--  4. Yalnız eski sürümde ad varsa: ad görünür, onam_var yine false.
--  5. Öğrenci kanalında ad yok.
--  6. Kapsam: sınıfa atanmamış meslektaş veliyi göremiyor.
--  7. `_veli_adi` istemciye kapalı.
--
-- İZOLASYON: kendi sınıfını kuruyor (12Q).
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text; jm text;
  v_ben uuid;
  s_sinif uuid;
  ali uuid; ayse uuid; mert uuid; can uuid;
  v jsonb; satir jsonb; y jsonb;
  patladi boolean;
begin
  -- ---------------------------------------------------------------------------
  -- Hazırlık
  -- ---------------------------------------------------------------------------
  update public.ogretmenler
     set pin_hash = extensions.crypt('VeliAdi!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('VeliAdi!2026'))->>'token';
  select id into v_ben from public.ogretmenler where yonetici;

  insert into public.siniflar (seviye, sube) values (12, 'Q')
    on conflict (seviye, sube) do update set arsiv = false returning id into s_sinif;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    values (v_ben, s_sinif) on conflict do nothing;

  ali  := (public.ogrenci_ekle(jt, 'Ali Adli',   'okul', s_sinif))->>'id';
  ayse := (public.ogrenci_ekle(jt, 'Ayse Onamsiz', 'okul', s_sinif))->>'id';
  mert := (public.ogrenci_ekle(jt, 'Mert Yenilenen', 'okul', s_sinif))->>'id';
  can  := (public.ogrenci_ekle(jt, 'Can Eskisurum', 'okul', s_sinif))->>'id';

  -- Ali'nin velisi onamı ADIYLA veriyor (boşluklar kırpılıyor — 0038).
  perform public.onam_ver(
    (public.giris((select kod from public.giris_kodlari
                    where ogrenci_id = ali and rol = 'veli')))->>'token',
    public._gecerli_onam_surumu(), '  Ayşe Adlı  ');

  -- Mert: önce eski bir sürümde "Eski Ad", sonra 0038 öncesi ADSIZ bir
  -- satır, en son bugünkü sürümde "Mert'in Annesi".
  insert into public.veli_onaylari (ogrenci_id, metin_surumu, veli_adi, onay_zamani)
    values (mert, 'test-eski-1', 'Eski Ad', now() - interval '20 days'),
           (mert, 'test-eski-2', null,      now() - interval '10 days');
  perform public.onam_ver(
    (public.giris((select kod from public.giris_kodlari
                    where ogrenci_id = mert and rol = 'veli')))->>'token',
    public._gecerli_onam_surumu(), 'Mert''in Annesi');

  -- Can: YALNIZ eski sürümde adlı onay var; bugünkü metni onaylamamış.
  insert into public.veli_onaylari (ogrenci_id, metin_surumu, veli_adi, onay_zamani)
    values (can, 'test-eski-1', 'Can Babası', now() - interval '5 days');

  -- Mesajlar listesine düşmeleri için yazışmalar.
  perform public.mesaj_gonder(jt, 'Veliye merhaba', ali, 'veli');
  perform public.mesaj_gonder(jt, 'Veliye merhaba', ayse, 'veli');
  perform public.mesaj_gonder(jt, 'Ogrenciye merhaba', ali, 'ogrenci');

  -- ---------------------------------------------------------------------------
  -- 1. ONAM VEREN VELİNİN ADI ÜÇ UÇTA DA
  -- ---------------------------------------------------------------------------
  v := public.sinif_velileri(jt, s_sinif);
  select e into satir from jsonb_array_elements(v->'veliler') e
   where e->>'ogrenci_id' = ali::text;
  if satir->>'veli_adi' is distinct from 'Ayşe Adlı' then
    raise exception '1a: sinif_velileri veli_adi = %, "Ayşe Adlı" olmalı', satir->>'veli_adi';
  end if;
  if (satir->>'onam_var')::boolean is not true then
    raise exception '1a: onam_var true olmalı';
  end if;
  raise notice '1a OK — Veliler/sınıf: "Ayşe Adlı" (kırpılmış)';

  v := public.yazisma_listesi(jt, 'veli');
  select s into satir
    from jsonb_array_elements(v->'gruplar') g, jsonb_array_elements(g->'satirlar') s
   where s->>'ogrenci_id' = ali::text;
  if satir->>'veli_adi' is distinct from 'Ayşe Adlı' then
    raise exception '1b: yazisma_listesi veli_adi = %', satir->>'veli_adi';
  end if;
  raise notice '1b OK — Mesajlar/Veliler: "Ayşe Adlı"';

  y := public.mesajlar_ogretmen(jt, ali, 'veli');
  if y->'ogrenci'->>'veli_adi' is distinct from 'Ayşe Adlı' then
    raise exception '1c: mesajlar_ogretmen veli_adi = %', y->'ogrenci'->>'veli_adi';
  end if;
  if y->'ogrenci'->>'ad' <> 'Ali Adli' then
    raise exception '1c: öğrenci adı bozuldu: %', y->'ogrenci'->>'ad';
  end if;
  raise notice '1c OK — yazışma ekranı: öğrenci "Ali Adli", veli "Ayşe Adlı"';

  -- ---------------------------------------------------------------------------
  -- 2. ONAMSIZ VELİ: AD YOK
  -- ---------------------------------------------------------------------------
  v := public.sinif_velileri(jt, s_sinif);
  select e into satir from jsonb_array_elements(v->'veliler') e
   where e->>'ogrenci_id' = ayse::text;
  if not (satir ? 'veli_adi') or jsonb_typeof(satir->'veli_adi') <> 'null' then
    raise exception '2a: onamsız velide veli_adi null olmalı: %', satir->'veli_adi';
  end if;
  v := public.yazisma_listesi(jt, 'veli');
  select s into satir
    from jsonb_array_elements(v->'gruplar') g, jsonb_array_elements(g->'satirlar') s
   where s->>'ogrenci_id' = ayse::text;
  if satir is null or satir->>'veli_adi' is not null then
    raise exception '2b: yazisma_listesi onamsız velide ad: %', satir;
  end if;
  raise notice '2 OK — onam vermemiş velinin adı uydurulmuyor (null)';

  -- ---------------------------------------------------------------------------
  -- 3. EN SON YAZILAN AD
  -- ---------------------------------------------------------------------------
  v := public.sinif_velileri(jt, s_sinif);
  select e into satir from jsonb_array_elements(v->'veliler') e
   where e->>'ogrenci_id' = mert::text;
  if satir->>'veli_adi' is distinct from 'Mert''in Annesi' then
    raise exception '3: en son ad bekleniyordu, gelen %', satir->>'veli_adi';
  end if;
  raise notice '3 OK — eski ad ve adsız satır varken en son yazılan ad geliyor';

  -- ---------------------------------------------------------------------------
  -- 4. YALNIZ ESKİ SÜRÜMDE AD: ad görünür, onam yine bekliyor
  -- ---------------------------------------------------------------------------
  select e into satir from jsonb_array_elements(v->'veliler') e
   where e->>'ogrenci_id' = can::text;
  if satir->>'veli_adi' is distinct from 'Can Babası' then
    raise exception '4a: eski sürümdeki ad gelmedi: %', satir->>'veli_adi';
  end if;
  if (satir->>'onam_var')::boolean is not false then
    raise exception '4b: eski sürüm onayı güncel sayıldı';
  end if;
  raise notice '4 OK — eski sürümdeki ad görünüyor, "onam bekliyor" durumu değişmedi';

  -- ---------------------------------------------------------------------------
  -- 5. ÖĞRENCİ KANALINDA AD YOK
  -- ---------------------------------------------------------------------------
  v := public.yazisma_listesi(jt, 'ogrenci');
  select s into satir
    from jsonb_array_elements(v->'gruplar') g, jsonb_array_elements(g->'satirlar') s
   where s->>'ogrenci_id' = ali::text;
  if satir is null or satir->>'veli_adi' is not null then
    raise exception '5a: öğrenci kanalında veli adı: %', satir;
  end if;
  y := public.mesajlar_ogretmen(jt, ali, 'ogrenci');
  if y->'ogrenci'->>'veli_adi' is not null then
    raise exception '5b: öğrenci yazışmasında veli adı: %', y->'ogrenci'->>'veli_adi';
  end if;
  raise notice '5 OK — öğrenci kanalında veli adı dönmüyor';

  -- ---------------------------------------------------------------------------
  -- 6. KAPSAM: atanmamış meslektaş göremiyor
  -- ---------------------------------------------------------------------------
  -- Tekrar çalıştırılabilsin: meslektaş zaten varsa yeniden eklenmiyor.
  if not exists (select 1 from public.ogretmenler where ad = 'Meslektas VeliAdi') then
    perform public.ogretmen_ekle(jt, 'Meslektas VeliAdi', 'VeliAdiMes!2026x');
  end if;
  jm := (public.giris('VeliAdiMes!2026x'))->>'token';

  patladi := false;
  begin
    perform public.sinif_velileri(jm, s_sinif);
  exception when sqlstate '42501' then patladi := true;
  end;
  if not patladi then raise exception '6a: meslektaş sınıfın velilerini gördü'; end if;

  patladi := false;
  begin
    perform public.mesajlar_ogretmen(jm, ali, 'veli');
  exception when sqlstate '42501' then patladi := true;
  end;
  if not patladi then raise exception '6b: meslektaş yazışmayı (ve veli adını) gördü'; end if;

  v := public.yazisma_listesi(jm, 'veli');
  if v::text like '%Ayşe Adlı%' then
    raise exception '6c: meslektaşın Mesajlar listesinde veli adı var';
  end if;
  raise notice '6 OK — atanmamış meslektaş veli adını hiçbir uçtan göremiyor';

  -- ---------------------------------------------------------------------------
  -- 7. _veli_adi İSTEMCİYE KAPALI
  -- ---------------------------------------------------------------------------
  if has_function_privilege('anon', 'public._veli_adi(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public._veli_adi(uuid)', 'execute') then
    raise exception '7: _veli_adi istemciye açık';
  end if;
  raise notice '7 OK — _veli_adi anon/authenticated için kapalı';
end $$;

select 'VELİ ADI TESTLERİ GEÇTİ' as sonuc;
