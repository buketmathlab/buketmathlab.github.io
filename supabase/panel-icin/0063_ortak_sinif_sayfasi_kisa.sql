-- SEKİZ — 0063: ortak Sınıflar sayfası, seviyelere göre konular
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Açıklamalı tam sürüm: supabase/migrations/0063_ortak_sinif_sayfasi.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Yedek)
-- 0062 ÇALIŞMIŞ OLMALI. Edge Function DEĞİŞMİYOR.
--
-- NE YAPIYOR:
--  1. Müdürün Genel sayfasında zorlanılan konular sınıf seviyelerine göre
--     (9., 10., 11., 12. sınıflar) ayrı ayrı.
--  2. Öğretmenlerin ve müdürün Sınıflar sayfası aynı: kartta öğrenci, ödev,
--     toplam soru, gönderim oranı, ortalama; sınıf sayfasında öğrenciler,
--     gelişim grafiği, ödevler ve soru sayıları, konu karnesi.
--     Öğretmen ortak sınıfta yine yalnız kendi ve sizin ödevlerinizi görür.
--  3. Güvenlik düzeltmesi: bir öğretmen artık başka öğretmenin sınıfının
--     konu karnesini açamıyor.
--
-- Veri SİLİNMİYOR, tablo DEĞİŞMİYOR; yalnız fonksiyonlar.
--
-- Beklenen sonuç: en altta tek satırlık bir tablo (_migration_kaydet → 0063).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SINIF KARTI SAYILARI — iç yardımcı
-- -----------------------------------------------------------------------------
create or replace function public._sinif_kart_ozetleri(p_idler uuid[], p_ogretmen uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun date := (now() at time zone 'Europe/Istanbul')::date;
begin
  return coalesce((
    with sinif as (
      select s.id, s.ad, s.seviye, s.sube, s.ozel, s.arsiv
        from public.siniflar s
       where s.id = any(p_idler)
    ),
    ogr as (
      select o.id, o.sinif_id
        from public.ogrenciler o
        join sinif s on s.id = o.sinif_id
       where o.aktif
    ),
    odev as (
      select d.id, d.sinif_id, d.soru_sayisi, d.created_at,
             d.son_tarih < bugun as doldu,
             (select count(*) from ogr o where o.sinif_id = d.sinif_id) as mevcut
        from public.odevler d
        join sinif s on s.id = d.sinif_id
       where d.yayinda
         and (p_ogretmen is null
              or public._odeve_erisir(p_ogretmen, d.ogretmen_id, d.sinif_id))
    ),
    -- Süresi dolmuş ödevlerde o sınıfın AKTİF öğrencilerinin gönderimleri.
    gon as (
      select d.sinif_id, coalesce(g.ogretmen_puan, g.puan) as p
        from odev d
        join public.gonderimler g on g.odev_id = d.id
        join ogr o on o.id = g.ogrenci_id and o.sinif_id = d.sinif_id
       where d.doldu
    ),
    x as (
      select s.*,
             (select count(*) from ogr o where o.sinif_id = s.id)::integer as ogrenci,
             (select count(*) from odev d where d.sinif_id = s.id)::integer as odev,
             (select count(*) from odev d where d.sinif_id = s.id and d.doldu)::integer as dolan,
             (select coalesce(sum(d.soru_sayisi), 0) from odev d where d.sinif_id = s.id)::integer as soru,
             (select count(*) from odev d where d.sinif_id = s.id and d.soru_sayisi is null)::integer as soru_sayisiz,
             (select coalesce(sum(d.mevcut), 0) from odev d where d.sinif_id = s.id and d.doldu)::integer as beklenen,
             (select count(*) from gon g where g.sinif_id = s.id)::integer as gonderim,
             (select sum(g.p) from gon g where g.sinif_id = s.id) as puan_top,
             (select count(g.p) from gon g where g.sinif_id = s.id)::integer as puan_say,
             (select max(d.created_at) from odev d where d.sinif_id = s.id) as son_odev
        from sinif s
    )
    select jsonb_agg(jsonb_build_object(
             'id', x.id,
             'ad', x.ad,
             'seviye', x.seviye,
             'ozel', x.ozel,
             'arsiv', x.arsiv,
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
      from x
  ), '[]'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. ÖĞRETMENİN SINIF KARTLARI
-- -----------------------------------------------------------------------------
create or replace function public.sinif_kartlari(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  -- `siniflar_listesi` ile aynı küme (arşiv dahil; ekran süzüyor).
  return public._sinif_kart_ozetleri(
    array(select s.id from public.siniflar s
           where public._ogretmenin_sinifi(v_ogretmen, s.id)),
    v_ogretmen);
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. MÜDÜR PANOSU — kartlar yardımcıdan, seviyelere göre konular
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
    select d.id, d.sinif_id, s.seviye, d.soru_sayisi, d.son_tarih, d.tur,
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
    select d.seviye, e->>'konu' as konu,
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
     group by d.seviye, e->>'konu'
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
               'ortalama', round(v.puan_top / nullif(v.puan_say, 0), 1),
               -- 0063: SEVİYENİN en çok zorlandığı konular (öğretmenin
               -- isteği: "9. sınıfların en çok zorlandığı konular…").
               'eksik_konular', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'konu', t.konu, 'toplam', t.toplam, 'dogru', t.dogru,
                          'oran', round(100.0 * t.dogru / t.toplam))
                        order by t.toplam - t.dogru desc, t.konu)
                   from (select * from konu k
                          where k.seviye = v.seviye
                            and public._konu_durumu(k.toplam, k.dogru) <> 'az_veri'
                            and k.toplam - k.dogru > 0
                          order by k.toplam - k.dogru desc, k.konu
                          limit 5) t
               ), '[]'::jsonb)
             ) order by v.seviye)
        from seviye_ozet v
    ), '[]'::jsonb),
    -- 0063: kartlar öğretmenin Sınıflar sayfasıyla AYNI yardımcıdan.
    'siniflar', public._sinif_kart_ozetleri(
      array(select s.id from public.siniflar s where not s.arsiv and not s.ozel), null),
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
-- 4. ORTAK SINIF SAYFASI — not çizelgesi
-- -----------------------------------------------------------------------------
drop function if exists public.sinif_not_cizelgesi(text, uuid);
create or replace function public.sinif_not_cizelgesi(
  p_token text,
  p_sinif_id uuid,
  p_onizleme boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun_tr  date := (now() at time zone 'Europe/Istanbul')::date;
  v_okuyan  uuid;
  v_sinif   record;
  v_yil_bas date;
  v_hepsi   boolean;
  v_dolan   integer;
begin
  v_okuyan := public._sinif_okuyucusu(p_token, p_sinif_id);

  -- 0063 — ÖDEV KAPSAMI. Müdür (ve sahibin müdür önizlemesi) sınıfın
  -- BÜTÜN ödevlerini görür; öğretmen bugünkü kuralla yalnız erişebildiği
  -- ödevleri (`_odeve_erisir`, 0055 — `sinif_ogrencileri` ile aynı).
  v_hepsi := (select o.rol from public._oturum(p_token) o) = 'mudur'
          or (p_onizleme and exists (select 1 from public.ogretmenler g
                                      where g.id = v_okuyan and g.yonetici));

  -- 0063: arşivdeki sınıf da açılıyor (öğretmenin sınıf sayfası bugün açıyor).
  select s.id, s.ad, s.ozel, s.arsiv into v_sinif
    from public.siniflar s where s.id = p_sinif_id;
  if not found then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;

  select count(*)::integer into v_dolan
    from public.odevler d
   where d.sinif_id = p_sinif_id and d.yayinda and d.son_tarih < bugun_tr
     and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id));

  v_yil_bas := make_date(
    case when extract(month from bugun_tr) >= 9 then extract(year from bugun_tr)::integer
         else extract(year from bugun_tr)::integer - 1 end, 9, 1);

  return jsonb_build_object(
    'sinif', jsonb_build_object(
      'id', v_sinif.id,
      'ad', v_sinif.ad,
      'ozel', v_sinif.ozel,
      'arsiv', v_sinif.arsiv,
      'ogretmenler', coalesce((
          select jsonb_agg(g.ad order by g.yonetici desc, g.ad)
            from public.ogretmen_siniflari os
            join public.ogretmenler g on g.id = os.ogretmen_id
           where os.sinif_id = p_sinif_id and g.aktif and not g.mudur
        ), '[]'::jsonb)),
    'kapsam', case when v_hepsi then 'tum' else 'ogretmen' end,
    'degerlendirilen_odev', v_dolan,
    'mevcut', (select count(*)::integer from public.ogrenciler o
                where o.sinif_id = p_sinif_id and o.aktif),
    'odevler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', d.id,
               'baslik', d.baslik,
               'tur', d.tur,
               'ogretmen', (select g.ad from public.ogretmenler g where g.id = d.ogretmen_id),
               'soru_sayisi', d.soru_sayisi,
               'son_tarih', d.son_tarih,
               'sure_doldu', d.son_tarih < bugun_tr,
               'gonderim', (select count(*)::integer from public.gonderimler g
                             join public.ogrenciler o on o.id = g.ogrenci_id
                            where g.odev_id = d.id and o.aktif and o.sinif_id = p_sinif_id),
               'ortalama', (select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1)
                              from public.gonderimler g
                              join public.ogrenciler o on o.id = g.ogrenci_id
                             where g.odev_id = d.id and o.aktif and o.sinif_id = p_sinif_id
                               and coalesce(g.ogretmen_puan, g.puan) is not null)
             ) order by d.son_tarih, d.created_at, d.id)
        from public.odevler d
       where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id)) and d.yayinda
    ), '[]'::jsonb),
    'ogrenciler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id,
               'ad', o.ad,
               'ogrenci_no', o.ogrenci_no,
               'tur', o.tur,
               -- 0063 — ÖĞRETMENİN SINIF SAYFASININ SAYILARI,
               -- `sinif_ogrencileri` (0055) ile BİREBİR aynı formül.
               'yapti', i.yapti,
               'yapmadi', v_dolan - i.yapti,
               'ortalama_yapan', i.ortalama_yapan,
               'ortalama_tum', i.ortalama_tum,
               -- ORTALAMA — `sinif_ogrenci_ozeti` (0051) ile birebir.
               'ortalama', (
                 select round(avg(coalesce(
                          (select coalesce(g.ogretmen_puan, g.puan)
                             from public.gonderimler g
                            where g.odev_id = d.id and g.ogrenci_id = o.id),
                          0)), 2)
                   from public.odevler d
                  where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id))
                    and d.yayinda
                    and d.son_tarih < bugun_tr
               ),
               'yapilan', (
                 select count(*)::integer from public.odevler d
                  where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id)) and d.yayinda
                    and d.son_tarih < bugun_tr
                    and exists (select 1 from public.gonderimler g
                                 where g.odev_id = d.id and g.ogrenci_id = o.id)
               ),
               'yapilmayan', (
                 select count(*)::integer from public.odevler d
                  where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id)) and d.yayinda
                    and d.son_tarih < bugun_tr
                    and not exists (select 1 from public.gonderimler g
                                     where g.odev_id = d.id and g.ogrenci_id = o.id)
               ),
               'puanlar', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'odev_id', d.id,
                          'puan', g.p,
                          'durum', case
                                     when g.var then 'gonderdi'
                                     when d.son_tarih < bugun_tr then 'gondermedi'
                                     else 'suresi_devam'
                                   end
                        ) order by d.son_tarih, d.created_at, d.id)
                   from public.odevler d
                   left join lateral (
                     select true as var, coalesce(gg.ogretmen_puan, gg.puan) as p
                       from public.gonderimler gg
                      where gg.odev_id = d.id and gg.ogrenci_id = o.id
                   ) g on true
                  where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id)) and d.yayinda
               ), '[]'::jsonb)
             )
             -- SIRA: öğretmenin sınıf sayfasıyla aynı (0044, sayısal numara).
             order by public._numara_sira(o.ogrenci_no) nulls last, o.ad)
        from public.ogrenciler o
        cross join lateral (
          select
            count(g.id)::integer as yapti,
            round(avg(coalesce(g.ogretmen_puan, g.puan))
                  filter (where g.id is not null), 1) as ortalama_yapan,
            case when v_dolan > 0 then
              round(sum(coalesce(g.ogretmen_puan, g.puan, 0)) / v_dolan, 1)
            end as ortalama_tum
          from public.odevler d
          left join public.gonderimler g
            on g.odev_id = d.id and g.ogrenci_id = o.id
          where d.sinif_id = p_sinif_id
            and d.yayinda
            and d.son_tarih < bugun_tr
            and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id))
        ) i
       where o.sinif_id = p_sinif_id and o.aktif
    ), '[]'::jsonb),
    -- SINIFIN AYLIK GELİŞİMİ — süresi dolmuş ödevler, aktif öğrenciler.
    'aylar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ay', a.ay,
               'odev_sayisi', (select count(*)::integer from public.odevler d
                                where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id)) and d.yayinda
                                  and date_trunc('month', d.son_tarih)::date = a.ay),
               'ortalama', (
                 select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1)
                   from public.odevler d
                   join public.gonderimler g on g.odev_id = d.id
                   join public.ogrenciler o on o.id = g.ogrenci_id
                  where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id)) and d.yayinda and d.son_tarih < bugun_tr
                    and date_trunc('month', d.son_tarih)::date = a.ay
                    and o.aktif and o.sinif_id = p_sinif_id
                    and coalesce(g.ogretmen_puan, g.puan) is not null),
               'gonderim_orani', (
                 select round(100.0 * count(g.id) / nullif(
                          (select count(*) from public.odevler d2
                            where d2.sinif_id = p_sinif_id
                              and (v_hepsi or public._odeve_erisir(v_okuyan, d2.ogretmen_id, d2.sinif_id)) and d2.yayinda
                              and d2.son_tarih < bugun_tr
                              and date_trunc('month', d2.son_tarih)::date = a.ay)
                          * (select count(*) from public.ogrenciler o2
                              where o2.sinif_id = p_sinif_id and o2.aktif), 0))
                   from public.odevler d
                   join public.gonderimler g on g.odev_id = d.id
                   join public.ogrenciler o on o.id = g.ogrenci_id
                  where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id)) and d.yayinda and d.son_tarih < bugun_tr
                    and date_trunc('month', d.son_tarih)::date = a.ay
                    and o.aktif and o.sinif_id = p_sinif_id)
             ) order by a.ay)
        from (select generate_series(v_yil_bas, date_trunc('month', bugun_tr)::date,
                                     interval '1 month')::date as ay) a
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. KONU KARNESİ — erişim kontrolü
-- -----------------------------------------------------------------------------
create or replace function public.konu_karnesi(
  p_token text,
  p_sinif_id uuid default null,
  p_ogrenci_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun_tr     date := (now() at time zone 'Europe/Istanbul')::date;
  v_sinif_id   uuid;
  v_ad         text;
  v_sinif_ad   text;
  v_tur        text;
  v_mevcut     integer;
  v_odev_sayisi integer;
  o            public.ogrenciler;
  s            public.siniflar;
  v_ogretmen   uuid;
begin
  -- 0063: ERİŞİM KONTROLÜ EKLENDİ. 0033'te yalnız rol bakılıyordu; bir
  -- öğretmen başka öğretmenin sınıfının ya da öğrencisinin karnesini
  -- okuyabiliyordu. Sınıf yolu `_sinif_okuyucusu` (öğretmen kendi sınıfı,
  -- müdür ve sahip özel ders dışındaki her sınıf); öğrenci yolu yalnız
  -- öğretmen (`_ogrenci_sahibi`) — aşağıda.
  if p_sinif_id is not null and p_ogrenci_id is null then
    v_ogretmen := public._sinif_okuyucusu(p_token, p_sinif_id);
  else
    v_ogretmen := public._ogretmen(p_token);
  end if;

  -- İKİSİNDEN TAM OLARAK BİRİ. Sessizce birini seçmek, öğretmenin baktığını
  -- sandığı şeyle ekranda gösterileni ayırırdı; ikisini birden kabul etmek
  -- de "hangisi kazandı" sorusunu doğururdu.
  if (p_sinif_id is null) = (p_ogrenci_id is null) then
    raise exception 'Sınıf ya da öğrenci: ikisinden tam olarak biri verilmeli.'
      using errcode = '22023';
  end if;

  if p_ogrenci_id is not null then
    select * into o from public.ogrenciler where id = p_ogrenci_id;
    if not found then
      raise exception 'Öğrenci bulunamadı.' using errcode = 'P0002';
    end if;
    perform public._ogrenci_sahibi(v_ogretmen, p_ogrenci_id);
    v_sinif_id := o.sinif_id;
    v_ad       := o.ad;
    v_tur      := 'ogrenci';
    v_mevcut   := 1;
    select ad into v_sinif_ad from public.siniflar where id = v_sinif_id;
  else
    select * into s from public.siniflar where id = p_sinif_id;
    if not found then
      raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
    end if;
    v_sinif_id := s.id;
    v_ad       := s.ad;
    v_sinif_ad := s.ad;
    v_tur      := 'sinif';
    select count(*)::integer into v_mevcut
      from public.ogrenciler g where g.sinif_id = v_sinif_id and g.aktif;
  end if;

  -- 0013 İLE BİREBİR AYNI ÖLÇÜT.
  select count(*)::integer into v_odev_sayisi
  from public.odevler d
  where d.sinif_id = v_sinif_id and d.yayinda and d.son_tarih < bugun_tr;

  return jsonb_build_object(
    'kapsam', jsonb_build_object(
      'tur', v_tur, 'ad', v_ad, 'sinif', v_sinif_ad, 'mevcut', v_mevcut
    ),

    -- Öğretmen "kaç ödev üzerinden konuşuyoruz" sorusunu görmeden hiçbir
    -- ortalamayı yorumlayamaz (0013'teki aynı gerekçe).
    'odev_sayisi', v_odev_sayisi,

    -- -----------------------------------------------------------------
    -- KONU DÖKÜMÜ — yalnız TEST ödevlerinden
    --
    -- Açık uçlu ödevin konu eşlemesi yok: anahtarı olmayan bir ödevde
    -- `_konu_analizi` her soruyu "boş" sayardı ve döküm, öğretmenin hiç
    -- sormadığı bir soruya uydurma bir cevap verirdi.
    --
    -- Sıralama `konu_ozeti` ile aynı: en çok eksik olan konu başta.
    -- -----------------------------------------------------------------
    'konular', coalesce((
      select jsonb_agg(jsonb_build_object(
               'konu', t.konu, 'toplam', t.toplam,
               'dogru', t.dogru, 'yanlis', t.yanlis, 'bos', t.bos)
             order by (t.toplam - t.dogru) desc, t.konu)
      from (
        select e->>'konu' as konu,
               sum((e->>'toplam')::integer)::integer as toplam,
               sum((e->>'dogru')::integer)::integer  as dogru,
               sum((e->>'yanlis')::integer)::integer as yanlis,
               sum((e->>'bos')::integer)::integer    as bos
        from public.odevler d
        join public.gonderimler g on g.odev_id = d.id
        join public.ogrenciler  k on k.id = g.ogrenci_id
        cross join lateral jsonb_array_elements(
          public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
        ) e
        where d.sinif_id = v_sinif_id
          and d.yayinda
          and d.son_tarih < bugun_tr
          and d.tur = 'test'
          and case when p_ogrenci_id is not null
                   then k.id = p_ogrenci_id
                   else k.sinif_id = v_sinif_id and k.aktif end
        group by e->>'konu'
      ) t
    ), '[]'::jsonb),

    -- -----------------------------------------------------------------
    -- GELİŞİM — ödev ödev, kronolojik
    --
    -- AÇIK UÇLU ÖDEV BURADA VAR. Konu eşlemesi yok ama puanı var, ve
    -- "bu öğrenci dönem boyunca nereye gidiyor" sorusunun cevabından
    -- açık uçlu ödevleri çıkarmak resmin yarısını silerdi.
    --
    -- `coalesce(ogretmen_puan, puan)` — arayüzün ve 0013'ün hesabıyla
    -- aynı: öğretmenin verdiği puan sistemin hesapladığını ezer.
    --
    -- GÖNDERİLMEYEN ÖDEV 0 DEĞİL, BOŞ (`deger: null`). Sıfır yazmak
    -- "sıfır aldı" demektir; göndermemek başka bir şeydir ve ekranın
    -- ikisini karıştırmaması gerekiyor. Kaç kişinin gönderdiği ayrı
    -- alanda duruyor, yani bilgi kaybolmuyor.
    -- -----------------------------------------------------------------
    'gelisim', coalesce((
      select jsonb_agg(jsonb_build_object(
               'odev', d.baslik,
               'tarih', d.son_tarih,
               'tur', d.tur,
               'deger', i.deger,
               'gonderen', i.gonderen,
               'mevcut', v_mevcut)
             order by d.son_tarih, d.baslik)
      from public.odevler d
      cross join lateral (
        select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1) as deger,
               count(g.id)::integer as gonderen
        from public.gonderimler g
        join public.ogrenciler k on k.id = g.ogrenci_id
        where g.odev_id = d.id
          and case when p_ogrenci_id is not null
                   then k.id = p_ogrenci_id
                   else k.sinif_id = v_sinif_id and k.aktif end
      ) i
      where d.sinif_id = v_sinif_id
        and d.yayinda
        and d.son_tarih < bugun_tr
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. YETKİLER
-- -----------------------------------------------------------------------------
revoke all on function public._sinif_kart_ozetleri(uuid[], uuid) from public, anon, authenticated;

revoke all on function public.sinif_kartlari(text) from public, anon, authenticated;
grant execute on function public.sinif_kartlari(text) to anon, authenticated;

revoke all on function public.mudur_paneli(text) from public, anon, authenticated;
grant execute on function public.mudur_paneli(text) to anon, authenticated;

revoke all on function public.sinif_not_cizelgesi(text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.sinif_not_cizelgesi(text, uuid, boolean) to anon, authenticated;

revoke all on function public.konu_karnesi(text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.konu_karnesi(text, uuid, uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. KENDİ KENDİNİ DENETLEME
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public._sinif_okuyucusu(text, uuid)') is null
     or pg_get_functiondef('public.mudur_paneli(text)'::regprocedure) not like '%_yonetici(p_token)%' then
    raise exception '0063: önce 0062 çalıştırılmalı';
  end if;
  if to_regprocedure('public.sinif_not_cizelgesi(text, uuid)') is not null then
    raise exception '0063: eski sinif_not_cizelgesi imzası duruyor';
  end if;
  if pg_get_functiondef('public.konu_karnesi(text, uuid, uuid)'::regprocedure) not like '%_sinif_okuyucusu(%'
     or pg_get_functiondef('public.konu_karnesi(text, uuid, uuid)'::regprocedure) not like '%_ogrenci_sahibi(%' then
    raise exception '0063: konu_karnesi erişim kontrolü eksik';
  end if;
  if pg_get_functiondef('public.mudur_paneli(text)'::regprocedure) not like '%_sinif_kart_ozetleri(%'
     or pg_get_functiondef('public.sinif_kartlari(text)'::regprocedure) not like '%_sinif_kart_ozetleri(%' then
    raise exception '0063: kart sayıları tek kaynaktan gelmiyor';
  end if;
  if has_function_privilege('anon', 'public._sinif_kart_ozetleri(uuid[], uuid)', 'execute') then
    raise exception '0063: _sinif_kart_ozetleri istemciye açık';
  end if;
end $$;

select public._migration_kaydet('0063');
