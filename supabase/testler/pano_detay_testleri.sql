-- =============================================================================
-- SEKİZ — 0015 PANO DETAY TESTLERİ
--
-- Pano sayıları eyleme dönüşmüyordu: "11 öğrenci göndermemiş" tek başına
-- kimin göndermediğini söylemiyor. Bu dosya dört listenin de DOĞRU İSİMLERİ
-- ve DOĞRU GRUPLAMAYI verdiğini ölçüyor.
--
-- Kurgu (elle doğrulanabilir):
--   Sınıf PA (2 öğrenci: Ali, Ayşe) + Özel ders grubu (1 öğrenci: Ozan)
--   PA'ya süresi dolmuş test ödevi → Ali gönderdi, Ayşe göndermedi
--   PA'ya süresi dolmamış ödev     → açık ödev listesinde
--   Özel gruba açık uçlu ödev      → Ozan gönderdi, puan bekliyor
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  t_ogretmen text; t_ali text; t_ozan text;
  v_pa uuid; v_ozel uuid;
  v_ali uuid; v_ayse uuid; v_ozan uuid;
  d_gecmis uuid; d_acik uuid; d_uclu uuid;
  r jsonb; grup jsonb;
  bugun_tr date := (now() at time zone 'Europe/Istanbul')::date;
begin
  raise notice '--- Kurulum ---';
  update public.ayarlar set ogretmen_pin_hash = null where id = 1;
  t_ogretmen := (public.pin_ayarla('pano-PIN.5')) ->> 'token';
  v_pa := (public.sinif_ekle(t_ogretmen, 11::smallint, 'P') ->> 'id')::uuid;
  select id into v_ozel from public.siniflar where ozel;

  v_ali  := (public.ogrenci_ekle(t_ogretmen, 'Pano Ali', 'okul', v_pa) ->> 'id')::uuid;
  v_ayse := (public.ogrenci_ekle(t_ogretmen, 'Pano Ayse', 'okul', v_pa) ->> 'id')::uuid;
  v_ozan := (public.ogrenci_ekle(t_ogretmen, 'Pano Ozan', 'ozel') ->> 'id')::uuid;
  t_ali  := (public.giris((select kod from public.giris_kodlari
              where ogrenci_id = v_ali and rol = 'ogrenci'))) ->> 'token';
  t_ozan := (public.giris((select kod from public.giris_kodlari
              where ogrenci_id = v_ozan and rol = 'ogrenci'))) ->> 'token';

  d_gecmis := (public.odev_olustur(t_ogretmen, 'PANO Gecmis', null, v_pa, 'test',
                bugun_tr - 3, 2, '{"1":"A","2":"B"}'::jsonb, null, null, true) ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogretmen, d_gecmis);
  perform public.odev_gonder(t_ali, d_gecmis,
    'cozum/'||d_gecmis||'/'||v_ali||'.jpg', '{"1":"A","2":"B"}'::jsonb);

  d_acik := (public.odev_olustur(t_ogretmen, 'PANO Acik', null, v_pa, 'test',
              bugun_tr + 4, 2, '{"1":"A","2":"B"}'::jsonb) ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogretmen, d_acik);

  d_uclu := (public.odev_olustur(t_ogretmen, 'PANO Uclu', null, v_ozel, 'acik',
              bugun_tr + 6) ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogretmen, d_uclu);
  perform public.odev_gonder(t_ozan, d_uclu, 'cozum/'||d_uclu||'/'||v_ozan||'.jpg');

  ------------------------------------------------------------------
  raise notice '--- 1. Öğrenci kutusu: ödev VERİLEN öğrenci sayısı ---';
  r := public.ogretmen_panosu(t_ogretmen);
  -- Toplam öğrenci ile ödev verilen öğrenci AYRI iki sayı olmalı; toplam
  -- kaldırılmadı çünkü boş sistem yönlendirmesi ona bakıyor.
  if not (r ? 'odev_verilen_ogrenci') or not (r ? 'ogrenci_sayisi') then
    raise exception 'HATA: pano iki sayıdan birini vermiyor: %', r;
  end if;
  if (r ->> 'odev_verilen_ogrenci')::int < 3 then
    raise exception 'HATA: ödev verilen öğrenci sayısı çok düşük (%)',
      r ->> 'odev_verilen_ogrenci';
  end if;
  raise notice '    iki sayı da var: OK';

  ------------------------------------------------------------------
  raise notice '--- 2. ÖĞRENCİ listesi sınıfa göre gruplu ---';
  r := public.pano_detay(t_ogretmen, 'ogrenci');
  select g into grup from jsonb_array_elements(r -> 'gruplar') g
   where (g ->> 'sinif') = '11P';
  if grup is null then
    raise exception 'HATA: 11P grubu listede yok!';
  end if;
  if jsonb_array_length(grup -> 'satirlar') <> 2 then
    raise exception 'HATA: 11P grubunda 2 öğrenci olmalı: %', grup;
  end if;

  -- Özel ders grubu AYRI ve işaretli olmalı.
  select g into grup from jsonb_array_elements(r -> 'gruplar') g
   where (g ->> 'sinif') = 'Özel ders';
  if grup is null or not (grup ->> 'ozel')::boolean then
    raise exception 'HATA: özel ders grubu ayrı ve işaretli değil: %', r -> 'gruplar';
  end if;
  raise notice '    sınıflar ayrı, özel ders işaretli: OK';

  ------------------------------------------------------------------
  raise notice '--- 3. AÇIK ÖDEV listesi: süresi dolan girmemeli ---';
  r := public.pano_detay(t_ogretmen, 'acik_odev');
  if exists (
    select 1 from jsonb_array_elements(r -> 'gruplar') g,
                  jsonb_array_elements(g -> 'satirlar') x
    where (x ->> 'ad') = 'PANO Gecmis'
  ) then
    raise exception 'HATA: süresi dolmuş ödev "açık ödev" listesinde!';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(r -> 'gruplar') g,
                  jsonb_array_elements(g -> 'satirlar') x
    where (x ->> 'ad') = 'PANO Acik'
  ) then
    raise exception 'HATA: açık ödev listede yok!';
  end if;
  raise notice '    yalnız süresi dolmamışlar: OK';

  ------------------------------------------------------------------
  raise notice '--- 4. GÖNDERMEYEN: gönderen listede OLMAMALI ---';
  r := public.pano_detay(t_ogretmen, 'gondermeyen');
  if exists (
    select 1 from jsonb_array_elements(r -> 'gruplar') g,
                  jsonb_array_elements(g -> 'satirlar') x
    where (x ->> 'ad') = 'Pano Ali'
  ) then
    raise exception 'HATA: ÖDEVİ GÖNDEREN ÖĞRENCİ "göndermeyen" listesinde!';
  end if;
  select x into grup from jsonb_array_elements(r -> 'gruplar') g,
                            jsonb_array_elements(g -> 'satirlar') x
   where (x ->> 'ad') = 'Pano Ayse';
  if grup is null then
    raise exception 'HATA: göndermeyen öğrenci listede yok!';
  end if;
  if (grup ->> 'eksik')::int <> 1 then
    raise exception 'HATA: eksik ödev sayısı yanlış: %', grup;
  end if;
  raise notice '    yalnız göndermeyen, eksik sayısıyla: OK';

  ------------------------------------------------------------------
  raise notice '--- 5. PUAN BEKLEYEN: yalnız açık uçlu ve incelemede ---';
  r := public.pano_detay(t_ogretmen, 'puan_bekleyen');
  select x into grup from jsonb_array_elements(r -> 'gruplar') g,
                            jsonb_array_elements(g -> 'satirlar') x
   where (x ->> 'ad') = 'Pano Ozan';
  if grup is null or (grup ->> 'odev') <> 'PANO Uclu' then
    raise exception 'HATA: puan bekleyen gönderim listede yok: %', r;
  end if;
  -- Test ödevi otomatik puanlanıyor; burada GÖRÜNMEMELİ.
  if exists (
    select 1 from jsonb_array_elements(r -> 'gruplar') g,
                  jsonb_array_elements(g -> 'satirlar') x
    where (x ->> 'odev') = 'PANO Gecmis'
  ) then
    raise exception 'HATA: otomatik puanlanan test ödevi "puan bekliyor"da!';
  end if;

  -- Puanlanınca listeden düşmeli.
  perform public.acik_puanla(t_ogretmen,
    (select id from public.gonderimler where odev_id = d_uclu and ogrenci_id = v_ozan), 75);
  r := public.pano_detay(t_ogretmen, 'puan_bekleyen');
  if exists (
    select 1 from jsonb_array_elements(r -> 'gruplar') g,
                  jsonb_array_elements(g -> 'satirlar') x
    where (x ->> 'ad') = 'Pano Ozan'
  ) then
    raise exception 'HATA: puanlanan gönderim listede kaldı!';
  end if;
  raise notice '    yalnız açık uçlu bekleyenler; puanlanınca düşüyor: OK';

  ------------------------------------------------------------------
  raise notice '--- 6. Geçersiz tür reddediliyor ---';
  begin
    perform public.pano_detay(t_ogretmen, 'uydurma');
    raise exception 'HATA: geçersiz tür kabul edildi!';
  exception when others then
    if sqlstate = '22023' then raise notice '    reddedildi: OK';
    else raise; end if;
  end;

  ------------------------------------------------------------------
  raise notice '--- 7. Öğrenci bu ucu çağıramaz ---';
  begin
    perform public.pano_detay(t_ali, 'ogrenci');
    raise exception 'HATA: ÖĞRENCİ TÜM OKULUN LİSTESİNİ GÖRDÜ!';
  exception when insufficient_privilege then
    raise notice '    öğrenci reddedildi: OK';
  end;

  raise notice '';
  raise notice '=========================================';
  raise notice 'PANO DETAY TESTLERİ GEÇTİ';
  raise notice '=========================================';
end;
$$;
