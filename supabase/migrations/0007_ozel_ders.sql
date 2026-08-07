-- SEKİZ · Adım 7 — Özel ders modülü (ders planı ve ödeme)
--
-- ETİK VE YASAL SINIR: Okul öğrencisinin hiçbir ekranında ödeme veya online ders
-- izi olamaz. Bu kural arayüzde saklanmakla kalmaz, VERİTABANI DÜZEYİNDE zorlanır:
-- iki tablo da (ogrenci_id, ogrenci_tip) bileşik anahtarıyla ogrenciler tablosuna
-- bağlıdır ve ogrenci_tip yalnız 'ozel' olabilir. Okul öğrencisine ders veya ödeme
-- kaydı eklemek veritabanı hatası verir — kod hatası olsa bile mümkün değildir.

create table if not exists dersler (
  id           uuid primary key default gen_random_uuid(),
  ogrenci_id   uuid not null,
  ogrenci_tip  text not null default 'ozel' check (ogrenci_tip = 'ozel'),
  baslangic    timestamptz not null,
  sure_dakika  smallint not null default 60 check (sure_dakika > 0),
  konu         text,
  baglanti     text,                                -- Zoom/Meet adresi
  durum        text not null default 'planlandi'
               check (durum in ('planlandi', 'yapildi', 'iptal')),
  not_metni    text,
  olusturma    timestamptz not null default now(),

  foreign key (ogrenci_id, ogrenci_tip)
    references ogrenciler (id, tip) on delete cascade
);

create table if not exists odemeler (
  id           uuid primary key default gen_random_uuid(),
  ogrenci_id   uuid not null,
  ogrenci_tip  text not null default 'ozel' check (ogrenci_tip = 'ozel'),
  tutar        numeric(10,2) not null check (tutar > 0),
  para_birimi  text not null default 'TRY',
  donem_etiketi text,                               -- "2025 Ekim"
  odendi       boolean not null default false,
  odeme_tarihi date,
  not_metni    text,
  olusturma    timestamptz not null default now(),

  foreign key (ogrenci_id, ogrenci_tip)
    references ogrenciler (id, tip) on delete cascade
);

create index if not exists ders_ogrenci on dersler (ogrenci_id, baslangic desc);
create index if not exists odeme_ogrenci on odemeler (ogrenci_id, olusturma desc);

-- Doğrulama
select 'dersler' as tablo, count(*) from dersler
union all
select 'odemeler', count(*) from odemeler;
