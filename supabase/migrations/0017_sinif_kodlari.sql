-- =============================================================================
-- SEKİZ — 0017 KODLAR SEKMESİ İÇİN SINIF KODLARI
--
-- Öğretmen yıl başında bir sınıfın kodlarını tek tek değil, TOPLUCA dağıtıyor.
-- Bugün elimizdeki tek uç `ogrenci_kodlari(p_token, p_id)` — öğrenci başına
-- bir çağrı. Otuz kişilik bir sınıfta otuz dokunuş demek; ekranın işe
-- yaramaması demek.
--
-- `sinif_kodlari(p_token, p_sinif_id)` BİR SINIFIN kodlarını tek seferde
-- veriyor. Üç sınır bilerek korunuyor:
--
--   1. SINIF SINIF. "Bütün kodları ver" diye bir uç YOK. En geniş sızıntı
--      yüzeyi bir sınıfla sınırlı kalıyor.
--   2. AÇIK EYLEMLE. Arayüz bu ucu ekran açılırken çağırmıyor; öğretmen
--      "Kodları göster"e basınca çağırıyor. Ortak bir tablette liste açık
--      unutulsa bile kodlar ekranda değil.
--   3. LİSTE UÇLARI KOD TAŞIMIYOR. `ogrenciler_listesi` ve diğerleri kod
--      döndürmüyor ve döndürmeyecek; testi bunu ayrıca ölçüyor.
--
-- Kodlar bir ŞİFREDİR. Bu yüzden yeni bir ekran açarken kolaylık uğruna
-- listeye gömmek yerine ayrı ve istekle çağrılan bir uç yazıyoruz — cevap
-- anahtarında ve dosya yollarında (0007, 0011) uyguladığımız desenin aynısı.
--
-- Pasif öğrenci listede YOK: `ogrenci_pasiflestir` kodları zaten siliyor
-- (0004), yani pasif öğrencinin gösterilecek kodu da yok.
--
-- Bu dosya tekrar çalıştırılabilir.
-- =============================================================================

create or replace function public.sinif_kodlari(p_token text, p_sinif_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sinif record;
begin
  perform public._ogretmen(p_token);

  select s.id, s.ad, s.ozel, s.arsiv into v_sinif
  from public.siniflar s where s.id = p_sinif_id;

  if not found then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'sinif', jsonb_build_object(
      'id', v_sinif.id, 'ad', v_sinif.ad,
      'ozel', v_sinif.ozel, 'arsiv', v_sinif.arsiv
    ),
    'ogrenciler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id,
               'ad', o.ad,
               'tur', o.tur,
               -- Kod yoksa alan null gelir; arayüz "kod yok" diyebilsin diye
               -- satırı düşürmüyoruz. Sessizce eksik bir liste, öğretmenin
               -- bir öğrenciyi atlamasına yol açardı.
               'ogrenci_kodu', (select k.kod from public.giris_kodlari k
                                 where k.ogrenci_id = o.id and k.rol = 'ogrenci'),
               'veli_kodu', (select k.kod from public.giris_kodlari k
                              where k.ogrenci_id = o.id and k.rol = 'veli')
             ) order by o.ad)
      from public.ogrenciler o
      where o.sinif_id = p_sinif_id and o.aktif
    ), '[]'::jsonb)
  );
end;
$$;

-- YETKİLER (0005 deseni)
revoke all on function public.sinif_kodlari(text, uuid) from public, anon, authenticated;
grant execute on function public.sinif_kodlari(text, uuid) to anon, authenticated;
