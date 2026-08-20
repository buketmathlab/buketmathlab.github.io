-- =============================================================================
-- SEKİZ — 0028: giriş kilidi kod bazına taşınıyor (Faz 11 bulgusu)
--
-- `docs/guvenlik-testleri.md` bunu zaten kalan risk olarak yazmıştı:
--   "Deneme limiti IP'ye dayanıyor. Aynı okul ağından çıkan öğrenciler aynı
--    IP'yi paylaşabilir; bir öğrencinin hatalı denemeleri diğerlerini
--    kilitleyebilir. Faz 11'de kod bazlı ayrı sayaç değerlendirilecek."
--
-- ÖLÇÜLDÜ, RİSK GERÇEK. `_istemci_kimligi()` yalnız IP hash'i döndürüyor
-- ve `_kilitli_mi` 15 dakikada 8 hatalı denemede kilitliyor. Okul ağının
-- tamamı tek NAT arkasındaysa tek sayaç paylaşılıyor: eylül ayının ilk
-- haftasında 30 kişilik bir sınıfta 8 yazım hatası çok olası ve o anda
-- OKULUN TAMAMI 15 dakika giriş yapamıyor.
--
-- Bu bir gizlilik açığı değil, ERİŞİLEBİLİRLİK açığı — ve okul açılmadan
-- önce düzeltilmesi gereken sınıftan.
--
-- ---------------------------------------------------------------------------
-- KARAR: İKİ AYRI SAYAÇ
--
--   KOD BAZLI  → 15 dakikada 8 hatalı deneme  (yeni, ASIL koruma)
--   IP BAZLI   → 15 dakikada 40 hatalı deneme (eşik 8'den yükseltildi)
--
-- Bu bir zayıflatma DEĞİL; ölçülerek gerekçelendirildi.
--
-- Kod uzayı ölçüldü: `_yeni_kod()` 31 harflik alfabeden 8 karakter
-- üretiyor → 31^8 ≈ 8,5 × 10^11 olasılık. Sistemde ~720 geçerli kod
-- olacak (360 öğrenci × 2), yani rastgele bir denemenin tutma olasılığı
-- ≈ 8,5 × 10^-10.
--
--   IP eşiği 8  → günde   768 deneme
--   IP eşiği 40 → günde 3.840 deneme → ilk isabet için beklenen süre
--                                       ~1 milyon yıl mertebesinde
--
-- Yani IP eşiğini yükseltmenin kaba kuvvete karşı ölçülebilir bir maliyeti
-- yok. Buna karşılık HEDEFLİ saldırıya karşı koruma ARTIYOR: bugün bir
-- saldırgan tek bir öğrencinin kodunu farklı IP'lerden sınırsız
-- deneyebiliyordu; artık o kod, IP'den bağımsız olarak 15 dakikada 8
-- denemeyle sınırlı.
--
-- KOD DÜZ METİN SAKLANMIYOR. Mevcut tasarım yalnız ilk iki karakteri
-- (`kod_ipucu`) tutuyordu ve bu doğru bir karardı; sayaç için kodun
-- kendisi değil SHA-256 hash'i saklanıyor.
-- =============================================================================

-- =============================================================================
-- 1. ŞEMA
-- =============================================================================
alter table public.giris_denemeleri
  add column if not exists kod_hash text;

create index if not exists giris_denemeleri_kod_zaman_idx
  on public.giris_denemeleri (kod_hash, zaman desc);

-- =============================================================================
-- 2. DENEME KAYDI — imza AYNI (0007 tuzağına girilmiyor)
-- =============================================================================
create or replace function public._deneme_kaydet(
  p_kimlik text,
  p_kod text,
  p_basarili boolean
)
returns void
language sql
security definer
set search_path = public, extensions, pg_temp
as $function$
  insert into public.giris_denemeleri (kimlik, kod_ipucu, kod_hash, basarili)
  values (
    p_kimlik,
    left(coalesce(p_kod, ''), 2),
    -- Kodun kendisi DEĞİL hash'i. Ayrıca `upper(btrim(...))`: girişte
    -- kodlar büyütülerek karşılaştırıldığı için sayaç da aynı
    -- normalleştirmeyi kullanmalı, yoksa "abc" ve "ABC" iki ayrı sayaç
    -- olur ve kilit delinir.
    encode(digest(upper(btrim(coalesce(p_kod, ''))), 'sha256'), 'hex'),
    p_basarili
  );
$function$;

-- =============================================================================
-- 3. KİLİT DENETİMLERİ
-- =============================================================================

-- IP bazlı — gövde değişti, imza aynı. Eşik 8 → 40.
create or replace function public._kilitli_mi(p_kimlik text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  basarisiz integer;
begin
  select count(*) into basarisiz
  from public.giris_denemeleri
  where kimlik = p_kimlik
    and not basarili
    and zaman > now() - interval '15 minutes';

  -- 40: okul NAT'ı arkasındaki sınıfın yazım hatalarını taşıyacak kadar
  -- geniş, betikle taramayı durduracak kadar dar (yukarıdaki hesap).
  return basarisiz >= 40;
end;
$function$;

-- Kod bazlı — YENİ. Asıl koruma bu: bir kodun kendisi kilitleniyor.
create or replace function public._kod_kilitli_mi(p_kod text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  basarisiz integer;
begin
  select count(*) into basarisiz
  from public.giris_denemeleri
  where kod_hash = encode(digest(upper(btrim(coalesce(p_kod, ''))), 'sha256'), 'hex')
    and not basarili
    and zaman > now() - interval '15 minutes';

  return basarisiz >= 8;
end;
$function$;

-- Dahili fonksiyon: dışarıdan çağrılamaz (0005 deseni).
revoke all on function public._kod_kilitli_mi(text) from public, anon, authenticated;

-- =============================================================================
-- 4. `giris` — GÖVDE KAYNAKTAN BİREBİR KOPYALANDI
--
-- 0016 dersi: `create or replace` için gövde ezberden yazılmaz. Bu gövde
-- canlı tanımdan alındı; eklenen TEK şey kod bazlı kilit denetimi.
--
-- SIRA ÖNEMLİ: kod denetimi, kod boş mu denetiminden SONRA ve kodun
-- gerçekten kullanıldığı yerden ÖNCE. Boş kod için sayaç işletmenin
-- anlamı yok.
-- =============================================================================
create or replace function public.giris(p_kod text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  kimlik   text;
  pin_hash text;
  kayit    record;
  token    text;
  ogr      record;
begin
  kimlik := public._istemci_kimligi();

  if public._kilitli_mi(kimlik) then
    raise exception 'Çok fazla hatalı deneme yapıldı. 15 dakika sonra tekrar deneyin.'
      using errcode = '53400';
  end if;

  if p_kod is null or length(btrim(p_kod)) = 0 then
    raise exception 'Kod boş olamaz.' using errcode = '22023';
  end if;

  p_kod := btrim(p_kod);

  -- EKLENEN (0028): bu KODUN kendisi kilitli mi.
  --
  -- Mesaj IP kilidiyle aynı biçimde yazıldı ve bilerek kodun geçerli olup
  -- olmadığını ele vermiyor: kilit, var olmayan bir kod için de aynı
  -- şekilde işliyor.
  if public._kod_kilitli_mi(p_kod) then
    raise exception 'Bu kod için çok fazla hatalı deneme yapıldı. 15 dakika sonra tekrar deneyin.'
      using errcode = '53400';
  end if;

  -- 1) İlk kurulum: PIN hiç belirlenmemişse kurulum ekranına yönlendir.
  select ogretmen_pin_hash into pin_hash from public.ayarlar where id = 1;
  if pin_hash is null then
    return jsonb_build_object('rol', 'kurulum');
  end if;

  -- 2) Öğretmen PIN'i mi?
  if crypt(p_kod, pin_hash) = pin_hash then
    perform public._deneme_kaydet(kimlik, p_kod, true);
    token := public._oturum_ac('ogretmen', null);
    return jsonb_build_object('rol', 'ogretmen', 'token', token);
  end if;

  -- 3) Öğrenci ya da veli kodu mu?
  --    Kodlar tek tabloda birincil anahtar olduğu için rol belirsizliği yok.
  select gk.rol, gk.ogrenci_id into kayit
  from public.giris_kodlari gk
  join public.ogrenciler o on o.id = gk.ogrenci_id
  where gk.kod = upper(p_kod) and o.aktif;

  if not found then
    perform public._deneme_kaydet(kimlik, p_kod, false);
    return jsonb_build_object('rol', 'yok');
  end if;

  perform public._deneme_kaydet(kimlik, p_kod, true);
  token := public._oturum_ac(kayit.rol, kayit.ogrenci_id);

  select o.id, o.ad, o.tur, s.ad as sinif into ogr
  from public.ogrenciler o
  left join public.siniflar s on s.id = o.sinif_id
  where o.id = kayit.ogrenci_id;

  return jsonb_build_object(
    'rol', kayit.rol,
    'token', token,
    'ogrenci', jsonb_build_object(
      'id', ogr.id, 'ad', ogr.ad, 'tur', ogr.tur, 'sinif', ogr.sinif
    )
  );
end;
$function$;

revoke all on function public.giris(text) from public, anon, authenticated;
grant execute on function public.giris(text) to anon, authenticated;

-- =============================================================================
-- 5. KENDİ KENDİNİ DENETLEME
-- =============================================================================
do $$
begin
  if to_regprocedure('public._kod_kilitli_mi(text)') is null then
    raise exception '0028: _kod_kilitli_mi oluşmadı';
  end if;

  -- Dahili kalmalı: dışarıdan çağrılabilirse kilit durumu yoklanabilir.
  if has_function_privilege('anon', 'public._kod_kilitli_mi(text)'::regprocedure, 'execute') then
    raise exception '0028: _kod_kilitli_mi anon''a açık kalmış';
  end if;

  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'giris') <> 1 then
    raise exception '0028: giris birden fazla imzayla duruyor';
  end if;

  -- `giris` anon'a açık kalmalı, yoksa kimse giremez.
  if not has_function_privilege('anon', 'public.giris(text)'::regprocedure, 'execute') then
    raise exception '0028: giris anon''a kapandı';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'giris_denemeleri'
       and column_name = 'kod_hash'
  ) then
    raise exception '0028: kod_hash sütunu yok';
  end if;

  raise notice 'Giriş kilidi iki sayaçlı: kod başına 8, IP başına 40 (15 dakika).';
end $$;
