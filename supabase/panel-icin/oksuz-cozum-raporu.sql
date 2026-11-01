-- SEKİZ — ÖKSÜZ ÇÖZÜM RAPORU
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
--
-- BU DOSYA HİÇBİR ŞEYİ SİLMEZ, DEĞİŞTİRMEZ. Yalnız bakar.
--
-- NE SORUYOR: "Öğrenci çözümünü yükledi ama gönderim kaydı oluşmadı mı?"
--
-- NEDEN OLABİLİR: ödev gönderme iki adımdır. Önce çözüm sayfaları depoya
-- yüklenir, sonra `odev_gonder` çağrılır. İkinci adım düşerse (bağlantı
-- koptu, sayfa kapandı, uygulama arka plana atıldı) fotoğraflar depoda
-- KALIR ama ortada gönderim kaydı OLMAZ. Öğrenci sayfalarının
-- yüklendiğini gördüğü için gönderdiğini sanır; öğretmen ise
-- "göndermedi" görür. İkisi de haklıdır.
--
-- Rapor tam bu durumu arıyor: depoda `cozum/<ödev>/<öğrenci>…` dosyası
-- var ama o ödev–öğrenci çiftinde gönderim satırı yok.
--
-- SONUÇ BOŞ GELİRSE: böyle bir durum yok; kaybın sebebi başka.
-- =============================================================================

-- NOT: `created_at` satırdan JSON üzerinden okunuyor
-- (`to_jsonb(o) ->> 'created_at'`). Sebebi: yerel test ortamındaki
-- `storage.objects` taklidinde o sütun yok ve doğrudan okunsaydı sorgu
-- orada çalıştırılıp sınanamazdı. JSON yolu, sütun varsa değeri verir,
-- yoksa null döner — sorgu iki şemada da koşar.
with dosya as (
  select
    o.name,
    (to_jsonb(o) ->> 'created_at')::timestamptz as created_at,
    -- Yol kalıbı: cozum/<odev_id>/<ogrenci_id>[-d<deneme>][-<sayfa>].jpg
    nullif(split_part(o.name, '/', 2), '')::uuid as odev_id,
    -- DİKKAT: öğrenci kimliği `-` ile AYRILAMAZ — UUID'nin kendisinde de
    -- tire var. İlk yazımda `split_part(..., '-', 1)` kullanılmıştı ve
    -- kimliği ortadan kesiyordu; rapor hiçbir şey bulamıyordu. Prova bunu
    -- yakaladı. UUID her zaman 36 karakter, o yüzden soldan 36 alınıyor;
    -- `-d2`, `-3` gibi ekler doğal olarak dışarıda kalıyor.
    nullif(left(split_part(split_part(o.name, '/', 3), '.', 1), 36), '')::uuid
      as ogrenci_id
    from storage.objects o
   where o.bucket_id = 'odev-dosyalari'
     and o.name like 'cozum/%/%'
     -- Bozuk bir ad sorguyu düşürmesin.
     and split_part(o.name, '/', 2) ~ '^[0-9a-f-]{36}$'
     and left(split_part(split_part(o.name, '/', 3), '.', 1), 36) ~ '^[0-9a-f-]{36}$'
),
oksuz as (
  select d.odev_id, d.ogrenci_id,
         count(*)      as dosya_sayisi,
         min(d.created_at) as ilk_yukleme,
         max(d.created_at) as son_yukleme
    from dosya d
   where not exists (
     select 1 from public.gonderimler g
      where g.odev_id = d.odev_id and g.ogrenci_id = d.ogrenci_id
   )
   group by 1, 2
)
select
  coalesce(s.ad, '?')               as sinif,
  coalesce(ogr.ad, '(öğrenci yok)') as ogrenci,
  coalesce(od.baslik, '(ödev yok)') as odev,
  od.son_tarih,
  k.dosya_sayisi                    as yuklenen_sayfa,
  to_char(k.ilk_yukleme at time zone 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI') as yukleme_zamani,
  case
    when od.son_tarih is null then '—'
    when (k.ilk_yukleme at time zone 'Europe/Istanbul')::date <= od.son_tarih
      then 'SÜRESİ İÇİNDE yüklemiş'
    else 'süre dolduktan sonra yüklemiş'
  end as zamanlama
from oksuz k
left join public.odevler   od  on od.id  = k.odev_id
left join public.ogrenciler ogr on ogr.id = k.ogrenci_id
left join public.siniflar   s   on s.id   = ogr.sinif_id
order by k.ilk_yukleme desc;
