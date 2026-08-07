-- SEKİZ · Adım 22 — Kurulum (KİŞİYE ÖZEL — çalıştırmadan önce düzenleyin)
--
-- Bu dosyada iki yer değiştirilecek: PIN ve dönem tarihleri.
-- PIN'i uygulamadan değil BURADAN belirliyoruz: böylece siteyi ilk açan kişinin
-- PIN belirlemesi mümkün olmaz.

-- 1) ÖĞRETMEN PIN'İ — aşağıdaki 'DEGISTIRIN-8HANE' yerine kendi PIN'inizi yazın.
--    En az 8 hane olmalı. Tarayıcı geçmişinde kalmaması için bu adımı çalıştırdıktan
--    sonra SQL Editor'deki metni silin.
do $$
declare
  v_pin constant text := 'DEGISTIRIN-8HANE';
begin
  if length(v_pin) < 8 then
    raise exception 'PIN en az 8 haneli olmalı. Dosyadaki değeri değiştirin.';
  end if;
  if v_pin = 'DEGISTIRIN-8HANE' then
    raise exception 'Örnek PIN olduğu gibi bırakılmış. Kendi PIN''inizi yazın.';
  end if;

  insert into ayarlar (anahtar, deger)
  values ('ogretmen_pin_hash', crypt(v_pin, gen_salt('bf', 10)))
  on conflict (anahtar) do update
  set deger = excluded.deger, guncelleme = now();
end;
$$;

-- 2) AKTİF DÖNEM — tarihleri kendi eğitim yılınıza göre düzenleyin.
insert into donemler (ad, baslangic, bitis, aktif)
select '2025–2026 Güz', date '2025-09-08', date '2026-01-23', true
where not exists (select 1 from donemler);

-- Doğrulama: PIN hash'i "$2a$" ile başlamalı (düz metin DEĞİL) ve dönem görünmeli.
select left(deger, 4) as pin_hash_basligi, guncelleme
from ayarlar where anahtar = 'ogretmen_pin_hash';

select ad, baslangic, bitis, aktif from donemler;
