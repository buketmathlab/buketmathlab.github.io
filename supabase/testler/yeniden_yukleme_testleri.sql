-- =============================================================================
-- SEKİZ — YENİDEN AÇILAN ÖDEVDE FOTOĞRAFI YENİDEN YÜKLEME (0082)
--
-- 0081 gönderimi iptal edip yeni tarih veriyordu, ama öğrenci ÇÖZÜM
-- FOTOĞRAFINI DEĞİŞTİREMİYORDU: yol sabit, üzerine yazmak kapalı. 0082
-- her yeniden açmaya ayrı bir yol veriyor (`-d<k>`), eski dosya duruyor.
--
-- Ölçülen:
--   1. Hiç açılmamış ödevde deneme 1; yollar bugünküyle BİREBİR aynı
--   2. Açınca deneme 2; `-d2` geçerli, `-d3` (gelecek deneme) geçersiz
--   3. Yeni fotoğrafla gönderim: kayıtta YENİ yol
--   4. "Önceki sayfalarımı kullan": eski yollar hâlâ kabul (öğretmenin kararı)
--   5. KARMA deneme reddediliyor
--   6. Başka öğrencinin `-d2` yolu reddediliyor
--   7. Sayfa sınırını aşan `-d2-<n>` reddediliyor
--   8. `onceki_sayfalar` son iptalin sayfalarını taşıyor; iptal yoksa null
--   9. 0081 öncesi (tarihsiz) açılmış gönderim de deneme 2 alıyor
--
-- Tekrar çalıştırılabilir: adlar ve PIN'ler her çalıştırmada farklı.
-- Hiçbir blokta `exception when others` YOK.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  ek   text := substr(md5(random()::text), 1, 6);
  js text; jo text; jo2 text;
  s_id uuid; sa uuid; o1 uuid; o2 uuid;
  d uuid; d2 uuid; g uuid; kod text;
  v jsonb; od jsonb; n integer;
  y1 text; y1b text; y2 text; y2b text; y3 text;
begin
  raise notice '--- Kurulum ---';
  update public.ogretmenler set pin_hash =
    extensions.crypt('Yukle!2026', extensions.gen_salt('bf', 10)) where yonetici;
  js := (public.giris('Yukle!2026'))->>'token';
  select id into s_id from public.ogretmenler where yonetici;

  insert into public.siniflar (seviye, sube) values (11, 'YY')
    on conflict (seviye, sube) do update set arsiv = false returning id into sa;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    values (s_id, sa) on conflict do nothing;

  o1 := (public.ogrenci_ekle(js, 'Yükleme Deneği ' || ek, 'okul', sa))->>'id';
  kod := (select k.kod from public.giris_kodlari k where k.ogrenci_id = o1 and k.rol = 'ogrenci');
  jo := (public.giris(kod))->>'token';
  o2 := (public.ogrenci_ekle(js, 'Yükleme Komşusu ' || ek, 'okul', sa))->>'id';
  kod := (select k.kod from public.giris_kodlari k where k.ogrenci_id = o2 and k.rol = 'ogrenci');
  jo2 := (public.giris(kod))->>'token';

  -- İKİ SAYFALIK ödev: tek denemelik yolların yanında `-2` eki de ölçülsün.
  d := (public.odev_olustur(js, 'Yükleme Testi ' || ek, null, sa, 'test', current_date + 7, 2,
        '{"1":"A","2":"B"}'::jsonb))->>'id';
  update public.odevler set sayfa_limiti = 2, tum_sayfalar = false where id = d;
  perform public.odev_yayinla(js, d);

  y1  := 'cozum/' || d || '/' || o1 || '.jpg';          -- 1. deneme, 1. sayfa
  y1b := 'cozum/' || d || '/' || o1 || '-2.jpg';        -- 1. deneme, 2. sayfa
  y2  := 'cozum/' || d || '/' || o1 || '-d2.jpg';       -- 2. deneme, 1. sayfa
  y2b := 'cozum/' || d || '/' || o1 || '-d2-2.jpg';     -- 2. deneme, 2. sayfa
  y3  := 'cozum/' || d || '/' || o1 || '-d3.jpg';       -- 3. deneme (henüz yok)

  ------------------------------------------------------------------
  raise notice '--- 1. Hiç açılmamış ödev: deneme 1, yollar bugünküyle aynı ---';
  if public._cozum_deneme(d, o1) <> 1 then
    raise exception 'HATA 1a: hiç açılmamışken deneme % (1 olmalı)', public._cozum_deneme(d, o1);
  end if;
  if not public._cozum_yolu_gecerli(o1, y1) or not public._cozum_yolu_gecerli(o1, y1b) then
    raise exception 'HATA 1b: BUGÜNKÜ YOLLAR GEÇERSİZ OLDU — eski gönderimler kırılır';
  end if;
  if public._cozum_yolu_gecerli(o1, y2) then
    raise exception 'HATA 1c: açılmamışken 2. deneme yolu kabul edildi';
  end if;
  raise notice '    deneme 1; eksiz ve -2 yolları geçerli, -d2 değil: OK';

  ------------------------------------------------------------------
  raise notice '--- 2. Yeniden açınca deneme 2; -d2 geçerli, -d3 geçersiz ---';
  perform public.odev_gonder(jo, d, y1, '{"1":"A"}'::jsonb, array[y1b]);
  select id into g from public.gonderimler where odev_id = d and ogrenci_id = o1;
  perform public.gonderimi_yeniden_ac(js, g, 'Boş sayfa gönderilmiş', (current_date + 7));

  if public._cozum_deneme(d, o1) <> 2 then
    raise exception 'HATA 2a: açtıktan sonra deneme % (2 olmalı)', public._cozum_deneme(d, o1);
  end if;
  if not public._cozum_yolu_gecerli(o1, y2) or not public._cozum_yolu_gecerli(o1, y2b) then
    raise exception 'HATA 2b: 2. DENEME YOLU KABUL EDİLMİYOR — öğrenci yeni fotoğraf yükleyemez';
  end if;
  if public._cozum_yolu_gecerli(o1, y3) then
    raise exception 'HATA 2c: GELECEKTEKİ DENEME (-d3) KABUL EDİLDİ';
  end if;
  -- Eski deneme hâlâ geçerli: "önceki sayfalarımı kullan" buna dayanıyor.
  if not public._cozum_yolu_gecerli(o1, y1) then
    raise exception 'HATA 2d: eski denemenin yolu geçersiz oldu — önceki sayfalar kullanılamaz';
  end if;
  raise notice '    deneme 2; -d2/-d2-2 geçerli, -d3 değil, eski yol duruyor: OK';

  ------------------------------------------------------------------
  raise notice '--- 3. Yeni fotoğrafla gönderim: kayıtta YENİ yol ---';
  -- `odev_gonder`in KENDİ kalıbı da genişlemiş olmalı: `_cozum_yolu_gecerli`
  -- geçse bile o satır eski kalsaydı yeni yol burada reddedilirdi. Ham
  -- 42501 "Geçersiz dosya yolu" neyin kırıldığını söylemiyor; etiketliyoruz.
  begin
    perform public.odev_gonder(jo, d, y2, '{"1":"A","2":"B"}'::jsonb, array[y2b]);
  exception when insufficient_privilege then
    raise exception 'HATA 3a: YENİ DENEME YOLU GÖNDERİMDE REDDEDİLDİ — odev_gonder kendi kalıbını genişletmemiş';
  end;
  select * into v from (
    select to_jsonb(x) from public.gonderimler x
     where x.odev_id = d and x.ogrenci_id = o1) t;
  if v->>'foto_yolu' <> y2 then
    raise exception 'HATA 3b: foto_yolu eski kaldı: %', v->>'foto_yolu';
  end if;
  if (v->'ek_sayfa_yollari')->>0 <> y2b then
    raise exception 'HATA 3c: ek sayfa yeni denemeye geçmedi: %', v->'ek_sayfa_yollari';
  end if;
  if (v->>'puan')::numeric <> 100 then
    raise exception 'HATA 3d: yeniden gönderim puanlanmadı: %', v->>'puan';
  end if;
  raise notice '    foto_yolu ve ek sayfa -d2 yollarını taşıyor, puan 100: OK';

  ------------------------------------------------------------------
  raise notice '--- 4. "Önceki sayfalarımı kullan": eski yollar kabul ---';
  select id into g from public.gonderimler where odev_id = d and ogrenci_id = o1;
  perform public.gonderimi_yeniden_ac(js, g, 'İkinci kez açılıyor', (current_date + 7));
  if public._cozum_deneme(d, o1) <> 3 then
    raise exception 'HATA 4a: ikinci açmada deneme % (3 olmalı)', public._cozum_deneme(d, o1);
  end if;
  -- Öğretmenin kararı: öğrenci isterse ÖNCEKİ sayfalarını gönderebiliyor.
  perform public.odev_gonder(jo, d, y1, '{"1":"A","2":"B"}'::jsonb, array[y1b]);
  if (select foto_yolu from public.gonderimler
       where odev_id = d and ogrenci_id = o1) <> y1 then
    raise exception 'HATA 4b: eski yollarla gönderim kaydedilmedi';
  end if;
  raise notice '    3. denemede 1. denemenin yolları kabul edildi: OK';

  ------------------------------------------------------------------
  raise notice '--- 5. KARMA deneme reddediliyor ---';
  select id into g from public.gonderimler where odev_id = d and ogrenci_id = o1;
  perform public.gonderimi_yeniden_ac(js, g, 'Karma deneme ölçümü', (current_date + 7));
  begin
    -- 1. denemenin 1. sayfası + 2. denemenin 2. sayfası.
    perform public.odev_gonder(jo, d, y1, '{"1":"A"}'::jsonb, array[y2b]);
    raise exception 'HATA 5a: KARMA DENEME KABUL EDİLDİ — öğretmen karma çözüm görürdü';
  exception when insufficient_privilege then null; end;
  begin
    -- Tersi de olmaz.
    perform public.odev_gonder(jo, d, y2, '{"1":"A"}'::jsonb, array[y1b]);
    raise exception 'HATA 5b: KARMA DENEME (ters yön) KABUL EDİLDİ';
  exception when insufficient_privilege then null; end;
  raise notice '    iki yönde de 42501; sayfalar tek denemeden: OK';

  ------------------------------------------------------------------
  raise notice '--- 6. Başka öğrencinin yolu reddediliyor ---';
  -- ÖNCE 1. DENEME YOLU. `-d2` ile ölçmek yanıltıcıydı: o2 hiç yeniden
  -- açılmadığı için deneme denetimi zaten reddediyor ve SAHİPLİK denetimi
  -- hiç sınanmıyordu. (Kusur provası gösterdi: sahiplik satırı silindiğinde
  -- test yeşil kalıyordu.) Eksiz yolda iki denetim ayrışıyor.
  if public._cozum_yolu_gecerli(o2, y1) then
    raise exception 'HATA 6a: BAŞKA ÖĞRENCİNİN YOLU KABUL EDİLDİ (1. deneme)';
  end if;
  if public._cozum_yolu_gecerli(o2, 'cozum/' || d || '/' || o1 || '-d2.jpg') then
    raise exception 'HATA 6b: BAŞKA ÖĞRENCİNİN -d2 YOLU KABUL EDİLDİ';
  end if;
  begin
    perform public.odev_gonder(jo2, d, 'cozum/' || d || '/' || o1 || '-d2.jpg', '{"1":"A"}'::jsonb);
    raise exception 'HATA 6c: başka öğrencinin yoluna gönderim yapıldı!';
  exception when insufficient_privilege then null; end;
  raise notice '    sahiplik denetimi deneme yolunda da duruyor: OK';

  ------------------------------------------------------------------
  raise notice '--- 7. Sayfa sınırını aşan deneme yolu reddediliyor ---';
  -- Ödevin sınırı 2; 3. sayfa deneme yolunda da geçersiz.
  if public._cozum_yolu_gecerli(o1, 'cozum/' || d || '/' || o1 || '-d2-3.jpg') then
    raise exception 'HATA 7a: SINIRI AŞAN -d2-3 KABUL EDİLDİ';
  end if;
  raise notice '    sayfa sınırı deneme yolunda da aranıyor: OK';

  ------------------------------------------------------------------
  raise notice '--- 8. onceki_sayfalar son iptalin sayfalarını taşıyor ---';
  od := (select x from jsonb_array_elements((public.ogrenci_odevleri(jo))->'odevler') x
          where x->>'id' = d::text);
  if od is null then
    raise exception 'HATA 8a: ödev öğrencinin listesinde yok';
  end if;
  if (od->>'deneme_no')::integer <> 4 then
    raise exception 'HATA 8b: deneme_no yanlış: % (4 olmalı)', od->>'deneme_no';
  end if;
  -- Son iptal 4. grubun gönderimiydi: 1. denemenin yolları.
  -- ÖNCE "dizi mi" diye bakılıyor: boş kalırsa `jsonb_array_length` ham bir
  -- "scalar" hatası verir ve neyin kırıldığını söylemez.
  if jsonb_typeof(od->'onceki_sayfalar') <> 'array' then
    raise exception 'HATA 8c: ÖNCEKİ SAYFALAR HİÇ DÖNMEDİ (%) — öğrenci "öncekini kullan" diyemez',
      od->'onceki_sayfalar';
  end if;
  if (od->'onceki_sayfalar')->>0 <> y1
     or (od->'onceki_sayfalar')->>1 <> y1b
     or jsonb_array_length(od->'onceki_sayfalar') <> 2 then
    raise exception 'HATA 8f: onceki_sayfalar yanlış: %', od->'onceki_sayfalar';
  end if;

  -- HİÇ İPTAL EDİLMEMİŞ ödevde null — ekran seçim çizmesin.
  d2 := (public.odev_olustur(js, 'Yükleme Temiz ' || ek, null, sa, 'test', current_date + 7, 1,
         '{"1":"A"}'::jsonb))->>'id';
  perform public.odev_yayinla(js, d2);
  od := (select x from jsonb_array_elements((public.ogrenci_odevleri(jo))->'odevler') x
          where x->>'id' = d2::text);
  if od->'onceki_sayfalar' <> 'null'::jsonb then
    raise exception 'HATA 8d: iptal yokken onceki_sayfalar dolu: %', od->'onceki_sayfalar';
  end if;
  if (od->>'deneme_no')::integer <> 1 then
    raise exception 'HATA 8e: temiz ödevde deneme_no % (1 olmalı)', od->>'deneme_no';
  end if;
  raise notice '    4 deneme, iki sayfalı önceki liste; temiz ödevde null: OK';

  ------------------------------------------------------------------
  raise notice '--- 9. 0081 ÖNCESİ (tarihsiz) açılmış gönderim de sayılıyor ---';
  -- 0056 yolundan açılmış bir kaydın şekli: `yeni` alanında `son_tarih` YOK.
  perform public.odev_gonder(jo, d2, 'cozum/' || d2 || '/' || o1 || '.jpg', '{"1":"A"}'::jsonb);
  select id into g from public.gonderimler where odev_id = d2 and ogrenci_id = o1;
  insert into public.denetim_izi (islem, tablo, kayit_id, aktor, eski, yeni)
  values ('gonderim_yeniden_acildi', 'gonderimler', g, 'ogretmen:' || s_id,
          jsonb_build_object('odev_id', d2::text, 'ogrenci_id', o1::text,
                             'foto_yolu', 'cozum/' || d2 || '/' || o1 || '.jpg'),
          jsonb_build_object('neden', 'eski yol', 'acan', s_id::text));
  delete from public.gonderimler where id = g;

  if public._cozum_deneme(d2, o1) <> 2 then
    raise exception 'HATA 9a: 0081 öncesi açılan gönderim sayılmadı: %',
      public._cozum_deneme(d2, o1);
  end if;
  if not public._cozum_yolu_gecerli(o1, 'cozum/' || d2 || '/' || o1 || '-d2.jpg') then
    raise exception 'HATA 9b: ESKİ YOLDAN AÇILAN ÖĞRENCİ YENİ FOTOĞRAF YÜKLEYEMİYOR';
  end if;
  raise notice '    tarihsiz iz de deneme sayıyor; -d2 yolu açık: OK';

  raise notice '';
  raise notice '=========================================';
  raise notice 'YENİDEN YÜKLEME TESTLERİ: 9 GRUP GEÇTİ';
  raise notice '=========================================';
end;
$$;
