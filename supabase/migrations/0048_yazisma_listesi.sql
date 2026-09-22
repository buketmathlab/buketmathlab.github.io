-- =============================================================================
-- 0048 — YAZIŞMA LİSTESİ: Mesajlar sekmesinin verisi
--
-- Öğretmenin isteği: "Kodlar sekmesi ayarlar sekmesinin içinde olsun.
-- Kodlar sekmesi yerine mesajlar gelsin ve en son mesajlaşılan öğrenciler
-- en üstte çıksın ve sınıflarına göre kategorize olsun."
--
-- Bugüne kadar yazışma LİSTESİ veren bir uç yoktu: `mesajlar_ogretmen`
-- TEK bir yazışmayı döndürüyor, `ogrenci_yazismalari` ise yalnız
-- CEVAPSIZ olanları ve yalnız öğrenci kanalını.
--
-- -----------------------------------------------------------------------------
-- SIFIRDAN YAZILMADI — `ogrenci_yazismalari`'nın GENELLEŞTİRİLMİŞİ
--
-- O uç (0025) `son_mesaj` ve `okunmamis`'ı tam olarak burada gereken
-- biçimde hesaplıyor. İkinci bir hesap yazmak, 0030'un dersinin aynısını
-- doğururdu: iki yol bir gün ayrışır ve öğretmen aynı öğrenci için iki
-- farklı "okunmamış" sayısı görür. Alt sorgular oradan BİREBİR alındı;
-- değişen üç şey:
--
--   1. `kanal` artık PARAMETRE (orada 'ogrenci' sabitti)
--   2. Süzgeç "okunmamis > 0" değil, "en az bir mesaj var"
--   3. Çıktı sınıfa göre GRUPLU
--
-- İkisinin aynı sayıyı verdiği `yazisma_listesi_testleri.sql` 11. grupta
-- ayrıca ölçülüyor.
--
-- -----------------------------------------------------------------------------
-- SIRALAMA — ÖĞRETMENİN KARARI
--
-- "En son mesajlaşılan en üstte" ile "sınıflarına göre kategorize"
-- birbiriyle çelişiyordu; öğretmen ikisini birden isteyen seçeneği
-- seçti:
--
--   * SINIFLAR kendi en yeni mesajına göre (`max(son_mesaj) desc`)
--   * SINIF İÇİNDE öğrenciler kendi son mesajına göre (`desc`)
--
-- Yani en son yazışılan sınıf en üstte, o sınıfın içinde de en son
-- yazışılan kişi en üstte.
--
-- -----------------------------------------------------------------------------
-- KİM LİSTEDE: YALNIZ YAZIŞMASI OLANLAR
--
-- Öğretmenin kararı. 720 öğrencinin hepsini sınıf sınıf dizmek, aradığı
-- kişiyi bulmayı kolaylaştırmaz zorlaştırır. Yeni yazışma başlatmak için
-- ekranda ARAMA kutusu var ve o `ogrenciler_listesi`'nin `p_arama`
-- parametresini kullanıyor — bunun için yeni bir uca gerek yok.
--
-- -----------------------------------------------------------------------------
-- OKUNMAMIŞ SAYISI: `kimden = p_kanal` — tesadüf değil
--
-- Öğrenci kanalında karşı taraf `kimden = 'ogrenci'`, veli kanalında
-- `kimden = 'veli'` (0025 şeması). Yani her iki kanalda da "karşı
-- taraftan gelen" demek `kimden = kanal` demek. `case` yazmak yerine bu
-- eşitlik kullanılıyor ve şemanın bu özelliği teste bağlandı (4. grup).
--
-- -----------------------------------------------------------------------------
-- MESLEKTAŞIN YAZIŞMASI GÖRÜNMÜYOR
--
-- `mesajlar.ogretmen_id` (0033) süzgeci her iki alt sorguda da var.
-- Aynı öğrenciye iki öğretmen ders veriyorsa her biri YALNIZ kendi
-- yazışmasını görüyor. 6. grup bunu ölçüyor.
-- =============================================================================

create or replace function public.yazisma_listesi(p_token text, p_kanal text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ogretmen uuid;
  sonuc jsonb;
begin
  v_ogretmen := public._ogretmen(p_token);

  if p_kanal is null or p_kanal not in ('ogrenci', 'veli') then
    raise exception 'Kanal ''ogrenci'' ya da ''veli'' olmalı.'
      using errcode = '22023';
  end if;

  with ozet as (
    select o.id as ogrenci_id, o.ad,
           s.id as sinif_id, s.ad as sinif, s.seviye, s.sube,
           (select max(m.created_at) from public.mesajlar m
             where m.ogrenci_id = o.id and m.kanal = p_kanal
               and m.ogretmen_id = v_ogretmen) as son_mesaj,
           (select count(*)::integer from public.mesajlar m
             where m.ogrenci_id = o.id and m.kimden = p_kanal and m.kanal = p_kanal
               and m.ogretmen_id = v_ogretmen
               and m.created_at > coalesce(
                     (select k.zaman from public.okundu k
                       where k.ogrenci_id = o.id and k.rol = 'ogretmen'
                         and k.kanal = p_kanal
                         and k.ogretmen_id = v_ogretmen),
                     '-infinity'::timestamptz)) as okunmamis
    from public.ogrenciler o
    join public.siniflar s on s.id = o.sinif_id
    where o.aktif and not s.arsiv
      and public._ogretmenin_ogrencisi(v_ogretmen, o.id)
  ),
  -- YALNIZ YAZIŞMASI OLANLAR (öğretmenin kararı).
  dolu as (
    select * from ozet where son_mesaj is not null
  )
  select jsonb_build_object(
    'kanal', p_kanal,
    'toplam_okunmamis', (select coalesce(sum(okunmamis), 0)::integer from dolu),
    'gruplar', coalesce((
      select jsonb_agg(g order by g_taze desc)
      from (
        select sinif_id, sinif,
               max(son_mesaj) as g_taze,
               jsonb_build_object(
                 'sinif_id', sinif_id,
                 'sinif', sinif,
                 'okunmamis', coalesce(sum(okunmamis), 0)::integer,
                 -- SINIF İÇİNDE de tazeliğe göre.
                 'satirlar', jsonb_agg(jsonb_build_object(
                     'ogrenci_id', ogrenci_id,
                     'ad', ad,
                     'son_mesaj', son_mesaj,
                     'okunmamis', okunmamis
                   ) order by son_mesaj desc)
               ) as g
        from dolu
        group by sinif_id, sinif
      ) t
    ), '[]'::jsonb)
  ) into sonuc;

  return sonuc;
end;
$$;

-- 0005 deseni: jeton İÇERİDE denetleniyor. Bu bir ÖĞRETMEN ucu —
-- `_ogretmen` kapısı öğrenci ve veli jetonunu zaten reddediyor, o yüzden
-- `guvenlik_denetimi.sql` beyaz listesine EKLENMİYOR.
revoke all on function public.yazisma_listesi(text, text) from public, anon, authenticated;
grant execute on function public.yazisma_listesi(text, text) to anon;

-- -----------------------------------------------------------------------------
-- KENDİNİ DENETLEME
--
-- `pg_get_function_identity_arguments()` KULLANILMIYOR: parametre
-- ADLARINI da döndürdüğü için çıplak tip listesiyle karşılaştırmak asla
-- tutmayan bir iddia kurar (0042'de ölü bulunmuştu).
-- -----------------------------------------------------------------------------
do $$
declare
  v_sayi integer;
begin
  select count(*) into v_sayi
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'yazisma_listesi';

  if v_sayi <> 1 then
    raise exception '0048: yazisma_listesi % imzayla duruyor, 1 olmalı', v_sayi;
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'yazisma_listesi'
     and pg_catalog.oidvectortypes(p.proargtypes) = 'text, text'
  ) then
    raise exception '0048: yazisma_listesi imzası beklenen (text, text) değil';
  end if;
end $$;

select public._migration_kaydet('0048');
