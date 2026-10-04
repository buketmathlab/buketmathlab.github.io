-- =============================================================================
-- 0065 — ÖĞRETMENİN "GENEL" SAYFASI ve ÖĞRETMENDEN SINIFA TEK YÖNLÜ DUYURU
--
-- Öğretmenin isteği: "Müdürün genel sekmesinde olan bilgiler öğretmenlerin
-- pano sayfasında olsun. Öğretmenlerin Pano sayfasının adı 'genel' olarak
-- değiştirilsin. Acil durumlarda sadece öğretmenlerin tek taraflı
-- bildirimde bulunabileceği bir duyuru panosu oluştur. Sadece hangi sınıfa
-- duyuru yapılacaksa o sınıfın öğrencilerine o duyuru gitsin."
--
-- Öğretmenin kararları (sorulup seçildi):
--   * Genel bilgiler OKULUN TAMAMI için — müdürün gördüğü rakamlar;
--   * duyuruyu YALNIZ ÖĞRENCİLER görür (veli görmez);
--   * bir duyuru BİRDEN ÇOK şubeye birlikte gönderilebilir.
--
-- 1. okul_geneli(p_token) — her öğretmen. `mudur_paneli` (0064) hesabının
--    AYNISI; yalnız okul / seviyeler / aylar / şubeler. Öğretmen başına
--    etkinlik listesi ve şube kartlarındaki öğretmen adları müdürde kalıyor.
--    `mudur_paneli` DEĞİŞMEDİ; iki hesabın sapmaması SQL testiyle bağlı.
-- 2. duyurular, duyuru_siniflari, duyuru_okundu — doğrudan erişim yok.
-- 3. duyuru_yayinla / duyuru_kaldir / ogretmen_duyurulari — öğretmen;
--    ogrenci_duyurulari / duyurulari_okudum — öğrenci. Öğrenci YANIT
--    veremez: yazma ucu yalnız öğretmende.
-- 4. ogrenci_odevleri ← 0064: `okunmamis_duyuru` (Pano rozeti) eklendi.
--
-- Bu dosya tekrar çalıştırılabilir. Ön koşul: 0064.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. okul_geneli — öğretmenin Genel sayfası
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 2. ŞEMA — duyurular
-- -----------------------------------------------------------------------------
create table if not exists public.duyurular (
  id          uuid primary key default gen_random_uuid(),
  ogretmen_id uuid not null references public.ogretmenler(id),
  metin       text not null check (length(btrim(metin, E' \t\r\n')) between 1 and 1000),
  created_at  timestamptz not null default now(),
  -- Kaldırma YUMUŞAK: öğrencilerin ekranından hemen kalkar, kayıt kalır.
  kaldirildi  timestamptz
);

create table if not exists public.duyuru_siniflari (
  duyuru_id uuid not null references public.duyurular(id) on delete cascade,
  sinif_id  uuid not null references public.siniflar(id) on delete cascade,
  primary key (duyuru_id, sinif_id)
);
create index if not exists duyuru_siniflari_sinif_idx on public.duyuru_siniflari (sinif_id);

-- Öğrencinin duyuruları en son gördüğü an (Pano açıldığında).
create table if not exists public.duyuru_okundu (
  ogrenci_id uuid primary key references public.ogrenciler(id) on delete cascade,
  zaman      timestamptz not null default now()
);

alter table public.duyurular        enable row level security;
alter table public.duyurular        force row level security;
alter table public.duyuru_siniflari enable row level security;
alter table public.duyuru_siniflari force row level security;
alter table public.duyuru_okundu    enable row level security;
alter table public.duyuru_okundu    force row level security;
drop policy if exists duyurular_dogrudan_erisim_yok on public.duyurular;
create policy duyurular_dogrudan_erisim_yok on public.duyurular
  for all to anon, authenticated using (false) with check (false);
drop policy if exists duyuru_siniflari_dogrudan_erisim_yok on public.duyuru_siniflari;
create policy duyuru_siniflari_dogrudan_erisim_yok on public.duyuru_siniflari
  for all to anon, authenticated using (false) with check (false);
drop policy if exists duyuru_okundu_dogrudan_erisim_yok on public.duyuru_okundu;
create policy duyuru_okundu_dogrudan_erisim_yok on public.duyuru_okundu
  for all to anon, authenticated using (false) with check (false);
revoke all on table public.duyurular        from public, anon, authenticated;
revoke all on table public.duyuru_siniflari from public, anon, authenticated;
revoke all on table public.duyuru_okundu    from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. TEK KURAL — duyuru bu öğrenciye düşer mi
-- -----------------------------------------------------------------------------
-- Öğrencinin şubesine yapılmış, kaldırılmamış, son 30 günde ve öğrenci
-- sınıfa GELDİKTEN sonra (0064'teki `sinif_giris` mantığı) yapılmış duyuru.
create or replace function public._ogrencinin_duyurusu(
  p_duyuru_id uuid, p_sinif_id uuid, p_sinif_giris date)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1
      from public.duyurular d
      join public.duyuru_siniflari ds on ds.duyuru_id = d.id
     where d.id = p_duyuru_id
       and ds.sinif_id = p_sinif_id
       and d.kaldirildi is null
       and d.created_at > now() - interval '30 days'
       and (p_sinif_giris is null
            or (d.created_at at time zone 'Europe/Istanbul')::date >= p_sinif_giris)
  );
$$;

create or replace function public._okunmamis_duyuru(
  p_ogrenci_id uuid, p_sinif_id uuid, p_sinif_giris date)
returns integer
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select count(*)::integer
    from public.duyurular d
   where public._ogrencinin_duyurusu(d.id, p_sinif_id, p_sinif_giris)
     and d.created_at > coalesce(
           (select k.zaman from public.duyuru_okundu k where k.ogrenci_id = p_ogrenci_id),
           '-infinity'::timestamptz);
$$;

-- -----------------------------------------------------------------------------
-- 4. ÖĞRETMEN UÇLARI
-- -----------------------------------------------------------------------------
create or replace function public.duyuru_yayinla(
  p_token text, p_metin text, p_siniflar uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o          record;
  v_ogretmen uuid;
  v_yonetici boolean;
  v_siniflar uuid[];
  v_sinif    record;
  v_id       uuid;
  v_metin    text;
begin
  v_ogretmen := public._ogretmen(p_token);
  select * into o from public._oturum(p_token);
  -- VEKÂLETTE DUYURU YASAK — `mesaj_gonder` (0058) ile aynı kural: öğrenci,
  -- öğretmeninin yazdığını sandığı bir duyuruyu başkasından almamalı.
  if o.vekil_id is not null then
    raise exception 'Başka bir öğretmenin hesabındayken onun adına duyuru yapamazsınız. '
                    'Kendi hesabınıza dönün.'
      using errcode = '42501';
  end if;

  v_metin := btrim(coalesce(p_metin, ''), E' \t\r\n');
  if length(v_metin) = 0 then
    raise exception 'Duyuru boş olamaz.' using errcode = '22023';
  end if;
  if length(v_metin) > 1000 then
    raise exception 'Duyuru en çok 1000 karakter olabilir.' using errcode = '22023';
  end if;

  v_siniflar := array(select distinct x from unnest(coalesce(p_siniflar, '{}'::uuid[])) x
                       where x is not null);
  if coalesce(array_length(v_siniflar, 1), 0) = 0 then
    raise exception 'Duyurunun gideceği en az bir şube seçilmeli.' using errcode = '22023';
  end if;

  select g.yonetici into v_yonetici from public.ogretmenler g where g.id = v_ogretmen;
  for v_sinif in
    select x as id, s.id as var_mi, s.ad, s.arsiv, s.ozel
      from unnest(v_siniflar) x
      left join public.siniflar s on s.id = x
  loop
    if v_sinif.var_mi is null or not public._ogretmenin_sinifi(v_ogretmen, v_sinif.id) then
      raise exception 'Seçilen şubelerden biri sizin şubeleriniz arasında değil.' using errcode = '42501';
    end if;
    if v_sinif.arsiv then
      raise exception '% arşivde; arşivdeki şubeye duyuru yapılamaz.', v_sinif.ad using errcode = '22023';
    end if;
    -- Özel ders öğrencileri yalnız yöneticinin (`_ogretmenin_ogrencisi`).
    if v_sinif.ozel and not coalesce(v_yonetici, false) then
      raise exception 'Özel ders grubuna yalnız yönetici duyuru yapabilir.' using errcode = '42501';
    end if;
  end loop;

  insert into public.duyurular (ogretmen_id, metin)
  values (v_ogretmen, v_metin)
  returning id into v_id;
  insert into public.duyuru_siniflari (duyuru_id, sinif_id)
  select v_id, x from unnest(v_siniflar) x;

  perform public._denetim('duyuru_yayinlandi', 'duyurular', v_id, public._aktor(v_ogretmen),
                          null, jsonb_build_object('metin', v_metin, 'siniflar', to_jsonb(v_siniflar)));

  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.duyuru_kaldir(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o          record;
  v_ogretmen uuid;
  d          record;
begin
  v_ogretmen := public._ogretmen(p_token);
  select * into o from public._oturum(p_token);
  if o.vekil_id is not null then
    raise exception 'Başka bir öğretmenin hesabındayken onun duyurusunu kaldıramazsınız.'
      using errcode = '42501';
  end if;
  select * into d from public.duyurular where id = p_id;
  -- Yalnız YAZAN öğretmen kaldırır; başkasınınki "yok" gibi görünür.
  if d.id is null or d.ogretmen_id <> v_ogretmen then
    raise exception 'Duyuru bulunamadı.' using errcode = '42501';
  end if;
  if d.kaldirildi is null then
    update public.duyurular set kaldirildi = now() where id = p_id;
    perform public._denetim('duyuru_kaldirildi', 'duyurular', p_id, public._aktor(v_ogretmen),
                            jsonb_build_object('metin', d.metin), null);
  end if;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- Öğretmenin KENDİ duyuruları (son 30 gün, kaldırılanlar hariç) ve şube
-- başına kaç öğrencinin gördüğü: acil durumda "kime ulaştı" sorusu.
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
                                    where o.sinif_id = s.id and o.aktif
                                      and public._ogrencinin_duyurusu(d.id, s.id, o.sinif_giris)),
                        'goren', (select count(*)::integer from public.ogrenciler o
                                   join public.duyuru_okundu k on k.ogrenci_id = o.id
                                  where o.sinif_id = s.id and o.aktif
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

-- -----------------------------------------------------------------------------
-- 5. ÖĞRENCİ UÇLARI — yalnız okuma ve "gördüm"; yanıt yok
-- -----------------------------------------------------------------------------
create or replace function public.ogrenci_duyurulari(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o   record;
  ogr record;
  v_son timestamptz;
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'ogrenci' then
    raise exception 'Bu bölüm yalnızca öğrenciler içindir.' using errcode = '42501';
  end if;
  select g.id, g.sinif_id, g.sinif_giris into ogr
    from public.ogrenciler g where g.id = o.ogrenci_id;
  select k.zaman into v_son from public.duyuru_okundu k where k.ogrenci_id = ogr.id;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', d.id,
             'metin', d.metin,
             'zaman', d.created_at,
             'ogretmen', t.ad,
             'yeni', d.created_at > coalesce(v_son, '-infinity'::timestamptz)
           ) order by d.created_at desc)
      from public.duyurular d
      join public.ogretmenler t on t.id = d.ogretmen_id
     where public._ogrencinin_duyurusu(d.id, ogr.sinif_id, ogr.sinif_giris)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.duyurulari_okudum(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'ogrenci' then
    raise exception 'Bu bölüm yalnızca öğrenciler içindir.' using errcode = '42501';
  end if;
  insert into public.duyuru_okundu (ogrenci_id, zaman)
  values (o.ogrenci_id, now())
  on conflict (ogrenci_id) do update set zaman = excluded.zaman;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. ogrenci_odevleri ← 0064 — yalnız `okunmamis_duyuru` eklendi
-- -----------------------------------------------------------------------------
create or replace function public.ogrenci_odevleri(p_token text)
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
  if o.rol <> 'ogrenci' then
    raise exception 'Bu bölüm yalnızca öğrenciler içindir.' using errcode = '42501';
  end if;

  select ogr2.id, ogr2.ad, ogr2.tur, s.ad as sinif, ogr2.sinif_id, ogr2.sinif_giris,
         coalesce(s.arsiv, false) as sinif_arsiv
    into ogr
  from public.ogrenciler ogr2
  left join public.siniflar s on s.id = ogr2.sinif_id
  where ogr2.id = o.ogrenci_id;

  return jsonb_build_object(
    'ogrenci', jsonb_build_object('id', ogr.id, 'ad', ogr.ad, 'sinif', ogr.sinif,
                                  'tur', ogr.tur),
    -- 0065: okunmamış duyuru — öğrenci sekme çubuğundaki Pano rozeti.
    'okunmamis_duyuru', public._okunmamis_duyuru(ogr.id, ogr.sinif_id, ogr.sinif_giris),
    'okunmamis_mesaj', (
      select count(*)::integer from public.mesajlar m
      where m.ogrenci_id = ogr.id and m.kanal = 'ogrenci' and m.kimden = 'ogretmen'
        and m.created_at > coalesce(
              (select k.zaman from public.okundu k
                where k.ogrenci_id = ogr.id and k.rol = 'ogrenci' and k.kanal = 'ogrenci'),
              '-infinity'::timestamptz)
    ),
    'odevler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'baslik', d.baslik,
        'aciklama', d.aciklama,
        'tur', d.tur,
        'son_tarih', d.son_tarih,
        'soru_sayisi', d.soru_sayisi,
        'gec_teslim', d.gec_teslim,
        'sik_sayisi', d.sik_sayisi,
        'sinif_arsiv', ogr.sinif_arsiv,
        'odev_yolu', d.odev_url,
        'gonderim', case when g.id is null then null else jsonb_build_object(
          'id', g.id, 'zaman', g.created_at, 'durum', g.durum,
          'dogru', g.dogru, 'yanlis', g.yanlis, 'bos', g.bos,
          'puan', g.puan, 'ogretmen_puan', g.ogretmen_puan,
          'ogretmen_yorum', g.ogretmen_yorum,
          'cevaplar', coalesce(g.cevaplar, '{}'::jsonb),
          'gecikmeli', public._gecikmeli(g.created_at, d.son_tarih)
        ) end,
        -- Anahtar ve konu analizi YALNIZ teslimden sonra.
        'konu_analizi', case when g.id is not null
          then public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
          else '[]'::jsonb end,
        'cevap_anahtari', case when g.id is not null then d.cevap_anahtari else null end,
        'anahtar_yolu',   case when g.id is not null then d.anahtar_url    else null end
      ) order by d.son_tarih)
      from public.odevler d
      left join public.gonderimler g
        on g.odev_id = d.id and g.ogrenci_id = ogr.id
      where d.yayinda and d.sinif_id = ogr.sinif_id
        -- 0064: sınıfa gelmeden önce son tarihi dolan ödev bu öğrencinin değil.
        and public._odev_ogrenciye_dusar(ogr.sinif_giris, d.son_tarih, d.created_at)
    ), '[]'::jsonb),
    'dersler', coalesce((
      select jsonb_agg(jsonb_build_object('zaman', l.zaman, 'mod', l.mod, 'link', l.link)
                       order by l.zaman)
      from public.dersler l
      where l.ogrenci_id = ogr.id and l.zaman > now()
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. YETKİLER
-- -----------------------------------------------------------------------------
revoke all on function public._ogrencinin_duyurusu(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public._okunmamis_duyuru(uuid, uuid, date)    from public, anon, authenticated;
revoke all on function public.okul_geneli(text)                       from public, anon, authenticated;
revoke all on function public.duyuru_yayinla(text, text, uuid[])      from public, anon, authenticated;
revoke all on function public.duyuru_kaldir(text, uuid)               from public, anon, authenticated;
revoke all on function public.ogretmen_duyurulari(text)               from public, anon, authenticated;
revoke all on function public.ogrenci_duyurulari(text)                from public, anon, authenticated;
revoke all on function public.duyurulari_okudum(text)                 from public, anon, authenticated;
grant execute on function public.okul_geneli(text)                  to anon, authenticated;
grant execute on function public.duyuru_yayinla(text, text, uuid[]) to anon, authenticated;
grant execute on function public.duyuru_kaldir(text, uuid)          to anon, authenticated;
grant execute on function public.ogretmen_duyurulari(text)          to anon, authenticated;
grant execute on function public.ogrenci_duyurulari(text)           to anon, authenticated;
grant execute on function public.duyurulari_okudum(text)            to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 8. KENDİ KENDİNİ DENETLEME
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if to_regprocedure('public._odev_ogrenciye_dusar(date, date, timestamptz)') is null then
    raise exception '0065: önce 0064 çalıştırılmalı';
  end if;
  foreach t in array array['duyurular', 'duyuru_siniflari', 'duyuru_okundu'] loop
    if not (select c.relrowsecurity and c.relforcerowsecurity from pg_class c
             where c.oid = ('public.' || t)::regclass) then
      raise exception '0065: % tablosunda RLS kapalı', t;
    end if;
    if has_table_privilege('anon', 'public.' || t, 'select') then
      raise exception '0065: % tablosu istemciye açık', t;
    end if;
  end loop;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'ogrenci_odevleri'
                    and pg_get_functiondef(p.oid) like '%okunmamis_duyuru%') then
    raise exception '0065: ogrenci_odevleri okunmamış duyuruyu döndürmüyor';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'okul_geneli'
                    and pg_get_functiondef(p.oid) like '%_odev_ogrenciye_dusar(%') then
    raise exception '0065: okul_geneli sınıf listesi kuralını kullanmıyor';
  end if;
  if has_function_privilege('anon', 'public._ogrencinin_duyurusu(uuid, uuid, date)', 'execute')
     or has_function_privilege('anon', 'public._okunmamis_duyuru(uuid, uuid, date)', 'execute') then
    raise exception '0065: yardımcı istemciye açık';
  end if;
end $$;

select public._migration_kaydet('0065');
