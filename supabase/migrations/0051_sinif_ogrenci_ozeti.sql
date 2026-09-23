-- =============================================================================
-- 0051 — SINIF ÖĞRENCİ ÖZETİ: ortalama ve en eksik konu, öğrenci öğrenci
--
-- Öğretmenin isteği: "Öğrenciler sekmesini tıkladığım zaman sınıflar
-- kategorize olmuş bir şekilde çıksın… sınıflara tıkladığım zaman
-- öğrencilerin listesi çıksın. Sınıf listesine göre listesi çıksın. Ve
-- bireysel olarak ödev ortalamaları öğrenci isimlerinin karşısında
-- yazsın. Aynı zamanda en çok eksik olduğu konunun adı da yazsın."
--
-- SINIF KUTUSU İÇİN YENİ UÇ YOK: `siniflar_listesi` sınıfları öğrenci
-- sayısıyla zaten veriyor ve `ogrenciler_listesi` sınıf seçilince zaten
-- okul numarasına göre sıralıyor (ekran `p_sirala='numara'` gönderiyor).
-- Eksik olan yalnız iki sütundu; bu dosya onları getiriyor.
--
-- -----------------------------------------------------------------------------
-- ÖĞRETMENİN DÖRT KARARI
--
--   1. ORTALAMA: teslim süresi DOLMUŞ ama gönderilmemiş ödev 0 sayılır;
--      süresi devam eden ödev hesaba HİÇ girmez.
--      Gerekçesi öğretmenin dil kuralıyla aynı yönde: gerçeği gizleme
--      (göndermediği ödev ortalamayı düşürür) ama henüz zamanı olan bir
--      ödev yüzünden çocuğu bugünden cezalandırma.
--
--   2. EN EKSİK KONU: yanlış + boş sayısı en yüksek konu.
--      `konu_karnesi` (0023) bugün zaten bu ölçütü kullanıyor
--      (`order by (toplam - dogru) desc, konu`). İKİNCİ BİR ÖLÇÜT
--      YAZILMADI: iki ekran aynı öğrenci için farklı konu söylerse
--      öğretmen hangisine güveneceğini bilemez (0030'un dersi).
--
--   3. ALT SINIR: yalnız TOPLAM 5+ soru çözülmüş konular aday.
--      Altında kalan öğrencide alan `null` dönüyor ve ekran "yeterli
--      veri yok" yazıyor. İki soruda iki yanlış "en eksik konu" değildir.
--
--   4. Ekranın arama kutusu ve düz listesi KALIYOR (arayüz kararı).
--
-- -----------------------------------------------------------------------------
-- HİÇ YANLIŞI OLMAYAN ÖĞRENCİYE KONU YAZILMIYOR
--
-- Bu kararı öğretmen sormadı, ben ekledim ve gerekçesi onun dil kuralı:
-- ÖĞRENCİYİ ETİKETLEME. Bütün soruları doğru yapmış bir çocuğun
-- karşısına "en eksik konu: Köklü Sayılar" yazmak, olmayan bir eksiği
-- isimlendirmek olurdu. `(toplam - dogru) > 0` koşulu bunu engelliyor.
--
-- -----------------------------------------------------------------------------
-- KONU VERİSİ TEK KAYNAKTAN
--
-- `_konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)`
-- — `konu_karnesi`'nin kullandığı yardımcının AYNISI. Süzgeçler de birebir
-- aynı: `d.yayinda`, `d.son_tarih < bugun_tr`, `d.tur = 'test'`.
-- Açık uçlu ödevde soru bazlı analiz yok, o yüzden konu hesabına girmiyor
-- — ama PUANI ortalamaya giriyor (ayrı şeyler).
--
-- `bugun_tr` da aynı: `(now() at time zone 'Europe/Istanbul')::date`.
-- Sunucu UTC'de; sade `current_date` Türkiye'de gece yarısından sonra
-- bir gün geriden gelirdi.
-- =============================================================================

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

               -- ORTALAMA — öğretmenin 1. kararı.
               -- Süresi dolmuş her ödev sayılıyor; gönderilmemişse 0.
               -- Gönderilmişse öğretmen puanı varsa o, yoksa otomatik puan
               -- (`coalesce(ogretmen_puan, puan)` — deponun her yerindeki
               -- ölçüt).
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
               ),

               -- SÜRESİ DOLMUŞ ÖDEV SAYISI. Ortalamanın kaç ödev üzerinden
               -- hesaplandığını ekran söyleyebilsin diye: "48,5 · 12 ödev".
               -- Sıfırsa ortalama zaten null ve ekran "henüz ödev yok" der.
               'odev_sayisi', (
                 select count(*)::integer from public.odevler d
                  where d.sinif_id = p_sinif_id and d.yayinda
                    and d.son_tarih < bugun_tr
               ),

               -- EN EKSİK KONU — öğretmenin 2. ve 3. kararı.
               -- Ölçüt `konu_karnesi` ile birebir aynı: (toplam - dogru)
               -- yani yanlış + boş. Alt sınır 5 soru. Hiç yanlışı yoksa
               -- null (öğrenciyi etiketleme).
               'en_eksik_konu', (
                 select t.konu
                   from (
                     select e->>'konu' as konu,
                            sum((e->>'toplam')::integer) as toplam,
                            sum((e->>'dogru')::integer)  as dogru
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
                        and d.tur = 'test'
                      group by e->>'konu'
                   ) t
                  where t.toplam >= 5
                    and (t.toplam - t.dogru) > 0
                  order by (t.toplam - t.dogru) desc, t.konu
                  limit 1
               )
             )
             -- SINIF LİSTESİ SIRASI (öğretmenin isteği): okul numarası.
             -- Numarası olmayan öğrenci sona, kendi içinde ada göre.
             order by o.ogrenci_no is null, o.ogrenci_no, o.ad)
      from public.ogrenciler o
      where o.sinif_id = p_sinif_id and o.aktif
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.sinif_ogrenci_ozeti(text, uuid) from public, anon, authenticated;
grant execute on function public.sinif_ogrenci_ozeti(text, uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- KENDİNİ DENETLEME
-- -----------------------------------------------------------------------------
do $$
declare
  v_sayi integer;
begin
  select count(*) into v_sayi
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'sinif_ogrenci_ozeti';

  if v_sayi <> 1 then
    raise exception '0051: sinif_ogrenci_ozeti % imzayla duruyor, 1 olmalı', v_sayi;
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'sinif_ogrenci_ozeti'
       and pg_catalog.oidvectortypes(p.proargtypes) = 'text, uuid'
  ) then
    raise exception '0051: sinif_ogrenci_ozeti imzası beklenen (text, uuid) değil';
  end if;

  -- KONU ÖLÇÜTÜ `konu_karnesi` İLE AYNI KALMALI. İkisi ayrışırsa iki ekran
  -- aynı öğrenci için farklı konu söyler. Kaba ama tam bu ayrışmayı arayan
  -- bir tarama.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'sinif_ogrenci_ozeti'
       and pg_get_functiondef(p.oid) like '%_konu_analizi%'
  ) then
    raise exception '0051: konu hesabı _konu_analizi kullanmıyor — ikinci bir ölçüt yazılmış';
  end if;
end $$;

select public._migration_kaydet('0051');
