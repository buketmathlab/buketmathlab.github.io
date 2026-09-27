-- =============================================================================
-- 0055 — YÖNETİCİNİN VERDİĞİ ÖDEV SINIF ÖĞRETMENİNDE · PANO · PUAN DÜZELTME
--
-- Öğretmenin (platform sahibi) üç isteği:
--
-- 1. "Diğer öğretmen arkadaşlarımın sınıflarına ben ödev gönderdim. Onlar
--    kendi hesaplarıyla girdiklerinde göremiyorlar. Kendileri göndermiş gibi
--    görsünler; ödevi de, öğrencilerin sonuçlarını da."
-- 2. Panodaki son gönderimlerde adın yanında sınıf; ada tıklayınca çözüm.
-- 3. Yalnız sahibe özel, elle puan düzeltme.
--
-- -----------------------------------------------------------------------------
-- KÖK NEDEN
--
-- Ödev uçları sahipliği `odevler.ogretmen_id = oturumdaki öğretmen` ile
-- süzüyordu. Yöneticinin verdiği ödevin sahibi yönetici — sınıfın öğretmeni
-- hiçbir listede görmüyordu. Sınıf analizi ve sınıf özeti ise ZATEN sınıfa
-- göre çalışıyordu; tutarsızlık buradan.
--
-- -----------------------------------------------------------------------------
-- KURAL — TEK YERDE: `_odeve_erisir(öğretmen, ödevin sahibi, ödevin sınıfı)`
--
--   ödevi veren sensin
--   YA DA ödevi YÖNETİCİ verdi ve sen o sınıfa atanmışsın.
--
-- Öğretmenin kararları:
--   * Sınıf öğretmeni o ödevde TAM yetkili: görür, puanlar, düzenler,
--     yayınlar, siler — "kendisi göndermiş gibi".
--   * Kapsam YALNIZ YÖNETİCİNİN ÖDEVLERİ. İki sıradan öğretmen aynı sınıfta
--     olsa bile birbirinin ödevini görmez. Sahip de öğretmenlerin kendi
--     ödevlerini bugünkü gibi VEKÂLETLE görür.
--
-- Bilerek istisnalar:
--   * KARDEŞLERE YAYMA yalnız ödevi verene. Kardeşler başka öğretmenlerin
--     sınıflarında; yayabilseydi onların öğrencilerinin notunu değiştirirdi.
--     Kardeş bilgisi (sınıf adları, gönderim sayıları) de yalnız ona dönüyor.
--   * `odev_guncelle` artık ödevin öğretmenin KENDİ sınıfına taşınmasına
--     izin veriyor — önceden hiç denetlenmiyordu.
--   * `konu_onerileri` kendi konularından; `ogretmenler_listesi`'ndeki
--     ödev sayısı oluşturana göre. Değişmedi.
--
-- BULGU: `sinif_ogrencileri`'nde "yaptı" sınıfın BÜTÜN ödevlerinden,
-- "verilen ödev" yalnız öğretmenin kendi ödevlerinden sayılıyordu. Yönetici
-- o sınıfa ödev verince öğretmenin ekranında "yapmadı" EKSİYE düşüyor,
-- ortalama bozuluyordu. İkisi aynı kurala bağlandı.
--
-- -----------------------------------------------------------------------------
-- PUAN DÜZELTME — `puan_duzelt`
--
-- Yalnız platformun sahibi; vekâletteyken de (gerçek kişi = vekil). Sebep
-- ZORUNLU. Test ve açık uçlu, bütün öğretmenlerin ödevlerinde. Puan
-- `ogretmen_puan`'a yazılıyor: ortalama, karne, veli paneli ve kıyas uçlarının
-- HEPSİ `coalesce(ogretmen_puan, puan)` kullanıyor (ölçüldü; çıplak toplam
-- yok) — düzeltme her yere kendiliğinden yansır.
--
-- Öğretmende İŞARETLİ ("Yönetici düzeltti" + sebep); öğrenci ve veli yalnız
-- yeni puanı görür. Öğretmen sonra yeniden puanlarsa işaret kalkar — son puan
-- onun. Test anahtarı sonradan düzeltilirse otomatik puan yeniden hesaplanır
-- ama DÜZELTME ÜSTÜN KALIR (ogretmen_puan önce gelir).
--
-- İMZASI DEĞİŞEN UÇ YOK → drop yok. Gövdeler dosyadan kopyalandı ve yalnız
-- listelenen yerlerde değişti; `app/scripts/ortak-odev-denetimi.mjs` bunu
-- mekanik olarak ölçüyor.
--
-- Bu dosya tekrar çalıştırılabilir.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ŞEMA — yönetici düzeltmesinin izi (boş bırakılabilir: eski yedekler geçerli)
-- -----------------------------------------------------------------------------
alter table public.gonderimler
  add column if not exists duzelten_yonetici uuid
    references public.ogretmenler(id) on delete set null,
  add column if not exists duzeltme_nedeni text,
  add column if not exists duzeltme_zamani timestamptz;

comment on column public.gonderimler.duzelten_yonetici is
  'Puanı elle düzelten yönetici (0055). NULL = düzeltilmedi.';

-- -----------------------------------------------------------------------------
-- 2. _odeve_erisir — erişim kuralı, TEK YERDE (dahili)
-- -----------------------------------------------------------------------------
create or replace function public._odeve_erisir(
  p_ogretmen uuid,
  p_odev_ogretmen uuid,
  p_sinif uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select p_odev_ogretmen = p_ogretmen
      or (exists (select 1 from public.ogretmenler y
                   where y.id = p_odev_ogretmen and y.yonetici)
          and public._ogretmenin_sinifi(p_ogretmen, p_sinif)
          -- ÖZEL DERS HİÇBİR ZAMAN (0033: "özel ders TAMAMEN sahipte").
          -- `ogretmen_sinif_ata` özel grubu başkasına atamıyor; bu şart onun
          -- YEDEĞİ — tabloya elle bir satır eklense bile sahibin özel ders
          -- ödevleri ve öğrencilerinin sonuçları açılmıyor.
          and not exists (select 1 from public.siniflar s
                           where s.id = p_sinif and s.ozel));
$$;

-- -----------------------------------------------------------------------------
-- 3. _odev_sahibi (gövde: 0033) — detay, gönderimler, güncelle, sil, yayınla,
--    dosya yolu ve kardeş yayma bu kapıdan geçiyor.
-- -----------------------------------------------------------------------------
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
    where d.id = p_odev_id
      -- 0055: oluşturan YA DA yöneticinin verdiği ödevde o sınıfın öğretmeni.
      and public._odeve_erisir(p_ogretmen_id, d.ogretmen_id, d.sinif_id)
  ) then
    raise exception 'Bu ödev size ait değil.' using errcode = '42501';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. odevler_listesi (gövde: 0033)
-- -----------------------------------------------------------------------------
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
      -- Ortalamalar YALNIZ süre dolduktan sonra.
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
    where public._odeve_erisir(v_ogretmen, d.ogretmen_id, d.sinif_id)
      and not s.arsiv
      and (p_sinif_id is null or d.sinif_id = p_sinif_id)
      and (p_yayinda is null or d.yayinda = p_yayinda)
  ), '[]'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. ogretmen_panosu (gövde: 0033) — sayaçlar + son gönderimlerde sınıf
-- -----------------------------------------------------------------------------
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
                       and public._odeve_erisir(v_ogretmen, d.ogretmen_id, d.sinif_id))
    ),
    'acik_odev', (select count(*) from public.odevler d
                   where d.yayinda and d.son_tarih >= bugun
                     and public._odeve_erisir(v_ogretmen, d.ogretmen_id, d.sinif_id)
                     and not public._sinif_arsivde(d.sinif_id)),
    'bekleyen_degerlendirme', (select count(*) from public.gonderimler g
                                join public.odevler o on o.id = g.odev_id
                               where o.tur = 'acik' and g.durum = 'incelemede'
                                 and public._odeve_erisir(v_ogretmen, o.ogretmen_id, o.sinif_id)
                                 and not public._sinif_arsivde(o.sinif_id)),
    'gecikmis_eksik', (
      select count(*)
      from public.odevler o
      join public.ogrenciler ogr
        on ogr.sinif_id = o.sinif_id and ogr.aktif
      where o.yayinda and o.son_tarih < bugun
        and public._odeve_erisir(v_ogretmen, o.ogretmen_id, o.sinif_id)
        and not public._sinif_arsivde(o.sinif_id)
        and not exists (select 1 from public.gonderimler g
                         where g.odev_id = o.id and g.ogrenci_id = ogr.id)
    ),
    'son_gonderimler', coalesce((
      select jsonb_agg(x order by x->>'zaman' desc) from (
        select jsonb_build_object(
                 'ogrenci', ogr.ad, 'odev', o.baslik,
                 -- 0055: panoda adın yanında sınıf, ada tıklayınca çözüm.
                 'sinif', (select s.ad from public.siniflar s where s.id = o.sinif_id),
                 'gonderim_id', g.id,
                 'puan', coalesce(g.ogretmen_puan, g.puan),
                 'zaman', g.created_at,
                 'gecikmeli', public._gecikmeli(g.created_at, o.son_tarih)
               ) as x
        from public.gonderimler g
        join public.ogrenciler ogr on ogr.id = g.ogrenci_id
        join public.odevler o on o.id = g.odev_id
        where not public._sinif_arsivde(o.sinif_id)
          and public._odeve_erisir(v_ogretmen, o.ogretmen_id, o.sinif_id)
        order by g.created_at desc limit 10
      ) t
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. sinif_ogrencileri (gövde: 0044) — iki sayı aynı kümeden
-- -----------------------------------------------------------------------------
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

  -- Bu sınıfa verilmiş, yayınlanmış ve süresi dolmuş ödev sayısı.
  select count(*) into v_odev_sayisi
  from public.odevler d
  where d.sinif_id = p_sinif_id and d.yayinda and d.son_tarih < bugun_tr
    and public._odeve_erisir(v_ogretmen, d.ogretmen_id, d.sinif_id);

  return jsonb_build_object(
    'sinif', jsonb_build_object(
      'id', s.id, 'ad', s.ad, 'ozel', s.ozel, 'arsiv', s.arsiv
    ),
    -- Öğretmen "kaç ödev üzerinden konuşuyoruz" sorusunu görmeden
    -- ortalamayı yorumlayamaz.
    'degerlendirilen_odev', v_odev_sayisi,
    'ogrenciler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id,
        'ad', o.ad,
        'ogrenci_no', o.ogrenci_no,
        'tur', o.tur,
        'yapti', i.yapti,
        'yapmadi', v_odev_sayisi - i.yapti,
        'ortalama_yapan', i.ortalama_yapan,
        'ortalama_tum', i.ortalama_tum
      -- SIRALAMA: OKUL NUMARASINA GÖRE (0044). Anahtar tek yerde
      -- (`_numara_sira`); numarasızlar sonda, kendi aralarında ada göre.
      --
      -- `nulls last` PostgreSQL'de ASC için ZATEN varsayılan; kaldırıldığında
      -- hiçbir ölçüm kırılmıyor (denendi). Yine de yazılı duruyor: bir gün
      -- sıra DESC'e çevrilirse varsayılan tersine döner ve numarasızlar
      -- listenin başına geçerdi.
      ) order by public._numara_sira(o.ogrenci_no) nulls last, o.ad)
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
          -- 0055: AYNI KÜME. Önceden `yapti` sınıfın BÜTÜN ödevlerinden,
          -- `v_odev_sayisi` yalnız öğretmenin kendi ödevlerinden sayılıyordu;
          -- yönetici o sınıfa ödev verince "yapmadı" eksiye düşüyordu.
          and public._odeve_erisir(v_ogretmen, d.ogretmen_id, d.sinif_id)
      ) i
      where o.sinif_id = p_sinif_id and o.aktif
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. bildirim_sayilari (gövde: 0033) — puan bekleyen sayısı
-- -----------------------------------------------------------------------------
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
    -- Okunmamış mesaj: HER İKİ yazışmadan. Karşılaştırma kanal başına
    -- yapılıyor — öğretmen veli yazışmasını okuduğunda öğrencininki
    -- okunmamış kalmalı.
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
        and public._odeve_erisir(v_ogretmen, o.ogretmen_id, o.sinif_id)
        and g.durum = 'incelemede'
        and not public._sinif_arsivde(o.sinif_id)
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. gonderim_foto_yolu (gövde: 0054)
-- -----------------------------------------------------------------------------
create or replace function public.gonderim_foto_yolu(p_token text, p_gonderim uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_yol text;
  v_ek  text[];
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);

  -- Çözüm fotoğrafı, gönderimin ait olduğu ÖDEVİN sahibine açık.
  select g.foto_yolu, g.ek_sayfa_yollari into v_yol, v_ek
  from public.gonderimler g
  join public.odevler d on d.id = g.odev_id
  where g.id = p_gonderim
    and public._odeve_erisir(v_ogretmen, d.ogretmen_id, d.sinif_id);

  if not found then
    raise exception 'Gönderim bulunamadı.' using errcode = 'P0002';
  end if;

  -- `yol` AYNEN DURUYOR: 0054'ten önce yayına girmiş bir arayüz yalnız onu
  -- okuyor. `yollar` 1. sayfa dahil TÜM sayfalar, sırayla.
  return jsonb_build_object(
    'yol', v_yol,
    'yollar', case when v_yol is null then '[]'::jsonb
                   else to_jsonb(array[v_yol] || coalesce(v_ek, '{}'::text[])) end);
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. acik_puanla (gövde: 0033)
-- -----------------------------------------------------------------------------
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

  -- Not vermek en ağır işlem: gönderim BAŞKASININ ödevine aitse bulunamıyor.
  select g.* into eski from public.gonderimler g
  join public.odevler d on d.id = g.odev_id
  where g.id = p_gonderim
    and public._odeve_erisir(v_ogretmen, d.ogretmen_id, d.sinif_id);
  if not found then
    raise exception 'Gönderim bulunamadı.' using errcode = 'P0002';
  end if;

  if p_puan < 0 or p_puan > 100 then
    raise exception 'Puan 0 ile 100 arasında olmalı.' using errcode = '22023';
  end if;

  update public.gonderimler
     set ogretmen_puan = p_puan,
         ogretmen_yorum = nullif(btrim(coalesce(p_yorum, '')), ''),
         durum = 'onaylandi',
         -- 0055: öğretmen yeniden puanlarsa son puan ONUN — "Yönetici
         -- düzeltti" etiketi artık doğru olmazdı. Geçmiş denetim izinde.
         duzelten_yonetici = null,
         duzeltme_nedeni = null,
         duzeltme_zamani = null
   where id = p_gonderim;

  perform public._denetim(
    'acik_uclu_puanlandi', 'gonderimler', p_gonderim, public._aktor(v_ogretmen),
    jsonb_build_object('ogretmen_puan', eski.ogretmen_puan, 'durum', eski.durum),
    jsonb_build_object('ogretmen_puan', p_puan, 'durum', 'onaylandi'));

  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. odev_detay (gövde: 0054) — kardeş bilgisi yalnız ödevi verene
-- -----------------------------------------------------------------------------
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
    'sayfa_limiti', d.sayfa_limiti,
    'cevap_anahtari', coalesce(d.cevap_anahtari, '{}'::jsonb),
    'anahtar_yolu', d.anahtar_url,
    'odev_yolu', d.odev_url,
    'yayinda', d.yayinda,
    'kardesler', case when d.grup_id is not null and d.ogretmen_id = v_ogretmen then (
      select coalesce(jsonb_agg(s2.ad order by s2.seviye, s2.sube), '[]'::jsonb)
        from public.odevler d2
        join public.siniflar s2 on s2.id = d2.sinif_id
       where d2.grup_id = d.grup_id and d2.id <> d.id
    ) end,
    'kardes_detay', case when d.grup_id is not null and d.ogretmen_id = v_ogretmen then (
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

-- -----------------------------------------------------------------------------
-- 11. odev_kardeslere_yay (gövde: 0054) — yalnız ödevi veren
-- -----------------------------------------------------------------------------
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
  -- Kardeşlere yayma NOT DEĞİŞTİRİYOR: kaynağın sahibi olmayan
  -- kimse başlatamaz.
  perform public._odev_sahibi(v_ogretmen, p_id);

  select * into d from public.odevler where id = p_id;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  -- 0055: YAYMA YALNIZ ÖDEVİ VERENE. Yöneticinin birden çok sınıfa
  -- verdiği bir ödevi o sınıflardan birinin öğretmeni de açabiliyor; ama
  -- kardeşler BAŞKA öğretmenlerin sınıflarında. Yayabilseydi onların
  -- öğrencilerinin notunu değiştirirdi.
  if d.ogretmen_id <> v_ogretmen then
    raise exception 'Bu ödevi kardeş sınıflara yalnız ödevi veren öğretmen yayabilir.'
      using errcode = '42501';
  end if;

  -- SESSİZ "TAMAM" YOK. Kardeşi olmayan bir ödevde hiçbir şey yapmayıp
  -- başarı dönmek, öğretmene yayıldığını sandırırdı.
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
    -- ARŞİVDEKİ SINIF ATLANIYOR (0016 kuralı).
    -- Arşivdeki sınıf öğretmenin hiçbir listesinde görünmüyor; görünmeyen bir
    -- sınıfın notunu sessizce değiştirmek o kuralı delerdi. Atlandığı raporda
    -- yazıyor — sessiz atlama da yok.
    if public._sinif_arsivde(k.sinif_id) then
      rapor := rapor || jsonb_build_object(
        'sinif', k.sinif_ad, 'odev_id', k.id,
        'yeniden_puanlanan', '[]'::jsonb, 'atlandi', 'arsiv');
      continue;
    end if;

    select * into eski from public.odevler where id = k.id;

    -- Anahtar bu kardeş için gerçekten değişiyor mu? Yalnız test ödevinde
    -- anlamlı; açık uçluda anahtar da soru sayısı da null.
    anahtar_degisti := eski.tur = 'test'
      and ((d.cevap_anahtari is distinct from eski.cevap_anahtari)
        or (d.soru_sayisi is distinct from eski.soru_sayisi));

    -- TAŞINAN ALANLAR — öğretmenin kararı, birebir.
    -- sinif_id, son_tarih, gec_teslim, yayinda ve grup_id BİLEREK YOK.
    update public.odevler
       set baslik         = d.baslik,
           aciklama       = d.aciklama,
           soru_sayisi    = d.soru_sayisi,
           cevap_anahtari = d.cevap_anahtari,
           sik_sayisi     = d.sik_sayisi,
           -- 0054: sayfa sınırı da ödevin İÇERİĞİ — aynı çözüm her sınıfta
           -- aynı sayıda sayfa tutar. Şık sayısı gibi taşınıyor; geç teslim
           -- gibi sınıfa özgü bir ayar DEĞİL.
           sayfa_limiti   = d.sayfa_limiti,
           konular        = public._konu_temizle(d.konular, d.soru_sayisi),
           anahtar_url    = d.anahtar_url,
           odev_url       = d.odev_url
     where id = k.id;

    perform public._denetim('kardeslere_yayildi', 'odevler', k.id, public._aktor(v_ogretmen),
                            to_jsonb(eski),
                            (select to_jsonb(o) from public.odevler o where o.id = k.id));

    -- -------------------------------------------------------------------
    -- YENİDEN PUANLAMA — gövde odev_guncelle'den (0020) BİREBİR kopyalandı.
    -- Ezberden yazmak 0016'da iki hataya yol açmıştı; o adım atlanmıyor.
    -- -------------------------------------------------------------------
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

          -- Not değişikliği HER ZAMAN iz bırakır (Part XLIII).
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

-- -----------------------------------------------------------------------------
-- 12. odev_guncelle (gövde: 0054) — yalnız kendi sınıfına taşıma
-- -----------------------------------------------------------------------------
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
  -- DİKKAT — burada varsayılan `null`, `true` DEĞİL.
  --
  -- Oluşturmada varsayılan `true` doğru: yeni ödev açık başlar. Ama
  -- güncellemede `true` olsaydı, parametreyi göndermeyen HERHANGİ bir çağrı
  -- öğretmenin kapattığı bir ödevi sessizce yeniden açardı. Ayarı "ödev
  -- verildikten sonra da değiştirebilmek" ancak değişikliğin kalıcı olmasıyla
  -- bir anlam taşır. `null` = "dokunma", aşağıdaki coalesce mevcut değeri
  -- koruyor — `p_sik_sayisi` ile aynı davranış.
  p_gec_teslim boolean default null,
  p_sik_sayisi smallint default null,
  -- NULL = DEĞİŞTİRME (p_gec_teslim ile aynı tuzak). Konuları temizlemek
  -- için boş nesne gönderilir: '{}'.
  p_konular jsonb default null,
  -- 0054 — NULL = DEĞİŞTİRME (p_gec_teslim ile aynı tuzak). Sınırı
  -- düşürmek yapılmış gönderimlere dokunmaz: gönderim değiştirilemez,
  -- sınır yalnız bundan sonraki gönderimleri bağlar.
  p_sayfa_limiti smallint default null
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
  -- 0055: ödev yalnız öğretmenin KENDİ sınıfına taşınabilir. Önceden hiç
  -- denetlenmiyordu; sınıf öğretmeni yöneticinin ödevini düzenleyebildiği
  -- için artık gerekli. Sınıf değişmiyorsa aranmıyor.
  if p_sinif_id is distinct from d.sinif_id
     and not public._ogretmenin_sinifi(v_ogretmen, p_sinif_id) then
    raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
  end if;
  if p_sayfa_limiti is not null and p_sayfa_limiti not between 1 and 8 then
    raise exception 'Sayfa sınırı 1 ile 8 arasında olmalı.' using errcode = '22023';
  end if;

  if d.tur = 'test' then
    yeni_sayi := coalesce(p_soru_sayisi, d.soru_sayisi);
    if yeni_sayi is null or yeni_sayi < 1 or yeni_sayi > 200 then
      raise exception 'Soru sayısı 1 ile 200 arasında olmalı.' using errcode = '22023';
    end if;

    -- Soru sayısı küçüldüyse anahtarı kırp: aksi hâlde artık var olmayan
    -- sorulara ait cevaplar kayıtta kalır ve puanlamayı bulandırır.
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
         -- Konular da soru sayısına göre kırpılıyor: anahtarda uygulanan
         -- kuralın aynısı, yoksa artık olmayan soruların konusu kayıtta kalır.
         konular     = public._konu_temizle(coalesce(p_konular, d.konular), yeni_sayi),
         sayfa_limiti = coalesce(p_sayfa_limiti, d.sayfa_limiti)
   where id = p_id;

  perform public._denetim('odev_guncellendi', 'odevler', p_id, public._aktor(v_ogretmen),
                          to_jsonb(d), (select to_jsonb(o) from public.odevler o where o.id = p_id));

  -- ---------------------------------------------------------------------
  -- YENİDEN PUANLAMA
  -- ---------------------------------------------------------------------
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

        -- Not değişikliği HER ZAMAN iz bırakır (Part XLIII).
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

-- -----------------------------------------------------------------------------
-- 13. odev_gonderimleri (gövde: 0033) — düzeltme işareti
-- -----------------------------------------------------------------------------
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
    -- SINIF KONU ÖZETİ: "bu sınıf en çok hangi konuda takıldı?"
    -- Öğretmenin bir sonraki dersini planlarken bakacağı sayı bu. Tek tek
    -- öğrencilerin analizini toplamak yerine sunucuda toplanıyor; aksi hâlde
    -- otuz öğrencinin cevapları tarayıcıya inerdi.
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
        -- HANGİ SORULAR YANLIŞ: sayı değil, numara. "5 yanlış" öğretmene
        -- ne yapacağını söylemez; "3, 7 ve 9 yanlış" söyler. Yalnız test
        -- ödevinde anlamlı — açık uçluda anahtar yok, her soru "boş"
        -- görünür ve bu bilgi gürültüden ibaret olurdu.
        'yanlis_sorular', case when g.id is not null and d.tur = 'test'
          then public._soru_dokumu(d.cevap_anahtari, g.cevaplar, d.soru_sayisi) -> 'yanlis'
          else '[]'::jsonb end,
        'bos_sorular', case when g.id is not null and d.tur = 'test'
          then public._soru_dokumu(d.cevap_anahtari, g.cevaplar, d.soru_sayisi) -> 'bos'
          else '[]'::jsonb end,
        'foto_var', (g.foto_yolu is not null),
        -- 0055: yönetici düzeltmesi öğretmende işaretli.
        'duzeltildi', (g.duzelten_yonetici is not null),
        'duzeltme_nedeni', g.duzeltme_nedeni
      ) order by o.ad)
      from public.ogrenciler o
      left join public.gonderimler g
        on g.odev_id = d.id and g.ogrenci_id = o.id
      where o.sinif_id = d.sinif_id and o.aktif
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 14. puan_duzelt — YENİ, yalnız platformun sahibi
-- -----------------------------------------------------------------------------
create or replace function public.puan_duzelt(
  p_token text,
  p_gonderim uuid,
  p_puan numeric,
  p_neden text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ogretmen uuid;
  v_gercek   uuid;
  v_neden    text := nullif(btrim(coalesce(p_neden, '')), '');
  eski       public.gonderimler;
begin
  -- `_ogretmen` önce: öğrenci/veli jetonu burada 42501 ile düşer ve vekâlet
  -- ayarı kurulur (`_aktor` denetim izine "sahip → öğretmen" yazsın).
  v_ogretmen := public._ogretmen(p_token);

  -- GERÇEK KİŞİ: vekâletteyse vekil (sahip), değilse oturumun öğretmeni.
  v_gercek := coalesce(nullif(current_setting('sekiz.vekil', true), '')::uuid, v_ogretmen);
  if not exists (select 1 from public.ogretmenler y where y.id = v_gercek and y.yonetici) then
    raise exception 'Puanı yalnız platformun sahibi düzeltebilir.' using errcode = '42501';
  end if;

  if p_puan is null or p_puan < 0 or p_puan > 100 then
    raise exception 'Puan 0 ile 100 arasında olmalı.' using errcode = '22023';
  end if;
  -- SEBEP ZORUNLU: bir notu elle değiştirmenin nedeni sonradan sorulur.
  if v_neden is null or char_length(v_neden) < 3 then
    raise exception 'Düzeltmenin sebebini yazın.' using errcode = '22023';
  end if;
  if char_length(v_neden) > 500 then
    raise exception 'Sebep en fazla 500 karakter olabilir.' using errcode = '22023';
  end if;

  select * into eski from public.gonderimler where id = p_gonderim;
  if not found then
    raise exception 'Gönderim bulunamadı.' using errcode = 'P0002';
  end if;

  update public.gonderimler
     set ogretmen_puan     = p_puan,
         -- Açık uçlu ve henüz puanlanmamışsa artık puanlı. Testte durum aynı.
         durum             = case when durum = 'incelemede' then 'onaylandi' else durum end,
         duzelten_yonetici = v_gercek,
         duzeltme_nedeni   = v_neden,
         duzeltme_zamani   = now()
   where id = p_gonderim;

  -- Not değişikliği HER ZAMAN iz bırakır (Part XLIII).
  perform public._denetim(
    'puan_duzeltildi', 'gonderimler', p_gonderim, public._aktor(v_ogretmen),
    jsonb_build_object('puan', eski.puan, 'ogretmen_puan', eski.ogretmen_puan,
                       'durum', eski.durum),
    jsonb_build_object('ogretmen_puan', p_puan, 'neden', v_neden));

  return jsonb_build_object('durum', 'tamam', 'puan', p_puan);
end;
$$;

-- -----------------------------------------------------------------------------
-- 15. YETKİLER (0005 deseni)
-- -----------------------------------------------------------------------------
revoke all on function public._odeve_erisir(uuid, uuid, uuid)
  from public, anon, authenticated;

revoke all on function public.puan_duzelt(text, uuid, numeric, text)
  from public, anon, authenticated;
grant execute on function public.puan_duzelt(text, uuid, numeric, text)
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 16. KENDİ KENDİNİ DENETLEME
-- -----------------------------------------------------------------------------
do $$
declare
  f text;
  n integer;
begin
  foreach f in array array['_odeve_erisir', 'puan_duzelt', '_odev_sahibi'] loop
    select count(*) into n
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.proname = f;
    if n <> 1 then
      raise exception '0055: % için % tanım var', f, n;
    end if;
  end loop;

  foreach f in array array['_odev_sahibi', 'odevler_listesi', 'ogretmen_panosu',
                           'sinif_ogrencileri', 'bildirim_sayilari',
                           'gonderim_foto_yolu', 'acik_puanla'] loop
    if not exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = f
         and pg_get_functiondef(p.oid) like '%_odeve_erisir(%'
    ) then
      raise exception '0055: % erişim kuralına bağlanmamış', f;
    end if;
  end loop;

  if has_function_privilege('anon', 'public._odeve_erisir(uuid, uuid, uuid)', 'execute') then
    raise exception '0055: _odeve_erisir anon''a açık';
  end if;
end $$;

select public._migration_kaydet('0055');
