-- =============================================================================
-- SEKİZ — 0060: MÜDÜR HESABI (salt izleme)
--
--  1. Müdür PIN'iyle giriş 'mudur' rolü döndürüyor; son girişi sahibin
--     Öğretmenler listesinde görünüyor.
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
--  9. (0061) Müdür kendi PIN'ini değiştiriyor: yanlış eski PIN, başkasının
--     PIN'i, kısa PIN reddediliyor; öğretmen jetonu bu uca giremiyor;
--     değişince diğer oturumları düşüyor.
-- 10. (0061) Soru toplamları: şube, seviye ve okul toplamları birbirini
--     tutuyor; soru sayısız ödev ayrı sayılıyor; aylık ödev sayıları
--     eğitim yılındaki ödevlerle aynı.
-- 11. (0061) Not çizelgesi: her öğrencinin ortalaması ve yapılan/yapılmayan
--     sayısı `sinif_ogrenci_ozeti` ile BİREBİR; puan durumları doğru;
--     cevap/yorum/dosya yolu yok; özel ders ve başkasının sınıfı kapalı.
-- 12. (0062) Sahip müdür ekranını KENDİ oturumuyla önizliyor: aynı sınıflar,
--     `onizleme` işaretli; kendisine atanmamış sınıfın çizelgesini açıyor.
--     Sıradan öğretmen ve sahibin vekâlet oturumu giremiyor.
-- 13. (0063) Ortak sınıf sayfası: öğretmen kipinde sayılar
--     `sinif_ogrencileri` ile birebir; ödev kapsamı role göre (öğretmen
--     yalnız erişebildiklerini, müdür ve sahip önizlemesi hepsini görüyor);
--     öğretmenin kartları müdürünkiyle aynı yardımcıdan; seviyelere göre
--     zorlanılan konular; konu_karnesi erişim açığı kapalı.
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
  o_odev uuid; o2 uuid; o3 uuid;
  jm2 text; beklenen integer; oz jsonb; cz jsonb; jv text; o_baris uuid; o_konu uuid; konu_ad text;
  v jsonb; satir jsonb; t jsonb; m jsonb;
  ek text := to_char(clock_timestamp(), 'HH24MISSUS');
  r record; cagri text; patladi boolean; durum text;
  -- `cikis` müdüre de açık (kendi oturumunu kapatır) — ve döngüde çağrılsaydı
  -- jetonu düşürüp sonraki bütün uçları "oturum geçersiz"le geçirirdi.
  izinli text[] := array['mudur_paneli', 'sinif_analizi', 'onam_dokumu', 'cikis',
                          'mudur_pin_degistir', 'sinif_not_cizelgesi'];
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
  update public.odevler set yayinda = false where sinif_id in (s_m, s_n);
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
  -- SON GİRİŞ: sahip, Öğretmenler ekranında müdürün son girişini de
  -- öğretmenlerinki gibi görmeli (`_oturum` → `son_gorulme`). Oturum
  -- açılışı zaten bir tarih yazıyor; ölçüm boşa çıkmasın diye o tarih
  -- iki gün geriye çekiliyor ve müdürün sonraki kullanımıyla güncellenmesi
  -- bekleniyor.
  update public.oturumlar set son_gorulme = now() - interval '2 days'
   where rol = 'mudur' and ogretmen_id = v_mudur;
  perform public.mudur_paneli(jm);
  select e into t from jsonb_array_elements(public.ogretmenler_listesi(jt)) e
   where (e->>'id')::uuid = v_mudur;
  if t is null or not (t->>'mudur')::boolean or t->>'son_gorulme' is null
     or (t->>'son_gorulme')::timestamptz < now() - interval '1 minute' then
    raise exception '1b: müdürün son girişi Öğretmenler listesinde yok: %', t;
  end if;
  raise notice '1 OK — müdür PIN''i "mudur" rolüyle oturum açıyor; son girişi sahibin listesinde görünüyor';

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
  raise notice '5 OK — % token''lı uç müdür jetonunu yetkiyle (42501) reddediyor; açık olan yalnız 4 okuma ucu, kendi PIN''i ve çıkış', sayi;

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
  -- 9. MÜDÜR KENDİ PIN'İNİ DEĞİŞTİRİR (0061)
  -- ---------------------------------------------------------------------------
  jm2 := (public.giris('Mudur!Okul26'))->>'token';
  patladi := false;
  begin
    perform public.mudur_pin_degistir(jm, 'yanlis-pin', 'Mudur!Yeni26');
  exception when sqlstate '28000' then patladi := true;
  end;
  if not patladi then raise exception '9a: yanlış eski PIN kabul edildi'; end if;
  patladi := false;
  begin
    perform public.mudur_pin_degistir(jm, 'Mudur!Okul26', 'MudurBaris!26');
  exception when sqlstate '22023' then patladi := true;
  end;
  if not patladi then raise exception '9b: başkasının PIN''i kabul edildi'; end if;
  patladi := false;
  begin
    perform public.mudur_pin_degistir(jm, 'Mudur!Okul26', '12345');
  exception when sqlstate '22023' then patladi := true;
  end;
  if not patladi then raise exception '9c: kısa PIN kabul edildi'; end if;
  patladi := false;
  begin
    perform public.mudur_pin_degistir(jt, 'Mudur!Sahip26', 'Sahip!Yeni26');
  exception when sqlstate '42501' then patladi := true;
  end;
  if not patladi then raise exception '9d: öğretmen jetonu müdür PIN ucuna girdi'; end if;

  perform public.mudur_pin_degistir(jm, 'Mudur!Okul26', 'Mudur!Yeni26');
  v := public.giris('Mudur!Yeni26');
  if v->>'rol' <> 'mudur' then raise exception '9e: yeni PIN''le giriş: %', v; end if;
  if (public.giris('Mudur!Okul26'))->>'rol' = 'mudur' then
    raise exception '9f: eski PIN hâlâ çalışıyor';
  end if;
  perform public.mudur_paneli(jm);  -- değiştiren oturum açık kalıyor
  patladi := false;
  begin
    perform public.mudur_paneli(jm2);
  exception when sqlstate '28000' then patladi := true;
  end;
  if not patladi then raise exception '9g: diğer oturum düşmedi'; end if;
  perform public.mudur_pin_degistir(jm, 'Mudur!Yeni26', 'Mudur!Okul26');  -- geri al
  raise notice '9 OK — müdür PIN''ini değiştiriyor; yanlış/başkasının/kısa PIN ve öğretmen jetonu reddediliyor; diğer oturum düşüyor';

  -- ---------------------------------------------------------------------------
  -- 10. SORU TOPLAMLARI (0061)
  --
  -- 12MA: 5 soruluk (süresi dolmuş) + 10 soruluk (süresi sürüyor) test +
  -- soru sayısız açık uçlu ödev.
  -- ---------------------------------------------------------------------------
  o2 := (public.odev_olustur(jt, 'Müdür testi ödevi 2', null, s_m, 'test',
          (current_date + 5)::date, 10,
          '{"1":"A","2":"B","3":"C","4":"D","5":"E","6":"A","7":"B","8":"C","9":"D","10":"E"}'::jsonb,
          null, null, true, 5::smallint, '{}'::jsonb))->>'id';
  perform public.odev_yayinla(jt, o2);
  o3 := (public.odev_olustur(jt, 'Müdür açık uçlu', null, s_m, 'acik',
          (current_date + 5)::date))->>'id';
  perform public.odev_yayinla(jt, o3);

  v := public.mudur_paneli(jm);
  select e2 into satir from jsonb_array_elements(v->'siniflar') e2 where e2->>'id' = s_m::text;
  if (satir->>'soru_toplami')::int <> 15 or (satir->>'soru_sayisiz')::int <> 1
     or (satir->>'odev_sayisi')::int <> 3 or (satir->>'seviye')::int <> 12 then
    raise exception '10a: 12MA soru toplamı: %', satir;
  end if;
  -- Şubelerin toplamı = okul; seviyelerin toplamı = okul; 12. seviye =
  -- 12. sınıf şubelerinin toplamı.
  if (select sum((e2->>'soru_toplami')::int) from jsonb_array_elements(v->'siniflar') e2)
       <> (v->'okul'->>'soru_toplami')::int
     or (select sum((e2->>'soru_toplami')::int) from jsonb_array_elements(v->'seviyeler') e2)
       <> (v->'okul'->>'soru_toplami')::int
     or (select (e2->>'soru_toplami')::int from jsonb_array_elements(v->'seviyeler') e2
          where (e2->>'seviye')::int = 12)
       <> (select sum((e2->>'soru_toplami')::int) from jsonb_array_elements(v->'siniflar') e2
            where (e2->>'seviye')::int = 12)
     or (select sum((e2->>'odev_sayisi')::int) from jsonb_array_elements(v->'seviyeler') e2)
       <> (v->'okul'->>'odev_sayisi')::int then
    raise exception '10b: toplamlar tutmuyor: okul %, seviyeler %', v->'okul', v->'seviyeler';
  end if;
  -- Okul toplamı veritabanından bağımsız hesapla aynı: ÖZEL DERS YOK.
  select coalesce(sum(d.soru_sayisi), 0) into beklenen
    from public.odevler d join public.siniflar s on s.id = d.sinif_id
   where d.yayinda and not s.arsiv and not s.ozel;
  if (v->'okul'->>'soru_toplami')::int <> beklenen then
    raise exception '10c: okul soru toplamı % ≠ %', v->'okul'->>'soru_toplami', beklenen;
  end if;
  -- Aylık ödev sayıları = eğitim yılı başından bu ayın sonuna kadarki ödevler.
  select count(*) into beklenen
    from public.odevler d join public.siniflar s on s.id = d.sinif_id
   where d.yayinda and not s.arsiv and not s.ozel
     and d.son_tarih >= (v->>'yil_baslangici')::date
     and d.son_tarih < (date_trunc('month', (now() at time zone 'Europe/Istanbul')::date)
                        + interval '1 month')::date;
  if (select sum((e2->>'odev_sayisi')::int) from jsonb_array_elements(v->'aylar') e2) <> beklenen then
    raise exception '10d: aylık ödev sayıları % ≠ %',
      (select sum((e2->>'odev_sayisi')::int) from jsonb_array_elements(v->'aylar') e2), beklenen;
  end if;
  if jsonb_typeof(v->'eksik_konular') <> 'array' then
    raise exception '10e: eksik_konular dizi değil';
  end if;
  if v::text like '%Gizli Ogrenci%' then raise exception '10f: panoda öğrenci adı'; end if;
  raise notice '10 OK — 12MA 15 soru (+1 sayısız ödev); şube, seviye, okul ve aylık toplamlar tutuyor; özel ders yok';

  -- ---------------------------------------------------------------------------
  -- 11. NOT ÇİZELGESİ (0061)
  -- ---------------------------------------------------------------------------
  m := public.sinif_not_cizelgesi(jm, s_m);
  t := public.sinif_ogrenci_ozeti(jt, s_m);
  if jsonb_array_length(m->'ogrenciler') <> jsonb_array_length(t->'ogrenciler') then
    raise exception '11a: öğrenci sayısı farklı';
  end if;
  for oz in select x from jsonb_array_elements(t->'ogrenciler') x loop
    select x into cz from jsonb_array_elements(m->'ogrenciler') x where x->>'id' = oz->>'id';
    if cz is null
       or (cz->'ortalama') is distinct from (oz->'ortalama')
       or (cz->>'yapilan') <> (oz->>'yapilan') or (cz->>'yapilmayan') <> (oz->>'yapilmayan') then
      raise exception '11b: % çizelgede %, özette %', oz->>'ad', cz, oz;
    end if;
  end loop;
  if (select string_agg(x->>'id', ',' order by n) from jsonb_array_elements(m->'ogrenciler') with ordinality y(x, n))
     <> (select string_agg(x->>'id', ',' order by n) from jsonb_array_elements(t->'ogrenciler') with ordinality y(x, n)) then
    raise exception '11c: öğrenci sırası özetten farklı';
  end if;
  if jsonb_array_length(m->'odevler') <> 3 then raise exception '11d: ödev sayısı %', m->'odevler'; end if;
  select x into cz from jsonb_array_elements(m->'odevler') x where x->>'id' = o2::text;
  if (cz->>'soru_sayisi')::int <> 10 or (cz->>'sure_doldu')::boolean then
    raise exception '11e: ödev satırı: %', cz;
  end if;
  select x into cz from jsonb_array_elements(m->'ogrenciler') x where x->>'id' = a1::text;
  if (cz->'puanlar'->0->>'odev_id') <> (m->'odevler'->0->>'id')
     or (select x->>'durum' from jsonb_array_elements(cz->'puanlar') x
          where x->>'odev_id' = o_odev::text) <> 'gonderdi'
     or (select (x->>'puan')::numeric from jsonb_array_elements(cz->'puanlar') x
          where x->>'odev_id' = o_odev::text) <> 80
     or (select x->>'durum' from jsonb_array_elements(cz->'puanlar') x
          where x->>'odev_id' = o2::text) <> 'suresi_devam' then
    raise exception '11f: a1 puanları: %', cz->'puanlar';
  end if;
  select x into cz from jsonb_array_elements(m->'ogrenciler') x where x->>'id' = a2::text;
  if (select x->>'durum' from jsonb_array_elements(cz->'puanlar') x
       where x->>'odev_id' = o_odev::text) <> 'gondermedi' then
    raise exception '11g: a2 gönderilmedi görünmüyor: %', cz->'puanlar';
  end if;
  -- 0063'ten beri ödevin cevap ANAHTARI ve dosyası çizelgede (öğretmenin
  -- isteği); öğrencinin CEVAPLARI, yorum ve çözüm kâğıdı hâlâ yok.
  if m::text ~* '"cevaplar"|yorum|cozum/' then
    raise exception '11h: çizelgede öğrenci cevabı/yorum/çözüm kâğıdı var';
  end if;
  patladi := false;
  begin
    perform public.sinif_not_cizelgesi(jm, s_ozel);
  exception when sqlstate '42501' then patladi := true;
  end;
  if not patladi then raise exception '11i: özel ders çizelgesi müdüre açık'; end if;
  patladi := false;
  begin
    perform public.sinif_not_cizelgesi(jb, s_m);
  exception when sqlstate '42501' then patladi := true;
  end;
  if not patladi then raise exception '11j: başkasının sınıfı öğretmene açık'; end if;
  raise notice '11 OK — not çizelgesi: ortalama, yapılan/yapılmayan ve sıra sinif_ogrenci_ozeti ile birebir; durumlar doğru; cevap yok';

  -- ---------------------------------------------------------------------------
  -- 12. SAHİBİN ÖNİZLEMESİ (0062)
  -- ---------------------------------------------------------------------------
  m := public.mudur_paneli(jm);
  t := public.mudur_paneli(jt);
  if (m->>'onizleme')::boolean or not (t->>'onizleme')::boolean then
    raise exception '12a: önizleme işareti yanlış: müdür %, sahip %', m->>'onizleme', t->>'onizleme';
  end if;
  if (m->'siniflar') <> (t->'siniflar') or (m->'okul') <> (t->'okul') or (m->'aylar') <> (t->'aylar') then
    raise exception '12b: sahibin önizlemesi müdürün ekranından farklı';
  end if;
  -- Sahibe ATANMAMIŞ bir sınıf (12MB yalnız Barış'ın) önizlemede açılmalı.
  delete from public.ogretmen_siniflari where ogretmen_id = v_ben and sinif_id = s_n;
  m := public.sinif_not_cizelgesi(jt, s_n);
  if m->'sinif'->>'id' <> s_n::text then raise exception '12c: sahip atanmamış sınıfı açamadı'; end if;
  perform public.sinif_analizi(jt, s_n);
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id) values (v_ben, s_n)
    on conflict do nothing;
  patladi := false;
  begin
    perform public.mudur_paneli(jb);
  exception when sqlstate '42501' then patladi := true;
  end;
  if not patladi then raise exception '12d: sıradan öğretmen müdür panosunu açtı'; end if;
  -- Sahip Barış'ın hesabındayken (vekâlet) ne pano ne Barış'ın olmayan sınıf.
  jv := (public.ogretmen_olarak_gir(jt, v_baris))->>'token';
  patladi := false;
  begin
    perform public.mudur_paneli(jv);
  exception when sqlstate '42501' then patladi := true;
  end;
  if not patladi then raise exception '12e: vekâlet oturumu müdür panosunu açtı'; end if;
  patladi := false;
  begin
    perform public.sinif_not_cizelgesi(jv, s_m);
  exception when sqlstate '42501' then patladi := true;
  end;
  if not patladi then raise exception '12f: vekâlet oturumu başkasının sınıfını açtı'; end if;
  raise notice '12 OK — sahip müdür ekranını kendi oturumuyla birebir görüyor; atanmamış sınıfı açıyor; öğretmen ve vekâlet giremiyor';

  -- ---------------------------------------------------------------------------
  -- 13. ORTAK SINIF SAYFASI (0063)
  -- ---------------------------------------------------------------------------
  -- 13a. Öğretmen kipi = sinif_ogrencileri (öğretmenin bugünkü sayıları).
  t := public.sinif_ogrencileri(jt, s_m);
  m := public.sinif_not_cizelgesi(jt, s_m);
  if (m->>'degerlendirilen_odev')::int <> (t->>'degerlendirilen_odev')::int then
    raise exception '13a: değerlendirilen ödev % ≠ %', m->>'degerlendirilen_odev', t->>'degerlendirilen_odev';
  end if;
  if (select jsonb_agg(jsonb_build_object('id', x->'id', 'yapti', x->'yapti', 'yapmadi', x->'yapmadi',
                                          'oy', x->'ortalama_yapan', 'ot', x->'ortalama_tum') order by n)
        from jsonb_array_elements(m->'ogrenciler') with ordinality y(x, n))
     is distinct from
     (select jsonb_agg(jsonb_build_object('id', x->'id', 'yapti', x->'yapti', 'yapmadi', x->'yapmadi',
                                          'oy', x->'ortalama_yapan', 'ot', x->'ortalama_tum') order by n)
        from jsonb_array_elements(t->'ogrenciler') with ordinality y(x, n)) then
    raise exception '13a: öğretmen kipi sinif_ogrencileri''nden farklı: % / %', m->'ogrenciler', t->'ogrenciler';
  end if;

  -- 13b. Ödev kapsamı: Barış 12MB'ye bir ödev veriyor.
  o_baris := (public.odev_olustur(jb, 'Barış müdür testi', null, s_n, 'acik',
               (current_date + 3)::date))->>'id';
  perform public.odev_yayinla(jb, o_baris);
  if exists (select 1 from jsonb_array_elements(public.sinif_not_cizelgesi(jt, s_n)->'odevler') x
              where x->>'id' = o_baris::text) then
    raise exception '13b: sahip kendi sınıf sayfasında Barış''ın ödevini görüyor (kapsam değişti)';
  end if;
  if not exists (select 1 from jsonb_array_elements(public.sinif_not_cizelgesi(jb, s_n)->'odevler') x
                  where x->>'id' = o_baris::text)
     or not exists (select 1 from jsonb_array_elements(public.sinif_not_cizelgesi(jm, s_n)->'odevler') x
                     where x->>'id' = o_baris::text)
     or not exists (select 1 from jsonb_array_elements(public.sinif_not_cizelgesi(jt, s_n, true)->'odevler') x
                     where x->>'id' = o_baris::text) then
    raise exception '13b: Barış, müdür ya da sahibin önizlemesi ödevi görmüyor';
  end if;
  if public.sinif_not_cizelgesi(jm, s_n)->>'kapsam' <> 'tum'
     or public.sinif_not_cizelgesi(jb, s_n)->>'kapsam' <> 'ogretmen' then
    raise exception '13b: kapsam işareti yanlış';
  end if;

  -- 13c. Kartlar: öğretmenin kartı müdürünkiyle aynı yardımcıdan.
  select x into oz from jsonb_array_elements(public.sinif_kartlari(jt)) x where x->>'id' = s_m::text;
  select x into cz from jsonb_array_elements(public.mudur_paneli(jm)->'siniflar') x where x->>'id' = s_m::text;
  if oz - 'arsiv' - 'ozel' is distinct from cz - 'arsiv' - 'ozel' then
    raise exception '13c: 12MA kartı öğretmende %, müdürde %', oz, cz;
  end if;
  select x into oz from jsonb_array_elements(public.sinif_kartlari(jt)) x where x->>'id' = s_n::text;
  select x into cz from jsonb_array_elements(public.mudur_paneli(jm)->'siniflar') x where x->>'id' = s_n::text;
  if (cz->>'odev_sayisi')::int <> (oz->>'odev_sayisi')::int + 1 then
    raise exception '13c: 12MB ödev sayısı müdürde %, sahipte % (Barış''ın ödevi yalnız müdürde olmalı)',
      cz->>'odev_sayisi', oz->>'odev_sayisi';
  end if;
  if exists (select 1 from jsonb_array_elements(public.sinif_kartlari(jb)) x where x->>'id' = s_m::text)
     or not exists (select 1 from jsonb_array_elements(public.sinif_kartlari(jb)) x where x->>'id' = s_n::text) then
    raise exception '13c: Barış''ın kartları yanlış sınıfları içeriyor';
  end if;

  -- 13d. Seviyelere göre konular: 12MA'da tek konulu, süresi dolmuş bir test.
  konu_ad := 'Müdür Konusu ' || ek;
  o_konu := (public.odev_olustur(jt, 'Müdür konu testi', null, s_m, 'test',
              (current_date + 3)::date, 5, '{"1":"A","2":"B","3":"C","4":"D","5":"E"}'::jsonb,
              null, null, true, 5::smallint,
              jsonb_build_object('1', konu_ad, '2', konu_ad, '3', konu_ad, '4', konu_ad, '5', konu_ad)))->>'id';
  perform public.odev_yayinla(jt, o_konu);
  perform public.odev_gonder(
    (public.giris((select kod from public.giris_kodlari where ogrenci_id = a1 and rol = 'ogrenci')))->>'token',
    o_konu, 'cozum/' || o_konu::text || '/' || a1::text || '.jpg',
    '{"1":"A","2":"B","3":"A","4":"A","5":"A"}'::jsonb);
  update public.odevler set son_tarih = current_date - 1 where id = o_konu;
  v := public.mudur_paneli(jm);
  if v ? 'eksik_konular' then raise exception '13d: okul geneli liste hâlâ var'; end if;
  if not exists (select 1 from jsonb_array_elements(v->'seviyeler') sv,
                               jsonb_array_elements(sv->'eksik_konular') k
                  where (sv->>'seviye')::int = 12 and k->>'konu' = konu_ad
                    and (k->>'toplam')::int = 5 and (k->>'dogru')::int = 2) then
    raise exception '13d: 12. seviyede konu yok: %', v->'seviyeler';
  end if;
  if exists (select 1 from jsonb_array_elements(v->'seviyeler') sv,
                           jsonb_array_elements(sv->'eksik_konular') k
              where (sv->>'seviye')::int <> 12 and k->>'konu' = konu_ad) then
    raise exception '13d: konu başka seviyede de görünüyor';
  end if;
  update public.odevler set yayinda = false where id = o_konu;

  -- 13e. konu_karnesi erişimi.
  patladi := false;
  begin
    perform public.konu_karnesi(jb, s_m, null);
  exception when sqlstate '42501' then patladi := true;
  end;
  if not patladi then raise exception '13e: Barış başka sınıfın konu karnesini açtı'; end if;
  patladi := false;
  begin
    perform public.konu_karnesi(jb, null, a1);
  exception when sqlstate '42501' then patladi := true;
  end;
  if not patladi then raise exception '13e: Barış başka sınıfın öğrencisinin karnesini açtı'; end if;
  patladi := false;
  begin
    perform public.konu_karnesi(jm, s_ozel, null);
  exception when sqlstate '42501' then patladi := true;
  end;
  if not patladi then raise exception '13e: müdür özel ders karnesini açtı'; end if;
  perform public.konu_karnesi(jm, s_m, null);
  perform public.konu_karnesi(jt, s_m, null);
  perform public.konu_karnesi(jt, null, a1);
  perform public.konu_karnesi(jb, s_n, null);
  -- 13f. Müdür ödevi ve cevap anahtarını görüyor; çözüm kâğıdını görmüyor.
  update public.odevler set odev_url = 'odev/' || o_odev::text || '/sorular.pdf',
                            anahtar_url = 'odev/' || o_odev::text || '/anahtar.pdf'
   where id = o_odev;
  select x into cz from jsonb_array_elements(public.sinif_not_cizelgesi(jm, s_m)->'odevler') x
   where x->>'id' = o_odev::text;
  if cz->'cevap_anahtari' <> '{"1":"A","2":"B","3":"C","4":"D","5":"E"}'::jsonb
     or cz->>'odev_yolu' <> 'odev/' || o_odev::text || '/sorular.pdf'
     or cz->>'anahtar_yolu' <> 'odev/' || o_odev::text || '/anahtar.pdf' then
    raise exception '13f: çizelgede ödev/anahtar yok: %', cz;
  end if;
  -- Dosya depoda yokken izin YOK: müdür yükleme adresi alıp dosya
  -- oluşturamamalı (Edge Function aynı izinle yükleme adresi de üretiyor).
  if public.dosya_erisim_izni(jm, 'odev/' || o_odev::text || '/sorular.pdf') then
    raise exception '13f: depoda olmayan dosyaya müdür izni (yükleme kapısı açık)';
  end if;
  insert into storage.objects (bucket_id, name)
  select 'odev-dosyalari', y from unnest(array['odev/' || o_odev::text || '/sorular.pdf',
                                               'odev/' || o_odev::text || '/anahtar.pdf']) y
   where not exists (select 1 from storage.objects so where so.name = y);
  if not public.dosya_erisim_izni(jm, 'odev/' || o_odev::text || '/sorular.pdf')
     or not public.dosya_erisim_izni(jm, 'odev/' || o_odev::text || '/anahtar.pdf') then
    raise exception '13f: müdür ödev ya da anahtar PDF''ini açamıyor';
  end if;
  if public.dosya_erisim_izni(jm, (select foto_yolu from public.gonderimler
                                    where odev_id = o_odev and ogrenci_id = a1)) then
    raise exception '13f: müdür öğrencinin çözüm kâğıdını açabiliyor';
  end if;
  update public.odevler set yayinda = false where id = o_odev;
  if public.dosya_erisim_izni(jm, 'odev/' || o_odev::text || '/sorular.pdf') then
    raise exception '13f: yayından kalkan ödevin dosyası müdüre açık';
  end if;
  update public.odevler set yayinda = true where id = o_odev;

  raise notice '13 OK — öğretmen kipi sinif_ogrencileri ile birebir; kapsam role göre; kartlar tek kaynaktan; seviyelere göre konular; konu_karnesi erişimi kapalı; müdür ödev ve anahtarı görüyor, çözüm kâğıdını görmüyor';

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
