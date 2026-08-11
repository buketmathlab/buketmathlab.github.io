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

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Ortak: updated_at tetikleyicisi
-- Eski şemada hiçbir tabloda değişiklik izi yoktu.
-- -----------------------------------------------------------------------------
create or replace function public.tetik_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
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
