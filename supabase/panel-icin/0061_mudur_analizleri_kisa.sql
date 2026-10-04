-- SEKİZ — 0061: müdür — PIN, soru sayıları, analizler, gelişim, öğrenci notları
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Açıklamalı tam sürüm: supabase/migrations/0061_mudur_analizleri.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Yedek)
-- 0060 ÇALIŞMIŞ OLMALI (müdür hesabı). Edge Function DEĞİŞMİYOR.
--
-- NE YAPIYOR:
--  1. Müdür kendi PIN'ini değiştirebilir (Müdür ekranı → PIN değiştir).
--     Değiştirebildiği TEK şey bu.
--  2. Müdür panosuna eklenenler: ödevlerin soru sayıları; şube, sınıf
--     seviyesi, öğretmen ve okul bazında bugüne kadar verilen toplam soru;
--     aylık gelişim (ortalama, gönderim oranı); okulun en eksik konuları.
--  3. Müdür sınıf sayfasında öğrencilerin bireysel notlarını görür
--     (ödev ödev puan, ortalama, yapılan/yapılmayan). Cevapları, öğretmen
--     yorumlarını ve mesajları GÖRMEZ; özel ders grupları ona kapalı.
--
-- Veri SİLİNMİYOR, tablo DEĞİŞMİYOR; yalnız fonksiyonlar.
--
-- Beklenen sonuç: en altta tek satırlık bir tablo (_migration_kaydet → 0061).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. MÜDÜR KENDİ PIN'İNİ DEĞİŞTİRİR
-- -----------------------------------------------------------------------------
create or replace function public.mudur_pin_degistir(p_token text, p_eski text, p_yeni text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id   uuid;
  mevcut text;
begin
  v_id := public._mudur(p_token);

  select pin_hash into mevcut from public.ogretmenler where id = v_id;

  if mevcut is null or p_eski is null or crypt(p_eski, mevcut) <> mevcut then
    raise exception 'Mevcut PIN doğru değil.' using errcode = '28000';
  end if;

  if p_yeni is null or length(p_yeni) < 6 then
    raise exception 'Yeni PIN en az 6 haneli olmalı.' using errcode = '22023';
  end if;

  -- Aynı PIN iki hesapta olursa giriş ilk eşleşene düşer (mudur_ekle).
  if exists (select 1 from public.ogretmenler g
              where g.id <> v_id and g.pin_hash is not null
                and crypt(p_yeni, g.pin_hash) = g.pin_hash) then
    raise exception 'Bu PIN başka bir hesapta kullanılıyor. Farklı bir PIN seçin.'
      using errcode = '22023';
  end if;

  update public.ogretmenler
     set pin_hash = crypt(p_yeni, gen_salt('bf', 10))
   where id = v_id;

  update public.oturumlar set iptal = true
   where rol = 'mudur'
     and ogretmen_id = v_id
     and not iptal
     and token_hash <> public._token_hash(p_token);

  perform public._denetim('mudur_pin_degistirildi', 'ogretmenler', v_id, public._aktor(v_id));

  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. MÜDÜR PANOSU — toplamlar, soru sayıları, aylık gelişim
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
begin
  v_id := public._mudur(p_token);

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
-- 3. SINIF NOT ÇİZELGESİ — öğrenci × ödev
--
-- Ödev sırası (son tarih, oluşturulma, kimlik) hem `odevler` dizisinde hem
-- her öğrencinin `puanlar` dizisinde AYNI: ekran iki diziyi sırayla
-- eşliyor.
-- -----------------------------------------------------------------------------
create or replace function public.sinif_not_cizelgesi(p_token text, p_sinif_id uuid)
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
begin
  v_okuyan := public._sinif_okuyucusu(p_token, p_sinif_id);

  select s.id, s.ad into v_sinif
    from public.siniflar s where s.id = p_sinif_id and not s.arsiv;
  if not found then
    raise exception 'Sınıf bulunamadı ya da arşivde.' using errcode = 'P0002';
  end if;

  v_yil_bas := make_date(
    case when extract(month from bugun_tr) >= 9 then extract(year from bugun_tr)::integer
         else extract(year from bugun_tr)::integer - 1 end, 9, 1);

  return jsonb_build_object(
    'sinif', jsonb_build_object(
      'id', v_sinif.id,
      'ad', v_sinif.ad,
      'ogretmenler', coalesce((
          select jsonb_agg(g.ad order by g.yonetici desc, g.ad)
            from public.ogretmen_siniflari os
            join public.ogretmenler g on g.id = os.ogretmen_id
           where os.sinif_id = p_sinif_id and g.aktif and not g.mudur
        ), '[]'::jsonb)),
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
       where d.sinif_id = p_sinif_id and d.yayinda
    ), '[]'::jsonb),
    'ogrenciler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id,
               'ad', o.ad,
               'ogrenci_no', o.ogrenci_no,
               -- ORTALAMA — `sinif_ogrenci_ozeti` (0051) ile birebir.
               'ortalama', (
                 select round(avg(coalesce(
                          (select coalesce(g.ogretmen_puan, g.puan)
                             from public.gonderimler g
                            where g.odev_id = d.id and g.ogrenci_id = o.id),
                          0)), 2)
                   from public.odevler d
                  where d.sinif_id = p_sinif_id
                    and d.yayinda
                    and d.son_tarih < bugun_tr
               ),
               'yapilan', (
                 select count(*)::integer from public.odevler d
                  where d.sinif_id = p_sinif_id and d.yayinda
                    and d.son_tarih < bugun_tr
                    and exists (select 1 from public.gonderimler g
                                 where g.odev_id = d.id and g.ogrenci_id = o.id)
               ),
               'yapilmayan', (
                 select count(*)::integer from public.odevler d
                  where d.sinif_id = p_sinif_id and d.yayinda
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
                  where d.sinif_id = p_sinif_id and d.yayinda
               ), '[]'::jsonb)
             )
             -- SINIF LİSTESİ SIRASI: okul numarası (0051 ile aynı).
             order by o.ogrenci_no is null, o.ogrenci_no, o.ad)
        from public.ogrenciler o
       where o.sinif_id = p_sinif_id and o.aktif
    ), '[]'::jsonb),
    -- SINIFIN AYLIK GELİŞİMİ — süresi dolmuş ödevler, aktif öğrenciler.
    'aylar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ay', a.ay,
               'odev_sayisi', (select count(*)::integer from public.odevler d
                                where d.sinif_id = p_sinif_id and d.yayinda
                                  and date_trunc('month', d.son_tarih)::date = a.ay),
               'ortalama', (
                 select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1)
                   from public.odevler d
                   join public.gonderimler g on g.odev_id = d.id
                   join public.ogrenciler o on o.id = g.ogrenci_id
                  where d.sinif_id = p_sinif_id and d.yayinda and d.son_tarih < bugun_tr
                    and date_trunc('month', d.son_tarih)::date = a.ay
                    and o.aktif and o.sinif_id = p_sinif_id
                    and coalesce(g.ogretmen_puan, g.puan) is not null),
               'gonderim_orani', (
                 select round(100.0 * count(g.id) / nullif(
                          (select count(*) from public.odevler d2
                            where d2.sinif_id = p_sinif_id and d2.yayinda
                              and d2.son_tarih < bugun_tr
                              and date_trunc('month', d2.son_tarih)::date = a.ay)
                          * (select count(*) from public.ogrenciler o2
                              where o2.sinif_id = p_sinif_id and o2.aktif), 0))
                   from public.odevler d
                   join public.gonderimler g on g.odev_id = d.id
                   join public.ogrenciler o on o.id = g.ogrenci_id
                  where d.sinif_id = p_sinif_id and d.yayinda and d.son_tarih < bugun_tr
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
-- 4. YETKİLER
-- -----------------------------------------------------------------------------
revoke all on function public.mudur_pin_degistir(text, text, text) from public, anon, authenticated;
grant execute on function public.mudur_pin_degistir(text, text, text) to anon;

revoke all on function public.mudur_paneli(text) from public, anon, authenticated;
grant execute on function public.mudur_paneli(text) to anon, authenticated;

revoke all on function public.sinif_not_cizelgesi(text, uuid) from public, anon, authenticated;
grant execute on function public.sinif_not_cizelgesi(text, uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. KENDİ KENDİNİ DENETLEME
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public._mudur(text)') is null then
    raise exception '0061: önce 0060 çalıştırılmalı (_mudur yok)';
  end if;
  if pg_get_functiondef('public.sinif_not_cizelgesi(text, uuid)'::regprocedure)
       not like '%_sinif_okuyucusu(%' then
    raise exception '0061: sinif_not_cizelgesi _sinif_okuyucusu kullanmıyor';
  end if;
  if pg_get_functiondef('public.mudur_pin_degistir(text, text, text)'::regprocedure)
       not like '%_mudur(p_token)%' then
    raise exception '0061: mudur_pin_degistir _mudur kapısından geçmiyor';
  end if;
  if pg_get_functiondef('public.mudur_paneli(text)'::regprocedure)
       not like '%_mudur(p_token)%' then
    raise exception '0061: mudur_paneli _mudur kapısından geçmiyor';
  end if;
  if not has_function_privilege('anon', 'public.sinif_not_cizelgesi(text, uuid)', 'execute')
     or not has_function_privilege('anon', 'public.mudur_pin_degistir(text, text, text)', 'execute') then
    raise exception '0061: yeni uçlar istemciye açılmadı';
  end if;
end $$;

select public._migration_kaydet('0061');
