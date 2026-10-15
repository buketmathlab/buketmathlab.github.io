-- SEKİZ — 0077: Anket sonuçlarında alt sınır yok
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Açıklamalı tam sürüm: supabase/migrations/0077_anket_alt_sinir_yok.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Ayarlar → Verinizin yedeği)
-- 0076 ÇALIŞMIŞ OLMALI. Edge Function DEĞİŞMİYOR.
--
-- NE YAPIYOR: Anket sonuçları artık TEK yanıtta da görünür (öğretmen,
-- öğrenci ve veli için). Önceden bir grupta 5 yanıt olmadan sonuç
-- gösterilmiyordu. Yanıtlar yine kimlikle birlikte saklanmaz.
--
-- Bu dosya hiçbir veriyi DEĞİŞTİRMEZ; yalnız sonuç ekranını değiştirir.
--
-- Beklenen sonuç: en altta tek satırlık bir tablo (_migration_kaydet → 0077).
-- =============================================================================

do $$
begin
  if to_regprocedure('public.anket_sonuclari(text)') is null then
    raise exception '0077: önce 0076 çalıştırılmalı';
  end if;
end $$;

-- Sonuçlar: sahip ve müdür. 0077: alt sınır yok, tek yanıt da gösteriliyor.
create or replace function public.anket_sonuclari(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  -- 0077: ALT SINIR YOK (öğretmenin kararı). Okulda 4 öğretmen var; eşik 5
  -- olsaydı öğretmen anketi hiç görünmezdi. Tek yanıt da gösteriliyor.
  esik constant integer := 1;
begin
  select * into o from public._oturum(p_token);
  if o.rol = 'mudur' then
    perform public._mudur(p_token);
  else
    perform public._yonetici(p_token);
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'anket', a.kod, 'baslik', a.baslik, 'acik', a.acik, 'esik', esik,
      'gruplar', (
        select jsonb_agg(jsonb_build_object(
          'rol', r.rol,
          'katilim', (select count(*) from public.anket_katilimlari k
                       where k.anket = a.kod and k.rol = r.rol)::integer,
          'yanit', r.n,
          'yeterli', r.n >= esik,
          'maddeler', case when r.n < esik then '[]'::jsonb else (
            select jsonb_agg(jsonb_build_object(
              'madde', 'm' || i,
              'dagilim', (select jsonb_agg((select count(*) from public.anket_yanitlari y
                                             where y.anket = a.kod and y.rol = r.rol
                                               and (y.cevaplar ->> ('m' || i))::integer = v)
                                           order by v)
                            from generate_series(1, 5) v),
              'ortalama', (select round(avg((y.cevaplar ->> ('m' || i))::integer), 2)
                             from public.anket_yanitlari y
                            where y.anket = a.kod and y.rol = r.rol)
            ) order by i)
            from generate_series(1, public._anket_madde_sayisi(r.rol)) i) end,
          -- Görüşler metin sırasına göre: yanıtlanma sırası bir ipucu olmasın.
          'gorusler', case when r.n < esik then '[]'::jsonb else coalesce((
            select jsonb_agg(y.cevaplar ->> 'acik' order by y.cevaplar ->> 'acik')
              from public.anket_yanitlari y
             where y.anket = a.kod and y.rol = r.rol and y.cevaplar ? 'acik'), '[]'::jsonb) end
        ) order by r.sira)
        from (select g.rol, g.sira,
                     (select count(*) from public.anket_yanitlari y
                       where y.anket = a.kod and y.rol = g.rol)::integer as n
                from (values ('ogrenci', 1), ('veli', 2), ('ogretmen', 3)) g(rol, sira)) r
      )
    ) order by a.kod desc)
    from public.anketler a
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.anket_sonuclari(text) from public, anon, authenticated;
grant execute on function public.anket_sonuclari(text) to anon, authenticated;

do $$
begin
  if pg_get_functiondef('public.anket_sonuclari(text)'::regprocedure)
       not like '%esik constant integer := 1;%' then
    raise exception '0077: anket_sonuclari hâlâ alt sınır uyguluyor';
  end if;
end $$;

select public._migration_kaydet('0077');
