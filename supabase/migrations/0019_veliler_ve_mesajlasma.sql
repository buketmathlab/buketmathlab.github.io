-- =============================================================================
-- SEKİZ — 0019 VELİLER SEKMESİ VE MESAJLAŞMA
--
-- ÖĞRETMENİN KARARI (daha önce alındı): "Veliye mesaj uygulama içinde gitsin."
--
-- Faz 1'de `mesaj_gonder`, `mesajlar_ogretmen`, `okundu_isaretle` yazıldı,
-- yetkileri verildi ve BUGÜNE KADAR ARAYÜZDE HİÇ ÇAĞRILMADI. Bu tur onları
-- gerçekten kullanılabilir hâle getiriyor. Eksik olan tek şey öğretmenin
-- "kim bana yazmış?" sorusuna cevap veren bir uçtu.
--
-- ŞEMA KUSURU — `okundu` tablosunun birincil anahtarı yalnız `ogrenci_id`:
--
--   create table public.okundu (
--     ogrenci_id uuid primary key ...,
--     rol text not null default 'veli' check (rol in ('veli','ogrenci')),
--     zaman timestamptz ...);
--
-- Yani bir öğrenci için TEK satır var; veli okuduğunda öğrencinin kaydı,
-- öğrenci okuduğunda velininki eziliyor (`okundu_isaretle` `on conflict
-- (ogrenci_id)` ile üstüne yazıyor). Öğretmenin okuma durumuna ise hiç yer
-- yok. Bugüne kadar fark edilmedi çünkü bu uç hiç çağrılmadı.
--
-- Düzeltme: birincil anahtar (ogrenci_id, rol) oluyor ve 'ogretmen' rolü
-- kabul ediliyor. Veri kaybı yok — mevcut satırlar olduğu gibi kalıyor.
--
-- Bu dosya tekrar çalıştırılabilir.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. okundu: rol başına ayrı satır
-- -----------------------------------------------------------------------------
do $$
begin
  -- Kısıt önce genişletiliyor: 'ogretmen' satırı yazılabilsin.
  alter table public.okundu drop constraint if exists okundu_rol_check;
  alter table public.okundu
    add constraint okundu_rol_check check (rol in ('veli', 'ogrenci', 'ogretmen'));

  -- Birincil anahtar (ogrenci_id) → (ogrenci_id, rol)
  if exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.okundu'::regclass and c.contype = 'p'
      and (select count(*) from unnest(c.conkey)) = 1
  ) then
    alter table public.okundu drop constraint okundu_pkey;
    alter table public.okundu add primary key (ogrenci_id, rol);
    raise notice 'okundu birincil anahtarı (ogrenci_id, rol) yapıldı.';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. okundu_isaretle — çakışma hedefi düzeltiliyor
--
-- Gövde 0004'ten; tek fark `on conflict (ogrenci_id, rol)`. Eski hâli veli
-- ile öğrencinin kaydını birbirine karıştırıyordu.
-- -----------------------------------------------------------------------------
create or replace function public.okundu_isaretle(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
begin
  select * into o from public._oturum(p_token);
  if o.ogrenci_id is null then
    raise exception 'Geçersiz oturum.' using errcode = '42501';
  end if;

  insert into public.okundu (ogrenci_id, rol, zaman)
  values (o.ogrenci_id, o.rol, now())
  on conflict (ogrenci_id, rol) do update set zaman = now();

  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. ogretmen_okudu — öğretmen bir veli yazışmasını okudu
--
-- Ayrı bir fonksiyon, çünkü öğretmenin oturumunda `ogrenci_id` yok; hangi
-- yazışmayı okuduğunu parametreyle söylüyor.
-- -----------------------------------------------------------------------------
create or replace function public.ogretmen_okudu(p_token text, p_ogrenci_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public._ogretmen(p_token);

  if not exists (select 1 from public.ogrenciler where id = p_ogrenci_id) then
    raise exception 'Öğrenci bulunamadı.' using errcode = 'P0002';
  end if;

  insert into public.okundu (ogrenci_id, rol, zaman)
  values (p_ogrenci_id, 'ogretmen', now())
  on conflict (ogrenci_id, rol) do update set zaman = now();

  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. veliler_listesi — öğretmenin veli sekmesi
--
-- İKİ SORUYA BİRDEN CEVAP VERİYOR:
--   1. "Kim bana yazmış?"  → `yanit_bekleyen`, sınıf ayrımı olmadan, en
--      eski bekleyen üstte. Mesajlaşmada asıl iş bu; sınıfların altına
--      gömseydik öğretmen yanıt bekleyen bir veliyi ancak o sınıfa
--      girerse görürdü.
--   2. "Filanca velinin numarası ne?" → `gruplar`, sınıfa göre.
--
-- Okunmamış sayımı: veliden gelen ve öğretmenin o yazışmayı en son
-- okuduğu andan SONRA yazılmış mesajlar. Öğretmen hiç okumadıysa hepsi.
--
-- MESAJ METNİ LİSTEDE YOK — yalnız zaman ve sayı. Önizleme koysaydık
-- ortak bir ekranda bütün velilerin yazdıkları yan yana görünürdü; kod
-- listesinde uyguladığımız kuralın aynısı.
--
-- Arşivdeki sınıflar burada da yok (0016 kuralı).
-- -----------------------------------------------------------------------------
create or replace function public.veliler_listesi(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  sonuc jsonb;
begin
  perform public._ogretmen(p_token);

  -- Tek sorgu, üç çıktı. GEÇİCİ TABLO KULLANILMIYOR: `security definer` bir
  -- fonksiyonda geçici tablo hem gereksiz hem de search_path'e bağlı bir
  -- kırılganlık. CTE aynı işi yapıyor ve işlem sınırlarına takılmıyor.
  with ozet as (
    select o.id as ogrenci_id, o.ad, o.tur, o.sinif_id,
           s.ad as sinif, s.ozel, s.seviye, s.sube,
           (select max(m.created_at) from public.mesajlar m
             where m.ogrenci_id = o.id) as son_mesaj,
           (select count(*)::integer from public.mesajlar m
             where m.ogrenci_id = o.id and m.kimden = 'veli'
               and m.created_at > coalesce(
                     (select k.zaman from public.okundu k
                       where k.ogrenci_id = o.id and k.rol = 'ogretmen'),
                     '-infinity'::timestamptz)) as okunmamis
    from public.ogrenciler o
    join public.siniflar s on s.id = o.sinif_id
    where o.aktif and not s.arsiv
  )
  select jsonb_build_object(
    'toplam_okunmamis', (select coalesce(sum(okunmamis), 0)::integer from ozet),
    -- En ESKİ bekleyen üstte: en uzun süredir cevapsız kalan veli önce.
    'yanit_bekleyen', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ogrenci_id', ogrenci_id, 'ad', ad, 'sinif', sinif,
               'okunmamis', okunmamis, 'son_mesaj', son_mesaj)
             order by son_mesaj)
      from ozet where okunmamis > 0
    ), '[]'::jsonb),
    'gruplar', coalesce((
      select jsonb_agg(g order by g_seviye, g_sube) from (
        select seviye as g_seviye, sube as g_sube,
               jsonb_build_object(
                 'sinif_id', sinif_id, 'sinif', sinif, 'ozel', ozel,
                 'veli_sayisi', count(*)::integer,
                 'okunmamis', coalesce(sum(okunmamis), 0)::integer
               ) as g
        from ozet
        group by sinif_id, sinif, ozel, seviye, sube
      ) t
    ), '[]'::jsonb)
  ) into sonuc;

  return sonuc;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. sinif_velileri — bir sınıfın velileri
--
-- Kodlar sekmesindeki desenin aynısı: liste hafif, ayrıntı istekle gelir.
-- Mesaj METNİ burada da yok; yalnız kaç okunmamış var ve son mesaj ne zaman.
-- -----------------------------------------------------------------------------
create or replace function public.sinif_velileri(p_token text, p_sinif_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sinif record;
begin
  perform public._ogretmen(p_token);

  select s.id, s.ad, s.ozel, s.arsiv into v_sinif
  from public.siniflar s where s.id = p_sinif_id;
  if not found then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'sinif', jsonb_build_object('id', v_sinif.id, 'ad', v_sinif.ad, 'ozel', v_sinif.ozel),
    'veliler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ogrenci_id', o.id,
               'ad', o.ad,
               'tur', o.tur,
               -- Veli kodu yoksa veli hiç giriş yapamaz; öğretmen bunu
               -- mesaj yazmadan önce bilsin.
               'veli_kodu_var', exists (select 1 from public.giris_kodlari k
                                         where k.ogrenci_id = o.id and k.rol = 'veli'),
               'mesaj_sayisi', (select count(*)::integer from public.mesajlar m
                                 where m.ogrenci_id = o.id),
               'son_mesaj', (select max(m.created_at) from public.mesajlar m
                              where m.ogrenci_id = o.id),
               'okunmamis', (select count(*)::integer from public.mesajlar m
                              where m.ogrenci_id = o.id and m.kimden = 'veli'
                                and m.created_at > coalesce(
                                      (select k.zaman from public.okundu k
                                        where k.ogrenci_id = o.id and k.rol = 'ogretmen'),
                                      '-infinity'::timestamptz))
             ) order by o.ad)
      from public.ogrenciler o
      where o.sinif_id = p_sinif_id and o.aktif
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. mesajlar_ogretmen — öğrencinin adı da dönsün
--
-- Gövde 0004'ten; tek fark öğrenci adının eklenmesi. Mesaj ekranının
-- başlığında "kimle yazışıyorum" yazması gerekiyor ve bunun için ayrı bir
-- istek attırmak gereksiz.
-- -----------------------------------------------------------------------------
create or replace function public.mesajlar_ogretmen(p_token text, p_ogrenci_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  ogr record;
begin
  perform public._ogretmen(p_token);

  select o.id, o.ad, o.tur, s.ad as sinif into ogr
  from public.ogrenciler o
  left join public.siniflar s on s.id = o.sinif_id
  where o.id = p_ogrenci_id;

  if not found then
    raise exception 'Öğrenci bulunamadı.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'ogrenci', jsonb_build_object('id', ogr.id, 'ad', ogr.ad, 'sinif', ogr.sinif),
    'veli_kodu_var', exists (select 1 from public.giris_kodlari k
                              where k.ogrenci_id = ogr.id and k.rol = 'veli'),
    'mesajlar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kimden', m.kimden, 'metin', m.metin, 'zaman', m.created_at)
             order by m.created_at)
      from public.mesajlar m where m.ogrenci_id = p_ogrenci_id
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 6b. veli_paneli — ŞEMA DEĞİŞİKLİĞİNİN KIRDIĞI YER
--
-- `okundu`'nun birincil anahtarını (ogrenci_id, rol) yapınca 0004'teki
--     (select zaman from public.okundu where ogrenci_id = ogr.id)
-- alt sorgusu ÜÇ SATIR dönmeye başlıyor ve veli paneli
-- "more than one row returned by a subquery" ile ÇÖKÜYOR.
--
-- Bunu tahminle değil, test yakaladı. Şemayı değiştiren migration onu
-- okuyan her yeri de onarmak zorunda; aynı dosyada duruyorlar ki biri
-- uygulanıp öbürü unutulmasın.
--
-- Gövde 0004'ten BİREBİR; tek fark rol süzgeci.
-- -----------------------------------------------------------------------------
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

  select ogr2.id, ogr2.ad, ogr2.tur, s.ad as sinif, ogr2.sinif_id into ogr
  from public.ogrenciler ogr2
  left join public.siniflar s on s.id = ogr2.sinif_id
  where ogr2.id = o.ogrenci_id;

  return jsonb_build_object(
    'ogrenci', jsonb_build_object('ad', ogr.ad, 'sinif', ogr.sinif, 'tur', ogr.tur),
    'odevler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'baslik', d.baslik,
        'son_tarih', d.son_tarih,
        'olusturma', d.created_at,
        'gonderildi', (g.id is not null),
        'gonderim_zamani', g.created_at,
        'puan', coalesce(g.ogretmen_puan, g.puan),
        'durum', g.durum
      ) order by d.son_tarih desc)
      from public.odevler d
      left join public.gonderimler g
        on g.odev_id = d.id and g.ogrenci_id = ogr.id
      where d.yayinda and d.sinif_id = ogr.sinif_id
    ), '[]'::jsonb),
    'mesajlar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kimden', m.kimden, 'metin', m.metin, 'zaman', m.created_at)
             order by m.created_at)
      from public.mesajlar m where m.ogrenci_id = ogr.id
    ), '[]'::jsonb),
    'odemeler', case when ogr.tur = 'ozel' then coalesce((
      select jsonb_agg(jsonb_build_object('tutar', p.tutar, 'tarih', p.tarih, 'odendi', p.odendi)
                       order by p.tarih desc)
      from public.odemeler p where p.ogrenci_id = ogr.id
    ), '[]'::jsonb) else '[]'::jsonb end,
    -- ROL SÜZGECİ ŞART (0019): `okundu`'nun birincil anahtarı artık
    -- (ogrenci_id, rol). Süzgeçsiz alt sorgu üç satır döner ve fonksiyon
    -- "more than one row returned by a subquery" ile çöker. Veli paneli
    -- velinin kendi son görülmesini ister.
    'son_gorulme', (select k.zaman from public.okundu k
                     where k.ogrenci_id = ogr.id and k.rol = 'veli')
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. YETKİLER (0005 deseni)
--
-- `mesajlar_ogretmen`'in imzası değişmedi (dönüş şekli değişti), yani eski
-- yetkisi ayakta; yine de açıkça yazılıyor.
-- -----------------------------------------------------------------------------
revoke all on function public.veliler_listesi(text)          from public, anon, authenticated;
revoke all on function public.sinif_velileri(text, uuid)     from public, anon, authenticated;
revoke all on function public.ogretmen_okudu(text, uuid)     from public, anon, authenticated;

grant execute on function public.veliler_listesi(text)       to anon, authenticated;
grant execute on function public.sinif_velileri(text, uuid)  to anon, authenticated;
grant execute on function public.ogretmen_okudu(text, uuid)  to anon, authenticated;
grant execute on function public.mesajlar_ogretmen(text, uuid) to anon, authenticated;
grant execute on function public.okundu_isaretle(text)       to anon, authenticated;
grant execute on function public.veli_paneli(text)           to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 8. KENDİ KENDİNİ DENETLEME
-- -----------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  select count(*) into n
  from pg_constraint c
  where c.conrelid = 'public.okundu'::regclass and c.contype = 'p'
    and (select count(*) from unnest(c.conkey)) = 2;
  if n <> 1 then
    raise exception 'okundu birincil anahtarı iki sütunlu değil; veli ve öğretmen kaydı birbirini ezer.';
  end if;

  -- 'ogretmen' rolü gerçekten yazılabiliyor mu (kısıt genişledi mi)
  begin
    insert into public.okundu (ogrenci_id, rol, zaman)
    select id, 'ogretmen', now() from public.ogrenciler limit 1;
    delete from public.okundu where rol = 'ogretmen';
  exception
    when check_violation then
      raise exception 'okundu tablosu ogretmen rolünü kabul etmiyor.';
    when others then null; -- hiç öğrenci yoksa sorun değil
  end;

  raise notice 'Veliler ve mesajlaşma uçları hazır.';
end $$;
