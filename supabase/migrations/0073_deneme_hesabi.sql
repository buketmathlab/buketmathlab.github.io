-- =============================================================================
-- 0073 — DENEME ÖĞRENCİ VE DENEME VELİ HESABI
--
-- Öğretmenin (platform sahibi) isteği: "Bir tane deneme yapmak için gerçek
-- olmayan bir öğrenci için öğrenci hesabı ve aynı şekilde veli hesabı olsun.
-- Gerçek öğrenci ve velilerin tüm özellikleri birebir olsun. Gerekirse ödev
-- de gönderebileyim."
--
-- BİREBİR: deneme öğrenci GERÇEK bir sınıfta, gerçek bir okul öğrencisi
-- gibi duruyor (kodu, veli kodu, ödevleri, gönderimi, puanı, mesajı,
-- onamı). Öğrenci ve veli ekranlarının hiçbiri değişmiyor.
--
-- HİÇBİR SAYIYA GİRMİYOR: `ogrenciler.deneme`. Sınıf mevcudu, gönderim
-- oranı, ortalamalar, kıyas, konu analizi, Genel, müdür paneli, onam
-- dökümü, okul bilgilendirmesi ve e-okul eşitlemesi deneme
-- öğrenciyi saymıyor. Kopyalanan her gövdede TEK değişiklik bu filtre:
--   öğrenci sayan yerde      `x.aktif`  →  `(x.aktif and not x.deneme)`
--   gönderim sayan yerde     `and not public._deneme_mi(g.ogrenci_id)`
-- Listelerde (öğrenciler, veliler, gönderimler) yalnız platform sahibi
-- görüyor: `(x.aktif and (not x.deneme or public._deneme_gorur(v_ogretmen)))`.
--
-- SIFIRLAMA = SİL + AYNI KODLARLA YENİDEN KUR. Gönderim satırını silmek
-- yetmiyordu: depodaki eski çözüm fotoğrafı SQL'den silinemiyor ve aynı
-- yola yeniden gönderimde istemci eskiyi kullanıyor (0056 notu). Yeni
-- öğrenci kimliği yeni yollar demek; kodlar aynı kaldığı için öğretmen
-- yeniden yazmak zorunda değil.
--
-- Bu dosya tekrar çalıştırılabilir. Ön koşul: 0072.
-- =============================================================================

alter table public.ogrenciler add column if not exists deneme boolean not null default false;

-- Tek deneme öğrenci: ikincisi karışıklık üretirdi.
create unique index if not exists ogrenciler_tek_deneme on public.ogrenciler (deneme) where deneme;

comment on column public.ogrenciler.deneme is
  'Platform sahibinin deneme hesabı (0073). Öğrenci ve veli ekranlarında '
  'gerçek öğrenci gibi; hiçbir sayıya, listeye (sahip dışında) ve eşitlemeye girmez.';

-- -----------------------------------------------------------------------------
-- 1. Yardımcılar
-- -----------------------------------------------------------------------------
create or replace function public._deneme_mi(p_ogrenci_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select coalesce((select o.deneme from public.ogrenciler o where o.id = p_ogrenci_id), false);
$$;

-- Deneme öğrenciyi listelerde kim görür: yalnız platform sahibi.
create or replace function public._deneme_gorur(p_ogretmen uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (select 1 from public.ogretmenler g where g.id = p_ogretmen and g.yonetici);
$$;

-- -----------------------------------------------------------------------------
-- 2. Uçlar — hepsi yalnız platform sahibi (`_yonetici`)
-- -----------------------------------------------------------------------------

-- Durum: hesap var mı, hangi sınıfta, kodları. Kodlar giriş için
-- öğretmenin elinde olmalı; deneme hesabı gerçek bir kişiye ait değil.
create or replace function public.deneme_hesabi(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
begin
  perform public._yonetici(p_token);
  select x.id, x.sinif_id, s.ad as sinif into o
    from public.ogrenciler x join public.siniflar s on s.id = x.sinif_id
   where x.deneme;
  if not found then
    return jsonb_build_object('var', false);
  end if;
  return jsonb_build_object(
    'var', true, 'id', o.id, 'sinif_id', o.sinif_id, 'sinif', o.sinif,
    'ogrenci_kodu', (select k.kod from public.giris_kodlari k where k.ogrenci_id = o.id and k.rol = 'ogrenci'),
    'veli_kodu',    (select k.kod from public.giris_kodlari k where k.ogrenci_id = o.id and k.rol = 'veli'));
end;
$$;

-- Deneme sınıfı: arşivde olmayan, özel ders olmayan bir okul sınıfı.
create or replace function public._deneme_sinifi_gecerli(p_sinif uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if p_sinif is null or not exists (
       select 1 from public.siniflar s where s.id = p_sinif and not s.arsiv and not s.ozel) then
    raise exception 'Deneme hesabı için arşivde olmayan bir okul sınıfı seçin.' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.deneme_hesabi_olustur(p_token text, p_sinif uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid;
  yeni uuid;
begin
  v_id := public._yonetici(p_token);
  perform public._deneme_sinifi_gecerli(p_sinif);
  if exists (select 1 from public.ogrenciler where deneme) then
    raise exception 'Deneme hesabı zaten var.' using errcode = '23505';
  end if;

  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, deneme)
  values ('Deneme Öğrenci', 'okul', p_sinif, v_id, true)
  returning id into yeni;
  insert into public.giris_kodlari (kod, ogrenci_id, rol)
  values (public._yeni_kod(), yeni, 'ogrenci'), (public._yeni_kod(), yeni, 'veli');

  perform public._denetim('deneme_hesabi_olusturuldu', 'ogrenciler', yeni, public._aktor(v_id),
                          null, jsonb_build_object('sinif_id', p_sinif));
  return public.deneme_hesabi(p_token);
end;
$$;

create or replace function public.deneme_sinifi_degistir(p_token text, p_sinif uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid;
  o record;
begin
  v_id := public._yonetici(p_token);
  perform public._deneme_sinifi_gecerli(p_sinif);
  select id, sinif_id into o from public.ogrenciler where deneme;
  if not found then
    raise exception 'Deneme hesabı yok.' using errcode = 'P0002';
  end if;
  update public.ogrenciler set sinif_id = p_sinif, sinif_giris = null where id = o.id;
  perform public._denetim('deneme_sinifi_degisti', 'ogrenciler', o.id, public._aktor(v_id),
                          jsonb_build_object('sinif_id', o.sinif_id), jsonb_build_object('sinif_id', p_sinif));
  return public.deneme_hesabi(p_token);
end;
$$;

-- Sil + aynı sınıfta, AYNI kodlarla yeniden kur (gerekçe dosya başında).
create or replace function public.deneme_sifirla(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid;
  o record;
  k_ogr text;
  k_veli text;
  yeni uuid;
begin
  v_id := public._yonetici(p_token);
  select id, sinif_id into o from public.ogrenciler where deneme;
  if not found then
    raise exception 'Deneme hesabı yok.' using errcode = 'P0002';
  end if;
  select kod into k_ogr  from public.giris_kodlari where ogrenci_id = o.id and rol = 'ogrenci';
  select kod into k_veli from public.giris_kodlari where ogrenci_id = o.id and rol = 'veli';

  -- Gönderimler, mesajlar, okundu, onam, duyuru okundu, oturumlar ve
  -- kodlar ON DELETE CASCADE ile gidiyor. YALNIZ deneme satırı.
  delete from public.ogrenciler where id = o.id and deneme;

  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, deneme)
  values ('Deneme Öğrenci', 'okul', o.sinif_id, v_id, true)
  returning id into yeni;
  insert into public.giris_kodlari (kod, ogrenci_id, rol)
  values (coalesce(k_ogr, public._yeni_kod()), yeni, 'ogrenci'),
         (coalesce(k_veli, public._yeni_kod()), yeni, 'veli');

  perform public._denetim('deneme_hesabi_sifirlandi', 'ogrenciler', yeni, public._aktor(v_id),
                          jsonb_build_object('eski_id', o.id), jsonb_build_object('sinif_id', o.sinif_id));
  return public.deneme_hesabi(p_token);
end;
$$;

create or replace function public.deneme_hesabi_sil(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid;
  o record;
begin
  v_id := public._yonetici(p_token);
  select id into o from public.ogrenciler where deneme;
  if found then
    delete from public.ogrenciler where id = o.id and deneme;
    perform public._denetim('deneme_hesabi_silindi', 'ogrenciler', o.id, public._aktor(v_id));
  end if;
  return jsonb_build_object('var', false);
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Sayılardan ve listelerden dışlama — kopyalanan gövdeler
--    (her birinde tek değişiklik deneme filtresi; kopya kaynağı başlıkta)
-- -----------------------------------------------------------------------------
-- _sinif_kart_ozetleri — kopya: 0064_sinif_listesi_esas.sql
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
      select o.id, o.sinif_id, o.sinif_giris
        from public.ogrenciler o
        join sinif s on s.id = o.sinif_id
       where (o.aktif and not o.deneme)
    ),
    odev as (
      select d.id, d.sinif_id, d.soru_sayisi, d.created_at, d.son_tarih,
             d.son_tarih < bugun as doldu,
             (select count(*) from ogr o where o.sinif_id = d.sinif_id
                 and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)) as mevcut
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
                  and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
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

-- okul_geneli — kopya: 0070_konu_nedeni_ayrinti.sql
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
     where (o.aktif and not o.deneme)
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
                 -- 0070: süresine bakmadan konusu girilmiş test — "konu
                 -- girdim ama 'girilmemiş' yazıyor" yanılgısı için.
                 'konulu_test', (select count(*) from odev d
                                   join public.odevler dd on dd.id = d.id
                                  where d.seviye = v.seviye and d.tur = 'test'
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

-- mudur_paneli — kopya: 0070_konu_nedeni_ayrinti.sql
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
     where (o.aktif and not o.deneme)
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
                 -- 0070: süresine bakmadan konusu girilmiş test — "konu
                 -- girdim ama 'girilmemiş' yazıyor" yanılgısı için.
                 'konulu_test', (select count(*) from odev d
                                   join public.odevler dd on dd.id = d.id
                                  where d.seviye = v.seviye and d.tur = 'test'
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

-- sinif_analizi — kopya: 0060_mudur_hesabi.sql
create or replace function public.sinif_analizi(
  p_token      text,
  p_sinif_id   uuid,
  p_baslangic  date default null,
  p_bitis      date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun_tr    date := (now() at time zone 'Europe/Istanbul')::date;
  v_ogretmen  uuid;
  v_sinif     record;
  v_bas       date;
  v_bit       date;
  v_varsayilan boolean;
  v_mevcut    integer;
  v_haftalar  jsonb;
  v_aylar     jsonb;
  v_ozet      jsonb;
begin
  -- 0060: öğretmen kendi sınıfını, müdür (salt okuma) özel ders dışındaki
  -- her sınıfı görür. Kural tek yerde: `_sinif_okuyucusu`.
  v_ogretmen := public._sinif_okuyucusu(p_token, p_sinif_id);

  select s.id, s.ad into v_sinif from public.siniflar s where s.id = p_sinif_id;
  if not found then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;

  -- VARSAYILAN ARALIK: son 12 hafta. Öğretmenin isteği "otomatik gelsin"
  -- idi; ekran açılır açılmaz bir şey göstermesi için bir varsayılan
  -- gerekiyor. Dönem analizi için tarihleri kendisi seçiyor.
  v_varsayilan := p_baslangic is null and p_bitis is null;
  v_bit := coalesce(p_bitis, bugun_tr);
  v_bas := coalesce(p_baslangic, (date_trunc('week', bugun_tr) - interval '11 weeks')::date);

  if v_bas > v_bit then
    raise exception 'Başlangıç tarihi bitişten sonra olamaz.' using errcode = '22023';
  end if;

  select count(*)::integer into v_mevcut
  from public.ogrenciler o where o.sinif_id = p_sinif_id and (o.aktif and not o.deneme);

  -- ---------------------------------------------------------------------------
  -- HAFTALIK
  --
  -- `date_trunc('week', …)` PostgreSQL'de PAZARTESİ'den başlıyor — Türkiye'de
  -- okul haftası da öyle.
  -- ---------------------------------------------------------------------------
  with odev as (
    select d.id, d.tur, d.son_tarih,
           date_trunc('week',  d.son_tarih)::date as kova
      from public.odevler d
     where d.sinif_id = p_sinif_id
       and d.yayinda
       and d.son_tarih < bugun_tr
       and d.son_tarih between v_bas and v_bit
  ),
  puan as (
    select o.kova, coalesce(g.ogretmen_puan, g.puan) as p
      from odev o
      join public.gonderimler g on g.odev_id = o.id
      join public.ogrenciler  k on k.id = g.ogrenci_id
     where k.sinif_id = p_sinif_id and (k.aktif and not k.deneme)
       and coalesce(g.ogretmen_puan, g.puan) is not null
  ),
  konu as (
    select o.kova, e->>'konu' as konu,
           sum((e->>'toplam')::integer)::integer as toplam,
           sum((e->>'dogru')::integer)::integer  as dogru
      from odev o
      join public.odevler     d on d.id = o.id
      join public.gonderimler g on g.odev_id = d.id
      join public.ogrenciler  k on k.id = g.ogrenci_id
      cross join lateral jsonb_array_elements(
        public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
      ) e
     where k.sinif_id = p_sinif_id and (k.aktif and not k.deneme)
       and d.tur = 'test'
     group by o.kova, e->>'konu'
  ),
  kovalar as (
    select kova,
           count(*)::integer as odev_sayisi,
           count(*) filter (where tur = 'test')::integer as test_sayisi
      from odev group by kova
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'baslangic', b.kova,
           'bitis', (b.kova + 6),
           'odev_sayisi', b.odev_sayisi,
           'test_sayisi', b.test_sayisi,
           'gonderim', (select count(*)::integer from puan p where p.kova = b.kova),
           'ortalama', (select round(avg(p.p), 1) from puan p where p.kova = b.kova),
           'konular', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'konu', t.konu, 'toplam', t.toplam, 'dogru', t.dogru,
                      'oran', round(100.0 * t.dogru / t.toplam),
                      'durum', public._konu_durumu(t.toplam, t.dogru))
                    order by (t.toplam - t.dogru) desc, t.konu)
               from konu t where t.kova = b.kova), '[]'::jsonb)
         ) order by b.kova desc), '[]'::jsonb)
    into v_haftalar
    from kovalar b;

  -- ---------------------------------------------------------------------------
  -- AYLIK — haftalığın aynısı, yalnız kova `month`
  -- ---------------------------------------------------------------------------
  with odev as (
    select d.id, d.tur, date_trunc('month', d.son_tarih)::date as kova
      from public.odevler d
     where d.sinif_id = p_sinif_id and d.yayinda
       and d.son_tarih < bugun_tr
       and d.son_tarih between v_bas and v_bit
  ),
  puan as (
    select o.kova, coalesce(g.ogretmen_puan, g.puan) as p
      from odev o
      join public.gonderimler g on g.odev_id = o.id
      join public.ogrenciler  k on k.id = g.ogrenci_id
     where k.sinif_id = p_sinif_id and (k.aktif and not k.deneme)
       and coalesce(g.ogretmen_puan, g.puan) is not null
  ),
  konu as (
    select o.kova, e->>'konu' as konu,
           sum((e->>'toplam')::integer)::integer as toplam,
           sum((e->>'dogru')::integer)::integer  as dogru
      from odev o
      join public.odevler     d on d.id = o.id
      join public.gonderimler g on g.odev_id = d.id
      join public.ogrenciler  k on k.id = g.ogrenci_id
      cross join lateral jsonb_array_elements(
        public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
      ) e
     where k.sinif_id = p_sinif_id and (k.aktif and not k.deneme) and d.tur = 'test'
     group by o.kova, e->>'konu'
  ),
  kovalar as (
    select kova, count(*)::integer as odev_sayisi,
           count(*) filter (where tur = 'test')::integer as test_sayisi
      from odev group by kova
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'ay', b.kova,
           'odev_sayisi', b.odev_sayisi,
           'test_sayisi', b.test_sayisi,
           'gonderim', (select count(*)::integer from puan p where p.kova = b.kova),
           'ortalama', (select round(avg(p.p), 1) from puan p where p.kova = b.kova),
           'konular', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'konu', t.konu, 'toplam', t.toplam, 'dogru', t.dogru,
                      'oran', round(100.0 * t.dogru / t.toplam),
                      'durum', public._konu_durumu(t.toplam, t.dogru))
                    order by (t.toplam - t.dogru) desc, t.konu)
               from konu t where t.kova = b.kova), '[]'::jsonb)
         ) order by b.kova desc), '[]'::jsonb)
    into v_aylar
    from kovalar b;

  -- ---------------------------------------------------------------------------
  -- ARALIĞIN TAMAMI — "dönem analizi" bu
  --
  -- Öğretmen hem yüzde çizgisi hem "en çok eksik üç konu" istedi; ikisi
  -- de burada. `en_eksik_uc` sıralamaya, `iyi`/`calisilmali` çizgiye
  -- dayanıyor — biri ötekinin yerine geçmiyor.
  -- ---------------------------------------------------------------------------
  with odev as (
    select d.id, d.tur
      from public.odevler d
     where d.sinif_id = p_sinif_id and d.yayinda
       and d.son_tarih < bugun_tr
       and d.son_tarih between v_bas and v_bit
  ),
  puan as (
    select coalesce(g.ogretmen_puan, g.puan) as p
      from odev o
      join public.gonderimler g on g.odev_id = o.id
      join public.ogrenciler  k on k.id = g.ogrenci_id
     where k.sinif_id = p_sinif_id and (k.aktif and not k.deneme)
       and coalesce(g.ogretmen_puan, g.puan) is not null
  ),
  konu as (
    select e->>'konu' as konu,
           sum((e->>'toplam')::integer)::integer as toplam,
           sum((e->>'dogru')::integer)::integer  as dogru
      from odev o
      join public.odevler     d on d.id = o.id
      join public.gonderimler g on g.odev_id = d.id
      join public.ogrenciler  k on k.id = g.ogrenci_id
      cross join lateral jsonb_array_elements(
        public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
      ) e
     where k.sinif_id = p_sinif_id and (k.aktif and not k.deneme) and d.tur = 'test'
     group by e->>'konu'
  ),
  damgali as (
    select konu, toplam, dogru,
           round(100.0 * dogru / toplam) as oran,
           public._konu_durumu(toplam, dogru) as durum
      from konu
  )
  select jsonb_build_object(
           'odev_sayisi', (select count(*)::integer from odev),
           'test_sayisi', (select count(*) filter (where tur = 'test')::integer from odev),
           'gonderim', (select count(*)::integer from puan),
           'ortalama', (select round(avg(p), 1) from puan),
           'konular', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'konu', konu, 'toplam', toplam, 'dogru', dogru,
                      'oran', oran, 'durum', durum)
                    order by (toplam - dogru) desc, konu) from damgali), '[]'::jsonb),
           'iyi', coalesce((
             select jsonb_agg(konu order by oran desc, konu)
               from damgali where durum = 'iyi'), '[]'::jsonb),
           'calisilmali', coalesce((
             select jsonb_agg(konu order by oran, konu)
               from damgali where durum = 'calisilmali'), '[]'::jsonb),
           'en_eksik_uc', coalesce((
             select jsonb_agg(konu order by eksik desc, konu)
               from (select konu, (toplam - dogru) as eksik from damgali
                      where durum <> 'az_veri'
                      order by eksik desc, konu limit 3) u), '[]'::jsonb)
         )
    into v_ozet;

  return jsonb_build_object(
    'sinif', jsonb_build_object('id', v_sinif.id, 'ad', v_sinif.ad),
    'aralik', jsonb_build_object(
      'baslangic', v_bas, 'bitis', v_bit, 'varsayilan', v_varsayilan
    ),
    -- Eşikler yanıtta: ekran "iyi" derken hangi çizgiyi kastettiğini
    -- yazabilsin. Çizgiyi arayüze gömseydik sunucuyla ayrışabilirdi —
    -- burada da elle yazsaydık damgayla ayrışırdı. Damganın kullandığı
    -- yardımcının ta kendisi dönüyor.
    'esikler', public._konu_esikleri(),
    'mevcut', v_mevcut,
    'haftalar', v_haftalar,
    'aylar', v_aylar,
    'ozet', v_ozet
  );
end;
$$;

-- sinif_not_cizelgesi — kopya: 0064_sinif_listesi_esas.sql
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
                where o.sinif_id = p_sinif_id and (o.aktif and not o.deneme)),
    'odevler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', d.id,
               'baslik', d.baslik,
               'tur', d.tur,
               'ogretmen', (select g.ad from public.ogretmenler g where g.id = d.ogretmen_id),
               'soru_sayisi', d.soru_sayisi,
               -- 0063: müdür ödevi ve cevap anahtarını görebiliyor.
               'odev_yolu', d.odev_url,
               'anahtar_yolu', d.anahtar_url,
               'cevap_anahtari', d.cevap_anahtari,
               'son_tarih', d.son_tarih,
               'sure_doldu', d.son_tarih < bugun_tr,
               -- 0064: SINIF LİSTESİ ESAS. Yalnız bugün sınıfta olan ve ödevin
               -- son tarihinde sınıfa gelmiş öğrenciler sayılıyor.
               'beklenen', (select count(*)::integer from public.ogrenciler o
                             where (o.aktif and not o.deneme) and o.sinif_id = p_sinif_id
                               and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)),
               'gonderim', (select count(*)::integer from public.gonderimler g
                             join public.ogrenciler o on o.id = g.ogrenci_id
                            where g.odev_id = d.id and (o.aktif and not o.deneme) and o.sinif_id = p_sinif_id
                              and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)),
               'ortalama', (select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1)
                              from public.gonderimler g
                              join public.ogrenciler o on o.id = g.ogrenci_id
                             where g.odev_id = d.id and (o.aktif and not o.deneme) and o.sinif_id = p_sinif_id
                               and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
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
               'yapmadi', i.beklenen - i.yapti,
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
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
               ),
               'yapilan', (
                 select count(*)::integer from public.odevler d
                  where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id)) and d.yayinda
                    and d.son_tarih < bugun_tr
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
                    and exists (select 1 from public.gonderimler g
                                 where g.odev_id = d.id and g.ogrenci_id = o.id)
               ),
               'yapilmayan', (
                 select count(*)::integer from public.odevler d
                  where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id)) and d.yayinda
                    and d.son_tarih < bugun_tr
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
                    and not exists (select 1 from public.gonderimler g
                                     where g.odev_id = d.id and g.ogrenci_id = o.id)
               ),
               'puanlar', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'odev_id', d.id,
                          'puan', g.p,
                          'durum', case
                                     when g.var then 'gonderdi'
                                     -- 0064: sınıfa gelmeden önce son tarihi dolan ödev.
                                     when not public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
                                       then 'kapsam_disi'
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
            count(*)::integer as beklenen,
            count(g.id)::integer as yapti,
            round(avg(coalesce(g.ogretmen_puan, g.puan))
                  filter (where g.id is not null), 1) as ortalama_yapan,
            case when count(*) > 0 then
              round(sum(coalesce(g.ogretmen_puan, g.puan, 0)) / count(*), 1)
            end as ortalama_tum
          from public.odevler d
          left join public.gonderimler g
            on g.odev_id = d.id and g.ogrenci_id = o.id
          where d.sinif_id = p_sinif_id
            and d.yayinda
            and d.son_tarih < bugun_tr
            and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id))
            and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
        ) i
       where o.sinif_id = p_sinif_id and (o.aktif and not o.deneme)
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
                    and (o.aktif and not o.deneme) and o.sinif_id = p_sinif_id
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
                    and coalesce(g.ogretmen_puan, g.puan) is not null),
               'gonderim_orani', (
                 -- 0064: payda öğrenci × ödev ÇİFTLERİ; sınıfa sonradan gelenin
                 -- gelmeden önceki ödevi paydada yok.
                 select round(100.0 * count(g.id) / nullif(
                          (select count(*) from public.odevler d2
                             join public.ogrenciler o2
                               on o2.sinif_id = p_sinif_id and (o2.aktif and not o2.deneme)
                              and public._odev_ogrenciye_dusar(o2.sinif_giris, d2.son_tarih, d2.created_at)
                            where d2.sinif_id = p_sinif_id
                              and (v_hepsi or public._odeve_erisir(v_okuyan, d2.ogretmen_id, d2.sinif_id)) and d2.yayinda
                              and d2.son_tarih < bugun_tr
                              and date_trunc('month', d2.son_tarih)::date = a.ay), 0))
                   from public.odevler d
                   join public.gonderimler g on g.odev_id = d.id
                   join public.ogrenciler o on o.id = g.ogrenci_id
                  where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id)) and d.yayinda and d.son_tarih < bugun_tr
                    and date_trunc('month', d.son_tarih)::date = a.ay
                    and (o.aktif and not o.deneme) and o.sinif_id = p_sinif_id
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at))
             ) order by a.ay)
        from (select generate_series(v_yil_bas, date_trunc('month', bugun_tr)::date,
                                     interval '1 month')::date as ay) a
    ), '[]'::jsonb)
  );
end;
$$;

-- sinif_ogrenci_ozeti — kopya: 0064_sinif_listesi_esas.sql
create or replace function public.sinif_ogrenci_ozeti(p_token text, p_sinif_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun_tr date := (now() at time zone 'Europe/Istanbul')::date;
  v_ogretmen uuid;
  v_sinif record;
begin
  v_ogretmen := public._ogretmen(p_token);
  if not public._ogretmenin_sinifi(v_ogretmen, p_sinif_id) then
    raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
  end if;

  select s.id, s.ad, s.ozel into v_sinif
    from public.siniflar s where s.id = p_sinif_id and not s.arsiv;
  if not found then
    raise exception 'Sınıf bulunamadı ya da arşivde.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'sinif', jsonb_build_object('id', v_sinif.id, 'ad', v_sinif.ad, 'ozel', v_sinif.ozel),
    'ogrenciler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id,
               'ad', o.ad,
               'ogrenci_no', o.ogrenci_no,
               'tur', o.tur,

               -- ORTALAMA — öğretmenin 1. kararı (0051).
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
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
               ),

               -- SÜRESİ DOLMUŞ ÖDEV SAYISI — ortalamanın paydası.
               'odev_sayisi', (
                 select count(*)::integer from public.odevler d
                  where d.sinif_id = p_sinif_id and d.yayinda
                    and d.son_tarih < bugun_tr
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
               ),

               -- YAPILAN (0052) — bu ödevlerin kaçında GÖNDERİM VAR.
               -- Puanına bakılmıyor: sıfır alan da yapmıştır.
               'yapilan', (
                 select count(*)::integer from public.odevler d
                  where d.sinif_id = p_sinif_id and d.yayinda
                    and d.son_tarih < bugun_tr
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
                    and exists (select 1 from public.gonderimler g
                                 where g.odev_id = d.id and g.ogrenci_id = o.id)
               ),

               -- YAPILMAYAN (0052) — aynı kümenin geri kalanı.
               'yapilmayan', (
                 select count(*)::integer from public.odevler d
                  where d.sinif_id = p_sinif_id and d.yayinda
                    and d.son_tarih < bugun_tr
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
                    and not exists (select 1 from public.gonderimler g
                                     where g.odev_id = d.id and g.ogrenci_id = o.id)
               ),

               -- EKSİK KONULAR (0053) — en fazla 3, en eksikten başlayarak.
               -- Ölçüt ve alt sınır 0051'den değişmedi; yalnız `limit 1`
               -- `limit 3` oldu ve sonuç bir DİZİ.
               'eksik_konular', coalesce((
                 select jsonb_agg(t.konu order by t.eksik desc, t.konu)
                   from (
                     select e->>'konu' as konu,
                            sum((e->>'toplam')::integer) as toplam,
                            sum((e->>'dogru')::integer)  as dogru,
                            sum((e->>'toplam')::integer) - sum((e->>'dogru')::integer)
                              as eksik
                       from public.odevler d
                       join public.gonderimler g
                         on g.odev_id = d.id and g.ogrenci_id = o.id
                       cross join lateral jsonb_array_elements(
                         public._konu_analizi(d.konular, d.cevap_anahtari,
                                              g.cevaplar, d.soru_sayisi)
                       ) e
                      where d.sinif_id = p_sinif_id
                        and d.yayinda
                        and d.son_tarih < bugun_tr
                        and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
                        and d.tur = 'test'
                      group by e->>'konu'
                     having sum((e->>'toplam')::integer) >= 5
                        and sum((e->>'toplam')::integer) - sum((e->>'dogru')::integer) > 0
                      order by sum((e->>'toplam')::integer) - sum((e->>'dogru')::integer) desc,
                               e->>'konu'
                      limit 3
                   ) t
               ), '[]'::jsonb)
             )
             -- SINIF LİSTESİ SIRASI (öğretmenin isteği): okul numarası.
             order by o.ogrenci_no is null, o.ogrenci_no, o.ad)
      from public.ogrenciler o
      where o.sinif_id = p_sinif_id and (o.aktif and not o.deneme)
    ), '[]'::jsonb)
  );
end;
$$;

-- konu_karnesi — kopya: 0063_ortak_sinif_sayfasi.sql
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
      from public.ogrenciler g where g.sinif_id = v_sinif_id and (g.aktif and not g.deneme);
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
                   else k.sinif_id = v_sinif_id and (k.aktif and not k.deneme) end
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
                   else k.sinif_id = v_sinif_id and (k.aktif and not k.deneme) end
      ) i
      where d.sinif_id = v_sinif_id
        and d.yayinda
        and d.son_tarih < bugun_tr
    ), '[]'::jsonb)
  );
end;
$$;

-- _odev_kiyasi — kopya: 0064_sinif_listesi_esas.sql
create or replace function public._odev_kiyasi(p_odev_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  d record;
  v_seviye smallint;
  v_ozel boolean;
  v_sinif_ort numeric;
  v_sinif_adet integer;
  v_seviye_ort numeric;
  v_seviye_adet integer;
  v_sube_adet integer;
begin
  select * into d from public.odevler where id = p_odev_id and yayinda;
  if not found then
    return jsonb_build_object('durum', 'kiyas_yok');
  end if;

  select s.seviye, s.ozel into v_seviye, v_ozel
    from public.siniflar s where s.id = d.sinif_id;

  -- Özel ders grubunda sınıf ortalamasının anlamı yok (bkz. başlık).
  if v_ozel then
    return jsonb_build_object('durum', 'kiyas_yok');
  end if;

  if d.son_tarih >= (now() at time zone 'Europe/Istanbul')::date then
    return jsonb_build_object('durum', 'sure_dolmadi');
  end if;

  -- KENDİ SINIFI
  select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1), count(*)
    into v_sinif_ort, v_sinif_adet
    from public.gonderimler g
    -- 0064: SINIF LİSTESİ ESAS — giden öğrencinin puanı sınıf ortalamasında yok.
    join public.ogrenciler k on k.id = g.ogrenci_id
                            and (k.aktif and not k.deneme) and k.sinif_id = d.sinif_id
                            and public._odev_ogrenciye_dusar(k.sinif_giris, d.son_tarih, d.created_at)
   where g.odev_id = d.id
     and coalesce(g.ogretmen_puan, g.puan) is not null;

  -- SEVİYE — öğretmenin üç koşulu. Kendi ödevi de dâhil; "tüm 9'lar"
  -- ortalaması kendi sınıfını dışarıda bırakırsa o sayı gerçeği
  -- göstermez.
  select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1),
         count(*), count(distinct d2.sinif_id)
    into v_seviye_ort, v_seviye_adet, v_sube_adet
    from public.odevler d2
    join public.siniflar s2 on s2.id = d2.sinif_id
    join public.gonderimler g on g.odev_id = d2.id
    join public.ogrenciler k on k.id = g.ogrenci_id
                            and (k.aktif and not k.deneme) and k.sinif_id = d2.sinif_id
                            and public._odev_ogrenciye_dusar(k.sinif_giris, d2.son_tarih, d2.created_at)
   where d2.yayinda
     and btrim(d2.baslik) = btrim(d.baslik)
     and d2.created_at::date = d.created_at::date
     and s2.seviye = v_seviye
     and not s2.ozel
     and coalesce(g.ogretmen_puan, g.puan) is not null;

  -- TESLİM SAYISI GÖNDERİLMİYOR — öğretmenin kararı: "Teslim sayısı
  -- veliye ya da öğrenciye gösterilmesin."
  --
  -- EKRANDAN GİZLEMEK YETMEZ, YANITTAN DA ÇIKIYOR. Bu deponun kuralı
  -- (Part XXI): göstermediğin şeyi göndermezsin. Sayı yanıtta dursa
  -- tarayıcının geliştirici araçlarını açan herkes onu okurdu; "ekranda
  -- yok" demek "kimse göremez" demek değil. Ödeme bilgisinde ve cevap
  -- anahtarında verilen kararın aynısı.
  --
  -- HESAP YİNE YAPILIYOR (`v_sinif_adet`, `v_seviye_adet`): bir gün alt
  -- sınır kararı değişirse dönülecek yer belli olsun. Sadece dışarı
  -- çıkmıyor.
  return jsonb_build_object(
    'durum', 'hazir',
    'sinif', jsonb_build_object(
      'ad',      (select s.ad from public.siniflar s where s.id = d.sinif_id),
      'ortalama', v_sinif_ort
    ),
    -- Kardeş şube yoksa (yalnız kendi sınıfına verilmiş) bu alan null
    -- ve ekran o satırı hiç çizmiyor. Öğretmenin kuralı: "diğer şubelere
    -- verilmemişse sadece ödevin verildiği sınıf ortalaması alınsın."
    --
    -- `v_sube_adet` de gönderilmiyor: ekranda görünmüyor, yalnız bu
    -- koşulu kuruyor.
    'seviye', case when v_sube_adet > 1 then jsonb_build_object(
      'ad',       v_seviye::text || '. sınıflar',
      'ortalama', v_seviye_ort
    ) else null end
  );
end;
$$;

-- ogretmen_panosu — kopya: 0064_sinif_listesi_esas.sql
create or replace function public.ogretmen_panosu(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun date := current_date;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);

  return jsonb_build_object(
    'ogrenci_sayisi', (select count(*) from public.ogrenciler o
                        where (o.aktif and not o.deneme) and not public._sinif_arsivde(o.sinif_id)
                          and public._ogretmenin_ogrencisi(v_ogretmen, o.id)),
    'odev_verilen_ogrenci', (
      select count(*)
      from public.ogrenciler o
      where (o.aktif and not o.deneme)
        and not public._sinif_arsivde(o.sinif_id)
        and public._ogretmenin_ogrencisi(v_ogretmen, o.id)
        and exists (select 1 from public.odevler d
                     where d.sinif_id = o.sinif_id and d.yayinda
                       and public._odeve_erisir(v_ogretmen, d.ogretmen_id, d.sinif_id))
    ),
    'acik_odev', (select count(*) from public.odevler d
                   where d.yayinda and d.son_tarih >= bugun
                     and public._odeve_erisir(v_ogretmen, d.ogretmen_id, d.sinif_id)
                     and not public._sinif_arsivde(d.sinif_id)),
    'bekleyen_degerlendirme', (select count(*) from public.gonderimler g
                                join public.odevler o on o.id = g.odev_id
                               where o.tur = 'acik' and g.durum = 'incelemede'
                                 and public._odeve_erisir(v_ogretmen, o.ogretmen_id, o.sinif_id)
                                 and not public._sinif_arsivde(o.sinif_id)),
    'gecikmis_eksik', (
      select count(*)
      from public.odevler o
      join public.ogrenciler ogr
        on ogr.sinif_id = o.sinif_id and (ogr.aktif and not ogr.deneme)
       and public._odev_ogrenciye_dusar(ogr.sinif_giris, o.son_tarih, o.created_at)
      where o.yayinda and o.son_tarih < bugun
        and public._odeve_erisir(v_ogretmen, o.ogretmen_id, o.sinif_id)
        and not public._sinif_arsivde(o.sinif_id)
        and not exists (select 1 from public.gonderimler g
                         where g.odev_id = o.id and g.ogrenci_id = ogr.id)
    ),
    'son_gonderimler', coalesce((
      select jsonb_agg(x order by x->>'zaman' desc) from (
        select jsonb_build_object(
                 'ogrenci', ogr.ad, 'odev', o.baslik,
                 -- 0055: panoda adın yanında sınıf, ada tıklayınca çözüm.
                 'sinif', (select s.ad from public.siniflar s where s.id = o.sinif_id),
                 'gonderim_id', g.id,
                 'puan', coalesce(g.ogretmen_puan, g.puan),
                 'zaman', g.created_at,
                 'gecikmeli', public._gecikmeli(g.created_at, o.son_tarih)
               ) as x
        from public.gonderimler g
        join public.ogrenciler ogr on ogr.id = g.ogrenci_id
        join public.odevler o on o.id = g.odev_id
        where not public._sinif_arsivde(o.sinif_id)
          and (ogr.aktif and not ogr.deneme) and ogr.sinif_id = o.sinif_id
          and public._odeve_erisir(v_ogretmen, o.ogretmen_id, o.sinif_id)
        order by g.created_at desc limit 10
      ) t
    ), '[]'::jsonb)
  );
end;
$$;

-- pano_detay — kopya: 0064_sinif_listesi_esas.sql
create or replace function public.pano_detay(p_token text, p_tur text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun date := current_date;
  v_baslik text;
  v_aciklama text;
  v_gruplar jsonb;
  v_toplam integer;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);

  if p_tur not in ('ogrenci', 'acik_odev', 'gondermeyen', 'puan_bekleyen') then
    raise exception 'Geçersiz pano bölümü.' using errcode = '22023';
  end if;

  if p_tur = 'ogrenci' then
    v_baslik := 'Ödev verilen öğrenciler';
    v_aciklama := 'Sınıfına en az bir ödev yayınlanmış öğrenciler.';
    select coalesce(jsonb_agg(g order by g_seviye, g_sube), '[]'::jsonb), coalesce(sum(g_adet), 0)
      into v_gruplar, v_toplam
    from (
      select s.seviye as g_seviye, s.sube as g_sube, count(*)::integer as g_adet,
             jsonb_build_object(
               'sinif', s.ad, 'ozel', s.ozel,
               'satirlar', jsonb_agg(jsonb_build_object('ad', o.ad) order by o.ad)
             ) as g
      from public.ogrenciler o
      join public.siniflar s on s.id = o.sinif_id
      where (o.aktif and not o.deneme) and not s.arsiv
        -- 0064: panodaki sayıyla (ogretmen_panosu) AYNI kapsam — bu ekran
        -- 0033'ten beri bütün okulun öğrencilerini listeliyordu.
        and public._ogretmenin_ogrencisi(v_ogretmen, o.id)
        and exists (select 1 from public.odevler d
                     where d.sinif_id = o.sinif_id and d.yayinda
                       and public._odeve_erisir(v_ogretmen, d.ogretmen_id, d.sinif_id))
      group by s.id, s.ad, s.ozel, s.seviye, s.sube
    ) t;

  elsif p_tur = 'acik_odev' then
    v_baslik := 'Açık ödevler';
    v_aciklama := 'Yayında ve süresi henüz dolmamış ödevler.';
    select coalesce(jsonb_agg(g order by g_seviye, g_sube), '[]'::jsonb), coalesce(sum(g_adet), 0)
      into v_gruplar, v_toplam
    from (
      select s.seviye as g_seviye, s.sube as g_sube, count(*)::integer as g_adet,
             jsonb_build_object(
               'sinif', s.ad, 'ozel', s.ozel,
               'satirlar', jsonb_agg(jsonb_build_object(
                 'id', d.id, 'ad', d.baslik, 'son_tarih', d.son_tarih,
                 'gonderim_sayisi', (select count(*) from public.gonderimler g
                                      join public.ogrenciler o on o.id = g.ogrenci_id
                                      where g.odev_id = d.id and (o.aktif and not o.deneme)
                                        and o.sinif_id = d.sinif_id
                                        and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at))
               ) order by d.son_tarih)
             ) as g
      from public.odevler d
      join public.siniflar s on s.id = d.sinif_id
      where d.yayinda and d.son_tarih >= bugun and not s.arsiv
        and public._odeve_erisir(v_ogretmen, d.ogretmen_id, d.sinif_id)
      group by s.id, s.ad, s.ozel, s.seviye, s.sube
    ) t;

  elsif p_tur = 'gondermeyen' then
    v_baslik := 'Göndermeyen öğrenciler';
    v_aciklama := 'Süresi dolmuş ödevlerden en az birini göndermemiş öğrenciler.';
    -- Öğrenci başına TEK satır, eksik ödev sayısıyla. Her eksik ödev için
    -- ayrı satır yazsaydık aynı isim listede beş kez görünürdü ve öğretmen
    -- kaç öğrenciyle konuşacağını sayamazdı.
    select coalesce(jsonb_agg(g order by g_seviye, g_sube), '[]'::jsonb), coalesce(sum(g_adet), 0)
      into v_gruplar, v_toplam
    from (
      select s.seviye as g_seviye, s.sube as g_sube, count(*)::integer as g_adet,
             jsonb_build_object(
               'sinif', s.ad, 'ozel', s.ozel,
               'satirlar', jsonb_agg(jsonb_build_object(
                 'ad', x.ad, 'eksik', x.eksik
               ) order by x.eksik desc, x.ad)
             ) as g
      from (
        select o.id, o.ad, o.sinif_id, count(*)::integer as eksik
        from public.ogrenciler o
        join public.odevler d
          on d.sinif_id = o.sinif_id and d.yayinda and d.son_tarih < bugun
         and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
         and public._odeve_erisir(v_ogretmen, d.ogretmen_id, d.sinif_id)
        where (o.aktif and not o.deneme)
          and not exists (select 1 from public.gonderimler g
                           where g.odev_id = d.id and g.ogrenci_id = o.id)
        group by o.id, o.ad, o.sinif_id
      ) x
      join public.siniflar s on s.id = x.sinif_id
      where not s.arsiv
      group by s.id, s.ad, s.ozel, s.seviye, s.sube
    ) t;

  else -- puan_bekleyen
    v_baslik := 'Puan bekleyenler';
    v_aciklama := 'Açık uçlu gönderimler; puanı siz verirsiniz.';
    select coalesce(jsonb_agg(g order by g_seviye, g_sube), '[]'::jsonb), coalesce(sum(g_adet), 0)
      into v_gruplar, v_toplam
    from (
      select s.seviye as g_seviye, s.sube as g_sube, count(*)::integer as g_adet,
             jsonb_build_object(
               'sinif', s.ad, 'ozel', s.ozel,
               'satirlar', jsonb_agg(jsonb_build_object(
                 'ad', o.ad, 'odev', d.baslik, 'odev_id', d.id,
                 'zaman', g2.created_at
               ) order by g2.created_at)
             ) as g
      from public.gonderimler g2
      join public.odevler d on d.id = g2.odev_id
      join public.ogrenciler o on o.id = g2.ogrenci_id
      join public.siniflar s on s.id = d.sinif_id
      where d.tur = 'acik' and g2.durum = 'incelemede' and not s.arsiv
        and public._odeve_erisir(v_ogretmen, d.ogretmen_id, d.sinif_id)
      group by s.id, s.ad, s.ozel, s.seviye, s.sube
    ) t;
  end if;

  return jsonb_build_object(
    'tur', p_tur,
    'baslik', v_baslik,
    'aciklama', v_aciklama,
    'toplam', v_toplam,
    'gruplar', v_gruplar
  );
end;
$$;

-- odevler_listesi — kopya: 0064_sinif_listesi_esas.sql
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
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);

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
      'kardesler', case when d.grup_id is not null then (
        select coalesce(jsonb_agg(s2.ad order by s2.seviye, s2.sube), '[]'::jsonb)
          from public.odevler d2
          join public.siniflar s2 on s2.id = d2.sinif_id
         where d2.grup_id = d.grup_id and d2.id <> d.id
      ) end,
      'odev_pdf_var', (d.odev_url is not null),
      'anahtar_pdf_var', (d.anahtar_url is not null),
      -- 0064: SINIF LİSTESİ ESAS — giden öğrencinin gönderimi sayılmıyor.
      'gonderim_sayisi', (
        select count(*) from public.gonderimler g
        join public.ogrenciler o on o.id = g.ogrenci_id
        where g.odev_id = d.id and o.sinif_id = d.sinif_id and (o.aktif and not o.deneme)
          and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
      ),
      'gec_gonderim_sayisi', (
        select count(*) from public.gonderimler g
        join public.ogrenciler o on o.id = g.ogrenci_id
        where g.odev_id = d.id and public._gecikmeli(g.created_at, d.son_tarih)
          and o.sinif_id = d.sinif_id and (o.aktif and not o.deneme)
          and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
      ),
      'sinif_mevcudu', (
        select count(*) from public.ogrenciler o
        where o.sinif_id = d.sinif_id and (o.aktif and not o.deneme)
          and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
      ),
      -- Ortalamalar YALNIZ süre dolduktan sonra.
      'ortalama_yapan', case when d.son_tarih < bugun_tr then (
        select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1)
        from public.gonderimler g
        join public.ogrenciler o on o.id = g.ogrenci_id
        where g.odev_id = d.id and coalesce(g.ogretmen_puan, g.puan) is not null
          and o.sinif_id = d.sinif_id and (o.aktif and not o.deneme)
          and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
      ) end,
      'ortalama_tum', case when d.son_tarih < bugun_tr then (
        select round(avg(coalesce(
                 (select coalesce(g.ogretmen_puan, g.puan)
                    from public.gonderimler g
                   where g.odev_id = d.id and g.ogrenci_id = o.id), 0)), 1)
        from public.ogrenciler o
        where o.sinif_id = d.sinif_id and (o.aktif and not o.deneme)
          and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
      ) end
    ) order by d.son_tarih desc, d.created_at desc)
    from public.odevler d
    join public.siniflar s on s.id = d.sinif_id
    where public._odeve_erisir(v_ogretmen, d.ogretmen_id, d.sinif_id)
      and not s.arsiv
      and (p_sinif_id is null or d.sinif_id = p_sinif_id)
      and (p_yayinda is null or d.yayinda = p_yayinda)
  ), '[]'::jsonb);
end;
$$;

-- onam_dokumu — kopya: 0060_mudur_hesabi.sql
create or replace function public.onam_dokumu(p_token text, p_sinif_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ogretmen uuid;
  v_sinif    record;
  v_surum    text := public._gecerli_onam_surumu();
begin
  -- 0060: öğretmen kendi sınıfını, müdür (salt okuma) özel ders dışındaki
  -- her sınıfı görür. Kural tek yerde: `_sinif_okuyucusu`.
  v_ogretmen := public._sinif_okuyucusu(p_token, p_sinif_id);

  select s.id, s.ad into v_sinif from public.siniflar s where s.id = p_sinif_id;
  if not found then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'sinif', jsonb_build_object('id', v_sinif.id, 'ad', v_sinif.ad),
    'surum', v_surum,
    'alindi', now(),
    'alan', (select g.ad from public.ogretmenler g where g.id = v_ogretmen),
    'satirlar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ogrenci_id', o.id,
               'ogrenci', o.ad,
               -- GEÇERLİ SÜRÜMÜN onayı aranıyor. Eski bir sürüme verilmiş
               -- onay bu belgede "onam bekliyor" sayılır: veli bugünkü
               -- metni onaylamış değildir ve belge bunu gizlememeli.
               'onam_var', (v.id is not null),
               'veli_adi', v.veli_adi,
               'onay_zamani', v.onay_zamani
             ) order by o.ad)
      from public.ogrenciler o
      left join public.veli_onaylari v
        on v.ogrenci_id = o.id and v.metin_surumu = v_surum
      where o.sinif_id = p_sinif_id and (o.aktif and not o.deneme)
    ), '[]'::jsonb),
    'toplam', (select count(*)::integer from public.ogrenciler o
                where o.sinif_id = p_sinif_id and (o.aktif and not o.deneme)),
    'onayli', (select count(*)::integer
                 from public.ogrenciler o
                 join public.veli_onaylari v
                   on v.ogrenci_id = o.id and v.metin_surumu = v_surum
                where o.sinif_id = p_sinif_id and (o.aktif and not o.deneme))
  );
end;
$$;

-- siniflari_esitle — kopya: 0064_sinif_listesi_esas.sql
create or replace function public.siniflari_esitle(
  p_token text,
  p_siniflar jsonb,
  p_uygula boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ogretmen uuid;
  bugun      date := (now() at time zone 'Europe/Istanbul')::date;
  c          jsonb;
  r          jsonb;
  v_sinif    uuid;
  s          record;
  p          record;
  v_sira     integer := 0;
  v_ad       text;
  v_no       text;
  aday       uuid;
  aday_sayi  integer;
  kullanilan uuid[] := '{}';
  v_plan     jsonb;
  v_eklenen  jsonb := '[]'::jsonb;
  yeni_id    uuid;
  eski_no    text;
  durum      text;
  kod_ogr    text;
  kod_veli   text;
  x          record;
begin
  -- Toplu öğrenci işi sahibin (0024'ten beri `ogrenciler_toplu_ekle` de öyle).
  v_ogretmen := public._yonetici(p_token);

  if p_siniflar is null or jsonb_typeof(p_siniflar) <> 'array'
     or jsonb_array_length(p_siniflar) = 0 then
    raise exception 'Sınıf listesi boş.' using errcode = '22023';
  end if;

  create temp table if not exists _esitle_plan (
    sira       integer,
    sinif_id   uuid,
    ad         text,
    no         text,
    anahtar    text,
    ogrenci_id uuid,
    islem      text,
    eski_sinif uuid
  ) on commit drop;
  truncate pg_temp._esitle_plan;

  -- ---------------------------------------------------------------------------
  -- 1. DOĞRULAMA — biri bozuksa HİÇBİR ŞEY yazılmıyor (tek işlem).
  -- ---------------------------------------------------------------------------
  for c in select * from jsonb_array_elements(p_siniflar) loop
    v_sinif := nullif(c->>'sinif_id', '')::uuid;
    select * into s from public.siniflar where id = v_sinif;
    if not found then
      raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
    end if;
    if s.ozel then
      raise exception 'Özel ders grubu listeyle eşitlenmez; özel ders öğrencilerini tek tek ekleyin.'
        using errcode = '22023';
    end if;
    if s.arsiv then
      raise exception '% arşivde; önce arşivden çıkarın.', s.ad using errcode = '22023';
    end if;
    if exists (select 1 from pg_temp._esitle_plan e where e.sinif_id = v_sinif) then
      raise exception '% listede iki kez var.', s.ad using errcode = '22023';
    end if;
    -- BOŞ LİSTE YASAK: eşitleme listede olmayanı çıkarıyor; boş bir liste
    -- bütün sınıfı çıkarırdı.
    if jsonb_typeof(c->'adlar') is distinct from 'array' or jsonb_array_length(c->'adlar') = 0 then
      raise exception '% için listede hiç ad yok; boş liste bütün sınıfı çıkarırdı.', s.ad
        using errcode = '22023';
    end if;
    if jsonb_array_length(c->'adlar') > 200 then
      raise exception '% için en fazla 200 öğrenci gönderilebilir.', s.ad using errcode = '22023';
    end if;

    for r in select * from jsonb_array_elements(c->'adlar') loop
      v_sira := v_sira + 1;
      v_ad := btrim(coalesce(public._toplu_ad(r), ''));
      v_no := public._toplu_no(r);
      if v_ad = '' then
        raise exception '%: %. satırdaki ad boş. Hiçbir değişiklik yapılmadı.', s.ad, v_sira
          using errcode = '22023';
      end if;
      if length(v_ad) > 100 then
        raise exception '%: "%" 100 karakterden uzun. Hiçbir değişiklik yapılmadı.', s.ad, v_ad
          using errcode = '22023';
      end if;
      if v_no is not null and length(v_no) > 20 then
        raise exception '%: "%" numarası 20 karakterden uzun. Hiçbir değişiklik yapılmadı.', s.ad, v_ad
          using errcode = '22023';
      end if;
      insert into pg_temp._esitle_plan (sira, sinif_id, ad, no, anahtar)
      values (v_sira, v_sinif, v_ad, v_no, public._ad_anahtari(v_ad));
    end loop;
  end loop;

  -- ---------------------------------------------------------------------------
  -- 2. EŞLEŞTİRME
  --   a) KALIR  — aynı sınıfta aynı adla aktif öğrenci (numarası tutan önce)
  --   b) TAŞINIR — başka (özel olmayan) sınıfta aynı adla TEK aktif öğrenci;
  --      kodları ve geçmişi korunur (öğretmenin kararı). Numaralar ikisinde
  --      de yazılı ve farklıysa başka bir çocuktur, taşınmaz.
  --   c) YENİ   — kalan satırlar.
  -- Önce bütün sınıfların (a)'sı: 9A'da kalan bir öğrenci, 9B'nin listesinde
  -- adaşı olduğu için 9B'ye çekilmesin.
  -- ---------------------------------------------------------------------------
  for p in select * from pg_temp._esitle_plan order by sira loop
    select o.id into aday
      from public.ogrenciler o
     where (o.aktif and not o.deneme) and o.sinif_id = p.sinif_id
       and public._ad_anahtari(o.ad) = p.anahtar
       and not (o.id = any (kullanilan))
     order by (p.no is not null and o.ogrenci_no is not distinct from p.no) desc, o.created_at
     limit 1;
    if aday is not null then
      update pg_temp._esitle_plan set ogrenci_id = aday, islem = 'kalir' where _esitle_plan.sira = p.sira;
      kullanilan := kullanilan || aday;
    end if;
  end loop;

  for p in select * from pg_temp._esitle_plan where islem is null order by sira loop
    select count(*) into aday_sayi
      from public.ogrenciler o
      join public.siniflar so on so.id = o.sinif_id and not so.ozel
     where (o.aktif and not o.deneme) and o.sinif_id <> p.sinif_id
       and public._ad_anahtari(o.ad) = p.anahtar
       and not (o.id = any (kullanilan))
       and not (p.no is not null and o.ogrenci_no is not null and o.ogrenci_no <> p.no);

    aday := null;
    if aday_sayi = 1 then
      select o.id into aday
        from public.ogrenciler o
        join public.siniflar so on so.id = o.sinif_id and not so.ozel
       where (o.aktif and not o.deneme) and o.sinif_id <> p.sinif_id
         and public._ad_anahtari(o.ad) = p.anahtar
         and not (o.id = any (kullanilan))
         and not (p.no is not null and o.ogrenci_no is not null and o.ogrenci_no <> p.no);
    elsif aday_sayi > 1 then
      -- Numara tutan tek aday varsa o; yoksa belirsiz — tahmin edilmiyor.
      if p.no is not null then
        select (array_agg(o.id))[1] into aday
          from public.ogrenciler o
          join public.siniflar so on so.id = o.sinif_id and not so.ozel
         where (o.aktif and not o.deneme) and o.sinif_id <> p.sinif_id
           and public._ad_anahtari(o.ad) = p.anahtar
           and not (o.id = any (kullanilan))
           and o.ogrenci_no = p.no
        having count(*) = 1;
      end if;
      if aday is null then
        raise exception '"%" adında birden çok sınıfta öğrenci var (%); hangisinin taşınacağı belirsiz. Satıra okul numarasını ekleyin. Hiçbir değişiklik yapılmadı.',
          p.ad,
          (select string_agg(distinct so.ad, ', ')
             from public.ogrenciler o join public.siniflar so on so.id = o.sinif_id
            where (o.aktif and not o.deneme) and o.sinif_id <> p.sinif_id and not so.ozel
              and public._ad_anahtari(o.ad) = p.anahtar)
          using errcode = '22023';
      end if;
    end if;

    if aday is not null then
      update pg_temp._esitle_plan
         set ogrenci_id = aday, islem = 'tasinir',
             eski_sinif = (select o.sinif_id from public.ogrenciler o where o.id = aday)
       where _esitle_plan.sira = p.sira;
      kullanilan := kullanilan || aday;
    else
      update pg_temp._esitle_plan set islem = 'yeni' where _esitle_plan.sira = p.sira;
    end if;
  end loop;

  -- ---------------------------------------------------------------------------
  -- 3. PLAN — önizleme ve uygulama AYNI planı döndürüyor.
  -- ---------------------------------------------------------------------------
  select coalesce(jsonb_agg(jsonb_build_object(
           'sinif_id', sx.id,
           'ad', sx.ad,
           'kalan', (select count(*) from pg_temp._esitle_plan e
                      where e.sinif_id = sx.id and e.islem = 'kalir'),
           'yeni', coalesce((select jsonb_agg(jsonb_build_object('ad', e.ad, 'no', e.no) order by e.sira)
                               from pg_temp._esitle_plan e
                              where e.sinif_id = sx.id and e.islem = 'yeni'), '[]'::jsonb),
           'tasinan', coalesce((select jsonb_agg(jsonb_build_object(
                                   'id', e.ogrenci_id, 'ad', e.ad, 'no', e.no,
                                   'eski_sinif', (select s2.ad from public.siniflar s2 where s2.id = e.eski_sinif))
                                 order by e.sira)
                                  from pg_temp._esitle_plan e
                                 where e.sinif_id = sx.id and e.islem = 'tasinir'), '[]'::jsonb),
           -- ÇIKARILACAKLAR: bu sınıfta aktif olup listede eşleşmeyenler.
           -- Başka sınıfa taşınacak olan `kullanilan`'da; çıkarılmıyor.
           'cikarilan', coalesce((select jsonb_agg(jsonb_build_object(
                                     'id', o.id, 'ad', o.ad, 'ogrenci_no', o.ogrenci_no)
                                   order by public._numara_sira(o.ogrenci_no) nulls last, o.ad)
                                    from public.ogrenciler o
                                   where (o.aktif and not o.deneme) and o.sinif_id = sx.id
                                     and not (o.id = any (kullanilan))), '[]'::jsonb)
         ) order by sx.seviye, sx.sube), '[]'::jsonb)
    into v_plan
    from public.siniflar sx
   where sx.id in (select distinct e.sinif_id from pg_temp._esitle_plan e);

  if not p_uygula then
    return jsonb_build_object('uygulandi', false, 'siniflar', v_plan);
  end if;

  -- ---------------------------------------------------------------------------
  -- 4. UYGULAMA
  -- ---------------------------------------------------------------------------
  for p in select * from pg_temp._esitle_plan order by sira loop
    if p.islem = 'kalir' then
      select o.ogrenci_no into eski_no from public.ogrenciler o where o.id = p.ogrenci_id;
      if p.no is not null and p.no is distinct from eski_no then
        update public.ogrenciler set ogrenci_no = p.no where id = p.ogrenci_id;
        perform public._denetim('ogrenci_no_guncellendi', 'ogrenciler', p.ogrenci_id,
          public._aktor(v_ogretmen),
          jsonb_build_object('ogrenci_no', eski_no), jsonb_build_object('ogrenci_no', p.no));
        durum := 'guncellendi';
      else
        durum := 'degismedi';
      end if;
      yeni_id := p.ogrenci_id;

    elsif p.islem = 'tasinir' then
      -- TAŞIMA: kodlar ve geçmiş korunur; yeni sınıfa geliş tarihi bugün —
      -- yeni sınıfın bugünden önce son tarihi dolan ödevleri ona sayılmaz.
      update public.ogrenciler
         set sinif_id = p.sinif_id,
             sinif_giris = bugun,
             ogrenci_no = coalesce(p.no, ogrenci_no)
       where id = p.ogrenci_id;
      perform public._denetim('ogrenci_tasindi', 'ogrenciler', p.ogrenci_id,
        public._aktor(v_ogretmen),
        jsonb_build_object('sinif_id', p.eski_sinif),
        jsonb_build_object('sinif_id', p.sinif_id));
      durum := 'tasindi';
      yeni_id := p.ogrenci_id;

    else
      insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, ogrenci_no, sinif_giris)
      values (p.ad, 'okul', p.sinif_id, v_ogretmen, p.no, bugun)
      returning id into yeni_id;

      kod_ogr  := public._yeni_kod();
      kod_veli := public._yeni_kod();
      insert into public.giris_kodlari (kod, ogrenci_id, rol)
      values (kod_ogr, yeni_id, 'ogrenci'), (kod_veli, yeni_id, 'veli');

      perform public._denetim('ogrenci_eklendi', 'ogrenciler', yeni_id, public._aktor(v_ogretmen));
      durum := 'eklendi';
      -- Yeni kayıt da listede: aşağıdaki çıkarma onu "listede yok" saymasın.
      kullanilan := kullanilan || yeni_id;
    end if;

    v_eklenen := v_eklenen || jsonb_build_array(jsonb_build_object(
      'id', yeni_id,
      'ad', (select o.ad from public.ogrenciler o where o.id = yeni_id),
      'ogrenci_no', (select o.ogrenci_no from public.ogrenciler o where o.id = yeni_id),
      'sinif', (select s2.ad from public.siniflar s2 where s2.id = p.sinif_id),
      'durum', durum,
      'ogrenci_kodu', (select max(k.kod) from public.giris_kodlari k
                        where k.ogrenci_id = yeni_id and k.rol = 'ogrenci'),
      'veli_kodu', (select max(k.kod) from public.giris_kodlari k
                     where k.ogrenci_id = yeni_id and k.rol = 'veli')));
  end loop;

  -- ÇIKARMA = `ogrenci_pasiflestir` (0033) ile aynı: kayıt ve ödev geçmişi
  -- SİLİNMİYOR; listelerden ve ortalamalardan düşüyor, kodlar iptal.
  for x in
    select o.id
      from public.ogrenciler o
     where (o.aktif and not o.deneme)
       and o.sinif_id in (select distinct e.sinif_id from pg_temp._esitle_plan e)
       and not (o.id = any (kullanilan))
  loop
    update public.ogrenciler set aktif = false where id = x.id;
    delete from public.giris_kodlari where ogrenci_id = x.id;
    update public.oturumlar set iptal = true where ogrenci_id = x.id and not iptal;
    perform public._denetim('ogrenci_pasiflestirildi', 'ogrenciler', x.id,
      public._aktor(v_ogretmen), null, jsonb_build_object('neden', 'sinif_listesi'));
  end loop;

  return jsonb_build_object(
    'uygulandi', true,
    'siniflar', v_plan,
    'eklenen', v_eklenen,
    'adet', jsonb_array_length(v_eklenen),
    'eklendi', (select count(*) from jsonb_array_elements(v_eklenen) e where e->>'durum' = 'eklendi'),
    'tasindi', (select count(*) from jsonb_array_elements(v_eklenen) e where e->>'durum' = 'tasindi'),
    'guncellendi', (select count(*) from jsonb_array_elements(v_eklenen) e where e->>'durum' = 'guncellendi'),
    'degismedi', (select count(*) from jsonb_array_elements(v_eklenen) e where e->>'durum' = 'degismedi'),
    'cikarildi', (select coalesce(sum(jsonb_array_length(v->'cikarilan')), 0)
                    from jsonb_array_elements(v_plan) v)
  );
end;
$$;

-- siniflar_listesi — kopya: 0033_ogretmen_kimligi.sql
create or replace function public.siniflar_listesi(p_token text, p_arsiv boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id, 'ad', s.ad, 'seviye', s.seviye,
             'sube', s.sube, 'ozel', s.ozel, 'arsiv', s.arsiv,
             'ogrenci_sayisi', (select count(*) from public.ogrenciler o
                                 where o.sinif_id = s.id and (o.aktif and not o.deneme))
           ) order by s.seviye, s.sube)
    from public.siniflar s
    where (p_arsiv or not s.arsiv)
      and public._ogretmenin_sinifi(v_ogretmen, s.id)
  ), '[]'::jsonb);
end;
$$;

-- ogretmen_duyurulari — kopya: 0065_genel_ve_duyurular.sql
create or replace function public.ogretmen_duyurulari(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', d.id,
             'metin', d.metin,
             'zaman', d.created_at,
             'siniflar', (
               select jsonb_agg(jsonb_build_object(
                        'id', s.id, 'ad', s.ad,
                        'mevcut', (select count(*)::integer from public.ogrenciler o
                                    where o.sinif_id = s.id and (o.aktif and not o.deneme)
                                      and public._ogrencinin_duyurusu(d.id, s.id, o.sinif_giris)),
                        'goren', (select count(*)::integer from public.ogrenciler o
                                   join public.duyuru_okundu k on k.ogrenci_id = o.id
                                  where o.sinif_id = s.id and (o.aktif and not o.deneme)
                                    and public._ogrencinin_duyurusu(d.id, s.id, o.sinif_giris)
                                    and k.zaman >= d.created_at)
                      ) order by s.seviye, s.sube, s.ad)
                 from public.duyuru_siniflari ds
                 join public.siniflar s on s.id = ds.sinif_id
                where ds.duyuru_id = d.id)
           ) order by d.created_at desc)
      from public.duyurular d
     where d.ogretmen_id = v_ogretmen
       and d.kaldirildi is null
       and d.created_at > now() - interval '30 days'
  ), '[]'::jsonb);
end;
$$;

-- okul_bilgilendirme — kopya: 0039_okul_bilgilendirme.sql
create or replace function public.okul_bilgilendirme(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id    uuid;
  v_surum text := public._gecerli_onam_surumu();
begin
  v_id := public._yonetici(p_token);

  return jsonb_build_object(
    'alindi', now(),
    'alan', (select g.ad from public.ogretmenler g where g.id = v_id),
    'surum', v_surum,

    -- Aktif öğretmen sayısı. "Dört" diye yazmıyoruz: onam metninde tam da
    -- o hatayı yaptık ve öğretmen yakaladı.
    'ogretmen_sayisi', (select count(*)::integer from public.ogretmenler
                         where aktif),
    'sinif_sayisi',    (select count(*)::integer from public.siniflar
                         where not arsiv),
    'ogrenci_sayisi',  (select count(*)::integer from public.ogrenciler
                         where aktif and not deneme),

    -- Onam tablosu: kaç velinin GEÇERLİ SÜRÜMDE onayı var. Belge "veliler
    -- bilgilendiriliyor" diyorsa, bunun sayısı da kâğıtta olmalı — yoksa
    -- iddia denetlenemez kalır.
    'onam_veren', (select count(*)::integer
                     from public.ogrenciler o
                     join public.veli_onaylari v
                       on v.ogrenci_id = o.id and v.metin_surumu = v_surum
                    where (o.aktif and not o.deneme)),

    -- Sistem ne zamandan beri kullanılıyor: en eski öğrenci kaydı.
    'ilk_kayit', (select min(o.created_at) from public.ogrenciler o)
  );
end;
$$;

-- odev_detay — kopya: 0055_yonetici_odevi_ve_duzeltme.sql
create or replace function public.odev_detay(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  d public.odevler;
  s public.siniflar;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  perform public._odev_sahibi(v_ogretmen, p_id);

  select * into d from public.odevler where id = p_id;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;
  select * into s from public.siniflar where id = d.sinif_id;

  return jsonb_build_object(
    'id', d.id,
    'baslik', d.baslik,
    'aciklama', d.aciklama,
    'tur', d.tur,
    'sinif_id', d.sinif_id,
    'sinif', s.ad,
    'son_tarih', d.son_tarih,
    'soru_sayisi', d.soru_sayisi,
    'gec_teslim', d.gec_teslim,
    'konular', coalesce(d.konular, '{}'::jsonb),
    'sik_sayisi', d.sik_sayisi,
    'sayfa_limiti', d.sayfa_limiti,
    'cevap_anahtari', coalesce(d.cevap_anahtari, '{}'::jsonb),
    'anahtar_yolu', d.anahtar_url,
    'odev_yolu', d.odev_url,
    'yayinda', d.yayinda,
    'kardesler', case when d.grup_id is not null and d.ogretmen_id = v_ogretmen then (
      select coalesce(jsonb_agg(s2.ad order by s2.seviye, s2.sube), '[]'::jsonb)
        from public.odevler d2
        join public.siniflar s2 on s2.id = d2.sinif_id
       where d2.grup_id = d.grup_id and d2.id <> d.id
    ) end,
    'kardes_detay', case when d.grup_id is not null and d.ogretmen_id = v_ogretmen then (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', d2.id,
               'sinif', s2.ad,
               'gonderim_sayisi', (select count(*) from public.gonderimler g
                                    where g.odev_id = d2.id
                                      and not public._deneme_mi(g.ogrenci_id)),
               'anahtar_ayni', (d2.cevap_anahtari is not distinct from d.cevap_anahtari),
               'arsiv', public._sinif_arsivde(d2.sinif_id)
             ) order by s2.seviye, s2.sube), '[]'::jsonb)
        from public.odevler d2
        join public.siniflar s2 on s2.id = d2.sinif_id
       where d2.grup_id = d.grup_id and d2.id <> d.id
    ) end,
    'gonderim_sayisi', (select count(*) from public.gonderimler g where g.odev_id = d.id
                          and not public._deneme_mi(g.ogrenci_id)),
    'gec_gonderim_sayisi', (
      select count(*) from public.gonderimler g
      where g.odev_id = d.id and public._gecikmeli(g.created_at, d.son_tarih)
        and not public._deneme_mi(g.ogrenci_id)
    )
  );
end;
$$;

-- ogrenciler_listesi — kopya: 0044_numara_sirasi.sql
create or replace function public.ogrenciler_listesi(
  p_token text,
  p_arama text default null,
  p_sinif_id uuid default null,
  p_sayfa integer default 1,
  p_boyut integer default 25,
  -- 0044: 'ad' (varsayılan, eski davranış) ya da 'numara'.
  p_sirala text default 'ad'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  toplam integer;
  satirlar jsonb;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  p_boyut := least(greatest(coalesce(p_boyut, 25), 1), 100);
  p_sayfa := greatest(coalesce(p_sayfa, 1), 1);

  if p_sirala is null or p_sirala not in ('ad', 'numara') then
    raise exception 'Sıralama ''ad'' ya da ''numara'' olmalı.' using errcode = '22023';
  end if;

  select count(*) into toplam
  from public.ogrenciler o
  where (o.aktif and (not o.deneme or public._deneme_gorur(v_ogretmen)))
    and public._ogretmenin_ogrencisi(v_ogretmen, o.id)
    and not public._sinif_arsivde(o.sinif_id)
    and (p_sinif_id is null or o.sinif_id = p_sinif_id)
    and (p_arama is null or o.ad ilike '%' || p_arama || '%');

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', o.id, 'ad', o.ad, 'ogrenci_no', o.ogrenci_no, 'tur', o.tur, 'sinif', s.ad, 'deneme', o.deneme
         ) order by case when p_sirala = 'numara'
             then public._numara_sira(o.ogrenci_no) end nulls last, o.ad), '[]'::jsonb) into satirlar
  from (
    select o.* from public.ogrenciler o
    where (o.aktif and (not o.deneme or public._deneme_gorur(v_ogretmen)))
      and public._ogretmenin_ogrencisi(v_ogretmen, o.id)
      and not public._sinif_arsivde(o.sinif_id)
      and (p_sinif_id is null or o.sinif_id = p_sinif_id)
      and (p_arama is null or o.ad ilike '%' || p_arama || '%')
    order by case when p_sirala = 'numara'
             then public._numara_sira(o.ogrenci_no) end nulls last, o.ad
    limit p_boyut offset (p_sayfa - 1) * p_boyut
  ) o
  left join public.siniflar s on s.id = o.sinif_id;

  return jsonb_build_object(
    'toplam', toplam,
    'sayfa', p_sayfa,
    'toplam_sayfa', greatest(ceil(toplam::numeric / p_boyut)::int, 1),
    'kayitlar', satirlar
  );
end;
$$;

-- veliler_listesi — kopya: 0033_ogretmen_kimligi.sql
create or replace function public.veliler_listesi(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  sonuc jsonb;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);

  with ozet as (
    select o.id as ogrenci_id, o.ad, o.tur, o.sinif_id,
           s.ad as sinif, s.ozel, s.seviye, s.sube,
           (select max(m.created_at) from public.mesajlar m
             where m.ogrenci_id = o.id and m.kanal = 'veli'
               and m.ogretmen_id = v_ogretmen) as son_mesaj,
           (select count(*)::integer from public.mesajlar m
             where m.ogrenci_id = o.id and m.kimden = 'veli' and m.kanal = 'veli'
               and m.ogretmen_id = v_ogretmen
               and m.created_at > coalesce(
                     (select k.zaman from public.okundu k
                       where k.ogrenci_id = o.id and k.rol = 'ogretmen'
                         and k.kanal = 'veli'
                         and k.ogretmen_id = v_ogretmen),
                     '-infinity'::timestamptz)) as okunmamis
    from public.ogrenciler o
    join public.siniflar s on s.id = o.sinif_id
    where (o.aktif and (not o.deneme or public._deneme_gorur(v_ogretmen))) and not s.arsiv
      and public._ogretmenin_ogrencisi(v_ogretmen, o.id)
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

-- sinif_velileri — kopya: 0057_veli_adi_listelerde.sql
create or replace function public.sinif_velileri(p_token text, p_sinif_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sinif record;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  if not public._ogretmenin_sinifi(v_ogretmen, p_sinif_id) then
    raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
  end if;

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
               -- 0057: velinin onam verirken KENDİ yazdığı ad (yoksa null).
               'veli_adi', public._veli_adi(o.id),
               -- ONAM DURUMU (0034). Onaylamayan veli panele giremiyor;
               -- öğretmen kimin beklediğini buradan görüyor. SALT OKUNUR:
               -- öğretmen onamı ne verebilir ne geri alabilir — onam
               -- velinin kendi iradesi, başkası adına tıklanamaz.
               'onam_var', exists (select 1 from public.veli_onaylari v
                                    where v.ogrenci_id = o.id
                                      and v.metin_surumu = public._gecerli_onam_surumu()),
               -- Veli kodu yoksa veli hiç giriş yapamaz; öğretmen bunu
               -- mesaj yazmadan önce bilsin.
               'veli_kodu_var', exists (select 1 from public.giris_kodlari k
                                         where k.ogrenci_id = o.id and k.rol = 'veli'),
               'mesaj_sayisi', (select count(*)::integer from public.mesajlar m
                                 where m.ogrenci_id = o.id
                                   and m.kanal = 'veli'
                                   and m.ogretmen_id = v_ogretmen),
               'son_mesaj', (select max(m.created_at) from public.mesajlar m
                              where m.ogrenci_id = o.id
                                and m.kanal = 'veli'
                                and m.ogretmen_id = v_ogretmen),
               'okunmamis', (select count(*)::integer from public.mesajlar m
                              where m.ogrenci_id = o.id and m.kimden = 'veli'
                                and m.kanal = 'veli'
                                and m.ogretmen_id = v_ogretmen
                                and m.created_at > coalesce(
                                      -- 0049: anahtarın DÖRT sütunu da
                                      -- süzülüyor; kanal ya da ogretmen_id
                                      -- eksikken bu alt sorgu tek satır
                                      -- döndürmek zorunda değildi.
                                      (select k.zaman from public.okundu k
                                        where k.ogrenci_id = o.id
                                          and k.rol = 'ogretmen'
                                          and k.kanal = 'veli'
                                          and k.ogretmen_id = v_ogretmen),
                                      '-infinity'::timestamptz))
             ) order by o.ad)
      from public.ogrenciler o
      where o.sinif_id = p_sinif_id and (o.aktif and (not o.deneme or public._deneme_gorur(v_ogretmen)))
    ), '[]'::jsonb)
  );
end;
$$;

-- odev_gonderimleri — kopya: 0064_sinif_listesi_esas.sql
create or replace function public.odev_gonderimleri(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  d public.odevler;
  s public.siniflar;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  perform public._odev_sahibi(v_ogretmen, p_id);

  select * into d from public.odevler where id = p_id;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;
  select * into s from public.siniflar where id = d.sinif_id;

  return jsonb_build_object(
    'odev', jsonb_build_object(
      'id', d.id,
      'baslik', d.baslik,
      'tur', d.tur,
      'sinif', s.ad,
      'son_tarih', d.son_tarih,
      'soru_sayisi', d.soru_sayisi,
      'gec_teslim', d.gec_teslim,
      'yayinda', d.yayinda
    ),
    'ozet', jsonb_build_object(
      -- 0064: SINIF LİSTESİ ESAS (bugün sınıfta olan, ödevin son
      -- tarihinde sınıfa gelmiş öğrenciler).
      'mevcut', (select count(*) from public.ogrenciler o
                  where o.sinif_id = d.sinif_id and (o.aktif and not o.deneme)
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)),
      'gonderen', (select count(*) from public.gonderimler g
                    join public.ogrenciler o on o.id = g.ogrenci_id
                    where g.odev_id = d.id and o.sinif_id = d.sinif_id and (o.aktif and not o.deneme)
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)),
      'gecikmeli', (select count(*) from public.gonderimler g
                     join public.ogrenciler o on o.id = g.ogrenci_id
                     where g.odev_id = d.id
                       and public._gecikmeli(g.created_at, d.son_tarih)
                       and o.sinif_id = d.sinif_id and (o.aktif and not o.deneme)
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)),
      'puan_bekleyen', (select count(*) from public.gonderimler g
                         join public.ogrenciler o on o.id = g.ogrenci_id
                         where g.odev_id = d.id and g.durum = 'incelemede'
                           and o.sinif_id = d.sinif_id and (o.aktif and not o.deneme)
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at))
    ),
    -- SINIF KONU ÖZETİ: "bu sınıf en çok hangi konuda takıldı?"
    -- Öğretmenin bir sonraki dersini planlarken bakacağı sayı bu. Tek tek
    -- öğrencilerin analizini toplamak yerine sunucuda toplanıyor; aksi hâlde
    -- otuz öğrencinin cevapları tarayıcıya inerdi.
    'konu_ozeti', coalesce((
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
        from public.gonderimler g
        join public.ogrenciler o on o.id = g.ogrenci_id
        cross join lateral jsonb_array_elements(
          public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
        ) e
        where g.odev_id = d.id and o.sinif_id = d.sinif_id and (o.aktif and (not o.deneme or public._deneme_gorur(v_ogretmen)))
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
        group by e->>'konu'
      ) t
    ), '[]'::jsonb),
    'satirlar', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ogrenci_id', o.id,
        'ogrenci', o.ad,
        'gonderim_id', g.id,
        'gonderdi', (g.id is not null),
        'zaman', g.created_at,
        'gecikmeli', case when g.id is null then false
                     else public._gecikmeli(g.created_at, d.son_tarih) end,
        'durum', g.durum,
        'dogru', g.dogru,
        'yanlis', g.yanlis,
        'bos', g.bos,
        'puan', g.puan,
        'ogretmen_puan', g.ogretmen_puan,
        'ogretmen_yorum', g.ogretmen_yorum,
        -- HANGİ SORULAR YANLIŞ: sayı değil, numara. "5 yanlış" öğretmene
        -- ne yapacağını söylemez; "3, 7 ve 9 yanlış" söyler. Yalnız test
        -- ödevinde anlamlı — açık uçluda anahtar yok, her soru "boş"
        -- görünür ve bu bilgi gürültüden ibaret olurdu.
        'yanlis_sorular', case when g.id is not null and d.tur = 'test'
          then public._soru_dokumu(d.cevap_anahtari, g.cevaplar, d.soru_sayisi) -> 'yanlis'
          else '[]'::jsonb end,
        'bos_sorular', case when g.id is not null and d.tur = 'test'
          then public._soru_dokumu(d.cevap_anahtari, g.cevaplar, d.soru_sayisi) -> 'bos'
          else '[]'::jsonb end,
        'foto_var', (g.foto_yolu is not null),
        -- 0055: yönetici düzeltmesi öğretmende işaretli.
        'duzeltildi', (g.duzelten_yonetici is not null),
        'duzeltme_nedeni', g.duzeltme_nedeni
      ) order by o.ad)
      from public.ogrenciler o
      left join public.gonderimler g
        on g.odev_id = d.id and g.ogrenci_id = o.id
      where o.sinif_id = d.sinif_id and (o.aktif and (not o.deneme or public._deneme_gorur(v_ogretmen)))
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. YETKİLER
-- -----------------------------------------------------------------------------
revoke all on function public._deneme_mi(uuid) from public, anon, authenticated;
revoke all on function public._deneme_gorur(uuid) from public, anon, authenticated;
revoke all on function public._deneme_sinifi_gecerli(uuid) from public, anon, authenticated;
do $$
declare ad text;
begin
  foreach ad in array array['deneme_hesabi(text)', 'deneme_hesabi_olustur(text,uuid)',
                            'deneme_sinifi_degistir(text,uuid)', 'deneme_sifirla(text)',
                            'deneme_hesabi_sil(text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', ad);
    execute format('grant execute on function public.%s to anon, authenticated', ad);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 5. ÖZ-DENETİM — her kopya gövdede deneme filtresi var
-- -----------------------------------------------------------------------------
do $$
declare
  ad text;
begin
  foreach ad in array array[
    '_sinif_kart_ozetleri', 'okul_geneli', 'mudur_paneli', 'sinif_analizi',
    'sinif_not_cizelgesi', 'sinif_ogrenci_ozeti', 'konu_karnesi', '_odev_kiyasi',
    'ogretmen_panosu', 'pano_detay', 'odevler_listesi', 'onam_dokumu',
    'siniflari_esitle', 'siniflar_listesi', 'ogretmen_duyurulari', 'okul_bilgilendirme',
    'odev_detay', 'ogrenciler_listesi', 'veliler_listesi', 'sinif_velileri',
    'odev_gonderimleri'] loop
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = ad
                      and (pg_get_functiondef(p.oid) like '%deneme%')) then
      raise exception '0073: % deneme öğrenciyi dışlamıyor', ad;
    end if;
  end loop;
end $$;

select public._migration_kaydet('0073');
