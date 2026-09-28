-- =============================================================================
-- SEKİZ — 0056 TESTLERİ: GÖNDERİMİ YENİDEN AÇMA
--
-- Olay: öğrenci cevaplarını işaretledi, gönderim BOŞ kaydedildi (0 puan).
-- "Gönderim değiştirilemez" kuralı yüzünden öğrencinin elinde yol yoktu.
--
-- Ölçülen:
--   1. YALNIZ SAHİP açabilir (kendi oturumu ya da vekâlet); sınıf öğretmeni,
--      öğrenci, veli 42501.
--   2. Sebep zorunlu; olmayan gönderim P0002.
--   3. Eski gönderimin TAMAMI denetim izinde; satır siliniyor.
--   4. Öğrenci yeniden gönderebiliyor (aynı fotoğraf yoluyla) ve doğru puan
--      alıyor; ikinci kez gönderemiyor.
--   5. Süre dolmuş + geç teslim kapalı: yeniden açılan öğrenci gönderebiliyor,
--      hiç göndermemiş başka öğrenci GÖNDEREMİYOR (istisna yalnız ona).
--
-- Tekrar çalıştırılabilir: adlar ve PIN'ler her çalıştırmada farklı.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  ek   text := substr(md5(random()::text), 1, 6);
  s_id uuid; x_id uuid;
  js text; jx text; jv text;
  sa uuid;
  o1 uuid; o3 uuid;
  jo text; jveli text; jo3 text;
  d uuid; d_gec uuid;
  g uuid; g2 uuid;
  v jsonb; r record; n integer; kod text; kod_sql text;
begin
  raise notice '--- Kurulum ---';
  update public.ogretmenler set pin_hash =
    extensions.crypt('Acma!2026', extensions.gen_salt('bf', 10)) where yonetici;
  js := (public.giris('Acma!2026'))->>'token';
  select id into s_id from public.ogretmenler where yonetici;
  x_id := (public.ogretmen_ekle(js, 'Xeda Açma ' || ek, 'XAcma!' || ek))->>'id';
  jx := (public.giris('XAcma!' || ek))->>'token';

  insert into public.siniflar (seviye, sube) values (10, 'YA')
    on conflict (seviye, sube) do update set arsiv = false returning id into sa;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    values (s_id, sa) on conflict do nothing;
  perform public.ogretmen_sinif_ata(js, x_id, jsonb_build_array(sa::text));

  o1 := (public.ogrenci_ekle(js, 'Duru Deneme ' || ek, 'okul', sa))->>'id';
  kod := (select k.kod from public.giris_kodlari k where k.ogrenci_id = o1 and k.rol = 'ogrenci');
  jo := (public.giris(kod))->>'token';
  kod := (select k.kod from public.giris_kodlari k where k.ogrenci_id = o1 and k.rol = 'veli');
  jveli := (public.giris(kod))->>'token';
  perform public.onam_ver(jveli, public._gecerli_onam_surumu(), 'Test Velisi');
  o3 := (public.ogrenci_ekle(js, 'Göndermeyen ' || ek, 'okul', sa))->>'id';
  kod := (select k.kod from public.giris_kodlari k where k.ogrenci_id = o3 and k.rol = 'ogrenci');
  jo3 := (public.giris(kod))->>'token';

  d := (public.odev_olustur(js, 'Açma Testi ' || ek, null, sa, 'test', current_date + 7, 2,
        '{"1":"A","2":"B"}'::jsonb))->>'id';
  perform public.odev_yayinla(js, d);

  -- OLAY: cevaplar boş gitti.
  perform public.odev_gonder(jo, d, 'cozum/' || d || '/' || o1 || '.jpg', '{}'::jsonb);
  select id into g from public.gonderimler where odev_id = d and ogrenci_id = o1;
  if (select bos from public.gonderimler where id = g) <> 2 then
    raise exception 'HATA: kurulum — boş gönderim beklenirdi';
  end if;

  ------------------------------------------------------------------
  raise notice '--- 1. YALNIZ SAHİP açabilir ---';
  begin perform public.gonderimi_yeniden_ac(jx, g, 'Deneme sebebi');
        raise exception 'HATA: SINIF ÖĞRETMENİ GÖNDERİMİ AÇTI!';
  exception when insufficient_privilege then null; end;
  begin perform public.gonderimi_yeniden_ac(jo, g, 'Deneme sebebi');
        raise exception 'HATA: ÖĞRENCİ KENDİ GÖNDERİMİNİ AÇTI!';
  exception when insufficient_privilege then null; end;
  begin perform public.gonderimi_yeniden_ac(jveli, g, 'Deneme sebebi');
        raise exception 'HATA: VELİ GÖNDERİMİ AÇTI!';
  exception when insufficient_privilege then null; end;
  if not exists (select 1 from public.gonderimler where id = g) then
    raise exception 'HATA: reddedilen açma yine de gönderimi sildi!';
  end if;
  raise notice '    sınıf öğretmeni, öğrenci, veli 42501; gönderim duruyor: OK';

  ------------------------------------------------------------------
  raise notice '--- 2. Sebep zorunlu; olmayan gönderim ---';
  foreach kod_sql in array array['', '  ', 'ab', repeat('x', 501)] loop
    begin perform public.gonderimi_yeniden_ac(js, g, kod_sql);
          raise exception 'HATA: geçersiz sebep kabul edildi: "%"', left(kod_sql, 10);
    exception when invalid_parameter_value then null; end;
  end loop;
  begin perform public.gonderimi_yeniden_ac(js, gen_random_uuid(), 'Olmayan gönderim');
        raise exception 'HATA: olmayan gönderim açıldı!';
  exception when no_data_found then null; end;
  raise notice '    boş/kısa/uzun sebep 22023, olmayan gönderim P0002: OK';

  ------------------------------------------------------------------
  raise notice '--- 3. SAHİP açıyor: eski gönderim denetim izinde, satır silindi ---';
  v := public.gonderimi_yeniden_ac(js, g, 'Cevaplar sisteme boş kaydedildi');
  if v->>'ogrenci' <> 'Duru Deneme ' || ek then
    raise exception 'HATA: dönüşte öğrenci adı yok: %', v;
  end if;
  if exists (select 1 from public.gonderimler where id = g) then
    raise exception 'HATA: gönderim silinmedi!';
  end if;
  select * into r from public.denetim_izi
   where islem = 'gonderim_yeniden_acildi' and kayit_id = g;
  if not found
     or r.eski->>'foto_yolu' <> 'cozum/' || d || '/' || o1 || '.jpg'
     or (r.eski->>'bos')::int <> 2
     or r.eski->>'odev_id' <> d::text
     or r.yeni->>'neden' <> 'Cevaplar sisteme boş kaydedildi'
     or (r.yeni->>'acan')::uuid <> s_id then
    raise exception 'HATA: denetim izi eksik: %', row_to_json(r);
  end if;
  raise notice '    satır silindi; izde fotoğraf, puan, sebep, açan: OK';

  ------------------------------------------------------------------
  raise notice '--- 4. Öğrenci YENİDEN gönderiyor (aynı fotoğraf yolu), bir daha değil ---';
  perform public.odev_gonder(jo, d, 'cozum/' || d || '/' || o1 || '.jpg', '{"1":"A","2":"B"}'::jsonb);
  select id into g2 from public.gonderimler where odev_id = d and ogrenci_id = o1;
  if (select puan from public.gonderimler where id = g2) <> 100 then
    raise exception 'HATA: yeniden gönderim doğru puanlanmadı';
  end if;
  begin
    perform public.odev_gonder(jo, d, 'cozum/' || d || '/' || o1 || '.jpg', '{"1":"A","2":"A"}'::jsonb);
    raise exception 'HATA: YENİDEN AÇILMADAN İKİNCİ GÖNDERİM KABUL EDİLDİ!';
  exception when unique_violation then null; end;
  raise notice '    yeniden gönderim 100 puan; üçüncü gönderim 23505: OK';

  ------------------------------------------------------------------
  raise notice '--- 5. Süre dolmuş + geç teslim kapalı: istisna YALNIZ açılan öğrenciye ---';
  d_gec := (public.odev_olustur(js, 'Açma Süre ' || ek, null, sa, 'test', current_date + 7, 2,
            '{"1":"A","2":"B"}'::jsonb, null, null, false))->>'id';
  perform public.odev_yayinla(js, d_gec);
  perform public.odev_gonder(jo, d_gec, 'cozum/' || d_gec || '/' || o1 || '.jpg', '{}'::jsonb);
  update public.odevler set son_tarih = current_date - 2 where id = d_gec;
  select id into g from public.gonderimler where odev_id = d_gec and ogrenci_id = o1;

  -- Açılmadan önce: hiç göndermemiş öğrenci süresi dolduğu için gönderemez.
  begin
    perform public.odev_gonder(jo3, d_gec, 'cozum/' || d_gec || '/' || o3 || '.jpg', '{}'::jsonb);
    raise exception 'HATA: süresi dolmuş ödeve gönderim kabul edildi (kurulum)';
  exception when invalid_parameter_value then null; end;

  -- VEKÂLETTE de sahip açabiliyor; iz "sahip → X".
  jv := (public.ogretmen_olarak_gir(js, x_id))->>'token';
  perform public.gonderimi_yeniden_ac(jv, g, 'Vekâletle yeniden açma');
  if not exists (select 1 from public.denetim_izi
                  where islem = 'gonderim_yeniden_acildi' and kayit_id = g and aktor like '%→%') then
    raise exception 'HATA: vekâlet denetim izinde görünmüyor!';
  end if;

  perform public.odev_gonder(jo, d_gec, 'cozum/' || d_gec || '/' || o1 || '.jpg', '{"1":"A","2":"B"}'::jsonb);
  if (select puan from public.gonderimler where odev_id = d_gec and ogrenci_id = o1) <> 100 then
    raise exception 'HATA: süre istisnasıyla gönderim puanlanmadı';
  end if;
  begin
    perform public.odev_gonder(jo3, d_gec, 'cozum/' || d_gec || '/' || o3 || '.jpg', '{}'::jsonb);
    raise exception 'HATA: İSTİSNA BAŞKA ÖĞRENCİYE DE AÇILDI!';
  exception when invalid_parameter_value then null; end;
  raise notice '    vekâlette açma; açılan öğrenci süre dolmuşken gönderdi, diğeri gönderemedi: OK';

  ------------------------------------------------------------------
  raise notice '--- 6. Yetkiler ---';
  if has_function_privilege('anon', 'public._gonderim_yeniden_acildi(uuid,uuid)', 'execute') then
    raise exception 'HATA: _gonderim_yeniden_acildi anon''a açık!';
  end if;
  if not has_function_privilege('anon', 'public.gonderimi_yeniden_ac(text,uuid,text)', 'execute') then
    raise exception 'HATA: gonderimi_yeniden_ac istemciye kapalı!';
  end if;
  raise notice '    dahili yardımcı kapalı, uç açık (yetki içeride): OK';

  raise notice '';
  raise notice '=========================================';
  raise notice 'GÖNDERİMİ YENİDEN AÇMA TESTLERİ GEÇTİ';
  raise notice '=========================================';
end;
$$;
