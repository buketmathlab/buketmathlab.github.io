-- SEKİZ — 0048: Yazışma listesi (Mesajlar sekmesi)
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Açıklamalı tam sürüm: supabase/migrations/0048_yazisma_listesi.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Yedek)
-- BU SQL ÖNCE ÇALIŞMALI, SİTE SONRA YAYINA ALINMALI.
--
-- NE YAPIYOR: Sekme çubuğundaki "Kodlar" sekmesinin yerine "Mesajlar"
-- geliyor. Bu SQL o sekmenin verisini üretiyor.
--
-- Listede: en son yazışılan SINIF en üstte, o sınıfın içinde de en son
-- yazışılan öğrenci en üstte — sizin kararınız.
--
-- Listede YALNIZ yazışması olanlar var. Hiç mesajlaşmadığınız öğrenciyi
-- ekrandaki arama kutusundan bulup yazışma başlatabilirsiniz.
--
-- İki kanal ayrı: ekranda üstte [Öğrenciler] [Veliler] düğmeleri var.
--
-- KODLAR SİLİNMEDİ — Ayarlar sayfasına taşındı, ekran ve adres aynı.
--
-- Meslektaşınızın yazışması size görünmüyor, sizinki ona görünmüyor.
-- Arşivdeki sınıflar listede yok.
--
-- Veri silinmiyor, hiçbir tablo değişmiyor; tek bir fonksiyon ekleniyor.

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
