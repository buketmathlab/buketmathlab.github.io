-- =============================================================================
-- 0042 — ÖĞRENCİ NUMARASI
--
-- NE İSTENDİ
-- Öğretmen, e-Okul PDF'inden sınıf aktarırken sordu: "PDF'den öğrencilerin
-- numaralarını almıyor, öğrencinin ismini [alıyor]. Onu ekletebilir miyiz?"
--
-- 0042'DEN ÖNCE NUMARA BİLEREK ATILIYORDU. Şemada duracağı bir alan yoktu
-- ve adın içinde kalması kusurdu: ad alanı `601 Ali Yılmaz Erkek` diye
-- kaydediliyordu. Artık numaranın kendi alanı var.
--
-- ÖĞRETMENİN İKİ KARARI
--   · Numara YALNIZ öğrenci listelerinde görünecek.
--   · Aynı sınıfta numara tekrar ederse UYARILACAK, ENGELLENMEYECEK.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SÜTUN
--
-- NULL OLABİLİR ve bu bir eksiklik değil, gereklilik: özel ders
-- öğrencisinin okul numarası yoktur. Zorunlu yapsaydık onları kayıt dışı
-- bırakırdık.
--
-- METİN, SAYI DEĞİL. Okul numaraları başında sıfır taşıyabiliyor ("0601")
-- ve sayıya çevirmek onu sessizce "601" yapardı. Ayrıca numara üzerinde
-- toplama çıkarma yapmıyoruz; o bir kimlik, bir miktar değil.
-- -----------------------------------------------------------------------------
alter table public.ogrenciler
  add column if not exists ogrenci_no text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ogrenci_no_gecerli'
  ) then
    alter table public.ogrenciler
      add constraint ogrenci_no_gecerli
      check (ogrenci_no is null or (btrim(ogrenci_no) <> '' and length(ogrenci_no) <= 20));
  end if;
end;
$$;

-- İNDEKS VAR, UNIQUE YOK.
--
-- Öğretmenin kararı "uyar, engelleme". Unique olsaydı, PDF'ten yanlış
-- okunan TEK bir numara 30 kişilik sınıfın tamamının reddedilmesine yol
-- açardı — ve öğretmen hangi satır yüzünden olduğunu ekrandan anlayamazdı.
-- Uyarı arayüzde veriliyor; karar öğretmenin.
create index if not exists ogrenciler_no_idx
  on public.ogrenciler (sinif_id, ogrenci_no);

-- -----------------------------------------------------------------------------
-- 2. TOPLU EKLEME — İMZA DEĞİŞMİYOR
--
-- 0007 TUZAĞINDAN BİLEREK KAÇINILDI. `p_adlar`a yeni bir parametre
-- eklemek YENİ bir fonksiyon yaratır, eskisi ortada kalır ve PostgREST
-- hangisini çağıracağını bilemez (0007'de tam olarak bu yaşandı).
--
-- Burada buna hiç gerek yok: `p_adlar` zaten `jsonb`. Artık HEM eski
-- biçimi (dizgi dizisi) HEM de yeni biçimi (`{ad, no}` nesneleri) kabul
-- ediyor. İmza aynı kaldığı için ortada düşürülecek bir şey de yok.
--
-- Eski biçimin çalışmaya devam etmesi TEST EDİLİYOR: bir arayüz sürümü
-- geride kalırsa sessizce bozulmasın.
-- -----------------------------------------------------------------------------
-- İKİ BİÇİMİ TEK YERDE ÇÖZEN YARDIMCILAR.
--
-- Eleman ya düz bir dizgi ("Ali Yılmaz") ya da bir nesne
-- ({"ad": "Ali Yılmaz", "no": "601"}). Ayrımı iki yerde tekrarlamak
-- yerine (denetleme geçişi ve yazma geçişi) tek yerde yapılıyor: biri
-- değişip öteki kalırsa denetlenen ile yazılan farklı şeyler olurdu.
create or replace function public._toplu_ad(p_eleman jsonb)
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select case jsonb_typeof(p_eleman)
    when 'string' then p_eleman #>> '{}'
    when 'object' then p_eleman ->> 'ad'
    else null
  end;
$$;

create or replace function public._toplu_no(p_eleman jsonb)
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select case jsonb_typeof(p_eleman)
    when 'object' then nullif(btrim(coalesce(p_eleman ->> 'no', '')), '')
    else null
  end;
$$;

create or replace function public.ogrenciler_toplu_ekle(
  p_token text,
  p_tur text,
  p_sinif_id uuid,
  p_adlar jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  ogel       jsonb;
  ad         text;
  no         text;
  sira       integer := 0;
  adet       integer;
  yeni_id    uuid;
  kod_ogr    text;
  kod_veli   text;
  sonuc      jsonb := '[]'::jsonb;
  v_ogretmen uuid;
begin
  -- Okul öğrencisi toplu eklemek okul düzeyinde bir iş: sahipte.
  v_ogretmen := public._yonetici(p_token);

  if p_tur is null or p_tur not in ('okul', 'ozel') then
    raise exception 'Öğrenci türü ''okul'' ya da ''ozel'' olmalı.'
      using errcode = '22023';
  end if;

  -- `ogrenci_ekle`'deki kuralın aynısı (0004): okul öğrencisi sınıfsız olamaz.
  if p_tur = 'okul' and p_sinif_id is null then
    raise exception 'Okul öğrencisi için sınıf seçilmeli.' using errcode = '22023';
  end if;

  if p_adlar is null or jsonb_typeof(p_adlar) <> 'array' then
    raise exception 'Ad listesi bir dizi olmalı.' using errcode = '22023';
  end if;

  adet := jsonb_array_length(p_adlar);
  if adet = 0 then
    raise exception 'Listede hiç ad yok.' using errcode = '22023';
  end if;

  -- ÜST SINIR. Bir sınıf ~35 kişi; 200 hem fazlasıyla rahat hem de tek bir
  -- isteğin veritabanında ne kadar iş yapabileceğini sınırlıyor.
  if adet > 200 then
    raise exception 'Tek seferde en fazla 200 öğrenci eklenebilir; % ad gönderildi.', adet
      using errcode = '22023';
  end if;

  -- ---------------------------------------------------------------------------
  -- ÖNCE HEPSİNİ DENETLE, SONRA YAZ
  --
  -- DÜRÜST OLMAK GEREKİRSE: atomikliği bu ayrı geçiş SAĞLAMIYOR. Fonksiyon
  -- hata fırlattığında PostgreSQL zaten bütün ifadeyi geri alıyor — tek
  -- geçişle yazsaydık da yarım kayıt kalmazdı. Ayrı geçişin kazandırdığı
  -- şey BOŞA İŞ YAPMAMAK: 200 adlık bir listede 200. ad bozuksa, önce 199
  -- öğrenci ve 398 kod üretip sonra hepsini çöpe atmıyoruz. `_yeni_kod`
  -- her çağrıda çakışma sorgusu yapıyor; o iş de boşa gitmiyor.
  -- ---------------------------------------------------------------------------
  for ogel in select jsonb_array_elements(p_adlar) loop
    sira := sira + 1;
    ad := btrim(coalesce(public._toplu_ad(ogel), ''));
    no := public._toplu_no(ogel);

    if ad = '' then
      raise exception '%. satırdaki ad boş. Hiçbir öğrenci eklenmedi.', sira
        using errcode = '22023';
    end if;
    if length(ad) > 100 then
      raise exception '%. satırdaki ad 100 karakterden uzun. Hiçbir öğrenci eklenmedi.', sira
        using errcode = '22023';
    end if;
    if no is not null and length(no) > 20 then
      raise exception '%. satırdaki numara 20 karakterden uzun. Hiçbir öğrenci eklenmedi.', sira
        using errcode = '22023';
    end if;
  end loop;

  -- ---------------------------------------------------------------------------
  -- YAZMA
  -- ---------------------------------------------------------------------------
  for ogel in select jsonb_array_elements(p_adlar) loop
    ad := btrim(public._toplu_ad(ogel));
    no := public._toplu_no(ogel);

    -- `sinif_id` olduğu gibi geçiyor — `ogrenci_ekle` ile aynı davranış.
    insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, ogrenci_no)
    values (ad, p_tur, p_sinif_id, v_ogretmen, no)
    returning id into yeni_id;

    kod_ogr  := public._yeni_kod();
    kod_veli := public._yeni_kod();

    insert into public.giris_kodlari (kod, ogrenci_id, rol)
    values (kod_ogr, yeni_id, 'ogrenci'), (kod_veli, yeni_id, 'veli');

    -- TOPLU İŞ DE İZ BIRAKIR. Öğrenci başına ayrı kayıt: "30 öğrenci
    -- eklendi" tek satırı, sonradan tek bir öğrencinin nereden geldiğini
    -- sormak gerektiğinde hiçbir şey söylemezdi (Part XLIII).
    perform public._denetim('ogrenci_eklendi', 'ogrenciler', yeni_id, public._aktor(v_ogretmen));

    sonuc := sonuc || jsonb_build_object(
      'id', yeni_id, 'ad', ad, 'ogrenci_no', no,
      'ogrenci_kodu', kod_ogr, 'veli_kodu', kod_veli
    );
  end loop;

  return jsonb_build_object('eklenen', sonuc, 'adet', jsonb_array_length(sonuc));
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. TEK ÖĞRENCİ — BURADA 0007 TUZAĞI GERÇEK
--
-- `ogrenci_ekle`ye varsayılanlı bir parametre eklemek YENİ bir fonksiyon
-- yaratıyor; eski 4 parametreli imza ortada kalıyor ve PostgREST çağrıyı
-- ona da yönlendirebiliyor — o da numarayı hiç yazmıyor. Sessiz veri
-- kaybı. Bu yüzden eski imza AÇIKÇA düşürülüyor ve düştüğü sınanıyor.
-- -----------------------------------------------------------------------------
-- GÖVDE 0033'ÜN AYNISI, YALNIZ NUMARA EKLENDİ.
--
-- İlk yazımda gövde baştan yazılmıştı ve üç davranış sessizce
-- kayboluyordu: sahiplik kapısı `_yonetici`den `_ogretmen`e düşmüştü
-- (yani her öğretmen öğrenci ekleyebilecekti), özel ders öğrencisinin
-- sınıfını kendiliğinden seçen blok gitmişti, dönüş alanları değişmişti.
-- Çalışan bir gövdeyi hatırdan yeniden yazmak, sessizce kural değiştirmek
-- demek. Mevcut gövde kopyalandı; eklenen tek şey numara.
create or replace function public.ogrenci_ekle(
  p_token text,
  p_ad text,
  p_tur text,
  p_sinif_id uuid default null,
  p_ogrenci_no text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  yeni_id uuid;
  v_sinif uuid := p_sinif_id;
  v_id uuid;
  kod_ogrenci text;
  kod_veli text;
  -- Boş ya da yalnız boşluktan ibaret numara NULL'a düşüyor: boş dizgi
  -- "numarası yok"tan farklı bir şeymiş gibi durmasın.
  v_no text := nullif(btrim(coalesce(p_ogrenci_no, '')), '');
begin
  -- Özel ders de okul öğrencisi de sahibe ait: öğretmenin kuralı gereği
  -- özel ders özelliği başka hiçbir öğretmende yok.
  v_id := public._yonetici(p_token);

  if v_sinif is null and p_tur = 'ozel' then
    select id into v_sinif from public.siniflar where ozel;
  end if;

  if p_tur = 'okul' and v_sinif is null then
    raise exception 'Okul öğrencisi için sınıf seçilmeli.' using errcode = '22023';
  end if;

  if v_no is not null and length(v_no) > 20 then
    raise exception 'Öğrenci numarası 20 karakterden uzun olamaz.' using errcode = '22023';
  end if;

  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, ogrenci_no)
  values (btrim(p_ad), p_tur, v_sinif, v_id, v_no)
  returning id into yeni_id;

  kod_ogrenci := public._yeni_kod();
  kod_veli    := public._yeni_kod();

  insert into public.giris_kodlari (kod, ogrenci_id, rol)
  values (kod_ogrenci, yeni_id, 'ogrenci'), (kod_veli, yeni_id, 'veli');

  perform public._denetim('ogrenci_eklendi', 'ogrenciler', yeni_id, public._aktor(v_id));

  return jsonb_build_object(
    'id', yeni_id, 'ogrenci_no', v_no,
    'ogrenci_kodu', kod_ogrenci, 'veli_kodu', kod_veli
  );
end;
$$;

-- ESKİ İMZAYI DÜŞÜR. Bu satır olmadan iki `ogrenci_ekle` yan yana durur.
drop function if exists public.ogrenci_ekle(text, text, text, uuid);


-- -----------------------------------------------------------------------------
-- 4. OKUMA UÇLARI NUMARAYI DÖNDÜRÜYOR
--
-- GÖVDELER 0033'TEN OLDUĞU GİBİ ALINDI, betikle — elle kopyalamak bu
-- dosyada bir kez davranış kaybettirdi (bkz. `ogrenci_ekle` notu).
-- Eklenen tek şey `ogrenci_no` alanı.
-- -----------------------------------------------------------------------------
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
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  if not public._ogretmenin_sinifi(v_ogretmen, p_sinif_id) then
    raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
  end if;

  select * into s from public.siniflar where id = p_sinif_id;
  if not found then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;

  -- Bu sınıfa verilmiş, yayınlanmış ve süresi dolmuş ödev sayısı.
  select count(*) into v_odev_sayisi
  from public.odevler d
  where d.sinif_id = p_sinif_id and d.yayinda and d.son_tarih < bugun_tr
    and d.ogretmen_id = v_ogretmen;

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
        'ogrenci_no', o.ogrenci_no,
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

create or replace function public.ogrenciler_listesi(
  p_token text,
  p_arama text default null,
  p_sinif_id uuid default null,
  p_sayfa integer default 1,
  p_boyut integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  toplam integer;
  satirlar jsonb;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  p_boyut := least(greatest(coalesce(p_boyut, 25), 1), 100);
  p_sayfa := greatest(coalesce(p_sayfa, 1), 1);

  select count(*) into toplam
  from public.ogrenciler o
  where o.aktif
    and public._ogretmenin_ogrencisi(v_ogretmen, o.id)
    and not public._sinif_arsivde(o.sinif_id)
    and (p_sinif_id is null or o.sinif_id = p_sinif_id)
    and (p_arama is null or o.ad ilike '%' || p_arama || '%');

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', o.id, 'ad', o.ad, 'ogrenci_no', o.ogrenci_no, 'tur', o.tur, 'sinif', s.ad
         ) order by o.ad), '[]'::jsonb) into satirlar
  from (
    select o.* from public.ogrenciler o
    where o.aktif
      and public._ogretmenin_ogrencisi(v_ogretmen, o.id)
      and not public._sinif_arsivde(o.sinif_id)
      and (p_sinif_id is null or o.sinif_id = p_sinif_id)
      and (p_arama is null or o.ad ilike '%' || p_arama || '%')
    order by o.ad
    limit p_boyut offset (p_sayfa - 1) * p_boyut
  ) o
  left join public.siniflar s on s.id = o.sinif_id;

  return jsonb_build_object(
    'toplam', toplam,
    'sayfa', p_sayfa,
    'toplam_sayfa', greatest(ceil(toplam::numeric / p_boyut)::int, 1),
    'kayitlar', satirlar
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. YETKİLER (0005 deseni)
--
-- `create or replace` yetkileri korur, ama YENİ fonksiyonlar (yardımcılar
-- ve yeni imzalı `ogrenci_ekle`) PUBLIC üzerinden anon'a AÇIK doğar.
-- "Yetki yazmadım, kapalıdır" bu depoda iki kez yanlış çıktı.
-- -----------------------------------------------------------------------------
revoke all on function public._toplu_ad(jsonb) from public, anon, authenticated;
revoke all on function public._toplu_no(jsonb) from public, anon, authenticated;

revoke all on function public.ogrenci_ekle(text, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.ogrenci_ekle(text, text, text, uuid, text)
  to anon, authenticated;

-- =============================================================================
-- KENDİ KENDİNİ DOĞRULAMA
-- =============================================================================
do $$
declare
  eksik text[] := '{}';
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ogrenciler'
      and column_name = 'ogrenci_no'
  ) then
    eksik := eksik || 'ogrenci_no sütunu yok'::text;
  end if;

  -- 0007 TUZAĞI: eski imza GERÇEKTEN düştü mü. Kalsaydı PostgREST
  -- çağrıyı ona yönlendirebilir ve numara sessizce yazılmazdı.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'ogrenci_ekle'
      and pg_get_function_identity_arguments(p.oid) = 'text, text, text, uuid'
  ) then
    eksik := eksik || 'eski 4 parametreli ogrenci_ekle hâlâ duruyor'::text;
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'ogrenci_ekle') <> 1 then
    eksik := eksik || 'ogrenci_ekle tek imza değil'::text;
  end if;

  -- İNDEKS UNIQUE OLMAMALI: öğretmenin kararı "uyar, engelleme".
  if exists (
    select 1 from pg_indexes i
    where i.schemaname = 'public' and i.indexname = 'ogrenciler_no_idx'
      and i.indexdef like '%UNIQUE%'
  ) then
    eksik := eksik || 'numara indeksi UNIQUE olmuş — engelleme isteniyordu değil'::text;
  end if;

  -- OKUMA UÇLARI NUMARAYI TAŞIYOR MU.
  for i in 1..1 loop
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'sinif_ogrencileri'
        and pg_get_functiondef(p.oid) like '%ogrenci_no%'
    ) then
      eksik := eksik || 'sinif_ogrencileri numarayı döndürmüyor'::text;
    end if;
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'ogrenciler_listesi'
        and pg_get_functiondef(p.oid) like '%ogrenci_no%'
    ) then
      eksik := eksik || 'ogrenciler_listesi numarayı döndürmüyor'::text;
    end if;
  end loop;

  if has_function_privilege('anon', 'public._toplu_ad(jsonb)', 'execute')
     or has_function_privilege('anon', 'public._toplu_no(jsonb)', 'execute') then
    eksik := eksik || 'toplu yardımcıları anon''a açık kalmış'::text;
  end if;
  if not has_function_privilege('anon', 'public.ogrenci_ekle(text, text, text, uuid, text)', 'execute') then
    eksik := eksik || 'ogrenci_ekle anon''a kapalı'::text;
  end if;

  if array_length(eksik, 1) is not null then
    raise exception '0042 EKSİK KALDI: %', array_to_string(eksik, ' | ');
  end if;

  raise notice '0042 tamam — öğrenci numarası hazır.';
end;
$$;

select public._migration_kaydet('0042');
