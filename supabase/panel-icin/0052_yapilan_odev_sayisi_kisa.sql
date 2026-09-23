-- SEKİZ — 0052: kaç ödev yapıldı, kaç tanesi yapılmadı
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Açıklamalı tam sürüm: supabase/migrations/0052_yapilan_odev_sayisi.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Yedek)
-- BU SQL ÖNCE ÇALIŞMALI, SİTE SONRA YAYINA ALINMALI.
-- 0051 ÇALIŞMIŞ OLMALI.
--
-- NE YAPIYOR: Öğrenciler sekmesinde bir sınıfa dokununca çıkan listede,
-- ortalamanın altına iki sayı daha geliyor: öğrencinin kaç ödevi
-- yaptığı ve kaç tanesini yapmadığı.
--
-- HANGİ ÖDEVLER SAYILIYOR: teslim süresi DOLMUŞ ödevler — ortalamanın
-- hesaplandığı ödevlerin tam olarak aynısı. Süresi devam eden bir ödev
-- "yapılmadı" sayılmıyor; teslim tarihi gelmemiş bir ödev yüzünden
-- öğrenci bugünden eksik görünmesin diye.
--
-- Böylece üç sayı birbiriyle tutarlı okunuyor:
--   yapılan + yapılmayan = ödev sayısı   (ve ortalama o sayı üzerinden)
--
-- SIFIR ALAN ÖĞRENCİ ÖDEVİ YAPMIŞ SAYILIYOR: sayım puana bakmıyor.
-- Yaptı, sonucu sıfır çıktı — ikisi ayrı şey ve ekran ikisini ayrı
-- gösteriyor.
--
-- Veri SİLİNMİYOR, hiçbir tablo değişmiyor; tek bir fonksiyon yenileniyor.
--
-- Beklenen sonuç: en altta tek satırlık bir tablo (_migration_kaydet → 0052).
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

               -- ORTALAMA — öğretmenin 1. kararı (0051).
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

               -- SÜRESİ DOLMUŞ ÖDEV SAYISI — ortalamanın paydası.
               'odev_sayisi', (
                 select count(*)::integer from public.odevler d
                  where d.sinif_id = p_sinif_id and d.yayinda
                    and d.son_tarih < bugun_tr
               ),

               -- YAPILAN (0052) — bu ödevlerin kaçında GÖNDERİM VAR.
               -- Puanına bakılmıyor: sıfır alan da yapmıştır. Geç teslim
               -- de yapılmıştır — gönderim satırı varsa iş görülmüştür.
               'yapilan', (
                 select count(*)::integer from public.odevler d
                  where d.sinif_id = p_sinif_id and d.yayinda
                    and d.son_tarih < bugun_tr
                    and exists (select 1 from public.gonderimler g
                                 where g.odev_id = d.id and g.ogrenci_id = o.id)
               ),

               -- YAPILMAYAN (0052) — aynı kümenin geri kalanı.
               -- Ekranda çıkarma yapılmıyor; kavramın tanımı burada.
               'yapilmayan', (
                 select count(*)::integer from public.odevler d
                  where d.sinif_id = p_sinif_id and d.yayinda
                    and d.son_tarih < bugun_tr
                    and not exists (select 1 from public.gonderimler g
                                     where g.odev_id = d.id and g.ogrenci_id = o.id)
               ),

               -- EN EKSİK KONU — öğretmenin 2. ve 3. kararı (0051).
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
    raise exception '0052: sinif_ogrenci_ozeti % imzayla duruyor, 1 olmalı', v_sayi;
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'sinif_ogrenci_ozeti'
       and pg_catalog.oidvectortypes(p.proargtypes) = 'text, uuid'
  ) then
    raise exception '0052: sinif_ogrenci_ozeti imzası beklenen (text, uuid) değil';
  end if;

  -- 0051'in konu güvencesi kaybolmasın: bu dosya onun gövdesini yeniden
  -- yazıyor ve yeniden yazılan her gövde eski güvenceyi düşürebilir.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'sinif_ogrenci_ozeti'
       and pg_get_functiondef(p.oid) like '%_konu_analizi%'
  ) then
    raise exception '0052: konu hesabı _konu_analizi kullanmıyor — 0051 güvencesi düştü';
  end if;

  -- YENİ ALANLAR GERÇEKTEN VAR MI. Panelde yanlış dosya çalıştırılırsa
  -- ekran boş sayı gösterir ve kimse fark etmez.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'sinif_ogrenci_ozeti'
       and pg_get_functiondef(p.oid) like '%''yapilmayan''%'
  ) then
    raise exception '0052: yapilan/yapilmayan alanları gövdede yok';
  end if;
end $$;

select public._migration_kaydet('0052');
