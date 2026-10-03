-- SEKİZ — 0060: müdür hesabı (yalnız izler)
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Açıklamalı tam sürüm: supabase/migrations/0060_mudur_hesabi.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Yedek)
-- 0059 ÇALIŞMIŞ OLMALI. Edge Function DEĞİŞMİYOR.
--
-- NE YAPIYOR:
--  1. Öğretmenler ekranından "Müdür ekle" ile müdüre PIN'li bir hesap
--     açabilirsiniz (yalnız siz).
--  2. Müdür kendi PIN'iyle girer; HİÇBİR ŞEYİ DEĞİŞTİREMEZ. Görür:
--     sınıf özetleri (ödev sayısı, gönderim oranı, ortalama, sınıf analizi
--     — öğrenci adı yok), öğretmen etkinliği (kim kaç ödev vermiş, hangi
--     sınıflara giriyor), veli onam dökümü.
--  3. Göremez: öğrenci puanları, mesajlar, cevap anahtarları, özel ders,
--     ödemeler.
--  4. Müdüre sınıf atanamaz, müdür hesabına "öğretmen olarak gir" yapılamaz.
--
-- Veri SİLİNMİYOR. Öğretmenler tablosuna bir sütun ekleniyor.
--
-- Beklenen sonuç: en altta tek satırlık bir tablo (_migration_kaydet → 0060).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ŞEMA
-- -----------------------------------------------------------------------------
alter table public.ogretmenler add column if not exists mudur boolean not null default false;

alter table public.ogretmenler drop constraint if exists ogretmenler_mudur_sahip_degil;
alter table public.ogretmenler add constraint ogretmenler_mudur_sahip_degil
  check (not (mudur and yonetici));

alter table public.oturumlar drop constraint if exists oturumlar_rol_check;
alter table public.oturumlar add constraint oturumlar_rol_check
  check (rol in ('ogretmen', 'ogrenci', 'veli', 'mudur'));

alter table public.oturumlar drop constraint if exists oturum_rol_tutarli;
alter table public.oturumlar add constraint oturum_rol_tutarli check (
  (rol = 'ogretmen' and ogrenci_id is null and ogretmen_id is not null)
  or (rol in ('ogrenci', 'veli') and ogrenci_id is not null and ogretmen_id is null)
  -- 0060: müdür oturumu kendi kimliğiyle; vekâlet yok.
  or (rol = 'mudur' and ogrenci_id is null and ogretmen_id is not null and vekil_id is null)
);

-- Müdüre sınıf atanamaz (hangi uçtan gelirse gelsin).
create or replace function public._mudure_sinif_atanamaz()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  if exists (select 1 from public.ogretmenler g where g.id = new.ogretmen_id and g.mudur) then
    raise exception 'Müdüre sınıf atanamaz; müdür bütün sınıfları zaten görür.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists ogretmen_siniflari_mudur on public.ogretmen_siniflari;
create trigger ogretmen_siniflari_mudur before insert or update on public.ogretmen_siniflari
  for each row execute function public._mudure_sinif_atanamaz();

-- -----------------------------------------------------------------------------
-- 2. OTURUM VE GİRİŞ
-- -----------------------------------------------------------------------------
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

  -- Pasifleştirilmiş öğretmenin jetonu da düşer. Aksi hâlde okuldan ayrılan
  -- bir öğretmen, oturumu açık kaldığı sürece 30 gün daha veri görürdü.
  -- 0060: müdür de öğretmenler tablosunda; pasifleştirilen müdürün jetonu da düşer.
  if kayit.rol in ('ogretmen', 'mudur')
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
  -- 0060 — KİMLİK İLE ROL AYRIŞMASIN. Müdür kimliğiyle ÖĞRETMEN oturumu
  -- açılamaz (müdür hiçbir şeyi değiştiremesin; "öğretmen olarak gir" de
  -- buradan geçtiği için müdür hesabına vekâlet de kapanıyor). Müdür
  -- oturumu da yalnız müdür kimliğiyle açılır.
  if p_rol in ('ogretmen', 'mudur') then
    if p_rol = 'ogretmen' and exists (
         select 1 from public.ogretmenler g where g.id = p_ogretmen_id and g.mudur) then
      raise exception 'Müdür hesabıyla öğretmen olarak işlem yapılamaz.' using errcode = '42501';
    end if;
    if p_rol = 'mudur' and not exists (
         select 1 from public.ogretmenler g where g.id = p_ogretmen_id and g.mudur) then
      raise exception 'Müdür oturumu yalnız müdür hesabıyla açılır.' using errcode = '42501';
    end if;
  end if;

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

  -- 1) İlk kurulum: HİÇBİR öğretmenin PIN'i belirlenmemişse kurulum ekranı.
  --    Eski koşul `ayarlar.ogretmen_pin_hash is null` idi; anlamı birebir
  --    aynı kaldı, yalnız kaynağı değişti. Bir yedekten geri yükleme sonrası
  --    (hash'ler yedeğe girmez) sistem yine kurulum ekranını gösterir.
  -- 0060: müdürün PIN'i kurulumu kapatmaz; kurulum bir ÖĞRETMEN içindir.
  if not exists (select 1 from public.ogretmenler where pin_hash is not null and aktif and not mudur) then
    return jsonb_build_object('rol', 'kurulum');
  end if;

  -- 2) Öğretmen PIN'i mi? Aktif öğretmenler taranıyor.
  --    0060: müdür de burada; oturumu 'mudur' rolüyle açılıyor ve hiçbir
  --    öğretmen ucundan geçemiyor (`_ogretmen` yalnız 'ogretmen' kabul eder).
  for g in select id, pin_hash, mudur from public.ogretmenler where pin_hash is not null and aktif loop
    if crypt(p_kod, g.pin_hash) = g.pin_hash then
      perform public._deneme_kaydet(kimlik, p_kod, true);
      if g.mudur then
        token := public._oturum_ac('mudur', null, g.id);
        return jsonb_build_object('rol', 'mudur', 'token', token);
      end if;
      token := public._oturum_ac('ogretmen', null, g.id);
      return jsonb_build_object('rol', 'ogretmen', 'token', token);
    end if;
  end loop;

  -- 3) Öğrenci ya da veli kodu mu?
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

-- -----------------------------------------------------------------------------
-- 3. KİMLİK YARDIMCILARI
-- -----------------------------------------------------------------------------

-- _mudur — müdür oturumu; değilse 42501. Kimliği döndürür.
create or replace function public._mudur(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'mudur' then
    raise exception 'Bu bölüm yalnız müdür içindir.' using errcode = '42501';
  end if;
  return o.ogretmen_id;
end;
$$;

-- _sinif_okuyucusu — sınıfın SALT OKUMA uçları için tek kapı.
--   öğretmen: bugünkü kural (`_ogretmen` + `_ogretmenin_sinifi`),
--   müdür: özel ders grubu DIŞINDAKİ her sınıf.
create or replace function public._sinif_okuyucusu(p_token text, p_sinif_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  v_ogretmen uuid;
begin
  select * into o from public._oturum(p_token);
  if o.rol = 'mudur' then
    if exists (select 1 from public.siniflar s where s.id = p_sinif_id and s.ozel) then
      raise exception 'Özel ders grubu müdür ekranında yer almaz.' using errcode = '42501';
    end if;
    return o.ogretmen_id;
  end if;

  v_ogretmen := public._ogretmen(p_token);
  if not public._ogretmenin_sinifi(v_ogretmen, p_sinif_id) then
    raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
  end if;
  return v_ogretmen;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. MÜDÜR EKLEME — yalnız platform sahibi (ogretmen_ekle'nin kuralları)
-- -----------------------------------------------------------------------------
create or replace function public.mudur_ekle(p_token text, p_ad text, p_pin text)
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
    raise exception 'Müdürün adı boş olamaz.' using errcode = '22023';
  end if;
  if p_pin is null or length(p_pin) < 6 then
    raise exception 'PIN en az 6 haneli olmalı.' using errcode = '22023';
  end if;
  -- Aynı PIN iki kişide olursa giriş ilk eşleşene düşer (ogretmen_ekle).
  if exists (select 1 from public.ogretmenler g
              where g.pin_hash is not null and crypt(p_pin, g.pin_hash) = g.pin_hash) then
    raise exception 'Bu PIN başka bir hesapta kullanılıyor. Farklı bir PIN seçin.'
      using errcode = '22023';
  end if;

  insert into public.ogretmenler (ad, pin_hash, yonetici, aktif, mudur)
  values (btrim(p_ad), crypt(p_pin, gen_salt('bf', 10)), false, true, true)
  returning id into yeni;

  perform public._denetim('mudur_eklendi', 'ogretmenler', yeni, public._aktor(v_sahip),
                          null, jsonb_build_object('ad', btrim(p_ad)));
  return jsonb_build_object('id', yeni, 'ad', btrim(p_ad));
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. MÜDÜR PANOSU — yalnız TOPLAMLAR, öğrenci adı yok
--
-- Özel ders grubu ve arşivlenmiş sınıflar yok. Sayılar yalnız YAYINDAKİ
-- ödevlerden. "Süresi dolan" ödev: son tarih bugünden önce (sınıf
-- analiziyle aynı pencere). Gönderim oranı: süresi dolan ödevlerdeki
-- gönderimler ÷ (aktif öğrenci × süresi dolan ödev). Ortalama:
-- `coalesce(ogretmen_puan, puan)` — öğretmen ekranlarıyla aynı hesap.
-- -----------------------------------------------------------------------------
create or replace function public.mudur_paneli(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id  uuid;
  bugun date := (now() at time zone 'Europe/Istanbul')::date;
begin
  v_id := public._mudur(p_token);

  return jsonb_build_object(
    'ad', (select g.ad from public.ogretmenler g where g.id = v_id),
    'siniflar', coalesce((
      select jsonb_agg(x.satir order by x.seviye, x.sube)
      from (
        select s.seviye, s.sube, jsonb_build_object(
          'id', s.id,
          'ad', s.ad,
          'ogretmenler', coalesce((
              select jsonb_agg(g.ad order by g.yonetici desc, g.ad)
                from public.ogretmen_siniflari os
                join public.ogretmenler g on g.id = os.ogretmen_id
               where os.sinif_id = s.id and g.aktif and not g.mudur
            ), '[]'::jsonb),
          'ogrenci_sayisi', (select count(*)::integer from public.ogrenciler o
                              where o.sinif_id = s.id and o.aktif),
          'odev_sayisi', (select count(*)::integer from public.odevler d
                           where d.sinif_id = s.id and d.yayinda),
          'suresi_dolan', (select count(*)::integer from public.odevler d
                            where d.sinif_id = s.id and d.yayinda and d.son_tarih < bugun),
          'gonderim_orani', (
              select round(100.0 * count(gn.id)
                           / nullif((select count(*) from public.ogrenciler o
                                      where o.sinif_id = s.id and o.aktif)
                                    * (select count(*) from public.odevler d2
                                        where d2.sinif_id = s.id and d2.yayinda
                                          and d2.son_tarih < bugun), 0))
                from public.odevler d
                join public.gonderimler gn on gn.odev_id = d.id
                join public.ogrenciler o on o.id = gn.ogrenci_id and o.aktif and o.sinif_id = s.id
               where d.sinif_id = s.id and d.yayinda and d.son_tarih < bugun
            ),
          'ortalama', (
              select round(avg(coalesce(gn.ogretmen_puan, gn.puan)), 1)
                from public.odevler d
                join public.gonderimler gn on gn.odev_id = d.id
               where d.sinif_id = s.id and d.yayinda and d.son_tarih < bugun
                 and coalesce(gn.ogretmen_puan, gn.puan) is not null
            ),
          'son_odev', (select max(d.created_at) from public.odevler d
                        where d.sinif_id = s.id and d.yayinda)
        ) as satir
        from public.siniflar s
        where not s.arsiv and not s.ozel
      ) x
    ), '[]'::jsonb),
    -- ÖĞRETMEN ETKİNLİĞİ: kim kaç ödev vermiş, hangi sınıflara giriyor.
    -- Giriş saatleri BİLEREK yok (öğretmenin seçtiği kapsam bu).
    'ogretmenler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ad', g.ad,
               'sahip', g.yonetici,
               'siniflar', coalesce((
                   select jsonb_agg(s.ad order by s.seviye, s.sube)
                     from public.ogretmen_siniflari os
                     join public.siniflar s on s.id = os.sinif_id
                    where os.ogretmen_id = g.id and not s.arsiv and not s.ozel
                 ), '[]'::jsonb),
               'odev_sayisi', (select count(*)::integer from public.odevler d
                                join public.siniflar s on s.id = d.sinif_id
                               where d.ogretmen_id = g.id and d.yayinda and not s.ozel),
               'son_30_gun', (select count(*)::integer from public.odevler d
                               join public.siniflar s on s.id = d.sinif_id
                              where d.ogretmen_id = g.id and d.yayinda and not s.ozel
                                and d.created_at > now() - interval '30 days'),
               'son_odev', (select max(d.created_at) from public.odevler d
                             join public.siniflar s on s.id = d.sinif_id
                            where d.ogretmen_id = g.id and d.yayinda and not s.ozel)
             ) order by g.yonetici desc, g.ad)
        from public.ogretmenler g
       where g.aktif and not g.mudur
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. SALT OKUMA UÇLARI MÜDÜRE DE AÇIK: sınıf analizi ve onam dökümü
-- -----------------------------------------------------------------------------
create or replace function public.sinif_analizi(
  p_token      text,
  p_sinif_id   uuid,
  p_baslangic  date default null,
  p_bitis      date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun_tr    date := (now() at time zone 'Europe/Istanbul')::date;
  v_ogretmen  uuid;
  v_sinif     record;
  v_bas       date;
  v_bit       date;
  v_varsayilan boolean;
  v_mevcut    integer;
  v_haftalar  jsonb;
  v_aylar     jsonb;
  v_ozet      jsonb;
begin
  -- 0060: öğretmen kendi sınıfını, müdür (salt okuma) özel ders dışındaki
  -- her sınıfı görür. Kural tek yerde: `_sinif_okuyucusu`.
  v_ogretmen := public._sinif_okuyucusu(p_token, p_sinif_id);

  select s.id, s.ad into v_sinif from public.siniflar s where s.id = p_sinif_id;
  if not found then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;

  -- VARSAYILAN ARALIK: son 12 hafta. Öğretmenin isteği "otomatik gelsin"
  -- idi; ekran açılır açılmaz bir şey göstermesi için bir varsayılan
  -- gerekiyor. Dönem analizi için tarihleri kendisi seçiyor.
  v_varsayilan := p_baslangic is null and p_bitis is null;
  v_bit := coalesce(p_bitis, bugun_tr);
  v_bas := coalesce(p_baslangic, (date_trunc('week', bugun_tr) - interval '11 weeks')::date);

  if v_bas > v_bit then
    raise exception 'Başlangıç tarihi bitişten sonra olamaz.' using errcode = '22023';
  end if;

  select count(*)::integer into v_mevcut
  from public.ogrenciler o where o.sinif_id = p_sinif_id and o.aktif;

  -- ---------------------------------------------------------------------------
  -- HAFTALIK
  --
  -- `date_trunc('week', …)` PostgreSQL'de PAZARTESİ'den başlıyor — Türkiye'de
  -- okul haftası da öyle.
  -- ---------------------------------------------------------------------------
  with odev as (
    select d.id, d.tur, d.son_tarih,
           date_trunc('week',  d.son_tarih)::date as kova
      from public.odevler d
     where d.sinif_id = p_sinif_id
       and d.yayinda
       and d.son_tarih < bugun_tr
       and d.son_tarih between v_bas and v_bit
  ),
  puan as (
    select o.kova, coalesce(g.ogretmen_puan, g.puan) as p
      from odev o
      join public.gonderimler g on g.odev_id = o.id
      join public.ogrenciler  k on k.id = g.ogrenci_id
     where k.sinif_id = p_sinif_id and k.aktif
       and coalesce(g.ogretmen_puan, g.puan) is not null
  ),
  konu as (
    select o.kova, e->>'konu' as konu,
           sum((e->>'toplam')::integer)::integer as toplam,
           sum((e->>'dogru')::integer)::integer  as dogru
      from odev o
      join public.odevler     d on d.id = o.id
      join public.gonderimler g on g.odev_id = d.id
      join public.ogrenciler  k on k.id = g.ogrenci_id
      cross join lateral jsonb_array_elements(
        public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
      ) e
     where k.sinif_id = p_sinif_id and k.aktif
       and d.tur = 'test'
     group by o.kova, e->>'konu'
  ),
  kovalar as (
    select kova,
           count(*)::integer as odev_sayisi,
           count(*) filter (where tur = 'test')::integer as test_sayisi
      from odev group by kova
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'baslangic', b.kova,
           'bitis', (b.kova + 6),
           'odev_sayisi', b.odev_sayisi,
           'test_sayisi', b.test_sayisi,
           'gonderim', (select count(*)::integer from puan p where p.kova = b.kova),
           'ortalama', (select round(avg(p.p), 1) from puan p where p.kova = b.kova),
           'konular', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'konu', t.konu, 'toplam', t.toplam, 'dogru', t.dogru,
                      'oran', round(100.0 * t.dogru / t.toplam),
                      'durum', public._konu_durumu(t.toplam, t.dogru))
                    order by (t.toplam - t.dogru) desc, t.konu)
               from konu t where t.kova = b.kova), '[]'::jsonb)
         ) order by b.kova desc), '[]'::jsonb)
    into v_haftalar
    from kovalar b;

  -- ---------------------------------------------------------------------------
  -- AYLIK — haftalığın aynısı, yalnız kova `month`
  -- ---------------------------------------------------------------------------
  with odev as (
    select d.id, d.tur, date_trunc('month', d.son_tarih)::date as kova
      from public.odevler d
     where d.sinif_id = p_sinif_id and d.yayinda
       and d.son_tarih < bugun_tr
       and d.son_tarih between v_bas and v_bit
  ),
  puan as (
    select o.kova, coalesce(g.ogretmen_puan, g.puan) as p
      from odev o
      join public.gonderimler g on g.odev_id = o.id
      join public.ogrenciler  k on k.id = g.ogrenci_id
     where k.sinif_id = p_sinif_id and k.aktif
       and coalesce(g.ogretmen_puan, g.puan) is not null
  ),
  konu as (
    select o.kova, e->>'konu' as konu,
           sum((e->>'toplam')::integer)::integer as toplam,
           sum((e->>'dogru')::integer)::integer  as dogru
      from odev o
      join public.odevler     d on d.id = o.id
      join public.gonderimler g on g.odev_id = d.id
      join public.ogrenciler  k on k.id = g.ogrenci_id
      cross join lateral jsonb_array_elements(
        public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
      ) e
     where k.sinif_id = p_sinif_id and k.aktif and d.tur = 'test'
     group by o.kova, e->>'konu'
  ),
  kovalar as (
    select kova, count(*)::integer as odev_sayisi,
           count(*) filter (where tur = 'test')::integer as test_sayisi
      from odev group by kova
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'ay', b.kova,
           'odev_sayisi', b.odev_sayisi,
           'test_sayisi', b.test_sayisi,
           'gonderim', (select count(*)::integer from puan p where p.kova = b.kova),
           'ortalama', (select round(avg(p.p), 1) from puan p where p.kova = b.kova),
           'konular', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'konu', t.konu, 'toplam', t.toplam, 'dogru', t.dogru,
                      'oran', round(100.0 * t.dogru / t.toplam),
                      'durum', public._konu_durumu(t.toplam, t.dogru))
                    order by (t.toplam - t.dogru) desc, t.konu)
               from konu t where t.kova = b.kova), '[]'::jsonb)
         ) order by b.kova desc), '[]'::jsonb)
    into v_aylar
    from kovalar b;

  -- ---------------------------------------------------------------------------
  -- ARALIĞIN TAMAMI — "dönem analizi" bu
  --
  -- Öğretmen hem yüzde çizgisi hem "en çok eksik üç konu" istedi; ikisi
  -- de burada. `en_eksik_uc` sıralamaya, `iyi`/`calisilmali` çizgiye
  -- dayanıyor — biri ötekinin yerine geçmiyor.
  -- ---------------------------------------------------------------------------
  with odev as (
    select d.id, d.tur
      from public.odevler d
     where d.sinif_id = p_sinif_id and d.yayinda
       and d.son_tarih < bugun_tr
       and d.son_tarih between v_bas and v_bit
  ),
  puan as (
    select coalesce(g.ogretmen_puan, g.puan) as p
      from odev o
      join public.gonderimler g on g.odev_id = o.id
      join public.ogrenciler  k on k.id = g.ogrenci_id
     where k.sinif_id = p_sinif_id and k.aktif
       and coalesce(g.ogretmen_puan, g.puan) is not null
  ),
  konu as (
    select e->>'konu' as konu,
           sum((e->>'toplam')::integer)::integer as toplam,
           sum((e->>'dogru')::integer)::integer  as dogru
      from odev o
      join public.odevler     d on d.id = o.id
      join public.gonderimler g on g.odev_id = d.id
      join public.ogrenciler  k on k.id = g.ogrenci_id
      cross join lateral jsonb_array_elements(
        public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
      ) e
     where k.sinif_id = p_sinif_id and k.aktif and d.tur = 'test'
     group by e->>'konu'
  ),
  damgali as (
    select konu, toplam, dogru,
           round(100.0 * dogru / toplam) as oran,
           public._konu_durumu(toplam, dogru) as durum
      from konu
  )
  select jsonb_build_object(
           'odev_sayisi', (select count(*)::integer from odev),
           'test_sayisi', (select count(*) filter (where tur = 'test')::integer from odev),
           'gonderim', (select count(*)::integer from puan),
           'ortalama', (select round(avg(p), 1) from puan),
           'konular', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'konu', konu, 'toplam', toplam, 'dogru', dogru,
                      'oran', oran, 'durum', durum)
                    order by (toplam - dogru) desc, konu) from damgali), '[]'::jsonb),
           'iyi', coalesce((
             select jsonb_agg(konu order by oran desc, konu)
               from damgali where durum = 'iyi'), '[]'::jsonb),
           'calisilmali', coalesce((
             select jsonb_agg(konu order by oran, konu)
               from damgali where durum = 'calisilmali'), '[]'::jsonb),
           'en_eksik_uc', coalesce((
             select jsonb_agg(konu order by eksik desc, konu)
               from (select konu, (toplam - dogru) as eksik from damgali
                      where durum <> 'az_veri'
                      order by eksik desc, konu limit 3) u), '[]'::jsonb)
         )
    into v_ozet;

  return jsonb_build_object(
    'sinif', jsonb_build_object('id', v_sinif.id, 'ad', v_sinif.ad),
    'aralik', jsonb_build_object(
      'baslangic', v_bas, 'bitis', v_bit, 'varsayilan', v_varsayilan
    ),
    -- Eşikler yanıtta: ekran "iyi" derken hangi çizgiyi kastettiğini
    -- yazabilsin. Çizgiyi arayüze gömseydik sunucuyla ayrışabilirdi —
    -- burada da elle yazsaydık damgayla ayrışırdı. Damganın kullandığı
    -- yardımcının ta kendisi dönüyor.
    'esikler', public._konu_esikleri(),
    'mevcut', v_mevcut,
    'haftalar', v_haftalar,
    'aylar', v_aylar,
    'ozet', v_ozet
  );
end;
$$;

create or replace function public.onam_dokumu(p_token text, p_sinif_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ogretmen uuid;
  v_sinif    record;
  v_surum    text := public._gecerli_onam_surumu();
begin
  -- 0060: öğretmen kendi sınıfını, müdür (salt okuma) özel ders dışındaki
  -- her sınıfı görür. Kural tek yerde: `_sinif_okuyucusu`.
  v_ogretmen := public._sinif_okuyucusu(p_token, p_sinif_id);

  select s.id, s.ad into v_sinif from public.siniflar s where s.id = p_sinif_id;
  if not found then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'sinif', jsonb_build_object('id', v_sinif.id, 'ad', v_sinif.ad),
    'surum', v_surum,
    'alindi', now(),
    'alan', (select g.ad from public.ogretmenler g where g.id = v_ogretmen),
    'satirlar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ogrenci_id', o.id,
               'ogrenci', o.ad,
               -- GEÇERLİ SÜRÜMÜN onayı aranıyor. Eski bir sürüme verilmiş
               -- onay bu belgede "onam bekliyor" sayılır: veli bugünkü
               -- metni onaylamış değildir ve belge bunu gizlememeli.
               'onam_var', (v.id is not null),
               'veli_adi', v.veli_adi,
               'onay_zamani', v.onay_zamani
             ) order by o.ad)
      from public.ogrenciler o
      left join public.veli_onaylari v
        on v.ogrenci_id = o.id and v.metin_surumu = v_surum
      where o.sinif_id = p_sinif_id and o.aktif
    ), '[]'::jsonb),
    'toplam', (select count(*)::integer from public.ogrenciler o
                where o.sinif_id = p_sinif_id and o.aktif),
    'onayli', (select count(*)::integer
                 from public.ogrenciler o
                 join public.veli_onaylari v
                   on v.ogrenci_id = o.id and v.metin_surumu = v_surum
                where o.sinif_id = p_sinif_id and o.aktif)
  );
end;
$$;

-- ogretmenler_listesi ← 0050 + 'mudur'
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
             -- 0060: müdür (yalnız izler). Ekran ona sınıf atama ve
             -- "öğretmen olarak gir" düğmesi göstermiyor.
             'mudur', g.mudur,
             'aktif', g.aktif,
             'pin_var', (g.pin_hash is not null),
             -- SINIF KİMLİKLERİ (0050). Ekran bunlarla kutucukları
             -- işaretliyor. Sıra `siniflar_listesi` ile aynı olsun diye
             -- seviye/şubeye göre diziliyor — ekranda karşılaştırması
             -- kolay olsun.
             'sinif_idler', coalesce((
                 select jsonb_agg(os.sinif_id order by s.seviye, s.sube)
                   from public.ogretmen_siniflari os
                   join public.siniflar s on s.id = os.sinif_id
                  where os.ogretmen_id = g.id
               ), '[]'::jsonb),
             -- SAYI ARTIK DİZİDEN TÜRETİLİYOR. Eskiden ayrı bir
             -- `count(*)` idi; iki hesabın bir gün ayrışması 0030'un
             -- dersiydi (rozet 3 derken listede 2 satır). Tek kaynak.
             'sinif_sayisi', (
                 select count(*)::integer
                   from public.ogretmen_siniflari os
                   join public.siniflar s on s.id = os.sinif_id
                  where os.ogretmen_id = g.id
               ),
             'odev_sayisi',  (select count(*) from public.odevler d where d.ogretmen_id = g.id),
             'son_gorulme',  (select max(o.son_gorulme) from public.oturumlar o
                               where o.ogretmen_id = g.id and o.vekil_id is null)
           ) order by g.yonetici desc, g.ad)
    from public.ogretmenler g
  ), '[]'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. YETKİLER (0005 deseni)
-- -----------------------------------------------------------------------------
revoke all on function public._oturum(text) from public, anon, authenticated;
revoke all on function public._oturum_ac(text, uuid, uuid, interval, uuid) from public, anon, authenticated;
revoke all on function public._mudur(text) from public, anon, authenticated;
revoke all on function public._sinif_okuyucusu(text, uuid) from public, anon, authenticated;
revoke all on function public._mudure_sinif_atanamaz() from public, anon, authenticated;

revoke all on function public.giris(text) from public, anon, authenticated;
grant execute on function public.giris(text) to anon;

revoke all on function public.mudur_ekle(text, text, text) from public, anon, authenticated;
grant execute on function public.mudur_ekle(text, text, text) to anon;

revoke all on function public.mudur_paneli(text) from public, anon, authenticated;
grant execute on function public.mudur_paneli(text) to anon, authenticated;

revoke all on function public.ogretmenler_listesi(text) from public, anon, authenticated;
grant execute on function public.ogretmenler_listesi(text) to anon, authenticated;

revoke all on function public.sinif_analizi(text, uuid, date, date) from public, anon, authenticated;
grant execute on function public.sinif_analizi(text, uuid, date, date) to anon, authenticated;

revoke all on function public.onam_dokumu(text, uuid) from public, anon, authenticated;
grant execute on function public.onam_dokumu(text, uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 8. KENDİ KENDİNİ DENETLEME
-- -----------------------------------------------------------------------------
do $$
declare
  ad text;
begin
  -- Değiştiren uçların kapısı yalnız öğretmeni tanımalı; müdür bu iki
  -- kapıdan GEÇEMEMELİ. Kapıların gövdesi değişirse burası bağırır.
  if pg_get_functiondef('public._ogretmen(text)'::regprocedure) not like '%o.rol <> ''ogretmen''%' then
    raise exception '0060: _ogretmen artık yalnız öğretmeni kabul etmiyor';
  end if;

  foreach ad in array array['sinif_analizi', 'onam_dokumu'] loop
    if not exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = ad
         and pg_get_functiondef(p.oid) like '%_sinif_okuyucusu(%'
    ) then
      raise exception '0060: % _sinif_okuyucusu kullanmıyor', ad;
    end if;
  end loop;

  foreach ad in array array['_mudur(text)', '_sinif_okuyucusu(text, uuid)', '_oturum_ac(text, uuid, uuid, interval, uuid)'] loop
    if has_function_privilege('anon', ('public.' || ad)::regprocedure, 'execute') then
      raise exception '0060: % istemciye açık', ad;
    end if;
  end loop;

  if not exists (select 1 from pg_trigger where tgname = 'ogretmen_siniflari_mudur') then
    raise exception '0060: müdüre sınıf atama engeli kurulmadı';
  end if;
end $$;

select public._migration_kaydet('0060');
