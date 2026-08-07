-- SEKİZ · Adım 16 — Sınıf silme (yıkıcı işlem)
--
-- İki adımlıdır: ilk çağrı ne olacağını anlatır, ikinci çağrı (p_onay = true) uygular.
-- Sınıfa ait ödev varsa silme reddedilir — geçmiş not kaybı olmaz, arşivleme önerilir.

create or replace function sinif_sil(p_jeton text, p_id uuid, p_onay boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_oturum oturumlar := sekiz_ogretmen(p_jeton);
  v_ad text;
  v_ogrenci integer;
  v_odev integer;
begin
  select ad into v_ad from siniflar where id = p_id;
  if v_ad is null then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;

  select count(*) into v_ogrenci from ogrenciler where sinif_id = p_id and aktif;
  select count(*) into v_odev from odevler where sinif_id = p_id;

  if v_odev > 0 then
    raise exception '% sınıfına verilmiş % ödev var. Ödev geçmişi silinmesin diye bu sınıf silinemez; arşivleyin.',
      v_ad, v_odev using errcode = '23503';
  end if;

  if not coalesce(p_onay, false) then
    return jsonb_build_object(
      'onay_gerekli', true,
      'sinif', v_ad,
      'ogrenci_sayisi', v_ogrenci,
      'aciklama', case
        when v_ogrenci = 0 then v_ad || ' silinecek. Bu sınıfta öğrenci yok.'
        else v_ad || ' silinecek. ' || v_ogrenci ||
             ' öğrenci sınıfsız kalacak; kayıtları ve kodları durmaya devam edecek, ' ||
             'sonra başka bir sınıfa taşıyabilirsiniz.'
      end
    );
  end if;

  delete from siniflar where id = p_id;   -- öğrencilerin sinif_id alanı null olur
  return jsonb_build_object('sonuc', v_ad || ' silindi.', 'sinifsiz_kalan', v_ogrenci);
end;
$$;

grant execute on function sinif_sil(text, uuid, boolean) to anon;
