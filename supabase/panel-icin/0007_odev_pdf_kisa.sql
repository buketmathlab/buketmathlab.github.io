alter table public.odevler add column if not exists odev_url text;
comment on column public.odevler.odev_url is
  'Soru PDF''inin storage yolu. Yayındaki ödevin sınıfındaki öğrenci teslim '
  'etmeden de görebilir — anahtar_url''den farkı budur.';
drop function if exists public.odev_olustur(text, text, text, uuid, text, date, integer, jsonb, text);
create or replace function public.odev_olustur(
  p_token text,
  p_baslik text,
  p_aciklama text,
  p_sinif_id uuid,
  p_tur text,
  p_son_tarih date,
  p_soru_sayisi integer default null,
  p_cevap_anahtari jsonb default null,
  p_anahtar_yolu text default null,
  p_odev_yolu text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  yeni_id uuid;
begin
  perform public._ogretmen(p_token);

  insert into public.odevler
    (baslik, aciklama, sinif_id, tur, son_tarih, soru_sayisi,
     cevap_anahtari, anahtar_url, odev_url, yayinda)
  values
    (btrim(p_baslik), nullif(btrim(coalesce(p_aciklama, '')), ''), p_sinif_id,
     p_tur, p_son_tarih, p_soru_sayisi, p_cevap_anahtari,
     nullif(btrim(coalesce(p_anahtar_yolu, '')), ''),
     nullif(btrim(coalesce(p_odev_yolu, '')), ''),
     false)  -- Taslak olarak başlar; öğretmen onaylamadan öğrenciye düşmez.
  returning id into yeni_id;

  perform public._denetim('odev_olusturuldu', 'odevler', yeni_id, 'ogretmen');
  return jsonb_build_object('id', yeni_id, 'yayinda', false);
end;
$$;
create or replace function public.ogrenci_odevleri(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  ogr record;
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'ogrenci' then
    raise exception 'Bu bölüm yalnızca öğrenciler içindir.' using errcode = '42501';
  end if;

  select ogr2.id, ogr2.ad, ogr2.tur, s.ad as sinif, ogr2.sinif_id
    into ogr
  from public.ogrenciler ogr2
  left join public.siniflar s on s.id = ogr2.sinif_id
  where ogr2.id = o.ogrenci_id;

  return jsonb_build_object(
    'ogrenci', jsonb_build_object('id', ogr.id, 'ad', ogr.ad, 'sinif', ogr.sinif),
    'odevler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'baslik', d.baslik,
        'aciklama', d.aciklama,
        'tur', d.tur,
        'son_tarih', d.son_tarih,
        'soru_sayisi', d.soru_sayisi,
        'odev_yolu', d.odev_url,
        'gonderim', case when g.id is null then null else jsonb_build_object(
          'id', g.id, 'zaman', g.created_at, 'durum', g.durum,
          'dogru', g.dogru, 'yanlis', g.yanlis, 'bos', g.bos,
          'puan', g.puan, 'ogretmen_puan', g.ogretmen_puan,
          'ogretmen_yorum', g.ogretmen_yorum
        ) end,
        'cevap_anahtari', case when g.id is not null then d.cevap_anahtari else null end,
        'anahtar_yolu',   case when g.id is not null then d.anahtar_url    else null end
      ) order by d.son_tarih)
      from public.odevler d
      left join public.gonderimler g
        on g.odev_id = d.id and g.ogrenci_id = ogr.id
      where d.yayinda and d.sinif_id = ogr.sinif_id
    ), '[]'::jsonb),
    'dersler', coalesce((
      select jsonb_agg(jsonb_build_object('zaman', l.zaman, 'mod', l.mod, 'link', l.link)
                       order by l.zaman)
      from public.dersler l
      where l.ogrenci_id = ogr.id and l.zaman > now()
    ), '[]'::jsonb)
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
      );
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
create or replace function public.odevler_listesi(
  p_token text,
  p_sinif_id uuid default null,
  p_yayinda boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public._ogretmen(p_token);

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', d.id,
      'baslik', d.baslik,
      'aciklama', d.aciklama,
      'tur', d.tur,
      'sinif_id', d.sinif_id,
      'sinif', s.ad,
      'son_tarih', d.son_tarih,
      'soru_sayisi', d.soru_sayisi,
      'yayinda', d.yayinda,
      'olusturma', d.created_at,
      'odev_pdf_var', (d.odev_url is not null),
      'anahtar_pdf_var', (d.anahtar_url is not null),
      'gonderim_sayisi', (
        select count(*) from public.gonderimler g where g.odev_id = d.id
      ),
      'sinif_mevcudu', (
        select count(*) from public.ogrenciler o
        where o.sinif_id = d.sinif_id and o.aktif
      )
    ) order by d.son_tarih desc, d.created_at desc)
    from public.odevler d
    join public.siniflar s on s.id = d.sinif_id
    where (p_sinif_id is null or d.sinif_id = p_sinif_id)
      and (p_yayinda is null or d.yayinda = p_yayinda)
  ), '[]'::jsonb);
end;
$$;
create or replace function public.odev_dosya_yolu(
  p_token text,
  p_id uuid,
  p_tur text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_yol text;
begin
  perform public._ogretmen(p_token);

  if p_tur not in ('odev', 'anahtar') then
    raise exception 'Geçersiz dosya türü.' using errcode = '22023';
  end if;

  select case when p_tur = 'odev' then d.odev_url else d.anahtar_url end
    into v_yol
  from public.odevler d
  where d.id = p_id;

  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  return jsonb_build_object('yol', v_yol);
end;
$$;
revoke all on function public.odev_olustur(text, text, text, uuid, text, date, integer, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function
  public.odev_olustur(text, text, text, uuid, text, date, integer, jsonb, text, text)
  to anon, authenticated;
grant execute on function public.ogrenci_odevleri(text)          to anon, authenticated;
grant execute on function public.dosya_erisim_izni(text, text)   to anon, authenticated;
revoke all on function public.odevler_listesi(text, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.odevler_listesi(text, uuid, boolean) to anon, authenticated;
revoke all on function public.odev_dosya_yolu(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.odev_dosya_yolu(text, uuid, text) to anon, authenticated;
revoke all on function public._oturum(text)              from public, anon, authenticated;
revoke all on function public._ogretmen(text)            from public, anon, authenticated;
grant execute on function public.dosya_erisim_izni(text, text) to service_role;
