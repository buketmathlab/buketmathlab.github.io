-- SEKİZ — kurulum (0001–0006 birleşik). Tek seferde çalıştırılır.

-- ═══ 0001_temel_sema.sql ═══
-- =============================================================================
-- SEKİZ — 0001 TEMEL ŞEMA
--
-- Hedef proje: oymueccauhprkgdrbqtv (boş)
-- Bu dosya boş bir veritabanına baştan uygulanacak şekilde yazıldı ve
-- tekrar çalıştırılabilir (idempotent) olacak biçimde IF NOT EXISTS kullanır.
--
-- Şema, silinen canlı projenin yapısını temel alır; Faz 0'da tespit edilen
-- kusurlar düzeltilmiş hâldedir. Her düzeltmenin gerekçesi yanında yazılıdır.
-- =============================================================================

-- pgcrypto: Supabase'de bu eklenti `extensions` şemasında kuruludur,
-- `public`'te değil. Fonksiyonlarımızda search_path güvenlik gereği
-- sabitlendiği için `extensions` de yola dahil edilmek zorunda; aksi hâlde
-- digest/crypt/gen_random_bytes bulunamaz.
--
-- Yerel PostgreSQL'de `extensions` şeması yoktur; burada oluşturup eklentiyi
-- oraya kuruyoruz ki yerel ortam Supabase ile aynı şekilde davransın.
-- (Yolda var olmayan şema bulunması Postgres'te hata değildir, yok sayılır.)
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Ortak: updated_at tetikleyicisi
-- Eski şemada hiçbir tabloda değişiklik izi yoktu.
-- -----------------------------------------------------------------------------
create or replace function public.tetik_updated_at()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- SINIFLAR
--
-- Eski sistemde sınıflar istemci kodunda sabitti (`["9A","9B","10C","11B"]`) —
-- hem eksikti hem Part XXVI'ya aykırıydı.
--
-- `seviye` ve `sube` ayrı alanlarda tutuluyor çünkü DOĞAL SIRALAMA gerekiyor:
-- metin olarak sıralandığında "10A" < "9A" çıkar. Sayısal seviye + harf şube
-- ile `order by seviye, sube` doğru sırayı verir.
-- -----------------------------------------------------------------------------
create table if not exists public.siniflar (
  id          uuid primary key default gen_random_uuid(),
  seviye      smallint not null check (seviye between 1 and 12),
  sube        text     not null check (sube ~ '^[A-ZÇĞİÖŞÜ]{1,2}$'),
  -- Görüntülenecek ad türetilmiştir; elle girilip tutarsızlaşamaz.
  ad          text generated always as (seviye::text || sube) stored,
  arsiv       boolean  not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (seviye, sube)
);

create index if not exists siniflar_sira_idx on public.siniflar (seviye, sube);

drop trigger if exists siniflar_updated_at on public.siniflar;
create trigger siniflar_updated_at before update on public.siniflar
  for each row execute function public.tetik_updated_at();

-- -----------------------------------------------------------------------------
-- OGRENCILER
--
-- Değişiklik: `sinif` serbest metin değil, `siniflar` tablosuna FK.
-- "Özel" artık sahte bir sınıf değil — ayrım `tur` alanında. Özel ders
-- öğrencisinin sınıfı olmayabilir; okul öğrencisinin olmak zorunda.
-- -----------------------------------------------------------------------------
create table if not exists public.ogrenciler (
  id          uuid primary key default gen_random_uuid(),
  ad          text not null check (length(btrim(ad)) > 0),
  tur         text not null check (tur in ('okul', 'ozel')),
  sinif_id    uuid references public.siniflar(id) on delete restrict,
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint ogrenci_sinif_tutarli
    check (tur = 'ozel' or sinif_id is not null)
);

create index if not exists ogrenciler_sinif_idx on public.ogrenciler (sinif_id);
create index if not exists ogrenciler_ad_idx on public.ogrenciler (ad);

drop trigger if exists ogrenciler_updated_at on public.ogrenciler;
create trigger ogrenciler_updated_at before update on public.ogrenciler
  for each row execute function public.tetik_updated_at();

-- -----------------------------------------------------------------------------
-- GIRIS_KODLARI
--
-- Eski şemada `ogrenci_kodu` ve `veli_kodu` ogrenciler tablosunda iki ayrı
-- UNIQUE sütundu. Bu, ARALARINDA çakışmayı engellemiyordu: bir öğrencinin
-- veli kodu, başka bir öğrencinin öğrenci koduyla aynı olabilirdi ve giriş
-- ekranı tek alan kullandığı için hangi kaydın açılacağı belirsizleşirdi.
-- Kodları tek tabloda birincil anahtar yapmak bu sınıf hatayı imkânsızlaştırır.
--
-- Kodlar DÜZ METİN saklanıyor. Bu bilinçli: öğretmenin kodu öğrenciye
-- yeniden gösterebilmesi gerekiyor, hash'lenirse bu iş akışı kırılır.
-- Koruma hash'ten değil, YETERLİ ENTROPİ (8 karakter, karışabilir harfler
-- ayıklanmış alfabe) ve GİRİŞ DENEME LİMİTİ'nden geliyor.
-- -----------------------------------------------------------------------------
create table if not exists public.giris_kodlari (
  kod         text primary key check (length(kod) between 6 and 24),
  ogrenci_id  uuid not null references public.ogrenciler(id) on delete cascade,
  rol         text not null check (rol in ('ogrenci', 'veli')),
  created_at  timestamptz not null default now(),
  unique (ogrenci_id, rol)
);

create index if not exists giris_kodlari_ogrenci_idx on public.giris_kodlari (ogrenci_id);

-- -----------------------------------------------------------------------------
-- ODEVLER
--
-- Değişiklik: `sinif` FK; yayın durumu eklendi (taslak ödev öğrenciye düşmez).
-- `cevap_anahtari` ve `anahtar_url` bu satırda duruyor — bu yüzden bu iki
-- alanı seçen her sorgu dikkatle yazılmalı (bkz. 0004, ogrenci_odevleri).
-- -----------------------------------------------------------------------------
create table if not exists public.odevler (
  id              uuid primary key default gen_random_uuid(),
  baslik          text not null check (length(btrim(baslik)) > 0),
  aciklama        text,
  sinif_id        uuid not null references public.siniflar(id) on delete restrict,
  tur             text not null check (tur in ('test', 'acik')),
  son_tarih       date not null,
  soru_sayisi     integer check (soru_sayisi is null or soru_sayisi between 1 and 200),
  cevap_anahtari  jsonb,
  anahtar_url     text,
  yayinda         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Test ödevinde soru sayısı ve cevap anahtarı zorunlu; açık uçluda anlamsız.
  constraint odev_test_tutarli check (
    (tur = 'test' and soru_sayisi is not null and cevap_anahtari is not null)
    or tur = 'acik'
  )
);

create index if not exists odevler_sinif_idx on public.odevler (sinif_id);
create index if not exists odevler_son_tarih_idx on public.odevler (son_tarih);

drop trigger if exists odevler_updated_at on public.odevler;
create trigger odevler_updated_at before update on public.odevler
  for each row execute function public.tetik_updated_at();

-- -----------------------------------------------------------------------------
-- GONDERIMLER
--
-- EN ÖNEMLİ DÜZELTME: (odev_id, ogrenci_id) üzerinde UNIQUE.
-- Eski şemada yalnız PRIMARY KEY (id) vardı; aynı öğrenci aynı ödeve birden
-- çok gönderim yapabiliyordu. Uygulama katmanında kontrol etmek yarış
-- koşullarına açıktır — kısıt veritabanında olmalı (Part XLIX, madde 12).
--
-- İkinci düzeltme: `durum` üzerinde CHECK. Diğer tüm sıralı alanlarda CHECK
-- vardı, bunda yoktu.
-- -----------------------------------------------------------------------------
create table if not exists public.gonderimler (
  id              uuid primary key default gen_random_uuid(),
  odev_id         uuid not null references public.odevler(id) on delete cascade,
  ogrenci_id      uuid not null references public.ogrenciler(id) on delete cascade,
  cevaplar        jsonb,
  foto_yolu       text not null,
  dogru           integer check (dogru is null or dogru >= 0),
  yanlis          integer check (yanlis is null or yanlis >= 0),
  bos             integer check (bos is null or bos >= 0),
  puan            numeric(5,2) check (puan is null or puan between 0 and 100),
  ogretmen_puan   numeric(5,2) check (ogretmen_puan is null or ogretmen_puan between 0 and 100),
  ogretmen_yorum  text,
  durum           text not null default 'incelemede'
                    check (durum in ('incelemede', 'onaylandi', 'puanlandi')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint gonderim_tek unique (odev_id, ogrenci_id)
);

create index if not exists gonderimler_odev_idx on public.gonderimler (odev_id);
create index if not exists gonderimler_ogrenci_idx on public.gonderimler (ogrenci_id);
create index if not exists gonderimler_durum_idx on public.gonderimler (durum)
  where durum = 'incelemede';

drop trigger if exists gonderimler_updated_at on public.gonderimler;
create trigger gonderimler_updated_at before update on public.gonderimler
  for each row execute function public.tetik_updated_at();

-- -----------------------------------------------------------------------------
-- MESAJLAR
-- -----------------------------------------------------------------------------
create table if not exists public.mesajlar (
  id          uuid primary key default gen_random_uuid(),
  ogrenci_id  uuid not null references public.ogrenciler(id) on delete cascade,
  kimden      text not null check (kimden in ('ogretmen', 'veli')),
  metin       text not null check (length(btrim(metin)) between 1 and 4000),
  created_at  timestamptz not null default now()
);

create index if not exists mesajlar_ogrenci_zaman_idx
  on public.mesajlar (ogrenci_id, created_at desc);

-- -----------------------------------------------------------------------------
-- DERSLER — yalnız özel ders öğrencileri için
-- -----------------------------------------------------------------------------
create table if not exists public.dersler (
  id          uuid primary key default gen_random_uuid(),
  ogrenci_id  uuid not null references public.ogrenciler(id) on delete cascade,
  zaman       timestamptz not null,
  mod         text not null default 'yuzyuze' check (mod in ('yuzyuze', 'online')),
  link        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists dersler_ogrenci_zaman_idx on public.dersler (ogrenci_id, zaman);

drop trigger if exists dersler_updated_at on public.dersler;
create trigger dersler_updated_at before update on public.dersler
  for each row execute function public.tetik_updated_at();

-- -----------------------------------------------------------------------------
-- ODEMELER — yalnız özel ders öğrencileri için (Part XI)
-- -----------------------------------------------------------------------------
create table if not exists public.odemeler (
  id          uuid primary key default gen_random_uuid(),
  ogrenci_id  uuid not null references public.ogrenciler(id) on delete cascade,
  tutar       numeric(10,2) not null check (tutar >= 0),
  tarih       date not null,
  odendi      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists odemeler_ogrenci_idx on public.odemeler (ogrenci_id);

drop trigger if exists odemeler_updated_at on public.odemeler;
create trigger odemeler_updated_at before update on public.odemeler
  for each row execute function public.tetik_updated_at();

-- -----------------------------------------------------------------------------
-- AYARLAR — tek satır. PIN artık HASH'li saklanıyor.
-- Sütun adı `ogretmen_pin_hash`: içeriğin ne olduğu adından anlaşılsın.
-- -----------------------------------------------------------------------------
create table if not exists public.ayarlar (
  id                 smallint primary key default 1 check (id = 1),
  ogretmen_pin_hash  text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

insert into public.ayarlar (id) values (1) on conflict (id) do nothing;

drop trigger if exists ayarlar_updated_at on public.ayarlar;
create trigger ayarlar_updated_at before update on public.ayarlar
  for each row execute function public.tetik_updated_at();

-- -----------------------------------------------------------------------------
-- OKUNDU — velinin bildirimleri en son ne zaman gördüğü
-- Eski şemada birincil anahtar doğrudan giriş kodunun kendisiydi.
-- Artık öğrenciye bağlı.
-- -----------------------------------------------------------------------------
create table if not exists public.okundu (
  ogrenci_id  uuid primary key references public.ogrenciler(id) on delete cascade,
  rol         text not null default 'veli' check (rol in ('veli', 'ogrenci')),
  zaman       timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- OTURUMLAR
--
-- Eski sistemde öğretmen PIN'i localStorage'da düz metin duruyor ve HER
-- istekte gönderiliyordu. Artık giriş bir jeton döndürüyor; veritabanında
-- yalnız jetonun hash'i saklanıyor, süresi doluyor ve iptal edilebiliyor.
-- -----------------------------------------------------------------------------
create table if not exists public.oturumlar (
  id            uuid primary key default gen_random_uuid(),
  token_hash    text not null unique,
  rol           text not null check (rol in ('ogretmen', 'ogrenci', 'veli')),
  ogrenci_id    uuid references public.ogrenciler(id) on delete cascade,
  created_at    timestamptz not null default now(),
  son_kullanma  timestamptz not null,
  son_gorulme   timestamptz not null default now(),
  iptal         boolean not null default false,
  -- Öğretmen oturumunun öğrencisi olmaz; öğrenci/veli oturumunun olmak zorunda.
  constraint oturum_rol_tutarli check (
    (rol = 'ogretmen' and ogrenci_id is null)
    or (rol in ('ogrenci', 'veli') and ogrenci_id is not null)
  )
);

create index if not exists oturumlar_temizlik_idx on public.oturumlar (son_kullanma);

-- -----------------------------------------------------------------------------
-- GIRIS_DENEMELERI — kaba kuvvet koruması
-- Denenen kodun tamamı loglanmaz; yalnız ilk iki karakter tutulur ki log
-- dosyası bir kod deposuna dönüşmesin.
-- -----------------------------------------------------------------------------
create table if not exists public.giris_denemeleri (
  id         bigint generated always as identity primary key,
  kod_ipucu  text,
  kimlik     text not null,
  basarili   boolean not null,
  zaman      timestamptz not null default now()
);

create index if not exists giris_denemeleri_kimlik_zaman_idx
  on public.giris_denemeleri (kimlik, zaman desc);

-- -----------------------------------------------------------------------------
-- DENETIM_IZI
--
-- Eğitimle ilgili hiçbir kayıt sessizce değişmemeli (Part XLIII).
-- Özellikle: not değişiklikleri, cevap anahtarı revizyonu, öğrenci silme.
-- -----------------------------------------------------------------------------
create table if not exists public.denetim_izi (
  id        bigint generated always as identity primary key,
  islem     text not null,
  tablo     text,
  kayit_id  uuid,
  aktor     text not null,
  eski      jsonb,
  yeni      jsonb,
  zaman     timestamptz not null default now()
);

create index if not exists denetim_izi_zaman_idx on public.denetim_izi (zaman desc);
create index if not exists denetim_izi_kayit_idx on public.denetim_izi (tablo, kayit_id);

-- ═══ 0002_yetkiler_rls.sql ═══
-- =============================================================================
-- SEKİZ — 0002 YETKİLER VE RLS
--
-- İKİ KATMANLI SAVUNMA. Bunlar birbirinin yerine geçmez:
--
--   1. GRANT katmanı — anon ve authenticated rollerinin tablolara DOĞRUDAN
--      erişimi tamamen kaldırılır. Silinen canlı projede koruma buydu ve
--      işe yarıyordu; korunuyor.
--
--   2. RLS katmanı — her tabloda açılır ve politika AÇIKÇA yazılır.
--
-- Neden ikisi birden: projede yeni tabloda otomatik RLS açan bir DDL event
-- trigger'ı (`rls_auto_enable`) bulunabiliyor. Ancak RLS'in AÇIK olması
-- politika olduğu anlamına gelmez — politikasız RLS hiçbir satıra erişim
-- vermez ve bu, güvenlik değil sessiz arızadır. Bu yüzden politikalar
-- burada elle yazılıyor, trigger'a güvenilmiyor.
--
-- Erişimin TEK yolu 0003/0004'teki SECURITY DEFINER fonksiyonlardır.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Doğrudan tablo erişimini kaldır
-- -----------------------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- Bundan sonra oluşturulacak nesneler için de varsayılanı kapat.
alter default privileges in schema public
  revoke all on tables from anon, authenticated;
alter default privileges in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges in schema public
  revoke all on functions from anon, authenticated;

-- Şemayı görebilsinler (fonksiyon çağırabilmek için gerekli), ama içindeki
-- nesnelere erişemesinler.
grant usage on schema public to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. RLS: her tabloda açık, politika açıkça yazılı
--
-- Politikalar bilinçli olarak BOŞ küme döndürür: `using (false)`.
-- Yani doğrudan sorgu hiçbir satır getirmez. SECURITY DEFINER fonksiyonlar
-- tablo sahibinin haklarıyla çalıştığı için RLS'i atlar — erişim oradan olur.
--
-- `using (false)` yazmak ile politikayı hiç yazmamak arasında pratik fark
-- yok gibi görünür ama vardır: niyet açık hâle gelir. İleride biri politika
-- eklerken burada bilinçli bir karar olduğunu görür.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  tablolar text[] := array[
    'siniflar', 'ogrenciler', 'giris_kodlari', 'odevler', 'gonderimler',
    'mesajlar', 'dersler', 'odemeler', 'ayarlar', 'okundu',
    'oturumlar', 'giris_denemeleri', 'denetim_izi'
  ];
begin
  foreach t in array tablolar loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_dogrudan_erisim_yok', t);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (false) with check (false)',
      t || '_dogrudan_erisim_yok', t
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Storage: PRIVATE bucket
--
-- Silinen projede `odevler` bucket'ı PUBLIC'ti. Doğrulanmıştı: public URL
-- isteği "Bucket not found" değil "NoSuchKey" döndürüyordu, yani bucket
-- vardı ve public okuma açıktı. Cevap anahtarı PDF'leri ve öğrenci çözüm
-- fotoğrafları URL'i bilen herkese açıktı.
--
-- Yeni bucket private. Erişim yalnız yetki kontrolü yapan fonksiyonun
-- ürettiği kısa ömürlü imzalı URL ile olacak (bkz. 0004: dosya_url).
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'odev-dosyalari',
  'odev-dosyalari',
  false,                                   -- PUBLIC DEĞİL
  10485760,                                -- 10 MB üst sınır
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Bucket'a doğrudan erişim yok. storage.objects üzerinde anon/authenticated
-- için politika TANIMLANMIYOR — RLS varsayılan olarak reddeder.
-- Yükleme ve okuma, imzalı URL üreten fonksiyon üzerinden yapılır.
drop policy if exists "odev_dosyalari_dogrudan_erisim_yok" on storage.objects;
create policy "odev_dosyalari_dogrudan_erisim_yok"
  on storage.objects for all to anon, authenticated
  using (false) with check (false);

-- ═══ 0003_guvenlik_fonksiyonlari.sql ═══
-- =============================================================================
-- SEKİZ — 0003 GÜVENLİK VE OTURUM KATMANI
--
-- Buradaki her fonksiyon:
--   * SECURITY DEFINER — tablo sahibinin haklarıyla çalışır, RLS'i atlar
--   * search_path sabitlenmiş — SECURITY DEFINER'da standart sertleştirme;
--     aksi hâlde çağıran taraf search_path'i değiştirip sahte tablo
--     gösterebilir
--   * yetkiyi PARAMETREDEN GELEN KİMLİĞE göre değil, jetondan doğrulayarak
--     belirler
--
-- Alt çizgiyle başlayan fonksiyonlar dahilidir; anon rolüne EXECUTE hakkı
-- verilmez (bkz. dosya sonu).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Jeton hash'i. Veritabanında jetonun kendisi asla durmaz.
-- -----------------------------------------------------------------------------
create or replace function public._token_hash(p_token text)
returns text
language sql
immutable
security definer
set search_path = public, extensions, pg_temp
as $$
  select encode(digest(p_token, 'sha256'), 'hex');
$$;

-- -----------------------------------------------------------------------------
-- Giriş kodu üreteci.
--
-- Alfabeden karışabilecek karakterler çıkarıldı: 0/O, 1/I/L. Kod telefonla
-- okunacak, elle yazılacak — okunabilirlik güvenliğin parçası, çünkü
-- karışan kod öğretmene "kodumu kaybettim" trafiği olarak geri döner.
--
-- 8 karakter × 32 harflik alfabe ≈ 1.1×10^12 olasılık. Giriş deneme
-- limitiyle birlikte kaba kuvvet pratikte imkânsız.
-- -----------------------------------------------------------------------------
create or replace function public._yeni_kod()
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  alfabe constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  -- Değişken adı sütun adıyla çakışmasın diye v_ önekli: PL/pgSQL'de
  -- `where g.kod = kod` ifadesindeki sağ taraf belirsiz kalıyordu.
  v_kod text;
  i integer;
begin
  loop
    v_kod := '';
    for i in 1..8 loop
      v_kod := v_kod || substr(alfabe, 1 + floor(random() * length(alfabe))::int, 1);
    end loop;
    -- Çakışma olasılığı çok düşük ama kontrol etmemek için sebep yok.
    exit when not exists (select 1 from public.giris_kodlari g where g.kod = v_kod);
  end loop;
  return v_kod;
end;
$$;

-- -----------------------------------------------------------------------------
-- Denetim izi kaydı (Part XLIII).
-- -----------------------------------------------------------------------------
create or replace function public._denetim(
  p_islem text,
  p_tablo text,
  p_kayit_id uuid,
  p_aktor text,
  p_eski jsonb default null,
  p_yeni jsonb default null
)
returns void
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  insert into public.denetim_izi (islem, tablo, kayit_id, aktor, eski, yeni)
  values (p_islem, p_tablo, p_kayit_id, p_aktor, p_eski, p_yeni);
$$;

-- -----------------------------------------------------------------------------
-- İstemci kimliği — deneme limiti için.
-- PostgREST istek başlıklarını `request.headers` altında sunar. IP yoksa
-- sabit bir değere düşeriz; o durumda limit küresel olur, yine de korur.
-- IP ham hâlde saklanmaz, hash'lenir (KVKK: gereksiz kişisel veri tutma).
-- -----------------------------------------------------------------------------
create or replace function public._istemci_kimligi()
returns text
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  basliklar json;
  ip text;
begin
  begin
    basliklar := current_setting('request.headers', true)::json;
    ip := coalesce(basliklar ->> 'cf-connecting-ip', basliklar ->> 'x-forwarded-for');
  exception when others then
    ip := null;
  end;
  return encode(digest(coalesce(ip, 'bilinmeyen'), 'sha256'), 'hex');
end;
$$;

-- -----------------------------------------------------------------------------
-- Deneme limiti.
--
-- Politika: son 15 dakikada 8 başarısız deneme → 15 dakika kilit.
-- Kilit süresi, üst üste kilitlenmelerde kademeli olarak artar.
-- -----------------------------------------------------------------------------
create or replace function public._kilitli_mi(p_kimlik text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  basarisiz integer;
begin
  select count(*) into basarisiz
  from public.giris_denemeleri
  where kimlik = p_kimlik
    and not basarili
    and zaman > now() - interval '15 minutes';

  return basarisiz >= 8;
end;
$$;

create or replace function public._deneme_kaydet(
  p_kimlik text,
  p_kod text,
  p_basarili boolean
)
returns void
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  insert into public.giris_denemeleri (kimlik, kod_ipucu, basarili)
  values (p_kimlik, left(coalesce(p_kod, ''), 2), p_basarili);
$$;

-- -----------------------------------------------------------------------------
-- Oturum açma. Ham jetonu YALNIZ burada, bir kez döndürür.
-- -----------------------------------------------------------------------------
create or replace function public._oturum_ac(
  p_rol text,
  p_ogrenci_id uuid,
  p_sure interval default interval '30 days'
)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  ham_token text;
begin
  ham_token := encode(gen_random_bytes(32), 'hex');

  insert into public.oturumlar (token_hash, rol, ogrenci_id, son_kullanma)
  values (public._token_hash(ham_token), p_rol, p_ogrenci_id, now() + p_sure);

  return ham_token;
end;
$$;

-- -----------------------------------------------------------------------------
-- Oturum doğrulama.
--
-- Her korumalı RPC'nin İLK satırında çağrılır. Geçersizse istisna fırlatır;
-- fonksiyonun geri kalanı hiç çalışmaz. "Önce iş yap, sonra yetki kontrol
-- et" hatası yapısal olarak engellenir.
-- -----------------------------------------------------------------------------
create or replace function public._oturum(p_token text)
returns table (rol text, ogrenci_id uuid)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  kayit record;
begin
  if p_token is null or length(p_token) < 32 then
    raise exception 'Oturum geçersiz. Lütfen tekrar giriş yapın.'
      using errcode = '28000';
  end if;

  select o.rol, o.ogrenci_id, o.id into kayit
  from public.oturumlar o
  where o.token_hash = public._token_hash(p_token)
    and not o.iptal
    and o.son_kullanma > now();

  if not found then
    raise exception 'Oturum süresi dolmuş. Lütfen tekrar giriş yapın.'
      using errcode = '28000';
  end if;

  update public.oturumlar set son_gorulme = now() where id = kayit.id;

  rol := kayit.rol;
  ogrenci_id := kayit.ogrenci_id;
  return next;
end;
$$;

-- -----------------------------------------------------------------------------
-- Öğretmen yetkisi zorunluluğu.
-- -----------------------------------------------------------------------------
create or replace function public._ogretmen(p_token text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'ogretmen' then
    raise exception 'Bu işlem için öğretmen yetkisi gerekiyor.'
      using errcode = '42501';
  end if;
end;
$$;

-- =============================================================================
-- HERKESE AÇIK GİRİŞ FONKSİYONLARI
-- =============================================================================

-- -----------------------------------------------------------------------------
-- İlk kurulum: öğretmen PIN'i belirleme.
-- Yalnız PIN henüz hiç belirlenmemişse çalışır — aksi hâlde herkes PIN'i
-- sıfırlayabilirdi.
-- -----------------------------------------------------------------------------
create or replace function public.pin_ayarla(p_yeni text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  mevcut text;
  token text;
begin
  select ogretmen_pin_hash into mevcut from public.ayarlar where id = 1;

  if mevcut is not null then
    raise exception 'PIN zaten belirlenmiş. Değiştirmek için mevcut PIN ile giriş yapın.'
      using errcode = '42501';
  end if;

  if p_yeni is null or length(p_yeni) < 6 then
    raise exception 'PIN en az 6 haneli olmalı.' using errcode = '22023';
  end if;

  -- bf = bcrypt. Düz metin saklanmıyor.
  update public.ayarlar
     set ogretmen_pin_hash = crypt(p_yeni, gen_salt('bf', 10))
   where id = 1;

  perform public._denetim('pin_ayarlandi', 'ayarlar', null, 'ogretmen');

  token := public._oturum_ac('ogretmen', null);
  return jsonb_build_object('rol', 'ogretmen', 'token', token);
end;
$$;

-- -----------------------------------------------------------------------------
-- PIN değiştirme — mevcut PIN doğrulanarak.
-- -----------------------------------------------------------------------------
create or replace function public.pin_degistir(p_token text, p_eski text, p_yeni text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  mevcut text;
begin
  perform public._ogretmen(p_token);

  select ogretmen_pin_hash into mevcut from public.ayarlar where id = 1;

  if mevcut is null or crypt(p_eski, mevcut) <> mevcut then
    raise exception 'Mevcut PIN doğru değil.' using errcode = '28000';
  end if;

  if p_yeni is null or length(p_yeni) < 6 then
    raise exception 'Yeni PIN en az 6 haneli olmalı.' using errcode = '22023';
  end if;

  update public.ayarlar
     set ogretmen_pin_hash = crypt(p_yeni, gen_salt('bf', 10))
   where id = 1;

  -- Güvenlik gereği diğer tüm oturumlar düşürülür.
  update public.oturumlar set iptal = true
   where rol = 'ogretmen' and token_hash <> public._token_hash(p_token);

  perform public._denetim('pin_degistirildi', 'ayarlar', null, 'ogretmen');

  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- -----------------------------------------------------------------------------
-- GİRİŞ — tek alan: öğretmen PIN'i, öğrenci kodu veya veli kodu.
--
-- Dönüş: { rol, token, ogrenci? }  — ham jeton yalnız burada verilir.
-- PIN artık her istekte gönderilmez.
-- -----------------------------------------------------------------------------
create or replace function public.giris(p_kod text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  kimlik   text;
  pin_hash text;
  kayit    record;
  token    text;
  ogr      record;
begin
  kimlik := public._istemci_kimligi();

  if public._kilitli_mi(kimlik) then
    raise exception 'Çok fazla hatalı deneme yapıldı. 15 dakika sonra tekrar deneyin.'
      using errcode = '53400';
  end if;

  if p_kod is null or length(btrim(p_kod)) = 0 then
    raise exception 'Kod boş olamaz.' using errcode = '22023';
  end if;

  p_kod := btrim(p_kod);

  -- 1) İlk kurulum: PIN hiç belirlenmemişse kurulum ekranına yönlendir.
  select ogretmen_pin_hash into pin_hash from public.ayarlar where id = 1;
  if pin_hash is null then
    return jsonb_build_object('rol', 'kurulum');
  end if;

  -- 2) Öğretmen PIN'i mi?
  if crypt(p_kod, pin_hash) = pin_hash then
    perform public._deneme_kaydet(kimlik, p_kod, true);
    token := public._oturum_ac('ogretmen', null);
    return jsonb_build_object('rol', 'ogretmen', 'token', token);
  end if;

  -- 3) Öğrenci ya da veli kodu mu?
  --    Kodlar tek tabloda birincil anahtar olduğu için rol belirsizliği yok.
  select gk.rol, gk.ogrenci_id into kayit
  from public.giris_kodlari gk
  join public.ogrenciler o on o.id = gk.ogrenci_id
  where gk.kod = upper(p_kod) and o.aktif;

  if not found then
    perform public._deneme_kaydet(kimlik, p_kod, false);
    return jsonb_build_object('rol', 'yok');
  end if;

  perform public._deneme_kaydet(kimlik, p_kod, true);
  token := public._oturum_ac(kayit.rol, kayit.ogrenci_id);

  select o.id, o.ad, o.tur, s.ad as sinif into ogr
  from public.ogrenciler o
  left join public.siniflar s on s.id = o.sinif_id
  where o.id = kayit.ogrenci_id;

  return jsonb_build_object(
    'rol', kayit.rol,
    'token', token,
    'ogrenci', jsonb_build_object(
      'id', ogr.id, 'ad', ogr.ad, 'tur', ogr.tur, 'sinif', ogr.sinif
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- ÇIKIŞ — jetonu iptal eder.
-- Eski sistemde çıkış yalnız localStorage'ı siliyordu; sunucuda karşılığı
-- yoktu, yani kopyalanmış bir PIN sonsuza kadar geçerliydi.
-- -----------------------------------------------------------------------------
create or replace function public.cikis(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  update public.oturumlar
     set iptal = true
   where token_hash = public._token_hash(p_token);
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- -----------------------------------------------------------------------------
-- Süresi dolmuş oturumların temizliği. Zamanlanmış görevden çağrılabilir.
-- -----------------------------------------------------------------------------
create or replace function public.oturum_temizle()
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  silinen integer;
begin
  delete from public.oturumlar
   where son_kullanma < now() - interval '7 days' or iptal;
  get diagnostics silinen = row_count;

  delete from public.giris_denemeleri where zaman < now() - interval '30 days';

  return silinen;
end;
$$;

-- =============================================================================
-- EXECUTE HAKLARI
--
-- 0002'de tüm fonksiyonlardan haklar çekildi. Burada YALNIZ dışarıya açık
-- olması gerekenler geri veriliyor. Alt çizgiyle başlayan dahili
-- fonksiyonlara anon EXECUTE hakkı ALMIYOR — dışarıdan çağrılamazlar.

-- EXECUTE hakları tek yerde toplandı: 0005_fonksiyon_yetkileri.sql

-- ═══ 0004_rpc_katmani.sql ═══
-- =============================================================================
-- SEKİZ — 0004 RPC KATMANI
--
-- Kural: her fonksiyon İLK satırında yetkiyi doğrular. Parametreden gelen
-- kimliğe asla güvenilmez; öğrenci/veli kimliği jetondan okunur.
-- =============================================================================

-- =============================================================================
-- DETERMİNİSTİK TEST PUANLAMA
--
-- YAPAY ZEKÂ KULLANILMAZ (Kural 5). Test puanlaması karşılaştırmadır:
-- hızlı, tekrarlanabilir, denetlenebilir olmak zorundadır. Aynı girdi her
-- zaman aynı sonucu verir; bir veli "bu puan nasıl çıktı?" diye sorduğunda
-- cevabı satır satır gösterilebilir olmalıdır.
--
-- Dayanıklılık (Part XLVIII): boş cevap, geçersiz şık, eksik soru ve
-- fazladan anahtar girdisi çökmeden ele alınır.
-- =============================================================================
create or replace function public._puanla(
  p_anahtar jsonb,
  p_cevaplar jsonb,
  p_soru_sayisi integer
)
returns table (dogru integer, yanlis integer, bos integer, puan numeric)
language plpgsql
immutable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  i integer;
  d integer := 0;
  y integer := 0;
  b integer := 0;
  anahtar_sik text;
  ogrenci_sik text;
begin
  for i in 1..p_soru_sayisi loop
    anahtar_sik := upper(btrim(coalesce(p_anahtar ->> i::text, '')));
    ogrenci_sik := upper(btrim(coalesce(p_cevaplar ->> i::text, '')));

    if ogrenci_sik = '' then
      -- Cevaplanmamış: yanlış değil, boş.
      b := b + 1;
    elsif anahtar_sik = '' then
      -- Anahtarda o soru yoksa öğrenci cezalandırılmaz.
      b := b + 1;
    elsif ogrenci_sik = anahtar_sik then
      d := d + 1;
    else
      -- Geçersiz bir şık ('Z', '3', bozuk veri) de basitçe yanlıştır.
      y := y + 1;
    end if;
  end loop;

  dogru  := d;
  yanlis := y;
  bos    := b;
  puan   := case when p_soru_sayisi > 0
                 then round(d * 100.0 / p_soru_sayisi, 2)
                 else 0 end;
  return next;
end;
$$;

-- =============================================================================
-- SINIF YÖNETİMİ (Part XXVI)
-- =============================================================================
create or replace function public.siniflar_listesi(p_token text, p_arsiv boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public._ogretmen(p_token);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id, 'ad', s.ad, 'seviye', s.seviye,
             'sube', s.sube, 'arsiv', s.arsiv,
             'ogrenci_sayisi', (select count(*) from public.ogrenciler o where o.sinif_id = s.id and o.aktif)
           ) order by s.seviye, s.sube)
    from public.siniflar s
    where p_arsiv or not s.arsiv
  ), '[]'::jsonb);
end;
$$;

create or replace function public.sinif_ekle(p_token text, p_seviye smallint, p_sube text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  yeni public.siniflar;
begin
  perform public._ogretmen(p_token);

  insert into public.siniflar (seviye, sube)
  values (p_seviye, upper(btrim(p_sube)))
  on conflict (seviye, sube) do update set arsiv = false
  returning * into yeni;

  perform public._denetim('sinif_eklendi', 'siniflar', yeni.id, 'ogretmen',
                          null, to_jsonb(yeni));
  return jsonb_build_object('id', yeni.id, 'ad', yeni.ad);
end;
$$;

-- Sınıf silinmez, arşivlenir: geçmiş ödev kayıtları bozulmasın (Part XXVI).
create or replace function public.sinif_arsivle(p_token text, p_id uuid, p_arsiv boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public._ogretmen(p_token);
  update public.siniflar set arsiv = p_arsiv where id = p_id;
  perform public._denetim(
    case when p_arsiv then 'sinif_arsivlendi' else 'sinif_geri_alindi' end,
    'siniflar', p_id, 'ogretmen');
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- =============================================================================
-- ÖĞRENCİ YÖNETİMİ
-- =============================================================================
create or replace function public.ogrenci_ekle(
  p_token text,
  p_ad text,
  p_tur text,
  p_sinif_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  yeni_id uuid;
  kod_ogrenci text;
  kod_veli text;
begin
  perform public._ogretmen(p_token);

  if p_tur = 'okul' and p_sinif_id is null then
    raise exception 'Okul öğrencisi için sınıf seçilmeli.' using errcode = '22023';
  end if;

  insert into public.ogrenciler (ad, tur, sinif_id)
  values (btrim(p_ad), p_tur, p_sinif_id)
  returning id into yeni_id;

  kod_ogrenci := public._yeni_kod();
  kod_veli    := public._yeni_kod();

  insert into public.giris_kodlari (kod, ogrenci_id, rol)
  values (kod_ogrenci, yeni_id, 'ogrenci'), (kod_veli, yeni_id, 'veli');

  perform public._denetim('ogrenci_eklendi', 'ogrenciler', yeni_id, 'ogretmen');

  return jsonb_build_object(
    'id', yeni_id, 'ogrenci_kodu', kod_ogrenci, 'veli_kodu', kod_veli
  );
end;
$$;

-- Öğrenci SİLİNMEZ, pasife alınır.
--
-- Eski sistemde silme "öğrenci ve tüm kayıtları" kaldırıyordu ve geri alınamıyordu.
-- Eğitim kaydı sessizce yok edilmemeli (Part XLIII). Pasif öğrencinin
-- kodları iptal edilir — erişimi anında düşer (Part XLIX, madde 14).
create or replace function public.ogrenci_pasiflestir(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public._ogretmen(p_token);

  update public.ogrenciler set aktif = false where id = p_id;
  delete from public.giris_kodlari where ogrenci_id = p_id;
  update public.oturumlar set iptal = true where ogrenci_id = p_id;

  perform public._denetim('ogrenci_pasiflestirildi', 'ogrenciler', p_id, 'ogretmen');
  return jsonb_build_object('durum', 'tamam');
end;
$$;

create or replace function public.ogrenci_kodlari(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  sonuc jsonb;
begin
  perform public._ogretmen(p_token);
  select jsonb_object_agg(rol, kod) into sonuc
  from public.giris_kodlari where ogrenci_id = p_id;
  return coalesce(sonuc, '{}'::jsonb);
end;
$$;

-- =============================================================================
-- ÖĞRETMEN PANOSU — sayfalanabilir (Part XVI: ~200 öğrenci ölçeği)
-- =============================================================================
create or replace function public.ogretmen_panosu(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun date := current_date;
begin
  perform public._ogretmen(p_token);

  return jsonb_build_object(
    'ogrenci_sayisi', (select count(*) from public.ogrenciler where aktif),
    'acik_odev', (select count(*) from public.odevler
                   where yayinda and son_tarih >= bugun),
    'bekleyen_degerlendirme', (select count(*) from public.gonderimler g
                                join public.odevler o on o.id = g.odev_id
                               where o.tur = 'acik' and g.durum = 'incelemede'),
    'gecikmis_eksik', (
      select count(*)
      from public.odevler o
      join public.ogrenciler ogr
        on ogr.sinif_id = o.sinif_id and ogr.aktif
      where o.yayinda and o.son_tarih < bugun
        and not exists (select 1 from public.gonderimler g
                         where g.odev_id = o.id and g.ogrenci_id = ogr.id)
    ),
    'son_gonderimler', coalesce((
      select jsonb_agg(x order by x->>'zaman' desc) from (
        select jsonb_build_object(
                 'ogrenci', ogr.ad, 'odev', o.baslik,
                 'puan', coalesce(g.ogretmen_puan, g.puan),
                 'zaman', g.created_at
               ) as x
        from public.gonderimler g
        join public.ogrenciler ogr on ogr.id = g.ogrenci_id
        join public.odevler o on o.id = g.odev_id
        order by g.created_at desc limit 10
      ) t
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.ogrenciler_listesi(
  p_token text,
  p_arama text default null,
  p_sinif_id uuid default null,
  p_sayfa integer default 1,
  p_boyut integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  toplam integer;
  satirlar jsonb;
begin
  perform public._ogretmen(p_token);
  p_boyut := least(greatest(coalesce(p_boyut, 25), 1), 100);
  p_sayfa := greatest(coalesce(p_sayfa, 1), 1);

  select count(*) into toplam
  from public.ogrenciler o
  where o.aktif
    and (p_sinif_id is null or o.sinif_id = p_sinif_id)
    and (p_arama is null or o.ad ilike '%' || p_arama || '%');

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', o.id, 'ad', o.ad, 'tur', o.tur, 'sinif', s.ad
         ) order by o.ad), '[]'::jsonb) into satirlar
  from (
    select o.* from public.ogrenciler o
    where o.aktif
      and (p_sinif_id is null or o.sinif_id = p_sinif_id)
      and (p_arama is null or o.ad ilike '%' || p_arama || '%')
    order by o.ad
    limit p_boyut offset (p_sayfa - 1) * p_boyut
  ) o
  left join public.siniflar s on s.id = o.sinif_id;

  return jsonb_build_object(
    'toplam', toplam,
    'sayfa', p_sayfa,
    'toplam_sayfa', greatest(ceil(toplam::numeric / p_boyut)::int, 1),
    'kayitlar', satirlar
  );
end;
$$;

-- =============================================================================
-- ÖDEV YÖNETİMİ
-- =============================================================================
create or replace function public.odev_olustur(
  p_token text,
  p_baslik text,
  p_aciklama text,
  p_sinif_id uuid,
  p_tur text,
  p_son_tarih date,
  p_soru_sayisi integer default null,
  p_cevap_anahtari jsonb default null,
  p_anahtar_yolu text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  yeni_id uuid;
begin
  perform public._ogretmen(p_token);

  insert into public.odevler
    (baslik, aciklama, sinif_id, tur, son_tarih, soru_sayisi,
     cevap_anahtari, anahtar_url, yayinda)
  values
    (btrim(p_baslik), nullif(btrim(coalesce(p_aciklama, '')), ''), p_sinif_id,
     p_tur, p_son_tarih, p_soru_sayisi, p_cevap_anahtari, p_anahtar_yolu,
     false)  -- Taslak olarak başlar; öğretmen onaylamadan öğrenciye düşmez.
  returning id into yeni_id;

  perform public._denetim('odev_olusturuldu', 'odevler', yeni_id, 'ogretmen');
  return jsonb_build_object('id', yeni_id, 'yayinda', false);
end;
$$;

-- Yayınlama ayrı adım: doğrulanmamış cevap anahtarı asla yayına çıkmaz
-- (Part XXVIII).
create or replace function public.odev_yayinla(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o public.odevler;
  eksik integer;
  i integer;
begin
  perform public._ogretmen(p_token);
  select * into o from public.odevler where id = p_id;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  if o.tur = 'test' then
    eksik := 0;
    for i in 1..o.soru_sayisi loop
      if coalesce(o.cevap_anahtari ->> i::text, '') = '' then
        eksik := eksik + 1;
      end if;
    end loop;
    if eksik > 0 then
      raise exception 'Cevap anahtarında % soru eksik. Yayınlamadan önce tamamlayın.', eksik
        using errcode = '22023';
    end if;
  end if;

  update public.odevler set yayinda = true where id = p_id;
  perform public._denetim('odev_yayinlandi', 'odevler', p_id, 'ogretmen');
  return jsonb_build_object('durum', 'tamam');
end;
$$;

create or replace function public.odev_sil(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o public.odevler;
begin
  perform public._ogretmen(p_token);
  select * into o from public.odevler where id = p_id;
  -- Silinen ödevin içeriği denetim izine yazılır; sessizce kaybolmaz.
  perform public._denetim('odev_silindi', 'odevler', p_id, 'ogretmen', to_jsonb(o));
  delete from public.odevler where id = p_id;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- =============================================================================
-- ÖĞRENCİ TARAFI
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ogrenci_odevleri
--
-- BU FONKSİYONUN EN KRİTİK DAVRANIŞI:
-- Cevap anahtarı (`cevap_anahtari`, `anahtar_url`), öğrenci teslim etmeden
-- SORGUYA HİÇ DAHİL EDİLMEZ. İstemcide gizlemek koruma değildir; karar
-- burada, sunucuda verilir (Part XXI).
-- -----------------------------------------------------------------------------
create or replace function public.ogrenci_odevleri(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  ogr record;
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'ogrenci' then
    raise exception 'Bu bölüm yalnızca öğrenciler içindir.' using errcode = '42501';
  end if;

  select ogr2.id, ogr2.ad, ogr2.tur, s.ad as sinif, ogr2.sinif_id
    into ogr
  from public.ogrenciler ogr2
  left join public.siniflar s on s.id = ogr2.sinif_id
  where ogr2.id = o.ogrenci_id;

  return jsonb_build_object(
    'ogrenci', jsonb_build_object('id', ogr.id, 'ad', ogr.ad, 'sinif', ogr.sinif),
    'odevler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'baslik', d.baslik,
        'aciklama', d.aciklama,
        'tur', d.tur,
        'son_tarih', d.son_tarih,
        'soru_sayisi', d.soru_sayisi,
        'gonderim', case when g.id is null then null else jsonb_build_object(
          'id', g.id, 'zaman', g.created_at, 'durum', g.durum,
          'dogru', g.dogru, 'yanlis', g.yanlis, 'bos', g.bos,
          'puan', g.puan, 'ogretmen_puan', g.ogretmen_puan,
          'ogretmen_yorum', g.ogretmen_yorum
        ) end,
        -- Anahtar YALNIZ teslim varsa eklenir. Teslim yoksa alan hiç yok.
        'cevap_anahtari', case when g.id is not null then d.cevap_anahtari else null end,
        'anahtar_yolu',   case when g.id is not null then d.anahtar_url    else null end
      ) order by d.son_tarih)
      from public.odevler d
      left join public.gonderimler g
        on g.odev_id = d.id and g.ogrenci_id = ogr.id
      where d.yayinda and d.sinif_id = ogr.sinif_id
    ), '[]'::jsonb),
    'dersler', coalesce((
      select jsonb_agg(jsonb_build_object('zaman', l.zaman, 'mod', l.mod, 'link', l.link)
                       order by l.zaman)
      from public.dersler l
      where l.ogrenci_id = ogr.id and l.zaman > now()
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- odev_gonder
--
-- Mükerrer teslim iki katmanda engellenir: burada açık kontrol, ve
-- veritabanında `gonderim_tek` UNIQUE kısıtı. İkincisi yarış koşullarına
-- karşı gerçek korumadır (Part XLIX, madde 12).
-- -----------------------------------------------------------------------------
create or replace function public.odev_gonder(
  p_token text,
  p_odev uuid,
  p_foto_yolu text,
  p_cevaplar jsonb default null
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
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'ogrenci' then
    raise exception 'Yalnızca öğrenci ödev gönderebilir.' using errcode = '42501';
  end if;

  select * into d from public.odevler where id = p_odev and yayinda;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  -- Ödev öğrencinin sınıfına ait mi? (Part XLIX, madde 1)
  if not exists (
    select 1 from public.ogrenciler ogr
    where ogr.id = o.ogrenci_id and ogr.sinif_id = d.sinif_id
  ) then
    raise exception 'Bu ödev sizin sınıfınıza ait değil.' using errcode = '42501';
  end if;

  if p_foto_yolu is null or btrim(p_foto_yolu) = '' then
    raise exception 'Çözüm fotoğrafı olmadan ödev gönderilemez.' using errcode = '22023';
  end if;

  if d.tur = 'test' then
    select * into s from public._puanla(d.cevap_anahtari, coalesce(p_cevaplar, '{}'::jsonb), d.soru_sayisi);

    insert into public.gonderimler
      (odev_id, ogrenci_id, cevaplar, foto_yolu, dogru, yanlis, bos, puan, durum)
    values
      (p_odev, o.ogrenci_id, p_cevaplar, p_foto_yolu, s.dogru, s.yanlis, s.bos, s.puan, 'puanlandi')
    returning id into yeni_id;

    perform public._denetim('odev_gonderildi', 'gonderimler', yeni_id,
                            'ogrenci:' || o.ogrenci_id);

    return jsonb_build_object(
      'id', yeni_id, 'dogru', s.dogru, 'yanlis', s.yanlis,
      'bos', s.bos, 'puan', s.puan
    );
  else
    insert into public.gonderimler
      (odev_id, ogrenci_id, foto_yolu, durum)
    values
      (p_odev, o.ogrenci_id, p_foto_yolu, 'incelemede')
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

-- =============================================================================
-- AÇIK UÇLU PUANLAMA (öğretmen)
-- Not değişiklikleri her zaman denetim izine yazılır (Part XLIII).
-- =============================================================================
create or replace function public.acik_puanla(
  p_token text,
  p_gonderim uuid,
  p_puan numeric,
  p_yorum text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  eski public.gonderimler;
begin
  perform public._ogretmen(p_token);

  select * into eski from public.gonderimler where id = p_gonderim;
  if not found then
    raise exception 'Gönderim bulunamadı.' using errcode = 'P0002';
  end if;

  if p_puan < 0 or p_puan > 100 then
    raise exception 'Puan 0 ile 100 arasında olmalı.' using errcode = '22023';
  end if;

  update public.gonderimler
     set ogretmen_puan = p_puan,
         ogretmen_yorum = nullif(btrim(coalesce(p_yorum, '')), ''),
         durum = 'onaylandi'
   where id = p_gonderim;

  perform public._denetim(
    'acik_uclu_puanlandi', 'gonderimler', p_gonderim, 'ogretmen',
    jsonb_build_object('ogretmen_puan', eski.ogretmen_puan, 'durum', eski.durum),
    jsonb_build_object('ogretmen_puan', p_puan, 'durum', 'onaylandi'));

  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- =============================================================================
-- VELİ PANELİ
--
-- Veli cevap anahtarını HİÇBİR KOŞULDA görmez (Kural 6). Aşağıdaki sorgu
-- `cevap_anahtari` ve `anahtar_url` alanlarını hiç seçmez.
-- =============================================================================
create or replace function public.veli_paneli(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  ogr record;
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'veli' then
    raise exception 'Bu bölüm yalnızca veliler içindir.' using errcode = '42501';
  end if;

  select ogr2.id, ogr2.ad, ogr2.tur, s.ad as sinif, ogr2.sinif_id into ogr
  from public.ogrenciler ogr2
  left join public.siniflar s on s.id = ogr2.sinif_id
  where ogr2.id = o.ogrenci_id;

  return jsonb_build_object(
    'ogrenci', jsonb_build_object('ad', ogr.ad, 'sinif', ogr.sinif, 'tur', ogr.tur),
    'odevler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'baslik', d.baslik,
        'son_tarih', d.son_tarih,
        'olusturma', d.created_at,
        'gonderildi', (g.id is not null),
        'gonderim_zamani', g.created_at,
        'puan', coalesce(g.ogretmen_puan, g.puan),
        'durum', g.durum
      ) order by d.son_tarih desc)
      from public.odevler d
      left join public.gonderimler g
        on g.odev_id = d.id and g.ogrenci_id = ogr.id
      where d.yayinda and d.sinif_id = ogr.sinif_id
    ), '[]'::jsonb),
    'mesajlar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kimden', m.kimden, 'metin', m.metin, 'zaman', m.created_at)
             order by m.created_at)
      from public.mesajlar m where m.ogrenci_id = ogr.id
    ), '[]'::jsonb),
    'odemeler', case when ogr.tur = 'ozel' then coalesce((
      select jsonb_agg(jsonb_build_object('tutar', p.tutar, 'tarih', p.tarih, 'odendi', p.odendi)
                       order by p.tarih desc)
      from public.odemeler p where p.ogrenci_id = ogr.id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'son_gorulme', (select zaman from public.okundu where ogrenci_id = ogr.id)
  );
end;
$$;

create or replace function public.okundu_isaretle(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
begin
  select * into o from public._oturum(p_token);
  if o.ogrenci_id is null then
    raise exception 'Geçersiz oturum.' using errcode = '42501';
  end if;

  insert into public.okundu (ogrenci_id, rol, zaman)
  values (o.ogrenci_id, o.rol, now())
  on conflict (ogrenci_id) do update set zaman = now();

  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- =============================================================================
-- MESAJLAŞMA
-- Metin düz metin olarak saklanır ve istemcide React tarafından kaçışlanır;
-- HTML hiçbir yerde render edilmez (Part XXXI, XLIX madde 10).
-- =============================================================================
create or replace function public.mesaj_gonder(
  p_token text,
  p_metin text,
  p_ogrenci_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  hedef uuid;
  kimden text;
begin
  select * into o from public._oturum(p_token);

  if o.rol = 'ogretmen' then
    if p_ogrenci_id is null then
      raise exception 'Mesajın gideceği öğrenci seçilmeli.' using errcode = '22023';
    end if;
    hedef := p_ogrenci_id;
    kimden := 'ogretmen';
  elsif o.rol = 'veli' then
    -- Veli yalnız kendi öğrencisi adına yazabilir; parametre yok sayılır.
    hedef := o.ogrenci_id;
    kimden := 'veli';
  else
    raise exception 'Bu bölümde mesaj gönderemezsiniz.' using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_metin, ''))) = 0 then
    raise exception 'Mesaj boş olamaz.' using errcode = '22023';
  end if;

  insert into public.mesajlar (ogrenci_id, kimden, metin)
  values (hedef, kimden, btrim(p_metin));

  return jsonb_build_object('durum', 'tamam');
end;
$$;

create or replace function public.mesajlar_ogretmen(p_token text, p_ogrenci_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public._ogretmen(p_token);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'kimden', m.kimden, 'metin', m.metin, 'zaman', m.created_at)
           order by m.created_at)
    from public.mesajlar m where m.ogrenci_id = p_ogrenci_id
  ), '[]'::jsonb);
end;
$$;

-- =============================================================================
-- ÖZEL DERS: ders planı ve ödeme (Part XI)
-- Okul öğrencisinde bu kayıtlar hiç oluşturulamaz.
-- =============================================================================
create or replace function public._ozel_ders_ogrencisi(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not exists (select 1 from public.ogrenciler where id = p_id and tur = 'ozel') then
    raise exception 'Bu işlem yalnızca özel ders öğrencileri için yapılabilir.'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function public.ders_ekle(
  p_token text, p_ogrenci uuid, p_zaman timestamptz,
  p_mod text default 'yuzyuze', p_link text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare yeni uuid;
begin
  perform public._ogretmen(p_token);
  perform public._ozel_ders_ogrencisi(p_ogrenci);
  insert into public.dersler (ogrenci_id, zaman, mod, link)
  values (p_ogrenci, p_zaman, p_mod, nullif(btrim(coalesce(p_link, '')), ''))
  returning id into yeni;
  return jsonb_build_object('id', yeni);
end;
$$;

create or replace function public.ders_sil(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public._ogretmen(p_token);
  delete from public.dersler where id = p_id;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

create or replace function public.odeme_ekle(
  p_token text, p_ogrenci uuid, p_tutar numeric, p_tarih date
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare yeni uuid;
begin
  perform public._ogretmen(p_token);
  perform public._ozel_ders_ogrencisi(p_ogrenci);
  insert into public.odemeler (ogrenci_id, tutar, tarih)
  values (p_ogrenci, p_tutar, p_tarih) returning id into yeni;
  perform public._denetim('odeme_eklendi', 'odemeler', yeni, 'ogretmen');
  return jsonb_build_object('id', yeni);
end;
$$;

create or replace function public.odeme_degistir(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public._ogretmen(p_token);
  update public.odemeler set odendi = not odendi where id = p_id;
  perform public._denetim('odeme_durumu_degisti', 'odemeler', p_id, 'ogretmen');
  return jsonb_build_object('durum', 'tamam');
end;
$$;

create or replace function public.odeme_sil(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare eski public.odemeler;
begin
  perform public._ogretmen(p_token);
  select * into eski from public.odemeler where id = p_id;
  perform public._denetim('odeme_silindi', 'odemeler', p_id, 'ogretmen', to_jsonb(eski));
  delete from public.odemeler where id = p_id;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- =============================================================================
-- DOSYA ERİŞİM YETKİSİ
--
-- Bu fonksiyon KARARI verir: "bu jeton bu dosyayı görebilir mi?"
--
-- İmzalı URL'in KENDİSİNİ üretmek SQL'den mümkün değil — Storage API
-- gerektiriyor. O adım bir Edge Function'a düşecek: fonksiyon önce bunu
-- çağırıp yetkiyi doğrulayacak, sonra service_role ile imzalı URL üretecek.
--
-- Faz 1'de bu Edge Function DEPLOY EDİLMEDİ (deploy için gereken erişim
-- yok). Dosya akışı Faz 2/3'te arayüzle birlikte devreye girecek.
-- Bucket private olduğu için bu arada dosyalara kimse erişemez — güvenli
-- taraf.
-- =============================================================================
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

  -- Öğretmen her dosyayı görebilir.
  if o.rol = 'ogretmen' then
    return true;
  end if;

  -- Öğrenci: yalnız kendi gönderdiği dosya, ya da teslim ettiği ödevin
  -- cevap anahtarı.
  if o.rol = 'ogrenci' then
    return exists (
      select 1 from public.gonderimler g
      where g.ogrenci_id = o.ogrenci_id and g.foto_yolu = p_yol
    ) or exists (
      select 1 from public.odevler d
      join public.gonderimler g on g.odev_id = d.id and g.ogrenci_id = o.ogrenci_id
      where d.anahtar_url = p_yol
    );
  end if;

  -- Veli: cevap anahtarına ASLA erişemez (Kural 6). Yalnız çocuğunun
  -- gönderdiği çözüm kâğıdı.
  if o.rol = 'veli' then
    return exists (
      select 1 from public.gonderimler g
      where g.ogrenci_id = o.ogrenci_id and g.foto_yolu = p_yol
    );
  end if;

  return false;
end;
$$;

-- =============================================================================
-- YEDEKLEME / DIŞA AKTARIM (Part XXIV)
--
-- Faz 10'dan Faz 1'e alındı: canlı veritabanının silinmesiyle veri kaybı
-- yaşandı. Geri getirilemeyen bir sistemde yedeklemeyi sona bırakmak
-- savunulabilir değil.
-- =============================================================================
create or replace function public.disa_aktar(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public._ogretmen(p_token);
  perform public._denetim('disa_aktarildi', null, null, 'ogretmen');

  return jsonb_build_object(
    'alindi', now(),
    'siniflar',  coalesce((select jsonb_agg(to_jsonb(s) order by s.seviye, s.sube) from public.siniflar s), '[]'::jsonb),
    'ogrenciler', coalesce((select jsonb_agg(to_jsonb(o) order by o.ad) from public.ogrenciler o), '[]'::jsonb),
    'giris_kodlari', coalesce((select jsonb_agg(to_jsonb(k)) from public.giris_kodlari k), '[]'::jsonb),
    'odevler',   coalesce((select jsonb_agg(to_jsonb(d)) from public.odevler d), '[]'::jsonb),
    'gonderimler', coalesce((select jsonb_agg(to_jsonb(g)) from public.gonderimler g), '[]'::jsonb),
    'mesajlar',  coalesce((select jsonb_agg(to_jsonb(m)) from public.mesajlar m), '[]'::jsonb),
    'dersler',   coalesce((select jsonb_agg(to_jsonb(l)) from public.dersler l), '[]'::jsonb),
    'odemeler',  coalesce((select jsonb_agg(to_jsonb(p)) from public.odemeler p), '[]'::jsonb)
  );
end;
$$;

-- =============================================================================
-- EXECUTE HAKLARI — yalnız dışarıya açık olanlar

-- EXECUTE hakları tek yerde toplandı: 0005_fonksiyon_yetkileri.sql

-- ═══ 0005_fonksiyon_yetkileri.sql ═══
-- =============================================================================
-- SEKİZ — 0005 FONKSİYON YETKİLERİ (izin listesi)
--
-- BU DOSYA NEDEN VAR:
--
-- PostgreSQL yeni oluşturulan her fonksiyona varsayılan olarak `PUBLIC`
-- rolüne EXECUTE hakkı verir. 0002'de yetkiler `anon` ve `authenticated`
-- rollerinden çekilmişti — ama `PUBLIC`'ten çekilmemişti ve her rol
-- PUBLIC'ten miras alır.
--
-- Sonuç, yerel testte yakalandı: `_oturum_ac('ogretmen', null)` anon
-- rolüyle çağrılabiliyordu. Yani PIN bilmeyen biri kendine ÖĞRETMEN JETONU
-- üretebilirdi — tam kimlik doğrulama atlatması.
--
-- Bu dosya tüm fonksiyon haklarını sıfırlayıp yalnız dışarıya açık olması
-- gerekenleri geri verir. Migration sırasının EN SONUNDA çalışmalıdır:
-- yeni bir fonksiyon eklendiğinde bu dosya da güncellenmeli, aksi hâlde
-- fonksiyon dışarıdan çağrılamaz (güvenli taraf — sessizce açılmaz).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Hepsini kapat. PUBLIC dahil.
-- -----------------------------------------------------------------------------
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all routines  in schema public from public, anon, authenticated;

-- Bundan sonra oluşturulacaklar için de varsayılanı kapat.
alter default privileges in schema public revoke all on functions from public;
alter default privileges in schema public revoke all on routines  from public;

-- -----------------------------------------------------------------------------
-- 2. İZİN LİSTESİ — yalnız buradakiler dışarıdan çağrılabilir.
--
-- Listede OLMAYAN her fonksiyon (özellikle alt çizgiyle başlayan dahili
-- yardımcılar: _oturum_ac, _oturum, _ogretmen, _token_hash, _yeni_kod,
-- _puanla, _denetim, _kilitli_mi, _deneme_kaydet, _istemci_kimligi,
-- _ozel_ders_ogrencisi) dışarıdan erişilemez.
-- -----------------------------------------------------------------------------

-- Giriş / oturum
grant execute on function public.giris(text)                     to anon, authenticated;
grant execute on function public.pin_ayarla(text)                to anon, authenticated;
grant execute on function public.pin_degistir(text, text, text)  to anon, authenticated;
grant execute on function public.cikis(text)                     to anon, authenticated;

-- Öğretmen — sınıf
grant execute on function public.siniflar_listesi(text, boolean)    to anon, authenticated;
grant execute on function public.sinif_ekle(text, smallint, text)   to anon, authenticated;
grant execute on function public.sinif_arsivle(text, uuid, boolean) to anon, authenticated;

-- Öğretmen — öğrenci
grant execute on function public.ogrenci_ekle(text, text, text, uuid)                   to anon, authenticated;
grant execute on function public.ogrenci_pasiflestir(text, uuid)                        to anon, authenticated;
grant execute on function public.ogrenci_kodlari(text, uuid)                            to anon, authenticated;
grant execute on function public.ogrenciler_listesi(text, text, uuid, integer, integer) to anon, authenticated;

-- Öğretmen — pano ve ödev
grant execute on function public.ogretmen_panosu(text)                     to anon, authenticated;
grant execute on function public.odev_yayinla(text, uuid)                  to anon, authenticated;
grant execute on function public.odev_sil(text, uuid)                      to anon, authenticated;
grant execute on function public.acik_puanla(text, uuid, numeric, text)    to anon, authenticated;
grant execute on function
  public.odev_olustur(text, text, text, uuid, text, date, integer, jsonb, text)
  to anon, authenticated;

-- Öğrenci
grant execute on function public.ogrenci_odevleri(text)                to anon, authenticated;
grant execute on function public.odev_gonder(text, uuid, text, jsonb)  to anon, authenticated;

-- Veli
grant execute on function public.veli_paneli(text)      to anon, authenticated;
grant execute on function public.okundu_isaretle(text)  to anon, authenticated;

-- Mesajlaşma
grant execute on function public.mesaj_gonder(text, text, uuid)     to anon, authenticated;
grant execute on function public.mesajlar_ogretmen(text, uuid)      to anon, authenticated;

-- Özel ders
grant execute on function public.ders_ekle(text, uuid, timestamptz, text, text) to anon, authenticated;
grant execute on function public.ders_sil(text, uuid)                           to anon, authenticated;
grant execute on function public.odeme_ekle(text, uuid, numeric, date)          to anon, authenticated;
grant execute on function public.odeme_degistir(text, uuid)                     to anon, authenticated;
grant execute on function public.odeme_sil(text, uuid)                          to anon, authenticated;

-- Dosya yetkisi ve yedekleme
grant execute on function public.dosya_erisim_izni(text, text) to anon, authenticated;
grant execute on function public.disa_aktar(text)              to anon, authenticated;

-- Bakım fonksiyonu dışarıya AÇILMAZ: oturum_temizle() yalnız zamanlanmış
-- görevden ya da panelden çalıştırılır.

-- ═══ 0006_baslangic_verisi.sql ═══
-- =============================================================================
-- SEKİZ — 0006 BAŞLANGIÇ VERİSİ
--
-- Sınıflar KODA SABİT YAZILMAZ (Part XXVI). Bu liste yalnızca başlangıç
-- verisidir; öğretmen panelden yeni sınıf ekleyebilir, mevcut sınıfı
-- arşivleyebilir.
--
-- Sıralama `seviye` (sayı) ve `sube` (harf) alanlarından gelir. Metin olarak
-- sıralansaydı "10A" < "9A" çıkardı; sayısal seviye bunu çözer.
-- =============================================================================

insert into public.siniflar (seviye, sube)
values
  (9,  'A'), (9,  'B'), (9,  'C'),
  (10, 'A'), (10, 'B'), (10, 'C'),
  (11, 'A'), (11, 'B'), (11, 'C'),
  (12, 'A'), (12, 'B'), (12, 'C')
on conflict (seviye, sube) do nothing;

-- Doğru sıralamayı doğrula: ilk kayıt 9A, son kayıt 12C olmalı.
do $$
declare
  ilk text;
  son text;
  adet integer;
begin
  select count(*) into adet from public.siniflar;
  select ad into ilk from public.siniflar order by seviye, sube limit 1;
  select ad into son from public.siniflar order by seviye desc, sube desc limit 1;

  assert adet >= 12, format('12 sınıf beklenirken %s bulundu', adet);
  assert ilk = '9A',  format('İlk sınıf 9A olmalı, %s geldi', ilk);
  assert son = '12C', format('Son sınıf 12C olmalı, %s geldi', son);

  raise notice 'Sınıflar yüklendi: % adet, % … %', adet, ilk, son;
end;
$$;

