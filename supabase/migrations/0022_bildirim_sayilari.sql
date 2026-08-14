-- =============================================================================
-- SEKİZ — 0022 BİLDİRİM SAYILARI: KABUKTAKİ ROZETLER İÇİN
--
-- ÖĞRETMENİN İSTEĞİ: uygulama içi bildirim. Bugün veliden mesaj geldiğini
-- ancak Veliler sekmesine girerek, puan bekleyen gönderim olduğunu ancak
-- Pano'ya bakarak öğreniyor. İkisi de "gidip bakmayı hatırlamak" istiyor.
--
-- NEDEN YENİ BİR UÇ — ölçülmüş bir maliyet:
-- Rozet KABUKTA duruyor, yani her ekranda ve aralıklı olarak yokleniyor.
-- Mevcut uçlar bu iş için pahalı:
--
--   veliler_listesi   → bütün aktif öğrencileri dolaşıp her biri için İKİ
--                       alt sorgu çalıştırıyor. 300 öğrencide her
--                       yoklamada 600 alt sorgu.
--   ogretmen_panosu   → son gönderim listesini de taşıyor.
--
-- Bu dosya tek amacı iki tam sayı döndürmek olan küçük bir uç ekliyor.
--
-- -----------------------------------------------------------------------------
-- ÖLÇÜTLER KOPYALANIYOR, UÇLAR ÇAĞRILMIYOR
--
-- Sayılar `veliler_listesi` (0019) ve `ogretmen_panosu` (0016) ile BİREBİR
-- aynı ölçütten geliyor. İki yerde iki farklı sayı çıkarsa rozet Pano'yla
-- çelişir ve hangisinin doğru olduğu sorusu doğar; test bu eşitliği ayrıca
-- ölçüyor.
--
-- Mevcut uçların GÖVDESİNE dokunulmuyor ve imzalarına parametre
-- eklenmiyor — her yeni imza 0007 tuzağını (eski imzanın yetkisiyle ayakta
-- kalması) davet ediyor.
--
-- Bu dosya tekrar çalıştırılabilir.
-- =============================================================================

create or replace function public.bildirim_sayilari(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public._ogretmen(p_token);

  return jsonb_build_object(
    -- OKUNMAMIŞ VELİ MESAJI — `veliler_listesi`'ndeki ölçütün aynısı:
    -- yalnız veliden gelen, öğretmenin o yazışmayı en son okumasından
    -- SONRA yazılmış mesajlar. Öğretmen o öğrencinin yazışmasını hiç
    -- açmadıysa `okundu` satırı yok; `-infinity` ile hepsi sayılıyor.
    --
    -- Arşivdeki sınıf ve pasif öğrenci sayılmıyor: öğretmenin hiçbir
    -- listesinde görünmeyen bir öğrenci için rozet göstermek, tıklayınca
    -- boş ekrana götüren bir sayı üretirdi (0016 kuralı).
    'okunmamis_mesaj', (
      select count(*)::integer
      from public.mesajlar m
      join public.ogrenciler o on o.id = m.ogrenci_id
      join public.siniflar  s on s.id = o.sinif_id
      where m.kimden = 'veli'
        and o.aktif
        and not s.arsiv
        and m.created_at > coalesce(
              (select k.zaman from public.okundu k
                where k.ogrenci_id = o.id and k.rol = 'ogretmen'),
              '-infinity'::timestamptz)
    ),

    -- PUAN BEKLEYEN — `ogretmen_panosu.bekleyen_degerlendirme` ile aynı:
    -- açık uçlu ödevin henüz incelenmemiş gönderimleri. Test ödevi
    -- SAYILMIYOR çünkü onun puanı gönderim anında hesaplanıyor.
    'puan_bekleyen', (
      select count(*)::integer
      from public.gonderimler g
      join public.odevler o on o.id = g.odev_id
      where o.tur = 'acik'
        and g.durum = 'incelemede'
        and not public._sinif_arsivde(o.sinif_id)
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- YETKİLER (0005 deseni)
-- -----------------------------------------------------------------------------
revoke all on function public.bildirim_sayilari(text) from public, anon, authenticated;
grant execute on function public.bildirim_sayilari(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- KENDİ KENDİNİ DENETLEME
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.bildirim_sayilari(text)') is null then
    raise exception 'bildirim_sayilari oluşmadı.';
  end if;

  -- Rozetin azalabilmesi buna bağlı: öğretmenin okuduğunu yazan uç
  -- kaybolursa sayaç sonsuza kadar artar ve rozet kalıcı olarak yanlış
  -- gösterir. Bu dosya ona dokunmuyor ama varlığına GÜVENİYOR.
  if to_regprocedure('public.ogretmen_okudu(text, uuid)') is null then
    raise exception 'ogretmen_okudu yok; okunmamış sayacı hiç azalmazdı.';
  end if;

  -- Sayının karşılaştırıldığı iki uç da yerinde mi
  if to_regprocedure('public.veliler_listesi(text)') is null
     or to_regprocedure('public.ogretmen_panosu(text)') is null then
    raise exception 'Karşılaştırma uçlarından biri kayboldu.';
  end if;

  raise notice 'Bildirim sayıları hazır.';
end $$;
