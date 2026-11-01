-- =============================================================================
-- SEKİZ — YAYARKEN SON TARİH DE TAŞINSIN TESTLERİ (0088)
--
-- Öğretmenin bildirimi: "Bir sınıfa yaptığım değişiklik diğer şubelere de
-- uygulansın dediğimde uygulanmıyor. Her şubeyi tek tek düzeltmem
-- gerekiyor." Sebep kırık kod değildi: `odev_kardeslere_yay` 0031'den beri
-- son tarihi BİLEREK taşımıyordu. 0088 onu seçenekli yaptı, varsayılan
-- AÇIK.
--
-- BU DOSYANIN ASIL SORUSU ÜÇ TANE:
--
--   1. Varsayılan gerçekten AÇIK mı — üçüncü argüman hiç verilmeden
--      (önbellekteki eski istemcinin şekli) tarih taşınıyor mu? 2. grup.
--   2. Kapatılabiliyor mu — `p_son_tarih_de => false` tarihi yerinde
--      bırakıyor mu? 3. grup.
--   3. Kardeş şubedeki ÖĞRENCİ tarihin değiştiğini görüyor mu? 0085'in
--      "uzatıldı" rozeti `kardeslere_yayildi` izini saymasaydı tarih
--      SESSİZCE değişirdi. 8. grup.
--
-- KAPSAM GENİŞLEMESİN: geç teslim, yayında ve sınıf hâlâ TAŞINMIYOR
-- (öğretmenin kararı). 4. grup bunu üç yönlü ölçüyor; kapsam bir gün
-- sessizce genişlerse orada kırılır.
--
-- NOT: hiçbir blokta `exception when others` YOK — böyle bir yakalayıcı
-- kendinden önceki grupların hatalarını yutar (0022'de yapılan hata).
--
-- SAYILAR FARK OLARAK ÖLÇÜLÜYOR; süit bütün dosyaları aynı veritabanında
-- koşturuyor ve mutlak sayı varsayımı 0022'de kırılmıştı.
--
-- İZOLASYON: 12TA, 12TB, 12TC ve (arşivli) 12TY bu dosyaya ait; başka
-- hiçbir test dosyası bu şubeleri kullanmıyor.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt      text;
  v_a uuid; v_b uuid; v_c uuid; v_y uuid;
  d_a uuid; d_b uuid; d_c uuid; d_y uuid;
  v       jsonb;
  o       jsonb;
  t       jsonb;
  kaynak_tarih date;
  b_tarih date; c_tarih date; y_tarih date;
  eski_gec boolean; eski_yayin boolean; eski_grup uuid;
  n integer;
begin
  update public.ogretmenler
     set pin_hash = extensions.crypt('Tarih!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Tarih!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (12, 'TA')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_a;
  insert into public.siniflar (seviye, sube) values (12, 'TB')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_b;
  insert into public.siniflar (seviye, sube) values (12, 'TC')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_c;
  -- 12TY ÖNCE AKTİF: `odevler_coklu_olustur` arşivdeki sınıfı reddediyor
  -- (0016), kardeşi ancak aktifken kurup sonra arşivleyebiliriz.
  insert into public.siniflar (seviye, sube) values (12, 'TY')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_y;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    select g.id, s from public.ogretmenler g, unnest(array[v_a, v_b, v_c, v_y]) s
    where g.yonetici
    on conflict do nothing;

  -- ===========================================================================
  raise notice '--- 1. Dört şubeye tek ödev; hepsi yayında, 12TY arşivde ---';
  -- ===========================================================================
  v := public.odevler_coklu_olustur(
         jt, jsonb_build_array(v_a, v_b, v_c, v_y),
         'Integral — 0088', 'İlk hâli', 'test', current_date + 7,
         2, '{"1":"A","2":"B"}'::jsonb,
         'odev/kardes-0088/anahtar-v1.pdf', 'odev/kardes-0088/sorular-v1.pdf',
         true, 5::smallint, null, 3::smallint);
  select (e ->> 'odev_id')::uuid into d_a from jsonb_array_elements(v -> 'odevler') e
   where (e ->> 'sinif_id')::uuid = v_a;
  select (e ->> 'odev_id')::uuid into d_b from jsonb_array_elements(v -> 'odevler') e
   where (e ->> 'sinif_id')::uuid = v_b;
  select (e ->> 'odev_id')::uuid into d_c from jsonb_array_elements(v -> 'odevler') e
   where (e ->> 'sinif_id')::uuid = v_c;
  select (e ->> 'odev_id')::uuid into d_y from jsonb_array_elements(v -> 'odevler') e
   where (e ->> 'sinif_id')::uuid = v_y;
  if d_a is null or d_b is null or d_c is null or d_y is null then
    raise exception '1a BAŞARISIZ — dört şubenin hepsine ödev açılmadı';
  end if;
  perform public.odev_yayinla(jt, d_a);
  perform public.odev_yayinla(jt, d_b);
  perform public.odev_yayinla(jt, d_c);
  perform public.odev_yayinla(jt, d_y);
  -- Yayın izi GERİYE ALINIYOR: `now()` işlem boyunca DONUK, yani yayın ile
  -- yayma aynı saniyeye düşer. `_odev_tarihleri` "yayından SONRA" diye
  -- ayırdığı için sıralamayı tesadüfe bırakmıyoruz (0085'in dersi).
  update public.denetim_izi set zaman = zaman - interval '2 hours'
   where tablo = 'odevler' and islem = 'odev_yayinlandi'
     and kayit_id in (d_a, d_b, d_c, d_y);
  update public.siniflar set arsiv = true where id = v_y;
  raise notice '1 OK — 12TA/TB/TC/TY kardeş, hepsi yayında, 12TY arşivlendi';

  -- ===========================================================================
  raise notice '--- 2. VARSAYILAN AÇIK: üçüncü argüman verilmeden tarih taşınıyor ---';
  -- ===========================================================================
  -- Kardeşlerin tarihi bilerek FARKLILAŞTIRILIYOR: taşınmasaydı bu değerler
  -- yerinde kalırdı. Ölçüm "zaten aynıydı" diye yeşil veremesin.
  update public.odevler set son_tarih = current_date + 2 where id in (d_b, d_c, d_y);
  update public.odevler set son_tarih = current_date + 21 where id = d_a;
  select son_tarih into kaynak_tarih from public.odevler where id = d_a;

  -- ÜÇÜNCÜ ARGÜMAN YOK — önbellekteki eski istemcinin çağrı şekli.
  v := public.odev_kardeslere_yay(jt, d_a);

  select son_tarih into b_tarih from public.odevler where id = d_b;
  select son_tarih into c_tarih from public.odevler where id = d_c;
  if b_tarih <> kaynak_tarih or c_tarih <> kaynak_tarih then
    raise exception '2a BAŞARISIZ — son tarih taşınmadı: 12TB=%, 12TC=% (kaynak %)',
      b_tarih, c_tarih, kaynak_tarih;
  end if;
  raise notice '2 OK — argümansız çağrıda son tarih iki kardeşe de taşındı';

  -- ===========================================================================
  raise notice '--- 3. KAPATILABİLİYOR: p_son_tarih_de => false ---';
  -- ===========================================================================
  update public.odevler set son_tarih = current_date + 2 where id in (d_b, d_c);
  update public.odevler set son_tarih = current_date + 30 where id = d_a;

  v := public.odev_kardeslere_yay(jt, d_a, false);

  if (select son_tarih from public.odevler where id = d_b) <> current_date + 2
     or (select son_tarih from public.odevler where id = d_c) <> current_date + 2 then
    raise exception '3a BAŞARISIZ — kapalıyken son tarih yine de taşındı';
  end if;
  -- Kapalıyken İÇERİK yine taşınmalı: kutu yalnız tarihi kapatıyor.
  update public.odevler set baslik = 'Integral — v2' where id = d_a;
  perform public.odev_kardeslere_yay(jt, d_a, false);
  if (select baslik from public.odevler where id = d_b) <> 'Integral — v2' then
    raise exception '3b BAŞARISIZ — kutu kapalıyken içerik de taşınmadı';
  end if;
  raise notice '3 OK — kapalıyken tarih yerinde, içerik yine taşınıyor';

  -- ===========================================================================
  raise notice '--- 4. KAPSAM GENİŞLEMEDİ: geç teslim, yayında, sınıf, grup ---';
  -- ===========================================================================
  update public.odevler set gec_teslim = false, yayinda = false where id = d_b;
  select gec_teslim, yayinda, grup_id into eski_gec, eski_yayin, eski_grup
    from public.odevler where id = d_b;
  update public.odevler set gec_teslim = true, yayinda = true where id = d_a;

  perform public.odev_kardeslere_yay(jt, d_a);

  if (select gec_teslim from public.odevler where id = d_b) is distinct from eski_gec then
    raise exception '4a BAŞARISIZ — GEÇ TESLİM taşındı, taşınmamalıydı';
  end if;
  if (select yayinda from public.odevler where id = d_b) is distinct from eski_yayin then
    raise exception '4b BAŞARISIZ — YAYINDA durumu taşındı, taşınmamalıydı';
  end if;
  if (select sinif_id from public.odevler where id = d_b) <> v_b then
    raise exception '4c BAŞARISIZ — SINIF değişti, hiçbir koşulda değişmemeliydi';
  end if;
  if (select grup_id from public.odevler where id = d_b) is distinct from eski_grup then
    raise exception '4d BAŞARISIZ — grup_id değişti';
  end if;
  update public.odevler set yayinda = true where id = d_b;
  raise notice '4 OK — geç teslim, yayında, sınıf ve grup yerinde';

  -- ===========================================================================
  raise notice '--- 5. İÇERİK TAŞINMAYA DEVAM EDİYOR (0031 bozulmadı) ---';
  -- ===========================================================================
  update public.odevler
     set baslik = 'Integral — v3', aciklama = 'Düzeltildi',
         cevap_anahtari = '{"1":"C","2":"B"}'::jsonb, sik_sayisi = 4,
         sayfa_limiti = 6, konular = '{"1":"Integral","2":"Alan"}'::jsonb,
         anahtar_url = 'odev/kardes-0088/anahtar-v3.pdf',
         odev_url = 'odev/kardes-0088/sorular-v3.pdf'
   where id = d_a;

  perform public.odev_kardeslere_yay(jt, d_a);

  select to_jsonb(x) into o from (
    select baslik, aciklama, cevap_anahtari, sik_sayisi, sayfa_limiti,
           konular, anahtar_url, odev_url
      from public.odevler where id = d_b) x;
  if (o ->> 'baslik') <> 'Integral — v3' or (o ->> 'aciklama') <> 'Düzeltildi'
     or (o -> 'cevap_anahtari') <> '{"1":"C","2":"B"}'::jsonb
     or (o ->> 'sik_sayisi') <> '4' or (o ->> 'sayfa_limiti') <> '6'
     or (o -> 'konular') <> '{"1":"Integral","2":"Alan"}'::jsonb
     or (o ->> 'anahtar_url') <> 'odev/kardes-0088/anahtar-v3.pdf'
     or (o ->> 'odev_url') <> 'odev/kardes-0088/sorular-v3.pdf' then
    raise exception '5a BAŞARISIZ — içerik eksik taşındı: %', o::text;
  end if;
  raise notice '5 OK — başlık, anahtar, şık, sayfa, konular ve iki PDF taşındı';

  -- ===========================================================================
  raise notice '--- 6. ARŞİVDEKİ KARDEŞ: atlanıyor VE tarihi dokunulmuyor ---';
  -- ===========================================================================
  select son_tarih into y_tarih from public.odevler where id = d_y;
  update public.odevler set son_tarih = current_date + 45 where id = d_a;

  v := public.odev_kardeslere_yay(jt, d_a);

  select e into o from jsonb_array_elements(v) e where e ->> 'sinif' = '12TY';
  if o is null then
    raise exception '6a BAŞARISIZ — arşivdeki kardeş raporda hiç yok (sessiz atlama)';
  end if;
  if (o ->> 'atlandi') <> 'arsiv' then
    raise exception '6b BAŞARISIZ — arşiv atlaması raporda yazmıyor: %', o::text;
  end if;
  if (select son_tarih from public.odevler where id = d_y) <> y_tarih then
    raise exception '6c BAŞARISIZ — ARŞİVDEKİ kardeşin tarihi değişti';
  end if;
  -- Raporun ŞEKLİ her satırda aynı olmalı: atlanan satırda da alanlar var.
  if not (o ? 'son_tarih_eski') or not (o ? 'son_tarih_yeni') then
    raise exception '6d BAŞARISIZ — atlanan satırda tarih alanları yok: %', o::text;
  end if;
  raise notice '6 OK — arşivdeki kardeş atlandı, tarihi yerinde, rapor şekli aynı';

  -- ===========================================================================
  raise notice '--- 7. RAPOR tarihi söylüyor; değişmediyse null ---';
  -- ===========================================================================
  -- 6. gruptaki çağrı 12TB''yi current_date+45''e çekmişti; raporu oradan oku.
  select e into o from jsonb_array_elements(v) e where e ->> 'sinif' = '12TB';
  if (o ->> 'son_tarih_yeni')::date <> current_date + 45 then
    raise exception '7a BAŞARISIZ — rapor yeni tarihi söylemiyor: %', o::text;
  end if;
  if (o ->> 'son_tarih_eski') is null then
    raise exception '7b BAŞARISIZ — rapor eski tarihi söylemiyor: %', o::text;
  end if;

  -- Aynı çağrı ikinci kez: tarih artık DEĞİŞMİYOR → iki alan da null.
  v := public.odev_kardeslere_yay(jt, d_a);
  select e into o from jsonb_array_elements(v) e where e ->> 'sinif' = '12TB';
  if (o ->> 'son_tarih_eski') is not null or (o ->> 'son_tarih_yeni') is not null then
    raise exception '7c BAŞARISIZ — tarih değişmediği hâlde rapor "değişti" dedi: %',
      o::text;
  end if;
  raise notice '7 OK — rapor yalnız gerçekten değişince tarihi söylüyor';

  -- ===========================================================================
  raise notice '--- 8. 0085 ROZETİ KARDEŞTE: öğrenci uzatmayı GÖRÜYOR ---';
  -- ===========================================================================
  -- Bu grup 0088''in asıl riski. `_odev_tarihleri` yalnız
  -- `odev_guncellendi` saysaydı kardeş şubedeki öğrenci tarihin
  -- değiştiğini HİÇ görmez, sessizce yeni tarihi bulurdu.
  t := (public.odev_detay(jt, d_b)) -> 'tarihler';
  if t is null or t = 'null'::jsonb then
    raise exception '8a BAŞARISIZ — kardeşin tarihler alanı hiç gelmedi';
  end if;
  if (t ->> 'yon') <> 'uzatildi' then
    raise exception '8b BAŞARISIZ — yayma ile uzatılan tarih "uzatildi" demiyor: %',
      t::text;
  end if;
  if (t ->> 'ilk_son_tarih') is null then
    raise exception '8c BAŞARISIZ — ilk son tarih yok: %', t::text;
  end if;
  if (t ->> 'son_tarih')::date <> current_date + 45 then
    raise exception '8d BAŞARISIZ — bugünkü son tarih yanlış: %', t::text;
  end if;
  if (t ->> 'degisiklik')::integer < 1 then
    raise exception '8e BAŞARISIZ — değişiklik sayısı 0: %', t::text;
  end if;
  raise notice '8 OK — kardeş şubede uzatma GÖRÜNÜYOR (ilk tarih %, yön uzatildi)',
    t ->> 'ilk_son_tarih';

  -- ===========================================================================
  raise notice '--- 9. Kapılar duruyor + zincirin sonu ---';
  -- ===========================================================================
  -- Kardeşi olmayan ödevde SESSİZ "tamam" yok.
  declare
    d_tek uuid;
  begin
    d_tek := (public.odev_olustur(jt, 'Tek şube 0088', null, v_a, 'acik',
                current_date + 5, null, null, null, null, true, null, null,
                1::smallint)) ->> 'id';
    begin
      perform public.odev_kardeslere_yay(jt, d_tek);
      raise exception '9a BAŞARISIZ — kardeşsiz ödevde yayma sessizce geçti';
    exception when sqlstate '22023' then
      null;
    end;
  end;
  -- Üçüncü argümanla da aynı kapı çalışıyor (yeni imza kapıyı atlatmıyor).
  select count(*) into n from public.uygulanan_migrationlar where dosya = '0088';
  if n <> 1 then
    raise exception '9b BAŞARISIZ — 0088 kaydı yok';
  end if;
  raise notice '9 OK — kardeşsiz ödev reddediliyor, zincir 0088''de';

  raise notice '=== 0088 kardeş son tarihi: 9 grubun hepsi geçti ===';
end $$;
