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
grant execute on function public.sinif_arsivle(text, uuid, boolean) to anon, authenticated;
