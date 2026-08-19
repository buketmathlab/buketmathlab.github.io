-- =============================================================================
-- SEKİZ — 0025 İKİ AYRI YAZIŞMA: ÖĞRENCİ↔ÖĞRETMEN, VELİ↔ÖĞRETMEN
--
-- ÖĞRETMENİN İSTEĞİ, KENDİ SÖZLERİYLE:
--   "Mesajlar kısmında öğrenci öğretmenle veli öğretmenle olacak şekilde"
--   "Öğretmen girişinde öğrenci ile mesajlaşma bölümünü öğrenciler kısmına ekle"
--
-- -----------------------------------------------------------------------------
-- NEDEN ŞEMA DEĞİŞİYOR — MAHREMİYET, ARAYÜZ TERCİHİ DEĞİL
--
-- Bugün `mesajlar` tablosunda öğrenci başına TEK bir akış var
-- (`kimden in ('ogretmen','veli')`). Öğrenciye "Mesajlar" sekmesi açıp bu
-- akışı olduğu gibi gösterseydik, çocuk VELİSİNİN öğretmenle yazdıklarını
-- okurdu — "Ali son zamanlarda çok tembelleşti, ne yapmalıyız?" gibi
-- cümleleri. Veli, çocuğu okumayacağını varsayarak yazıyor.
--
-- Sınırı arayüzde çizmek yetmez: gizlenen veri gönderilmiş veridir
-- (Part XXI). Bu yüzden ayrım TABLODA: her mesaj hangi yazışmaya ait
-- olduğunu `kanal` sütununda taşıyor ve okuma uçları o sütuna göre
-- süzüyor. Öğrencinin ucundan velinin mesajı HİÇ ÇIKMIYOR.
--
-- -----------------------------------------------------------------------------
-- `okundu` ANAHTARINA `kanal` EKLENİYOR — VE BU ZORUNLU
--
-- Öğretmenin artık öğrenci başına İKİ yazışması var. Okuma işareti tek
-- satır kalsaydı, veli yazışmasını okumak öğrencininkini de "okundu"
-- sayardı: çocuğun mesajı rozetten düşer, öğretmen onu hiç görmezdi.
--
-- 0019 aynı hatayı bir kez yaptı (o zaman anahtar yalnız `ogrenci_id`'ydi
-- ve veli ile öğrenci birbirinin kaydını eziyordu). Aynı sınıftan bir hata
-- iki kez yapılmasın diye anahtar bu turda üç sütuna çıkıyor.
--
-- -----------------------------------------------------------------------------
-- ÜÇ İMZA DEĞİŞİYOR — 0007 TUZAĞI
--
-- `mesaj_gonder`, `ogretmen_okudu`, `mesajlar_ogretmen` artık kanalı
-- bilmek zorunda. PostgreSQL'de parametre eklemek YENİ bir fonksiyon
-- üretir; eski imza EXECUTE yetkisiyle ayakta kalır ve arayüz farkında
-- olmadan KANALSIZ eski davranışı çağırmayı sürdürebilir. Eskiler açıkça
-- `drop` ediliyor ve testte `to_regprocedure` ile düştükleri ölçülüyor.
--
-- Gövdesi değişen her uç KAYNAĞINDAN BİREBİR KOPYALANDI. 0016'da ezberden
-- yazmak iki gerçek hataya yol açmıştı (`foto_yolu` yerine `foto_url`,
-- parametre sırası değişikliği); o yol bir daha kullanılmıyor.
--
-- Bu dosya tekrar çalıştırılabilir.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ŞEMA
-- -----------------------------------------------------------------------------
do $$
begin
  -- mesajlar.kanal — hangi yazışma.
  --
  -- Varsayılan 'veli': bugüne kadar yazılmış her mesaj veli yazışmasıdır.
  -- Ayrı bir veri dönüşümü gerekmiyor, mevcut satırlar doğru yere düşüyor.
  alter table public.mesajlar add column if not exists kanal text not null default 'veli';

  alter table public.mesajlar drop constraint if exists mesajlar_kanal_check;
  alter table public.mesajlar
    add constraint mesajlar_kanal_check check (kanal in ('veli', 'ogrenci'));

  -- kimden'e 'ogrenci' ekleniyor: öğrenci bugüne kadar hiç yazamıyordu.
  alter table public.mesajlar drop constraint if exists mesajlar_kimden_check;
  alter table public.mesajlar
    add constraint mesajlar_kimden_check check (kimden in ('ogretmen', 'veli', 'ogrenci'));

  -- okundu.kanal
  alter table public.okundu add column if not exists kanal text not null default 'veli';

  -- Mevcut satırların taşınması: veli ve öğretmen işaretleri veli
  -- yazışmasına aitti; öğrencinin işareti (varsa) kendi yazışmasına.
  update public.okundu set kanal = 'ogrenci' where rol = 'ogrenci' and kanal <> 'ogrenci';

  alter table public.okundu drop constraint if exists okundu_kanal_check;
  alter table public.okundu
    add constraint okundu_kanal_check check (kanal in ('veli', 'ogrenci'));

  -- Birincil anahtar (ogrenci_id, rol) → (ogrenci_id, rol, kanal)
  if exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.okundu'::regclass and c.contype = 'p'
      and (select count(*) from unnest(c.conkey)) = 2
  ) then
    alter table public.okundu drop constraint okundu_pkey;
    alter table public.okundu add primary key (ogrenci_id, rol, kanal);
    raise notice 'okundu birincil anahtarı (ogrenci_id, rol, kanal) yapıldı.';
  end if;
end $$;

create index if not exists mesajlar_kanal_idx
  on public.mesajlar (ogrenci_id, kanal, created_at desc);

-- -----------------------------------------------------------------------------
-- 2. ESKİ İMZALAR DÜŞÜYOR (0007 tuzağı)
-- -----------------------------------------------------------------------------
drop function if exists public.mesaj_gonder(text, text, uuid);
drop function if exists public.ogretmen_okudu(text, uuid);
drop function if exists public.mesajlar_ogretmen(text, uuid);

-- -----------------------------------------------------------------------------
-- 3. mesaj_gonder — gövde 0004'ten, kanal eklendi
--
-- ROL KANALI BELİRLİYOR, PARAMETRE DEĞİL (öğretmen hariç):
--   veli    → her zaman 'veli'
--   öğrenci → her zaman 'ogrenci'
-- Yani veli, `p_kanal='ogrenci'` göndererek çocuğun yazışmasına giremez;
-- öğrenci de velisininkine. Parametre yalnız ÖĞRETMEN için anlamlı, çünkü
-- iki yazışmaya da o yazıyor.
-- -----------------------------------------------------------------------------
create or replace function public.mesaj_gonder(
  p_token text,
  p_metin text,
  p_ogrenci_id uuid default null,
  p_kanal text default 'veli'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  hedef uuid;
  kimden text;
  -- DEĞİŞKEN ADI SÜTUN ADIYLA AYNI OLMAMALI. `kanal` desem, PL/pgSQL onu
  -- `insert ... on conflict (…, kanal)` gibi yerlerde sütunla karıştırıp
  -- "column reference is ambiguous" hatası veriyor (ölçüldü).
  v_kanal text;
begin
  select * into o from public._oturum(p_token);

  if o.rol = 'ogretmen' then
    if p_ogrenci_id is null then
      raise exception 'Mesajın gideceği öğrenci seçilmeli.' using errcode = '22023';
    end if;
    if coalesce(p_kanal, '') not in ('veli', 'ogrenci') then
      raise exception 'Yazışma ''veli'' ya da ''ogrenci'' olmalı.' using errcode = '22023';
    end if;
    hedef   := p_ogrenci_id;
    kimden  := 'ogretmen';
    v_kanal := p_kanal;
  elsif o.rol = 'veli' then
    -- Veli yalnız kendi öğrencisi adına yazabilir; parametre yok sayılır.
    hedef   := o.ogrenci_id;
    kimden  := 'veli';
    v_kanal := 'veli';
  elsif o.rol = 'ogrenci' then
    -- ÖĞRENCİ ARTIK YAZABİLİYOR — ama yalnız kendi yazışmasına.
    hedef   := o.ogrenci_id;
    kimden  := 'ogrenci';
    v_kanal := 'ogrenci';
  else
    raise exception 'Bu bölümde mesaj gönderemezsiniz.' using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_metin, ''))) = 0 then
    raise exception 'Mesaj boş olamaz.' using errcode = '22023';
  end if;

  insert into public.mesajlar (ogrenci_id, kimden, metin, kanal)
  values (hedef, kimden, btrim(p_metin), v_kanal);

  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. okundu_isaretle — gövde 0019'dan, kanal roldan türetiliyor
--
-- İmza değişmiyor: veli ve öğrenci için kanal zaten roldan belli.
-- -----------------------------------------------------------------------------
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

  insert into public.okundu (ogrenci_id, rol, kanal, zaman)
  values (o.ogrenci_id, o.rol, v_kanal, now())
  on conflict (ogrenci_id, rol, kanal) do update set zaman = now();

  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. ogretmen_okudu — gövde 0019'dan, kanal eklendi
-- -----------------------------------------------------------------------------
create or replace function public.ogretmen_okudu(
  p_token text, p_ogrenci_id uuid, p_kanal text default 'veli'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public._ogretmen(p_token);

  if coalesce(p_kanal, '') not in ('veli', 'ogrenci') then
    raise exception 'Yazışma ''veli'' ya da ''ogrenci'' olmalı.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.ogrenciler where id = p_ogrenci_id) then
    raise exception 'Öğrenci bulunamadı.' using errcode = 'P0002';
  end if;

  insert into public.okundu (ogrenci_id, rol, kanal, zaman)
  values (p_ogrenci_id, 'ogretmen', p_kanal, now())
  on conflict (ogrenci_id, rol, kanal) do update set zaman = now();

  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. mesajlar_ogretmen — gövde 0019'dan, kanal eklendi
-- -----------------------------------------------------------------------------
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
begin
  perform public._ogretmen(p_token);

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

  return jsonb_build_object(
    'ogrenci', jsonb_build_object('id', ogr.id, 'ad', ogr.ad, 'sinif', ogr.sinif),
    'kanal', p_kanal,
    -- Karşı tarafın giriş kodu var mı: yoksa yazdığı mesaj kimseye ulaşmaz
    -- ve öğretmen bunu önceden bilmeli.
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
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. veliler_listesi — gövde 0019'dan, tek fark kanal süzgeci
--
-- Veliler sekmesi YALNIZ veli yazışmasını sayıyor. Öğrenci mesajları
-- öğretmenin Öğrenciler bölümünde (onun kararı).
-- -----------------------------------------------------------------------------
create or replace function public.veliler_listesi(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  sonuc jsonb;
begin
  perform public._ogretmen(p_token);

  with ozet as (
    select o.id as ogrenci_id, o.ad, o.tur, o.sinif_id,
           s.ad as sinif, s.ozel, s.seviye, s.sube,
           (select max(m.created_at) from public.mesajlar m
             where m.ogrenci_id = o.id and m.kanal = 'veli') as son_mesaj,
           (select count(*)::integer from public.mesajlar m
             where m.ogrenci_id = o.id and m.kimden = 'veli' and m.kanal = 'veli'
               and m.created_at > coalesce(
                     (select k.zaman from public.okundu k
                       where k.ogrenci_id = o.id and k.rol = 'ogretmen'
                         and k.kanal = 'veli'),
                     '-infinity'::timestamptz)) as okunmamis
    from public.ogrenciler o
    join public.siniflar s on s.id = o.sinif_id
    where o.aktif and not s.arsiv
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

-- -----------------------------------------------------------------------------
-- 8. ogrenci_yazismalari — YENİ. Öğretmene "hangi öğrenciler yazmış"
--
-- `veliler_listesi.yanit_bekleyen`'in kardeşi. MESAJ METNİ YOK: ortak bir
-- ekranda bütün öğrencilerin yazdıkları yan yana görünmesin (kod
-- listesinde ve veli listesinde uygulanan aynı kural).
--
-- Arşivdeki sınıf ve pasif öğrenci yok (0016 / 0014).
-- -----------------------------------------------------------------------------
create or replace function public.ogrenci_yazismalari(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  sonuc jsonb;
begin
  perform public._ogretmen(p_token);

  with ozet as (
    select o.id as ogrenci_id, o.ad, s.ad as sinif,
           (select max(m.created_at) from public.mesajlar m
             where m.ogrenci_id = o.id and m.kanal = 'ogrenci') as son_mesaj,
           (select count(*)::integer from public.mesajlar m
             where m.ogrenci_id = o.id and m.kimden = 'ogrenci' and m.kanal = 'ogrenci'
               and m.created_at > coalesce(
                     (select k.zaman from public.okundu k
                       where k.ogrenci_id = o.id and k.rol = 'ogretmen'
                         and k.kanal = 'ogrenci'),
                     '-infinity'::timestamptz)) as okunmamis
    from public.ogrenciler o
    join public.siniflar s on s.id = o.sinif_id
    where o.aktif and not s.arsiv
  )
  select jsonb_build_object(
    'toplam_okunmamis', (select coalesce(sum(okunmamis), 0)::integer from ozet),
    -- En ESKİ bekleyen üstte: en uzun süredir cevapsız kalan öğrenci önce.
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

-- -----------------------------------------------------------------------------
-- 9. veli_paneli — gövde 0020'den, iki fark: kanal süzgeci
-- -----------------------------------------------------------------------------
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

  select ogr2.id, ogr2.ad, ogr2.tur, s.ad as sinif, ogr2.sinif_id into ogr
  from public.ogrenciler ogr2
  left join public.siniflar s on s.id = ogr2.sinif_id
  where ogr2.id = o.ogrenci_id;

  return jsonb_build_object(
    'ogrenci', jsonb_build_object('ad', ogr.ad, 'sinif', ogr.sinif, 'tur', ogr.tur),
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

-- -----------------------------------------------------------------------------
-- 10. ogrenci_odevleri — gövde 0020'den, tek ekleme okunmamis_mesaj
--
-- YAZIŞMANIN KENDİSİ BURADA YOK, yalnız sayı. Mesajlar sekmesi açılmadan
-- mesaj metinlerini indirmenin sebebi yok (0022'deki aynı ölçü); sayı ise
-- Pano rozeti için gerekiyor ve tek bir `count`.
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

  select ogr2.id, ogr2.ad, ogr2.tur, s.ad as sinif, ogr2.sinif_id,
         coalesce(s.arsiv, false) as sinif_arsiv
    into ogr
  from public.ogrenciler ogr2
  left join public.siniflar s on s.id = ogr2.sinif_id
  where ogr2.id = o.ogrenci_id;

  return jsonb_build_object(
    'ogrenci', jsonb_build_object('id', ogr.id, 'ad', ogr.ad, 'sinif', ogr.sinif,
                                  'tur', ogr.tur),
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
        'gec_teslim', d.gec_teslim,
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
-- 11. ogrenci_mesajlari — YENİ. Öğrencinin KENDİ yazışması
--
-- Ayrı uç, çünkü Mesajlar sekmesi açılmadan mesaj metinlerini indirmenin
-- sebebi yok. Süzgeç `kanal = 'ogrenci'`: velinin yazdıkları buradan
-- HİÇ ÇIKMIYOR.
-- -----------------------------------------------------------------------------
create or replace function public.ogrenci_mesajlari(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'ogrenci' then
    raise exception 'Bu bölüm yalnızca öğrenciler içindir.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'mesajlar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kimden', m.kimden, 'metin', m.metin, 'zaman', m.created_at)
             order by m.created_at)
      from public.mesajlar m
      where m.ogrenci_id = o.ogrenci_id and m.kanal = 'ogrenci'
    ), '[]'::jsonb),
    'son_gorulme', (select k.zaman from public.okundu k
                     where k.ogrenci_id = o.ogrenci_id
                       and k.rol = 'ogrenci' and k.kanal = 'ogrenci')
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 12. bildirim_sayilari — gövde 0022'den, iki kanal birden
--
-- TEK ROZET, İKİ KANAL. İki ayrı sayı göstermek öğretmene iki ayrı yer
-- aratırdı; rozetin işi "bakılacak bir şey var" demek, nerede olduğunu
-- sekmenin kendisi söylüyor.
-- -----------------------------------------------------------------------------
create or replace function public.bildirim_sayilari(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public._ogretmen(p_token);

  return jsonb_build_object(
    -- Okunmamış mesaj: HER İKİ yazışmadan. Karşılaştırma kanal başına
    -- yapılıyor — öğretmen veli yazışmasını okuduğunda öğrencininki
    -- okunmamış kalmalı.
    'okunmamis_mesaj', (
      select count(*)::integer
      from public.mesajlar m
      join public.ogrenciler o on o.id = m.ogrenci_id
      join public.siniflar  s on s.id = o.sinif_id
      where m.kimden in ('veli', 'ogrenci')
        and o.aktif
        and not s.arsiv
        and m.created_at > coalesce(
              (select k.zaman from public.okundu k
                where k.ogrenci_id = o.id and k.rol = 'ogretmen'
                  and k.kanal = m.kanal),
              '-infinity'::timestamptz)
    ),

    'puan_bekleyen', (
      select count(*)::integer
      from public.gonderimler g
      join public.odevler o on o.id = g.odev_id
      where o.tur = 'acik'
        and g.durum = 'incelemede'
        and not public._sinif_arsivde(o.sinif_id)
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 13. YETKİLER (0005 deseni)
-- -----------------------------------------------------------------------------
revoke all on function public.mesaj_gonder(text, text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.ogretmen_okudu(text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.mesajlar_ogretmen(text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.ogrenci_mesajlari(text) from public, anon, authenticated;
revoke all on function public.ogrenci_yazismalari(text) from public, anon, authenticated;

grant execute on function public.mesaj_gonder(text, text, uuid, text)   to anon, authenticated;
grant execute on function public.ogretmen_okudu(text, uuid, text)       to anon, authenticated;
grant execute on function public.mesajlar_ogretmen(text, uuid, text)    to anon, authenticated;
grant execute on function public.ogrenci_mesajlari(text)                to anon, authenticated;
grant execute on function public.ogrenci_yazismalari(text)              to anon, authenticated;
grant execute on function public.okundu_isaretle(text)                  to anon, authenticated;
grant execute on function public.veliler_listesi(text)                  to anon, authenticated;
grant execute on function public.veli_paneli(text)                      to anon, authenticated;
grant execute on function public.ogrenci_odevleri(text)                 to anon, authenticated;
grant execute on function public.bildirim_sayilari(text)                to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 14. KENDİ KENDİNİ DENETLEME
-- -----------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  -- Eski imzalar gerçekten düştü mü (0007 tuzağı)
  if to_regprocedure('public.mesaj_gonder(text, text, uuid)') is not null then
    raise exception 'Eski mesaj_gonder imzası hâlâ ayakta; kanalsız mesaj yazılabilirdi.';
  end if;
  if to_regprocedure('public.ogretmen_okudu(text, uuid)') is not null then
    raise exception 'Eski ogretmen_okudu imzası hâlâ ayakta.';
  end if;
  if to_regprocedure('public.mesajlar_ogretmen(text, uuid)') is not null then
    raise exception 'Eski mesajlar_ogretmen imzası hâlâ ayakta; kanalsız okuma yapılabilirdi.';
  end if;

  if to_regprocedure('public.ogrenci_mesajlari(text)') is null
     or to_regprocedure('public.ogrenci_yazismalari(text)') is null then
    raise exception 'Yeni uçlar oluşmadı.';
  end if;

  -- okundu anahtarı üç sütun mu — bu turun mahremiyet güvencesi buna bağlı
  select count(*) into n
  from pg_constraint c
  where c.conrelid = 'public.okundu'::regclass and c.contype = 'p'
    and (select count(*) from unnest(c.conkey)) = 3;
  if n <> 1 then
    raise exception 'okundu birincil anahtarı üç sütunlu değil; '
                    'veli yazışmasını okumak öğrencininkini de okunmuş sayardı.';
  end if;

  -- Mevcut mesajların hepsi bir kanala düştü mü
  if exists (select 1 from public.mesajlar where kanal is null) then
    raise exception 'Kanalsız mesaj kaldı.';
  end if;

  raise notice 'İki ayrı yazışma hazır: öğrenci↔öğretmen ve veli↔öğretmen.';
end $$;
