-- =============================================================================
-- 0053 — EN EKSİK KONU TEKTEN LİSTEYE: `eksik_konular`
--
-- Öğretmenin isteği (yazdırma turu): veliye verilecek fişte *"eksik olduğu
-- konu başlıkları"* yazsın. ÇOĞUL — bugün uç tek bir konu adı döndürüyor.
--
-- `en_eksik_konu` (text) → `eksik_konular` (text dizisi, EN FAZLA 3).
--
-- İMZA AYNI (text, uuid) → 0007 TUZAĞI YOK.
--
-- -----------------------------------------------------------------------------
-- NEDEN İKİ ALAN BİRDEN DURMUYOR
--
-- `en_eksik_konu` bırakılıp yanına `eksik_konular` eklenebilirdi. Yapılmadı:
-- ikisi aynı hesabın iki yazımı olurdu ve bir gün ayrışırlardı — ekran bir
-- konu, kâğıt başka bir konu söylerdi. 0030'un dersi. Ekran artık listenin
-- İLK elemanını gösteriyor; kâğıt hepsini.
--
-- Davranış birebir korunuyor: sıralama ve alt sınır aynı, yani
-- `eksik_konular[1]` 0052'nin `en_eksik_konu`'su ile aynı değer. Test bunu
-- ayrıca ölçüyor.
--
-- -----------------------------------------------------------------------------
-- NEDEN ÜÇ
--
-- Kâğıt bir veliyle konuşurken açılıyor ve konuşma birkaç dakika. Sekiz
-- konu adı yazmak listeyi okunmaz yapardı; tek konu ise "başlıkları"
-- isteğini karşılamıyor. Üç, kesilip verilen bir fişin genişliğine de
-- sığıyor.
--
-- ALT SINIR VE ÖLÇÜT DEĞİŞMEDİ: yalnız toplam 5+ soru çözülmüş ve yanlış +
-- boşu olan konular aday; sıra `(toplam - dogru) desc, konu`. Hiç yanlışı
-- olmayan öğrenciye konu yazılmıyor — boş dizi dönüyor (0051'in kararı:
-- öğrenciyi etiketleme).
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
               -- Puanına bakılmıyor: sıfır alan da yapmıştır.
               'yapilan', (
                 select count(*)::integer from public.odevler d
                  where d.sinif_id = p_sinif_id and d.yayinda
                    and d.son_tarih < bugun_tr
                    and exists (select 1 from public.gonderimler g
                                 where g.odev_id = d.id and g.ogrenci_id = o.id)
               ),

               -- YAPILMAYAN (0052) — aynı kümenin geri kalanı.
               'yapilmayan', (
                 select count(*)::integer from public.odevler d
                  where d.sinif_id = p_sinif_id and d.yayinda
                    and d.son_tarih < bugun_tr
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
    raise exception '0053: sinif_ogrenci_ozeti % imzayla duruyor, 1 olmalı', v_sayi;
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'sinif_ogrenci_ozeti'
       and pg_catalog.oidvectortypes(p.proargtypes) = 'text, uuid'
  ) then
    raise exception '0053: sinif_ogrenci_ozeti imzası beklenen (text, uuid) değil';
  end if;

  -- 0051'in ve 0052'nin güvenceleri kaybolmasın: bu dosya gövdeyi yeniden
  -- yazıyor ve yeniden yazılan her gövde eski güvenceyi düşürebilir.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'sinif_ogrenci_ozeti'
       and pg_get_functiondef(p.oid) like '%_konu_analizi%'
  ) then
    raise exception '0053: konu hesabı _konu_analizi kullanmıyor — 0051 güvencesi düştü';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'sinif_ogrenci_ozeti'
       and pg_get_functiondef(p.oid) like '%''yapilmayan''%'
  ) then
    raise exception '0053: yapilan/yapilmayan alanları düştü — 0052 güvencesi kayıp';
  end if;

  -- YENİ ALAN GERÇEKTEN VAR MI, ESKİSİ GERÇEKTEN GİTTİ Mİ. İkisi bir arada
  -- kalırsa iki yazım bir gün ayrışır (bu dosyanın başındaki gerekçe).
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'sinif_ogrenci_ozeti'
       and pg_get_functiondef(p.oid) like '%''eksik_konular''%'
  ) then
    raise exception '0053: eksik_konular alanı gövdede yok';
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'sinif_ogrenci_ozeti'
       and pg_get_functiondef(p.oid) like '%''en_eksik_konu''%'
  ) then
    raise exception '0053: eski en_eksik_konu alanı hâlâ gövdede — iki yazım bir arada';
  end if;
end $$;

select public._migration_kaydet('0053');
