-- =============================================================================
-- 0081 — ANKET SONUÇLARINDA KAPSAM: kendi sınıflarım · sınıf sınıf · tüm okul
--
-- Öğretmenin isteği: "Ben platform sahibi olarak tüm sınıfları görebiliyorum,
-- fakat bu tüm sınıfların öğretmeni değilim. Benim girdiğim sınıflar 9A, 9B,
-- 10C, 11C. … benim dersine girdiğim öğrencilerin ve bu öğrencilerin
-- velilerinden oluşan anketi ben göreyim. Bir de tüm okulun … anketlerini
-- genel olarak göreyim. Ve diğer öğretmenler de kendi girdikleri sınıfların
-- anketlerini görsünler … Aynı benim gördüğüm gibi."
--
-- Bugün `anket_sonuclari` TEK bir sayı kümesi döndürüyor (bütün okul, rol
-- başına) ve yalnız SAHİP ile MÜDÜR görüyor; öğretmenler hiç görmüyor.
--
-- -----------------------------------------------------------------------------
-- ÖĞRETMENİN DÖRT KARARI
--
--   1. KIRILIM: sınıf sınıf da görünsün (9A, 9B, 10C, 11C ayrı ayrı), ayrıca
--      kendi sınıfları topluca ve tüm okul.
--   2. ÖĞRETMEN ANKETİ: yalnız sahip ve müdür görsün. Okulda 4 öğretmen var
--      ve alt sınır yok (0077); meslektaşların birbirinin görüşünü okuması
--      anketi dürüst doldurmayı zorlaştırırdı.
--   3. "BENİM SINIFLARIM": Ayarlar'dan kendisi işaretleyecek.
--   4. ALT SINIR: yok, bugünkü gibi — tek yanıt da gösterilir (0077 sürüyor).
--
-- -----------------------------------------------------------------------------
-- KİMSEYE SINIF SORULMUYOR — ama yanıt satırına yazılıyor
--
-- Anket formu AYNEN kalıyor: ad yok, sınıf yok, kod yok. Sunucu yanıtlayanı
-- zaten biliyor (tekrarı engelleyen özeti üretmek için gerekiyor) ve sınıfı
-- hesabından okuyor.
--
-- BEDELİ DÜRÜSTÇE: kişi yazmasa da yanıt satırına sınıf kaydedilmiş oluyor.
-- Bugün bir yanıt "tüm okul"a aitken yarın "9A"ya ait oluyor. Alt sınır da
-- olmadığı için TEK BİR YANIT BİLE gösteriliyor — 30 kişilik bir sınıfta tek
-- bir görüşün kime ait olduğu tahmin edilebilir. Öğretmene söylendi, kararı
-- bu yönde; ekranda da yazılı (`anket-kapsam-metni.ts` → GIZLILIK_NOTU).
--
-- Anonimliğin geri kalanı AYNEN duruyor: yanıtta kimlik yok, saat yok,
-- denetim izine yazılmıyor, `anket_katilimlari` ile `anket_yanitlari`
-- arasında uygulama düzeyinde bağ kurulamıyor.
--
-- -----------------------------------------------------------------------------
-- GERİYE DÖNÜK DOLDURMA YOK — VE OLAMAZ
--
-- Bugüne kadar toplanmış yanıtlar kimliksiz; hangi sınıftan geldikleri
-- HİÇBİR YERDE yazmıyor. 0041'in çıpalı deseni burada uygulanamıyor, çünkü
-- çıpa niteliğinde bir kayıt yok — ve olsaydı zaten anonimlik kırılmış
-- olurdu. O yanıtlar `sinif_id is null` kalıyor ve YALNIZ "tüm okul"
-- sonucunda görünüyorlar. Kaç tane olduğu aşağıda `raise notice` ile
-- bildiriliyor ve ekranda da yazılıyor: sessizce yok saymak, toplamların
-- tutmamasına ve öğretmenin sayılara güvenmemesine yol açardı.
--
-- Bu dosya tekrar çalıştırılabilir. Ön koşul: 0077.
-- =============================================================================

do $$
begin
  if to_regprocedure('public.anket_sonuclari(text)') is null
     and to_regprocedure('public.anket_sonuclari(text,text,uuid)') is null then
    raise exception '0081: önce 0076 ve 0077 çalıştırılmalı';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. YANITA SINIF
-- -----------------------------------------------------------------------------
alter table public.anket_yanitlari
  add column if not exists sinif_id uuid references public.siniflar(id) on delete set null;

-- `on delete set null`: sınıf silinirse (bu depoda silinebiliyor,
-- `sinif-silme-denetimi.mjs`) yanıt KAYBOLMUYOR, genel sonuca düşüyor.
-- Yanıt sayılarının bir sınıf silindi diye azalması, öğretmenin sayılara
-- güvenini bir daha geri gelmemek üzere bozardı.
create index if not exists anket_yanitlari_sinif_idx
  on public.anket_yanitlari (anket, rol, sinif_id);

do $$
declare n integer;
begin
  select count(*) into n from public.anket_yanitlari where sinif_id is null;
  raise notice '0081: sınıfsız yanıt — % satır (bu turdan önce toplananlar; yalnız tüm okul sonucunda görünürler)', n;
end $$;

-- -----------------------------------------------------------------------------
-- 2. "DERSİNE GİRDİĞİM SINIF" İŞARETİ
--
-- VARSAYILAN `true` VE BU BİLİNÇLİ: normal öğretmende `ogretmen_siniflari`
-- zaten tam olarak "kendi sınıfları" demek (sahip onları elle atıyor),
-- onlar için hiçbir şey değişmiyor. Yalnız SAHİP özel: 0033:92 bütün mevcut
-- sınıfları yöneticiye bağlamış, o yüzden hepsini görüyor.
--
-- SINIF GÖRME YETKİSİ DEĞİŞMİYOR. `_ogretmenin_sinifi` bu sütuna BAKMIYOR;
-- öğrenciler, ödevler, mesajlar, sınıf listesi — hepsi bugünkü gibi. Bu
-- bayrak yalnız anket kapsamında okunuyor. (Öğretmene sunulan "sınıf
-- atamamı gerçeğe çekelim" seçeneği tam bu yüzden reddedildi: o yol bütün
-- ekranlarda diğer sınıfları kapatırdı.)
-- -----------------------------------------------------------------------------
alter table public.ogretmen_siniflari
  add column if not exists dersine_giriyor boolean not null default true;

-- Bir öğretmenin derse girdiği, ARŞİVDE OLMAYAN sınıfları.
--
-- Arşiv dışarıda (0016'nın kuralı): arşivlenmiş sınıfın sekmesi çizilmiyor,
-- dolayısıyla "kendi sınıflarım" toplamına da girmiyor — yoksa sekmesi
-- olmayan bir sınıf toplamı sessizce şişirirdi. O yanıtlar tüm okul
-- sonucunda duruyor.
create or replace function public._dersine_girdigi_siniflar(p_ogretmen_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select os.sinif_id
    from public.ogretmen_siniflari os
    join public.siniflar s on s.id = os.sinif_id
   where os.ogretmen_id = p_ogretmen_id
     and os.dersine_giriyor
     and not s.arsiv;
$$;

-- -----------------------------------------------------------------------------
-- 3. YANIT YAZILIRKEN SINIF — `anket_yanitla`, İMZA AYNI (0007 tuzağı yok)
--    Kopya: 0076_anonim_anket.sql; tek değişiklik `v_sinif`.
-- -----------------------------------------------------------------------------
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
  v_sinif uuid;
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

  -- 0081 — SINIF HESAPTAN OKUNUYOR, SORULMUYOR.
  --
  -- Veli rolünde de `kimlik` ÇOCUĞUN kimliği (`_anket_yanitlayan`), yani
  -- velinin sınıfı çocuğunun sınıfı. Doğru olan bu: veli o sınıfın velisi.
  --
  -- ÖĞRETMEN YANITINDA NULL ve bu bilinçli: öğretmenin "sınıfı" yok ve
  -- olmamalı. Okulda 4 öğretmen var; yanıtı bir sınıfa bağlamak, kimin
  -- yazdığını doğrudan ele verirdi.
  if y.rol in ('ogrenci', 'veli') then
    select o.sinif_id into v_sinif from public.ogrenciler o where o.id = y.kimlik;
  end if;

  v_ozet := public._anket_ozeti(v_anket, y.rol, y.kimlik);
  begin
    insert into public.anket_katilimlari (anket, rol, kisi_ozeti) values (v_anket, y.rol, v_ozet);
  exception when unique_violation then
    raise exception 'Bu anketi zaten yanıtladınız. Teşekkür ederiz.' using errcode = '23505';
  end;
  insert into public.anket_yanitlari (anket, rol, cevaplar, hafta, sinif_id)
  values (v_anket, y.rol, temiz,
          date_trunc('week', (now() at time zone 'Europe/Istanbul'))::date,
          v_sinif);

  -- DENETİM İZİNE YAZILMIYOR (bilinçli): izin saati, oturumun "son görülme"
  -- saatiyle yan yana konunca yanıtı bir kişiye bağlayabilirdi.
  return jsonb_build_object('kaydedildi', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. SONUÇLAR — TEK FONKSİYON, KAPSAM PARAMETRESİ
--
-- 0007 TUZAĞI: imza değişiyor, yani bu YENİ bir fonksiyon. Eski tek
-- argümanlı sürüm yerinde bırakılsaydı PostgREST `{p_token}` çağrısını ona
-- çözerdi ve ekran eski (kapsamsız) sonucu görürdü. AÇIKÇA DÜŞÜRÜLÜYOR ve
-- düşürüldüğü öz-denetimde sayılıyor.
-- -----------------------------------------------------------------------------
drop function if exists public.anket_sonuclari(text);

create or replace function public.anket_sonuclari(
  p_token text,
  p_kapsam text default 'okul',
  p_sinif_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  -- 0077: ALT SINIR YOK (öğretmenin kararı). Tek yanıt da gösteriliyor.
  esik constant integer := 1;
  v_ogretmen uuid;
  v_mudur    boolean := false;
  v_sahip    boolean := false;
  -- Öğretmen grubu YALNIZ sahip ve müdüre (öğretmenin kararı).
  v_ogretmen_grubu boolean;
  -- true: süzgeç yok (tüm okul). false: yalnız `v_siniflar` içindekiler.
  v_tum      boolean := false;
  v_siniflar uuid[];
  v_sinif_ad text;
begin
  select * into o from public._oturum(p_token);
  if o.rol = 'mudur' then
    perform public._mudur(p_token);
    v_mudur := true;
  else
    -- `_ogretmen` sahibi de kabul ediyor; sahiplik ayrıca okunuyor.
    v_ogretmen := public._ogretmen(p_token);
    v_sahip := exists (select 1 from public.ogretmenler g
                        where g.id = v_ogretmen and g.yonetici);
  end if;

  if p_kapsam is null or p_kapsam not in ('okul', 'kendi', 'sinif') then
    raise exception 'Geçersiz kapsam.' using errcode = '22023';
  end if;

  if p_kapsam = 'okul' then
    v_tum := true;
  elsif p_kapsam = 'kendi' then
    if v_mudur then
      -- Müdür derse girmiyor; bu kapsamın onda karşılığı yok. Boş bir
      -- sonuç döndürmek "hiç yanıt yok" gibi okunurdu.
      raise exception 'Müdür hesabında "kendi sınıflarım" kapsamı yok.'
        using errcode = '42501';
    end if;
    v_siniflar := array(select public._dersine_girdigi_siniflar(v_ogretmen));
  else
    if p_sinif_id is null then
      raise exception 'Sınıf seçilmedi.' using errcode = '22023';
    end if;
    -- SINIF KAPISI. Müdür her sınıfı görebiliyor (0060); öğretmen YALNIZ
    -- derse girdiği sınıfı. B öğretmeni A'nın sınıf kimliğini eline
    -- geçirse bile buradan geçemiyor.
    if not v_mudur
       and not exists (select 1 from public._dersine_girdigi_siniflar(v_ogretmen) s
                        where s = p_sinif_id) then
      raise exception 'Bu sınıf derse girdiğiniz sınıflar arasında değil.'
        using errcode = '42501';
    end if;
    v_siniflar := array[p_sinif_id];
    select s.ad into v_sinif_ad from public.siniflar s where s.id = p_sinif_id;
  end if;

  -- DAR KAPSAMLARDA ÖĞRETMEN GRUBU HİÇ YOK: öğretmen yanıtı sınıf
  -- taşımıyor (taşımamalı), dolayısıyla sınıfa bölünemez.
  v_ogretmen_grubu := (v_sahip or v_mudur) and p_kapsam = 'okul';

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'anket', a.kod, 'baslik', a.baslik, 'acik', a.acik, 'esik', esik,
      'kapsam', p_kapsam,
      'sinif', case when p_kapsam = 'sinif'
                    then jsonb_build_object('id', p_sinif_id, 'ad', v_sinif_ad)
                    else null end,
      -- SINIFSIZ YANIT SAYISI yalnız genel kapsamda: dar kapsamda zaten
      -- dışarıda ve orada anmak kafa karıştırırdı. Ekranda yazılı —
      -- sessizce yok saymak toplamları tutmaz hâle getirirdi.
      --
      -- ÖĞRETMEN YANITLARI SAYILMIYOR. Onlar BİLEREK sınıfsız (yukarıya
      -- bakın); "atfedilemeyen yanıt" diye saymak sayıyı şişirir ve
      -- ekranda olmayan bir eksiklik gösterirdi. Burada sayılan yalnız
      -- 0081 ÖNCESİNDEN kalan, sınıfı artık bilinemeyecek öğrenci ve veli
      -- yanıtları. (Testin 8. grubu bunu ölçüyor ve kusuru o buldu.)
      'sinifsiz_yanit', case when p_kapsam = 'okul' then (
        select count(*) from public.anket_yanitlari y
         where y.anket = a.kod and y.sinif_id is null
           and y.rol in ('ogrenci', 'veli'))::integer else 0 end,
      'gruplar', (
        select jsonb_agg(jsonb_build_object(
          'rol', r.rol,
          -- `katilim` ARTIK `yanit` İLE AYNI SAYI ve bu bilinçli.
          --
          -- 0076'da `katilim` `anket_katilimlari`'ndan sayılıyordu; o tablo
          -- sınıf TAŞIMIYOR ve taşımamalı (kimlik özetini bir sınıfa
          -- bağlamak anonimliği bozardı). Dolayısıyla kapsama göre
          -- süzülemiyor. İki sayı zaten her zaman eşitti: katılım ve yanıt
          -- aynı işlemde bir kez yazılıyor. Alan, arayüz sözleşmesi
          -- bozulmasın diye duruyor.
          'katilim', r.n,
          'yanit', r.n,
          'yeterli', r.n >= esik,
          'maddeler', case when r.n < esik then '[]'::jsonb else (
            select jsonb_agg(jsonb_build_object(
              'madde', 'm' || i,
              'dagilim', (select jsonb_agg((select count(*) from public.anket_yanitlari y
                                             where y.anket = a.kod and y.rol = r.rol
                                               and (v_tum or y.sinif_id = any(v_siniflar))
                                               and (y.cevaplar ->> ('m' || i))::integer = v)
                                           order by v)
                            from generate_series(1, 5) v),
              'ortalama', (select round(avg((y.cevaplar ->> ('m' || i))::integer), 2)
                             from public.anket_yanitlari y
                            where y.anket = a.kod and y.rol = r.rol
                              and (v_tum or y.sinif_id = any(v_siniflar)))
            ) order by i)
            from generate_series(1, public._anket_madde_sayisi(r.rol)) i) end,
          -- Görüşler metin sırasına göre: yanıtlanma sırası bir ipucu olmasın.
          'gorusler', case when r.n < esik then '[]'::jsonb else coalesce((
            select jsonb_agg(y.cevaplar ->> 'acik' order by y.cevaplar ->> 'acik')
              from public.anket_yanitlari y
             where y.anket = a.kod and y.rol = r.rol
               and (v_tum or y.sinif_id = any(v_siniflar))
               and y.cevaplar ? 'acik'), '[]'::jsonb) end
        ) order by r.sira)
        from (select g.rol, g.sira,
                     (select count(*) from public.anket_yanitlari y
                       where y.anket = a.kod and y.rol = g.rol
                         and (v_tum or y.sinif_id = any(v_siniflar)))::integer as n
                from (values ('ogrenci', 1), ('veli', 2), ('ogretmen', 3)) g(rol, sira)
               where g.rol <> 'ogretmen' or v_ogretmen_grubu) r
      ),
      -- Ekranın sekmeleri bundan çiziliyor. Müdürde arşivde olmayan bütün
      -- sınıflar; öğretmende derse girdikleri.
      'secilebilir_siniflar', coalesce((
        select jsonb_agg(jsonb_build_object('id', s.id, 'ad', s.ad)
                         order by s.seviye, s.sube)
          from public.siniflar s
         where not s.arsiv
           and (v_mudur or s.id in (select public._dersine_girdigi_siniflar(v_ogretmen)))
      ), '[]'::jsonb)
    ) order by a.kod desc)
    from public.anketler a
  ), '[]'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. "DERSE GİRDİĞİM SINIFLAR" İŞARETİ — okuma ve yazma
-- -----------------------------------------------------------------------------

-- siniflar_listesi — kopya: 0073_deneme_hesabi.sql. İMZA AYNI; tek ek alan
-- `dersine_giriyor` (Ayarlar'daki işaret kutuları bunu okuyor).
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
                                 where o.sinif_id = s.id and (o.aktif and not o.deneme)),
             'dersine_giriyor', coalesce((select os.dersine_giriyor
                                            from public.ogretmen_siniflari os
                                           where os.ogretmen_id = v_ogretmen
                                             and os.sinif_id = s.id), false)
           ) order by s.seviye, s.sube)
    from public.siniflar s
    where (p_arsiv or not s.arsiv)
      and public._ogretmenin_sinifi(v_ogretmen, s.id)
  ), '[]'::jsonb);
end;
$$;

-- İşareti değiştirmek. Yalnız KENDİ bağlı sınıfı için: bir öğretmen
-- başkasının kapsamını belirleyemez.
create or replace function public.sinif_dersine_giriyor(
  p_token text, p_sinif_id uuid, p_deger boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  if p_sinif_id is null or p_deger is null then
    raise exception 'Eksik bilgi.' using errcode = '22023';
  end if;
  if not public._ogretmenin_sinifi(v_ogretmen, p_sinif_id) then
    raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
  end if;

  update public.ogretmen_siniflari
     set dersine_giriyor = p_deger
   where ogretmen_id = v_ogretmen and sinif_id = p_sinif_id;

  perform public._denetim('dersine_giriyor_degisti', 'ogretmen_siniflari',
                          p_sinif_id, public._aktor(v_ogretmen),
                          null, jsonb_build_object('deger', p_deger));
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. YETKİLER
-- -----------------------------------------------------------------------------
revoke all on function public._dersine_girdigi_siniflar(uuid) from public, anon, authenticated;
do $$
declare ad text;
begin
  foreach ad in array array['anket_sonuclari(text,text,uuid)',
                            'sinif_dersine_giriyor(text,uuid,boolean)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', ad);
    execute format('grant execute on function public.%s to anon, authenticated', ad);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 7. ÖZ-DENETİM
-- -----------------------------------------------------------------------------
do $$
declare eksik text[] := '{}';
begin
  -- 0007 TUZAĞI: eski tek argümanlı sürüm gerçekten gitti mi.
  if to_regprocedure('public.anket_sonuclari(text)') is not null then
    eksik := eksik || 'eski anket_sonuclari(text) duruyor — PostgREST onu çağırır'::text;
  end if;
  if to_regprocedure('public.anket_sonuclari(text,text,uuid)') is null then
    eksik := eksik || 'kapsamlı anket_sonuclari kurulmadı'::text;
  end if;

  -- Sütunlar.
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'anket_yanitlari'
                    and column_name = 'sinif_id') then
    eksik := eksik || 'anket_yanitlari.sinif_id yok'::text;
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'ogretmen_siniflari'
                    and column_name = 'dersine_giriyor') then
    eksik := eksik || 'ogretmen_siniflari.dersine_giriyor yok'::text;
  end if;

  -- ANONİMLİK: yanıt hâlâ kimlik ve saat taşımıyor (0076'nın güvencesi).
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'anket_yanitlari'
                and column_name in ('ogrenci_id', 'ogretmen_id', 'kisi_ozeti', 'created_at')) then
    eksik := eksik || 'anket_yanitlari kimlik ya da saat taşıyor'::text;
  end if;

  -- ALT SINIR hâlâ yok (0077'nin kararı bu turda değişmedi).
  if pg_get_functiondef('public.anket_sonuclari(text,text,uuid)'::regprocedure)
       not like '%esik constant integer := 1;%' then
    eksik := eksik || 'alt sınır geri geldi — 0077 ezildi'::text;
  end if;

  -- SINIF GÖRME YETKİSİ DEĞİŞMEDİ: `_ogretmenin_sinifi` bayrağa bakmamalı.
  if pg_get_functiondef('public._ogretmenin_sinifi(uuid,uuid)'::regprocedure)
       like '%dersine_giriyor%' then
    eksik := eksik || '_ogretmenin_sinifi bayrağa bakıyor — sınıf görme yetkisi daraldı'::text;
  end if;

  -- ÖĞRETMEN YANITI SINIF TAŞIMAMALI.
  if pg_get_functiondef('public.anket_yanitla(text,jsonb)'::regprocedure)
       not like '%y.rol in (''ogrenci'', ''veli'')%' then
    eksik := eksik || 'anket_yanitla sınıfı rol ayırmadan yazıyor'::text;
  end if;

  if array_length(eksik, 1) > 0 then
    raise exception '0081 eksik: %', array_to_string(eksik, ' | ');
  end if;
end $$;

select public._migration_kaydet('0081');
