-- =============================================================================
-- SEKİZ — AYNI ÖDEVİ BİRDEN ÇOK SINIFA VERME TESTLERİ (0030)
--
-- ASIL SORU, PAYLAŞILAN CEVAP ANAHTARI. Kopyalar aynı yüklenmiş PDF'i
-- paylaşıyor (yol ödevin id'sinden bağımsız üretiliyor). `dosya_erisim_izni`
-- öğrenciye anahtarı `d.anahtar_url = p_yol` eşleşmesiyle veriyor — yani üç
-- ödev aynı yolu taşıdığında, 9A'nın öğrencisi 9B'nin kopyası üzerinden
-- anahtara ulaşabilir mi? Ulaşabilseydi Kural 6 teslim etmeden anahtarı
-- gören bir öğrenci üretirdi. 7. grup bunu ölçüyor ve VARSAYMIYOR.
--
-- İKİNCİ SORU ATOMİKLİK. Döngünün ortasında bir insert patlarsa öncekiler
-- kalıyor mu? Kalsaydı öğretmen "hangi sınıfa gitti?" diye tek tek bakmak
-- zorunda kalırdı. Ölçüm 4. grupta ve gerçek bir arıza ENJEKTE EDEREK
-- yapılıyor: ön denetim zaten bozuk sınıfı baştan eliyor, dolayısıyla
-- "geçersiz sınıf" denemesi döngünün atomikliğini hiç sınamazdı.
--
-- NOT: hiçbir blokta `exception when others` YOK — böyle bir yakalayıcı
-- kendinden önceki grupların hatalarını yutar (0022'de yapılan hata).
--
-- SAYILAR FARK OLARAK ÖLÇÜLÜYOR; süit bütün dosyaları aynı veritabanında
-- koşturuyor ve mutlak sayı varsayımı 0022'de kırılmıştı.
--
-- İZOLASYON: 9P, 9R, 9S, (arşivli) 9T ve 9ZA…9ZU bu dosyaya ait. 9. seviyeyi
-- başka hiçbir test dosyası kullanmıyor.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt      text;
  v_p     uuid; v_r uuid; v_s uuid; v_t uuid;
  v       jsonb; k jsonb;
  d_p     uuid; d_r uuid; d_s uuid; d_tek uuid;
  n       integer;
  c_yol   text := 'odev/paylasilan-0030/anahtar.pdf';
begin
  update public.ayarlar
     set ogretmen_pin_hash = extensions.crypt('Coklu!2026', extensions.gen_salt('bf', 10))
   where id = 1;
  jt := (public.giris('Coklu!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (9, 'P')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_p;
  insert into public.siniflar (seviye, sube) values (9, 'R')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_r;
  insert into public.siniflar (seviye, sube) values (9, 'S')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_s;
  -- 9T bilerek ARŞİVDE: 3. grup onu reddetmeyi ölçüyor.
  insert into public.siniflar (seviye, sube) values (9, 'T')
    on conflict (seviye, sube) do update set arsiv = true returning id into v_t;
  update public.siniflar set arsiv = true where id = v_t;

  -- ===========================================================================
  raise notice '--- 1. Üç sınıf tek çağrıda ---';
  -- ===========================================================================
  v := public.odevler_coklu_olustur(
         jt, jsonb_build_array(v_p, v_r, v_s),
         'Üslü Sayılar', 'Aynı ödev üç şubeye', 'test', current_date + 7,
         2, '{"1":"A","2":"B"}'::jsonb, c_yol, 'odev/paylasilan-0030/sorular.pdf',
         false, 4::smallint, null);

  if jsonb_array_length(v->'odevler') <> 3 then
    raise exception '1a: 3 ödev beklenirken %', jsonb_array_length(v->'odevler');
  end if;

  select (v->'odevler'->0->>'odev_id')::uuid,
         (v->'odevler'->1->>'odev_id')::uuid,
         (v->'odevler'->2->>'odev_id')::uuid
    into d_p, d_r, d_s;

  if d_p = d_r or d_r = d_s or d_p = d_s then
    raise exception '1b: dönen ödev kimlikleri ayrı değil';
  end if;

  -- Her ödev KENDİ sınıfına yazıldı mı — dönen sıra istenen sırayla aynı mı.
  if (select sinif_id from public.odevler where id = d_p) <> v_p
     or (select sinif_id from public.odevler where id = d_r) <> v_r
     or (select sinif_id from public.odevler where id = d_s) <> v_s then
    raise exception '1c: ödevler istenen sınıflara yazılmadı';
  end if;

  -- Üçü de AYNI grupta.
  if v->>'grup_id' is null then
    raise exception '1d: çok sınıflı çağrıda grup_id üretilmedi';
  end if;
  select count(distinct grup_id) into n from public.odevler where id in (d_p, d_r, d_s);
  if n <> 1 then raise exception '1e: üç ödev % ayrı gruba düştü', n; end if;

  -- PDF BİR KEZ YÜKLENİYOR: üçü de aynı yolu taşıyor. Turun asıl kazancı bu.
  select count(distinct anahtar_url) into n from public.odevler where id in (d_p, d_r, d_s);
  if n <> 1 or (select anahtar_url from public.odevler where id = d_p) <> c_yol then
    raise exception '1f: kopyalar aynı cevap anahtarı yolunu paylaşmıyor';
  end if;

  -- Taslak olarak açılıyor (odev_olustur'un kuralı; burada tekrarlanmadı).
  if exists (select 1 from public.odevler where id in (d_p, d_r, d_s) and yayinda) then
    raise exception '1g: kopyalar yayında olarak açıldı';
  end if;

  raise notice '1 OK — üç sınıfa üç ayrı ödev, tek grup, tek PDF yolu';

  -- ===========================================================================
  raise notice '--- 2. Tek sınıfta grup YOK ---';
  -- ===========================================================================
  -- Kardeşi olmayan ödeve grup kimliği vermek, düzenleme ekranında "birlikte
  -- verildi" uyarısının boş yere çıkması demek olurdu.
  v := public.odevler_coklu_olustur(
         jt, jsonb_build_array(v_p),
         'Tek Sınıflık', null, 'acik', current_date + 7);
  d_tek := (v->'odevler'->0->>'odev_id')::uuid;

  if v->>'grup_id' is not null then
    raise exception '2a: tek sınıfta grup_id üretilmiş';
  end if;
  if (select grup_id from public.odevler where id = d_tek) is not null then
    raise exception '2b: tek sınıflık ödevin satırında grup_id var';
  end if;
  raise notice '2 OK — tek sınıfta grup_id null';

  -- ===========================================================================
  raise notice '--- 3. Sınırlar ---';
  -- ===========================================================================
  -- Her deneme kendi alt bloğunda; başarısızlık işareti `raise exception`
  -- varsayılan P0001 ile çıkıyor, yakalayıcı yalnız 22023 tuttuğu için
  -- işaret yutulmuyor.
  begin
    perform public.odevler_coklu_olustur(jt, '[]'::jsonb, 'Boş', null, 'acik', current_date + 7);
    raise exception '3a: boş dizi kabul edildi';
  exception when sqlstate '22023' then null;
  end;

  begin
    perform public.odevler_coklu_olustur(jt, '"9P"'::jsonb, 'Dizi değil', null, 'acik', current_date + 7);
    raise exception '3b: dizi olmayan girdi kabul edildi';
  exception when sqlstate '22023' then null;
  end;

  begin
    perform public.odevler_coklu_olustur(
      jt, jsonb_build_array(v_p, v_r, v_p), 'Mükerrer', null, 'acik', current_date + 7);
    raise exception '3c: aynı sınıf iki kez kabul edildi';
  exception when sqlstate '22023' then null;
  end;

  begin
    perform public.odevler_coklu_olustur(
      jt, jsonb_build_array(v_p, v_t), 'Arşivli', null, 'acik', current_date + 7);
    raise exception '3d: ARŞİVDEKİ sınıfa ödev verildi (0016 kuralı)';
  exception when sqlstate '22023' then null;
  end;

  begin
    perform public.odevler_coklu_olustur(
      jt, '["bu-bir-uuid-degil"]'::jsonb, 'Bozuk', null, 'acik', current_date + 7);
    raise exception '3e: geçersiz kimlik kabul edildi';
  exception when sqlstate '22023' then null;
  end;

  -- 21 sınıf GERÇEK ve HEPSİ AYRI olmalı. İlk yazımda aynı sınıfı 21 kez
  -- göndermiştim; tavanı kaldırınca bu kez MÜKERRER denetimi 22023 veriyordu
  -- ve test yine geçiyordu — yani tavanı değil başka bir kuralı ölçüyordu.
  -- Geri alma kanıtı bunu yakaladı (0024'teki 4b ile aynı sınıf hata).
  insert into public.siniflar (seviye, sube)
  select 9, 'Z' || chr(64 + i) from generate_series(1, 21) i
    on conflict (seviye, sube) do update set arsiv = false;

  begin
    perform public.odevler_coklu_olustur(
      jt,
      (select jsonb_agg(s.id) from public.siniflar s
        where s.seviye = 9 and s.sube like 'Z%'),
      'Çok', null, 'acik', current_date + 7);
    raise exception '3f: 21 sınıflık çağrı kabul edildi';
  exception when sqlstate '22023' then null;
  end;

  -- Reddedilen denemelerin hiçbiri satır bırakmamalı.
  select count(*) into n from public.odevler
   where baslik in ('Boş', 'Dizi değil', 'Mükerrer', 'Arşivli', 'Bozuk', 'Çok');
  if n <> 0 then raise exception '3g: reddedilen denemelerden % satır kaldı', n; end if;

  raise notice '3 OK — boş/dizi değil/mükerrer/arşivli/bozuk/21 sınıf reddedildi';

  -- ===========================================================================
  raise notice '--- 5. Denetim izi ---';
  -- ===========================================================================
  -- Kayıtları `odev_olustur` yazıyor; toplu uç ikinci bir kayıt yazmıyor
  -- (çift kayıt olurdu). Ölçülen: ödev başına TAM BİR kayıt.
  select count(*) into n from public.denetim_izi
   where islem = 'odev_olusturuldu' and kayit_id in (d_p, d_r, d_s);
  if n <> 3 then raise exception '5a: 3 denetim kaydı beklenirken %', n; end if;
  raise notice '5 OK — her ödev için tam bir denetim kaydı';

  -- ===========================================================================
  raise notice '--- 6. kardesler alanı ---';
  -- ===========================================================================
  k := (public.odev_detay(jt, d_p))->'kardesler';
  if k is null or k = 'null'::jsonb then
    raise exception '6a: odev_detay kardeşleri döndürmedi';
  end if;
  if k <> '["9R","9S"]'::jsonb then
    raise exception '6b: kardeşler ["9R","9S"] beklenirken %', k::text;
  end if;

  -- Tek sınıflık ödevde alan NULL — ekran boş yere uyarı çizmesin.
  if (public.odev_detay(jt, d_tek))->>'kardesler' is not null then
    raise exception '6c: kardeşsiz ödevde kardesler dolu';
  end if;

  -- Liste ucu da aynı bilgiyi taşıyor (iki ekran aynı şeyi söylesin).
  select e->'kardesler' into k
    from jsonb_array_elements(public.odevler_listesi(jt, v_p, null)) e
   where (e->>'id')::uuid = d_p;
  if k <> '["9R","9S"]'::jsonb then
    raise exception '6d: odevler_listesi kardeşleri taşımıyor: %', coalesce(k::text, 'null');
  end if;

  raise notice '6 OK — kardeş sınıflar iki uçta da doğru, kardeşsizde null';
end $$;

-- =============================================================================
-- 4 — ATOMİKLİK: döngünün ortasında patlarsa ÖNCEKİ ödev de kalmamalı
--
-- BU GRUP `do` BLOĞUNUN DIŞINDA, VE BU ZORUNLU. PL/pgSQL'de `exception`
-- taşıyan her blok kendi ALT İŞLEMİNİ açar; hata yakalandığında çağrılan
-- fonksiyonun yazdığı satırlar zaten geri alınır. Yani testi bir yakalayıcıya
-- koysaydım fonksiyonun atomikliğini değil PostgreSQL'in geri alma
-- davranışını ölçerdim ve fonksiyon YARIM YAZSA BİLE geçerdi (0024'te tam
-- olarak bu hata yapılmıştı).
--
-- ARIZA ENJEKTE EDİLİYOR. Ön denetim bozuk sınıfı baştan elediği için
-- "geçersiz sınıf" denemesi döngüyü hiç sınamaz. Bunun yerine ikinci sınıfın
-- insert'inde patlayan geçici bir tetikleyici kuruluyor: birinci sınıf
-- yazılıyor, ikincisi patlıyor. Fonksiyona bir gün `exception when others
-- then continue` eklenirse bu test kırılır.
-- =============================================================================
create or replace function public.__test_atomik_0030() returns trigger
language plpgsql as $$
begin
  if new.baslik = 'Atomik Ödev'
     and new.sinif_id = (select id from public.siniflar where seviye = 9 and sube = 'R') then
    raise exception 'BEKLENEN test arızası (4. grup) — ikinci sınıfın inserti bilerek patlatıldı';
  end if;
  return new;
end $$;

create trigger __test_atomik_0030 before insert on public.odevler
  for each row execute function public.__test_atomik_0030();

\set ON_ERROR_STOP off
select public.odevler_coklu_olustur(
  (public.giris('Coklu!2026'))->>'token',
  jsonb_build_array(
    (select id from public.siniflar where seviye = 9 and sube = 'P'),
    (select id from public.siniflar where seviye = 9 and sube = 'R')),
  'Atomik Ödev', null, 'acik', current_date + 7);
\set ON_ERROR_STOP on

drop trigger __test_atomik_0030 on public.odevler;
drop function public.__test_atomik_0030();

do $$
declare n integer;
begin
  select count(*) into n from public.odevler where baslik = 'Atomik Ödev';
  if n <> 0 then
    raise exception '4a: ikinci sınıf patladığı hâlde % ödev kaldı — atomik değil', n;
  end if;
  raise notice '4 OK — döngünün ortasındaki arıza bütün partiyi geri aldı';
end $$;

-- =============================================================================
-- 7 — PAYLAŞILAN CEVAP ANAHTARI SIZDIRMIYOR (turun en kritik grubu)
-- =============================================================================
do $$
declare
  jt   text; jo_ada text; jo_efe text; jv_ada text;
  v_p  uuid; v_r uuid;
  d_p  uuid; d_r uuid;
  ada  uuid; efe uuid;
  c_yol text := 'odev/paylasilan-0030/anahtar.pdf';
begin
  jt := (public.giris('Coklu!2026'))->>'token';
  select id into v_p from public.siniflar where seviye = 9 and sube = 'P';
  select id into v_r from public.siniflar where seviye = 9 and sube = 'R';

  select id into d_p from public.odevler
   where baslik = 'Üslü Sayılar' and sinif_id = v_p;
  select id into d_r from public.odevler
   where baslik = 'Üslü Sayılar' and sinif_id = v_r;
  perform public.odev_yayinla(jt, d_p);
  perform public.odev_yayinla(jt, d_r);

  ada := (public.ogrenci_ekle(jt, 'Ada Şube', 'okul', v_p))->>'id';
  efe := (public.ogrenci_ekle(jt, 'Efe Şube', 'okul', v_r))->>'id';
  jo_ada := (public.giris((select kod from public.giris_kodlari
                            where ogrenci_id = ada and rol = 'ogrenci')))->>'token';
  jo_efe := (public.giris((select kod from public.giris_kodlari
                            where ogrenci_id = efe and rol = 'ogrenci')))->>'token';
  jv_ada := (public.giris((select kod from public.giris_kodlari
                            where ogrenci_id = ada and rol = 'veli')))->>'token';

  -- 7a — TESLİM ETMEDEN ANAHTAR YOK. Bugüne kadarki kural; paylaşılan yol
  -- onu delmiş olsaydı buradan görülürdü.
  if public.dosya_erisim_izni(jo_ada, c_yol) then
    raise exception '7a: teslim etmemiş öğrenci paylaşılan anahtara ulaştı';
  end if;
  if public.dosya_erisim_izni(jo_efe, c_yol) then
    raise exception '7a2: teslim etmemiş ikinci sınıf öğrencisi anahtara ulaştı';
  end if;

  -- 7b — Ada KENDİ ödevine teslim ediyor; anahtar ona açılıyor.
  perform public.odev_gonder(jo_ada, d_p, 'cozum/' || d_p || '/' || ada || '.jpg',
                             '{"1":"A","2":"B"}'::jsonb);
  if not public.dosya_erisim_izni(jo_ada, c_yol) then
    raise exception '7b: teslim eden öğrenci kendi anahtarını göremiyor';
  end if;

  -- 7c — ASIL SIZINTI SORUSU. Efe hâlâ teslim etmedi. Ada'nın teslimi ve
  -- paylaşılan yol yüzünden anahtar ona da açılsaydı, üç sınıflı bir ödevde
  -- bir sınıfın teslimi diğer iki sınıfa anahtarı açardı.
  if public.dosya_erisim_izni(jo_efe, c_yol) then
    raise exception '7c: BAŞKA SINIFIN teslimi anahtarı açtı — paylaşılan yol sızdırıyor';
  end if;

  -- 7d — Efe kendi kopyasına teslim edince açılıyor.
  perform public.odev_gonder(jo_efe, d_r, 'cozum/' || d_r || '/' || efe || '.jpg',
                             '{"1":"A","2":"B"}'::jsonb);
  if not public.dosya_erisim_izni(jo_efe, c_yol) then
    raise exception '7d: kendi kopyasına teslim eden öğrenci anahtarı göremiyor';
  end if;

  -- 7e — VELİ HİÇBİR KOŞULDA GÖREMEZ (Kural 6). Çocuğu teslim etmiş olsa da.
  if public.dosya_erisim_izni(jv_ada, c_yol) then
    raise exception '7e: VELİ cevap anahtarına ulaştı — Kural 6 ihlali';
  end if;

  raise notice '7 OK — paylaşılan anahtar yalnız kendi kopyasına teslim edene açılıyor, veliye asla';

  -- ===========================================================================
  raise notice '--- 8. Öğrenci ve veli bu ucu çağıramıyor ---';
  -- ===========================================================================
  begin
    perform public.odevler_coklu_olustur(
      jo_ada, jsonb_build_array(v_p), 'Öğrenci Denemesi', null, 'acik', current_date + 7);
    raise exception '8a: ÖĞRENCİ toplu ödev oluşturabildi';
  exception when sqlstate '42501' then null;
  end;

  begin
    perform public.odevler_coklu_olustur(
      jv_ada, jsonb_build_array(v_p), 'Veli Denemesi', null, 'acik', current_date + 7);
    raise exception '8b: VELİ toplu ödev oluşturabildi';
  exception when sqlstate '42501' then null;
  end;

  if exists (select 1 from public.odevler
              where baslik in ('Öğrenci Denemesi', 'Veli Denemesi')) then
    raise exception '8c: reddedilen çağrılardan ödev kaldı';
  end if;

  raise notice '8 OK — öğrenci ve veli 42501 alıyor, satır oluşmuyor';
end $$;

do $$
begin
  raise notice 'ÇOKLU SINIF ÖDEVİ TESTLERİ: 8 GRUP GEÇTİ';
end $$;
