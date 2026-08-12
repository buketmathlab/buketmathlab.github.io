do $$
begin
  alter table public.okundu drop constraint if exists okundu_rol_check;
  alter table public.okundu
    add constraint okundu_rol_check check (rol in ('veli', 'ogrenci', 'ogretmen'));

  if exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.okundu'::regclass and c.contype = 'p'
      and (select count(*) from unnest(c.conkey)) = 1
  ) then
    alter table public.okundu drop constraint okundu_pkey;
    alter table public.okundu add primary key (ogrenci_id, rol);
    raise notice 'okundu birincil anahtarı (ogrenci_id, rol) yapıldı.';
  end if;
end $$;

create or replace function public.okundu_isaretle(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
begin
  select * into o from public._oturum(p_token);
  if o.ogrenci_id is null then
    raise exception 'Geçersiz oturum.' using errcode = '42501';
  end if;

  insert into public.okundu (ogrenci_id, rol, zaman)
  values (o.ogrenci_id, o.rol, now())
  on conflict (ogrenci_id, rol) do update set zaman = now();

  return jsonb_build_object('durum', 'tamam');
end;
$$;

create or replace function public.ogretmen_okudu(p_token text, p_ogrenci_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public._ogretmen(p_token);

  if not exists (select 1 from public.ogrenciler where id = p_ogrenci_id) then
    raise exception 'Öğrenci bulunamadı.' using errcode = 'P0002';
  end if;

  insert into public.okundu (ogrenci_id, rol, zaman)
  values (p_ogrenci_id, 'ogretmen', now())
  on conflict (ogrenci_id, rol) do update set zaman = now();

  return jsonb_build_object('durum', 'tamam');
end;
$$;

create or replace function public.veliler_listesi(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  sonuc jsonb;
begin
  perform public._ogretmen(p_token);

  with ozet as (
    select o.id as ogrenci_id, o.ad, o.tur, o.sinif_id,
           s.ad as sinif, s.ozel, s.seviye, s.sube,
           (select max(m.created_at) from public.mesajlar m
             where m.ogrenci_id = o.id) as son_mesaj,
           (select count(*)::integer from public.mesajlar m
             where m.ogrenci_id = o.id and m.kimden = 'veli'
               and m.created_at > coalesce(
                     (select k.zaman from public.okundu k
                       where k.ogrenci_id = o.id and k.rol = 'ogretmen'),
                     '-infinity'::timestamptz)) as okunmamis
    from public.ogrenciler o
    join public.siniflar s on s.id = o.sinif_id
    where o.aktif and not s.arsiv
  )
  select jsonb_build_object(
    'toplam_okunmamis', (select coalesce(sum(okunmamis), 0)::integer from ozet),
    'yanit_bekleyen', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ogrenci_id', ogrenci_id, 'ad', ad, 'sinif', sinif,
               'okunmamis', okunmamis, 'son_mesaj', son_mesaj)
             order by son_mesaj)
      from ozet where okunmamis > 0
    ), '[]'::jsonb),
    'gruplar', coalesce((
      select jsonb_agg(g order by g_seviye, g_sube) from (
        select seviye as g_seviye, sube as g_sube,
               jsonb_build_object(
                 'sinif_id', sinif_id, 'sinif', sinif, 'ozel', ozel,
                 'veli_sayisi', count(*)::integer,
                 'okunmamis', coalesce(sum(okunmamis), 0)::integer
               ) as g
        from ozet
        group by sinif_id, sinif, ozel, seviye, sube
      ) t
    ), '[]'::jsonb)
  ) into sonuc;

  return sonuc;
end;
$$;

create or replace function public.sinif_velileri(p_token text, p_sinif_id uuid)
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
    'sinif', jsonb_build_object('id', v_sinif.id, 'ad', v_sinif.ad, 'ozel', v_sinif.ozel),
    'veliler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ogrenci_id', o.id,
               'ad', o.ad,
               'tur', o.tur,
               'veli_kodu_var', exists (select 1 from public.giris_kodlari k
                                         where k.ogrenci_id = o.id and k.rol = 'veli'),
               'mesaj_sayisi', (select count(*)::integer from public.mesajlar m
                                 where m.ogrenci_id = o.id),
               'son_mesaj', (select max(m.created_at) from public.mesajlar m
                              where m.ogrenci_id = o.id),
               'okunmamis', (select count(*)::integer from public.mesajlar m
                              where m.ogrenci_id = o.id and m.kimden = 'veli'
                                and m.created_at > coalesce(
                                      (select k.zaman from public.okundu k
                                        where k.ogrenci_id = o.id and k.rol = 'ogretmen'),
                                      '-infinity'::timestamptz))
             ) order by o.ad)
      from public.ogrenciler o
      where o.sinif_id = p_sinif_id and o.aktif
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.mesajlar_ogretmen(p_token text, p_ogrenci_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  ogr record;
begin
  perform public._ogretmen(p_token);

  select o.id, o.ad, o.tur, s.ad as sinif into ogr
  from public.ogrenciler o
  left join public.siniflar s on s.id = o.sinif_id
  where o.id = p_ogrenci_id;

  if not found then
    raise exception 'Öğrenci bulunamadı.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'ogrenci', jsonb_build_object('id', ogr.id, 'ad', ogr.ad, 'sinif', ogr.sinif),
    'veli_kodu_var', exists (select 1 from public.giris_kodlari k
                              where k.ogrenci_id = ogr.id and k.rol = 'veli'),
    'mesajlar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kimden', m.kimden, 'metin', m.metin, 'zaman', m.created_at)
             order by m.created_at)
      from public.mesajlar m where m.ogrenci_id = p_ogrenci_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.veli_paneli(p_token text)
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
  if o.rol <> 'veli' then
    raise exception 'Bu bölüm yalnızca veliler içindir.' using errcode = '42501';
  end if;

  select ogr2.id, ogr2.ad, ogr2.tur, s.ad as sinif, ogr2.sinif_id into ogr
  from public.ogrenciler ogr2
  left join public.siniflar s on s.id = ogr2.sinif_id
  where ogr2.id = o.ogrenci_id;

  return jsonb_build_object(
    'ogrenci', jsonb_build_object('ad', ogr.ad, 'sinif', ogr.sinif, 'tur', ogr.tur),
    'odevler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'baslik', d.baslik,
        'son_tarih', d.son_tarih,
        'olusturma', d.created_at,
        'gonderildi', (g.id is not null),
        'gonderim_zamani', g.created_at,
        'puan', coalesce(g.ogretmen_puan, g.puan),
        'durum', g.durum
      ) order by d.son_tarih desc)
      from public.odevler d
      left join public.gonderimler g
        on g.odev_id = d.id and g.ogrenci_id = ogr.id
      where d.yayinda and d.sinif_id = ogr.sinif_id
    ), '[]'::jsonb),
    'mesajlar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kimden', m.kimden, 'metin', m.metin, 'zaman', m.created_at)
             order by m.created_at)
      from public.mesajlar m where m.ogrenci_id = ogr.id
    ), '[]'::jsonb),
    'odemeler', case when ogr.tur = 'ozel' then coalesce((
      select jsonb_agg(jsonb_build_object('tutar', p.tutar, 'tarih', p.tarih, 'odendi', p.odendi)
                       order by p.tarih desc)
      from public.odemeler p where p.ogrenci_id = ogr.id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'son_gorulme', (select k.zaman from public.okundu k
                     where k.ogrenci_id = ogr.id and k.rol = 'veli')
  );
end;
$$;

revoke all on function public.veliler_listesi(text)          from public, anon, authenticated;
revoke all on function public.sinif_velileri(text, uuid)     from public, anon, authenticated;
revoke all on function public.ogretmen_okudu(text, uuid)     from public, anon, authenticated;

grant execute on function public.veliler_listesi(text)       to anon, authenticated;
grant execute on function public.sinif_velileri(text, uuid)  to anon, authenticated;
grant execute on function public.ogretmen_okudu(text, uuid)  to anon, authenticated;
grant execute on function public.mesajlar_ogretmen(text, uuid) to anon, authenticated;
grant execute on function public.okundu_isaretle(text)       to anon, authenticated;
grant execute on function public.veli_paneli(text)           to anon, authenticated;

do $$
declare
  n integer;
begin
  select count(*) into n
  from pg_constraint c
  where c.conrelid = 'public.okundu'::regclass and c.contype = 'p'
    and (select count(*) from unnest(c.conkey)) = 2;
  if n <> 1 then
    raise exception 'okundu birincil anahtarı iki sütunlu değil; veli ve öğretmen kaydı birbirini ezer.';
  end if;

  begin
    insert into public.okundu (ogrenci_id, rol, zaman)
    select id, 'ogretmen', now() from public.ogrenciler limit 1;
    delete from public.okundu where rol = 'ogretmen';
  exception
    when check_violation then
      raise exception 'okundu tablosu ogretmen rolünü kabul etmiyor.';
    when others then null; -- hiç öğrenci yoksa sorun değil
  end;

  raise notice 'Veliler ve mesajlaşma uçları hazır.';
end $$;
