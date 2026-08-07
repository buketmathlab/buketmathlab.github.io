-- SEKİZ · Adım 2 — Eğitim dönemi ve sınıflar

-- Tüm kayıtlar bir döneme bağlanır. Dönem değişince panolar temiz başlar,
-- geçmişe erişim korunur.
create table if not exists donemler (
  id         uuid primary key default gen_random_uuid(),
  ad         text not null,                       -- "2025–2026 Güz"
  baslangic  date not null,
  bitis      date not null,
  aktif      boolean not null default false,
  olusturma  timestamptz not null default now(),
  constraint donem_tarih_sirasi check (bitis > baslangic)
);

-- Aynı anda yalnız tek dönem aktif olabilir.
create unique index if not exists donem_tek_aktif
  on donemler ((aktif)) where aktif;

-- Sınıflar koda gömülmez; öğretmen kendisi oluşturur. Kurulumda liste boştur.
create table if not exists siniflar (
  id         uuid primary key default gen_random_uuid(),
  ad         text not null,                       -- "9A"
  kademe     smallint not null check (kademe between 9 and 12),
  aciklama   text,
  arsivli    boolean not null default false,      -- dönem bitince gizlenir, verisi kalır
  olusturma  timestamptz not null default now()
);

-- Sınıf adı benzersizdir: iki tane "9A" olamaz.
create unique index if not exists sinif_ad_benzersiz
  on siniflar (lower(ad));

comment on column siniflar.arsivli is
  'Arşivli sınıf listelerde gizlenir ama silinmez; ödev ve gönderim geçmişi korunur.';

-- Doğrulama: iki tablo da boş listeyle dönmeli.
select 'donemler' as tablo, count(*) from donemler
union all
select 'siniflar', count(*) from siniflar;
