-- SEKİZ — 0082: Yeniden açılan ödevde fotoğrafı yeniden yükleyebilme
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Açıklamalı tam sürüm: supabase/migrations/0082_yeniden_yukleme.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Ayarlar → Verinizin yedeği)
-- 0081 ÇALIŞMIŞ OLMALI. Edge Function DEĞİŞMİYOR.
--
-- NE YAPIYOR: Gönderimi yeniden açtığınızda öğrenci artık çözüm
-- sayfalarının fotoğrafını YENİDEN YÜKLEYEBİLİR. Bugüne kadar depodaki
-- yol sabit olduğu için yeni fotoğraf sessizce atılıyor, eski (boş)
-- sayfalar gönderiliyordu.
--
-- Öğrenci iki yoldan birini seçiyor: yeni fotoğraf yüklemek, ya da
-- önceki sayfalarını olduğu gibi göndermek.
--
-- HİÇBİR DOSYA SİLİNMEZ VE ÜZERİNE YAZILMAZ. Her yeniden açma ayrı bir
-- yol kullanıyor; eski gönderimin fotoğrafı yerinde kalıyor, böylece
-- denetim izindeki kayıt da doğru kalıyor.
--
-- Beklenen sonuç: en altta tek satırlık bir tablo (_migration_kaydet → 0082).
-- =============================================================================


do $$
begin
  if to_regclass('public.odev_ek_sure') is null
     or to_regprocedure('public.gonderimi_yeniden_ac(text,uuid,text,date)') is null then
    raise exception '0082: önce 0081 çalıştırılmalı';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. _cozum_deneme — kaçıncı deneme
--
-- Denetim izinden türetiliyor ve bu bilinçli: yeniden açma zaten oraya
-- yazılıyor, ikinci bir sayaç tutmak iki kaydın ayrışması demekti. 0081
-- öncesi (tarihsiz) açılmış gönderimler de aynı satırları bıraktığı için
-- onlar da doğru numarayı alıyor.
-- -----------------------------------------------------------------------------
create or replace function public._cozum_deneme(p_odev uuid, p_ogrenci uuid)
returns integer
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select 1 + (
    select count(*)::integer
    from public.denetim_izi z
    where z.islem = 'gonderim_yeniden_acildi'
      and z.tablo = 'gonderimler'
      and z.eski ->> 'odev_id'    = p_odev::text
      and z.eski ->> 'ogrenci_id' = p_ogrenci::text
  );
$$;

revoke all on function public._cozum_deneme(uuid, uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. _cozum_yolu_gecerli — kalıp `-d<k>` ile genişliyor (gövde: 0078)
--
-- İMZA DEĞİŞMİYOR: `create or replace` yetiyor, 0007 tuzağı doğmuyor.
-- Bu fonksiyonu hem YÜKLEME izni (`dosya_erisim_izni` → Edge Function) hem
-- GÖNDERİM (`odev_gonder`) soruyor; ikisi de buradan geçiyor.
-- -----------------------------------------------------------------------------
create or replace function public._cozum_yolu_gecerli(
  p_ogrenci_id uuid,
  p_yol text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_odev_id uuid;
  v_parca   text[];
  v_sayfa   integer;
  v_deneme  integer;
begin
  -- Beklenen: cozum/<uuid>/<uuid>.<uzanti>               (1. deneme, 1. sayfa — 0009)
  --       ya: cozum/<uuid>/<uuid>-<2..40>.<uzanti>       (1. deneme, ek sayfa — 0054)
  --       ya: cozum/<uuid>/<uuid>-d<2..50>.<uzanti>      (k. deneme, 1. sayfa — 0082)
  --       ya: cozum/<uuid>/<uuid>-d<2..50>-<2..40>.<uzanti>  (k. deneme, ek sayfa)
  v_parca := regexp_match(
    p_yol,
    '^cozum/([0-9a-f-]{36})/([0-9a-f-]{36})(?:-d([2-9]|[1-4][0-9]|50))?(?:-([2-9]|[1-3][0-9]|40))?\.(jpg|jpeg|png|webp)$'
  );
  if v_parca is null then
    return false;
  end if;

  -- Yoldaki öğrenci kimliği jetondan gelenle AYNI olmalı. Başka öğrencinin
  -- yoluna yükleme denemesi burada düşer.
  if v_parca[2] <> p_ogrenci_id::text then
    return false;
  end if;

  v_odev_id := v_parca[1]::uuid;
  -- `-d1` diye bir yazım YOK: kalıp yalnız 2–50'yi tanıyor, yani 1.
  -- denemenin iki farklı yazımı olamaz. Aynı kural sayfa için de geçerli.
  v_deneme  := coalesce(v_parca[3]::integer, 1);
  v_sayfa   := coalesce(v_parca[4]::integer, 1);

  -- 0082: GELECEKTEKİ BİR DENEMEYE YÜKLENEMEZ. Küçük numara serbest,
  -- çünkü "önceki sayfalarımı kullan" tam olarak eski denemenin
  -- yollarını gönderiyor (öğretmenin kararı).
  if v_deneme > public._cozum_deneme(v_odev_id, p_ogrenci_id) then
    return false;
  end if;

  -- Ödev yayında ve öğrencinin sınıfına ait mi?
  return exists (
    select 1
    from public.odevler d
    join public.ogrenciler o on o.id = p_ogrenci_id
    where d.id = v_odev_id
      and d.yayinda
      and d.sinif_id = o.sinif_id
      and o.aktif
      -- 0054: sayfa numarası ödevin sınırını aşamaz. Sınır YÜKLEME
      -- anında da aranıyor, yalnız gönderimde değil: sınırı 2 olan ödevde
      -- öğrenci 3. sayfa için yükleme adresi bile alamaz. Depoya sınırın
      -- ötesinde dosya bırakmanın yolu burada kapanıyor.
      and v_sayfa <= d.sayfa_limiti
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. odev_gonder — yollar bir TEK denemeden (gövde: 0081_gonderim_iptali.sql)
--
-- İki şey değişti; gerisi mekanik kopya.
--
--   a) 1. sayfanın ve ek sayfaların AYRI regex'leri `-d<k>` önekini
--      tanıyor. Bu satırlar olduğu gibi kalsaydı yeni yol SESSİZCE
--      reddedilirdi — `_cozum_yolu_gecerli` geçse bile.
--   b) Bütün sayfalar AYNI denemeden gelmek zorunda: önek 1. sayfadan
--      türetilip her sayfaya uygulanıyor. 1. denemenin sayfa 1'i ile 2.
--      denemenin sayfa 2'si karışsaydı öğretmen karma bir çözüm görürdü.
-- -----------------------------------------------------------------------------
create or replace function public.odev_gonder(
  p_token text,
  p_odev uuid,
  p_foto_yolu text,
  p_cevaplar jsonb default null,
  -- 0054: 2. ve sonraki sayfaların yolları, SIRAYLA. null ya da boş dizi
  -- = tek sayfa; bugünkü çağrılar bu parametreyi hiç göndermiyor.
  p_ek_sayfa_yollari text[] default null
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
  v_ek      text[];
  v_ek_sayi integer;
  i         integer;
  v_foto    text;
  v_dparca  text[];
  v_deneme  integer;
  v_on      text;
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

  -- Sınıf arşivdeyse ödev öğretmenin hiçbir ekranında görünmüyor; gönderim
  -- kabul etmek görünmeyen bir iş üretmek olurdu.
  if public._sinif_arsivde(d.sinif_id) then
    raise exception 'Bu sınıf kapatılmış. Öğretmeniniz açana kadar ödev gönderemezsiniz.'
      using errcode = '22023';
  end if;

  -- Geç teslim kapalıysa son tarihten sonra gönderim yok.
  --
  -- 0056: YENİDEN AÇILAN GÖNDERİM İSTİSNA. Platform sahibi bu öğrencinin bu
  -- ödevdeki gönderimini yeniden açtıysa (`gonderimi_yeniden_ac`) öğrenci
  -- süre dolmuş olsa da gönderebilir: yeniden açmanın amacı öğrencinin
  -- mağdur olmaması. Gönderim yine "gecikmeli" görünür — dürüst kayıt.
  if not d.gec_teslim
     and (now() at time zone 'Europe/Istanbul')::date > d.son_tarih
     -- 0081: KİŞİSEL SON TARİH. Sahip gönderimi yeniden açarken bir tarih
     -- veriyor; öğrenci O TARİHE KADAR gönderebiliyor, sonra kapı yine
     -- kapanıyor. 0056'da süre sınırsız açılıyordu.
     and not exists (select 1 from public.odev_ek_sure e
                      where e.odev_id = p_odev and e.ogrenci_id = o.ogrenci_id
                        and (now() at time zone 'Europe/Istanbul')::date <= e.son_tarih)
     -- ESKİ KAYITLAR (0081 ÖNCESİ). Bu dal bir çatallanma değil: 0081'den
     -- önce yeniden açılmış ve hâlâ göndermemiş öğrenciler için duruyor.
     -- Onlara bir tarih uydurmak veri uydurmak olurdu. Sayı zamanla sıfıra
     -- iner; migration kaç kişi olduğunu çalışırken bildiriyor.
     and not public._tarihsiz_yeniden_acildi(p_odev, o.ogrenci_id)
     -- 0074: deneme hesabı süresi geçmiş ödeve de gönderebilir (öğretmen
     -- öğrencinin yaşadığını sonradan da deneyebilsin). Kayıt yine dürüst:
     -- gönderim `gecikmeli` görünür.
     and not public._deneme_mi(o.ogrenci_id) then
    raise exception 'Bu ödevin süresi doldu. Öğretmeniniz geç teslime izin vermiyor.'
      using errcode = '22023';
  end if;

  if p_foto_yolu is null or btrim(p_foto_yolu) = '' then
    raise exception 'Çözüm fotoğrafı olmadan ödev gönderilemez.' using errcode = '22023';
  end if;
  v_foto := btrim(p_foto_yolu);

  -- 0082: DENEME NUMARASI 1. SAYFADAN OKUNUYOR ve bütün sayfalara o
  -- uygulanıyor. `foto_yolu` her zaman 1. sayfa — onu okuyan her yer
  -- (öğretmen, veli) buna güveniyor; 0054'ten beri eksiz olmak zorundaydı,
  -- artık yalnız `-d<k>` eki serbest.
  v_dparca := regexp_match(
    v_foto,
    '^cozum/' || p_odev::text || '/' || o.ogrenci_id::text
      || '(?:-d([0-9]+))?\.(jpg|jpeg|png|webp)$'
  );
  if v_dparca is null then
    raise exception 'Geçersiz dosya yolu.' using errcode = '42501';
  end if;
  v_deneme := coalesce(v_dparca[1]::integer, 1);

  -- Yol kendi kimliğini, bu ödevi ve var olan bir denemeyi taşımalı.
  -- Sahiplik, yayında olma, sınıf, sayfa sınırı ve deneme üst sınırı
  -- `_cozum_yolu_gecerli` içinde.
  if not public._cozum_yolu_gecerli(o.ogrenci_id, v_foto) then
    raise exception 'Geçersiz dosya yolu.' using errcode = '42501';
  end if;

  -- Bütün sayfaların paylaştığı önek. Ek sayfa yolları buna `-<n>` ekler;
  -- başka bir denemenin sayfası bu önekle eşleşmez.
  v_on := 'cozum/' || p_odev::text || '/' || o.ogrenci_id::text
          || case when v_deneme > 1 then '-d' || v_deneme::text else '' end;

  -- EK SAYFALAR (0054).
  --
  -- SINIR ÖNCE, YOL SONRA. Öğretmen sınırı öğrenci sayfaları hazırladıktan
  -- sonra düşürmüş olabilir; o zaman fazla sayfanın yolu da geçersizdir ama
  -- öğrenciye söylenecek doğru şey "geçersiz yol" değil, "fazla sayfa".
  v_ek := coalesce(p_ek_sayfa_yollari, '{}'::text[]);
  v_ek_sayi := coalesce(array_length(v_ek, 1), 0);

  if 1 + v_ek_sayi > d.sayfa_limiti then
    raise exception 'Bu ödevde en fazla % sayfa gönderilebilir. Fazla sayfaları çıkarıp tekrar deneyin.',
      d.sayfa_limiti using errcode = '22023';
  end if;

  -- 0078: HER SAYFA ZORUNLU (yeni ödevler). Öğretmenin isteği: "ödev kaç
  -- sayfaysa öğrenci o kadar sayfa göndersin; her sayfayı göndermek
  -- zorunda". Eski ödevlerde (`tum_sayfalar` false) kural değişmedi: en az
  -- 1, en fazla sayfa_limiti.
  if d.tum_sayfalar and 1 + v_ek_sayi < d.sayfa_limiti then
    raise exception 'Bu ödev % sayfa; her sayfanın çözümünü eklemelisin (% sayfa eksik).',
      d.sayfa_limiti, d.sayfa_limiti - 1 - v_ek_sayi using errcode = '22023';
  end if;

  -- SIRA BOŞLUKSUZ: i. ek sayfa TAM OLARAK `-(i+1)` ekini taşımalı.
  -- Böylece aynı sayfa iki kez yazılamaz, sayfa atlanamaz ve öğretmenin
  -- gördüğü sıra öğrencinin gönderdiği sırayla aynıdır.
  --
  -- 0082: önek `v_on` olduğu için bu denetim AYNI ZAMANDA "hepsi tek
  -- denemeden" kuralıdır — başka bir denemenin sayfası eşleşmez.
  for i in 1 .. v_ek_sayi loop
    if v_ek[i] is null
       or btrim(v_ek[i]) !~ ('^' || v_on || '-' || (i + 1)::text || '\.(jpg|jpeg|png|webp)$')
       or not public._cozum_yolu_gecerli(o.ogrenci_id, btrim(v_ek[i])) then
      raise exception 'Geçersiz dosya yolu.' using errcode = '42501';
    end if;
    v_ek[i] := btrim(v_ek[i]);
  end loop;

  if d.tur = 'test' then
    select * into s from public._puanla(d.cevap_anahtari, coalesce(p_cevaplar, '{}'::jsonb), d.soru_sayisi);

    insert into public.gonderimler
      (odev_id, ogrenci_id, cevaplar, foto_yolu, ek_sayfa_yollari, dogru, yanlis, bos, puan, durum)
    values
      (p_odev, o.ogrenci_id, p_cevaplar, v_foto, nullif(v_ek, '{}'::text[]),
       s.dogru, s.yanlis, s.bos, s.puan, 'puanlandi')
    returning id into yeni_id;

    perform public._denetim('odev_gonderildi', 'gonderimler', yeni_id,
                            'ogrenci:' || o.ogrenci_id);

    return jsonb_build_object(
      'id', yeni_id, 'dogru', s.dogru, 'yanlis', s.yanlis,
      'bos', s.bos, 'puan', s.puan
    );
  else
    insert into public.gonderimler
      (odev_id, ogrenci_id, foto_yolu, ek_sayfa_yollari, durum)
    values
      (p_odev, o.ogrenci_id, v_foto, nullif(v_ek, '{}'::text[]), 'incelemede')
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
-- 4. ogrenci_odevleri — iki yeni alan (gövde: 0081_gonderim_iptali.sql)
--
-- İMZA DEĞİŞMİYOR.
--
--   deneme_no       o anki deneme; istemci yeni yolu buradan kuruyor.
--                   (`ogrenciler.deneme` ile karıştırmamak için `_no`:
--                    o, deneme HESABI bayrağı — bambaşka bir şey.)
--   onceki_sayfalar son iptalin sayfaları; "önceki sayfalarımı kullan"
--                   seçeneği bu listeyi gönderiyor. Hiç iptal yoksa null.
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

  select ogr2.id, ogr2.ad, ogr2.tur, s.ad as sinif, ogr2.sinif_id, ogr2.sinif_giris, ogr2.deneme,
         coalesce(s.arsiv, false) as sinif_arsiv
    into ogr
  from public.ogrenciler ogr2
  left join public.siniflar s on s.id = ogr2.sinif_id
  where ogr2.id = o.ogrenci_id;

  return jsonb_build_object(
    'ogrenci', jsonb_build_object('id', ogr.id, 'ad', ogr.ad, 'sinif', ogr.sinif,
                                  'tur', ogr.tur),
    -- 0065: okunmamış duyuru — öğrenci sekme çubuğundaki Pano rozeti.
    'okunmamis_duyuru', public._okunmamis_duyuru(ogr.id, ogr.sinif_id, ogr.sinif_giris),
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
        -- 0081: KİŞİSEL SON TARİH. Sahip gönderimi yeniden açarken tarih
        -- verdiyse öğrenci bunu görmeli; yoksa geçmiş bir tarihe bakıp
        -- "gönderemem" sanır. Yoksa null — bugünkü davranış.
        'ek_sure', (select e.son_tarih from public.odev_ek_sure e
                     where e.odev_id = d.id and e.ogrenci_id = ogr.id),
        -- 0082: KAÇINCI DENEME. İstemci yükleme yolunu buradan kuruyor;
        -- 1 ise yol 0009'dan beri kullanılanla birebir aynı.
        'deneme_no', public._cozum_deneme(d.id, ogr.id),
        -- 0082: SON İPTALİN SAYFALARI. Öğrenci isterse bunları yeniden
        -- gönderebiliyor (öğretmenin kararı: "öğrenci seçsin") — cevapları
        -- yanlışlıkla boş giden öğrenci sayfaları yeniden çekmesin.
        'onceki_sayfalar', (
          select jsonb_build_array(z.eski ->> 'foto_yolu')
                 -- `ek_sayfa_yollari` tek sayfalık gönderimde JSON null;
                 -- doğrudan eklemek diziye bir `null` sokardı.
                 || case when jsonb_typeof(z.eski -> 'ek_sayfa_yollari') = 'array'
                         then z.eski -> 'ek_sayfa_yollari'
                         else '[]'::jsonb end
          from public.denetim_izi z
          where z.islem = 'gonderim_yeniden_acildi'
            and z.tablo = 'gonderimler'
            and z.eski ->> 'odev_id'    = d.id::text
            and z.eski ->> 'ogrenci_id' = ogr.id::text
            and coalesce(z.eski ->> 'foto_yolu', '') <> ''
          order by z.zaman desc
          limit 1
        ),
        'soru_sayisi', d.soru_sayisi,
        -- 0074: deneme hesabında her ödev açık — arayüzün üç "teslim
        -- kapandı" kapısı bu alanı okuyor; gerçek öğrencide değişmiyor.
        'gec_teslim', d.gec_teslim or ogr.deneme,
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
        -- 0064: sınıfa gelmeden önce son tarihi dolan ödev bu öğrencinin değil.
        and public._odev_ogrenciye_dusar(ogr.sinif_giris, d.son_tarih, d.created_at)
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
-- 5. YETKİLER — imzalar değişmedi, yine de açıkça yazılıyor
-- -----------------------------------------------------------------------------
grant execute on function public.odev_gonder(text, uuid, text, jsonb, text[])
  to anon, authenticated;
grant execute on function public.ogrenci_odevleri(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. ÖZ-DENETİM
-- -----------------------------------------------------------------------------
do $$
declare eksik text[] := '{}';
begin
  if to_regprocedure('public._cozum_deneme(uuid,uuid)') is null then
    eksik := eksik || '_cozum_deneme kurulmadı'::text;
  end if;
  if has_function_privilege('anon', 'public._cozum_deneme(uuid, uuid)', 'execute') then
    eksik := eksik || '_cozum_deneme anon''a açık'::text;
  end if;

  -- KALIP GENİŞLEDİ Mİ.
  if pg_get_functiondef('public._cozum_yolu_gecerli(uuid,text)'::regprocedure)
       not like '%-d(%' then
    eksik := eksik || '_cozum_yolu_gecerli deneme ekini tanımıyor'::text;
  end if;
  -- GELECEKTEKİ DENEME KAPALI MI.
  if pg_get_functiondef('public._cozum_yolu_gecerli(uuid,text)'::regprocedure)
       not like '%_cozum_deneme%' then
    eksik := eksik || '_cozum_yolu_gecerli deneme numarasını denetlemiyor'::text;
  end if;

  -- `odev_gonder`in KENDİ regex'i de genişlemeli; yoksa yeni yol
  -- `_cozum_yolu_gecerli` geçse bile sessizce reddedilir.
  if pg_get_functiondef('public.odev_gonder(text,uuid,text,jsonb,text[])'::regprocedure)
       not like '%(?:-d([0-9]+))?%' then
    eksik := eksik || 'odev_gonder 1. sayfada deneme ekini tanımıyor'::text;
  end if;
  -- TEK DENEME KURALI: ek sayfalar 1. sayfanın önekini paylaşmalı.
  if pg_get_functiondef('public.odev_gonder(text,uuid,text,jsonb,text[])'::regprocedure)
       not like '%v_on || ''-'' || (i + 1)%' then
    eksik := eksik || 'odev_gonder ek sayfaları aynı denemeye bağlamıyor'::text;
  end if;

  if pg_get_functiondef('public.ogrenci_odevleri(text)'::regprocedure)
       not like '%deneme_no%'
     or pg_get_functiondef('public.ogrenci_odevleri(text)'::regprocedure)
       not like '%onceki_sayfalar%' then
    eksik := eksik || 'ogrenci_odevleri yeni alanları döndürmüyor'::text;
  end if;
  -- 0081 KORUNDU MU (kişisel tarih hâlâ yanıtta ve kapıda).
  if pg_get_functiondef('public.ogrenci_odevleri(text)'::regprocedure)
       not like '%ek_sure%' then
    eksik := eksik || '0081''in ek_sure alanı kayboldu'::text;
  end if;
  if pg_get_functiondef('public.odev_gonder(text,uuid,text,jsonb,text[])'::regprocedure)
       not like '%odev_ek_sure%' then
    eksik := eksik || '0081''in kişisel tarih kapısı kayboldu'::text;
  end if;

  if array_length(eksik, 1) > 0 then
    raise exception '0082 eksik: %', array_to_string(eksik, ' | ');
  end if;
end $$;

select public._migration_kaydet('0082');
