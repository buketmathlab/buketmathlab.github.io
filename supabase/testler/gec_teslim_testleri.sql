-- =============================================================================
-- SEKİZ — 0010 GEÇ TESLİM TESTLERİ
--
-- Öğretmenin kararı: geç teslimin kabul edilip edilmeyeceği ödev başına
-- seçilir. Bu dosya kuralın GERÇEKTEN SUNUCUDA uygulandığını ölçüyor —
-- ekranda düğmeyi gizlemek bir kural değildir.
--
-- Ayrıca 0007'de yaşanan tuzağı ölçüyor: parametre eklemek yeni bir
-- fonksiyon yaratır, eski imza yetkisiyle birlikte ayakta kalır. Eski
-- imzaların gerçekten düştüğü doğrulanıyor.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  t_ogretmen text;
  t_ogr      text;
  v_sinif    uuid;
  v_ogr      uuid;
  v_gecmis_kapali uuid;
  v_gecmis_acik   uuid;
  v_ileri_kapali  uuid;
  v_bugun_kapali  uuid;
  v_varsayilan    uuid;
  v_dort_sik      uuid;
  r          jsonb;
  bugun_tr   date := (now() at time zone 'Europe/Istanbul')::date;
  o          jsonb;

  function_yol text;
begin
  raise notice '--- Kurulum ---';
  update public.ayarlar set ogretmen_pin_hash = null where id = 1;
  t_ogretmen := (public.pin_ayarla('gecteslim-PIN.4')) ->> 'token';
  r := public.sinif_ekle(t_ogretmen, 12::smallint, 'G'); v_sinif := (r ->> 'id')::uuid;

  r := public.ogrenci_ekle(t_ogretmen, 'Gec Teslim Ogrencisi', 'okul', v_sinif);
  v_ogr := (r ->> 'id')::uuid;
  t_ogr := (public.giris(r ->> 'ogrenci_kodu')) ->> 'token';

  -- Süresi geçmiş, geç teslim KAPALI
  r := public.odev_olustur(t_ogretmen, 'GEC Kapali', null, v_sinif, 'test',
                           bugun_tr - 3, 2, '{"1":"A","2":"B"}'::jsonb, null, null, false);
  v_gecmis_kapali := (r ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogretmen, v_gecmis_kapali);

  -- Süresi geçmiş, geç teslim AÇIK
  r := public.odev_olustur(t_ogretmen, 'GEC Acik', null, v_sinif, 'test',
                           bugun_tr - 3, 2, '{"1":"A","2":"B"}'::jsonb, null, null, true);
  v_gecmis_acik := (r ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogretmen, v_gecmis_acik);

  -- Süresi GEÇMEMİŞ, geç teslim kapalı
  r := public.odev_olustur(t_ogretmen, 'GEC Ileri', null, v_sinif, 'test',
                           bugun_tr + 5, 2, '{"1":"A","2":"B"}'::jsonb, null, null, false);
  v_ileri_kapali := (r ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogretmen, v_ileri_kapali);

  -- SON GÜN, geç teslim kapalı — son gün hâlâ süre içindedir
  r := public.odev_olustur(t_ogretmen, 'GEC Bugun', null, v_sinif, 'test',
                           bugun_tr, 2, '{"1":"A","2":"B"}'::jsonb, null, null, false);
  v_bugun_kapali := (r ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogretmen, v_bugun_kapali);

  -- Parametre HİÇ VERİLMEDEN — eski çağrı biçimi
  r := public.odev_olustur(t_ogretmen, 'GEC Varsayilan', null, v_sinif, 'test',
                           bugun_tr - 3, 2, '{"1":"A","2":"B"}'::jsonb);
  v_varsayilan := (r ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogretmen, v_varsayilan);

  ------------------------------------------------------------------
  raise notice '--- 1. Varsayılan `true`: eski davranış korunuyor ---';
  if not (select gec_teslim from public.odevler where id = v_varsayilan) then
    raise exception 'HATA: parametresiz oluşturulan ödevde gec_teslim false!';
  end if;
  perform public.odev_gonder(t_ogr, v_varsayilan,
    'cozum/' || v_varsayilan || '/' || v_ogr || '.jpg', '{"1":"A","2":"B"}'::jsonb);
  raise notice '    süresi geçmiş ama varsayılan açık: gönderim kabul edildi: OK';

  ------------------------------------------------------------------
  raise notice '--- 2. Süresi geçmiş + KAPALI → REDDEDİLMELİ ---';
  begin
    perform public.odev_gonder(t_ogr, v_gecmis_kapali,
      'cozum/' || v_gecmis_kapali || '/' || v_ogr || '.jpg', '{"1":"A","2":"B"}'::jsonb);
    raise exception 'HATA: GEÇ TESLİM KAPALIYKEN SÜRESİ GEÇMİŞ ÖDEV KABUL EDİLDİ!';
  exception when others then
    if sqlstate = '22023' then
      raise notice '    reddedildi: OK';
    else
      raise;
    end if;
  end;

  -- Reddedilen gönderim kayıt DA bırakmamalı.
  if exists (select 1 from public.gonderimler where odev_id = v_gecmis_kapali) then
    raise exception 'HATA: reddedilen gönderim yine de kaydedilmiş!';
  end if;
  raise notice '    reddedilen gönderim kayıt bırakmadı: OK';

  ------------------------------------------------------------------
  raise notice '--- 3. Süresi geçmiş + AÇIK → kabul edilmeli ---';
  r := public.odev_gonder(t_ogr, v_gecmis_acik,
    'cozum/' || v_gecmis_acik || '/' || v_ogr || '.jpg', '{"1":"A","2":"B"}'::jsonb);
  if (r ->> 'puan')::numeric <> 100 then
    raise exception 'HATA: geç teslim açıkken puanlama yanlış (%)', r ->> 'puan';
  end if;
  raise notice '    kabul edildi ve puanlandı: OK';

  ------------------------------------------------------------------
  raise notice '--- 4. Süresi geçmemiş + KAPALI → kabul edilmeli ---';
  perform public.odev_gonder(t_ogr, v_ileri_kapali,
    'cozum/' || v_ileri_kapali || '/' || v_ogr || '.jpg', '{"1":"A","2":"B"}'::jsonb);
  raise notice '    süre içindeki ödev kapalı ayarla da gönderilebiliyor: OK';

  ------------------------------------------------------------------
  raise notice '--- 5. SON GÜN hâlâ süre içinde ---';
  perform public.odev_gonder(t_ogr, v_bugun_kapali,
    'cozum/' || v_bugun_kapali || '/' || v_ogr || '.jpg', '{"1":"A","2":"B"}'::jsonb);
  raise notice '    son gün gönderim kabul edildi: OK';

  ------------------------------------------------------------------
  raise notice '--- 6. Öğretmen ayarı sonradan değiştirebiliyor ---';
  perform public.odev_guncelle(t_ogretmen, v_gecmis_kapali, 'GEC Kapali', null,
                               v_sinif, bugun_tr - 3, 2,
                               '{"1":"A","2":"B"}'::jsonb, null, null, true);
  perform public.odev_gonder(t_ogr, v_gecmis_kapali,
    'cozum/' || v_gecmis_kapali || '/' || v_ogr || '.jpg', '{"1":"A","2":"B"}'::jsonb);
  raise notice '    kapalıyken reddedilen ödev, açılınca kabul edildi: OK';

  ------------------------------------------------------------------
  raise notice '--- 6b. Ayar YAYINDAKİ ödevde de kapatılabiliyor ve KALICI ---';
  -- Öğretmenin isteği: "diğer düzenlemeleri yapabildiği gibi bu düzenlemeyi
  -- de ödevi verdikten sonra da yapabilsin." Kalıcı olmazsa anlamı yok.
  perform public.odev_guncelle(t_ogretmen, v_gecmis_acik, 'GEC Acik', null,
                               v_sinif, bugun_tr - 3, 2,
                               '{"1":"A","2":"B"}'::jsonb, null, null, false);
  if (select gec_teslim from public.odevler where id = v_gecmis_acik)
     or not (select yayinda from public.odevler where id = v_gecmis_acik) then
    raise exception 'HATA: yayındaki ödevde geç teslim kapatılamadı!';
  end if;

  -- ASIL TUZAK: parametre GÖNDERİLMEDEN yapılan bir güncelleme (başlık
  -- değişikliği gibi) ayarı sessizce yeniden AÇMAMALI.
  perform public.odev_guncelle(t_ogretmen, v_gecmis_acik, 'GEC Acik yeni ad', null,
                               v_sinif, bugun_tr - 3, 2,
                               '{"1":"A","2":"B"}'::jsonb);
  if (select gec_teslim from public.odevler where id = v_gecmis_acik) then
    raise exception 'HATA: BAŞKA BİR DÜZENLEME GEÇ TESLİMİ SESSİZCE YENİDEN AÇTI!';
  end if;
  raise notice '    kapatma kalıcı, başka düzenleme ayarı bozmuyor: OK';

  ------------------------------------------------------------------
  raise notice '--- 7. Ayar üç okuma ucundan da görünüyor ---';
  o := public.odev_detay(t_ogretmen, v_ileri_kapali);
  if (o ->> 'gec_teslim')::boolean then
    raise exception 'HATA: odev_detay gec_teslim''i yanlış veriyor!';
  end if;

  if not exists (
    select 1 from jsonb_array_elements(public.odevler_listesi(t_ogretmen, v_sinif, null)) e
    where (e ->> 'id')::uuid = v_ileri_kapali and (e ->> 'gec_teslim')::boolean = false
  ) then
    raise exception 'HATA: odevler_listesi gec_teslim taşımıyor!';
  end if;

  if not exists (
    select 1 from jsonb_array_elements(public.ogrenci_odevleri(t_ogr) -> 'odevler') e
    where (e ->> 'id')::uuid = v_ileri_kapali and (e ->> 'gec_teslim')::boolean = false
  ) then
    raise exception 'HATA: ogrenci_odevleri gec_teslim taşımıyor — öğrenci kuralı bilemez!';
  end if;
  raise notice '    odev_detay, odevler_listesi, ogrenci_odevleri: OK';

  ------------------------------------------------------------------
  raise notice '--- 7b. Şık sayısı saklanıyor ve geri dönüyor ---';
  if (select sik_sayisi from public.odevler where id = v_ileri_kapali) <> 5 then
    raise exception 'HATA: varsayılan şık sayısı 5 değil!';
  end if;

  r := public.odev_olustur(t_ogretmen, 'GEC DortSik', null, v_sinif, 'test',
                           bugun_tr + 5, 2, '{"1":"A","2":"B"}'::jsonb,
                           null, null, true, 4::smallint);
  v_dort_sik := (r ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogretmen, v_dort_sik);

  if (select sik_sayisi from public.odevler where id = v_dort_sik) <> 4 then
    raise exception 'HATA: 4 şıklı ödev 4 olarak kaydedilmedi!';
  end if;
  if (public.odev_detay(t_ogretmen, v_dort_sik) ->> 'sik_sayisi')::int <> 4 then
    raise exception 'HATA: odev_detay şık sayısını vermiyor — düzenleme ekranı A–E''ye döner!';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(public.ogrenci_odevleri(t_ogr) -> 'odevler') e
    where (e ->> 'id')::uuid = v_dort_sik and (e ->> 'sik_sayisi')::int = 4
  ) then
    raise exception 'HATA: ogrenci_odevleri şık sayısını vermiyor — öğrenciye olmayan E şıkkı gösterilir!';
  end if;

  -- Geçersiz değer sessizce kabul edilmemeli; şema kısıtı korunmalı.
  if (select sik_sayisi from public.odevler where id = (
        (public.odev_olustur(t_ogretmen, 'GEC ZartSik', null, v_sinif, 'test',
                             bugun_tr + 5, 1, '{"1":"A"}'::jsonb,
                             null, null, true, 9::smallint)) ->> 'id')::uuid) <> 5 then
    raise exception 'HATA: geçersiz şık sayısı şema kısıtını bozdu!';
  end if;

  -- Düzenlemede parametre verilmezse mevcut değer korunmalı.
  perform public.odev_guncelle(t_ogretmen, v_dort_sik, 'GEC DortSik', null, v_sinif,
                               bugun_tr + 5, 2, '{"1":"A","2":"B"}'::jsonb, null, null, true);
  if (select sik_sayisi from public.odevler where id = v_dort_sik) <> 4 then
    raise exception 'HATA: güncelleme şık sayısını sessizce 5''e çevirdi!';
  end if;
  raise notice '    saklanıyor, üç uçtan da dönüyor, güncellemede korunuyor: OK';

  ------------------------------------------------------------------
  raise notice '--- 7c. Öğrenci KENDİ cevaplarını geri alabiliyor ---';
  -- "8 doğru 1 yanlış" bilgisi hangi soru olduğu bilinmeden işe yaramıyor.
  -- Bu KENDİ verisi; anahtar sızıntısıyla karıştırılmamalı — anahtar
  -- teslimden önce hâlâ null (0007 testleri bunu ayrıca ölçüyor).
  if not exists (
    select 1 from jsonb_array_elements(public.ogrenci_odevleri(t_ogr) -> 'odevler') e
    where (e ->> 'id')::uuid = v_gecmis_acik
      and (e -> 'gonderim' -> 'cevaplar' ->> '1') = 'A'
  ) then
    raise exception 'HATA: öğrenci kendi verdiği cevapları göremiyor!';
  end if;

  -- Teslim edilmemiş ödevde gönderim bloğunun kendisi yok.
  if exists (
    select 1 from jsonb_array_elements(public.ogrenci_odevleri(t_ogr) -> 'odevler') e
    where (e ->> 'id')::uuid = v_gecmis_kapali
      and jsonb_typeof(e -> 'gonderim') <> 'null'
      and (e -> 'gonderim') is not null
      and not exists (select 1 from public.gonderimler gg
                      where gg.odev_id = v_gecmis_kapali and gg.ogrenci_id = v_ogr)
  ) then
    raise exception 'HATA: gönderim yokken gönderim bloğu dolu döndü!';
  end if;
  raise notice '    kendi cevapları dönüyor, gönderim yoksa blok boş: OK';

  ------------------------------------------------------------------
  raise notice '--- 7d. GECİKMELİ gönderim her ekranda görünüyor ---';
  -- Öğretmenin isteği: geç teslime izin verilen ödevlerde bile geç gelen
  -- teslim "gecikmeli" olarak görünmeli. İzin vermek, gecikmeyi görmezden
  -- gelmek değil.

  -- v_gecmis_acik: son tarihi 3 gün geçmiş bir ödeve gönderim yapıldı.
  if not exists (
    select 1 from jsonb_array_elements(public.odevler_listesi(t_ogretmen, v_sinif, null)) e
    where (e ->> 'id')::uuid = v_gecmis_acik and (e ->> 'gec_gonderim_sayisi')::int = 1
  ) then
    raise exception 'HATA: odevler_listesi gecikmeli gönderimi saymıyor!';
  end if;

  if (public.odev_detay(t_ogretmen, v_gecmis_acik) ->> 'gec_gonderim_sayisi')::int <> 1 then
    raise exception 'HATA: odev_detay gecikmeli sayısını vermiyor!';
  end if;

  if not exists (
    select 1 from jsonb_array_elements(public.ogrenci_odevleri(t_ogr) -> 'odevler') e
    where (e ->> 'id')::uuid = v_gecmis_acik
      and (e -> 'gonderim' ->> 'gecikmeli')::boolean
  ) then
    raise exception 'HATA: öğrenci kendi gecikmesini göremiyor!';
  end if;

  if not exists (
    select 1 from jsonb_array_elements(public.ogretmen_panosu(t_ogretmen) -> 'son_gonderimler') e
    where (e ->> 'gecikmeli')::boolean
  ) then
    raise exception 'HATA: panoda gecikmeli gönderim işaretlenmiyor!';
  end if;

  -- SÜRESİ İÇİNDE gönderilen teslim gecikmeli SAYILMAMALI. Bu ölçüm olmadan
  -- "hep true dönen" bir alan da testi geçerdi.
  if (select count(*) from jsonb_array_elements(
        public.odevler_listesi(t_ogretmen, v_sinif, null)) e
      where (e ->> 'id')::uuid = v_ileri_kapali
        and (e ->> 'gec_gonderim_sayisi')::int <> 0) > 0 then
    raise exception 'HATA: süresi içinde gelen teslim gecikmeli sayıldı!';
  end if;

  -- SON GÜN gönderimi de gecikme değildir — odev_gonder ile aynı kural.
  if not exists (
    select 1 from jsonb_array_elements(public.ogrenci_odevleri(t_ogr) -> 'odevler') e
    where (e ->> 'id')::uuid = v_bugun_kapali
      and (e -> 'gonderim' ->> 'gecikmeli')::boolean = false
  ) then
    raise exception 'HATA: son gün gönderimi gecikmeli sayıldı!';
  end if;
  raise notice '    liste, detay, öğrenci ve pano: geç olan işaretli, zamanında olan değil: OK';

  ------------------------------------------------------------------
  raise notice '--- 8. ESKİ İMZALAR DÜŞTÜ MÜ (0007 tuzağı) ---';
  function_yol := 'public.odev_olustur(text,text,text,uuid,text,date,integer,jsonb,text,text)';
  if to_regprocedure(function_yol) is not null then
    raise exception 'HATA: odev_olustur''un eski 10 parametreli imzası hâlâ ayakta!';
  end if;
  function_yol := 'public.odev_guncelle(text,uuid,text,text,uuid,date,integer,jsonb,text,text)';
  if to_regprocedure(function_yol) is not null then
    raise exception 'HATA: odev_guncelle''nin eski 10 parametreli imzası hâlâ ayakta!';
  end if;
  raise notice '    eski imzalar yok, yalnız yeni imza çağrılabilir: OK';

  ------------------------------------------------------------------
  raise notice '--- 9. Yeni imzalar anon''a açık, öğrenciye kapalı ---';
  if not has_function_privilege('anon',
      'public.odev_olustur(text,text,text,uuid,text,date,integer,jsonb,text,text,boolean,smallint)',
      'execute') then
    raise exception 'HATA: yeni odev_olustur imzası anon''a kapalı — istemci çağıramaz!';
  end if;
  if not has_function_privilege('anon',
      'public.odev_guncelle(text,uuid,text,text,uuid,date,integer,jsonb,text,text,boolean,smallint)',
      'execute') then
    raise exception 'HATA: yeni odev_guncelle imzası anon''a kapalı!';
  end if;

  -- Yetki anon rolünde; asıl koruma fonksiyonun içindeki rol denetimi.
  begin
    perform public.odev_guncelle(t_ogr, v_ileri_kapali, 'X', null, v_sinif,
                                 bugun_tr + 5, 2, '{"1":"A","2":"B"}'::jsonb,
                                 null, null, true);
    raise exception 'HATA: ÖĞRENCİ ÖDEV GÜNCELLEDİ!';
  exception when insufficient_privilege then
    raise notice '    öğrenci odev_guncelle''den reddedildi: OK';
  end;

  raise notice '';
  raise notice '=========================================';
  raise notice 'GEÇ TESLİM TESTLERİ GEÇTİ';
  raise notice '=========================================';
end;
$$;
