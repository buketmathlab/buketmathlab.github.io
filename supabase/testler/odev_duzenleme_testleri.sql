-- =============================================================================
-- SEKİZ — 0008 ÖDEV DÜZENLEME VE YENİDEN PUANLAMA TESTLERİ
--
-- En kritik davranış: cevap anahtarı düzeltilince mevcut gönderimlerin
-- yeniden puanlanması. Puanlamazsak öğretmen anahtarı düzeltir ama
-- öğrencinin notu yanlış kalır — sessiz ve haksız bir hata.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  t_ogretmen text;
  t_ogr1     text;
  t_ogr2     text;
  t_veli     text;
  v_sinif    uuid;
  v_ogr1     uuid;
  v_ogr2     uuid;
  v_odev     uuid;
  r          jsonb;
  rapor      jsonb;
  p1         numeric;
  p2         numeric;
  n          integer;
begin
  raise notice '--- Kurulum ---';
  update public.ayarlar set ogretmen_pin_hash = null where id = 1;
  t_ogretmen := (public.pin_ayarla('duzenleme-PIN.9')) ->> 'token';
  r := public.sinif_ekle(t_ogretmen, 11::smallint, 'D'); v_sinif := (r ->> 'id')::uuid;

  -- 4 soruluk test. Anahtar BİLEREK YANLIŞ: 3. soru 'C' olmalıyken 'A'.
  r := public.odev_olustur(t_ogretmen, 'DUZ Test', null, v_sinif, 'test',
                           current_date + 5, 4,
                           '{"1":"A","2":"B","3":"A","4":"D"}'::jsonb, null, null);
  v_odev := (r ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogretmen, v_odev);

  r := public.ogrenci_ekle(t_ogretmen, 'Duz Ogrenci Bir', 'okul', v_sinif);
  v_ogr1 := (r ->> 'id')::uuid;
  t_ogr1 := (public.giris(r ->> 'ogrenci_kodu')) ->> 'token';
  t_veli := (public.giris(r ->> 'veli_kodu')) ->> 'token';

  r := public.ogrenci_ekle(t_ogretmen, 'Duz Ogrenci Iki', 'okul', v_sinif);
  v_ogr2 := (r ->> 'id')::uuid;
  t_ogr2 := (public.giris(r ->> 'ogrenci_kodu')) ->> 'token';

  -- 1. öğrenci DOĞRU cevapları verdi (3'e C dedi) — yanlış anahtar yüzünden
  -- 75 alacak. 2. öğrenci anahtarla aynı hatayı yaptı, 100 alacak.
  perform public.odev_gonder(t_ogr1, v_odev, 'cozum/' || v_odev || '/' || v_ogr1 || '.jpg', '{"1":"A","2":"B","3":"C","4":"D"}'::jsonb);
  perform public.odev_gonder(t_ogr2, v_odev, 'cozum/' || v_odev || '/' || v_ogr2 || '.jpg', '{"1":"A","2":"B","3":"A","4":"D"}'::jsonb);

  select puan into p1 from public.gonderimler where odev_id = v_odev and ogrenci_id = v_ogr1;
  select puan into p2 from public.gonderimler where odev_id = v_odev and ogrenci_id = v_ogr2;
  if p1 <> 75 or p2 <> 100 then
    raise exception 'HATA: başlangıç puanları beklenmedik (% ve %)', p1, p2;
  end if;
  raise notice '    yanlış anahtarla: doğru çözen 75, hatayı paylaşan 100 — kurulum hazır';

  ------------------------------------------------------------------
  raise notice '--- 1. odev_detay anahtarı öğretmene veriyor ---';
  r := public.odev_detay(t_ogretmen, v_odev);
  if (r -> 'cevap_anahtari' ->> '3') <> 'A' then
    raise exception 'HATA: odev_detay cevap anahtarını vermedi!';
  end if;
  if (r ->> 'gonderim_sayisi')::int <> 2 then
    raise exception 'HATA: gönderim sayısı yanlış!';
  end if;
  raise notice '    anahtar ve gönderim sayısı doğru: OK';

  ------------------------------------------------------------------
  raise notice '--- 2. ANAHTAR DÜZELTİLİNCE YENİDEN PUANLAMA ---';
  r := public.odev_guncelle(t_ogretmen, v_odev, 'DUZ Test', null, v_sinif,
                            current_date + 5, 4,
                            '{"1":"A","2":"B","3":"C","4":"D"}'::jsonb, null, null);
  rapor := r -> 'yeniden_puanlanan';

  select puan into p1 from public.gonderimler where odev_id = v_odev and ogrenci_id = v_ogr1;
  select puan into p2 from public.gonderimler where odev_id = v_odev and ogrenci_id = v_ogr2;
  if p1 <> 100 then
    raise exception 'HATA: doğru çözen öğrenci yeniden puanlanmadı! (%)', p1;
  end if;
  if p2 <> 75 then
    raise exception 'HATA: hatalı çözen öğrencinin puanı düşmedi! (%)', p2;
  end if;
  raise notice '    doğru çözen 75 → 100, hatalı çözen 100 → 75: OK';

  if jsonb_array_length(rapor) <> 2 then
    raise exception 'HATA: rapor % kayıt içeriyor, 2 olmalı', jsonb_array_length(rapor);
  end if;
  raise notice '    rapor iki öğrenciyi de listeliyor: OK';

  ------------------------------------------------------------------
  raise notice '--- 3. Not değişikliği denetim izine yazıldı mı ---';
  select count(*) into n from public.denetim_izi
   where islem = 'yeniden_puanlandi';
  if n <> 2 then
    raise exception 'HATA: denetim izinde % kayıt var, 2 olmalı', n;
  end if;
  raise notice '    iki not değişikliği de iz bıraktı: OK';

  ------------------------------------------------------------------
  raise notice '--- 4. Puanı DEĞİŞMEYEN öğrenci raporda olmamalı ---';
  -- Aynı anahtarla tekrar güncelle: hiçbir puan değişmemeli.
  r := public.odev_guncelle(t_ogretmen, v_odev, 'DUZ Test', 'açıklama eklendi', v_sinif,
                            current_date + 9, 4,
                            '{"1":"A","2":"B","3":"C","4":"D"}'::jsonb, null, null);
  if jsonb_array_length(r -> 'yeniden_puanlanan') <> 0 then
    raise exception 'HATA: değişmeyen puanlar raporlandı!';
  end if;
  raise notice '    boş rapor: OK';

  ------------------------------------------------------------------
  raise notice '--- 5. Diğer alanlar güncelleniyor (yayındayken de) ---';
  r := public.odev_detay(t_ogretmen, v_odev);
  if (r ->> 'aciklama') <> 'açıklama eklendi'
     or (r ->> 'son_tarih')::date <> current_date + 9 then
    raise exception 'HATA: açıklama/son tarih güncellenmedi!';
  end if;
  if not (r ->> 'yayinda')::boolean then
    raise exception 'HATA: ödev yayından düştü!';
  end if;
  raise notice '    açıklama ve son tarih değişti, yayın durumu korundu: OK';

  ------------------------------------------------------------------
  raise notice '--- 6. Soru sayısı küçülünce anahtar kırpılıyor ---';
  r := public.odev_guncelle(t_ogretmen, v_odev, 'DUZ Test', null, v_sinif,
                            current_date + 9, 2,
                            '{"1":"A","2":"B","3":"C","4":"D"}'::jsonb, null, null);
  r := public.odev_detay(t_ogretmen, v_odev);
  if (r -> 'cevap_anahtari') ? '3' or (r -> 'cevap_anahtari') ? '4' then
    raise exception 'HATA: soru sayısı 2 olduğu hâlde 3-4 anahtarda kaldı!';
  end if;
  raise notice '    fazla anahtar kırpıldı, şema kısıtı korundu: OK';

  ------------------------------------------------------------------
  raise notice '--- 7. Öğrenci ve veli bu fonksiyonları çağıramaz ---';
  begin
    perform public.odev_detay(t_ogr1, v_odev);
    raise exception 'HATA: ÖĞRENCİ ODEV_DETAY ÇAĞIRDI — anahtar sızardı!';
  exception when insufficient_privilege then
    raise notice '    öğrenci odev_detay''dan reddedildi: OK';
  end;

  begin
    perform public.odev_guncelle(t_veli, v_odev, 'X', null, v_sinif, current_date + 1);
    raise exception 'HATA: VELİ ÖDEVİ GÜNCELLEDİ!';
  exception when insufficient_privilege then
    raise notice '    veli odev_guncelle''den reddedildi: OK';
  end;

  ------------------------------------------------------------------
  raise notice '--- 8. Boş başlık reddediliyor ---';
  begin
    perform public.odev_guncelle(t_ogretmen, v_odev, '   ', null, v_sinif, current_date + 1);
    raise exception 'HATA: boş başlık kabul edildi!';
  exception when others then
    if sqlstate = '22023' then raise notice '    boş başlık reddedildi: OK';
    else raise; end if;
  end;

  raise notice '';
  raise notice '=========================================';
  raise notice 'ÖDEV DÜZENLEME TESTLERİ GEÇTİ';
  raise notice '=========================================';
end;
$$;
