-- SEKİZ — 0040: Haftalık, aylık ve dönemlik sınıf analizi
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Beklenen sonuç: "Success. No rows returned."
-- Açıklamalı tam sürüm: supabase/migrations/0040_donem_analizi.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Yedek)
-- ÖNCE SİTE YAYINA ALINMIŞ OLMALI.
--
-- 0039'A BAĞLI DEĞİL. 0039'u (okul yönetimi bilgilendirmesi) henüz
-- çalıştırmadıysanız bu dosya yine de çalışır — ikisi birbirinden
-- bağımsız. Ölçüldü: 0039 atlanarak kurulmuş ayrı bir veritabanında
-- analiz testlerinin 9 grubu da geçti. Sırayla gitmek yine de daha
-- düzenli olur.
--
-- NE YAPIYOR: Sınıf ekranına "Analiz" ekliyor. Bir sınıfın ödevlerinden
-- HAFTALIK, AYLIK ve seçtiğiniz TARİH ARALIĞI için ortalama, iyi giden
-- konular ve çalışılması gereken konular çıkarıyor.
--
-- HANGİ ÖDEVLER GİRİYOR: yayında olan ve SON TESLİM TARİHİ GEÇMİŞ
-- ödevler — ürünün geri kalanıyla aynı ölçüt. Ödev, son teslim
-- tarihinin düştüğü haftaya sayılıyor.
--
-- KONU DÖKÜMÜ yalnız test ödevlerinden çıkar; açık uçlu ödevin konu
-- eşlemesi yoktur ama puanı ortalamaya girer.
--
-- BEŞ SORUDAN AZ olan konu "az veri" diye işaretlenir: listede durur,
-- ama "iyi" ya da "çalışılmalı" diye damgalanmaz. İki soruluk bir konuya
-- "çalışılması gerekiyor" demek, olmayan bir bilgi vermek olurdu.
--
-- KİM GÖREBİLİYOR: her öğretmen YALNIZ KENDİ sınıfının analizini alıyor.
-- Ekranda tek bir öğrenci adı geçmiyor — bu bir KONU dökümü, öğrenci
-- listesi değil.
--
-- Yeni tablo yok, veri silinmiyor, onam akışı değişmiyor.

create or replace function public._konu_esikleri()
returns jsonb
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select jsonb_build_object('iyi', 70, 'calisilmali', 50, 'en_az_soru', 5);
$$;

-- DAMGA, EKRANDA YAZAN YÜZDEYLE AYNI SAYIDAN ÇIKIYOR. Ekran oranı
-- yuvarlayarak gösteriyor (`round`). Damga yuvarlanmamış orandan çıksaydı
-- 69,6'lık bir konu tabloda "%70" yazıp yanında "Orta" damgası taşırdı —
-- oysa hemen üstünde "iyi: %70 ve üstü" yazıyor. Öğretmen ekranda kendi
-- kendini yalanlayan bir satır görürdü.
create or replace function public._konu_durumu(p_toplam integer, p_dogru integer)
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select case
    when coalesce(p_toplam, 0) < (public._konu_esikleri()->>'en_az_soru')::integer
      then 'az_veri'
    when round(100.0 * p_dogru / p_toplam)
         >= (public._konu_esikleri()->>'iyi')::numeric
      then 'iyi'
    when round(100.0 * p_dogru / p_toplam)
         <  (public._konu_esikleri()->>'calisilmali')::numeric
      then 'calisilmali'
    else 'orta'
  end;
$$;

create or replace function public.sinif_analizi(
  p_token      text,
  p_sinif_id   uuid,
  p_baslangic  date default null,
  p_bitis      date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun_tr    date := (now() at time zone 'Europe/Istanbul')::date;
  v_ogretmen  uuid;
  v_sinif     record;
  v_bas       date;
  v_bit       date;
  v_varsayilan boolean;
  v_mevcut    integer;
  v_haftalar  jsonb;
  v_aylar     jsonb;
  v_ozet      jsonb;
begin
  v_ogretmen := public._ogretmen(p_token);

  if not public._ogretmenin_sinifi(v_ogretmen, p_sinif_id) then
    raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
  end if;

  select s.id, s.ad into v_sinif from public.siniflar s where s.id = p_sinif_id;
  if not found then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;

  -- VARSAYILAN ARALIK: son 12 hafta. Öğretmenin isteği "otomatik gelsin"
  -- idi; ekran açılır açılmaz bir şey göstermesi için bir varsayılan
  -- gerekiyor. Dönem analizi için tarihleri kendisi seçiyor.
  v_varsayilan := p_baslangic is null and p_bitis is null;
  v_bit := coalesce(p_bitis, bugun_tr);
  v_bas := coalesce(p_baslangic, (date_trunc('week', bugun_tr) - interval '11 weeks')::date);

  if v_bas > v_bit then
    raise exception 'Başlangıç tarihi bitişten sonra olamaz.' using errcode = '22023';
  end if;

  select count(*)::integer into v_mevcut
  from public.ogrenciler o where o.sinif_id = p_sinif_id and o.aktif;

  -- ---------------------------------------------------------------------------
  -- HAFTALIK
  --
  -- `date_trunc('week', …)` PostgreSQL'de PAZARTESİ'den başlıyor — Türkiye'de
  -- okul haftası da öyle.
  -- ---------------------------------------------------------------------------
  with odev as (
    select d.id, d.tur, d.son_tarih,
           date_trunc('week',  d.son_tarih)::date as kova
      from public.odevler d
     where d.sinif_id = p_sinif_id
       and d.yayinda
       and d.son_tarih < bugun_tr
       and d.son_tarih between v_bas and v_bit
  ),
  puan as (
    select o.kova, coalesce(g.ogretmen_puan, g.puan) as p
      from odev o
      join public.gonderimler g on g.odev_id = o.id
      join public.ogrenciler  k on k.id = g.ogrenci_id
     where k.sinif_id = p_sinif_id and k.aktif
       and coalesce(g.ogretmen_puan, g.puan) is not null
  ),
  konu as (
    select o.kova, e->>'konu' as konu,
           sum((e->>'toplam')::integer)::integer as toplam,
           sum((e->>'dogru')::integer)::integer  as dogru
      from odev o
      join public.odevler     d on d.id = o.id
      join public.gonderimler g on g.odev_id = d.id
      join public.ogrenciler  k on k.id = g.ogrenci_id
      cross join lateral jsonb_array_elements(
        public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
      ) e
     where k.sinif_id = p_sinif_id and k.aktif
       and d.tur = 'test'
     group by o.kova, e->>'konu'
  ),
  kovalar as (
    select kova,
           count(*)::integer as odev_sayisi,
           count(*) filter (where tur = 'test')::integer as test_sayisi
      from odev group by kova
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'baslangic', b.kova,
           'bitis', (b.kova + 6),
           'odev_sayisi', b.odev_sayisi,
           'test_sayisi', b.test_sayisi,
           'gonderim', (select count(*)::integer from puan p where p.kova = b.kova),
           'ortalama', (select round(avg(p.p), 1) from puan p where p.kova = b.kova),
           'konular', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'konu', t.konu, 'toplam', t.toplam, 'dogru', t.dogru,
                      'oran', round(100.0 * t.dogru / t.toplam),
                      'durum', public._konu_durumu(t.toplam, t.dogru))
                    order by (t.toplam - t.dogru) desc, t.konu)
               from konu t where t.kova = b.kova), '[]'::jsonb)
         ) order by b.kova desc), '[]'::jsonb)
    into v_haftalar
    from kovalar b;

  -- ---------------------------------------------------------------------------
  -- AYLIK — haftalığın aynısı, yalnız kova `month`
  -- ---------------------------------------------------------------------------
  with odev as (
    select d.id, d.tur, date_trunc('month', d.son_tarih)::date as kova
      from public.odevler d
     where d.sinif_id = p_sinif_id and d.yayinda
       and d.son_tarih < bugun_tr
       and d.son_tarih between v_bas and v_bit
  ),
  puan as (
    select o.kova, coalesce(g.ogretmen_puan, g.puan) as p
      from odev o
      join public.gonderimler g on g.odev_id = o.id
      join public.ogrenciler  k on k.id = g.ogrenci_id
     where k.sinif_id = p_sinif_id and k.aktif
       and coalesce(g.ogretmen_puan, g.puan) is not null
  ),
  konu as (
    select o.kova, e->>'konu' as konu,
           sum((e->>'toplam')::integer)::integer as toplam,
           sum((e->>'dogru')::integer)::integer  as dogru
      from odev o
      join public.odevler     d on d.id = o.id
      join public.gonderimler g on g.odev_id = d.id
      join public.ogrenciler  k on k.id = g.ogrenci_id
      cross join lateral jsonb_array_elements(
        public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
      ) e
     where k.sinif_id = p_sinif_id and k.aktif and d.tur = 'test'
     group by o.kova, e->>'konu'
  ),
  kovalar as (
    select kova, count(*)::integer as odev_sayisi,
           count(*) filter (where tur = 'test')::integer as test_sayisi
      from odev group by kova
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'ay', b.kova,
           'odev_sayisi', b.odev_sayisi,
           'test_sayisi', b.test_sayisi,
           'gonderim', (select count(*)::integer from puan p where p.kova = b.kova),
           'ortalama', (select round(avg(p.p), 1) from puan p where p.kova = b.kova),
           'konular', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'konu', t.konu, 'toplam', t.toplam, 'dogru', t.dogru,
                      'oran', round(100.0 * t.dogru / t.toplam),
                      'durum', public._konu_durumu(t.toplam, t.dogru))
                    order by (t.toplam - t.dogru) desc, t.konu)
               from konu t where t.kova = b.kova), '[]'::jsonb)
         ) order by b.kova desc), '[]'::jsonb)
    into v_aylar
    from kovalar b;

  -- ---------------------------------------------------------------------------
  -- ARALIĞIN TAMAMI — "dönem analizi" bu
  --
  -- Öğretmen hem yüzde çizgisi hem "en çok eksik üç konu" istedi; ikisi
  -- de burada. `en_eksik_uc` sıralamaya, `iyi`/`calisilmali` çizgiye
  -- dayanıyor — biri ötekinin yerine geçmiyor.
  -- ---------------------------------------------------------------------------
  with odev as (
    select d.id, d.tur
      from public.odevler d
     where d.sinif_id = p_sinif_id and d.yayinda
       and d.son_tarih < bugun_tr
       and d.son_tarih between v_bas and v_bit
  ),
  puan as (
    select coalesce(g.ogretmen_puan, g.puan) as p
      from odev o
      join public.gonderimler g on g.odev_id = o.id
      join public.ogrenciler  k on k.id = g.ogrenci_id
     where k.sinif_id = p_sinif_id and k.aktif
       and coalesce(g.ogretmen_puan, g.puan) is not null
  ),
  konu as (
    select e->>'konu' as konu,
           sum((e->>'toplam')::integer)::integer as toplam,
           sum((e->>'dogru')::integer)::integer  as dogru
      from odev o
      join public.odevler     d on d.id = o.id
      join public.gonderimler g on g.odev_id = d.id
      join public.ogrenciler  k on k.id = g.ogrenci_id
      cross join lateral jsonb_array_elements(
        public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
      ) e
     where k.sinif_id = p_sinif_id and k.aktif and d.tur = 'test'
     group by e->>'konu'
  ),
  damgali as (
    select konu, toplam, dogru,
           round(100.0 * dogru / toplam) as oran,
           public._konu_durumu(toplam, dogru) as durum
      from konu
  )
  select jsonb_build_object(
           'odev_sayisi', (select count(*)::integer from odev),
           'test_sayisi', (select count(*) filter (where tur = 'test')::integer from odev),
           'gonderim', (select count(*)::integer from puan),
           'ortalama', (select round(avg(p), 1) from puan),
           'konular', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'konu', konu, 'toplam', toplam, 'dogru', dogru,
                      'oran', oran, 'durum', durum)
                    order by (toplam - dogru) desc, konu) from damgali), '[]'::jsonb),
           'iyi', coalesce((
             select jsonb_agg(konu order by oran desc, konu)
               from damgali where durum = 'iyi'), '[]'::jsonb),
           'calisilmali', coalesce((
             select jsonb_agg(konu order by oran, konu)
               from damgali where durum = 'calisilmali'), '[]'::jsonb),
           'en_eksik_uc', coalesce((
             select jsonb_agg(konu order by eksik desc, konu)
               from (select konu, (toplam - dogru) as eksik from damgali
                      where durum <> 'az_veri'
                      order by eksik desc, konu limit 3) u), '[]'::jsonb)
         )
    into v_ozet;

  return jsonb_build_object(
    'sinif', jsonb_build_object('id', v_sinif.id, 'ad', v_sinif.ad),
    'aralik', jsonb_build_object(
      'baslangic', v_bas, 'bitis', v_bit, 'varsayilan', v_varsayilan
    ),
    -- Eşikler yanıtta: ekran "iyi" derken hangi çizgiyi kastettiğini
    -- yazabilsin. Çizgiyi arayüze gömseydik sunucuyla ayrışabilirdi —
    -- burada da elle yazsaydık damgayla ayrışırdı. Damganın kullandığı
    -- yardımcının ta kendisi dönüyor.
    'esikler', public._konu_esikleri(),
    'mevcut', v_mevcut,
    'haftalar', v_haftalar,
    'aylar', v_aylar,
    'ozet', v_ozet
  );
end;
$$;

revoke all on function public._konu_esikleri() from public, anon, authenticated;
revoke all on function public._konu_durumu(integer, integer) from public, anon, authenticated;
revoke all on function public.sinif_analizi(text, uuid, date, date) from public, anon, authenticated;
grant execute on function public.sinif_analizi(text, uuid, date, date) to anon, authenticated;

do $$
declare
  eksik text[] := '{}';
begin
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'sinif_analizi') <> 1 then
    eksik := eksik || 'sinif_analizi yok'::text;
  end if;
  if not has_function_privilege('anon', 'public.sinif_analizi(text, uuid, date, date)', 'execute') then
    eksik := eksik || 'sinif_analizi anon''a kapalı'::text;
  end if;
  if has_function_privilege('anon', 'public._konu_durumu(integer, integer)', 'execute') then
    eksik := eksik || '_konu_durumu anon''a açık kalmış'::text;
  end if;
  if has_function_privilege('anon', 'public._konu_esikleri()', 'execute') then
    eksik := eksik || '_konu_esikleri anon''a açık kalmış'::text;
  end if;

  -- KAPSAM KAPISI GÖVDEDE Mİ. Düşerse bir öğretmen başka bir öğretmenin
  -- sınıfının analizini alır.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'sinif_analizi'
      and pg_get_functiondef(p.oid) like '%_ogretmenin_sinifi%'
  ) then
    eksik := eksik || 'sinif_analizi kapsam kapısı taşımıyor'::text;
  end if;

  -- EŞİKLER TEK YERDE Mİ: analiz, sınıflandırmayı kendi içinde
  -- tekrarlamak yerine yardımcıyı çağırmalı.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'sinif_analizi'
      and pg_get_functiondef(p.oid) like '%_konu_durumu%'
  ) then
    eksik := eksik || 'sinif_analizi eşik yardımcısını kullanmıyor'::text;
  end if;

  -- YAZAN ÇİZGİ İLE DAMGALAYAN ÇİZGİ AYNI MI.
  --
  -- Yukarıdaki "yardımcıyı çağırıyor mu" ölçümü yetmez: çağırıp yanında
  -- başka bir sayı da yazabilir. Burada sınır değerleri ESİKLERDEN
  -- TÜRETİLİP damgaya soruluyor. Sınırları buraya elle yazsaydık ölçüm de
  -- aynı sabiti tekrarlar ve ayrışmayı göremezdi.
  declare
    e_iyi  integer := (public._konu_esikleri()->>'iyi')::integer;
    e_cal  integer := (public._konu_esikleri()->>'calisilmali')::integer;
    e_az   integer := (public._konu_esikleri()->>'en_az_soru')::integer;
  begin
    if public._konu_durumu(100, e_iyi) <> 'iyi' then
      eksik := eksik || format('%%%s doğru "iyi" sayılmıyor', e_iyi);
    end if;
    if public._konu_durumu(100, e_iyi - 1) = 'iyi' then
      eksik := eksik || format('%%%s doğru "iyi" sayılıyor (çizginin altında)', e_iyi - 1);
    end if;
    if public._konu_durumu(100, e_cal - 1) <> 'calisilmali' then
      eksik := eksik || format('%%%s doğru "çalışılmalı" sayılmıyor', e_cal - 1);
    end if;
    if public._konu_durumu(100, e_cal) = 'calisilmali' then
      eksik := eksik || format('%%%s doğru "çalışılmalı" sayılıyor (çizginin üstünde)', e_cal);
    end if;
    -- Az veri sınırı: bir eksiği tamamı doğru olsa bile damgalanmalı.
    if public._konu_durumu(e_az - 1, e_az - 1) <> 'az_veri' then
      eksik := eksik || format('%s soru "az veri" sayılmıyor', e_az - 1);
    end if;
    if public._konu_durumu(e_az, e_az) = 'az_veri' then
      eksik := eksik || format('%s soru "az veri" sayılıyor (sınırda)', e_az);
    end if;
  end;

  -- Yanıttaki `esikler` alanı gerçekten yardımcıdan mı geliyor: elle
  -- yazılmış bir jsonb kalmışsa gövdede görünür.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'sinif_analizi'
      and pg_get_functiondef(p.oid) like '%''esikler'', jsonb_build_object%'
  ) then
    eksik := eksik || 'sinif_analizi esikler alanını elle yazıyor'::text;
  end if;

  if array_length(eksik, 1) is not null then
    raise exception '0040 EKSİK KALDI: %', array_to_string(eksik, ' | ');
  end if;

  raise notice '0040 tamam — haftalık, aylık ve dönemlik sınıf analizi hazır.';
end;
$$;
