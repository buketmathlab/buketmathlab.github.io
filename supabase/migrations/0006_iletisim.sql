-- SEKİZ · Adım 6 — Mesajlar ve bildirimler

-- Öğretmen hem veliyle hem öğrenciyle birebir yazışır.
create table if not exists mesajlar (
  id          uuid primary key default gen_random_uuid(),
  ogrenci_id  uuid not null references ogrenciler (id) on delete cascade,
  -- Yazışma hattı: öğrenciyle mi veliyle mi.
  hat         text not null check (hat in ('ogrenci', 'veli')),
  -- Gönderen taraf.
  gonderen    text not null check (gonderen in ('ogretmen', 'ogrenci', 'veli')),
  metin       text not null check (length(btrim(metin)) between 1 and 2000),
  okundu      boolean not null default false,
  olusturma   timestamptz not null default now()
);

create index if not exists mesaj_hat on mesajlar (ogrenci_id, hat, olusturma desc);

-- Bildirimler: yeni ödev, gönderim alındı, ödev yapılmadı, öğretmen mesajı…
create table if not exists bildirimler (
  id          uuid primary key default gen_random_uuid(),
  hedef       text not null check (hedef in ('ogrenci', 'veli', 'ogretmen')),
  ogrenci_id  uuid references ogrenciler (id) on delete cascade,
  tur         text not null,                     -- 'yeni_odev', 'puan', 'yapilmadi', 'mesaj', 'puan_degisti'
  metin       text not null,
  odev_id     uuid references odevler (id) on delete cascade,
  okundu      boolean not null default false,
  olusturma   timestamptz not null default now()
);

create index if not exists bildirim_hedef
  on bildirimler (hedef, ogrenci_id, okundu, olusturma desc);

-- Doğrulama
select 'mesajlar' as tablo, count(*) from mesajlar
union all
select 'bildirimler', count(*) from bildirimler;
