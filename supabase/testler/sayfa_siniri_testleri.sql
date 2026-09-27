-- =============================================================================
-- SEKİZ — 0054 SAYFA SINIRI TESTLERİ
--
-- En kritik iki ölçüm:
--   1. VARSAYILAN YOL DEĞİŞMEDİ: sınırı 1 olan ödevde bugünkü çağrı biçimi
--      aynen çalışıyor, ek sayfa yolu açılmıyor.
--   2. YOL HÂLÂ HESAPLANIYOR: ek sayfalar da öğrencinin kendi kimliğini
--      taşıyor; başkasının `-2` yoluna yükleme ve gönderim imkânsız.
--
-- Sınıf adları iki harfli (12-SA/SB/SC): tüm test dosyaları aynı
-- veritabanını paylaşıyor, tek harfli şubeler başka dosyalarda kullanılıyor.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  t_ogretmen text;
  t_ali      text;
  t_ayse     text;
  t_can      text;
  t_veli_ali text;
  t_veli_ayse text;
  v_sinif    uuid;
  v_sinif_b  uuid;
  v_sinif_c  uuid;
  v_ali      uuid;
  v_ayse     uuid;
  v_can      uuid;
  v_bir      uuid;   -- sınırı 1 (varsayılan)
  v_uc       uuid;   -- sınırı 3
  v_taslak   uuid;
  v_yabanci  uuid;   -- başka sınıfın ödevi
  v_grup     jsonb;
  v_kardes_a uuid;
  v_kardes_b uuid;
  r          jsonb;
  n          integer;
  ek         text[];
  v_kod      text;
begin
  raise notice '--- Kurulum ---';
  -- Öğretmen ve sınıflar 0033 sonrası testlerin kalıbıyla kuruluyor
  -- (odev_kiyasi_testleri.sql): PIN doğrudan yazılıyor, sınıflar yöneticiye
  -- `ogretmen_siniflari` üzerinden bağlanıyor.
  update public.ogretmenler
     set pin_hash = extensions.crypt('Sayfa!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  t_ogretmen := (public.giris('Sayfa!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (12, 'SA')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_sinif;
  insert into public.siniflar (seviye, sube) values (12, 'SB')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_sinif_b;
  insert into public.siniflar (seviye, sube) values (12, 'SC')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_sinif_c;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    select g.id, s.id from public.ogretmenler g, public.siniflar s
     where g.yonetici and s.id in (v_sinif, v_sinif_b, v_sinif_c)
    on conflict do nothing;

  r := public.ogrenci_ekle(t_ogretmen, 'Ali Sayfa', 'okul', v_sinif);
  v_ali := (r ->> 'id')::uuid;
  t_ali := (public.giris(r ->> 'ogrenci_kodu')) ->> 'token';
  t_veli_ali := (public.giris(r ->> 'veli_kodu')) ->> 'token';
  perform public.onam_ver(t_veli_ali, public._gecerli_onam_surumu(), 'Ali Velisi');

  r := public.ogrenci_ekle(t_ogretmen, 'Ayşe Sayfa', 'okul', v_sinif);
  v_ayse := (r ->> 'id')::uuid;
  t_ayse := (public.giris(r ->> 'ogrenci_kodu')) ->> 'token';
  t_veli_ayse := (public.giris(r ->> 'veli_kodu')) ->> 'token';
  perform public.onam_ver(t_veli_ayse, public._gecerli_onam_surumu(), 'Ayşe Velisi');

  r := public.ogrenci_ekle(t_ogretmen, 'Can Sayfa', 'okul', v_sinif);
  v_can := (r ->> 'id')::uuid;
  t_can := (public.giris(r ->> 'ogrenci_kodu')) ->> 'token';

  -- Sınırı VERİLMEYEN ödev: bugünkü arayüzün çağrısı birebir bu.
  r := public.odev_olustur(t_ogretmen, 'Tek sayfa', null, v_sinif, 'test',
                           current_date + 5, 2, '{"1":"A","2":"B"}'::jsonb,
                           'odev/sayfa-test/anahtar.pdf', null);
  v_bir := (r ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogretmen, v_bir);

  r := public.odev_olustur(p_token => t_ogretmen, p_baslik => 'Üç sayfa',
                           p_aciklama => null, p_sinif_id => v_sinif, p_tur => 'acik',
                           p_son_tarih => current_date + 5, p_sayfa_limiti => 3::smallint);
  v_uc := (r ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogretmen, v_uc);

  r := public.odev_olustur(p_token => t_ogretmen, p_baslik => 'Taslak',
                           p_aciklama => null, p_sinif_id => v_sinif, p_tur => 'acik',
                           p_son_tarih => current_date + 5, p_sayfa_limiti => 3::smallint);
  v_taslak := (r ->> 'id')::uuid;

  r := public.odev_olustur(p_token => t_ogretmen, p_baslik => 'Başka sınıf',
                           p_aciklama => null, p_sinif_id => v_sinif_b, p_tur => 'acik',
                           p_son_tarih => current_date + 5, p_sayfa_limiti => 3::smallint);
  v_yabanci := (r ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogretmen, v_yabanci);

  ------------------------------------------------------------------
  raise notice '--- 1. VARSAYILAN 1 — öğretmen, öğrenci ve tablo aynı şeyi söylüyor ---';
  if (select sayfa_limiti from public.odevler where id = v_bir) <> 1 then
    raise exception 'HATA: sınır verilmeyen ödevin sınırı 1 değil!';
  end if;
  if (public.odev_detay(t_ogretmen, v_bir) ->> 'sayfa_limiti')::int <> 1
     or (public.odev_detay(t_ogretmen, v_uc) ->> 'sayfa_limiti')::int <> 3 then
    raise exception 'HATA: odev_detay sınırı yanlış döndürüyor!';
  end if;
  if public.odev_sayfa_siniri(t_ali, v_bir) <> 1
     or public.odev_sayfa_siniri(t_ali, v_uc) <> 3 then
    raise exception 'HATA: odev_sayfa_siniri yanlış döndürüyor!';
  end if;
  raise notice '    varsayılan 1; detay ve öğrenci ucu tutarlı: OK';

  ------------------------------------------------------------------
  raise notice '--- 2. SINIR 1: ek sayfa yolu AÇILMIYOR ---';
  if public.dosya_erisim_izni(t_ali, 'cozum/' || v_bir || '/' || v_ali || '-2.jpg') then
    raise exception 'HATA: sınırı 1 olan ödevde 2. sayfa yolu açıldı!';
  end if;
  if not public.dosya_erisim_izni(t_ali, 'cozum/' || v_bir || '/' || v_ali || '.jpg') then
    raise exception 'HATA: 1. sayfa yolu kapandı — REGRESYON!';
  end if;
  raise notice '    1. sayfa açık, 2. sayfa kapalı: OK';

  ------------------------------------------------------------------
  raise notice '--- 3. SINIR 1: BUGÜNKÜ ÇAĞRI BİÇİMİ aynen çalışıyor (regresyon) ---';
  -- Dört argüman, konumsal — 0054 öncesinde yayına girmiş arayüzün çağrısı.
  r := public.odev_gonder(t_ali, v_bir, 'cozum/' || v_bir || '/' || v_ali || '.jpg',
                          '{"1":"A","2":"B"}'::jsonb);
  if (r ->> 'puan')::numeric <> 100 then
    raise exception 'HATA: puan yanlış (%)', r ->> 'puan';
  end if;
  if (select ek_sayfa_yollari from public.gonderimler
       where odev_id = v_bir and ogrenci_id = v_ali) is not null then
    raise exception 'HATA: tek sayfalık gönderimde ek sayfa dizisi NULL değil!';
  end if;
  r := public.gonderim_foto_yolu(t_ogretmen,
         (select id from public.gonderimler where odev_id = v_bir and ogrenci_id = v_ali));
  if r ->> 'yol' <> 'cozum/' || v_bir || '/' || v_ali || '.jpg'
     or jsonb_array_length(r -> 'yollar') <> 1 then
    raise exception 'HATA: gonderim_foto_yolu tek sayfada bozuk: %', r;
  end if;
  raise notice '    eski çağrı çalışıyor, puan 100, dizi NULL, `yol` aynen duruyor: OK';

  ------------------------------------------------------------------
  raise notice '--- 4. Boş dizi = tek sayfa (NULL ile aynı) ---';
  perform public.odev_gonder(t_ayse, v_bir, 'cozum/' || v_bir || '/' || v_ayse || '.jpg',
                             '{"1":"A"}'::jsonb, '{}'::text[]);
  if (select ek_sayfa_yollari from public.gonderimler
       where odev_id = v_bir and ogrenci_id = v_ayse) is not null then
    raise exception 'HATA: boş dizi NULL''a çevrilmedi — "ek sayfa yok"un iki yazımı oldu!';
  end if;
  raise notice '    boş dizi NULL olarak kaydedildi: OK';

  ------------------------------------------------------------------
  raise notice '--- 5. SINIR 3: yükleme yolları sınıra kadar açık, ötesi kapalı ---';
  if not public.dosya_erisim_izni(t_ali, 'cozum/' || v_uc || '/' || v_ali || '.jpg')
     or not public.dosya_erisim_izni(t_ali, 'cozum/' || v_uc || '/' || v_ali || '-2.jpg')
     or not public.dosya_erisim_izni(t_ali, 'cozum/' || v_uc || '/' || v_ali || '-3.jpg') then
    raise exception 'HATA: sınır içindeki bir sayfa yolu kapalı!';
  end if;
  if public.dosya_erisim_izni(t_ali, 'cozum/' || v_uc || '/' || v_ali || '-4.jpg') then
    raise exception 'HATA: SINIRIN ÖTESİNDEKİ 4. SAYFAYA YÜKLEME YOLU AÇIK!';
  end if;
  raise notice '    1–3 açık, 4 kapalı: OK';

  ------------------------------------------------------------------
  raise notice '--- 6. Uydurma ek yollar reddediliyor ---';
  if public.dosya_erisim_izni(t_ali, 'cozum/' || v_uc || '/' || v_ali || '-1.jpg')    -- 1. sayfanın ikinci yazımı
     or public.dosya_erisim_izni(t_ali, 'cozum/' || v_uc || '/' || v_ali || '-9.jpg') -- 8'in ötesi
     or public.dosya_erisim_izni(t_ali, 'cozum/' || v_uc || '/' || v_ali || '-10.jpg')
     or public.dosya_erisim_izni(t_ali, 'cozum/' || v_uc || '/' || v_ali || '-2.exe')
     or public.dosya_erisim_izni(t_ali, 'cozum/' || v_uc || '/' || v_ali || '-2-3.jpg')
     or public.dosya_erisim_izni(t_ali, 'cozum/' || v_uc || '/' || v_ali || '_2.jpg') then
    raise exception 'HATA: uydurma bir ek sayfa yolu kabul edildi!';
  end if;
  raise notice '    -1, -9, -10, yanlış uzantı ve bozuk ek reddedildi: OK';

  ------------------------------------------------------------------
  raise notice '--- 7. BAŞKASININ ek sayfa yolu KAPALI ---';
  if public.dosya_erisim_izni(t_ali, 'cozum/' || v_uc || '/' || v_ayse || '-2.jpg') then
    raise exception 'HATA: ALİ, AYŞE''NİN 2. SAYFASINA YÜKLEYEBİLİYOR!';
  end if;
  if public.dosya_erisim_izni(t_ali, 'cozum/' || v_taslak || '/' || v_ali || '-2.jpg') then
    raise exception 'HATA: taslak ödevde ek sayfa yolu açık!';
  end if;
  if public.dosya_erisim_izni(t_ali, 'cozum/' || v_yabanci || '/' || v_ali || '-2.jpg') then
    raise exception 'HATA: başka sınıfın ödevinde ek sayfa yolu açık!';
  end if;
  if public.dosya_erisim_izni(t_veli_ali, 'cozum/' || v_uc || '/' || v_ali || '-2.jpg') then
    raise exception 'HATA: VELİ, GÖNDERİM OLMADAN EK SAYFA YOLUNA ERİŞİYOR!';
  end if;
  raise notice '    başkasının, taslağın, başka sınıfın ve velinin yolu kapalı: OK';

  ------------------------------------------------------------------
  raise notice '--- 8. Gönderimde SIRA ve KİMLİK denetimi ---';
  -- Her deneme 42501 ile düşmeli; hiçbiri kayıt bırakmamalı.
  foreach v_kod in array array[
    -- 2. sayfa atlanmış
    'ARRAY[''cozum/' || v_uc || '/' || v_ali || '-3.jpg'']',
    -- aynı sayfa iki kez
    'ARRAY[''cozum/' || v_uc || '/' || v_ali || '-2.jpg'', ''cozum/' || v_uc || '/' || v_ali || '-2.jpg'']',
    -- ters sıra
    'ARRAY[''cozum/' || v_uc || '/' || v_ali || '-3.jpg'', ''cozum/' || v_uc || '/' || v_ali || '-2.jpg'']',
    -- başkasının sayfası
    'ARRAY[''cozum/' || v_uc || '/' || v_ayse || '-2.jpg'']',
    -- başka ödevin sayfası
    'ARRAY[''cozum/' || v_bir || '/' || v_ali || '-2.jpg'']',
    -- NULL eleman
    'ARRAY[NULL::text]'
  ] loop
    begin
      execute format('select public.odev_gonder(%L, %L::uuid, %L, null, %s)',
                     t_ali, v_uc, 'cozum/' || v_uc || '/' || v_ali || '.jpg', v_kod);
      raise exception 'HATA: GEÇERSİZ EK SAYFA DİZİSİ KABUL EDİLDİ: %', v_kod;
    exception when insufficient_privilege then
      null;
    end;
  end loop;

  -- 1. sayfa yerine ek sayfa yolu: `foto_yolu` her zaman eksiz olmalı.
  begin
    perform public.odev_gonder(t_ali, v_uc, 'cozum/' || v_uc || '/' || v_ali || '-2.jpg');
    raise exception 'HATA: 1. sayfa yerine 2. sayfa yolu kabul edildi!';
  exception when insufficient_privilege then
    null;
  end;

  if exists (select 1 from public.gonderimler where odev_id = v_uc) then
    raise exception 'HATA: reddedilen denemeler kayıt bıraktı!';
  end if;
  raise notice '    atlama, tekrar, ters sıra, yabancı yol, NULL, ekli 1. sayfa reddedildi: OK';

  ------------------------------------------------------------------
  raise notice '--- 9. SINIR AŞIMI anlaşılır bir mesajla reddediliyor ---';
  begin
    perform public.odev_gonder(t_ali, v_uc, 'cozum/' || v_uc || '/' || v_ali || '.jpg', null,
      array['cozum/' || v_uc || '/' || v_ali || '-2.jpg',
            'cozum/' || v_uc || '/' || v_ali || '-3.jpg',
            'cozum/' || v_uc || '/' || v_ali || '-4.jpg']);
    raise exception 'HATA: 4 SAYFA, SINIRI 3 OLAN ÖDEVE GÖNDERİLDİ!';
  exception when invalid_parameter_value then
    get stacked diagnostics v_kod = message_text;
    if v_kod not like '%en fazla 3 sayfa%' then
      raise exception 'HATA: sınır aşımında yanlış mesaj: %', v_kod;
    end if;
  end;
  raise notice '    "en fazla 3 sayfa" ile reddedildi: OK';

  ------------------------------------------------------------------
  raise notice '--- 10. ÜÇ SAYFALIK GÖNDERİM kabul ediliyor, sıra korunuyor ---';
  perform public.odev_gonder(t_ali, v_uc, 'cozum/' || v_uc || '/' || v_ali || '.jpg', null,
    array['cozum/' || v_uc || '/' || v_ali || '-2.jpg',
          ' cozum/' || v_uc || '/' || v_ali || '-3.jpg ']);   -- boşluk kırpılmalı
  select ek_sayfa_yollari into ek from public.gonderimler
   where odev_id = v_uc and ogrenci_id = v_ali;
  if ek is distinct from array['cozum/' || v_uc || '/' || v_ali || '-2.jpg',
                                'cozum/' || v_uc || '/' || v_ali || '-3.jpg'] then
    raise exception 'HATA: ek sayfalar yanlış kaydedildi: %', ek;
  end if;
  r := public.gonderim_foto_yolu(t_ogretmen,
         (select id from public.gonderimler where odev_id = v_uc and ogrenci_id = v_ali));
  if jsonb_array_length(r -> 'yollar') <> 3
     or r -> 'yollar' ->> 0 <> 'cozum/' || v_uc || '/' || v_ali || '.jpg'
     or r -> 'yollar' ->> 2 <> 'cozum/' || v_uc || '/' || v_ali || '-3.jpg'
     or r ->> 'yol' <> r -> 'yollar' ->> 0 then
    raise exception 'HATA: öğretmen sayfaları doğru sırayla göremiyor: %', r;
  end if;
  raise notice '    kaydedildi, kırpıldı, öğretmen 3 sayfayı sırayla görüyor: OK';

  ------------------------------------------------------------------
  raise notice '--- 11. Gönderimden sonra: öğrenci ve VELİSİ görüyor, başkası görmüyor ---';
  if not public.dosya_erisim_izni(t_ali, 'cozum/' || v_uc || '/' || v_ali || '-3.jpg') then
    raise exception 'HATA: öğrenci kendi 3. sayfasını göremiyor!';
  end if;
  if not public.dosya_erisim_izni(t_veli_ali, 'cozum/' || v_uc || '/' || v_ali || '-3.jpg') then
    raise exception 'HATA: veli çocuğunun 3. sayfasını göremiyor!';
  end if;
  if public.dosya_erisim_izni(t_veli_ayse, 'cozum/' || v_uc || '/' || v_ali || '-3.jpg') then
    raise exception 'HATA: BAŞKA ÇOCUĞUN VELİSİ EK SAYFAYI GÖREBİLİYOR!';
  end if;
  if public.dosya_erisim_izni(t_ayse, 'cozum/' || v_uc || '/' || v_ali || '-2.jpg') then
    raise exception 'HATA: SINIF ARKADAŞI EK SAYFAYI GÖREBİLİYOR!';
  end if;
  raise notice '    sahibi ve velisi açık; başka veli ve sınıf arkadaşı kapalı: OK';

  ------------------------------------------------------------------
  raise notice '--- 12. Veli hâlâ ANAHTARA erişemiyor (Kural 6) ---';
  if public.dosya_erisim_izni(t_veli_ali, 'odev/sayfa-test/anahtar.pdf') then
    raise exception 'HATA: VELİ CEVAP ANAHTARINA ERİŞİYOR!';
  end if;
  raise notice '    veli anahtara kapalı: OK';

  ------------------------------------------------------------------
  raise notice '--- 13. Tekrar gönderim hâlâ reddediliyor (kesinlik) ---';
  begin
    perform public.odev_gonder(t_ali, v_uc, 'cozum/' || v_uc || '/' || v_ali || '.jpg');
    raise exception 'HATA: İKİNCİ GÖNDERİM KABUL EDİLDİ!';
  exception when unique_violation then
    null;
  end;
  raise notice '    ikinci gönderim reddedildi: OK';

  ------------------------------------------------------------------
  raise notice '--- 14. odev_sayfa_siniri: yalnız öğrenci, yalnız kendi sınıfı ---';
  begin
    perform public.odev_sayfa_siniri(t_ali, v_yabanci);
    raise exception 'HATA: BAŞKA SINIFIN ÖDEVİNİN SINIRI OKUNDU!';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.odev_sayfa_siniri(t_veli_ali, v_uc);
    raise exception 'HATA: VELİ öğrenci ucunu çağırabildi!';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.odev_sayfa_siniri(t_ogretmen, v_uc);
    raise exception 'HATA: ÖĞRETMEN öğrenci ucunu çağırabildi!';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.odev_sayfa_siniri(t_ali, v_taslak);
    raise exception 'HATA: TASLAK ödevin sınırı öğrenciye göründü!';
  exception when no_data_found then null;
  end;
  raise notice '    başka sınıf, veli, öğretmen 42501; taslak P0002: OK';

  ------------------------------------------------------------------
  raise notice '--- 15. Sınır 1–8 dışı reddediliyor ---';
  foreach n in array array[0, 9, -1] loop
    begin
      perform public.odev_olustur(p_token => t_ogretmen, p_baslik => 'X',
        p_aciklama => null, p_sinif_id => v_sinif, p_tur => 'acik',
        p_son_tarih => current_date + 5, p_sayfa_limiti => n::smallint);
      raise exception 'HATA: % sayfa sınırı kabul edildi!', n;
    exception when invalid_parameter_value then null;
    end;
  end loop;
  begin
    perform public.odev_guncelle(p_token => t_ogretmen, p_id => v_uc, p_baslik => 'Üç sayfa',
      p_aciklama => null, p_sinif_id => v_sinif, p_son_tarih => current_date + 5,
      p_sayfa_limiti => 9::smallint);
    raise exception 'HATA: güncellemede 9 sayfa kabul edildi!';
  exception when invalid_parameter_value then null;
  end;
  raise notice '    0, 9, -1 oluşturmada; 9 güncellemede reddedildi: OK';

  ------------------------------------------------------------------
  raise notice '--- 16. Güncelleme: NULL = DOKUNMA; düşürmek eski gönderime dokunmuyor ---';
  perform public.odev_guncelle(p_token => t_ogretmen, p_id => v_uc, p_baslik => 'Üç sayfa (düzeltildi)',
    p_aciklama => null, p_sinif_id => v_sinif, p_son_tarih => current_date + 5);
  if (select sayfa_limiti from public.odevler where id = v_uc) <> 3 then
    raise exception 'HATA: sınırı göndermeyen güncelleme sınırı DEĞİŞTİRDİ!';
  end if;

  perform public.odev_guncelle(p_token => t_ogretmen, p_id => v_uc, p_baslik => 'Üç sayfa',
    p_aciklama => null, p_sinif_id => v_sinif, p_son_tarih => current_date + 5,
    p_sayfa_limiti => 2::smallint);
  if (select sayfa_limiti from public.odevler where id = v_uc) <> 2 then
    raise exception 'HATA: sınır 2''ye düşmedi!';
  end if;
  if (select cardinality(ek_sayfa_yollari) from public.gonderimler
       where odev_id = v_uc and ogrenci_id = v_ali) <> 2 then
    raise exception 'HATA: SINIRI DÜŞÜRMEK YAPILMIŞ GÖNDERİMİ DEĞİŞTİRDİ!';
  end if;

  -- Sınır düştükten sonra 3 sayfa gönderen öğrenci anlaşılır mesaj almalı.
  begin
    perform public.odev_gonder(t_can, v_uc, 'cozum/' || v_uc || '/' || v_can || '.jpg', null,
      array['cozum/' || v_uc || '/' || v_can || '-2.jpg',
            'cozum/' || v_uc || '/' || v_can || '-3.jpg']);
    raise exception 'HATA: düşürülmüş sınırın üstünde gönderim kabul edildi!';
  exception when invalid_parameter_value then
    get stacked diagnostics v_kod = message_text;
    if v_kod not like '%en fazla 2 sayfa%' then
      raise exception 'HATA: yanlış mesaj: %', v_kod;
    end if;
  end;
  if public.dosya_erisim_izni(t_can, 'cozum/' || v_uc || '/' || v_can || '-3.jpg') then
    raise exception 'HATA: düşürülmüş sınırın ötesindeki sayfa yolu hâlâ açık!';
  end if;
  raise notice '    NULL dokunmadı; 2''ye düştü; eski gönderim 3 sayfa kaldı; yeni 3 sayfa reddedildi: OK';

  ------------------------------------------------------------------
  raise notice '--- 17. Çoklu sınıf ve KARDEŞLERE YAYMA sınırı taşıyor ---';
  v_grup := public.odevler_coklu_olustur(
    p_token => t_ogretmen, p_sinif_idler => jsonb_build_array(v_sinif, v_sinif_c),
    p_baslik => 'Kardeş', p_aciklama => null, p_tur => 'acik',
    p_son_tarih => current_date + 5, p_sayfa_limiti => 4::smallint);
  v_kardes_a := (v_grup -> 'odevler' -> 0 ->> 'odev_id')::uuid;
  v_kardes_b := (v_grup -> 'odevler' -> 1 ->> 'odev_id')::uuid;
  if (select count(*) from public.odevler
       where id in (v_kardes_a, v_kardes_b) and sayfa_limiti = 4) <> 2 then
    raise exception 'HATA: çoklu oluşturma sınırı her sınıfa geçirmedi!';
  end if;

  perform public.odev_guncelle(p_token => t_ogretmen, p_id => v_kardes_a, p_baslik => 'Kardeş',
    p_aciklama => null, p_sinif_id => v_sinif, p_son_tarih => current_date + 5,
    p_sayfa_limiti => 6::smallint);
  perform public.odev_kardeslere_yay(t_ogretmen, v_kardes_a);
  if (select sayfa_limiti from public.odevler where id = v_kardes_b) <> 6 then
    raise exception 'HATA: kardeşlere yayma sayfa sınırını taşımadı!';
  end if;
  raise notice '    çoklu oluşturma 4''ü iki sınıfa verdi; yayma 6''yı kardeşe taşıdı: OK';

  ------------------------------------------------------------------
  raise notice '--- 18. Tablo kısıtları — uçları atlayan bir yazım da düşüyor ---';
  begin
    update public.odevler set sayfa_limiti = 9 where id = v_bir;
    raise exception 'HATA: tablo 9 sayfa sınırını kabul etti!';
  exception when check_violation then null;
  end;
  begin
    update public.gonderimler set ek_sayfa_yollari = '{}'
     where odev_id = v_bir and ogrenci_id = v_ali;
    raise exception 'HATA: tablo boş ek sayfa dizisini kabul etti!';
  exception when check_violation then null;
  end;
  begin
    update public.gonderimler
       set ek_sayfa_yollari = array['a','b','c','d','e','f','g','h']
     where odev_id = v_bir and ogrenci_id = v_ali;
    raise exception 'HATA: tablo 8 ek sayfayı (toplam 9) kabul etti!';
  exception when check_violation then null;
  end;
  raise notice '    9 sınır, boş dizi ve 8 ek sayfa şemada da kilitli: OK';

  ------------------------------------------------------------------
  raise notice '--- 19. ESKİ İMZALAR DÜŞTÜ (0007 tuzağı), yenileri anon''a açık ---';
  if to_regprocedure('public.odev_gonder(text,uuid,text,jsonb)') is not null
     or to_regprocedure('public.odev_olustur(text,text,text,uuid,text,date,integer,jsonb,text,text,boolean,smallint,jsonb)') is not null
     or to_regprocedure('public.odev_guncelle(text,uuid,text,text,uuid,date,integer,jsonb,text,text,boolean,smallint,jsonb)') is not null
     or to_regprocedure('public.odevler_coklu_olustur(text,jsonb,text,text,text,date,integer,jsonb,text,text,boolean,smallint,jsonb)') is not null then
    raise exception 'HATA: 0054 öncesi bir imza hâlâ ayakta!';
  end if;
  if not has_function_privilege('anon', 'public.odev_gonder(text,uuid,text,jsonb,text[])', 'execute')
     or not has_function_privilege('anon', 'public.odev_sayfa_siniri(text,uuid)', 'execute')
     or not has_function_privilege('anon', 'public.odevler_coklu_olustur(text,jsonb,text,text,text,date,integer,jsonb,text,text,boolean,smallint,jsonb,smallint)', 'execute') then
    raise exception 'HATA: yeni bir imza anon''a kapalı — istemci çağıramaz!';
  end if;
  if has_function_privilege('anon', 'public._cozum_yolu_gecerli(uuid,text)', 'execute') then
    raise exception 'HATA: _cozum_yolu_gecerli anon''a açıldı!';
  end if;
  raise notice '    eski imzalar yok, yeniler açık, dahili yardımcı kapalı: OK';

  raise notice '';
  raise notice '=========================================';
  raise notice 'SAYFA SINIRI TESTLERİ GEÇTİ';
  raise notice '=========================================';
end;
$$;
