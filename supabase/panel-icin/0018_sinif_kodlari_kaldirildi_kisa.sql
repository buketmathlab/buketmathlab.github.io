drop function if exists public.sinif_kodlari(text, uuid);

do $$
begin
  if to_regprocedure('public.sinif_kodlari(text, uuid)') is not null then
    raise exception 'sinif_kodlari hâlâ duruyor; kaldırılamadı.';
  end if;
  if to_regprocedure('public.ogrenci_kodlari(text, uuid)') is null then
    raise exception 'ogrenci_kodlari yok; kod gösterecek uç kalmadı.';
  end if;
  raise notice 'sinif_kodlari kaldırıldı; kodlar artık yalnız ogrenci_kodlari ile, tek tek.';
end $$;
