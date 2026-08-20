-- =============================================================================
-- SEKİZ — 0029 GENEL ORTALAMA TESTLERİ
--
-- Tanıtım sayfasının nihai metni "öğrenci genel ortalamasını takip
-- edebilir" diyor. Bu dosya o cümlenin ARKASINDAKİ SAYIYI ölçüyor.
--
-- İKİ ASIL SORU:
--   1. Sayı doğru mu — elle toplanabilir puanlarla kontrol ediliyor.
--   2. Ortalamayla birlikte KIYAS sızdı mı? 0026'nın güvencesi buydu:
--      sınıf ortalaması, sıralama, başka öğrencinin verisi çocuğa
--      gitmiyor. Ortalama eklerken o kapının açılması en olası hataydı.
--
-- SIZINTI ALAN ADIYLA DEĞİL GERÇEK DEĞERLE aranıyor: ikinci bir öğrenci
-- bilinen ve alışılmadık bir puanla kuruluyor, o puan yanıtta aranıyor.
-- Alan adı aramak, sayı başka bir adla sızarsa hiçbir şey yakalamazdı.
--
-- İZOLASYON: kendi sınıfımızı (12, 'O') kuruyoruz ve dosya yeniden
-- çalıştırılabilir olsun diye önce temizliyoruz — 0026'da bu atlanınca
-- geri alma kanıtı tamamen geçersiz çıkmıştı.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text;       -- öğretmen
  jo text;       -- Ada
  jv text;       -- Ada'nın velisi
  v_sinif uuid;
  v_ada uuid;
  v_efe uuid;    -- BAŞKA öğrenci
  d1 uuid; d2 uuid; d3 uuid; d4 uuid;
  v jsonb;       -- kendi_karnem
  vv jsonb;      -- veli_paneli
  n numeric;

  -- Efe'nin puanı ALIŞILMADIK: Ada'nın yanıtında tesadüfen bulunmasın.
  c_efe_puan constant integer := 37;
  c_efe_ad   constant text    := 'Efe Ortalamasız';
begin
  update public.ayarlar
     set ogretmen_pin_hash = extensions.crypt('Ortalama!2026', extensions.gen_salt('bf', 10))
   where id = 1;
  jt := (public.giris('Ortalama!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (12, 'O')
    on conflict (seviye, sube) do update set arsiv = false
    returning id into v_sinif;

  -- --- TEMİZLİK: dosya tekrar çalıştırılabilir olmalı --------------------
  delete from public.gonderimler
   where odev_id in (select id from public.odevler where sinif_id = v_sinif);
  delete from public.odevler where sinif_id = v_sinif;
  delete from public.giris_kodlari
   where ogrenci_id in (select id from public.ogrenciler where sinif_id = v_sinif);
  delete from public.ogrenciler where sinif_id = v_sinif;

  v_ada := (public.ogrenci_ekle(jt, 'Ada Ortalama', 'okul', v_sinif))->>'id';
  v_efe := (public.ogrenci_ekle(jt, c_efe_ad, 'okul', v_sinif))->>'id';
  jo := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_ada and rol = 'ogrenci')))->>'token';
  jv := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_ada and rol = 'veli')))->>'token';

  -- --- ÖDEVLER -----------------------------------------------------------
  -- d1, d2: süresi dolmuş test ödevleri — ortalamaya girecekler
  -- d3: süresi dolmuş, Ada GÖNDERMEDİ — ortalamayı düşürmemeli
  -- d4: süresi DOLMAMIŞ — pencerenin dışında
  d1 := (public.odev_olustur(jt, 'Ortalama 1', null, v_sinif, 'test',
          current_date - 5, 2, '{"1":"A","2":"B"}'::jsonb, null, null, true, 4::smallint, null))->>'id';
  d2 := (public.odev_olustur(jt, 'Ortalama 2', null, v_sinif, 'test',
          current_date - 4, 2, '{"1":"A","2":"B"}'::jsonb, null, null, true, 4::smallint, null))->>'id';
  d3 := (public.odev_olustur(jt, 'Ortalama 3 — gönderilmedi', null, v_sinif, 'test',
          current_date - 3, 2, '{"1":"A","2":"B"}'::jsonb, null, null, true, 4::smallint, null))->>'id';
  d4 := (public.odev_olustur(jt, 'Ortalama 4 — süresi dolmadı', null, v_sinif, 'test',
          current_date + 5, 2, '{"1":"A","2":"B"}'::jsonb, null, null, true, 4::smallint, null))->>'id';
  perform public.odev_yayinla(jt, d1);
  perform public.odev_yayinla(jt, d2);
  perform public.odev_yayinla(jt, d3);
  perform public.odev_yayinla(jt, d4);

  -- Ada: d1'de 2/2 = 100, d2'de 1/2 = 50 → ortalama 75.0
  perform public.odev_gonder(jo, d1, 'cozum/' || d1 || '/' || v_ada || '.jpg',
                             '{"1":"A","2":"B"}'::jsonb);
  perform public.odev_gonder(jo, d2, 'cozum/' || d2 || '/' || v_ada || '.jpg',
                             '{"1":"A","2":"X"}'::jsonb);

  -- ===========================================================================
  raise notice '--- 1. Sayı doğru mu ---';
  -- ===========================================================================
  v := public.kendi_karnem(jo);
  n := (v->>'genel_ortalama')::numeric;
  if n is distinct from 75.0 then
    raise exception '1a BAŞARISIZ — ortalama 75.0 beklenirken %', coalesce(n::text, 'null');
  end if;
  raise notice '1a OK — 100 ve 50 → ortalama %', n;

  -- 1b — GÖNDERİLMEYEN ÖDEV ORTALAMAYI DÜŞÜRMÜYOR.
  -- d3 gönderilmedi. Sıfır olarak girseydi ortalama 50 olurdu.
  if n = 50.0 then
    raise exception '1b BAŞARISIZ — gönderilmeyen ödev 0 olarak ortalamaya girmiş';
  end if;
  raise notice '1b OK — gönderilmeyen ödev ortalamaya 0 olarak girmiyor';

  -- 1c — SÜRESİ DOLMAMIŞ ÖDEV PENCEREYE GİRMİYOR.
  -- d4'e mükemmel bir gönderim yapılıyor; ortalama DEĞİŞMEMELİ.
  perform public.odev_gonder(jo, d4, 'cozum/' || d4 || '/' || v_ada || '.jpg',
                             '{"1":"A","2":"B"}'::jsonb);
  if ((public.kendi_karnem(jo))->>'genel_ortalama')::numeric is distinct from 75.0 then
    raise exception '1c BAŞARISIZ — süresi dolmamış ödev ortalamayı değiştirdi: %',
      (public.kendi_karnem(jo))->>'genel_ortalama';
  end if;
  raise notice '1c OK — süresi dolmamış ödev ortalamaya girmiyor';

  -- ===========================================================================
  raise notice '--- 2. Öğretmen puanı önceliği ---';
  -- ===========================================================================
  -- d2'nin gönderimine öğretmen 90 veriyor → ortalama (100+90)/2 = 95.0
  perform public.acik_puanla(jt,
    (select id from public.gonderimler where odev_id = d2 and ogrenci_id = v_ada),
    90, 'Elle düzeltildi.');
  n := ((public.kendi_karnem(jo))->>'genel_ortalama')::numeric;
  if n is distinct from 95.0 then
    raise exception '2 BAŞARISIZ — ogretmen_puan sonrası 95.0 beklenirken %', n;
  end if;
  raise notice '2 OK — coalesce(ogretmen_puan, puan) kullanılıyor → %', n;

  -- ===========================================================================
  raise notice '--- 3. Öğrenci ve veli AYNI sayıyı görüyor ---';
  -- ===========================================================================
  vv := public.veli_paneli(jv);
  if (vv->>'genel_ortalama') is distinct from (v->>'genel_ortalama') then
    -- v eski; taze okuyalım
    v := public.kendi_karnem(jo);
  end if;
  if (vv->>'genel_ortalama')::numeric is distinct from
     ((public.kendi_karnem(jo))->>'genel_ortalama')::numeric then
    raise exception '3 BAŞARISIZ — veli % görüyor, öğrenci %',
      vv->>'genel_ortalama', (public.kendi_karnem(jo))->>'genel_ortalama';
  end if;
  raise notice '3 OK — iki uç da % veriyor', vv->>'genel_ortalama';

  -- ===========================================================================
  raise notice '--- 4. KIYAS SIZMADI ---';
  -- ===========================================================================
  -- Efe'ye bilinen ve alışılmadık bir puan veriliyor.
  perform public.odev_gonder(
    (public.giris((select kod from public.giris_kodlari
                   where ogrenci_id = v_efe and rol = 'ogrenci')))->>'token',
    d1, 'cozum/' || d1 || '/' || v_efe || '.jpg', '{"1":"A","2":"X"}'::jsonb);
  perform public.acik_puanla(jt,
    (select id from public.gonderimler where odev_id = d1 and ogrenci_id = v_efe),
    c_efe_puan, null);

  v  := public.kendi_karnem(jo);
  vv := public.veli_paneli(jv);

  -- 4a — Başka öğrencinin ADI yanıtta yok.
  if v::text like '%' || c_efe_ad || '%' then
    raise exception '4a BAŞARISIZ — kendi_karnem''de başka öğrencinin adı var';
  end if;
  if vv::text like '%' || c_efe_ad || '%' then
    raise exception '4a BAŞARISIZ — veli_paneli''de başka öğrencinin adı var';
  end if;
  raise notice '4a OK — başka öğrencinin adı iki yanıtta da yok';

  -- 4b — Başka öğrencinin PUANI yanıtta yok.
  if v::text ~ ('\m' || c_efe_puan::text || '\M') then
    raise exception '4b BAŞARISIZ — kendi_karnem''de Efe''nin puanı (%) geçiyor', c_efe_puan;
  end if;
  raise notice '4b OK — başka öğrencinin puanı yanıtta geçmiyor';

  -- 4c — SINIF ORTALAMASI / SIRALAMA alanı yok.
  if v::text ~* 'sinif_ortalama|sınıf ortalama|siralama|sıralama|mevcut' then
    raise exception '4c BAŞARISIZ — kendi_karnem kıyas alanı taşıyor';
  end if;
  if vv::text ~* 'sinif_ortalama|sınıf ortalama|siralama|sıralama' then
    raise exception '4c BAŞARISIZ — veli_paneli kıyas alanı taşıyor';
  end if;
  raise notice '4c OK — sınıf ortalaması ve sıralama iki uçta da yok';

  -- 4d — DENETİMİN İŞE YARADIĞI KANITI.
  -- Aynı değerler ÖĞRETMENİN ucunda BULUNUYOR. Bulunmasaydı yukarıdaki
  -- üç denetim, veri hiç yazılmadığı için de geçerdi ve hiçbir şey
  -- ölçmezlerdi.
  if (public.sinif_ogrencileri(jt, v_sinif))::text not like '%' || c_efe_ad || '%' then
    raise exception '4d BAŞARISIZ — Efe öğretmenin listesinde de yok; test bir şey ölçmüyor';
  end if;
  raise notice '4d OK — aynı ad öğretmenin ucunda BULUNUYOR (denetim ölçüyor)';

  -- ===========================================================================
  raise notice '--- 5. Değerlendirilmiş gönderim yoksa null ---';
  -- ===========================================================================
  -- Efe'nin velisi: Efe'nin tek gönderimi var ama onu d1'e yaptı ve
  -- puanlandı; bu yüzden Efe için null beklemiyoruz. Bunun yerine
  -- Ada'nın gönderimlerini silip ölçüyoruz.
  delete from public.gonderimler where ogrenci_id = v_ada;
  if (public.kendi_karnem(jo))->>'genel_ortalama' is not null then
    raise exception '5 BAŞARISIZ — gönderim yokken ortalama % dönüyor',
      (public.kendi_karnem(jo))->>'genel_ortalama';
  end if;
  raise notice '5 OK — değerlendirilmiş gönderim yokken null';

  -- ===========================================================================
  raise notice '--- 6. Öğretmen bu uçları çağıramıyor (0026 güvencesi) ---';
  -- ===========================================================================
  begin
    perform public.kendi_karnem(jt);
    raise exception '6 BAŞARISIZ — öğretmen kendi_karnem çağırabildi';
  exception when sqlstate '42501' then
    null;
  end;
  raise notice '6 OK — öğretmen kendi_karnem çağıramıyor';

  raise notice '';
  raise notice 'GENEL ORTALAMA TESTLERİ: 6 GRUP GEÇTİ';
end $$;
