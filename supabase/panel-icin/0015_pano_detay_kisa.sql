create or replace function public.ogretmen_panosu(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun date := current_date;
begin
  perform public._ogretmen(p_token);
  return jsonb_build_object(
    'ogrenci_sayisi', (select count(*) from public.ogrenciler where aktif),
    'odev_verilen_ogrenci', (
      select count(*)
      from public.ogrenciler o
      where o.aktif
        and exists (select 1 from public.odevler d
                     where d.sinif_id = o.sinif_id and d.yayinda)
    ),
    'acik_odev', (select count(*) from public.odevler
                   where yayinda and son_tarih >= bugun),
    'bekleyen_degerlendirme', (select count(*) from public.gonderimler g
                                join public.odevler o on o.id = g.odev_id
                               where o.tur = 'acik' and g.durum = 'incelemede'),
    'gecikmis_eksik', (
      select count(*)
      from public.odevler o
      join public.ogrenciler ogr
        on ogr.sinif_id = o.sinif_id and ogr.aktif
      where o.yayinda and o.son_tarih < bugun
        and not exists (select 1 from public.gonderimler g
                         where g.odev_id = o.id and g.ogrenci_id = ogr.id)
    ),
    'son_gonderimler', coalesce((
      select jsonb_agg(x order by x->>'zaman' desc) from (
        select jsonb_build_object(
                 'ogrenci', ogr.ad, 'odev', o.baslik,
                 'puan', coalesce(g.ogretmen_puan, g.puan),
                 'zaman', g.created_at,
                 'gecikmeli', public._gecikmeli(g.created_at, o.son_tarih)
               ) as x
        from public.gonderimler g
        join public.ogrenciler ogr on ogr.id = g.ogrenci_id
        join public.odevler o on o.id = g.odev_id
        order by g.created_at desc limit 10
      ) t
    ), '[]'::jsonb)
  );
end;
$$;
create or replace function public.pano_detay(p_token text, p_tur text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun date := current_date;
  v_baslik text;
  v_aciklama text;
  v_gruplar jsonb;
  v_toplam integer;
begin
  perform public._ogretmen(p_token);
  if p_tur not in ('ogrenci', 'acik_odev', 'gondermeyen', 'puan_bekleyen') then
    raise exception 'Geçersiz pano bölümü.' using errcode = '22023';
  end if;
  if p_tur = 'ogrenci' then
    v_baslik := 'Ödev verilen öğrenciler';
    v_aciklama := 'Sınıfına en az bir ödev yayınlanmış öğrenciler.';
    select coalesce(jsonb_agg(g order by g_seviye, g_sube), '[]'::jsonb), coalesce(sum(g_adet), 0)
      into v_gruplar, v_toplam
    from (
      select s.seviye as g_seviye, s.sube as g_sube, count(*)::integer as g_adet,
             jsonb_build_object(
               'sinif', s.ad, 'ozel', s.ozel,
               'satirlar', jsonb_agg(jsonb_build_object('ad', o.ad) order by o.ad)
             ) as g
      from public.ogrenciler o
      join public.siniflar s on s.id = o.sinif_id
      where o.aktif
        and exists (select 1 from public.odevler d
                     where d.sinif_id = o.sinif_id and d.yayinda)
      group by s.id, s.ad, s.ozel, s.seviye, s.sube
    ) t;
  elsif p_tur = 'acik_odev' then
    v_baslik := 'Açık ödevler';
    v_aciklama := 'Yayında ve süresi henüz dolmamış ödevler.';
    select coalesce(jsonb_agg(g order by g_seviye, g_sube), '[]'::jsonb), coalesce(sum(g_adet), 0)
      into v_gruplar, v_toplam
    from (
      select s.seviye as g_seviye, s.sube as g_sube, count(*)::integer as g_adet,
             jsonb_build_object(
               'sinif', s.ad, 'ozel', s.ozel,
               'satirlar', jsonb_agg(jsonb_build_object(
                 'id', d.id, 'ad', d.baslik, 'son_tarih', d.son_tarih,
                 'gonderim_sayisi', (select count(*) from public.gonderimler g
                                      where g.odev_id = d.id)
               ) order by d.son_tarih)
             ) as g
      from public.odevler d
      join public.siniflar s on s.id = d.sinif_id
      where d.yayinda and d.son_tarih >= bugun
      group by s.id, s.ad, s.ozel, s.seviye, s.sube
    ) t;
  elsif p_tur = 'gondermeyen' then
    v_baslik := 'Göndermeyen öğrenciler';
    v_aciklama := 'Süresi dolmuş ödevlerden en az birini göndermemiş öğrenciler.';
    select coalesce(jsonb_agg(g order by g_seviye, g_sube), '[]'::jsonb), coalesce(sum(g_adet), 0)
      into v_gruplar, v_toplam
    from (
      select s.seviye as g_seviye, s.sube as g_sube, count(*)::integer as g_adet,
             jsonb_build_object(
               'sinif', s.ad, 'ozel', s.ozel,
               'satirlar', jsonb_agg(jsonb_build_object(
                 'ad', x.ad, 'eksik', x.eksik
               ) order by x.eksik desc, x.ad)
             ) as g
      from (
        select o.id, o.ad, o.sinif_id, count(*)::integer as eksik
        from public.ogrenciler o
        join public.odevler d
          on d.sinif_id = o.sinif_id and d.yayinda and d.son_tarih < bugun
        where o.aktif
          and not exists (select 1 from public.gonderimler g
                           where g.odev_id = d.id and g.ogrenci_id = o.id)
        group by o.id, o.ad, o.sinif_id
      ) x
      join public.siniflar s on s.id = x.sinif_id
      group by s.id, s.ad, s.ozel, s.seviye, s.sube
    ) t;
  else -- puan_bekleyen
    v_baslik := 'Puan bekleyenler';
    v_aciklama := 'Açık uçlu gönderimler; puanı siz verirsiniz.';
    select coalesce(jsonb_agg(g order by g_seviye, g_sube), '[]'::jsonb), coalesce(sum(g_adet), 0)
      into v_gruplar, v_toplam
    from (
      select s.seviye as g_seviye, s.sube as g_sube, count(*)::integer as g_adet,
             jsonb_build_object(
               'sinif', s.ad, 'ozel', s.ozel,
               'satirlar', jsonb_agg(jsonb_build_object(
                 'ad', o.ad, 'odev', d.baslik, 'odev_id', d.id,
                 'zaman', g2.created_at
               ) order by g2.created_at)
             ) as g
      from public.gonderimler g2
      join public.odevler d on d.id = g2.odev_id
      join public.ogrenciler o on o.id = g2.ogrenci_id
      join public.siniflar s on s.id = d.sinif_id
      where d.tur = 'acik' and g2.durum = 'incelemede'
      group by s.id, s.ad, s.ozel, s.seviye, s.sube
    ) t;
  end if;
  return jsonb_build_object(
    'tur', p_tur,
    'baslik', v_baslik,
    'aciklama', v_aciklama,
    'toplam', v_toplam,
    'gruplar', v_gruplar
  );
end;
$$;
revoke all on function public.pano_detay(text, text)
  from public, anon, authenticated;
grant execute on function public.pano_detay(text, text) to anon, authenticated;
grant execute on function public.ogretmen_panosu(text)  to anon, authenticated;
