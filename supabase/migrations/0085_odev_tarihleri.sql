-- =============================================================================
-- 0085 — ÖDEVİN ÜZERİNDE VERİLİŞ TARİHİ, SON TESLİM TARİHİ VE UZATMA
--
-- Öğretmenin isteği: "Ödevleri verdiğim tarih de ödevin üzerinde yazsın
-- geriye dönüp baktığımda. Yani VERİLİŞ TARİHİ ve SON TESLİM TARİHİ
-- yazsın. Eğer teslim tarihinde UZATMA yaptıysam o ekstra belirtilsin."
--
-- Kararları (soruldu): tarihleri ÖĞRENCİ VE VELİ DE GÖRSÜN; hem ÖDEV
-- SAYFASINDA hem LİSTEDE yazsın.
--
-- -----------------------------------------------------------------------------
-- ŞEMA DEĞİŞMİYOR — İKİ TARİH DE 0004'TEN BERİ DURUYOR
--
-- Her ödev TASLAK doğuyor: `odev_olustur` `yayinda` alanına her zaman
-- `false` yazıyor ve o alanı `true` yapan tek yer `odev_yayinla`.
-- Yayından kaldırma diye bir işlem YOK. `odev_yayinla` ise 0004'ten beri
-- `odev_yayinlandi` denetim izi satırını yazıyor. Yani ödevin ÖĞRENCİYE
-- VERİLDİĞİ an kayıtlı — geçmiş ödevlerin hepsinde.
--
-- 0047'NİN YORUMU BU KONUDA YANLIŞ. Orada şöyle yazıyor: "VERİLİŞ TARİHİ
-- DİYE AYRI BİR ALAN YOK. Ölçüldü: ... yayına alma ZAMANI hiçbir yerde
-- tutulmuyor." Alan yok, doğru; ama ZAMAN tutuluyor — o tur denetim izine
-- bakmamış. Cümle burada düzeltiliyor.
--
-- 0047'NİN KENDİ HESABI (ödev kıyası gruplarını `created_at` ile eşleme)
-- BU TURDA DEĞİŞMİYOR. Ortalama gruplarını oynatmak öğretmenin sormadığı
-- bir davranış değişikliği olurdu; bu dosya yalnız EKRANDA YAZILANI
-- ekliyor.
--
-- UZATMA DA İZDE. `odev_guncelle`, `odev_guncellendi` satırına eski ve
-- yeni satırın TAMAMINI yazıyor (`to_jsonb(d)` / `to_jsonb(o)`), yani
-- `eski->>'son_tarih'` ile `yeni->>'son_tarih'` karşılaştırılabiliyor.
-- `son_tarih`'i değiştiren başka bir yol yok: `kardeslere_yayildi` (0031)
-- bu alanı bilerek taşımıyor, 0083'ün kopyalaması da ona dokunmuyor.
--
-- -----------------------------------------------------------------------------
-- ÜÇ TUZAK — HESAP BU YÜZDEN TEK YERDE
--
--   1. `odev_guncellendi` SATIRI TARİH DEĞİŞMESE DE YAZILIYOR. Gerçek
--      veride `2026-11-03 -> 2026-11-03` satırı var: öğretmen başlığı
--      düzeltmiş. Süzmeden sayılsa her düzenleme "uzatma" görünürdü.
--      Süzgeç: `eski->>'son_tarih' is distinct from yeni->>'son_tarih'`.
--
--   2. TARİH ÖNE DE ALINABİLİR. Yalnız "uzatıldı" yazıp öne alınmış
--      tarihte susmak, öğrencinin gerçeği göremediği tek durum olurdu.
--      İki yön de dönüyor: `uzatildi` / `one_alindi`.
--
--   3. TASLAKTAYKEN YAPILAN TARİH DEĞİŞİKLİĞİ UZATMA DEĞİL. Ödev henüz
--      kimsede görünmüyordu; onu "uzatma" diye yazmak öğretmene hiç
--      yapmadığı bir işi hatırlatırdı. Sayılan değişiklikler yalnız
--      `zaman >= verilis` olanlar.
--
-- BİLİNEN SINIR: tarih değiştirilip sonra ilk hâline geri getirilirse
-- `degisiklik` 2 olur ama `yon` null kalır — bugünkü tarih ilk tarihin
-- aynısı olduğu için ekranda "3 Kasım'dan 3 Kasım'a uzatıldı" gibi bir
-- cümle çıkmaz. Ekranda yazılan şey ödevin BUGÜNKÜ hâli; arada görünen
-- ara tarih denetim izinde duruyor.
--
-- -----------------------------------------------------------------------------
-- DÖRT UÇ, TEK HESAP
--
-- `_odev_tarihleri` hesabı tek yerde yapıyor ve dört uç da onu çağırıyor:
-- `odev_detay`, `odevler_listesi` (öğretmen), `ogrenci_odevleri`
-- (öğrenci), `veli_paneli` (veli). Öğretmenin gördüğü tarihle öğrencinin
-- gördüğü tarih ayrışamıyor.
--
-- Dört ucun da İMZASI DEĞİŞMİYOR; 0007 tuzağı (yeni imza = yeni
-- fonksiyon) bu dosyada yok, `drop function` gerekmiyor.
--
-- `odev_ek_sure` (0081/0084) BU ALANA KARIŞMIYOR: o öğrenciye özel bir
-- son tarih ve kendi alanında (`ek_sure`) gidiyor. `tarihler` SINIFIN
-- tarihlerini anlatıyor.
--
-- Bu dosya tekrar çalıştırılabilir. Ön koşul: 0083.
-- =============================================================================

do $$
begin
  -- Dört uç EN SON hâllerinden kopyalandı. 0083'ün `odev_detay`'ı
  -- yerinde değilse bu dosya onu geriye alır (`verilebilir_siniflar`
  -- kaybolur, 0083'ün kartı sessizce ölür).
  if pg_get_functiondef('public.odev_detay'::regproc)
       not like '%verilebilir_siniflar%' then
    raise exception '0085: önce 0083 çalıştırılmalı';
  end if;
  -- 0082'nin `ogrenci_odevleri`'si de aynı sebeple şart.
  if pg_get_functiondef('public.ogrenci_odevleri'::regproc)
       not like '%onceki_sayfalar%' then
    raise exception '0085: önce 0082 çalıştırılmalı';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. HESAP — TEK YER
-- -----------------------------------------------------------------------------

-- `denetim_izi`'nin RLS'i tamamen kapalı (`using(false)`), o yüzden
-- `security definer`. İstemciye AÇILMIYOR: yalnız aşağıdaki dört definer
-- fonksiyon çağırıyor. İki sorgu da `(tablo, kayit_id)` indeksini
-- kullanıyor; yeni indeks gerekmiyor.
create or replace function public._odev_tarihleri(p_odev uuid, p_son_tarih date)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  with verilis as (
    -- `min`: `odev_yayinla` ikinci kez çağrılırsa ikinci satır da yazılır;
    -- öğrenciye düştüğü an İLK olanıdır.
    select min(z.zaman) as zaman
      from public.denetim_izi z
     where z.tablo = 'odevler'
       and z.kayit_id = p_odev
       and z.islem = 'odev_yayinlandi'
  ),
  degisim as (
    select z.id, z.zaman, (z.eski ->> 'son_tarih')::date as eski_tarih
      from public.denetim_izi z
      cross join verilis v
     where z.tablo = 'odevler'
       and z.kayit_id = p_odev
       and z.islem = 'odev_guncellendi'
       -- 3. tuzak: taslaktayken yapılan değişiklik sayılmıyor.
       and v.zaman is not null
       and z.zaman >= v.zaman
       -- 1. tuzak: tarihi değiştirmeyen düzenleme uzatma değil.
       and (z.eski ->> 'son_tarih') is distinct from (z.yeni ->> 'son_tarih')
  ),
  ilk as (
    -- `zaman` eşitse `id` karar veriyor: denetim izi kimlikleri artan
    -- sırada verildiği için gerçek sıra budur. Aynı saniyeyi iki ayrı RPC
    -- çağrısı paylaşamaz, ama sıralamayı tesadüfe bırakmanın bedeli
    -- "ilk tarih" diye YANLIŞ tarihi yazmak olurdu.
    select eski_tarih from degisim order by zaman, id limit 1
  )
  select jsonb_build_object(
    -- Taslakta null: veriliş tarihi UYDURULMUYOR.
    'verilis', (select zaman from verilis),
    'son_tarih', p_son_tarih,
    -- Yayından sonra hiç değişmediyse null.
    'ilk_son_tarih', (select eski_tarih from ilk),
    'degisiklik', (select count(*) from degisim),
    -- 2. tuzak: iki yön de söyleniyor.
    'yon', case
             when (select eski_tarih from ilk) is null then null
             when p_son_tarih > (select eski_tarih from ilk) then 'uzatildi'
             when p_son_tarih < (select eski_tarih from ilk) then 'one_alindi'
           end
  );
$$;

revoke all on function public._odev_tarihleri(uuid, date) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. DÖRT UÇ — her biri EN SON tanımından kopyalandı, tek satır eklendi
-- -----------------------------------------------------------------------------
-- odev_detay — kopya: 0083_odevi_siniflara_ver.sql (0083)
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
    -- 0085: VERİLİŞ TARİHİ + UZATMA. Hesap tek yerde; öğretmenin,
    -- öğrencinin ve velinin gördüğü tarih ayrışamıyor.
    'tarihler', public._odev_tarihleri(d.id, d.son_tarih),
    'soru_sayisi', d.soru_sayisi,
    'gec_teslim', d.gec_teslim,
    'konular', coalesce(d.konular, '{}'::jsonb),
    'sik_sayisi', d.sik_sayisi,
    'sayfa_limiti', d.sayfa_limiti,
    'tum_sayfalar', d.tum_sayfalar,
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
    -- 0083: BU ÖDEVİN HENÜZ VERİLMEDİĞİ, öğretmenin kendi, arşivde
    -- olmayan sınıfları. Yalnız ödevi VEREN öğretmene dolu geliyor;
    -- başkası (yönetici dâhil) kopyalayamadığı için liste de boş.
    'verilebilir_siniflar', case when d.ogretmen_id = v_ogretmen then (
      select coalesce(jsonb_agg(jsonb_build_object('id', s3.id, 'ad', s3.ad)
                                order by s3.seviye, s3.sube), '[]'::jsonb)
        from public.siniflar s3
        join public.ogretmen_siniflari os
          on os.sinif_id = s3.id and os.ogretmen_id = v_ogretmen
       where not s3.arsiv
         and s3.id <> d.sinif_id
         and not exists (
           select 1 from public.odevler d3
           where d3.grup_id is not null
             and d3.grup_id = d.grup_id
             and d3.sinif_id = s3.id
         )
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

-- odevler_listesi — kopya: 0073_deneme_hesabi.sql (0073)
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
      -- 0085: VERİLİŞ TARİHİ + UZATMA. Hesap tek yerde; öğretmenin,
      -- öğrencinin ve velinin gördüğü tarih ayrışamıyor.
      'tarihler', public._odev_tarihleri(d.id, d.son_tarih),
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

-- ogrenci_odevleri — kopya: 0082_yeniden_yukleme.sql (0082)
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

  select ogr2.id, ogr2.ad, ogr2.tur, s.ad as sinif, ogr2.sinif_id, ogr2.sinif_giris, ogr2.deneme,
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
        -- 0085: VERİLİŞ TARİHİ + UZATMA. Hesap tek yerde; öğretmenin,
        -- öğrencinin ve velinin gördüğü tarih ayrışamıyor.
        'tarihler', public._odev_tarihleri(d.id, d.son_tarih),
        -- 0081: KİŞİSEL SON TARİH. Sahip gönderimi yeniden açarken tarih
        -- verdiyse öğrenci bunu görmeli; yoksa geçmiş bir tarihe bakıp
        -- "gönderemem" sanır. Yoksa null — bugünkü davranış.
        'ek_sure', (select e.son_tarih from public.odev_ek_sure e
                     where e.odev_id = d.id and e.ogrenci_id = ogr.id),
        -- 0082: KAÇINCI DENEME. İstemci yükleme yolunu buradan kuruyor;
        -- 1 ise yol 0009'dan beri kullanılanla birebir aynı.
        'deneme_no', public._cozum_deneme(d.id, ogr.id),
        -- 0082: SON İPTALİN SAYFALARI. Öğrenci isterse bunları yeniden
        -- gönderebiliyor (öğretmenin kararı: "öğrenci seçsin") — cevapları
        -- yanlışlıkla boş giden öğrenci sayfaları yeniden çekmesin.
        'onceki_sayfalar', (
          select jsonb_build_array(z.eski ->> 'foto_yolu')
                 -- `ek_sayfa_yollari` tek sayfalık gönderimde JSON null;
                 -- doğrudan eklemek diziye bir `null` sokardı.
                 || case when jsonb_typeof(z.eski -> 'ek_sayfa_yollari') = 'array'
                         then z.eski -> 'ek_sayfa_yollari'
                         else '[]'::jsonb end
          from public.denetim_izi z
          where z.islem = 'gonderim_yeniden_acildi'
            and z.tablo = 'gonderimler'
            and z.eski ->> 'odev_id'    = d.id::text
            and z.eski ->> 'ogrenci_id' = ogr.id::text
            and coalesce(z.eski ->> 'foto_yolu', '') <> ''
          order by z.zaman desc
          limit 1
        ),
        'soru_sayisi', d.soru_sayisi,
        -- 0074: deneme hesabında her ödev açık — arayüzün üç "teslim
        -- kapandı" kapısı bu alanı okuyor; gerçek öğrencide değişmiyor.
        'gec_teslim', d.gec_teslim or ogr.deneme,
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

-- veli_paneli — kopya: 0071_veli_odev_dosyalari.sql (0071)
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
        -- 0085: VERİLİŞ TARİHİ + UZATMA. Hesap tek yerde; öğretmenin,
        -- öğrencinin ve velinin gördüğü tarih ayrışamıyor.
        'tarihler', public._odev_tarihleri(d.id, d.son_tarih),
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
          else '[]'::jsonb end,
        -- 0071 — VELİ SORULARI VE ÇOCUĞUN ÇÖZÜMÜNÜ AÇABİLSİN. Yalnız YOL
        -- gidiyor; imzalı adresi `dosya-url` her dokunuşta yeniden üretiyor
        -- ve izni `dosya_erisim_izni` orada yeniden denetliyor. Cevap
        -- anahtarının yolu buraya EKLENMİYOR (Kural 6).
        'odev_yolu', d.odev_url,
        'cozum_yollari', case when g.id is not null and g.foto_yolu is not null
          then to_jsonb(array[g.foto_yolu] || coalesce(g.ek_sayfa_yollari, '{}'::text[]))
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

-- -----------------------------------------------------------------------------
-- 3. YETKİLER — imzalar değişmedi, yine de açıkça yazılıyor
-- -----------------------------------------------------------------------------
grant execute on function public.odev_detay(text, uuid)               to anon, authenticated;
grant execute on function public.odevler_listesi(text, uuid, boolean) to anon, authenticated;
grant execute on function public.ogrenci_odevleri(text)               to anon, authenticated;
grant execute on function public.veli_paneli(text)                    to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. ÖZ-DENETİM
-- -----------------------------------------------------------------------------
do $$
declare
  eksik text[] := '{}';
  t text;
begin
  if to_regprocedure('public._odev_tarihleri(uuid,date)') is null then
    eksik := eksik || '_odev_tarihleri kurulmadı'::text;
  end if;
  -- Hesap istemciye kapalı kalmalı.
  if has_function_privilege('anon', 'public._odev_tarihleri(uuid, date)', 'execute') then
    eksik := eksik || '_odev_tarihleri anon''a açık'::text;
  end if;

  t := pg_get_functiondef('public._odev_tarihleri(uuid,date)'::regprocedure);
  -- 1. tuzak: süzgeç yerinde mi.
  if t not like '%is distinct from (z.yeni ->> ''son_tarih'')%' then
    eksik := eksik || 'tarih değişmeyen güncelleme süzülmüyor'::text;
  end if;
  -- 3. tuzak: taslak dönemi dışarıda mı.
  if t not like '%z.zaman >= v.zaman%' then
    eksik := eksik || 'taslaktaki tarih değişikliği uzatma sayılıyor'::text;
  end if;
  -- 2. tuzak: iki yön de var mı.
  if t not like '%one_alindi%' then
    eksik := eksik || 'tarihin öne alınması söylenmiyor'::text;
  end if;

  -- DÖRT UÇ DA ÇAĞIRIYOR MU — biri eksikse o ekran sessizce boş kalır.
  if pg_get_functiondef('public.odev_detay'::regproc) not like '%_odev_tarihleri%' then
    eksik := eksik || 'odev_detay tarihleri döndürmüyor'::text;
  end if;
  if pg_get_functiondef('public.odevler_listesi'::regproc) not like '%_odev_tarihleri%' then
    eksik := eksik || 'odevler_listesi tarihleri döndürmüyor'::text;
  end if;
  if pg_get_functiondef('public.ogrenci_odevleri'::regproc) not like '%_odev_tarihleri%' then
    eksik := eksik || 'ogrenci_odevleri tarihleri döndürmüyor'::text;
  end if;
  if pg_get_functiondef('public.veli_paneli'::regproc) not like '%_odev_tarihleri%' then
    eksik := eksik || 'veli_paneli tarihleri döndürmüyor'::text;
  end if;

  -- KOPYALAMA GERİYE ALMADI MI. Dört uç en son hâlinden kopyalandı;
  -- önceki turların alanları yerinde kalmalı.
  if pg_get_functiondef('public.odev_detay'::regproc) not like '%verilebilir_siniflar%'
     or pg_get_functiondef('public.odev_detay'::regproc) not like '%kardes_detay%'
     or pg_get_functiondef('public.odev_detay'::regproc) not like '%tum_sayfalar%' then
    eksik := eksik || 'odev_detay''ın eski alanları kayboldu'::text;
  end if;
  if pg_get_functiondef('public.ogrenci_odevleri'::regproc) not like '%onceki_sayfalar%'
     or pg_get_functiondef('public.ogrenci_odevleri'::regproc) not like '%deneme_no%'
     or pg_get_functiondef('public.ogrenci_odevleri'::regproc) not like '%ek_sure%' then
    eksik := eksik || 'ogrenci_odevleri''nin eski alanları kayboldu'::text;
  end if;
  -- Kural 6: veliye giden gövdede cevap anahtarının yolu YOK.
  if pg_get_functiondef('public.veli_paneli'::regproc) like '%anahtar_url%' then
    eksik := eksik || 'veli_paneli cevap anahtarı yolunu içeriyor'::text;
  end if;
  if pg_get_functiondef('public.veli_paneli'::regproc) not like '%cozum_yollari%' then
    eksik := eksik || 'veli_paneli''nin eski alanları kayboldu'::text;
  end if;
  if pg_get_functiondef('public.odevler_listesi'::regproc) not like '%ortalama_tum%' then
    eksik := eksik || 'odevler_listesi''nin eski alanları kayboldu'::text;
  end if;

  if array_length(eksik, 1) > 0 then
    raise exception '0085 eksik: %', array_to_string(eksik, ' | ');
  end if;
end $$;

select public._migration_kaydet('0085');
