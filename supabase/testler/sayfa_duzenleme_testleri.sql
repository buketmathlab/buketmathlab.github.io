-- =============================================================================
-- SEKİZ — 0079 SAYFA SAYISI DÜZENLEME TESTLERİ (0087'DEN SONRA)
--
-- 0087 ALT SINIRI KALDIRDI: sayfa sayısı artık yalnız ÜST sınır. Bu
-- dosyanın "eksik sayfa reddediliyor" iddiaları o yüzden yeniden
-- yazıldı; silinmedi, çünkü asıl ölçüm (sayı değişince ne oluyor)
-- aynen geçerli.
--
--  1. Gönderimi olan ödevin sayfa sayısı DEĞİŞİYOR; önceden yapılmış
--     gönderim (yollar, puan) olduğu gibi kalıyor.
--  2. Yeni sayı henüz göndermeyene ÜST SINIR olarak uygulanıyor: sayının
--     altında gönderim kabul, üstünde red. Sayı KÜÇÜLDÜĞÜNDE de.
--  3. Düzenleme `tum_sayfalar` bayrağını AÇMIYOR (0087); sayının altında
--     gönderim düzenlemeden sonra da kabul.
--  4. Kardeş yayma: gönderimi olan kardeşe de sayı taşınıyor, bayrak
--     kapalı kalıyor; kardeşteki gönderim değişmiyor.
--  5. Yeniden açılan gönderim yeni sayıyla, sayının altında da
--     gönderilebiliyor.
--
-- Sınıf adları iki harfli (12-DA/DB): test dosyaları aynı veritabanını
-- paylaşıyor.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  t_ogr    text;
  t_ali    text;
  t_ayse   text;
  t_yabanci text;
  v_sinif  uuid;
  v_sinif_b uuid;
  v_ali    uuid;
  v_ayse   uuid;
  v_yabanci_ogr uuid;
  v_test   uuid;   -- yeni, test, 2 sayfa
  v_eski   uuid;   -- eski kural, sınır 3
  v_eski2  uuid;   -- eski kural, sayı gönderilmeden güncellenecek
  v_ka     uuid;
  v_kb     uuid;
  v_gon    uuid;
  r        jsonb;
  once     record;
  sonra    record;
  mesaj    text;
begin
  raise notice '--- Kurulum ---';
  update public.ogretmenler
     set pin_hash = extensions.crypt('Duzenle!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  t_ogr := (public.giris('Duzenle!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (12, 'DA')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_sinif;
  insert into public.siniflar (seviye, sube) values (12, 'DB')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_sinif_b;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    select g.id, s.id from public.ogretmenler g, public.siniflar s
     where g.yonetici and s.id in (v_sinif, v_sinif_b)
    on conflict do nothing;

  r := public.ogrenci_ekle(t_ogr, 'Ali Düzenle', 'okul', v_sinif);
  v_ali := (r ->> 'id')::uuid;
  t_ali := (public.giris(r ->> 'ogrenci_kodu')) ->> 'token';
  r := public.ogrenci_ekle(t_ogr, 'Ayşe Düzenle', 'okul', v_sinif);
  v_ayse := (r ->> 'id')::uuid;
  t_ayse := (public.giris(r ->> 'ogrenci_kodu')) ->> 'token';
  r := public.ogrenci_ekle(t_ogr, 'Yabancı Düzenle', 'okul', v_sinif_b);
  v_yabanci_ogr := (r ->> 'id')::uuid;
  t_yabanci := (public.giris(r ->> 'ogrenci_kodu')) ->> 'token';

  r := public.odev_olustur(p_token => t_ogr, p_baslik => 'Test iki sayfa', p_aciklama => null,
                           p_sinif_id => v_sinif, p_tur => 'test',
                           p_son_tarih => current_date + 5, p_soru_sayisi => 2,
                           p_cevap_anahtari => '{"1":"A","2":"B"}'::jsonb,
                           p_sayfa_limiti => 2::smallint);
  v_test := (r ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogr, v_test);

  r := public.odev_olustur(p_token => t_ogr, p_baslik => 'Eski düzen', p_aciklama => null,
                           p_sinif_id => v_sinif, p_tur => 'acik',
                           p_son_tarih => current_date + 5, p_sayfa_limiti => 3::smallint);
  v_eski := (r ->> 'id')::uuid;
  r := public.odev_olustur(p_token => t_ogr, p_baslik => 'Eski düzen 2', p_aciklama => null,
                           p_sinif_id => v_sinif, p_tur => 'acik',
                           p_son_tarih => current_date + 5, p_sayfa_limiti => 3::smallint);
  v_eski2 := (r ->> 'id')::uuid;
  -- 0078 öncesinde oluşturulmuş ödevleri taklit ediyor.
  update public.odevler set tum_sayfalar = false where id in (v_eski, v_eski2);
  perform public.odev_yayinla(t_ogr, v_eski);
  perform public.odev_yayinla(t_ogr, v_eski2);

  ------------------------------------------------------------------
  raise notice '--- 1. Gönderimi olan ödevde sayı değişiyor, gönderim olduğu gibi ---';
  perform public.odev_gonder(t_ali, v_test, 'cozum/' || v_test || '/' || v_ali || '.jpg',
                             '{"1":"A","2":"C"}'::jsonb,
                             array['cozum/' || v_test || '/' || v_ali || '-2.jpg']);
  select foto_yolu, ek_sayfa_yollari, puan, dogru, yanlis into once
    from public.gonderimler where odev_id = v_test and ogrenci_id = v_ali;
  perform public.odev_guncelle(p_token => t_ogr, p_id => v_test, p_baslik => 'Test iki sayfa',
                               p_aciklama => null, p_sinif_id => v_sinif,
                               p_son_tarih => current_date + 5, p_sayfa_limiti => 3::smallint);
  if (select sayfa_limiti from public.odevler where id = v_test) <> 3 then
    raise exception 'HATA: gönderimi olan ödevin sayfa sayısı değişmedi!';
  end if;
  select foto_yolu, ek_sayfa_yollari, puan, dogru, yanlis into sonra
    from public.gonderimler where odev_id = v_test and ogrenci_id = v_ali;
  if once is distinct from sonra then
    raise exception 'HATA: önceden yapılmış gönderim değişti: % → %', once, sonra;
  end if;
  if (public.odev_sayfa_kurali(t_ayse, v_test) ->> 'sayfa')::int <> 3 then
    raise exception 'HATA: öğrenci ucu yeni sayıyı söylemiyor!';
  end if;
  raise notice '    2 → 3 kabul; önceki gönderim (yollar, puan %) aynı: OK', sonra.puan;

  ------------------------------------------------------------------
  raise notice '--- 2. Yeni sayı ÜST SINIR olarak uygulanıyor (büyüyünce ve küçülünce) ---';
  -- 0087: 2/3 artık GEÇİYOR. Sayı yalnız tavan.
  perform public.odev_gonder(t_ayse, v_test, 'cozum/' || v_test || '/' || v_ayse || '.jpg',
                             '{"1":"A","2":"B"}'::jsonb,
                             array['cozum/' || v_test || '/' || v_ayse || '-2.jpg']);
  if (select cardinality(ek_sayfa_yollari) from public.gonderimler
       where odev_id = v_test and ogrenci_id = v_ayse) <> 1 then
    raise exception 'HATA: 2/3 sayfalık gönderim kaydedilmedi!';
  end if;
  delete from public.gonderimler where odev_id = v_test and ogrenci_id = v_ayse;
  -- Sayı küçülüyor: 3 → 1. Artık 2 sayfa fazla.
  perform public.odev_guncelle(p_token => t_ogr, p_id => v_test, p_baslik => 'Test iki sayfa',
                               p_aciklama => null, p_sinif_id => v_sinif,
                               p_son_tarih => current_date + 5, p_sayfa_limiti => 1::smallint);
  begin
    perform public.odev_gonder(t_ayse, v_test, 'cozum/' || v_test || '/' || v_ayse || '.jpg',
                               '{"1":"A","2":"B"}'::jsonb,
                               array['cozum/' || v_test || '/' || v_ayse || '-2.jpg']);
    raise exception 'HATA: küçülen sayıdan fazla sayfa KABUL EDİLDİ!';
  exception when invalid_parameter_value then null; end;
  perform public.odev_gonder(t_ayse, v_test, 'cozum/' || v_test || '/' || v_ayse || '.jpg',
                             '{"1":"A","2":"B"}'::jsonb, null);
  if (select puan from public.gonderimler where odev_id = v_test and ogrenci_id = v_ayse) <> 100 then
    raise exception 'HATA: 1/1 gönderim puanlanmadı!';
  end if;
  -- Ali'nin 2 sayfalık gönderimi sayı 1'e inse de duruyor.
  if (select cardinality(ek_sayfa_yollari) from public.gonderimler
       where odev_id = v_test and ogrenci_id = v_ali) <> 1 then
    raise exception 'HATA: sayı küçülünce önceki gönderimin sayfası kayboldu!';
  end if;
  raise notice '    2/3 kabul; 1''e inince 2 sayfa reddedildi, 1/1 kabul; Ali''nin sayfaları duruyor: OK';

  ------------------------------------------------------------------
  raise notice '--- 3. Düzenleme bayrağı AÇMIYOR (0087) ---';
  -- Sayı gönderilmeden güncelleme: bayrak kapalı.
  perform public.odev_guncelle(p_token => t_ogr, p_id => v_eski2, p_baslik => 'Eski düzen 2 (başlık)',
                               p_aciklama => null, p_sinif_id => v_sinif,
                               p_son_tarih => current_date + 5);
  if (select tum_sayfalar from public.odevler where id = v_eski2) then
    raise exception 'HATA: sayısız güncelleme bayrağı açtı!';
  end if;
  perform public.odev_gonder(t_ali, v_eski, 'cozum/' || v_eski || '/' || v_ali || '.jpg', null, null);
  -- Öğretmen sayıyı (aynı 3) yazıp kaydediyor. 0079'da bu, bayrağı açıp
  -- "her sayfa zorunlu" kuralına geçiriyordu; 0087'den sonra AÇMIYOR.
  perform public.odev_guncelle(p_token => t_ogr, p_id => v_eski, p_baslik => 'Eski düzen',
                               p_aciklama => null, p_sinif_id => v_sinif,
                               p_son_tarih => current_date + 5, p_sayfa_limiti => 3::smallint);
  if (select tum_sayfalar from public.odevler where id = v_eski) then
    raise exception 'HATA: sayfa sayısı yazılınca bayrak diriltildi!';
  end if;
  if (public.odev_sayfa_kurali(t_ayse, v_eski) ->> 'tum_sayfalar')::boolean then
    raise exception 'HATA: öğrenci ucu zorunlu gösteriyor!';
  end if;
  -- Düzenlemeden SONRA da sayının altında gönderim kabul.
  perform public.odev_gonder(t_ayse, v_eski, 'cozum/' || v_eski || '/' || v_ayse || '.jpg', null, null);
  if not exists (select 1 from public.gonderimler
                  where odev_id = v_eski and ogrenci_id = v_ayse) then
    raise exception 'HATA: düzenlemeden sonra 1/3 sayfa kabul edilmedi!';
  end if;
  if not exists (select 1 from public.gonderimler where odev_id = v_eski and ogrenci_id = v_ali) then
    raise exception 'HATA: Ali''nin gönderimi kayboldu!';
  end if;
  raise notice '    düzenleme bayrağı açmıyor; 1/3 sayfa kabul; eski gönderim duruyor: OK';

  ------------------------------------------------------------------
  raise notice '--- 4. Kardeş yayma gönderimi olan kardeşe de taşıyor ---';
  perform public.odevler_coklu_olustur(p_token => t_ogr,
            p_sinif_idler => jsonb_build_array(v_sinif, v_sinif_b), p_baslik => 'Kardeş düzenle',
            p_aciklama => null, p_tur => 'acik', p_son_tarih => current_date + 5,
            p_sayfa_limiti => 2::smallint);
  select id into v_ka from public.odevler where baslik = 'Kardeş düzenle' and sinif_id = v_sinif order by created_at desc limit 1;
  select id into v_kb from public.odevler where baslik = 'Kardeş düzenle' and sinif_id = v_sinif_b order by created_at desc limit 1;
  -- 12-DB'deki kardeş eski düzende ve gönderimi var.
  update public.odevler set tum_sayfalar = false where id = v_kb;
  perform public.odev_yayinla(t_ogr, v_ka);
  perform public.odev_yayinla(t_ogr, v_kb);
  perform public.odev_gonder(t_yabanci, v_kb, 'cozum/' || v_kb || '/' || v_yabanci_ogr || '.jpg', null, null);
  select foto_yolu, ek_sayfa_yollari into once
    from public.gonderimler where odev_id = v_kb and ogrenci_id = v_yabanci_ogr;
  perform public.odev_guncelle(p_token => t_ogr, p_id => v_ka, p_baslik => 'Kardeş düzenle',
                               p_aciklama => null, p_sinif_id => v_sinif,
                               p_son_tarih => current_date + 5, p_sayfa_limiti => 4::smallint);
  perform public.odev_kardeslere_yay(t_ogr, v_ka);
  -- 0087: sayı taşınıyor, bayrak kapalı kalıyor.
  if (select sayfa_limiti from public.odevler where id = v_kb) <> 4 then
    raise exception 'HATA: gönderimi olan kardeşe sayı taşınmadı!';
  end if;
  if (select tum_sayfalar from public.odevler where id = v_kb) then
    raise exception 'HATA: kardeşe bayrak taşındı — 0087 geri alınmış!';
  end if;
  select foto_yolu, ek_sayfa_yollari into sonra
    from public.gonderimler where odev_id = v_kb and ogrenci_id = v_yabanci_ogr;
  if once is distinct from sonra then
    raise exception 'HATA: kardeşteki gönderim değişti!';
  end if;
  raise notice '    kardeşe 4 sayfa taşındı, bayrak kapalı; kardeşteki gönderim aynı: OK';

  ------------------------------------------------------------------
  raise notice '--- 5. Yeniden açılan gönderim yeni sayıyla ---';
  select id into v_gon from public.gonderimler where odev_id = v_eski and ogrenci_id = v_ali;
  perform public.gonderimi_yeniden_ac(t_ogr, v_gon, 'Eksik sayfa: ödev 3 sayfa.', (current_date + 7));
  -- 0087: yeniden açılan gönderim de sayının altında yapılabiliyor;
  -- ölçüm asıl olarak YENİ SAYININ geçerli olduğunu sınıyor.
  perform public.odev_gonder(t_ali, v_eski, 'cozum/' || v_eski || '/' || v_ali || '.jpg', null,
                             array['cozum/' || v_eski || '/' || v_ali || '-2.jpg',
                                   'cozum/' || v_eski || '/' || v_ali || '-3.jpg']);
  if (select cardinality(ek_sayfa_yollari) from public.gonderimler
       where odev_id = v_eski and ogrenci_id = v_ali) <> 2 then
    raise exception 'HATA: yeniden gönderimde sayfalar yanlış!';
  end if;
  raise notice '    yeniden açılınca 3/3 kabul: OK';

  -- Temizlik
  update public.ogrenciler set aktif = false where id in (v_ali, v_ayse, v_yabanci_ogr);
  update public.odevler set yayinda = false where id in (v_test, v_eski, v_eski2, v_ka, v_kb);

  raise notice '';
  raise notice 'SAYFA SAYISI DÜZENLEME TESTLERİ: 5 GRUP GEÇTİ';
end;
$$;
