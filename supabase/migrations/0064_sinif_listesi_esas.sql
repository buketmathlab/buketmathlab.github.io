-- =============================================================================
-- 0064 — SINIF LİSTESİ ESAS: gelen/giden öğrenci, şube değişikliği,
--        sonradan gelenin önceki ödevleri
--
-- Öğretmenin isteği: "Yeni listeyi eklediğimde tam olarak listedekilerden
-- oluşturmuyor sınıfı. Giden öğrencileri çıkarmıyor sistem. Verdiğim sınıf
-- listesinde kim varsa sınıfa da sadece o öğrenciler alınmalı ve hemen
-- geçmişe dönük ortalamalar ödev verileri güncellenmeli."
--
-- Öğretmenin kararları (sorulup seçildi):
--   * listede OLMAYAN öğrenci sınıftan çıkarılır, verisi KALIR
--     (`ogrenci_pasiflestir` ile aynı: kodlar iptal, ödev geçmişi durur);
--   * şube değiştiren öğrencinin AYNI kaydı yeni şubeye TAŞINIR (kodları ve
--     geçmişi korunur);
--   * sınıfa sonradan gelen öğrenciye, gelmeden önce son tarihi dolan
--     ödevler SAYILMAZ (ne "yapmadı" ne 0).
--
-- 1. ogrenciler.sinif_giris — öğrencinin BU sınıfa geldiği gün. Mevcut
--    kayıtlarda boş (= başından beri sınıfta, bugünkü hesap değişmez); yeni
--    eklenen ve taşınanlarda bugün.
-- 2. _odev_ogrenciye_dusar(sinif_giris, son_tarih, verilis) — tek kural,
--    her yerde: gelmeden önce verilmiş VE son tarihi gelmeden önce dolmuş
--    ödev o öğrenciye sayılmaz.
-- 3. siniflari_esitle(p_token, p_siniflar, p_uygula) — önizleme ve uygulama
--    AYNI plan; birden çok şube TEK işlemde (eskiden şube şube ayrı
--    çağrılardı ve ortada kopunca yarısı yazılı kalıyordu).
-- 4. SINIF LİSTESİ ESAS: ödev istatistikleri (gönderen, mevcut, iki
--    ortalama, gönderim oranı) yalnız BUGÜN sınıfta olan öğrencilerden.
--    Giden öğrencinin gönderimi sınıfın sayılarından hemen düşüyor.
--    Kopyalanıp güncellenen gövdeler:
--      sinif_not_cizelgesi, _sinif_kart_ozetleri, mudur_paneli ← 0063;
--      sinif_ogrencileri, odevler_listesi, odev_gonderimleri,
--      ogretmen_panosu ← 0055; sinif_ogrenci_ozeti ← 0053;
--      pano_detay ← 0033; ogrenci_odevleri ← 0025; veli_paneli ← 0058;
--      kendi_karnem ← 0034; _odev_kiyasi ← 0047.
-- 5. pano_detay — ÖNCEDEN KALMA KAPSAM AÇIĞI KAPANDI: panodaki sayılar
--    öğretmenin kendi sınıfları ve ödevleriyleydi ama tıklayınca açılan
--    liste bütün okulu gösteriyordu.
--
-- Bu dosya tekrar çalıştırılabilir. Ön koşul: 0063.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ŞEMA — sınıfa geliş günü
-- -----------------------------------------------------------------------------
alter table public.ogrenciler add column if not exists sinif_giris date;
-- Varsayılan SONRADAN veriliyor: sütun eklenirken verilseydi bütün mevcut
-- öğrenciler "bugün geldi" sayılır ve geçmiş ödevleri ortalamadan düşerdi.
alter table public.ogrenciler
  alter column sinif_giris set default ((now() at time zone 'Europe/Istanbul')::date);

-- -----------------------------------------------------------------------------
-- 2. TEK KURAL
-- -----------------------------------------------------------------------------
-- Ödev öğrenciye SAYILIR: sınıfa geliş günü boşsa (başından beri sınıfta),
-- ödevin son tarihi geldiği günden sonraysa (yapma fırsatı vardı) ya da ödev
-- geldikten SONRA verildiyse. Sayılmayan: gelmeden önce verilmiş VE son
-- tarihi gelmeden önce dolmuş ödev.
create or replace function public._odev_ogrenciye_dusar(
  p_sinif_giris date,
  p_son_tarih date,
  p_verilis timestamptz
)
returns boolean
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select p_sinif_giris is null
      or p_son_tarih >= p_sinif_giris
      or (p_verilis at time zone 'Europe/Istanbul')::date >= p_sinif_giris;
$$;

-- -----------------------------------------------------------------------------
-- 3. LİSTEYLE EŞİTLEME
-- -----------------------------------------------------------------------------
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
     where o.aktif and o.sinif_id = p.sinif_id
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
     where o.aktif and o.sinif_id <> p.sinif_id
       and public._ad_anahtari(o.ad) = p.anahtar
       and not (o.id = any (kullanilan))
       and not (p.no is not null and o.ogrenci_no is not null and o.ogrenci_no <> p.no);

    aday := null;
    if aday_sayi = 1 then
      select o.id into aday
        from public.ogrenciler o
        join public.siniflar so on so.id = o.sinif_id and not so.ozel
       where o.aktif and o.sinif_id <> p.sinif_id
         and public._ad_anahtari(o.ad) = p.anahtar
         and not (o.id = any (kullanilan))
         and not (p.no is not null and o.ogrenci_no is not null and o.ogrenci_no <> p.no);
    elsif aday_sayi > 1 then
      -- Numara tutan tek aday varsa o; yoksa belirsiz — tahmin edilmiyor.
      if p.no is not null then
        select (array_agg(o.id))[1] into aday
          from public.ogrenciler o
          join public.siniflar so on so.id = o.sinif_id and not so.ozel
         where o.aktif and o.sinif_id <> p.sinif_id
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
            where o.aktif and o.sinif_id <> p.sinif_id and not so.ozel
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
                                   where o.aktif and o.sinif_id = sx.id
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
     where o.aktif
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


-- -----------------------------------------------------------------------------
-- 4. HESAPLAR — SINIF LİSTESİ ESAS
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
      select o.id, o.sinif_id, o.sinif_giris
        from public.ogrenciler o
        join sinif s on s.id = o.sinif_id
       where o.aktif
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
               -- 0063: müdür ödevi ve cevap anahtarını görebiliyor.
               'odev_yolu', d.odev_url,
               'anahtar_yolu', d.anahtar_url,
               'cevap_anahtari', d.cevap_anahtari,
               'son_tarih', d.son_tarih,
               'sure_doldu', d.son_tarih < bugun_tr,
               -- 0064: SINIF LİSTESİ ESAS. Yalnız bugün sınıfta olan ve ödevin
               -- son tarihinde sınıfa gelmiş öğrenciler sayılıyor.
               'beklenen', (select count(*)::integer from public.ogrenciler o
                             where o.aktif and o.sinif_id = p_sinif_id
                               and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)),
               'gonderim', (select count(*)::integer from public.gonderimler g
                             join public.ogrenciler o on o.id = g.ogrenci_id
                            where g.odev_id = d.id and o.aktif and o.sinif_id = p_sinif_id
                              and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)),
               'ortalama', (select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1)
                              from public.gonderimler g
                              join public.ogrenciler o on o.id = g.ogrenci_id
                             where g.odev_id = d.id and o.aktif and o.sinif_id = p_sinif_id
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
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
                    and coalesce(g.ogretmen_puan, g.puan) is not null),
               'gonderim_orani', (
                 -- 0064: payda öğrenci × ödev ÇİFTLERİ; sınıfa sonradan gelenin
                 -- gelmeden önceki ödevi paydada yok.
                 select round(100.0 * count(g.id) / nullif(
                          (select count(*) from public.odevler d2
                             join public.ogrenciler o2
                               on o2.sinif_id = p_sinif_id and o2.aktif
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
                    and o.aktif and o.sinif_id = p_sinif_id
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at))
             ) order by a.ay)
        from (select generate_series(v_yil_bas, date_trunc('month', bugun_tr)::date,
                                     interval '1 month')::date as ay) a
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.sinif_ogrencileri(p_token text, p_sinif_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  s public.siniflar;
  bugun_tr date := (now() at time zone 'Europe/Istanbul')::date;
  v_odev_sayisi integer;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  if not public._ogretmenin_sinifi(v_ogretmen, p_sinif_id) then
    raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
  end if;

  select * into s from public.siniflar where id = p_sinif_id;
  if not found then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;

  -- Bu sınıfa verilmiş, yayınlanmış ve süresi dolmuş ödev sayısı.
  select count(*) into v_odev_sayisi
  from public.odevler d
  where d.sinif_id = p_sinif_id and d.yayinda and d.son_tarih < bugun_tr
    and public._odeve_erisir(v_ogretmen, d.ogretmen_id, d.sinif_id);

  return jsonb_build_object(
    'sinif', jsonb_build_object(
      'id', s.id, 'ad', s.ad, 'ozel', s.ozel, 'arsiv', s.arsiv
    ),
    -- Öğretmen "kaç ödev üzerinden konuşuyoruz" sorusunu görmeden
    -- ortalamayı yorumlayamaz.
    'degerlendirilen_odev', v_odev_sayisi,
    'ogrenciler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id,
        'ad', o.ad,
        'ogrenci_no', o.ogrenci_no,
        'tur', o.tur,
        'yapti', i.yapti,
        'yapmadi', i.beklenen - i.yapti,
        'ortalama_yapan', i.ortalama_yapan,
        'ortalama_tum', i.ortalama_tum
      -- SIRALAMA: OKUL NUMARASINA GÖRE (0044). Anahtar tek yerde
      -- (`_numara_sira`); numarasızlar sonda, kendi aralarında ada göre.
      --
      -- `nulls last` PostgreSQL'de ASC için ZATEN varsayılan; kaldırıldığında
      -- hiçbir ölçüm kırılmıyor (denendi). Yine de yazılı duruyor: bir gün
      -- sıra DESC'e çevrilirse varsayılan tersine döner ve numarasızlar
      -- listenin başına geçerdi.
      ) order by public._numara_sira(o.ogrenci_no) nulls last, o.ad)
      from public.ogrenciler o
      cross join lateral (
        select
          count(*)::integer as beklenen,
          count(g.id)::integer as yapti,
          round(avg(coalesce(g.ogretmen_puan, g.puan))
                filter (where g.id is not null), 1) as ortalama_yapan,
          -- 0064: payda ÖĞRENCİNİN kendi ödevleri — sınıfa sonradan
          -- geldiyse gelmeden önce son tarihi dolanlar yok.
          case when count(*) > 0 then
            round(sum(coalesce(g.ogretmen_puan, g.puan, 0)) / count(*), 1)
          end as ortalama_tum
        from public.odevler d
        left join public.gonderimler g
          on g.odev_id = d.id and g.ogrenci_id = o.id
        where d.sinif_id = p_sinif_id
          and d.yayinda
          and d.son_tarih < bugun_tr
          -- 0055: AYNI KÜME. Önceden `yapti` sınıfın BÜTÜN ödevlerinden,
          -- `v_odev_sayisi` yalnız öğretmenin kendi ödevlerinden sayılıyordu;
          -- yönetici o sınıfa ödev verince "yapmadı" eksiye düşüyordu.
          and public._odeve_erisir(v_ogretmen, d.ogretmen_id, d.sinif_id)
          and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
      ) i
      where o.sinif_id = p_sinif_id and o.aktif
    ), '[]'::jsonb)
  );
end;
$$;

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
      where o.sinif_id = p_sinif_id and o.aktif
    ), '[]'::jsonb)
  );
end;
$$;

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
        where g.odev_id = d.id and o.sinif_id = d.sinif_id and o.aktif
          and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
      ),
      'gec_gonderim_sayisi', (
        select count(*) from public.gonderimler g
        join public.ogrenciler o on o.id = g.ogrenci_id
        where g.odev_id = d.id and public._gecikmeli(g.created_at, d.son_tarih)
          and o.sinif_id = d.sinif_id and o.aktif
          and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
      ),
      'sinif_mevcudu', (
        select count(*) from public.ogrenciler o
        where o.sinif_id = d.sinif_id and o.aktif
          and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
      ),
      -- Ortalamalar YALNIZ süre dolduktan sonra.
      'ortalama_yapan', case when d.son_tarih < bugun_tr then (
        select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1)
        from public.gonderimler g
        join public.ogrenciler o on o.id = g.ogrenci_id
        where g.odev_id = d.id and coalesce(g.ogretmen_puan, g.puan) is not null
          and o.sinif_id = d.sinif_id and o.aktif
          and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
      ) end,
      'ortalama_tum', case when d.son_tarih < bugun_tr then (
        select round(avg(coalesce(
                 (select coalesce(g.ogretmen_puan, g.puan)
                    from public.gonderimler g
                   where g.odev_id = d.id and g.ogrenci_id = o.id), 0)), 1)
        from public.ogrenciler o
        where o.sinif_id = d.sinif_id and o.aktif
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
                  where o.sinif_id = d.sinif_id and o.aktif
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)),
      'gonderen', (select count(*) from public.gonderimler g
                    join public.ogrenciler o on o.id = g.ogrenci_id
                    where g.odev_id = d.id and o.sinif_id = d.sinif_id and o.aktif
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)),
      'gecikmeli', (select count(*) from public.gonderimler g
                     join public.ogrenciler o on o.id = g.ogrenci_id
                     where g.odev_id = d.id
                       and public._gecikmeli(g.created_at, d.son_tarih)
                       and o.sinif_id = d.sinif_id and o.aktif
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)),
      'puan_bekleyen', (select count(*) from public.gonderimler g
                         join public.ogrenciler o on o.id = g.ogrenci_id
                         where g.odev_id = d.id and g.durum = 'incelemede'
                           and o.sinif_id = d.sinif_id and o.aktif
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
        where g.odev_id = d.id and o.sinif_id = d.sinif_id and o.aktif
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
      where o.sinif_id = d.sinif_id and o.aktif
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
    ), '[]'::jsonb)
  );
end;
$$;

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
                        where o.aktif and not public._sinif_arsivde(o.sinif_id)
                          and public._ogretmenin_ogrencisi(v_ogretmen, o.id)),
    'odev_verilen_ogrenci', (
      select count(*)
      from public.ogrenciler o
      where o.aktif
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
        on ogr.sinif_id = o.sinif_id and ogr.aktif
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
          and ogr.aktif and ogr.sinif_id = o.sinif_id
          and public._odeve_erisir(v_ogretmen, o.ogretmen_id, o.sinif_id)
        order by g.created_at desc limit 10
      ) t
    ), '[]'::jsonb)
  );
end;
$$;

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
      where o.aktif and not s.arsiv
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
                                      where g.odev_id = d.id and o.aktif
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

create or replace function public.veli_paneli(p_token text)
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
  if o.rol <> 'veli' then
    raise exception 'Bu bölüm yalnızca veliler içindir.' using errcode = '42501';
  end if;

  -- ONAM KAPISI (0034) — BURADA HATA DEĞİL, ERKEN DÖNÜŞ.
  --
  -- Bu uç hata verseydi veli kabuğu çöker, veli onam metnini bile
  -- göremeden beyaz ekranda kalırdı. Bunun yerine çocuğa ait TEK BİR
  -- ALAN bile okunmadan dönülüyor: aşağıdaki `select ... into ogr` hiç
  -- çalışmıyor. Kapı yine sunucuda; arayüz sadece ne çizeceğini
  -- öğreniyor.
  if not exists (
    select 1 from public.veli_onaylari v
    where v.ogrenci_id = o.ogrenci_id
      and v.metin_surumu = public._gecerli_onam_surumu()
  ) then
    return jsonb_build_object(
      'onam_gerekli', true,
      'surum', public._gecerli_onam_surumu()
    );
  end if;

  select ogr2.id, ogr2.ad, ogr2.tur, s.ad as sinif, ogr2.sinif_id, ogr2.sinif_giris into ogr
  from public.ogrenciler ogr2
  left join public.siniflar s on s.id = ogr2.sinif_id
  where ogr2.id = o.ogrenci_id;

  return jsonb_build_object(
    'ogrenci', jsonb_build_object('ad', ogr.ad, 'sinif', ogr.sinif, 'tur', ogr.tur),

    -- GENEL ORTALAMA (0029) — YALNIZ ÇOCUĞUN KENDİSİ.
    --
    -- 0047'YE KADAR BURADA ŞU YAZIYORDU: "Sınıf ortalaması, sıralama,
    -- başka öğrencinin verisi BURAYA DA eklenmiyor." O CÜMLE ARTIK
    -- DOĞRU DEĞİL ve silinmek yerine düzeltiliyor: öğretmen ve okul
    -- müdürü 0047'de ödev BAZINDA sınıf/seviye ortalamasının görünmesine
    -- karar verdi (aşağıdaki 'kiyas' alanı).
    --
    -- DEĞİŞMEYEN KISIM: bu alan, yani ÇOCUĞUN GENEL ortalaması, hâlâ
    -- yalnız çocuğun kendisi. Sıralama hiçbir yerde yok, başka bir
    -- öğrencinin verisi hiçbir yerde yok. Kıyas ödev bazında ve
    -- İSİMSİZ bir toplamdan ibaret.
    --
    -- GÖNDERİLMEYEN ÖDEV 0 OLARAK GİRMİYOR. Tanıtım metninin kendi
    -- cümlesi bunu söylüyor: "Yapılmayan ödevler puanlandırılmaz."
    -- Puanlanmamış bir işi ortalamaya sıfırla katmak, öğrenciyi
    -- yapmadığı bir sınavdan kalmış gibi gösterirdi.
    --
    -- Ölçüt `kendi_karnem.odev_sayisi` ile aynı pencereyi kullanıyor
    -- (yayında + süresi dolmuş) ki ekrandaki "N değerlendirilmiş ödev
    -- üzerinden" satırıyla aynı şeyden söz etsin.
    --
    -- Puan `coalesce(ogretmen_puan, puan)`: arayüzdeki ve
    -- `sinif_ogrencileri`'ndeki hesabın aynısı.
    'genel_ortalama', (
      select round(avg(coalesce(g2.ogretmen_puan, g2.puan)), 1)
        from public.gonderimler g2
        join public.odevler d2 on d2.id = g2.odev_id
       where g2.ogrenci_id = ogr.id
         and d2.sinif_id = ogr.sinif_id
         and d2.yayinda
         and d2.son_tarih < (now() at time zone 'Europe/Istanbul')::date
         and coalesce(g2.ogretmen_puan, g2.puan) is not null
    ),
    'odevler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'baslik', d.baslik,
        'son_tarih', d.son_tarih,
        'olusturma', d.created_at,
        'gonderildi', (g.id is not null),
        'gonderim_zamani', g.created_at,
        'puan', coalesce(g.ogretmen_puan, g.puan),
        'durum', g.durum,
        'konu_analizi', case when g.id is not null
          then public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
          else '[]'::jsonb end,
        -- ÖDEV KIYASI (0047) — satırın İÇİNE gömülü, çünkü veliye ödev
        -- kimliği gitmiyor ve kimlikle ayrı bir çağrı yapamıyor.
        -- `konu_analizi` ile aynı desen, hesabı `_odev_kiyasi` yapıyor:
        -- öğrencinin gördüğü sayıyla veliye giden sayı AYNI koddan.
        'kiyas', public._odev_kiyasi(d.id),
        -- VELİYE YALNIZ NUMARA. Şık gitmiyor (Kural 6).
        'yanlis_sorular', case when g.id is not null and d.tur = 'test'
          then public._soru_dokumu(d.cevap_anahtari, g.cevaplar, d.soru_sayisi) -> 'yanlis'
          else '[]'::jsonb end,
        'bos_sorular', case when g.id is not null and d.tur = 'test'
          then public._soru_dokumu(d.cevap_anahtari, g.cevaplar, d.soru_sayisi) -> 'bos'
          else '[]'::jsonb end
      ) order by d.son_tarih desc)
      from public.odevler d
      left join public.gonderimler g
        on g.odev_id = d.id and g.ogrenci_id = ogr.id
      where d.yayinda and d.sinif_id = ogr.sinif_id
        and public._odev_ogrenciye_dusar(ogr.sinif_giris, d.son_tarih, d.created_at)
    ), '[]'::jsonb),
    -- YALNIZ VELİ YAZIŞMASI. Öğrencinin öğretmenle yazdıkları buradan
    -- ÇIKMIYOR: çocuk da öğretmenine velisinin okumayacağını varsayarak
    -- yazıyor. Ayrım tabloda, arayüzde değil.
    'mesajlar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kimden', m.kimden, 'metin', m.metin, 'zaman', m.created_at,
               -- 0058: mesaj hangi öğretmenle olan yazışmaya ait.
               'ogretmen_id', m.ogretmen_id,
               'ogretmen', (select g.ad from public.ogretmenler g where g.id = m.ogretmen_id))
             order by m.created_at)
      from public.mesajlar m
      where m.ogrenci_id = ogr.id and m.kanal = 'veli'
    ), '[]'::jsonb),
    -- 0058: velinin mesaj yazabileceği öğretmenler (sınıf öğretmeni önce).
    'ogretmenler', public._ogrencinin_ogretmenleri(ogr.id),
    'okunmamis_mesaj', (
      select count(*)::integer from public.mesajlar m
      where m.ogrenci_id = ogr.id and m.kanal = 'veli' and m.kimden = 'ogretmen'
        and m.created_at > coalesce(
              (select k.zaman from public.okundu k
                where k.ogrenci_id = ogr.id and k.rol = 'veli' and k.kanal = 'veli'),
              '-infinity'::timestamptz)
    ),
    'odemeler', case when ogr.tur = 'ozel' then coalesce((
      select jsonb_agg(jsonb_build_object('tutar', p.tutar, 'tarih', p.tarih, 'odendi', p.odendi)
                       order by p.tarih desc)
      from public.odemeler p where p.ogrenci_id = ogr.id
    ), '[]'::jsonb) else '[]'::jsonb end,
    -- KANAL SÜZGECİ DE ŞART. 0019'da rol süzgeci unutulunca alt sorgu üç
    -- satır dönüp fonksiyon çökmüştü; anahtar üç sütuna çıkınca aynı tuzak
    -- kanal için yeniden kuruluyor.
    'son_gorulme', (select k.zaman from public.okundu k
                     where k.ogrenci_id = ogr.id and k.rol = 'veli' and k.kanal = 'veli')
  );
end;
$$;

create or replace function public.kendi_karnem(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun_tr      date := (now() at time zone 'Europe/Istanbul')::date;
  o             record;
  v_ogrenci_id  uuid;
  v_ad          text;
  v_sinif_id    uuid;
  v_sinif_ad    text;
  v_odev_sayisi integer;
  v_giris       date;
begin
  select * into o from public._oturum(p_token);
  -- ONAM KAPISI (0034). Veli dışındaki rollerde etkisiz: bu iki uç
  -- öğrenci tarafından da kullanılıyor.
  perform public._onam_kapisi(o.rol, o.ogrenci_id);

  -- ÖĞRETMEN BURAYA GİRMİYOR. Onun ucu `konu_karnesi` ve orada sınıf ya da
  -- öğrenci seçebiliyor; burada seçilecek bir şey yok.
  if o.rol not in ('ogrenci', 'veli') then
    raise exception 'Bu bölüm öğrenci ve veli içindir.' using errcode = '42501';
  end if;
  if o.ogrenci_id is null then
    raise exception 'Geçersiz oturum.' using errcode = '42501';
  end if;

  v_ogrenci_id := o.ogrenci_id;

  select g.ad, g.sinif_id, g.sinif_giris into v_ad, v_sinif_id, v_giris
    from public.ogrenciler g where g.id = v_ogrenci_id;
  if v_ad is null then
    raise exception 'Öğrenci bulunamadı.' using errcode = 'P0002';
  end if;

  select s.ad into v_sinif_ad from public.siniflar s where s.id = v_sinif_id;

  -- 0013 VE 0023 İLE BİREBİR AYNI ÖLÇÜT.
  select count(*)::integer into v_odev_sayisi
  from public.odevler d
  where d.sinif_id = v_sinif_id and public._odev_ogrenciye_dusar(v_giris, d.son_tarih, d.created_at) and d.yayinda and d.son_tarih < bugun_tr;

  return jsonb_build_object(
    -- `mevcut` YOK (0023'te var). Sınıfın kaç kişi olduğu bu ekrana ait
    -- değil; kıyasın en küçük tohumu bile gönderilmiyor.
    'kapsam', jsonb_build_object('ad', v_ad, 'sinif', v_sinif_ad),

    -- "Kaç ödev üzerinden konuşuyoruz" — iki konu arasındaki farkı
    -- yorumlayabilmek için gereken tek bağlam sayısı.
    'odev_sayisi', v_odev_sayisi,

    -- GENEL ORTALAMA (0029) — YALNIZ ÇOCUĞUN KENDİSİ.
    --
    -- Sınıf ortalaması, sıralama, başka öğrencinin verisi BURAYA DA
    -- eklenmiyor; 0026'da bilerek dışarıda bırakılmışlardı ve o karar
    -- değişmedi. Çocuk kendi gidişatını görüyor, kimseyle
    -- karşılaştırılmıyor.
    --
    -- GÖNDERİLMEYEN ÖDEV 0 OLARAK GİRMİYOR. Tanıtım metninin kendi
    -- cümlesi bunu söylüyor: "Yapılmayan ödevler puanlandırılmaz."
    -- Puanlanmamış bir işi ortalamaya sıfırla katmak, öğrenciyi
    -- yapmadığı bir sınavdan kalmış gibi gösterirdi.
    --
    -- Ölçüt `kendi_karnem.odev_sayisi` ile aynı pencereyi kullanıyor
    -- (yayında + süresi dolmuş) ki ekrandaki "N değerlendirilmiş ödev
    -- üzerinden" satırıyla aynı şeyden söz etsin.
    --
    -- Puan `coalesce(ogretmen_puan, puan)`: arayüzdeki ve
    -- `sinif_ogrencileri`'ndeki hesabın aynısı.
    'genel_ortalama', (
      select round(avg(coalesce(g2.ogretmen_puan, g2.puan)), 1)
        from public.gonderimler g2
        join public.odevler d2 on d2.id = g2.odev_id
       where g2.ogrenci_id = v_ogrenci_id
         and d2.sinif_id = v_sinif_id
         and d2.yayinda
         and d2.son_tarih < bugun_tr
         and coalesce(g2.ogretmen_puan, g2.puan) is not null
    ),

    -- -----------------------------------------------------------------
    -- KONU DÖKÜMÜ — yalnız TEST ödevlerinden (0023 ile aynı gerekçe)
    --
    -- Açık uçlu ödevin konu eşlemesi yok: anahtarı olmayan bir ödevde
    -- `_konu_analizi` her soruyu "boş" sayardı ve döküm, öğretmenin hiç
    -- sormadığı bir soruya uydurma bir cevap verirdi.
    --
    -- Sıralama da aynı: en çok eksik olan konu başta. Arayüz bu sırayı
    -- bozmuyor — bozsaydı "en zayıf konu" iddiası ekrandan ekrana
    -- değişebilirdi.
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
        cross join lateral jsonb_array_elements(
          public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
        ) e
        where d.sinif_id = v_sinif_id and public._odev_ogrenciye_dusar(v_giris, d.son_tarih, d.created_at)
          and d.yayinda
          and d.son_tarih < bugun_tr
          and d.tur = 'test'
          -- TEK BAĞ: kendi gönderimleri. Başka öğrencinin cevabı bu
          -- toplama hiçbir koşulda giremez.
          and g.ogrenci_id = v_ogrenci_id
        group by e->>'konu'
      ) t
    ), '[]'::jsonb),

    -- -----------------------------------------------------------------
    -- GELİŞİM — ödev ödev, kronolojik
    --
    -- AÇIK UÇLU ÖDEV BURADA VAR: konu eşlemesi yok ama puanı var, ve
    -- "dönem boyunca nereye gidiyorum" sorusunun cevabından açık uçlu
    -- ödevleri çıkarmak resmin yarısını silerdi.
    --
    -- GÖNDERİLMEYEN ÖDEV 0 DEĞİL, BOŞ (`deger: null`). Sıfır yazmak
    -- "sıfır aldı" demektir; göndermemek başka bir şeydir.
    --
    -- `gonderen` VE `mevcut` YOK (0023'te var). Onlar sınıf bilgisi;
    -- burada "kaç kişiden kaçı gönderdi" demek kıyas kapısını açardı.
    -- `Gelisim` bileşeni `kapsam='ogrenci'` iken o alanları zaten
    -- çizmiyor (ölçüldü), yani ekranda bir eksiklik oluşmuyor.
    --
    -- HİÇBİR EĞİLİM İDDİASI YOK: ne "yükseliyor" ne "düşüyor". Üç
    -- noktadan yön çıkarmak ölçemeyeceğim bir iddia olurdu.
    -- -----------------------------------------------------------------
    'gelisim', coalesce((
      select jsonb_agg(jsonb_build_object(
               'odev', d.baslik,
               'tarih', d.son_tarih,
               'tur', d.tur,
               'deger', i.deger)
             order by d.son_tarih, d.baslik)
      from public.odevler d
      cross join lateral (
        select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1) as deger
        from public.gonderimler g
        where g.odev_id = d.id and g.ogrenci_id = v_ogrenci_id
      ) i
      where d.sinif_id = v_sinif_id and public._odev_ogrenciye_dusar(v_giris, d.son_tarih, d.created_at)
        and d.yayinda
        and d.son_tarih < bugun_tr
    ), '[]'::jsonb)
  );
end;
$$;

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
                            and k.aktif and k.sinif_id = d.sinif_id
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
                            and k.aktif and k.sinif_id = d2.sinif_id
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

-- -----------------------------------------------------------------------------
-- 5. YETKİLER
-- -----------------------------------------------------------------------------
revoke all on function public._odev_ogrenciye_dusar(date, date, timestamptz) from public, anon, authenticated;
revoke all on function public.siniflari_esitle(text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.siniflari_esitle(text, jsonb, boolean) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. KENDİ KENDİNİ DENETLEME
-- -----------------------------------------------------------------------------
do $$
declare
  ad text;
begin
  if to_regprocedure('public._sinif_kart_ozetleri(uuid[], uuid)') is null then
    raise exception '0064: önce 0063 çalıştırılmalı';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'ogrenciler'
                    and column_name = 'sinif_giris') then
    raise exception '0064: sinif_giris sütunu yok';
  end if;
  foreach ad in array array['_sinif_kart_ozetleri', 'mudur_paneli', 'sinif_not_cizelgesi',
                            'sinif_ogrencileri', 'sinif_ogrenci_ozeti', 'odevler_listesi',
                            'odev_gonderimleri', 'ogretmen_panosu', 'pano_detay',
                            'ogrenci_odevleri', 'veli_paneli', 'kendi_karnem', '_odev_kiyasi'] loop
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = ad
                      and pg_get_functiondef(p.oid) like '%_odev_ogrenciye_dusar(%') then
      raise exception '0064: % sınıf listesi kuralını kullanmıyor', ad;
    end if;
  end loop;
  if has_function_privilege('anon', 'public._odev_ogrenciye_dusar(date, date, timestamptz)', 'execute') then
    raise exception '0064: yardımcı istemciye açık';
  end if;
end $$;

select public._migration_kaydet('0064');
