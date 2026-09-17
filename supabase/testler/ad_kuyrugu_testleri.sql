-- =============================================================================
-- SEKİZ — AD KUYRUĞU TEMİZLİĞİ TESTLERİ
--
-- `panel-icin/ad-kuyrugu-temizle.sql`, e-Okul listesinden adın sonuna
-- yapışmış CİNSİYET ve PANSİYON sütunlarını temizliyor:
--
--   "Ayşe Sarı Kız Yatılı"  →  "Ayşe Sarı"
--
-- Bu dosya TOPLU ve kendiliğinden çalışan bir düzeltme. O yüzden ağırlığı
-- "temizliyor mu"da değil, **TEMİZ ADLARA DOKUNMUYOR MU** (4. grup) ve
-- **BAŞKA HİÇBİR ŞEYİ DEĞİŞTİRMİYOR MU** (3. grup) sorularında. Yanlış
-- kırpılan bir soyadı, öğretmenin fark etmesi zor bir kayıptır.
--
-- İKİ ADIMLI: `sadece_bak = true` iken hiçbir şey yazmamalı (2. grup).
-- Öğretmen önce listeyi okuyacak; okumadan yazan bir betik, ona kararı
-- vermeden sonucu dayatır.
--
-- ## ÖLÇÜLEN ŞEY, ÖĞRETMENİN YAPIŞTIRACAĞI DOSYANIN KENDİSİ
--
-- Test kendi sorgusunu TAŞIMIYOR: panel dosyasının metnini okuyup yalnız
-- `girdi` bloğunu değiştirerek çalıştırıyor. Değiştirmenin gerçekten
-- olduğu da ölçülüyor — yoksa bütün gruplar dosyanın varsayılanlarıyla
-- (`sadece_bak = true`) koşar ve "yazmadı" ölçümleri bedavaya yeşil yanardı.
--
-- Dosya depo kökünden okunuyor; `calistir.sh` `SEKIZ_KOK`u veriyor.
-- =============================================================================
\set ON_ERROR_STOP on

\set kuyruk_sql `sed 's/;[[:space:]]*$//' "${SEKIZ_KOK:-.}/supabase/panel-icin/ad-kuyrugu-temizle.sql"`

select set_config('sekiz.kuyruk_sql', :'kuyruk_sql', false) is not null as okundu;

-- Panel dosyasını verilen girdiyle çalıştırıp satırlarını geçici tabloya alır.
create or replace function pg_temp._kuyruk(
  p_sadece_bak boolean, p_atlanacak text[]
) returns void language plpgsql as $$
declare
  dosya text := coalesce(current_setting('sekiz.kuyruk_sql', true), '');
  sorgu text;
begin
  sorgu := regexp_replace(
    dosya,
    '(-- ↓↓↓ DOLDURULACAK ALANLAR ↓↓↓).*?(-- ↑↑↑ DOLDURULACAK ALANLAR ↑↑↑)',
    E'\\1\n' || format(
      '%L::boolean as sadece_bak, %L::text[] as atlanacak_numaralar',
      p_sadece_bak, p_atlanacak
    ) || E'\n\\2',
    'sg'
  );
  -- DEĞİŞTİRME GERÇEKTEN OLDU MU.
  if position(format('%L::boolean as sadece_bak', p_sadece_bak) in sorgu) = 0 then
    raise exception 'girdi bloğu değiştirilemedi — dosyanın işaretleri mi değişti?';
  end if;
  -- "yok, atlandı" uyarısı çıktıyı kirletmesin.
  set local client_min_messages = warning;
  execute 'drop table if exists cikti';
  set local client_min_messages = notice;
  execute format('create temp table cikti as %s', sorgu);
end;
$$;

do $$
declare
  dosya text := coalesce(current_setting('sekiz.kuyruk_sql', true), '');
  v_ogr uuid; v_s uuid; v_odev uuid;
  ayse uuid; temiz uuid; kizil uuid; erkek_soyadi uuid; ozel uuid;
  buyuk uuid; hepsi_kuyruk uuid;
  n integer; t text;
begin
  if position('ogrenci_adi_duzeltildi' in dosya) = 0 then
    raise exception '0a: panel dosyası okunamadı (% karakter) — SEKIZ_KOK doğru mu?',
      length(dosya);
  end if;

  select id into v_ogr from public.ogretmenler where yonetici;
  insert into public.siniflar (seviye, sube) values (3, 'P')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_s;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
  values (v_ogr, v_s) on conflict do nothing;
  delete from public.ogrenciler where sinif_id = v_s;

  -- KURULAN DÜNYA
  --   · kuyruklu ad (asıl vaka)            → temizlenmeli
  --   · tertemiz ad                        → DOKUNULMAMALI
  --   · içinde "kız" geçen soyadı          → DOKUNULMAMALI (kelime kelime)
  --   · soyadı gerçekten "Erkek" olan      → temizlenir; öğretmen hariç tutabilmeli
  --   · BÜYÜK HARFLİ kuyruk ("… KIZ YATILI") → temizlenmeli
  --   · adın TAMAMI kuyruk ("Kız Yatılı")   → DOKUNULMAMALI (boş ad olurdu)
  --   · sınıfsız (özel ders) kuyruklu ad   → temizlenmeli
  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, ogrenci_no)
  values ('Ayşe Sarı Kız Yatılı', 'okul', v_s, v_ogr, '301') returning id into ayse;
  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, ogrenci_no)
  values ('Temiz Öğrenci', 'okul', v_s, v_ogr, '302') returning id into temiz;
  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, ogrenci_no)
  values ('Nehir Kızılkaya', 'okul', v_s, v_ogr, '303') returning id into kizil;
  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, ogrenci_no)
  values ('Kenan Erkek', 'okul', v_s, v_ogr, '304') returning id into erkek_soyadi;
  -- Düzeltme kapalıyken yapıştırılmış bir liste: kuyruk da BÜYÜK HARFLİ.
  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, ogrenci_no)
  values ('AYŞE KAYA KIZ YATILI', 'okul', v_s, v_ogr, '305') returning id into buyuk;
  -- Adın tamamı sütun değeri: kırpılsa geriye BOŞ AD kalırdı.
  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, ogrenci_no)
  values ('Kız Yatılı', 'okul', v_s, v_ogr, '306') returning id into hepsi_kuyruk;
  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, ogrenci_no)
  values ('Derya Bulut Erkek Gündüzlü', 'ozel', null, v_ogr, null) returning id into ozel;

  insert into public.giris_kodlari (kod, ogrenci_id, rol)
  values ('KUYRUK01', ayse, 'ogrenci'), ('KUYRUK02', ayse, 'veli');

  insert into public.odevler (ogretmen_id, sinif_id, baslik, tur, son_tarih, yayinda)
  values (v_ogr, v_s, 'Kuyruk Denemesi', 'acik',
          (now() at time zone 'Europe/Istanbul')::date + 1, true)
  returning id into v_odev;
  insert into public.gonderimler (odev_id, ogrenci_id, foto_yolu)
  values (v_odev, ayse, 'test/kuyruk.jpg');

  -- ---------------------------------------------------------------------------
  -- 1. BAŞLANGIÇ (pozitif kontrol)
  -- ---------------------------------------------------------------------------
  select count(*) into n from public.ogrenciler where sinif_id = v_s and aktif;
  if n <> 6 then raise exception '1a: 3P''de 6 öğrenci bekleniyordu, %', n; end if;
  if position('-- ↓↓↓ DOLDURULACAK ALANLAR ↓↓↓' in dosya) = 0 then
    raise exception '1b: girdi bloğunun işaretleri bulunamadı';
  end if;
  raise notice '1 OK — dünya kuruldu, panel dosyası okundu';

  -- ---------------------------------------------------------------------------
  -- 2. SADECE BAK — HİÇBİR ŞEY YAZMIYOR
  --
  -- Öğretmen kararı listeyi okuduktan sonra veriyor. Okumadan yazan bir
  -- betik, kararı ona bırakmış olmaz.
  -- ---------------------------------------------------------------------------
  perform pg_temp._kuyruk(true, '{}'::text[]);

  select ad into t from public.ogrenciler where id = ayse;
  if t is distinct from 'Ayşe Sarı Kız Yatılı' then
    raise exception '2a: sadece_bak açıkken ad DEĞİŞTİ: %', t;
  end if;
  if exists (select 1 from public.denetim_izi
              where islem = 'ogrenci_adi_duzeltildi' and kayit_id = ayse) then
    raise exception '2b: sadece_bak açıkken iz yazıldı';
  end if;
  -- Ama ÖNERİYİ göstermeli: göstermeyen bir "bak" adımı işe yaramaz.
  select yeni_ad into t from cikti where bolum = '1 · AD' and numara = '301';
  if t is distinct from 'Ayşe Sarı' then
    raise exception '2c: önerilen ad yanlış ya da yok: %', coalesce(t, '(satır yok)');
  end if;
  select aciklama into t from cikti where bolum = '0 · ÖZET';
  if t is null or position('HİÇBİR ŞEY DEĞİŞMEDİ' in t) = 0 then
    raise exception '2d: özet, hiçbir şeyin değişmediğini söylemiyor: %', t;
  end if;
  raise notice '2 OK — sadece_bak hiçbir şey yazmadı, öneriyi gösterdi';

  -- ---------------------------------------------------------------------------
  -- 3. DÜZELTME — kuyruk gitti, BAŞKA HİÇBİR ŞEY DEĞİŞMEDİ
  -- ---------------------------------------------------------------------------
  perform pg_temp._kuyruk(false, '{}'::text[]);

  select ad into t from public.ogrenciler where id = ayse;
  if t is distinct from 'Ayşe Sarı' then
    raise exception '3a: kuyruk temizlenmedi: %', t;
  end if;
  if (select ogrenci_no from public.ogrenciler where id = ayse) is distinct from '301' then
    raise exception '3b: okul numarası değişti';
  end if;
  if not exists (select 1 from public.giris_kodlari
                  where ogrenci_id = ayse and rol = 'ogrenci' and kod = 'KUYRUK01') then
    raise exception '3c: GİRİŞ KODU değişti — dağıtılmış kâğıt geçersiz olurdu';
  end if;
  select count(*) into n from public.giris_kodlari where ogrenci_id = ayse;
  if n <> 2 then raise exception '3d: kod sayısı % oldu', n; end if;
  if not exists (select 1 from public.gonderimler where ogrenci_id = ayse) then
    raise exception '3e: ödev gönderimi koptu';
  end if;
  if not exists (select 1 from public.ogrenciler where id = ayse and aktif) then
    raise exception '3f: kayıt pasifleşti ya da kimliği değişti';
  end if;
  -- BÜYÜK HARFLİ kuyruk da kesilmeli. `/i` bayrağı ya da düz `lower()`
  -- Türkçe'nin İ/ı çiftini bilmiyor: "KIZ" ile "kız" eşleşmez.
  if (select ad from public.ogrenciler where id = buyuk)
     is distinct from 'AYŞE KAYA' then
    raise exception '3g: BÜYÜK HARFLİ kuyruk kesilmedi: %',
      (select ad from public.ogrenciler where id = buyuk);
  end if;
  raise notice '3 OK — kuyruk gitti (büyük harfli dâhil); kod, numara, gönderim yerinde';

  -- ---------------------------------------------------------------------------
  -- 4. TEMİZ ADLARA DOKUNULMADI  ← BU DOSYANIN ASIL ÖLÇÜMÜ
  --
  -- Toplu ve kendiliğinden çalışan bir düzeltmenin en tehlikeli hâli,
  -- düzeltilmesi gerekmeyene dokunmasıdır: yanlış kırpılmış bir soyadını
  -- öğretmenin fark etmesi zordur.
  -- ---------------------------------------------------------------------------
  if (select ad from public.ogrenciler where id = temiz)
     is distinct from 'Temiz Öğrenci' then
    raise exception '4a: temiz ad değişti';
  end if;
  -- "Kızılkaya" içinde "kız" geçiyor: KELİME KELİME bakılmasaydı kırpılırdı.
  if (select ad from public.ogrenciler where id = kizil)
     is distinct from 'Nehir Kızılkaya' then
    raise exception '4b: "Kızılkaya" soyadı kırpıldı — kelime kelime bakılmıyor';
  end if;
  -- ADIN TAMAMI KUYRUKSA DOKUNULMUYOR: kırpılsaydı geriye boş bir ad
  -- kalırdı ve öğrenci ekranlarda adsız görünürdü. Böyle bir kayda elle
  -- bakmak gerekir; betik onu sessizce bozmamalı.
  if (select ad from public.ogrenciler where id = hepsi_kuyruk)
     is distinct from 'Kız Yatılı' then
    raise exception '4c: adın tamamı kuyruk olan kayıt bozuldu: "%"',
      (select ad from public.ogrenciler where id = hepsi_kuyruk);
  end if;
  raise notice '4 OK — temiz adlar, "Kızılkaya" ve tamamı-kuyruk kayıt korundu';

  -- ---------------------------------------------------------------------------
  -- 5. SINIFSIZ (ÖZEL DERS) ÖĞRENCİ DE TEMİZLENİYOR
  -- ---------------------------------------------------------------------------
  if (select ad from public.ogrenciler where id = ozel)
     is distinct from 'Derya Bulut' then
    raise exception '5a: sınıfsız öğrencinin kuyruğu temizlenmedi: %',
      (select ad from public.ogrenciler where id = ozel);
  end if;
  raise notice '5 OK — sınıfsız öğrenci de kapsamda';

  -- ---------------------------------------------------------------------------
  -- 6. DENETİM İZİ (Part XLIII) — eski ve yeni adla
  -- ---------------------------------------------------------------------------
  if not exists (
    select 1 from public.denetim_izi
    where islem = 'ogrenci_adi_duzeltildi' and kayit_id = ayse
      and eski->>'ad' = 'Ayşe Sarı Kız Yatılı' and yeni->>'ad' = 'Ayşe Sarı'
  ) then
    raise exception '6a: düzeltme denetim izine eski/yeni adla yazılmadı';
  end if;
  raise notice '6 OK — düzeltme izde, eski ve yeni adıyla';

  -- ---------------------------------------------------------------------------
  -- 7. İKİNCİ ÇALIŞTIRMA ZARARSIZ (idempotent)
  -- ---------------------------------------------------------------------------
  perform pg_temp._kuyruk(false, '{}'::text[]);
  select count(*) into n from cikti where bolum = '1 · AD';
  if n <> 0 then
    raise exception '7a: ikinci çalıştırmada hâlâ % kuyruk görünüyor', n;
  end if;
  if (select ad from public.ogrenciler where id = ayse) is distinct from 'Ayşe Sarı' then
    raise exception '7b: ikinci çalıştırma adı bozdu';
  end if;
  raise notice '7 OK — ikinci çalıştırma hiçbir şey değiştirmiyor';

  -- ---------------------------------------------------------------------------
  -- 8. HARİÇ TUTMA İŞE YARIYOR
  --
  -- Soyadı gerçekten "Erkek" olan öğrenci: dosya onu kuyruk sanıyor ve
  -- sanması KAÇINILMAZ — satıra bakarak ayırt edilemez. Öğretmenin elinde
  -- kalan tek koruma bu liste; işe yaramazsa "önce bak" adımının da
  -- anlamı kalmaz.
  -- ---------------------------------------------------------------------------
  -- 3. grup zaten hariçsiz çalıştı ve bu adı kırptı; sahneyi geri kuruyoruz.
  -- (Kurmasaydık 8a, kırpma hiç çalışmasa da yeşil kalırdı.)
  update public.ogrenciler set ad = 'Kenan Erkek' where id = erkek_soyadi;

  perform pg_temp._kuyruk(false, array['304']::text[]);
  if (select ad from public.ogrenciler where id = erkek_soyadi)
     is distinct from 'Kenan Erkek' then
    raise exception '8a: hariç tutulan öğrencinin adı değişti: %',
      (select ad from public.ogrenciler where id = erkek_soyadi);
  end if;

  -- Hariç tutulmazsa kırpılıyor — bu da ölçülüyor: "hariç tutma işe
  -- yarıyor" iddiası, ancak kırpmanın gerçekten olduğunu görürsek anlamlı.
  perform pg_temp._kuyruk(false, '{}'::text[]);
  if (select ad from public.ogrenciler where id = erkek_soyadi)
     is distinct from 'Kenan' then
    raise exception '8b: hariç tutulmayınca kırpılmadı — 8a bedavaya geçmiş olurdu';
  end if;
  raise notice '8 OK — hariç tutma koruyor, tutulmayınca kırpıyor';

  -- TEMİZLİK
  delete from public.gonderimler where odev_id = v_odev;
  delete from public.odevler where id = v_odev;
  delete from public.ogrenciler where sinif_id = v_s or id = ozel;
  delete from public.denetim_izi where islem = 'ogrenci_adi_duzeltildi';
  set local client_min_messages = warning;
  execute 'drop table if exists cikti';
  set local client_min_messages = notice;

  raise notice '';
  raise notice 'AD KUYRUĞU TESTLERİ: 8 GRUP GEÇTİ';
end $$;
