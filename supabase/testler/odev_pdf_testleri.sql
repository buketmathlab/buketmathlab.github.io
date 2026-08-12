-- =============================================================================
-- SEKİZ — 0007 ÖDEV PDF'İ DAVRANIŞ TESTLERİ
--
-- İki dosyanın görünürlüğü FARKLI ve bu farkın doğru olduğunu ölçüyoruz:
--
--   odev_url     → sınıfındaki öğrenci, YAYINDAKİ ödevde, teslim etmeden görür
--   anahtar_url  → öğrenci YALNIZ teslim ettikten sonra; veli asla
--
-- Ayrıca imza değişikliğinin güvenlik sonucu ölçülüyor: eski `odev_olustur`
-- sürümü ortada kalmamalı, çünkü 0005'te ona EXECUTE hakkı verilmişti.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  t_ogretmen text;
  t_ogrenci  text;
  t_veli     text;
  v_sinif_a  uuid;
  v_sinif_b  uuid;
  v_ogrenci  uuid;
  v_odev     uuid;
  v_taslak   uuid;
  v_baska    uuid;
  r          jsonb;
  d_odev     jsonb;
  n          integer;
begin
  raise notice '--- Kurulum ---';
  update public.ayarlar set ogretmen_pin_hash = null where id = 1;
  t_ogretmen := (public.pin_ayarla('pdf-test-PIN.1')) ->> 'token';

  r := public.sinif_ekle(t_ogretmen, 9::smallint, 'A');  v_sinif_a := (r ->> 'id')::uuid;
  r := public.sinif_ekle(t_ogretmen, 9::smallint, 'B');  v_sinif_b := (r ->> 'id')::uuid;

  r := public.ogrenci_ekle(t_ogretmen, 'PDF Test Öğrencisi', 'okul', v_sinif_a);
  v_ogrenci  := (r ->> 'id')::uuid;
  t_ogrenci  := (public.giris(r ->> 'ogrenci_kodu')) ->> 'token';
  t_veli     := (public.giris(r ->> 'veli_kodu')) ->> 'token';

  -- 9A'ya yayında bir test ödevi: hem soru hem anahtar PDF'i var.
  r := public.odev_olustur(t_ogretmen, 'PDFTEST Türev', null, v_sinif_a, 'test',
                           current_date + 7, 2, '{"1":"A","2":"B"}'::jsonb,
                           'anahtar/turev-anahtar.pdf', 'odev/turev-sorular.pdf');
  v_odev := (r ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogretmen, v_odev);

  -- 9A'ya TASLAK ödev (yayınlanmadı).
  r := public.odev_olustur(t_ogretmen, 'PDFTEST Limit taslak', null, v_sinif_a, 'test',
                           current_date + 9, 1, '{"1":"C"}'::jsonb,
                           'anahtar/limit-anahtar.pdf', 'odev/limit-sorular.pdf');
  v_taslak := (r ->> 'id')::uuid;

  -- 9B'ye yayında ödev — öğrencimiz 9A'da, bunu görmemeli.
  r := public.odev_olustur(t_ogretmen, 'PDFTEST Başka sınıf', null, v_sinif_b, 'test',
                           current_date + 7, 1, '{"1":"D"}'::jsonb,
                           'anahtar/baska-anahtar.pdf', 'odev/baska-sorular.pdf');
  v_baska := (r ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogretmen, v_baska);

  ------------------------------------------------------------------
  raise notice '--- 1. Sütun ve imza ---';
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='odevler'
                   and column_name='odev_url') then
    raise exception 'HATA: odevler.odev_url sütunu yok!';
  end if;
  raise notice '    odevler.odev_url sütunu var: OK';

  -- Eski 9 parametreli sürüm ortada kalmamalı: 0005 ona EXECUTE vermişti,
  -- kalırsa anon iki sürümden birini çağırabilir ve davranış ayrışır.
  select count(*) into n
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname='public' and p.proname='odev_olustur';
  if n <> 1 then
    raise exception 'HATA: odev_olustur % sürüm hâlinde duruyor (1 olmalı)!', n;
  end if;
  raise notice '    odev_olustur tek sürüm (eski imza düşürüldü): OK';

  ------------------------------------------------------------------
  raise notice '--- 2. Soru PDF''i öğrenciye TESLİMDEN ÖNCE görünmeli ---';
  -- Dizine güvenmiyoruz: aynı veritabanında başka testlerin ödevleri de var.
  select e into d_odev
  from jsonb_array_elements(public.ogrenci_odevleri(t_ogrenci) -> 'odevler') e
  where e ->> 'baslik' = 'PDFTEST Türev';
  if d_odev is null then
    raise exception 'HATA: yayındaki ödev öğrenci listesinde yok!';
  end if;
  if (d_odev ->> 'odev_yolu') is distinct from 'odev/turev-sorular.pdf' then
    raise exception 'HATA: soru PDF yolu öğrenciye dönmedi! (%)', d_odev ->> 'odev_yolu';
  end if;
  raise notice '    soru PDF yolu dönüyor: OK';

  if not public.dosya_erisim_izni(t_ogrenci, 'odev/turev-sorular.pdf') then
    raise exception 'HATA: öğrenci kendi sınıfının soru PDF''ini açamıyor!';
  end if;
  raise notice '    öğrenci soru PDF''ini açabiliyor: OK';

  ------------------------------------------------------------------
  raise notice '--- 3. Cevap anahtarı teslimden önce KAPALI kalmalı ---';
  if (d_odev ->> 'anahtar_yolu') is not null then
    raise exception 'HATA: teslim yokken anahtar yolu sızdı!';
  end if;
  if (d_odev ->> 'cevap_anahtari') is not null then
    raise exception 'HATA: teslim yokken cevap anahtarı sızdı!';
  end if;
  if public.dosya_erisim_izni(t_ogrenci, 'anahtar/turev-anahtar.pdf') then
    raise exception 'HATA: teslim yokken anahtar PDF''i açılabiliyor!';
  end if;
  raise notice '    anahtar hem veride hem dosyada kapalı: OK';

  ------------------------------------------------------------------
  raise notice '--- 4. TASLAK ödevin soru PDF''i açılmamalı ---';
  if public.dosya_erisim_izni(t_ogrenci, 'odev/limit-sorular.pdf') then
    raise exception 'HATA: yayınlanmamış ödevin soru PDF''i açılabiliyor!';
  end if;
  raise notice '    taslak soru PDF''i kapalı: OK';

  ------------------------------------------------------------------
  raise notice '--- 5. BAŞKA SINIFIN soru PDF''i açılmamalı ---';
  if public.dosya_erisim_izni(t_ogrenci, 'odev/baska-sorular.pdf') then
    raise exception 'HATA: başka sınıfın soru PDF''i açılabiliyor!';
  end if;
  raise notice '    başka sınıfın soru PDF''i kapalı: OK';

  ------------------------------------------------------------------
  raise notice '--- 6. VELİ hiçbir PDF''i açamamalı ---';
  if public.dosya_erisim_izni(t_veli, 'odev/turev-sorular.pdf') then
    raise exception 'HATA: veli soru PDF''ini açabiliyor!';
  end if;
  if public.dosya_erisim_izni(t_veli, 'anahtar/turev-anahtar.pdf') then
    raise exception 'HATA: VELİ CEVAP ANAHTARINI AÇABİLİYOR! (Kural 6 ihlali)';
  end if;
  raise notice '    veli ikisini de açamıyor: OK';

  ------------------------------------------------------------------
  raise notice '--- 7. Teslimden SONRA anahtar açılmalı, soru PDF''i kalmalı ---';
  perform public.odev_gonder(t_ogrenci, v_odev, 'cozum/' || v_odev || '/' || v_ogrenci || '.jpg', '{"1":"A","2":"B"}'::jsonb);
  select e into d_odev
  from jsonb_array_elements(public.ogrenci_odevleri(t_ogrenci) -> 'odevler') e
  where e ->> 'baslik' = 'PDFTEST Türev';
  if (d_odev ->> 'anahtar_yolu') is distinct from 'anahtar/turev-anahtar.pdf' then
    raise exception 'HATA: teslimden sonra anahtar yolu gelmedi!';
  end if;
  if (d_odev ->> 'odev_yolu') is distinct from 'odev/turev-sorular.pdf' then
    raise exception 'HATA: teslimden sonra soru PDF yolu kayboldu!';
  end if;
  if not public.dosya_erisim_izni(t_ogrenci, 'anahtar/turev-anahtar.pdf') then
    raise exception 'HATA: teslimden sonra anahtar PDF''i hâlâ kapalı!';
  end if;
  raise notice '    teslim sonrası ikisi de açık: OK';

  ------------------------------------------------------------------
  raise notice '--- 8. Öğretmen her ikisini de açabilmeli ---';
  if not public.dosya_erisim_izni(t_ogretmen, 'odev/limit-sorular.pdf')
     or not public.dosya_erisim_izni(t_ogretmen, 'anahtar/baska-anahtar.pdf') then
    raise exception 'HATA: öğretmen kendi dosyalarını açamıyor!';
  end if;
  raise notice '    öğretmen taslak ve anahtar dahil hepsini açıyor: OK';

  raise notice '';
  raise notice '=========================================';
  raise notice 'ÖDEV PDF TESTLERİ GEÇTİ';
  raise notice '=========================================';
end;
$$;

-- =============================================================================
-- odevler_listesi — öğretmenin ödev listesi
-- =============================================================================
do $$
declare
  t_ogretmen text;
  t_ogrenci  text;
  v_sinif    uuid;
  r          jsonb;
  liste      jsonb;
begin
  raise notice '--- 9. odevler_listesi ---';
  update public.ayarlar set ogretmen_pin_hash = null where id = 1;
  t_ogretmen := (public.pin_ayarla('liste-test-PIN.2')) ->> 'token';
  r := public.sinif_ekle(t_ogretmen, 11::smallint, 'Z'); v_sinif := (r ->> 'id')::uuid;

  r := public.odev_olustur(t_ogretmen, 'LISTE Taslak', null, v_sinif, 'test',
                           current_date + 3, 1, '{"1":"A"}'::jsonb,
                           'anahtar/l.pdf', 'odev/l.pdf');

  liste := public.odevler_listesi(t_ogretmen, v_sinif, null);
  if jsonb_array_length(liste) <> 1 then
    raise exception 'HATA: sınıf filtresi çalışmadı (% kayıt)', jsonb_array_length(liste);
  end if;
  if (liste -> 0 ->> 'yayinda')::boolean then
    raise exception 'HATA: yeni ödev yayında görünüyor!';
  end if;
  if not (liste -> 0 ->> 'odev_pdf_var')::boolean
     or not (liste -> 0 ->> 'anahtar_pdf_var')::boolean then
    raise exception 'HATA: PDF varlık bayrakları yanlış!';
  end if;
  raise notice '    liste, sınıf filtresi ve PDF bayrakları: OK';

  -- Cevap anahtarı listede DÖNMEMELİ.
  if (liste -> 0) ? 'cevap_anahtari' or (liste -> 0) ? 'anahtar_url' then
    raise exception 'HATA: cevap anahtarı ödev listesinde dönüyor!';
  end if;
  raise notice '    liste cevap anahtarını taşımıyor: OK';

  -- Yayında filtresi
  if jsonb_array_length(public.odevler_listesi(t_ogretmen, v_sinif, true)) <> 0 then
    raise exception 'HATA: yayında filtresi taslağı getirdi!';
  end if;
  raise notice '    yayında filtresi: OK';

  -- Öğrenci bu fonksiyonu çağıramamalı.
  r := public.ogrenci_ekle(t_ogretmen, 'Liste Test Öğrencisi', 'okul', v_sinif);
  t_ogrenci := (public.giris(r ->> 'ogrenci_kodu')) ->> 'token';
  begin
    perform public.odevler_listesi(t_ogrenci, null, null);
    raise exception 'HATA: ÖĞRENCİ ÖDEV LİSTESİNİ ÇAĞIRABİLDİ!';
  exception when insufficient_privilege then
    raise notice '    öğrenci reddedildi: OK';
  end;

  raise notice '';
  raise notice 'ODEVLER_LISTESI TESTLERİ GEÇTİ';
end;
$$;

-- =============================================================================
-- odev_dosya_yolu — yol tek tek, istendiğinde
-- =============================================================================
do $$
declare
  t_ogretmen text; t_ogrenci text; v_sinif uuid; v_odev uuid; r jsonb;
begin
  raise notice '--- 10. odev_dosya_yolu ---';
  update public.ayarlar set ogretmen_pin_hash = null where id = 1;
  t_ogretmen := (public.pin_ayarla('yol-test-PIN.3')) ->> 'token';
  r := public.sinif_ekle(t_ogretmen, 12::smallint, 'Y'); v_sinif := (r ->> 'id')::uuid;
  r := public.odev_olustur(t_ogretmen, 'YOL Testi', null, v_sinif, 'test',
                           current_date + 5, 1, '{"1":"A"}'::jsonb,
                           'anahtar/y.pdf', 'odev/y.pdf');
  v_odev := (r ->> 'id')::uuid;

  if (public.odev_dosya_yolu(t_ogretmen, v_odev, 'odev') ->> 'yol') <> 'odev/y.pdf' then
    raise exception 'HATA: soru PDF yolu yanlış!';
  end if;
  if (public.odev_dosya_yolu(t_ogretmen, v_odev, 'anahtar') ->> 'yol') <> 'anahtar/y.pdf' then
    raise exception 'HATA: anahtar PDF yolu yanlış!';
  end if;
  raise notice '    öğretmen iki yolu da alıyor: OK';

  begin
    perform public.odev_dosya_yolu(t_ogretmen, v_odev, 'baska');
    raise exception 'HATA: geçersiz tür kabul edildi!';
  exception when others then
    if sqlstate = '22023' then raise notice '    geçersiz tür reddedildi: OK';
    else raise; end if;
  end;

  r := public.ogrenci_ekle(t_ogretmen, 'Yol Test Öğrencisi', 'okul', v_sinif);
  t_ogrenci := (public.giris(r ->> 'ogrenci_kodu')) ->> 'token';
  begin
    perform public.odev_dosya_yolu(t_ogrenci, v_odev, 'anahtar');
    raise exception 'HATA: ÖĞRENCİ ANAHTAR YOLUNU ALDI!';
  exception when insufficient_privilege then
    raise notice '    öğrenci reddedildi: OK';
  end;

  raise notice '';
  raise notice 'ODEV_DOSYA_YOLU TESTLERİ GEÇTİ';
end;
$$;

-- =============================================================================
-- service_role — Edge Function'ın yetki sorabilmesi
--
-- CANLIDA YAKALANAN HATA, buraya kilitleniyor.
-- 0005 tüm fonksiyon haklarını PUBLIC'ten çekiyordu; `service_role` erişimini
-- PUBLIC üzerinden aldığı için o da kaybetti. Sonuç: Edge Function
-- `dosya_erisim_izni`'ni çağıramıyor, her dosya isteği 500 dönüyordu.
-- Bu testsiz bir boşluktu.
-- =============================================================================
do $$
begin
  raise notice '--- 11. service_role yetkisi ---';

  if not has_function_privilege('service_role', 'public.dosya_erisim_izni(text, text)', 'execute') then
    raise exception 'HATA: service_role dosya_erisim_izni''ni ÇAĞIRAMIYOR! Edge Function çalışmaz.';
  end if;
  raise notice '    service_role dosya_erisim_izni''ni çağırabiliyor: OK';

  -- Gereğinden fazlası verilmemeli: service_role çok yetkili bir rol, ona
  -- toptan EXECUTE vermek Edge Function'ın erişimini gereksiz genişletir.
  if has_function_privilege('service_role', 'public._oturum_ac(text, uuid, interval)', 'execute') then
    raise exception 'HATA: service_role dahili _oturum_ac''ı da çağırabiliyor — fazla yetki!';
  end if;
  raise notice '    dahili fonksiyonlar service_role''e de kapalı: OK';

  -- anon hâlâ çağırabilmeli (istemci de bu fonksiyonu kullanmıyor ama
  -- 0007 grant''i onu da kapsıyor; yanlışlıkla düşmediğini doğrula).
  if not has_function_privilege('anon', 'public.dosya_erisim_izni(text, text)', 'execute') then
    raise exception 'HATA: anon dosya_erisim_izni''ni kaybetti!';
  end if;
  raise notice '    anon erişimi korunuyor: OK';

  raise notice '';
  raise notice 'SERVICE_ROLE TESTLERİ GEÇTİ';
end;
$$;
