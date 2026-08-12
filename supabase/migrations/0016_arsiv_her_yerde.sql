-- =============================================================================
-- SEKİZ — 0016 ARŞİV HER YERDE GEÇERLİ
--
-- ÖĞRETMENİN SORUSU:
--   "Arşivlediğim sınıflar Panodaki kutulara tıkladığımda da arşivlenmiş
--    oluyor öyle değil mi? Bir yerde arşivlediğimde artık o sınıf başka bir
--    yerde görünmemeli. Tekrar ben geri getirene kadar."
--
-- CEVAP: HAYIR. Yerel PostgreSQL'de ölçüldü — 7A arşivlendikten sonra:
--
--   siniflar_listesi         kayboldu   ✓
--   odevler_listesi          hâlâ orada ✗
--   ogrenciler_listesi       hâlâ orada ✗
--   pano_detay(ogrenci)      hâlâ orada ✗
--   pano_detay(gondermeyen)  hâlâ orada ✗
--   ogretmen_panosu sayıları hiç değişmedi ✗
--   öğrenci hâlâ ödevi görüyor ve gönderebiliyor ✗
--
-- Yani `arsiv` bugüne kadar TEK BİR EKRANIN süzgeci olarak yazılmış, ürünün
-- kuralı olarak değil. Bu dosya onu kurala çeviriyor.
--
-- KURAL: arşivdeki sınıf öğretmenin hiçbir listesinde görünmez ve o sınıfa
-- YENİ GÖNDERİM KABUL EDİLMEZ. Hiçbir veri silinmiyor; geri alındığı anda
-- her şey aynen geri geliyor.
--
-- NEDEN GÖNDERİM DE KAPANIYOR: arşivden sonra ödev öğretmenin hiçbir
-- ekranında görünmüyor. Gönderimi açık bırakırsak öğrenci ödev yollar,
-- ödev hiçbir yere düşmez ve kimse fark etmez. Görünmeyen bir işi kabul
-- etmektense açıkça reddetmek doğru; üstelik öğretmen sınıfı geri alınca
-- kural da geri geliyor.
--
-- İKİ UÇ BİLEREK SÜZÜLMÜYOR — ikisi de KİMLİKLE çağrılıyor, listeleme
-- değil, ve arşivden geri alma yolunun üzerindeler:
--   sinif_ogrencileri(p_sinif_id)  — Sınıflar'da "Arşivdekileri göster"
--                                     deyip sınıf karnesine bakabilmek için
--   odev_gonderimleri(p_id)        — eski bir ödevin gönderimlerini açmak için
-- Öğretmen bu iki ekrana ancak arşivi bilerek açarak ulaşıyor.
--
-- Bu dosya tekrar çalıştırılabilir.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Yardımcı: sınıf arşivde mi?
--
-- `ogrenciler.sinif_id` NULL olabilir (sınıfa bağlanmamış özel ders
-- öğrencisi). `not s.arsiv` yazsaydık LEFT JOIN'de NULL çıkar ve o öğrenci
-- SESSİZCE listeden düşerdi — arşivle hiç ilgisi olmadığı hâlde. Karar tek
-- yerde toplanıyor ki bu tuzak her sorguda yeniden kurulmasın.
-- -----------------------------------------------------------------------------
create or replace function public._sinif_arsivde(p_sinif_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select coalesce((select s.arsiv from public.siniflar s where s.id = p_sinif_id), false);
$$;

revoke all on function public._sinif_arsivde(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. ogretmen_panosu — dört sayı da arşivi dışarıda bırakıyor
-- -----------------------------------------------------------------------------
create or replace function public.ogretmen_panosu(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun date := current_date;
begin
  perform public._ogretmen(p_token);

  return jsonb_build_object(
    'ogrenci_sayisi', (select count(*) from public.ogrenciler o
                        where o.aktif and not public._sinif_arsivde(o.sinif_id)),
    'odev_verilen_ogrenci', (
      select count(*)
      from public.ogrenciler o
      where o.aktif
        and not public._sinif_arsivde(o.sinif_id)
        and exists (select 1 from public.odevler d
                     where d.sinif_id = o.sinif_id and d.yayinda)
    ),
    'acik_odev', (select count(*) from public.odevler d
                   where d.yayinda and d.son_tarih >= bugun
                     and not public._sinif_arsivde(d.sinif_id)),
    'bekleyen_degerlendirme', (select count(*) from public.gonderimler g
                                join public.odevler o on o.id = g.odev_id
                               where o.tur = 'acik' and g.durum = 'incelemede'
                                 and not public._sinif_arsivde(o.sinif_id)),
    'gecikmis_eksik', (
      select count(*)
      from public.odevler o
      join public.ogrenciler ogr
        on ogr.sinif_id = o.sinif_id and ogr.aktif
      where o.yayinda and o.son_tarih < bugun
        and not public._sinif_arsivde(o.sinif_id)
        and not exists (select 1 from public.gonderimler g
                         where g.odev_id = o.id and g.ogrenci_id = ogr.id)
    ),
    'son_gonderimler', coalesce((
      select jsonb_agg(x order by x->>'zaman' desc) from (
        select jsonb_build_object(
                 'ogrenci', ogr.ad, 'odev', o.baslik,
                 'puan', coalesce(g.ogretmen_puan, g.puan),
                 'zaman', g.created_at,
                 'gecikmeli', public._gecikmeli(g.created_at, o.son_tarih)
               ) as x
        from public.gonderimler g
        join public.ogrenciler ogr on ogr.id = g.ogrenci_id
        join public.odevler o on o.id = g.odev_id
        where not public._sinif_arsivde(o.sinif_id)
        order by g.created_at desc limit 10
      ) t
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. pano_detay — dört listenin dördü de
-- -----------------------------------------------------------------------------
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
begin
  perform public._ogretmen(p_token);

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
      where o.aktif and not s.arsiv
        and exists (select 1 from public.odevler d
                     where d.sinif_id = o.sinif_id and d.yayinda)
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
                                      where g.odev_id = d.id)
               ) order by d.son_tarih)
             ) as g
      from public.odevler d
      join public.siniflar s on s.id = d.sinif_id
      where d.yayinda and d.son_tarih >= bugun and not s.arsiv
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
        where o.aktif
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

-- -----------------------------------------------------------------------------
-- 4. odevler_listesi — arşivdeki sınıfın ödevleri listede yok
--
-- Gövde 0012'deki ile aynı; tek fark `and not s.arsiv`. Dosya bütün olarak
-- tekrar yazılıyor çünkü `create or replace` parça değiştiremiyor.
-- -----------------------------------------------------------------------------
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
      -- Ortalamalar YALNIZ süre dolduktan sonra.
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
    where not s.arsiv
      and (p_sinif_id is null or d.sinif_id = p_sinif_id)
      and (p_yayinda is null or d.yayinda = p_yayinda)
  ), '[]'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. ogrenciler_listesi — arşivdeki sınıfın öğrencileri listede yok
--
-- SINIFSIZ ÖĞRENCİ DÜŞMEMELİ: `_sinif_arsivde` NULL'ı `false` sayıyor.
-- -----------------------------------------------------------------------------
create or replace function public.ogrenciler_listesi(
  p_token text,
  p_arama text default null,
  p_sinif_id uuid default null,
  p_sayfa integer default 1,
  p_boyut integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  toplam integer;
  satirlar jsonb;
begin
  perform public._ogretmen(p_token);
  p_boyut := least(greatest(coalesce(p_boyut, 25), 1), 100);
  p_sayfa := greatest(coalesce(p_sayfa, 1), 1);

  select count(*) into toplam
  from public.ogrenciler o
  where o.aktif
    and not public._sinif_arsivde(o.sinif_id)
    and (p_sinif_id is null or o.sinif_id = p_sinif_id)
    and (p_arama is null or o.ad ilike '%' || p_arama || '%');

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', o.id, 'ad', o.ad, 'tur', o.tur, 'sinif', s.ad
         ) order by o.ad), '[]'::jsonb) into satirlar
  from (
    select o.* from public.ogrenciler o
    where o.aktif
      and not public._sinif_arsivde(o.sinif_id)
      and (p_sinif_id is null or o.sinif_id = p_sinif_id)
      and (p_arama is null or o.ad ilike '%' || p_arama || '%')
    order by o.ad
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

-- -----------------------------------------------------------------------------
-- 6. odev_gonder — arşivdeki sınıfa gönderim yok
--
-- Denetim SUNUCUDA. Arayüzde düğmeyi gizlemek yetmez: kural veritabanında
-- durmazsa doğrudan istek atan biri yine gönderebilirdi.
-- -----------------------------------------------------------------------------
create or replace function public.odev_gonder(
  p_token text,
  p_odev uuid,
  p_foto_yolu text,
  p_cevaplar jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  d public.odevler;
  s record;
  yeni_id uuid;
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'ogrenci' then
    raise exception 'Yalnızca öğrenci ödev gönderebilir.' using errcode = '42501';
  end if;

  select * into d from public.odevler where id = p_odev and yayinda;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.ogrenciler ogr
    where ogr.id = o.ogrenci_id and ogr.sinif_id = d.sinif_id
  ) then
    raise exception 'Bu ödev sizin sınıfınıza ait değil.' using errcode = '42501';
  end if;

  -- Sınıf arşivdeyse ödev öğretmenin hiçbir ekranında görünmüyor; gönderim
  -- kabul etmek görünmeyen bir iş üretmek olurdu.
  if public._sinif_arsivde(d.sinif_id) then
    raise exception 'Bu sınıf kapatılmış. Öğretmeniniz açana kadar ödev gönderemezsiniz.'
      using errcode = '22023';
  end if;

  -- Geç teslim kapalıysa son tarihten sonra gönderim yok.
  if not d.gec_teslim
     and (now() at time zone 'Europe/Istanbul')::date > d.son_tarih then
    raise exception 'Bu ödevin süresi doldu. Öğretmeniniz geç teslime izin vermiyor.'
      using errcode = '22023';
  end if;

  if p_foto_yolu is null or btrim(p_foto_yolu) = '' then
    raise exception 'Çözüm fotoğrafı olmadan ödev gönderilemez.' using errcode = '22023';
  end if;

  -- Yol kendi kimliğini ve bu ödevi taşımalı.
  if not public._cozum_yolu_gecerli(o.ogrenci_id, btrim(p_foto_yolu))
     or btrim(p_foto_yolu) not like 'cozum/' || p_odev::text || '/%' then
    raise exception 'Geçersiz dosya yolu.' using errcode = '42501';
  end if;

  if d.tur = 'test' then
    select * into s from public._puanla(d.cevap_anahtari, coalesce(p_cevaplar, '{}'::jsonb), d.soru_sayisi);

    insert into public.gonderimler
      (odev_id, ogrenci_id, cevaplar, foto_yolu, dogru, yanlis, bos, puan, durum)
    values
      (p_odev, o.ogrenci_id, p_cevaplar, btrim(p_foto_yolu), s.dogru, s.yanlis, s.bos, s.puan, 'puanlandi')
    returning id into yeni_id;

    perform public._denetim('odev_gonderildi', 'gonderimler', yeni_id,
                            'ogrenci:' || o.ogrenci_id);

    return jsonb_build_object(
      'id', yeni_id, 'dogru', s.dogru, 'yanlis', s.yanlis,
      'bos', s.bos, 'puan', s.puan
    );
  else
    insert into public.gonderimler
      (odev_id, ogrenci_id, foto_yolu, durum)
    values
      (p_odev, o.ogrenci_id, btrim(p_foto_yolu), 'incelemede')
    returning id into yeni_id;

    perform public._denetim('odev_gonderildi', 'gonderimler', yeni_id,
                            'ogrenci:' || o.ogrenci_id);

    return jsonb_build_object('id', yeni_id, 'durum', 'incelemede');
  end if;

exception
  when unique_violation then
    raise exception 'Bu ödevi zaten gönderdiniz. Gönderim değiştirilemez.'
      using errcode = '23505';
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. ogrenci_odevleri — ödev görünüyor ama `sinif_arsiv` işaretli
--
-- Ödevi GİZLEMİYORUZ: öğrenci geçmiş ödevini ve aldığı puanı görmeye devam
-- etsin, hiçbir şey silinmedi. Yalnız yeni gönderim yapamayacağını arayüz
-- önceden söyleyebilsin diye bayrak ekleniyor — sunucu hatasına düşürüp
-- öğrenciyi şaşırtmak yerine.
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

  select ogr2.id, ogr2.ad, ogr2.tur, s.ad as sinif, ogr2.sinif_id,
         coalesce(s.arsiv, false) as sinif_arsiv
    into ogr
  from public.ogrenciler ogr2
  left join public.siniflar s on s.id = ogr2.sinif_id
  where ogr2.id = o.ogrenci_id;

  return jsonb_build_object(
    'ogrenci', jsonb_build_object('id', ogr.id, 'ad', ogr.ad, 'sinif', ogr.sinif),
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
        -- Sınıf kapalıysa gönderim yok; arayüz nedenini yazsın diye burada.
        'sinif_arsiv', ogr.sinif_arsiv,
        -- Soru PDF'i: teslimden bağımsız, her zaman.
        'odev_yolu', d.odev_url,
        'gonderim', case when g.id is null then null else jsonb_build_object(
          'id', g.id, 'zaman', g.created_at, 'durum', g.durum,
          'dogru', g.dogru, 'yanlis', g.yanlis, 'bos', g.bos,
          'puan', g.puan, 'ogretmen_puan', g.ogretmen_puan,
          'ogretmen_yorum', g.ogretmen_yorum,
          'cevaplar', coalesce(g.cevaplar, '{}'::jsonb),
          -- Öğrenci de kendi gecikmesini görüyor. Öğretmene görünen bir
          -- şeyin öğrenciden saklanması için bir sebep yok; üstelik geç
          -- gönderdiğini bilmesi işin yarısı.
          'gecikmeli', public._gecikmeli(g.created_at, d.son_tarih)
        ) end,
        -- Anahtar YALNIZ teslim varsa eklenir. Teslim yoksa alan hiç yok.
        'cevap_anahtari', case when g.id is not null then d.cevap_anahtari else null end,
        'anahtar_yolu',   case when g.id is not null then d.anahtar_url    else null end
      ) order by d.son_tarih)
      from public.odevler d
      left join public.gonderimler g
        on g.odev_id = d.id and g.ogrenci_id = ogr.id
      where d.yayinda and d.sinif_id = ogr.sinif_id
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
-- 8. YETKİLER (0005 deseni)
--
-- İmzalar değişmedi, yani eski yetkiler ayakta; yine de açıkça yazıyoruz ki
-- dosya tek başına okunduğunda hangi rolün neyi çağırabildiği görünsün.
-- -----------------------------------------------------------------------------
grant execute on function public.ogretmen_panosu(text)                        to anon, authenticated;
grant execute on function public.pano_detay(text, text)                       to anon, authenticated;
grant execute on function public.odevler_listesi(text, uuid, boolean)         to anon, authenticated;
grant execute on function public.ogrenciler_listesi(text, text, uuid, integer, integer)
  to anon, authenticated;
grant execute on function public.odev_gonder(text, uuid, text, jsonb)         to anon, authenticated;
grant execute on function public.ogrenci_odevleri(text)                       to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 9. KENDİ KENDİNİ DENETLEME
--
-- Yardımcının NULL davranışı bu dosyanın en kırılgan yeri: yanlış olsaydı
-- sınıfsız özel ders öğrencileri sessizce kaybolurdu. Migration burada
-- durup kendini sınıyor.
-- -----------------------------------------------------------------------------
do $$
begin
  if public._sinif_arsivde(null) then
    raise exception '_sinif_arsivde(null) true döndü; sınıfsız öğrenciler listelerden düşerdi.';
  end if;
  if not exists (select 1 from public.siniflar where not arsiv) then
    raise exception 'Hiç arşivde olmayan sınıf kalmamış; beklenmeyen durum.';
  end if;
end $$;
