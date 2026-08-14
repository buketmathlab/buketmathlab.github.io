-- SEKİZ — 0022: bildirim sayıları (kabuktaki rozetler)
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Beklenen sonuç: "Success. No rows returned."
-- Açıklamalı tam sürüm: supabase/migrations/0022_bildirim_sayilari.sql

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

revoke all on function public.bildirim_sayilari(text) from public, anon, authenticated;
grant execute on function public.bildirim_sayilari(text) to anon, authenticated;

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
