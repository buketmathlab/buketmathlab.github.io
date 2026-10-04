-- =============================================================================
-- 0069 — "EN ÇOK ZORLANILAN KONULAR" BOŞSA NEDENİ
--
-- Öğretmenin sorusu: "10. sınıfların en çok zorlandığı konular neden
-- gösterilmiyor? Neden yeteri kadar veri yok yazıyor?" Seçimi: ekran genel
-- "yeterli veri yok" yerine NEDENİ söylesin.
--
-- `seviyeler[].konu_verisi`: test_odev, dolan_test, konulu_dolan_test,
-- yeterli_konu, en_az_cevap. Hesap kuralı DEĞİŞMEDİ (yalnız süresi dolmuş
-- test ödevleri, konusu girilmiş sorular, konu başına en az N cevap).
--
-- Kopyalanan gövdeler: mudur_paneli, okul_geneli ← 0066. İki uç hâlâ aynı
-- hesap (duyuru_testleri 1. grup `seviyeler` eşitliğini ölçüyor).
--
-- Bu dosya tekrar çalıştırılabilir. Ön koşul: 0068.
-- =============================================================================

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
    select o.id, o.sinif_id, o.sinif_giris
      from public.ogrenciler o
      join sinif s on s.id = o.sinif_id
     where o.aktif
  ),
  odev as (
    select d.id, d.sinif_id, s.seviye, d.soru_sayisi, d.son_tarih, d.created_at, d.tur,
           d.son_tarih < bugun as doldu,
           date_trunc('month', d.son_tarih)::date as ay,
           (select count(*) from ogr o where o.sinif_id = d.sinif_id
               and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)) as mevcut
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
                and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
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
                and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
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
               -- 0066: KONTROL EDİLEN SORU — öğrencilerin GÖNDERDİĞİ
               -- çözümlerdeki soru (öğretmenin seçimi: yalnız gönderenler).
               -- 30 kişilik şubede 28 kişi 50 soruluk ödevi gönderdiyse 1400.
               'kontrol_edilen_soru', (
                 select coalesce(sum(d.soru_sayisi), 0)::integer
                   from odev d
                   join public.gonderimler g on g.odev_id = d.id
                   join ogr o on o.id = g.ogrenci_id and o.sinif_id = d.sinif_id
                  where d.soru_sayisi is not null),
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
               ), '[]'::jsonb),
               -- 0069: konu listesi boşsa NEDENİ (öğretmenin isteği: "neden
               -- yeteri kadar veri yok yazıyor?"). Ekran bu sayılardan
               -- açıklamayı seçiyor: test ödevi yok / süresi dolmadı / konu
               -- girilmemiş / konu başına yeterli cevap yok / zorlanılan konu yok.
               'konu_verisi', jsonb_build_object(
                 'test_odev', (select count(*) from odev d
                                where d.seviye = v.seviye and d.tur = 'test')::integer,
                 'dolan_test', (select count(*) from odev d
                                 where d.seviye = v.seviye and d.tur = 'test' and d.doldu)::integer,
                 'konulu_dolan_test', (select count(*) from odev d
                                         join public.odevler dd on dd.id = d.id
                                        where d.seviye = v.seviye and d.tur = 'test' and d.doldu
                                          and dd.konular is not null
                                          and dd.konular not in ('{}'::jsonb, '[]'::jsonb, 'null'::jsonb))::integer,
                 'yeterli_konu', (select count(*) from konu k
                                   where k.seviye = v.seviye
                                     and public._konu_durumu(k.toplam, k.dogru) <> 'az_veri')::integer,
                 'en_az_cevap', (public._konu_esikleri()->>'en_az_soru')::integer)
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

create or replace function public.okul_geneli(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun     date := (now() at time zone 'Europe/Istanbul')::date;
  v_yil_bas date;
  v_sonuc   jsonb;
begin
  -- Her öğretmen; vekâlette de okunabilir (yalnız okuma). Müdür, öğrenci
  -- ve veli `_ogretmen`'den geçemez (42501).
  perform public._ogretmen(p_token);

  v_yil_bas := make_date(
    case when extract(month from bugun) >= 9 then extract(year from bugun)::integer
         else extract(year from bugun)::integer - 1 end, 9, 1);

  -- Aşağıdaki hesap `mudur_paneli` (0064) ile BİREBİR aynı.
  with sinif as (
    select s.id, s.ad, s.seviye, s.sube
      from public.siniflar s
     where not s.arsiv and not s.ozel
  ),
  ogr as (
    select o.id, o.sinif_id, o.sinif_giris
      from public.ogrenciler o
      join sinif s on s.id = o.sinif_id
     where o.aktif
  ),
  odev as (
    select d.id, d.sinif_id, s.seviye, d.soru_sayisi, d.son_tarih, d.created_at, d.tur,
           d.son_tarih < bugun as doldu,
           date_trunc('month', d.son_tarih)::date as ay,
           (select count(*) from ogr o where o.sinif_id = d.sinif_id
               and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)) as mevcut
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
                and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
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
                and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
      cross join lateral jsonb_array_elements(
        public._konu_analizi(dd.konular, dd.cevap_anahtari, g.cevaplar, dd.soru_sayisi)
      ) e
     where d.doldu and d.tur = 'test'
     group by d.seviye, e->>'konu'
  )
  select jsonb_build_object(
    'yil_baslangici', v_yil_bas,
    'okul', (
      select jsonb_build_object(
               'sinif_sayisi', count(*)::integer,
               'ogrenci_sayisi', coalesce(sum(ogrenci), 0)::integer,
               'odev_sayisi', coalesce(sum(odev), 0)::integer,
               'soru_toplami', coalesce(sum(soru), 0)::integer,
               'soru_sayisiz', coalesce(sum(soru_sayisiz), 0)::integer,
               -- 0066: KONTROL EDİLEN SORU — öğrencilerin GÖNDERDİĞİ
               -- çözümlerdeki soru (öğretmenin seçimi: yalnız gönderenler).
               -- 30 kişilik şubede 28 kişi 50 soruluk ödevi gönderdiyse 1400.
               'kontrol_edilen_soru', (
                 select coalesce(sum(d.soru_sayisi), 0)::integer
                   from odev d
                   join public.gonderimler g on g.odev_id = d.id
                   join ogr o on o.id = g.ogrenci_id and o.sinif_id = d.sinif_id
                  where d.soru_sayisi is not null),
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
               ), '[]'::jsonb),
               -- 0069: konu listesi boşsa NEDENİ (öğretmenin isteği: "neden
               -- yeteri kadar veri yok yazıyor?"). Ekran bu sayılardan
               -- açıklamayı seçiyor: test ödevi yok / süresi dolmadı / konu
               -- girilmemiş / konu başına yeterli cevap yok / zorlanılan konu yok.
               'konu_verisi', jsonb_build_object(
                 'test_odev', (select count(*) from odev d
                                where d.seviye = v.seviye and d.tur = 'test')::integer,
                 'dolan_test', (select count(*) from odev d
                                 where d.seviye = v.seviye and d.tur = 'test' and d.doldu)::integer,
                 'konulu_dolan_test', (select count(*) from odev d
                                         join public.odevler dd on dd.id = d.id
                                        where d.seviye = v.seviye and d.tur = 'test' and d.doldu
                                          and dd.konular is not null
                                          and dd.konular not in ('{}'::jsonb, '[]'::jsonb, 'null'::jsonb))::integer,
                 'yeterli_konu', (select count(*) from konu k
                                   where k.seviye = v.seviye
                                     and public._konu_durumu(k.toplam, k.dogru) <> 'az_veri')::integer,
                 'en_az_cevap', (public._konu_esikleri()->>'en_az_soru')::integer)
             ) order by v.seviye)
        from seviye_ozet v
    ), '[]'::jsonb),
    -- Şube kartları müdürle AYNI yardımcıdan; yalnız öğretmen adları ve
    -- etkinlik alanları çıkarılmış (onlar müdürün ekranında kalıyor).
    'siniflar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', k->'id', 'ad', k->'ad', 'seviye', k->'seviye',
               'ogrenci_sayisi', k->'ogrenci_sayisi', 'odev_sayisi', k->'odev_sayisi',
               'soru_toplami', k->'soru_toplami', 'gonderim_orani', k->'gonderim_orani',
               'ortalama', k->'ortalama') order by ord)
        from jsonb_array_elements(public._sinif_kart_ozetleri(
               array(select s.id from public.siniflar s where not s.arsiv and not s.ozel), null))
             with ordinality as t(k, ord)
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
    ), '[]'::jsonb)
  ) into v_sonuc;

  return v_sonuc;
end;
$$;

do $$
declare
  ad text;
begin
  if to_regprocedure('public.sinif_sil(text, uuid)') is null then
    raise exception '0069: önce 0068 çalıştırılmalı';
  end if;
  foreach ad in array array['mudur_paneli', 'okul_geneli'] loop
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = ad
                      and pg_get_functiondef(p.oid) like '%konu_verisi%'
                      and pg_get_functiondef(p.oid) like '%kontrol_edilen_soru%') then
      raise exception '0069: % konu nedenini döndürmüyor', ad;
    end if;
  end loop;
end $$;

select public._migration_kaydet('0069');
