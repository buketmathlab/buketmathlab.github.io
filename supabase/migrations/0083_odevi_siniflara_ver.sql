-- =============================================================================
-- 0083 — VAR OLAN ÖDEVİ SONRADAN BAŞKA SINIFLARA DA VERME
--
-- Öğretmenin isteği: "Bir sınıfa gönderdiğim ödevin aynısını diğer sınıfa
-- da gönderebileyim. Mesela 10C'ye ödev gönderdim. Bu ödevin aynısını
-- DAHA SONRA istediğim diğer sınıflara da gönderebileyim."
--
-- -----------------------------------------------------------------------------
-- BUGÜN NE VAR, NE YOK
--
--   0030 `odevler_coklu_olustur` — aynı ödev OLUŞTURMA ANINDA birden çok
--        sınıfa verilebiliyor. Her sınıf KENDİ `odevler` satırını alıyor;
--        aralarındaki tek bağ `grup_id`.
--   0031 `odev_kardeslere_yay` — bir kardeşteki içerik düzeltmesi
--        ötekilere yayılıyor.
--
-- EKSİK OLAN: var olan bir ödeve SONRADAN sınıf eklemek. Bugün 10C'nin
-- ödevini 10D'ye vermek için form baştan dolduruluyor ve iki PDF yeniden
-- yükleniyor.
--
-- -----------------------------------------------------------------------------
-- KOPYA, ORTAK ÖDEV DEĞİL — 0030'un kararı aynen sürüyor
--
-- `odevler.sinif_id` `not null` ve neredeyse her uç ona göre süzüyor.
-- "Tek ödev - çok sınıf" şeması o uçların tamamını elden geçirmek demekti.
-- Her sınıfın KENDİ ödevi oluşuyor: kendi gönderimleri, kendi karnesi,
-- kendi ortalaması. Aralarındaki tek bağ `grup_id` — yani kopyalar
-- kardeş oluyor ve 0031'in yayma düğmesi onlara da ulaşıyor.
--
-- GÖVDE KOPYALANMIYOR: ön denetimden sonra döngüde mevcut
-- `public.odev_olustur` ÇAĞRILIYOR (0030'un gerekçesinin aynısı). İkinci
-- bir insert yazsaydık iki yol bir gün ayrışırdı.
--
-- -----------------------------------------------------------------------------
-- ÖĞRETMENİN İKİ KARARI (soruldu)
--
--   1. KOPYALAR TASLAK gelir; öğretmen görüp "Yayınla" der. Bugün yeni
--      ödev nasıl çalışıyorsa öyle: yanlış sınıf seçilirse öğrenci hiç
--      görmeden düzeltilir.
--   2. SEÇİLEN BÜTÜN SINIFLARA TEK TARİH. Sonradan her sınıfın tarihi
--      kendi sayfasından ayrı ayrı düzenlenebiliyor.
--
-- -----------------------------------------------------------------------------
-- PDF'LER YENİDEN YÜKLENMİYOR — ölçüldü
--
-- Kopya, kaynakla AYNI depo yolunu gösteriyor. Öğrencinin soru PDF'ine
-- erişimi `dosya_erisim_izni` içinde
--     d.odev_url = p_yol and d.yayinda and d.sinif_id = ogr.sinif_id
-- kuralından geliyor; kopya yeni sınıfın satırı olduğu için o sınıfın
-- öğrencisi dosyayı yayından sonra açabiliyor, başka sınıfın öğrencisi
-- açamıyor. Cevap anahtarı da aynı (kendi gönderimine bağlı).
-- YENİ İZİN AÇILMIYOR; testin 4. grubu bunu ölçüyor.
--
-- -----------------------------------------------------------------------------
-- `tum_sayfalar` TUZAĞI
--
-- 0078'den beri `odev_olustur` YENİ ödevi her zaman `tum_sayfalar = true`
-- yapıyor. Kopya bu alanı kaynaktan almazsa, 0078 öncesi bir ödevin
-- kopyası kaynaktan DAHA KATI olurdu (öğrenci her sayfayı göndermek
-- zorunda kalırdı). Bu yüzden oluşturmadan sonra kaynaktan yazılıyor.
--
-- Bu dosya tekrar çalıştırılabilir. Ön koşul: 0082.
-- =============================================================================

do $$
begin
  if to_regprocedure('public._cozum_deneme(uuid,uuid)') is null then
    raise exception '0083: önce 0082 çalıştırılmalı';
  end if;
  if to_regprocedure('public.odevler_coklu_olustur(text,jsonb,text,text,text,date,integer,jsonb,text,text,boolean,smallint,jsonb,smallint)') is null then
    raise exception '0083: önce 0030 çalıştırılmalı';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. odev_siniflara_kopyala — turun tek yeni ucu
--
-- Parametre sırası `odev_kardeslere_yay` ile akraba: önce jeton, sonra
-- KAYNAK ödev. Hedefler ve tarih sonra geliyor.
-- -----------------------------------------------------------------------------
create or replace function public.odev_siniflara_kopyala(
  p_token text,
  p_id uuid,
  p_sinif_idler jsonb,
  p_son_tarih date
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ogretmen uuid;
  d          public.odevler;
  v_adet     integer;
  v_ham      text;
  v_sinif    uuid;
  v_grup     uuid;
  v_yeni     jsonb;
  v_yeni_id  uuid;
  v_sonuc    jsonb := '[]'::jsonb;
  v_bugun    date := (now() at time zone 'Europe/Istanbul')::date;
begin
  v_ogretmen := public._ogretmen(p_token);
  perform public._odev_sahibi(v_ogretmen, p_id);

  select * into d from public.odevler where id = p_id;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  -- 0031'in kuralının aynısı: ödevi başka sınıflara yalnız ONU VEREN
  -- öğretmen verir. `_odev_sahibi` yöneticiye de izin veriyor; burada
  -- ayrıca sahiplik aranıyor.
  if d.ogretmen_id <> v_ogretmen then
    raise exception 'Bu ödevi başka sınıflara yalnız ödevi veren öğretmen verebilir.'
      using errcode = '42501';
  end if;

  if p_sinif_idler is null or jsonb_typeof(p_sinif_idler) <> 'array' then
    raise exception 'Sınıf listesi gerekli.' using errcode = '22023';
  end if;
  v_adet := jsonb_array_length(p_sinif_idler);
  if v_adet < 1 then
    raise exception 'En az bir sınıf seçin.' using errcode = '22023';
  end if;
  if v_adet > 12 then
    raise exception 'En fazla 12 sınıf seçilebilir.' using errcode = '22023';
  end if;
  if (select count(distinct e) from jsonb_array_elements_text(p_sinif_idler) e)
     <> v_adet then
    raise exception 'Aynı sınıf listede birden çok kez var.' using errcode = '22023';
  end if;

  if p_son_tarih is null then
    raise exception 'Yeni son tarihi seçin.' using errcode = '22023';
  end if;
  -- GEÇMİŞ TARİH YOK (0081'deki kural): geçmiş tarihli bir ödev öğrenciye
  -- daha açılmadan kapanmış görünürdü.
  if p_son_tarih < v_bugun then
    raise exception 'Yeni son tarih bugünden önce olamaz.' using errcode = '22023';
  end if;

  -- ---------------------------------------------------------------------
  -- ÖN DENETİM — hepsi YAZMADAN ÖNCE (0030'un deseni).
  --
  -- Atomikliği bu geçiş SAĞLAMIYOR (onu geri alma sağlıyor); boşa iş
  -- yapmayı önlüyor ve hata mesajı hangi sınıfta takıldığını söylüyor.
  -- ---------------------------------------------------------------------
  for v_ham in select value from jsonb_array_elements_text(p_sinif_idler) loop
    begin
      v_sinif := v_ham::uuid;
    exception when invalid_text_representation then
      raise exception 'Geçersiz sınıf kimliği: %', v_ham using errcode = '22023';
    end;

    if not exists (
      select 1 from public.siniflar s where s.id = v_sinif and not s.arsiv
    ) then
      raise exception 'Sınıf bulunamadı ya da arşivde.' using errcode = '22023';
    end if;

    if not public._ogretmenin_sinifi(v_ogretmen, v_sinif) then
      raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
    end if;

    if v_sinif = d.sinif_id then
      raise exception 'Bu ödev zaten bu sınıfa verilmiş.' using errcode = '22023';
    end if;

    -- GRUPTA ZATEN OLAN SINIF YOK. İkinci bir kopya, öğrencinin ekranında
    -- iki özdeş ödev demekti.
    if d.grup_id is not null and exists (
      select 1 from public.odevler d2
      where d2.grup_id = d.grup_id and d2.sinif_id = v_sinif
    ) then
      raise exception 'Bu ödev zaten bu sınıfa verilmiş.' using errcode = '22023';
    end if;
  end loop;

  -- KAYNAĞIN GRUBU YOKSA ŞİMDİ DOĞUYOR ve kaynağa da yazılıyor: kopya
  -- oluştuğu an kaynak da kardeşli hâle geliyor, yoksa yayma düğmesi
  -- yalnız kopyalarda çıkardı.
  v_grup := d.grup_id;
  if v_grup is null then
    v_grup := gen_random_uuid();
    update public.odevler set grup_id = v_grup where id = d.id;
  end if;

  for v_ham in select value from jsonb_array_elements_text(p_sinif_idler) loop
    v_sinif := v_ham::uuid;

    -- MEVCUT UÇ ÇAĞRILIYOR: taslak olarak açılması, konu temizliği, şık
    -- sayısı kuralı ve denetim izi kaydı orada. Burada tekrarlanmıyor.
    v_yeni := public.odev_olustur(
      p_token, d.baslik, d.aciklama, v_sinif, d.tur, p_son_tarih,
      d.soru_sayisi, d.cevap_anahtari, d.anahtar_url, d.odev_url,
      d.gec_teslim, d.sik_sayisi, d.konular, d.sayfa_limiti);
    v_yeni_id := (v_yeni ->> 'id')::uuid;

    -- `tum_sayfalar` KAYNAKTAN: 0078 yeni ödevi her zaman `true` yapıyor,
    -- kopya kaynaktan katı olmamalı. `grup_id` de burada bağlanıyor.
    update public.odevler
       set grup_id = v_grup,
           tum_sayfalar = d.tum_sayfalar
     where id = v_yeni_id;

    perform public._denetim(
      'odev_siniflara_verildi', 'odevler', v_yeni_id, public._aktor(v_ogretmen),
      to_jsonb(d),
      jsonb_build_object('kaynak_id', d.id, 'sinif_id', v_sinif,
                         'son_tarih', p_son_tarih, 'grup_id', v_grup));

    v_sonuc := v_sonuc || jsonb_build_object(
      'odev_id',  v_yeni_id,
      'sinif_id', v_sinif,
      'sinif',    (select s.ad from public.siniflar s where s.id = v_sinif));
  end loop;

  return jsonb_build_object('grup_id', v_grup, 'odevler', v_sonuc);
end;
$$;

revoke all on function public.odev_siniflara_kopyala(text, uuid, jsonb, date)
  from public, anon, authenticated;
grant execute on function public.odev_siniflara_kopyala(text, uuid, jsonb, date)
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. odev_detay — `verilebilir_siniflar` (gövde: 0078_tum_sayfalar_zorunlu.sql)
--
-- Diyalogun hangi sınıfları göstereceğini SUNUCU söylüyor: öğretmenin
-- arşivde olmayan sınıflarından, kaynağın sınıfı ve gruptakiler
-- çıkarılmış hâli. Ekranda süzmek, aynı listeyi iki yerde iki türlü
-- hesaplamak olurdu — ve ekran süzgeci kayarsa sunucu reddederken
-- öğretmen sebebini anlamazdı.
--
-- İMZA DEĞİŞMİYOR; yalnız alan ekleniyor.
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
    'tum_sayfalar', d.tum_sayfalar,
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
                                    where g.odev_id = d2.id
                                      and not public._deneme_mi(g.ogrenci_id)),
               'anahtar_ayni', (d2.cevap_anahtari is not distinct from d.cevap_anahtari),
               'arsiv', public._sinif_arsivde(d2.sinif_id)
             ) order by s2.seviye, s2.sube), '[]'::jsonb)
        from public.odevler d2
        join public.siniflar s2 on s2.id = d2.sinif_id
       where d2.grup_id = d.grup_id and d2.id <> d.id
    ) end,
    -- 0083: BU ÖDEVİN HENÜZ VERİLMEDİĞİ, öğretmenin kendi, arşivde
    -- olmayan sınıfları. Yalnız ödevi VEREN öğretmene dolu geliyor;
    -- başkası (yönetici dâhil) kopyalayamadığı için liste de boş.
    'verilebilir_siniflar', case when d.ogretmen_id = v_ogretmen then (
      select coalesce(jsonb_agg(jsonb_build_object('id', s3.id, 'ad', s3.ad)
                                order by s3.seviye, s3.sube), '[]'::jsonb)
        from public.siniflar s3
        join public.ogretmen_siniflari os
          on os.sinif_id = s3.id and os.ogretmen_id = v_ogretmen
       where not s3.arsiv
         and s3.id <> d.sinif_id
         and not exists (
           select 1 from public.odevler d3
           where d3.grup_id is not null
             and d3.grup_id = d.grup_id
             and d3.sinif_id = s3.id
         )
    ) end,
    'gonderim_sayisi', (select count(*) from public.gonderimler g where g.odev_id = d.id
                          and not public._deneme_mi(g.ogrenci_id)),
    'gec_gonderim_sayisi', (
      select count(*) from public.gonderimler g
      where g.odev_id = d.id and public._gecikmeli(g.created_at, d.son_tarih)
        and not public._deneme_mi(g.ogrenci_id)
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. ÖZ-DENETİM
-- -----------------------------------------------------------------------------
do $$
declare eksik text[] := '{}';
begin
  if to_regprocedure('public.odev_siniflara_kopyala(text,uuid,jsonb,date)') is null then
    eksik := eksik || 'odev_siniflara_kopyala kurulmadı'::text;
  end if;
  if not has_function_privilege('anon', 'public.odev_siniflara_kopyala(text, uuid, jsonb, date)', 'execute') then
    eksik := eksik || 'odev_siniflara_kopyala istemciye kapalı'::text;
  end if;

  -- TEK OLUŞTURMA YOLU: kopya kendi insert'ini yazmamalı.
  if pg_get_functiondef('public.odev_siniflara_kopyala(text,uuid,jsonb,date)'::regprocedure)
       not like '%public.odev_olustur(%' then
    eksik := eksik || 'kopyalama odev_olustur''u çağırmıyor'::text;
  end if;
  if pg_get_functiondef('public.odev_siniflara_kopyala(text,uuid,jsonb,date)'::regprocedure)
       like '%insert into public.odevler%' then
    eksik := eksik || 'kopyalama kendi insert''ini yazıyor — iki yol ayrışır'::text;
  end if;
  -- 0078 EZMESİ DÜZELTİLİYOR MU.
  if pg_get_functiondef('public.odev_siniflara_kopyala(text,uuid,jsonb,date)'::regprocedure)
       not like '%tum_sayfalar = d.tum_sayfalar%' then
    eksik := eksik || 'kopya tum_sayfalar''ı kaynaktan almıyor'::text;
  end if;

  if pg_get_functiondef('public.odev_detay(text,uuid)'::regprocedure)
       not like '%verilebilir_siniflar%' then
    eksik := eksik || 'odev_detay verilebilir_siniflar döndürmüyor'::text;
  end if;
  -- 0078 ve 0031 KORUNDU MU.
  if pg_get_functiondef('public.odev_detay(text,uuid)'::regprocedure)
       not like '%tum_sayfalar%'
     or pg_get_functiondef('public.odev_detay(text,uuid)'::regprocedure)
       not like '%kardes_detay%' then
    eksik := eksik || 'odev_detay''ın eski alanları kayboldu'::text;
  end if;

  if array_length(eksik, 1) > 0 then
    raise exception '0083 eksik: %', array_to_string(eksik, ' | ');
  end if;
end $$;

select public._migration_kaydet('0083');
