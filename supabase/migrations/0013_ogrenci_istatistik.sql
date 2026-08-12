-- =============================================================================
-- SEKİZ — 0013 SINIF DETAYI VE ÖĞRENCİ ÖDEV İSTATİSTİKLERİ
--
-- ÖĞRETMENİN İSTEĞİ:
--   "Sınıflar sekmesine tıkladığımda, hangi sınıfa tıklarsam o sınıfın
--    öğrenci listesi açılsın. Ve her öğrenci için o güne kadar verdiğim
--    ödevlerden kaç tanesini yaptı, kaç tanesini yapmadı, ve sadece yaptığı
--    ödevlerin puan ortalaması ayrıca yaptığı ve yapmadığı tüm ödevlerin
--    puan ortalaması görünsün, yapmadığı ödev puanı sıfır olacak şekilde."
--
-- HANGİ ÖDEVLER SAYILIYOR — bilinçli ve dar bir tanım:
--   • yalnız YAYINDAKİ ödevler (taslak öğrenciye hiç düşmedi)
--   • yalnız SÜRESİ DOLMUŞ ödevler
--   • yalnız öğrencinin KENDİ SINIFINA verilenler
--
-- Süresi dolmamış ödevi "yapmadı" sayıp 0 vermek öğrenciye haksızlık olurdu:
-- daha süresi var. Üstelik ortalama her gün kendiliğinden oynardı ve
-- öğretmen aynı öğrenciye iki gün üst üste baktığında farklı sayı görürdü.
--
-- İKİ ORTALAMA, İKİ FARKLI SORU (0012'deki ödev ortalamasıyla aynı ilke):
--   ortalama_yapan → "yaptıklarında ne kadar başarılı"
--   ortalama_tum   → "genel durumu ne" (yapmadığı 0)
-- Bir öğrenci iki ödevden 100 alıp sekizini hiç yapmadıysa, tek bir sayı
-- bunu gizlerdi. İkisi yan yana durunca sorun görünür oluyor.
--
-- Bu dosya tekrar çalıştırılabilir.
-- =============================================================================

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
begin
  perform public._ogretmen(p_token);

  select * into s from public.siniflar where id = p_sinif_id;
  if not found then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;

  -- Bu sınıfa verilmiş, yayınlanmış ve süresi dolmuş ödev sayısı.
  select count(*) into v_odev_sayisi
  from public.odevler d
  where d.sinif_id = p_sinif_id and d.yayinda and d.son_tarih < bugun_tr;

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
        'tur', o.tur,
        'yapti', i.yapti,
        'yapmadi', v_odev_sayisi - i.yapti,
        'ortalama_yapan', i.ortalama_yapan,
        'ortalama_tum', i.ortalama_tum
      ) order by o.ad)
      from public.ogrenciler o
      cross join lateral (
        select
          count(g.id)::integer as yapti,
          round(avg(coalesce(g.ogretmen_puan, g.puan))
                filter (where g.id is not null), 1) as ortalama_yapan,
          case when v_odev_sayisi > 0 then
            round(sum(coalesce(g.ogretmen_puan, g.puan, 0)) / v_odev_sayisi, 1)
          end as ortalama_tum
        from public.odevler d
        left join public.gonderimler g
          on g.odev_id = d.id and g.ogrenci_id = o.id
        where d.sinif_id = p_sinif_id
          and d.yayinda
          and d.son_tarih < bugun_tr
      ) i
      where o.sinif_id = p_sinif_id and o.aktif
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- YETKİLER (0005 deseni)
-- -----------------------------------------------------------------------------
revoke all on function public.sinif_ogrencileri(text, uuid)
  from public, anon, authenticated;
grant execute on function public.sinif_ogrencileri(text, uuid) to anon, authenticated;
