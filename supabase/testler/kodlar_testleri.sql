-- =============================================================================
-- SEKİZ — 0017 KODLAR TESTLERİ
--
-- Kodlar bir kimlik bilgisi. Bu dosyanın asıl işi "çalışıyor mu" değil,
-- "SIZDIRIYOR MU" sorusuna cevap vermek.
--
-- İZOLASYON: testler tek veritabanını paylaşıyor; kendi sınıfımızı (8K)
-- kuruyoruz ve toplam sayılara değil kendi kayıtlarımıza bakıyoruz.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text;
  jo text;
  jv text;
  v_sinif uuid;
  v_a uuid;
  v_b uuid;
  v_pasif uuid;
  v jsonb;
  n integer;
  s text;
begin
  -- ---------------------------------------------------------------------------
  -- Hazırlık
  -- ---------------------------------------------------------------------------
  update public.ayarlar
     set ogretmen_pin_hash = extensions.crypt('Kod!2026', extensions.gen_salt('bf', 10))
   where id = 1;
  jt := (public.giris('Kod!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (8, 'K')
    on conflict (seviye, sube) do update set arsiv = false
    returning id into v_sinif;

  v_a := (public.ogrenci_ekle(jt, 'Ali Yılmaz', 'okul', v_sinif))->>'id';
  v_b := (public.ogrenci_ekle(jt, 'Beste Aydın', 'okul', v_sinif))->>'id';
  v_pasif := (public.ogrenci_ekle(jt, 'Cem Şahin', 'okul', v_sinif))->>'id';

  jo := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_a and rol = 'ogrenci')))->>'token';
  jv := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_a and rol = 'veli')))->>'token';

  -- ---------------------------------------------------------------------------
  -- 1 — Öğretmen sınıfın kodlarını topluca alabiliyor
  -- ---------------------------------------------------------------------------
  v := public.sinif_kodlari(jt, v_sinif);

  if v->'sinif'->>'ad' <> '8K' then
    raise exception '1a: sınıf adı 8K değil: %', v->'sinif'->>'ad';
  end if;

  select jsonb_array_length(v->'ogrenciler') into n;
  if n <> 3 then raise exception '1b: 3 öğrenci beklenirken %', n; end if;

  -- Sıralama ada göre: Ali, Beste, Cem
  if (v->'ogrenciler'->0->>'ad') <> 'Ali Yılmaz' then
    raise exception '1c: ada göre sıralı değil: %', v->'ogrenciler'->0->>'ad';
  end if;

  raise notice '1 OK — sınıfın kodları tek çağrıda, ada göre sıralı';

  -- ---------------------------------------------------------------------------
  -- 2 — Dönen kodlar GERÇEKTEN o öğrencinin kodları
  --
  -- "Bir şey döndü" yetmez: yanlış eşleşen bir kod, öğrenciye başkasının
  -- hesabını vermek demek. giris_kodlari ile birebir karşılaştırılıyor.
  -- ---------------------------------------------------------------------------
  select count(*) into n
  from jsonb_array_elements(v->'ogrenciler') e
  join public.giris_kodlari ko
    on ko.ogrenci_id = (e->>'id')::uuid and ko.rol = 'ogrenci'
   and ko.kod = e->>'ogrenci_kodu'
  join public.giris_kodlari kv
    on kv.ogrenci_id = (e->>'id')::uuid and kv.rol = 'veli'
   and kv.kod = e->>'veli_kodu';
  if n <> 3 then
    raise exception '2a: 3 öğrencinin de iki kodu eşleşmeliydi, eşleşen %', n;
  end if;

  -- Ali'nin kodu Beste'ye verilmiş olmasın
  if (v->'ogrenciler'->0->>'ogrenci_kodu') = (v->'ogrenciler'->1->>'ogrenci_kodu') then
    raise exception '2b: iki öğrenciye aynı kod döndü';
  end if;

  raise notice '2 OK — her kod doğru öğrenciye ait, kodlar birbirinden farklı';

  -- ---------------------------------------------------------------------------
  -- 3 — PASİF öğrenci listede yok (kodları da silinmiş olmalı)
  -- ---------------------------------------------------------------------------
  perform public.ogrenci_pasiflestir(jt, v_pasif);

  v := public.sinif_kodlari(jt, v_sinif);
  select jsonb_array_length(v->'ogrenciler') into n;
  if n <> 2 then raise exception '3a: pasiften sonra 2 beklenirken %', n; end if;

  select count(*) into n
  from jsonb_array_elements(v->'ogrenciler') e where (e->>'id')::uuid = v_pasif;
  if n <> 0 then raise exception '3b: pasif öğrenci hâlâ listede'; end if;

  select count(*) into n from public.giris_kodlari where ogrenci_id = v_pasif;
  if n <> 0 then raise exception '3c: pasif öğrencinin kodları silinmemiş'; end if;

  raise notice '3 OK — pasif öğrenci listede yok, kodları silinmiş';

  -- ---------------------------------------------------------------------------
  -- 4 — ÖĞRENCİ VE VELİ BU UCU ÇAĞIRAMAZ (asıl sızıntı testi)
  --
  -- Çağırabilseydi bir öğrenci tüm sınıf arkadaşlarının ve velilerinin
  -- hesabını ele geçirirdi.
  -- ---------------------------------------------------------------------------
  begin
    perform public.sinif_kodlari(jo, v_sinif);
    raise exception '4a: ÖĞRENCİ sınıfın kodlarını aldı';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    perform public.sinif_kodlari(jv, v_sinif);
    raise exception '4b: VELİ sınıfın kodlarını aldı';
  exception
    when sqlstate '42501' then null;
  end;

  -- Tek öğrenci ucu da kapalı kalmalı (0004'teki kural bozulmadı)
  begin
    perform public.ogrenci_kodlari(jo, v_b);
    raise exception '4c: öğrenci başkasının kodunu aldı';
  exception
    when sqlstate '42501' then null;
  end;

  raise notice '4 OK — öğrenci ve veli kod uçlarının hiçbirini çağıramıyor';

  -- ---------------------------------------------------------------------------
  -- 5 — LİSTE UÇLARI KOD TAŞIMIYOR
  --
  -- Kodların tek çıkış kapısı kod uçları olmalı. Bir liste ucu kolaylık
  -- olsun diye kod eklerse, ekran açılır açılmaz bütün kodlar ağdan geçer.
  -- ---------------------------------------------------------------------------
  -- ALAN ADINA bakıyoruz, "kod" geçen her metne değil: bir öğrencinin adı
  -- "Kodaman" olsaydı ham metin araması boş yere patlardı.
  s := public.ogrenciler_listesi(jt, null, v_sinif, 1, 100)::text;
  if s like '%"kod%' or s like '%_kodu"%' then
    raise exception '5a: ogrenciler_listesi kod alanı taşıyor: %', left(s, 200);
  end if;

  s := public.sinif_ogrencileri(jt, v_sinif)::text;
  if s like '%"kod%' or s like '%_kodu"%' then
    raise exception '5b: sinif_ogrencileri kod alanı taşıyor';
  end if;

  s := public.pano_detay(jt, 'ogrenci')::text;
  if s like '%"kod%' or s like '%_kodu"%' then
    raise exception '5c: pano_detay kod alanı taşıyor';
  end if;

  -- Gerçek bir kodun metni yanıtlarda geçmemeli (alan adı değil, DEĞER)
  s := public.ogrenciler_listesi(jt, null, v_sinif, 1, 100)::text;
  if position((select kod from public.giris_kodlari
                where ogrenci_id = v_a and rol = 'ogrenci') in s) > 0 then
    raise exception '5d: gerçek kod öğrenci listesinde geçiyor';
  end if;

  -- Aynı denetimin sinif_kodlari'nda GERÇEKTEN patladığını görüyoruz:
  -- yoksa 5. grup her zaman geçen boş bir kontrol olurdu.
  s := public.sinif_kodlari(jt, v_sinif)::text;
  if not (s like '%_kodu"%') then
    raise exception '5e: denetim işe yaramıyor — sinif_kodlari bile kod alanı göstermedi';
  end if;

  raise notice '5 OK — liste uçları kod taşımıyor, gerçek kod sızmıyor, denetim çalışıyor';

  -- ---------------------------------------------------------------------------
  -- 6 — Olmayan sınıf reddediliyor
  -- ---------------------------------------------------------------------------
  begin
    perform public.sinif_kodlari(jt, '00000000-0000-0000-0000-000000000000'::uuid);
    raise exception '6a: olmayan sınıf kabul edildi';
  exception
    when sqlstate 'P0002' then null;
  end;

  raise notice '6 OK — olmayan sınıf reddediliyor';

  -- ---------------------------------------------------------------------------
  -- 7 — Tek imza, aşırı yükleme yok (0007 tuzağı)
  -- ---------------------------------------------------------------------------
  select count(*) into n from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'sinif_kodlari';
  if n <> 1 then raise exception '7a: sinif_kodlari % imzayla duruyor', n; end if;

  if not has_function_privilege('anon', 'public.sinif_kodlari(text, uuid)', 'execute') then
    raise exception '7b: anon çağıramıyor; arayüz bu ucu kullanamaz';
  end if;

  raise notice '7 OK — tek imza, anon rolüne açık (jeton denetimi içeride)';

  raise notice '';
  raise notice 'KODLAR TESTLERİ: 7 GRUP GEÇTİ';
end $$;
