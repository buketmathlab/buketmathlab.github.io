-- SEKİZ — 0033: Öğretmen kimliği, sahiplik ve kapsam
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Beklenen sonuç: "Success. No rows returned."
-- Açıklamalı tam sürüm: supabase/migrations/0033_ogretmen_kimligi.sql
--
-- NE YAPIYOR: sistem tek öğretmenlikten çok öğretmenliye geçiyor.
--   * Mevcut PIN'iniz sizin satırınıza taşınıyor — AYNI PIN'le girmeye
--     devam ediyorsunuz, hiçbir ekranınız değişmiyor.
--   * Bütün sınıflarınız, ödevleriniz, mesajlarınız, dersleriniz ve
--     ödemeleriniz size bağlanıyor.
--   * Siz platformun SAHİBİSİNİZ: öğretmen ekler, çıkarır, PIN sıfırlar,
--     istediğiniz öğretmenin hesabına geçebilirsiniz.
--   * Özel ders (sınıfı, öğrencisi, dersleri, ödemeleri ve o velilerle
--     yazışma) tamamen SİZDE kalıyor; başka öğretmen göremiyor.
--
-- ÇALIŞTIRILMAZSA hiçbir şey bozulmaz: sistem bugünkü gibi tek öğretmenli
-- çalışmaya devam eder. Öğretmenler ekranı ve vekâlet görünmez.
--
-- ÇALIŞTIRDIKTAN SONRA da tek öğretmenlisiniz — ikinci öğretmen ancak siz
-- Öğretmenler ekranından eklediğinizde oluşur.

create table if not exists public.ogretmenler (
  id          uuid primary key default gen_random_uuid(),
  ad          text not null check (length(btrim(ad)) between 1 and 120),
  pin_hash    text,
  yonetici    boolean not null default false,
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists ogretmenler_tek_sahip
  on public.ogretmenler ((true)) where yonetici;

drop trigger if exists ogretmenler_updated_at on public.ogretmenler;
create trigger ogretmenler_updated_at before update on public.ogretmenler
  for each row execute function public.tetik_updated_at();

create table if not exists public.ogretmen_siniflari (
  ogretmen_id uuid not null references public.ogretmenler(id) on delete cascade,
  sinif_id    uuid not null references public.siniflar(id)    on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (ogretmen_id, sinif_id)
);

create index if not exists ogretmen_siniflari_sinif_idx
  on public.ogretmen_siniflari (sinif_id);

insert into public.ogretmenler (ad, pin_hash, yonetici, aktif)
select 'Buket Topuzoğlu', a.ogretmen_pin_hash, true, true
from public.ayarlar a
where a.id = 1
  and not exists (select 1 from public.ogretmenler);

insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
select y.id, s.id
from public.ogretmenler y
cross join public.siniflar s
where y.yonetici
on conflict do nothing;

alter table public.odevler  add column if not exists ogretmen_id uuid references public.ogretmenler(id) on delete restrict;
alter table public.mesajlar add column if not exists ogretmen_id uuid references public.ogretmenler(id) on delete cascade;
alter table public.dersler  add column if not exists ogretmen_id uuid references public.ogretmenler(id) on delete cascade;
alter table public.odemeler add column if not exists ogretmen_id uuid references public.ogretmenler(id) on delete cascade;

update public.odevler  set ogretmen_id = (select id from public.ogretmenler where yonetici limit 1) where ogretmen_id is null;
update public.mesajlar set ogretmen_id = (select id from public.ogretmenler where yonetici limit 1) where ogretmen_id is null;
update public.dersler  set ogretmen_id = (select id from public.ogretmenler where yonetici limit 1) where ogretmen_id is null;
update public.odemeler set ogretmen_id = (select id from public.ogretmenler where yonetici limit 1) where ogretmen_id is null;

do $$
begin
  if exists (select 1 from public.odevler  where ogretmen_id is null)
  or exists (select 1 from public.mesajlar where ogretmen_id is null)
  or exists (select 1 from public.dersler  where ogretmen_id is null)
  or exists (select 1 from public.odemeler where ogretmen_id is null) then
    raise exception '0033: sahipsiz satır kaldı — veri taşıma tamamlanmadı.';
  end if;
end $$;

alter table public.odevler  alter column ogretmen_id set not null;
alter table public.mesajlar alter column ogretmen_id set not null;
alter table public.dersler  alter column ogretmen_id set not null;
alter table public.odemeler alter column ogretmen_id set not null;

create index if not exists odevler_ogretmen_idx  on public.odevler  (ogretmen_id);
create index if not exists mesajlar_ogretmen_idx on public.mesajlar (ogretmen_id, ogrenci_id);
create index if not exists dersler_ogretmen_idx  on public.dersler  (ogretmen_id);
create index if not exists odemeler_ogretmen_idx on public.odemeler (ogretmen_id);

alter table public.okundu add column if not exists ogretmen_id uuid references public.ogretmenler(id) on delete cascade;

update public.okundu set ogretmen_id = (select id from public.ogretmenler where yonetici limit 1) where ogretmen_id is null;

do $$
begin
  if exists (select 1 from public.okundu where ogretmen_id is null) then
    raise exception '0033: okundu satırı sahipsiz kaldı.';
  end if;
end $$;

alter table public.okundu alter column ogretmen_id set not null;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.okundu'::regclass and conname = 'okundu_pkey'
  ) then
    alter table public.okundu drop constraint okundu_pkey;
  end if;
end $$;

alter table public.okundu add primary key (ogrenci_id, rol, kanal, ogretmen_id);

alter table public.oturumlar add column if not exists ogretmen_id uuid references public.ogretmenler(id) on delete cascade;

update public.oturumlar
   set ogretmen_id = (select id from public.ogretmenler where yonetici limit 1)
 where rol = 'ogretmen' and ogretmen_id is null;

alter table public.oturumlar add column if not exists vekil_id uuid references public.ogretmenler(id) on delete cascade;

alter table public.oturumlar drop constraint if exists oturum_rol_tutarli;
alter table public.oturumlar add constraint oturum_rol_tutarli check (
  (rol = 'ogretmen' and ogrenci_id is null and ogretmen_id is not null)
  or (rol in ('ogrenci', 'veli') and ogrenci_id is not null and ogretmen_id is null)
);

alter table public.ayarlar drop column if exists ogretmen_pin_hash;

drop function if exists public._aktor(uuid);
create or replace function public._aktor(p_ogretmen_id uuid, p_vekil_id uuid default null)
returns text
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select case when coalesce(p_vekil_id::text, nullif(current_setting('sekiz.vekil', true), '')) is null then ''
              else coalesce((select v.ad || ' <' || v.id::text || '> → '
                             from public.ogretmenler v
                             where v.id = coalesce(p_vekil_id,
                                     nullif(current_setting('sekiz.vekil', true), '')::uuid)), '')
         end
      || coalesce(
           (select o.ad || ' <' || o.id::text || '>' from public.ogretmenler o where o.id = p_ogretmen_id),
           'ogretmen'
         );
$$;

drop function if exists public._oturum(text);
create or replace function public._oturum(p_token text)
returns table (rol text, ogrenci_id uuid, ogretmen_id uuid, vekil_id uuid)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  kayit record;
begin
  if p_token is null or length(p_token) < 32 then
    raise exception 'Oturum geçersiz. Lütfen tekrar giriş yapın.'
      using errcode = '28000';
  end if;

  select o.rol, o.ogrenci_id, o.ogretmen_id, o.vekil_id, o.id into kayit
  from public.oturumlar o
  where o.token_hash = public._token_hash(p_token)
    and not o.iptal
    and o.son_kullanma > now();

  if not found then
    raise exception 'Oturum süresi dolmuş. Lütfen tekrar giriş yapın.'
      using errcode = '28000';
  end if;

  if kayit.rol = 'ogretmen'
     and not exists (select 1 from public.ogretmenler g where g.id = kayit.ogretmen_id and g.aktif) then
    raise exception 'Oturum geçersiz. Lütfen tekrar giriş yapın.'
      using errcode = '28000';
  end if;

  update public.oturumlar set son_gorulme = now() where id = kayit.id;

  rol := kayit.rol;
  ogrenci_id := kayit.ogrenci_id;
  ogretmen_id := kayit.ogretmen_id;
  vekil_id := kayit.vekil_id;
  return next;
end;
$$;

drop function if exists public._ogretmen(text);
create or replace function public._ogretmen(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'ogretmen' then
    raise exception 'Bu işlem için öğretmen yetkisi gerekiyor.'
      using errcode = '42501';
  end if;

  perform set_config('sekiz.vekil', coalesce(o.vekil_id::text, ''), true);

  return o.ogretmen_id;
end;
$$;

create or replace function public._yonetici(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid;
begin
  v_id := public._ogretmen(p_token);
  if not exists (select 1 from public.ogretmenler g where g.id = v_id and g.yonetici) then
    raise exception 'Bu işlem için yönetici yetkisi gerekiyor.'
      using errcode = '42501';
  end if;
  return v_id;
end;
$$;

drop function if exists public._oturum_ac(text, uuid, interval);
create or replace function public._oturum_ac(
  p_rol text,
  p_ogrenci_id uuid,
  p_ogretmen_id uuid default null,
  p_sure interval default interval '30 days',
  p_vekil_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  ham_token text;
begin
  ham_token := encode(gen_random_bytes(32), 'hex');

  insert into public.oturumlar (token_hash, rol, ogrenci_id, ogretmen_id, vekil_id, son_kullanma)
  values (public._token_hash(ham_token), p_rol, p_ogrenci_id, p_ogretmen_id, p_vekil_id, now() + p_sure);

  return ham_token;
end;
$$;

create or replace function public.giris(p_kod text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  kimlik text;
  kayit  record;
  token  text;
  ogr    record;
  g      record;
begin
  kimlik := public._istemci_kimligi();

  if public._kilitli_mi(kimlik) then
    raise exception 'Çok fazla hatalı deneme yapıldı. 15 dakika sonra tekrar deneyin.'
      using errcode = '53400';
  end if;

  if p_kod is null or length(btrim(p_kod)) = 0 then
    raise exception 'Kod boş olamaz.' using errcode = '22023';
  end if;

  p_kod := btrim(p_kod);

  if public._kod_kilitli_mi(p_kod) then
    raise exception 'Bu kod için çok fazla hatalı deneme yapıldı. 15 dakika sonra tekrar deneyin.'
      using errcode = '53400';
  end if;

  if not exists (select 1 from public.ogretmenler where pin_hash is not null and aktif) then
    return jsonb_build_object('rol', 'kurulum');
  end if;

  for g in select id, pin_hash from public.ogretmenler where pin_hash is not null and aktif loop
    if crypt(p_kod, g.pin_hash) = g.pin_hash then
      perform public._deneme_kaydet(kimlik, p_kod, true);
      token := public._oturum_ac('ogretmen', null, g.id);
      return jsonb_build_object('rol', 'ogretmen', 'token', token);
    end if;
  end loop;

  select gk.rol, gk.ogrenci_id into kayit
  from public.giris_kodlari gk
  join public.ogrenciler o on o.id = gk.ogrenci_id
  where gk.kod = upper(p_kod) and o.aktif;

  if not found then
    perform public._deneme_kaydet(kimlik, p_kod, false);
    return jsonb_build_object('rol', 'yok');
  end if;

  perform public._deneme_kaydet(kimlik, p_kod, true);
  token := public._oturum_ac(kayit.rol, kayit.ogrenci_id, null);

  select o.id, o.ad, o.tur, s.ad as sinif into ogr
  from public.ogrenciler o
  left join public.siniflar s on s.id = o.sinif_id
  where o.id = kayit.ogrenci_id;

  return jsonb_build_object(
    'rol', kayit.rol,
    'token', token,
    'ogrenci', jsonb_build_object(
      'id', ogr.id, 'ad', ogr.ad, 'tur', ogr.tur, 'sinif', ogr.sinif
    )
  );
end;
$function$;

create or replace function public.pin_ayarla(p_yeni text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id  uuid;
  token text;
begin
  if exists (select 1 from public.ogretmenler where pin_hash is not null) then
    raise exception 'PIN zaten belirlenmiş. Değiştirmek için mevcut PIN ile giriş yapın.'
      using errcode = '42501';
  end if;

  if p_yeni is null or length(p_yeni) < 6 then
    raise exception 'PIN en az 6 haneli olmalı.' using errcode = '22023';
  end if;

  select id into v_id from public.ogretmenler where yonetici order by created_at limit 1;

  if v_id is null then
    insert into public.ogretmenler (ad, yonetici, aktif)
    values ('Öğretmen', true, true)
    returning id into v_id;
  end if;

  update public.ogretmenler
     set pin_hash = crypt(p_yeni, gen_salt('bf', 10))
   where id = v_id;

  perform public._denetim('pin_ayarlandi', 'ogretmenler', v_id, public._aktor(v_id));

  token := public._oturum_ac('ogretmen', null, v_id);
  return jsonb_build_object('rol', 'ogretmen', 'token', token);
end;
$$;

create or replace function public.pin_degistir(p_token text, p_eski text, p_yeni text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id   uuid;
  mevcut text;
begin
  v_id := public._ogretmen(p_token);

  select pin_hash into mevcut from public.ogretmenler where id = v_id;

  if mevcut is null or crypt(p_eski, mevcut) <> mevcut then
    raise exception 'Mevcut PIN doğru değil.' using errcode = '28000';
  end if;

  if p_yeni is null or length(p_yeni) < 6 then
    raise exception 'Yeni PIN en az 6 haneli olmalı.' using errcode = '22023';
  end if;

  update public.ogretmenler
     set pin_hash = crypt(p_yeni, gen_salt('bf', 10))
   where id = v_id;

  update public.oturumlar set iptal = true
   where rol = 'ogretmen'
     and ogretmen_id = v_id
     and token_hash <> public._token_hash(p_token);

  perform public._denetim('pin_degistirildi', 'ogretmenler', v_id, public._aktor(v_id));

  return jsonb_build_object('durum', 'tamam');
end;
$$;

revoke all on function public._aktor(uuid, uuid)        from public, anon, authenticated;
revoke all on function public._oturum(text)             from public, anon, authenticated;
revoke all on function public._ogretmen(text)           from public, anon, authenticated;
revoke all on function public._yonetici(text)           from public, anon, authenticated;
revoke all on function public._oturum_ac(text, uuid, uuid, interval, uuid) from public, anon, authenticated;

revoke all on function public.giris(text)                       from public, anon, authenticated;
revoke all on function public.pin_ayarla(text)                  from public, anon, authenticated;
revoke all on function public.pin_degistir(text, text, text)    from public, anon, authenticated;
grant execute on function public.giris(text)                    to anon;
grant execute on function public.pin_ayarla(text)               to anon;
grant execute on function public.pin_degistir(text, text, text) to anon;

alter table public.ogrenciler add column if not exists ekleyen_id uuid references public.ogretmenler(id) on delete restrict;

update public.ogrenciler set ekleyen_id = (select id from public.ogretmenler where yonetici limit 1) where ekleyen_id is null;

do $$
begin
  if exists (select 1 from public.ogrenciler where ekleyen_id is null) then
    raise exception '0033: sahipsiz öğrenci kaldı.';
  end if;
end $$;

alter table public.ogrenciler alter column ekleyen_id set not null;
create index if not exists ogrenciler_ekleyen_idx on public.ogrenciler (ekleyen_id);

create or replace function public._ogretmenin_ogrencisi(p_ogretmen_id uuid, p_ogrenci_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select coalesce((
    select case
      when o.tur = 'ozel' then exists (
        select 1 from public.ogretmenler g
        where g.id = p_ogretmen_id and g.yonetici
      )
      else exists (
        select 1 from public.ogretmen_siniflari os
        where os.ogretmen_id = p_ogretmen_id and os.sinif_id = o.sinif_id
      )
    end
    from public.ogrenciler o where o.id = p_ogrenci_id
  ), false);
$$;

create or replace function public._ogretmenin_sinifi(p_ogretmen_id uuid, p_sinif_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.ogretmen_siniflari os
    where os.ogretmen_id = p_ogretmen_id and os.sinif_id = p_sinif_id
  );
$$;

create or replace function public._odev_sahibi(p_ogretmen_id uuid, p_odev_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not exists (
    select 1 from public.odevler d
    where d.id = p_odev_id and d.ogretmen_id = p_ogretmen_id
  ) then
    raise exception 'Bu ödev size ait değil.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public._ogrenci_sahibi(p_ogretmen_id uuid, p_ogrenci_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not public._ogretmenin_ogrencisi(p_ogretmen_id, p_ogrenci_id) then
    raise exception 'Bu öğrenci sizin sınıflarınızda değil.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public._ogrencinin_ogretmeni(p_ogrenci_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ids uuid[];
begin
  select array_agg(g.id) into v_ids
  from public.ogretmenler g
  where g.aktif and public._ogretmenin_ogrencisi(g.id, p_ogrenci_id);

  if v_ids is null or array_length(v_ids, 1) = 0 then
    raise exception 'Öğretmeniniz tanımlı değil. Lütfen öğretmeninizle iletişime geçin.'
      using errcode = '22023';
  end if;

  if array_length(v_ids, 1) > 1 then
    raise exception 'Birden çok öğretmeniniz var; mesajın kime gideceği henüz seçilemiyor.'
      using errcode = '22023';
  end if;

  return v_ids[1];
end;
$$;

revoke all on function public._ogretmenin_ogrencisi(uuid, uuid) from public, anon, authenticated;
revoke all on function public._ogretmenin_sinifi(uuid, uuid)    from public, anon, authenticated;
revoke all on function public._odev_sahibi(uuid, uuid)          from public, anon, authenticated;
revoke all on function public._ogrenci_sahibi(uuid, uuid)       from public, anon, authenticated;
revoke all on function public._ogrencinin_ogretmeni(uuid)       from public, anon, authenticated;

create or replace function public.ders_ekle(
  p_token text, p_ogrenci uuid, p_zaman timestamptz,
  p_mod text default 'yuzyuze', p_link text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare yeni uuid; v_id uuid;
begin
  v_id := public._yonetici(p_token);
  perform public._ozel_ders_ogrencisi(p_ogrenci);
  insert into public.dersler (ogrenci_id, zaman, mod, link, ogretmen_id)
  values (p_ogrenci, p_zaman, p_mod, nullif(btrim(coalesce(p_link, '')), ''), v_id)
  returning id into yeni;
  return jsonb_build_object('id', yeni);
end;
$$;

create or replace function public.ders_sil(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare v_id uuid;
begin
  v_id := public._yonetici(p_token);
  if not exists (select 1 from public.dersler where id = p_id and ogretmen_id = v_id) then
    raise exception 'Bu ders size ait değil.' using errcode = '42501';
  end if;
  delete from public.dersler where id = p_id and ogretmen_id = v_id;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

create or replace function public.odeme_ekle(
  p_token text, p_ogrenci uuid, p_tutar numeric, p_tarih date
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare yeni uuid; v_id uuid;
begin
  v_id := public._yonetici(p_token);
  perform public._ozel_ders_ogrencisi(p_ogrenci);
  insert into public.odemeler (ogrenci_id, tutar, tarih, ogretmen_id)
  values (p_ogrenci, p_tutar, p_tarih, v_id) returning id into yeni;
  perform public._denetim('odeme_eklendi', 'odemeler', yeni, public._aktor(v_id));
  return jsonb_build_object('id', yeni);
end;
$$;

create or replace function public.odeme_degistir(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare v_id uuid;
begin
  v_id := public._yonetici(p_token);
  if not exists (select 1 from public.odemeler where id = p_id and ogretmen_id = v_id) then
    raise exception 'Bu ödeme kaydı size ait değil.' using errcode = '42501';
  end if;
  update public.odemeler set odendi = not odendi where id = p_id and ogretmen_id = v_id;
  perform public._denetim('odeme_durumu_degisti', 'odemeler', p_id, public._aktor(v_id));
  return jsonb_build_object('durum', 'tamam');
end;
$$;

create or replace function public.odeme_sil(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare eski public.odemeler; v_id uuid;
begin
  v_id := public._yonetici(p_token);
  select * into eski from public.odemeler where id = p_id and ogretmen_id = v_id;
  if eski.id is null then
    raise exception 'Bu ödeme kaydı size ait değil.' using errcode = '42501';
  end if;
  perform public._denetim('odeme_silindi', 'odemeler', p_id, public._aktor(v_id), to_jsonb(eski));
  delete from public.odemeler where id = p_id and ogretmen_id = v_id;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

create or replace function public.ogrenci_ekle(
  p_token text,
  p_ad text,
  p_tur text,
  p_sinif_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  yeni_id uuid;
  v_sinif uuid := p_sinif_id;
  v_id uuid;
  kod_ogrenci text;
  kod_veli text;
begin
  v_id := public._yonetici(p_token);

  if v_sinif is null and p_tur = 'ozel' then
    select id into v_sinif from public.siniflar where ozel;
  end if;

  if p_tur = 'okul' and v_sinif is null then
    raise exception 'Okul öğrencisi için sınıf seçilmeli.' using errcode = '22023';
  end if;

  insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id)
  values (btrim(p_ad), p_tur, v_sinif, v_id)
  returning id into yeni_id;

  kod_ogrenci := public._yeni_kod();
  kod_veli    := public._yeni_kod();

  insert into public.giris_kodlari (kod, ogrenci_id, rol)
  values (kod_ogrenci, yeni_id, 'ogrenci'), (kod_veli, yeni_id, 'veli');

  perform public._denetim('ogrenci_eklendi', 'ogrenciler', yeni_id, public._aktor(v_id));

  return jsonb_build_object(
    'id', yeni_id, 'ogrenci_kodu', kod_ogrenci, 'veli_kodu', kod_veli
  );
end;
$$;

create or replace function public.ogrenci_kodlari(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  sonuc jsonb;
  v_id uuid;
begin
  v_id := public._ogretmen(p_token);
  perform public._ogrenci_sahibi(v_id, p_id);
  select jsonb_object_agg(rol, kod) into sonuc
  from public.giris_kodlari where ogrenci_id = p_id;
  return coalesce(sonuc, '{}'::jsonb);
end;
$$;

create or replace function public.ogrenci_pasiflestir(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_tur text;
  v_id uuid;
begin
  v_id := public._yonetici(p_token);

  select tur into v_tur from public.ogrenciler where id = p_id;
  if not found then
    raise exception 'Öğrenci bulunamadı.' using errcode = 'P0002';
  end if;

  update public.ogrenciler set aktif = false where id = p_id;
  delete from public.giris_kodlari where ogrenci_id = p_id;
  update public.oturumlar set iptal = true where ogrenci_id = p_id;

  perform public._denetim('ogrenci_pasiflestirildi', 'ogrenciler', p_id, public._aktor(v_id));
  return jsonb_build_object('durum', 'tamam');
end;
$$;

create or replace function public.sinif_ekle(p_token text, p_seviye smallint, p_sube text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  yeni public.siniflar;
  v_id uuid;
begin
  v_id := public._yonetici(p_token);

  insert into public.siniflar (seviye, sube)
  values (p_seviye, upper(btrim(p_sube)))
  on conflict (seviye, sube) do update set arsiv = false
  returning * into yeni;

  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
  values (v_id, yeni.id) on conflict do nothing;

  perform public._denetim('sinif_eklendi', 'siniflar', yeni.id, public._aktor(v_id),
                          null, to_jsonb(yeni));
  return jsonb_build_object('id', yeni.id, 'ad', yeni.ad);
end;
$$;

create or replace function public.sinif_arsivle(p_token text, p_id uuid, p_arsiv boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ozel boolean;
  v_id uuid;
begin
  v_id := public._yonetici(p_token);

  select ozel into v_ozel from public.siniflar where id = p_id;
  if not found then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;

  if v_ozel and p_arsiv then
    raise exception 'Özel ders grubu arşivlenemez. Arşivlenirse özel ders '
                    'öğrencilerinize ödev veremezsiniz.'
      using errcode = '22023';
  end if;

  update public.siniflar set arsiv = p_arsiv where id = p_id;
  perform public._denetim(
    case when p_arsiv then 'sinif_arsivlendi' else 'sinif_geri_alindi' end,
    'siniflar', p_id, public._aktor(v_id));
  return jsonb_build_object('durum', 'tamam');
end;
$$;

create or replace function public.odev_olustur(
  p_token text,
  p_baslik text,
  p_aciklama text,
  p_sinif_id uuid,
  p_tur text,
  p_son_tarih date,
  p_soru_sayisi integer default null,
  p_cevap_anahtari jsonb default null,
  p_anahtar_yolu text default null,
  p_odev_yolu text default null,
  p_gec_teslim boolean default true,
  p_sik_sayisi smallint default 5,
  p_konular jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  yeni_id uuid;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  if not public._ogretmenin_sinifi(v_ogretmen, p_sinif_id) then
    raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
  end if;

  insert into public.odevler
    (baslik, aciklama, sinif_id, tur, son_tarih, soru_sayisi,
     cevap_anahtari, anahtar_url, odev_url, gec_teslim, sik_sayisi, konular, yayinda,
     ogretmen_id)
  values
    (btrim(p_baslik), nullif(btrim(coalesce(p_aciklama, '')), ''), p_sinif_id,
     p_tur, p_son_tarih, p_soru_sayisi, p_cevap_anahtari,
     nullif(btrim(coalesce(p_anahtar_yolu, '')), ''),
     nullif(btrim(coalesce(p_odev_yolu, '')), ''),
     coalesce(p_gec_teslim, true),
     case when coalesce(p_sik_sayisi, 5) = 4 then 4 else 5 end,
     public._konu_temizle(p_konular, p_soru_sayisi),
     false,  -- Taslak olarak başlar; öğretmen onaylamadan öğrenciye düşmez.
     v_ogretmen)
  returning id into yeni_id;

  perform public._denetim('odev_olusturuldu', 'odevler', yeni_id, public._aktor(v_ogretmen));
  return jsonb_build_object('id', yeni_id, 'yayinda', false);
end;
$$;
create or replace function public.odev_sil(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o public.odevler;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  perform public._odev_sahibi(v_ogretmen, p_id);
  select * into o from public.odevler where id = p_id;
  perform public._denetim('odev_silindi', 'odevler', p_id, public._aktor(v_ogretmen), to_jsonb(o));
  delete from public.odevler where id = p_id;
  return jsonb_build_object('durum', 'tamam');
end;
$$;
create or replace function public.odev_yayinla(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o public.odevler;
  eksik integer;
  i integer;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  perform public._odev_sahibi(v_ogretmen, p_id);
  select * into o from public.odevler where id = p_id;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  if o.tur = 'test' then
    eksik := 0;
    for i in 1..o.soru_sayisi loop
      if coalesce(o.cevap_anahtari ->> i::text, '') = '' then
        eksik := eksik + 1;
      end if;
    end loop;
    if eksik > 0 then
      raise exception 'Cevap anahtarında % soru eksik. Yayınlamadan önce tamamlayın.', eksik
        using errcode = '22023';
    end if;
  end if;

  update public.odevler set yayinda = true where id = p_id;
  perform public._denetim('odev_yayinlandi', 'odevler', p_id, public._aktor(v_ogretmen));
  return jsonb_build_object('durum', 'tamam');
end;
$$;
create or replace function public.odev_dosya_yolu(
  p_token text,
  p_id uuid,
  p_tur text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_yol text;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  perform public._odev_sahibi(v_ogretmen, p_id);

  if p_tur not in ('odev', 'anahtar') then
    raise exception 'Geçersiz dosya türü.' using errcode = '22023';
  end if;

  select case when p_tur = 'odev' then d.odev_url else d.anahtar_url end
    into v_yol
  from public.odevler d
  where d.id = p_id;

  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  return jsonb_build_object('yol', v_yol);
end;
$$;
create or replace function public.gonderim_foto_yolu(p_token text, p_gonderim uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_yol text;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);

  select g.foto_yolu into v_yol
  from public.gonderimler g
  join public.odevler d on d.id = g.odev_id
  where g.id = p_gonderim and d.ogretmen_id = v_ogretmen;

  if not found then
    raise exception 'Gönderim bulunamadı.' using errcode = 'P0002';
  end if;

  return jsonb_build_object('yol', v_yol);
end;
$$;
create or replace function public.acik_puanla(
  p_token text,
  p_gonderim uuid,
  p_puan numeric,
  p_yorum text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  eski public.gonderimler;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);

  select g.* into eski from public.gonderimler g
  join public.odevler d on d.id = g.odev_id
  where g.id = p_gonderim and d.ogretmen_id = v_ogretmen;
  if not found then
    raise exception 'Gönderim bulunamadı.' using errcode = 'P0002';
  end if;

  if p_puan < 0 or p_puan > 100 then
    raise exception 'Puan 0 ile 100 arasında olmalı.' using errcode = '22023';
  end if;

  update public.gonderimler
     set ogretmen_puan = p_puan,
         ogretmen_yorum = nullif(btrim(coalesce(p_yorum, '')), ''),
         durum = 'onaylandi'
   where id = p_gonderim;

  perform public._denetim(
    'acik_uclu_puanlandi', 'gonderimler', p_gonderim, public._aktor(v_ogretmen),
    jsonb_build_object('ogretmen_puan', eski.ogretmen_puan, 'durum', eski.durum),
    jsonb_build_object('ogretmen_puan', p_puan, 'durum', 'onaylandi'));

  return jsonb_build_object('durum', 'tamam');
end;
$$;

create or replace function public.siniflar_listesi(p_token text, p_arsiv boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id, 'ad', s.ad, 'seviye', s.seviye,
             'sube', s.sube, 'ozel', s.ozel, 'arsiv', s.arsiv,
             'ogrenci_sayisi', (select count(*) from public.ogrenciler o
                                 where o.sinif_id = s.id and o.aktif)
           ) order by s.seviye, s.sube)
    from public.siniflar s
    where (p_arsiv or not s.arsiv)
      and public._ogretmenin_sinifi(v_ogretmen, s.id)
  ), '[]'::jsonb);
end;
$$;
create or replace function public.konu_onerileri(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  return coalesce((
    select jsonb_agg(konu order by adet desc, konu)
    from (
      select v.value #>> '{}' as konu, count(*) as adet
      from public.odevler d
      cross join lateral jsonb_each(coalesce(d.konular, '{}'::jsonb)) v
      where d.ogretmen_id = v_ogretmen and btrim(v.value #>> '{}') <> ''
      group by v.value #>> '{}'
      limit 100
    ) t
  ), '[]'::jsonb);
end;
$$;
create or replace function public.ogrenciler_listesi(
  p_token text,
  p_arama text default null,
  p_sinif_id uuid default null,
  p_sayfa integer default 1,
  p_boyut integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  toplam integer;
  satirlar jsonb;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  p_boyut := least(greatest(coalesce(p_boyut, 25), 1), 100);
  p_sayfa := greatest(coalesce(p_sayfa, 1), 1);

  select count(*) into toplam
  from public.ogrenciler o
  where o.aktif
    and public._ogretmenin_ogrencisi(v_ogretmen, o.id)
    and not public._sinif_arsivde(o.sinif_id)
    and (p_sinif_id is null or o.sinif_id = p_sinif_id)
    and (p_arama is null or o.ad ilike '%' || p_arama || '%');

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', o.id, 'ad', o.ad, 'tur', o.tur, 'sinif', s.ad
         ) order by o.ad), '[]'::jsonb) into satirlar
  from (
    select o.* from public.ogrenciler o
    where o.aktif
      and public._ogretmenin_ogrencisi(v_ogretmen, o.id)
      and not public._sinif_arsivde(o.sinif_id)
      and (p_sinif_id is null or o.sinif_id = p_sinif_id)
      and (p_arama is null or o.ad ilike '%' || p_arama || '%')
    order by o.ad
    limit p_boyut offset (p_sayfa - 1) * p_boyut
  ) o
  left join public.siniflar s on s.id = o.sinif_id;

  return jsonb_build_object(
    'toplam', toplam,
    'sayfa', p_sayfa,
    'toplam_sayfa', greatest(ceil(toplam::numeric / p_boyut)::int, 1),
    'kayitlar', satirlar
  );
end;
$$;

create or replace function public.mesajlar_ogretmen(
  p_token text, p_ogrenci_id uuid, p_kanal text default 'veli'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  ogr record;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);

  if coalesce(p_kanal, '') not in ('veli', 'ogrenci') then
    raise exception 'Yazışma ''veli'' ya da ''ogrenci'' olmalı.' using errcode = '22023';
  end if;

  select o.id, o.ad, o.tur, s.ad as sinif into ogr
  from public.ogrenciler o
  left join public.siniflar s on s.id = o.sinif_id
  where o.id = p_ogrenci_id;

  if not found then
    raise exception 'Öğrenci bulunamadı.' using errcode = 'P0002';
  end if;

  perform public._ogrenci_sahibi(v_ogretmen, p_ogrenci_id);

  return jsonb_build_object(
    'ogrenci', jsonb_build_object('id', ogr.id, 'ad', ogr.ad, 'sinif', ogr.sinif),
    'kanal', p_kanal,
    'veli_kodu_var', exists (select 1 from public.giris_kodlari k
                              where k.ogrenci_id = ogr.id
                                and k.rol = case when p_kanal = 'ogrenci'
                                                 then 'ogrenci' else 'veli' end),
    'mesajlar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kimden', m.kimden, 'metin', m.metin, 'zaman', m.created_at)
             order by m.created_at)
      from public.mesajlar m
      where m.ogrenci_id = p_ogrenci_id and m.kanal = p_kanal
        and m.ogretmen_id = v_ogretmen
    ), '[]'::jsonb)
  );
end;
$$;
create or replace function public.ogretmen_okudu(
  p_token text, p_ogrenci_id uuid, p_kanal text default 'veli'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);

  if coalesce(p_kanal, '') not in ('veli', 'ogrenci') then
    raise exception 'Yazışma ''veli'' ya da ''ogrenci'' olmalı.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.ogrenciler where id = p_ogrenci_id) then
    raise exception 'Öğrenci bulunamadı.' using errcode = 'P0002';
  end if;

  perform public._ogrenci_sahibi(v_ogretmen, p_ogrenci_id);

  insert into public.okundu (ogrenci_id, rol, kanal, ogretmen_id, zaman)
  values (p_ogrenci_id, 'ogretmen', p_kanal, v_ogretmen, now())
  on conflict (ogrenci_id, rol, kanal, ogretmen_id) do update set zaman = now();

  return jsonb_build_object('durum', 'tamam');
end;
$$;
create or replace function public.okundu_isaretle(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  v_kanal text;   -- `kanal` DEĞİL: sütunla çakışıp belirsizlik hatası verir
begin
  select * into o from public._oturum(p_token);
  if o.ogrenci_id is null then
    raise exception 'Geçersiz oturum.' using errcode = '42501';
  end if;

  v_kanal := case when o.rol = 'ogrenci' then 'ogrenci' else 'veli' end;

  insert into public.okundu (ogrenci_id, rol, kanal, ogretmen_id, zaman)
  values (o.ogrenci_id, o.rol, v_kanal, public._ogrencinin_ogretmeni(o.ogrenci_id), now())
  on conflict (ogrenci_id, rol, kanal, ogretmen_id) do update set zaman = now();

  return jsonb_build_object('durum', 'tamam');
end;
$$;
create or replace function public.veliler_listesi(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  sonuc jsonb;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);

  with ozet as (
    select o.id as ogrenci_id, o.ad, o.tur, o.sinif_id,
           s.ad as sinif, s.ozel, s.seviye, s.sube,
           (select max(m.created_at) from public.mesajlar m
             where m.ogrenci_id = o.id and m.kanal = 'veli'
               and m.ogretmen_id = v_ogretmen) as son_mesaj,
           (select count(*)::integer from public.mesajlar m
             where m.ogrenci_id = o.id and m.kimden = 'veli' and m.kanal = 'veli'
               and m.ogretmen_id = v_ogretmen
               and m.created_at > coalesce(
                     (select k.zaman from public.okundu k
                       where k.ogrenci_id = o.id and k.rol = 'ogretmen'
                         and k.kanal = 'veli'
                         and k.ogretmen_id = v_ogretmen),
                     '-infinity'::timestamptz)) as okunmamis
    from public.ogrenciler o
    join public.siniflar s on s.id = o.sinif_id
    where o.aktif and not s.arsiv
      and public._ogretmenin_ogrencisi(v_ogretmen, o.id)
  )
  select jsonb_build_object(
    'toplam_okunmamis', (select coalesce(sum(okunmamis), 0)::integer from ozet),
    'yanit_bekleyen', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ogrenci_id', ogrenci_id, 'ad', ad, 'sinif', sinif,
               'okunmamis', okunmamis, 'son_mesaj', son_mesaj)
             order by son_mesaj)
      from ozet where okunmamis > 0
    ), '[]'::jsonb),
    'gruplar', coalesce((
      select jsonb_agg(g order by g_seviye, g_sube) from (
        select seviye as g_seviye, sube as g_sube,
               jsonb_build_object(
                 'sinif_id', sinif_id, 'sinif', sinif, 'ozel', ozel,
                 'veli_sayisi', count(*)::integer,
                 'okunmamis', coalesce(sum(okunmamis), 0)::integer
               ) as g
        from ozet
        group by sinif_id, sinif, ozel, seviye, sube
      ) t
    ), '[]'::jsonb)
  ) into sonuc;

  return sonuc;
end;
$$;
create or replace function public.ogrenci_yazismalari(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  sonuc jsonb;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);

  with ozet as (
    select o.id as ogrenci_id, o.ad, s.ad as sinif,
           (select max(m.created_at) from public.mesajlar m
             where m.ogrenci_id = o.id and m.kanal = 'ogrenci'
               and m.ogretmen_id = v_ogretmen) as son_mesaj,
           (select count(*)::integer from public.mesajlar m
             where m.ogrenci_id = o.id and m.kimden = 'ogrenci' and m.kanal = 'ogrenci'
               and m.ogretmen_id = v_ogretmen
               and m.created_at > coalesce(
                     (select k.zaman from public.okundu k
                       where k.ogrenci_id = o.id and k.rol = 'ogretmen'
                         and k.kanal = 'ogrenci'
                         and k.ogretmen_id = v_ogretmen),
                     '-infinity'::timestamptz)) as okunmamis
    from public.ogrenciler o
    join public.siniflar s on s.id = o.sinif_id
    where o.aktif and not s.arsiv
      and public._ogretmenin_ogrencisi(v_ogretmen, o.id)
  )
  select jsonb_build_object(
    'toplam_okunmamis', (select coalesce(sum(okunmamis), 0)::integer from ozet),
    'yanit_bekleyen', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ogrenci_id', ogrenci_id, 'ad', ad, 'sinif', sinif,
               'okunmamis', okunmamis, 'son_mesaj', son_mesaj)
             order by son_mesaj)
      from ozet where okunmamis > 0
    ), '[]'::jsonb)
  ) into sonuc;

  return sonuc;
end;
$$;
create or replace function public.bildirim_sayilari(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);

  return jsonb_build_object(
    'okunmamis_mesaj', (
      select count(*)::integer
      from public.mesajlar m
      join public.ogrenciler o on o.id = m.ogrenci_id
      join public.siniflar  s on s.id = o.sinif_id
      where m.kimden in ('veli', 'ogrenci')
        and m.ogretmen_id = v_ogretmen
        and o.aktif
        and not s.arsiv
        and m.created_at > coalesce(
              (select k.zaman from public.okundu k
                where k.ogrenci_id = o.id and k.rol = 'ogretmen'
                  and k.kanal = m.kanal
                  and k.ogretmen_id = v_ogretmen),
              '-infinity'::timestamptz)
    ),

    'puan_bekleyen', (
      select count(*)::integer
      from public.gonderimler g
      join public.odevler o on o.id = g.odev_id
      where o.tur = 'acik'
        and o.ogretmen_id = v_ogretmen
        and g.durum = 'incelemede'
        and not public._sinif_arsivde(o.sinif_id)
    )
  );
end;
$$;

create or replace function public.odevler_listesi(
  p_token text,
  p_sinif_id uuid default null,
  p_yayinda boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun_tr date := (now() at time zone 'Europe/Istanbul')::date;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', d.id,
      'baslik', d.baslik,
      'aciklama', d.aciklama,
      'tur', d.tur,
      'sinif_id', d.sinif_id,
      'sinif', s.ad,
      'sinif_ozel', s.ozel,
      'son_tarih', d.son_tarih,
      'soru_sayisi', d.soru_sayisi,
      'gec_teslim', d.gec_teslim,
      'sik_sayisi', d.sik_sayisi,
      'yayinda', d.yayinda,
      'olusturma', d.created_at,
      'kardesler', case when d.grup_id is not null then (
        select coalesce(jsonb_agg(s2.ad order by s2.seviye, s2.sube), '[]'::jsonb)
          from public.odevler d2
          join public.siniflar s2 on s2.id = d2.sinif_id
         where d2.grup_id = d.grup_id and d2.id <> d.id
      ) end,
      'odev_pdf_var', (d.odev_url is not null),
      'anahtar_pdf_var', (d.anahtar_url is not null),
      'gonderim_sayisi', (
        select count(*) from public.gonderimler g where g.odev_id = d.id
      ),
      'gec_gonderim_sayisi', (
        select count(*) from public.gonderimler g
        where g.odev_id = d.id and public._gecikmeli(g.created_at, d.son_tarih)
      ),
      'sinif_mevcudu', (
        select count(*) from public.ogrenciler o
        where o.sinif_id = d.sinif_id and o.aktif
      ),
      'ortalama_yapan', case when d.son_tarih < bugun_tr then (
        select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1)
        from public.gonderimler g
        where g.odev_id = d.id and coalesce(g.ogretmen_puan, g.puan) is not null
      ) end,
      'ortalama_tum', case when d.son_tarih < bugun_tr then (
        select round(avg(coalesce(
                 (select coalesce(g.ogretmen_puan, g.puan)
                    from public.gonderimler g
                   where g.odev_id = d.id and g.ogrenci_id = o.id), 0)), 1)
        from public.ogrenciler o
        where o.sinif_id = d.sinif_id and o.aktif
      ) end
    ) order by d.son_tarih desc, d.created_at desc)
    from public.odevler d
    join public.siniflar s on s.id = d.sinif_id
    where d.ogretmen_id = v_ogretmen
      and not s.arsiv
      and (p_sinif_id is null or d.sinif_id = p_sinif_id)
      and (p_yayinda is null or d.yayinda = p_yayinda)
  ), '[]'::jsonb);
end;
$$;
create or replace function public.ogretmen_panosu(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun date := current_date;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);

  return jsonb_build_object(
    'ogrenci_sayisi', (select count(*) from public.ogrenciler o
                        where o.aktif and not public._sinif_arsivde(o.sinif_id)
                          and public._ogretmenin_ogrencisi(v_ogretmen, o.id)),
    'odev_verilen_ogrenci', (
      select count(*)
      from public.ogrenciler o
      where o.aktif
        and not public._sinif_arsivde(o.sinif_id)
        and public._ogretmenin_ogrencisi(v_ogretmen, o.id)
        and exists (select 1 from public.odevler d
                     where d.sinif_id = o.sinif_id and d.yayinda
                       and d.ogretmen_id = v_ogretmen)
    ),
    'acik_odev', (select count(*) from public.odevler d
                   where d.yayinda and d.son_tarih >= bugun
                     and d.ogretmen_id = v_ogretmen
                     and not public._sinif_arsivde(d.sinif_id)),
    'bekleyen_degerlendirme', (select count(*) from public.gonderimler g
                                join public.odevler o on o.id = g.odev_id
                               where o.tur = 'acik' and g.durum = 'incelemede'
                                 and o.ogretmen_id = v_ogretmen
                                 and not public._sinif_arsivde(o.sinif_id)),
    'gecikmis_eksik', (
      select count(*)
      from public.odevler o
      join public.ogrenciler ogr
        on ogr.sinif_id = o.sinif_id and ogr.aktif
      where o.yayinda and o.son_tarih < bugun
        and o.ogretmen_id = v_ogretmen
        and not public._sinif_arsivde(o.sinif_id)
        and not exists (select 1 from public.gonderimler g
                         where g.odev_id = o.id and g.ogrenci_id = ogr.id)
    ),
    'son_gonderimler', coalesce((
      select jsonb_agg(x order by x->>'zaman' desc) from (
        select jsonb_build_object(
                 'ogrenci', ogr.ad, 'odev', o.baslik,
                 'puan', coalesce(g.ogretmen_puan, g.puan),
                 'zaman', g.created_at,
                 'gecikmeli', public._gecikmeli(g.created_at, o.son_tarih)
               ) as x
        from public.gonderimler g
        join public.ogrenciler ogr on ogr.id = g.ogrenci_id
        join public.odevler o on o.id = g.odev_id
        where not public._sinif_arsivde(o.sinif_id)
          and o.ogretmen_id = v_ogretmen
        order by g.created_at desc limit 10
      ) t
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.ogretmenler_listesi(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sahip uuid;
begin
  v_sahip := public._yonetici(p_token);

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', g.id,
             'ad', g.ad,
             'sahip', g.yonetici,
             'aktif', g.aktif,
             'pin_var', (g.pin_hash is not null),
             'sinif_sayisi', (select count(*) from public.ogretmen_siniflari os where os.ogretmen_id = g.id),
             'odev_sayisi',  (select count(*) from public.odevler d where d.ogretmen_id = g.id),
             'son_gorulme',  (select max(o.son_gorulme) from public.oturumlar o
                               where o.ogretmen_id = g.id and o.vekil_id is null)
           ) order by g.yonetici desc, g.ad)
    from public.ogretmenler g
  ), '[]'::jsonb);
end;
$$;

create or replace function public.ogretmen_ekle(p_token text, p_ad text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sahip uuid;
  yeni uuid;
begin
  v_sahip := public._yonetici(p_token);

  if p_ad is null or length(btrim(p_ad)) = 0 then
    raise exception 'Öğretmen adı boş olamaz.' using errcode = '22023';
  end if;
  if p_pin is null or length(p_pin) < 6 then
    raise exception 'PIN en az 6 haneli olmalı.' using errcode = '22023';
  end if;

  if exists (select 1 from public.ogretmenler g
              where g.pin_hash is not null and crypt(p_pin, g.pin_hash) = g.pin_hash) then
    raise exception 'Bu PIN başka bir öğretmende kullanılıyor. Farklı bir PIN seçin.'
      using errcode = '22023';
  end if;

  insert into public.ogretmenler (ad, pin_hash, yonetici, aktif)
  values (btrim(p_ad), crypt(p_pin, gen_salt('bf', 10)), false, true)
  returning id into yeni;

  perform public._denetim('ogretmen_eklendi', 'ogretmenler', yeni, public._aktor(v_sahip),
                          null, jsonb_build_object('ad', btrim(p_ad)));
  return jsonb_build_object('id', yeni, 'ad', btrim(p_ad));
end;
$$;

create or replace function public.ogretmen_guncelle(
  p_token text, p_id uuid, p_ad text default null, p_aktif boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sahip uuid;
  eski public.ogretmenler;
begin
  v_sahip := public._yonetici(p_token);

  select * into eski from public.ogretmenler where id = p_id;
  if not found then
    raise exception 'Öğretmen bulunamadı.' using errcode = 'P0002';
  end if;

  if eski.yonetici and p_aktif is distinct from true and p_aktif is not null then
    raise exception 'Platform sahibi sistemden çıkarılamaz.' using errcode = '42501';
  end if;

  update public.ogretmenler
     set ad    = coalesce(nullif(btrim(coalesce(p_ad, '')), ''), ad),
         aktif = coalesce(p_aktif, aktif)
   where id = p_id;

  if p_aktif is false then
    update public.oturumlar set iptal = true
     where ogretmen_id = p_id and not iptal;
  end if;

  perform public._denetim('ogretmen_guncellendi', 'ogretmenler', p_id, public._aktor(v_sahip),
                          jsonb_build_object('ad', eski.ad, 'aktif', eski.aktif),
                          jsonb_build_object('ad', coalesce(nullif(btrim(coalesce(p_ad, '')), ''), eski.ad),
                                             'aktif', coalesce(p_aktif, eski.aktif)));
  return jsonb_build_object('durum', 'tamam');
end;
$$;

create or replace function public.ogretmen_pin_sifirla(p_token text, p_id uuid, p_yeni text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sahip uuid;
begin
  v_sahip := public._yonetici(p_token);

  if p_yeni is null or length(p_yeni) < 6 then
    raise exception 'PIN en az 6 haneli olmalı.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.ogretmenler where id = p_id) then
    raise exception 'Öğretmen bulunamadı.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.ogretmenler g
              where g.id <> p_id and g.pin_hash is not null
                and crypt(p_yeni, g.pin_hash) = g.pin_hash) then
    raise exception 'Bu PIN başka bir öğretmende kullanılıyor. Farklı bir PIN seçin.'
      using errcode = '22023';
  end if;

  update public.ogretmenler set pin_hash = crypt(p_yeni, gen_salt('bf', 10)) where id = p_id;

  update public.oturumlar set iptal = true where ogretmen_id = p_id and not iptal;

  perform public._denetim('ogretmen_pin_sifirlandi', 'ogretmenler', p_id, public._aktor(v_sahip));
  return jsonb_build_object('durum', 'tamam');
end;
$$;

create or replace function public.ogretmen_sinif_ata(p_token text, p_id uuid, p_sinif_idler jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sahip uuid;
  n integer;
begin
  v_sahip := public._yonetici(p_token);

  if jsonb_typeof(p_sinif_idler) <> 'array' then
    raise exception 'Sınıf listesi bir dizi olmalı.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.ogretmenler where id = p_id) then
    raise exception 'Öğretmen bulunamadı.' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from jsonb_array_elements_text(p_sinif_idler) e
    join public.siniflar s on s.id = e::uuid
    where s.ozel
  ) then
    raise exception 'Özel ders grubu başka bir öğretmene atanamaz.' using errcode = '42501';
  end if;

  delete from public.ogretmen_siniflari where ogretmen_id = p_id;

  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
  select p_id, e::uuid from jsonb_array_elements_text(p_sinif_idler) e
  on conflict do nothing;

  select count(*) into n from public.ogretmen_siniflari where ogretmen_id = p_id;

  perform public._denetim('ogretmen_siniflari_degisti', 'ogretmenler', p_id, public._aktor(v_sahip),
                          null, jsonb_build_object('sinif_sayisi', n));
  return jsonb_build_object('sinif_sayisi', n);
end;
$$;

create or replace function public.ogretmen_olarak_gir(p_token text, p_ogretmen_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sahip uuid;
  hedef public.ogretmenler;
  token text;
begin
  v_sahip := public._yonetici(p_token);

  select * into hedef from public.ogretmenler where id = p_ogretmen_id;
  if not found then
    raise exception 'Öğretmen bulunamadı.' using errcode = 'P0002';
  end if;
  if hedef.id = v_sahip then
    raise exception 'Zaten kendi hesabınızdasınız.' using errcode = '22023';
  end if;

  token := public._oturum_ac('ogretmen', null, hedef.id, interval '8 hours', v_sahip);

  perform public._denetim('ogretmen_olarak_girildi', 'ogretmenler', hedef.id,
                          public._aktor(hedef.id, v_sahip));

  return jsonb_build_object(
    'rol', 'ogretmen', 'token', token,
    'vekalet', true, 'ogretmen', jsonb_build_object('id', hedef.id, 'ad', hedef.ad)
  );
end;
$$;

create or replace function public.ben_kimim(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  g public.ogretmenler;
  v public.ogretmenler;
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'ogretmen' then
    raise exception 'Bu işlem için öğretmen yetkisi gerekiyor.' using errcode = '42501';
  end if;

  select * into g from public.ogretmenler where id = o.ogretmen_id;
  if o.vekil_id is not null then
    select * into v from public.ogretmenler where id = o.vekil_id;
  end if;

  return jsonb_build_object(
    'id', g.id, 'ad', g.ad, 'sahip', g.yonetici,
    'vekalet', (o.vekil_id is not null),
    'vekil', case when o.vekil_id is not null
                  then jsonb_build_object('id', v.id, 'ad', v.ad) end
  );
end;
$$;

revoke all on function public.ogretmenler_listesi(text)                     from public, anon, authenticated;
revoke all on function public.ogretmen_ekle(text, text, text)               from public, anon, authenticated;
revoke all on function public.ogretmen_guncelle(text, uuid, text, boolean)  from public, anon, authenticated;
revoke all on function public.ogretmen_pin_sifirla(text, uuid, text)        from public, anon, authenticated;
revoke all on function public.ogretmen_sinif_ata(text, uuid, jsonb)         from public, anon, authenticated;
revoke all on function public.ogretmen_olarak_gir(text, uuid)               from public, anon, authenticated;
revoke all on function public.ben_kimim(text)                               from public, anon, authenticated;
grant execute on function public.ogretmenler_listesi(text)                     to anon;
grant execute on function public.ogretmen_ekle(text, text, text)               to anon;
grant execute on function public.ogretmen_guncelle(text, uuid, text, boolean)  to anon;
grant execute on function public.ogretmen_pin_sifirla(text, uuid, text)        to anon;
grant execute on function public.ogretmen_sinif_ata(text, uuid, jsonb)         to anon;
grant execute on function public.ogretmen_olarak_gir(text, uuid)               to anon;
grant execute on function public.ben_kimim(text)                               to anon;

create or replace function public.ozel_ders_detay(p_token text, p_ogrenci_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  ogr record;
begin
  perform public._yonetici(p_token);

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
create or replace function public.ewalu_mesaj_yaz(
  p_token text,
  p_bant  smallint,
  p_cumle text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  temiz text;
  eski  text;
  v_id  uuid;
begin
  v_id := public._yonetici(p_token);

  if p_bant is null or p_bant not in (0, 50, 70, 85, 100) then
    raise exception 'Geçersiz puan bandı. Bantlar: 0, 50, 70, 85, 100.'
      using errcode = '22023';
  end if;

  select e.cumle into eski from public.ewalu_mesajlari e where e.bant = p_bant;

  if p_cumle is null then
    if eski is null then
      return jsonb_build_object('bant', p_bant, 'cumle', null, 'degisti', false);
    end if;
    delete from public.ewalu_mesajlari where bant = p_bant;
    perform public._denetim('ewalu_mesaji_varsayilana_dondu', 'ewalu_mesajlari',
              null, public._aktor(v_id),
              jsonb_build_object('bant', p_bant, 'cumle', eski),
              jsonb_build_object('bant', p_bant, 'cumle', null));
    return jsonb_build_object('bant', p_bant, 'cumle', null, 'degisti', true);
  end if;

  temiz := btrim(p_cumle);

  if temiz = '' then
    raise exception 'Cümle boş olamaz. Varsayılana dönmek için "Varsayılana dön" düğmesini kullanın.'
      using errcode = '22023';
  end if;

  if length(temiz) > 400 then
    raise exception 'Cümle en fazla 400 karakter olabilir (şu an %).', length(temiz)
      using errcode = '22023';
  end if;

  insert into public.ewalu_mesajlari (bant, cumle) values (p_bant, temiz)
  on conflict (bant) do update set cumle = excluded.cumle;

  perform public._denetim('ewalu_mesaji_degisti', 'ewalu_mesajlari',
            null, public._aktor(v_id),
            jsonb_build_object('bant', p_bant, 'cumle', eski),
            jsonb_build_object('bant', p_bant, 'cumle', temiz));

  return jsonb_build_object('bant', p_bant, 'cumle', temiz, 'degisti', true);
end;
$$;
create or replace function public.sinif_ogrencileri(p_token text, p_sinif_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  s public.siniflar;
  bugun_tr date := (now() at time zone 'Europe/Istanbul')::date;
  v_odev_sayisi integer;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  if not public._ogretmenin_sinifi(v_ogretmen, p_sinif_id) then
    raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
  end if;

  select * into s from public.siniflar where id = p_sinif_id;
  if not found then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;

  select count(*) into v_odev_sayisi
  from public.odevler d
  where d.sinif_id = p_sinif_id and d.yayinda and d.son_tarih < bugun_tr
    and d.ogretmen_id = v_ogretmen;

  return jsonb_build_object(
    'sinif', jsonb_build_object(
      'id', s.id, 'ad', s.ad, 'ozel', s.ozel, 'arsiv', s.arsiv
    ),
    'degerlendirilen_odev', v_odev_sayisi,
    'ogrenciler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id,
        'ad', o.ad,
        'tur', o.tur,
        'yapti', i.yapti,
        'yapmadi', v_odev_sayisi - i.yapti,
        'ortalama_yapan', i.ortalama_yapan,
        'ortalama_tum', i.ortalama_tum
      ) order by o.ad)
      from public.ogrenciler o
      cross join lateral (
        select
          count(g.id)::integer as yapti,
          round(avg(coalesce(g.ogretmen_puan, g.puan))
                filter (where g.id is not null), 1) as ortalama_yapan,
          case when v_odev_sayisi > 0 then
            round(sum(coalesce(g.ogretmen_puan, g.puan, 0)) / v_odev_sayisi, 1)
          end as ortalama_tum
        from public.odevler d
        left join public.gonderimler g
          on g.odev_id = d.id and g.ogrenci_id = o.id
        where d.sinif_id = p_sinif_id
          and d.yayinda
          and d.son_tarih < bugun_tr
      ) i
      where o.sinif_id = p_sinif_id and o.aktif
    ), '[]'::jsonb)
  );
end;
$$;
create or replace function public.sinif_velileri(p_token text, p_sinif_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sinif record;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  if not public._ogretmenin_sinifi(v_ogretmen, p_sinif_id) then
    raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
  end if;

  select s.id, s.ad, s.ozel, s.arsiv into v_sinif
  from public.siniflar s where s.id = p_sinif_id;
  if not found then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'sinif', jsonb_build_object('id', v_sinif.id, 'ad', v_sinif.ad, 'ozel', v_sinif.ozel),
    'veliler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ogrenci_id', o.id,
               'ad', o.ad,
               'tur', o.tur,
               'veli_kodu_var', exists (select 1 from public.giris_kodlari k
                                         where k.ogrenci_id = o.id and k.rol = 'veli'),
               'mesaj_sayisi', (select count(*)::integer from public.mesajlar m
                                 where m.ogrenci_id = o.id),
               'son_mesaj', (select max(m.created_at) from public.mesajlar m
                              where m.ogrenci_id = o.id),
               'okunmamis', (select count(*)::integer from public.mesajlar m
                              where m.ogrenci_id = o.id and m.kimden = 'veli'
                                and m.created_at > coalesce(
                                      (select k.zaman from public.okundu k
                                        where k.ogrenci_id = o.id and k.rol = 'ogretmen'),
                                      '-infinity'::timestamptz))
             ) order by o.ad)
      from public.ogrenciler o
      where o.sinif_id = p_sinif_id and o.aktif
    ), '[]'::jsonb)
  );
end;
$$;
create or replace function public.odev_detay(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  d public.odevler;
  s public.siniflar;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  perform public._odev_sahibi(v_ogretmen, p_id);

  select * into d from public.odevler where id = p_id;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;
  select * into s from public.siniflar where id = d.sinif_id;

  return jsonb_build_object(
    'id', d.id,
    'baslik', d.baslik,
    'aciklama', d.aciklama,
    'tur', d.tur,
    'sinif_id', d.sinif_id,
    'sinif', s.ad,
    'son_tarih', d.son_tarih,
    'soru_sayisi', d.soru_sayisi,
    'gec_teslim', d.gec_teslim,
    'konular', coalesce(d.konular, '{}'::jsonb),
    'sik_sayisi', d.sik_sayisi,
    'cevap_anahtari', coalesce(d.cevap_anahtari, '{}'::jsonb),
    'anahtar_yolu', d.anahtar_url,
    'odev_yolu', d.odev_url,
    'yayinda', d.yayinda,
    'kardesler', case when d.grup_id is not null then (
      select coalesce(jsonb_agg(s2.ad order by s2.seviye, s2.sube), '[]'::jsonb)
        from public.odevler d2
        join public.siniflar s2 on s2.id = d2.sinif_id
       where d2.grup_id = d.grup_id and d2.id <> d.id
    ) end,
    'kardes_detay', case when d.grup_id is not null then (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', d2.id,
               'sinif', s2.ad,
               'gonderim_sayisi', (select count(*) from public.gonderimler g
                                    where g.odev_id = d2.id),
               'anahtar_ayni', (d2.cevap_anahtari is not distinct from d.cevap_anahtari),
               'arsiv', public._sinif_arsivde(d2.sinif_id)
             ) order by s2.seviye, s2.sube), '[]'::jsonb)
        from public.odevler d2
        join public.siniflar s2 on s2.id = d2.sinif_id
       where d2.grup_id = d.grup_id and d2.id <> d.id
    ) end,
    'gonderim_sayisi', (select count(*) from public.gonderimler g where g.odev_id = d.id),
    'gec_gonderim_sayisi', (
      select count(*) from public.gonderimler g
      where g.odev_id = d.id and public._gecikmeli(g.created_at, d.son_tarih)
    )
  );
end;
$$;
create or replace function public.odev_gonderimleri(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  d public.odevler;
  s public.siniflar;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  perform public._odev_sahibi(v_ogretmen, p_id);

  select * into d from public.odevler where id = p_id;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;
  select * into s from public.siniflar where id = d.sinif_id;

  return jsonb_build_object(
    'odev', jsonb_build_object(
      'id', d.id,
      'baslik', d.baslik,
      'tur', d.tur,
      'sinif', s.ad,
      'son_tarih', d.son_tarih,
      'soru_sayisi', d.soru_sayisi,
      'gec_teslim', d.gec_teslim,
      'yayinda', d.yayinda
    ),
    'ozet', jsonb_build_object(
      'mevcut', (select count(*) from public.ogrenciler o
                  where o.sinif_id = d.sinif_id and o.aktif),
      'gonderen', (select count(*) from public.gonderimler g
                    where g.odev_id = d.id),
      'gecikmeli', (select count(*) from public.gonderimler g
                     where g.odev_id = d.id
                       and public._gecikmeli(g.created_at, d.son_tarih)),
      'puan_bekleyen', (select count(*) from public.gonderimler g
                         where g.odev_id = d.id and g.durum = 'incelemede')
    ),
    'konu_ozeti', coalesce((
      select jsonb_agg(jsonb_build_object(
               'konu', t.konu, 'toplam', t.toplam,
               'dogru', t.dogru, 'yanlis', t.yanlis, 'bos', t.bos)
             order by (t.toplam - t.dogru) desc, t.konu)
      from (
        select e->>'konu' as konu,
               sum((e->>'toplam')::integer)::integer as toplam,
               sum((e->>'dogru')::integer)::integer  as dogru,
               sum((e->>'yanlis')::integer)::integer as yanlis,
               sum((e->>'bos')::integer)::integer    as bos
        from public.gonderimler g
        cross join lateral jsonb_array_elements(
          public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
        ) e
        where g.odev_id = d.id
        group by e->>'konu'
      ) t
    ), '[]'::jsonb),
    'satirlar', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ogrenci_id', o.id,
        'ogrenci', o.ad,
        'gonderim_id', g.id,
        'gonderdi', (g.id is not null),
        'zaman', g.created_at,
        'gecikmeli', case when g.id is null then false
                     else public._gecikmeli(g.created_at, d.son_tarih) end,
        'durum', g.durum,
        'dogru', g.dogru,
        'yanlis', g.yanlis,
        'bos', g.bos,
        'puan', g.puan,
        'ogretmen_puan', g.ogretmen_puan,
        'ogretmen_yorum', g.ogretmen_yorum,
        'yanlis_sorular', case when g.id is not null and d.tur = 'test'
          then public._soru_dokumu(d.cevap_anahtari, g.cevaplar, d.soru_sayisi) -> 'yanlis'
          else '[]'::jsonb end,
        'bos_sorular', case when g.id is not null and d.tur = 'test'
          then public._soru_dokumu(d.cevap_anahtari, g.cevaplar, d.soru_sayisi) -> 'bos'
          else '[]'::jsonb end,
        'foto_var', (g.foto_yolu is not null)
      ) order by o.ad)
      from public.ogrenciler o
      left join public.gonderimler g
        on g.odev_id = d.id and g.ogrenci_id = o.id
      where o.sinif_id = d.sinif_id and o.aktif
    ), '[]'::jsonb)
  );
end;
$$;
create or replace function public.odev_guncelle(
  p_token text,
  p_id uuid,
  p_baslik text,
  p_aciklama text,
  p_sinif_id uuid,
  p_son_tarih date,
  p_soru_sayisi integer default null,
  p_cevap_anahtari jsonb default null,
  p_anahtar_yolu text default null,
  p_odev_yolu text default null,
  p_gec_teslim boolean default null,
  p_sik_sayisi smallint default null,
  p_konular jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  d           public.odevler;
  yeni_sayi   integer;
  yeni_anahtar jsonb;
  anahtar_degisti boolean;
  g           record;
  yeni        record;
  rapor       jsonb := '[]'::jsonb;
  v_ogretmen  uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  perform public._odev_sahibi(v_ogretmen, p_id);

  select * into d from public.odevler where id = p_id;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  if p_baslik is null or btrim(p_baslik) = '' then
    raise exception 'Başlık boş olamaz.' using errcode = '22023';
  end if;
  if p_sinif_id is null or p_son_tarih is null then
    raise exception 'Sınıf ve son tarih zorunludur.' using errcode = '22023';
  end if;

  if d.tur = 'test' then
    yeni_sayi := coalesce(p_soru_sayisi, d.soru_sayisi);
    if yeni_sayi is null or yeni_sayi < 1 or yeni_sayi > 200 then
      raise exception 'Soru sayısı 1 ile 200 arasında olmalı.' using errcode = '22023';
    end if;

    yeni_anahtar := coalesce(p_cevap_anahtari, d.cevap_anahtari, '{}'::jsonb);
    select coalesce(jsonb_object_agg(k, yeni_anahtar -> k), '{}'::jsonb)
      into yeni_anahtar
    from jsonb_object_keys(yeni_anahtar) k
    where (k ~ '^\d+$') and k::integer between 1 and yeni_sayi;

    anahtar_degisti := (yeni_anahtar is distinct from coalesce(d.cevap_anahtari, '{}'::jsonb))
                       or (yeni_sayi is distinct from d.soru_sayisi);
  else
    yeni_sayi := null;
    yeni_anahtar := null;
    anahtar_degisti := false;
  end if;

  update public.odevler
     set baslik      = btrim(p_baslik),
         aciklama    = nullif(btrim(coalesce(p_aciklama, '')), ''),
         sinif_id    = p_sinif_id,
         son_tarih   = p_son_tarih,
         soru_sayisi = yeni_sayi,
         cevap_anahtari = yeni_anahtar,
         anahtar_url = nullif(btrim(coalesce(p_anahtar_yolu, '')), ''),
         odev_url    = nullif(btrim(coalesce(p_odev_yolu, '')), ''),
         gec_teslim  = coalesce(p_gec_teslim, d.gec_teslim),
         sik_sayisi  = case when p_sik_sayisi = 4 then 4
                            when p_sik_sayisi = 5 then 5
                            else d.sik_sayisi end,
         konular     = public._konu_temizle(coalesce(p_konular, d.konular), yeni_sayi)
   where id = p_id;

  perform public._denetim('odev_guncellendi', 'odevler', p_id, public._aktor(v_ogretmen),
                          to_jsonb(d), (select to_jsonb(o) from public.odevler o where o.id = p_id));

  if anahtar_degisti then
    for g in
      select gn.id, gn.ogrenci_id, gn.cevaplar, gn.puan, gn.dogru, gn.yanlis, gn.bos,
             o.ad as ogrenci_ad
      from public.gonderimler gn
      join public.ogrenciler o on o.id = gn.ogrenci_id
      where gn.odev_id = p_id
    loop
      select * into yeni
      from public._puanla(yeni_anahtar, coalesce(g.cevaplar, '{}'::jsonb), yeni_sayi);

      if yeni.puan is distinct from g.puan then
        update public.gonderimler
           set dogru = yeni.dogru, yanlis = yeni.yanlis,
               bos = yeni.bos, puan = yeni.puan
         where id = g.id;

        perform public._denetim(
          'yeniden_puanlandi', 'gonderimler', g.id, public._aktor(v_ogretmen),
          jsonb_build_object('puan', g.puan, 'dogru', g.dogru,
                             'yanlis', g.yanlis, 'bos', g.bos),
          jsonb_build_object('puan', yeni.puan, 'dogru', yeni.dogru,
                             'yanlis', yeni.yanlis, 'bos', yeni.bos));

        rapor := rapor || jsonb_build_object(
          'ogrenci', g.ogrenci_ad,
          'eski_puan', g.puan,
          'yeni_puan', yeni.puan);
      end if;
    end loop;
  end if;

  return jsonb_build_object('durum', 'tamam', 'yeniden_puanlanan', rapor);
end;
$$;
create or replace function public.odev_kardeslere_yay(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  d       public.odevler;   -- kaynak
  k       record;           -- kardeş
  eski    public.odevler;   -- kardeşin yayma ÖNCESİ hâli (denetim izi için)
  g       record;
  yeni    record;
  anahtar_degisti boolean;
  rapor   jsonb := '[]'::jsonb;
  puanlar jsonb;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  perform public._odev_sahibi(v_ogretmen, p_id);

  select * into d from public.odevler where id = p_id;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  if d.grup_id is null then
    raise exception 'Bu ödev tek sınıfa verilmiş; yayılacak kardeş ödev yok.'
      using errcode = '22023';
  end if;

  for k in
    select d2.id, d2.sinif_id, s2.ad as sinif_ad
      from public.odevler d2
      join public.siniflar s2 on s2.id = d2.sinif_id
     where d2.grup_id = d.grup_id and d2.id <> p_id
     order by s2.seviye, s2.sube
  loop
    if public._sinif_arsivde(k.sinif_id) then
      rapor := rapor || jsonb_build_object(
        'sinif', k.sinif_ad, 'odev_id', k.id,
        'yeniden_puanlanan', '[]'::jsonb, 'atlandi', 'arsiv');
      continue;
    end if;

    select * into eski from public.odevler where id = k.id;

    anahtar_degisti := eski.tur = 'test'
      and ((d.cevap_anahtari is distinct from eski.cevap_anahtari)
        or (d.soru_sayisi is distinct from eski.soru_sayisi));

    update public.odevler
       set baslik         = d.baslik,
           aciklama       = d.aciklama,
           soru_sayisi    = d.soru_sayisi,
           cevap_anahtari = d.cevap_anahtari,
           sik_sayisi     = d.sik_sayisi,
           konular        = public._konu_temizle(d.konular, d.soru_sayisi),
           anahtar_url    = d.anahtar_url,
           odev_url       = d.odev_url
     where id = k.id;

    perform public._denetim('kardeslere_yayildi', 'odevler', k.id, public._aktor(v_ogretmen),
                            to_jsonb(eski),
                            (select to_jsonb(o) from public.odevler o where o.id = k.id));

    puanlar := '[]'::jsonb;
    if anahtar_degisti then
      for g in
        select gn.id, gn.ogrenci_id, gn.cevaplar, gn.puan, gn.dogru, gn.yanlis, gn.bos,
               o.ad as ogrenci_ad
          from public.gonderimler gn
          join public.ogrenciler o on o.id = gn.ogrenci_id
         where gn.odev_id = k.id
      loop
        select * into yeni
        from public._puanla(coalesce(d.cevap_anahtari, '{}'::jsonb),
                            coalesce(g.cevaplar, '{}'::jsonb),
                            d.soru_sayisi);

        if yeni.puan is distinct from g.puan then
          update public.gonderimler
             set dogru = yeni.dogru, yanlis = yeni.yanlis,
                 bos = yeni.bos, puan = yeni.puan
           where id = g.id;

          perform public._denetim(
            'yeniden_puanlandi', 'gonderimler', g.id, public._aktor(v_ogretmen),
            jsonb_build_object('puan', g.puan, 'dogru', g.dogru,
                               'yanlis', g.yanlis, 'bos', g.bos),
            jsonb_build_object('puan', yeni.puan, 'dogru', yeni.dogru,
                               'yanlis', yeni.yanlis, 'bos', yeni.bos));

          puanlar := puanlar || jsonb_build_object(
            'ogrenci', g.ogrenci_ad,
            'eski_puan', g.puan,
            'yeni_puan', yeni.puan);
        end if;
      end loop;
    end if;

    rapor := rapor || jsonb_build_object(
      'sinif', k.sinif_ad, 'odev_id', k.id,
      'yeniden_puanlanan', puanlar, 'atlandi', null);
  end loop;

  return rapor;
end;
$$;
create or replace function public.odevler_coklu_olustur(
  p_token text,
  p_sinif_idler jsonb,
  p_baslik text,
  p_aciklama text,
  p_tur text,
  p_son_tarih date,
  p_soru_sayisi integer default null,
  p_cevap_anahtari jsonb default null,
  p_anahtar_yolu text default null,
  p_odev_yolu text default null,
  p_gec_teslim boolean default true,
  p_sik_sayisi smallint default 5,
  p_konular jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_adet   integer;
  v_grup   uuid;
  v_ham    text;
  v_sinif  uuid;
  v_yeni   jsonb;
  v_sonuc  jsonb := '[]'::jsonb;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);

  if p_sinif_idler is null or jsonb_typeof(p_sinif_idler) <> 'array' then
    raise exception 'Sınıf listesi bir dizi olmalı.' using errcode = '22023';
  end if;

  v_adet := jsonb_array_length(p_sinif_idler);

  if v_adet = 0 then
    raise exception 'En az bir sınıf seçin.' using errcode = '22023';
  end if;

  if v_adet > 20 then
    raise exception 'Tek seferde en fazla 20 sınıfa ödev verilebilir.'
      using errcode = '22023';
  end if;

  if (select count(distinct e) from jsonb_array_elements_text(p_sinif_idler) e)
     <> v_adet then
    raise exception 'Aynı sınıf listede birden çok kez var.' using errcode = '22023';
  end if;

  for v_ham in select value from jsonb_array_elements_text(p_sinif_idler) loop
    begin
      v_sinif := v_ham::uuid;
    exception when invalid_text_representation then
      raise exception 'Geçersiz sınıf kimliği: %', v_ham using errcode = '22023';
    end;

    if not public._ogretmenin_sinifi(v_ogretmen, v_sinif) then
      raise exception 'Seçilen sınıflardan biri sizin sınıflarınız arasında değil.'
        using errcode = '42501';
    end if;

    if not exists (
      select 1 from public.siniflar s where s.id = v_sinif and not s.arsiv
    ) then
      raise exception 'Sınıf bulunamadı ya da arşivde.' using errcode = '22023';
    end if;
  end loop;

  v_grup := case when v_adet > 1 then gen_random_uuid() end;

  for v_ham in select value from jsonb_array_elements_text(p_sinif_idler) loop
    v_sinif := v_ham::uuid;

    v_yeni := public.odev_olustur(
      p_token, p_baslik, p_aciklama, v_sinif, p_tur, p_son_tarih,
      p_soru_sayisi, p_cevap_anahtari, p_anahtar_yolu, p_odev_yolu,
      p_gec_teslim, p_sik_sayisi, p_konular);

    if v_grup is not null then
      update public.odevler set grup_id = v_grup where id = (v_yeni ->> 'id')::uuid;
    end if;

    v_sonuc := v_sonuc || jsonb_build_object(
      'odev_id',  v_yeni ->> 'id',
      'sinif_id', v_sinif,
      'sinif',    (select s.ad from public.siniflar s where s.id = v_sinif));
  end loop;

  return jsonb_build_object('grup_id', v_grup, 'odevler', v_sonuc);
end;
$$;
create or replace function public.ogrenciler_toplu_ekle(
  p_token text,
  p_tur text,
  p_sinif_id uuid,
  p_adlar jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  ham        text;
  ad         text;
  sira       integer := 0;
  adet       integer;
  yeni_id    uuid;
  kod_ogr    text;
  kod_veli   text;
  sonuc      jsonb := '[]'::jsonb;
  v_ogretmen uuid;
begin
  v_ogretmen := public._yonetici(p_token);

  if p_tur is null or p_tur not in ('okul', 'ozel') then
    raise exception 'Öğrenci türü ''okul'' ya da ''ozel'' olmalı.'
      using errcode = '22023';
  end if;

  if p_tur = 'okul' and p_sinif_id is null then
    raise exception 'Okul öğrencisi için sınıf seçilmeli.' using errcode = '22023';
  end if;

  if p_adlar is null or jsonb_typeof(p_adlar) <> 'array' then
    raise exception 'Ad listesi bir dizi olmalı.' using errcode = '22023';
  end if;

  adet := jsonb_array_length(p_adlar);
  if adet = 0 then
    raise exception 'Listede hiç ad yok.' using errcode = '22023';
  end if;

  if adet > 200 then
    raise exception 'Tek seferde en fazla 200 öğrenci eklenebilir; % ad gönderildi.', adet
      using errcode = '22023';
  end if;

  for ham in select jsonb_array_elements_text(p_adlar) loop
    sira := sira + 1;
    ad := btrim(coalesce(ham, ''));
    if ad = '' then
      raise exception '%. satırdaki ad boş. Hiçbir öğrenci eklenmedi.', sira
        using errcode = '22023';
    end if;
    if length(ad) > 100 then
      raise exception '%. satırdaki ad 100 karakterden uzun. Hiçbir öğrenci eklenmedi.', sira
        using errcode = '22023';
    end if;
  end loop;

  for ham in select jsonb_array_elements_text(p_adlar) loop
    ad := btrim(ham);

    insert into public.ogrenciler (ad, tur, sinif_id, ekleyen_id)
    values (ad, p_tur, p_sinif_id, v_ogretmen)
    returning id into yeni_id;

    kod_ogr  := public._yeni_kod();
    kod_veli := public._yeni_kod();

    insert into public.giris_kodlari (kod, ogrenci_id, rol)
    values (kod_ogr, yeni_id, 'ogrenci'), (kod_veli, yeni_id, 'veli');

    perform public._denetim('ogrenci_eklendi', 'ogrenciler', yeni_id, public._aktor(v_ogretmen));

    sonuc := sonuc || jsonb_build_object(
      'id', yeni_id, 'ad', ad,
      'ogrenci_kodu', kod_ogr, 'veli_kodu', kod_veli
    );
  end loop;

  return jsonb_build_object('eklenen', sonuc, 'adet', jsonb_array_length(sonuc));
end;
$$;
create or replace function public.konu_karnesi(
  p_token text,
  p_sinif_id uuid default null,
  p_ogrenci_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun_tr     date := (now() at time zone 'Europe/Istanbul')::date;
  v_sinif_id   uuid;
  v_ad         text;
  v_sinif_ad   text;
  v_tur        text;
  v_mevcut     integer;
  v_odev_sayisi integer;
  o            public.ogrenciler;
  s            public.siniflar;
  v_ogretmen   uuid;
begin
  v_ogretmen := public._ogretmen(p_token);

  if (p_sinif_id is null) = (p_ogrenci_id is null) then
    raise exception 'Sınıf ya da öğrenci: ikisinden tam olarak biri verilmeli.'
      using errcode = '22023';
  end if;

  if p_ogrenci_id is not null then
    select * into o from public.ogrenciler where id = p_ogrenci_id;
    if not found then
      raise exception 'Öğrenci bulunamadı.' using errcode = 'P0002';
    end if;
    v_sinif_id := o.sinif_id;
    v_ad       := o.ad;
    v_tur      := 'ogrenci';
    v_mevcut   := 1;
    select ad into v_sinif_ad from public.siniflar where id = v_sinif_id;
  else
    select * into s from public.siniflar where id = p_sinif_id;
    if not found then
      raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
    end if;
    v_sinif_id := s.id;
    v_ad       := s.ad;
    v_sinif_ad := s.ad;
    v_tur      := 'sinif';
    select count(*)::integer into v_mevcut
      from public.ogrenciler g where g.sinif_id = v_sinif_id and g.aktif;
  end if;

  select count(*)::integer into v_odev_sayisi
  from public.odevler d
  where d.sinif_id = v_sinif_id and d.yayinda and d.son_tarih < bugun_tr;

  return jsonb_build_object(
    'kapsam', jsonb_build_object(
      'tur', v_tur, 'ad', v_ad, 'sinif', v_sinif_ad, 'mevcut', v_mevcut
    ),

    'odev_sayisi', v_odev_sayisi,

    'konular', coalesce((
      select jsonb_agg(jsonb_build_object(
               'konu', t.konu, 'toplam', t.toplam,
               'dogru', t.dogru, 'yanlis', t.yanlis, 'bos', t.bos)
             order by (t.toplam - t.dogru) desc, t.konu)
      from (
        select e->>'konu' as konu,
               sum((e->>'toplam')::integer)::integer as toplam,
               sum((e->>'dogru')::integer)::integer  as dogru,
               sum((e->>'yanlis')::integer)::integer as yanlis,
               sum((e->>'bos')::integer)::integer    as bos
        from public.odevler d
        join public.gonderimler g on g.odev_id = d.id
        join public.ogrenciler  k on k.id = g.ogrenci_id
        cross join lateral jsonb_array_elements(
          public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
        ) e
        where d.sinif_id = v_sinif_id
          and d.yayinda
          and d.son_tarih < bugun_tr
          and d.tur = 'test'
          and case when p_ogrenci_id is not null
                   then k.id = p_ogrenci_id
                   else k.sinif_id = v_sinif_id and k.aktif end
        group by e->>'konu'
      ) t
    ), '[]'::jsonb),

    'gelisim', coalesce((
      select jsonb_agg(jsonb_build_object(
               'odev', d.baslik,
               'tarih', d.son_tarih,
               'tur', d.tur,
               'deger', i.deger,
               'gonderen', i.gonderen,
               'mevcut', v_mevcut)
             order by d.son_tarih, d.baslik)
      from public.odevler d
      cross join lateral (
        select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1) as deger,
               count(g.id)::integer as gonderen
        from public.gonderimler g
        join public.ogrenciler k on k.id = g.ogrenci_id
        where g.odev_id = d.id
          and case when p_ogrenci_id is not null
                   then k.id = p_ogrenci_id
                   else k.sinif_id = v_sinif_id and k.aktif end
      ) i
      where d.sinif_id = v_sinif_id
        and d.yayinda
        and d.son_tarih < bugun_tr
    ), '[]'::jsonb)
  );
end;
$$;
create or replace function public.disa_aktar(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid;
begin
  v_id := public._yonetici(p_token);
  perform public._denetim('disa_aktarildi', null, null, public._aktor(v_id));

  return jsonb_build_object(
    'alindi', now(),
    -- KADRO YEDEĞE GİRİYOR. Girmeseydi yedek 0033'ten sonra GERİ
    -- YÜKLENEMEZ olurdu: satırlarda `ogretmen_id`/`ekleyen_id` var ve
    -- ikisi de `ogretmenler`e yabancı anahtarla bağlı. Taşıma provasında
    -- ölçüldü — dosya boş bir projeye yüklenirken yabancı anahtar
    -- kısıtından düşüyordu. Yani yedek zinciri, tam da işe yarayacağı gün
    -- kopmuş olurdu.
    --
    -- `pin_hash` ÇIKARILIYOR. Yedek öğretmenin bilgisayarına inen düz bir
    -- dosya; içinde dört öğretmenin PIN hash'i olmamalı. Zaten öğretmenin
    -- kendi PIN'i de bilerek yedeğe girmiyordu — aynı kural kadroya da
    -- uygulanıyor. Geri yüklendiğinde herkes PIN'ini yeniden belirler.
    'ogretmenler', coalesce((select jsonb_agg((to_jsonb(g) - 'pin_hash')
      order by g.yonetici desc, g.ad) from public.ogretmenler g), '[]'::jsonb),
    'ogretmen_siniflari', coalesce((select jsonb_agg(to_jsonb(b))
      from public.ogretmen_siniflari b), '[]'::jsonb),
    'siniflar',  coalesce((select jsonb_agg(to_jsonb(s) order by s.seviye, s.sube) from public.siniflar s), '[]'::jsonb),
    'ogrenciler', coalesce((select jsonb_agg(to_jsonb(o) order by o.ad) from public.ogrenciler o), '[]'::jsonb),
    'giris_kodlari', coalesce((select jsonb_agg(to_jsonb(k)) from public.giris_kodlari k), '[]'::jsonb),
    'odevler',   coalesce((select jsonb_agg(to_jsonb(d)) from public.odevler d), '[]'::jsonb),
    'gonderimler', coalesce((select jsonb_agg(to_jsonb(g)) from public.gonderimler g), '[]'::jsonb),
    'mesajlar',  coalesce((select jsonb_agg(to_jsonb(m)) from public.mesajlar m), '[]'::jsonb),
    'dersler',   coalesce((select jsonb_agg(to_jsonb(l)) from public.dersler l), '[]'::jsonb),
    'odemeler',  coalesce((select jsonb_agg(to_jsonb(p)) from public.odemeler p), '[]'::jsonb),
    'ewalu_mesajlari', coalesce((select jsonb_agg(to_jsonb(e) order by e.bant desc) from public.ewalu_mesajlari e), '[]'::jsonb)
  );
end;
$$;
create or replace function public.pano_detay(p_token text, p_tur text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun date := current_date;
  v_baslik text;
  v_aciklama text;
  v_gruplar jsonb;
  v_toplam integer;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);

  if p_tur not in ('ogrenci', 'acik_odev', 'gondermeyen', 'puan_bekleyen') then
    raise exception 'Geçersiz pano bölümü.' using errcode = '22023';
  end if;

  if p_tur = 'ogrenci' then
    v_baslik := 'Ödev verilen öğrenciler';
    v_aciklama := 'Sınıfına en az bir ödev yayınlanmış öğrenciler.';
    select coalesce(jsonb_agg(g order by g_seviye, g_sube), '[]'::jsonb), coalesce(sum(g_adet), 0)
      into v_gruplar, v_toplam
    from (
      select s.seviye as g_seviye, s.sube as g_sube, count(*)::integer as g_adet,
             jsonb_build_object(
               'sinif', s.ad, 'ozel', s.ozel,
               'satirlar', jsonb_agg(jsonb_build_object('ad', o.ad) order by o.ad)
             ) as g
      from public.ogrenciler o
      join public.siniflar s on s.id = o.sinif_id
      where o.aktif and not s.arsiv
        and exists (select 1 from public.odevler d
                     where d.sinif_id = o.sinif_id and d.yayinda)
      group by s.id, s.ad, s.ozel, s.seviye, s.sube
    ) t;

  elsif p_tur = 'acik_odev' then
    v_baslik := 'Açık ödevler';
    v_aciklama := 'Yayında ve süresi henüz dolmamış ödevler.';
    select coalesce(jsonb_agg(g order by g_seviye, g_sube), '[]'::jsonb), coalesce(sum(g_adet), 0)
      into v_gruplar, v_toplam
    from (
      select s.seviye as g_seviye, s.sube as g_sube, count(*)::integer as g_adet,
             jsonb_build_object(
               'sinif', s.ad, 'ozel', s.ozel,
               'satirlar', jsonb_agg(jsonb_build_object(
                 'id', d.id, 'ad', d.baslik, 'son_tarih', d.son_tarih,
                 'gonderim_sayisi', (select count(*) from public.gonderimler g
                                      where g.odev_id = d.id)
               ) order by d.son_tarih)
             ) as g
      from public.odevler d
      join public.siniflar s on s.id = d.sinif_id
      where d.yayinda and d.son_tarih >= bugun and not s.arsiv
      group by s.id, s.ad, s.ozel, s.seviye, s.sube
    ) t;

  elsif p_tur = 'gondermeyen' then
    v_baslik := 'Göndermeyen öğrenciler';
    v_aciklama := 'Süresi dolmuş ödevlerden en az birini göndermemiş öğrenciler.';
    select coalesce(jsonb_agg(g order by g_seviye, g_sube), '[]'::jsonb), coalesce(sum(g_adet), 0)
      into v_gruplar, v_toplam
    from (
      select s.seviye as g_seviye, s.sube as g_sube, count(*)::integer as g_adet,
             jsonb_build_object(
               'sinif', s.ad, 'ozel', s.ozel,
               'satirlar', jsonb_agg(jsonb_build_object(
                 'ad', x.ad, 'eksik', x.eksik
               ) order by x.eksik desc, x.ad)
             ) as g
      from (
        select o.id, o.ad, o.sinif_id, count(*)::integer as eksik
        from public.ogrenciler o
        join public.odevler d
          on d.sinif_id = o.sinif_id and d.yayinda and d.son_tarih < bugun
        where o.aktif
          and not exists (select 1 from public.gonderimler g
                           where g.odev_id = d.id and g.ogrenci_id = o.id)
        group by o.id, o.ad, o.sinif_id
      ) x
      join public.siniflar s on s.id = x.sinif_id
      where not s.arsiv
      group by s.id, s.ad, s.ozel, s.seviye, s.sube
    ) t;

  else -- puan_bekleyen
    v_baslik := 'Puan bekleyenler';
    v_aciklama := 'Açık uçlu gönderimler; puanı siz verirsiniz.';
    select coalesce(jsonb_agg(g order by g_seviye, g_sube), '[]'::jsonb), coalesce(sum(g_adet), 0)
      into v_gruplar, v_toplam
    from (
      select s.seviye as g_seviye, s.sube as g_sube, count(*)::integer as g_adet,
             jsonb_build_object(
               'sinif', s.ad, 'ozel', s.ozel,
               'satirlar', jsonb_agg(jsonb_build_object(
                 'ad', o.ad, 'odev', d.baslik, 'odev_id', d.id,
                 'zaman', g2.created_at
               ) order by g2.created_at)
             ) as g
      from public.gonderimler g2
      join public.odevler d on d.id = g2.odev_id
      join public.ogrenciler o on o.id = g2.ogrenci_id
      join public.siniflar s on s.id = d.sinif_id
      where d.tur = 'acik' and g2.durum = 'incelemede' and not s.arsiv
      group by s.id, s.ad, s.ozel, s.seviye, s.sube
    ) t;
  end if;

  return jsonb_build_object(
    'tur', p_tur,
    'baslik', v_baslik,
    'aciklama', v_aciklama,
    'toplam', v_toplam,
    'gruplar', v_gruplar
  );
end;
$$;

create or replace function public.mesaj_gonder(
  p_token text,
  p_metin text,
  p_ogrenci_id uuid default null::uuid,
  p_kanal text default 'veli'::text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  o record;
  hedef uuid;
  kimden text;
  v_kanal text;
  v_ogretmen uuid;
begin
  select * into o from public._oturum(p_token);

  if o.rol = 'ogretmen' then
    if p_ogrenci_id is null then
      raise exception 'Mesajın gideceği öğrenci seçilmeli.' using errcode = '22023';
    end if;
    if coalesce(p_kanal, '') not in ('veli', 'ogrenci') then
      raise exception 'Yazışma ''veli'' ya da ''ogrenci'' olmalı.' using errcode = '22023';
    end if;
    if o.vekil_id is not null then
      raise exception 'Başka bir öğretmenin hesabındayken onun adına mesaj gönderemezsiniz. '
                      'Kendi hesabınıza dönün.'
        using errcode = '42501';
    end if;

    perform public._ogrenci_sahibi(o.ogretmen_id, p_ogrenci_id);
    hedef      := p_ogrenci_id;
    kimden     := 'ogretmen';
    v_kanal    := p_kanal;
    v_ogretmen := o.ogretmen_id;
  elsif o.rol = 'veli' then
    hedef      := o.ogrenci_id;
    kimden     := 'veli';
    v_kanal    := 'veli';
    v_ogretmen := public._ogrencinin_ogretmeni(o.ogrenci_id);
  elsif o.rol = 'ogrenci' then
    hedef      := o.ogrenci_id;
    kimden     := 'ogrenci';
    v_kanal    := 'ogrenci';
    v_ogretmen := public._ogrencinin_ogretmeni(o.ogrenci_id);
  else
    raise exception 'Bu bölümde mesaj gönderemezsiniz.' using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_metin, ''), E' \t\r\n')) = 0 then
    raise exception 'Mesaj boş olamaz.' using errcode = '22023';
  end if;

  insert into public.mesajlar (ogrenci_id, kimden, metin, kanal, ogretmen_id)
  values (hedef, kimden, btrim(p_metin, E' \t\r\n'), v_kanal, v_ogretmen);

  return jsonb_build_object('durum', 'tamam');
end;
$function$;
