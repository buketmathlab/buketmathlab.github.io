-- SEKİZ — 0075: Proje raporu (Okul Gelişim Projesi izleme-değerlendirme)
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Açıklamalı tam sürüm: supabase/migrations/0075_proje_raporu.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Ayarlar → Verinizin yedeği)
-- 0074 ÇALIŞMIŞ OLMALI. Edge Function DEĞİŞMİYOR.
--
-- NE YAPIYOR: Müdür ekranına "Rapor" sekmesi gelir (siz Öğretmenler →
-- "Proje raporu" ile açarsınız). Kayıt, giriş, veli onamı, hazırlanan ödev,
-- çözümlü cevap anahtarı, kontrol edilen soru ve başarı sayıları tek sayfada;
-- yazdırılabilir. Yalnız toplu sayılar; öğrenci adı yok.
--
-- Bu dosyayı çalıştırmak hiçbir veriyi DEĞİŞTİRMEZ; yalnız okuyan bir uç ekler.
--
-- Beklenen sonuç: en altta tek satırlık bir tablo (_migration_kaydet → 0075).
-- =============================================================================

do $$
begin
  if to_regprocedure('public.deneme_hesaplari(text)') is null then
    raise exception '0075: önce 0074 çalıştırılmalı';
  end if;
end $$;

create or replace function public.proje_raporu(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o       record;
  bugun   date := (now() at time zone 'Europe/Istanbul')::date;
  v_yil_bas date;
  v_sonuc jsonb;
begin
  -- Sahip ya da müdür. Öğretmen yolunda `_yonetici` (vekâlette sahip
  -- değil → 42501); müdür kendi rolüyle.
  select * into o from public._oturum(p_token);
  if o.rol = 'mudur' then
    perform public._mudur(p_token);
  else
    perform public._yonetici(p_token);
  end if;

  v_yil_bas := make_date(
    case when extract(month from bugun) >= 9 then extract(year from bugun)::integer
         else extract(year from bugun)::integer - 1 end, 9, 1);

  with sinif as (
    select s.id, s.seviye from public.siniflar s where not s.arsiv and not s.ozel
  ),
  ogr as (
    select x.id, x.sinif_id, x.sinif_giris, s.seviye
      from public.ogrenciler x join sinif s on s.id = x.sinif_id
     where (x.aktif and not x.deneme)
  ),
  odev as (
    select d.id, coalesce(d.grup_id, d.id) as grup, d.sinif_id, s.seviye, d.tur,
           d.soru_sayisi, d.anahtar_url, d.odev_url, d.konular, d.ogretmen_id,
           d.created_at, d.son_tarih,
           date_trunc('month', (d.created_at at time zone 'Europe/Istanbul'))::date as ay
      from public.odevler d join sinif s on s.id = d.sinif_id
     where d.yayinda
  ),
  -- Hazırlanan ödev: grup başına TEK satır (ilk şube kopyası).
  hazir as (
    select distinct on (grup) * from odev order by grup, created_at, id
  ),
  -- Gönderim: o şubenin, ödevin düştüğü aktif öğrencisi (Genel ile aynı kural).
  gon as (
    select g.id, d.id as odev_id, d.tur, d.soru_sayisi, d.seviye, d.anahtar_url,
           g.dogru, g.yanlis, g.bos, coalesce(g.ogretmen_puan, g.puan) as p,
           date_trunc('month', (g.created_at at time zone 'Europe/Istanbul'))::date as ay,
           g.ogrenci_id
      from odev d
      join public.gonderimler g on g.odev_id = d.id
      join ogr x on x.id = g.ogrenci_id and x.sinif_id = d.sinif_id
                 and public._odev_ogrenciye_dusar(x.sinif_giris, d.son_tarih, d.created_at)
  ),
  giren_ogr as (
    select distinct t.ogrenci_id from public.oturumlar t
      join ogr x on x.id = t.ogrenci_id where t.rol = 'ogrenci'
    union
    select distinct ogrenci_id from gon
  ),
  onam as (
    select distinct v.ogrenci_id from public.veli_onaylari v join ogr x on x.id = v.ogrenci_id
  ),
  giren_veli as (
    select distinct t.ogrenci_id from public.oturumlar t
      join ogr x on x.id = t.ogrenci_id where t.rol = 'veli'
    union
    select ogrenci_id from onam
  )
  select jsonb_build_object(
    'rapor_zamani', now(),
    'yil_baslangici', v_yil_bas,
    'kayit', jsonb_build_object(
      'sube_sayisi', (select count(*) from sinif)::integer,
      'ogrenci_sayisi', (select count(*) from ogr)::integer,
      'giris_yapan_ogrenci', (select count(*) from giren_ogr)::integer,
      'giris_yapan_veli', (select count(*) from giren_veli)::integer,
      'veli_onami', (select count(*) from onam)::integer,
      'ilk_veli_onami', (select min(v.onay_zamani) from public.veli_onaylari v join ogr x on x.id = v.ogrenci_id),
      'ogretmen_hesabi', (select count(*) from public.ogretmenler g
                           where g.aktif and not g.mudur and g.pin_hash is not null)::integer,
      'mudur_hesabi', (select count(*) from public.ogretmenler g
                        where g.aktif and g.mudur and g.pin_hash is not null)::integer
    ),
    'odev', jsonb_build_object(
      'hazirlanan', (select count(*) from hazir)::integer,
      'subeye_ulasan', (select count(*) from odev)::integer,
      'hazirlanan_soru', (select coalesce(sum(soru_sayisi), 0) from hazir)::integer,
      'subeye_ulasan_soru', (select coalesce(sum(soru_sayisi), 0) from odev)::integer,
      'test', (select count(*) from hazir where tur = 'test')::integer,
      'acik_uclu', (select count(*) from hazir where tur = 'acik')::integer,
      'cozumlu_anahtar', (select count(*) from hazir where anahtar_url is not null)::integer,
      'soru_dosyasi', (select count(*) from hazir where odev_url is not null)::integer,
      'konu_etiketli', (select count(*) from hazir
                         where konular is not null
                           and konular not in ('{}'::jsonb, '[]'::jsonb, 'null'::jsonb))::integer
    ),
    'gonderim', jsonb_build_object(
      'toplam', (select count(*) from gon)::integer,
      'gonderen_ogrenci', (select count(distinct ogrenci_id) from gon)::integer,
      -- Genel sayfasıyla BİREBİR aynı tanım (okul_geneli, 0066): o şubenin
      -- aktif öğrencilerinin gönderdiği çözümlerdeki soru.
      'kontrol_edilen_soru', (select coalesce(sum(d.soru_sayisi), 0)
                                from odev d
                                join public.gonderimler g on g.odev_id = d.id
                                join ogr x on x.id = g.ogrenci_id and x.sinif_id = d.sinif_id
                               where d.soru_sayisi is not null)::integer,
      -- Otomatik puanlanan soru: test ödevinde doğru+yanlış+boş (iptal
      -- edilen sorular `_puanla` tarafından zaten dışarıda, 0072).
      'otomatik_puanlanan_soru', (select coalesce(sum(coalesce(dogru, 0) + coalesce(yanlis, 0) + coalesce(bos, 0)), 0)
                                   from gon where tur = 'test')::integer,
      'dogru', (select coalesce(sum(dogru), 0) from gon where tur = 'test')::integer,
      'yanlis', (select coalesce(sum(yanlis), 0) from gon where tur = 'test')::integer,
      'bos', (select coalesce(sum(bos), 0) from gon where tur = 'test')::integer,
      -- Çözümlü cevap anahtarına teslimden hemen sonra ulaşan gönderim.
      'cozume_ulasan', (select count(*) from gon where anahtar_url is not null)::integer,
      'ortalama', (select round(avg(p), 1) from gon)
    ),
    'aylar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ay', a.ay,
               'hazirlanan', (select count(*) from hazir h where h.ay = a.ay)::integer,
               'subeye_ulasan', (select count(*) from odev d where d.ay = a.ay)::integer,
               'gonderim', (select count(*) from gon g where g.ay = a.ay)::integer,
               'ortalama', (select round(avg(g.p), 1) from gon g where g.ay = a.ay)
             ) order by a.ay)
        from (select generate_series(v_yil_bas, date_trunc('month', bugun)::date,
                                     interval '1 month')::date as ay) a
    ), '[]'::jsonb),
    'seviyeler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'seviye', v.seviye,
               'sube_sayisi', (select count(*) from sinif s where s.seviye = v.seviye)::integer,
               'ogrenci_sayisi', (select count(*) from ogr x where x.seviye = v.seviye)::integer,
               'veli_onami', (select count(*) from onam n join ogr x on x.id = n.ogrenci_id
                               where x.seviye = v.seviye)::integer,
               'hazirlanan', (select count(*) from hazir h where h.seviye = v.seviye)::integer,
               'gonderim', (select count(*) from gon g where g.seviye = v.seviye)::integer,
               'ortalama', (select round(avg(g.p), 1) from gon g where g.seviye = v.seviye)
             ) order by v.seviye)
        from (select distinct seviye from sinif) v
    ), '[]'::jsonb),
    'ogretmenler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ad', g.ad,
               'hazirlanan', (select count(*) from hazir h where h.ogretmen_id = g.id)::integer,
               'soru', (select coalesce(sum(h.soru_sayisi), 0) from hazir h where h.ogretmen_id = g.id)::integer,
               'sube', (select count(distinct d.sinif_id) from odev d where d.ogretmen_id = g.id)::integer
             ) order by g.ad)
        from public.ogretmenler g
       where g.aktif and not g.mudur and g.pin_hash is not null
    ), '[]'::jsonb)
  ) into v_sonuc;

  return v_sonuc;
end;
$$;

revoke all on function public.proje_raporu(text) from public, anon, authenticated;
grant execute on function public.proje_raporu(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- ÖZ-DENETİM
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  t := pg_get_functiondef('public.proje_raporu(text)'::regprocedure);
  if t not like '%not x.deneme%' then
    raise exception '0075: proje_raporu deneme hesaplarını dışlamıyor';
  end if;
  if t not like '%not s.ozel%' then
    raise exception '0075: proje_raporu özel dersi dışlamıyor';
  end if;
end $$;

select public._migration_kaydet('0075');
