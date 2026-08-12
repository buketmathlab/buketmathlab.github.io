-- =============================================================================
-- SEKİZ — 0009 ÖĞRENCİNİN ÇÖZÜM FOTOĞRAFI YÜKLEYEBİLMESİ
--
-- YAKALANMIŞ BOŞLUK (Faz 2B'de koda not düşülmüştü):
-- `dosya_erisim_izni` öğrenci için `gonderimler.foto_yolu = p_yol` arıyordu.
-- Ama fotoğraf YÜKLENİRKEN o gönderim kaydı henüz yok — kayıt ancak
-- `odev_gonder` çağrılınca oluşuyor. Yani öğrenci yükleme izni alamıyor,
-- ödev gönderemiyordu. Tavuk-yumurta.
--
-- ÇÖZÜM: yolu tahmin işi olmaktan çıkarmak.
-- Öğrencinin yükleyebileceği yol TEK ve HESAPLANABİLİR:
--
--     cozum/<odev_id>/<ogrenci_id>.<uzanti>
--
-- Bu kalıp iki şeyi birden sağlıyor:
--   1. Öğrenci kendi yoluna yükleyebilir (gönderim kaydı gerekmeden).
--   2. BAŞKASININ yoluna yükleyemez — yol kendi kimliğini içeriyor ve
--      jetondan gelen kimlikle karşılaştırılıyor. Uydurma yol denemesi
--      reddedilir.
--
-- Ayrıca ödev yayında ve öğrencinin sınıfına ait olmalı. Taslak ya da
-- başka sınıfın ödevi için yükleme yolu açılmaz.
--
-- Bu dosya tekrar çalıştırılabilir.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Yolun geçerli olup olmadığını söyleyen yardımcı
--
-- Dahili: doğrudan çağrılamaz, yalnız `dosya_erisim_izni` kullanır.
-- -----------------------------------------------------------------------------
create or replace function public._cozum_yolu_gecerli(
  p_ogrenci_id uuid,
  p_yol text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_odev_id uuid;
  v_parca   text[];
begin
  -- Beklenen: cozum/<uuid>/<uuid>.<uzanti>
  v_parca := regexp_match(
    p_yol,
    '^cozum/([0-9a-f-]{36})/([0-9a-f-]{36})\.(jpg|jpeg|png|webp)$'
  );
  if v_parca is null then
    return false;
  end if;

  -- Yoldaki öğrenci kimliği jetondan gelenle AYNI olmalı. Başka öğrencinin
  -- yoluna yükleme denemesi burada düşer.
  if v_parca[2] <> p_ogrenci_id::text then
    return false;
  end if;

  v_odev_id := v_parca[1]::uuid;

  -- Ödev yayında ve öğrencinin sınıfına ait mi?
  return exists (
    select 1
    from public.odevler d
    join public.ogrenciler o on o.id = p_ogrenci_id
    where d.id = v_odev_id
      and d.yayinda
      and d.sinif_id = o.sinif_id
      and o.aktif
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. dosya_erisim_izni — öğrenciye yükleme yolu açılıyor
--
-- Diğer kurallar aynen korunuyor:
--   - öğrenci: kendi gönderdiği fotoğraf, teslim ettiği ödevin anahtarı,
--     kendi sınıfının yayındaki ödevinin soru PDF'i
--   - veli: yalnız çocuğunun gönderdiği fotoğraf, anahtara ASLA (Kural 6)
-- -----------------------------------------------------------------------------
create or replace function public.dosya_erisim_izni(p_token text, p_yol text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
begin
  select * into o from public._oturum(p_token);

  if o.rol = 'ogretmen' then
    return true;
  end if;

  if o.rol = 'ogrenci' then
    return
      -- kendi gönderdiği çözüm kâğıdı (teslimden sonra görüntülemek için)
      exists (
        select 1 from public.gonderimler g
        where g.ogrenci_id = o.ogrenci_id and g.foto_yolu = p_yol
      )
      -- teslim ettiği ödevin cevap anahtarı
      or exists (
        select 1 from public.odevler d
        join public.gonderimler g on g.odev_id = d.id and g.ogrenci_id = o.ogrenci_id
        where d.anahtar_url = p_yol
      )
      -- kendi sınıfındaki yayındaki ödevin soru PDF'i (teslim şartı yok)
      or exists (
        select 1 from public.odevler d
        join public.ogrenciler ogr on ogr.id = o.ogrenci_id
        where d.odev_url = p_yol
          and d.yayinda
          and d.sinif_id = ogr.sinif_id
      )
      -- YENİ: henüz göndermeden, kendi çözüm fotoğrafını YÜKLEMEK için
      or public._cozum_yolu_gecerli(o.ogrenci_id, p_yol);
  end if;

  if o.rol = 'veli' then
    return exists (
      select 1 from public.gonderimler g
      where g.ogrenci_id = o.ogrenci_id and g.foto_yolu = p_yol
    );
  end if;

  return false;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. odev_gonder — yolun kalıba uyduğu SUNUCUDA da doğrulanıyor
--
-- İstemci yolu kendisi üretiyor. Yükleme izni zaten kalıbı denetliyor ama
-- gönderim kaydına yazılan yol da aynı denetimden geçmeli: aksi hâlde
-- öğrenci geçerli bir yola yükleyip kayda başka bir yol yazdırabilirdi.
-- -----------------------------------------------------------------------------
create or replace function public.odev_gonder(
  p_token text,
  p_odev uuid,
  p_foto_yolu text,
  p_cevaplar jsonb default null
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

  if p_foto_yolu is null or btrim(p_foto_yolu) = '' then
    raise exception 'Çözüm fotoğrafı olmadan ödev gönderilemez.' using errcode = '22023';
  end if;

  -- Yol kendi kimliğini ve bu ödevi taşımalı.
  if not public._cozum_yolu_gecerli(o.ogrenci_id, btrim(p_foto_yolu))
     or btrim(p_foto_yolu) not like 'cozum/' || p_odev::text || '/%' then
    raise exception 'Geçersiz dosya yolu.' using errcode = '42501';
  end if;

  if d.tur = 'test' then
    select * into s from public._puanla(d.cevap_anahtari, coalesce(p_cevaplar, '{}'::jsonb), d.soru_sayisi);

    insert into public.gonderimler
      (odev_id, ogrenci_id, cevaplar, foto_yolu, dogru, yanlis, bos, puan, durum)
    values
      (p_odev, o.ogrenci_id, p_cevaplar, btrim(p_foto_yolu), s.dogru, s.yanlis, s.bos, s.puan, 'puanlandi')
    returning id into yeni_id;

    perform public._denetim('odev_gonderildi', 'gonderimler', yeni_id,
                            'ogrenci:' || o.ogrenci_id);

    return jsonb_build_object(
      'id', yeni_id, 'dogru', s.dogru, 'yanlis', s.yanlis,
      'bos', s.bos, 'puan', s.puan
    );
  else
    insert into public.gonderimler
      (odev_id, ogrenci_id, foto_yolu, durum)
    values
      (p_odev, o.ogrenci_id, btrim(p_foto_yolu), 'incelemede')
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
-- 4. YETKİLER
--
-- `_cozum_yolu_gecerli` DAHİLİ: dışarıya açılmaz. Açılsaydı bir öğrenci
-- başka öğrencinin kimliğiyle yol deneyip hangi ödevlerin yayında olduğunu
-- öğrenebilirdi — küçük ama gereksiz bir sızıntı.
-- -----------------------------------------------------------------------------
revoke all on function public._cozum_yolu_gecerli(uuid, text)
  from public, anon, authenticated;

grant execute on function public.dosya_erisim_izni(text, text) to anon, authenticated;
grant execute on function public.dosya_erisim_izni(text, text) to service_role;
grant execute on function public.odev_gonder(text, uuid, text, jsonb) to anon, authenticated;
