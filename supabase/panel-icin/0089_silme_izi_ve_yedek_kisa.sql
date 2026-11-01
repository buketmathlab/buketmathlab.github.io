-- SEKİZ — 0089: Ödev silme geri alınabilir olsun, yedek eksiksiz olsun
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Açıklamalı tam sürüm: supabase/migrations/0089_silme_izi_ve_yedek.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Ayarlar → Verinizin yedeği)
-- 0088 ÇALIŞMIŞ OLMALI. Edge Function DEĞİŞMİYOR.
--
-- NE YAPIYOR — İKİ ŞEY:
--
-- 1) ÖDEV SİLİNCE PUANLAR ARTIK KAYBOLMUYOR. Bugüne kadar bir ödevi
--    silince ona bağlı bütün gönderimler ve puanlar da siliniyordu ve
--    denetim izinde onlardan hiç iz kalmıyordu. Bundan sonra silinen her
--    gönderim tam hâliyle (puan, cevaplar, fotoğraf yolu) ize yazılıyor;
--    yanlışlıkla silinirse geri getirilebilir.
--    Ayrıca gönderimi olan bir ödevi silerken SEBEP soruluyor.
--    Gönderimi olmayan ödev bugünkü gibi, sebepsiz silinir.
--
-- 2) YEDEK EKSİKSİZLEŞİYOR. Yedek 2026'nın başından beri güncellenmemişti;
--    sonradan eklenen 10 tablo dosyaya hiç girmiyordu. En önemlisi DENETİM
--    İZİ — silmelerin ve not değişikliklerinin tek kaydı. Artık giriyor.
--    Yeni girenler: denetim izi, kişisel ek süreler, duyurular, anketler,
--    okundu işaretleri, ayarlar.
--    Oturum jetonları ve PIN bilerek GİRMİYOR (dosya düz metin).
--
-- NOT: Denetim izi çok büyürse yedeğe en yeni 50.000 satırı girer ve
-- Ayarlar ekranı bunu size yazar. Sessizce eksik yedek verilmez.
--
-- Beklenen sonuç: en altta tek satırlık bir tablo (_migration_kaydet → 0089).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. ÖNKOŞUL
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.odev_kardeslere_yay(text,uuid,boolean)') is null then
    raise exception '0089: önce 0088 çalıştırılmalı';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. ESKİ İMZA DÜŞÜYOR (0007 tuzağı)
-- -----------------------------------------------------------------------------
drop function if exists public.odev_sil(text, uuid);

-- -----------------------------------------------------------------------------
-- 2. ODEV_SIL — silinen her gönderim ize yazılıyor
-- -----------------------------------------------------------------------------
create or replace function public.odev_sil(
  p_token text,
  p_id uuid,
  -- 0089: gönderimi olan ödevde SEBEP ZORUNLU. `default null`
  -- bilerek: gönderimi olmayan ödevi silmek bugünkü gibi kalsın ve
  -- önbellekteki eski istemci de çalışsın (Part VIII).
  p_neden text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o public.odevler;
  v_ogretmen uuid;
  -- 0089: silmeden önce ize yazılacak gönderimler.
  v_neden text := nullif(btrim(coalesce(p_neden, '')), '');
  v_sayi  integer;
  g       record;
begin
  v_ogretmen := public._ogretmen(p_token);
  perform public._odev_sahibi(v_ogretmen, p_id);
  select * into o from public.odevler where id = p_id;

  -- ---------------------------------------------------------------
  -- 0089: SİLİNEN GÖNDERİMLER DE İZE GİRİYOR
  --
  -- `gonderimler.odev_id` yabancı anahtarı `on delete cascade`:
  -- ödev silinince ona bağlı BÜTÜN gönderimler ve puanlar da
  -- siliniyor. Bugüne kadar iz yalnız `odev_silindi` idi, yani o
  -- puanlar denetim izinden GERİ GELMİYORDU. Öğretmen gönderilmiş
  -- ödevlerin "gönderilmedi" göründüğünü bildirdi ve bu yol, o
  -- kaybın sessiz kalabildiği tek yoldu.
  --
  -- Silme YASAKLANMIYOR: öğretmen ödevin sahibi ve yanlış verilmiş
  -- bir ödevi kaldırabilmeli. Silme GERİ ALINABİLİR hâle geliyor.
  -- ---------------------------------------------------------------
  select count(*) into v_sayi from public.gonderimler gn where gn.odev_id = p_id;

  if v_sayi > 0 then
    -- SEBEP ZORUNLU — 0081'in `gonderimi_yeniden_ac`taki kalıbının
    -- aynısı. Başkasının notunu silen bir işlem sebepsiz olmaz.
    if v_neden is null or char_length(v_neden) < 3 then
      raise exception 'Bu ödeve % gönderim yapıldı ve silinince puanları da silinir. Silmek için sebebini yazın.',
        v_sayi using errcode = '22023';
    end if;
    if char_length(v_neden) > 500 then
      raise exception 'Sebep en fazla 500 karakter olabilir.' using errcode = '22023';
    end if;

    -- ÖNCE İZ, SONRA SİLME. İz yazılamazsa silme de olmaz: ikisi
    -- aynı işlemde. Tam satır giriyor (puan, cevaplar, foto_yolu,
    -- ek_sayfa_yollari) — cascade satırı götürse de kayıt duruyor.
    for g in select * from public.gonderimler gn where gn.odev_id = p_id loop
      perform public._denetim(
        'gonderim_odevle_silindi', 'gonderimler', g.id,
        public._aktor(v_ogretmen), to_jsonb(g),
        jsonb_build_object('odev_id', p_id, 'odev', o.baslik, 'neden', v_neden));
    end loop;
  end if;

  -- Silinen ödevin içeriği denetim izine yazılır; sessizce kaybolmaz.
  perform public._denetim('odev_silindi', 'odevler', p_id, public._aktor(v_ogretmen), to_jsonb(o),
                          jsonb_build_object('neden', v_neden, 'gonderim_sayisi', v_sayi));
  delete from public.odevler where id = p_id;
  return jsonb_build_object('durum', 'tamam', 'silinen_gonderim', v_sayi);
end;
$$;

revoke all on function public.odev_sil(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.odev_sil(text, uuid, text)
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. DISA_AKTAR — eksik tablolar giriyor
-- -----------------------------------------------------------------------------
create or replace function public.disa_aktar(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid;
begin
  -- Yedek BÜTÜN sistemi indiriyor: bir öğretmenin meslektaşlarının
  -- verisini tek dosyada indirmesi kabul edilemez. Sahipte.
  v_id := public._yonetici(p_token);
  perform public._denetim('disa_aktarildi', null, null, public._aktor(v_id));

  return jsonb_build_object(
    'alindi', now(),
    -- KADRO YEDEĞE GİRİYOR. Girmeseydi yedek 0033'ten sonra GERİ
    -- YÜKLENEMEZ olurdu: satırlarda `ogretmen_id`/`ekleyen_id` var ve
    -- ikisi de `ogretmenler`e yabancı anahtarla bağlı. Taşıma provasında
    -- ölçüldü — dosya boş bir projeye yüklenirken yabancı anahtar
    -- kısıtından düşüyordu. Yani yedek zinciri, tam da işe yarayacağı gün
    -- kopmuş olurdu.
    --
    -- `pin_hash` ÇIKARILIYOR. Yedek öğretmenin bilgisayarına inen düz bir
    -- dosya; içinde dört öğretmenin PIN hash'i olmamalı. Zaten öğretmenin
    -- kendi PIN'i de bilerek yedeğe girmiyordu — aynı kural kadroya da
    -- uygulanıyor. Geri yüklendiğinde herkes PIN'ini yeniden belirler.
    'ogretmenler', coalesce((select jsonb_agg((to_jsonb(g) - 'pin_hash')
      order by g.yonetici desc, g.ad) from public.ogretmenler g), '[]'::jsonb),
    'ogretmen_siniflari', coalesce((select jsonb_agg(to_jsonb(b))
      from public.ogretmen_siniflari b), '[]'::jsonb),
    'siniflar',  coalesce((select jsonb_agg(to_jsonb(s) order by s.seviye, s.sube) from public.siniflar s), '[]'::jsonb),
    'ogrenciler', coalesce((select jsonb_agg(to_jsonb(o) order by o.ad) from public.ogrenciler o), '[]'::jsonb),
    'giris_kodlari', coalesce((select jsonb_agg(to_jsonb(k)) from public.giris_kodlari k), '[]'::jsonb),
    -- ONAM YEDEĞE GİRİYOR (0034). Girmeseydi bir geri yüklemeden sonra
    -- BÜTÜN veliler yeniden onam vermek zorunda kalırdı — verilmiş bir
    -- rızayı kaybetmek, kaydı hiç tutmamak kadar kötü.
    'veli_onaylari', coalesce((select jsonb_agg(to_jsonb(v)) from public.veli_onaylari v), '[]'::jsonb),
    'odevler',   coalesce((select jsonb_agg(to_jsonb(d)) from public.odevler d), '[]'::jsonb),
    'gonderimler', coalesce((select jsonb_agg(to_jsonb(g)) from public.gonderimler g), '[]'::jsonb),
    'mesajlar',  coalesce((select jsonb_agg(to_jsonb(m)) from public.mesajlar m), '[]'::jsonb),
    'dersler',   coalesce((select jsonb_agg(to_jsonb(l)) from public.dersler l), '[]'::jsonb),
    'odemeler',  coalesce((select jsonb_agg(to_jsonb(p)) from public.odemeler p), '[]'::jsonb),
    'ewalu_mesajlari', coalesce((select jsonb_agg(to_jsonb(e) order by e.bant desc) from public.ewalu_mesajlari e), '[]'::jsonb),

    -- -------------------------------------------------------------
    -- 0089: YEDEK 0034'TEN BERİ GÜNCELLENMEMİŞTİ
    --
    -- Ondan sonra eklenen her tablo yedeğin dışında kalmıştı.
    -- Öğretmenin 1 Kasım'da aldığı yedek ölçüldü: 12 tablo var, 13
    -- tablo yok. En acısı `denetim_izi` idi — kayıp gönderimlerin
    -- TEK kanıtı orada ve yedekte yoktu.
    -- -------------------------------------------------------------

    -- DENETİM İZİ SINIRLI. Sonsuza dek büyüyor ve bu dosya öğretmenin
    -- tabletinde JSON'a çevriliyor; sınırsız alsaydık yedek bir gün
    -- tarayıcıyı düşürürdü. En yeni 50 000 satır alınıyor; kesildiyse
    -- arayüz bunu SÖYLÜYOR — sessizce eksik yedek vermek, yedeği hiç
    -- vermemekten kötü olurdu.
    'denetim_izi', coalesce((select jsonb_agg(to_jsonb(z) order by z.id desc)
      from (select * from public.denetim_izi order by id desc limit 50000) z), '[]'::jsonb),
    'denetim_izi_toplam', (select count(*) from public.denetim_izi),
    'denetim_izi_kesildi', ((select count(*) from public.denetim_izi) > 50000),

    -- KİŞİSEL TESLİM TARİHLERİ (0081/0084). Kaybolursa öğrencilerin
    -- süresi sessizce değişir — verilmiş bir hakkı kaybetmek olurdu.
    'odev_ek_sure', coalesce((select jsonb_agg(to_jsonb(e)) from public.odev_ek_sure e), '[]'::jsonb),

    -- ÖĞRETMENİN YAZDIĞI İÇERİK (0065).
    'duyurular', coalesce((select jsonb_agg(to_jsonb(d2)) from public.duyurular d2), '[]'::jsonb),
    'duyuru_siniflari', coalesce((select jsonb_agg(to_jsonb(ds)) from public.duyuru_siniflari ds), '[]'::jsonb),
    'duyuru_okundu', coalesce((select jsonb_agg(to_jsonb(do2)) from public.duyuru_okundu do2), '[]'::jsonb),

    -- ANKET (0076). Yanıtlar kimlik TAŞIMIYOR, katılım ayrı tabloda
    -- ve ikisi birlikte de eşleştirilemiyor; anonimlik yedekte de
    -- korunuyor (0076'nın kendi ölçümü bunu kanıtlıyor).
    'anketler', coalesce((select jsonb_agg(to_jsonb(a)) from public.anketler a), '[]'::jsonb),
    'anket_yanitlari', coalesce((select jsonb_agg(to_jsonb(ay)) from public.anket_yanitlari ay), '[]'::jsonb),
    'anket_katilimlari', coalesce((select jsonb_agg(to_jsonb(ak)) from public.anket_katilimlari ak), '[]'::jsonb),

    'okundu', coalesce((select jsonb_agg(to_jsonb(ok)) from public.okundu ok), '[]'::jsonb),
    'ayarlar', coalesce((select jsonb_agg(to_jsonb(ay2)) from public.ayarlar ay2), '[]'::jsonb)

    -- BİLEREK DIŞARIDA:
    --   `oturumlar`        — canlı oturum jetonları. Düz bir dosyada
    --                        jeton taşımak, `pin_hash`i dışarıda
    --                        bırakma gerekçesinin aynısıyla olmaz.
    --   `giris_denemeleri` — hız sınırı günlüğü; geri yüklenecek bir
    --                        değeri yok.
    --   `uygulanan_migrationlar` — zincir yeniden uygulanınca
    --                        kendiliğinden doğar.
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. ÖZ-DENETİM
-- -----------------------------------------------------------------------------
do $$
declare
  eksik text[] := '{}';
  t     text;
begin
  -- ESKİ İMZA GİTTİ Mİ.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'odev_sil'
       and pg_get_function_identity_arguments(p.oid) = 'p_token text, p_id uuid'
  ) then
    eksik := eksik || 'iki argümanlı odev_sil hâlâ duruyor'::text;
  end if;
  if to_regprocedure('public.odev_sil(text,uuid,text)') is null then
    eksik := eksik || 'üç argümanlı odev_sil yok'::text;
  else
    t := pg_get_functiondef('public.odev_sil(text,uuid,text)'::regprocedure);
    if t not like '%p_neden text DEFAULT NULL%' then
      eksik := eksik || 'p_neden varsayılanı null değil'::text;
    end if;
    if t not like '%gonderim_odevle_silindi%' then
      eksik := eksik || 'silinen gönderimler ize yazılmıyor'::text;
    end if;
    if t not like '%Silmek için sebebini yazın%' then
      eksik := eksik || 'gönderimli ödevde sebep sorulmuyor'::text;
    end if;
    -- 0033 KORUNDU MU.
    if t not like '%_odev_sahibi%' or t not like '%odev_silindi%' then
      eksik := eksik || 'odev_sil 0033''ü geriye aldı'::text;
    end if;
  end if;

  -- YEDEK: YENİ ANAHTARLAR.
  t := pg_get_functiondef('public.disa_aktar'::regproc);
  if t not like '%''denetim_izi''%' or t not like '%''odev_ek_sure''%'
     or t not like '%''duyurular''%' or t not like '%''anketler''%'
     or t not like '%''okundu''%' or t not like '%''ayarlar''%' then
    eksik := eksik || 'yedek yeni tabloları almıyor'::text;
  end if;
  if t not like '%denetim_izi_kesildi%' then
    eksik := eksik || 'yedek denetim izinin kesildiğini söylemiyor'::text;
  end if;
  -- YEDEK: ESKİ ANAHTARLAR DURUYOR MU (0088'in dersi: kopya geriye almasın).
  if t not like '%''gonderimler''%' or t not like '%''veli_onaylari''%'
     or t not like '%''giris_kodlari''%' or t not like '%''ogretmen_siniflari''%'
     or t not like '%''ewalu_mesajlari''%' then
    eksik := eksik || 'yedek eski tablolarından birini kaybetti'::text;
  end if;
  -- YEDEK: SIZMAMASI GEREKENLER.
  if t like '%pin_hash''%' and t not like '%- ''pin_hash''%' then
    eksik := eksik || 'yedek pin_hash sızdırıyor'::text;
  end if;
  if t like '%public.oturumlar%' then
    eksik := eksik || 'yedek oturum jetonlarını alıyor'::text;
  end if;

  if array_length(eksik, 1) > 0 then
    raise exception '0089 eksik: %', array_to_string(eksik, ' | ');
  end if;
end $$;

select public._migration_kaydet('0089');
