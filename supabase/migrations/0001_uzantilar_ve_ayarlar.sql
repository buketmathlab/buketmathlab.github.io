-- SEKİZ · Adım 1 — Uzantılar ve ayar tablosu
-- pgcrypto: PIN hash'leme (crypt/gen_salt), rastgele kod ve jeton üretimi.

create extension if not exists pgcrypto;

-- Tekil ayarlar: öğretmen PIN hash'i, okul bilgisi, aktif dönem vb.
-- PIN burada DÜZ METİN OLARAK TUTULMAZ; yalnız bcrypt hash'i saklanır.
create table if not exists ayarlar (
  anahtar     text primary key,
  deger       text not null,
  guncelleme  timestamptz not null default now()
);

comment on table ayarlar is
  'Tekil ayarlar. ogretmen_pin_hash anahtarı bcrypt hash tutar, düz PIN asla saklanmaz.';

-- Doğrulama: hata yoksa bu sorgu boş sonuç döner (henüz ayar girilmedi).
select anahtar, guncelleme from ayarlar;
