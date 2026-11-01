-- SEKİZ — KAYIP GÖNDERİM RAPORU
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
--
-- BU DOSYA HİÇBİR ŞEYİ SİLMEZ, DEĞİŞTİRMEZ, EKLEMEZ. Yalnız bakar ve bir
-- tablo döndürür. Güvenle çalıştırabilirsiniz.
--
-- NE SORUYOR: "Gönderilmiş ve hatta puanlanmış bir ödev neden şimdi
-- gönderilmemiş görünüyor?"
--
-- NASIL CEVAPLIYOR: Her gönderim yapıldığında denetim izine bir
-- `odev_gonderildi` satırı yazılıyor. O satır, gönderim kaydı sonradan
-- silinse bile DURUYOR. Rapor ikisini karşılaştırıyor:
--
--     izde kaç gönderim var   ↔   bugün kaç gönderim duruyor
--
-- Aradaki fark KAYIP gönderimdir. Fark yoksa kayıp yoktur ve sorun
-- görüntülemededir (örneğin öğrencinin ikinci bir kaydı olması).
--
-- Gönderim kaydının yok olmasının YALNIZ üç yolu var; rapor üçünü de
-- ayrı ayrı gösteriyor:
--   1. "Gönderimi yeniden aç" (denetim izinde `gonderim_yeniden_acildi`;
--      sebebi ve eski puanı izde saklı — geri alınabilir),
--   2. ÖDEVİN silinmesi (`odev_silindi`) — ödev silinince ona bağlı bütün
--      gönderimler ve puanlar da silinir,
--   3. ÖĞRENCİ kaydının silinmesi — o öğrencinin bütün gönderimleri gider.
--
-- ## Nasıl kullanılır
--
-- Aşağıdaki ilk satırda `ARANAN` yazan yere öğrencinin adından bir parça
-- yazın (örnek: 'Ayşe'). Büyük/küçük harf ve Türkçe harf farkı önemli
-- değil. Boş bırakırsanız (''), rapor BÜTÜN öğrencileri tarar ve yalnız
-- kaybı olanları listeler — genel tarama için bunu kullanın.
--
-- ## Neden tek bir sorgu
--
-- Supabase panelinde yalnız SON ifadenin sonucu görünüyor. Rapor birkaç
-- ayrı `select` olsaydı yalnız sonuncuyu görürdünüz. Bu yüzden her şey
-- tek tabloda, `bolum` sütunuyla ayrılmış hâlde dönüyor.
--
-- İLK SATIRDAN BAŞLAYIN: `0 · OZET` tek cümlede durumu söylüyor.
-- =============================================================================

with ayar as (
  select ''::text as aranan   -- ←←← ÖĞRENCİ ADINDAN BİR PARÇA (boş = hepsi)
),

-- Türkçe harfler elle çevriliyor: `lower()` veritabanının diline bağlı ve
-- "İ" harfini bozabiliyor (0041'in dersi).
ogr as (
  select o.id, o.ad, o.aktif, o.ogrenci_no, o.sinif_giris, o.created_at,
         s.ad as sinif
    from public.ogrenciler o
    left join public.siniflar s on s.id = o.sinif_id
   where (select aranan from ayar) = ''
      or regexp_replace(lower(translate(o.ad, 'İIĞÜŞÖÇ', 'iığüşöç')), '\s+', ' ', 'g')
         like '%' || regexp_replace(
                lower(translate(btrim((select aranan from ayar)), 'İIĞÜŞÖÇ', 'iığüşöç')),
                '\s+', ' ', 'g') || '%'
),

-- İZDEKİ gönderimler: öğrenci her gönderdiğinde bir satır. Gönderim kaydı
-- sonradan silinse bile bu satır durur.
izde as (
  select o.id as ogrenci_id,
         z.kayit_id as gonderim_id,
         z.zaman
    from public.denetim_izi z
    join ogr o on z.aktor = 'ogrenci:' || o.id::text
   where z.tablo = 'gonderimler' and z.islem = 'odev_gonderildi'
),

-- BUGÜN DURAN gönderimler.
duran as (
  select g.id as gonderim_id, g.ogrenci_id, g.odev_id, g.durum, g.puan
    from public.gonderimler g
    join ogr o on o.id = g.ogrenci_id
),

-- KAYIP: izde var, bugün yok.
kayip as (
  select i.ogrenci_id, i.gonderim_id, i.zaman
    from izde i
   where not exists (select 1 from duran d where d.gonderim_id = i.gonderim_id)
),

-- 1. YOL — "Gönderimi yeniden aç". `eski` tam satırı taşıyor: hangi ödev,
-- hangi puan. Yani bu yoldan gidenler GERİ ALINABİLİR.
acilan as (
  select z.kayit_id as gonderim_id,
         (z.eski ->> 'odev_id')::uuid as odev_id,
         (z.eski ->> 'puan') as eski_puan,
         z.zaman, z.aktor,
         (z.yeni ->> 'neden') as neden
    from public.denetim_izi z
   where z.tablo = 'gonderimler' and z.islem = 'gonderim_yeniden_acildi'
),

-- 2. YOL — ödev silinmesi. Ödev silinince gönderimleri de gider ve o
-- gönderimler için AYRI bir iz satırı YAZILMAZ.
silinen_odev as (
  select z.kayit_id as odev_id,
         (z.eski ->> 'baslik') as baslik,
         (z.eski ->> 'son_tarih') as son_tarih,
         z.zaman, z.aktor
    from public.denetim_izi z
   where z.tablo = 'odevler' and z.islem = 'odev_silindi'
),

-- Aynı ada sahip BİRDEN ÇOK öğrenci kaydı: gönderimler eski kayda bağlı
-- kalmış olabilir. Bu durumda veri KAYBOLMAMIŞTIR, yanlış kayda bakılıyordur.
kopya as (
  select regexp_replace(lower(translate(btrim(o.ad), 'İIĞÜŞÖÇ', 'iığüşöç')), '\s+', ' ', 'g') as anahtar,
         count(*) as kayit_sayisi
    from public.ogrenciler o
    join ogr x on x.id = o.id or
         regexp_replace(lower(translate(btrim(o.ad), 'İIĞÜŞÖÇ', 'iığüşöç')), '\s+', ' ', 'g')
       = regexp_replace(lower(translate(btrim(x.ad), 'İIĞÜŞÖÇ', 'iığüşöç')), '\s+', ' ', 'g')
   group by 1
  having count(*) > 1
)

select * from (
  -- ---------------------------------------------------------------- 0
  select '0 · OZET' as bolum, 1 as sira, ''::text as kim,
         case when (select count(*) from kayip) = 0
              then 'KAYIP GÖNDERİM YOK. İzdeki ' || (select count(*) from izde)::text
                   || ' gönderimin hepsi bugün de duruyor. Sorun görüntülemede olabilir:'
                   || ' aşağıdaki "4 · KOPYA AD" bölümüne bakın.'
              else 'DİKKAT: ' || (select count(*) from kayip)::text
                   || ' gönderim izde var ama bugün YOK. Aşağıdaki bölümler nedenini gösteriyor.'
         end as ayrinti,
         ''::text as zaman
  union all
  -- ---------------------------------------------------------------- 1
  select '1 · ÖĞRENCİ KAYITLARI', 2, o.ad || coalesce(' (' || o.sinif || ')', ''),
         'no: ' || coalesce(o.ogrenci_no::text, '—')
           || ' · aktif: ' || o.aktif::text
           || ' · sınıfa giriş: ' || coalesce(o.sinif_giris::text, '—')
           || ' · izde ' || (select count(*) from izde i where i.ogrenci_id = o.id)::text
           || ' gönderim, bugün ' || (select count(*) from duran d where d.ogrenci_id = o.id)::text
           || ' duruyor',
         to_char(o.created_at at time zone 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI')
    from ogr o
  union all
  -- ---------------------------------------------------------------- 2
  select '2 · KAYIP GÖNDERİM', 3,
         (select ad from public.ogrenciler x where x.id = k.ogrenci_id),
         case
           when a.gonderim_id is not null then
             'YENİDEN AÇILMIŞ · ödev: '
               || coalesce((select baslik from public.odevler d where d.id = a.odev_id),
                           (select baslik from silinen_odev s where s.odev_id = a.odev_id),
                           '(ödev bulunamadı)')
               || ' · eski puan: ' || coalesce(a.eski_puan, '—')
               || ' · açan: ' || a.aktor
               || ' · sebep: ' || coalesce(a.neden, '—')
               || ' → İZDE SAKLI, GERİ ALINABİLİR'
           else
             'SEBEP İZDE YOK · ödev ya da öğrenci kaydı silinmiş olabilir'
               || ' (bkz. 3. bölüm). Gönderim kimliği: ' || k.gonderim_id::text
         end,
         to_char(k.zaman at time zone 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI')
    from kayip k
    left join acilan a on a.gonderim_id = k.gonderim_id
  union all
  -- ---------------------------------------------------------------- 3
  select '3 · SİLİNEN ÖDEV', 4, coalesce(s.baslik, '(başlıksız)'),
         'son tarih: ' || coalesce(s.son_tarih, '—') || ' · silen: ' || s.aktor
           || ' → bu ödeve bağlı BÜTÜN gönderimler ve puanlar da silindi',
         to_char(s.zaman at time zone 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI')
    from silinen_odev s
  union all
  -- ---------------------------------------------------------------- 4
  select '4 · KOPYA AD', 5, k.anahtar,
         k.kayit_sayisi::text || ' ayrı öğrenci kaydı var. Gönderimler bir kayda,'
           || ' sınıf listesi başka bir kayda bağlıysa ödev "gönderilmedi"'
           || ' görünür ama VERİ KAYBOLMAMIŞTIR.',
         ''
    from kopya k
  union all
  -- ---------------------------------------------------------------- 5
  select '5 · ÖĞRENCİ KAYDI DEĞİŞİKLİKLERİ', 6,
         coalesce((select ad from public.ogrenciler x where x.id = z.kayit_id), z.kayit_id::text),
         z.islem || ' · ' || z.aktor,
         to_char(z.zaman at time zone 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI')
    from public.denetim_izi z
   where z.tablo = 'ogrenciler'
     and z.islem in ('ogrenci_tasindi', 'ogrenci_pasiflestirildi', 'ogrenci_no_guncellendi')
     and (z.kayit_id in (select id from ogr) or (select aranan from ayar) = '')
     and z.zaman > now() - interval '60 days'
) r
order by sira, zaman desc nulls last, kim;
