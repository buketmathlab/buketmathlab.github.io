-- =============================================================================
-- 0076 — ANONİM PAYDAŞ ANKETİ (öğrenci, veli, öğretmen)
--
-- Okul Gelişim Projesi izleme-değerlendirmesinde en güçlü eksik kanıt
-- paydaş görüşüydü. Öğretmenin kararı: anket uygulamanın içinde olsun.
--
-- ANONİMLİK SUNUCUDA KURULUYOR, arayüzde değil:
--   * `anket_katilimlari` yalnız TEKRARI engelliyor: kim katıldı, ama bir
--     kimlik değil, gizli tuzla üretilmiş bir özet (sha256). Saat yok.
--   * `anket_yanitlari` yanıtları tutuyor: kimlik YOK, saat YOK, yalnız
--     haftanın başı. İki tablo arasında uygulama düzeyinde bağ kurulamaz.
--   * Sonuçlar grup başına EN AZ 5 yanıt olmadan gösterilmiyor: dört
--     öğretmenli bir okulda "ortalama 2" bir kişiyi işaret ederdi.
--   * Ankette ad, sınıf, şube ya da kod SORULMUYOR.
--
-- KİM YANITLAR: öğrenci, veli (onam verdiyse, 0034 kapısı) ve öğretmen.
-- Müdür yanıtlamaz (yalnız izler). Vekâlet oturumu yanıtlayamaz — sahip
-- başkasının yerine görüş bildiremez. Deneme hesabı (0073) yanıt
-- gönderebilir ama KAYDEDİLMEZ: sahip akışı dener, sayılar bozulmaz.
--
-- Sorular istemcide (`app/src/lib/anket-sorulari.ts`); sunucu madde
-- SAYISINI ve değer aralığını doğruluyor: öğrenci m1–m7, veli ve öğretmen
-- m1–m5, hepsi 1–5; "acik" isteğe bağlı, en çok 300 karakter.
--
-- Bu dosya tekrar çalıştırılabilir. Ön koşul: 0075.
-- =============================================================================

do $$
begin
  if to_regprocedure('public.proje_raporu(text)') is null then
    raise exception '0076: önce 0075 çalıştırılmalı';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. Tablolar
-- -----------------------------------------------------------------------------
create table if not exists public.anketler (
  kod     text primary key,
  baslik  text not null,
  acik    boolean not null default false,
  -- Özetin tuzu: yedekte ve hiçbir uçta YOK. Kimlik → özet yönü bilinse
  -- de tuz olmadan bir özetten kimliğe gidilemez.
  tuz     text not null default encode(extensions.gen_random_bytes(32), 'hex')
);

create table if not exists public.anket_katilimlari (
  anket       text not null references public.anketler(kod) on delete cascade,
  rol         text not null check (rol in ('ogrenci', 'veli', 'ogretmen')),
  kisi_ozeti  text not null,
  primary key (anket, kisi_ozeti)
);

create table if not exists public.anket_yanitlari (
  id        uuid primary key default gen_random_uuid(),
  anket     text not null references public.anketler(kod) on delete cascade,
  rol       text not null check (rol in ('ogrenci', 'veli', 'ogretmen')),
  cevaplar  jsonb not null,
  hafta     date not null
);

alter table public.anketler          enable row level security;
alter table public.anketler          force row level security;
alter table public.anket_katilimlari enable row level security;
alter table public.anket_katilimlari force row level security;
alter table public.anket_yanitlari   enable row level security;
alter table public.anket_yanitlari   force row level security;
revoke all on public.anketler, public.anket_katilimlari, public.anket_yanitlari
  from public, anon, authenticated;
drop policy if exists anketler_kapali on public.anketler;
create policy anketler_kapali on public.anketler for all using (false);
drop policy if exists anket_katilimlari_kapali on public.anket_katilimlari;
create policy anket_katilimlari_kapali on public.anket_katilimlari for all using (false);
drop policy if exists anket_yanitlari_kapali on public.anket_yanitlari;
create policy anket_yanitlari_kapali on public.anket_yanitlari for all using (false);

-- Bu eğitim yılının anketi, KAPALI başlıyor: sahip açınca görünür.
insert into public.anketler (kod, baslik)
values ('2026-2027-1', '2026-2027 1. dönem SEKİZ görüş anketi')
on conflict (kod) do nothing;

-- -----------------------------------------------------------------------------
-- 2. Yardımcılar
-- -----------------------------------------------------------------------------
-- Açık anket (en yeni kod). Yoksa null.
create or replace function public._acik_anket()
returns text
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select kod from public.anketler where acik order by kod desc limit 1;
$$;

-- Oturumdan yanıtlayan: rol, kişi kimliği, deneme mi. Yanıtlayamazsa 42501.
create or replace function public._anket_yanitlayan(p_token text)
returns table (rol text, kimlik uuid, deneme boolean)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
begin
  select * into o from public._oturum(p_token);
  if o.rol = 'ogretmen' then
    if o.vekil_id is not null then
      raise exception 'Başka bir öğretmenin hesabındayken anket yanıtlanamaz.' using errcode = '42501';
    end if;
    rol := 'ogretmen'; kimlik := o.ogretmen_id; deneme := false;
  elsif o.rol in ('ogrenci', 'veli') then
    perform public._onam_kapisi(o.rol, o.ogrenci_id);
    rol := o.rol; kimlik := o.ogrenci_id; deneme := public._deneme_mi(o.ogrenci_id);
  else
    raise exception 'Bu anket öğrenci, veli ve öğretmenler içindir.' using errcode = '42501';
  end if;
  return next;
end;
$$;

create or replace function public._anket_ozeti(p_anket text, p_rol text, p_kimlik uuid)
returns text
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select encode(extensions.digest(p_rol || ':' || p_kimlik::text || ':' || a.kod || ':' || a.tuz, 'sha256'), 'hex')
    from public.anketler a where a.kod = p_anket;
$$;

create or replace function public._anket_madde_sayisi(p_rol text)
returns integer
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select case p_rol when 'ogrenci' then 7 else 5 end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Uçlar
-- -----------------------------------------------------------------------------
-- Pano kartı: açık anket var mı, ben katıldım mı.
create or replace function public.anket_durumu(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  y record;
  v_anket text;
begin
  select * into y from public._anket_yanitlayan(p_token);
  v_anket := public._acik_anket();
  if v_anket is null then
    return jsonb_build_object('acik', false);
  end if;
  return jsonb_build_object(
    'acik', true,
    'anket', v_anket,
    'rol', y.rol,
    'madde_sayisi', public._anket_madde_sayisi(y.rol),
    'katildi', (not y.deneme) and exists (
      select 1 from public.anket_katilimlari k
       where k.anket = v_anket and k.kisi_ozeti = public._anket_ozeti(v_anket, y.rol, y.kimlik)),
    'deneme', y.deneme);
end;
$$;

create or replace function public.anket_yanitla(p_token text, p_cevaplar jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  y record;
  v_anket text;
  v_ozet  text;
  n integer;
  i integer;
  d jsonb;
  temiz jsonb := '{}'::jsonb;
  v_acik text;
begin
  select * into y from public._anket_yanitlayan(p_token);
  v_anket := public._acik_anket();
  if v_anket is null then
    raise exception 'Şu anda açık bir anket yok.' using errcode = 'P0002';
  end if;
  if p_cevaplar is null or jsonb_typeof(p_cevaplar) <> 'object' then
    raise exception 'Yanıtlar okunamadı.' using errcode = '22023';
  end if;

  -- Her madde 1–5 arası tam sayı; hepsi zorunlu. Fazla anahtar alınmıyor.
  n := public._anket_madde_sayisi(y.rol);
  for i in 1 .. n loop
    d := p_cevaplar -> ('m' || i);
    if d is null or jsonb_typeof(d) <> 'number'
       or (d::text)::numeric not in (1, 2, 3, 4, 5) then
      raise exception 'Lütfen bütün soruları yanıtlayın.' using errcode = '22023';
    end if;
    temiz := temiz || jsonb_build_object('m' || i, (d::text)::integer);
  end loop;
  v_acik := nullif(btrim(coalesce(p_cevaplar ->> 'acik', '')), '');
  if v_acik is not null then
    if length(v_acik) > 300 then
      raise exception 'Görüşünüz en çok 300 karakter olabilir.' using errcode = '22023';
    end if;
    temiz := temiz || jsonb_build_object('acik', v_acik);
  end if;

  -- Deneme hesabı: akış birebir, KAYIT YOK (sayılar bozulmasın).
  if y.deneme then
    return jsonb_build_object('kaydedildi', false, 'deneme', true);
  end if;

  v_ozet := public._anket_ozeti(v_anket, y.rol, y.kimlik);
  begin
    insert into public.anket_katilimlari (anket, rol, kisi_ozeti) values (v_anket, y.rol, v_ozet);
  exception when unique_violation then
    raise exception 'Bu anketi zaten yanıtladınız. Teşekkür ederiz.' using errcode = '23505';
  end;
  insert into public.anket_yanitlari (anket, rol, cevaplar, hafta)
  values (v_anket, y.rol, temiz,
          date_trunc('week', (now() at time zone 'Europe/Istanbul'))::date);

  -- DENETİM İZİNE YAZILMIYOR (bilinçli): izin saati, oturumun "son görülme"
  -- saatiyle yan yana konunca yanıtı bir kişiye bağlayabilirdi.
  return jsonb_build_object('kaydedildi', true);
end;
$$;

-- Sahip: anketi aç / kapat. Tek anket açık olabilir (en yeni kod).
create or replace function public.anket_ac_kapat(p_token text, p_anket text, p_acik boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid;
begin
  v_id := public._yonetici(p_token);
  if not exists (select 1 from public.anketler where kod = p_anket) then
    raise exception 'Anket bulunamadı.' using errcode = 'P0002';
  end if;
  if p_acik then
    update public.anketler set acik = false where kod <> p_anket and acik;
  end if;
  update public.anketler set acik = p_acik where kod = p_anket;
  perform public._denetim(case when p_acik then 'anket_acildi' else 'anket_kapandi' end,
                          'anketler', null, public._aktor(v_id), null,
                          jsonb_build_object('anket', p_anket));
  return public.anket_sonuclari(p_token);
end;
$$;

-- Sonuçlar: sahip ve müdür. Grup başına n < 5 ise dağılım ve görüş YOK.
create or replace function public.anket_sonuclari(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  esik constant integer := 5;
begin
  select * into o from public._oturum(p_token);
  if o.rol = 'mudur' then
    perform public._mudur(p_token);
  else
    perform public._yonetici(p_token);
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'anket', a.kod, 'baslik', a.baslik, 'acik', a.acik, 'esik', esik,
      'gruplar', (
        select jsonb_agg(jsonb_build_object(
          'rol', r.rol,
          'katilim', (select count(*) from public.anket_katilimlari k
                       where k.anket = a.kod and k.rol = r.rol)::integer,
          'yanit', r.n,
          'yeterli', r.n >= esik,
          'maddeler', case when r.n < esik then '[]'::jsonb else (
            select jsonb_agg(jsonb_build_object(
              'madde', 'm' || i,
              'dagilim', (select jsonb_agg((select count(*) from public.anket_yanitlari y
                                             where y.anket = a.kod and y.rol = r.rol
                                               and (y.cevaplar ->> ('m' || i))::integer = v)
                                           order by v)
                            from generate_series(1, 5) v),
              'ortalama', (select round(avg((y.cevaplar ->> ('m' || i))::integer), 2)
                             from public.anket_yanitlari y
                            where y.anket = a.kod and y.rol = r.rol)
            ) order by i)
            from generate_series(1, public._anket_madde_sayisi(r.rol)) i) end,
          -- Görüşler metin sırasına göre: yanıtlanma sırası bir ipucu olmasın.
          'gorusler', case when r.n < esik then '[]'::jsonb else coalesce((
            select jsonb_agg(y.cevaplar ->> 'acik' order by y.cevaplar ->> 'acik')
              from public.anket_yanitlari y
             where y.anket = a.kod and y.rol = r.rol and y.cevaplar ? 'acik'), '[]'::jsonb) end
        ) order by r.sira)
        from (select g.rol, g.sira,
                     (select count(*) from public.anket_yanitlari y
                       where y.anket = a.kod and y.rol = g.rol)::integer as n
                from (values ('ogrenci', 1), ('veli', 2), ('ogretmen', 3)) g(rol, sira)) r
      )
    ) order by a.kod desc)
    from public.anketler a
  ), '[]'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Yetkiler
-- -----------------------------------------------------------------------------
revoke all on function public._acik_anket() from public, anon, authenticated;
revoke all on function public._anket_yanitlayan(text) from public, anon, authenticated;
revoke all on function public._anket_ozeti(text, text, uuid) from public, anon, authenticated;
revoke all on function public._anket_madde_sayisi(text) from public, anon, authenticated;
do $$
declare ad text;
begin
  foreach ad in array array['anket_durumu(text)', 'anket_yanitla(text,jsonb)',
                            'anket_ac_kapat(text,text,boolean)', 'anket_sonuclari(text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', ad);
    execute format('grant execute on function public.%s to anon, authenticated', ad);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Öz-denetim
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'anket_yanitlari'
                and column_name in ('ogrenci_id', 'ogretmen_id', 'kisi_ozeti', 'created_at')) then
    raise exception '0076: anket_yanitlari kimlik ya da saat taşıyor';
  end if;
  if has_function_privilege('anon', 'public._anket_ozeti(text, text, uuid)', 'execute') then
    raise exception '0076: _anket_ozeti anon''a açık';
  end if;
  if pg_get_functiondef('public._anket_yanitlayan(text)'::regprocedure) not like '%_onam_kapisi%' then
    raise exception '0076: veli onam kapısı yok';
  end if;
end $$;

select public._migration_kaydet('0076');
