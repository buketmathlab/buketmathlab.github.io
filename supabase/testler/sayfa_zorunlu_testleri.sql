-- =============================================================================
-- SEKİZ — 0078 HER SAYFA ZORUNLU TESTLERİ
--
--  1. Yeni ödev `tum_sayfalar = true` ile kaydediliyor; detay ve öğrenci ucu
--     bunu söylüyor.
--  2. Eksik sayfa REDDEDİLİYOR (mesaj eksik sayıyı söylüyor); fazla sayfa
--     reddediliyor; tam sayfa kabul ediliyor ve sırası korunuyor.
--  3. ESKİ ödev (tum_sayfalar false) eski kuralla sürüyor: sınırın altında
--     gönderim kabul.
--  4. 40 sayfa: kısıt, yol kalıbı (-40 açık, -41 kapalı), 41 reddediliyor.
--  5. Sayfa sayısı güncelleniyor; kardeş yaymada bayrak taşınıyor. (0078'de
--     gönderim varken kilitliydi; 0079'dan beri kilit yok — ayrıntısı
--     `sayfa_duzenleme_testleri.sql`.)
--  6. `odev_sayfa_kurali` yetkisi: başka sınıf, veli ve öğretmen 42501.
--  7. Deneme hesabında da aynı kural.
--
-- Sınıf adları iki harfli (12-ZA/ZB): test dosyaları aynı veritabanını
-- paylaşıyor.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  t_ogr    text;
  t_ali    text;
  t_veli   text;
  t_yabanci text;
  v_sinif  uuid;
  v_sinif_b uuid;
  v_ali    uuid;
  v_yabanci_ogr uuid;
  v_dort   uuid;   -- yeni, 4 sayfa
  v_eski   uuid;   -- eski kural (tum_sayfalar false), sınır 3
  v_kirk   uuid;   -- 40 sayfa
  v_bos    uuid;   -- gönderimsiz yeni ödev (sayı değişebilir)
  v_grup   jsonb;
  v_ka     uuid;
  v_kb     uuid;
  r        jsonb;
  ek       text[];
  dn       jsonb;
  t_dn     text;
  v_dn     uuid;
  i        integer;
  yakalandi boolean;
  mesaj    text;
begin
  raise notice '--- Kurulum ---';
  update public.ogretmenler
     set pin_hash = extensions.crypt('Zorunlu!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  t_ogr := (public.giris('Zorunlu!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (12, 'ZA')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_sinif;
  insert into public.siniflar (seviye, sube) values (12, 'ZB')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_sinif_b;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    select g.id, s.id from public.ogretmenler g, public.siniflar s
     where g.yonetici and s.id in (v_sinif, v_sinif_b)
    on conflict do nothing;

  r := public.ogrenci_ekle(t_ogr, 'Ali Zorunlu', 'okul', v_sinif);
  v_ali := (r ->> 'id')::uuid;
  t_ali := (public.giris(r ->> 'ogrenci_kodu')) ->> 'token';
  t_veli := (public.giris(r ->> 'veli_kodu')) ->> 'token';
  perform public.onam_ver(t_veli, public._gecerli_onam_surumu(), 'Ali Velisi');

  r := public.ogrenci_ekle(t_ogr, 'Yabancı Zorunlu', 'okul', v_sinif_b);
  v_yabanci_ogr := (r ->> 'id')::uuid;
  t_yabanci := (public.giris(r ->> 'ogrenci_kodu')) ->> 'token';

  r := public.odev_olustur(p_token => t_ogr, p_baslik => 'Dört sayfa', p_aciklama => null,
                           p_sinif_id => v_sinif, p_tur => 'acik',
                           p_son_tarih => current_date + 5, p_sayfa_limiti => 4::smallint);
  v_dort := (r ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogr, v_dort);

  r := public.odev_olustur(p_token => t_ogr, p_baslik => 'Eski kural', p_aciklama => null,
                           p_sinif_id => v_sinif, p_tur => 'acik',
                           p_son_tarih => current_date + 5, p_sayfa_limiti => 3::smallint);
  v_eski := (r ->> 'id')::uuid;
  -- 0078 öncesinde oluşturulmuş bir ödevi taklit ediyor.
  update public.odevler set tum_sayfalar = false where id = v_eski;
  perform public.odev_yayinla(t_ogr, v_eski);

  r := public.odev_olustur(p_token => t_ogr, p_baslik => 'Kırk sayfa', p_aciklama => null,
                           p_sinif_id => v_sinif, p_tur => 'acik',
                           p_son_tarih => current_date + 5, p_sayfa_limiti => 40::smallint);
  v_kirk := (r ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogr, v_kirk);

  r := public.odev_olustur(p_token => t_ogr, p_baslik => 'Gönderimsiz', p_aciklama => null,
                           p_sinif_id => v_sinif, p_tur => 'acik',
                           p_son_tarih => current_date + 5, p_sayfa_limiti => 2::smallint);
  v_bos := (r ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogr, v_bos);

  ------------------------------------------------------------------
  raise notice '--- 1. Yeni ödev her sayfası zorunlu ---';
  if not (select tum_sayfalar from public.odevler where id = v_dort) then
    raise exception 'HATA: yeni ödev tum_sayfalar=true ile kaydedilmedi!';
  end if;
  if not (public.odev_detay(t_ogr, v_dort) ->> 'tum_sayfalar')::boolean
     or (public.odev_detay(t_ogr, v_eski) ->> 'tum_sayfalar')::boolean then
    raise exception 'HATA: odev_detay bayrağı yanlış!';
  end if;
  r := public.odev_sayfa_kurali(t_ali, v_dort);
  if (r ->> 'sayfa')::int <> 4 or not (r ->> 'tum_sayfalar')::boolean then
    raise exception 'HATA: odev_sayfa_kurali yanlış: %', r;
  end if;
  if (public.odev_sayfa_kurali(t_ali, v_eski) ->> 'tum_sayfalar')::boolean then
    raise exception 'HATA: eski ödev zorunlu görünüyor!';
  end if;
  if public.odev_sayfa_siniri(t_ali, v_dort) <> 4 then
    raise exception 'HATA: eski uç (odev_sayfa_siniri) bozuldu!';
  end if;
  raise notice '    bayrak, detay, yeni ve eski öğrenci ucu: OK';

  ------------------------------------------------------------------
  raise notice '--- 2. Eksik reddedilir, fazla reddedilir, tam kabul ---';
  ek := array['cozum/' || v_dort || '/' || v_ali || '-2.jpg',
              'cozum/' || v_dort || '/' || v_ali || '-3.jpg'];
  begin
    perform public.odev_gonder(t_ali, v_dort, 'cozum/' || v_dort || '/' || v_ali || '.jpg', null, ek);
    raise exception 'HATA: 3/4 sayfalık gönderim KABUL EDİLDİ!';
  exception when invalid_parameter_value then
    get stacked diagnostics mesaj = message_text;
    if mesaj not like 'Bu ödev 4 sayfa;%(1 sayfa eksik).' then
      raise exception 'HATA: eksik sayfa mesajı beklenmedik: %', mesaj;
    end if;
  end;
  begin
    perform public.odev_gonder(t_ali, v_dort, 'cozum/' || v_dort || '/' || v_ali || '.jpg', null, null);
    raise exception 'HATA: tek sayfalık gönderim KABUL EDİLDİ!';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.odev_gonder(t_ali, v_dort, 'cozum/' || v_dort || '/' || v_ali || '.jpg', null,
                               ek || array['cozum/' || v_dort || '/' || v_ali || '-4.jpg',
                                           'cozum/' || v_dort || '/' || v_ali || '-5.jpg']);
    raise exception 'HATA: 5/4 sayfalık gönderim KABUL EDİLDİ!';
  exception when invalid_parameter_value then null; end;
  ek := ek || array['cozum/' || v_dort || '/' || v_ali || '-4.jpg'];
  r := public.odev_gonder(t_ali, v_dort, 'cozum/' || v_dort || '/' || v_ali || '.jpg', null, ek);
  if (select cardinality(ek_sayfa_yollari) from public.gonderimler
       where odev_id = v_dort and ogrenci_id = v_ali) <> 3 then
    raise exception 'HATA: tam gönderimde ek sayfa sayısı yanlış!';
  end if;
  raise notice '    eksik ve fazla reddedildi, 4/4 kabul edildi: OK';

  ------------------------------------------------------------------
  raise notice '--- 3. Eski ödev eski kuralla sürüyor ---';
  r := public.odev_gonder(t_ali, v_eski, 'cozum/' || v_eski || '/' || v_ali || '.jpg', null,
                          array['cozum/' || v_eski || '/' || v_ali || '-2.jpg']);
  if not exists (select 1 from public.gonderimler where odev_id = v_eski and ogrenci_id = v_ali) then
    raise exception 'HATA: eski ödevde 2/3 sayfa kabul edilmedi — REGRESYON!';
  end if;
  raise notice '    eski ödevde sınırın altında gönderim kabul: OK';

  ------------------------------------------------------------------
  raise notice '--- 4. 40 sayfa ---';
  if not public.dosya_erisim_izni(t_ali, 'cozum/' || v_kirk || '/' || v_ali || '-40.jpg') then
    raise exception 'HATA: 40. sayfa yolu açılmadı!';
  end if;
  if public.dosya_erisim_izni(t_ali, 'cozum/' || v_kirk || '/' || v_ali || '-41.jpg')
     or public.dosya_erisim_izni(t_ali, 'cozum/' || v_kirk || '/' || v_ali || '-1.jpg')
     or public.dosya_erisim_izni(t_ali, 'cozum/' || v_dort || '/' || v_ali || '-5.jpg') then
    raise exception 'HATA: sınır dışı yol açıldı!';
  end if;
  ek := '{}';
  for i in 2 .. 40 loop
    ek := ek || ('cozum/' || v_kirk || '/' || v_ali || '-' || i || '.jpg');
  end loop;
  r := public.odev_gonder(t_ali, v_kirk, 'cozum/' || v_kirk || '/' || v_ali || '.jpg', null, ek);
  begin
    perform public.odev_olustur(p_token => t_ogr, p_baslik => 'Kırk bir', p_aciklama => null,
                                p_sinif_id => v_sinif, p_tur => 'acik',
                                p_son_tarih => current_date + 5, p_sayfa_limiti => 41::smallint);
    raise exception 'HATA: 41 sayfalık ödev oluşturuldu!';
  exception when invalid_parameter_value then null; end;
  raise notice '    -40 açık, -41 ve -1 kapalı, 40/40 kabul, 41 reddedildi: OK';

  ------------------------------------------------------------------
  raise notice '--- 5. Sayfa sayısı güncelleme; kardeş yayma ---';
  -- Aynı sayıyı yeniden yazmak serbest (form her kayıtta sayıyı gönderiyor).
  perform public.odev_guncelle(p_token => t_ogr, p_id => v_dort, p_baslik => 'Dört sayfa (yeni başlık)',
                               p_aciklama => null, p_sinif_id => v_sinif,
                               p_son_tarih => current_date + 5, p_sayfa_limiti => 4::smallint);
  perform public.odev_guncelle(p_token => t_ogr, p_id => v_bos, p_baslik => 'Gönderimsiz',
                               p_aciklama => null, p_sinif_id => v_sinif,
                               p_son_tarih => current_date + 5, p_sayfa_limiti => 6::smallint);
  if (select sayfa_limiti from public.odevler where id = v_bos) <> 6 then
    raise exception 'HATA: gönderimsiz ödevin sayfa sayısı değişmedi!';
  end if;

  -- Kardeşler: ZA ve ZB'ye aynı ödev, 3 sayfa.
  v_grup := public.odevler_coklu_olustur(p_token => t_ogr,
              p_sinif_idler => jsonb_build_array(v_sinif, v_sinif_b), p_baslik => 'Kardeş',
              p_aciklama => null, p_tur => 'acik', p_son_tarih => current_date + 5,
              p_sayfa_limiti => 3::smallint);
  select id into v_ka from public.odevler where baslik = 'Kardeş' and sinif_id = v_sinif order by created_at desc limit 1;
  select id into v_kb from public.odevler where baslik = 'Kardeş' and sinif_id = v_sinif_b order by created_at desc limit 1;
  if not (select tum_sayfalar from public.odevler where id = v_kb) then
    raise exception 'HATA: çoklu oluşturmada bayrak açılmadı!';
  end if;
  perform public.odev_yayinla(t_ogr, v_ka);
  perform public.odev_yayinla(t_ogr, v_kb);
  -- ZB'deki öğrenci 3/3 gönderiyor; ZA'da sayı 5'e çıkarılıp yayılıyor.
  perform public.odev_gonder(t_yabanci, v_kb, 'cozum/' || v_kb || '/' || v_yabanci_ogr || '.jpg', null,
                             array['cozum/' || v_kb || '/' || v_yabanci_ogr || '-2.jpg',
                                   'cozum/' || v_kb || '/' || v_yabanci_ogr || '-3.jpg']);
  perform public.odev_guncelle(p_token => t_ogr, p_id => v_ka, p_baslik => 'Kardeş',
                               p_aciklama => null, p_sinif_id => v_sinif,
                               p_son_tarih => current_date + 5, p_sayfa_limiti => 5::smallint);
  perform public.odev_kardeslere_yay(t_ogr, v_ka);
  -- 0079: gönderimi olan kardeşe de taşınıyor.
  if (select sayfa_limiti from public.odevler where id = v_kb) <> 5 then
    raise exception 'HATA: kardeşin sayfa sayısı taşınmadı!';
  end if;
  if (select baslik from public.odevler where id = v_kb) <> 'Kardeş' then
    raise exception 'HATA: kardeş yayma içerik taşımadı!';
  end if;
  raise notice '    güncelleme, çoklu oluşturma, kardeşe taşıma: OK';

  ------------------------------------------------------------------
  raise notice '--- 6. odev_sayfa_kurali yetkisi ---';
  begin perform public.odev_sayfa_kurali(t_yabanci, v_dort);
    raise exception 'HATA: başka sınıfın öğrencisi kuralı okudu!';
  exception when insufficient_privilege then null; end;
  begin perform public.odev_sayfa_kurali(t_veli, v_dort);
    raise exception 'HATA: veli kuralı okudu!';
  exception when insufficient_privilege then null; end;
  begin perform public.odev_sayfa_kurali(t_ogr, v_dort);
    raise exception 'HATA: öğretmen jetonu kabul edildi!';
  exception when insufficient_privilege then null; end;
  raise notice '    başka sınıf, veli ve öğretmen 42501: OK';

  ------------------------------------------------------------------
  raise notice '--- 7. Deneme hesabında aynı kural ---';
  dn := (public.deneme_hesabi_olustur(t_ogr, v_sinif))->0;
  v_dn := (dn ->> 'id')::uuid;
  t_dn := (public.giris(dn ->> 'ogrenci_kodu')) ->> 'token';
  begin
    perform public.odev_gonder(t_dn, v_bos, 'cozum/' || v_bos || '/' || v_dn || '.jpg', null, null);
    raise exception 'HATA: deneme hesabında eksik sayfa kabul edildi!';
  exception when invalid_parameter_value then null; end;
  perform public.deneme_hesabi_sil(t_ogr, v_dn);
  raise notice '    deneme hesabı eksik sayfayla gönderemiyor: OK';

  -- Temizlik
  update public.ogrenciler set aktif = false where id in (v_ali, v_yabanci_ogr);
  update public.odevler set yayinda = false where id in (v_dort, v_eski, v_kirk, v_bos, v_ka, v_kb);

  raise notice '';
  raise notice 'HER SAYFA ZORUNLU TESTLERİ: 7 GRUP GEÇTİ';
end;
$$;
