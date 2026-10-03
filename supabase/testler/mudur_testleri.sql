-- =============================================================================
-- SEKİZ — 0060: MÜDÜR HESABI (salt izleme)
--
--  1. Müdür PIN'iyle giriş 'mudur' rolü döndürüyor.
--  2. Pano: sınıflar ve öğretmenler; sayılar doğru; özel ders grubu ve
--     arşiv yok; ÖĞRENCİ ADI HİÇBİR YERDE YOK; müdür öğretmen listesinde yok.
--  3. Sınıf analizi müdürde öğretmeninkiyle BİREBİR aynı; onam dökümü
--     açılıyor ve "alan" müdür.
--  4. Özel ders grubu müdüre kapalı.
--  5. SALT OKUMA: istemcinin çağırabildiği BÜTÜN token'lı uçlar müdür
--     jetonuyla çağrılıyor; üç okuma ucu dışında hepsi reddediyor
--     (dosya_erisim_izni "hayır" diyor). Yeni bir uç eklenip müdüre
--     yanlışlıkla açılırsa bu grup bağırır.
--  6. Müdüre sınıf atanamıyor, müdür hesabına vekâletle girilemiyor.
--  7. Pasifleştirilen müdürün jetonu düşüyor.
--  8. Yalnız sahip müdür ekleyebiliyor; aynı PIN reddediliyor.
--
-- İZOLASYON: kendi sınıflarını kuruyor (12MA, 12MB); tekrar çalıştırılınca
-- önceki koşunun öğrencileri pasif, ödevleri yayın dışı bırakılıyor.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text; jb text; jm text;
  v_ben uuid; v_baris uuid; v_mudur uuid;
  s_m uuid; s_n uuid; s_ozel uuid;
  a1 uuid; a2 uuid; a3 uuid;
  o_odev uuid;
  v jsonb; satir jsonb; t jsonb; m jsonb;
  ek text := to_char(clock_timestamp(), 'HH24MISSUS');
  r record; cagri text; patladi boolean; durum text;
  -- `cikis` müdüre de açık (kendi oturumunu kapatır) — ve döngüde çağrılsaydı
  -- jetonu düşürüp sonraki bütün uçları "oturum geçersiz"le geçirirdi.
  izinli text[] := array['mudur_paneli', 'sinif_analizi', 'onam_dokumu', 'cikis'];
  acik text[] := '{}';
  sayi integer := 0;
begin
  -- ---------------------------------------------------------------------------
  -- Hazırlık
  -- ---------------------------------------------------------------------------
  update public.ogretmenler
     set pin_hash = extensions.crypt('Mudur!Sahip26', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Mudur!Sahip26'))->>'token';
  select id into v_ben from public.ogretmenler where yonetici;

  if not exists (select 1 from public.ogretmenler where ad = 'Barış Müdürtest') then
    perform public.ogretmen_ekle(jt, 'Barış Müdürtest', 'MudurBaris!26');
  end if;
  select id into v_baris from public.ogretmenler where ad = 'Barış Müdürtest';
  jb := (public.giris('MudurBaris!26'))->>'token';

  s_m := (public.sinif_ekle(jt, 12::smallint, 'MA'))->>'id';
  s_n := (public.sinif_ekle(jt, 12::smallint, 'MB'))->>'id';
  update public.ogrenciler set aktif = false where sinif_id = s_m;
  update public.odevler set yayinda = false where sinif_id = s_m;
  perform public.ogretmen_sinif_ata(jt, v_baris, jsonb_build_array(s_n::text));
  select id into s_ozel from public.siniflar where ozel limit 1;

  a1 := (public.ogrenci_ekle(jt, 'Gizli Ogrenci Bir ' || ek, 'okul', s_m))->>'id';
  a2 := (public.ogrenci_ekle(jt, 'Gizli Ogrenci Iki ' || ek, 'okul', s_m))->>'id';
  a3 := (public.ogrenci_ekle(jt, 'Gizli Ozel ' || ek, 'ozel', null))->>'id';

  -- 12MA'da süresi DOLMUŞ, yayında bir ödev; iki öğrenciden biri gönderdi (80).
  o_odev := (public.odev_olustur(jt, 'Müdür testi ödevi', null, s_m, 'test',
              (current_date + 3)::date, 5, '{"1":"A","2":"B","3":"C","4":"D","5":"E"}'::jsonb,
              null, null, true, 5::smallint, '{"1":"Sayılar"}'::jsonb))->>'id';
  perform public.odev_yayinla(jt, o_odev);
  perform public.odev_gonder(
    (public.giris((select kod from public.giris_kodlari where ogrenci_id = a1 and rol = 'ogrenci')))->>'token',
    o_odev, 'cozum/' || o_odev::text || '/' || a1::text || '.jpg',
    '{"1":"A","2":"B","3":"C","4":"D","5":"A"}'::jsonb);
  update public.odevler set son_tarih = current_date - 1 where id = o_odev;

  -- Müdür
  if not exists (select 1 from public.ogretmenler where ad = 'Müdür Test') then
    perform public.mudur_ekle(jt, 'Müdür Test', 'Mudur!Okul26');
  end if;
  select id into v_mudur from public.ogretmenler where ad = 'Müdür Test';

  -- ---------------------------------------------------------------------------
  -- 1. GİRİŞ
  -- ---------------------------------------------------------------------------
  v := public.giris('Mudur!Okul26');
  if v->>'rol' <> 'mudur' or v->>'token' is null then
    raise exception '1: müdür girişi: %', v;
  end if;
  jm := v->>'token';
  raise notice '1 OK — müdür PIN''i "mudur" rolüyle oturum açıyor';

  -- ---------------------------------------------------------------------------
  -- 2. PANO
  -- ---------------------------------------------------------------------------
  v := public.mudur_paneli(jm);
  if v->>'ad' <> 'Müdür Test' then raise exception '2a: ad %', v->>'ad'; end if;
  select e into satir from jsonb_array_elements(v->'siniflar') e where e->>'id' = s_m::text;
  if satir is null then raise exception '2b: 12MA panoda yok'; end if;
  if (satir->>'ogrenci_sayisi')::int <> 2 or (satir->>'odev_sayisi')::int <> 1
     or (satir->>'suresi_dolan')::int <> 1 or (satir->>'gonderim_orani')::int <> 50
     or (satir->>'ortalama')::numeric <> 80 then
    raise exception '2c: 12MA sayıları yanlış: %', satir;
  end if;
  if exists (select 1 from jsonb_array_elements(v->'siniflar') e where e->>'id' = s_ozel::text) then
    raise exception '2d: özel ders grubu panoda';
  end if;
  select e into satir from jsonb_array_elements(v->'siniflar') e where e->>'id' = s_n::text;
  if satir is null or not (satir->'ogretmenler' ? 'Barış Müdürtest') then
    raise exception '2e: 12MB öğretmeni yok: %', satir;
  end if;
  if v::text like '%Gizli Ogrenci%' or v::text like '%Gizli Ozel%' then
    raise exception '2f: panoda ÖĞRENCİ ADI var';
  end if;
  if exists (select 1 from jsonb_array_elements(v->'ogretmenler') e where e->>'ad' = 'Müdür Test') then
    raise exception '2g: müdür kendini öğretmen listesinde görüyor';
  end if;
  select e into t from jsonb_array_elements(v->'ogretmenler') e where e->>'ad' = 'Barış Müdürtest';
  if t is null or not (t->'siniflar' ? '12MB') then
    raise exception '2h: öğretmen etkinliği eksik: %', t;
  end if;
  raise notice '2 OK — pano: 12MA 2 öğrenci, 1 ödev, %%50 gönderim, ort. 80; özel ders yok; öğrenci adı yok';

  -- ---------------------------------------------------------------------------
  -- 3. SINIF ANALİZİ VE ONAM DÖKÜMÜ
  -- ---------------------------------------------------------------------------
  t := public.sinif_analizi(jt, s_m);
  m := public.sinif_analizi(jm, s_m);
  if t <> m then raise exception '3a: müdürün analizi öğretmeninkinden farklı'; end if;
  if m::text like '%Gizli Ogrenci%' then raise exception '3b: analizde öğrenci adı'; end if;
  m := public.onam_dokumu(jm, s_n);
  if m->>'alan' <> 'Müdür Test' or (m->>'toplam')::int < 0 then
    raise exception '3c: onam dökümü: %', m->>'alan';
  end if;
  raise notice '3 OK — sınıf analizi öğretmeninkiyle birebir; onam dökümü açılıyor (alan: Müdür Test)';

  -- ---------------------------------------------------------------------------
  -- 4. ÖZEL DERS KAPALI
  -- ---------------------------------------------------------------------------
  patladi := false;
  begin
    perform public.sinif_analizi(jm, s_ozel);
  exception when sqlstate '42501' then patladi := true;
  end;
  if not patladi then raise exception '4: özel ders grubu müdüre açık'; end if;
  raise notice '4 OK — özel ders grubu müdüre kapalı';

  -- ---------------------------------------------------------------------------
  -- 5. SALT OKUMA — BÜTÜN UÇLAR
  --
  -- İstemcinin çağırabildiği (anon EXECUTE), ilk parametresi `p_token` olan
  -- her uç müdür jetonuyla, diğer parametreler NULL çağrılıyor. Beklenen
  -- YALNIZ 42501 (yetki): 28000 kabul edilmiyor, çünkü jeton geçerli olmalı —
  -- "oturum geçersiz" ölçümü sessizce boşa çıkarırdı. dosya_erisim_izni
  -- "false" dönmeli.
  -- ---------------------------------------------------------------------------
  for r in
    select p.proname, p.oid, pg_get_function_identity_arguments(p.oid) as imza,
           (select array_agg(format_type(x, null) order by n)
              from unnest(p.proargtypes) with ordinality as a(x, n)) as tipler
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.prokind = 'f'
       and has_function_privilege('anon', p.oid, 'execute')
       and p.proargnames[1] = 'p_token'
       and not (p.proname = any(izinli))
     order by p.proname
  loop
    cagri := format('select public.%I(%s)', r.proname,
      (select string_agg(case when n = 1 then quote_literal(jm) || '::text'
                              else 'null::' || tip end, ', ' order by n)
         from unnest(r.tipler) with ordinality as a(tip, n)));
    sayi := sayi + 1;
    begin
      execute cagri into durum;
      if r.proname = 'dosya_erisim_izni' and durum = 'false' then
        continue;
      end if;
      acik := acik || (r.proname || ' → ' || coalesce(durum, 'null'));
    exception
      when sqlstate '42501' then null;
      when others then
        acik := acik || (r.proname || ' → ' || sqlstate || ' ' || sqlerrm);
    end;
  end loop;
  if array_length(acik, 1) > 0 then
    raise exception '5: müdüre açık ya da yetkiden ÖNCE başka hata veren uçlar (% uçtan): %',
      sayi, array_to_string(acik, ' | ');
  end if;
  -- Jeton döngü boyunca geçerli kaldı mı? (Ölçüm boşa çıkmadı mı?)
  perform public.mudur_paneli(jm);
  raise notice '5 OK — % token''lı uç müdür jetonunu yetkiyle (42501) reddediyor; açık olan yalnız 3 okuma ucu ve çıkış', sayi;

  -- ---------------------------------------------------------------------------
  -- 6. SINIF ATAMA VE VEKÂLET
  -- ---------------------------------------------------------------------------
  patladi := false;
  begin
    perform public.ogretmen_sinif_ata(jt, v_mudur, jsonb_build_array(s_m::text));
  exception when sqlstate '22023' then patladi := true;
  end;
  if not patladi then raise exception '6a: müdüre sınıf atandı'; end if;
  patladi := false;
  begin
    perform public.ogretmen_olarak_gir(jt, v_mudur);
  exception when sqlstate '42501' then patladi := true;
  end;
  if not patladi then raise exception '6b: müdür hesabına vekâletle girildi'; end if;
  if exists (select 1 from jsonb_array_elements(public._ogrencinin_ogretmenleri(a1)) e
              where (e->>'id')::uuid = v_mudur) then
    raise exception '6c: müdür velinin mesaj listesinde';
  end if;
  raise notice '6 OK — müdüre sınıf atanamıyor, vekâlet yok, mesaj listesinde değil';

  -- ---------------------------------------------------------------------------
  -- 8. YALNIZ SAHİP EKLER; AYNI PIN YOK
  -- ---------------------------------------------------------------------------
  patladi := false;
  begin
    perform public.mudur_ekle(jb, 'Kaçak Müdür', 'Kacak!Mudur26');
  exception when sqlstate '42501' then patladi := true;
  end;
  if not patladi then raise exception '8a: öğretmen müdür ekledi'; end if;
  patladi := false;
  begin
    perform public.mudur_ekle(jt, 'İkinci Müdür', 'MudurBaris!26');
  exception when sqlstate '22023' then patladi := true;
  end;
  if not patladi then raise exception '8b: başkasının PIN''iyle müdür eklendi'; end if;
  raise notice '8 OK — müdürü yalnız sahip ekliyor; kullanılan PIN reddediliyor';

  -- ---------------------------------------------------------------------------
  -- 7. PASİFLEŞTİRİLEN MÜDÜR (en sonda: hesabı kapatıyor)
  -- ---------------------------------------------------------------------------
  perform public.ogretmen_guncelle(jt, v_mudur, null, false);
  patladi := false;
  begin
    perform public.mudur_paneli(jm);
  exception when sqlstate '28000' then patladi := true;
  end;
  if not patladi then raise exception '7: pasif müdürün jetonu çalışıyor'; end if;
  update public.ogretmenler set aktif = true where id = v_mudur;
  raise notice '7 OK — pasifleştirilen müdürün oturumu düşüyor';
end $$;

select 'MÜDÜR TESTLERİ GEÇTİ' as sonuc;
