-- =============================================================================
-- SEKİZ — 0009 ÖĞRENCİ ÇÖZÜM YÜKLEME TESTLERİ
--
-- Bu boşluk Faz 2B'de fark edilip koda not düşülmüştü: öğrenci fotoğraf
-- yükleyemiyordu çünkü yükleme izni, henüz var olmayan gönderim kaydına
-- bakıyordu. Yol artık deterministik bir kalıba bağlı.
--
-- En kritik ölçüm: bir öğrenci BAŞKA bir öğrencinin yoluna yükleyememeli.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  t_ogretmen text;
  t_ali      text;
  t_ayse     text;
  t_veli_ali text;
  v_sinif    uuid;
  v_sinif_b  uuid;
  v_ali      uuid;
  v_ayse     uuid;
  v_yabanci  uuid;
  v_odev     uuid;
  v_taslak   uuid;
  r          jsonb;
  yol_ali    text;
  yol_ayse   text;
begin
  raise notice '--- Kurulum ---';
  update public.ayarlar set ogretmen_pin_hash = null where id = 1;
  t_ogretmen := (public.pin_ayarla('yukleme-PIN.7')) ->> 'token';
  r := public.sinif_ekle(t_ogretmen, 10::smallint, 'Y'); v_sinif   := (r ->> 'id')::uuid;
  r := public.sinif_ekle(t_ogretmen, 10::smallint, 'Z'); v_sinif_b := (r ->> 'id')::uuid;

  r := public.ogrenci_ekle(t_ogretmen, 'Ali Yukleme', 'okul', v_sinif);
  v_ali := (r ->> 'id')::uuid;
  t_ali := (public.giris(r ->> 'ogrenci_kodu')) ->> 'token';
  t_veli_ali := (public.giris(r ->> 'veli_kodu')) ->> 'token';

  r := public.ogrenci_ekle(t_ogretmen, 'Ayse Yukleme', 'okul', v_sinif);
  v_ayse := (r ->> 'id')::uuid;
  t_ayse := (public.giris(r ->> 'ogrenci_kodu')) ->> 'token';

  r := public.ogrenci_ekle(t_ogretmen, 'Baska Sinif', 'okul', v_sinif_b);
  v_yabanci := (r ->> 'id')::uuid;

  r := public.odev_olustur(t_ogretmen, 'YUK Test', null, v_sinif, 'test',
                           current_date + 5, 2, '{"1":"A","2":"B"}'::jsonb, null, null);
  v_odev := (r ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogretmen, v_odev);

  r := public.odev_olustur(t_ogretmen, 'YUK Taslak', null, v_sinif, 'test',
                           current_date + 5, 1, '{"1":"C"}'::jsonb, null, null);
  v_taslak := (r ->> 'id')::uuid;

  yol_ali  := 'cozum/' || v_odev || '/' || v_ali  || '.jpg';
  yol_ayse := 'cozum/' || v_odev || '/' || v_ayse || '.jpg';

  ------------------------------------------------------------------
  raise notice '--- 1. Öğrenci TESLİM ETMEDEN kendi yoluna yükleyebilmeli ---';
  if not public.dosya_erisim_izni(t_ali, yol_ali) then
    raise exception 'HATA: öğrenci kendi çözüm yoluna yükleyemiyor — ödev gönderemez!';
  end if;
  raise notice '    kendi yoluna izin var: OK';

  ------------------------------------------------------------------
  raise notice '--- 2. BAŞKA ÖĞRENCİNİN yoluna yükleyememeli ---';
  if public.dosya_erisim_izni(t_ali, yol_ayse) then
    raise exception 'HATA: ALİ, AYŞE''NİN YOLUNA YÜKLEYEBİLİYOR!';
  end if;
  raise notice '    başkasının yolu kapalı: OK';

  ------------------------------------------------------------------
  raise notice '--- 3. Uydurma / bozuk yollar reddedilmeli ---';
  if public.dosya_erisim_izni(t_ali, 'cozum/' || v_odev || '/' || v_ali || '.exe')
     or public.dosya_erisim_izni(t_ali, 'cozum/olmayan/' || v_ali || '.jpg')
     or public.dosya_erisim_izni(t_ali, 'anahtar/' || v_odev || '/' || v_ali || '.jpg')
     or public.dosya_erisim_izni(t_ali, 'cozum/' || v_odev || '/' || v_ali) then
    raise exception 'HATA: geçersiz bir yol kabul edildi!';
  end if;
  raise notice '    uzantı, klasör ve biçim denetimi çalışıyor: OK';

  ------------------------------------------------------------------
  raise notice '--- 4. TASLAK ödeve yükleme yolu açılmamalı ---';
  if public.dosya_erisim_izni(t_ali, 'cozum/' || v_taslak || '/' || v_ali || '.jpg') then
    raise exception 'HATA: yayınlanmamış ödeve çözüm yüklenebiliyor!';
  end if;
  raise notice '    taslak kapalı: OK';

  ------------------------------------------------------------------
  raise notice '--- 5. BAŞKA SINIFIN ödevine yükleme olmamalı ---';
  if public.dosya_erisim_izni(t_ali, 'cozum/' || v_odev || '/' || v_yabanci || '.jpg') then
    raise exception 'HATA: başka sınıfın öğrencisinin yolu açıldı!';
  end if;
  raise notice '    sınıf denetimi çalışıyor: OK';

  ------------------------------------------------------------------
  raise notice '--- 6. VELİ yükleyememeli ---';
  if public.dosya_erisim_izni(t_veli_ali, yol_ali) then
    raise exception 'HATA: VELİ ÇÖZÜM YÜKLEYEBİLİYOR!';
  end if;
  raise notice '    veli yükleyemiyor: OK';

  ------------------------------------------------------------------
  raise notice '--- 7. Gerçek gönderim çalışmalı ve puanlanmalı ---';
  r := public.odev_gonder(t_ali, v_odev, yol_ali, '{"1":"A","2":"B"}'::jsonb);
  if (r ->> 'puan')::numeric <> 100 then
    raise exception 'HATA: gönderim puanı yanlış (%)', r ->> 'puan';
  end if;
  raise notice '    gönderim kabul edildi, puan 100: OK';

  ------------------------------------------------------------------
  raise notice '--- 8. Gönderimde UYDURMA yol reddedilmeli ---';
  begin
    perform public.odev_gonder(t_ayse, v_odev, yol_ali, '{"1":"A"}'::jsonb);
    raise exception 'HATA: AYŞE, ALİ''NİN YOLUYLA GÖNDERİM YAPTI!';
  exception when insufficient_privilege then
    raise notice '    başkasının yoluyla gönderim reddedildi: OK';
  end;

  begin
    perform public.odev_gonder(t_ayse, v_odev, 'rastgele/yol.jpg', '{"1":"A"}'::jsonb);
    raise exception 'HATA: kalıba uymayan yol kabul edildi!';
  exception when insufficient_privilege then
    raise notice '    kalıp dışı yol reddedilecek: OK';
  end;

  ------------------------------------------------------------------
  raise notice '--- 9. Teslimden sonra kendi fotoğrafı ve anahtar açık ---';
  if not public.dosya_erisim_izni(t_ali, yol_ali) then
    raise exception 'HATA: teslimden sonra kendi fotoğrafını göremiyor!';
  end if;
  if not public.dosya_erisim_izni(t_veli_ali, yol_ali) then
    raise exception 'HATA: veli çocuğunun çözümünü göremiyor!';
  end if;
  raise notice '    öğrenci ve veli çözüm kâğıdını görebiliyor: OK';

  ------------------------------------------------------------------
  raise notice '--- 10. Dahili yardımcı dışarıya kapalı ---';
  if has_function_privilege('anon', 'public._cozum_yolu_gecerli(uuid, text)', 'execute') then
    raise exception 'HATA: _cozum_yolu_gecerli anon''a açık!';
  end if;
  raise notice '    _cozum_yolu_gecerli kapalı: OK';

  raise notice '';
  raise notice '=========================================';
  raise notice 'ÖĞRENCİ YÜKLEME TESTLERİ GEÇTİ';
  raise notice '=========================================';
end;
$$;
