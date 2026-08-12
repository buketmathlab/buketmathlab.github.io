-- =============================================================================
-- SEKİZ — 0016 ARŞİV TESTLERİ
--
-- Arşivlenen sınıf öğretmenin HİÇBİR listesinde görünmemeli ve o sınıfa yeni
-- gönderim kabul edilmemeli. Geri alındığında her şey aynen dönmeli.
--
-- Her grup, düzeltme geri alındığında GERÇEKTEN başarısız olacak şekilde
-- yazıldı; sayılar elle doğrulanabilir.
--
-- İZOLASYON: testler tek bir veritabanını paylaşıyor. Bu yüzden toplam
-- sayılara değil, "bu sınıf listede var mı" sorusuna bakıyoruz ve kendi
-- sınıfımızı (7Z) kuruyoruz — başka testlerin bıraktığı veri sonucu
-- değiştirmesin.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text;
  jo text;
  v_sinif uuid;
  v_ogr uuid;
  v_odev_acik uuid;
  v_odev_gecmis uuid;
  n integer;
  b boolean;
  v_hata text;
begin
  -- ---------------------------------------------------------------------------
  -- Hazırlık
  -- ---------------------------------------------------------------------------
  update public.ayarlar
     set ogretmen_pin_hash = extensions.crypt('Ars!v2026', extensions.gen_salt('bf', 10))
   where id = 1;
  jt := (public.giris('Ars!v2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (7, 'Z')
    on conflict (seviye, sube) do update set arsiv = false
    returning id into v_sinif;

  v_ogr := (public.ogrenci_ekle(jt, 'Arşiv Testi Öğrencisi', 'okul', v_sinif))->>'id';
  jo := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_ogr and rol = 'ogrenci')))->>'token';

  -- Biri süresi devam eden, biri geçmiş iki ödev: pano sayılarının dördünü
  -- de besleyebilmek için.
  v_odev_acik := (public.odev_olustur(jt, 'Arşiv — açık ödev', null, v_sinif, 'acik',
      (current_date + 5)::date, null, null, null, null, true, 5::smallint))->>'id';
  perform public.odev_yayinla(jt, v_odev_acik);

  v_odev_gecmis := (public.odev_olustur(jt, 'Arşiv — geçmiş ödev', null, v_sinif, 'test',
      (current_date - 3)::date, 2, '{"1":"A","2":"B"}'::jsonb, null, null, true, 5::smallint))->>'id';
  perform public.odev_yayinla(jt, v_odev_gecmis);

  -- ---------------------------------------------------------------------------
  -- 1 — ARŞİVLEMEDEN ÖNCE her yerde görünüyor (testin tabanı)
  --
  -- Bu grup olmadan "arşivden sonra görünmüyor" iddiası boş olurdu: sınıf
  -- zaten hiç görünmüyor olabilirdi.
  -- ---------------------------------------------------------------------------
  select count(*) into n from jsonb_array_elements(public.odevler_listesi(jt)) e
   where e->>'sinif' = '7Z';
  if n <> 2 then raise exception '1a: ödev listesinde 2 ödev beklenirken %', n; end if;

  select count(*) into n
    from jsonb_array_elements((public.ogrenciler_listesi(jt, null, null, 1, 100))->'kayitlar') e
   where e->>'sinif' = '7Z';
  if n <> 1 then raise exception '1b: öğrenci listesinde 1 öğrenci beklenirken %', n; end if;

  select count(*) into n
    from jsonb_array_elements((public.pano_detay(jt, 'ogrenci'))->'gruplar') e
   where e->>'sinif' = '7Z';
  if n <> 1 then raise exception '1c: pano(ogrenci) grubunda 7Z beklenirken %', n; end if;

  select count(*) into n
    from jsonb_array_elements((public.pano_detay(jt, 'acik_odev'))->'gruplar') e
   where e->>'sinif' = '7Z';
  if n <> 1 then raise exception '1d: pano(acik_odev) grubunda 7Z beklenirken %', n; end if;

  select count(*) into n
    from jsonb_array_elements((public.pano_detay(jt, 'gondermeyen'))->'gruplar') e
   where e->>'sinif' = '7Z';
  if n <> 1 then raise exception '1e: pano(gondermeyen) grubunda 7Z beklenirken %', n; end if;

  raise notice '1 OK — arşivlemeden önce sınıf her listede görünüyor';

  -- ---------------------------------------------------------------------------
  -- 2 — ARŞİVLE, sonra HİÇBİR listede olmamalı
  -- ---------------------------------------------------------------------------
  perform public.sinif_arsivle(jt, v_sinif, true);

  select count(*) into n from jsonb_array_elements(public.siniflar_listesi(jt)) e
   where e->>'ad' = '7Z';
  if n <> 0 then raise exception '2a: sınıf listesinde hâlâ 7Z var'; end if;

  select count(*) into n from jsonb_array_elements(public.odevler_listesi(jt)) e
   where e->>'sinif' = '7Z';
  if n <> 0 then raise exception '2b: ödev listesinde hâlâ % ödev var', n; end if;

  select count(*) into n
    from jsonb_array_elements((public.ogrenciler_listesi(jt, null, null, 1, 100))->'kayitlar') e
   where e->>'sinif' = '7Z';
  if n <> 0 then raise exception '2c: öğrenci listesinde hâlâ 7Z öğrencisi var'; end if;

  select count(*) into n
    from jsonb_array_elements((public.pano_detay(jt, 'ogrenci'))->'gruplar') e
   where e->>'sinif' = '7Z';
  if n <> 0 then raise exception '2d: pano(ogrenci) hâlâ 7Z gösteriyor'; end if;

  select count(*) into n
    from jsonb_array_elements((public.pano_detay(jt, 'acik_odev'))->'gruplar') e
   where e->>'sinif' = '7Z';
  if n <> 0 then raise exception '2e: pano(acik_odev) hâlâ 7Z gösteriyor'; end if;

  select count(*) into n
    from jsonb_array_elements((public.pano_detay(jt, 'gondermeyen'))->'gruplar') e
   where e->>'sinif' = '7Z';
  if n <> 0 then raise exception '2f: pano(gondermeyen) hâlâ 7Z gösteriyor'; end if;

  raise notice '2 OK — arşivden sonra sınıf hiçbir listede yok';

  -- ---------------------------------------------------------------------------
  -- 3 — Sınıf filtresi de arşivi delmiyor
  --
  -- Öğretmen ödev listesinde doğrudan o sınıfı seçse bile arşiv geçerli.
  -- Aksi hâlde "her yerde görünmez" kuralında bir delik kalırdı.
  -- ---------------------------------------------------------------------------
  -- İmza (p_token, p_sinif_id, p_yayinda) — sıra 0012'den beri böyle.
  select jsonb_array_length(public.odevler_listesi(jt, v_sinif, null)) into n;
  if n <> 0 then raise exception '3a: sınıf filtresiyle arşivdeki ödevler geldi (%)', n; end if;

  select jsonb_array_length((public.ogrenciler_listesi(jt, null, v_sinif, 1, 100))->'kayitlar')
    into n;
  if n <> 0 then raise exception '3b: sınıf filtresiyle arşivdeki öğrenciler geldi (%)', n; end if;

  raise notice '3 OK — sınıf filtresi arşivi delmiyor';

  -- ---------------------------------------------------------------------------
  -- 4 — ÖĞRENCİ arşivdeki sınıfa gönderim YAPAMIYOR
  -- ---------------------------------------------------------------------------
  begin
    perform public.odev_gonder(jo, v_odev_acik,
      'cozum/' || v_odev_acik::text || '/' || v_ogr::text || '.jpg', null);
    raise exception '4a: arşivdeki sınıfa gönderim KABUL EDİLDİ';
  exception
    when sqlstate '22023' then
      get stacked diagnostics v_hata = message_text;
      if v_hata not like '%kapat%' then
        raise exception '4a: beklenen arşiv hatası değil: %', v_hata;
      end if;
  end;

  -- Gerçekten hiç kayıt oluşmadı mı (hata yutulup satır yazılmış olmasın)
  select count(*) into n from public.gonderimler where odev_id = v_odev_acik;
  if n <> 0 then raise exception '4b: reddedilmesine rağmen % gönderim yazılmış', n; end if;

  raise notice '4 OK — arşivdeki sınıfa gönderim reddediliyor, kayıt oluşmuyor';

  -- ---------------------------------------------------------------------------
  -- 5 — Öğrenci ödevlerini GÖRMEYE devam ediyor, bayrak işaretli
  --
  -- Veri silinmiyor; öğrenci geçmişini görebilmeli. Arayüz "gönderemezsin"
  -- diyebilsin diye `sinif_arsiv` dolu geliyor.
  -- ---------------------------------------------------------------------------
  select jsonb_array_length((public.ogrenci_odevleri(jo))->'odevler') into n;
  if n <> 2 then raise exception '5a: öğrenci 2 ödev görmeliydi, % gördü', n; end if;

  select bool_and((e->>'sinif_arsiv')::boolean) into b
    from jsonb_array_elements((public.ogrenci_odevleri(jo))->'odevler') e;
  if not b then raise exception '5b: sinif_arsiv bayrağı işaretli değil'; end if;

  raise notice '5 OK — öğrenci geçmişini görüyor, sinif_arsiv işaretli';

  -- ---------------------------------------------------------------------------
  -- 6 — Kimlikle çağrılan iki uç BİLEREK açık (arşivden geri dönüş yolu)
  -- ---------------------------------------------------------------------------
  select jsonb_array_length((public.sinif_ogrencileri(jt, v_sinif))->'ogrenciler') into n;
  if n <> 1 then raise exception '6a: sınıf karnesi açılmıyor (% öğrenci)', n; end if;

  select jsonb_array_length((public.odev_gonderimleri(jt, v_odev_gecmis))->'satirlar') into n;
  if n <> 1 then raise exception '6b: gönderim ekranı açılmıyor (% satır)', n; end if;

  raise notice '6 OK — sınıf karnesi ve gönderim ekranı arşivde de açılıyor';

  -- ---------------------------------------------------------------------------
  -- 7 — GERİ AL: her şey aynen dönüyor, hiçbir veri kaybolmadı
  -- ---------------------------------------------------------------------------
  perform public.sinif_arsivle(jt, v_sinif, false);

  select count(*) into n from jsonb_array_elements(public.odevler_listesi(jt)) e
   where e->>'sinif' = '7Z';
  if n <> 2 then raise exception '7a: geri alındıktan sonra 2 ödev beklenirken %', n; end if;

  select count(*) into n
    from jsonb_array_elements((public.ogrenciler_listesi(jt, null, null, 1, 100))->'kayitlar') e
   where e->>'sinif' = '7Z';
  if n <> 1 then raise exception '7b: geri alındıktan sonra öğrenci dönmedi'; end if;

  select count(*) into n
    from jsonb_array_elements((public.pano_detay(jt, 'acik_odev'))->'gruplar') e
   where e->>'sinif' = '7Z';
  if n <> 1 then raise exception '7c: geri alındıktan sonra pano 7Z göstermiyor'; end if;

  -- Gönderim de artık kabul ediliyor
  perform public.odev_gonder(jo, v_odev_acik,
    'cozum/' || v_odev_acik::text || '/' || v_ogr::text || '.jpg', null);
  select count(*) into n from public.gonderimler where odev_id = v_odev_acik;
  if n <> 1 then raise exception '7d: geri alındıktan sonra gönderim kabul edilmedi'; end if;

  select bool_or((e->>'sinif_arsiv')::boolean) into b
    from jsonb_array_elements((public.ogrenci_odevleri(jo))->'odevler') e;
  if b then raise exception '7e: geri alındığı hâlde sinif_arsiv hâlâ true'; end if;

  raise notice '7 OK — geri alma her şeyi eski hâline getiriyor';

  -- ---------------------------------------------------------------------------
  -- 8 — SINIFSIZ ÖĞRENCİ DÜŞMÜYOR (NULL tuzağı)
  --
  -- `not s.arsiv` yazsaydık LEFT JOIN'de NULL çıkar ve sınıfa bağlanmamış
  -- özel ders öğrencisi listeden sessizce kaybolurdu.
  -- ---------------------------------------------------------------------------
  if public._sinif_arsivde(null) then
    raise exception '8a: _sinif_arsivde(null) true döndü';
  end if;

  declare
    v_sinifsiz uuid;
  begin
    insert into public.ogrenciler (ad, tur, sinif_id, aktif)
    values ('Sınıfsız Özel Öğrenci', 'ozel', null, true)
    returning id into v_sinifsiz;

    select count(*) into n
      from jsonb_array_elements((public.ogrenciler_listesi(jt, 'Sınıfsız Özel', null, 1, 100))->'kayitlar') e;
    if n <> 1 then raise exception '8b: sınıfsız öğrenci listeden düştü (% kayıt)', n; end if;

    delete from public.ogrenciler where id = v_sinifsiz;
  end;

  raise notice '8 OK — sınıfsız öğrenci arşiv süzgecinden etkilenmiyor';

  -- ---------------------------------------------------------------------------
  -- 9 — Özel ders grubu hâlâ arşivlenemiyor (0014 bozulmadı)
  -- ---------------------------------------------------------------------------
  begin
    perform public.sinif_arsivle(jt, (select id from public.siniflar where ozel), true);
    raise exception '9a: özel ders grubu arşivlendi';
  exception
    when sqlstate '22023' then null;
  end;

  raise notice '9 OK — özel ders grubu korumalı';

  -- ---------------------------------------------------------------------------
  -- 10 — DEĞİŞTİRİLEN FONKSİYONLARIN TEK İMZASI KALDI (0007 tuzağı)
  --
  -- PostgreSQL'de parametre eklemek ya da SIRASINI DEĞİŞTİRMEK yeni bir
  -- fonksiyon üretir; eski imza `grant`'iyle birlikte ayakta kalır. Arayüz
  -- adlandırılmış parametrelerle çağırdığı için iki aşırı yükleme varsa
  -- çağrı ya belirsiz kalır ya da SESSİZCE süzgeçsiz eski sürüme düşer.
  -- Bu tur taslakta tam olarak bu oldu; bir daha kaçmasın.
  -- ---------------------------------------------------------------------------
  select count(*) into n from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'odevler_listesi';
  if n <> 1 then
    raise exception '10a: odevler_listesi % imzayla duruyor, 1 olmalı', n;
  end if;

  if to_regprocedure('public.odevler_listesi(text, boolean, uuid)') is not null then
    raise exception '10b: yanlış sıralı odevler_listesi imzası hâlâ var';
  end if;

  select count(*) into n from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('odev_gonder', 'ogretmen_panosu', 'pano_detay',
                       'ogrenciler_listesi', 'ogrenci_odevleri');
  if n <> 5 then
    raise exception '10c: beş uçtan % imza var, aşırı yükleme oluşmuş', n;
  end if;

  -- Yardımcı öğrenciye/veliye kapalı olmalı.
  if has_function_privilege('anon', 'public._sinif_arsivde(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public._sinif_arsivde(uuid)', 'execute') then
    raise exception '10d: _sinif_arsivde anon/authenticated tarafından çağrılabiliyor';
  end if;

  raise notice '10 OK — tek imza, aşırı yükleme yok, yardımcı kapalı';

  raise notice '';
  raise notice 'ARŞİV TESTLERİ: 10 GRUP GEÇTİ';
end $$;
