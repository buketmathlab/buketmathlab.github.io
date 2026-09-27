-- =============================================================================
-- 0054 — ÖDEV BAŞINA SAYFA SINIRI (varsayılan 1)
--
-- Öğretmenin isteği: bir ödevde öğrenci birden fazla çözüm görseli
-- yükleyebilsin — ama VARSAYILAN BİR KALSIN. Öğrenciler bugün sayfalarını
-- birleştirip tek dosya gönderiyor; bu alışkanlık bozulmayacak. Öğretmen
-- yalnız istediği ödevde sınırı yükseltiyor (en fazla 8).
--
-- TEMEL İLKE: sınırı 1 olan her ödevde — yani 0054'ten önceki bütün
-- ödevlerde ve yeni ödevlerin varsayılanında — dosya yolu, kayıt ve ekran
-- BİREBİR bugünkü. Yeni kod yalnız sınır yükseltildiğinde çalışıyor.
--
-- -----------------------------------------------------------------------------
-- VERİ MODELİ
--
--   odevler.sayfa_limiti          smallint not null default 1, 1–8
--   gonderimler.ek_sayfa_yollari  text[]  — YALNIZ 2. ve sonraki sayfalar
--
-- Neden tam liste değil de "ek sayfalar": 1. sayfa `foto_yolu` olarak
-- kalıyor ve tek doğru kaynak o. Aynı bilgi iki yerde durmadığı için
-- birbirinden sapamaz. `foto_yolu`'nu okuyan her yer (`foto_var`, veli
-- erişimi, eski arayüz) hiç değişmeden çalışıyor. Eski kayıtlarda ve eski
-- yedeklerde kolon boş — "boş" zaten "ek sayfa yok" demek, geri doldurma
-- gerekmiyor.
--
-- -----------------------------------------------------------------------------
-- YOL ŞEMASI
--
--   1. sayfa:    cozum/<odev>/<ogrenci>.jpg        ← 0009'dan beri, DEĞİŞMİYOR
--   2–8. sayfa:  cozum/<odev>/<ogrenci>-<n>.jpg
--
-- Yol hâlâ HESAPLANIYOR, uydurulmuyor (0009'un güvencesi): öğrencinin kendi
-- kimliğini taşıyor, başkasının yoluna yükleme yine imkânsız. Sayfa
-- numarasının sınırı aşmadığı YÜKLEME anında aranıyor.
--
-- -----------------------------------------------------------------------------
-- YENİDEN DENEME — NEDEN ÜZERİNE YAZMA AÇILMADI
--
-- Fotoğraf yüklenip `odev_gonder` ağ hatasıyla düşerse, tekrar denemede aynı
-- yola yeniden yükleme "zaten var" diye reddediliyor. Çok sayfada bu daha
-- olası. İlk akla gelen çözüm — `cozum/` yollarında üzerine yazmayı açıp
-- gönderimden sonra yükleme iznini kapatmak — GÜVENLİ DEĞİL: Supabase'in
-- imzalı yükleme adresi saatlerce geçerli. Öğrenci gönderimden ÖNCE bir
-- adres alıp saklar, gönderir, sonra o adresle gönderilmiş fotoğrafın
-- üzerine yazardı. "Gönderim değiştirilemez" kuralı bugün yalnız üzerine
-- yazmanın kapalı olmasına dayanıyor; o kapı açılmıyor.
--
-- Bunun yerine istemci "zaten var"ı başarı sayıp mevcut dosyayı kullanıyor
-- (dosya-url Edge Function'ı + `services/dosya.ts`). Dosya öğrencinin KENDİ
-- yolunda, KENDİ önceki denemesinden — başkasının dosyası olamaz.
--
-- -----------------------------------------------------------------------------
-- İMZA DEĞİŞEN DÖRT UÇ → 0007 TUZAĞI
--
-- Parametre eklemek `create or replace` ile eskisini DEĞİŞTİRMEZ, yanına
-- ikinci bir aşırı yükleme koyar. Dördü de önce eski imzayla düşürülüyor:
--   odev_gonder, odev_olustur, odev_guncelle, odevler_coklu_olustur
-- Yeni parametreler SONDA ve varsayılanlı: konumsal çağrılar (testler,
-- `odevler_coklu_olustur` → `odev_olustur`) aynen çalışıyor.
--
-- GÖVDELER DOSYADAN KOPYALANDI, ezberden yazılmadı (0016'nın iki hatası).
-- Her gövde en son tanımlandığı migration'dan alınıp yalnız işaretli
-- satırlarda değiştirildi; `app/scripts/sayfa-siniri-denetimi.mjs` farkın
-- yalnız bu satırlardan ibaret olduğunu mekanik olarak ölçüyor.
--
-- Bu dosya tekrar çalıştırılabilir.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ŞEMA
-- -----------------------------------------------------------------------------
alter table public.odevler
  add column if not exists sayfa_limiti smallint not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.odevler'::regclass
       and conname  = 'odevler_sayfa_limiti_araligi'
  ) then
    alter table public.odevler
      add constraint odevler_sayfa_limiti_araligi check (sayfa_limiti between 1 and 8);
  end if;
end $$;

alter table public.gonderimler
  add column if not exists ek_sayfa_yollari text[];

-- Ek sayfa en az 1, en fazla 7 (1. sayfa + 7 = 8). BOŞ DİZİ YASAK: "ek sayfa
-- yok" tek biçimde, NULL ile yazılıyor. İki yazım olsaydı her okuyan ikisini
-- de denetlemek zorunda kalırdı.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.gonderimler'::regclass
       and conname  = 'gonderimler_ek_sayfa_sayisi'
  ) then
    alter table public.gonderimler
      add constraint gonderimler_ek_sayfa_sayisi
      check (ek_sayfa_yollari is null
             or cardinality(ek_sayfa_yollari) between 1 and 7);
  end if;
end $$;

comment on column public.odevler.sayfa_limiti is
  'Öğrencinin bu ödevde yükleyebileceği çözüm görseli sayısı (1–8). Varsayılan 1. (0054)';
comment on column public.gonderimler.ek_sayfa_yollari is
  '2. ve sonraki sayfaların yolları, sırayla. 1. sayfa foto_yolu. NULL = tek sayfa. (0054)';

-- -----------------------------------------------------------------------------
-- 2. _cozum_yolu_gecerli — sayfa eki ve sınır (gövde: 0009)
--
-- İmza aynı (uuid, text): dahili kalıyor, yetkisi değişmiyor.
-- -----------------------------------------------------------------------------
create or replace function public._cozum_yolu_gecerli(
  p_ogrenci_id uuid,
  p_yol text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_odev_id uuid;
  v_parca   text[];
  v_sayfa   integer;
begin
  -- Beklenen: cozum/<uuid>/<uuid>.<uzanti>          (1. sayfa — 0009'dan beri)
  --       ya: cozum/<uuid>/<uuid>-<2..8>.<uzanti>   (ek sayfa — 0054)
  v_parca := regexp_match(
    p_yol,
    '^cozum/([0-9a-f-]{36})/([0-9a-f-]{36})(?:-([2-8]))?\.(jpg|jpeg|png|webp)$'
  );
  if v_parca is null then
    return false;
  end if;

  -- Yoldaki öğrenci kimliği jetondan gelenle AYNI olmalı. Başka öğrencinin
  -- yoluna yükleme denemesi burada düşer.
  if v_parca[2] <> p_ogrenci_id::text then
    return false;
  end if;

  v_odev_id := v_parca[1]::uuid;
  -- Eksiz yol 1. sayfa. `-1` diye bir ek YOK: kalıp yalnız 2–8'i tanıyor,
  -- yani 1. sayfanın iki farklı yazımı olamaz.
  v_sayfa   := coalesce(v_parca[3]::integer, 1);

  -- Ödev yayında ve öğrencinin sınıfına ait mi?
  return exists (
    select 1
    from public.odevler d
    join public.ogrenciler o on o.id = p_ogrenci_id
    where d.id = v_odev_id
      and d.yayinda
      and d.sinif_id = o.sinif_id
      and o.aktif
      -- 0054: sayfa numarası ödevin sınırını aşamaz. Sınır YÜKLEME
      -- anında da aranıyor, yalnız gönderimde değil: sınırı 2 olan ödevde
      -- öğrenci 3. sayfa için yükleme adresi bile alamaz. Depoya sınırın
      -- ötesinde dosya bırakmanın yolu burada kapanıyor.
      and v_sayfa <= d.sayfa_limiti
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. dosya_erisim_izni — öğrenci ve veli ek sayfaları da açabilir (gövde: 0034)
--
-- Kural değişmiyor, yalnız genişliyor: "kendi gönderimindeki fotoğraf"
-- artık 1. sayfayla sınırlı değil. Veli yine yalnız ÇOCUĞUNUN gönderimini,
-- anahtara yine ASLA (Kural 6). Onam kapısı (0034) yerinde.
-- -----------------------------------------------------------------------------
create or replace function public.dosya_erisim_izni(p_token text, p_yol text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
begin
  select * into o from public._oturum(p_token);
  -- ONAM KAPISI (0034). Veli dışındaki rollerde etkisiz: bu iki uç
  -- öğrenci tarafından da kullanılıyor.
  perform public._onam_kapisi(o.rol, o.ogrenci_id);

  if o.rol = 'ogretmen' then
    return true;
  end if;

  if o.rol = 'ogrenci' then
    return
      -- kendi gönderdiği çözüm kâğıdı (teslimden sonra görüntülemek için)
      exists (
        select 1 from public.gonderimler g
        where g.ogrenci_id = o.ogrenci_id
          and (g.foto_yolu = p_yol or p_yol = any(g.ek_sayfa_yollari))
      )
      -- teslim ettiği ödevin cevap anahtarı
      or exists (
        select 1 from public.odevler d
        join public.gonderimler g on g.odev_id = d.id and g.ogrenci_id = o.ogrenci_id
        where d.anahtar_url = p_yol
      )
      -- kendi sınıfındaki yayındaki ödevin soru PDF'i (teslim şartı yok)
      or exists (
        select 1 from public.odevler d
        join public.ogrenciler ogr on ogr.id = o.ogrenci_id
        where d.odev_url = p_yol
          and d.yayinda
          and d.sinif_id = ogr.sinif_id
      )
      -- YENİ: henüz göndermeden, kendi çözüm fotoğrafını YÜKLEMEK için
      or public._cozum_yolu_gecerli(o.ogrenci_id, p_yol);
  end if;

  if o.rol = 'veli' then
    return exists (
      select 1 from public.gonderimler g
      where g.ogrenci_id = o.ogrenci_id
          and (g.foto_yolu = p_yol or p_yol = any(g.ek_sayfa_yollari))
    );
  end if;

  return false;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. odev_gonder — ek sayfalar (gövde: 0016)
-- -----------------------------------------------------------------------------
drop function if exists public.odev_gonder(text, uuid, text, jsonb);

create or replace function public.odev_gonder(
  p_token text,
  p_odev uuid,
  p_foto_yolu text,
  p_cevaplar jsonb default null,
  -- 0054: 2. ve sonraki sayfaların yolları, SIRAYLA. null ya da boş dizi
  -- = tek sayfa; bugünkü çağrılar bu parametreyi hiç göndermiyor.
  p_ek_sayfa_yollari text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  d public.odevler;
  s record;
  yeni_id uuid;
  v_ek      text[];
  v_ek_sayi integer;
  i         integer;
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'ogrenci' then
    raise exception 'Yalnızca öğrenci ödev gönderebilir.' using errcode = '42501';
  end if;

  select * into d from public.odevler where id = p_odev and yayinda;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.ogrenciler ogr
    where ogr.id = o.ogrenci_id and ogr.sinif_id = d.sinif_id
  ) then
    raise exception 'Bu ödev sizin sınıfınıza ait değil.' using errcode = '42501';
  end if;

  -- Sınıf arşivdeyse ödev öğretmenin hiçbir ekranında görünmüyor; gönderim
  -- kabul etmek görünmeyen bir iş üretmek olurdu.
  if public._sinif_arsivde(d.sinif_id) then
    raise exception 'Bu sınıf kapatılmış. Öğretmeniniz açana kadar ödev gönderemezsiniz.'
      using errcode = '22023';
  end if;

  -- Geç teslim kapalıysa son tarihten sonra gönderim yok.
  if not d.gec_teslim
     and (now() at time zone 'Europe/Istanbul')::date > d.son_tarih then
    raise exception 'Bu ödevin süresi doldu. Öğretmeniniz geç teslime izin vermiyor.'
      using errcode = '22023';
  end if;

  if p_foto_yolu is null or btrim(p_foto_yolu) = '' then
    raise exception 'Çözüm fotoğrafı olmadan ödev gönderilemez.' using errcode = '22023';
  end if;

  -- Yol kendi kimliğini ve bu ödevi taşımalı.
  --
  -- 0054: 1. SAYFA EKSİZ OLMALI. 0054'ten önce `_cozum_yolu_gecerli`
  -- yalnız eksiz yolu tanıdığı için `like` yetiyordu. Artık `-2` gibi ek
  -- sayfa yolları da geçerli ve `like` onları da kabul ederdi. `foto_yolu`
  -- her zaman 1. sayfa — onu okuyan her yer (öğretmen, veli) buna güveniyor.
  if not public._cozum_yolu_gecerli(o.ogrenci_id, btrim(p_foto_yolu))
     or btrim(p_foto_yolu) !~ ('^cozum/' || p_odev::text || '/' || o.ogrenci_id::text
                              || '\.(jpg|jpeg|png|webp)$') then
    raise exception 'Geçersiz dosya yolu.' using errcode = '42501';
  end if;

  -- EK SAYFALAR (0054).
  --
  -- SINIR ÖNCE, YOL SONRA. Öğretmen sınırı öğrenci sayfaları hazırladıktan
  -- sonra düşürmüş olabilir; o zaman fazla sayfanın yolu da geçersizdir ama
  -- öğrenciye söylenecek doğru şey "geçersiz yol" değil, "fazla sayfa".
  v_ek := coalesce(p_ek_sayfa_yollari, '{}'::text[]);
  v_ek_sayi := coalesce(array_length(v_ek, 1), 0);

  if 1 + v_ek_sayi > d.sayfa_limiti then
    raise exception 'Bu ödevde en fazla % sayfa gönderilebilir. Fazla sayfaları çıkarıp tekrar deneyin.',
      d.sayfa_limiti using errcode = '22023';
  end if;

  -- SIRA BOŞLUKSUZ: i. ek sayfa TAM OLARAK `-(i+1)` ekini taşımalı.
  -- Böylece aynı sayfa iki kez yazılamaz, sayfa atlanamaz ve öğretmenin
  -- gördüğü sıra öğrencinin gönderdiği sırayla aynıdır.
  for i in 1 .. v_ek_sayi loop
    if v_ek[i] is null
       or btrim(v_ek[i]) !~ ('^cozum/' || p_odev::text || '/' || o.ogrenci_id::text
                            || '-' || (i + 1)::text || '\.(jpg|jpeg|png|webp)$')
       or not public._cozum_yolu_gecerli(o.ogrenci_id, btrim(v_ek[i])) then
      raise exception 'Geçersiz dosya yolu.' using errcode = '42501';
    end if;
    v_ek[i] := btrim(v_ek[i]);
  end loop;

  if d.tur = 'test' then
    select * into s from public._puanla(d.cevap_anahtari, coalesce(p_cevaplar, '{}'::jsonb), d.soru_sayisi);

    insert into public.gonderimler
      (odev_id, ogrenci_id, cevaplar, foto_yolu, ek_sayfa_yollari, dogru, yanlis, bos, puan, durum)
    values
      (p_odev, o.ogrenci_id, p_cevaplar, btrim(p_foto_yolu), nullif(v_ek, '{}'::text[]),
       s.dogru, s.yanlis, s.bos, s.puan, 'puanlandi')
    returning id into yeni_id;

    perform public._denetim('odev_gonderildi', 'gonderimler', yeni_id,
                            'ogrenci:' || o.ogrenci_id);

    return jsonb_build_object(
      'id', yeni_id, 'dogru', s.dogru, 'yanlis', s.yanlis,
      'bos', s.bos, 'puan', s.puan
    );
  else
    insert into public.gonderimler
      (odev_id, ogrenci_id, foto_yolu, ek_sayfa_yollari, durum)
    values
      (p_odev, o.ogrenci_id, btrim(p_foto_yolu), nullif(v_ek, '{}'::text[]), 'incelemede')
    returning id into yeni_id;

    perform public._denetim('odev_gonderildi', 'gonderimler', yeni_id,
                            'ogrenci:' || o.ogrenci_id);

    return jsonb_build_object('id', yeni_id, 'durum', 'incelemede');
  end if;

exception
  when unique_violation then
    raise exception 'Bu ödevi zaten gönderdiniz. Gönderim değiştirilemez.'
      using errcode = '23505';
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. odev_olustur — sayfa sınırı (gövde: 0033)
-- -----------------------------------------------------------------------------
drop function if exists public.odev_olustur(text,text,text,uuid,text,date,integer,jsonb,text,text,boolean,smallint,jsonb);

create or replace function public.odev_olustur(
  p_token text,
  p_baslik text,
  p_aciklama text,
  p_sinif_id uuid,
  p_tur text,
  p_son_tarih date,
  p_soru_sayisi integer default null,
  p_cevap_anahtari jsonb default null,
  p_anahtar_yolu text default null,
  p_odev_yolu text default null,
  p_gec_teslim boolean default true,
  p_sik_sayisi smallint default 5,
  p_konular jsonb default null,
  -- 0054: öğrencinin bu ödevde yükleyebileceği görsel sayısı.
  p_sayfa_limiti smallint default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  yeni_id uuid;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  -- Öğretmen yalnız KENDİ sınıfına ödev verebilir.
  if not public._ogretmenin_sinifi(v_ogretmen, p_sinif_id) then
    raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
  end if;

  -- 0054: 1–8. Tablo kısıtı da yakalar, ama kısıtın ham adını öğretmene
  -- göstermemek için burada Türkçe söylüyoruz.
  if coalesce(p_sayfa_limiti, 1) not between 1 and 8 then
    raise exception 'Sayfa sınırı 1 ile 8 arasında olmalı.' using errcode = '22023';
  end if;

  insert into public.odevler
    (baslik, aciklama, sinif_id, tur, son_tarih, soru_sayisi,
     cevap_anahtari, anahtar_url, odev_url, gec_teslim, sik_sayisi, konular, yayinda,
     ogretmen_id, sayfa_limiti)
  values
    (btrim(p_baslik), nullif(btrim(coalesce(p_aciklama, '')), ''), p_sinif_id,
     p_tur, p_son_tarih, p_soru_sayisi, p_cevap_anahtari,
     nullif(btrim(coalesce(p_anahtar_yolu, '')), ''),
     nullif(btrim(coalesce(p_odev_yolu, '')), ''),
     coalesce(p_gec_teslim, true),
     case when coalesce(p_sik_sayisi, 5) = 4 then 4 else 5 end,
     public._konu_temizle(p_konular, p_soru_sayisi),
     false,  -- Taslak olarak başlar; öğretmen onaylamadan öğrenciye düşmez.
     v_ogretmen,
     coalesce(p_sayfa_limiti, 1))
  returning id into yeni_id;

  perform public._denetim('odev_olusturuldu', 'odevler', yeni_id, public._aktor(v_ogretmen));
  return jsonb_build_object('id', yeni_id, 'yayinda', false);
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. odevler_coklu_olustur — sınırı her sınıfa geçiriyor (gövde: 0033)
-- -----------------------------------------------------------------------------
drop function if exists public.odevler_coklu_olustur(text,jsonb,text,text,text,date,integer,jsonb,text,text,boolean,smallint,jsonb);

create or replace function public.odevler_coklu_olustur(
  p_token text,
  p_sinif_idler jsonb,
  p_baslik text,
  p_aciklama text,
  p_tur text,
  p_son_tarih date,
  p_soru_sayisi integer default null,
  p_cevap_anahtari jsonb default null,
  p_anahtar_yolu text default null,
  p_odev_yolu text default null,
  p_gec_teslim boolean default true,
  p_sik_sayisi smallint default 5,
  p_konular jsonb default null,
  -- 0054: her sınıfa aynı sınır. Denetim odev_olustur'da; ilk sınıfta
  -- düşerse işlemin tamamı geri alınıyor, yarım grup kalmıyor.
  p_sayfa_limiti smallint default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_adet   integer;
  v_grup   uuid;
  v_ham    text;
  v_sinif  uuid;
  v_yeni   jsonb;
  v_sonuc  jsonb := '[]'::jsonb;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);

  if p_sinif_idler is null or jsonb_typeof(p_sinif_idler) <> 'array' then
    raise exception 'Sınıf listesi bir dizi olmalı.' using errcode = '22023';
  end if;

  v_adet := jsonb_array_length(p_sinif_idler);

  if v_adet = 0 then
    raise exception 'En az bir sınıf seçin.' using errcode = '22023';
  end if;

  -- 12 sınıf var; 20 rahat bir tavan ve tek işlemin büyüklüğünü sınırlıyor.
  if v_adet > 20 then
    raise exception 'Tek seferde en fazla 20 sınıfa ödev verilebilir.'
      using errcode = '22023';
  end if;

  -- MÜKERRER SINIF REDDEDİLİYOR. Aynı sınıfa aynı anda iki ödev oluşturmak
  -- sessiz bir çift kayıt olurdu; öğrenci ödevi listesinde iki kez görürdü.
  if (select count(distinct e) from jsonb_array_elements_text(p_sinif_idler) e)
     <> v_adet then
    raise exception 'Aynı sınıf listede birden çok kez var.' using errcode = '22023';
  end if;

  -- ÖN DENETİM. Arşivdeki sınıf reddediliyor (0016 kuralı: arşivdeki sınıf
  -- öğretmenin hiçbir listesinde görünmez, ona yeni ödev de verilmez).
  for v_ham in select value from jsonb_array_elements_text(p_sinif_idler) loop
    begin
      v_sinif := v_ham::uuid;
    exception when invalid_text_representation then
      -- Ham hatayı öğretmene göstermek yerine hangi değerin bozuk olduğunu
      -- söylüyoruz; bu blok hiçbir şey YAZMIYOR, yalnız dönüştürüyor.
      raise exception 'Geçersiz sınıf kimliği: %', v_ham using errcode = '22023';
    end;

    -- Öğretmen yalnız KENDİ sınıflarına toplu ödev verebilir.
    if not public._ogretmenin_sinifi(v_ogretmen, v_sinif) then
      raise exception 'Seçilen sınıflardan biri sizin sınıflarınız arasında değil.'
        using errcode = '42501';
    end if;

    if not exists (
      select 1 from public.siniflar s where s.id = v_sinif and not s.arsiv
    ) then
      raise exception 'Sınıf bulunamadı ya da arşivde.' using errcode = '22023';
    end if;
  end loop;

  -- TEK SINIFTA GRUP YOK. Kardeşi olmayan ödeve grup kimliği vermek, ekranda
  -- "birlikte verildi" uyarısının boş yere çıkması demek olurdu.
  v_grup := case when v_adet > 1 then gen_random_uuid() end;

  for v_ham in select value from jsonb_array_elements_text(p_sinif_idler) loop
    v_sinif := v_ham::uuid;

    -- MEVCUT UÇ ÇAĞRILIYOR: taslak olarak açılması, konu temizliği, şık
    -- sayısı kuralı ve denetim izi kaydı orada. Burada tekrarlanmıyor.
    -- (`_ogretmen` her çağrıda yeniden bakıyor; ucuz ve zararsız.)
    v_yeni := public.odev_olustur(
      p_token, p_baslik, p_aciklama, v_sinif, p_tur, p_son_tarih,
      p_soru_sayisi, p_cevap_anahtari, p_anahtar_yolu, p_odev_yolu,
      p_gec_teslim, p_sik_sayisi, p_konular, p_sayfa_limiti);

    if v_grup is not null then
      update public.odevler set grup_id = v_grup where id = (v_yeni ->> 'id')::uuid;
    end if;

    v_sonuc := v_sonuc || jsonb_build_object(
      'odev_id',  v_yeni ->> 'id',
      'sinif_id', v_sinif,
      'sinif',    (select s.ad from public.siniflar s where s.id = v_sinif));
  end loop;

  return jsonb_build_object('grup_id', v_grup, 'odevler', v_sonuc);
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. odev_guncelle — sınır sonradan değiştirilebilir (gövde: 0033)
-- -----------------------------------------------------------------------------
drop function if exists public.odev_guncelle(text,uuid,text,text,uuid,date,integer,jsonb,text,text,boolean,smallint,jsonb);

create or replace function public.odev_guncelle(
  p_token text,
  p_id uuid,
  p_baslik text,
  p_aciklama text,
  p_sinif_id uuid,
  p_son_tarih date,
  p_soru_sayisi integer default null,
  p_cevap_anahtari jsonb default null,
  p_anahtar_yolu text default null,
  p_odev_yolu text default null,
  -- DİKKAT — burada varsayılan `null`, `true` DEĞİL.
  --
  -- Oluşturmada varsayılan `true` doğru: yeni ödev açık başlar. Ama
  -- güncellemede `true` olsaydı, parametreyi göndermeyen HERHANGİ bir çağrı
  -- öğretmenin kapattığı bir ödevi sessizce yeniden açardı. Ayarı "ödev
  -- verildikten sonra da değiştirebilmek" ancak değişikliğin kalıcı olmasıyla
  -- bir anlam taşır. `null` = "dokunma", aşağıdaki coalesce mevcut değeri
  -- koruyor — `p_sik_sayisi` ile aynı davranış.
  p_gec_teslim boolean default null,
  p_sik_sayisi smallint default null,
  -- NULL = DEĞİŞTİRME (p_gec_teslim ile aynı tuzak). Konuları temizlemek
  -- için boş nesne gönderilir: '{}'.
  p_konular jsonb default null,
  -- 0054 — NULL = DEĞİŞTİRME (p_gec_teslim ile aynı tuzak). Sınırı
  -- düşürmek yapılmış gönderimlere dokunmaz: gönderim değiştirilemez,
  -- sınır yalnız bundan sonraki gönderimleri bağlar.
  p_sayfa_limiti smallint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  d           public.odevler;
  yeni_sayi   integer;
  yeni_anahtar jsonb;
  anahtar_degisti boolean;
  g           record;
  yeni        record;
  rapor       jsonb := '[]'::jsonb;
  v_ogretmen  uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  perform public._odev_sahibi(v_ogretmen, p_id);

  select * into d from public.odevler where id = p_id;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  if p_baslik is null or btrim(p_baslik) = '' then
    raise exception 'Başlık boş olamaz.' using errcode = '22023';
  end if;
  if p_sinif_id is null or p_son_tarih is null then
    raise exception 'Sınıf ve son tarih zorunludur.' using errcode = '22023';
  end if;
  if p_sayfa_limiti is not null and p_sayfa_limiti not between 1 and 8 then
    raise exception 'Sayfa sınırı 1 ile 8 arasında olmalı.' using errcode = '22023';
  end if;

  if d.tur = 'test' then
    yeni_sayi := coalesce(p_soru_sayisi, d.soru_sayisi);
    if yeni_sayi is null or yeni_sayi < 1 or yeni_sayi > 200 then
      raise exception 'Soru sayısı 1 ile 200 arasında olmalı.' using errcode = '22023';
    end if;

    -- Soru sayısı küçüldüyse anahtarı kırp: aksi hâlde artık var olmayan
    -- sorulara ait cevaplar kayıtta kalır ve puanlamayı bulandırır.
    yeni_anahtar := coalesce(p_cevap_anahtari, d.cevap_anahtari, '{}'::jsonb);
    select coalesce(jsonb_object_agg(k, yeni_anahtar -> k), '{}'::jsonb)
      into yeni_anahtar
    from jsonb_object_keys(yeni_anahtar) k
    where (k ~ '^\d+$') and k::integer between 1 and yeni_sayi;

    anahtar_degisti := (yeni_anahtar is distinct from coalesce(d.cevap_anahtari, '{}'::jsonb))
                       or (yeni_sayi is distinct from d.soru_sayisi);
  else
    yeni_sayi := null;
    yeni_anahtar := null;
    anahtar_degisti := false;
  end if;

  update public.odevler
     set baslik      = btrim(p_baslik),
         aciklama    = nullif(btrim(coalesce(p_aciklama, '')), ''),
         sinif_id    = p_sinif_id,
         son_tarih   = p_son_tarih,
         soru_sayisi = yeni_sayi,
         cevap_anahtari = yeni_anahtar,
         anahtar_url = nullif(btrim(coalesce(p_anahtar_yolu, '')), ''),
         odev_url    = nullif(btrim(coalesce(p_odev_yolu, '')), ''),
         gec_teslim  = coalesce(p_gec_teslim, d.gec_teslim),
         sik_sayisi  = case when p_sik_sayisi = 4 then 4
                            when p_sik_sayisi = 5 then 5
                            else d.sik_sayisi end,
         -- Konular da soru sayısına göre kırpılıyor: anahtarda uygulanan
         -- kuralın aynısı, yoksa artık olmayan soruların konusu kayıtta kalır.
         konular     = public._konu_temizle(coalesce(p_konular, d.konular), yeni_sayi),
         sayfa_limiti = coalesce(p_sayfa_limiti, d.sayfa_limiti)
   where id = p_id;

  perform public._denetim('odev_guncellendi', 'odevler', p_id, public._aktor(v_ogretmen),
                          to_jsonb(d), (select to_jsonb(o) from public.odevler o where o.id = p_id));

  -- ---------------------------------------------------------------------
  -- YENİDEN PUANLAMA
  -- ---------------------------------------------------------------------
  if anahtar_degisti then
    for g in
      select gn.id, gn.ogrenci_id, gn.cevaplar, gn.puan, gn.dogru, gn.yanlis, gn.bos,
             o.ad as ogrenci_ad
      from public.gonderimler gn
      join public.ogrenciler o on o.id = gn.ogrenci_id
      where gn.odev_id = p_id
    loop
      select * into yeni
      from public._puanla(yeni_anahtar, coalesce(g.cevaplar, '{}'::jsonb), yeni_sayi);

      if yeni.puan is distinct from g.puan then
        update public.gonderimler
           set dogru = yeni.dogru, yanlis = yeni.yanlis,
               bos = yeni.bos, puan = yeni.puan
         where id = g.id;

        -- Not değişikliği HER ZAMAN iz bırakır (Part XLIII).
        perform public._denetim(
          'yeniden_puanlandi', 'gonderimler', g.id, public._aktor(v_ogretmen),
          jsonb_build_object('puan', g.puan, 'dogru', g.dogru,
                             'yanlis', g.yanlis, 'bos', g.bos),
          jsonb_build_object('puan', yeni.puan, 'dogru', yeni.dogru,
                             'yanlis', yeni.yanlis, 'bos', yeni.bos));

        rapor := rapor || jsonb_build_object(
          'ogrenci', g.ogrenci_ad,
          'eski_puan', g.puan,
          'yeni_puan', yeni.puan);
      end if;
    end loop;
  end if;

  return jsonb_build_object('durum', 'tamam', 'yeniden_puanlanan', rapor);
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. odev_detay — düzenleme formu mevcut sınırı görsün (gövde: 0033)
-- -----------------------------------------------------------------------------
create or replace function public.odev_detay(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  d public.odevler;
  s public.siniflar;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  perform public._odev_sahibi(v_ogretmen, p_id);

  select * into d from public.odevler where id = p_id;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;
  select * into s from public.siniflar where id = d.sinif_id;

  return jsonb_build_object(
    'id', d.id,
    'baslik', d.baslik,
    'aciklama', d.aciklama,
    'tur', d.tur,
    'sinif_id', d.sinif_id,
    'sinif', s.ad,
    'son_tarih', d.son_tarih,
    'soru_sayisi', d.soru_sayisi,
    'gec_teslim', d.gec_teslim,
    'konular', coalesce(d.konular, '{}'::jsonb),
    'sik_sayisi', d.sik_sayisi,
    'sayfa_limiti', d.sayfa_limiti,
    'cevap_anahtari', coalesce(d.cevap_anahtari, '{}'::jsonb),
    'anahtar_yolu', d.anahtar_url,
    'odev_yolu', d.odev_url,
    'yayinda', d.yayinda,
    'kardesler', case when d.grup_id is not null then (
      select coalesce(jsonb_agg(s2.ad order by s2.seviye, s2.sube), '[]'::jsonb)
        from public.odevler d2
        join public.siniflar s2 on s2.id = d2.sinif_id
       where d2.grup_id = d.grup_id and d2.id <> d.id
    ) end,
    'kardes_detay', case when d.grup_id is not null then (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', d2.id,
               'sinif', s2.ad,
               'gonderim_sayisi', (select count(*) from public.gonderimler g
                                    where g.odev_id = d2.id),
               'anahtar_ayni', (d2.cevap_anahtari is not distinct from d.cevap_anahtari),
               'arsiv', public._sinif_arsivde(d2.sinif_id)
             ) order by s2.seviye, s2.sube), '[]'::jsonb)
        from public.odevler d2
        join public.siniflar s2 on s2.id = d2.sinif_id
       where d2.grup_id = d.grup_id and d2.id <> d.id
    ) end,
    'gonderim_sayisi', (select count(*) from public.gonderimler g where g.odev_id = d.id),
    'gec_gonderim_sayisi', (
      select count(*) from public.gonderimler g
      where g.odev_id = d.id and public._gecikmeli(g.created_at, d.son_tarih)
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. gonderim_foto_yolu — tüm sayfalar (gövde: 0033)
-- -----------------------------------------------------------------------------
create or replace function public.gonderim_foto_yolu(p_token text, p_gonderim uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_yol text;
  v_ek  text[];
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);

  -- Çözüm fotoğrafı, gönderimin ait olduğu ÖDEVİN sahibine açık.
  select g.foto_yolu, g.ek_sayfa_yollari into v_yol, v_ek
  from public.gonderimler g
  join public.odevler d on d.id = g.odev_id
  where g.id = p_gonderim and d.ogretmen_id = v_ogretmen;

  if not found then
    raise exception 'Gönderim bulunamadı.' using errcode = 'P0002';
  end if;

  -- `yol` AYNEN DURUYOR: 0054'ten önce yayına girmiş bir arayüz yalnız onu
  -- okuyor. `yollar` 1. sayfa dahil TÜM sayfalar, sırayla.
  return jsonb_build_object(
    'yol', v_yol,
    'yollar', case when v_yol is null then '[]'::jsonb
                   else to_jsonb(array[v_yol] || coalesce(v_ek, '{}'::text[])) end);
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. odev_kardeslere_yay — sınır da taşınıyor (gövde: 0033)
-- -----------------------------------------------------------------------------
create or replace function public.odev_kardeslere_yay(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  d       public.odevler;   -- kaynak
  k       record;           -- kardeş
  eski    public.odevler;   -- kardeşin yayma ÖNCESİ hâli (denetim izi için)
  g       record;
  yeni    record;
  anahtar_degisti boolean;
  rapor   jsonb := '[]'::jsonb;
  puanlar jsonb;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  -- Kardeşlere yayma NOT DEĞİŞTİRİYOR: kaynağın sahibi olmayan
  -- kimse başlatamaz.
  perform public._odev_sahibi(v_ogretmen, p_id);

  select * into d from public.odevler where id = p_id;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  -- SESSİZ "TAMAM" YOK. Kardeşi olmayan bir ödevde hiçbir şey yapmayıp
  -- başarı dönmek, öğretmene yayıldığını sandırırdı.
  if d.grup_id is null then
    raise exception 'Bu ödev tek sınıfa verilmiş; yayılacak kardeş ödev yok.'
      using errcode = '22023';
  end if;

  for k in
    select d2.id, d2.sinif_id, s2.ad as sinif_ad
      from public.odevler d2
      join public.siniflar s2 on s2.id = d2.sinif_id
     where d2.grup_id = d.grup_id and d2.id <> p_id
     order by s2.seviye, s2.sube
  loop
    -- ARŞİVDEKİ SINIF ATLANIYOR (0016 kuralı).
    -- Arşivdeki sınıf öğretmenin hiçbir listesinde görünmüyor; görünmeyen bir
    -- sınıfın notunu sessizce değiştirmek o kuralı delerdi. Atlandığı raporda
    -- yazıyor — sessiz atlama da yok.
    if public._sinif_arsivde(k.sinif_id) then
      rapor := rapor || jsonb_build_object(
        'sinif', k.sinif_ad, 'odev_id', k.id,
        'yeniden_puanlanan', '[]'::jsonb, 'atlandi', 'arsiv');
      continue;
    end if;

    select * into eski from public.odevler where id = k.id;

    -- Anahtar bu kardeş için gerçekten değişiyor mu? Yalnız test ödevinde
    -- anlamlı; açık uçluda anahtar da soru sayısı da null.
    anahtar_degisti := eski.tur = 'test'
      and ((d.cevap_anahtari is distinct from eski.cevap_anahtari)
        or (d.soru_sayisi is distinct from eski.soru_sayisi));

    -- TAŞINAN ALANLAR — öğretmenin kararı, birebir.
    -- sinif_id, son_tarih, gec_teslim, yayinda ve grup_id BİLEREK YOK.
    update public.odevler
       set baslik         = d.baslik,
           aciklama       = d.aciklama,
           soru_sayisi    = d.soru_sayisi,
           cevap_anahtari = d.cevap_anahtari,
           sik_sayisi     = d.sik_sayisi,
           -- 0054: sayfa sınırı da ödevin İÇERİĞİ — aynı çözüm her sınıfta
           -- aynı sayıda sayfa tutar. Şık sayısı gibi taşınıyor; geç teslim
           -- gibi sınıfa özgü bir ayar DEĞİL.
           sayfa_limiti   = d.sayfa_limiti,
           konular        = public._konu_temizle(d.konular, d.soru_sayisi),
           anahtar_url    = d.anahtar_url,
           odev_url       = d.odev_url
     where id = k.id;

    perform public._denetim('kardeslere_yayildi', 'odevler', k.id, public._aktor(v_ogretmen),
                            to_jsonb(eski),
                            (select to_jsonb(o) from public.odevler o where o.id = k.id));

    -- -------------------------------------------------------------------
    -- YENİDEN PUANLAMA — gövde odev_guncelle'den (0020) BİREBİR kopyalandı.
    -- Ezberden yazmak 0016'da iki hataya yol açmıştı; o adım atlanmıyor.
    -- -------------------------------------------------------------------
    puanlar := '[]'::jsonb;
    if anahtar_degisti then
      for g in
        select gn.id, gn.ogrenci_id, gn.cevaplar, gn.puan, gn.dogru, gn.yanlis, gn.bos,
               o.ad as ogrenci_ad
          from public.gonderimler gn
          join public.ogrenciler o on o.id = gn.ogrenci_id
         where gn.odev_id = k.id
      loop
        select * into yeni
        from public._puanla(coalesce(d.cevap_anahtari, '{}'::jsonb),
                            coalesce(g.cevaplar, '{}'::jsonb),
                            d.soru_sayisi);

        if yeni.puan is distinct from g.puan then
          update public.gonderimler
             set dogru = yeni.dogru, yanlis = yeni.yanlis,
                 bos = yeni.bos, puan = yeni.puan
           where id = g.id;

          -- Not değişikliği HER ZAMAN iz bırakır (Part XLIII).
          perform public._denetim(
            'yeniden_puanlandi', 'gonderimler', g.id, public._aktor(v_ogretmen),
            jsonb_build_object('puan', g.puan, 'dogru', g.dogru,
                               'yanlis', g.yanlis, 'bos', g.bos),
            jsonb_build_object('puan', yeni.puan, 'dogru', yeni.dogru,
                               'yanlis', yeni.yanlis, 'bos', yeni.bos));

          puanlar := puanlar || jsonb_build_object(
            'ogrenci', g.ogrenci_ad,
            'eski_puan', g.puan,
            'yeni_puan', yeni.puan);
        end if;
      end loop;
    end if;

    rapor := rapor || jsonb_build_object(
      'sinif', k.sinif_ad, 'odev_id', k.id,
      'yeniden_puanlanan', puanlar, 'atlandi', null);
  end loop;

  return rapor;
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. odev_sayfa_siniri — YENİ, öğrencinin ucu
--
-- AYRI UÇ, `ogrenci_odevleri`'ne EKLENMEDİ: oraya eklemek 300 satırlık
-- gövdeyi kopyalamak demekti. 0032 (`ewalu_mesajlari`) ve 0047
-- (`odev_kiyasi`) aynı sebeple ayrı uç.
--
-- Arayüz bu uca ulaşamazsa sınırı 1 SAYIYOR. 1 her ödevde geçerli bir
-- değer olduğu için en kötü sonuç bugünkü davranış.
--
-- Yalnız öğrenci: velinin yükleme ekranı yok, öğretmen `odev_detay`'ı
-- kullanıyor. Başka sınıfın ödevi 42501 ile reddediliyor — hangi ödevin
-- kaç sayfa istediği bile başka sınıfa sızmıyor.
-- -----------------------------------------------------------------------------
create or replace function public.odev_sayfa_siniri(p_token text, p_odev_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  d public.odevler;
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'ogrenci' then
    raise exception 'Bu bilgi yalnız öğrenciye açık.' using errcode = '42501';
  end if;

  select * into d from public.odevler where id = p_odev_id and yayinda;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.ogrenciler ogr
    where ogr.id = o.ogrenci_id and ogr.sinif_id = d.sinif_id
  ) then
    raise exception 'Bu ödev sizin sınıfınıza ait değil.' using errcode = '42501';
  end if;

  return d.sayfa_limiti;
end;
$$;

-- -----------------------------------------------------------------------------
-- 12. YETKİLER (0005 deseni)
--
-- Düşürülüp yeniden oluşturulan dört uç ve yeni uç açıkça veriliyor.
-- İmzası aynı kalanlar (`create or replace`) yetkilerini koruyor; dahili
-- `_cozum_yolu_gecerli` yine de yeniden kapatılıyor — ucuz, zararsız, ve
-- yanlışlıkla açılmışsa burada kapanıyor.
-- -----------------------------------------------------------------------------
revoke all on function public._cozum_yolu_gecerli(uuid, text)
  from public, anon, authenticated;

revoke all on function public.odev_gonder(text, uuid, text, jsonb, text[])
  from public, anon, authenticated;
grant execute on function public.odev_gonder(text, uuid, text, jsonb, text[])
  to anon, authenticated;

revoke all on function public.odev_olustur(text,text,text,uuid,text,date,integer,jsonb,text,text,boolean,smallint,jsonb,smallint)
  from public, anon, authenticated;
grant execute on function public.odev_olustur(text,text,text,uuid,text,date,integer,jsonb,text,text,boolean,smallint,jsonb,smallint)
  to anon, authenticated;

revoke all on function public.odevler_coklu_olustur(text,jsonb,text,text,text,date,integer,jsonb,text,text,boolean,smallint,jsonb,smallint)
  from public, anon, authenticated;
grant execute on function public.odevler_coklu_olustur(text,jsonb,text,text,text,date,integer,jsonb,text,text,boolean,smallint,jsonb,smallint)
  to anon, authenticated;

revoke all on function public.odev_guncelle(text,uuid,text,text,uuid,date,integer,jsonb,text,text,boolean,smallint,jsonb,smallint)
  from public, anon, authenticated;
grant execute on function public.odev_guncelle(text,uuid,text,text,uuid,date,integer,jsonb,text,text,boolean,smallint,jsonb,smallint)
  to anon, authenticated;

revoke all on function public.odev_sayfa_siniri(text, uuid)
  from public, anon, authenticated;
grant execute on function public.odev_sayfa_siniri(text, uuid)
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 13. KENDİ KENDİNİ DENETLEME
--
-- Panelde yarım kalan ya da yanlış sırada çalışan bir dosya burada düşer —
-- sessizce "tamam" demez.
-- -----------------------------------------------------------------------------
do $$
declare
  f text;
  n integer;
begin
  -- 0007 tuzağı: her uçtan TEK tanım kalmalı.
  foreach f in array array['odev_gonder', 'odev_olustur', 'odev_guncelle',
                           'odevler_coklu_olustur', 'odev_sayfa_siniri'] loop
    select count(*) into n
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.proname = f;
    if n <> 1 then
      raise exception '0054: % için % tanım var — eski imza düşmemiş', f, n;
    end if;
  end loop;

  -- Değişikliklerin gövdelere gerçekten girdiği.
  foreach f in array array['_cozum_yolu_gecerli', 'dosya_erisim_izni', 'odev_gonder',
                           'odev_olustur', 'odevler_coklu_olustur', 'odev_guncelle', 'odev_detay',
                           'gonderim_foto_yolu', 'odev_kardeslere_yay'] loop
    if not exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = f
         and (pg_get_functiondef(p.oid) like '%sayfa_limiti%'
              or pg_get_functiondef(p.oid) like '%ek_sayfa_yollari%')
    ) then
      raise exception '0054: % gövdesi güncellenmemiş', f;
    end if;
  end loop;

  -- Dahili yardımcı dışarıya kapalı kalmalı.
  if has_function_privilege('anon', 'public._cozum_yolu_gecerli(uuid, text)', 'execute') then
    raise exception '0054: _cozum_yolu_gecerli anon''a açık';
  end if;
end $$;

select public._migration_kaydet('0054');
