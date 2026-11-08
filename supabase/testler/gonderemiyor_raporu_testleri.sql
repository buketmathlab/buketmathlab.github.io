-- =============================================================================
-- SEKİZ — "BU SINIF GÖNDEREMİYOR" RAPORU (panel-icin dosyası)
--
-- Öğretmenin bildirimi: "10B'deki öğrenciler son ödevlerini
-- yükleyemiyorlar." Bir sınıfın TAMAMININ tek ödevde takılması tek tek
-- öğrenci sorunu değil, kapanmış bir kapıdır. Rapor kapıları sunucunun
-- baktığı sırayla ölçüyor.
--
-- TEST KENDİ SORGUSUNU TAŞIMIYOR. `panel-icin/gonderemiyor-raporu.sql`in
-- GERÇEK metni okunup çalıştırılıyor (`kopya_temizlik_testleri.sql`in
-- deseni). Kopyalanmış bir sorguyu ölçmek, dosyanın kendisini hiç
-- ölçmemek olurdu.
--
-- SINIF 10B: panel dosyasının varsayılan ayarı bu. Dosya, öğretmenin
-- çalıştıracağı hâliyle, olduğu gibi ölçülüyor.
--
-- HER KAPI İKİ YÖNDE ÖLÇÜLÜYOR: kapı kapalıyken rapor onu ADIYLA
-- söylüyor, kapı açıkken "ENGEL YOK" diyor. Bir rapor yalnız bulduğunu
-- değil, bulamadığını da doğru söylemeli — yoksa her şeye "sorun var"
-- diyen bir rapor da bütün kapılarda yeşil yanardı.
--
-- Ölçülen:
--   0.  Dosya gerçekten okundu mu (çıpa)
--   1.  ENGEL YOK — temiz durumda rapor engel UYDURMUYOR
--   2.  SON TARİH GEÇTİ, GEÇ TESLİM KAPALI
--   3.  Kişisel ek süresi olan öğrenci engelli SAYILMIYOR (0081)
--   4.  ÖDEV YAYINDA DEĞİL (taslak kopya)
--   5.  SINIF ARŞİVDE
--   6.  ÖĞRENCİ PASİF
--   7.  ÖDEV BU ÖĞRENCİYE DÜŞMÜYOR (0064 sınıfa giriş)
--   8.  GÖNDEREN öğrenci engelli sayılmıyor
--   9.  KARDEŞ ŞUBELER bölümü şubeler arası tarih farkını gösteriyor
--  10.  DEPODA DURAN DOSYA — yüklenmiş ama gönderimi olmayan sayfa
--  11.  "Son ödev" EN SON VERİLEN ödev (son tarihi en ileri olan değil)
--
-- `now()` bir işlem boyunca DONUK; tarih kapıları `current_date`
-- üzerinden kuruluyor, denetim izi gerekmiyor.
--
-- Tekrar çalıştırılabilir. Hiçbir blokta `exception when others` YOK.
--
-- -----------------------------------------------------------------------------
-- KUSUR PROVALARI — HER KAPI GERÇEKTEN ISIRIYOR MU (ölçüldü)
--
-- 11 grubun hepsi İLK KOŞUDA yeşil döndü. Bu tek başına hiçbir şey
-- kanıtlamaz: hiçbir şey ölçmeyen bir süit de yeşil döner. Raporun
-- kendisi altı ayrı yerinden bozuldu.
--
--   R1  Kapı SIRASI bozuluyor (süre kapısı taslaktan önce bakılıyor)
--         → 4a ısırdı: "taslakta üç öğrenci beklenirken 0"
--   R2  Açık kişisel ek süre dikkate alınmıyor
--         → 3a ısırdı: "ek süresi açık öğrenci engelli sayıldı"
--   R3  "Son ödev" son TARİHE göre seçiliyor (verilişe göre değil)
--         → 11a ısırdı: özet eski ödevi "son ödev" sandı
--   R4  UUID TİRESİ TUZAĞI geri geliyor (kimlik kendi tiresinden
--       kesiliyor, öksüz dosya hiç bulunamıyor)
--         → 10a ısırdı: "bir öksüz dosya beklenirken 0"
--       İLK YAZIMINDA yalnız `select` bozuluyordu; süzgeç hâlâ
--       `left(...,36)` baktığı için satır geçiyor ve TÜR DÖNÜŞÜMÜ
--       patlıyordu. Prova "ısırdı" görünüyordu ama ısıran şey benim
--       kapım değil bir SQL hatasıydı — yani 10. grup hiç ölçülmemişti.
--       Gerçek kusurda süzgeç de aynı ifadeyi kullanıyor ve satır
--       SESSİZCE eleniyor; prova artık onu taklit ediyor.
--   R5  Engeli OLMAYAN öğrenciler de 4. bölüme giriyor
--         → 1a ısırdı: "engel yokken 3 öğrenci engelli sayıldı"
--   R6  Kardeş şubeler yalnız incelenen sınıfla sınırlanıyor
--         → 9a ısırdı: "iki kardeş satırı beklenirken 1"
--
-- Isırmayan — ya da BEKLENMEDİK yerden ısıran — provada önce koşum
-- takımına bakılıyor. R4 tam bunun örneği.
-- =============================================================================
\set ON_ERROR_STOP on

-- Dosyanın metni okunuyor. Sondaki `;` kırpılıyor: metin bir alt sorgu
-- olarak `create temp table ... as` içine yerleşecek.
\set rapor_sql `sed 's/;[[:space:]]*$//' "${SEKIZ_KOK:-.}/supabase/panel-icin/gonderemiyor-raporu.sql"`

select set_config('sekiz.gr_sql', :'rapor_sql', false) is not null as okundu;

do $$
declare
  rapor text := coalesce(current_setting('sekiz.gr_sql', true), '');
  ek    text := substr(md5(random()::text), 1, 6);
  s_id  uuid;
  v_10b uuid;
  v_9z  uuid;
  o1 uuid; o2 uuid; o3 uuid;
  d_eski uuid; d_yeni uuid; d_kardes uuid;
  n integer;
  t text;

  -- Raporu çalıştırıp çıktısını geçici tabloya koyan yardımcı.
  -- Metin her seferinde YENİDEN çalıştırılıyor: dünya değişti, cevap da
  -- değişmeli.
  procedure_yok boolean := false;
begin
  -- ---------------------------------------------------------------------------
  -- 0. ÇIPA — dosya gerçekten okundu mu
  --
  -- Bu olmadan boş bir metin sessizce boş bir tablo üretir ve aşağıdaki
  -- bütün "engel görünmüyor" ölçümleri yeşil yanardı. Ölçümün en
  -- tehlikeli hâli, ölçmeden geçmesidir.
  --
  -- Çıpa ölçülen davranışlardan biri DEĞİL: aksi hâlde o davranış
  -- bozulduğunda "dosya okunamadı" diye yanlış yere işaret ederdi.
  -- ---------------------------------------------------------------------------
  if position('5 · DEPODA DURAN DOSYA' in rapor) = 0 then
    raise exception '0a BAŞARISIZ — rapor dosyası okunamadı (% karakter) — SEKIZ_KOK doğru mu?',
      length(rapor);
  end if;
  if position('ARANAN_SINIF' in rapor) = 0 then
    raise exception '0b BAŞARISIZ — dosya beklenen ayar satırını taşımıyor';
  end if;
  raise notice '0 OK — panel dosyası okundu (% karakter)', length(rapor);

  -- ---------------------------------------------------------------------------
  -- DÜNYA KURULUYOR
  -- ---------------------------------------------------------------------------
  select id into s_id from public.ogretmenler where yonetici;

  insert into public.siniflar (seviye, sube) values (10, 'B')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_10b;
  insert into public.siniflar (seviye, sube) values (9, 'Z')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_9z;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    values (s_id, v_10b), (s_id, v_9z) on conflict do nothing;

  -- Temiz başlangıç.
  --
  -- DEPO SİLMESİ DAR TUTULUYOR: yalnız bu iki sınıfın ödevlerine ait
  -- dosyalar. `cozum/%` deseninin tamamını silmek başka süitlerin
  -- kurduğu dünyayı da götürürdü — bir testin başka bir testi bozması,
  -- sonradan teşhisi en zor yeşil/kırmızıdır.
  delete from storage.objects
   where bucket_id = 'odev-dosyalari'
     and name like 'cozum/%'
     and split_part(name, '/', 2) in
         (select id::text from public.odevler where sinif_id in (v_10b, v_9z));
  delete from public.odev_ek_sure
   where odev_id in (select id from public.odevler where sinif_id in (v_10b, v_9z));
  delete from public.gonderimler
   where odev_id in (select id from public.odevler where sinif_id in (v_10b, v_9z));
  delete from public.denetim_izi
   where tablo = 'odevler'
     and kayit_id in (select id from public.odevler where sinif_id in (v_10b, v_9z));
  delete from public.odevler where sinif_id in (v_10b, v_9z);
  delete from public.giris_kodlari
   where ogrenci_id in (select id from public.ogrenciler where sinif_id in (v_10b, v_9z));
  delete from public.ogrenciler where sinif_id in (v_10b, v_9z);

  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id)
  values ('Birinci Deneği ' || ek, 'okul', v_10b, s_id) returning id into o1;
  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id)
  values ('İkinci Deneği ' || ek, 'okul', v_10b, s_id) returning id into o2;
  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id)
  values ('Üçüncü Deneği ' || ek, 'okul', v_10b, s_id) returning id into o3;

  -- AÇIK ödev: son tarih ileride, yayında.
  insert into public.odevler (baslik, sinif_id, tur, son_tarih, soru_sayisi,
                              cevap_anahtari, yayinda, gec_teslim, ogretmen_id)
  values ('Son Ödev ' || ek, v_10b, 'test', current_date + 7, 2,
          '{"1":"A","2":"B"}'::jsonb, true, false, s_id)
  returning id into d_yeni;

  -- ---------------------------------------------------------------------------
  raise notice '--- 1. Temiz durumda ENGEL YOK ---';
  -- ---------------------------------------------------------------------------
  set local client_min_messages = warning;
  drop table if exists gr;
  set local client_min_messages = notice;
  execute 'create temp table gr as ' || rapor;

  select count(*) into n from gr where bolum = '4 · ÖĞRENCİ';
  if n <> 0 then
    raise exception '1a BAŞARISIZ — engel yokken % öğrenci engelli sayıldı: %',
      n, (select string_agg(kim || ' → ' || ayrinti, ' | ') from gr where bolum = '4 · ÖĞRENCİ');
  end if;
  select ayrinti into t from gr where bolum = '0 · OZET';
  if t not like 'ENGEL YOK%' then
    raise exception '1b BAŞARISIZ — özet engel uydurdu: %', t;
  end if;
  raise notice '    engel yokken rapor engel UYDURMUYOR: OK';

  -- ---------------------------------------------------------------------------
  raise notice '--- 2. SON TARİH GEÇTİ, GEÇ TESLİM KAPALI ---';
  -- ---------------------------------------------------------------------------
  -- 10B'nin kopyası geçmiş tarihte kalmış: öğretmenin bildirdiği durumun
  -- birebir kendisi.
  update public.odevler set son_tarih = current_date - 3, gec_teslim = false
   where id = d_yeni;
  drop table gr;
  execute 'create temp table gr as ' || rapor;

  select count(*) into n from gr
   where bolum = '4 · ÖĞRENCİ' and ayrinti like 'SON TARİH GEÇTİ%';
  if n <> 3 then
    raise exception '2a BAŞARISIZ — üç öğrenci beklenirken %: %',
      n, (select string_agg(kim || ' → ' || ayrinti, ' | ') from gr where bolum = '4 · ÖĞRENCİ');
  end if;
  select ayrinti into t from gr where bolum = '0 · OZET';
  if t not like '%3''i gönderemiyor%' or t not like '%SON TARİH GEÇTİ%' then
    raise exception '2b BAŞARISIZ — özet kapıyı söylemiyor: %', t;
  end if;
  -- 1. bölüm de uyarıyor mu.
  if not exists (select 1 from gr where bolum = '1 · ÖDEV' and ayrinti like '%TESLİM KAPALI%') then
    raise exception '2c BAŞARISIZ — ödev satırı "TESLİM KAPALI" demiyor';
  end if;
  raise notice '    kapı adıyla söyleniyor, özet sayıyı veriyor: OK';

  -- ---------------------------------------------------------------------------
  raise notice '--- 3. Kişisel ek süresi olan engelli SAYILMIYOR (0081) ---';
  -- ---------------------------------------------------------------------------
  insert into public.odev_ek_sure (odev_id, ogrenci_id, son_tarih, veren_id)
  values (d_yeni, o1, current_date + 5, s_id);
  drop table gr;
  execute 'create temp table gr as ' || rapor;

  if exists (select 1 from gr where bolum = '4 · ÖĞRENCİ' and kim like 'Birinci%') then
    raise exception '3a BAŞARISIZ — ek süresi açık öğrenci engelli sayıldı';
  end if;
  select count(*) into n from gr where bolum = '4 · ÖĞRENCİ';
  if n <> 2 then
    raise exception '3b BAŞARISIZ — iki öğrenci beklenirken %', n;
  end if;
  -- DOLMUŞ ek süre kapıyı AÇMIYOR.
  update public.odev_ek_sure set son_tarih = current_date - 1
   where odev_id = d_yeni and ogrenci_id = o1;
  drop table gr;
  execute 'create temp table gr as ' || rapor;
  if not exists (select 1 from gr where bolum = '4 · ÖĞRENCİ' and kim like 'Birinci%') then
    raise exception '3c BAŞARISIZ — DOLMUŞ ek süre kapıyı açık gösterdi';
  end if;
  if not exists (select 1 from gr where bolum = '4 · ÖĞRENCİ'
                   and kim like 'Birinci%' and ayrinti like '%kişisel süre%') then
    raise exception '3d BAŞARISIZ — kişisel süre satırda yazmıyor';
  end if;
  delete from public.odev_ek_sure where odev_id = d_yeni and ogrenci_id = o1;
  raise notice '    açık ek süre engeli kaldırıyor, dolmuş olan kaldırmıyor: OK';

  -- ---------------------------------------------------------------------------
  raise notice '--- 4. ÖDEV YAYINDA DEĞİL ---';
  -- ---------------------------------------------------------------------------
  -- Taslak kopya, kapı sırasında SON TARİHTEN ÖNCE gelmeli: öğrenci ödevi
  -- hiç görmüyorsa ona "süresi doldu" demek yanlış yere işaret etmektir.
  update public.odevler set yayinda = false where id = d_yeni;
  drop table gr;
  execute 'create temp table gr as ' || rapor;

  select count(*) into n from gr
   where bolum = '4 · ÖĞRENCİ' and ayrinti like 'ÖDEV YAYINDA DEĞİL%';
  if n <> 3 then
    raise exception '4a BAŞARISIZ — taslakta üç öğrenci beklenirken %: %',
      n, (select string_agg(ayrinti, ' | ') from gr where bolum = '4 · ÖĞRENCİ');
  end if;
  if not exists (select 1 from gr where bolum = '1 · ÖDEV' and ayrinti like '%TASLAK%') then
    raise exception '4b BAŞARISIZ — ödev satırı taslak olduğunu söylemiyor';
  end if;
  update public.odevler set yayinda = true, son_tarih = current_date + 7 where id = d_yeni;
  raise notice '    taslak kapısı süre kapısından ÖNCE söyleniyor: OK';

  -- ---------------------------------------------------------------------------
  raise notice '--- 5. SINIF ARŞİVDE ---';
  -- ---------------------------------------------------------------------------
  update public.siniflar set arsiv = true where id = v_10b;
  drop table gr;
  execute 'create temp table gr as ' || rapor;

  select count(*) into n from gr
   where bolum = '4 · ÖĞRENCİ' and ayrinti like 'SINIF ARŞİVDE%';
  if n <> 3 then
    raise exception '5a BAŞARISIZ — arşivde üç öğrenci beklenirken %', n;
  end if;
  if not exists (select 1 from gr where bolum = '2 · SINIF'
                   and ayrinti like '%ARŞİVDEKİ SINIFA GÖNDERİM YAPILAMAZ%') then
    raise exception '5b BAŞARISIZ — sınıf satırı arşivi söylemiyor';
  end if;
  update public.siniflar set arsiv = false where id = v_10b;
  raise notice '    arşiv kapısı görünüyor: OK';

  -- ---------------------------------------------------------------------------
  raise notice '--- 6. ÖĞRENCİ PASİF ---';
  -- ---------------------------------------------------------------------------
  update public.ogrenciler set aktif = false where id = o2;
  drop table gr;
  execute 'create temp table gr as ' || rapor;

  if not exists (select 1 from gr where bolum = '4 · ÖĞRENCİ'
                   and kim like 'İkinci%' and ayrinti like 'ÖĞRENCİ PASİF%') then
    raise exception '6a BAŞARISIZ — pasif öğrenci görünmüyor: %',
      (select string_agg(kim || ' → ' || ayrinti, ' | ') from gr where bolum = '4 · ÖĞRENCİ');
  end if;
  select count(*) into n from gr where bolum = '4 · ÖĞRENCİ';
  if n <> 1 then
    raise exception '6b BAŞARISIZ — yalnız pasif öğrenci beklenirken %', n;
  end if;
  update public.ogrenciler set aktif = true where id = o2;
  raise notice '    pasif öğrenci adıyla görünüyor: OK';

  -- ---------------------------------------------------------------------------
  raise notice '--- 7. ÖDEV BU ÖĞRENCİYE DÜŞMÜYOR (0064) ---';
  -- ---------------------------------------------------------------------------
  -- Öğrenci sınıfa ödevin son tarihinden ve verilişinden SONRA geldi.
  update public.odevler set son_tarih = current_date + 2 where id = d_yeni;
  update public.ogrenciler set sinif_giris = current_date + 5 where id = o3;
  drop table gr;
  execute 'create temp table gr as ' || rapor;

  if not exists (select 1 from gr where bolum = '4 · ÖĞRENCİ'
                   and kim like 'Üçüncü%' and ayrinti like 'ÖDEV BU ÖĞRENCİYE DÜŞMÜYOR%') then
    raise exception '7a BAŞARISIZ — sınıfa sonradan gelen öğrenci görünmüyor: %',
      (select string_agg(kim || ' → ' || ayrinti, ' | ') from gr where bolum = '4 · ÖĞRENCİ');
  end if;
  if not exists (select 1 from gr where bolum = '4 · ÖĞRENCİ'
                   and kim like 'Üçüncü%' and ayrinti like '%sınıfa giriş%') then
    raise exception '7b BAŞARISIZ — sınıfa giriş tarihi satırda yazmıyor';
  end if;
  update public.ogrenciler set sinif_giris = null where id = o3;
  raise notice '    sınıf listesi esası kapısı görünüyor: OK';

  -- ---------------------------------------------------------------------------
  raise notice '--- 8. GÖNDEREN öğrenci engelli sayılmıyor ---';
  -- ---------------------------------------------------------------------------
  update public.odevler set son_tarih = current_date - 3 where id = d_yeni;
  insert into public.gonderimler (odev_id, ogrenci_id, foto_yolu, durum)
  values (d_yeni, o1, 'cozum/' || d_yeni || '/' || o1 || '.jpg', 'incelemede');
  drop table gr;
  execute 'create temp table gr as ' || rapor;

  if exists (select 1 from gr where bolum = '4 · ÖĞRENCİ' and kim like 'Birinci%') then
    raise exception '8a BAŞARISIZ — gönderen öğrenci engelli sayıldı';
  end if;
  select ayrinti into t from gr where bolum = '0 · OZET';
  if t not like '%2''i gönderemiyor%' then
    raise exception '8b BAŞARISIZ — özet sayısı yanlış: %', t;
  end if;
  raise notice '    gönderen sayılmıyor, özet 2 diyor: OK';

  -- ---------------------------------------------------------------------------
  raise notice '--- 9. KARDEŞ ŞUBELER tarih farkını gösteriyor ---';
  -- ---------------------------------------------------------------------------
  -- ÖĞRETMENİN BİLDİRDİĞİ DURUMUN TAM KENDİSİ: 9Z'nin tarihi uzatılmış,
  -- 10B'ninki geçmişte kalmış. 0088 öncesi `odev_kardeslere_yay` son
  -- tarihi taşımıyor ve fark tam böyle doğuyor.
  update public.odevler set grup_id = gen_random_uuid() where id = d_yeni;
  insert into public.odevler (baslik, sinif_id, tur, son_tarih, soru_sayisi,
                              cevap_anahtari, yayinda, gec_teslim, ogretmen_id, grup_id)
  select 'Son Ödev ' || ek, v_9z, 'test', current_date + 10, 2,
         '{"1":"A","2":"B"}'::jsonb, true, false, s_id, d.grup_id
    from public.odevler d where d.id = d_yeni
  returning id into d_kardes;
  drop table gr;
  execute 'create temp table gr as ' || rapor;

  select count(*) into n from gr where bolum = '3 · KARDEŞ ŞUBELER';
  if n <> 2 then
    raise exception '9a BAŞARISIZ — iki kardeş satırı beklenirken %', n;
  end if;
  if not exists (select 1 from gr where bolum = '3 · KARDEŞ ŞUBELER'
                   and kim like '9Z%' and ayrinti like '%' || (current_date + 10)::text || '%') then
    raise exception '9b BAŞARISIZ — 9Z''nin ileri tarihi görünmüyor: %',
      (select string_agg(kim || ' → ' || ayrinti, ' | ') from gr where bolum = '3 · KARDEŞ ŞUBELER');
  end if;
  if not exists (select 1 from gr where bolum = '3 · KARDEŞ ŞUBELER'
                   and kim like '10B%' and ayrinti like '%BU SINIF%') then
    raise exception '9c BAŞARISIZ — incelenen şube işaretlenmemiş';
  end if;
  raise notice '    iki şube yan yana, tarih farkı görünüyor: OK';

  -- ---------------------------------------------------------------------------
  raise notice '--- 10. DEPODA DURAN AMA GÖNDERİMİ OLMAYAN DOSYA ---';
  -- ---------------------------------------------------------------------------
  -- o2 fotoğrafını yükledi, "Gönder" adımı düştü.
  insert into storage.objects (bucket_id, name)
  values ('odev-dosyalari', 'cozum/' || d_yeni || '/' || o2 || '.jpg');
  -- o1 hem yükledi hem gönderdi: öksüz DEĞİL.
  insert into storage.objects (bucket_id, name)
  values ('odev-dosyalari', 'cozum/' || d_yeni || '/' || o1 || '.jpg');
  drop table gr;
  execute 'create temp table gr as ' || rapor;

  select count(*) into n from gr where bolum = '5 · DEPODA DURAN DOSYA';
  if n <> 1 then
    raise exception '10a BAŞARISIZ — bir öksüz dosya beklenirken %: %',
      n, (select string_agg(kim || ' → ' || ayrinti, ' | ')
            from gr where bolum = '5 · DEPODA DURAN DOSYA');
  end if;
  if not exists (select 1 from gr where bolum = '5 · DEPODA DURAN DOSYA'
                   and kim like 'İkinci%') then
    raise exception '10b BAŞARISIZ — öksüz dosyanın sahibi yanlış';
  end if;
  -- UUID TİRESİ TUZAĞI: kimlik `-` ile kesilseydi hiçbir şey bulunamazdı
  -- (`oksuz-cozum-raporu.sql`de ölçülmüştü). Sahibin ADI çözülüyorsa
  -- kimlik doğru okunmuş demektir — yukarıdaki 10b tam bunu ölçüyor.
  raise notice '    yüklenmiş ama gönderilmemiş sayfa görünüyor, gönderilmiş olan görünmüyor: OK';

  -- ---------------------------------------------------------------------------
  raise notice '--- 11. "Son ödev" EN SON VERİLEN ödev ---';
  -- ---------------------------------------------------------------------------
  -- Son tarihi daha İLERİDE ama DAHA ÖNCE verilmiş bir ödev, "son ödev"
  -- olmamalı. Sıralama `created_at`e göre: öğretmenin sorduğu şey "en son
  -- verdiğim ödev".
  insert into public.odevler (baslik, sinif_id, tur, son_tarih, soru_sayisi,
                              cevap_anahtari, yayinda, gec_teslim, ogretmen_id, created_at)
  values ('Eski Ama Uzun Ödev ' || ek, v_10b, 'test', current_date + 30, 2,
          '{"1":"A","2":"B"}'::jsonb, true, false, s_id, now() - interval '20 days')
  returning id into d_eski;
  drop table gr;
  execute 'create temp table gr as ' || rapor;

  select ayrinti into t from gr where bolum = '0 · OZET';
  if t not like '%Son Ödev%' then
    raise exception '11a BAŞARISIZ — özet en son VERİLEN ödevi almıyor: %', t;
  end if;
  if t like '%Eski Ama Uzun%' then
    raise exception '11b BAŞARISIZ — özet eski ödevi "son ödev" sandı: %', t;
  end if;
  -- Eski ödev yine de 1. bölümde listeleniyor: hangisinin "son" olduğu
  -- belirsiz kalmasın diye son üç ödev birden yazılıyor.
  if not exists (select 1 from gr where bolum = '1 · ÖDEV' and kim like '%Eski Ama Uzun%') then
    raise exception '11c BAŞARISIZ — önceki ödevler listelenmiyor';
  end if;
  raise notice '    "son ödev" = en son VERİLEN; öncekiler yine listede: OK';

  drop table gr;
  raise notice '';
  raise notice 'GÖNDEREMİYOR RAPORU TESTLERİ GEÇTİ (11 grup)';
end $$;
