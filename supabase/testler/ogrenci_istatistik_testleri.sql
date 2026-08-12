-- =============================================================================
-- SEKİZ — 0013 ÖĞRENCİ İSTATİSTİK TESTLERİ
--
-- Ortalamalar bir öğrencinin karnesi gibi okunacak; yanlış hesap sessizce
-- haksızlık üretir. Bu yüzden sayılar ELLE DOĞRULANABİLİR seçildi:
--
--   3 ödev (hepsinin süresi dolmuş), 3 öğrenci
--     Ali    : 3/3 yaptı  → 100, 50, 0   → yapan 50.0   tüm 50.0
--     Ayşe   : 1/3 yaptı  → 90           → yapan 90.0   tüm 30.0
--     Mehmet : 0/3 yaptı  → —            → yapan  —     tüm  0.0
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  t_ogretmen text;
  t_ali text; t_ayse text;
  v_sinif uuid;
  v_ali uuid; v_ayse uuid; v_mehmet uuid;
  d1 uuid; d2 uuid; d3 uuid; d_acik uuid;
  r jsonb; e jsonb;
  bugun_tr date := (now() at time zone 'Europe/Istanbul')::date;
begin
  raise notice '--- Kurulum ---';
  update public.ayarlar set ogretmen_pin_hash = null where id = 1;
  t_ogretmen := (public.pin_ayarla('istatistik-PIN.2')) ->> 'token';
  v_sinif := (public.sinif_ekle(t_ogretmen, 10::smallint, 'İ') ->> 'id')::uuid;

  v_ali    := (public.ogrenci_ekle(t_ogretmen, 'Ali Ist', 'okul', v_sinif) ->> 'id')::uuid;
  v_ayse   := (public.ogrenci_ekle(t_ogretmen, 'Ayse Ist', 'okul', v_sinif) ->> 'id')::uuid;
  v_mehmet := (public.ogrenci_ekle(t_ogretmen, 'Mehmet Ist', 'okul', v_sinif) ->> 'id')::uuid;
  t_ali := (public.giris((select kod from public.giris_kodlari
             where ogrenci_id = v_ali and rol = 'ogrenci'))) ->> 'token';
  t_ayse := (public.giris((select kod from public.giris_kodlari
              where ogrenci_id = v_ayse and rol = 'ogrenci'))) ->> 'token';

  -- Üç ödev, hepsinin süresi dolmuş, hepsi geç teslime açık.
  d1 := (public.odev_olustur(t_ogretmen, 'IST 1', null, v_sinif, 'test',
          bugun_tr - 5, 2, '{"1":"A","2":"B"}'::jsonb, null, null, true) ->> 'id')::uuid;
  d2 := (public.odev_olustur(t_ogretmen, 'IST 2', null, v_sinif, 'test',
          bugun_tr - 4, 2, '{"1":"A","2":"B"}'::jsonb, null, null, true) ->> 'id')::uuid;
  d3 := (public.odev_olustur(t_ogretmen, 'IST 3', null, v_sinif, 'test',
          bugun_tr - 3, 2, '{"1":"A","2":"B"}'::jsonb, null, null, true) ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogretmen, d1);
  perform public.odev_yayinla(t_ogretmen, d2);
  perform public.odev_yayinla(t_ogretmen, d3);

  -- Ali: 100, 50, 0
  perform public.odev_gonder(t_ali, d1, 'cozum/'||d1||'/'||v_ali||'.jpg', '{"1":"A","2":"B"}'::jsonb);
  perform public.odev_gonder(t_ali, d2, 'cozum/'||d2||'/'||v_ali||'.jpg', '{"1":"A","2":"X"}'::jsonb);
  perform public.odev_gonder(t_ali, d3, 'cozum/'||d3||'/'||v_ali||'.jpg', '{"1":"X","2":"Y"}'::jsonb);
  -- Ayşe: yalnız d1, açık uçlu gibi öğretmen puanı verilecek → 90
  perform public.odev_gonder(t_ayse, d1, 'cozum/'||d1||'/'||v_ayse||'.jpg', '{"1":"A","2":"B"}'::jsonb);
  perform public.acik_puanla(t_ogretmen,
    (select id from public.gonderimler where odev_id = d1 and ogrenci_id = v_ayse), 90);
  -- Mehmet: hiç göndermedi.

  ------------------------------------------------------------------
  raise notice '--- 1. Değerlendirilen ödev sayısı ---';
  r := public.sinif_ogrencileri(t_ogretmen, v_sinif);
  if (r ->> 'degerlendirilen_odev')::int <> 3 then
    raise exception 'HATA: 3 ödev beklenirken % geldi', r ->> 'degerlendirilen_odev';
  end if;
  if jsonb_array_length(r -> 'ogrenciler') <> 3 then
    raise exception 'HATA: 3 öğrenci beklenirken % geldi',
      jsonb_array_length(r -> 'ogrenciler');
  end if;
  raise notice '    3 ödev, 3 öğrenci: OK';

  ------------------------------------------------------------------
  raise notice '--- 2. Hepsini yapan öğrenci (100/50/0) ---';
  select x into e from jsonb_array_elements(r -> 'ogrenciler') x
   where (x ->> 'id')::uuid = v_ali;
  if (e ->> 'yapti')::int <> 3 or (e ->> 'yapmadi')::int <> 0 then
    raise exception 'HATA: Ali sayıları yanlış: %', e;
  end if;
  if (e ->> 'ortalama_yapan')::numeric <> 50.0
     or (e ->> 'ortalama_tum')::numeric <> 50.0 then
    raise exception 'HATA: Ali ortalamaları yanlış: %', e;
  end if;
  raise notice '    3 yaptı, iki ortalama da 50.0: OK';

  ------------------------------------------------------------------
  raise notice '--- 3. AZ YAPAN öğrencide iki ortalama AYRIŞMALI ---';
  -- Testin can alıcı noktası: 90 alıp iki ödevi hiç yapmayan öğrencinin
  -- genel durumu 30. Tek ortalama gösterilseydi bu öğrenci "90'lık"
  -- görünürdü.
  select x into e from jsonb_array_elements(r -> 'ogrenciler') x
   where (x ->> 'id')::uuid = v_ayse;
  if (e ->> 'yapti')::int <> 1 or (e ->> 'yapmadi')::int <> 2 then
    raise exception 'HATA: Ayşe sayıları yanlış: %', e;
  end if;
  if (e ->> 'ortalama_yapan')::numeric <> 90.0 then
    raise exception 'HATA: Ayşe yapan ortalaması % (90 olmalı)', e ->> 'ortalama_yapan';
  end if;
  if (e ->> 'ortalama_tum')::numeric <> 30.0 then
    raise exception 'HATA: Ayşe tüm ortalaması % (30 olmalı)', e ->> 'ortalama_tum';
  end if;
  -- Öğretmen puanı ham puanın önüne geçmeli (acik_puanla ile 90 verildi).
  raise notice '    yapan 90.0, tüm 30.0 — ayrışıyor ve öğretmen puanı öncelikli: OK';

  ------------------------------------------------------------------
  raise notice '--- 4. HİÇ YAPMAYAN öğrenci ---';
  select x into e from jsonb_array_elements(r -> 'ogrenciler') x
   where (x ->> 'id')::uuid = v_mehmet;
  if (e ->> 'yapti')::int <> 0 or (e ->> 'yapmadi')::int <> 3 then
    raise exception 'HATA: Mehmet sayıları yanlış: %', e;
  end if;
  -- Yaptığı ödev yoksa "yapan ortalaması" YOK; 0 yazmak yanlış olurdu
  -- (0 almış demek değil, hiç yapmamış demek).
  if (e ->> 'ortalama_yapan') is not null then
    raise exception 'HATA: hiç yapmayanda yapan ortalaması var: %', e;
  end if;
  if (e ->> 'ortalama_tum')::numeric <> 0.0 then
    raise exception 'HATA: Mehmet tüm ortalaması % (0 olmalı)', e ->> 'ortalama_tum';
  end if;
  raise notice '    0 yaptı, yapan ortalaması boş, tüm 0.0: OK';

  ------------------------------------------------------------------
  raise notice '--- 5. SÜRESİ DOLMAMIŞ ödev ortalamaya GİRMEZ ---';
  d_acik := (public.odev_olustur(t_ogretmen, 'IST Acik', null, v_sinif, 'test',
              bugun_tr + 7, 2, '{"1":"A","2":"B"}'::jsonb) ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogretmen, d_acik);

  r := public.sinif_ogrencileri(t_ogretmen, v_sinif);
  if (r ->> 'degerlendirilen_odev')::int <> 3 then
    raise exception 'HATA: süresi dolmamış ödev sayıma girdi (%)',
      r ->> 'degerlendirilen_odev';
  end if;
  select x into e from jsonb_array_elements(r -> 'ogrenciler') x
   where (x ->> 'id')::uuid = v_ayse;
  if (e ->> 'ortalama_tum')::numeric <> 30.0 then
    raise exception 'HATA: süresi dolmamış ödev ortalamayı bozdu (%)',
      e ->> 'ortalama_tum';
  end if;
  raise notice '    daha süresi olan ödev "yapmadı" sayılmadı: OK';

  ------------------------------------------------------------------
  raise notice '--- 6. TASLAK ödev sayılmaz ---';
  perform public.odev_olustur(t_ogretmen, 'IST Taslak', null, v_sinif, 'test',
                              bugun_tr - 1, 2, '{"1":"A","2":"B"}'::jsonb);
  r := public.sinif_ogrencileri(t_ogretmen, v_sinif);
  if (r ->> 'degerlendirilen_odev')::int <> 3 then
    raise exception 'HATA: yayınlanmamış ödev sayıldı (%)',
      r ->> 'degerlendirilen_odev';
  end if;
  raise notice '    taslak sayılmadı: OK';

  ------------------------------------------------------------------
  raise notice '--- 7. Öğrenci ve veli bu ucu çağıramaz ---';
  begin
    perform public.sinif_ogrencileri(t_ali, v_sinif);
    raise exception 'HATA: ÖĞRENCİ TÜM SINIFIN ORTALAMALARINI GÖRDÜ!';
  exception when insufficient_privilege then
    raise notice '    öğrenci reddedildi: OK';
  end;

  raise notice '';
  raise notice '=========================================';
  raise notice 'ÖĞRENCİ İSTATİSTİK TESTLERİ GEÇTİ';
  raise notice '=========================================';
end;
$$;
