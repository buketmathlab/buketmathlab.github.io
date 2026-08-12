-- =============================================================================
-- SEKİZ — 0011 GÖNDERİM TAKİBİ VE AÇIK UÇLU PUANLAMA TESTLERİ
--
-- En kritik iki davranış:
--   1. GÖNDERMEYEN öğrenci listede satır olarak görünmeli. Öğretmenin bu
--      ekranı açarkenki sorusu çoğu zaman "kim göndermedi".
--   2. Açık uçlu ödev artık puanlanabilmeli — `acik_puanla` vardı ama
--      arayüz hangi gönderimi puanlayacağını öğrenemiyordu.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  t_ogretmen text;
  t_ali      text;
  t_ayse     text;
  t_veli     text;
  v_sinif    uuid;
  v_ali      uuid;
  v_ayse     uuid;
  v_mehmet   uuid;
  v_test     uuid;
  v_acik     uuid;
  r          jsonb;
  liste      jsonb;
  satir      jsonb;
  g_ali      uuid;
  n          integer;
  bugun_tr   date := (now() at time zone 'Europe/Istanbul')::date;
begin
  raise notice '--- Kurulum ---';
  update public.ayarlar set ogretmen_pin_hash = null where id = 1;
  t_ogretmen := (public.pin_ayarla('takip-PIN.3')) ->> 'token';
  r := public.sinif_ekle(t_ogretmen, 11::smallint, 'T'); v_sinif := (r ->> 'id')::uuid;

  r := public.ogrenci_ekle(t_ogretmen, 'Ali Takip', 'okul', v_sinif);
  v_ali := (r ->> 'id')::uuid;
  t_ali := (public.giris(r ->> 'ogrenci_kodu')) ->> 'token';
  t_veli := (public.giris(r ->> 'veli_kodu')) ->> 'token';

  r := public.ogrenci_ekle(t_ogretmen, 'Ayse Takip', 'okul', v_sinif);
  v_ayse := (r ->> 'id')::uuid;
  t_ayse := (public.giris(r ->> 'ogrenci_kodu')) ->> 'token';

  -- Mehmet HİÇ GÖNDERMEYECEK. Testin can alıcı noktası bu öğrenci.
  r := public.ogrenci_ekle(t_ogretmen, 'Mehmet Takip', 'okul', v_sinif);
  v_mehmet := (r ->> 'id')::uuid;

  -- Test ödevi: süresi 3 gün önce doldu, geç teslim açık.
  r := public.odev_olustur(t_ogretmen, 'TAK Test', null, v_sinif, 'test',
                           bugun_tr - 3, 2, '{"1":"A","2":"B"}'::jsonb,
                           null, null, true);
  v_test := (r ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogretmen, v_test);

  -- Açık uçlu ödev: süresi dolmadı.
  r := public.odev_olustur(t_ogretmen, 'TAK Acik', null, v_sinif, 'acik',
                           bugun_tr + 5);
  v_acik := (r ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogretmen, v_acik);

  -- Ali geç gönderdi (ödevin süresi geçmişti), Ayşe hiç göndermedi.
  perform public.odev_gonder(t_ali, v_test,
    'cozum/' || v_test || '/' || v_ali || '.jpg', '{"1":"A","2":"B"}'::jsonb);
  -- Açık uçluya Ali ve Ayşe gönderdi; ikisi de 'incelemede' kalacak.
  perform public.odev_gonder(t_ali, v_acik,
    'cozum/' || v_acik || '/' || v_ali || '.jpg');
  perform public.odev_gonder(t_ayse, v_acik,
    'cozum/' || v_acik || '/' || v_ayse || '.jpg');

  ------------------------------------------------------------------
  raise notice '--- 1. GÖNDERMEYEN öğrenci listede satır olarak var ---';
  r := public.odev_gonderimleri(t_ogretmen, v_test);
  liste := r -> 'satirlar';

  if jsonb_array_length(liste) <> 3 then
    raise exception 'HATA: sınıf 3 kişilik ama liste % satır', jsonb_array_length(liste);
  end if;

  select e into satir from jsonb_array_elements(liste) e
   where (e ->> 'ogrenci_id')::uuid = v_mehmet;
  if satir is null then
    raise exception 'HATA: HİÇ GÖNDERMEYEN ÖĞRENCİ LİSTEDE YOK — "kim göndermedi" sorusu cevapsız!';
  end if;
  if (satir ->> 'gonderdi')::boolean then
    raise exception 'HATA: göndermeyen öğrenci gönderdi görünüyor!';
  end if;
  if (satir ->> 'gonderim_id') is not null or (satir ->> 'puan') is not null then
    raise exception 'HATA: göndermeyen öğrencide gönderim verisi var!';
  end if;
  raise notice '    3 satır; göndermeyen öğrenci gönderim verisi olmadan listede: OK';

  ------------------------------------------------------------------
  raise notice '--- 2. Gecikme işareti doğru ---';
  select e into satir from jsonb_array_elements(liste) e
   where (e ->> 'ogrenci_id')::uuid = v_ali;
  if not (satir ->> 'gecikmeli')::boolean then
    raise exception 'HATA: süresi geçmiş ödeve gelen teslim gecikmeli sayılmadı!';
  end if;
  if (satir ->> 'puan')::numeric <> 100 then
    raise exception 'HATA: test puanı listede yanlış (%)', satir ->> 'puan';
  end if;

  -- GÖNDERMEYEN gecikmeli SAYILMAMALI. Bu ölçüm olmadan "hep true dönen"
  -- bir alan da testi geçerdi.
  select e into satir from jsonb_array_elements(liste) e
   where (e ->> 'ogrenci_id')::uuid = v_mehmet;
  if (satir ->> 'gecikmeli')::boolean then
    raise exception 'HATA: hiç göndermeyen öğrenci "gecikmeli" işaretlendi!';
  end if;
  raise notice '    geç gönderen işaretli, hiç göndermeyen değil: OK';

  ------------------------------------------------------------------
  raise notice '--- 3. Özet sayılar ---';
  if (r -> 'ozet' ->> 'mevcut')::int <> 3
     or (r -> 'ozet' ->> 'gonderen')::int <> 1
     or (r -> 'ozet' ->> 'gecikmeli')::int <> 1 then
    raise exception 'HATA: özet yanlış: %', r -> 'ozet';
  end if;
  raise notice '    mevcut 3, gönderen 1, gecikmeli 1: OK';

  ------------------------------------------------------------------
  raise notice '--- 4. AÇIK UÇLU ÖDEV ARTIK PUANLANABİLİYOR ---';
  r := public.odev_gonderimleri(t_ogretmen, v_acik);
  if (r -> 'ozet' ->> 'puan_bekleyen')::int <> 2 then
    raise exception 'HATA: puan bekleyen sayısı yanlış (%)',
      r -> 'ozet' ->> 'puan_bekleyen';
  end if;

  select (e ->> 'gonderim_id')::uuid into g_ali
  from jsonb_array_elements(r -> 'satirlar') e
  where (e ->> 'ogrenci_id')::uuid = v_ali;
  if g_ali is null then
    raise exception 'HATA: gönderim kimliği dönmüyor — arayüz acik_puanla''yı çağıramaz!';
  end if;

  perform public.acik_puanla(t_ogretmen, g_ali, 85, 'İkinci soruda gösterim eksik.');

  r := public.odev_gonderimleri(t_ogretmen, v_acik);
  select e into satir from jsonb_array_elements(r -> 'satirlar') e
   where (e ->> 'ogrenci_id')::uuid = v_ali;
  if (satir ->> 'ogretmen_puan')::numeric <> 85
     or (satir ->> 'durum') <> 'onaylandi'
     or (satir ->> 'ogretmen_yorum') is null then
    raise exception 'HATA: puanlama listeye yansımadı: %', satir;
  end if;
  if (r -> 'ozet' ->> 'puan_bekleyen')::int <> 1 then
    raise exception 'HATA: puanlamadan sonra bekleyen sayısı düşmedi!';
  end if;
  raise notice '    85 puan ve yorum kaydedildi, bekleyen 2 → 1: OK';

  ------------------------------------------------------------------
  raise notice '--- 5. Not değişikliği denetim izine yazıldı ---';
  select count(*) into n from public.denetim_izi where islem = 'acik_uclu_puanlandi';
  if n <> 1 then
    raise exception 'HATA: açık uçlu puanlama iz bırakmadı (% kayıt)', n;
  end if;
  raise notice '    iz var: OK';

  ------------------------------------------------------------------
  raise notice '--- 6. Puan sınırları zorlanıyor ---';
  begin
    perform public.acik_puanla(t_ogretmen, g_ali, 101);
    raise exception 'HATA: 101 puan kabul edildi!';
  exception when others then
    if sqlstate = '22023' then raise notice '    101 reddedildi: OK';
    else raise; end if;
  end;
  begin
    perform public.acik_puanla(t_ogretmen, g_ali, -1);
    raise exception 'HATA: negatif puan kabul edildi!';
  exception when others then
    if sqlstate = '22023' then raise notice '    -1 reddedildi: OK';
    else raise; end if;
  end;
  -- Sınır değerler GEÇERLİ olmalı; kısıt fazla dar olmasın.
  perform public.acik_puanla(t_ogretmen, g_ali, 0);
  perform public.acik_puanla(t_ogretmen, g_ali, 100);
  raise notice '    0 ve 100 kabul: OK';

  ------------------------------------------------------------------
  raise notice '--- 7. Fotoğraf yolu tek tek veriliyor ---';
  if (public.gonderim_foto_yolu(t_ogretmen, g_ali) ->> 'yol')
     <> 'cozum/' || v_acik || '/' || v_ali || '.jpg' then
    raise exception 'HATA: fotoğraf yolu yanlış!';
  end if;
  -- Liste yanıtı yol TAŞIMAMALI (0007 deseni).
  if (r -> 'satirlar' -> 0) ? 'foto_yolu' then
    raise exception 'HATA: liste yanıtı dosya yollarını taşıyor!';
  end if;
  raise notice '    yol tek tek geliyor, listede yok: OK';

  ------------------------------------------------------------------
  raise notice '--- 8. Liste cevap anahtarı SIZDIRMIYOR ---';
  r := public.odev_gonderimleri(t_ogretmen, v_test);
  if r ? 'cevap_anahtari' or (r -> 'odev') ? 'cevap_anahtari' then
    raise exception 'HATA: gönderim listesi cevap anahtarı taşıyor!';
  end if;
  raise notice '    anahtar yok: OK';

  ------------------------------------------------------------------
  raise notice '--- 9. Öğrenci ve veli bu uçları çağıramaz ---';
  begin
    perform public.odev_gonderimleri(t_ali, v_test);
    raise exception 'HATA: ÖĞRENCİ TÜM SINIFIN PUANLARINI GÖRDÜ!';
  exception when insufficient_privilege then
    raise notice '    öğrenci reddedildi: OK';
  end;
  begin
    perform public.odev_gonderimleri(t_veli, v_test);
    raise exception 'HATA: VELİ TÜM SINIFIN PUANLARINI GÖRDÜ!';
  exception when insufficient_privilege then
    raise notice '    veli reddedildi: OK';
  end;
  begin
    perform public.gonderim_foto_yolu(t_ayse, g_ali);
    raise exception 'HATA: ÖĞRENCİ BAŞKASININ ÇÖZÜM FOTOĞRAFININ YOLUNU ALDI!';
  exception when insufficient_privilege then
    raise notice '    öğrenci fotoğraf yolunu alamıyor: OK';
  end;
  begin
    perform public.acik_puanla(t_ali, g_ali, 100);
    raise exception 'HATA: ÖĞRENCİ KENDİNE 100 VERDİ!';
  exception when insufficient_privilege then
    raise notice '    öğrenci puanlayamıyor: OK';
  end;

  ------------------------------------------------------------------
  raise notice '--- 10. Öğretmen puanı öğrencinin ekranına düşüyor ---';
  if not exists (
    select 1 from jsonb_array_elements(public.ogrenci_odevleri(t_ali) -> 'odevler') e
    where (e ->> 'id')::uuid = v_acik
      and (e -> 'gonderim' ->> 'ogretmen_puan')::numeric = 100
  ) then
    raise exception 'HATA: öğretmenin verdiği puan öğrenciye görünmüyor!';
  end if;
  raise notice '    öğrenci öğretmen puanını görüyor: OK';

  raise notice '';
  raise notice '=========================================';
  raise notice 'GÖNDERİM TAKİBİ TESTLERİ GEÇTİ';
  raise notice '=========================================';
end;
$$;
