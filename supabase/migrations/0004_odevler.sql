-- SEKİZ · Adım 4 — Ödevler
--
-- KRİTİK: Soru kağıdı ve cevap anahtarı AYRI alanlardır. v1'de tek alan vardı ve
-- öğrenci soruyu göremiyordu; bu düzeltilen bir ürün hatasıdır.
-- Alanlar imzalı URL üretilebilmesi için tam adres değil, depodaki YOL tutar.

create table if not exists odevler (
  id              uuid primary key default gen_random_uuid(),
  donem_id        uuid references donemler (id) on delete restrict,
  sinif_id        uuid references siniflar (id) on delete restrict,
  baslik          text not null,
  konu            text,                            -- Türev, Limit…
  kademe          smallint check (kademe between 9 and 12),
  tur             text not null check (tur in ('test', 'acik')),
  soru_sayisi     smallint not null default 0 check (soru_sayisi >= 0),

  soru_pdf_yol    text,                            -- öğrenci baştan görür
  anahtar_pdf_yol text,                            -- yalnız gönderim sonrası açılır
  cozum_pdf_yol   text,                            -- çözümlü anlatım (gönderim sonrası)

  -- Testlerde cevap anahtarı: {"1":"B","2":"D"}. Öğrenciye giden hiçbir
  -- fonksiyon bu sütunu SEÇMEZ; erişim yalnız odev_anahtar() üzerindendir.
  anahtar         jsonb,

  -- Son teslim anı. GEÇ TESLİM YOKTUR: bu an geçtikten sonra gönderim reddedilir,
  -- öğrenci ödevi yapmamış sayılır.
  son_tarih       timestamptz not null,

  yayinda         boolean not null default false,  -- öğretmen onaylamadan öğrenci görmez
  olusturma       timestamptz not null default now()
);

create index if not exists odev_sinif_tarih on odevler (sinif_id, son_tarih desc);
create index if not exists odev_yayinda on odevler (yayinda, son_tarih desc);

comment on column odevler.anahtar is
  'Cevap anahtarı. Öğrenci gönderim yapmadan sunucudan hiç dönmez (bkz. odev_anahtar).';

-- Doğrulama: alan adlarının doğru geldiğini gösterir.
select column_name from information_schema.columns
where table_name = 'odevler' and column_name like '%pdf%'
order by column_name;
