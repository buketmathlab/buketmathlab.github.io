-- =============================================================================
-- SEKİZ — VAR OLAN ÖDEVİ SONRADAN BAŞKA SINIFLARA VERME (0083)
--
-- Öğretmenin isteği: "10C'ye ödev gönderdim. Bu ödevin aynısını DAHA SONRA
-- istediğim diğer sınıflara da gönderebileyim."
--
-- 0030 bunu yalnız OLUŞTURMA ANINDA yapabiliyordu. 0083 var olan ödeve
-- sonradan sınıf ekliyor: kopyalar taslak, tek tarih, kaynakla kardeş.
--
-- Ölçülen:
--   1. Kopya oluşuyor; alanlar kaynakla aynı, tarih yeni, TASLAK
--   2. grup_id bağlanıyor; kaynağın grubu yoksa KAYNAĞA DA yazılıyor
--   3. tum_sayfalar ve sayfa_limiti KAYNAKTAN (0078 ezmesi yok)
--   4. PDF yolu aynı; yeni sınıfın öğrencisi açabiliyor, yabancı açamıyor
--   5. Kaynağın kendi sınıfı ve GRUPTAKİ sınıf reddediliyor
--   6. Arşivdeki sınıf, başkasının sınıfı, tekrarlı liste reddediliyor
--   7. Geçmiş tarih reddediliyor
--   8. Yetki: başka öğretmen ve öğrenci 42501
--   9. ATOMİK: listede bir geçersiz sınıf varsa HİÇBİR ödev oluşmuyor
--  10. odev_detay.verilebilir_siniflar süzüyor; kopyadan sonra küçülüyor
--
-- Tekrar çalıştırılabilir: adlar ve PIN'ler her çalıştırmada farklı.
-- Hiçbir blokta `exception when others` YOK.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  ek   text := substr(md5(random()::text), 1, 6);
  js text; jx text; jo text; jo_yabanci text;
  s_id uuid; x_id uuid;
  sa uuid; sb uuid; sc uuid; s_arsiv uuid; s_yabanci uuid;
  d uuid; kopya uuid; kod text;
  v jsonb; od jsonb; n integer;
  o_sb uuid; o_yabanci uuid;
  v_yol text; v_anahtar text;
begin
  raise notice '--- Kurulum ---';
  update public.ogretmenler set pin_hash =
    extensions.crypt('Verme!2026', extensions.gen_salt('bf', 10)) where yonetici;
  js := (public.giris('Verme!2026'))->>'token';
  select id into s_id from public.ogretmenler where yonetici;
  x_id := (public.ogretmen_ekle(js, 'Xeda Verme ' || ek, 'XVerme!' || ek))->>'id';
  jx := (public.giris('XVerme!' || ek))->>'token';

  -- Sahibin sınıfları: kaynak + iki hedef.
  insert into public.siniflar (seviye, sube) values (11, 'VA')
    on conflict (seviye, sube) do update set arsiv = false returning id into sa;
  insert into public.siniflar (seviye, sube) values (11, 'VB')
    on conflict (seviye, sube) do update set arsiv = false returning id into sb;
  insert into public.siniflar (seviye, sube) values (11, 'VC')
    on conflict (seviye, sube) do update set arsiv = false returning id into sc;
  insert into public.siniflar (seviye, sube) values (11, 'VD')
    on conflict (seviye, sube) do update set arsiv = true returning id into s_arsiv;
  -- `on conflict do update` YALNIZ çakışmada çalışıyor; ilk çalıştırmada
  -- sınıf arşivsiz kalıyordu ve 6. grup kendi kurulumu yüzünden kırmızı
  -- yanmıştı. Arşiv burada açıkça yazılıyor.
  update public.siniflar set arsiv = true where id = s_arsiv;
  -- SAHİBE ATANMAYAN sınıf: "başkasının sınıfı" ölçümü için.
  insert into public.siniflar (seviye, sube) values (11, 'VE')
    on conflict (seviye, sube) do update set arsiv = false returning id into s_yabanci;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    values (s_id, sa), (s_id, sb), (s_id, sc), (s_id, s_arsiv)
    on conflict do nothing;
  delete from public.ogretmen_siniflari where sinif_id = s_yabanci;

  o_sb := (public.ogrenci_ekle(js, 'VB Öğrencisi ' || ek, 'okul', sb))->>'id';
  kod := (select k.kod from public.giris_kodlari k where k.ogrenci_id = o_sb and k.rol = 'ogrenci');
  jo := (public.giris(kod))->>'token';
  o_yabanci := (public.ogrenci_ekle(js, 'VC Öğrencisi ' || ek, 'okul', sc))->>'id';
  kod := (select k.kod from public.giris_kodlari k where k.ogrenci_id = o_yabanci and k.rol = 'ogrenci');
  jo_yabanci := (public.giris(kod))->>'token';

  -- KAYNAK ÖDEV: iki PDF'li, çok sayfalı test.
  v_yol     := 'odev/' || gen_random_uuid() || '/sorular.pdf';
  v_anahtar := 'odev/' || gen_random_uuid() || '/anahtar.pdf';
  d := (public.odev_olustur(js, 'Köklü Sayılar ' || ek, 'Açıklama', sa, 'test',
        current_date + 7, 2, '{"1":"A","2":"B"}'::jsonb, v_anahtar, v_yol,
        false, 4::smallint, null, 3::smallint))->>'id';
  -- 0078 ÖNCESİ BİR ÖDEVİ TAKLİT EDİYOR: `tum_sayfalar` false. Kopya
  -- kaynaktan daha katı OLMAMALI (3. grup).
  update public.odevler set tum_sayfalar = false where id = d;
  perform public.odev_yayinla(js, d);

  ------------------------------------------------------------------
  raise notice '--- 1. Kopya: alanlar kaynakla aynı, tarih yeni, TASLAK ---';
  v := public.odev_siniflara_kopyala(js, d, jsonb_build_array(sb::text), current_date + 14);
  if jsonb_array_length(v->'odevler') <> 1 then
    raise exception 'HATA 1a: kopya sayısı %', jsonb_array_length(v->'odevler');
  end if;
  kopya := ((v->'odevler')->0->>'odev_id')::uuid;

  if (select baslik from public.odevler where id = kopya)
       <> (select baslik from public.odevler where id = d)
     or (select aciklama from public.odevler where id = kopya) <> 'Açıklama'
     or (select tur from public.odevler where id = kopya) <> 'test'
     or (select soru_sayisi from public.odevler where id = kopya) <> 2
     or (select cevap_anahtari from public.odevler where id = kopya)
          <> '{"1":"A","2":"B"}'::jsonb
     or (select sik_sayisi from public.odevler where id = kopya) <> 4
     or (select gec_teslim from public.odevler where id = kopya) <> false then
    raise exception 'HATA 1b: alanlar kaynaktan kopyalanmadı: %',
      (select to_jsonb(x) from public.odevler x where x.id = kopya);
  end if;
  if (select sinif_id from public.odevler where id = kopya) <> sb then
    raise exception 'HATA 1c: kopya yanlış sınıfta';
  end if;
  if (select son_tarih from public.odevler where id = kopya) <> current_date + 14 then
    raise exception 'HATA 1d: YENİ SON TARİH UYGULANMADI: %',
      (select son_tarih from public.odevler where id = kopya);
  end if;
  -- ÖĞRETMENİN KARARI: kopyalar TASLAK gelir.
  if (select yayinda from public.odevler where id = kopya) then
    raise exception 'HATA 1e: KOPYA DOĞRUDAN YAYINA GİRDİ — öğretmen taslak istedi';
  end if;
  raise notice '    alanlar aynı, tarih yeni, taslak: OK';

  ------------------------------------------------------------------
  raise notice '--- 2. grup_id: kopya ve KAYNAK kardeş oldu ---';
  if (select grup_id from public.odevler where id = kopya) is null then
    raise exception 'HATA 2a: kopyada grup_id yok — kardeşlere yayma çalışmaz';
  end if;
  if (select grup_id from public.odevler where id = d) is null then
    raise exception 'HATA 2b: KAYNAĞA grup_id yazılmadı — yayma düğmesi yalnız kopyada çıkar';
  end if;
  if (select grup_id from public.odevler where id = d)
     <> (select grup_id from public.odevler where id = kopya) then
    raise exception 'HATA 2c: kaynak ve kopya farklı gruplarda';
  end if;
  raise notice '    kaynak ve kopya aynı grupta: OK';

  ------------------------------------------------------------------
  raise notice '--- 3. sayfa kuralı KAYNAKTAN (0078 ezmesi yok) ---';
  if (select sayfa_limiti from public.odevler where id = kopya) <> 3 then
    raise exception 'HATA 3a: sayfa_limiti kopyalanmadı: %',
      (select sayfa_limiti from public.odevler where id = kopya);
  end if;
  if (select tum_sayfalar from public.odevler where id = kopya) then
    raise exception 'HATA 3b: KOPYA KAYNAKTAN KATI — tum_sayfalar 0078''den geldi';
  end if;
  raise notice '    sayfa_limiti 3, tum_sayfalar false: OK';

  ------------------------------------------------------------------
  raise notice '--- 4. PDF yeniden yüklenmiyor; erişim sınıf üyeliğinden ---';
  -- `is distinct from`: yol NULL kalırsa `<>` NULL döner ve iddia SESSİZCE
  -- geçerdi. (Kusur provası gösterdi: yollar null yapıldığında 4a değil,
  -- aşağıdaki erişim ölçümü yandı.)
  if (select odev_url from public.odevler where id = kopya) is distinct from v_yol
     or (select anahtar_url from public.odevler where id = kopya) is distinct from v_anahtar then
    raise exception 'HATA 4a: PDF yolları kopyalanmadı: %',
      (select odev_url from public.odevler where id = kopya);
  end if;
  -- Taslakken kimse göremez (0016 kuralı: yayında olmayan ödevin dosyası yok).
  if public.dosya_erisim_izni(jo, v_yol) then
    raise exception 'HATA 4b: TASLAK ödevin PDF''i öğrenciye açık!';
  end if;
  perform public.odev_yayinla(js, kopya);
  if not public.dosya_erisim_izni(jo, v_yol) then
    raise exception 'HATA 4c: YENİ SINIFIN ÖĞRENCİSİ SORU PDF''İNİ AÇAMIYOR';
  end if;
  if public.dosya_erisim_izni(jo_yabanci, v_yol) then
    raise exception 'HATA 4d: BAŞKA SINIFIN ÖĞRENCİSİ PDF''İ AÇABİLİYOR!';
  end if;
  raise notice '    yol aynı; taslakken kapalı, yayında yalnız o sınıfa açık: OK';

  ------------------------------------------------------------------
  raise notice '--- 5. Kendi sınıfı ve gruptaki sınıf reddediliyor ---';
  begin
    perform public.odev_siniflara_kopyala(js, d, jsonb_build_array(sa::text), current_date + 14);
    raise exception 'HATA 5a: KAYNAĞIN KENDİ SINIFI KABUL EDİLDİ';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.odev_siniflara_kopyala(js, d, jsonb_build_array(sb::text), current_date + 14);
    raise exception 'HATA 5b: GRUPTAKİ SINIFA İKİNCİ KOPYA — öğrenci iki özdeş ödev görürdü';
  exception when invalid_parameter_value then null; end;
  if (select count(*) from public.odevler where grup_id =
        (select grup_id from public.odevler where id = d)) <> 2 then
    raise exception 'HATA 5c: reddedilen çağrı yine de ödev oluşturdu';
  end if;
  raise notice '    ikisi de 22023; fazladan ödev yok: OK';

  ------------------------------------------------------------------
  raise notice '--- 6. Arşiv, başkasının sınıfı, tekrarlı liste ---';
  begin
    perform public.odev_siniflara_kopyala(js, d, jsonb_build_array(s_arsiv::text), current_date + 14);
    raise exception 'HATA 6a: ARŞİVDEKİ SINIFA ÖDEV VERİLDİ';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.odev_siniflara_kopyala(js, d, jsonb_build_array(s_yabanci::text), current_date + 14);
    raise exception 'HATA 6b: KENDİ SINIFI OLMAYAN SINIFA ÖDEV VERİLDİ';
  exception when insufficient_privilege then null; end;
  begin
    perform public.odev_siniflara_kopyala(js, d,
      jsonb_build_array(sc::text, sc::text), current_date + 14);
    raise exception 'HATA 6c: TEKRARLI LİSTE KABUL EDİLDİ';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.odev_siniflara_kopyala(js, d, '[]'::jsonb, current_date + 14);
    raise exception 'HATA 6d: BOŞ LİSTE KABUL EDİLDİ';
  exception when invalid_parameter_value then null; end;
  raise notice '    arşiv ve tekrar 22023, yabancı sınıf 42501: OK';

  ------------------------------------------------------------------
  raise notice '--- 7. Geçmiş tarih reddediliyor ---';
  begin
    perform public.odev_siniflara_kopyala(js, d, jsonb_build_array(sc::text), current_date - 1);
    raise exception 'HATA 7a: GEÇMİŞ TARİH KABUL EDİLDİ — ödev açılmadan kapanırdı';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.odev_siniflara_kopyala(js, d, jsonb_build_array(sc::text), null);
    raise exception 'HATA 7b: TARİHSİZ ÇAĞRI KABUL EDİLDİ';
  exception when invalid_parameter_value then null; end;
  raise notice '    geçmiş ve boş tarih 22023: OK';

  ------------------------------------------------------------------
  raise notice '--- 8. Yetki: başka öğretmen ve öğrenci ---';
  perform public.ogretmen_sinif_ata(js, x_id, jsonb_build_array(sa::text, sc::text));
  begin
    perform public.odev_siniflara_kopyala(jx, d, jsonb_build_array(sc::text), current_date + 14);
    raise exception 'HATA 8a: BAŞKA ÖĞRETMEN ÖDEVİ KOPYALADI';
  exception when insufficient_privilege then null; end;
  begin
    perform public.odev_siniflara_kopyala(jo, d, jsonb_build_array(sc::text), current_date + 14);
    raise exception 'HATA 8b: ÖĞRENCİ ÖDEVİ KOPYALADI';
  exception when insufficient_privilege then null; end;
  raise notice '    ikisi de 42501: OK';

  ------------------------------------------------------------------
  -- ----------------------------------------------------------------
  -- 9. ATOMİKLİK — BU İDDİANIN NEYİ KORUDUĞU DÜRÜSTÇE YAZILIYOR
  --
  -- Kusur provası denendi ve ISIRMADI; sebebi öğretici: atomikliği bu
  -- dosyadaki kod DEĞİL, işlemin geri alması sağlıyor (0030'un notu). Ön
  -- denetim döngüsü de yaratma döngüsünün hiç yarıda kalmamasını
  -- sağlıyor. Yani tek bir kusurla kırılamıyor:
  --   • ön denetim döngüden sonraya alınsa → hata yine geri alır,
  --   • döngüde hata yutulsa → ön denetim zaten geçersiz sınıfı eler.
  --
  -- İddia yine de duruyor, çünkü İKİSİ BİRDEN bozulursa (ör. ileride
  -- sınıf başına `begin/exception` eklenip ön denetim gevşetilirse)
  -- öğretmen yarım bir kopyalama görürdü. Ölçümün neyi yakalayıp neyi
  -- yakalamadığı burada yazılı olsun ki yeşili yanlış okunmasın.
  -- ----------------------------------------------------------------
  raise notice '--- 9. ATOMİK: biri geçersizse hiçbiri oluşmuyor ---';
  select count(*) into n from public.odevler
   where grup_id = (select grup_id from public.odevler where id = d);
  begin
    -- sc geçerli, arşivdeki sınıf geçersiz: ikisi birlikte verilince
    -- HİÇBİRİ oluşmamalı.
    perform public.odev_siniflara_kopyala(js, d,
      jsonb_build_array(sc::text, s_arsiv::text), current_date + 14);
    raise exception 'HATA 9a: geçersiz sınıf içeren liste kabul edildi';
  exception when invalid_parameter_value then null; end;
  if (select count(*) from public.odevler
       where grup_id = (select grup_id from public.odevler where id = d)) <> n then
    raise exception 'HATA 9b: YARIM KOPYALAMA — % iken % oldu', n,
      (select count(*) from public.odevler
        where grup_id = (select grup_id from public.odevler where id = d));
  end if;
  if exists (select 1 from public.odevler where sinif_id = sc
              and grup_id = (select grup_id from public.odevler where id = d)) then
    raise exception 'HATA 9c: geçerli sınıfın ödevi oluşmuş — işlem atomik değil';
  end if;
  raise notice '    hiçbir ödev oluşmadı: OK';

  ------------------------------------------------------------------
  raise notice '--- 10. verilebilir_siniflar süzüyor ---';
  od := public.odev_detay(js, d);
  if od->'verilebilir_siniflar' = 'null'::jsonb then
    raise exception 'HATA 10a: verilebilir_siniflar hiç gelmiyor';
  end if;
  if exists (select 1 from jsonb_array_elements(od->'verilebilir_siniflar') x
              where (x->>'id')::uuid = sa) then
    raise exception 'HATA 10b: KAYNAĞIN KENDİ SINIFI listede';
  end if;
  if exists (select 1 from jsonb_array_elements(od->'verilebilir_siniflar') x
              where (x->>'id')::uuid = sb) then
    raise exception 'HATA 10c: ZATEN VERİLMİŞ SINIF listede — ikinci kopya önerilir';
  end if;
  if exists (select 1 from jsonb_array_elements(od->'verilebilir_siniflar') x
              where (x->>'id')::uuid in (s_arsiv, s_yabanci)) then
    raise exception 'HATA 10d: arşiv ya da yabancı sınıf listede';
  end if;
  if not exists (select 1 from jsonb_array_elements(od->'verilebilir_siniflar') x
                  where (x->>'id')::uuid = sc) then
    raise exception 'HATA 10e: verilebilecek sınıf (sc) listede yok';
  end if;

  -- Kopyaladıktan sonra liste küçülüyor.
  n := jsonb_array_length(od->'verilebilir_siniflar');
  perform public.odev_siniflara_kopyala(js, d, jsonb_build_array(sc::text), current_date + 14);
  od := public.odev_detay(js, d);
  if jsonb_array_length(od->'verilebilir_siniflar') <> n - 1 then
    raise exception 'HATA 10f: kopyadan sonra liste küçülmedi (% → %)',
      n, jsonb_array_length(od->'verilebilir_siniflar');
  end if;
  raise notice '    kaynak, kardeş, arşiv ve yabancı sınıf yok; kopyadan sonra küçüldü: OK';

  raise notice '';
  raise notice '=========================================';
  raise notice 'SINIFLARA VERME TESTLERİ: 10 GRUP GEÇTİ';
  raise notice '=========================================';
end;
$$;
