-- =============================================================================
-- SEKİZ — 0002 YETKİLER VE RLS
--
-- İKİ KATMANLI SAVUNMA. Bunlar birbirinin yerine geçmez:
--
--   1. GRANT katmanı — anon ve authenticated rollerinin tablolara DOĞRUDAN
--      erişimi tamamen kaldırılır. Silinen canlı projede koruma buydu ve
--      işe yarıyordu; korunuyor.
--
--   2. RLS katmanı — her tabloda açılır ve politika AÇIKÇA yazılır.
--
-- Neden ikisi birden: projede yeni tabloda otomatik RLS açan bir DDL event
-- trigger'ı (`rls_auto_enable`) bulunabiliyor. Ancak RLS'in AÇIK olması
-- politika olduğu anlamına gelmez — politikasız RLS hiçbir satıra erişim
-- vermez ve bu, güvenlik değil sessiz arızadır. Bu yüzden politikalar
-- burada elle yazılıyor, trigger'a güvenilmiyor.
--
-- Erişimin TEK yolu 0003/0004'teki SECURITY DEFINER fonksiyonlardır.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Doğrudan tablo erişimini kaldır
-- -----------------------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- Bundan sonra oluşturulacak nesneler için de varsayılanı kapat.
alter default privileges in schema public
  revoke all on tables from anon, authenticated;
alter default privileges in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges in schema public
  revoke all on functions from anon, authenticated;

-- Şemayı görebilsinler (fonksiyon çağırabilmek için gerekli), ama içindeki
-- nesnelere erişemesinler.
grant usage on schema public to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. RLS: her tabloda açık, politika açıkça yazılı
--
-- Politikalar bilinçli olarak BOŞ küme döndürür: `using (false)`.
-- Yani doğrudan sorgu hiçbir satır getirmez. SECURITY DEFINER fonksiyonlar
-- tablo sahibinin haklarıyla çalıştığı için RLS'i atlar — erişim oradan olur.
--
-- `using (false)` yazmak ile politikayı hiç yazmamak arasında pratik fark
-- yok gibi görünür ama vardır: niyet açık hâle gelir. İleride biri politika
-- eklerken burada bilinçli bir karar olduğunu görür.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  tablolar text[] := array[
    'siniflar', 'ogrenciler', 'giris_kodlari', 'odevler', 'gonderimler',
    'mesajlar', 'dersler', 'odemeler', 'ayarlar', 'okundu',
    'oturumlar', 'giris_denemeleri', 'denetim_izi'
  ];
begin
  foreach t in array tablolar loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_dogrudan_erisim_yok', t);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (false) with check (false)',
      t || '_dogrudan_erisim_yok', t
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Storage: PRIVATE bucket
--
-- Silinen projede `odevler` bucket'ı PUBLIC'ti. Doğrulanmıştı: public URL
-- isteği "Bucket not found" değil "NoSuchKey" döndürüyordu, yani bucket
-- vardı ve public okuma açıktı. Cevap anahtarı PDF'leri ve öğrenci çözüm
-- fotoğrafları URL'i bilen herkese açıktı.
--
-- Yeni bucket private. Erişim yalnız yetki kontrolü yapan fonksiyonun
-- ürettiği kısa ömürlü imzalı URL ile olacak (bkz. 0004: dosya_url).
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'odev-dosyalari',
  'odev-dosyalari',
  false,                                   -- PUBLIC DEĞİL
  10485760,                                -- 10 MB üst sınır
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Bucket'a doğrudan erişim yok. storage.objects üzerinde anon/authenticated
-- için politika TANIMLANMIYOR — RLS varsayılan olarak reddeder.
-- Yükleme ve okuma, imzalı URL üreten fonksiyon üzerinden yapılır.
drop policy if exists "odev_dosyalari_dogrudan_erisim_yok" on storage.objects;
create policy "odev_dosyalari_dogrudan_erisim_yok"
  on storage.objects for all to anon, authenticated
  using (false) with check (false);
