-- SEKİZ · Adım 17 — Öğrenci ekleme ve listeleme
-- 200 öğrenci ölçeği: liste her zaman aranabilir ve sayfalanabilir döner.

create or replace function ogrenci_ekle(
  p_jeton text, p_ad text, p_ogrenci_no text,
  p_sinif_id uuid default null, p_tip text default 'okul',
  p_veli_ad text default null, p_veli_eposta text default null,
  p_veli_telefon text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_oturum oturumlar := sekiz_ogretmen(p_jeton);
  v_ad text := btrim(coalesce(p_ad, ''));
  v_no text := btrim(coalesce(p_ogrenci_no, ''));
  v_id uuid;
  v_ogrenci_kodu text;
  v_veli_kodu text;
begin
  if v_ad = '' or v_no = '' then
    raise exception 'Ad ve öğrenci numarası zorunludur.' using errcode = '22023';
  end if;
  if coalesce(p_tip, 'okul') not in ('okul', 'ozel') then
    raise exception 'Öğrenci tipi "okul" veya "ozel" olmalı.' using errcode = '22023';
  end if;
  if exists (select 1 from ogrenciler where ogrenci_no = v_no) then
    raise exception '% numarası başka bir öğrencide kayıtlı.', v_no using errcode = '23505';
  end if;

  -- Kodlar çakışırsa yeniden üretilir.
  loop
    v_ogrenci_kodu := sekiz_kod_uret();
    exit when not exists (select 1 from ogrenciler
                          where upper(ogrenci_kodu) = v_ogrenci_kodu
                             or upper(veli_kodu) = v_ogrenci_kodu);
  end loop;
  loop
    v_veli_kodu := sekiz_kod_uret();
    exit when v_veli_kodu <> v_ogrenci_kodu
          and not exists (select 1 from ogrenciler
                          where upper(ogrenci_kodu) = v_veli_kodu
                             or upper(veli_kodu) = v_veli_kodu);
  end loop;

  insert into ogrenciler (ad, ogrenci_no, tip, sinif_id, ogrenci_kodu, veli_kodu,
                          veli_ad, veli_eposta, veli_telefon)
  values (v_ad, v_no, coalesce(p_tip, 'okul'), p_sinif_id, v_ogrenci_kodu, v_veli_kodu,
          nullif(btrim(coalesce(p_veli_ad, '')), ''),
          nullif(btrim(coalesce(p_veli_eposta, '')), ''),
          nullif(btrim(coalesce(p_veli_telefon, '')), ''))
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id, 'ogrenci_kodu', v_ogrenci_kodu, 'veli_kodu', v_veli_kodu,
    'sonuc', v_ad || ' eklendi.'
  );
end;
$$;

create or replace function ogrenciler_listele(
  p_jeton text, p_sinif_id uuid default null, p_arama text default null,
  p_limit integer default 50, p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_oturum oturumlar := sekiz_ogretmen(p_jeton);
  v_arama text := nullif(btrim(coalesce(p_arama, '')), '');
  v_toplam integer;
begin
  select count(*) into v_toplam
  from ogrenciler o
  where o.aktif
    and (p_sinif_id is null or o.sinif_id = p_sinif_id)
    and (v_arama is null or o.ad ilike '%' || v_arama || '%'
         or o.ogrenci_no ilike '%' || v_arama || '%');

  return jsonb_build_object(
    'toplam', v_toplam,
    'kayitlar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id, 'ad', o.ad, 'ogrenci_no', o.ogrenci_no, 'tip', o.tip,
               'sinif_id', o.sinif_id, 'sinif_adi', s.ad,
               'ogrenci_kodu', o.ogrenci_kodu, 'veli_kodu', o.veli_kodu))
      from (
        select o.* from ogrenciler o
        where o.aktif
          and (p_sinif_id is null or o.sinif_id = p_sinif_id)
          and (v_arama is null or o.ad ilike '%' || v_arama || '%'
               or o.ogrenci_no ilike '%' || v_arama || '%')
        order by o.ogrenci_no
        limit least(coalesce(p_limit, 50), 200) offset greatest(coalesce(p_offset, 0), 0)
      ) o
      left join siniflar s on s.id = o.sinif_id
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function ogrenci_ekle(text, text, text, uuid, text, text, text, text) to anon;
grant execute on function ogrenciler_listele(text, uuid, text, integer, integer) to anon;
