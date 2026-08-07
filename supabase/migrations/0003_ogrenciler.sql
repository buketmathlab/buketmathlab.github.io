-- SEKİZ · Adım 3 — Öğrenciler ve giriş kodları

create table if not exists ogrenciler (
  id           uuid primary key default gen_random_uuid(),
  ad           text not null,
  ogrenci_no   text not null,                     -- 200 öğrencide birincil ayırt edici
  tip          text not null default 'okul' check (tip in ('okul', 'ozel')),
  sinif_id     uuid references siniflar (id) on delete set null,
  ogrenci_kodu text not null,                     -- öğrencinin giriş kodu
  veli_kodu    text not null,                     -- velinin giriş kodu (ayrı)
  veli_ad      text,
  veli_eposta  text,
  veli_telefon text,
  aktif        boolean not null default true,
  olusturma    timestamptz not null default now(),

  -- Okul öğrencisinin ödeme/online ders kaydı olamaz; bu kural veritabanı
  -- düzeyinde 7. adımdaki bileşik anahtarla zorlanır.
  unique (id, tip)
);

create unique index if not exists ogrenci_no_benzersiz on ogrenciler (ogrenci_no);
create unique index if not exists ogrenci_kodu_benzersiz on ogrenciler (upper(ogrenci_kodu));
create unique index if not exists veli_kodu_benzersiz on ogrenciler (upper(veli_kodu));
create index if not exists ogrenci_sinif on ogrenciler (sinif_id) where aktif;

comment on column ogrenciler.ogrenci_kodu is
  'Yenilenebilir giriş kodu. Kod paylaşımı şüphesinde tek dokunuşla değiştirilir.';

-- Doğrulama
select count(*) as ogrenci_sayisi from ogrenciler;
