-- =============================================================================
-- 0056 — GÖNDERİMİ YENİDEN AÇMA (yalnız platform sahibi)
--
-- Öğretmenin isteği: bir öğrenci (Duru) cevaplarını işaretlemiş, gönderirken
-- cevaplar sisteme BOŞ gitmiş; öğrenci mağdur olmasın. "Gönderim
-- değiştirilemez" kuralı (gonderim_tek) yüzünden öğrenci ödevi bir daha
-- gönderemiyordu; tek yol puanı elle düzeltmekti.
--
-- `gonderimi_yeniden_ac(token, gönderim, sebep)`:
--   * YALNIZ PLATFORM SAHİBİ (kendi oturumunda ya da vekâlette gerçek kişi
--     sahip) — `puan_duzelt` ile aynı kural. Diğer öğretmenler, öğrenci,
--     veli: 42501.
--   * Sebep ZORUNLU (3–500 karakter).
--   * Gönderimin TAMAMI (cevaplar, puan, fotoğraf yolları, zaman,
--     öğretmen puanı/yorumu) denetim izine yazılır, sonra satır silinir.
--     "Geçmiş sessizce ezilmez": eski gönderim `denetim_izi`nde
--     (islem = 'gonderim_yeniden_acildi', eski = satırın kendisi) duruyor.
--   * Öğrenci ödevi yeniden gönderebilir. Süre dolmuş ve geç teslim kapalı
--     olsa bile — `odev_gonder` bu öğrenci için istisna tanıyor.
--
-- FOTOĞRAF: depodaki eski çözüm fotoğrafı silinmiyor (depo SQL'den
-- silinemez; Edge Function değişmiyor). Öğrenci yeniden gönderirken aynı
-- sayfa yolu dolu olduğu için istemci ESKİ fotoğrafı kullanıyor ve bunu
-- öğrenciye söylüyor (0054 davranışı). Cevaplar ve ek sayfalar yeni.
--
-- Yedek (`disa_aktar`) denetim izini taşımıyor; geri yüklenen bir
-- sistemde eski gönderimin kaydı ve süre istisnası taşınmaz — bilinçli,
-- yedek dosyasının biçimi değişmesin.
--
-- Bu dosya tekrar çalıştırılabilir.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. _gonderim_yeniden_acildi — bu öğrencinin bu ödevdeki gönderimi
--    hiç yeniden açıldı mı (dahili)
-- -----------------------------------------------------------------------------
create or replace function public._gonderim_yeniden_acildi(p_odev uuid, p_ogrenci uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.denetim_izi z
     where z.islem = 'gonderim_yeniden_acildi'
       and z.tablo = 'gonderimler'
       and z.eski ->> 'odev_id' = p_odev::text
       and z.eski ->> 'ogrenci_id' = p_ogrenci::text
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. gonderimi_yeniden_ac — YENİ
-- -----------------------------------------------------------------------------
create or replace function public.gonderimi_yeniden_ac(
  p_token text,
  p_gonderim uuid,
  p_neden text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ogretmen uuid;
  v_gercek   uuid;
  v_neden    text := nullif(btrim(coalesce(p_neden, '')), '');
  eski       public.gonderimler;
  v_ogrenci  text;
  v_odev     text;
begin
  -- `_ogretmen` önce: öğrenci/veli jetonu burada 42501 ile düşer ve vekâlet
  -- ayarı kurulur (`_aktor` denetim izine "sahip → öğretmen" yazsın).
  v_ogretmen := public._ogretmen(p_token);

  -- GERÇEK KİŞİ: vekâletteyse vekil (sahip), değilse oturumun öğretmeni.
  v_gercek := coalesce(nullif(current_setting('sekiz.vekil', true), '')::uuid, v_ogretmen);
  if not exists (select 1 from public.ogretmenler y where y.id = v_gercek and y.yonetici) then
    raise exception 'Gönderimi yalnız platformun sahibi yeniden açabilir.' using errcode = '42501';
  end if;

  if v_neden is null or char_length(v_neden) < 3 then
    raise exception 'Yeniden açmanın sebebini yazın.' using errcode = '22023';
  end if;
  if char_length(v_neden) > 500 then
    raise exception 'Sebep en fazla 500 karakter olabilir.' using errcode = '22023';
  end if;

  -- Satır kilitleniyor: aynı anda iki açma, ya da açma sırasında puanlama,
  -- yarım bir iz bırakmasın.
  select * into eski from public.gonderimler where id = p_gonderim for update;
  if not found then
    raise exception 'Gönderim bulunamadı.' using errcode = 'P0002';
  end if;

  select ad into v_ogrenci from public.ogrenciler where id = eski.ogrenci_id;
  select baslik into v_odev from public.odevler where id = eski.odev_id;

  -- ÖNCE İZ, SONRA SİLME. İz yazılamazsa (hata) silme de olmaz: ikisi aynı
  -- işlemde.
  perform public._denetim(
    'gonderim_yeniden_acildi', 'gonderimler', p_gonderim, public._aktor(v_ogretmen),
    to_jsonb(eski),
    jsonb_build_object('neden', v_neden, 'acan', v_gercek));

  delete from public.gonderimler where id = p_gonderim;

  return jsonb_build_object('durum', 'tamam', 'ogrenci', v_ogrenci, 'odev', v_odev);
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. odev_gonder — yeniden açılan öğrenciye süre istisnası (gövde: 0054)
-- -----------------------------------------------------------------------------
create or replace function public.odev_gonder(
  p_token text,
  p_odev uuid,
  p_foto_yolu text,
  p_cevaplar jsonb default null,
  -- 0054: 2. ve sonraki sayfaların yolları, SIRAYLA. null ya da boş dizi
  -- = tek sayfa; bugünkü çağrılar bu parametreyi hiç göndermiyor.
  p_ek_sayfa_yollari text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  d public.odevler;
  s record;
  yeni_id uuid;
  v_ek      text[];
  v_ek_sayi integer;
  i         integer;
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'ogrenci' then
    raise exception 'Yalnızca öğrenci ödev gönderebilir.' using errcode = '42501';
  end if;

  select * into d from public.odevler where id = p_odev and yayinda;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.ogrenciler ogr
    where ogr.id = o.ogrenci_id and ogr.sinif_id = d.sinif_id
  ) then
    raise exception 'Bu ödev sizin sınıfınıza ait değil.' using errcode = '42501';
  end if;

  -- Sınıf arşivdeyse ödev öğretmenin hiçbir ekranında görünmüyor; gönderim
  -- kabul etmek görünmeyen bir iş üretmek olurdu.
  if public._sinif_arsivde(d.sinif_id) then
    raise exception 'Bu sınıf kapatılmış. Öğretmeniniz açana kadar ödev gönderemezsiniz.'
      using errcode = '22023';
  end if;

  -- Geç teslim kapalıysa son tarihten sonra gönderim yok.
  --
  -- 0056: YENİDEN AÇILAN GÖNDERİM İSTİSNA. Platform sahibi bu öğrencinin bu
  -- ödevdeki gönderimini yeniden açtıysa (`gonderimi_yeniden_ac`) öğrenci
  -- süre dolmuş olsa da gönderebilir: yeniden açmanın amacı öğrencinin
  -- mağdur olmaması. Gönderim yine "gecikmeli" görünür — dürüst kayıt.
  if not d.gec_teslim
     and (now() at time zone 'Europe/Istanbul')::date > d.son_tarih
     and not public._gonderim_yeniden_acildi(p_odev, o.ogrenci_id) then
    raise exception 'Bu ödevin süresi doldu. Öğretmeniniz geç teslime izin vermiyor.'
      using errcode = '22023';
  end if;

  if p_foto_yolu is null or btrim(p_foto_yolu) = '' then
    raise exception 'Çözüm fotoğrafı olmadan ödev gönderilemez.' using errcode = '22023';
  end if;

  -- Yol kendi kimliğini ve bu ödevi taşımalı.
  --
  -- 0054: 1. SAYFA EKSİZ OLMALI. 0054'ten önce `_cozum_yolu_gecerli`
  -- yalnız eksiz yolu tanıdığı için `like` yetiyordu. Artık `-2` gibi ek
  -- sayfa yolları da geçerli ve `like` onları da kabul ederdi. `foto_yolu`
  -- her zaman 1. sayfa — onu okuyan her yer (öğretmen, veli) buna güveniyor.
  if not public._cozum_yolu_gecerli(o.ogrenci_id, btrim(p_foto_yolu))
     or btrim(p_foto_yolu) !~ ('^cozum/' || p_odev::text || '/' || o.ogrenci_id::text
                              || '\.(jpg|jpeg|png|webp)$') then
    raise exception 'Geçersiz dosya yolu.' using errcode = '42501';
  end if;

  -- EK SAYFALAR (0054).
  --
  -- SINIR ÖNCE, YOL SONRA. Öğretmen sınırı öğrenci sayfaları hazırladıktan
  -- sonra düşürmüş olabilir; o zaman fazla sayfanın yolu da geçersizdir ama
  -- öğrenciye söylenecek doğru şey "geçersiz yol" değil, "fazla sayfa".
  v_ek := coalesce(p_ek_sayfa_yollari, '{}'::text[]);
  v_ek_sayi := coalesce(array_length(v_ek, 1), 0);

  if 1 + v_ek_sayi > d.sayfa_limiti then
    raise exception 'Bu ödevde en fazla % sayfa gönderilebilir. Fazla sayfaları çıkarıp tekrar deneyin.',
      d.sayfa_limiti using errcode = '22023';
  end if;

  -- SIRA BOŞLUKSUZ: i. ek sayfa TAM OLARAK `-(i+1)` ekini taşımalı.
  -- Böylece aynı sayfa iki kez yazılamaz, sayfa atlanamaz ve öğretmenin
  -- gördüğü sıra öğrencinin gönderdiği sırayla aynıdır.
  for i in 1 .. v_ek_sayi loop
    if v_ek[i] is null
       or btrim(v_ek[i]) !~ ('^cozum/' || p_odev::text || '/' || o.ogrenci_id::text
                            || '-' || (i + 1)::text || '\.(jpg|jpeg|png|webp)$')
       or not public._cozum_yolu_gecerli(o.ogrenci_id, btrim(v_ek[i])) then
      raise exception 'Geçersiz dosya yolu.' using errcode = '42501';
    end if;
    v_ek[i] := btrim(v_ek[i]);
  end loop;

  if d.tur = 'test' then
    select * into s from public._puanla(d.cevap_anahtari, coalesce(p_cevaplar, '{}'::jsonb), d.soru_sayisi);

    insert into public.gonderimler
      (odev_id, ogrenci_id, cevaplar, foto_yolu, ek_sayfa_yollari, dogru, yanlis, bos, puan, durum)
    values
      (p_odev, o.ogrenci_id, p_cevaplar, btrim(p_foto_yolu), nullif(v_ek, '{}'::text[]),
       s.dogru, s.yanlis, s.bos, s.puan, 'puanlandi')
    returning id into yeni_id;

    perform public._denetim('odev_gonderildi', 'gonderimler', yeni_id,
                            'ogrenci:' || o.ogrenci_id);

    return jsonb_build_object(
      'id', yeni_id, 'dogru', s.dogru, 'yanlis', s.yanlis,
      'bos', s.bos, 'puan', s.puan
    );
  else
    insert into public.gonderimler
      (odev_id, ogrenci_id, foto_yolu, ek_sayfa_yollari, durum)
    values
      (p_odev, o.ogrenci_id, btrim(p_foto_yolu), nullif(v_ek, '{}'::text[]), 'incelemede')
    returning id into yeni_id;

    perform public._denetim('odev_gonderildi', 'gonderimler', yeni_id,
                            'ogrenci:' || o.ogrenci_id);

    return jsonb_build_object('id', yeni_id, 'durum', 'incelemede');
  end if;

exception
  when unique_violation then
    raise exception 'Bu ödevi zaten gönderdiniz. Gönderim değiştirilemez.'
      using errcode = '23505';
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. YETKİLER (0005 deseni)
-- -----------------------------------------------------------------------------
revoke all on function public._gonderim_yeniden_acildi(uuid, uuid)
  from public, anon, authenticated;

revoke all on function public.gonderimi_yeniden_ac(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.gonderimi_yeniden_ac(text, uuid, text)
  to anon, authenticated;

revoke all on function public.odev_gonder(text, uuid, text, jsonb, text[])
  from public, anon, authenticated;
grant execute on function public.odev_gonder(text, uuid, text, jsonb, text[])
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. KENDİ KENDİNİ DENETLEME
-- -----------------------------------------------------------------------------
do $$
begin
  if (select count(*) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'odev_gonder') <> 1 then
    raise exception '0056: odev_gonder için birden fazla tanım var';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.proname = 'odev_gonder'
       and pg_get_functiondef(p.oid) like '%_gonderim_yeniden_acildi(%'
  ) then
    raise exception '0056: odev_gonder yeniden açma istisnasını tanımıyor';
  end if;
  if has_function_privilege('anon', 'public._gonderim_yeniden_acildi(uuid, uuid)', 'execute') then
    raise exception '0056: _gonderim_yeniden_acildi anon''a açık';
  end if;
  if not has_function_privilege('anon', 'public.gonderimi_yeniden_ac(text, uuid, text)', 'execute') then
    raise exception '0056: gonderimi_yeniden_ac istemciye kapalı';
  end if;
end $$;

select public._migration_kaydet('0056');
