-- SEKİZ · Adım 23 — Ödev oluşturma ve yayınlama (öğretmen)
--
-- Ödev önce TASLAK olarak kaydedilir; öğrenci göremez. Yayınlama ayrı bir
-- adımdır: testlerde cevap anahtarı onaylanmadan ödev yayınlanamaz — yanlış
-- okunan tek cevap tüm sınıfı yanlış puanlar, bu kapı zorunludur.

create or replace function odev_olustur(
  p_jeton text, p_baslik text, p_tur text, p_sinif_id uuid,
  p_son_tarih timestamptz, p_soru_sayisi smallint default 0,
  p_konu text default null, p_anahtar jsonb default null,
  p_soru_pdf_yol text default null, p_anahtar_pdf_yol text default null,
  p_cozum_pdf_yol text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_oturum oturumlar := sekiz_ogretmen(p_jeton);
  v_baslik text := btrim(coalesce(p_baslik, ''));
  v_donem uuid;
  v_kademe smallint;
  v_id uuid;
begin
  if v_baslik = '' then
    raise exception 'Ödev başlığı boş olamaz.' using errcode = '22023';
  end if;
  if p_tur not in ('test', 'acik') then
    raise exception 'Ödev türü "test" veya "acik" olmalı.' using errcode = '22023';
  end if;
  if p_son_tarih <= now() then
    raise exception 'Son teslim tarihi gelecekte olmalı.' using errcode = '22023';
  end if;

  select id into v_donem from donemler where aktif;
  select kademe into v_kademe from siniflar where id = p_sinif_id;
  if v_kademe is null then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;

  insert into odevler (donem_id, sinif_id, baslik, konu, kademe, tur, soru_sayisi,
                       son_tarih, anahtar, soru_pdf_yol, anahtar_pdf_yol, cozum_pdf_yol,
                       yayinda)
  values (v_donem, p_sinif_id, v_baslik, nullif(btrim(coalesce(p_konu, '')), ''),
          v_kademe, p_tur, coalesce(p_soru_sayisi, 0), p_son_tarih, p_anahtar,
          p_soru_pdf_yol, p_anahtar_pdf_yol, p_cozum_pdf_yol, false)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'sonuc', v_baslik || ' taslak olarak kaydedildi.');
end;
$$;

-- Yayınlama: öğretmen anahtarı gözden geçirip onayladıktan sonra çağrılır.
-- Yayınlanınca sınıftaki öğrencilere ve velilerine bildirim düşer.
create or replace function odev_yayinla(p_jeton text, p_odev_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_oturum oturumlar := sekiz_ogretmen(p_jeton);
  v_odev odevler;
  v_kisi integer;
begin
  select * into v_odev from odevler where id = p_odev_id;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  if v_odev.tur = 'test' and (v_odev.anahtar is null or v_odev.anahtar = '{}'::jsonb) then
    raise exception 'Cevap anahtarı onaylanmadan test ödevi yayınlanamaz.' using errcode = '22023';
  end if;

  if v_odev.son_tarih <= now() then
    raise exception 'Son teslim tarihi geçmiş bir ödev yayınlanamaz.' using errcode = '22023';
  end if;

  update odevler set yayinda = true where id = p_odev_id;

  insert into bildirimler (hedef, ogrenci_id, tur, metin, odev_id)
  select 'ogrenci', o.id, 'yeni_odev',
         'Yeni ödev: ' || v_odev.baslik || '. Son teslim: ' ||
         to_char(v_odev.son_tarih, 'DD.MM.YYYY HH24:MI'), v_odev.id
  from ogrenciler o where o.sinif_id = v_odev.sinif_id and o.aktif;

  insert into bildirimler (hedef, ogrenci_id, tur, metin, odev_id)
  select 'veli', o.id, 'yeni_odev',
         o.ad || ' için yeni ödev verildi: ' || v_odev.baslik, v_odev.id
  from ogrenciler o where o.sinif_id = v_odev.sinif_id and o.aktif;

  select count(*) into v_kisi from ogrenciler
  where sinif_id = v_odev.sinif_id and aktif;

  return jsonb_build_object('sonuc', v_odev.baslik || ' yayınlandı.', 'ogrenci_sayisi', v_kisi);
end;
$$;

grant execute on function odev_olustur(text, text, text, uuid, timestamptz, smallint, text, jsonb, text, text, text) to anon;
grant execute on function odev_yayinla(text, uuid) to anon;
