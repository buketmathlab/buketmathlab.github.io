-- SEKİZ · Adım 5 — Gönderimler
--
-- Bir öğrenci bir ödevi YALNIZ BİR KEZ gönderebilir. Bu kural veritabanı
-- düzeyinde benzersizlik kısıtıyla zorlanır; fonksiyon hatası olsa bile
-- ikinci gönderim veritabanına giremez.

create table if not exists gonderimler (
  id                 uuid primary key default gen_random_uuid(),
  odev_id            uuid not null references odevler (id) on delete cascade,
  ogrenci_id         uuid not null references ogrenciler (id) on delete cascade,
  gonderim_zamani    timestamptz not null default now(),

  cevaplar           jsonb,                       -- testte {"1":"B","2":"D"}
  foto_yol           text not null,               -- çözüm kağıdı fotoğrafı: zorunlu
  foto_bayt          integer,                     -- depo bütçesi takibi için

  puan               numeric(5,2) check (puan >= 0 and puan <= 100),
  dogru_sayisi       smallint,
  yanlis_sayisi      smallint,
  bos_sayisi         smallint,

  onaylandi          boolean not null default false,  -- açık uçluda öğretmen imzası
  ogretmen_notu      text,

  -- Faz 5 (yapay zekâ) için hazır alanlar. Anahtar yoksa 'kapali' kalır.
  ai_denetim_durumu  text not null default 'kapali'
                     check (ai_denetim_durumu in ('kapali','beklemede','temiz','incelenmeli')),
  ai_denetim_notu    text,

  constraint gonderim_tek_kez unique (odev_id, ogrenci_id)
);

create index if not exists gonderim_odev on gonderimler (odev_id);
create index if not exists gonderim_ogrenci on gonderimler (ogrenci_id, gonderim_zamani desc);

comment on constraint gonderim_tek_kez on gonderimler is
  'Bir ödev bir öğrenci tarafından yalnız bir kez gönderilir — puan yükseltmek için tekrar gönderim engellenir.';

-- Doğrulama
select count(*) as gonderim_sayisi from gonderimler;
