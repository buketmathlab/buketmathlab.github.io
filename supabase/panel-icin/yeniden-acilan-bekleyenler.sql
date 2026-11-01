-- SEKİZ — YENİDEN AÇILMIŞ AMA HÂLÂ GÖNDERİLMEMİŞ
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
--
-- BU DOSYA HİÇBİR ŞEYİ SİLMEZ, DEĞİŞTİRMEZ. Yalnız bakar.
--
-- NE SORUYOR: "Gönderimini yeniden açtığım ama henüz yeniden
-- göndermemiş öğrenciler kimler?"
--
-- NEDEN ÖNEMLİ: "Gönderimi yeniden aç" önceki gönderimi VE PUANINI
-- siler. O öğrenci, yeniden göndermediği sürece listelerde ve veli
-- ekranında "ödevini yapmamış" görünür — oysa göndermişti ve puanı
-- hesaplanmıştı. Veliye bir şey söylemeden önce bu listeye bakın.
--
-- ÜÇ DURUM AYRI AYRI:
--   BEKLİYOR          → yeniden açıldı, henüz göndermedi. Haksızlık
--                       riski burada.
--   YENİDEN GÖNDERDİ  → sorun yok, yeni gönderimi var.
--   ÖDEV YOK          → ödev sonradan silinmiş.
--
-- `onceki_puan` silinen gönderimin puanıdır; denetim izinde saklı ve
-- gerekirse geri yazılabilir.
-- =============================================================================

with acilan as (
  select
    z.kayit_id                        as gonderim_id,
    (z.eski ->> 'odev_id')::uuid      as odev_id,
    (z.eski ->> 'ogrenci_id')::uuid   as ogrenci_id,
    (z.eski ->> 'puan')               as onceki_puan,
    (z.eski ->> 'durum')              as onceki_durum,
    (z.yeni ->> 'neden')              as neden,
    (z.yeni ->> 'son_tarih')          as yeni_son_tarih,
    z.aktor,
    z.zaman
  from public.denetim_izi z
  where z.tablo = 'gonderimler'
    and z.islem = 'gonderim_yeniden_acildi'
),
-- Aynı gönderim birden çok kez açılmış olabilir; EN SON açılma esas.
son_acilma as (
  select distinct on (odev_id, ogrenci_id) *
    from acilan
   order by odev_id, ogrenci_id, zaman desc
)
select
  case
    when od.id is null then 'ÖDEV YOK'
    when g.id is not null then 'YENİDEN GÖNDERDİ'
    else 'BEKLİYOR'
  end                                               as durum,
  coalesce(s.ad, '?')                               as sinif,
  coalesce(ogr.ad, '(öğrenci yok)')                 as ogrenci,
  coalesce(od.baslik, '(ödev silinmiş)')            as odev,
  a.onceki_puan,
  od.son_tarih                                      as odev_son_tarihi,
  a.yeni_son_tarih                                  as kisiye_verilen_tarih,
  a.neden,
  to_char(a.zaman at time zone 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI') as acilma,
  a.aktor                                           as acan
from son_acilma a
left join public.odevler    od  on od.id  = a.odev_id
left join public.ogrenciler ogr on ogr.id = a.ogrenci_id
left join public.siniflar   s   on s.id   = ogr.sinif_id
left join public.gonderimler g  on g.odev_id = a.odev_id and g.ogrenci_id = a.ogrenci_id
order by
  case when od.id is null then 3 when g.id is not null then 2 else 1 end,
  a.zaman desc;
