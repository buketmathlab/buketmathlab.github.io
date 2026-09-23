-- =============================================================================
-- 0050 — ONARIM: öğretmene atanan sınıflar ekranda işaretli gelmiyordu
--
-- BELİRTİ (öğretmen bildirdi, canlıda):
--   Öğretmenler → bir öğretmen → "Sınıfları" → atadığı sınıflar
--   işaretli GELMİYOR, liste boş açılıyor.
--
-- -----------------------------------------------------------------------------
-- SEBEP — ÜÇ PARÇA, ÜÇÜ DE ÖLÇÜLDÜ
--
--   1. `ogretmenler_listesi` yalnız `sinif_sayisi` döndürüyordu: bir SAYI.
--      Ekranın kutucukları işaretleyecek KİMLİK verisi hiç yoktu.
--   2. Arayüz pencereyi açarken seçimi doldurmuyordu (dolduracak veri
--      olmadığı için dolduramıyordu da).
--   3. `ogretmen_sinif_ata` listeyi DEĞİŞTİRİYOR: `delete` + `insert`.
--
-- Üçü birleşince ekran yalnız "göstermiyor" değil, TEHLİKELİ oluyordu:
-- pencereyi açıp hiçbir şey işaretlemeden "Kaydet" demek, o öğretmenin
-- bütün sınıflarını siliyordu. Pencerenin kendi cümlesi bunu zaten
-- söylüyor ("İşaretlenmeyen sınıflar listesinden düşer") — ama hepsi
-- işaretsiz açıldığı için cümle bir uyarı değil, bir tuzak oluyordu.
--
-- -----------------------------------------------------------------------------
-- ONARIM — SUNUCU YARISI
--
-- Uç artık `sinif_idler` de döndürüyor. `sinif_sayisi` KALDIRILMADI:
-- listede satır başına gösteriliyor ve iki ayrı yerde iki ayrı hesap
-- olmasın diye SAYI ARTIK DİZİDEN TÜRETİLİYOR — ikisi bir gün ayrışamaz.
--
-- Arayüz yarısı (pencere açılırken işaretleme, kapanınca sıfırlama, boş
-- kaydetmede ek onay) `Ogretmenler.tsx`'te.
--
-- İMZA DEĞİŞMİYOR (text) — 0007 tuzağı yok.
--
-- KAPI AYNI: `_yonetici`. Bu uç yalnız sahibe açık ve öyle kalıyor;
-- sınıf kimliği eklemek yetkiyi genişletmiyor, zaten aynı kişinin
-- `siniflar_listesi` ile görebildiği kimlikler.
-- =============================================================================

create or replace function public.ogretmenler_listesi(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sahip uuid;
begin
  v_sahip := public._yonetici(p_token);

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', g.id,
             'ad', g.ad,
             'sahip', g.yonetici,
             'aktif', g.aktif,
             'pin_var', (g.pin_hash is not null),
             -- SINIF KİMLİKLERİ (0050). Ekran bunlarla kutucukları
             -- işaretliyor. Sıra `siniflar_listesi` ile aynı olsun diye
             -- seviye/şubeye göre diziliyor — ekranda karşılaştırması
             -- kolay olsun.
             'sinif_idler', coalesce((
                 select jsonb_agg(os.sinif_id order by s.seviye, s.sube)
                   from public.ogretmen_siniflari os
                   join public.siniflar s on s.id = os.sinif_id
                  where os.ogretmen_id = g.id
               ), '[]'::jsonb),
             -- SAYI ARTIK DİZİDEN TÜRETİLİYOR. Eskiden ayrı bir
             -- `count(*)` idi; iki hesabın bir gün ayrışması 0030'un
             -- dersiydi (rozet 3 derken listede 2 satır). Tek kaynak.
             'sinif_sayisi', (
                 select count(*)::integer
                   from public.ogretmen_siniflari os
                   join public.siniflar s on s.id = os.sinif_id
                  where os.ogretmen_id = g.id
               ),
             'odev_sayisi',  (select count(*) from public.odevler d where d.ogretmen_id = g.id),
             'son_gorulme',  (select max(o.son_gorulme) from public.oturumlar o
                               where o.ogretmen_id = g.id and o.vekil_id is null)
           ) order by g.yonetici desc, g.ad)
    from public.ogretmenler g
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.ogretmenler_listesi(text) from public, anon, authenticated;
grant execute on function public.ogretmenler_listesi(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- KENDİNİ DENETLEME
-- -----------------------------------------------------------------------------
do $$
declare
  v_sayi integer;
begin
  select count(*) into v_sayi
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'ogretmenler_listesi';

  if v_sayi <> 1 then
    raise exception '0050: ogretmenler_listesi % imzayla duruyor, 1 olmalı', v_sayi;
  end if;

  -- Alan gerçekten yanıtta mı? Gövdede aramak yetmez — `jsonb_build_object`
  -- anahtarı yazılıp değeri unutulabilir.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'ogretmenler_listesi'
       and pg_get_functiondef(p.oid) like '%sinif_idler%'
  ) then
    raise exception '0050: ogretmenler_listesi sinif_idler döndürmüyor';
  end if;
end $$;

select public._migration_kaydet('0050');
