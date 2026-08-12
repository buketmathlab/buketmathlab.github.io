create or replace function public._cozum_yolu_gecerli(
  p_ogrenci_id uuid,
  p_yol text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_odev_id uuid;
  v_parca   text[];
begin
  v_parca := regexp_match(
    p_yol,
    '^cozum/([0-9a-f-]{36})/([0-9a-f-]{36})\.(jpg|jpeg|png|webp)$'
  );
  if v_parca is null then
    return false;
  end if;
  if v_parca[2] <> p_ogrenci_id::text then
    return false;
  end if;
  v_odev_id := v_parca[1]::uuid;
  return exists (
    select 1
    from public.odevler d
    join public.ogrenciler o on o.id = p_ogrenci_id
    where d.id = v_odev_id
      and d.yayinda
      and d.sinif_id = o.sinif_id
      and o.aktif
  );
end;
$$;
create or replace function public.dosya_erisim_izni(p_token text, p_yol text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
begin
  select * into o from public._oturum(p_token);
  if o.rol = 'ogretmen' then
    return true;
  end if;
  if o.rol = 'ogrenci' then
    return
      exists (
        select 1 from public.gonderimler g
        where g.ogrenci_id = o.ogrenci_id and g.foto_yolu = p_yol
      )
      or exists (
        select 1 from public.odevler d
        join public.gonderimler g on g.odev_id = d.id and g.ogrenci_id = o.ogrenci_id
        where d.anahtar_url = p_yol
      )
      or exists (
        select 1 from public.odevler d
        join public.ogrenciler ogr on ogr.id = o.ogrenci_id
        where d.odev_url = p_yol
          and d.yayinda
          and d.sinif_id = ogr.sinif_id
      )
      or public._cozum_yolu_gecerli(o.ogrenci_id, p_yol);
  end if;
  if o.rol = 'veli' then
    return exists (
      select 1 from public.gonderimler g
      where g.ogrenci_id = o.ogrenci_id and g.foto_yolu = p_yol
    );
  end if;
  return false;
end;
$$;
create or replace function public.odev_gonder(
  p_token text,
  p_odev uuid,
  p_foto_yolu text,
  p_cevaplar jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  d public.odevler;
  s record;
  yeni_id uuid;
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'ogrenci' then
    raise exception 'Yalnızca öğrenci ödev gönderebilir.' using errcode = '42501';
  end if;
  select * into d from public.odevler where id = p_odev and yayinda;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.ogrenciler ogr
    where ogr.id = o.ogrenci_id and ogr.sinif_id = d.sinif_id
  ) then
    raise exception 'Bu ödev sizin sınıfınıza ait değil.' using errcode = '42501';
  end if;
  if p_foto_yolu is null or btrim(p_foto_yolu) = '' then
    raise exception 'Çözüm fotoğrafı olmadan ödev gönderilemez.' using errcode = '22023';
  end if;
  if not public._cozum_yolu_gecerli(o.ogrenci_id, btrim(p_foto_yolu))
     or btrim(p_foto_yolu) not like 'cozum/' || p_odev::text || '/%' then
    raise exception 'Geçersiz dosya yolu.' using errcode = '42501';
  end if;
  if d.tur = 'test' then
    select * into s from public._puanla(d.cevap_anahtari, coalesce(p_cevaplar, '{}'::jsonb), d.soru_sayisi);
    insert into public.gonderimler
      (odev_id, ogrenci_id, cevaplar, foto_yolu, dogru, yanlis, bos, puan, durum)
    values
      (p_odev, o.ogrenci_id, p_cevaplar, btrim(p_foto_yolu), s.dogru, s.yanlis, s.bos, s.puan, 'puanlandi')
    returning id into yeni_id;
    perform public._denetim('odev_gonderildi', 'gonderimler', yeni_id,
                            'ogrenci:' || o.ogrenci_id);
    return jsonb_build_object(
      'id', yeni_id, 'dogru', s.dogru, 'yanlis', s.yanlis,
      'bos', s.bos, 'puan', s.puan
    );
  else
    insert into public.gonderimler
      (odev_id, ogrenci_id, foto_yolu, durum)
    values
      (p_odev, o.ogrenci_id, btrim(p_foto_yolu), 'incelemede')
    returning id into yeni_id;
    perform public._denetim('odev_gonderildi', 'gonderimler', yeni_id,
                            'ogrenci:' || o.ogrenci_id);
    return jsonb_build_object('id', yeni_id, 'durum', 'incelemede');
  end if;
exception
  when unique_violation then
    raise exception 'Bu ödevi zaten gönderdiniz. Gönderim değiştirilemez.'
      using errcode = '23505';
end;
$$;
revoke all on function public._cozum_yolu_gecerli(uuid, text)
  from public, anon, authenticated;
grant execute on function public.dosya_erisim_izni(text, text) to anon, authenticated;
grant execute on function public.dosya_erisim_izni(text, text) to service_role;
grant execute on function public.odev_gonder(text, uuid, text, jsonb) to anon, authenticated;
