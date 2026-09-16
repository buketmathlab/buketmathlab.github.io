-- SEKİZ — 0043: Toplu eklemede mevcut öğrenciyi eşleştir
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Açıklamalı tam sürüm: supabase/migrations/0043_toplu_eslestirme.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Yedek)
-- ÖNCE SİTE YAYINA ALINMIŞ OLMALI.
--
-- NE YAPIYOR: Toplu öğrenci eklerken, sınıfta ZATEN KAYITLI bir ad
-- bulunursa artık ikinci bir kayıt açılmıyor; o öğrencinin okul numarası
-- yazılıyor. Giriş kodları DEĞİŞMİYOR — dağıttığınız kâğıtlar geçerli
-- kalıyor.
--
-- KARARI SİZ VERİYORSUNUZ: önizlemede "N öğrenci sınıfta zaten kayıtlı,
-- M tanesi yeni" yazıyor ve iki seçenek sunuluyor. Varsayılan, eşleşen
-- varsa "numarasını güncelle" — kopya üretmek, numara yazmaktan çok daha
-- pahalı bir hata.
--
-- SINIFTA AYNI ADDA İKİ ÖĞRENCİ VARSA: hangisinin numarası yazılacağı
-- belirsiz olduğu için HATA verilir ve HİÇBİR ŞEY yazılmaz. Hata, adı
-- söyler. Önce `kopya-ogrenci-raporu.sql` ile bakın.
--
-- Veri silinmiyor, mevcut öğrenciler etkilenmiyor.

-- -----------------------------------------------------------------------------
-- 1. AD ANAHTARI — "ALİ  YILMAZ" ile "Ali Yılmaz" aynı kişi
--
-- e-Okul listeleri adları BÜYÜK HARFLE veriyor, elle yazılanlar karışık.
-- Aradaki boşluk da bir ya da iki olabiliyor. Eşleştirme bunlara takılmamalı.
--
-- TÜRKÇE HARFLER ELLE ÇEVRİLİYOR. `lower()` veritabanının diline bağlı ve
-- "İ" harfini bozabiliyor (`lower(x, 'tr')` diye bir şey de yok).
-- `translate` ile Türkçe büyük harfler karşılıklarına çevriliyor, kalanı
-- `lower()` hallediyor: sonuç dil ayarından bağımsız.
--
-- PANEL DOSYALARI BU YARDIMCIYI ÇAĞIRMIYOR, aynı ifadeyi kendi içlerinde
-- taşıyor. Bilerek: temizlik dosyaları bu migration ÇALIŞMADAN ÖNCE de
-- çalışabilmeli. İki kopya da ayrı ayrı ölçülüyor — buradaki
-- `toplu_eslestirme_testleri`nde zor adlarla, oradaki
-- `kopya_temizlik_testleri`nde panel dosyasının kendisi çalıştırılarak.
-- -----------------------------------------------------------------------------
create or replace function public._ad_anahtari(p_ad text)
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select regexp_replace(
    lower(translate(btrim(coalesce(p_ad, '')), 'İIĞÜŞÖÇ', 'iığüşöç')),
    '\s+', ' ', 'g'
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. TOPLU EKLEME — YENİ PARAMETRE, ESKİ İMZA DÜŞÜYOR
--
-- 0007 TUZAĞI BURADA GERÇEK. Varsayılanlı bir parametre eklemek YENİ bir
-- fonksiyon yaratıyor; eski 4 parametreli imza ortada kalırsa PostgREST
-- çağrıyı ona da yönlendirebilir ve **eşleştirme hiç çalışmaz** — öğretmen
-- seçeneği işaretler, kopyalar yine üretilir. Eski imza dosyanın sonunda
-- açıkça düşürülüyor ve düştüğü sınanıyor.
--
-- BAYRAK VARSAYILAN OLARAK KAPALI: eski bir arayüz sürümü geride kalırsa
-- bugünkü davranışı aynen sürdürsün, sessizce kayıt güncellemeye başlamasın.
-- -----------------------------------------------------------------------------
create or replace function public.ogrenciler_toplu_ekle(
  p_token text,
  p_tur text,
  p_sinif_id uuid,
  p_adlar jsonb,
  p_mevcutlari_guncelle boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  ogel       jsonb;
  v_ad       text;
  v_no       text;
  v_anahtar  text;
  sira       integer := 0;
  adet       integer;
  eslesme    integer;
  yeni_id    uuid;
  mevcut_id  uuid;
  eski_no    text;
  kod_ogr    text;
  kod_veli   text;
  durum      text;
  -- BU ÇAĞRIDA DOKUNULAN KAYITLAR eşleştirmenin dışında tutuluyor.
  --
  -- Yoksa listede aynı ad iki kez geçtiğinde ikinci satır, az önce eklenen
  -- birinci satırı "mevcut öğrenci" sanıp ONUN numarasını ezerdi: iki
  -- adaştan biri kayıt dışı kalırdı. Gerçek adaşlar bir sınıfta olur.
  dokunulan  uuid[] := '{}';
  sonuc      jsonb := '[]'::jsonb;
  n_eklendi     integer := 0;
  n_guncellendi integer := 0;
  n_degismedi   integer := 0;
  v_ogretmen uuid;
begin
  -- Okul öğrencisi toplu eklemek okul düzeyinde bir iş: sahipte.
  v_ogretmen := public._yonetici(p_token);

  if p_tur is null or p_tur not in ('okul', 'ozel') then
    raise exception 'Öğrenci türü ''okul'' ya da ''ozel'' olmalı.'
      using errcode = '22023';
  end if;

  -- `ogrenci_ekle`'deki kuralın aynısı (0004): okul öğrencisi sınıfsız olamaz.
  if p_tur = 'okul' and p_sinif_id is null then
    raise exception 'Okul öğrencisi için sınıf seçilmeli.' using errcode = '22023';
  end if;

  if p_adlar is null or jsonb_typeof(p_adlar) <> 'array' then
    raise exception 'Ad listesi bir dizi olmalı.' using errcode = '22023';
  end if;

  adet := jsonb_array_length(p_adlar);
  if adet = 0 then
    raise exception 'Listede hiç ad yok.' using errcode = '22023';
  end if;

  -- ÜST SINIR. Bir sınıf ~35 kişi; 200 hem fazlasıyla rahat hem de tek bir
  -- isteğin veritabanında ne kadar iş yapabileceğini sınırlıyor.
  if adet > 200 then
    raise exception 'Tek seferde en fazla 200 öğrenci eklenebilir; % ad gönderildi.', adet
      using errcode = '22023';
  end if;

  -- ---------------------------------------------------------------------------
  -- ÖNCE HEPSİNİ DENETLE, SONRA YAZ
  --
  -- DÜRÜST OLMAK GEREKİRSE: atomikliği bu ayrı geçiş SAĞLAMIYOR. Fonksiyon
  -- hata fırlattığında PostgreSQL zaten bütün ifadeyi geri alıyor — tek
  -- geçişle yazsaydık da yarım kayıt kalmazdı. Ayrı geçişin kazandırdığı
  -- şey BOŞA İŞ YAPMAMAK: 200 adlık bir listede 200. ad bozuksa, önce 199
  -- öğrenci ve 398 kod üretip sonra hepsini çöpe atmıyoruz. `_yeni_kod`
  -- her çağrıda çakışma sorgusu yapıyor; o iş de boşa gitmiyor.
  -- ---------------------------------------------------------------------------
  for ogel in select jsonb_array_elements(p_adlar) loop
    sira := sira + 1;
    v_ad := btrim(coalesce(public._toplu_ad(ogel), ''));
    v_no := public._toplu_no(ogel);

    if v_ad = '' then
      raise exception '%. satırdaki ad boş. Hiçbir öğrenci eklenmedi.', sira
        using errcode = '22023';
    end if;
    if length(v_ad) > 100 then
      raise exception '%. satırdaki ad 100 karakterden uzun. Hiçbir öğrenci eklenmedi.', sira
        using errcode = '22023';
    end if;
    if v_no is not null and length(v_no) > 20 then
      raise exception '%. satırdaki numara 20 karakterden uzun. Hiçbir öğrenci eklenmedi.', sira
        using errcode = '22023';
    end if;

    -- BELİRSİZLİK ÖNCEDEN YAKALANIYOR.
    --
    -- Sınıfta aynı adda BİRDEN FAZLA aktif öğrenci varsa hangisinin
    -- numarası yazılacağı bilinmiyor. Tahmin etmek, YANLIŞ ÇOCUĞUN
    -- kaydını değiştirmek demek. Hiçbir şey yazılmadan duruluyor ve hata
    -- adı söylüyor ki öğretmen hangi satıra bakacağını bilsin.
    if p_mevcutlari_guncelle then
      select count(*) into eslesme
      from public.ogrenciler o
      where o.aktif
        and o.sinif_id is not distinct from p_sinif_id
        and public._ad_anahtari(o.ad) = public._ad_anahtari(v_ad);

      if eslesme > 1 then
        raise exception
          'Sınıfta "%" adında % aktif öğrenci var; hangisinin numarası yazılacağı belirsiz. Hiçbir şey değiştirilmedi.',
          v_ad, eslesme using errcode = '22023';
      end if;
    end if;
  end loop;

  -- ---------------------------------------------------------------------------
  -- YAZMA
  -- ---------------------------------------------------------------------------
  for ogel in select jsonb_array_elements(p_adlar) loop
    v_ad := btrim(public._toplu_ad(ogel));
    v_no := public._toplu_no(ogel);
    v_anahtar := public._ad_anahtari(v_ad);
    mevcut_id := null;

    if p_mevcutlari_guncelle then
      select o.id, o.ogrenci_no into mevcut_id, eski_no
      from public.ogrenciler o
      where o.aktif
        and o.sinif_id is not distinct from p_sinif_id
        and public._ad_anahtari(o.ad) = v_anahtar
        and not (o.id = any (dokunulan))
      limit 1;
    end if;

    if mevcut_id is not null then
      -- ---------------------------------------------------------------------
      -- EŞLEŞTİ — YENİ KAYIT AÇILMIYOR
      --
      -- YENİ GİRİŞ KODU DA ÜRETİLMİYOR. Öğrencinin kodu zaten var ve
      -- büyük olasılıkla dağıtıldı; değiştirmek elindeki kâğıdı geçersiz
      -- kılardı. Dönen satırda MEVCUT kodlar var, öğretmen tek listeden
      -- okuyabilsin diye.
      -- ---------------------------------------------------------------------
      if v_no is not null and v_no is distinct from eski_no then
        -- `updated_at` elle yazılmıyor: `ogrenciler_updated_at` tetiği
        -- zaten yazıyor. İkisini birden yapmak, tetik değişirse iki farklı
        -- doğru üretir.
        update public.ogrenciler set ogrenci_no = v_no where id = mevcut_id;

        perform public._denetim(
          'ogrenci_no_guncellendi', 'ogrenciler', mevcut_id,
          public._aktor(v_ogretmen),
          jsonb_build_object('ogrenci_no', eski_no),
          jsonb_build_object('ogrenci_no', v_no)
        );
        durum := 'guncellendi';
        n_guncellendi := n_guncellendi + 1;
      else
        -- Numara gelmemiş ya da zaten aynı: yazacak bir şey yok.
        -- "Güncellendi" demek yalan olurdu; yeni kayıt açmak kopya üretirdi.
        durum := 'degismedi';
        n_degismedi := n_degismedi + 1;
      end if;

      select
        max(k.kod) filter (where k.rol = 'ogrenci'),
        max(k.kod) filter (where k.rol = 'veli')
      into kod_ogr, kod_veli
      from public.giris_kodlari k where k.ogrenci_id = mevcut_id;

      yeni_id := mevcut_id;
      -- Dönen ad ve numara KAYITTAKİLER: eşleşen öğrencinin adı DEĞİŞMİYOR,
      -- listedeki büyük harfli yazım kayıtlı adı ezmiyor. Öğretmen ekranda
      -- veritabanında ne durduğunu görüyor, ne gönderdiğini değil.
      select o.ad, o.ogrenci_no into v_ad, v_no
      from public.ogrenciler o where o.id = mevcut_id;
    else
      -- `sinif_id` olduğu gibi geçiyor — `ogrenci_ekle` ile aynı davranış.
      insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, ogrenci_no)
      values (v_ad, p_tur, p_sinif_id, v_ogretmen, v_no)
      returning id into yeni_id;

      kod_ogr  := public._yeni_kod();
      kod_veli := public._yeni_kod();

      insert into public.giris_kodlari (kod, ogrenci_id, rol)
      values (kod_ogr, yeni_id, 'ogrenci'), (kod_veli, yeni_id, 'veli');

      -- TOPLU İŞ DE İZ BIRAKIR. Öğrenci başına ayrı kayıt: "30 öğrenci
      -- eklendi" tek satırı, sonradan tek bir öğrencinin nereden geldiğini
      -- sormak gerektiğinde hiçbir şey söylemezdi (Part XLIII).
      perform public._denetim('ogrenci_eklendi', 'ogrenciler', yeni_id, public._aktor(v_ogretmen));

      durum := 'eklendi';
      n_eklendi := n_eklendi + 1;
    end if;

    dokunulan := dokunulan || yeni_id;

    sonuc := sonuc || jsonb_build_object(
      'id', yeni_id, 'ad', v_ad, 'ogrenci_no', v_no, 'durum', durum,
      'ogrenci_kodu', kod_ogr, 'veli_kodu', kod_veli
    );
  end loop;

  -- `eklenen` adı 0024'ten beri aynı; arayüz onu okuyor. İçindeki satırlar
  -- artık `durum` da taşıyor ve sayaçlar ayrı ayrı dönüyor.
  return jsonb_build_object(
    'eklenen', sonuc,
    'adet', jsonb_array_length(sonuc),
    'eklendi', n_eklendi,
    'guncellendi', n_guncellendi,
    'degismedi', n_degismedi
  );
end;
$$;

-- ESKİ İMZAYI DÜŞÜR. Bu satır olmadan iki `ogrenciler_toplu_ekle` yan yana
-- durur ve bayrak taşımayan çağrı eskisine düşerek kopya üretmeyi sürdürür.
drop function if exists public.ogrenciler_toplu_ekle(text, text, uuid, jsonb);

-- -----------------------------------------------------------------------------
-- 3. YETKİLER (0005 deseni)
--
-- `create or replace` yetkileri korur, ama YENİ imza (ve yeni yardımcı)
-- PUBLIC üzerinden anon'a AÇIK doğuyor. "Yetki yazmadım, kapalıdır" bu
-- depoda iki kez yanlış çıktı.
-- -----------------------------------------------------------------------------
revoke all on function public._ad_anahtari(text) from public, anon, authenticated;

revoke all on function public.ogrenciler_toplu_ekle(text, text, uuid, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.ogrenciler_toplu_ekle(text, text, uuid, jsonb, boolean)
  to anon, authenticated;

-- =============================================================================
-- KENDİ KENDİNİ DOĞRULAMA
-- =============================================================================
do $$
declare
  eksik text[] := '{}';
begin
  -- 0007 TUZAĞI: eski imza GERÇEKTEN düştü mü.
  --
  -- TÜR LİSTESİ `oidvectortypes` İLE OKUNUYOR. 0042'de aynı kontrol
  -- `pg_get_function_identity_arguments(...) = 'text, text, uuid'` diye
  -- yazılmıştı; o fonksiyon **parametre adlarını da** döndürüyor
  -- (`p_token text, ...`), yani karşılaştırma hiçbir zaman tutmuyor:
  -- ASLA KALAMAYAN bir ölçüm. Orada gerçek koruma yanındaki
  -- "tek imza değil" satırıydı; burada ikisi de ısırıyor ve ikisinin de
  -- ısırdığı geri alınarak gösterildi.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'ogrenciler_toplu_ekle'
      and pg_catalog.oidvectortypes(p.proargtypes) = 'text, text, uuid, jsonb'
  ) then
    eksik := eksik || 'eski 4 parametreli ogrenciler_toplu_ekle hâlâ duruyor'::text;
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'ogrenciler_toplu_ekle') <> 1 then
    eksik := eksik || 'ogrenciler_toplu_ekle tek imza değil'::text;
  end if;

  -- BAYRAK VARSAYILAN OLARAK KAPALI OLMALI: eski arayüz sürümü sessizce
  -- kayıt güncellemeye başlamasın.
  -- `exists` ile yazılıyor, tek satır döndüren alt sorguyla DEĞİL.
  --
  -- İlk yazımda skaler alt sorguydu ve eski imza ayakta kaldığında iki
  -- satır dönüp "more than one row returned by a subquery" hatası veriyordu:
  -- kontrol kırılıyordu ama **yanlış cümleyle**, üstelik asıl kusuru
  -- (eski imza duruyor) söyleyen satıra hiç sıra gelmeden. Bir kapı,
  -- tam da işe yarayacağı anda anlaşılmaz konuşmamalı.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'ogrenciler_toplu_ekle'
      and pg_get_function_arguments(p.oid)
          like '%p_mevcutlari_guncelle boolean DEFAULT false%'
  ) then
    eksik := eksik || 'p_mevcutlari_guncelle varsayılanı false değil'::text;
  end if;

  -- AD ANAHTARI TÜRKÇEYİ TAŞIYOR MU. Bu tek satır bozulursa e-Okul'un
  -- büyük harfli adları hiçbir kayıtla eşleşmez ve kopyalar yeniden üremeye
  -- başlar — üstelik sessizce.
  if public._ad_anahtari('ALİ  IŞIK') is distinct from 'ali ışık' then
    eksik := eksik || format('_ad_anahtari Türkçeyi bozuyor: %s',
                             public._ad_anahtari('ALİ  IŞIK'))::text;
  end if;

  if has_function_privilege('anon', 'public._ad_anahtari(text)', 'execute') then
    eksik := eksik || '_ad_anahtari anon''a açık kalmış'::text;
  end if;
  if not has_function_privilege(
       'anon', 'public.ogrenciler_toplu_ekle(text, text, uuid, jsonb, boolean)', 'execute') then
    eksik := eksik || 'ogrenciler_toplu_ekle anon''a kapalı'::text;
  end if;

  if array_length(eksik, 1) is not null then
    raise exception '0043 EKSİK KALDI: %', array_to_string(eksik, ' | ');
  end if;

  raise notice '0043 tamam — toplu eklemede eşleştirme hazır.';
end;
$$;

select public._migration_kaydet('0043');

-- Panelde YALNIZ SON İFADENİN SONUCU görünüyor. 0041 ve 0042'de "NULL"
-- görmenizin sebebi buydu: son ifade bir değer döndürmüyordu. Bu dosya
-- okunabilir bir satırla bitiyor — aşağıdaki tabloyu görüyorsanız tamamdır.
select
  '0043 tamam — toplu eklemede eşleştirme hazır.'               as sonuc,
  (select count(*) from public.uygulanan_migrationlar)          as defterdeki_dosya,
  (select max(dosya) from public.uygulanan_migrationlar)        as son_dosya;
