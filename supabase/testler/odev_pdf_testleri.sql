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
  perform public.odev_gonder(t_ogrenci, v_odev, 'cozum/ogrenci-foto.jpg', '{"1":"A","2":"B"}'::jsonb);
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
