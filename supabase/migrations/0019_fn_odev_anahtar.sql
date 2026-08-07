-- SEKİZ · Adım 19 — Ödev görüntüleme ve CEVAP ANAHTARI KAPISI
--
-- EN KRİTİK KURAL: Cevap anahtarı, öğrenci gönderim yapmadan sunucudan HİÇ dönmez.
-- Bu kural fonksiyonun içinde uygulanır. İstemcide gizlemek yeterli değildir:
-- ağ trafiğini açan bir öğrenci isteği elle gönderebilir.

-- Ödev bilgisi. Öğrenci/veli için anahtar alanları sorguya HİÇ alınmaz.
create or replace function odev_detay(p_jeton text, p_odev_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_oturum oturumlar := sekiz_oturum(p_jeton);
  v_odev odevler;
  v_gonderdi boolean := false;
begin
  select * into v_odev from odevler where id = p_odev_id;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  if v_oturum.rol = 'ogretmen' then
    return jsonb_build_object(
      'id', v_odev.id, 'baslik', v_odev.baslik, 'konu', v_odev.konu,
      'tur', v_odev.tur, 'sinif_id', v_odev.sinif_id, 'kademe', v_odev.kademe,
      'soru_sayisi', v_odev.soru_sayisi, 'son_tarih', v_odev.son_tarih,
      'yayinda', v_odev.yayinda,
      'soru_pdf_yol', v_odev.soru_pdf_yol,
      'anahtar_pdf_yol', v_odev.anahtar_pdf_yol,
      'cozum_pdf_yol', v_odev.cozum_pdf_yol,
      'anahtar', v_odev.anahtar
    );
  end if;

  -- Öğrenci ve veli yalnız yayınlanmış ödevi görür.
  if not v_odev.yayinda then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  select exists (
    select 1 from gonderimler
    where odev_id = p_odev_id and ogrenci_id = v_oturum.ogrenci_id
  ) into v_gonderdi;

  -- Soru kağıdı baştan görünür; anahtar ve çözüm YALNIZ gönderimden sonra.
  return jsonb_build_object(
    'id', v_odev.id, 'baslik', v_odev.baslik, 'konu', v_odev.konu,
    'tur', v_odev.tur, 'soru_sayisi', v_odev.soru_sayisi,
    'son_tarih', v_odev.son_tarih,
    'soru_pdf_yol', v_odev.soru_pdf_yol,
    'gonderdim', v_gonderdi,
    'suresi_doldu', v_odev.son_tarih <= now()
  );
end;
$$;

-- Cevap anahtarı kapısı. Tek çıkış noktasıdır.
create or replace function odev_anahtar(p_jeton text, p_odev_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_oturum oturumlar := sekiz_oturum(p_jeton);
  v_odev odevler;
begin
  select * into v_odev from odevler where id = p_odev_id;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  if v_oturum.rol <> 'ogretmen' then
    -- Öğrenci de veli de aynı kapıdan geçer: gönderim yoksa anahtar yoktur.
    if not exists (
      select 1 from gonderimler
      where odev_id = p_odev_id and ogrenci_id = v_oturum.ogrenci_id
    ) then
      raise exception 'Cevap anahtarı, çözüm gönderildikten sonra açılır.'
        using errcode = '42501';
    end if;
  end if;

  return jsonb_build_object(
    'anahtar', v_odev.anahtar,
    'anahtar_pdf_yol', v_odev.anahtar_pdf_yol,
    'cozum_pdf_yol', v_odev.cozum_pdf_yol
  );
end;
$$;

grant execute on function odev_detay(text, uuid) to anon;
grant execute on function odev_anahtar(text, uuid) to anon;
