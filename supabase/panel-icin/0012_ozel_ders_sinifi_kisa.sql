alter table public.siniflar add column if not exists ozel boolean not null default false;
alter table public.siniflar drop column if exists ad;
alter table public.siniflar
  add column if not exists ad text generated always as (
    case when ozel then 'Özel ders' else seviye::text || sube end
  ) stored;
alter table public.siniflar drop constraint if exists siniflar_seviye_check;
alter table public.siniflar
  add constraint siniflar_seviye_check
  check ((ozel and seviye = 99) or (not ozel and seviye between 1 and 12));
create unique index if not exists siniflar_tek_ozel on public.siniflar (ozel)
  where ozel;
comment on column public.siniflar.ozel is
  'Özel ders grubu. Bir kimlik değil, ödev hedefleme ve gruplama aracı; '
  'öğrencinin kendi türü ogrenciler.tur alanında durur.';
insert into public.siniflar (seviye, sube, ozel)
values (99, 'Ö', true)
on conflict do nothing;
do $$
declare
  v_ozel uuid;
  n integer;
begin
  select id into v_ozel from public.siniflar where ozel;
  update public.ogrenciler
     set sinif_id = v_ozel
   where tur = 'ozel' and sinif_id is null;
  get diagnostics n = row_count;
  if (select ad from public.siniflar where id = v_ozel) <> 'Özel ders' then
    raise exception 'HATA: özel sınıfın adı "%" — üretilmiş sütun yenilenmemiş!',
      (select ad from public.siniflar where id = v_ozel);
  end if;
  if not exists (select 1 from public.siniflar where ad = '9A') then
    raise exception 'HATA: sayısal sınıf adları bozuldu, 9A bulunamıyor!';
  end if;
  raise notice 'Özel ders sınıfı hazır; % öğrenci taşındı.', n;
end;
$$;
create or replace function public.ogrenci_ekle(
  p_token text,
  p_ad text,
  p_tur text,
  p_sinif_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  yeni_id uuid;
  v_sinif uuid := p_sinif_id;
  kod_ogrenci text;
  kod_veli text;
begin
  perform public._ogretmen(p_token);
  if v_sinif is null and p_tur = 'ozel' then
    select id into v_sinif from public.siniflar where ozel;
  end if;
  if p_tur = 'okul' and v_sinif is null then
    raise exception 'Okul öğrencisi için sınıf seçilmeli.' using errcode = '22023';
  end if;
  insert into public.ogrenciler (ad, tur, sinif_id)
  values (btrim(p_ad), p_tur, v_sinif)
  returning id into yeni_id;
  kod_ogrenci := public._yeni_kod();
  kod_veli    := public._yeni_kod();
  insert into public.giris_kodlari (kod, ogrenci_id, rol)
  values (kod_ogrenci, yeni_id, 'ogrenci'), (kod_veli, yeni_id, 'veli');
  perform public._denetim('ogrenci_eklendi', 'ogrenciler', yeni_id, 'ogretmen');
  return jsonb_build_object(
    'id', yeni_id, 'ogrenci_kodu', kod_ogrenci, 'veli_kodu', kod_veli
  );
end;
$$;
create or replace function public.siniflar_listesi(p_token text, p_arsiv boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public._ogretmen(p_token);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id, 'ad', s.ad, 'seviye', s.seviye,
             'sube', s.sube, 'ozel', s.ozel, 'arsiv', s.arsiv,
             'ogrenci_sayisi', (select count(*) from public.ogrenciler o
                                 where o.sinif_id = s.id and o.aktif)
           ) order by s.seviye, s.sube)
    from public.siniflar s
    where p_arsiv or not s.arsiv
  ), '[]'::jsonb);
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
declare
  bugun_tr date := (now() at time zone 'Europe/Istanbul')::date;
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
      'sinif_ozel', s.ozel,
      'son_tarih', d.son_tarih,
      'soru_sayisi', d.soru_sayisi,
      'gec_teslim', d.gec_teslim,
      'sik_sayisi', d.sik_sayisi,
      'yayinda', d.yayinda,
      'olusturma', d.created_at,
      'odev_pdf_var', (d.odev_url is not null),
      'anahtar_pdf_var', (d.anahtar_url is not null),
      'gonderim_sayisi', (
        select count(*) from public.gonderimler g where g.odev_id = d.id
      ),
      'gec_gonderim_sayisi', (
        select count(*) from public.gonderimler g
        where g.odev_id = d.id and public._gecikmeli(g.created_at, d.son_tarih)
      ),
      'sinif_mevcudu', (
        select count(*) from public.ogrenciler o
        where o.sinif_id = d.sinif_id and o.aktif
      ),
      'ortalama_yapan', case when d.son_tarih < bugun_tr then (
        select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1)
        from public.gonderimler g
        where g.odev_id = d.id and coalesce(g.ogretmen_puan, g.puan) is not null
      ) end,
      'ortalama_tum', case when d.son_tarih < bugun_tr then (
        select round(avg(coalesce(
                 (select coalesce(g.ogretmen_puan, g.puan)
                    from public.gonderimler g
                   where g.odev_id = d.id and g.ogrenci_id = o.id), 0)), 1)
        from public.ogrenciler o
        where o.sinif_id = d.sinif_id and o.aktif
      ) end
    ) order by d.son_tarih desc, d.created_at desc)
    from public.odevler d
    join public.siniflar s on s.id = d.sinif_id
    where (p_sinif_id is null or d.sinif_id = p_sinif_id)
      and (p_yayinda is null or d.yayinda = p_yayinda)
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.ogrenci_ekle(text, text, text, uuid) to anon, authenticated;
grant execute on function public.siniflar_listesi(text, boolean)      to anon, authenticated;
grant execute on function public.odevler_listesi(text, uuid, boolean) to anon, authenticated;
