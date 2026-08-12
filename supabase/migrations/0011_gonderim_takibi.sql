-- =============================================================================
-- SEKİZ — 0011 GÖNDERİM TAKİBİ VE AÇIK UÇLU PUANLAMA
--
-- NEDEN:
-- Faz 2C'den sonra öğrenci ödevini gönderebiliyor, ama öğretmen tarafında üç
-- şey eksikti ve üçü de aynı boşluğa çıkıyordu — gönderimleri listeleyen bir
-- uç yok:
--
--   1. Ödev kartı "12/20 gönderdi" diyor; hangi 8 öğrencinin göndermediği
--      hiçbir ekranda görünmüyor.
--   2. Öğretmenin her dosyaya yetkisi var (`dosya_erisim_izni` öğretmene
--      true dönüyor) ama gönderimin dosya YOLUNU veren bir uç yok. Yetki
--      var, adres yok — yani çözüm fotoğrafı açılamıyor.
--   3. AÇIK UÇLU ÖDEV ÇIKMAZ SOKAK. `acik_puanla` Faz 1'de yazıldı, 0005'te
--      yetkisi verildi, ama arayüz onu çağıramıyor çünkü hangi gönderimi
--      puanlayacağını öğrenemiyor. Öğrenci gönderiyor, kayıt 'incelemede'
--      olarak kalıyor, puanlanmasının hiçbir yolu yok.
--
-- Bu dosya `acik_puanla`'ya DOKUNMUYOR — o zaten doğru çalışıyor, yalnız
-- ulaşılamıyordu.
--
-- Bu dosya tekrar çalıştırılabilir.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. odev_gonderimleri — bir ödevin SINIF listesi
--
-- Yalnız gönderenleri değil, SINIFIN TAMAMINI döndürüyor. Öğretmenin bu
-- ekranı açarkenki sorusu çoğu zaman "kim göndermedi"; göndermeyeni listede
-- hiç göstermeyip yalnız bir sayı vermek o soruyu cevapsız bırakırdı.
--
-- CEVAP ANAHTARI DÖNMÜYOR. Bu ekranın işi değil; `odevler_listesi`'nde
-- uygulanan kuralın aynısı (0007). Anahtarın gerektiği tek yer `odev_detay`.
--
-- Gecikme `_gecikmeli` ile hesaplanıyor (0010) — ikinci bir tanım yazılmıyor,
-- yoksa iki yerde iki farklı "gecikme" kuralı oluşurdu.
-- -----------------------------------------------------------------------------
create or replace function public.odev_gonderimleri(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  d public.odevler;
  s public.siniflar;
begin
  perform public._ogretmen(p_token);

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
      'mevcut', (select count(*) from public.ogrenciler o
                  where o.sinif_id = d.sinif_id and o.aktif),
      'gonderen', (select count(*) from public.gonderimler g
                    where g.odev_id = d.id),
      'gecikmeli', (select count(*) from public.gonderimler g
                     where g.odev_id = d.id
                       and public._gecikmeli(g.created_at, d.son_tarih)),
      'puan_bekleyen', (select count(*) from public.gonderimler g
                         where g.odev_id = d.id and g.durum = 'incelemede')
    ),
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
        'foto_var', (g.foto_yolu is not null)
      ) order by o.ad)
      from public.ogrenciler o
      left join public.gonderimler g
        on g.odev_id = d.id and g.ogrenci_id = o.id
      where o.sinif_id = d.sinif_id and o.aktif
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. gonderim_foto_yolu — çözüm fotoğrafının yolu, tek tek
--
-- `odev_dosya_yolu` (0007) deseninin aynısı: liste yanıtı dosya yolu
-- taşımıyor, yol yalnız öğretmen o fotoğrafı gerçekten açmak istediğinde
-- isteniyor. Yirmi kişilik bir sınıfın listesi yirmi dosya yolu taşımasın.
-- -----------------------------------------------------------------------------
create or replace function public.gonderim_foto_yolu(p_token text, p_gonderim uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_yol text;
begin
  perform public._ogretmen(p_token);

  select g.foto_yolu into v_yol
  from public.gonderimler g
  where g.id = p_gonderim;

  if not found then
    raise exception 'Gönderim bulunamadı.' using errcode = 'P0002';
  end if;

  return jsonb_build_object('yol', v_yol);
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. YETKİLER (0005 deseni: önce hepsini çek, sonra açıkça ver)
-- -----------------------------------------------------------------------------
revoke all on function public.odev_gonderimleri(text, uuid)
  from public, anon, authenticated;
grant execute on function public.odev_gonderimleri(text, uuid) to anon, authenticated;

revoke all on function public.gonderim_foto_yolu(text, uuid)
  from public, anon, authenticated;
grant execute on function public.gonderim_foto_yolu(text, uuid) to anon, authenticated;
