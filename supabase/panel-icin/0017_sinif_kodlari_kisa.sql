create or replace function public.sinif_kodlari(p_token text, p_sinif_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sinif record;
begin
  perform public._ogretmen(p_token);

  select s.id, s.ad, s.ozel, s.arsiv into v_sinif
  from public.siniflar s where s.id = p_sinif_id;

  if not found then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'sinif', jsonb_build_object(
      'id', v_sinif.id, 'ad', v_sinif.ad,
      'ozel', v_sinif.ozel, 'arsiv', v_sinif.arsiv
    ),
    'ogrenciler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id,
               'ad', o.ad,
               'tur', o.tur,
               'ogrenci_kodu', (select k.kod from public.giris_kodlari k
                                 where k.ogrenci_id = o.id and k.rol = 'ogrenci'),
               'veli_kodu', (select k.kod from public.giris_kodlari k
                              where k.ogrenci_id = o.id and k.rol = 'veli')
             ) order by o.ad)
      from public.ogrenciler o
      where o.sinif_id = p_sinif_id and o.aktif
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.sinif_kodlari(text, uuid) from public, anon, authenticated;
grant execute on function public.sinif_kodlari(text, uuid) to anon, authenticated;
