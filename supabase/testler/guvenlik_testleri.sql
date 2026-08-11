-- =============================================================================
-- SEKİZ — Faz 1 güvenlik ve davranış testleri
--
-- Yerel bir PostgreSQL üzerinde migration'lar uygulandıktan sonra çalıştırılır.
-- Her test başarısız olursa `assert` istisna fırlatır ve script durur.
-- "Muhtemelen çalışıyor" kabul edilmez.
-- =============================================================================

\set ON_ERROR_STOP on

do $$
declare
  t_ogretmen text;
  t_ogrenci  text;
  t_veli     text;
  v_sinif    uuid;
  v_ogrenci  uuid;
  v_odev     uuid;
  r          jsonb;
  s          record;
  kodlar     jsonb;
  hata       text;
begin
  raise notice '--- 1. PIN hash''li saklanıyor mu? ---';
  r := public.pin_ayarla('gizli123');
  assert (r ->> 'rol') = 'ogretmen', 'PIN ayarlama öğretmen rolü döndürmeli';
  t_ogretmen := r ->> 'token';
  assert t_ogretmen is not null and length(t_ogretmen) = 64, 'Jeton üretilmeli';

  assert (select ogretmen_pin_hash from public.ayarlar where id = 1) <> 'gizli123',
         'HATA: PIN düz metin saklanıyor!';
  assert (select ogretmen_pin_hash from public.ayarlar where id = 1) like '$2%',
         'PIN bcrypt ile hash''lenmeli';
  raise notice '    PIN bcrypt hash: OK';

  raise notice '--- 2. PIN ikinci kez ayarlanamamalı ---';
  begin
    perform public.pin_ayarla('baskabiri');
    raise exception 'HATA: PIN yeniden ayarlanabildi!';
  exception when insufficient_privilege then
    raise notice '    ikinci pin_ayarla reddedildi: OK';
  end;

  raise notice '--- 3. Sınıf ve öğrenci oluşturma ---';
  r := public.sinif_ekle(t_ogretmen, 9::smallint, 'A');
  v_sinif := (r ->> 'id')::uuid;
  assert (r ->> 'ad') = '9A', 'Sınıf adı türetilmeli';

  r := public.ogrenci_ekle(t_ogretmen, 'Test Öğrenci', 'okul', v_sinif);
  v_ogrenci := (r ->> 'id')::uuid;
  assert (r ->> 'ogrenci_kodu') <> (r ->> 'veli_kodu'), 'Kodlar farklı olmalı';
  assert length(r ->> 'ogrenci_kodu') = 8, 'Kod 8 karakter olmalı';

  t_ogrenci := (public.giris(r ->> 'ogrenci_kodu')) ->> 'token';
  t_veli    := (public.giris(r ->> 'veli_kodu')) ->> 'token';
  assert t_ogrenci is not null and t_veli is not null, 'Kod ile giriş çalışmalı';
  raise notice '    öğrenci/veli girişi: OK';

  raise notice '--- 4. Okul öğrencisi sınıfsız eklenememeli ---';
  begin
    perform public.ogrenci_ekle(t_ogretmen, 'Sınıfsız', 'okul', null);
    raise exception 'HATA: sınıfsız okul öğrencisi eklendi!';
  exception when others then
    if sqlstate = 'P0001' and sqlerrm like 'HATA:%' then raise; end if;
    raise notice '    sınıfsız okul öğrencisi reddedildi: OK';
  end;

  raise notice '--- 5. Deterministik puanlama ---';
  -- Anahtar: 1-B 2-D 3-A 4-C 5-E, öğrenci: 1-B 2-A 3-A 4-C 5-E → 4 doğru
  select * into s from public._puanla(
    '{"1":"B","2":"D","3":"A","4":"C","5":"E"}'::jsonb,
    '{"1":"B","2":"A","3":"A","4":"C","5":"E"}'::jsonb, 5);
  assert s.dogru = 4 and s.yanlis = 1 and s.bos = 0 and s.puan = 80.00,
         format('Puanlama yanlış: %s/%s/%s puan %s', s.dogru, s.yanlis, s.bos, s.puan);
  raise notice '    4 doğru 1 yanlış = 80 puan: OK';

  -- Boş cevaplar yanlış sayılmamalı
  select * into s from public._puanla(
    '{"1":"B","2":"D","3":"A"}'::jsonb, '{"1":"B"}'::jsonb, 3);
  assert s.dogru = 1 and s.yanlis = 0 and s.bos = 2,
         format('Boş cevap hatalı: %s/%s/%s', s.dogru, s.yanlis, s.bos);
  raise notice '    boş cevaplar boş sayıldı: OK';

  -- Geçersiz şık ve küçük harf
  select * into s from public._puanla(
    '{"1":"B","2":"D"}'::jsonb, '{"1":"b","2":"Z"}'::jsonb, 2);
  assert s.dogru = 1 and s.yanlis = 1,
         format('Geçersiz şık hatalı: %s/%s', s.dogru, s.yanlis);
  raise notice '    küçük harf doğru, geçersiz şık yanlış: OK';

  -- Hiç cevap yok — çökmemeli
  select * into s from public._puanla('{"1":"A"}'::jsonb, '{}'::jsonb, 1);
  assert s.bos = 1 and s.puan = 0, 'Boş gönderim 0 puan olmalı';
  raise notice '    tamamen boş gönderim çökmedi: OK';

  raise notice '--- 6. Yayınlanmamış ödev öğrenciye görünmemeli ---';
  r := public.odev_olustur(t_ogretmen, 'Türev testi', null, v_sinif, 'test',
                           current_date + 7, 5,
                           '{"1":"B","2":"D","3":"A","4":"C","5":"E"}'::jsonb, null);
  v_odev := (r ->> 'id')::uuid;
  assert (r ->> 'yayinda')::boolean = false, 'Ödev taslak olarak başlamalı';

  r := public.ogrenci_odevleri(t_ogrenci);
  assert jsonb_array_length(r -> 'odevler') = 0, 'Taslak ödev öğrenciye düşmemeli';
  raise notice '    taslak ödev gizli: OK';

  raise notice '--- 7. Eksik cevap anahtarıyla yayınlanamamalı ---';
  declare v_eksik uuid;
  begin
    r := public.odev_olustur(t_ogretmen, 'Eksik anahtar', null, v_sinif, 'test',
                             current_date + 7, 5, '{"1":"A"}'::jsonb, null);
    v_eksik := (r ->> 'id')::uuid;
    begin
      perform public.odev_yayinla(t_ogretmen, v_eksik);
      raise exception 'HATA: eksik anahtarlı ödev yayınlandı!';
    exception when others then
      if sqlerrm like 'HATA:%' then raise; end if;
      raise notice '    eksik anahtar yayını reddedildi: OK';
    end;
  end;

  perform public.odev_yayinla(t_ogretmen, v_odev);

  raise notice '--- 8. CEVAP ANAHTARI teslim öncesi sızıyor mu? ---';
  r := public.ogrenci_odevleri(t_ogrenci);
  assert jsonb_array_length(r -> 'odevler') = 1, 'Yayınlanan ödev görünmeli';
  assert (r -> 'odevler' -> 0 -> 'cevap_anahtari') = 'null'::jsonb,
         'KRİTİK HATA: cevap anahtarı teslim öncesi gönderiliyor!';
  assert (r -> 'odevler' -> 0 -> 'anahtar_yolu') = 'null'::jsonb,
         'KRİTİK HATA: anahtar dosya yolu teslim öncesi gönderiliyor!';
  raise notice '    teslim öncesi anahtar gizli: OK';

  raise notice '--- 9. Teslim ve puanlama ---';
  r := public.odev_gonder(t_ogrenci, v_odev, 'cozum/' || v_odev || '/' || v_ogrenci || '.jpg',
                          '{"1":"B","2":"A","3":"A","4":"C","5":"E"}'::jsonb);
  assert (r ->> 'puan')::numeric = 80.00, 'Teslimde puan 80 olmalı';
  raise notice '    teslim puanı 80: OK';

  raise notice '--- 10. Teslim sonrası anahtar açılmalı ---';
  r := public.ogrenci_odevleri(t_ogrenci);
  assert (r -> 'odevler' -> 0 -> 'cevap_anahtari') <> 'null'::jsonb,
         'Teslimden sonra anahtar görünmeli';
  raise notice '    teslim sonrası anahtar açıldı: OK';

  raise notice '--- 11. MÜKERRER TESLİM engelleniyor mu? ---';
  begin
    perform public.odev_gonder(t_ogrenci, v_odev, 'cozum/' || v_odev || '/' || v_ogrenci || '.jpg',
                               '{"1":"B","2":"D","3":"A","4":"C","5":"E"}'::jsonb);
    raise exception 'HATA: mükerrer teslim kabul edildi!';
  exception when unique_violation then
    raise notice '    mükerrer teslim reddedildi: OK';
  end;
  assert (select count(*) from public.gonderimler where odev_id = v_odev) = 1,
         'Tek gönderim olmalı';

  raise notice '--- 12. VELİ cevap anahtarını görebiliyor mu? ---';
  r := public.veli_paneli(t_veli);
  assert r::text not like '%cevap_anahtari%', 'KRİTİK HATA: veli anahtarı görüyor!';
  assert r::text not like '%anahtar_yolu%', 'KRİTİK HATA: veli anahtar yolunu görüyor!';
  assert (r -> 'odevler' -> 0 ->> 'puan')::numeric = 80.00, 'Veli puanı görmeli';
  raise notice '    veli anahtarı görmüyor, puanı görüyor: OK';

  raise notice '--- 13. Öğrenci öğretmen fonksiyonunu çağırabilir mi? ---';
  begin
    perform public.ogretmen_panosu(t_ogrenci);
    raise exception 'HATA: öğrenci öğretmen panosunu açtı!';
  exception when insufficient_privilege then
    raise notice '    öğrenci öğretmen panosundan reddedildi: OK';
  end;

  begin
    perform public.ogrenci_pasiflestir(t_veli, v_ogrenci);
    raise exception 'HATA: veli öğrenci sildi!';
  exception when insufficient_privilege then
    raise notice '    veli silme işleminden reddedildi: OK';
  end;

  raise notice '--- 14. Geçersiz/uydurma jeton ---';
  begin
    perform public.ogretmen_panosu(repeat('f', 64));
    raise exception 'HATA: uydurma jeton kabul edildi!';
  exception when invalid_authorization_specification then
    raise notice '    uydurma jeton reddedildi: OK';
  end;

  raise notice '--- 15. Çıkış jetonu düşürüyor mu? ---';
  perform public.cikis(t_veli);
  begin
    perform public.veli_paneli(t_veli);
    raise exception 'HATA: çıkıştan sonra jeton hâlâ geçerli!';
  exception when invalid_authorization_specification then
    raise notice '    çıkış sonrası jeton geçersiz: OK';
  end;

  raise notice '--- 16. Pasif öğrencinin erişimi düşüyor mu? ---';
  perform public.ogrenci_pasiflestir(t_ogretmen, v_ogrenci);
  begin
    perform public.ogrenci_odevleri(t_ogrenci);
    raise exception 'HATA: pasif öğrenci hâlâ erişebiliyor!';
  exception when invalid_authorization_specification then
    raise notice '    pasif öğrencinin oturumu iptal edildi: OK';
  end;
  assert (select count(*) from public.giris_kodlari where ogrenci_id = v_ogrenci) = 0,
         'Pasif öğrencinin kodları silinmeli';

  raise notice '--- 17. Denetim izi tutuluyor mu? ---';
  assert (select count(*) from public.denetim_izi) > 0, 'Denetim izi boş olmamalı';
  assert exists (select 1 from public.denetim_izi where islem = 'odev_gonderildi'),
         'Teslim denetim izine yazılmalı';
  raise notice '    denetim izi kaydı var: OK';

  raise notice '--- 18. Özel ders kaydı okul öğrencisine açılamamalı ---';
  declare v_okul uuid;
  begin
    r := public.ogrenci_ekle(t_ogretmen, 'Okul Öğrencisi', 'okul', v_sinif);
    v_okul := (r ->> 'id')::uuid;
    begin
      perform public.odeme_ekle(t_ogretmen, v_okul, 500, current_date);
      raise exception 'HATA: okul öğrencisine ödeme kaydı açıldı!';
    exception when insufficient_privilege then
      raise notice '    okul öğrencisine ödeme reddedildi: OK';
    end;
  end;

  raise notice '';
  raise notice '=========================================';
  raise notice 'TÜM TESTLER GEÇTİ';
  raise notice '=========================================';
end;
$$;
