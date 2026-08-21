-- SEKİZ — 0030: aynı ödevi birden çok sınıfa verme
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Beklenen sonuç: "Success. No rows returned."
-- Açıklamalı tam sürüm: supabase/migrations/0030_coklu_sinif_odev.sql

-- -----------------------------------------------------------------------------
-- 1. Şema: grup_id
--
-- Birlikte oluşturulan ödevler aynı grup_id'yi taşır. TEK sınıfa verilen
-- ödevde NULL — "her ödev kendi başına bir gruptur" demek, tek sınıflık
-- ödevlerde boşuna alt sorgu çalıştırmak ve ekranda anlamsız bir "kardeş
-- yok" durumu üretmek olurdu.
-- -----------------------------------------------------------------------------
alter table public.odevler
  add column if not exists grup_id uuid;

create index if not exists odevler_grup_idx on public.odevler (grup_id)
  where grup_id is not null;

-- -----------------------------------------------------------------------------
-- 2. odevler_coklu_olustur — turun tek yeni ucu
--
-- Parametreler `odev_olustur` ile AYNI, tek fark: `p_sinif_id uuid` yerine
-- `p_sinif_idler jsonb`. Sıra da aynı tutuldu ki iki uç yan yana okununca
-- farkın nerede olduğu görünsün.
-- -----------------------------------------------------------------------------
create or replace function public.odevler_coklu_olustur(
  p_token text,
  p_sinif_idler jsonb,
  p_baslik text,
  p_aciklama text,
  p_tur text,
  p_son_tarih date,
  p_soru_sayisi integer default null,
  p_cevap_anahtari jsonb default null,
  p_anahtar_yolu text default null,
  p_odev_yolu text default null,
  p_gec_teslim boolean default true,
  p_sik_sayisi smallint default 5,
  p_konular jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_adet   integer;
  v_grup   uuid;
  v_ham    text;
  v_sinif  uuid;
  v_yeni   jsonb;
  v_sonuc  jsonb := '[]'::jsonb;
begin
  perform public._ogretmen(p_token);

  if p_sinif_idler is null or jsonb_typeof(p_sinif_idler) <> 'array' then
    raise exception 'Sınıf listesi bir dizi olmalı.' using errcode = '22023';
  end if;

  v_adet := jsonb_array_length(p_sinif_idler);

  if v_adet = 0 then
    raise exception 'En az bir sınıf seçin.' using errcode = '22023';
  end if;

  -- 12 sınıf var; 20 rahat bir tavan ve tek işlemin büyüklüğünü sınırlıyor.
  if v_adet > 20 then
    raise exception 'Tek seferde en fazla 20 sınıfa ödev verilebilir.'
      using errcode = '22023';
  end if;

  -- MÜKERRER SINIF REDDEDİLİYOR. Aynı sınıfa aynı anda iki ödev oluşturmak
  -- sessiz bir çift kayıt olurdu; öğrenci ödevi listesinde iki kez görürdü.
  if (select count(distinct e) from jsonb_array_elements_text(p_sinif_idler) e)
     <> v_adet then
    raise exception 'Aynı sınıf listede birden çok kez var.' using errcode = '22023';
  end if;

  -- ÖN DENETİM. Arşivdeki sınıf reddediliyor (0016 kuralı: arşivdeki sınıf
  -- öğretmenin hiçbir listesinde görünmez, ona yeni ödev de verilmez).
  for v_ham in select value from jsonb_array_elements_text(p_sinif_idler) loop
    begin
      v_sinif := v_ham::uuid;
    exception when invalid_text_representation then
      -- Ham hatayı öğretmene göstermek yerine hangi değerin bozuk olduğunu
      -- söylüyoruz; bu blok hiçbir şey YAZMIYOR, yalnız dönüştürüyor.
      raise exception 'Geçersiz sınıf kimliği: %', v_ham using errcode = '22023';
    end;

    if not exists (
      select 1 from public.siniflar s where s.id = v_sinif and not s.arsiv
    ) then
      raise exception 'Sınıf bulunamadı ya da arşivde.' using errcode = '22023';
    end if;
  end loop;

  -- TEK SINIFTA GRUP YOK. Kardeşi olmayan ödeve grup kimliği vermek, ekranda
  -- "birlikte verildi" uyarısının boş yere çıkması demek olurdu.
  v_grup := case when v_adet > 1 then gen_random_uuid() end;

  for v_ham in select value from jsonb_array_elements_text(p_sinif_idler) loop
    v_sinif := v_ham::uuid;

    -- MEVCUT UÇ ÇAĞRILIYOR: taslak olarak açılması, konu temizliği, şık
    -- sayısı kuralı ve denetim izi kaydı orada. Burada tekrarlanmıyor.
    -- (`_ogretmen` her çağrıda yeniden bakıyor; ucuz ve zararsız.)
    v_yeni := public.odev_olustur(
      p_token, p_baslik, p_aciklama, v_sinif, p_tur, p_son_tarih,
      p_soru_sayisi, p_cevap_anahtari, p_anahtar_yolu, p_odev_yolu,
      p_gec_teslim, p_sik_sayisi, p_konular);

    if v_grup is not null then
      update public.odevler set grup_id = v_grup where id = (v_yeni ->> 'id')::uuid;
    end if;

    v_sonuc := v_sonuc || jsonb_build_object(
      'odev_id',  v_yeni ->> 'id',
      'sinif_id', v_sinif,
      'sinif',    (select s.ad from public.siniflar s where s.id = v_sinif));
  end loop;

  return jsonb_build_object('grup_id', v_grup, 'odevler', v_sonuc);
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. odev_detay — gövde 0020'den BİREBİR, tek ekleme `kardesler`
-- -----------------------------------------------------------------------------
create or replace function public.odev_detay(p_token text, p_id uuid)
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
    'id', d.id,
    'baslik', d.baslik,
    'aciklama', d.aciklama,
    'tur', d.tur,
    'sinif_id', d.sinif_id,
    'sinif', s.ad,
    'son_tarih', d.son_tarih,
    'soru_sayisi', d.soru_sayisi,
    'gec_teslim', d.gec_teslim,
    'konular', coalesce(d.konular, '{}'::jsonb),
    'sik_sayisi', d.sik_sayisi,
    'cevap_anahtari', coalesce(d.cevap_anahtari, '{}'::jsonb),
    'anahtar_yolu', d.anahtar_url,
    'odev_yolu', d.odev_url,
    'yayinda', d.yayinda,
    'kardesler', case when d.grup_id is not null then (
      select coalesce(jsonb_agg(s2.ad order by s2.seviye, s2.sube), '[]'::jsonb)
        from public.odevler d2
        join public.siniflar s2 on s2.id = d2.sinif_id
       where d2.grup_id = d.grup_id and d2.id <> d.id
    ) end,
    'gonderim_sayisi', (select count(*) from public.gonderimler g where g.odev_id = d.id),
    'gec_gonderim_sayisi', (
      select count(*) from public.gonderimler g
      where g.odev_id = d.id and public._gecikmeli(g.created_at, d.son_tarih)
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. odevler_listesi — gövde 0016'dan BİREBİR, tek ekleme `kardesler`
-- -----------------------------------------------------------------------------
create or replace function public.odevler_listesi(
  p_token text,
  p_sinif_id uuid default null,
  p_yayinda boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun_tr date := (now() at time zone 'Europe/Istanbul')::date;
begin
  perform public._ogretmen(p_token);

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', d.id,
      'baslik', d.baslik,
      'aciklama', d.aciklama,
      'tur', d.tur,
      'sinif_id', d.sinif_id,
      'sinif', s.ad,
      'sinif_ozel', s.ozel,
      'son_tarih', d.son_tarih,
      'soru_sayisi', d.soru_sayisi,
      'gec_teslim', d.gec_teslim,
      'sik_sayisi', d.sik_sayisi,
      'yayinda', d.yayinda,
      'olusturma', d.created_at,
      'kardesler', case when d.grup_id is not null then (
        select coalesce(jsonb_agg(s2.ad order by s2.seviye, s2.sube), '[]'::jsonb)
          from public.odevler d2
          join public.siniflar s2 on s2.id = d2.sinif_id
         where d2.grup_id = d.grup_id and d2.id <> d.id
      ) end,
      'odev_pdf_var', (d.odev_url is not null),
      'anahtar_pdf_var', (d.anahtar_url is not null),
      'gonderim_sayisi', (
        select count(*) from public.gonderimler g where g.odev_id = d.id
      ),
      'gec_gonderim_sayisi', (
        select count(*) from public.gonderimler g
        where g.odev_id = d.id and public._gecikmeli(g.created_at, d.son_tarih)
      ),
      'sinif_mevcudu', (
        select count(*) from public.ogrenciler o
        where o.sinif_id = d.sinif_id and o.aktif
      ),
      -- Ortalamalar YALNIZ süre dolduktan sonra.
      'ortalama_yapan', case when d.son_tarih < bugun_tr then (
        select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1)
        from public.gonderimler g
        where g.odev_id = d.id and coalesce(g.ogretmen_puan, g.puan) is not null
      ) end,
      'ortalama_tum', case when d.son_tarih < bugun_tr then (
        select round(avg(coalesce(
                 (select coalesce(g.ogretmen_puan, g.puan)
                    from public.gonderimler g
                   where g.odev_id = d.id and g.ogrenci_id = o.id), 0)), 1)
        from public.ogrenciler o
        where o.sinif_id = d.sinif_id and o.aktif
      ) end
    ) order by d.son_tarih desc, d.created_at desc)
    from public.odevler d
    join public.siniflar s on s.id = d.sinif_id
    where not s.arsiv
      and (p_sinif_id is null or d.sinif_id = p_sinif_id)
      and (p_yayinda is null or d.yayinda = p_yayinda)
  ), '[]'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Yetkiler (0005 deseni)
-- -----------------------------------------------------------------------------
revoke all on function public.odevler_coklu_olustur(
  text, jsonb, text, text, text, date, integer, jsonb, text, text, boolean,
  smallint, jsonb) from public, anon, authenticated;

grant execute on function public.odevler_coklu_olustur(
  text, jsonb, text, text, text, date, integer, jsonb, text, text, boolean,
  smallint, jsonb) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. Kendi kendini denetleyen blok
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.odevler_coklu_olustur(text,jsonb,text,text,text,date,integer,jsonb,text,text,boolean,smallint,jsonb)') is null then
    raise exception '0030: odevler_coklu_olustur oluşmadı.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'odevler' and column_name = 'grup_id'
  ) then
    raise exception '0030: odevler.grup_id eklenmedi.';
  end if;

  -- 0007 TUZAĞI: `odev_olustur`'un tek imzası kalmalı. Yeni uç ona bir
  -- parametre eklemiş olsaydı eski imza yetkisiyle ayakta kalırdı.
  if (select count(*) from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'odev_olustur') <> 1 then
    raise exception '0030: odev_olustur birden çok imzayla duruyor.';
  end if;

  -- İki gövdeye de alan gerçekten girdi mi.
  if pg_get_functiondef(to_regprocedure('public.odev_detay(text,uuid)')) not like '%kardesler%' then
    raise exception '0030: odev_detay kardesler alanını döndürmüyor.';
  end if;
  if pg_get_functiondef(to_regprocedure('public.odevler_listesi(text,uuid,boolean)')) not like '%kardesler%' then
    raise exception '0030: odevler_listesi kardesler alanını döndürmüyor.';
  end if;

  raise notice 'Çoklu sınıf ödevi hazır.';
end $$;
