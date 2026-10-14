-- SEKİZ — 0074: her sınıf düzeyine ayrı deneme hesabı; geçmiş ödevlerin hepsi açık
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Açıklamalı tam sürüm: supabase/migrations/0074_deneme_duzeyleri.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Ayarlar → Verinizin yedeği)
-- 0073 ÇALIŞMIŞ OLMALI. Edge Function DEĞİŞMİYOR.
--
-- NE YAPIYOR: Öğretmenler sayfasında her düzeye (9, 10, 11, 12) ayrı deneme
-- hesabı açılabilir. Deneme hesabı, bulunduğu şubeye EN BAŞINDAN BERİ
-- verilen bütün ödevleri görür ve süresi geçmiş olanlara da gönderebilir.
-- Gerçek öğrenciler için hiçbir şey değişmez.
--
-- Veriye tek dokunuşu: varsa mevcut deneme hesabının "sınıfa geliş tarihi"
-- boşaltılır (geçmiş ödevleri görebilsin diye). Gerçek öğrencilere dokunmaz.
--
-- Beklenen sonuç: en altta tek satırlık bir tablo (_migration_kaydet → 0074).
-- =============================================================================

do $$
begin
  if to_regprocedure('public._deneme_mi(uuid)') is null then
    raise exception '0074: önce 0073 çalıştırılmalı';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. Düzey başına bir hesap
-- -----------------------------------------------------------------------------
drop index if exists public.ogrenciler_tek_deneme;

-- Mevcut deneme satırı: en baştan beri bu sınıfta.
update public.ogrenciler set sinif_giris = null where deneme and sinif_giris is not null;

comment on column public.ogrenciler.deneme is
  'Platform sahibinin deneme hesabı (0073; 0074: düzey başına bir tane, sinif_giris hep NULL). '
  'Öğrenci ve veli ekranlarında gerçek öğrenci gibi; hiçbir sayıya, listeye (sahip dışında) '
  've eşitlemeye girmez.';

-- Aynı düzeyde (siniflar.seviye) başka deneme hesabı varsa 23505.
-- `p_haric`: sınıf değiştirirken hesabın kendisi sayılmasın.
-- Kilit: aynı anda iki "oluştur" tıklaması iki hesap açmasın (indeks
-- tablolar arası koşulu taşıyamıyor).
create or replace function public._deneme_duzeyi_bos(p_sinif uuid, p_haric uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_seviye smallint;
begin
  perform pg_advisory_xact_lock(hashtext('sekiz.deneme_hesabi'));
  select seviye into v_seviye from public.siniflar where id = p_sinif;
  if exists (select 1 from public.ogrenciler x join public.siniflar s on s.id = x.sinif_id
              where x.deneme and s.seviye = v_seviye
                and (p_haric is null or x.id <> p_haric)) then
    raise exception '%. sınıflar için deneme hesabı zaten var.', v_seviye using errcode = '23505';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Eski tek-hesap uçları
-- -----------------------------------------------------------------------------
drop function if exists public.deneme_hesabi(text);
drop function if exists public.deneme_sinifi_degistir(text, uuid);
drop function if exists public.deneme_sifirla(text);
drop function if exists public.deneme_hesabi_sil(text);

-- -----------------------------------------------------------------------------
-- 3. Uçlar — hepsi yalnız platform sahibi (`_yonetici`)
-- -----------------------------------------------------------------------------

-- Bütün deneme hesapları, düzeye göre. Kodlar öğretmenin elinde olmalı
-- (tek tıkla giriş bu kodlarla `giris` çağırıyor).
create or replace function public.deneme_hesaplari(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public._yonetici(p_token);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', x.id, 'sinif_id', x.sinif_id, 'sinif', s.ad, 'seviye', s.seviye,
             'ogrenci_kodu', (select k.kod from public.giris_kodlari k where k.ogrenci_id = x.id and k.rol = 'ogrenci'),
             'veli_kodu',    (select k.kod from public.giris_kodlari k where k.ogrenci_id = x.id and k.rol = 'veli'))
           order by s.seviye, s.sube)
      from public.ogrenciler x join public.siniflar s on s.id = x.sinif_id
     where x.deneme), '[]'::jsonb);
end;
$$;

create or replace function public.deneme_hesabi_olustur(p_token text, p_sinif uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid;
  yeni uuid;
begin
  v_id := public._yonetici(p_token);
  perform public._deneme_sinifi_gecerli(p_sinif);
  perform public._deneme_duzeyi_bos(p_sinif, null);

  -- sinif_giris NULL: en baştan beri bu sınıfta (gerekçe dosya başında).
  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, deneme, sinif_giris)
  values ('Deneme Öğrenci', 'okul', p_sinif, v_id, true, null)
  returning id into yeni;
  insert into public.giris_kodlari (kod, ogrenci_id, rol)
  values (public._yeni_kod(), yeni, 'ogrenci'), (public._yeni_kod(), yeni, 'veli');

  perform public._denetim('deneme_hesabi_olusturuldu', 'ogrenciler', yeni, public._aktor(v_id),
                          null, jsonb_build_object('sinif_id', p_sinif));
  return public.deneme_hesaplari(p_token);
end;
$$;

create or replace function public.deneme_sinifi_degistir(p_token text, p_id uuid, p_sinif uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid;
  o record;
begin
  v_id := public._yonetici(p_token);
  perform public._deneme_sinifi_gecerli(p_sinif);
  select id, sinif_id into o from public.ogrenciler where id = p_id and deneme;
  if not found then
    raise exception 'Deneme hesabı bulunamadı.' using errcode = 'P0002';
  end if;
  perform public._deneme_duzeyi_bos(p_sinif, o.id);
  update public.ogrenciler set sinif_id = p_sinif, sinif_giris = null where id = o.id and deneme;
  perform public._denetim('deneme_sinifi_degisti', 'ogrenciler', o.id, public._aktor(v_id),
                          jsonb_build_object('sinif_id', o.sinif_id), jsonb_build_object('sinif_id', p_sinif));
  return public.deneme_hesaplari(p_token);
end;
$$;

-- Sil + aynı sınıfta, AYNI kodlarla yeniden kur (gerekçe 0073'te).
-- Yalnız bu hesap; öbür düzeylerin deneme gönderimleri duruyor.
create or replace function public.deneme_sifirla(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid;
  o record;
  k_ogr text;
  k_veli text;
  yeni uuid;
begin
  v_id := public._yonetici(p_token);
  select id, sinif_id into o from public.ogrenciler where id = p_id and deneme;
  if not found then
    raise exception 'Deneme hesabı bulunamadı.' using errcode = 'P0002';
  end if;
  select kod into k_ogr  from public.giris_kodlari where ogrenci_id = o.id and rol = 'ogrenci';
  select kod into k_veli from public.giris_kodlari where ogrenci_id = o.id and rol = 'veli';

  delete from public.ogrenciler where id = o.id and deneme;

  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id, deneme, sinif_giris)
  values ('Deneme Öğrenci', 'okul', o.sinif_id, v_id, true, null)
  returning id into yeni;
  insert into public.giris_kodlari (kod, ogrenci_id, rol)
  values (coalesce(k_ogr, public._yeni_kod()), yeni, 'ogrenci'),
         (coalesce(k_veli, public._yeni_kod()), yeni, 'veli');

  perform public._denetim('deneme_hesabi_sifirlandi', 'ogrenciler', yeni, public._aktor(v_id),
                          jsonb_build_object('eski_id', o.id), jsonb_build_object('sinif_id', o.sinif_id));
  return public.deneme_hesaplari(p_token);
end;
$$;

create or replace function public.deneme_hesabi_sil(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid;
begin
  v_id := public._yonetici(p_token);
  delete from public.ogrenciler where id = p_id and deneme;
  if found then
    perform public._denetim('deneme_hesabi_silindi', 'ogrenciler', p_id, public._aktor(v_id));
  end if;
  return public.deneme_hesaplari(p_token);
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. ogrenci_odevleri — kopya: 0065_genel_ve_duyurular.sql
--    Tek değişiklik: `gec_teslim` deneme hesabında true.
-- -----------------------------------------------------------------------------
create or replace function public.ogrenci_odevleri(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  ogr record;
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'ogrenci' then
    raise exception 'Bu bölüm yalnızca öğrenciler içindir.' using errcode = '42501';
  end if;

  select ogr2.id, ogr2.ad, ogr2.tur, s.ad as sinif, ogr2.sinif_id, ogr2.sinif_giris, ogr2.deneme,
         coalesce(s.arsiv, false) as sinif_arsiv
    into ogr
  from public.ogrenciler ogr2
  left join public.siniflar s on s.id = ogr2.sinif_id
  where ogr2.id = o.ogrenci_id;

  return jsonb_build_object(
    'ogrenci', jsonb_build_object('id', ogr.id, 'ad', ogr.ad, 'sinif', ogr.sinif,
                                  'tur', ogr.tur),
    -- 0065: okunmamış duyuru — öğrenci sekme çubuğundaki Pano rozeti.
    'okunmamis_duyuru', public._okunmamis_duyuru(ogr.id, ogr.sinif_id, ogr.sinif_giris),
    'okunmamis_mesaj', (
      select count(*)::integer from public.mesajlar m
      where m.ogrenci_id = ogr.id and m.kanal = 'ogrenci' and m.kimden = 'ogretmen'
        and m.created_at > coalesce(
              (select k.zaman from public.okundu k
                where k.ogrenci_id = ogr.id and k.rol = 'ogrenci' and k.kanal = 'ogrenci'),
              '-infinity'::timestamptz)
    ),
    'odevler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'baslik', d.baslik,
        'aciklama', d.aciklama,
        'tur', d.tur,
        'son_tarih', d.son_tarih,
        'soru_sayisi', d.soru_sayisi,
        -- 0074: deneme hesabında her ödev açık — arayüzün üç "teslim
        -- kapandı" kapısı bu alanı okuyor; gerçek öğrencide değişmiyor.
        'gec_teslim', d.gec_teslim or ogr.deneme,
        'sik_sayisi', d.sik_sayisi,
        'sinif_arsiv', ogr.sinif_arsiv,
        'odev_yolu', d.odev_url,
        'gonderim', case when g.id is null then null else jsonb_build_object(
          'id', g.id, 'zaman', g.created_at, 'durum', g.durum,
          'dogru', g.dogru, 'yanlis', g.yanlis, 'bos', g.bos,
          'puan', g.puan, 'ogretmen_puan', g.ogretmen_puan,
          'ogretmen_yorum', g.ogretmen_yorum,
          'cevaplar', coalesce(g.cevaplar, '{}'::jsonb),
          'gecikmeli', public._gecikmeli(g.created_at, d.son_tarih)
        ) end,
        -- Anahtar ve konu analizi YALNIZ teslimden sonra.
        'konu_analizi', case when g.id is not null
          then public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
          else '[]'::jsonb end,
        'cevap_anahtari', case when g.id is not null then d.cevap_anahtari else null end,
        'anahtar_yolu',   case when g.id is not null then d.anahtar_url    else null end
      ) order by d.son_tarih)
      from public.odevler d
      left join public.gonderimler g
        on g.odev_id = d.id and g.ogrenci_id = ogr.id
      where d.yayinda and d.sinif_id = ogr.sinif_id
        -- 0064: sınıfa gelmeden önce son tarihi dolan ödev bu öğrencinin değil.
        and public._odev_ogrenciye_dusar(ogr.sinif_giris, d.son_tarih, d.created_at)
    ), '[]'::jsonb),
    'dersler', coalesce((
      select jsonb_agg(jsonb_build_object('zaman', l.zaman, 'mod', l.mod, 'link', l.link)
                       order by l.zaman)
      from public.dersler l
      where l.ogrenci_id = ogr.id and l.zaman > now()
    ), '[]'::jsonb)
  );
end;
$$;


-- -----------------------------------------------------------------------------
-- 5. odev_gonder — kopya: 0056_gonderimi_yeniden_ac.sql
--    Tek değişiklik: süre kontrolünde deneme istisnası.
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
     and not public._gonderim_yeniden_acildi(p_odev, o.ogrenci_id)
     -- 0074: deneme hesabı süresi geçmiş ödeve de gönderebilir (öğretmen
     -- öğrencinin yaşadığını sonradan da deneyebilsin). Kayıt yine dürüst:
     -- gönderim `gecikmeli` görünür.
     and not public._deneme_mi(o.ogrenci_id) then
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
-- 6. YETKİLER
-- -----------------------------------------------------------------------------
revoke all on function public._deneme_duzeyi_bos(uuid, uuid) from public, anon, authenticated;
do $$
declare ad text;
begin
  foreach ad in array array['deneme_hesaplari(text)', 'deneme_hesabi_olustur(text,uuid)',
                            'deneme_sinifi_degistir(text,uuid,uuid)', 'deneme_sifirla(text,uuid)',
                            'deneme_hesabi_sil(text,uuid)', 'ogrenci_odevleri(text)',
                            'odev_gonder(text,uuid,text,jsonb,text[])'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', ad);
    execute format('grant execute on function public.%s to anon, authenticated', ad);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 7. ÖZ-DENETİM
-- -----------------------------------------------------------------------------
do $$
declare
  ad text;
begin
  if to_regclass('public.ogrenciler_tek_deneme') is not null then
    raise exception '0074: tek-deneme indeksi duruyor';
  end if;
  foreach ad in array array['deneme_hesabi(text)', 'deneme_sinifi_degistir(text,uuid)',
                            'deneme_sifirla(text)', 'deneme_hesabi_sil(text)'] loop
    if to_regprocedure('public.' || ad) is not null then
      raise exception '0074: eski uç duruyor: %', ad;
    end if;
  end loop;
  foreach ad in array array['deneme_hesaplari(text)', 'deneme_hesabi_olustur(text,uuid)',
                            'deneme_sinifi_degistir(text,uuid,uuid)', 'deneme_sifirla(text,uuid)',
                            'deneme_hesabi_sil(text,uuid)'] loop
    if to_regprocedure('public.' || ad) is null then
      raise exception '0074: uç yok: %', ad;
    end if;
  end loop;
  if pg_get_functiondef('public.odev_gonder(text,uuid,text,jsonb,text[])'::regprocedure)
       not like '%and not public._deneme_mi(o.ogrenci_id) then%' then
    raise exception '0074: odev_gonder deneme hesabına süresi geçmiş ödevi açmıyor';
  end if;
  if pg_get_functiondef('public.odev_gonder(text,uuid,text,jsonb,text[])'::regprocedure)
       not like '%_gonderim_yeniden_acildi(%' then
    raise exception '0074: odev_gonder 0056 istisnasını kaybetti';
  end if;
  if pg_get_functiondef('public.ogrenci_odevleri(text)'::regprocedure)
       not like '%d.gec_teslim or ogr.deneme%' then
    raise exception '0074: ogrenci_odevleri deneme hesabında teslimi açmıyor';
  end if;
  if pg_get_functiondef('public.ogrenci_odevleri(text)'::regprocedure) not like '%okunmamis_duyuru%' then
    raise exception '0074: ogrenci_odevleri 0065 alanını kaybetti';
  end if;
  if exists (select 1 from public.ogrenciler where deneme and sinif_giris is not null) then
    raise exception '0074: sınıfa giriş tarihi dolu deneme hesabı var';
  end if;
end $$;

select public._migration_kaydet('0074');
