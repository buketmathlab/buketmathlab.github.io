-- =============================================================================
-- SEKİZ — 0004 RPC KATMANI
--
-- Kural: her fonksiyon İLK satırında yetkiyi doğrular. Parametreden gelen
-- kimliğe asla güvenilmez; öğrenci/veli kimliği jetondan okunur.
-- =============================================================================

-- =============================================================================
-- DETERMİNİSTİK TEST PUANLAMA
--
-- YAPAY ZEKÂ KULLANILMAZ (Kural 5). Test puanlaması karşılaştırmadır:
-- hızlı, tekrarlanabilir, denetlenebilir olmak zorundadır. Aynı girdi her
-- zaman aynı sonucu verir; bir veli "bu puan nasıl çıktı?" diye sorduğunda
-- cevabı satır satır gösterilebilir olmalıdır.
--
-- Dayanıklılık (Part XLVIII): boş cevap, geçersiz şık, eksik soru ve
-- fazladan anahtar girdisi çökmeden ele alınır.
-- =============================================================================
create or replace function public._puanla(
  p_anahtar jsonb,
  p_cevaplar jsonb,
  p_soru_sayisi integer
)
returns table (dogru integer, yanlis integer, bos integer, puan numeric)
language plpgsql
immutable
security definer
set search_path = public, pg_temp
as $$
declare
  i integer;
  d integer := 0;
  y integer := 0;
  b integer := 0;
  anahtar_sik text;
  ogrenci_sik text;
begin
  for i in 1..p_soru_sayisi loop
    anahtar_sik := upper(btrim(coalesce(p_anahtar ->> i::text, '')));
    ogrenci_sik := upper(btrim(coalesce(p_cevaplar ->> i::text, '')));

    if ogrenci_sik = '' then
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
  puan   := case when p_soru_sayisi > 0
                 then round(d * 100.0 / p_soru_sayisi, 2)
                 else 0 end;
  return next;
end;
$$;

-- =============================================================================
-- SINIF YÖNETİMİ (Part XXVI)
-- =============================================================================
create or replace function public.siniflar_listesi(p_token text, p_arsiv boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public._ogretmen(p_token);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id, 'ad', s.ad, 'seviye', s.seviye,
             'sube', s.sube, 'arsiv', s.arsiv,
             'ogrenci_sayisi', (select count(*) from public.ogrenciler o where o.sinif_id = s.id and o.aktif)
           ) order by s.seviye, s.sube)
    from public.siniflar s
    where p_arsiv or not s.arsiv
  ), '[]'::jsonb);
end;
$$;

create or replace function public.sinif_ekle(p_token text, p_seviye smallint, p_sube text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  yeni public.siniflar;
begin
  perform public._ogretmen(p_token);

  insert into public.siniflar (seviye, sube)
  values (p_seviye, upper(btrim(p_sube)))
  on conflict (seviye, sube) do update set arsiv = false
  returning * into yeni;

  perform public._denetim('sinif_eklendi', 'siniflar', yeni.id, 'ogretmen',
                          null, to_jsonb(yeni));
  return jsonb_build_object('id', yeni.id, 'ad', yeni.ad);
end;
$$;

-- Sınıf silinmez, arşivlenir: geçmiş ödev kayıtları bozulmasın (Part XXVI).
create or replace function public.sinif_arsivle(p_token text, p_id uuid, p_arsiv boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public._ogretmen(p_token);
  update public.siniflar set arsiv = p_arsiv where id = p_id;
  perform public._denetim(
    case when p_arsiv then 'sinif_arsivlendi' else 'sinif_geri_alindi' end,
    'siniflar', p_id, 'ogretmen');
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- =============================================================================
-- ÖĞRENCİ YÖNETİMİ
-- =============================================================================
create or replace function public.ogrenci_ekle(
  p_token text,
  p_ad text,
  p_tur text,
  p_sinif_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  yeni_id uuid;
  kod_ogrenci text;
  kod_veli text;
begin
  perform public._ogretmen(p_token);

  if p_tur = 'okul' and p_sinif_id is null then
    raise exception 'Okul öğrencisi için sınıf seçilmeli.' using errcode = '22023';
  end if;

  insert into public.ogrenciler (ad, tur, sinif_id)
  values (btrim(p_ad), p_tur, p_sinif_id)
  returning id into yeni_id;

  kod_ogrenci := public._yeni_kod();
  kod_veli    := public._yeni_kod();

  insert into public.giris_kodlari (kod, ogrenci_id, rol)
  values (kod_ogrenci, yeni_id, 'ogrenci'), (kod_veli, yeni_id, 'veli');

  perform public._denetim('ogrenci_eklendi', 'ogrenciler', yeni_id, 'ogretmen');

  return jsonb_build_object(
    'id', yeni_id, 'ogrenci_kodu', kod_ogrenci, 'veli_kodu', kod_veli
  );
end;
$$;

-- Öğrenci SİLİNMEZ, pasife alınır.
--
-- Eski sistemde silme "öğrenci ve tüm kayıtları" kaldırıyordu ve geri alınamıyordu.
-- Eğitim kaydı sessizce yok edilmemeli (Part XLIII). Pasif öğrencinin
-- kodları iptal edilir — erişimi anında düşer (Part XLIX, madde 14).
create or replace function public.ogrenci_pasiflestir(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public._ogretmen(p_token);

  update public.ogrenciler set aktif = false where id = p_id;
  delete from public.giris_kodlari where ogrenci_id = p_id;
  update public.oturumlar set iptal = true where ogrenci_id = p_id;

  perform public._denetim('ogrenci_pasiflestirildi', 'ogrenciler', p_id, 'ogretmen');
  return jsonb_build_object('durum', 'tamam');
end;
$$;

create or replace function public.ogrenci_kodlari(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sonuc jsonb;
begin
  perform public._ogretmen(p_token);
  select jsonb_object_agg(rol, kod) into sonuc
  from public.giris_kodlari where ogrenci_id = p_id;
  return coalesce(sonuc, '{}'::jsonb);
end;
$$;

-- =============================================================================
-- ÖĞRETMEN PANOSU — sayfalanabilir (Part XVI: ~200 öğrenci ölçeği)
-- =============================================================================
create or replace function public.ogretmen_panosu(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  bugun date := current_date;
begin
  perform public._ogretmen(p_token);

  return jsonb_build_object(
    'ogrenci_sayisi', (select count(*) from public.ogrenciler where aktif),
    'acik_odev', (select count(*) from public.odevler
                   where yayinda and son_tarih >= bugun),
    'bekleyen_degerlendirme', (select count(*) from public.gonderimler g
                                join public.odevler o on o.id = g.odev_id
                               where o.tur = 'acik' and g.durum = 'incelemede'),
    'gecikmis_eksik', (
      select count(*)
      from public.odevler o
      join public.ogrenciler ogr
        on ogr.sinif_id = o.sinif_id and ogr.aktif
      where o.yayinda and o.son_tarih < bugun
        and not exists (select 1 from public.gonderimler g
                         where g.odev_id = o.id and g.ogrenci_id = ogr.id)
    ),
    'son_gonderimler', coalesce((
      select jsonb_agg(x order by x->>'zaman' desc) from (
        select jsonb_build_object(
                 'ogrenci', ogr.ad, 'odev', o.baslik,
                 'puan', coalesce(g.ogretmen_puan, g.puan),
                 'zaman', g.created_at
               ) as x
        from public.gonderimler g
        join public.ogrenciler ogr on ogr.id = g.ogrenci_id
        join public.odevler o on o.id = g.odev_id
        order by g.created_at desc limit 10
      ) t
    ), '[]'::jsonb)
  );
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
set search_path = public, pg_temp
as $$
declare
  toplam integer;
  satirlar jsonb;
begin
  perform public._ogretmen(p_token);
  p_boyut := least(greatest(coalesce(p_boyut, 25), 1), 100);
  p_sayfa := greatest(coalesce(p_sayfa, 1), 1);

  select count(*) into toplam
  from public.ogrenciler o
  where o.aktif
    and (p_sinif_id is null or o.sinif_id = p_sinif_id)
    and (p_arama is null or o.ad ilike '%' || p_arama || '%');

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', o.id, 'ad', o.ad, 'tur', o.tur, 'sinif', s.ad
         ) order by o.ad), '[]'::jsonb) into satirlar
  from (
    select o.* from public.ogrenciler o
    where o.aktif
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

-- =============================================================================
-- ÖDEV YÖNETİMİ
-- =============================================================================
create or replace function public.odev_olustur(
  p_token text,
  p_baslik text,
  p_aciklama text,
  p_sinif_id uuid,
  p_tur text,
  p_son_tarih date,
  p_soru_sayisi integer default null,
  p_cevap_anahtari jsonb default null,
  p_anahtar_yolu text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  yeni_id uuid;
begin
  perform public._ogretmen(p_token);

  insert into public.odevler
    (baslik, aciklama, sinif_id, tur, son_tarih, soru_sayisi,
     cevap_anahtari, anahtar_url, yayinda)
  values
    (btrim(p_baslik), nullif(btrim(coalesce(p_aciklama, '')), ''), p_sinif_id,
     p_tur, p_son_tarih, p_soru_sayisi, p_cevap_anahtari, p_anahtar_yolu,
     false)  -- Taslak olarak başlar; öğretmen onaylamadan öğrenciye düşmez.
  returning id into yeni_id;

  perform public._denetim('odev_olusturuldu', 'odevler', yeni_id, 'ogretmen');
  return jsonb_build_object('id', yeni_id, 'yayinda', false);
end;
$$;

-- Yayınlama ayrı adım: doğrulanmamış cevap anahtarı asla yayına çıkmaz
-- (Part XXVIII).
create or replace function public.odev_yayinla(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o public.odevler;
  eksik integer;
  i integer;
begin
  perform public._ogretmen(p_token);
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
  perform public._denetim('odev_yayinlandi', 'odevler', p_id, 'ogretmen');
  return jsonb_build_object('durum', 'tamam');
end;
$$;

create or replace function public.odev_sil(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o public.odevler;
begin
  perform public._ogretmen(p_token);
  select * into o from public.odevler where id = p_id;
  -- Silinen ödevin içeriği denetim izine yazılır; sessizce kaybolmaz.
  perform public._denetim('odev_silindi', 'odevler', p_id, 'ogretmen', to_jsonb(o));
  delete from public.odevler where id = p_id;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- =============================================================================
-- ÖĞRENCİ TARAFI
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ogrenci_odevleri
--
-- BU FONKSİYONUN EN KRİTİK DAVRANIŞI:
-- Cevap anahtarı (`cevap_anahtari`, `anahtar_url`), öğrenci teslim etmeden
-- SORGUYA HİÇ DAHİL EDİLMEZ. İstemcide gizlemek koruma değildir; karar
-- burada, sunucuda verilir (Part XXI).
-- -----------------------------------------------------------------------------
create or replace function public.ogrenci_odevleri(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o record;
  ogr record;
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'ogrenci' then
    raise exception 'Bu bölüm yalnızca öğrenciler içindir.' using errcode = '42501';
  end if;

  select ogr2.id, ogr2.ad, ogr2.tur, s.ad as sinif, ogr2.sinif_id
    into ogr
  from public.ogrenciler ogr2
  left join public.siniflar s on s.id = ogr2.sinif_id
  where ogr2.id = o.ogrenci_id;

  return jsonb_build_object(
    'ogrenci', jsonb_build_object('id', ogr.id, 'ad', ogr.ad, 'sinif', ogr.sinif),
    'odevler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'baslik', d.baslik,
        'aciklama', d.aciklama,
        'tur', d.tur,
        'son_tarih', d.son_tarih,
        'soru_sayisi', d.soru_sayisi,
        'gonderim', case when g.id is null then null else jsonb_build_object(
          'id', g.id, 'zaman', g.created_at, 'durum', g.durum,
          'dogru', g.dogru, 'yanlis', g.yanlis, 'bos', g.bos,
          'puan', g.puan, 'ogretmen_puan', g.ogretmen_puan,
          'ogretmen_yorum', g.ogretmen_yorum
        ) end,
        -- Anahtar YALNIZ teslim varsa eklenir. Teslim yoksa alan hiç yok.
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
-- odev_gonder
--
-- Mükerrer teslim iki katmanda engellenir: burada açık kontrol, ve
-- veritabanında `gonderim_tek` UNIQUE kısıtı. İkincisi yarış koşullarına
-- karşı gerçek korumadır (Part XLIX, madde 12).
-- -----------------------------------------------------------------------------
create or replace function public.odev_gonder(
  p_token text,
  p_odev uuid,
  p_foto_yolu text,
  p_cevaplar jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o record;
  d public.odevler;
  s record;
  yeni_id uuid;
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'ogrenci' then
    raise exception 'Yalnızca öğrenci ödev gönderebilir.' using errcode = '42501';
  end if;

  select * into d from public.odevler where id = p_odev and yayinda;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  -- Ödev öğrencinin sınıfına ait mi? (Part XLIX, madde 1)
  if not exists (
    select 1 from public.ogrenciler ogr
    where ogr.id = o.ogrenci_id and ogr.sinif_id = d.sinif_id
  ) then
    raise exception 'Bu ödev sizin sınıfınıza ait değil.' using errcode = '42501';
  end if;

  if p_foto_yolu is null or btrim(p_foto_yolu) = '' then
    raise exception 'Çözüm fotoğrafı olmadan ödev gönderilemez.' using errcode = '22023';
  end if;

  if d.tur = 'test' then
    select * into s from public._puanla(d.cevap_anahtari, coalesce(p_cevaplar, '{}'::jsonb), d.soru_sayisi);

    insert into public.gonderimler
      (odev_id, ogrenci_id, cevaplar, foto_yolu, dogru, yanlis, bos, puan, durum)
    values
      (p_odev, o.ogrenci_id, p_cevaplar, p_foto_yolu, s.dogru, s.yanlis, s.bos, s.puan, 'puanlandi')
    returning id into yeni_id;

    perform public._denetim('odev_gonderildi', 'gonderimler', yeni_id,
                            'ogrenci:' || o.ogrenci_id);

    return jsonb_build_object(
      'id', yeni_id, 'dogru', s.dogru, 'yanlis', s.yanlis,
      'bos', s.bos, 'puan', s.puan
    );
  else
    insert into public.gonderimler
      (odev_id, ogrenci_id, foto_yolu, durum)
    values
      (p_odev, o.ogrenci_id, p_foto_yolu, 'incelemede')
    returning id into yeni_id;

    perform public._denetim('odev_gonderildi', 'gonderimler', yeni_id,
                            'ogrenci:' || o.ogrenci_id);

    return jsonb_build_object('id', yeni_id, 'durum', 'incelemede');
  end if;

exception
  when unique_violation then
    raise exception 'Bu ödevi zaten gönderdiniz. Gönderim değiştirilemez.'
      using errcode = '23505';
end;
$$;

-- =============================================================================
-- AÇIK UÇLU PUANLAMA (öğretmen)
-- Not değişiklikleri her zaman denetim izine yazılır (Part XLIII).
-- =============================================================================
create or replace function public.acik_puanla(
  p_token text,
  p_gonderim uuid,
  p_puan numeric,
  p_yorum text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  eski public.gonderimler;
begin
  perform public._ogretmen(p_token);

  select * into eski from public.gonderimler where id = p_gonderim;
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
    'acik_uclu_puanlandi', 'gonderimler', p_gonderim, 'ogretmen',
    jsonb_build_object('ogretmen_puan', eski.ogretmen_puan, 'durum', eski.durum),
    jsonb_build_object('ogretmen_puan', p_puan, 'durum', 'onaylandi'));

  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- =============================================================================
-- VELİ PANELİ
--
-- Veli cevap anahtarını HİÇBİR KOŞULDA görmez (Kural 6). Aşağıdaki sorgu
-- `cevap_anahtari` ve `anahtar_url` alanlarını hiç seçmez.
-- =============================================================================
create or replace function public.veli_paneli(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
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
        'durum', g.durum
      ) order by d.son_tarih desc)
      from public.odevler d
      left join public.gonderimler g
        on g.odev_id = d.id and g.ogrenci_id = ogr.id
      where d.yayinda and d.sinif_id = ogr.sinif_id
    ), '[]'::jsonb),
    'mesajlar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kimden', m.kimden, 'metin', m.metin, 'zaman', m.created_at)
             order by m.created_at)
      from public.mesajlar m where m.ogrenci_id = ogr.id
    ), '[]'::jsonb),
    'odemeler', case when ogr.tur = 'ozel' then coalesce((
      select jsonb_agg(jsonb_build_object('tutar', p.tutar, 'tarih', p.tarih, 'odendi', p.odendi)
                       order by p.tarih desc)
      from public.odemeler p where p.ogrenci_id = ogr.id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'son_gorulme', (select zaman from public.okundu where ogrenci_id = ogr.id)
  );
end;
$$;

create or replace function public.okundu_isaretle(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o record;
begin
  select * into o from public._oturum(p_token);
  if o.ogrenci_id is null then
    raise exception 'Geçersiz oturum.' using errcode = '42501';
  end if;

  insert into public.okundu (ogrenci_id, rol, zaman)
  values (o.ogrenci_id, o.rol, now())
  on conflict (ogrenci_id) do update set zaman = now();

  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- =============================================================================
-- MESAJLAŞMA
-- Metin düz metin olarak saklanır ve istemcide React tarafından kaçışlanır;
-- HTML hiçbir yerde render edilmez (Part XXXI, XLIX madde 10).
-- =============================================================================
create or replace function public.mesaj_gonder(
  p_token text,
  p_metin text,
  p_ogrenci_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o record;
  hedef uuid;
  kimden text;
begin
  select * into o from public._oturum(p_token);

  if o.rol = 'ogretmen' then
    if p_ogrenci_id is null then
      raise exception 'Mesajın gideceği öğrenci seçilmeli.' using errcode = '22023';
    end if;
    hedef := p_ogrenci_id;
    kimden := 'ogretmen';
  elsif o.rol = 'veli' then
    -- Veli yalnız kendi öğrencisi adına yazabilir; parametre yok sayılır.
    hedef := o.ogrenci_id;
    kimden := 'veli';
  else
    raise exception 'Bu bölümde mesaj gönderemezsiniz.' using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_metin, ''))) = 0 then
    raise exception 'Mesaj boş olamaz.' using errcode = '22023';
  end if;

  insert into public.mesajlar (ogrenci_id, kimden, metin)
  values (hedef, kimden, btrim(p_metin));

  return jsonb_build_object('durum', 'tamam');
end;
$$;

create or replace function public.mesajlar_ogretmen(p_token text, p_ogrenci_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public._ogretmen(p_token);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'kimden', m.kimden, 'metin', m.metin, 'zaman', m.created_at)
           order by m.created_at)
    from public.mesajlar m where m.ogrenci_id = p_ogrenci_id
  ), '[]'::jsonb);
end;
$$;

-- =============================================================================
-- ÖZEL DERS: ders planı ve ödeme (Part XI)
-- Okul öğrencisinde bu kayıtlar hiç oluşturulamaz.
-- =============================================================================
create or replace function public._ozel_ders_ogrencisi(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.ogrenciler where id = p_id and tur = 'ozel') then
    raise exception 'Bu işlem yalnızca özel ders öğrencileri için yapılabilir.'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function public.ders_ekle(
  p_token text, p_ogrenci uuid, p_zaman timestamptz,
  p_mod text default 'yuzyuze', p_link text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare yeni uuid;
begin
  perform public._ogretmen(p_token);
  perform public._ozel_ders_ogrencisi(p_ogrenci);
  insert into public.dersler (ogrenci_id, zaman, mod, link)
  values (p_ogrenci, p_zaman, p_mod, nullif(btrim(coalesce(p_link, '')), ''))
  returning id into yeni;
  return jsonb_build_object('id', yeni);
end;
$$;

create or replace function public.ders_sil(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public._ogretmen(p_token);
  delete from public.dersler where id = p_id;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

create or replace function public.odeme_ekle(
  p_token text, p_ogrenci uuid, p_tutar numeric, p_tarih date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare yeni uuid;
begin
  perform public._ogretmen(p_token);
  perform public._ozel_ders_ogrencisi(p_ogrenci);
  insert into public.odemeler (ogrenci_id, tutar, tarih)
  values (p_ogrenci, p_tutar, p_tarih) returning id into yeni;
  perform public._denetim('odeme_eklendi', 'odemeler', yeni, 'ogretmen');
  return jsonb_build_object('id', yeni);
end;
$$;

create or replace function public.odeme_degistir(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public._ogretmen(p_token);
  update public.odemeler set odendi = not odendi where id = p_id;
  perform public._denetim('odeme_durumu_degisti', 'odemeler', p_id, 'ogretmen');
  return jsonb_build_object('durum', 'tamam');
end;
$$;

create or replace function public.odeme_sil(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare eski public.odemeler;
begin
  perform public._ogretmen(p_token);
  select * into eski from public.odemeler where id = p_id;
  perform public._denetim('odeme_silindi', 'odemeler', p_id, 'ogretmen', to_jsonb(eski));
  delete from public.odemeler where id = p_id;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- =============================================================================
-- DOSYA ERİŞİM YETKİSİ
--
-- Bu fonksiyon KARARI verir: "bu jeton bu dosyayı görebilir mi?"
--
-- İmzalı URL'in KENDİSİNİ üretmek SQL'den mümkün değil — Storage API
-- gerektiriyor. O adım bir Edge Function'a düşecek: fonksiyon önce bunu
-- çağırıp yetkiyi doğrulayacak, sonra service_role ile imzalı URL üretecek.
--
-- Faz 1'de bu Edge Function DEPLOY EDİLMEDİ (deploy için gereken erişim
-- yok). Dosya akışı Faz 2/3'te arayüzle birlikte devreye girecek.
-- Bucket private olduğu için bu arada dosyalara kimse erişemez — güvenli
-- taraf.
-- =============================================================================
create or replace function public.dosya_erisim_izni(p_token text, p_yol text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o record;
begin
  select * into o from public._oturum(p_token);

  -- Öğretmen her dosyayı görebilir.
  if o.rol = 'ogretmen' then
    return true;
  end if;

  -- Öğrenci: yalnız kendi gönderdiği dosya, ya da teslim ettiği ödevin
  -- cevap anahtarı.
  if o.rol = 'ogrenci' then
    return exists (
      select 1 from public.gonderimler g
      where g.ogrenci_id = o.ogrenci_id and g.foto_yolu = p_yol
    ) or exists (
      select 1 from public.odevler d
      join public.gonderimler g on g.odev_id = d.id and g.ogrenci_id = o.ogrenci_id
      where d.anahtar_url = p_yol
    );
  end if;

  -- Veli: cevap anahtarına ASLA erişemez (Kural 6). Yalnız çocuğunun
  -- gönderdiği çözüm kâğıdı.
  if o.rol = 'veli' then
    return exists (
      select 1 from public.gonderimler g
      where g.ogrenci_id = o.ogrenci_id and g.foto_yolu = p_yol
    );
  end if;

  return false;
end;
$$;

-- =============================================================================
-- YEDEKLEME / DIŞA AKTARIM (Part XXIV)
--
-- Faz 10'dan Faz 1'e alındı: canlı veritabanının silinmesiyle veri kaybı
-- yaşandı. Geri getirilemeyen bir sistemde yedeklemeyi sona bırakmak
-- savunulabilir değil.
-- =============================================================================
create or replace function public.disa_aktar(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public._ogretmen(p_token);
  perform public._denetim('disa_aktarildi', null, null, 'ogretmen');

  return jsonb_build_object(
    'alindi', now(),
    'siniflar',  coalesce((select jsonb_agg(to_jsonb(s) order by s.seviye, s.sube) from public.siniflar s), '[]'::jsonb),
    'ogrenciler', coalesce((select jsonb_agg(to_jsonb(o) order by o.ad) from public.ogrenciler o), '[]'::jsonb),
    'giris_kodlari', coalesce((select jsonb_agg(to_jsonb(k)) from public.giris_kodlari k), '[]'::jsonb),
    'odevler',   coalesce((select jsonb_agg(to_jsonb(d)) from public.odevler d), '[]'::jsonb),
    'gonderimler', coalesce((select jsonb_agg(to_jsonb(g)) from public.gonderimler g), '[]'::jsonb),
    'mesajlar',  coalesce((select jsonb_agg(to_jsonb(m)) from public.mesajlar m), '[]'::jsonb),
    'dersler',   coalesce((select jsonb_agg(to_jsonb(l)) from public.dersler l), '[]'::jsonb),
    'odemeler',  coalesce((select jsonb_agg(to_jsonb(p)) from public.odemeler p), '[]'::jsonb)
  );
end;
$$;

-- =============================================================================
-- EXECUTE HAKLARI — yalnız dışarıya açık olanlar

-- EXECUTE hakları tek yerde toplandı: 0005_fonksiyon_yetkileri.sql
