-- SEKİZ · Adım 9 — Satır düzeyi güvenlik ve yetkiler
--
-- Mimarinin kilit taşı: tarayıcıdaki anahtarla HİÇBİR tabloya erişilemez.
-- Tüm tablolarda RLS açıktır ve HİÇBİR politika tanımlanmaz — politika yoksa
-- hiçbir satır dönmez. Erişimin tek yolu SECURITY DEFINER fonksiyonlardır.

alter table ayarlar          enable row level security;
alter table donemler         enable row level security;
alter table siniflar         enable row level security;
alter table ogrenciler       enable row level security;
alter table odevler          enable row level security;
alter table gonderimler      enable row level security;
alter table mesajlar         enable row level security;
alter table bildirimler      enable row level security;
alter table dersler          enable row level security;
alter table odemeler         enable row level security;
alter table oturumlar        enable row level security;
alter table giris_denemeleri enable row level security;

-- Tabloya doğrudan erişim yetkisi geri alınır (kuşak ve kemer: RLS + yetki yok).
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- İleride eklenecek tablolar da varsayılan olarak kapalı gelsin.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- Fonksiyon çağırabilmek için şema kullanım hakkı gerekir; bu tek başına
-- hiçbir tabloya erişim vermez.
grant usage on schema public to anon;

-- Doğrulama: tüm tablolarda rowsecurity = true olmalı.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
