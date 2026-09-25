-- SEKİZ — 0054: bildirimler (zil + liste + rozet)
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Açıklamalı tam sürüm: supabase/migrations/0054_bildirimler.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Yedek)
-- BU SQL ÖNCE ÇALIŞMALI, SİTE SONRA YAYINA ALINMALI.
--
-- NE YAPIYOR: öğrenci ve veli, bugüne kadar yalnız yeni mesaj için bir
-- işaret görüyordu. Bu SQL dört olayı da haber veriyor:
--   • öğretmenden yeni mesaj
--   • yeni ödev yayınlandı
--   • ödev teslimi yarın (YALNIZ ÖĞRENCİYE — sizin kararınız)
--   • ödev değerlendirildi (yalnız açık uçlu ödevde — sizin kararınız)
--
-- BİLDİRİM DEFTERİ TUTULMUYOR, satırlar o anki durumdan türetiliyor.
-- Kazancı şu: bir ödevi yayından kaldırdığınızda "yeni ödev" bildirimi
-- aynı anda kayboluyor, öğrenci ödevini gönderdiğinde "teslimi yarın"
-- hatırlatması kendiliğinden düşüyor.
--
-- İKİ DEĞİŞİKLİK VERİDE:
--   1. `odevler` tablosuna `yayin_zamani` sütunu ekleniyor. Bugüne kadar
--      ödevin YAYINLANDIĞI an kayıtlı değildi; "yeni ödev" bildirimi
--      onsuz olmuyor. Eski ödevler denetim izinden damgalanıyor, izi
--      olmayanlar oluşturulma tarihinden — kaç ödev hangi kaynaktan
--      damgalandığını çalışırken bildiriyor.
--   2. `bildirim_gorulme` adında küçük bir tablo açılıyor: kimin
--      bildirimleri en son ne zaman gördüğü. Rozetin saydığı şey bu.
--
-- Hiçbir veri SİLİNMİYOR. Öğrenci/veli adı, notu, ödevi değişmiyor.
--
-- TELEFONA BİLDİRİM GİTMİYOR: bu tur uygulama içi. Öğrenci uygulamayı
-- açtığında görüyor; ekranda bu açıkça yazıyor.
--
-- Beklenen sonuç: en altta tek satırlık bir tablo (_migration_kaydet → 0054).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. `odevler.yayin_zamani` — YAYIN ANININ DAMGASI
--
-- `odevler.updated_at` KULLANILAMAZ: `odevler_updated_at` tetikleyicisi
-- her düzenlemede onu ileri atıyor, yani bir ay önce yayınlanmış ödevin
-- başlığı bugün düzeltilse "yeni ödev" bildirimi dirilirdi.
-- -----------------------------------------------------------------------------
alter table public.odevler add column if not exists yayin_zamani timestamptz;

comment on column public.odevler.yayin_zamani is
  '0054: ödevin İLK yayına alındığı an. Bildirim listesi bunu kullanıyor; '
  'updated_at her düzenlemede ilerlediği için oradan türetilemez.';

-- GERİYE DÖNÜK DOLDURMA — 0041'in çıpalı deseni.
--
-- Bugün yayında olan ödevlerin yayın anı bilinmiyor, ama `denetim_izi`'nde
-- `odev_yayinlandi` kaydı var. Çıpası tutmayan ödev `created_at`'e
-- düşüyor ve kaç ödevin hangi kaynaktan damgalandığı BİLDİRİLİYOR —
-- sessiz bir tahmin, tahmin olduğunu söylemeyen bir tahmindir.
do $$
declare
  v_iz  integer;
  v_cpa integer;
begin
  update public.odevler d
     set yayin_zamani = (
           select min(i.zaman) from public.denetim_izi i
            where i.tablo = 'odevler' and i.kayit_id = d.id
              and i.islem = 'odev_yayinlandi')
   where d.yayinda and d.yayin_zamani is null
     and exists (select 1 from public.denetim_izi i
                  where i.tablo = 'odevler' and i.kayit_id = d.id
                    and i.islem = 'odev_yayinlandi');
  get diagnostics v_iz = row_count;

  update public.odevler d
     set yayin_zamani = d.created_at
   where d.yayinda and d.yayin_zamani is null;
  get diagnostics v_cpa = row_count;

  raise notice '0054: yayın damgası — % ödev denetim izinden, % ödev created_at''ten',
    v_iz, v_cpa;
end $$;

-- `odev_yayinla` YENİDEN KURULUYOR — İMZA AYNI (text, uuid), 0007 tuzağı yok.
--
-- Gövde 0033'ten birebir alındı; tek değişiklik `update` satırı.
-- `coalesce` bilinçli: ödev yayından kaldırılıp tekrar yayınlanırsa damga
-- DEĞİŞMİYOR, yoksa eski bir ödev ikinci kez "yeni" olurdu.
create or replace function public.odev_yayinla(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ogretmen uuid;
  v_odev     record;
  eksik      integer := 0;
  i          integer;
begin
  v_ogretmen := public._ogretmen(p_token);

  select d.id, d.tur, d.soru_sayisi, d.cevap_anahtari, d.sinif_id
    into v_odev
    from public.odevler d where d.id = p_id;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;
  if not public._ogretmenin_sinifi(v_ogretmen, v_odev.sinif_id) then
    raise exception 'Bu ödev sizin sınıflarınızdan birine ait değil.'
      using errcode = '42501';
  end if;

  -- EKSİK ANAHTARLA YAYINLANMIYOR (0033'ten aynen). Test ödevinde her
  -- sorunun karşılığı olmalı; yoksa öğrenci gönderir ve puanı yanlış
  -- hesaplanır.
  if v_odev.tur = 'test' then
    for i in 1..coalesce(v_odev.soru_sayisi, 0) loop
      if coalesce(v_odev.cevap_anahtari, '{}'::jsonb) ->> i::text is null then
        eksik := eksik + 1;
      end if;
    end loop;
    if eksik > 0 then
      raise exception 'Cevap anahtarında % soru eksik. Yayınlamadan önce tamamlayın.', eksik
        using errcode = '22023';
    end if;
  end if;

  update public.odevler
     set yayinda = true,
         yayin_zamani = coalesce(yayin_zamani, now())   -- YALNIZ İLK YAYINDA
   where id = p_id;

  perform public._denetim('odev_yayinlandi', 'odevler', p_id, public._aktor(v_ogretmen));
  return jsonb_build_object('durum', 'tamam');
end;
$$;

revoke all on function public.odev_yayinla(text, uuid) from public, anon, authenticated;
grant execute on function public.odev_yayinla(text, uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. `bildirim_gorulme` — GÖRÜLME İŞARETİ
--
-- `okundu` tablosuna YENİ BİR `kanal` DEĞERİ OLARAK EKLENMİYOR: o tablonun
-- `kanal` ve `rol` kısıtlarını genişletmek, onu kullanan üç ucu (mesaj
-- rozeti, `ogretmen_okudu`, `yazisma_listesi`) aynı anda riske atardı ve
-- 0019'un dosyada yazılı uyarısı tam olarak o tablonun paylaşılmasının
-- kafa karıştırdığını söylüyor. Ayrı tablo, aynı şekil.
-- -----------------------------------------------------------------------------
create table if not exists public.bildirim_gorulme (
  ogrenci_id uuid not null references public.ogrenciler(id) on delete cascade,
  rol        text not null check (rol in ('ogrenci', 'veli')),
  zaman      timestamptz not null default now(),
  primary key (ogrenci_id, rol)
);

alter table public.bildirim_gorulme enable row level security;

comment on table public.bildirim_gorulme is
  '0054: bildirim listesinin en son ne zaman görüldüğü. `okundu` ile '
  'karıştırılmasın — o mesaj okuma işareti ve üç ayrı uç tarafından '
  'kullanılıyor.';

-- -----------------------------------------------------------------------------
-- 3. `_bildirimlerim` — DÖRT KAYNAĞIN BİRLEŞİMİ (içeride, anon'a kapalı)
-- -----------------------------------------------------------------------------
create or replace function public._bildirimlerim(p_ogrenci_id uuid, p_rol text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  -- Sunucu UTC'de; sade `current_date` Türkiye'de gece yarısından sonra
  -- bir gün geriden gelir ve "teslimi yarın" yanlış güne düşerdi.
  bugun_tr  date := (now() at time zone 'Europe/Istanbul')::date;
  v_sinif   uuid;
  v_goruldu timestamptz;
begin
  select o.sinif_id into v_sinif
    from public.ogrenciler o
   where o.id = p_ogrenci_id and o.aktif;
  if not found then
    -- Pasif öğrenci (0016): liste boş, hata değil. Oturumu zaten
    -- `ogrenci_pasiflestir` kapatıyor; buraya düşerse sessiz kalsın.
    return '[]'::jsonb;
  end if;
  if public._sinif_arsivde(v_sinif) then
    return '[]'::jsonb;
  end if;

  select g.zaman into v_goruldu
    from public.bildirim_gorulme g
   where g.ogrenci_id = p_ogrenci_id and g.rol = p_rol;
  v_goruldu := coalesce(v_goruldu, '-infinity'::timestamptz);

  return coalesce((
    select jsonb_agg(s order by (s->>'zaman')::timestamptz desc)
      from (
        -- --------------------------------------------------------------
        -- MESAJ — öğretmenden gelen, KENDİ KANALINDAN.
        -- `kanal = p_rol` eşitliği 0048'de kullanılanın aynısı: veli
        -- kanalında veli, öğrenci kanalında öğrenci.
        -- --------------------------------------------------------------
        select jsonb_build_object(
                 'tur', 'mesaj',
                 'zaman', m.created_at,
                 'baslik', null,
                 'odev_id', null,
                 'yeni', m.created_at > v_goruldu) as s
          from public.mesajlar m
         where m.ogrenci_id = p_ogrenci_id
           and m.kimden = 'ogretmen'
           and m.kanal = p_rol
           and m.created_at > now() - interval '30 days'

        union all

        -- --------------------------------------------------------------
        -- YENİ ÖDEV — yayında olan. Yayından kaldırılan ödev buradan
        -- KENDİLİĞİNDEN düşüyor; defterin yapamayacağı şey bu.
        -- --------------------------------------------------------------
        select jsonb_build_object(
                 'tur', 'odev',
                 'zaman', d.yayin_zamani,
                 'baslik', d.baslik,
                 'odev_id', d.id,
                 'yeni', d.yayin_zamani > v_goruldu)
          from public.odevler d
         where d.sinif_id = v_sinif
           and d.yayinda
           and d.yayin_zamani is not null
           and d.yayin_zamani > now() - interval '30 days'

        union all

        -- --------------------------------------------------------------
        -- TESLİM YAKLAŞIYOR — YALNIZ ÖĞRENCİYE (öğretmenin kararı).
        --
        -- Gerekçe kayda geçiyor: o hatırlatma çocuğa YAPILACAK İŞİ
        -- söylüyor; veliye gitse aynı cümle baskı aracına dönüşebilir.
        --
        -- Gönderimi olan ödev listeden kendiliğinden düşüyor.
        --
        -- SON GÜN DE LİSTEDE: satır bir gün önce doğuyor ve teslim günü
        -- boyunca duruyor. Bu İKİNCİ BİR HATIRLATMA DEĞİL (öğretmenin
        -- kararı bir tane) — öğrenci uygulamayı o gün açmadıysa satır
        -- sessizce kaybolmasın diye. Süre geçince düşüyor.
        -- --------------------------------------------------------------
        select jsonb_build_object(
                 'tur', 'teslim',
                 'zaman', ((d.son_tarih - 1)::timestamptz),
                 'baslik', d.baslik,
                 'odev_id', d.id,
                 'yeni', ((d.son_tarih - 1)::timestamptz) > v_goruldu)
          from public.odevler d
         where p_rol = 'ogrenci'
           and d.sinif_id = v_sinif
           and d.yayinda
           and d.son_tarih in (bugun_tr + 1, bugun_tr)
           and not exists (select 1 from public.gonderimler g
                            where g.odev_id = d.id and g.ogrenci_id = p_ogrenci_id)

        union all

        -- --------------------------------------------------------------
        -- SONUÇ AÇIKLANDI — YALNIZ AÇIK UÇLU ÖDEVDE (öğretmenin kararı).
        --
        -- Test ödevinde puan gönderim anında hesaplanıyor (`_puanla`) ve
        -- öğrenci onu aynı ekranda görüyor; ikinci kez haber vermek
        -- gürültü olurdu.
        --
        -- `updated_at` `gonderimler_updated_at` tetikleyicisinden geliyor
        -- (0001). Öğretmen puanı sonradan düzeltirse satır yeniden "yeni"
        -- oluyor — yanlış değil: yeniden değerlendirme gerçekten haberdir.
        -- --------------------------------------------------------------
        select jsonb_build_object(
                 'tur', 'sonuc',
                 'zaman', g.updated_at,
                 'baslik', d.baslik,
                 'odev_id', d.id,
                 'yeni', g.updated_at > v_goruldu)
          from public.gonderimler g
          join public.odevler d on d.id = g.odev_id
         where g.ogrenci_id = p_ogrenci_id
           and d.tur = 'acik'
           and g.durum = 'onaylandi'
           and g.ogretmen_puan is not null
           and g.updated_at > now() - interval '30 days'
      ) t
     -- SINIR: en çok 50 satır. Sınırsız bir liste telefonda hem yavaş
     -- hem okunmaz.
     limit 50
  ), '[]'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. ÜÇ AÇIK UÇ
-- -----------------------------------------------------------------------------

create or replace function public.bildirimlerim(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o      record;
  liste  jsonb;
begin
  select * into o from public._oturum(p_token);
  perform public._onam_kapisi(o.rol, o.ogrenci_id);

  if o.rol not in ('ogrenci', 'veli') then
    raise exception 'Bu bölüm öğrenci ve veli içindir.' using errcode = '42501';
  end if;
  if o.ogrenci_id is null then
    raise exception 'Geçersiz oturum.' using errcode = '42501';
  end if;

  liste := public._bildirimlerim(o.ogrenci_id, o.rol);

  return jsonb_build_object(
    'bildirimler', liste,
    'toplam_yeni', (
      select count(*)::integer from jsonb_array_elements(liste) e
       where (e->>'yeni')::boolean)
  );
end;
$$;

create or replace function public.bildirim_goruldu(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
begin
  select * into o from public._oturum(p_token);
  perform public._onam_kapisi(o.rol, o.ogrenci_id);

  if o.rol not in ('ogrenci', 'veli') then
    raise exception 'Bu bölüm öğrenci ve veli içindir.' using errcode = '42501';
  end if;
  if o.ogrenci_id is null then
    raise exception 'Geçersiz oturum.' using errcode = '42501';
  end if;

  insert into public.bildirim_gorulme (ogrenci_id, rol, zaman)
  values (o.ogrenci_id, o.rol, now())
  on conflict (ogrenci_id, rol) do update set zaman = now();

  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- ROZET İÇİN AYRI UÇ (0022'nin gerekçesi): rozet her ekranda duruyor ve
-- aralıklı yokleniyor; sekme açılmadan bildirim metinlerini indirmenin
-- sebebi yok.
--
-- AMA AYNI SORGUYU ÇAĞIRIYOR. İkinci bir sayma sorgusu yazılmadı: 0030'un
-- dersi — iki yol bir gün ayrışır ve rozet "3" derken listede 2 satır
-- çıkar. Liste 50 satırla sınırlı olduğu için bedeli de yok.
create or replace function public.bildirim_sayim(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
begin
  select * into o from public._oturum(p_token);
  perform public._onam_kapisi(o.rol, o.ogrenci_id);

  if o.rol not in ('ogrenci', 'veli') then
    raise exception 'Bu bölüm öğrenci ve veli içindir.' using errcode = '42501';
  end if;
  if o.ogrenci_id is null then
    raise exception 'Geçersiz oturum.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'yeni', (
      select count(*)::integer
        from jsonb_array_elements(public._bildirimlerim(o.ogrenci_id, o.rol)) e
       where (e->>'yeni')::boolean)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. YETKİLER
--
-- `_bildirimlerim` DAHİLİ: anon çağıramaz. Açık üç uç `_oturum`'dan
-- geçiyor, yani jetonsuz kimse giremiyor.
-- -----------------------------------------------------------------------------
revoke all on function public._bildirimlerim(uuid, text) from public, anon, authenticated;

revoke all on function public.bildirimlerim(text)     from public, anon, authenticated;
revoke all on function public.bildirim_goruldu(text)  from public, anon, authenticated;
revoke all on function public.bildirim_sayim(text)    from public, anon, authenticated;

grant execute on function public.bildirimlerim(text)     to anon, authenticated;
grant execute on function public.bildirim_goruldu(text)  to anon, authenticated;
grant execute on function public.bildirim_sayim(text)    to anon, authenticated;

-- -----------------------------------------------------------------------------
-- KENDİNİ DENETLEME
-- -----------------------------------------------------------------------------
do $$
declare
  eksik text[] := '{}';
  f     text;
begin
  if to_regclass('public.bildirim_gorulme') is null then
    eksik := eksik || 'bildirim_gorulme tablosu yok'::text;
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'odevler'
       and column_name = 'yayin_zamani'
  ) then
    eksik := eksik || 'odevler.yayin_zamani sütunu yok'::text;
  end if;

  foreach f in array array['_bildirimlerim', 'bildirimlerim',
                           'bildirim_goruldu', 'bildirim_sayim'] loop
    if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = f) = 0 then
      eksik := eksik || (f || ' fonksiyonu yok')::text;
    end if;
  end loop;

  -- `odev_yayinla` GERÇEKTEN DAMGALIYOR MU. `create or replace` sessizce
  -- eski tanımı bırakabilirdi; kaynağa bakılıyor, varlığına değil.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'odev_yayinla'
       and pg_get_functiondef(p.oid) like '%yayin_zamani%'
  ) then
    eksik := eksik || 'odev_yayinla yayin_zamani damgalamıyor'::text;
  end if;

  -- İMZA KONTROLÜ: `odev_yayinla` tek imzayla durmalı (0007 tuzağı).
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'odev_yayinla') <> 1 then
    eksik := eksik || 'odev_yayinla birden fazla imzayla duruyor'::text;
  end if;

  -- ROZET İLE LİSTE AYRIŞMASIN: sayım kendi sorgusunu yazmamalı.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'bildirim_sayim'
       and pg_get_functiondef(p.oid) like '%_bildirimlerim%'
  ) then
    eksik := eksik || 'bildirim_sayim _bildirimlerim kullanmıyor'::text;
  end if;

  -- DAHİLİ FONKSİYON ANON'A AÇIK KALMASIN.
  if has_function_privilege('anon', 'public._bildirimlerim(uuid, text)', 'execute') then
    eksik := eksik || '_bildirimlerim anon''a açık'::text;
  end if;

  if array_length(eksik, 1) > 0 then
    raise exception '0054 eksik: %', array_to_string(eksik, ' | ');
  end if;
end $$;

select public._migration_kaydet('0054');
