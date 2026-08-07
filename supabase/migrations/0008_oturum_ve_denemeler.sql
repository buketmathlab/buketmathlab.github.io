-- SEKİZ · Adım 8 — Oturumlar ve giriş denemeleri (oran sınırlama)

-- Giriş başarılı olunca rastgele bir jeton üretilir; veritabanında yalnız
-- SHA-256 özeti saklanır. Jetonun kendisi bir daha sunucuda görünmez.
-- Kod paylaşıldığında öğretmen kodu yeniler; o koda ait oturumlar da iptal olur.
create table if not exists oturumlar (
  id            uuid primary key default gen_random_uuid(),
  jeton_hash    text not null unique,
  rol           text not null check (rol in ('ogretmen', 'ogrenci', 'veli')),
  ogrenci_id    uuid references ogrenciler (id) on delete cascade,
  parmak_izi    text,                              -- istemci parmak izi (kilit kapsamı için)
  olusturma     timestamptz not null default now(),
  son_kullanim  timestamptz not null default now(),
  bitis         timestamptz not null,
  iptal         boolean not null default false,

  -- Öğretmen oturumunun öğrencisi olmaz; öğrenci/veli oturumunun olmak zorundadır.
  constraint oturum_rol_tutarli check (
    (rol = 'ogretmen' and ogrenci_id is null) or
    (rol in ('ogrenci', 'veli') and ogrenci_id is not null)
  )
);

create index if not exists oturum_gecerli on oturumlar (jeton_hash) where not iptal;

-- Her giriş denemesi kaydedilir. Girilen kod/PIN DÜZ METİN OLARAK YAZILMAZ;
-- yalnız özeti tutulur, böylece günlük sızsa bile geçerli kod öğrenilemez.
create table if not exists giris_denemeleri (
  id          bigserial primary key,
  kimlik      text not null,        -- 'ogretmen' veya girilen kodun SHA-256 özeti
  parmak_izi  text,
  basarili    boolean not null,
  zaman       timestamptz not null default now()
);

create index if not exists deneme_pencere on giris_denemeleri (kimlik, zaman desc)
  where not basarili;

-- Doğrulama
select 'oturumlar' as tablo, count(*) from oturumlar
union all
select 'giris_denemeleri', count(*) from giris_denemeleri;
