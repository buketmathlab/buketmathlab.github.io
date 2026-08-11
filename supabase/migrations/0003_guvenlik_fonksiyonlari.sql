-- =============================================================================
-- SEKİZ — 0003 GÜVENLİK VE OTURUM KATMANI
--
-- Buradaki her fonksiyon:
--   * SECURITY DEFINER — tablo sahibinin haklarıyla çalışır, RLS'i atlar
--   * search_path sabitlenmiş — SECURITY DEFINER'da standart sertleştirme;
--     aksi hâlde çağıran taraf search_path'i değiştirip sahte tablo
--     gösterebilir
--   * yetkiyi PARAMETREDEN GELEN KİMLİĞE göre değil, jetondan doğrulayarak
--     belirler
--
-- Alt çizgiyle başlayan fonksiyonlar dahilidir; anon rolüne EXECUTE hakkı
-- verilmez (bkz. dosya sonu).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Jeton hash'i. Veritabanında jetonun kendisi asla durmaz.
-- -----------------------------------------------------------------------------
create or replace function public._token_hash(p_token text)
returns text
language sql
immutable
security definer
set search_path = public, pg_temp
as $$
  select encode(digest(p_token, 'sha256'), 'hex');
$$;

-- -----------------------------------------------------------------------------
-- Giriş kodu üreteci.
--
-- Alfabeden karışabilecek karakterler çıkarıldı: 0/O, 1/I/L. Kod telefonla
-- okunacak, elle yazılacak — okunabilirlik güvenliğin parçası, çünkü
-- karışan kod öğretmene "kodumu kaybettim" trafiği olarak geri döner.
--
-- 8 karakter × 32 harflik alfabe ≈ 1.1×10^12 olasılık. Giriş deneme
-- limitiyle birlikte kaba kuvvet pratikte imkânsız.
-- -----------------------------------------------------------------------------
create or replace function public._yeni_kod()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  alfabe constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  -- Değişken adı sütun adıyla çakışmasın diye v_ önekli: PL/pgSQL'de
  -- `where g.kod = kod` ifadesindeki sağ taraf belirsiz kalıyordu.
  v_kod text;
  i integer;
begin
  loop
    v_kod := '';
    for i in 1..8 loop
      v_kod := v_kod || substr(alfabe, 1 + floor(random() * length(alfabe))::int, 1);
    end loop;
    -- Çakışma olasılığı çok düşük ama kontrol etmemek için sebep yok.
    exit when not exists (select 1 from public.giris_kodlari g where g.kod = v_kod);
  end loop;
  return v_kod;
end;
$$;

-- -----------------------------------------------------------------------------
-- Denetim izi kaydı (Part XLIII).
-- -----------------------------------------------------------------------------
create or replace function public._denetim(
  p_islem text,
  p_tablo text,
  p_kayit_id uuid,
  p_aktor text,
  p_eski jsonb default null,
  p_yeni jsonb default null
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.denetim_izi (islem, tablo, kayit_id, aktor, eski, yeni)
  values (p_islem, p_tablo, p_kayit_id, p_aktor, p_eski, p_yeni);
$$;

-- -----------------------------------------------------------------------------
-- İstemci kimliği — deneme limiti için.
-- PostgREST istek başlıklarını `request.headers` altında sunar. IP yoksa
-- sabit bir değere düşeriz; o durumda limit küresel olur, yine de korur.
-- IP ham hâlde saklanmaz, hash'lenir (KVKK: gereksiz kişisel veri tutma).
-- -----------------------------------------------------------------------------
create or replace function public._istemci_kimligi()
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  basliklar json;
  ip text;
begin
  begin
    basliklar := current_setting('request.headers', true)::json;
    ip := coalesce(basliklar ->> 'cf-connecting-ip', basliklar ->> 'x-forwarded-for');
  exception when others then
    ip := null;
  end;
  return encode(digest(coalesce(ip, 'bilinmeyen'), 'sha256'), 'hex');
end;
$$;

-- -----------------------------------------------------------------------------
-- Deneme limiti.
--
-- Politika: son 15 dakikada 8 başarısız deneme → 15 dakika kilit.
-- Kilit süresi, üst üste kilitlenmelerde kademeli olarak artar.
-- -----------------------------------------------------------------------------
create or replace function public._kilitli_mi(p_kimlik text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  basarisiz integer;
begin
  select count(*) into basarisiz
  from public.giris_denemeleri
  where kimlik = p_kimlik
    and not basarili
    and zaman > now() - interval '15 minutes';

  return basarisiz >= 8;
end;
$$;

create or replace function public._deneme_kaydet(
  p_kimlik text,
  p_kod text,
  p_basarili boolean
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.giris_denemeleri (kimlik, kod_ipucu, basarili)
  values (p_kimlik, left(coalesce(p_kod, ''), 2), p_basarili);
$$;

-- -----------------------------------------------------------------------------
-- Oturum açma. Ham jetonu YALNIZ burada, bir kez döndürür.
-- -----------------------------------------------------------------------------
create or replace function public._oturum_ac(
  p_rol text,
  p_ogrenci_id uuid,
  p_sure interval default interval '30 days'
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ham_token text;
begin
  ham_token := encode(gen_random_bytes(32), 'hex');

  insert into public.oturumlar (token_hash, rol, ogrenci_id, son_kullanma)
  values (public._token_hash(ham_token), p_rol, p_ogrenci_id, now() + p_sure);

  return ham_token;
end;
$$;

-- -----------------------------------------------------------------------------
-- Oturum doğrulama.
--
-- Her korumalı RPC'nin İLK satırında çağrılır. Geçersizse istisna fırlatır;
-- fonksiyonun geri kalanı hiç çalışmaz. "Önce iş yap, sonra yetki kontrol
-- et" hatası yapısal olarak engellenir.
-- -----------------------------------------------------------------------------
create or replace function public._oturum(p_token text)
returns table (rol text, ogrenci_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  kayit record;
begin
  if p_token is null or length(p_token) < 32 then
    raise exception 'Oturum geçersiz. Lütfen tekrar giriş yapın.'
      using errcode = '28000';
  end if;

  select o.rol, o.ogrenci_id, o.id into kayit
  from public.oturumlar o
  where o.token_hash = public._token_hash(p_token)
    and not o.iptal
    and o.son_kullanma > now();

  if not found then
    raise exception 'Oturum süresi dolmuş. Lütfen tekrar giriş yapın.'
      using errcode = '28000';
  end if;

  update public.oturumlar set son_gorulme = now() where id = kayit.id;

  rol := kayit.rol;
  ogrenci_id := kayit.ogrenci_id;
  return next;
end;
$$;

-- -----------------------------------------------------------------------------
-- Öğretmen yetkisi zorunluluğu.
-- -----------------------------------------------------------------------------
create or replace function public._ogretmen(p_token text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o record;
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'ogretmen' then
    raise exception 'Bu işlem için öğretmen yetkisi gerekiyor.'
      using errcode = '42501';
  end if;
end;
$$;

-- =============================================================================
-- HERKESE AÇIK GİRİŞ FONKSİYONLARI
-- =============================================================================

-- -----------------------------------------------------------------------------
-- İlk kurulum: öğretmen PIN'i belirleme.
-- Yalnız PIN henüz hiç belirlenmemişse çalışır — aksi hâlde herkes PIN'i
-- sıfırlayabilirdi.
-- -----------------------------------------------------------------------------
create or replace function public.pin_ayarla(p_yeni text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  mevcut text;
  token text;
begin
  select ogretmen_pin_hash into mevcut from public.ayarlar where id = 1;

  if mevcut is not null then
    raise exception 'PIN zaten belirlenmiş. Değiştirmek için mevcut PIN ile giriş yapın.'
      using errcode = '42501';
  end if;

  if p_yeni is null or length(p_yeni) < 6 then
    raise exception 'PIN en az 6 haneli olmalı.' using errcode = '22023';
  end if;

  -- bf = bcrypt. Düz metin saklanmıyor.
  update public.ayarlar
     set ogretmen_pin_hash = crypt(p_yeni, gen_salt('bf', 10))
   where id = 1;

  perform public._denetim('pin_ayarlandi', 'ayarlar', null, 'ogretmen');

  token := public._oturum_ac('ogretmen', null);
  return jsonb_build_object('rol', 'ogretmen', 'token', token);
end;
$$;

-- -----------------------------------------------------------------------------
-- PIN değiştirme — mevcut PIN doğrulanarak.
-- -----------------------------------------------------------------------------
create or replace function public.pin_degistir(p_token text, p_eski text, p_yeni text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  mevcut text;
begin
  perform public._ogretmen(p_token);

  select ogretmen_pin_hash into mevcut from public.ayarlar where id = 1;

  if mevcut is null or crypt(p_eski, mevcut) <> mevcut then
    raise exception 'Mevcut PIN doğru değil.' using errcode = '28000';
  end if;

  if p_yeni is null or length(p_yeni) < 6 then
    raise exception 'Yeni PIN en az 6 haneli olmalı.' using errcode = '22023';
  end if;

  update public.ayarlar
     set ogretmen_pin_hash = crypt(p_yeni, gen_salt('bf', 10))
   where id = 1;

  -- Güvenlik gereği diğer tüm oturumlar düşürülür.
  update public.oturumlar set iptal = true
   where rol = 'ogretmen' and token_hash <> public._token_hash(p_token);

  perform public._denetim('pin_degistirildi', 'ayarlar', null, 'ogretmen');

  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- -----------------------------------------------------------------------------
-- GİRİŞ — tek alan: öğretmen PIN'i, öğrenci kodu veya veli kodu.
--
-- Dönüş: { rol, token, ogrenci? }  — ham jeton yalnız burada verilir.
-- PIN artık her istekte gönderilmez.
-- -----------------------------------------------------------------------------
create or replace function public.giris(p_kod text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  kimlik   text;
  pin_hash text;
  kayit    record;
  token    text;
  ogr      record;
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

  -- 1) İlk kurulum: PIN hiç belirlenmemişse kurulum ekranına yönlendir.
  select ogretmen_pin_hash into pin_hash from public.ayarlar where id = 1;
  if pin_hash is null then
    return jsonb_build_object('rol', 'kurulum');
  end if;

  -- 2) Öğretmen PIN'i mi?
  if crypt(p_kod, pin_hash) = pin_hash then
    perform public._deneme_kaydet(kimlik, p_kod, true);
    token := public._oturum_ac('ogretmen', null);
    return jsonb_build_object('rol', 'ogretmen', 'token', token);
  end if;

  -- 3) Öğrenci ya da veli kodu mu?
  --    Kodlar tek tabloda birincil anahtar olduğu için rol belirsizliği yok.
  select gk.rol, gk.ogrenci_id into kayit
  from public.giris_kodlari gk
  join public.ogrenciler o on o.id = gk.ogrenci_id
  where gk.kod = upper(p_kod) and o.aktif;

  if not found then
    perform public._deneme_kaydet(kimlik, p_kod, false);
    return jsonb_build_object('rol', 'yok');
  end if;

  perform public._deneme_kaydet(kimlik, p_kod, true);
  token := public._oturum_ac(kayit.rol, kayit.ogrenci_id);

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
$$;

-- -----------------------------------------------------------------------------
-- ÇIKIŞ — jetonu iptal eder.
-- Eski sistemde çıkış yalnız localStorage'ı siliyordu; sunucuda karşılığı
-- yoktu, yani kopyalanmış bir PIN sonsuza kadar geçerliydi.
-- -----------------------------------------------------------------------------
create or replace function public.cikis(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.oturumlar
     set iptal = true
   where token_hash = public._token_hash(p_token);
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- -----------------------------------------------------------------------------
-- Süresi dolmuş oturumların temizliği. Zamanlanmış görevden çağrılabilir.
-- -----------------------------------------------------------------------------
create or replace function public.oturum_temizle()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  silinen integer;
begin
  delete from public.oturumlar
   where son_kullanma < now() - interval '7 days' or iptal;
  get diagnostics silinen = row_count;

  delete from public.giris_denemeleri where zaman < now() - interval '30 days';

  return silinen;
end;
$$;

-- =============================================================================
-- EXECUTE HAKLARI
--
-- 0002'de tüm fonksiyonlardan haklar çekildi. Burada YALNIZ dışarıya açık
-- olması gerekenler geri veriliyor. Alt çizgiyle başlayan dahili
-- fonksiyonlara anon EXECUTE hakkı ALMIYOR — dışarıdan çağrılamazlar.

-- EXECUTE hakları tek yerde toplandı: 0005_fonksiyon_yetkileri.sql
