-- SEKİZ · Adım 18 — Kod yenileme, sınıf değiştirme, öğrenci silme

-- Kod paylaşımı şüphesinde tek dokunuş: yeni kod üretilir ve o koda ait
-- açık oturumlar KAPATILIR — eski kodu alan kişi de düşer.
create or replace function kod_yenile(p_jeton text, p_ogrenci_id uuid, p_hangi text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_oturum oturumlar := sekiz_ogretmen(p_jeton);
  v_yeni text;
begin
  if p_hangi not in ('ogrenci', 'veli') then
    raise exception 'Hangi kodun yenileneceği "ogrenci" veya "veli" olmalı.' using errcode = '22023';
  end if;

  loop
    v_yeni := sekiz_kod_uret();
    exit when not exists (select 1 from ogrenciler
                          where upper(ogrenci_kodu) = v_yeni or upper(veli_kodu) = v_yeni);
  end loop;

  if p_hangi = 'ogrenci' then
    update ogrenciler set ogrenci_kodu = v_yeni where id = p_ogrenci_id;
  else
    update ogrenciler set veli_kodu = v_yeni where id = p_ogrenci_id;
  end if;

  if not found then
    raise exception 'Öğrenci bulunamadı.' using errcode = 'P0002';
  end if;

  update oturumlar set iptal = true
  where ogrenci_id = p_ogrenci_id and rol = p_hangi and not iptal;

  return jsonb_build_object('yeni_kod', v_yeni,
    'sonuc', 'Yeni kod üretildi. Eski kodla açık olan oturumlar kapatıldı.');
end;
$$;

-- Nakil ve şube değişikliği gerçek bir ihtiyaç; geçmiş ödev kayıtları korunur.
create or replace function ogrenci_tasi(p_jeton text, p_ogrenci_id uuid, p_sinif_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_oturum oturumlar := sekiz_ogretmen(p_jeton);
begin
  update ogrenciler set sinif_id = p_sinif_id where id = p_ogrenci_id;
  if not found then
    raise exception 'Öğrenci bulunamadı.' using errcode = 'P0002';
  end if;
  return jsonb_build_object('sonuc', 'Öğrenci yeni sınıfına taşındı. Ödev geçmişi korundu.');
end;
$$;

-- Yıkıcı işlem: iki adımlı. Silme veli erişimini de kaldırır; bu, onay
-- metninde açıkça yazılır.
create or replace function ogrenci_sil(p_jeton text, p_ogrenci_id uuid, p_onay boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_oturum oturumlar := sekiz_ogretmen(p_jeton);
  v_ad text;
  v_gonderim integer;
begin
  select ad into v_ad from ogrenciler where id = p_ogrenci_id;
  if v_ad is null then
    raise exception 'Öğrenci bulunamadı.' using errcode = 'P0002';
  end if;

  select count(*) into v_gonderim from gonderimler where ogrenci_id = p_ogrenci_id;

  if not coalesce(p_onay, false) then
    return jsonb_build_object(
      'onay_gerekli', true,
      'ogrenci', v_ad,
      'gonderim_sayisi', v_gonderim,
      'aciklama', v_ad || ' silinecek. ' || v_gonderim ||
        ' gönderimi ve notları da silinecek. Velisinin giriş kodu geçersiz olacak ' ||
        've veli paneline bir daha giremeyecek. Bu işlem geri alınamaz.'
    );
  end if;

  delete from ogrenciler where id = p_ogrenci_id;
  return jsonb_build_object('sonuc', v_ad || ' silindi. Veli erişimi de kaldırıldı.');
end;
$$;

grant execute on function kod_yenile(text, uuid, text) to anon;
grant execute on function ogrenci_tasi(text, uuid, uuid) to anon;
grant execute on function ogrenci_sil(text, uuid, boolean) to anon;
