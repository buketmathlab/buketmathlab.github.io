-- SEKİZ · Adım 11 — Oran sınırlama (kaba kuvvet kilidi)
--
-- Kural: 5 hatalı denemeden sonra 15 dakika kilit.
-- İki katmanlı: (1) aynı cihaz+kimlik için 5 deneme, (2) aynı kimlik için toplam
-- 25 deneme. İkinci katman, cihaz parmak izini değiştirerek kilidi aşmayı engeller.
-- Başarılı girişten sonraki denemeler sıfırdan sayılır.

create or replace function sekiz_kilit_saniye(p_kimlik text, p_parmak_izi text)
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_pencere constant interval := interval '15 minutes';
  v_son_basari timestamptz;
  v_cihaz_sayi integer;  v_cihaz_son timestamptz;
  v_genel_sayi integer;  v_genel_son timestamptz;
  v_kalan integer := 0;
begin
  select max(zaman) into v_son_basari
  from giris_denemeleri
  where kimlik = p_kimlik and basarili;

  -- (1) Bu cihazdan yapılan başarısız denemeler
  select count(*), max(zaman) into v_cihaz_sayi, v_cihaz_son
  from giris_denemeleri
  where kimlik = p_kimlik
    and parmak_izi is not distinct from p_parmak_izi
    and not basarili
    and zaman > now() - v_pencere
    and zaman > coalesce(v_son_basari, '-infinity'::timestamptz);

  if v_cihaz_sayi >= 5 then
    v_kalan := greatest(v_kalan,
      ceil(extract(epoch from (v_cihaz_son + v_pencere - now())))::int);
  end if;

  -- (2) Tüm cihazlardan yapılan başarısız denemeler
  select count(*), max(zaman) into v_genel_sayi, v_genel_son
  from giris_denemeleri
  where kimlik = p_kimlik
    and not basarili
    and zaman > now() - v_pencere
    and zaman > coalesce(v_son_basari, '-infinity'::timestamptz);

  if v_genel_sayi >= 25 then
    v_kalan := greatest(v_kalan,
      ceil(extract(epoch from (v_genel_son + v_pencere - now())))::int);
  end if;

  return greatest(v_kalan, 0);
end;
$$;

create or replace function sekiz_deneme_yaz(p_kimlik text, p_parmak_izi text, p_basarili boolean)
returns void
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  insert into giris_denemeleri (kimlik, parmak_izi, basarili)
  values (p_kimlik, nullif(btrim(coalesce(p_parmak_izi, '')), ''), p_basarili);
$$;

revoke all on function sekiz_kilit_saniye(text, text) from public, anon, authenticated;
revoke all on function sekiz_deneme_yaz(text, text, boolean) from public, anon, authenticated;

-- Doğrulama: hiç deneme yokken kilit 0 saniye olmalı.
select sekiz_kilit_saniye('ogretmen', 'deneme-cihaz') as kilit_saniye;
