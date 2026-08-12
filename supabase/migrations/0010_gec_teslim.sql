-- =============================================================================
-- SEKİZ — 0010 GEÇ TESLİM AYARI (ödev başına)
--
-- NEDEN:
-- Bugüne kadar sunucu geç teslimi hiç denetlemiyordu — son tarihi geçmiş bir
-- ödev sessizce kabul ediliyordu. Öğretmenin kararı:
--
--   "Süresi geçtiği zaman geç gönderilen ödev kabul edilsin mi edilmesin mi,
--    öğretmen ödevi verirken bunun için seçenek açılsın."
--
-- Ayar ÖDEV BAŞINA tutuluyor, genel bir tercih olarak değil: bir deneme
-- sınavında "süre süredir", bir konu tekrarında geç gelen ödev hiç
-- gelmemesinden iyidir. İkisi aynı sistemde yaşayabilmeli.
--
-- VARSAYILAN `true` — yani bugünkü davranış. Mevcut ödevlerin kuralı bir
-- migration yüzünden sessizce sertleşmemeli: bir öğrenci dün gönderebildiği
-- ödevi bugün gönderemez hâle gelmemeli.
--
-- Bu dosya tekrar çalıştırılabilir.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Yeni sütun
-- -----------------------------------------------------------------------------
alter table public.odevler
  add column if not exists gec_teslim boolean not null default true;

comment on column public.odevler.gec_teslim is
  'Son tarih geçtikten sonra teslim alınsın mı. false ise odev_gonder '
  'reddeder. Varsayılan true — 0010 öncesi davranış budur.';

-- -----------------------------------------------------------------------------
-- 1b. Şık sayısı — aynı turda kapatılan ikinci eksik
--
-- Öğretmen ödev oluştururken 4 şık (A–D) ya da 5 şık (A–E) seçiyordu ama bu
-- seçim HİÇBİR YERDE SAKLANMIYORDU; yalnız o anki ekranın durumuydu. İki
-- somut sonucu var:
--
--   1. Öğrenci ekranı kaç şık göstereceğini bilemez. A–D'lik bir testte
--      olmayan bir E düğmesi görünürdü.
--   2. Öğretmen A–D'lik bir ödevi düzenlemeye açtığında ızgara A–E dönüyordu;
--      seçimi her seferinde yeniden yapması gerekirdi.
--
-- Varsayılan 5: bugüne kadarki ödevler için ekranların davranışı buydu.
-- -----------------------------------------------------------------------------
alter table public.odevler
  add column if not exists sik_sayisi smallint not null default 5;

do $$ begin
  alter table public.odevler
    add constraint odevler_sik_sayisi_gecerli check (sik_sayisi in (4, 5));
exception when duplicate_object then null;
end $$;

comment on column public.odevler.sik_sayisi is
  'Test ödevinde şık sayısı: 4 (A–D) ya da 5 (A–E). Öğrenci ekranı kaç '
  'düğme göstereceğini buradan bilir.';

-- -----------------------------------------------------------------------------
-- 2. odev_gonder — geç teslim denetimi
--
-- SAAT DİLİMİ AÇIKÇA YAZILIYOR. Sunucu UTC çalışıyor; düz `current_date`
-- kullansaydım Türkiye'de saat 03:00'ten önce teslim eden öğrenci sunucuya
-- göre "bir önceki gün" sayılırdı ve bu kimi zaman lehine, kimi zaman
-- aleyhine çalışırdı. Son tarih, öğrencinin yaşadığı güne göre biter.
--
-- Gövdenin geri kalanı 0009 ile aynı; yalnız denetim eklendi.
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
set search_path = public, extensions, pg_temp
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

  if not exists (
    select 1 from public.ogrenciler ogr
    where ogr.id = o.ogrenci_id and ogr.sinif_id = d.sinif_id
  ) then
    raise exception 'Bu ödev sizin sınıfınıza ait değil.' using errcode = '42501';
  end if;

  -- Geç teslim kapalıysa son tarihten sonra gönderim yok.
  if not d.gec_teslim
     and (now() at time zone 'Europe/Istanbul')::date > d.son_tarih then
    raise exception 'Bu ödevin süresi doldu. Öğretmeniniz geç teslime izin vermiyor.'
      using errcode = '22023';
  end if;

  if p_foto_yolu is null or btrim(p_foto_yolu) = '' then
    raise exception 'Çözüm fotoğrafı olmadan ödev gönderilemez.' using errcode = '22023';
  end if;

  -- Yol kendi kimliğini ve bu ödevi taşımalı.
  if not public._cozum_yolu_gecerli(o.ogrenci_id, btrim(p_foto_yolu))
     or btrim(p_foto_yolu) not like 'cozum/' || p_odev::text || '/%' then
    raise exception 'Geçersiz dosya yolu.' using errcode = '42501';
  end if;

  if d.tur = 'test' then
    select * into s from public._puanla(d.cevap_anahtari, coalesce(p_cevaplar, '{}'::jsonb), d.soru_sayisi);

    insert into public.gonderimler
      (odev_id, ogrenci_id, cevaplar, foto_yolu, dogru, yanlis, bos, puan, durum)
    values
      (p_odev, o.ogrenci_id, p_cevaplar, btrim(p_foto_yolu), s.dogru, s.yanlis, s.bos, s.puan, 'puanlandi')
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
      (p_odev, o.ogrenci_id, btrim(p_foto_yolu), 'incelemede')
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

-- -----------------------------------------------------------------------------
-- 3. odev_olustur — imza değişiyor
--
-- DİKKAT (0007'de yaşandı): yeni parametre eklemek YENİ BİR FONKSİYON
-- yaratır; eski imza EXECUTE hakkıyla birlikte ayakta kalır ve eski davranış
-- çağrılabilir olmayı sürdürür. Eski imza açıkça düşürülmeli.
-- -----------------------------------------------------------------------------
drop function if exists public.odev_olustur(
  text, text, text, uuid, text, date, integer, jsonb, text, text);

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
  p_sik_sayisi smallint default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  yeni_id uuid;
begin
  perform public._ogretmen(p_token);

  insert into public.odevler
    (baslik, aciklama, sinif_id, tur, son_tarih, soru_sayisi,
     cevap_anahtari, anahtar_url, odev_url, gec_teslim, sik_sayisi, yayinda)
  values
    (btrim(p_baslik), nullif(btrim(coalesce(p_aciklama, '')), ''), p_sinif_id,
     p_tur, p_son_tarih, p_soru_sayisi, p_cevap_anahtari,
     nullif(btrim(coalesce(p_anahtar_yolu, '')), ''),
     nullif(btrim(coalesce(p_odev_yolu, '')), ''),
     coalesce(p_gec_teslim, true),
     case when coalesce(p_sik_sayisi, 5) = 4 then 4 else 5 end,
     false)  -- Taslak olarak başlar; öğretmen onaylamadan öğrenciye düşmez.
  returning id into yeni_id;

  perform public._denetim('odev_olusturuldu', 'odevler', yeni_id, 'ogretmen');
  return jsonb_build_object('id', yeni_id, 'yayinda', false);
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. odev_guncelle — imza değişiyor
--
-- Geç teslim ayarı yayınlanmış ödevde de değiştirilebilir; puanlamayla
-- ilgisi yok, yeniden puanlama tetiklemez. Gövdenin kalanı 0008 ile aynı.
-- -----------------------------------------------------------------------------
drop function if exists public.odev_guncelle(
  text, uuid, text, text, uuid, date, integer, jsonb, text, text);

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
  p_gec_teslim boolean default true,
  p_sik_sayisi smallint default null
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
begin
  perform public._ogretmen(p_token);

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
                            else d.sik_sayisi end
   where id = p_id;

  perform public._denetim('odev_guncellendi', 'odevler', p_id, 'ogretmen',
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
          'yeniden_puanlandi', 'gonderimler', g.id, 'ogretmen',
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
-- 5. Okuma uçları — ayar üç yerden görünmeli
--
-- odev_detay        → düzenleme formu kutuyu doğru doldursun
-- odevler_listesi   → öğretmen listede hangi ödevin sert kurallı olduğunu görsün
-- ogrenci_odevleri  → öğrenci ekranı gönderme düğmesini buna göre göstersin
--
-- Öğrenci tarafında bu bilgi bir SIR DEĞİL: kuralı bilmeden ödev yapmak
-- haksızlık olurdu. Kararın kendisi yine sunucuda (`odev_gonder`); ekran
-- yalnızca aynı kuralı önceden söylüyor.
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
begin
  perform public._ogretmen(p_token);

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
    'sik_sayisi', d.sik_sayisi,
    'cevap_anahtari', coalesce(d.cevap_anahtari, '{}'::jsonb),
    'anahtar_yolu', d.anahtar_url,
    'odev_yolu', d.odev_url,
    'yayinda', d.yayinda,
    'gonderim_sayisi', (select count(*) from public.gonderimler g where g.odev_id = d.id)
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
begin
  perform public._ogretmen(p_token);

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', d.id,
      'baslik', d.baslik,
      'aciklama', d.aciklama,
      'tur', d.tur,
      'sinif_id', d.sinif_id,
      'sinif', s.ad,
      'son_tarih', d.son_tarih,
      'soru_sayisi', d.soru_sayisi,
      'gec_teslim', d.gec_teslim,
      'sik_sayisi', d.sik_sayisi,
      'yayinda', d.yayinda,
      'olusturma', d.created_at,
      -- Dosyaların kendisi değil, varlıkları.
      'odev_pdf_var', (d.odev_url is not null),
      'anahtar_pdf_var', (d.anahtar_url is not null),
      'gonderim_sayisi', (
        select count(*) from public.gonderimler g where g.odev_id = d.id
      ),
      'sinif_mevcudu', (
        select count(*) from public.ogrenciler o
        where o.sinif_id = d.sinif_id and o.aktif
      )
    ) order by d.son_tarih desc, d.created_at desc)
    from public.odevler d
    join public.siniflar s on s.id = d.sinif_id
    where (p_sinif_id is null or d.sinif_id = p_sinif_id)
      and (p_yayinda is null or d.yayinda = p_yayinda)
  ), '[]'::jsonb);
end;
$$;

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
        'gec_teslim', d.gec_teslim,
        'sik_sayisi', d.sik_sayisi,
        -- Soru PDF'i: teslimden bağımsız, her zaman.
        'odev_yolu', d.odev_url,
        'gonderim', case when g.id is null then null else jsonb_build_object(
          'id', g.id, 'zaman', g.created_at, 'durum', g.durum,
          'dogru', g.dogru, 'yanlis', g.yanlis, 'bos', g.bos,
          'puan', g.puan, 'ogretmen_puan', g.ogretmen_puan,
          'ogretmen_yorum', g.ogretmen_yorum,
          -- Öğrencinin KENDİ verdiği cevaplar. Sızıntı değil, kendi verisi;
          -- ve bu olmadan "8 doğru 1 yanlış" bilgisi işe yaramıyor —
          -- öğrenci HANGİ soruyu kaçırdığını göremiyordu.
          'cevaplar', coalesce(g.cevaplar, '{}'::jsonb)
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
-- 6. YETKİLER (0005 deseni: önce hepsini çek, sonra açıkça ver)
--
-- İki YENİ imza doğdu; ikisi de sıfırdan yetkilendiriliyor. Eski imzalar
-- yukarıda düşürüldüğü için onlara verilmiş haklar da onlarla gitti.
-- -----------------------------------------------------------------------------
revoke all on function
  public.odev_olustur(text, text, text, uuid, text, date, integer, jsonb, text, text, boolean, smallint)
  from public, anon, authenticated;
grant execute on function
  public.odev_olustur(text, text, text, uuid, text, date, integer, jsonb, text, text, boolean, smallint)
  to anon, authenticated;

revoke all on function
  public.odev_guncelle(text, uuid, text, text, uuid, date, integer, jsonb, text, text, boolean, smallint)
  from public, anon, authenticated;
grant execute on function
  public.odev_guncelle(text, uuid, text, text, uuid, date, integer, jsonb, text, text, boolean, smallint)
  to anon, authenticated;

grant execute on function public.odev_gonder(text, uuid, text, jsonb) to anon, authenticated;
grant execute on function public.odev_detay(text, uuid)               to anon, authenticated;
grant execute on function public.odevler_listesi(text, uuid, boolean) to anon, authenticated;
grant execute on function public.ogrenci_odevleri(text)               to anon, authenticated;
