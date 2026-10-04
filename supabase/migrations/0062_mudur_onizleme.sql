-- =============================================================================
-- 0062 — MÜDÜR EKRANI ÖNİZLEMESİ (platform sahibi)
--
-- Öğretmenin sorusu: "Diğer öğretmenlere platform sahibi olarak onların
-- hesapları gibi girebiliyordum. Müdürün kinde de öyle mi olacak?"
-- Cevap: müdür hesabına GİRİLMİYOR (0060 — vekâlet kapalı); onun yerine
-- sahip, KENDİ OTURUMUYLA müdürün gördüğü ekranın aynısını açıyor.
--
-- NEDEN VEKÂLET DEĞİL: müdür hiçbir şeyi değiştiremiyor, yani hesabına
-- girmenin tek amacı "ne görüyor" sorusu. Önizleme o soruyu cevaplıyor ve
-- (1) müdürün "son giriş"ini bozmuyor, (2) onam dökümünde "alan" sahibin
-- adı oluyor — kâğıt kimin aldığını doğru söylüyor, (3) müdür adına PIN
-- değiştirme gibi bir kapı açmıyor.
--
-- 1. mudur_paneli (0061 kopyası): müdür ya da SAHİP; yanıtta `onizleme`.
-- 2. _sinif_okuyucusu (0060 kopyası): sahip, vekâlette değilken, özel ders
--    dışındaki her sınıfı okuyabiliyor (sinif_analizi, onam_dokumu,
--    sinif_not_cizelgesi). Başka öğretmenin kuralı DEĞİŞMEDİ.
--
-- Bu dosya tekrar çalıştırılabilir. Ön koşul: 0061.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. MÜDÜR PANOSU — müdür ya da sahip (önizleme)
-- -----------------------------------------------------------------------------
create or replace function public.mudur_paneli(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id      uuid;
  bugun     date := (now() at time zone 'Europe/Istanbul')::date;
  v_yil_bas date;
  v_sonuc   jsonb;
  v_onizleme boolean := false;
begin
  -- 0062: platform sahibi ÖNİZLEME için kendi oturumuyla açabiliyor —
  -- müdürün yerine geçmeden. Sahip bu sayıların hepsini zaten görüyor;
  -- yeni bir şey açılmıyor. Başka hiçbir öğretmen giremiyor (`_yonetici`).
  if (select o.rol from public._oturum(p_token) o) = 'mudur' then
    v_id := public._mudur(p_token);
  else
    v_id := public._yonetici(p_token);
    v_onizleme := true;
  end if;

  v_yil_bas := make_date(
    case when extract(month from bugun) >= 9 then extract(year from bugun)::integer
         else extract(year from bugun)::integer - 1 end, 9, 1);

  with sinif as (
    select s.id, s.ad, s.seviye, s.sube
      from public.siniflar s
     where not s.arsiv and not s.ozel
  ),
  ogr as (
    select o.id, o.sinif_id
      from public.ogrenciler o
      join sinif s on s.id = o.sinif_id
     where o.aktif
  ),
  odev as (
    select d.id, d.sinif_id, d.soru_sayisi, d.son_tarih, d.tur,
           d.son_tarih < bugun as doldu,
           date_trunc('month', d.son_tarih)::date as ay,
           (select count(*) from ogr o where o.sinif_id = d.sinif_id) as mevcut
      from public.odevler d
      join sinif s on s.id = d.sinif_id
     where d.yayinda
  ),
  -- Süresi dolmuş ödevlerde o sınıfın AKTİF öğrencilerinin gönderimleri.
  gon as (
    select d.id as odev_id, d.sinif_id, d.ay,
           coalesce(g.ogretmen_puan, g.puan) as p
      from odev d
      join public.gonderimler g on g.odev_id = d.id
      join ogr o on o.id = g.ogrenci_id and o.sinif_id = d.sinif_id
     where d.doldu
  ),
  sinif_ozet as (
    select s.id, s.ad, s.seviye, s.sube,
           (select count(*) from ogr o where o.sinif_id = s.id)::integer as ogrenci,
           (select count(*) from odev d where d.sinif_id = s.id)::integer as odev,
           (select count(*) from odev d where d.sinif_id = s.id and d.doldu)::integer as dolan,
           (select coalesce(sum(d.soru_sayisi), 0) from odev d where d.sinif_id = s.id)::integer as soru,
           (select count(*) from odev d where d.sinif_id = s.id and d.soru_sayisi is null)::integer as soru_sayisiz,
           (select coalesce(sum(d.mevcut), 0) from odev d where d.sinif_id = s.id and d.doldu)::integer as beklenen,
           (select count(*) from gon g where g.sinif_id = s.id)::integer as gonderim,
           (select sum(g.p) from gon g where g.sinif_id = s.id) as puan_top,
           (select count(g.p) from gon g where g.sinif_id = s.id)::integer as puan_say,
           (select max(dd.created_at) from public.odevler dd
             where dd.sinif_id = s.id and dd.yayinda) as son_odev
      from sinif s
  ),
  seviye_ozet as (
    select seviye,
           count(*)::integer as sinif_sayisi,
           sum(ogrenci)::integer as ogrenci, sum(odev)::integer as odev,
           sum(soru)::integer as soru, sum(soru_sayisiz)::integer as soru_sayisiz,
           sum(beklenen)::integer as beklenen, sum(gonderim)::integer as gonderim,
           sum(puan_top) as puan_top, sum(puan_say)::integer as puan_say
      from sinif_ozet group by seviye
  ),
  konu as (
    select e->>'konu' as konu,
           sum((e->>'toplam')::integer)::integer as toplam,
           sum((e->>'dogru')::integer)::integer  as dogru
      from odev d
      join public.odevler dd on dd.id = d.id
      join public.gonderimler g on g.odev_id = d.id
      join ogr o on o.id = g.ogrenci_id and o.sinif_id = d.sinif_id
      cross join lateral jsonb_array_elements(
        public._konu_analizi(dd.konular, dd.cevap_anahtari, g.cevaplar, dd.soru_sayisi)
      ) e
     where d.doldu and d.tur = 'test'
     group by e->>'konu'
  )
  select jsonb_build_object(
    'ad', (select g.ad from public.ogretmenler g where g.id = v_id),
    'onizleme', v_onizleme,
    'yil_baslangici', v_yil_bas,
    'okul', (
      select jsonb_build_object(
               'sinif_sayisi', count(*)::integer,
               'ogrenci_sayisi', coalesce(sum(ogrenci), 0)::integer,
               'odev_sayisi', coalesce(sum(odev), 0)::integer,
               'soru_toplami', coalesce(sum(soru), 0)::integer,
               'soru_sayisiz', coalesce(sum(soru_sayisiz), 0)::integer,
               'gonderim_orani', round(100.0 * sum(gonderim) / nullif(sum(beklenen), 0)),
               'ortalama', round(sum(puan_top) / nullif(sum(puan_say), 0), 1))
        from sinif_ozet
    ),
    'seviyeler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'seviye', v.seviye,
               'sinif_sayisi', v.sinif_sayisi,
               'ogrenci_sayisi', v.ogrenci,
               'odev_sayisi', v.odev,
               'soru_toplami', v.soru,
               'soru_sayisiz', v.soru_sayisiz,
               'gonderim_orani', round(100.0 * v.gonderim / nullif(v.beklenen, 0)),
               'ortalama', round(v.puan_top / nullif(v.puan_say, 0), 1)
             ) order by v.seviye)
        from seviye_ozet v
    ), '[]'::jsonb),
    'siniflar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', x.id,
               'ad', x.ad,
               'seviye', x.seviye,
               'ogretmenler', coalesce((
                   select jsonb_agg(g.ad order by g.yonetici desc, g.ad)
                     from public.ogretmen_siniflari os
                     join public.ogretmenler g on g.id = os.ogretmen_id
                    where os.sinif_id = x.id and g.aktif and not g.mudur
                 ), '[]'::jsonb),
               'ogrenci_sayisi', x.ogrenci,
               'odev_sayisi', x.odev,
               'suresi_dolan', x.dolan,
               'soru_toplami', x.soru,
               'soru_sayisiz', x.soru_sayisiz,
               'gonderim_orani', round(100.0 * x.gonderim / nullif(x.beklenen, 0)),
               'ortalama', round(x.puan_top / nullif(x.puan_say, 0), 1),
               'son_odev', x.son_odev
             ) order by x.seviye, x.sube)
        from sinif_ozet x
    ), '[]'::jsonb),
    -- AYLIK GELİŞİM — eğitim yılı başından bu aya; ödevsiz ay da satır
    -- (grafikte boşluk "veri yok" demek, sıfır değil).
    'aylar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ay', a.ay,
               'odev_sayisi', (select count(*) from odev d where d.ay = a.ay)::integer,
               'soru_toplami', (select coalesce(sum(d.soru_sayisi), 0) from odev d where d.ay = a.ay)::integer,
               'gonderim_orani', round(100.0
                   * (select count(*) from gon g where g.ay = a.ay)
                   / nullif((select sum(d.mevcut) from odev d where d.ay = a.ay and d.doldu), 0)),
               'ortalama', (select round(avg(g.p), 1) from gon g where g.ay = a.ay)
             ) order by a.ay)
        from (select generate_series(v_yil_bas, date_trunc('month', bugun)::date,
                                     interval '1 month')::date as ay) a
    ), '[]'::jsonb),
    -- OKULUN EN EKSİK KONULARI — sınıf analizinin ölçütü (`_konu_durumu`),
    -- az veri olan konu aday değil.
    'eksik_konular', coalesce((
      select jsonb_agg(jsonb_build_object(
               'konu', t.konu, 'toplam', t.toplam, 'dogru', t.dogru,
               'oran', round(100.0 * t.dogru / t.toplam))
             order by t.toplam - t.dogru desc, t.konu)
        from (select * from konu k
               where public._konu_durumu(k.toplam, k.dogru) <> 'az_veri'
                 and k.toplam - k.dogru > 0
               order by k.toplam - k.dogru desc, k.konu
               limit 5) t
    ), '[]'::jsonb),
    'ogretmenler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ad', g.ad,
               'sahip', g.yonetici,
               'siniflar', coalesce((
                   select jsonb_agg(s.ad order by s.seviye, s.sube)
                     from public.ogretmen_siniflari os
                     join public.siniflar s on s.id = os.sinif_id
                    where os.ogretmen_id = g.id and not s.arsiv and not s.ozel
                 ), '[]'::jsonb),
               'odev_sayisi', (select count(*)::integer from public.odevler d
                                join public.siniflar s on s.id = d.sinif_id
                               where d.ogretmen_id = g.id and d.yayinda and not s.ozel),
               'soru_toplami', (select coalesce(sum(d.soru_sayisi), 0)::integer from public.odevler d
                                 join public.siniflar s on s.id = d.sinif_id
                                where d.ogretmen_id = g.id and d.yayinda and not s.ozel),
               'son_30_gun', (select count(*)::integer from public.odevler d
                               join public.siniflar s on s.id = d.sinif_id
                              where d.ogretmen_id = g.id and d.yayinda and not s.ozel
                                and d.created_at > now() - interval '30 days'),
               'son_odev', (select max(d.created_at) from public.odevler d
                             join public.siniflar s on s.id = d.sinif_id
                            where d.ogretmen_id = g.id and d.yayinda and not s.ozel)
             ) order by g.yonetici desc, g.ad)
        from public.ogretmenler g
       where g.aktif and not g.mudur
    ), '[]'::jsonb)
  ) into v_sonuc;

  return v_sonuc;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. SINIF OKUYUCUSU — sahip her (özel olmayan) sınıfı okuyabilir
-- -----------------------------------------------------------------------------
create or replace function public._sinif_okuyucusu(p_token text, p_sinif_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  v_ogretmen uuid;
begin
  select * into o from public._oturum(p_token);
  if o.rol = 'mudur' then
    if exists (select 1 from public.siniflar s where s.id = p_sinif_id and s.ozel) then
      raise exception 'Özel ders grubu müdür ekranında yer almaz.' using errcode = '42501';
    end if;
    return o.ogretmen_id;
  end if;

  v_ogretmen := public._ogretmen(p_token);
  if public._ogretmenin_sinifi(v_ogretmen, p_sinif_id) then
    return v_ogretmen;
  end if;

  -- 0062: PLATFORM SAHİBİ (kendi hesabındayken, vekâlette değil) özel ders
  -- dışındaki her sınıfı OKUYABİLİR — müdür ekranı önizlemesi müdürün
  -- gördüğü her sınıfı açabilsin. Sahip zaten her öğretmenin hesabına
  -- girebiliyor; bu üç okuma ucu için yeni bir yetki değil.
  if o.vekil_id is null
     and exists (select 1 from public.ogretmenler g where g.id = v_ogretmen and g.yonetici)
     and exists (select 1 from public.siniflar s where s.id = p_sinif_id and not s.ozel) then
    return v_ogretmen;
  end if;

  raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. YETKİLER
-- -----------------------------------------------------------------------------
revoke all on function public.mudur_paneli(text) from public, anon, authenticated;
grant execute on function public.mudur_paneli(text) to anon, authenticated;
revoke all on function public._sinif_okuyucusu(text, uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. KENDİ KENDİNİ DENETLEME
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.sinif_not_cizelgesi(text, uuid)') is null then
    raise exception '0062: önce 0061 çalıştırılmalı';
  end if;
  if pg_get_functiondef('public.mudur_paneli(text)'::regprocedure) not like '%_yonetici(p_token)%'
     or pg_get_functiondef('public.mudur_paneli(text)'::regprocedure) not like '%_mudur(p_token)%' then
    raise exception '0062: mudur_paneli kapıları eksik';
  end if;
  if pg_get_functiondef('public._sinif_okuyucusu(text, uuid)'::regprocedure) not like '%o.vekil_id is null%' then
    raise exception '0062: _sinif_okuyucusu sahip kuralı eksik';
  end if;
  if has_function_privilege('anon', 'public._sinif_okuyucusu(text, uuid)', 'execute') then
    raise exception '0062: _sinif_okuyucusu istemciye açık';
  end if;
end $$;

select public._migration_kaydet('0062');
