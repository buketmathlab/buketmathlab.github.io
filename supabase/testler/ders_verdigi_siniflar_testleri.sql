-- =============================================================================
-- SEKİZ — "DERS VERDİĞİM SINIFLAR" (0092)
--
-- Öğretmenin düzeltmesi: "Zaten her sınıfın bir öğretmeni var. Ama ben sahip
-- olduğum için tüm sınıflar bende var gözüküyor. Fakat benim girdiğim sınıflar
-- 9A, 9B, 10C, 11C."
--
-- 0033'ün taşıması bütün sınıfları sahibe bağladı, yani sahip için
-- `ogretmen_siniflari` ERİŞİM kaydı; diğer öğretmenlerde erişim ile ders aynı
-- şey. 0091'in künyesi bu ayrımı bilmediği için başka bir öğretmenin sınıfında
-- sahibin adını da basıyordu — VELİYE GİDEN KÂĞITTA YANLIŞ BİLGİ.
--
-- Ölçülen:
--   1.  Sütun var ve varsayılanı `true` (diğer öğretmenler etkilenmiyor)
--   2.  TAŞIMA: sahibin bütün kayıtları `false`
--   3.  KÜNYE SÜZGECİ: ders vermediği sınıfta sahibin adı listede YOK
--   4.  İşaret açılınca ad listeye GERİ GELİYOR
--   5.  Yönetici olmayan öğretmen varsayılanla listede
--   6.  `ogretmen_ders_siniflari_ayarla` — yetki kapısı ve atanmamış sınıf
--   7.  `ogretmen_sinif_ata` ders işaretini KORUYOR (delete+insert tuzağı)
--   8.  Yeni atanan sınıf: yöneticide `false`, öğretmende `true`
--   9.  Değişiklik denetim izi bırakıyor (Part XLIII)
--
-- Tekrar çalıştırılabilir. Hiçbir blokta `exception when others` YOK.
--
-- -----------------------------------------------------------------------------
-- KUSUR PROVALARI — HER KAPI GERÇEKTEN ISIRIYOR MU (ölçüldü)
--
--   W1  `sinif_not_cizelgesi`ten `os.ders_veriyor` süzgeci çıkarılıyor
--         → 3b ısırdı: "sahip ders vermediği sınıfın künyesinde ÇIKTI"
--         (0092'nin öz-denetimi de ayrıca bağırdı: "künye ders süzgecini
--          uygulamıyor" — iki ayrı kapı, ikisi de yakaladı)
--   W2  `ogretmen_sinif_ata`nın `v_ders` koruması siliniyor (0033'teki
--       sade delete+insert'e dönülüyor)
--         → 7b ısırdı: "atama sonrası ders işareti true'ya döndü"
--         Bu kusur SESSİZ olurdu: sahip ayarını yapar, bir ay sonra bir
--         sınıf atar, künye yine yanlış ad basmaya başlardı.
--   W3  Taşıma bloğu atlanıyor (sahibin kayıtları `true` kalıyor)
--         → 0092 HİÇ UYGULANMADI: öz-denetim "sahibin ders işareti
--           taşımada temizlenmemiş" diye patladı ve zincir orada durdu.
--
-- BU SÜİT BİR KUSUR BULDU. İlk yazımda yalnız `ogretmen_sinif_ata`
-- düzeltilmişti; `sinif_ekle` de yöneticiyi her yeni sınıfa bağlıyor ve
-- ders işareti varsayılanla `true` geliyordu. 2. grup "sahibin 75 kaydı
-- hâlâ ders_veriyor" diye bağırdı. Arka kapı 0092'de kapatıldı.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  ek   text := substr(md5(random()::text), 1, 6);
  jt   text;
  s_id uuid;
  o_id uuid;          -- yönetici OLMAYAN öğretmen
  v_x  uuid;          -- sahibin ders verdiği sınıf
  v_y  uuid;          -- sahibin yalnız eriştiği sınıf
  c    jsonb;
  n    integer;
  adlar text;
begin
  raise notice '--- Kurulum ---';
  update public.ogretmenler set pin_hash =
    extensions.crypt('Ders!2026', extensions.gen_salt('bf', 10)) where yonetici;
  jt := (public.giris('Ders!2026'))->>'token';
  select id into s_id from public.ogretmenler where yonetici;

  insert into public.siniflar (seviye, sube) values (9, 'X')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_x;
  insert into public.siniflar (seviye, sube) values (9, 'Y')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_y;

  -- Sahip İKİSİNE DE kayıtlı (0033 taşımasının gerçek hâli), ama yalnız
  -- birinin dersine giriyor.
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    values (s_id, v_x), (s_id, v_y) on conflict do nothing;
  update public.ogretmen_siniflari set ders_veriyor = (sinif_id = v_x)
   where ogretmen_id = s_id and sinif_id in (v_x, v_y);

  -- =========================================================================
  raise notice '--- 1. Sütun ve varsayılanı ---';
  -- =========================================================================
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'ogretmen_siniflari'
       and column_name = 'ders_veriyor' and is_nullable = 'NO'
  ) then
    raise exception '1a: ders_veriyor sütunu yok ya da null kabul ediyor';
  end if;
  if (select column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'ogretmen_siniflari'
         and column_name = 'ders_veriyor') is distinct from 'true' then
    raise exception '1b: varsayılan true değil — öbür öğretmenlerin davranışı değişir';
  end if;
  raise notice '    sütun var, varsayılan true: OK';

  -- =========================================================================
  raise notice '--- 2. Sahibe YENİ gelen sınıf ders işareti almıyor ---';
  -- =========================================================================
  -- TAŞIMANIN KENDİSİ BURADA ÖLÇÜLEMEZ: migration zinciri koştuktan sonra
  -- öbür test dosyaları sınıf ekliyor, dolayısıyla "sahibin bütün kayıtları
  -- false mu" sorusu bu noktada anlamını yitiriyor. Taşımayı 0092'nin kendi
  -- öz-denetimi ölçüyor ve temizlenmemişse migration HİÇ UYGULANMIYOR.
  --
  -- Burada ölçülen şey ARKA KAPI: sahip yeni bir sınıf açtığında ders
  -- işareti gelmemeli. İlk yazımda `sinif_ekle` atlanmıştı ve bu grup
  -- "sahibin 75 kaydı hâlâ ders_veriyor" diye bağırarak onu buldu.
  declare
    v_yeni uuid;
  begin
    delete from public.siniflar where seviye = 9 and sube = 'W';
    v_yeni := (public.sinif_ekle(jt, 9::smallint, 'W'))->>'id';
    if (select ders_veriyor from public.ogretmen_siniflari
         where ogretmen_id = s_id and sinif_id = v_yeni) then
      raise exception '2a: sahibin açtığı yeni sınıf ders_veriyor=true geldi';
    end if;
    raise notice '    sinif_ekle ders işareti yazmıyor: OK';
  end;

  -- =========================================================================
  raise notice '--- 3. Künye süzgeci: ders vermediği sınıfta ad YOK ---';
  -- =========================================================================
  c := public.sinif_not_cizelgesi(jt, v_x);
  adlar := c->'sinif'->>'ogretmenler';
  if adlar not like '%' || (select ad from public.ogretmenler where id = s_id) || '%' then
    raise exception '3a: ders VERDİĞİ sınıfta sahibin adı künyede yok — süzgeç fazla kesiyor';
  end if;
  raise notice '    ders verdiği sınıfta ad var: OK (%)', adlar;

  c := public.sinif_not_cizelgesi(jt, v_y);
  adlar := c->'sinif'->>'ogretmenler';
  if adlar like '%' || (select ad from public.ogretmenler where id = s_id) || '%' then
    raise exception '3b: sahip ders vermediği sınıfın künyesinde ÇIKTI: %', adlar;
  end if;
  if adlar <> '[]' then
    raise exception '3b: ders vermediği sınıfta künye boş olmalıydı, gelen: %', adlar;
  end if;
  raise notice '    ders vermediği sınıfta künye boş: OK';

  -- =========================================================================
  raise notice '--- 4. İşaret açılınca ad geri geliyor ---';
  -- =========================================================================
  perform public.ogretmen_ders_siniflari_ayarla(
    jt, s_id, jsonb_build_array(v_x::text, v_y::text));
  c := public.sinif_not_cizelgesi(jt, v_y);
  if (c->'sinif'->>'ogretmenler') = '[]' then
    raise exception '4a: işaret açıldı ama künye hâlâ boş';
  end if;
  raise notice '    işaret açılınca ad künyede: OK';

  -- Geri al: sonraki ölçümler "yalnız v_x" hâliyle devam etsin.
  perform public.ogretmen_ders_siniflari_ayarla(jt, s_id, jsonb_build_array(v_x::text));

  -- =========================================================================
  raise notice '--- 5. Yönetici OLMAYAN öğretmen varsayılanla listede ---';
  -- =========================================================================
  o_id := (public.ogretmen_ekle(jt, 'Ders Öğretmeni ' || ek, 'Ogretmen!2026'))->>'id';
  perform public.ogretmen_sinif_ata(jt, o_id, jsonb_build_array(v_y::text));
  if not (select ders_veriyor from public.ogretmen_siniflari
           where ogretmen_id = o_id and sinif_id = v_y) then
    raise exception '5a: yönetici olmayan öğretmenin yeni sınıfı ders_veriyor=false geldi';
  end if;
  c := public.sinif_not_cizelgesi(jt, v_y);
  if (c->'sinif'->>'ogretmenler') not like '%Ders Öğretmeni%' then
    raise exception '5b: öğretmenin adı künyede yok: %', c->'sinif'->>'ogretmenler';
  end if;
  raise notice '    öğretmen varsayılanla künyede, sahip değil: OK (%)',
               c->'sinif'->>'ogretmenler';

  -- =========================================================================
  raise notice '--- 6. Yeni ucun kapıları ---';
  -- =========================================================================
  -- ATANMAMIŞ SINIF İŞARETLENEMEZ.
  begin
    perform public.ogretmen_ders_siniflari_ayarla(
      jt, o_id, jsonb_build_array(v_x::text));
    raise exception '6a: atanmamış sınıf işaretlenebildi';
  exception when sqlstate '42501' then
    raise notice '    atanmamış sınıf reddedildi: OK';
  end;

  -- DİZİ OLMAYAN GİRDİ.
  begin
    perform public.ogretmen_ders_siniflari_ayarla(jt, o_id, '"hepsi"'::jsonb);
    raise exception '6b: dizi olmayan girdi kabul edildi';
  exception when sqlstate '22023' then
    raise notice '    dizi olmayan girdi reddedildi: OK';
  end;

  -- SAHİP OLMAYAN ÇAĞIRAMAZ: öğretmen kendi token'ıyla deneniyor.
  declare
    jo text;
  begin
    update public.ogretmenler set pin_hash =
      extensions.crypt('Ogretmen!2026', extensions.gen_salt('bf', 10)) where id = o_id;
    jo := (public.giris('Ogretmen!2026'))->>'token';
    begin
      perform public.ogretmen_ders_siniflari_ayarla(jo, o_id, jsonb_build_array(v_y::text));
      raise exception '6c: öğretmen kendi ders listesini değiştirebildi';
    exception when sqlstate '42501' then
      raise notice '    sahip olmayan reddedildi: OK';
    end;
  end;

  -- =========================================================================
  raise notice '--- 7. ogretmen_sinif_ata ders işaretini KORUYOR ---';
  -- =========================================================================
  -- Sahibin bugünkü hâli: v_x ders, v_y değil. Sınıf ataması bu ayarı
  -- SİLMEMELİ — `delete` + `insert` deseninin sessiz tuzağı buydu.
  perform public.ogretmen_sinif_ata(jt, s_id, jsonb_build_array(v_x::text, v_y::text));
  if not (select ders_veriyor from public.ogretmen_siniflari
           where ogretmen_id = s_id and sinif_id = v_x) then
    raise exception '7a: atama sonrası ders işareti KAYBOLDU';
  end if;
  if (select ders_veriyor from public.ogretmen_siniflari
       where ogretmen_id = s_id and sinif_id = v_y) then
    raise exception '7b: atama sonrası ders işareti true''ya döndü — ayar sessizce silindi';
  end if;
  raise notice '    atama ders işaretini bozmadı: OK';

  -- =========================================================================
  raise notice '--- 8. Yeni atanan sınıf: yöneticide false, öğretmende true ---';
  -- =========================================================================
  declare
    v_z uuid;
  begin
    insert into public.siniflar (seviye, sube) values (9, 'Z')
      on conflict (seviye, sube) do update set arsiv = false returning id into v_z;
    perform public.ogretmen_sinif_ata(
      jt, s_id, jsonb_build_array(v_x::text, v_y::text, v_z::text));
    if (select ders_veriyor from public.ogretmen_siniflari
         where ogretmen_id = s_id and sinif_id = v_z) then
      raise exception '8a: sahibe yeni atanan sınıf ders_veriyor=true geldi';
    end if;
    perform public.ogretmen_sinif_ata(jt, o_id, jsonb_build_array(v_y::text, v_z::text));
    if not (select ders_veriyor from public.ogretmen_siniflari
             where ogretmen_id = o_id and sinif_id = v_z) then
      raise exception '8b: öğretmene yeni atanan sınıf ders_veriyor=false geldi';
    end if;
    raise notice '    yeni sınıf yöneticide false, öğretmende true: OK';
  end;

  -- =========================================================================
  raise notice '--- 9. Denetim izi (Part XLIII) ---';
  -- =========================================================================
  perform public.ogretmen_ders_siniflari_ayarla(jt, s_id, jsonb_build_array(v_x::text));
  select count(*) into n from public.denetim_izi
   where islem = 'ders_siniflari_degisti' and kayit_id = s_id;
  if n = 0 then
    raise exception '9a: ders listesi değişikliği iz bırakmadı';
  end if;
  raise notice '    değişiklik iz bıraktı: OK';

  raise notice '';
  raise notice 'DERS VERDİĞİ SINIFLAR TESTLERİ GEÇTİ (9 grup)';
end $$;
