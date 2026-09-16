-- =============================================================================
-- SEKİZ — KOPYA ÖĞRENCİ TEMİZLİĞİ TESTLERİ
--
-- Bu dosya SİLEN bir betiği sınıyor, o yüzden ağırlığı "siliyor mu"da
-- değil **SİLMEMESİ GEREKENİ SİLMİYOR MU**da.
--
-- Yanlış silinen bir öğrenci geri gelmez: ödevleri, notları, veli
-- yazışması ve onamı `on delete cascade` ile birlikte gider. Bu yüzden
-- 4. grup (kullanılmış kopyaya dokunmama) bu dosyanın asıl ölçümüdür;
-- ötekiler onun etrafındaki çit.
--
-- ## ÖLÇÜLEN ŞEY, ÖĞRETMENİN YAPIŞTIRACAĞI DOSYANIN KENDİSİ
--
-- Test kendi silme sorgusunu TAŞIMIYOR. `panel-icin/` altındaki iki
-- dosyanın metnini okuyup aynen çalıştırıyor. 0041'de öğrenilen ders
-- buydu: ölçüm, çalışan kodun kopyasını ölçerse, kopya ile asıl ayrıştığı
-- gün test yeşil kalır ve yanılır.
--
-- Dosyalar depo kökünden okunuyor; `calistir.sh` `SEKIZ_KOK`u veriyor.
-- Tek başına çalıştırmak için depo kökünden çağırın.
--
-- KURULAN DÜNYA — 6K sınıfında altı kayıt, 6L'de bir tane:
--   · "Temiz Kopya"        numarasız, 6K'da numaralı ikizi VAR,
--                          hiç kullanılmamış            → SİLİNMELİ
--   · "TEMİZ  KOPYA"       numaralı (ikiz; büyük harf ve çift boşlukla
--                          yazıldı — ad eşleştirmesi bunu aynı kişi
--                          saymalı)                     → KALMALI
--   · "Kullanılmış Kopya"  numarasız, ikizi VAR, GÖNDERİMİ VAR
--                          → KALMALI (asıl ölçüm)
--   · "Kullanılmış Kopya"  numaralı (ikiz)              → KALMALI
--   · "Tekil Öğrenci"      numarasız, ikizi YOK         → KALMALI
--   · "Komşu Sınıf Adaşı"  numarasız; aynı adda numaralı kayıt BAŞKA
--                          sınıfta (6L)                 → KALMALI
-- =============================================================================
\set ON_ERROR_STOP on

-- Dosyaların metni okunuyor. Sondaki `;` kırpılıyor: metin bir alt
-- sorgu olarak `create temp table ... as` içine yerleşecek.
\set rapor_sql `sed 's/;[[:space:]]*$//' "${SEKIZ_KOK:-.}/supabase/panel-icin/kopya-ogrenci-raporu.sql"`
\set sil_sql   `sed 's/;[[:space:]]*$//' "${SEKIZ_KOK:-.}/supabase/panel-icin/kopya-ogrenci-sil.sql"`

select set_config('sekiz.rapor_sql', :'rapor_sql', false) is not null
   and set_config('sekiz.sil_sql',   :'sil_sql',   false) is not null as okundu;

do $$
declare
  rapor_metni text := coalesce(current_setting('sekiz.rapor_sql', true), '');
  sil_metni   text := coalesce(current_setting('sekiz.sil_sql', true), '');
  v_s     uuid;
  v_s2    uuid;
  v_ogr   uuid;
  v_odev  uuid;
  temiz_kopya   uuid;
  temiz_ikiz    uuid;
  kul_kopya     uuid;
  kul_ikiz      uuid;
  tekil         uuid;
  komsu_adas    uuid;
  komsu_ikiz    uuid;
  once_aktif  integer;
  sonra_aktif integer;
  n integer;
  t text;
begin
  -- ---------------------------------------------------------------------------
  -- 0. DOSYALAR GERÇEKTEN OKUNDU MU
  --
  -- Bu olmadan boş bir metin sessizce "hiçbir şey silinmedi" üretir ve
  -- aşağıdaki bütün "silinmedi" ölçümleri yeşil yanardı. Ölçümün en
  -- tehlikeli hâli, ölçmeden geçmesidir.
  -- ---------------------------------------------------------------------------
  -- Geçici tablolar önceki bir çalıştırmadan kalmış olabilir; "yok, atlandı"
  -- uyarıları çıktıyı kirletmesin diye sessizce düşürülüyor.
  set local client_min_messages = warning;
  drop table if exists rapor_ciktisi;
  drop table if exists rapor_ciktisi_2;
  drop table if exists sil_ozeti;
  drop table if exists sil_ozeti_2;
  set local client_min_messages = notice;

  -- Çıpa, ölçülen davranışlardan biri DEĞİL: aksi hâlde o davranış
  -- bozulduğunda "dosya okunamadı" diye yanlış yere işaret ederdi.
  if position('delete from public.ogrenciler' in sil_metni) = 0 then
    raise exception '0a: silme dosyası okunamadı (% karakter) — SEKIZ_KOK doğru mu?',
      length(sil_metni);
  end if;
  if position('KORUNACAK' in rapor_metni) = 0 then
    raise exception '0b: rapor dosyası okunamadı (% karakter) — SEKIZ_KOK doğru mu?',
      length(rapor_metni);
  end if;

  -- ---------------------------------------------------------------------------
  -- DÜNYA KURULUYOR
  -- ---------------------------------------------------------------------------
  select id into v_ogr from public.ogretmenler where yonetici;

  insert into public.siniflar (seviye, sube) values (6, 'K')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_s;
  insert into public.siniflar (seviye, sube) values (6, 'L')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_s2;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
  values (v_ogr, v_s), (v_ogr, v_s2) on conflict do nothing;

  -- Temiz bir başlangıç: bu iki sınıfta başka kayıt kalmasın.
  delete from public.ogrenciler where sinif_id in (v_s, v_s2);

  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, ogrenci_no)
  values ('Temiz Kopya', 'okul', v_s, v_ogr, null) returning id into temiz_kopya;
  -- Büyük harf ve çift boşlukla: ad normalleştirmesi bunu aynı kişi saymalı.
  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, ogrenci_no)
  values ('TEMİZ  KOPYA', 'okul', v_s, v_ogr, '601') returning id into temiz_ikiz;

  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, ogrenci_no)
  values ('Kullanılmış Kopya', 'okul', v_s, v_ogr, null) returning id into kul_kopya;
  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, ogrenci_no)
  values ('Kullanılmış Kopya', 'okul', v_s, v_ogr, '602') returning id into kul_ikiz;

  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, ogrenci_no)
  values ('Tekil Öğrenci', 'okul', v_s, v_ogr, null) returning id into tekil;

  -- Adaşı BAŞKA sınıfta: sınıf şartı düşerse bu öğrenci silinir.
  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, ogrenci_no)
  values ('Komşu Sınıf Adaşı', 'okul', v_s, v_ogr, null) returning id into komsu_adas;
  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, ogrenci_no)
  values ('Komşu Sınıf Adaşı', 'okul', v_s2, v_ogr, '650') returning id into komsu_ikiz;

  -- Giriş kodları elle veriliyor (`ogrenci_ekle` normalde üretir, düz
  -- `insert` üretmez). KOD KULLANIM SAYILMAMALI: temiz kopyanın kodu
  -- olduğu hâlde silinmesi gerekiyor — 3. grup bunu da ölçüyor.
  insert into public.giris_kodlari (kod, ogrenci_id, rol) values
    ('TKOPYA01', temiz_kopya, 'ogrenci'),
    ('TIKIZ001', temiz_ikiz,  'ogrenci');

  -- KULLANILMIŞ kopyaya gerçek bir kayıt bağlanıyor: bir ödev gönderimi.
  insert into public.odevler (ogretmen_id, sinif_id, baslik, tur, son_tarih, yayinda)
  values (v_ogr, v_s, 'Temizlik Denemesi', 'acik',
          (now() at time zone 'Europe/Istanbul')::date + 1, true)
  returning id into v_odev;
  insert into public.gonderimler (odev_id, ogrenci_id, foto_yolu)
  values (v_odev, kul_kopya, 'test/temizlik.jpg');

  -- ---------------------------------------------------------------------------
  -- 1. BAŞLANGIÇ DOĞRU KURULDU MU (pozitif kontrol)
  --
  -- Bu olmadan aşağıdaki "silinmedi" ölçümleri, kayıtlar hiç oluşmamış
  -- olsa da yeşil kalırdı.
  -- ---------------------------------------------------------------------------
  select count(*) into n from public.ogrenciler where sinif_id = v_s and aktif;
  if n <> 6 then
    raise exception '1a: kurulumda 6K''da 6 öğrenci bekleniyordu, % var', n;
  end if;
  if not exists (select 1 from public.gonderimler where ogrenci_id = kul_kopya) then
    raise exception '1b: kullanılmış kopyaya gönderim bağlanmamış';
  end if;
  -- Kodlar kuruldu mu: 7. grup (cascade) buna dayanıyor.
  if not exists (select 1 from public.giris_kodlari where ogrenci_id = temiz_kopya) then
    raise exception '1c: silinecek öğrencinin giriş kodu yok — 7. grup ölçemez';
  end if;
  raise notice '1 OK — dünya kuruldu: 6K''da 6 öğrenci, biri kullanılmış kopya';

  -- ---------------------------------------------------------------------------
  -- 2. RAPOR — silmeden ÖNCE ne olacağını doğru anlatıyor mu
  --
  -- Rapor ile silme dosyası ayrı iki sorgu; ayrışırlarsa rapor, silmenin
  -- yapacağını yanlış anlatır. İkisi de aynı dünyada ölçülüyor.
  -- ---------------------------------------------------------------------------
  execute format('create temp table rapor_ciktisi as %s', rapor_metni);

  select aciklama into t from rapor_ciktisi
   where bolum like '1 %' and sinif = '6K';
  if t is distinct from 'toplam 6 · numaralı 2 · numarasız 4' then
    raise exception '2a: sınıf durumu yanlış: %', coalesce(t, '(satır yok)');
  end if;

  select aciklama into t from rapor_ciktisi
   where bolum like '2 %' and sinif = '6K';
  if t is null or t not like '1 kopya%' then
    raise exception '2b: silinecek sayısı 1 olmalıydı: %', coalesce(t, '(satır yok)');
  end if;

  select count(*) into n from rapor_ciktisi
   where bolum like '3 %' and ogrenci = 'Kullanılmış Kopya';
  if n <> 1 then
    raise exception '2c: kullanılmış kopya KORUNACAK bölümünde adıyla yok (% satır)', n;
  end if;

  -- Komşu sınıfın adaşı ne silinecekte ne korunacakta olmalı: o kopya değil.
  if exists (
    select 1 from rapor_ciktisi
     where bolum like '3 %' and ogrenci = 'Komşu Sınıf Adaşı'
  ) then
    raise exception '2d: farklı sınıftaki adaş kopya sayılmış';
  end if;
  raise notice '2 OK — rapor doğru sayıyor: 1 silinecek, 1 korunacak';

  -- ---------------------------------------------------------------------------
  -- 3. SİLME — yalnız TEMİZ kopya gitmeli
  -- ---------------------------------------------------------------------------
  select count(*) into once_aktif from public.ogrenciler where aktif;

  execute format('create temp table sil_ozeti as %s', sil_metni);

  if exists (select 1 from public.ogrenciler where id = temiz_kopya) then
    raise exception '3a: temiz kopya silinmedi';
  end if;
  raise notice '3 OK — temiz kopya silindi (büyük harfli ikizi tanındı)';

  -- ---------------------------------------------------------------------------
  -- 4. KULLANILMIŞ KOPYAYA DOKUNULMADI  ← BU DOSYANIN ASIL ÖLÇÜMÜ
  --
  -- Silinseydi ödev gönderimi de cascade ile giderdi: geri dönüşü olmayan
  -- bir kayıp.
  -- ---------------------------------------------------------------------------
  if not exists (select 1 from public.ogrenciler where id = kul_kopya) then
    raise exception '4a: KULLANILMIŞ kopya silindi — veri kaybı';
  end if;
  if not exists (select 1 from public.gonderimler where ogrenci_id = kul_kopya) then
    raise exception '4b: kullanılmış kopyanın gönderimi kayboldu';
  end if;
  raise notice '4 OK — kullanılmış kopyaya dokunulmadı, gönderimi duruyor';

  -- ---------------------------------------------------------------------------
  -- 5. YANLIŞ TARAF SİLİNMEDİ + İKİZİ OLMAYAN DURUYOR
  --
  -- "Numarası yok" tek başına silme sebebi değil; ikiz şartı düşerse
  -- numarası girilmemiş BÜTÜN öğrenciler silinirdi.
  -- ---------------------------------------------------------------------------
  if not exists (select 1 from public.ogrenciler where id = temiz_ikiz) then
    raise exception '5a: numaralı ikiz silindi — yanlış taraf';
  end if;
  if not exists (select 1 from public.ogrenciler where id = kul_ikiz) then
    raise exception '5b: numaralı ikiz silindi — yanlış taraf';
  end if;
  if not exists (select 1 from public.ogrenciler where id = tekil) then
    raise exception '5c: ikizi olmayan öğrenci silindi';
  end if;
  if not exists (select 1 from public.ogrenciler where id = komsu_adas) then
    raise exception '5d: adaşı BAŞKA sınıfta olan öğrenci silindi — sınıf şartı düşmüş';
  end if;

  select count(*) into n from public.ogrenciler where sinif_id = v_s and aktif;
  if n <> 5 then
    raise exception '5e: silmeden sonra 6K''da 5 öğrenci bekleniyordu, % var', n;
  end if;
  raise notice '5 OK — numaralı ikizler, tekil öğrenci ve komşu sınıf adaşı duruyor';

  -- ---------------------------------------------------------------------------
  -- 6. ÖZET SATIRI GERÇEĞİ ANLATIYOR MU
  --
  -- Öğretmen ne olduğunu yalnız bu satırdan okuyacak (panelde son ifadenin
  -- sonucu görünür). Yanlış sayı, yanlış güven demek.
  -- ---------------------------------------------------------------------------
  select count(*) into sonra_aktif from public.ogrenciler where aktif;
  select silindi into n from sil_ozeti;
  if n <> once_aktif - sonra_aktif then
    raise exception '6a: özet % silindi diyor, gerçekte % satır gitti',
      n, once_aktif - sonra_aktif;
  end if;
  select iz_yazildi into n from sil_ozeti;
  if n <> once_aktif - sonra_aktif then
    raise exception '6b: iz sayısı silinen sayısıyla tutmuyor';
  end if;
  select kalan_aktif into n from sil_ozeti;
  if n <> sonra_aktif then
    raise exception '6c: özet % kalan diyor, gerçekte % aktif', n, sonra_aktif;
  end if;
  select sinif_kirilimi into t from sil_ozeti;
  if t is null or position('6K' in t) = 0 then
    raise exception '6d: sınıf kırılımı 6K''yı göstermiyor: %', coalesce(t, '(boş)');
  end if;
  raise notice '6 OK — özet satırı gerçekle örtüşüyor: %', t;

  -- ---------------------------------------------------------------------------
  -- 7. CASCADE: silinenin kodları gitti, başkasınınki durdu
  -- ---------------------------------------------------------------------------
  if exists (select 1 from public.giris_kodlari where ogrenci_id = temiz_kopya) then
    raise exception '7a: silinen öğrencinin kodları kaldı';
  end if;
  if not exists (select 1 from public.giris_kodlari where ogrenci_id = temiz_ikiz) then
    raise exception '7b: kalan öğrencinin kodları da gitmiş';
  end if;
  raise notice '7 OK — silinenin kodları gitti, kalanınki durdu';

  -- ---------------------------------------------------------------------------
  -- 8. İZ BIRAKTI MI (Part XLIII)
  -- ---------------------------------------------------------------------------
  if not exists (
    select 1 from public.denetim_izi
    where islem = 'ogrenci_kopya_silindi' and kayit_id = temiz_kopya
  ) then
    raise exception '8a: silme denetim izine yazılmadı';
  end if;
  if exists (
    select 1 from public.denetim_izi
    where islem = 'ogrenci_kopya_silindi' and kayit_id = kul_kopya
  ) then
    raise exception '8b: silinmeyen öğrenci için iz yazılmış';
  end if;
  raise notice '8 OK — silme denetim izine yazıldı, yalnız silinen için';

  -- ---------------------------------------------------------------------------
  -- 9. TEKRAR ÇALIŞTIRMAK ZARARSIZ (idempotent)
  --
  -- Öğretmen dosyayı iki kez çalıştırabilir; ikincisi bir şey silmemeli.
  -- ---------------------------------------------------------------------------
  execute format('create temp table sil_ozeti_2 as %s', sil_metni);
  select silindi into n from sil_ozeti_2;
  if n <> 0 then
    raise exception '9a: ikinci çalıştırma % satır sildi', n;
  end if;
  select count(*) into n from public.ogrenciler where sinif_id = v_s and aktif;
  if n <> 5 then
    raise exception '9b: ikinci çalıştırmadan sonra 6K''da % öğrenci var', n;
  end if;
  raise notice '9 OK — ikinci çalıştırma hiçbir şey silmiyor';

  -- ---------------------------------------------------------------------------
  -- 10. RAPOR TEMİZLENMİŞ DÜNYAYI DA DOĞRU OKUYOR
  --
  -- Bu, 2. gruptaki sayıların sabit yazılmış olmadığını gösteriyor:
  -- dünya değişti, rapor da değişti.
  -- ---------------------------------------------------------------------------
  execute format('create temp table rapor_ciktisi_2 as %s', rapor_metni);
  if exists (select 1 from rapor_ciktisi_2 where bolum like '2 %' and sinif = '6K') then
    raise exception '10a: temizlikten sonra hâlâ silinecek kopya gösteriliyor';
  end if;
  select count(*) into n from rapor_ciktisi_2
   where bolum like '3 %' and ogrenci = 'Kullanılmış Kopya';
  if n <> 1 then
    raise exception '10b: kullanılmış kopya artık raporda görünmüyor';
  end if;
  select aciklama into t from rapor_ciktisi_2
   where bolum like '1 %' and sinif = '6K';
  if t is distinct from 'toplam 5 · numaralı 2 · numarasız 3' then
    raise exception '10c: temizlik sonrası sınıf durumu yanlış: %',
      coalesce(t, '(satır yok)');
  end if;
  raise notice '10 OK — rapor değişen dünyayı okuyor, sayıları sabit değil';

  -- TEMİZLİK
  delete from public.gonderimler where odev_id = v_odev;
  delete from public.odevler where id = v_odev;
  delete from public.ogrenciler where sinif_id in (v_s, v_s2);
  delete from public.denetim_izi where islem = 'ogrenci_kopya_silindi';
  set local client_min_messages = warning;
  drop table if exists rapor_ciktisi;
  drop table if exists rapor_ciktisi_2;
  drop table if exists sil_ozeti;
  drop table if exists sil_ozeti_2;
  set local client_min_messages = notice;

  raise notice '';
  raise notice 'KOPYA TEMİZLİK TESTLERİ: 10 GRUP GEÇTİ';
end $$;
