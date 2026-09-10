-- =============================================================================
-- 0034 — VELİ ONAMI (uygulama içi açık rıza)
--
-- NE İSTENDİ
-- Öğretmen "onam formu hazır mı?" diye sordu; değildi. Kararı: onam
-- KÂĞIT DEĞİL, uygulama içinde alınacak; muhatabı VELİ; onaylamayan veli
-- panele GİREMEYECEK; onayın geri çekilmesi şimdilik YOK.
--
-- KAPI NEREDE
-- Sunucuda. Onam bir "gizle" işi değil: `display:none` ile kurulan sınır
-- sınır değildir (Part XXI). Bu yüzden veli jetonu kabul eden RPC'lerin
-- HEPSİ `_onam_kapisi()` çağırıyor. Liste sayımla çıkarıldı, tahminle
-- değil — `grant execute ... to anon` verilen 60 fonksiyonun her birinin
-- EN SON tanımı okundu ve veli jetonuyla çağrılabilenler ayrıldı:
--
--   veli_paneli        → hata vermiyor, `onam_gerekli` döndürüyor (aşağıda)
--   kendi_karnem       → kapı
--   mesaj_gonder       → kapı (veli dalı)
--   okundu_isaretle    → kapı
--   dosya_erisim_izni  → kapı
--   cikis              → KAPI YOK, bilerek. Onaylamayan veli en azından
--                        çıkabilmeli; çıkışı da kapatmak insanı ekranda
--                        kilitlemek olurdu.
--
-- `veli_paneli` NEDEN İSTİSNA
-- O da hata verseydi veli kabuğu (`VeliKabuk`, `useKendiOzet('veli_paneli')`)
-- çöker, veli onam metnini bile göremeden beyaz ekranla kalırdı. Bu yüzden
-- onam yokken YALNIZ `{'onam_gerekli': true, 'surum': …}` dönüyor —
-- çocuğa ait tek bir alan bile içinde olmadan. Kapı yine sunucuda; arayüz
-- sadece ne çizeceğini öğreniyor.
--
-- METİN NEREDE, SÜRÜM NEREDE
-- Metnin kendisi depoda (`app/src/lib/onam-metni.ts`) — statik site, ek
-- istek yok, geçmişi git'te. Veritabanına giren şey METNİN SÜRÜMÜ.
-- Sürüm sunucuda sabit: istemcinin gönderdiği sürüme güvenilmiyor,
-- yalnız eşleşme aranıyor.
--
-- Metin değişip sürüm sabit kalsaydı eski onaylar yeni metni SESSİZCE
-- kapsardı. Bunu engelleyen ölçüm arayüz tarafında: `onam-metni.test.ts`
-- metnin hash'ini kilitliyor, metin değişince test kırmızı oluyor ve
-- sürümü bilerek yükseltmek gerekiyor.
--
-- BU MİGRATION ÇALIŞTIĞI AN onam vermemiş bütün veliler panel dışında
-- kalır. Öğretmen bunu bilerek seçti; kimin beklediğini Veliler ekranında
-- görüyor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABLO
--
-- Onam kaydı SİLİNMİYOR, üzerine yazılmıyor. `unique (ogrenci_id,
-- metin_surumu)`: aynı veli aynı sürümü iki kez onaylayamaz, ama metin
-- yeni sürüme geçerse yeni bir satır gerekir — eski satır da durur.
-- "Hangi metni, ne zaman onayladı" sorusunun cevabı böyle kalıcı oluyor.
-- -----------------------------------------------------------------------------
create table if not exists public.veli_onaylari (
  id           uuid primary key default gen_random_uuid(),
  ogrenci_id   uuid not null references public.ogrenciler(id) on delete cascade,
  metin_surumu text not null check (btrim(metin_surumu) <> ''),
  onay_zamani  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (ogrenci_id, metin_surumu)
);

create index if not exists veli_onaylari_ogrenci_idx
  on public.veli_onaylari (ogrenci_id);

alter table public.veli_onaylari enable row level security;
alter table public.veli_onaylari force row level security;

-- Politika YOK: erişim yalnız `security definer` fonksiyonlardan.
revoke all on table public.veli_onaylari from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. GEÇERLİ SÜRÜM — tek yerde
--
-- Sunucu otorite. `app/src/lib/onam-metni.ts` içindeki `ONAM_SURUMU` ile
-- AYNI olmak zorunda; `onam_testleri.sql` ve `onam-metni.test.ts` ikisini
-- de ayrı ayrı ölçüyor.
-- -----------------------------------------------------------------------------
create or replace function public._gecerli_onam_surumu()
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select '2026-09-2'::text;
$$;

-- -----------------------------------------------------------------------------
-- 3. KAPI
--
-- YALNIZ VELİ İÇİN. Öğrenci ve öğretmen buradan dokunulmadan geçiyor —
-- `kendi_karnem` ve `okundu_isaretle` iki rol tarafından da kullanılıyor;
-- kapıyı role bakmadan kursaydık onam, öğrencinin karnesini de kapatırdı.
-- `onam_testleri.sql` bunu ayrı bir NEGATİF KONTROL olarak ölçüyor.
-- -----------------------------------------------------------------------------
create or replace function public._onam_kapisi(p_rol text, p_ogrenci_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if p_rol <> 'veli' then
    return;
  end if;

  if not exists (
    select 1 from public.veli_onaylari v
    where v.ogrenci_id = p_ogrenci_id
      and v.metin_surumu = public._gecerli_onam_surumu()
  ) then
    raise exception 'Devam etmek için onam metnini onaylamanız gerekiyor.'
      using errcode = '42501';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. ONAM VERME
--
-- Sürüm eşleşmesi aranıyor: istemci eski bir sürümü onaylamış gibi
-- gönderemesin. `on conflict do nothing` — iki kez basmak ikinci satır
-- açmıyor, ilk onayın zamanı korunuyor.
-- -----------------------------------------------------------------------------
create or replace function public.onam_ver(p_token text, p_surum text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
begin
  select * into o from public._oturum(p_token);

  if o.rol <> 'veli' then
    raise exception 'Bu işlem yalnızca veliler içindir.' using errcode = '42501';
  end if;
  if o.ogrenci_id is null then
    raise exception 'Geçersiz oturum.' using errcode = '42501';
  end if;

  if coalesce(btrim(p_surum), '') <> public._gecerli_onam_surumu() then
    raise exception 'Onam metni güncellenmiş. Sayfayı yenileyip yeniden okuyun.'
      using errcode = '22023';
  end if;

  insert into public.veli_onaylari (ogrenci_id, metin_surumu)
  values (o.ogrenci_id, public._gecerli_onam_surumu())
  on conflict (ogrenci_id, metin_surumu) do nothing;

  -- Denetim izi (Part XLIII): onamın ne zaman verildiği ürünün kendi
  -- kaydında da duruyor, yalnız tabloda değil.
  perform public._denetim(
    'onam_verildi', 'veli_onaylari', o.ogrenci_id, 'veli',
    null, jsonb_build_object('surum', public._gecerli_onam_surumu())
  );

  return jsonb_build_object('onayli', true, 'surum', public._gecerli_onam_surumu());
end;
$$;

-- =============================================================================
-- 5. MEVCUT RPC'LERE KAPI
--
-- Aşağıdaki beş gövde ELLE YAZILMADI: her birinin en son tanımı
-- (`kendi_karnem`/`veli_paneli` 0029, `mesaj_gonder`/`okundu_isaretle`
-- 0033, `dosya_erisim_izni` 0009) olduğu gibi alındı ve `_oturum`
-- çağrısının hemen ardına tek satır eklendi. Elle kopyalasaydık sessiz
-- bir sürüklenme riski olurdu.
-- =============================================================================

-- kendi_karnem — 0029'daki gövde + kapı
-- --------------------------------------------------------------------------

create or replace function public.kendi_karnem(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun_tr      date := (now() at time zone 'Europe/Istanbul')::date;
  o             record;
  v_ogrenci_id  uuid;
  v_ad          text;
  v_sinif_id    uuid;
  v_sinif_ad    text;
  v_odev_sayisi integer;
begin
  select * into o from public._oturum(p_token);
  -- ONAM KAPISI (0034). Veli dışındaki rollerde etkisiz: bu iki uç
  -- öğrenci tarafından da kullanılıyor.
  perform public._onam_kapisi(o.rol, o.ogrenci_id);

  -- ÖĞRETMEN BURAYA GİRMİYOR. Onun ucu `konu_karnesi` ve orada sınıf ya da
  -- öğrenci seçebiliyor; burada seçilecek bir şey yok.
  if o.rol not in ('ogrenci', 'veli') then
    raise exception 'Bu bölüm öğrenci ve veli içindir.' using errcode = '42501';
  end if;
  if o.ogrenci_id is null then
    raise exception 'Geçersiz oturum.' using errcode = '42501';
  end if;

  v_ogrenci_id := o.ogrenci_id;

  select g.ad, g.sinif_id into v_ad, v_sinif_id
    from public.ogrenciler g where g.id = v_ogrenci_id;
  if v_ad is null then
    raise exception 'Öğrenci bulunamadı.' using errcode = 'P0002';
  end if;

  select s.ad into v_sinif_ad from public.siniflar s where s.id = v_sinif_id;

  -- 0013 VE 0023 İLE BİREBİR AYNI ÖLÇÜT.
  select count(*)::integer into v_odev_sayisi
  from public.odevler d
  where d.sinif_id = v_sinif_id and d.yayinda and d.son_tarih < bugun_tr;

  return jsonb_build_object(
    -- `mevcut` YOK (0023'te var). Sınıfın kaç kişi olduğu bu ekrana ait
    -- değil; kıyasın en küçük tohumu bile gönderilmiyor.
    'kapsam', jsonb_build_object('ad', v_ad, 'sinif', v_sinif_ad),

    -- "Kaç ödev üzerinden konuşuyoruz" — iki konu arasındaki farkı
    -- yorumlayabilmek için gereken tek bağlam sayısı.
    'odev_sayisi', v_odev_sayisi,

    -- GENEL ORTALAMA (0029) — YALNIZ ÇOCUĞUN KENDİSİ.
    --
    -- Sınıf ortalaması, sıralama, başka öğrencinin verisi BURAYA DA
    -- eklenmiyor; 0026'da bilerek dışarıda bırakılmışlardı ve o karar
    -- değişmedi. Çocuk kendi gidişatını görüyor, kimseyle
    -- karşılaştırılmıyor.
    --
    -- GÖNDERİLMEYEN ÖDEV 0 OLARAK GİRMİYOR. Tanıtım metninin kendi
    -- cümlesi bunu söylüyor: "Yapılmayan ödevler puanlandırılmaz."
    -- Puanlanmamış bir işi ortalamaya sıfırla katmak, öğrenciyi
    -- yapmadığı bir sınavdan kalmış gibi gösterirdi.
    --
    -- Ölçüt `kendi_karnem.odev_sayisi` ile aynı pencereyi kullanıyor
    -- (yayında + süresi dolmuş) ki ekrandaki "N değerlendirilmiş ödev
    -- üzerinden" satırıyla aynı şeyden söz etsin.
    --
    -- Puan `coalesce(ogretmen_puan, puan)`: arayüzdeki ve
    -- `sinif_ogrencileri`'ndeki hesabın aynısı.
    'genel_ortalama', (
      select round(avg(coalesce(g2.ogretmen_puan, g2.puan)), 1)
        from public.gonderimler g2
        join public.odevler d2 on d2.id = g2.odev_id
       where g2.ogrenci_id = v_ogrenci_id
         and d2.sinif_id = v_sinif_id
         and d2.yayinda
         and d2.son_tarih < bugun_tr
         and coalesce(g2.ogretmen_puan, g2.puan) is not null
    ),

    -- -----------------------------------------------------------------
    -- KONU DÖKÜMÜ — yalnız TEST ödevlerinden (0023 ile aynı gerekçe)
    --
    -- Açık uçlu ödevin konu eşlemesi yok: anahtarı olmayan bir ödevde
    -- `_konu_analizi` her soruyu "boş" sayardı ve döküm, öğretmenin hiç
    -- sormadığı bir soruya uydurma bir cevap verirdi.
    --
    -- Sıralama da aynı: en çok eksik olan konu başta. Arayüz bu sırayı
    -- bozmuyor — bozsaydı "en zayıf konu" iddiası ekrandan ekrana
    -- değişebilirdi.
    -- -----------------------------------------------------------------
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
        cross join lateral jsonb_array_elements(
          public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
        ) e
        where d.sinif_id = v_sinif_id
          and d.yayinda
          and d.son_tarih < bugun_tr
          and d.tur = 'test'
          -- TEK BAĞ: kendi gönderimleri. Başka öğrencinin cevabı bu
          -- toplama hiçbir koşulda giremez.
          and g.ogrenci_id = v_ogrenci_id
        group by e->>'konu'
      ) t
    ), '[]'::jsonb),

    -- -----------------------------------------------------------------
    -- GELİŞİM — ödev ödev, kronolojik
    --
    -- AÇIK UÇLU ÖDEV BURADA VAR: konu eşlemesi yok ama puanı var, ve
    -- "dönem boyunca nereye gidiyorum" sorusunun cevabından açık uçlu
    -- ödevleri çıkarmak resmin yarısını silerdi.
    --
    -- GÖNDERİLMEYEN ÖDEV 0 DEĞİL, BOŞ (`deger: null`). Sıfır yazmak
    -- "sıfır aldı" demektir; göndermemek başka bir şeydir.
    --
    -- `gonderen` VE `mevcut` YOK (0023'te var). Onlar sınıf bilgisi;
    -- burada "kaç kişiden kaçı gönderdi" demek kıyas kapısını açardı.
    -- `Gelisim` bileşeni `kapsam='ogrenci'` iken o alanları zaten
    -- çizmiyor (ölçüldü), yani ekranda bir eksiklik oluşmuyor.
    --
    -- HİÇBİR EĞİLİM İDDİASI YOK: ne "yükseliyor" ne "düşüyor". Üç
    -- noktadan yön çıkarmak ölçemeyeceğim bir iddia olurdu.
    -- -----------------------------------------------------------------
    'gelisim', coalesce((
      select jsonb_agg(jsonb_build_object(
               'odev', d.baslik,
               'tarih', d.son_tarih,
               'tur', d.tur,
               'deger', i.deger)
             order by d.son_tarih, d.baslik)
      from public.odevler d
      cross join lateral (
        select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1) as deger
        from public.gonderimler g
        where g.odev_id = d.id and g.ogrenci_id = v_ogrenci_id
      ) i
      where d.sinif_id = v_sinif_id
        and d.yayinda
        and d.son_tarih < bugun_tr
    ), '[]'::jsonb)
  );
end;
$$;

-- okundu_isaretle — 0033'teki gövde + kapı
-- --------------------------------------------------------------------------

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
  -- ONAM KAPISI (0034). Veli dışındaki rollerde etkisiz: bu iki uç
  -- öğrenci tarafından da kullanılıyor.
  perform public._onam_kapisi(o.rol, o.ogrenci_id);
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

-- mesaj_gonder — 0033'teki gövde + kapı
-- --------------------------------------------------------------------------

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
  -- DEĞİŞKEN ADI SÜTUN ADIYLA AYNI OLMAMALI. `kanal` desem, PL/pgSQL onu
  -- `insert ... on conflict (…, kanal)` gibi yerlerde sütunla karıştırıp
  -- "column reference is ambiguous" hatası veriyor (ölçüldü).
  v_kanal text;
  v_ogretmen uuid;
begin
  select * into o from public._oturum(p_token);
  -- ONAM KAPISI (0034). Veli dışındaki rollerde etkisiz: bu iki uç
  -- öğrenci tarafından da kullanılıyor.
  perform public._onam_kapisi(o.rol, o.ogrenci_id);

  if o.rol = 'ogretmen' then
    if p_ogrenci_id is null then
      raise exception 'Mesajın gideceği öğrenci seçilmeli.' using errcode = '22023';
    end if;
    if coalesce(p_kanal, '') not in ('veli', 'ogrenci') then
      raise exception 'Yazışma ''veli'' ya da ''ogrenci'' olmalı.' using errcode = '22023';
    end if;
    -- VEKÂLETTE MESAJ YASAK — öğretmenin kararı. Sahip başka bir
    -- öğretmenin hesabındayken her şeyi görüp düzeltebiliyor, ama o kişi
    -- ADINA mesaj yazamıyor: bir veli, öğretmeninin yazdığını sandığı bir
    -- mesajı başkasından almış olmamalı.
    if o.vekil_id is not null then
      raise exception 'Başka bir öğretmenin hesabındayken onun adına mesaj gönderemezsiniz. '
                      'Kendi hesabınıza dönün.'
        using errcode = '42501';
    end if;

    -- Öğretmen yalnız KENDİ öğrencisine yazabilir.
    perform public._ogrenci_sahibi(o.ogretmen_id, p_ogrenci_id);
    hedef      := p_ogrenci_id;
    kimden     := 'ogretmen';
    v_kanal    := p_kanal;
    v_ogretmen := o.ogretmen_id;
  elsif o.rol = 'veli' then
    -- Veli yalnız kendi öğrencisi adına yazabilir; parametre yok sayılır.
    hedef      := o.ogrenci_id;
    kimden     := 'veli';
    v_kanal    := 'veli';
    v_ogretmen := public._ogrencinin_ogretmeni(o.ogrenci_id);
  elsif o.rol = 'ogrenci' then
    -- ÖĞRENCİ ARTIK YAZABİLİYOR — ama yalnız kendi yazışmasına.
    hedef      := o.ogrenci_id;
    kimden     := 'ogrenci';
    v_kanal    := 'ogrenci';
    v_ogretmen := public._ogrencinin_ogretmeni(o.ogrenci_id);
  else
    raise exception 'Bu bölümde mesaj gönderemezsiniz.' using errcode = '42501';
  end if;

  -- DEĞİŞEN SATIR (0027): ikinci argüman olmadan sekme ve satır sonu
  -- kırpılmıyordu; yalnız boşluktan oluşan mesaj buradan geçiyordu.
  if length(btrim(coalesce(p_metin, ''), E' \t\r\n')) = 0 then
    raise exception 'Mesaj boş olamaz.' using errcode = '22023';
  end if;

  -- DEĞİŞEN SATIR (0027): baştaki/sondaki satır sonları da kırpılıyor.
  -- İÇERİDEKİ satır sonlarına dokunulmuyor — çok satırlı mesaj meşru.
  insert into public.mesajlar (ogrenci_id, kimden, metin, kanal, ogretmen_id)
  values (hedef, kimden, btrim(p_metin, E' \t\r\n'), v_kanal, v_ogretmen);

  return jsonb_build_object('durum', 'tamam');
end;
$function$;

-- dosya_erisim_izni — 0009'daki gövde + kapı
-- --------------------------------------------------------------------------

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
  -- ONAM KAPISI (0034). Veli dışındaki rollerde etkisiz: bu iki uç
  -- öğrenci tarafından da kullanılıyor.
  perform public._onam_kapisi(o.rol, o.ogrenci_id);

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

-- veli_paneli — 0029'daki gövde + erken dönüş
-- --------------------------------------------------------------------------

create or replace function public.veli_paneli(p_token text)
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
  if o.rol <> 'veli' then
    raise exception 'Bu bölüm yalnızca veliler içindir.' using errcode = '42501';
  end if;

  -- ONAM KAPISI (0034) — BURADA HATA DEĞİL, ERKEN DÖNÜŞ.
  --
  -- Bu uç hata verseydi veli kabuğu çöker, veli onam metnini bile
  -- göremeden beyaz ekranda kalırdı. Bunun yerine çocuğa ait TEK BİR
  -- ALAN bile okunmadan dönülüyor: aşağıdaki `select ... into ogr` hiç
  -- çalışmıyor. Kapı yine sunucuda; arayüz sadece ne çizeceğini
  -- öğreniyor.
  if not exists (
    select 1 from public.veli_onaylari v
    where v.ogrenci_id = o.ogrenci_id
      and v.metin_surumu = public._gecerli_onam_surumu()
  ) then
    return jsonb_build_object(
      'onam_gerekli', true,
      'surum', public._gecerli_onam_surumu()
    );
  end if;

  select ogr2.id, ogr2.ad, ogr2.tur, s.ad as sinif, ogr2.sinif_id into ogr
  from public.ogrenciler ogr2
  left join public.siniflar s on s.id = ogr2.sinif_id
  where ogr2.id = o.ogrenci_id;

  return jsonb_build_object(
    'ogrenci', jsonb_build_object('ad', ogr.ad, 'sinif', ogr.sinif, 'tur', ogr.tur),

    -- GENEL ORTALAMA (0029) — YALNIZ ÇOCUĞUN KENDİSİ.
    --
    -- Sınıf ortalaması, sıralama, başka öğrencinin verisi BURAYA DA
    -- eklenmiyor; 0026'da bilerek dışarıda bırakılmışlardı ve o karar
    -- değişmedi. Çocuk kendi gidişatını görüyor, kimseyle
    -- karşılaştırılmıyor.
    --
    -- GÖNDERİLMEYEN ÖDEV 0 OLARAK GİRMİYOR. Tanıtım metninin kendi
    -- cümlesi bunu söylüyor: "Yapılmayan ödevler puanlandırılmaz."
    -- Puanlanmamış bir işi ortalamaya sıfırla katmak, öğrenciyi
    -- yapmadığı bir sınavdan kalmış gibi gösterirdi.
    --
    -- Ölçüt `kendi_karnem.odev_sayisi` ile aynı pencereyi kullanıyor
    -- (yayında + süresi dolmuş) ki ekrandaki "N değerlendirilmiş ödev
    -- üzerinden" satırıyla aynı şeyden söz etsin.
    --
    -- Puan `coalesce(ogretmen_puan, puan)`: arayüzdeki ve
    -- `sinif_ogrencileri`'ndeki hesabın aynısı.
    'genel_ortalama', (
      select round(avg(coalesce(g2.ogretmen_puan, g2.puan)), 1)
        from public.gonderimler g2
        join public.odevler d2 on d2.id = g2.odev_id
       where g2.ogrenci_id = ogr.id
         and d2.sinif_id = ogr.sinif_id
         and d2.yayinda
         and d2.son_tarih < (now() at time zone 'Europe/Istanbul')::date
         and coalesce(g2.ogretmen_puan, g2.puan) is not null
    ),
    'odevler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'baslik', d.baslik,
        'son_tarih', d.son_tarih,
        'olusturma', d.created_at,
        'gonderildi', (g.id is not null),
        'gonderim_zamani', g.created_at,
        'puan', coalesce(g.ogretmen_puan, g.puan),
        'durum', g.durum,
        'konu_analizi', case when g.id is not null
          then public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
          else '[]'::jsonb end,
        -- VELİYE YALNIZ NUMARA. Şık gitmiyor (Kural 6).
        'yanlis_sorular', case when g.id is not null and d.tur = 'test'
          then public._soru_dokumu(d.cevap_anahtari, g.cevaplar, d.soru_sayisi) -> 'yanlis'
          else '[]'::jsonb end,
        'bos_sorular', case when g.id is not null and d.tur = 'test'
          then public._soru_dokumu(d.cevap_anahtari, g.cevaplar, d.soru_sayisi) -> 'bos'
          else '[]'::jsonb end
      ) order by d.son_tarih desc)
      from public.odevler d
      left join public.gonderimler g
        on g.odev_id = d.id and g.ogrenci_id = ogr.id
      where d.yayinda and d.sinif_id = ogr.sinif_id
    ), '[]'::jsonb),
    -- YALNIZ VELİ YAZIŞMASI. Öğrencinin öğretmenle yazdıkları buradan
    -- ÇIKMIYOR: çocuk da öğretmenine velisinin okumayacağını varsayarak
    -- yazıyor. Ayrım tabloda, arayüzde değil.
    'mesajlar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kimden', m.kimden, 'metin', m.metin, 'zaman', m.created_at)
             order by m.created_at)
      from public.mesajlar m
      where m.ogrenci_id = ogr.id and m.kanal = 'veli'
    ), '[]'::jsonb),
    'okunmamis_mesaj', (
      select count(*)::integer from public.mesajlar m
      where m.ogrenci_id = ogr.id and m.kanal = 'veli' and m.kimden = 'ogretmen'
        and m.created_at > coalesce(
              (select k.zaman from public.okundu k
                where k.ogrenci_id = ogr.id and k.rol = 'veli' and k.kanal = 'veli'),
              '-infinity'::timestamptz)
    ),
    'odemeler', case when ogr.tur = 'ozel' then coalesce((
      select jsonb_agg(jsonb_build_object('tutar', p.tutar, 'tarih', p.tarih, 'odendi', p.odendi)
                       order by p.tarih desc)
      from public.odemeler p where p.ogrenci_id = ogr.id
    ), '[]'::jsonb) else '[]'::jsonb end,
    -- KANAL SÜZGECİ DE ŞART. 0019'da rol süzgeci unutulunca alt sorgu üç
    -- satır dönüp fonksiyon çökmüştü; anahtar üç sütuna çıkınca aynı tuzak
    -- kanal için yeniden kuruluyor.
    'son_gorulme', (select k.zaman from public.okundu k
                     where k.ogrenci_id = ogr.id and k.rol = 'veli' and k.kanal = 'veli')
  );
end;
$$;

-- sinif_velileri — 0033'teki gövde + onam durumu
-- --------------------------------------------------------------------------

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
               -- ONAM DURUMU (0034). Onaylamayan veli panele giremiyor;
               -- öğretmen kimin beklediğini buradan görüyor. SALT OKUNUR:
               -- öğretmen onamı ne verebilir ne geri alabilir — onam
               -- velinin kendi iradesi, başkası adına tıklanamaz.
               'onam_var', exists (select 1 from public.veli_onaylari v
                                    where v.ogrenci_id = o.id
                                      and v.metin_surumu = public._gecerli_onam_surumu()),
               -- Veli kodu yoksa veli hiç giriş yapamaz; öğretmen bunu
               -- mesaj yazmadan önce bilsin.
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

-- disa_aktar — 0033'teki gövde + veli_onaylari
-- --------------------------------------------------------------------------

create or replace function public.disa_aktar(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid;
begin
  -- Yedek BÜTÜN sistemi indiriyor: bir öğretmenin meslektaşlarının
  -- verisini tek dosyada indirmesi kabul edilemez. Sahipte.
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
    -- ONAM YEDEĞE GİRİYOR (0034). Girmeseydi bir geri yüklemeden sonra
    -- BÜTÜN veliler yeniden onam vermek zorunda kalırdı — verilmiş bir
    -- rızayı kaybetmek, kaydı hiç tutmamak kadar kötü.
    'veli_onaylari', coalesce((select jsonb_agg(to_jsonb(v)) from public.veli_onaylari v), '[]'::jsonb),
    'odevler',   coalesce((select jsonb_agg(to_jsonb(d)) from public.odevler d), '[]'::jsonb),
    'gonderimler', coalesce((select jsonb_agg(to_jsonb(g)) from public.gonderimler g), '[]'::jsonb),
    'mesajlar',  coalesce((select jsonb_agg(to_jsonb(m)) from public.mesajlar m), '[]'::jsonb),
    'dersler',   coalesce((select jsonb_agg(to_jsonb(l)) from public.dersler l), '[]'::jsonb),
    'odemeler',  coalesce((select jsonb_agg(to_jsonb(p)) from public.odemeler p), '[]'::jsonb),
    'ewalu_mesajlari', coalesce((select jsonb_agg(to_jsonb(e) order by e.bant desc) from public.ewalu_mesajlari e), '[]'::jsonb)
  );
end;
$$;

-- =============================================================================
-- 6. YETKİLER
--
-- Yeni uç yalnız `onam_ver`. Kapı fonksiyonları (`_` ile başlayanlar)
-- dışarıya AÇILMIYOR: `anon` onları çağırıp kapıyı yoklayamaz.
--
-- REVOKE UNUTULURSA SESSİZCE AÇIK KALIR. PostgreSQL yeni bir fonksiyonun
-- EXECUTE hakkını varsayılan olarak PUBLIC'e verir; `anon` da PUBLIC'in
-- içindedir. Yani "grant yazmadım, demek ki kapalı" YANLIŞTIR — bu iki
-- satır olmadan `_onam_kapisi` dışarıdan çağrılabilir ve bir öğrencinin
-- kimliğini bilen biri onam durumunu yoklayabilirdi.
--
-- Bu, ilk yazımda gerçekten atlandı ve `guvenlik_denetimi.sql` 1a grubu
-- yakaladı ("_onam_kapisi → HATA VERMEDİ"). Denetim tam da bunun için var.
-- =============================================================================
revoke all on function public._gecerli_onam_surumu()      from public, anon, authenticated;
revoke all on function public._onam_kapisi(text, uuid)    from public, anon, authenticated;

revoke all on function public.onam_ver(text, text) from public, anon, authenticated;
grant execute on function public.onam_ver(text, text) to anon, authenticated;

-- =============================================================================
-- 7. KENDİ KENDİNİ DOĞRULAMA
--
-- Migration çalıştıktan sonra kapının GERÇEKTEN yerinde olduğunu ölçüyor.
-- `create or replace` sessizce eski tanımı bırakabilir; o yüzden burada
-- fonksiyonların KAYNAĞINA bakılıyor, varlığına değil.
-- =============================================================================
do $$
declare
  eksik text[] := '{}';
  f     text;
begin
  if to_regclass('public.veli_onaylari') is null then
    eksik := eksik || 'veli_onaylari tablosu yok'::text;
  end if;

  foreach f in array array['_gecerli_onam_surumu', '_onam_kapisi', 'onam_ver'] loop
    if (select count(*) from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = f) <> 1 then
      eksik := eksik || (f || ' fonksiyonu yok')::text;
    end if;
  end loop;

  -- Kapı satırı dört uçta da duruyor mu?
  foreach f in array array['kendi_karnem', 'okundu_isaretle',
                           'mesaj_gonder', 'dosya_erisim_izni'] loop
    if not exists (
      select 1 from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = f
        and pg_get_functiondef(p.oid) like '%_onam_kapisi%'
    ) then
      eksik := eksik || (f || ' kapısız kalmış')::text;
    end if;
  end loop;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'veli_paneli'
      and pg_get_functiondef(p.oid) like '%onam_gerekli%'
  ) then
    eksik := eksik || 'veli_paneli erken dönüşü yok'::text;
  end if;

  -- YEDEK ZİNCİRİ. 0033'ün kusuru buydu; bir daha sessizce geçmesin.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'disa_aktar'
      and pg_get_functiondef(p.oid) like '%veli_onaylari%'
  ) then
    eksik := eksik || 'disa_aktar onamı yedeklemiyor'::text;
  end if;

  -- Yardımcılar DIŞARIYA KAPALI mı? (Varsayılan PUBLIC hakkı gerçekten
  -- düştü mü — "revoke yazdım" ile "kapandı" aynı şey değil.)
  if has_function_privilege('anon', 'public._onam_kapisi(text, uuid)', 'execute') then
    eksik := eksik || '_onam_kapisi anon''a açık kalmış'::text;
  end if;
  if has_function_privilege('anon', 'public._gecerli_onam_surumu()', 'execute') then
    eksik := eksik || '_gecerli_onam_surumu anon''a açık kalmış'::text;
  end if;
  if not has_function_privilege('anon', 'public.onam_ver(text, text)', 'execute') then
    eksik := eksik || 'onam_ver anon''a kapalı — veli onam veremez'::text;
  end if;

  if array_length(eksik, 1) is not null then
    raise exception '0034 EKSİK KALDI: %', array_to_string(eksik, ' | ');
  end if;

  raise notice '0034 tamam — veli onamı kuruldu, sürüm %', public._gecerli_onam_surumu();
end;
$$;
