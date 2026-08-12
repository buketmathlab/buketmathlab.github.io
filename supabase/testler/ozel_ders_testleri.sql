-- =============================================================================
-- SEKİZ — 0012 ÖZEL DERS SINIFI VE ÖDEV ORTALAMASI TESTLERİ
--
-- En kritik davranış: özel ders öğrencisine ÖDEV VERİLEBİLMESİ. Bugüne kadar
-- verilemiyordu (odevler.sinif_id NOT NULL, özel öğrencinin sinif_id'si NULL)
-- ve ürün onlara ödev vaat ediyordu.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  t_ogretmen text;
  t_ozel     text;
  v_ozel_sinif uuid;
  v_9a       uuid;
  v_ozel_ogr uuid;
  v_a        uuid;
  v_b        uuid;
  v_odev     uuid;
  v_odev_9a  uuid;
  r          jsonb;
  e          jsonb;
  adet       integer;
  son_ad     text;
  bugun_tr   date := (now() at time zone 'Europe/Istanbul')::date;
begin
  raise notice '--- Kurulum ---';
  update public.ayarlar set ogretmen_pin_hash = null where id = 1;
  t_ogretmen := (public.pin_ayarla('ozel-PIN.6')) ->> 'token';

  ------------------------------------------------------------------
  raise notice '--- 1. On iki sayısal sınıf + tek Özel ders, en sonda ---';
  -- Toplam sayı sabitlenmiyor: bu testler ortak bir veritabanında sırayla
  -- çalışıyor ve önceki dosyalar kendi sınıflarını ekliyor. Ölçülen şey
  -- başlangıç verisinin bozulmamış olması ve özel sınıfın tekliği.
  select count(*) into adet from public.siniflar
   where not ozel and seviye between 9 and 12 and sube in ('A','B','C');
  if adet <> 12 then
    raise exception 'HATA: 12 başlangıç sınıfı beklenirken % bulundu', adet;
  end if;
  select count(*) into adet from public.siniflar where ozel;
  if adet <> 1 then
    raise exception 'HATA: özel ders sınıfı % adet (1 olmalı)', adet;
  end if;
  select ad into son_ad from public.siniflar order by seviye desc, sube desc limit 1;
  if son_ad <> 'Özel ders' then
    raise exception 'HATA: son sınıf "Özel ders" değil, "%"', son_ad;
  end if;

  -- Sayısal sınıfların adı DEĞİŞMEMELİ. Üretilmiş sütun yeniden kuruldu;
  -- bu kontrol olmadan "9A" bir gün "9 A" olsa fark edilmezdi.
  if not exists (select 1 from public.siniflar where ad = '9A')
     or not exists (select 1 from public.siniflar where ad = '12C') then
    raise exception 'HATA: sayısal sınıf adları bozuldu!';
  end if;
  raise notice '    12 başlangıç sınıfı korunmuş, tek özel sınıf en sonda: OK';

  select id into v_ozel_sinif from public.siniflar where ozel;
  -- Ortalama ölçümü için TAZE bir sınıf. 9A'yı kullansaydım önceki test
  -- dosyalarının oraya eklediği öğrenciler ortalamayı bozardı (ölçüldü:
  -- 50 yerine 25 çıktı).
  v_9a := (public.sinif_ekle(t_ogretmen, 9::smallint, 'Q') ->> 'id')::uuid;

  ------------------------------------------------------------------
  raise notice '--- 2. İkinci bir özel ders sınıfı açılamaz ---';
  begin
    insert into public.siniflar (seviye, sube, ozel) values (99, 'X', true);
    raise exception 'HATA: İKİNCİ ÖZEL DERS SINIFI AÇILDI!';
  exception when unique_violation then
    raise notice '    tek özel sınıf kısıtı çalışıyor: OK';
  end;

  ------------------------------------------------------------------
  raise notice '--- 3. Özel ders öğrencisi sınıfsız KALMIYOR ---';
  r := public.ogrenci_ekle(t_ogretmen, 'Ozel Ogrenci', 'ozel');
  v_ozel_ogr := (r ->> 'id')::uuid;
  t_ozel := (public.giris(r ->> 'ogrenci_kodu')) ->> 'token';

  if (select sinif_id from public.ogrenciler where id = v_ozel_ogr)
     is distinct from v_ozel_sinif then
    raise exception 'HATA: özel ders öğrencisi Özel ders sınıfına bağlanmadı!';
  end if;
  -- Türü DEĞİŞMEMELİ: sınıf bir hedefleme aracı, kimlik değil.
  if (select tur from public.ogrenciler where id = v_ozel_ogr) <> 'ozel' then
    raise exception 'HATA: öğrencinin türü değişti!';
  end if;
  raise notice '    sınıfa bağlandı, türü "ozel" kaldı: OK';

  ------------------------------------------------------------------
  raise notice '--- 4. ÖZEL DERS ÖĞRENCİSİNE ÖDEV VERİLEBİLİYOR ---';
  r := public.odev_olustur(t_ogretmen, 'OZ Odev', null, v_ozel_sinif, 'test',
                           bugun_tr + 3, 2, '{"1":"A","2":"B"}'::jsonb);
  v_odev := (r ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogretmen, v_odev);

  if not exists (
    select 1 from jsonb_array_elements(public.ogrenci_odevleri(t_ozel) -> 'odevler') x
    where (x ->> 'id')::uuid = v_odev
  ) then
    raise exception 'HATA: ÖZEL DERS ÖĞRENCİSİ ÖDEVİ GÖREMİYOR!';
  end if;

  perform public.odev_gonder(t_ozel, v_odev,
    'cozum/' || v_odev || '/' || v_ozel_ogr || '.jpg', '{"1":"A","2":"B"}'::jsonb);
  raise notice '    ödev görüldü ve gönderildi: OK';

  ------------------------------------------------------------------
  raise notice '--- 5. Okul öğrencisi hâlâ sınıfsız eklenemiyor ---';
  begin
    perform public.ogrenci_ekle(t_ogretmen, 'Sinifsiz Okul', 'okul');
    raise exception 'HATA: okul öğrencisi sınıfsız eklendi!';
  exception when others then
    if sqlstate = '22023' then raise notice '    reddedildi: OK';
    else raise; end if;
  end;

  ------------------------------------------------------------------
  raise notice '--- 6. ÖDEV ORTALAMASI yalnız süre dolunca ---';
  r := public.ogrenci_ekle(t_ogretmen, 'A Ogrenci', 'okul', v_9a);
  v_a := (r ->> 'id')::uuid;
  r := public.ogrenci_ekle(t_ogretmen, 'B Ogrenci', 'okul', v_9a);
  v_b := (r ->> 'id')::uuid;

  -- Süresi GEÇMEMİŞ ödev: ortalama olmamalı.
  r := public.odev_olustur(t_ogretmen, 'OZ Acik Sure', null, v_9a, 'test',
                           bugun_tr + 5, 2, '{"1":"A","2":"B"}'::jsonb);
  perform public.odev_yayinla(t_ogretmen, (r ->> 'id')::uuid);
  select x into e from jsonb_array_elements(
    public.odevler_listesi(t_ogretmen, v_9a, null)) x
   where (x ->> 'id')::uuid = (r ->> 'id')::uuid;
  if (e ->> 'ortalama_yapan') is not null or (e ->> 'ortalama_tum') is not null then
    raise exception 'HATA: süresi dolmamış ödevde ortalama gösterildi!';
  end if;
  raise notice '    süre dolmadan ortalama yok: OK';

  ------------------------------------------------------------------
  raise notice '--- 7. İki ortalama ayrı hesaplanıyor ---';
  -- Süresi dolmuş ödev; A gönderdi (100), B göndermedi.
  r := public.odev_olustur(t_ogretmen, 'OZ Gecmis', null, v_9a, 'test',
                           bugun_tr - 2, 2, '{"1":"A","2":"B"}'::jsonb,
                           null, null, true);
  v_odev_9a := (r ->> 'id')::uuid;
  perform public.odev_yayinla(t_ogretmen, v_odev_9a);
  perform public.odev_gonder(
    (public.giris((select kod from public.giris_kodlari
                   where ogrenci_id = v_a and rol = 'ogrenci'))) ->> 'token',
    v_odev_9a, 'cozum/' || v_odev_9a || '/' || v_a || '.jpg',
    '{"1":"A","2":"B"}'::jsonb);

  select x into e from jsonb_array_elements(
    public.odevler_listesi(t_ogretmen, v_9a, null)) x
   where (x ->> 'id')::uuid = v_odev_9a;

  -- Yapanın ortalaması 100; göndermeyen 0 sayılınca sınıf ortalaması 50.
  if (e ->> 'ortalama_yapan')::numeric <> 100 then
    raise exception 'HATA: yapanların ortalaması yanlış (%)', e ->> 'ortalama_yapan';
  end if;
  if (e ->> 'ortalama_tum')::numeric <> 50 then
    raise exception 'HATA: göndermeyen 0 sayılmadı, ortalama % geldi',
      e ->> 'ortalama_tum';
  end if;
  raise notice '    yapan 100, tümü 50 (göndermeyen 0 sayıldı): OK';

  ------------------------------------------------------------------
  raise notice '--- 8. Listede sınıf ve özel bilgisi var ---';
  select x into e from jsonb_array_elements(
    public.odevler_listesi(t_ogretmen, v_ozel_sinif, null)) x
   where (x ->> 'id')::uuid = v_odev;
  if (e ->> 'sinif') <> 'Özel ders' or not (e ->> 'sinif_ozel')::boolean then
    raise exception 'HATA: özel ders ödevi listede yanlış etiketlendi: %', e;
  end if;

  if not exists (
    select 1 from jsonb_array_elements(public.siniflar_listesi(t_ogretmen, false)) x
    where (x ->> 'ad') = 'Özel ders' and (x ->> 'ozel')::boolean
  ) then
    raise exception 'HATA: siniflar_listesi özel bayrağını vermiyor!';
  end if;
  raise notice '    sınıf adı ve özel bayrağı doğru: OK';

  raise notice '';
  raise notice '=========================================';
  raise notice 'ÖZEL DERS TESTLERİ GEÇTİ';
  raise notice '=========================================';
end;
$$;
