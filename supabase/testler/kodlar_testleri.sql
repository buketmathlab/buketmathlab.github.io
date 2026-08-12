-- =============================================================================
-- SEKİZ — KODLAR TESTLERİ (0017 kaldırıldı, 0018 sonrası)
--
-- Kodlar bir kimlik bilgisi. Bu dosyanın asıl işi "çalışıyor mu" değil,
-- "SIZDIRIYOR MU" sorusuna cevap vermek.
--
-- KURAL: kod yalnız `ogrenci_kodlari(p_token, p_id)` ile, ÖĞRENCİ BAŞINA
-- gelir. Bir sınıfın tümünü döndüren uç YOK — 0017'de yazılmıştı, öğretmenin
-- "bir öğrenciye gösterirken diğerlerininki görünmesin" isteği üzerine 0018
-- ile kaldırıldı. Toplu indirip arayüzde gizlemek, kodları ağ yanıtında ve
-- bellekte bırakırdı.
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
  kod_a text;
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
  -- 1 — TOPLU KOD UCU ARTIK YOK
  --
  -- Bu grubun tek işi bir şeyin OLMADIĞINI kanıtlamak: kullanılmayan bir uç
  -- sessizce geri gelirse burada patlar.
  -- ---------------------------------------------------------------------------
  if to_regprocedure('public.sinif_kodlari(text, uuid)') is not null then
    raise exception '1a: sinif_kodlari hâlâ duruyor; toplu kod ucu kaldırılmalıydı';
  end if;

  -- Yerine geçen uç yerinde mi (ikisini birden kaybetmiş olmayalım)
  if to_regprocedure('public.ogrenci_kodlari(text, uuid)') is null then
    raise exception '1b: ogrenci_kodlari yok; kod gösterecek uç kalmadı';
  end if;

  -- Bir sınıfın tümünü döndüren BAŞKA bir uç da olmasın
  select count(*) into n from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname like '%kodlari%';
  if n <> 1 then
    raise exception '1c: kod döndüren % fonksiyon var, yalnız ogrenci_kodlari olmalı', n;
  end if;

  raise notice '1 OK — toplu kod ucu yok, tek yol ogrenci_kodlari';

  -- ---------------------------------------------------------------------------
  -- 2 — Öğretmen TEK öğrencinin kodunu alabiliyor ve kodlar DOĞRU
  --
  -- "Bir şey döndü" yetmez: yanlış eşleşen bir kod, öğrenciye başkasının
  -- hesabını vermek demek.
  -- ---------------------------------------------------------------------------
  v := public.ogrenci_kodlari(jt, v_a);

  if v->>'ogrenci' is null or v->>'veli' is null then
    raise exception '2a: iki kod da dönmeliydi: %', v;
  end if;

  select count(*) into n from public.giris_kodlari k
   where k.ogrenci_id = v_a
     and ((k.rol = 'ogrenci' and k.kod = v->>'ogrenci')
       or (k.rol = 'veli'    and k.kod = v->>'veli'));
  if n <> 2 then
    raise exception '2b: dönen kodlar giris_kodlari ile eşleşmiyor (eşleşen %)', n;
  end if;

  -- Yanıtta SADECE o öğrencinin kodları var; Beste'ninki sızmıyor
  kod_a := (select kod from public.giris_kodlari
             where ogrenci_id = v_b and rol = 'ogrenci');
  if position(kod_a in v::text) > 0 then
    raise exception '2c: BAŞKA öğrencinin kodu yanıtta geçiyor';
  end if;

  raise notice '2 OK — tek öğrencinin kodu doğru dönüyor, başkasınınki sızmıyor';

  -- ---------------------------------------------------------------------------
  -- 3 — PASİF öğrencinin kodu yok
  -- ---------------------------------------------------------------------------
  perform public.ogrenci_pasiflestir(jt, v_pasif);

  select count(*) into n from public.giris_kodlari where ogrenci_id = v_pasif;
  if n <> 0 then raise exception '3a: pasif öğrencinin kodları silinmemiş'; end if;

  v := public.ogrenci_kodlari(jt, v_pasif);
  if v <> '{}'::jsonb then
    raise exception '3b: pasif öğrenci için kod döndü: %', v;
  end if;

  raise notice '3 OK — pasif öğrencinin kodu yok, uç boş dönüyor';

  -- ---------------------------------------------------------------------------
  -- 4 — ÖĞRENCİ VE VELİ BU UCU ÇAĞIRAMAZ (asıl sızıntı testi)
  --
  -- Çağırabilseydi bir öğrenci sınıf arkadaşlarının ve velilerinin hesabını
  -- ele geçirirdi.
  -- ---------------------------------------------------------------------------
  begin
    perform public.ogrenci_kodlari(jo, v_b);
    raise exception '4a: ÖĞRENCİ başkasının kodunu aldı';
  exception
    when sqlstate '42501' then null;
  end;

  -- Kendi kodunu bile bu uçtan alamamalı: uç öğretmene ait
  begin
    perform public.ogrenci_kodlari(jo, v_a);
    raise exception '4b: ÖĞRENCİ kendi kodunu öğretmen ucundan aldı';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    perform public.ogrenci_kodlari(jv, v_a);
    raise exception '4c: VELİ kod ucunu çağırdı';
  exception
    when sqlstate '42501' then null;
  end;

  raise notice '4 OK — öğrenci ve veli kod ucunu hiçbir şekilde çağıramıyor';

  -- ---------------------------------------------------------------------------
  -- 5 — LİSTE UÇLARI KOD TAŞIMIYOR
  --
  -- Ekran öğrenci listesini çekiyor; o yanıt kod taşısaydı sınıf açılır
  -- açılmaz bütün kodlar tarayıcıya inerdi — tam da kaçındığımız şey.
  -- ALAN ADINA bakıyoruz: bir öğrencinin adı "Kodaman" olsaydı ham metin
  -- araması boş yere patlardı.
  -- ---------------------------------------------------------------------------
  s := public.ogrenciler_listesi(jt, null, v_sinif, 1, 100)::text;
  if s like '%"kod%' or s like '%_kodu"%' then
    raise exception '5a: ogrenciler_listesi kod alanı taşıyor: %', left(s, 200);
  end if;

  -- Gerçek kodun DEĞERİ de geçmemeli
  if position((select kod from public.giris_kodlari
                where ogrenci_id = v_a and rol = 'ogrenci') in s) > 0 then
    raise exception '5b: gerçek kod öğrenci listesinde geçiyor';
  end if;

  s := public.sinif_ogrencileri(jt, v_sinif)::text;
  if s like '%"kod%' or s like '%_kodu"%' then
    raise exception '5c: sinif_ogrencileri kod alanı taşıyor';
  end if;

  s := public.pano_detay(jt, 'ogrenci')::text;
  if s like '%"kod%' or s like '%_kodu"%' then
    raise exception '5d: pano_detay kod alanı taşıyor';
  end if;

  -- Denetimin GERÇEKTEN çalıştığı: aynı süzgeç kod ucunda patlamalı.
  -- Yoksa 5. grup her zaman geçen boş bir kontrol olurdu.
  s := public.ogrenci_kodlari(jt, v_a)::text;
  if not (s like '%"ogrenci"%') then
    raise exception '5e: denetim işe yaramıyor — kod ucu bile kod göstermedi';
  end if;

  raise notice '5 OK — liste uçları kod taşımıyor, denetimin kendisi çalışıyor';

  -- ---------------------------------------------------------------------------
  -- 6 — Olmayan öğrenci sessizce boş dönüyor, hata değil
  --
  -- Ekran silinmiş bir öğrenciye dokunursa çökmemeli.
  -- ---------------------------------------------------------------------------
  v := public.ogrenci_kodlari(jt, '00000000-0000-0000-0000-000000000000'::uuid);
  if v <> '{}'::jsonb then
    raise exception '6a: olmayan öğrenci için kod döndü: %', v;
  end if;

  raise notice '6 OK — olmayan öğrencide boş yanıt, çökme yok';

  raise notice '';
  raise notice 'KODLAR TESTLERİ: 6 GRUP GEÇTİ';
end $$;
