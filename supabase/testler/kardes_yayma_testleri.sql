-- =============================================================================
-- SEKİZ — DÜZELTMEYİ KARDEŞ ÖDEVLERE YAYMA TESTLERİ (0031)
--
-- ASIL SORU NOT DOĞRULUĞU. 0030 aynı ödevi üç şubeye vermeyi getirdi ama
-- kopyalar bağımsız: 9B'de düzeltilen cevap anahtarı 9A ve 9C'de yanlış
-- notları sessizce bırakıyordu. Bu dosya, yaymanın o notları GERÇEKTEN
-- düzelttiğini elle doğrulanabilir sayılarla ölçüyor — "çalışıyor gibi
-- görünmesi" yetmez.
--
-- İKİNCİ SORU KAPSAM. Öğretmenin kararı: içerik ve başlık taşınır; son
-- tarih, geç teslim ve yayında olma TAŞINMAZ (her sınıfın kendi programı),
-- sınıf hiçbir koşulda değişmez. 5. grup bunu iki yönlü ölçüyor — taşınanın
-- taşındığı VE taşınmayanın taşınmadığı. Kapsam bir gün sessizce genişlerse
-- bu grup kırılır.
--
-- ÜÇÜNCÜ SORU ARŞİV. 0016'nın kuralı: arşivdeki sınıf öğretmenin hiçbir
-- listesinde yok. Görünmeyen bir sınıfın notunu sessizce değiştirmek o kuralı
-- delerdi. 6. grup arşivdeki kardeşin ATLANDIĞINI ve notunun değişmediğini
-- ölçüyor.
--
-- NOT: hiçbir blokta `exception when others` YOK — böyle bir yakalayıcı
-- kendinden önceki grupların hatalarını yutar (0022'de yapılan hata).
--
-- SAYILAR FARK OLARAK ÖLÇÜLÜYOR; süit bütün dosyaları aynı veritabanında
-- koşturuyor ve mutlak sayı varsayımı 0022'de kırılmıştı.
--
-- İZOLASYON: 10U, 10V, 10W ve (arşivli) 10Y bu dosyaya ait. Başka hiçbir test
-- dosyası bu şubeleri kullanmıyor (10. seviyede yalnız 10K kullanılıyor).
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt          text;
  v_u uuid; v_v uuid; v_w uuid; v_y uuid;
  d_u uuid; d_v uuid; d_w uuid; d_y uuid;
  v           jsonb;
  o           jsonb;
  ada uuid; efe uuid; can uuid; zeynep uuid; deniz uuid;
  jo_ada text; jv_ada text;
  n_yay integer; n_puan integer;
  eski_tarih date; eski_gec boolean; eski_yayin boolean;
  p integer;
begin
  update public.ayarlar
     set ogretmen_pin_hash = extensions.crypt('Kardes!2026', extensions.gen_salt('bf', 10))
   where id = 1;
  jt := (public.giris('Kardes!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (10, 'U')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_u;
  insert into public.siniflar (seviye, sube) values (10, 'V')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_v;
  insert into public.siniflar (seviye, sube) values (10, 'W')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_w;
  -- 10Y ÖNCE AKTİF: `odevler_coklu_olustur` arşivdeki sınıfı reddediyor
  -- (0016), yani kardeşi ancak aktifken kurup sonra arşivleyebiliriz.
  insert into public.siniflar (seviye, sube) values (10, 'Y')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_y;

  -- ===========================================================================
  raise notice '--- 1. Dört şubeye tek ödev, sonra 10Y arşivleniyor ---';
  -- ===========================================================================
  v := public.odevler_coklu_olustur(
         jt, jsonb_build_array(v_u, v_v, v_w, v_y),
         'Türev — Deneme', 'İlk hâli', 'test', current_date + 7,
         2, '{"1":"A","2":"B"}'::jsonb,
         'odev/kardes-0031/anahtar-v1.pdf', 'odev/kardes-0031/sorular-v1.pdf',
         true, 5::smallint, '{"1":"Limit","2":"Türev"}'::jsonb);

  select (e ->> 'odev_id')::uuid into d_u from jsonb_array_elements(v -> 'odevler') e
   where (e ->> 'sinif_id')::uuid = v_u;
  select (e ->> 'odev_id')::uuid into d_v from jsonb_array_elements(v -> 'odevler') e
   where (e ->> 'sinif_id')::uuid = v_v;
  select (e ->> 'odev_id')::uuid into d_w from jsonb_array_elements(v -> 'odevler') e
   where (e ->> 'sinif_id')::uuid = v_w;
  select (e ->> 'odev_id')::uuid into d_y from jsonb_array_elements(v -> 'odevler') e
   where (e ->> 'sinif_id')::uuid = v_y;

  if d_u is null or d_v is null or d_w is null or d_y is null then
    raise exception '1a: dört ödevin hepsi oluşmadı';
  end if;
  if (select count(distinct grup_id) from public.odevler
       where id in (d_u, d_v, d_w, d_y)) <> 1 then
    raise exception '1b: dördü aynı grup_id''yi paylaşmıyor';
  end if;

  -- Yayınla (gönderim alabilmesi için).
  -- 10Y BURADA ARŞİVLENMİYOR: 0016 arşivdeki sınıfa gönderimi reddediyor, yani
  -- Deniz'in gönderimi hiç oluşamazdı ve "arşivdeki kardeşin puanı DEĞİŞMİYOR"
  -- ölçümü ölçecek bir puan bulamazdı. Arşivleme gönderimlerden sonra (2. grup).
  perform public.odev_yayinla(jt, d_u);
  perform public.odev_yayinla(jt, d_v);
  perform public.odev_yayinla(jt, d_w);
  perform public.odev_yayinla(jt, d_y);

  raise notice '1 OK — dört kardeş kuruldu ve yayınlandı';

  -- ===========================================================================
  raise notice '--- 2. Öğrenciler ve gönderimler ---';
  -- ===========================================================================
  ada    := (public.ogrenci_ekle(jt, 'Ada Yayma',    'okul', v_u))->>'id';
  efe    := (public.ogrenci_ekle(jt, 'Efe Yayma',    'okul', v_v))->>'id';
  can    := (public.ogrenci_ekle(jt, 'Can Yayma',    'okul', v_w))->>'id';
  zeynep := (public.ogrenci_ekle(jt, 'Zeynep Yayma', 'okul', v_v))->>'id';
  deniz  := (public.ogrenci_ekle(jt, 'Deniz Yayma',  'okul', v_y))->>'id';

  -- Ada, Efe, Can: 1. doğru, 2. yanlış → 50 puan (anahtar {"1":"A","2":"B"}).
  -- ZEYNEP BİLEREK FARKLI: 2. soruya "A" veriyor. Eski anahtarda da yeni
  -- anahtarda da yanlış, yani puanı DEĞİŞMEYECEK. 4. grup onun raporda
  -- olmadığını ölçüyor — "her öğrenciyi rapora yaz" hatası yakalansın.
  perform public.odev_gonder(
    (public.giris((select kod from public.giris_kodlari where ogrenci_id = ada and rol='ogrenci')))->>'token',
    d_u, 'cozum/' || d_u || '/' || ada || '.jpg', '{"1":"A","2":"C"}'::jsonb);
  perform public.odev_gonder(
    (public.giris((select kod from public.giris_kodlari where ogrenci_id = efe and rol='ogrenci')))->>'token',
    d_v, 'cozum/' || d_v || '/' || efe || '.jpg', '{"1":"A","2":"C"}'::jsonb);
  perform public.odev_gonder(
    (public.giris((select kod from public.giris_kodlari where ogrenci_id = can and rol='ogrenci')))->>'token',
    d_w, 'cozum/' || d_w || '/' || can || '.jpg', '{"1":"A","2":"C"}'::jsonb);
  perform public.odev_gonder(
    (public.giris((select kod from public.giris_kodlari where ogrenci_id = zeynep and rol='ogrenci')))->>'token',
    d_v, 'cozum/' || d_v || '/' || zeynep || '.jpg', '{"1":"A","2":"A"}'::jsonb);
  perform public.odev_gonder(
    (public.giris((select kod from public.giris_kodlari where ogrenci_id = deniz and rol='ogrenci')))->>'token',
    d_y, 'cozum/' || d_y || '/' || deniz || '.jpg', '{"1":"A","2":"C"}'::jsonb);

  -- Elle doğrulanabilir başlangıç: 2 sorunun 1'i doğru → 50.
  for p in select puan::integer from public.gonderimler
            where ogrenci_id in (ada, efe, can, zeynep, deniz) loop
    if p <> 50 then
      raise exception '2a: başlangıç puanı 50 değil (%)', p;
    end if;
  end loop;

  -- ŞİMDİ arşivleniyor: Deniz'in gönderimi ve 50 puanı yerinde. Yayma bu sınıfı
  -- atlamalı ve Deniz'in puanı 50'de kalmalı (6. grup).
  update public.siniflar set arsiv = true where id = v_y;
  if not public._sinif_arsivde(v_y) then
    raise exception '2b: 10Y arşive alınamadı';
  end if;

  raise notice '2 OK — beş gönderim hepsi 50, 10Y sonradan arşivlendi';

  -- ===========================================================================
  raise notice '--- 3. Kaynakta anahtar düzeltiliyor: YALNIZ 10U değişiyor ---';
  -- ===========================================================================
  -- Doğru cevap aslında C'ymiş. Öğretmen 10U'da düzeltiyor.
  perform public.odev_guncelle(
    jt, d_u, 'Türev — Deneme (düzeltildi)', 'Anahtar düzeltildi', v_u,
    current_date + 7, 2, '{"1":"A","2":"C"}'::jsonb,
    'odev/kardes-0031/anahtar-v2.pdf', 'odev/kardes-0031/sorular-v2.pdf',
    true, 5::smallint, '{"1":"Limit","2":"Zincir Kuralı"}'::jsonb);

  if (select puan from public.gonderimler where ogrenci_id = ada) <> 100 then
    raise exception '3a: kaynaktaki öğrencinin puanı düzelmedi';
  end if;
  -- ASIL SORUN BURADA GÖRÜNÜYOR: kardeşler hâlâ yanlış notta.
  if (select puan from public.gonderimler where ogrenci_id = efe) <> 50 then
    raise exception '3b: kardeş kendiliğinden düzeldi — bu turun varsayımı yanlış';
  end if;

  raise notice '3 OK — kaynak düzeldi (100), kardeş hâlâ 50';

  -- ===========================================================================
  raise notice '--- 4. YAYMA: kardeşlerin notları düzeliyor ---';
  -- ===========================================================================
  select count(*) into n_yay from public.denetim_izi where islem = 'kardeslere_yayildi';
  select count(*) into n_puan from public.denetim_izi where islem = 'yeniden_puanlandi';

  v := public.odev_kardeslere_yay(jt, d_u);

  -- Elle doğrulanabilir: Efe ve Can 50 → 100.
  if (select puan from public.gonderimler where ogrenci_id = efe) <> 100 then
    raise exception '4a: 10V öğrencisinin puanı düzelmedi';
  end if;
  if (select puan from public.gonderimler where ogrenci_id = can) <> 100 then
    raise exception '4b: 10W öğrencisinin puanı düzelmedi';
  end if;
  -- Zeynep iki anahtarda da yanlış: puanı değişmemeli.
  if (select puan from public.gonderimler where ogrenci_id = zeynep) <> 50 then
    raise exception '4c: puanı değişmemesi gereken öğrencinin puanı değişti';
  end if;

  -- Rapor: üç kardeş satırı (10V, 10W, 10Y).
  if jsonb_array_length(v) <> 3 then
    raise exception '4d: rapor 3 kardeş içermiyor (%)', jsonb_array_length(v);
  end if;

  -- DEĞİŞMEYEN ÖĞRENCİ RAPORDA YOK. 10V'de iki öğrenci var ama yalnız biri
  -- değişti; rapor ikisini de yazsaydı öğretmen olmayan bir not değişikliği
  -- görürdü.
  select e into o from jsonb_array_elements(v) e where e ->> 'sinif' = '10V';
  if jsonb_array_length(o -> 'yeniden_puanlanan') <> 1 then
    raise exception '4e: 10V raporunda 1 değil % kayıt var',
      jsonb_array_length(o -> 'yeniden_puanlanan');
  end if;
  if (o -> 'yeniden_puanlanan' -> 0 ->> 'ogrenci') <> 'Efe Yayma' then
    raise exception '4f: raporda yanlış öğrenci';
  end if;
  if (o -> 'yeniden_puanlanan' -> 0 ->> 'eski_puan')::numeric <> 50
     or (o -> 'yeniden_puanlanan' -> 0 ->> 'yeni_puan')::numeric <> 100 then
    raise exception '4g: raporda eski/yeni puan yanlış';
  end if;

  -- Denetim izi (Part XLIII): iki kardeş güncellendi, iki not değişti.
  if (select count(*) from public.denetim_izi where islem = 'kardeslere_yayildi') - n_yay <> 2 then
    raise exception '4h: kardeslere_yayildi izi 2 artmadı';
  end if;
  if (select count(*) from public.denetim_izi where islem = 'yeniden_puanlandi') - n_puan <> 2 then
    raise exception '4i: yeniden_puanlandi izi 2 artmadı';
  end if;

  raise notice '4 OK — iki kardeşin notu düzeldi, değişmeyen öğrenci raporda yok, iz düşüldü';

  -- ===========================================================================
  raise notice '--- 5. KAPSAM: taşınan taşındı, TAŞINMAYAN TAŞINMADI ---';
  -- ===========================================================================
  -- Taşınanlar
  if (select baslik from public.odevler where id = d_v) <> 'Türev — Deneme (düzeltildi)' then
    raise exception '5a: başlık taşınmadı';
  end if;
  if (select aciklama from public.odevler where id = d_v) <> 'Anahtar düzeltildi' then
    raise exception '5b: açıklama taşınmadı';
  end if;
  if (select cevap_anahtari from public.odevler where id = d_v)
     is distinct from '{"1":"A","2":"C"}'::jsonb then
    raise exception '5c: cevap anahtarı taşınmadı';
  end if;
  if (select anahtar_url from public.odevler where id = d_v) <> 'odev/kardes-0031/anahtar-v2.pdf' then
    raise exception '5d: anahtar PDF yolu taşınmadı';
  end if;
  if (select odev_url from public.odevler where id = d_v) <> 'odev/kardes-0031/sorular-v2.pdf' then
    raise exception '5e: ödev PDF yolu taşınmadı';
  end if;
  if (select konular from public.odevler where id = d_v)
     is distinct from '{"1":"Limit","2":"Zincir Kuralı"}'::jsonb then
    raise exception '5f: konular taşınmadı';
  end if;

  -- TAŞINMAYANLAR — öğretmenin kararının kod karşılığı.
  -- 10V'nin son tarihi bilerek farklılaştırılıp yayma tekrar çağrılıyor;
  -- taşınsaydı bu değer kaynağınkine dönerdi.
  update public.odevler set son_tarih = current_date + 30, gec_teslim = false
   where id = d_v;
  select son_tarih, gec_teslim, yayinda into eski_tarih, eski_gec, eski_yayin
    from public.odevler where id = d_v;

  perform public.odev_kardeslere_yay(jt, d_u);

  if (select son_tarih from public.odevler where id = d_v) <> eski_tarih then
    raise exception '5g: SON TARİH taşındı — taşınmamalıydı';
  end if;
  if (select gec_teslim from public.odevler where id = d_v) is distinct from eski_gec then
    raise exception '5h: GEÇ TESLİM ayarı taşındı — taşınmamalıydı';
  end if;
  if (select yayinda from public.odevler where id = d_v) is distinct from eski_yayin then
    raise exception '5i: YAYINDA durumu taşındı — taşınmamalıydı';
  end if;
  if (select sinif_id from public.odevler where id = d_v) <> v_v then
    raise exception '5j: SINIF değişti — hiçbir koşulda değişmemeliydi';
  end if;

  raise notice '5 OK — içerik taşındı; son tarih, geç teslim, yayın ve sınıf yerinde';

  -- ===========================================================================
  raise notice '--- 6. ARŞİVDEKİ KARDEŞ ATLANIYOR (0016 kuralı) ---';
  -- ===========================================================================
  select e into o from jsonb_array_elements(v) e where e ->> 'sinif' = '10Y';
  if o is null then
    raise exception '6a: arşivdeki kardeş raporda hiç yok — sessiz atlama';
  end if;
  if (o ->> 'atlandi') <> 'arsiv' then
    raise exception '6b: arşivdeki kardeş "atlandi" işaretlenmemiş';
  end if;
  if (select cevap_anahtari from public.odevler where id = d_y)
     is distinct from '{"1":"A","2":"B"}'::jsonb then
    raise exception '6c: ARŞİVDEKİ ödevin anahtarı değişti';
  end if;
  if (select puan from public.gonderimler where ogrenci_id = deniz) <> 50 then
    raise exception '6d: ARŞİVDEKİ sınıfın öğrencisinin notu sessizce değişti';
  end if;

  raise notice '6 OK — arşivdeki kardeş atlandı, notu değişmedi, raporda yazıyor';

  -- ===========================================================================
  raise notice '--- 7. Kardeşi olmayan ödev sessizce "tamam" demiyor ---';
  -- ===========================================================================
  d_y := (public.odev_olustur(jt, 'Tek başına', null, v_u, 'test',
                              current_date + 5, 1, '{"1":"A"}'::jsonb,
                              null, null, true, 5::smallint, null))->>'id';
  begin
    perform public.odev_kardeslere_yay(jt, d_y);
    raise exception '7a: grup_id null olan ödevde hata vermedi';
  exception when sqlstate '22023' then
    null;
  end;

  raise notice '7 OK — kardeşsiz ödev 22023 ile reddediliyor';

  -- ===========================================================================
  raise notice '--- 8. Yetki: öğrenci ve veli çağıramıyor ---';
  -- ===========================================================================
  jo_ada := (public.giris((select kod from public.giris_kodlari
                            where ogrenci_id = ada and rol = 'ogrenci')))->>'token';
  jv_ada := (public.giris((select kod from public.giris_kodlari
                            where ogrenci_id = ada and rol = 'veli')))->>'token';
  begin
    perform public.odev_kardeslere_yay(jo_ada, d_u);
    raise exception '8a: ÖĞRENCİ yayma ucunu çağırabildi';
  exception when sqlstate '42501' then
    null;
  end;
  begin
    perform public.odev_kardeslere_yay(jv_ada, d_u);
    raise exception '8b: VELİ yayma ucunu çağırabildi';
  exception when sqlstate '42501' then
    null;
  end;

  raise notice '8 OK — yalnız öğretmen çağırabiliyor';

  -- ===========================================================================
  raise notice '--- 9. kardes_detay: yayma düğmesinin ihtiyacı ---';
  -- ===========================================================================
  v := public.odev_detay(jt, d_u);
  -- `is distinct from` ZORUNLU. Geri alma kanıtı bunu yakaladı: alan hiç
  -- dönmezse `v -> 'kardes_detay'` NULL olur, `jsonb_array_length(NULL)` da
  -- NULL döner ve `NULL <> 3` NULL'dur — yani `if` hiç tetiklenmez ve test
  -- alan tamamen kaybolmuşken bile GEÇER. Aynı NULL tuzağı geri yükleme
  -- betiğinde de yaşanmıştı (docs/yedekleme.md).
  if jsonb_typeof(v -> 'kardes_detay') is distinct from 'array' then
    raise exception '9a: kardes_detay dizi olarak dönmüyor (% )',
      coalesce(jsonb_typeof(v -> 'kardes_detay'), 'alan yok');
  end if;
  if jsonb_array_length(v -> 'kardes_detay') is distinct from 3 then
    raise exception '9a2: kardes_detay 3 kardeş vermiyor';
  end if;
  -- 0030'un güvencesi bozulmadı.
  if jsonb_typeof(v -> 'kardesler') is distinct from 'array' then
    raise exception '9b: kardesler alanı bozuldu (0030 güvencesi)';
  end if;
  if jsonb_array_length(v -> 'kardesler') is distinct from 3 then
    raise exception '9b2: kardesler 3 sınıf vermiyor (0030 güvencesi)';
  end if;
  -- Buradaki `is distinct from` da aynı NULL tuzağına karşı: satır hiç
  -- bulunmazsa `o` NULL kalır ve düz karşılaştırma sessizce geçerdi.
  select e into o from jsonb_array_elements(v -> 'kardes_detay') e where e ->> 'sinif' = '10V';
  if (o ->> 'gonderim_sayisi')::integer is distinct from 2 then
    raise exception '9c: kardes_detay gönderim sayısı yanlış';
  end if;
  if (o ->> 'anahtar_ayni')::boolean is distinct from true then
    raise exception '9d: yayma sonrası anahtar aynı görünmüyor';
  end if;
  select e into o from jsonb_array_elements(v -> 'kardes_detay') e where e ->> 'sinif' = '10Y';
  if (o ->> 'arsiv')::boolean is distinct from true then
    raise exception '9e: arşivdeki kardeş arsiv=true olarak işaretlenmemiş';
  end if;
  -- Cevap anahtarı sızıntısı: kardes_detay anahtarın KENDİSİNİ taşımıyor.
  if (v -> 'kardes_detay')::text like '%"A"%' then
    raise exception '9f: kardes_detay cevap anahtarı değeri sızdırıyor';
  end if;

  raise notice '9 OK — kardes_detay doğru, kardesler bozulmadı, anahtar sızmıyor';
end $$;

-- =============================================================================
-- 10 — ATOMİKLİK: döngünün ortasında patlarsa ÖNCEKİ kardeş de kalmamalı
--
-- BU GRUP `do` BLOĞUNUN DIŞINDA, VE BU ZORUNLU. PL/pgSQL'de `exception`
-- taşıyan her blok kendi ALT İŞLEMİNİ açar; hata yakalandığında çağrılan
-- fonksiyonun yazdığı satırlar zaten geri alınır. Yani testi bir yakalayıcıya
-- koysaydım fonksiyonun atomikliğini değil PostgreSQL'in geri alma
-- davranışını ölçerdim ve fonksiyon YARIM YAZSA BİLE geçerdi (0024'te tam
-- olarak bu hata yapılmıştı).
--
-- ARIZA ENJEKTE EDİLİYOR: ikinci kardeşin (10W) güncellemesinde patlayan
-- geçici bir tetikleyici. Birinci kardeş (10V) yazılıyor, ikincisi patlıyor.
-- Fonksiyona bir gün `exception when others then continue` eklenirse bu test
-- kırılır.
-- =============================================================================
create or replace function public.__test_atomik_0031() returns trigger
language plpgsql as $$
begin
  if new.baslik = 'ATOMİK-0031'
     and new.sinif_id = (select id from public.siniflar where seviye = 10 and sube = 'W') then
    raise exception 'BEKLENEN test arızası (10. grup) — ikinci kardeşin güncellemesi bilerek patlatıldı';
  end if;
  return new;
end $$;

create trigger __test_atomik_0031 before update on public.odevler
  for each row execute function public.__test_atomik_0031();

-- Kaynağın başlığı tetikleyicinin arayacağı değere çekiliyor (doğrudan, çünkü
-- odev_guncelle da aynı tetikleyiciye takılırdı — kaynak 10U, tetikleyici
-- yalnız 10W'yi patlatıyor, yani bu update güvenli).
update public.odevler set baslik = 'ATOMİK-0031'
 where sinif_id = (select id from public.siniflar where seviye = 10 and sube = 'U')
   and grup_id is not null;

\set ON_ERROR_STOP off
select public.odev_kardeslere_yay(
  (public.giris('Kardes!2026'))->>'token',
  (select id from public.odevler
    where sinif_id = (select id from public.siniflar where seviye = 10 and sube = 'U')
      and grup_id is not null));
\set ON_ERROR_STOP on

drop trigger __test_atomik_0031 on public.odevler;
drop function public.__test_atomik_0031();

do $$
begin
  -- 10V yazılmış olsaydı başlığı 'ATOMİK-0031' olurdu. Geri alma çalıştıysa
  -- eski başlığında kalmıştır.
  if (select baslik from public.odevler
       where sinif_id = (select id from public.siniflar where seviye = 10 and sube = 'V')
         and grup_id is not null) = 'ATOMİK-0031' then
    raise exception '10: ATOMİK DEĞİL — ikinci kardeş patlarken birincisi yazılı kaldı';
  end if;
  raise notice '10 OK — döngü ortasında patlayan çağrı hiçbir kardeşi yazmadı';
end $$;

do $$ begin raise notice 'KARDEŞ YAYMA TESTLERİ: 10 GRUP GEÇTİ'; end $$;
