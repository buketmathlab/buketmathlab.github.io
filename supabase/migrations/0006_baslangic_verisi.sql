-- =============================================================================
-- SEKİZ — 0006 BAŞLANGIÇ VERİSİ
--
-- Sınıflar KODA SABİT YAZILMAZ (Part XXVI). Bu liste yalnızca başlangıç
-- verisidir; öğretmen panelden yeni sınıf ekleyebilir, mevcut sınıfı
-- arşivleyebilir.
--
-- Sıralama `seviye` (sayı) ve `sube` (harf) alanlarından gelir. Metin olarak
-- sıralansaydı "10A" < "9A" çıkardı; sayısal seviye bunu çözer.
-- =============================================================================

insert into public.siniflar (seviye, sube)
values
  (9,  'A'), (9,  'B'), (9,  'C'),
  (10, 'A'), (10, 'B'), (10, 'C'),
  (11, 'A'), (11, 'B'), (11, 'C'),
  (12, 'A'), (12, 'B'), (12, 'C')
on conflict (seviye, sube) do nothing;

-- Doğru sıralamayı doğrula: ilk kayıt 9A, son kayıt 12C olmalı.
do $$
declare
  ilk text;
  son text;
  adet integer;
begin
  select count(*) into adet from public.siniflar;
  select ad into ilk from public.siniflar order by seviye, sube limit 1;
  select ad into son from public.siniflar order by seviye desc, sube desc limit 1;

  assert adet >= 12, format('12 sınıf beklenirken %s bulundu', adet);
  assert ilk = '9A',  format('İlk sınıf 9A olmalı, %s geldi', ilk);
  assert son = '12C', format('Son sınıf 12C olmalı, %s geldi', son);

  raise notice 'Sınıflar yüklendi: % adet, % … %', adet, ilk, son;
end;
$$;
