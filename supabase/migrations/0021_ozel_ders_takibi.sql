-- =============================================================================
-- SEKİZ — 0021 ÖZEL DERS TAKİBİ: OKUMA UCU
--
-- ÖĞRETMENİN İSTEĞİ: özel ders öğrencileri için hem ders programı hem
-- ödeme takibi.
--
-- NEDEN GEREKLİ — ölçülmüş bir çıkmaz:
-- `ders_ekle`, `ders_sil`, `odeme_ekle`, `odeme_degistir`, `odeme_sil`
-- 0004'te yazıldı ve 0005'te yetkisi verildi. Üçü `p_id` istiyor. Ama
-- öğretmenin o id'yi öğrenebileceği HİÇBİR UÇ YOK:
--
--   ogrenci_odevleri (öğrenci) → yalnız GELECEK dersler, id YOK
--   veli_paneli      (veli)    → ödemeler, id YOK
--   disa_aktar       (öğretmen)→ hepsi var ama o bir yedek dosyası
--
-- Yani bugün ödeme "ödendi" işaretlenemiyor, ders silinemiyor. Bu dosya
-- tek bir okuma ucu ekleyerek beş yazma ucunu kullanılabilir kılıyor.
--
-- YENİ YAZMA UCU YOK. `odeme_degistir` yalnız `odendi`'yi ters çeviriyor;
-- tutar ya da tarih düzeltmek için sil-yeniden ekle yeterli. Her yeni imza
-- 0007 tuzağını (eski imzanın yetkisiyle ayakta kalması) davet ediyor;
-- gerekmedikçe açılmıyor.
--
-- -----------------------------------------------------------------------------
-- KURAL — ÖĞRENCİ ÖDEME BİLGİSİ GÖRMEZ
--
-- Öğretmenin kararı: "Ödeme detaylarını öğrenci görmesin. Yani özel ders
-- öğrencim." Para velinin ve öğretmenin meselesi; çocuk ödevine çalışırken
-- borç bilgisiyle karşılaşmamalı.
--
-- Bu uç ÖĞRETMENE ÖZEL (`_ogretmen`). Öğrencinin ucu `ogrenci_odevleri`
-- ödemeyle ilgili hiçbir alan taşımıyor ve bu dosya onu DEĞİŞTİRMİYOR.
-- Veli kendi ödemelerini `veli_paneli`'nden görmeye devam ediyor.
--
-- Sınır SUNUCUDA: ayrı uçlar ve rol denetimi. Arayüzde gizlemek değil —
-- gizlenen veri gönderilmiş veridir (Part XXI).
--
-- Bu dosya tekrar çalıştırılabilir.
-- =============================================================================

create or replace function public.ozel_ders_detay(p_token text, p_ogrenci_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  ogr record;
begin
  perform public._ogretmen(p_token);

  select o.id, o.ad, o.tur, o.aktif, s.ad as sinif
    into ogr
    from public.ogrenciler o
    left join public.siniflar s on s.id = o.sinif_id
   where o.id = p_ogrenci_id;

  if not found then
    raise exception 'Öğrenci bulunamadı.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'ogrenci', jsonb_build_object(
      'id', ogr.id, 'ad', ogr.ad, 'tur', ogr.tur,
      'sinif', ogr.sinif, 'aktif', ogr.aktif
    ),

    -- DERSLER: GEÇMİŞ VE GELECEK BİRLİKTE.
    -- `ogrenci_odevleri` yalnız geleceği veriyor çünkü öğrencinin işine o
    -- yarıyor. Öğretmen "kaç ders yaptık" sorusunu da soruyor; geçmişi
    -- kesmek o soruyu cevapsız bırakırdı.
    --
    -- `id` DÖNÜYOR — bu ucun bütün varlık sebebi o. `ders_sil(p_id)`
    -- id olmadan çağrılamıyordu.
    'dersler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l.id,
               'zaman', l.zaman,
               'mod', l.mod,
               'link', l.link,
               'gecti', (l.zaman <= now()))
             order by l.zaman desc)
      from public.dersler l
      where l.ogrenci_id = ogr.id
    ), '[]'::jsonb),

    'odemeler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id,
               'tutar', p.tutar,
               'tarih', p.tarih,
               'odendi', p.odendi)
             order by p.tarih desc)
      from public.odemeler p
      where p.ogrenci_id = ogr.id
    ), '[]'::jsonb),

    -- ÖZET: öğretmenin asıl bakacağı sayı KALAN. Satırları toplamasını
    -- istemiyoruz; toplama hatası para meselesinde sessiz ve can sıkıcıdır.
    'ozet', jsonb_build_object(
      'toplam', coalesce((select sum(p.tutar) from public.odemeler p
                           where p.ogrenci_id = ogr.id), 0),
      'odenen', coalesce((select sum(p.tutar) from public.odemeler p
                           where p.ogrenci_id = ogr.id and p.odendi), 0),
      'kalan',  coalesce((select sum(p.tutar) from public.odemeler p
                           where p.ogrenci_id = ogr.id and not p.odendi), 0),
      'ders_toplam', (select count(*) from public.dersler l
                       where l.ogrenci_id = ogr.id),
      'gelecek_ders', (select count(*) from public.dersler l
                        where l.ogrenci_id = ogr.id and l.zaman > now())
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- YETKİLER (0005 deseni)
-- -----------------------------------------------------------------------------
revoke all on function public.ozel_ders_detay(text, uuid) from public, anon, authenticated;
grant execute on function public.ozel_ders_detay(text, uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- KENDİ KENDİNİ DENETLEME
-- -----------------------------------------------------------------------------
do $$
declare
  v jsonb;
  v_o uuid; v_d uuid; v_p uuid;
  jt text;
begin
  -- Uç gerçekten oluştu mu
  if to_regprocedure('public.ozel_ders_detay(text, uuid)') is null then
    raise exception 'ozel_ders_detay oluşmadı.';
  end if;

  -- Beş yazma ucu hâlâ yerinde mi (bu dosya onlara dokunmamalı)
  if to_regprocedure('public.ders_ekle(text,uuid,timestamptz,text,text)') is null
     or to_regprocedure('public.ders_sil(text,uuid)') is null
     or to_regprocedure('public.odeme_ekle(text,uuid,numeric,date)') is null
     or to_regprocedure('public.odeme_degistir(text,uuid)') is null
     or to_regprocedure('public.odeme_sil(text,uuid)') is null then
    raise exception 'Özel ders yazma uçlarından biri kayboldu.';
  end if;

  -- ÖĞRENCİNİN UCU ÖDEME TAŞIMIYOR — öğretmenin kuralı.
  -- Gövde metninde ödeme alanı geçiyorsa bu dosya ya da başka bir
  -- migration öğrencinin ucuna para bilgisi eklemiş demektir.
  if pg_get_functiondef('public.ogrenci_odevleri(text)'::regprocedure)
       ~* '(tutar|odendi|odemeler)' then
    raise exception 'ogrenci_odevleri ödeme bilgisi taşıyor; öğrenci parayı görmemeli.';
  end if;

  raise notice 'Özel ders takibi hazır; öğrencinin ucu ödeme taşımıyor.';
end $$;
