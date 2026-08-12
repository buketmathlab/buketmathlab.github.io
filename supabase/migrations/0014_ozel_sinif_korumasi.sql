-- =============================================================================
-- SEKİZ — 0014 ÖZEL DERS GRUBU ARŞİVLENEMEZ
--
-- CANLIDA YAKALANAN HATA. Öğretmen bildirdi:
--   "Özel ders sınıfını arşivlediğim zaman tekrar geri gelmiyor, çünkü
--    seçenekler arasında özel ders yok. Sınıf ekle'ye tıkladığımda özel
--    ders çıkmıyor."
--
-- İki ayrı sorun vardı; bu dosya asıl olanı kapatıyor.
--
-- ASIL SORUN: Özel ders grubu arşivlenebiliyordu. Arşivlenince ödev verme
-- ekranlarındaki sınıf listesinden düşüyor — özel ders öğrencileri sistemde
-- duruyor ama ONLARA ÖDEV VERİLEMEZ hâle geliyor. 0012 tam da bu kapıyı
-- açmıştı; arşivleme onu sessizce kapatıyordu.
--
-- Arşivlenmiş bir Özel ders grubunun hiçbir meşru kullanımı yok: sayısal
-- sınıflar mezun olur, özel ders grubu olmaz. Yapılabilecek doğru şey, bu
-- durumu mümkün kılmamak.
--
-- İkinci sorun (kurtarma yolunun görünmez olması) arayüz tarafında
-- düzeltildi; buraya bir şey gerekmiyor.
--
-- Bu dosya tekrar çalıştırılabilir.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. KENDİ KENDİNİ ONARMA
--
-- Grup şu anda öğretmenin ekranında arşivde. Onu geri almak için ayrıca bir
-- şey çalıştırmasını istemiyoruz: bu satır zaten bunu yapıyor. Arşivde
-- değilse hiçbir etkisi yok.
-- -----------------------------------------------------------------------------
do $$
declare n integer;
begin
  update public.siniflar set arsiv = false where ozel and arsiv;
  get diagnostics n = row_count;
  if n > 0 then
    raise notice 'Özel ders grubu arşivden geri alındı.';
  else
    raise notice 'Özel ders grubu zaten arşivde değil.';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. sinif_arsivle — özel grubu reddet
--
-- Kural SUNUCUDA. Arayüzden düğmeyi kaldırmak yetmez: kuralı yalnız ekranda
-- uygulamak, ekran değişince ya da başka bir yoldan çağrıldığında kuralın
-- yok olması demek.
--
-- Geri alma (`p_arsiv = false`) engellenmiyor — zaten zararsız ve bir gün
-- elle arşivlenmiş bir kayıt kalırsa kurtarma yolu açık kalsın.
-- -----------------------------------------------------------------------------
create or replace function public.sinif_arsivle(p_token text, p_id uuid, p_arsiv boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ozel boolean;
begin
  perform public._ogretmen(p_token);

  select ozel into v_ozel from public.siniflar where id = p_id;
  if not found then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;

  if v_ozel and p_arsiv then
    raise exception 'Özel ders grubu arşivlenemez. Arşivlenirse özel ders '
                    'öğrencilerinize ödev veremezsiniz.'
      using errcode = '22023';
  end if;

  update public.siniflar set arsiv = p_arsiv where id = p_id;
  perform public._denetim(
    case when p_arsiv then 'sinif_arsivlendi' else 'sinif_geri_alindi' end,
    'siniflar', p_id, 'ogretmen');
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. YETKİLER
-- -----------------------------------------------------------------------------
grant execute on function public.sinif_arsivle(text, uuid, boolean) to anon, authenticated;
