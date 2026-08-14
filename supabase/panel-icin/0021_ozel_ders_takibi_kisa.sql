-- SEKİZ — 0021: özel ders takibi (dersler ve ödemeler)
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Beklenen sonuç: "Success. No rows returned."
-- Açıklamalı tam sürüm: supabase/migrations/0021_ozel_ders_takibi.sql

create or replace function public.ozel_ders_detay(p_token text, p_ogrenci_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  ogr record;
begin
  perform public._ogretmen(p_token);

  select o.id, o.ad, o.tur, o.aktif, s.ad as sinif
    into ogr
    from public.ogrenciler o
    left join public.siniflar s on s.id = o.sinif_id
   where o.id = p_ogrenci_id;

  if not found then
    raise exception 'Öğrenci bulunamadı.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'ogrenci', jsonb_build_object(
      'id', ogr.id, 'ad', ogr.ad, 'tur', ogr.tur,
      'sinif', ogr.sinif, 'aktif', ogr.aktif
    ),

    'dersler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l.id,
               'zaman', l.zaman,
               'mod', l.mod,
               'link', l.link,
               'gecti', (l.zaman <= now()))
             order by l.zaman desc)
      from public.dersler l
      where l.ogrenci_id = ogr.id
    ), '[]'::jsonb),

    'odemeler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id,
               'tutar', p.tutar,
               'tarih', p.tarih,
               'odendi', p.odendi)
             order by p.tarih desc)
      from public.odemeler p
      where p.ogrenci_id = ogr.id
    ), '[]'::jsonb),

    'ozet', jsonb_build_object(
      'toplam', coalesce((select sum(p.tutar) from public.odemeler p
                           where p.ogrenci_id = ogr.id), 0),
      'odenen', coalesce((select sum(p.tutar) from public.odemeler p
                           where p.ogrenci_id = ogr.id and p.odendi), 0),
      'kalan',  coalesce((select sum(p.tutar) from public.odemeler p
                           where p.ogrenci_id = ogr.id and not p.odendi), 0),
      'ders_toplam', (select count(*) from public.dersler l
                       where l.ogrenci_id = ogr.id),
      'gelecek_ders', (select count(*) from public.dersler l
                        where l.ogrenci_id = ogr.id and l.zaman > now())
    )
  );
end;
$$;

revoke all on function public.ozel_ders_detay(text, uuid) from public, anon, authenticated;
grant execute on function public.ozel_ders_detay(text, uuid) to anon, authenticated;

do $$
declare
  v jsonb;
  v_o uuid; v_d uuid; v_p uuid;
  jt text;
begin
  if to_regprocedure('public.ozel_ders_detay(text, uuid)') is null then
    raise exception 'ozel_ders_detay oluşmadı.';
  end if;

  if to_regprocedure('public.ders_ekle(text,uuid,timestamptz,text,text)') is null
     or to_regprocedure('public.ders_sil(text,uuid)') is null
     or to_regprocedure('public.odeme_ekle(text,uuid,numeric,date)') is null
     or to_regprocedure('public.odeme_degistir(text,uuid)') is null
     or to_regprocedure('public.odeme_sil(text,uuid)') is null then
    raise exception 'Özel ders yazma uçlarından biri kayboldu.';
  end if;

  if pg_get_functiondef('public.ogrenci_odevleri(text)'::regprocedure)
       ~* '(tutar|odendi|odemeler)' then
    raise exception 'ogrenci_odevleri ödeme bilgisi taşıyor; öğrenci parayı görmemeli.';
  end if;

  raise notice 'Özel ders takibi hazır; öğrencinin ucu ödeme taşımıyor.';
end $$;
