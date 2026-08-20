-- SEKİZ — 0027: boşluk kırpma kusuru (güvenlik denetimi bulgusu)
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Beklenen sonuç: "Success. No rows returned."
-- Açıklamalı tam sürüm: supabase/migrations/0027_bosluk_kirpma.sql

do $$
declare
  n integer;
begin
  -- ---------------------------------------------------------------------------
  -- 1. MEVCUT KİRLİ SATIRLAR
  --
  -- Kısıt sıkılaştırılmadan önce onu ihlal eden satırlar temizlenmeli;
  -- aksi hâlde `alter table ... add constraint` doğrulamada patlar.
  --
  -- Silinen satır YALNIZ boşluktan oluşuyor: hiçbir bilgi taşımıyor.
  -- Kaç satır silindiği kayda geçiyor — sessiz silme yok.
  -- ---------------------------------------------------------------------------
  delete from public.mesajlar where btrim(metin, E' \t\r\n') = '';
  get diagnostics n = row_count;
  if n > 0 then
    raise notice '0027: yalnız boşluktan oluşan % mesaj silindi', n;
  end if;

  -- ---------------------------------------------------------------------------
  -- 2. KISITLAR
  -- ---------------------------------------------------------------------------
  alter table public.mesajlar drop constraint if exists mesajlar_metin_check;
  alter table public.mesajlar
    add constraint mesajlar_metin_check
    check (length(btrim(metin, E' \t\r\n')) between 1 and 4000);

  -- Öğretmen girdisi; sınır değil, tutarlılık.
  update public.ogrenciler set ad = btrim(ad, E' \t\r\n')
   where ad <> btrim(ad, E' \t\r\n');
  alter table public.ogrenciler drop constraint if exists ogrenciler_ad_check;
  alter table public.ogrenciler
    add constraint ogrenciler_ad_check
    check (length(btrim(ad, E' \t\r\n')) > 0);

  update public.odevler set baslik = btrim(baslik, E' \t\r\n')
   where baslik <> btrim(baslik, E' \t\r\n');
  alter table public.odevler drop constraint if exists odevler_baslik_check;
  alter table public.odevler
    add constraint odevler_baslik_check
    check (length(btrim(baslik, E' \t\r\n')) > 0);
end $$;

-- =============================================================================
-- 3. `mesaj_gonder` — GÖVDE KAYNAKTAN BİREBİR KOPYALANDI
--
-- 0016'da bir gövdeyi ezberden yeniden yazmak iki ayrı hataya yol açmıştı
-- (olmayan bir sütun adı ve kaybolan denetim izi). Bu gövde canlı
-- tanımdan (`pg_get_functiondef`) alındı; değişen YALNIZ iki satır:
-- denetimdeki ve insert'teki `btrim` çağrıları.
-- =============================================================================
create or replace function public.mesaj_gonder(
  p_token text,
  p_metin text,
  p_ogrenci_id uuid default null::uuid,
  p_kanal text default 'veli'::text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  o record;
  hedef uuid;
  kimden text;
  -- DEĞİŞKEN ADI SÜTUN ADIYLA AYNI OLMAMALI. `kanal` desem, PL/pgSQL onu
  -- `insert ... on conflict (…, kanal)` gibi yerlerde sütunla karıştırıp
  -- "column reference is ambiguous" hatası veriyor (ölçüldü).
  v_kanal text;
begin
  select * into o from public._oturum(p_token);

  if o.rol = 'ogretmen' then
    if p_ogrenci_id is null then
      raise exception 'Mesajın gideceği öğrenci seçilmeli.' using errcode = '22023';
    end if;
    if coalesce(p_kanal, '') not in ('veli', 'ogrenci') then
      raise exception 'Yazışma ''veli'' ya da ''ogrenci'' olmalı.' using errcode = '22023';
    end if;
    hedef   := p_ogrenci_id;
    kimden  := 'ogretmen';
    v_kanal := p_kanal;
  elsif o.rol = 'veli' then
    -- Veli yalnız kendi öğrencisi adına yazabilir; parametre yok sayılır.
    hedef   := o.ogrenci_id;
    kimden  := 'veli';
    v_kanal := 'veli';
  elsif o.rol = 'ogrenci' then
    -- ÖĞRENCİ ARTIK YAZABİLİYOR — ama yalnız kendi yazışmasına.
    hedef   := o.ogrenci_id;
    kimden  := 'ogrenci';
    v_kanal := 'ogrenci';
  else
    raise exception 'Bu bölümde mesaj gönderemezsiniz.' using errcode = '42501';
  end if;

  -- DEĞİŞEN SATIR (0027): ikinci argüman olmadan sekme ve satır sonu
  -- kırpılmıyordu; yalnız boşluktan oluşan mesaj buradan geçiyordu.
  if length(btrim(coalesce(p_metin, ''), E' \t\r\n')) = 0 then
    raise exception 'Mesaj boş olamaz.' using errcode = '22023';
  end if;

  -- DEĞİŞEN SATIR (0027): baştaki/sondaki satır sonları da kırpılıyor.
  -- İÇERİDEKİ satır sonlarına dokunulmuyor — çok satırlı mesaj meşru.
  insert into public.mesajlar (ogrenci_id, kimden, metin, kanal)
  values (hedef, kimden, btrim(p_metin, E' \t\r\n'), v_kanal);

  return jsonb_build_object('durum', 'tamam');
end;
$function$;

revoke all on function public.mesaj_gonder(text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.mesaj_gonder(text, text, uuid, text)
  to anon, authenticated;

-- =============================================================================
-- 4. KENDİ KENDİNİ DENETLEME
-- =============================================================================
do $$
declare
  v_def text;
begin
  if to_regprocedure('public.mesaj_gonder(text, text, uuid, text)') is null then
    raise exception '0027: mesaj_gonder kayboldu';
  end if;

  -- İMZA ÇOĞALMASI OLMAMALI (0007 tuzağı): parametre eklemek YENİ bir
  -- fonksiyon üretir ve eskisi yetkisiyle ayakta kalır. Burada imza
  -- değişmedi; yine de ölçülüyor.
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'mesaj_gonder') <> 1 then
    raise exception '0027: mesaj_gonder birden fazla imzayla duruyor';
  end if;

  -- Denetimin gerçekten değiştiği: gövdede iki argümanlı btrim olmalı.
  v_def := pg_get_functiondef('public.mesaj_gonder(text,text,uuid,text)'::regprocedure);
  if v_def !~ 'btrim\(coalesce\(p_metin' or v_def !~ E'\\\\t' then
    raise exception '0027: mesaj_gonder gövdesinde boşluk kümesi yok';
  end if;

  -- Kısıt gerçekten sıkılaştı mı: sekme+satır sonu artık geçmemeli.
  if length(btrim(E'\t\n  ', E' \t\r\n')) <> 0 then
    raise exception '0027: boşluk kümesi beklendiği gibi çalışmıyor';
  end if;

  raise notice 'Boşluk kırpma kusuru kapatıldı: sekme ve satır sonu artık boş sayılıyor.';
end $$;
