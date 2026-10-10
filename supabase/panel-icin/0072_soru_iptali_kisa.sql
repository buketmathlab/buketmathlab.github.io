-- SEKİZ — 0072: soru iptali
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Açıklamalı tam sürüm: supabase/migrations/0072_soru_iptali.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Ayarlar → Verinizin yedeği)
-- 0071 ÇALIŞMIŞ OLMALI. Edge Function DEĞİŞMİYOR.
--
-- NE YAPIYOR: Ödev düzenleme sayfasına "Soru iptali" eklenir. İptal edilen
-- soru değerlendirme dışı kalır: puan kalan sorular üzerinden hesaplanır
-- (65 soruda 2 iptal → 63 üzerinden). Aynı ödevin bütün şubeleri birlikte
-- yeniden puanlanır; her not değişikliği denetim izine yazılır.
--
-- Bu dosyayı çalıştırmak hiçbir notu DEĞİŞTİRMEZ. Notlar ancak siz bir
-- soruyu iptal ettiğinizde yeniden hesaplanır.
--
-- Beklenen sonuç: en altta tek satırlık bir tablo (_migration_kaydet → 0072).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. _iptal_mi — anahtar değeri iptal işareti mi
-- -----------------------------------------------------------------------------
create or replace function public._iptal_mi(p_deger text)
returns boolean
language sql
immutable
as $$
  select upper(btrim(coalesce(p_deger, ''))) like 'IPTAL%';
$$;

-- -----------------------------------------------------------------------------
-- 2. _puanla (gövde: 0004) — iptal edilen soru PAYDADAN da düşüyor
-- -----------------------------------------------------------------------------
create or replace function public._puanla(
  p_anahtar jsonb,
  p_cevaplar jsonb,
  p_soru_sayisi integer
)
returns table (dogru integer, yanlis integer, bos integer, puan numeric)
language plpgsql
immutable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  i integer;
  d integer := 0;
  y integer := 0;
  b integer := 0;
  iptal integer := 0;
  anahtar_sik text;
  ogrenci_sik text;
begin
  for i in 1..coalesce(p_soru_sayisi, 0) loop
    anahtar_sik := upper(btrim(coalesce(p_anahtar ->> i::text, '')));
    ogrenci_sik := upper(btrim(coalesce(p_cevaplar ->> i::text, '')));

    if public._iptal_mi(anahtar_sik) then
      -- 0072: İPTAL — ne doğru ne yanlış ne boş; soru sayılmıyor.
      iptal := iptal + 1;
    elsif ogrenci_sik = '' then
      -- Cevaplanmamış: yanlış değil, boş.
      b := b + 1;
    elsif anahtar_sik = '' then
      -- Anahtarda o soru yoksa öğrenci cezalandırılmaz.
      b := b + 1;
    elsif ogrenci_sik = anahtar_sik then
      d := d + 1;
    else
      -- Geçersiz bir şık ('Z', '3', bozuk veri) de basitçe yanlıştır.
      y := y + 1;
    end if;
  end loop;

  dogru  := d;
  yanlis := y;
  bos    := b;
  puan   := case when coalesce(p_soru_sayisi, 0) - iptal > 0
                 then round(d * 100.0 / (p_soru_sayisi - iptal), 2)
                 else 0 end;
  return next;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. _konu_analizi (gövde: 0020) — iptal edilen soru konu toplamına girmiyor
-- -----------------------------------------------------------------------------
create or replace function public._konu_analizi(
  p_konular jsonb, p_anahtar jsonb, p_cevaplar jsonb, p_soru_sayisi integer
)
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'konu', konu, 'toplam', toplam,
           'dogru', dogru, 'yanlis', yanlis, 'bos', bos)
         order by (toplam - dogru) desc, konu), '[]'::jsonb)
  from (
    select p_konular ->> k as konu,
           count(*)::integer as toplam,
           count(*) filter (where a <> '' and c <> '' and c = a)::integer as dogru,
           count(*) filter (where a <> '' and c <> '' and c <> a)::integer as yanlis,
           count(*) filter (where c = '' or a = '')::integer as bos
    from jsonb_object_keys(coalesce(p_konular, '{}'::jsonb)) k
    cross join lateral (
      select upper(btrim(coalesce(p_anahtar  ->> k, ''))) as a,
             upper(btrim(coalesce(p_cevaplar ->> k, ''))) as c
    ) s
    where k ~ '^\d+$'
      and k::integer between 1 and coalesce(p_soru_sayisi, 0)
      and btrim(coalesce(p_konular ->> k, '')) <> ''
      -- 0072: iptal edilen soru konunun da sorusu değil.
      and not public._iptal_mi(a)
    group by p_konular ->> k
  ) t;
$$;

-- -----------------------------------------------------------------------------
-- 4. _soru_dokumu (gövde: 0020) — iptal edilen soru yanlış/boş listesinde
--    yok; ayrı `iptal` listesi (mevcut çağıranlar yalnız yanlis/bos okuyor)
-- -----------------------------------------------------------------------------
create or replace function public._soru_dokumu(
  p_anahtar jsonb, p_cevaplar jsonb, p_soru_sayisi integer
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'yanlis', coalesce(jsonb_agg(n order by n)
                filter (where not ip and a <> '' and c <> '' and c <> a), '[]'::jsonb),
    'bos',    coalesce(jsonb_agg(n order by n)
                filter (where not ip and (c = '' or a = '')), '[]'::jsonb),
    'iptal',  coalesce(jsonb_agg(n order by n) filter (where ip), '[]'::jsonb)
  )
  from generate_series(1, coalesce(p_soru_sayisi, 0)) n
  cross join lateral (
    select upper(btrim(coalesce(p_anahtar  ->> n::text, ''))) as a,
           upper(btrim(coalesce(p_cevaplar ->> n::text, ''))) as c,
           public._iptal_mi(p_anahtar ->> n::text) as ip
  ) s;
$$;

-- -----------------------------------------------------------------------------
-- 5. _odevi_yeniden_puanla — bir ödevin bütün gönderimleri, izle
--
-- odev_guncelle'deki döngünün aynısı (0055): puan değişen her gönderim
-- güncelleniyor ve `yeniden_puanlandi` izi düşüyor (Part XLIII). Elle
-- düzeltilmiş puan (`ogretmen_puan`) KORUNUYOR — her yer
-- `coalesce(ogretmen_puan, puan)` kullanıyor — ama öğretmen bilsin diye
-- ayrıca listeleniyor.
-- -----------------------------------------------------------------------------
create or replace function public._odevi_yeniden_puanla(p_odev uuid, p_aktor text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  d      public.odevler;
  g      record;
  yeni   record;
  n      integer := 0;
  elle   jsonb := '[]'::jsonb;
  once   numeric;
  sonra  numeric;
begin
  select * into d from public.odevler where id = p_odev;

  select round(avg(coalesce(gn.ogretmen_puan, gn.puan)), 1) into once
    from public.gonderimler gn where gn.odev_id = p_odev;

  for g in
    select gn.id, gn.cevaplar, gn.puan, gn.dogru, gn.yanlis, gn.bos, gn.ogretmen_puan,
           o.ad as ogrenci_ad
      from public.gonderimler gn
      join public.ogrenciler o on o.id = gn.ogrenci_id
     where gn.odev_id = p_odev
  loop
    select * into yeni
      from public._puanla(coalesce(d.cevap_anahtari, '{}'::jsonb),
                          coalesce(g.cevaplar, '{}'::jsonb), d.soru_sayisi);

    if yeni.puan is distinct from g.puan
       or yeni.dogru is distinct from g.dogru
       or yeni.yanlis is distinct from g.yanlis
       or yeni.bos is distinct from g.bos then
      update public.gonderimler
         set dogru = yeni.dogru, yanlis = yeni.yanlis, bos = yeni.bos, puan = yeni.puan
       where id = g.id;

      perform public._denetim(
        'yeniden_puanlandi', 'gonderimler', g.id, p_aktor,
        jsonb_build_object('puan', g.puan, 'dogru', g.dogru, 'yanlis', g.yanlis, 'bos', g.bos),
        jsonb_build_object('puan', yeni.puan, 'dogru', yeni.dogru,
                           'yanlis', yeni.yanlis, 'bos', yeni.bos));
      n := n + 1;

      if g.ogretmen_puan is not null then
        elle := elle || jsonb_build_object('ogrenci', g.ogrenci_ad,
                                           'ogretmen_puan', g.ogretmen_puan,
                                           'hesaplanan', yeni.puan);
      end if;
    end if;
  end loop;

  select round(avg(coalesce(gn.ogretmen_puan, gn.puan)), 1) into sonra
    from public.gonderimler gn where gn.odev_id = p_odev;

  return jsonb_build_object('yeniden_puanlanan', n, 'ortalama_once', once,
                            'ortalama_sonra', sonra, 'elle_duzeltilmis', elle);
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. sorulari_iptal_et — ödev ve bütün kardeş şubeleri
-- -----------------------------------------------------------------------------
create or replace function public.sorulari_iptal_et(
  p_token text,
  p_odev uuid,
  p_sorular integer[],
  p_sebep text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ogretmen uuid;
  v_aktor    text;
  d          public.odevler;
  k          record;
  sorular    integer[];
  v_sebep    text := btrim(coalesce(p_sebep, ''));
  n          integer;
  harf       text;
  anahtar    jsonb;
  rapor      jsonb := '[]'::jsonb;
begin
  v_ogretmen := public._ogretmen(p_token);
  v_aktor := public._aktor(v_ogretmen);

  select * into d from public.odevler where id = p_odev;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;
  -- Kardeşlere yaymadaki kural (0031): bütün şubeleri ödevi veren öğretmen
  -- değiştirebilir.
  if d.ogretmen_id is distinct from v_ogretmen then
    raise exception 'Soru iptalini yalnız ödevi veren öğretmen yapabilir.' using errcode = '42501';
  end if;
  if d.tur <> 'test' then
    raise exception 'Soru iptali yalnız test ödevlerinde yapılabilir.' using errcode = '22023';
  end if;
  if length(v_sebep) < 3 or length(v_sebep) > 500 then
    raise exception 'İptalin sebebini yazın (en fazla 500 karakter).' using errcode = '22023';
  end if;

  sorular := array(select distinct x from unnest(coalesce(p_sorular, '{}'::integer[])) x
                    where x is not null order by x);
  if cardinality(sorular) = 0 then
    raise exception 'İptal edilecek soru numarasını yazın.' using errcode = '22023';
  end if;
  if cardinality(sorular) <> cardinality(array_remove(p_sorular, null)) then
    raise exception 'Aynı soru numarası birden fazla yazılmış.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(sorular) x where x < 1 or x > d.soru_sayisi) then
    raise exception 'Soru numaraları 1 ile % arasında olmalı.', d.soru_sayisi using errcode = '22023';
  end if;

  for k in
    select d2.id, d2.sinif_id, d2.soru_sayisi, d2.cevap_anahtari, s2.ad as sinif_ad
      from public.odevler d2
      join public.siniflar s2 on s2.id = d2.sinif_id
     where d2.id = p_odev or (d.grup_id is not null and d2.grup_id = d.grup_id)
     order by (d2.id <> p_odev), s2.seviye, s2.sube
  loop
    if public._sinif_arsivde(k.sinif_id) then
      rapor := rapor || jsonb_build_object('sinif', k.sinif_ad, 'odev_id', k.id, 'atlandi', 'arsiv');
      continue;
    end if;

    anahtar := coalesce(k.cevap_anahtari, '{}'::jsonb);
    foreach n in array sorular loop
      continue when n > k.soru_sayisi;
      harf := upper(btrim(coalesce(anahtar ->> n::text, '')));
      if not public._iptal_mi(harf) then
        anahtar := anahtar || jsonb_build_object(n::text, 'IPTAL:' || harf);
      end if;
    end loop;

    if anahtar = coalesce(k.cevap_anahtari, '{}'::jsonb) then
      rapor := rapor || jsonb_build_object('sinif', k.sinif_ad, 'odev_id', k.id, 'atlandi', 'zaten_iptal');
      continue;
    end if;

    -- En az bir soru değerlendirmede kalmalı: yoksa puanın paydası 0 olur.
    if not exists (select 1 from generate_series(1, k.soru_sayisi) i
                    where not public._iptal_mi(anahtar ->> i::text)) then
      raise exception 'Bütün sorular iptal edilemez; en az bir soru değerlendirmede kalmalı.'
        using errcode = '22023';
    end if;

    update public.odevler set cevap_anahtari = anahtar where id = k.id;

    perform public._denetim('soru_iptal_edildi', 'odevler', k.id, v_aktor,
      jsonb_build_object('cevap_anahtari', k.cevap_anahtari),
      jsonb_build_object('cevap_anahtari', anahtar, 'sorular', to_jsonb(sorular), 'sebep', v_sebep));

    rapor := rapor || (jsonb_build_object('sinif', k.sinif_ad, 'odev_id', k.id)
                       || public._odevi_yeniden_puanla(k.id, v_aktor));
  end loop;

  return jsonb_build_object('durum', 'tamam', 'sorular', to_jsonb(sorular), 'subeler', rapor);
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. soru_iptalini_geri_al — asıl harf geri, yeniden puanlama, iz
-- -----------------------------------------------------------------------------
create or replace function public.soru_iptalini_geri_al(
  p_token text,
  p_odev uuid,
  p_soru integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ogretmen uuid;
  v_aktor    text;
  d          public.odevler;
  k          record;
  deger      text;
  asil       text;
  anahtar    jsonb;
  rapor      jsonb := '[]'::jsonb;
begin
  v_ogretmen := public._ogretmen(p_token);
  v_aktor := public._aktor(v_ogretmen);

  select * into d from public.odevler where id = p_odev;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;
  if d.ogretmen_id is distinct from v_ogretmen then
    raise exception 'Soru iptalini yalnız ödevi veren öğretmen geri alabilir.' using errcode = '42501';
  end if;
  if p_soru is null or p_soru < 1 or p_soru > coalesce(d.soru_sayisi, 0) then
    raise exception 'Soru numarası 1 ile % arasında olmalı.', d.soru_sayisi using errcode = '22023';
  end if;

  for k in
    select d2.id, d2.sinif_id, d2.cevap_anahtari, s2.ad as sinif_ad
      from public.odevler d2
      join public.siniflar s2 on s2.id = d2.sinif_id
     where d2.id = p_odev or (d.grup_id is not null and d2.grup_id = d.grup_id)
     order by (d2.id <> p_odev), s2.seviye, s2.sube
  loop
    if public._sinif_arsivde(k.sinif_id) then
      rapor := rapor || jsonb_build_object('sinif', k.sinif_ad, 'odev_id', k.id, 'atlandi', 'arsiv');
      continue;
    end if;

    anahtar := coalesce(k.cevap_anahtari, '{}'::jsonb);
    deger := anahtar ->> p_soru::text;
    if not public._iptal_mi(deger) then
      rapor := rapor || jsonb_build_object('sinif', k.sinif_ad, 'odev_id', k.id, 'atlandi', 'iptal_degil');
      continue;
    end if;

    asil := btrim(substr(btrim(deger), 7));   -- 'IPTAL:' sonrası
    anahtar := case when asil = '' then anahtar - p_soru::text
                    else anahtar || jsonb_build_object(p_soru::text, asil) end;

    update public.odevler set cevap_anahtari = anahtar where id = k.id;

    perform public._denetim('soru_iptali_geri_alindi', 'odevler', k.id, v_aktor,
      jsonb_build_object('cevap_anahtari', k.cevap_anahtari),
      jsonb_build_object('cevap_anahtari', anahtar, 'soru', p_soru));

    rapor := rapor || (jsonb_build_object('sinif', k.sinif_ad, 'odev_id', k.id)
                       || public._odevi_yeniden_puanla(k.id, v_aktor));
  end loop;

  return jsonb_build_object('durum', 'tamam', 'soru', p_soru, 'subeler', rapor);
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. YETKİLER
-- -----------------------------------------------------------------------------
revoke all on function public._iptal_mi(text) from public, anon, authenticated;
revoke all on function public._puanla(jsonb, jsonb, integer) from public, anon, authenticated;
revoke all on function public._konu_analizi(jsonb, jsonb, jsonb, integer) from public, anon, authenticated;
revoke all on function public._soru_dokumu(jsonb, jsonb, integer) from public, anon, authenticated;
revoke all on function public._odevi_yeniden_puanla(uuid, text) from public, anon, authenticated;

revoke all on function public.sorulari_iptal_et(text, uuid, integer[], text) from public, anon, authenticated;
grant execute on function public.sorulari_iptal_et(text, uuid, integer[], text) to anon, authenticated;
revoke all on function public.soru_iptalini_geri_al(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.soru_iptalini_geri_al(text, uuid, integer) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 9. ÖZ-DENETİM — iptal edilen soru paydadan düşüyor
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  -- 4 soru; 2. iptal. 3 doğru cevap → 3/3 = 100. (Paydada kalsaydı 75.)
  select * into r from public._puanla('{"1":"A","2":"IPTAL:B","3":"C","4":"D"}'::jsonb,
                                       '{"1":"A","3":"C","4":"D"}'::jsonb, 4);
  if r.puan <> 100 or r.dogru <> 3 or r.bos <> 0 then
    raise exception '0072: _puanla iptal edilen soruyu paydadan düşmüyor (%)', r;
  end if;
  if public._soru_dokumu('{"1":"A","2":"IPTAL:B"}'::jsonb, '{}'::jsonb, 2)
     <> '{"yanlis": [], "bos": [1], "iptal": [2]}'::jsonb then
    raise exception '0072: _soru_dokumu iptali ayırmıyor';
  end if;
end $$;

select public._migration_kaydet('0072');
