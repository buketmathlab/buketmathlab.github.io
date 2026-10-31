-- SEKİZ — 0086: Çalışma kağıdı (puansız üçüncü ödev türü)
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Açıklamalı tam sürüm: supabase/migrations/0086_calisma_kagidi.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Ayarlar → Verinizin yedeği)
-- 0085 ÇALIŞMIŞ OLMALI. Edge Function DEĞİŞMİYOR.
--
-- NE YAPIYOR: Ödev oluştururken üçüncü bir tür çıkıyor: ÇALIŞMA KAĞIDI.
-- Puanlanmıyor. Öğrenci çözümünü yine yüklüyor (fotoğraf ya da PDF);
-- siz yalnız "gönderdi / göndermedi" görüyorsunuz.
--
-- AYRI KATEGORİ: Ödevler listesinde "Çalışma kağıtları" süzgeci var.
-- Karnede ve sınıf listesinde kendi satırı: "Çalışma kağıdı: 4/5
-- gönderdi". ORTALAMALARA HİÇ GİRMİYOR — ne sizin listenizde, ne
-- öğrencinin karnesinde, ne velide.
--
-- PUAN HİÇBİR YOLDAN VERİLEMİYOR: puanlama uçları bu türü reddediyor ve
-- tablo kısıtı cevap anahtarını kabul etmiyor. Kural ekranda değil,
-- veritabanında.
--
-- Öğrenci ve veli de türü görüyor, böylece "daha değerlendirilmedi"
-- sanılmıyor.
--
-- MEVCUT ÖDEVLERE DOKUNULMUYOR. Test ve açık uçlu ödevlerin davranışı
-- aynı; ölçümün 10. grubu bunu sayı sayı karşılaştırıyor.
--
-- Beklenen sonuç: en altta tek satırlık bir tablo (_migration_kaydet → 0086).
-- =============================================================================

do $$
begin
  if to_regprocedure('public._odev_tarihleri(uuid,date)') is null then
    raise exception '0086: önce 0085 çalıştırılmalı';
  end if;
  if to_regprocedure('public._ogrenci_ortalamalari(uuid,uuid,date)') is null then
    raise exception '0086: önce 0080 çalıştırılmalı';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. KISITLAR — üçüncü tür ve yeni gönderim durumu
-- -----------------------------------------------------------------------------

-- Var olan satırlar etkilenmiyor: küme yalnız GENİŞLİYOR.
alter table public.odevler drop constraint if exists odevler_tur_check;
alter table public.odevler
  add constraint odevler_tur_check check (tur in ('test', 'acik', 'calisma'));

-- İKİNCİ KISIT — ölçüm bulmuştu, akıl yürütme değil.
--
-- `odev_test_tutarli` (0001) "test değilse `acik`'tir" diye yazılmıştı;
-- çalışma kağıdı satırı bu yüzden reddediliyordu. Yeniden yazılırken
-- kural GÜÇLENDİRİLİYOR: çalışma kağıdında soru sayısı ve cevap
-- anahtarı null OLMAK ZORUNDA. Böylece "puanlanmaz" kuralı yalnız
-- fonksiyonda değil, VERİTABANINDA duruyor — hangi yoldan yazılırsa
-- yazılsın anahtar giremiyor.
alter table public.odevler drop constraint if exists odev_test_tutarli;
alter table public.odevler
  add constraint odev_test_tutarli check (
    (tur = 'test' and soru_sayisi is not null and cevap_anahtari is not null)
    or tur = 'acik'
    or (tur = 'calisma' and soru_sayisi is null and cevap_anahtari is null)
  );

alter table public.gonderimler drop constraint if exists gonderimler_durum_check;
alter table public.gonderimler
  add constraint gonderimler_durum_check
  check (durum in ('incelemede', 'onaylandi', 'puanlandi', 'tamamlandi'));

-- -----------------------------------------------------------------------------
-- 2. UÇLAR — her biri EN SON tanımından kopyalandı, yalnız işaretli
--    satırlar eklendi
-- -----------------------------------------------------------------------------
-- odev_olustur — çalışma kağıdında puanlama alanları zorla null
-- kopya: 0078_tum_sayfalar_zorunlu.sql
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
  p_sik_sayisi smallint default 5,
  p_konular jsonb default null,
  -- 0054: öğrencinin bu ödevde yükleyebileceği görsel sayısı.
  p_sayfa_limiti smallint default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  yeni_id uuid;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  -- Öğretmen yalnız KENDİ sınıfına ödev verebilir.
  if not public._ogretmenin_sinifi(v_ogretmen, p_sinif_id) then
    raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
  end if;

  -- 0054: 1–8. Tablo kısıtı da yakalar, ama kısıtın ham adını öğretmene
  -- göstermemek için burada Türkçe söylüyoruz.
  -- 0078: 1–40 (ödevin sayfa sayısı).
  if coalesce(p_sayfa_limiti, 1) not between 1 and 40 then
    raise exception 'Sayfa sayısı 1 ile 40 arasında olmalı.' using errcode = '22023';
  end if;

  -- 0086: ÇALIŞMA KAĞIDI PUANLANMIYOR.
  --
  -- Soru sayısı, cevap anahtarı ve konu eşlemesi bu türde anlamsız.
  -- Ekran onları göstermiyor, ama kural EKRANDA DEĞİL BURADA olmalı:
  -- aksi hâlde başka bir çağrı onları doldurur ve puanlama yolları
  -- (`_puanla`, konu analizi) sessizce yeniden açılırdı.
  if p_tur = 'calisma' then
    p_soru_sayisi    := null;
    p_cevap_anahtari := null;
    p_konular        := null;
  end if;

  insert into public.odevler
    (baslik, aciklama, sinif_id, tur, son_tarih, soru_sayisi,
     cevap_anahtari, anahtar_url, odev_url, gec_teslim, sik_sayisi, konular, yayinda,
     ogretmen_id, sayfa_limiti, tum_sayfalar)
  values
    (btrim(p_baslik), nullif(btrim(coalesce(p_aciklama, '')), ''), p_sinif_id,
     p_tur, p_son_tarih, p_soru_sayisi, p_cevap_anahtari,
     nullif(btrim(coalesce(p_anahtar_yolu, '')), ''),
     nullif(btrim(coalesce(p_odev_yolu, '')), ''),
     coalesce(p_gec_teslim, true),
     case when coalesce(p_sik_sayisi, 5) = 4 then 4 else 5 end,
     public._konu_temizle(p_konular, p_soru_sayisi),
     false,  -- Taslak olarak başlar; öğretmen onaylamadan öğrenciye düşmez.
     v_ogretmen,
     coalesce(p_sayfa_limiti, 1),
     -- 0078: YENİ ÖDEVDE HER SAYFA ZORUNLU. Öğrenci tam sayfa_limiti kadar
     -- sayfa gönderir; eksik de fazla da kabul edilmez (odev_gonder).
     true)
  returning id into yeni_id;

  perform public._denetim('odev_olusturuldu', 'odevler', yeni_id, public._aktor(v_ogretmen));
  return jsonb_build_object('id', yeni_id, 'yayinda', false);
end;
$$;

-- odev_gonder — üçüncü dal: puan yok, durum tamamlandi
-- kopya: 0082_yeniden_yukleme.sql
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
  elsif d.tur = 'calisma' then
    -- 0086: ÇALIŞMA KAĞIDI — PUAN HESAPLANMIYOR.
    --
    -- Öğretmenin cümlesi: "Ödevi gönderdim mi, göndermedim mi?" Tek
    -- bilgi bu. `durum` yeni bir değer alıyor:
    --   'puanlandi' YALAN olurdu (ortada puan yok),
    --   'incelemede' öğretmene hiç bitmeyen bir değerlendirme kuyruğu
    --   gösterirdi ve `acik_puanla` onu puanlanabilir sayardı.
    -- Çözüm yüklemesi aynen yapılıyor (öğretmenin kararı): yukarıdaki
    -- sayfa, yol ve süre kurallarının hepsi bu türde de geçerli.
    insert into public.gonderimler
      (odev_id, ogrenci_id, foto_yolu, ek_sayfa_yollari, durum)
    values
      (p_odev, o.ogrenci_id, v_foto, nullif(v_ek, '{}'::text[]), 'tamamlandi')
    returning id into yeni_id;

    perform public._denetim('odev_gonderildi', 'gonderimler', yeni_id,
                            'ogrenci:' || o.ogrenci_id);

    return jsonb_build_object('id', yeni_id, 'durum', 'tamamlandi');
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

-- acik_puanla — çalışma kağıdı puanlanamaz
-- kopya: 0055_yonetici_odevi_ve_duzeltme.sql
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

  -- 0055: bu uç YALNIZ İLK puanı verir — açık uçlu, henüz puanlanmamış
  -- (`incelemede`) gönderim. Sistemin puanladığı test (`puanlandi`) ve daha
  -- önce puanlanmış gönderim (`onaylandi`) buradan DEĞİŞTİRİLEMEZ: sonradan
  -- ya da sistemden farklı puan yazmak yalnız platform sahibinin işi ve
  -- `puan_duzelt` ile, sebebiyle, denetim izine yazılarak yapılır. Sahip de
  -- bu uçtan geçemez — her sonradan değişikliğin bir sebebi olsun.
  -- 0086: ÇALIŞMA KAĞIDI PUANLANMAZ.
  --
  -- Aşağıdaki `durum` kapısı bunu zaten engelliyor ('tamamlandi'
  -- 'incelemede' değil), ama mesajı yanıltıcıydı: öğretmene "sahibe
  -- sor" derdi, oysa sahip de puanlayamaz. Kural açıkça yazılıyor.
  if exists (select 1 from public.odevler d
              where d.id = eski.odev_id and d.tur = 'calisma') then
    raise exception 'Çalışma kağıdı puanlanmaz; yalnız gönderildi ya da gönderilmedi.'
      using errcode = '42501';
  end if;

  if eski.durum <> 'incelemede' then
    raise exception 'Verilmiş puanı yalnız platformun sahibi değiştirebilir.'
      using errcode = '42501';
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
    'acik_uclu_puanlandi', 'gonderimler', p_gonderim, public._aktor(v_ogretmen),
    jsonb_build_object('ogretmen_puan', eski.ogretmen_puan, 'durum', eski.durum),
    jsonb_build_object('ogretmen_puan', p_puan, 'durum', 'onaylandi'));

  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- puan_duzelt — çalışma kağıdı puanlanamaz (arka kapı da kapalı)
-- kopya: 0055_yonetici_odevi_ve_duzeltme.sql
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

  -- 0086: ÇALIŞMA KAĞIDI PUANLANMAZ — SAHİP DE PUANLAYAMAZ.
  --
  -- Bu uç tür denetlemiyordu. Denetlemeseydi "puan hesaplamasına gerek
  -- yok" kuralı ekranda kalır, veride kalmazdı: tek bir çağrı çalışma
  -- kağıdına not yazar ve o not bütün ortalamalara sızardı.
  if exists (select 1 from public.odevler d
              where d.id = eski.odev_id and d.tur = 'calisma') then
    raise exception 'Çalışma kağıdı puanlanmaz; yalnız gönderildi ya da gönderilmedi.'
      using errcode = '42501';
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

-- _ogrenci_ortalamalari — çalışma kağıdı ortalamanın DIŞINDA, kendi sayacıyla
-- kopya: 0080_iki_ortalama.sql
create or replace function public._ogrenci_ortalamalari(
  p_ogrenci uuid,
  p_sinif uuid,
  p_sinif_giris date
)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  with o as (
    select g.id is not null as gonderdi,
           coalesce(g.ogretmen_puan, g.puan) as puan,
           -- 0086: çalışma kağıdı AYNI sorguda ama AYRI sayılıyor.
           (d.tur = 'calisma') as calisma
      from public.odevler d
      left join public.gonderimler g
        on g.odev_id = d.id and g.ogrenci_id = p_ogrenci
     where d.sinif_id = p_sinif
       and d.yayinda
       and d.son_tarih < (now() at time zone 'Europe/Istanbul')::date
       and public._odev_ogrenciye_dusar(p_sinif_giris, d.son_tarih, d.created_at)
  )
  select jsonb_build_object(
    -- 0086: AŞAĞIDAKİ HER SAYI ÇALIŞMA KAĞIDININ DIŞINDA.
    --
    -- Süzgeç olmasaydı `tum_ortalama` göndermeyen öğrenciye 0 yazardı
    -- (çalışma kağıdının puanı yok, ama "gönderilmedi" dalı 0 veriyor)
    -- ve `puan_bekleyen` hiç eksilmezdi.
    'odev_sayisi',      (count(*) filter (where not calisma))::integer,
    'yapilan',          (count(*) filter (where not calisma and gonderdi))::integer,
    'yapilmayan',       (count(*) filter (where not calisma and not gonderdi))::integer,
    'puan_bekleyen',    (count(*) filter (where not calisma and gonderdi and puan is null))::integer,
    'yapilan_ortalama', avg(puan) filter (where not calisma and gonderdi),
    'tum_ortalama',     avg(case when gonderdi then puan else 0 end) filter (where not calisma),

    -- 0086: ÇALIŞMA KAĞIDININ KENDİ SATIRI (öğretmenin kararı).
    -- Puan yok; tek soru "gönderdi mi".
    'calisma_sayisi',   (count(*) filter (where calisma))::integer,
    'calisma_yapilan',  (count(*) filter (where calisma and gonderdi))::integer
  )
  from o;
$$;

-- kendi_karnem — ödev sayısı çalışma kağıdını saymıyor; ayrı satır eklendi
-- kopya: 0080_iki_ortalama.sql
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
  v_giris       date;
  v_ort         jsonb;
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

  select g.ad, g.sinif_id, g.sinif_giris into v_ad, v_sinif_id, v_giris
    from public.ogrenciler g where g.id = v_ogrenci_id;
  if v_ad is null then
    raise exception 'Öğrenci bulunamadı.' using errcode = 'P0002';
  end if;

  -- 0080: iki ortalama, öğretmenin listesiyle AYNI yardımcıdan.
  v_ort := public._ogrenci_ortalamalari(v_ogrenci_id, v_sinif_id, v_giris);

  select s.ad into v_sinif_ad from public.siniflar s where s.id = v_sinif_id;

  -- 0013 VE 0023 İLE BİREBİR AYNI ÖLÇÜT.
  -- 0086: çalışma kağıdı bu sayıya GİRMİYOR — "kaç ödev üzerinden
  -- konuşuyoruz" sorusunun cevabı puanlanan ödevlerdir.
  select count(*)::integer into v_odev_sayisi
  from public.odevler d
  where d.sinif_id = v_sinif_id and public._odev_ogrenciye_dusar(v_giris, d.son_tarih, d.created_at) and d.yayinda and d.son_tarih < bugun_tr
    and d.tur <> 'calisma';

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
    --
    -- 0080: hesap `_ogrenci_ortalamalari`'na taşındı (anlam aynı: yaptığı
    -- ve puanlanmış ödevler). Ödev kümesi öğretmenin listesiyle birleşti:
    -- sınıfa gelmeden önce kapanmış ödev buraya da girmiyor.
    'genel_ortalama', round((v_ort->>'yapilan_ortalama')::numeric, 1),

    -- 0080 — TÜM ÖDEVLER ORTALAMASI (öğretmenin isteği): yapılmayan ödev
    -- 0 sayılır. Amaç kıyas değil; çocuk, ödevlerini yaparsa kendi
    -- ortalamasının ne kadar yükseleceğini görsün. Yine YALNIZ kendisi.
    -- Puanlanmamış gönderim puan verilene kadar ikisine de girmez.
    'tum_ortalama', round((v_ort->>'tum_ortalama')::numeric, 1),
    'yapilmayan', (v_ort->>'yapilmayan')::integer,
    'puan_bekleyen', (v_ort->>'puan_bekleyen')::integer,

    -- 0086 — ÇALIŞMA KAĞIDI: AYRI SATIR, PUANSIZ.
    -- Ortalamaya girmiyor; "kaçını gönderdin" sorusunun cevabı.
    'calisma_sayisi', (v_ort->>'calisma_sayisi')::integer,
    'calisma_yapilan', (v_ort->>'calisma_yapilan')::integer,

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
        where d.sinif_id = v_sinif_id and public._odev_ogrenciye_dusar(v_giris, d.son_tarih, d.created_at)
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
      where d.sinif_id = v_sinif_id and public._odev_ogrenciye_dusar(v_giris, d.son_tarih, d.created_at)
        and d.yayinda
        and d.son_tarih < bugun_tr
        -- 0086: GELİŞİM GRAFİĞİNE ÇALIŞMA KAĞIDI GİRMİYOR.
        --
        -- Ölçüm buldu: süzgeçsiz hâlde grafiğe `deger: null` bir nokta
        -- ekleniyordu. Puanı olmayan bir işi puan grafiğine koymak,
        -- çocuğa olmayan bir düşüş göstermek olurdu.
        and d.tur <> 'calisma'
    ), '[]'::jsonb)
  );
end;
$$;

-- sinif_ogrenci_ozeti — üç sayım çalışma kağıdını dışlıyor; ayrı satır eklendi
-- kopya: 0080_iki_ortalama.sql
create or replace function public.sinif_ogrenci_ozeti(p_token text, p_sinif_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun_tr date := (now() at time zone 'Europe/Istanbul')::date;
  v_ogretmen uuid;
  v_sinif record;
begin
  v_ogretmen := public._ogretmen(p_token);
  if not public._ogretmenin_sinifi(v_ogretmen, p_sinif_id) then
    raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
  end if;

  select s.id, s.ad, s.ozel into v_sinif
    from public.siniflar s where s.id = p_sinif_id and not s.arsiv;
  if not found then
    raise exception 'Sınıf bulunamadı ya da arşivde.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'sinif', jsonb_build_object('id', v_sinif.id, 'ad', v_sinif.ad, 'ozel', v_sinif.ozel),
    'ogrenciler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id,
               'ad', o.ad,
               'ogrenci_no', o.ogrenci_no,
               'tur', o.tur,

               -- ORTALAMA — öğretmenin 1. kararı (0051): TÜM ödevler,
               -- yapılmayan 0. 0080: puanlanmamış gönderim (puan bekleyen)
               -- artık 0 sayılmıyor; puan verilene kadar hesaba girmiyor.
               'ortalama', round((oo.x->>'tum_ortalama')::numeric, 2),

               -- 0080: YAPTIĞI ödevlerin ortalaması (puanlı gönderimler).
               -- İki sayı arasındaki fark, yapılmayan ödevlerin bedeli.
               'yapilan_ortalama', round((oo.x->>'yapilan_ortalama')::numeric, 2),

               -- 0080: gönderdiği ama henüz puanı olmayan ödev sayısı.
               'puan_bekleyen', (oo.x->>'puan_bekleyen')::integer,

               -- 0086 — ÇALIŞMA KAĞIDI: AYRI SATIR. Ortalamaya girmiyor.
               'calisma_sayisi', (oo.x->>'calisma_sayisi')::integer,
               'calisma_yapilan', (oo.x->>'calisma_yapilan')::integer,

               -- SÜRESİ DOLMUŞ ÖDEV SAYISI — ortalamanın paydası.
               -- 0086: çalışma kağıdı paydaya girmiyor.
               'odev_sayisi', (
                 select count(*)::integer from public.odevler d
                  where d.sinif_id = p_sinif_id and d.yayinda
                    and d.son_tarih < bugun_tr
                    and d.tur <> 'calisma'
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
               ),

               -- YAPILAN (0052) — bu ödevlerin kaçında GÖNDERİM VAR.
               -- Puanına bakılmıyor: sıfır alan da yapmıştır.
               'yapilan', (
                 select count(*)::integer from public.odevler d
                  where d.sinif_id = p_sinif_id and d.yayinda
                    and d.son_tarih < bugun_tr
                    and d.tur <> 'calisma'
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
                    and exists (select 1 from public.gonderimler g
                                 where g.odev_id = d.id and g.ogrenci_id = o.id)
               ),

               -- YAPILMAYAN (0052) — aynı kümenin geri kalanı.
               'yapilmayan', (
                 select count(*)::integer from public.odevler d
                  where d.sinif_id = p_sinif_id and d.yayinda
                    and d.son_tarih < bugun_tr
                    and d.tur <> 'calisma'
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
                    and not exists (select 1 from public.gonderimler g
                                     where g.odev_id = d.id and g.ogrenci_id = o.id)
               ),

               -- EKSİK KONULAR (0053) — en fazla 3, en eksikten başlayarak.
               -- Ölçüt ve alt sınır 0051'den değişmedi; yalnız `limit 1`
               -- `limit 3` oldu ve sonuç bir DİZİ.
               'eksik_konular', coalesce((
                 select jsonb_agg(t.konu order by t.eksik desc, t.konu)
                   from (
                     select e->>'konu' as konu,
                            sum((e->>'toplam')::integer) as toplam,
                            sum((e->>'dogru')::integer)  as dogru,
                            sum((e->>'toplam')::integer) - sum((e->>'dogru')::integer)
                              as eksik
                       from public.odevler d
                       join public.gonderimler g
                         on g.odev_id = d.id and g.ogrenci_id = o.id
                       cross join lateral jsonb_array_elements(
                         public._konu_analizi(d.konular, d.cevap_anahtari,
                                              g.cevaplar, d.soru_sayisi)
                       ) e
                      where d.sinif_id = p_sinif_id
                        and d.yayinda
                        and d.son_tarih < bugun_tr
                        and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
                        and d.tur = 'test'
                      group by e->>'konu'
                     having sum((e->>'toplam')::integer) >= 5
                        and sum((e->>'toplam')::integer) - sum((e->>'dogru')::integer) > 0
                      order by sum((e->>'toplam')::integer) - sum((e->>'dogru')::integer) desc,
                               e->>'konu'
                      limit 3
                   ) t
               ), '[]'::jsonb)
             )
             -- SINIF LİSTESİ SIRASI (öğretmenin isteği): okul numarası.
             order by o.ogrenci_no is null, o.ogrenci_no, o.ad)
      from public.ogrenciler o
      -- 0080: iki ortalama tek yardımcıdan, öğrenci başına bir kez.
      cross join lateral (
        select public._ogrenci_ortalamalari(o.id, p_sinif_id, o.sinif_giris) as x
      ) oo
      where o.sinif_id = p_sinif_id and (o.aktif and not o.deneme)
    ), '[]'::jsonb)
  );
end;
$$;

-- sinif_ogrencileri — ortalama çalışma kağıdını saymıyor; ayrı sayaç eklendi
-- kopya: 0064_sinif_listesi_esas.sql
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
  -- 0086: çalışma kağıdı "değerlendirilen ödev" değil.
  select count(*) into v_odev_sayisi
  from public.odevler d
  where d.sinif_id = p_sinif_id and d.yayinda and d.son_tarih < bugun_tr
    and d.tur <> 'calisma'
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
        'yapmadi', i.beklenen - i.yapti,
        'ortalama_yapan', i.ortalama_yapan,
        'ortalama_tum', i.ortalama_tum,
        -- 0086 — ÇALIŞMA KAĞIDI: AYRI SATIR, ortalamanın dışında.
        'calisma_sayisi', i.calisma_sayisi,
        'calisma_yapilan', i.calisma_yapilan
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
          -- 0086: HER SAYIDA ÇALIŞMA KAĞIDI DIŞARIDA. Süzgeç olmasaydı
          -- `ortalama_tum` paydası büyür, ortalama aşağı çekilirdi.
          (count(*) filter (where d.tur <> 'calisma'))::integer as beklenen,
          (count(g.id) filter (where d.tur <> 'calisma'))::integer as yapti,
          round(avg(coalesce(g.ogretmen_puan, g.puan))
                filter (where g.id is not null and d.tur <> 'calisma'), 1) as ortalama_yapan,
          -- 0064: payda ÖĞRENCİNİN kendi ödevleri — sınıfa sonradan
          -- geldiyse gelmeden önce son tarihi dolanlar yok.
          case when count(*) filter (where d.tur <> 'calisma') > 0 then
            round(sum(coalesce(g.ogretmen_puan, g.puan, 0)) filter (where d.tur <> 'calisma')
                  / count(*) filter (where d.tur <> 'calisma'), 1)
          end as ortalama_tum,
          -- 0086: çalışma kağıdının kendi çifti.
          (count(*) filter (where d.tur = 'calisma'))::integer as calisma_sayisi,
          (count(g.id) filter (where d.tur = 'calisma'))::integer as calisma_yapilan
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
          and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
      ) i
      where o.sinif_id = p_sinif_id and o.aktif
    ), '[]'::jsonb)
  );
end;
$$;

-- odevler_listesi — çalışma kağıdı kartında ortalama yok
-- kopya: 0085_odev_tarihleri.sql
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
      -- 0085: VERİLİŞ TARİHİ + UZATMA. Hesap tek yerde; öğretmenin,
      -- öğrencinin ve velinin gördüğü tarih ayrışamıyor.
      'tarihler', public._odev_tarihleri(d.id, d.son_tarih),
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
      -- 0064: SINIF LİSTESİ ESAS — giden öğrencinin gönderimi sayılmıyor.
      'gonderim_sayisi', (
        select count(*) from public.gonderimler g
        join public.ogrenciler o on o.id = g.ogrenci_id
        where g.odev_id = d.id and o.sinif_id = d.sinif_id and (o.aktif and not o.deneme)
          and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
      ),
      'gec_gonderim_sayisi', (
        select count(*) from public.gonderimler g
        join public.ogrenciler o on o.id = g.ogrenci_id
        where g.odev_id = d.id and public._gecikmeli(g.created_at, d.son_tarih)
          and o.sinif_id = d.sinif_id and (o.aktif and not o.deneme)
          and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
      ),
      'sinif_mevcudu', (
        select count(*) from public.ogrenciler o
        where o.sinif_id = d.sinif_id and (o.aktif and not o.deneme)
          and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
      ),
      -- Ortalamalar YALNIZ süre dolduktan sonra.
      -- 0086: ÇALIŞMA KAĞIDINDA HİÇ YOK — puanı olmayan bir ödevde
      -- "ortalama 0" yazmak, öğretmene olmayan bir başarısızlık
      -- göstermek olurdu.
      'ortalama_yapan', case when d.tur <> 'calisma' and d.son_tarih < bugun_tr then (
        select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1)
        from public.gonderimler g
        join public.ogrenciler o on o.id = g.ogrenci_id
        where g.odev_id = d.id and coalesce(g.ogretmen_puan, g.puan) is not null
          and o.sinif_id = d.sinif_id and (o.aktif and not o.deneme)
          and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
      ) end,
      'ortalama_tum', case when d.tur <> 'calisma' and d.son_tarih < bugun_tr then (
        select round(avg(coalesce(
                 (select coalesce(g.ogretmen_puan, g.puan)
                    from public.gonderimler g
                   where g.odev_id = d.id and g.ogrenci_id = o.id), 0)), 1)
        from public.ogrenciler o
        where o.sinif_id = d.sinif_id and (o.aktif and not o.deneme)
          and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
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

-- sinif_not_cizelgesi — ortalamalar çalışma kağıdını saymıyor; ayrı sayaç eklendi
-- kopya: 0073_deneme_hesabi.sql
create or replace function public.sinif_not_cizelgesi(
  p_token text,
  p_sinif_id uuid,
  p_onizleme boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun_tr  date := (now() at time zone 'Europe/Istanbul')::date;
  v_okuyan  uuid;
  v_sinif   record;
  v_yil_bas date;
  v_hepsi   boolean;
  v_dolan   integer;
begin
  v_okuyan := public._sinif_okuyucusu(p_token, p_sinif_id);

  -- 0063 — ÖDEV KAPSAMI. Müdür (ve sahibin müdür önizlemesi) sınıfın
  -- BÜTÜN ödevlerini görür; öğretmen bugünkü kuralla yalnız erişebildiği
  -- ödevleri (`_odeve_erisir`, 0055 — `sinif_ogrencileri` ile aynı).
  v_hepsi := (select o.rol from public._oturum(p_token) o) = 'mudur'
          or (p_onizleme and exists (select 1 from public.ogretmenler g
                                      where g.id = v_okuyan and g.yonetici));

  -- 0063: arşivdeki sınıf da açılıyor (öğretmenin sınıf sayfası bugün açıyor).
  select s.id, s.ad, s.ozel, s.arsiv into v_sinif
    from public.siniflar s where s.id = p_sinif_id;
  if not found then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;

  -- 0086: çalışma kağıdı "süresi dolmuş değerlendirilen ödev" değil.
  select count(*)::integer into v_dolan
    from public.odevler d
   where d.sinif_id = p_sinif_id and d.yayinda and d.son_tarih < bugun_tr
     and d.tur <> 'calisma'
     and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id));

  v_yil_bas := make_date(
    case when extract(month from bugun_tr) >= 9 then extract(year from bugun_tr)::integer
         else extract(year from bugun_tr)::integer - 1 end, 9, 1);

  return jsonb_build_object(
    'sinif', jsonb_build_object(
      'id', v_sinif.id,
      'ad', v_sinif.ad,
      'ozel', v_sinif.ozel,
      'arsiv', v_sinif.arsiv,
      'ogretmenler', coalesce((
          select jsonb_agg(g.ad order by g.yonetici desc, g.ad)
            from public.ogretmen_siniflari os
            join public.ogretmenler g on g.id = os.ogretmen_id
           where os.sinif_id = p_sinif_id and g.aktif and not g.mudur
        ), '[]'::jsonb)),
    'kapsam', case when v_hepsi then 'tum' else 'ogretmen' end,
    'degerlendirilen_odev', v_dolan,
    'mevcut', (select count(*)::integer from public.ogrenciler o
                where o.sinif_id = p_sinif_id and (o.aktif and not o.deneme)),
    'odevler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', d.id,
               'baslik', d.baslik,
               'tur', d.tur,
               'ogretmen', (select g.ad from public.ogretmenler g where g.id = d.ogretmen_id),
               'soru_sayisi', d.soru_sayisi,
               -- 0063: müdür ödevi ve cevap anahtarını görebiliyor.
               'odev_yolu', d.odev_url,
               'anahtar_yolu', d.anahtar_url,
               'cevap_anahtari', d.cevap_anahtari,
               'son_tarih', d.son_tarih,
               'sure_doldu', d.son_tarih < bugun_tr,
               -- 0064: SINIF LİSTESİ ESAS. Yalnız bugün sınıfta olan ve ödevin
               -- son tarihinde sınıfa gelmiş öğrenciler sayılıyor.
               'beklenen', (select count(*)::integer from public.ogrenciler o
                             where (o.aktif and not o.deneme) and o.sinif_id = p_sinif_id
                               and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)),
               'gonderim', (select count(*)::integer from public.gonderimler g
                             join public.ogrenciler o on o.id = g.ogrenci_id
                            where g.odev_id = d.id and (o.aktif and not o.deneme) and o.sinif_id = p_sinif_id
                              and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)),
               'ortalama', (select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1)
                              from public.gonderimler g
                              join public.ogrenciler o on o.id = g.ogrenci_id
                             where g.odev_id = d.id and (o.aktif and not o.deneme) and o.sinif_id = p_sinif_id
                               and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
                               and coalesce(g.ogretmen_puan, g.puan) is not null)
             ) order by d.son_tarih, d.created_at, d.id)
        from public.odevler d
       where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id)) and d.yayinda
                    -- 0086: çalışma kağıdı puan ızgarasında sütun açmıyor.
                    and d.tur <> 'calisma'
    ), '[]'::jsonb),
    'ogrenciler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id,
               'ad', o.ad,
               'ogrenci_no', o.ogrenci_no,
               'tur', o.tur,
               -- 0063 — ÖĞRETMENİN SINIF SAYFASININ SAYILARI,
               -- `sinif_ogrencileri` (0055) ile BİREBİR aynı formül.
               'yapti', i.yapti,
               'yapmadi', i.beklenen - i.yapti,
               'ortalama_yapan', i.ortalama_yapan,
               'ortalama_tum', i.ortalama_tum,
               -- 0086 — ÇALIŞMA KAĞIDI: AYRI SATIR, ortalamanın dışında.
               'calisma_sayisi', i.calisma_sayisi,
               'calisma_yapilan', i.calisma_yapilan,
               -- ORTALAMA — `sinif_ogrenci_ozeti` (0051) ile birebir.
               'ortalama', (
                 select round(avg(coalesce(
                          (select coalesce(g.ogretmen_puan, g.puan)
                             from public.gonderimler g
                            where g.odev_id = d.id and g.ogrenci_id = o.id),
                          0)), 2)
                   from public.odevler d
                  where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id))
                    and d.yayinda
                    and d.son_tarih < bugun_tr
                    and d.tur <> 'calisma'
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
               ),
               'yapilan', (
                 select count(*)::integer from public.odevler d
                  where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id)) and d.yayinda
                    and d.son_tarih < bugun_tr
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
                    and d.tur <> 'calisma'
                    and exists (select 1 from public.gonderimler g
                                 where g.odev_id = d.id and g.ogrenci_id = o.id)
               ),
               'yapilmayan', (
                 select count(*)::integer from public.odevler d
                  where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id)) and d.yayinda
                    and d.son_tarih < bugun_tr
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
                    and d.tur <> 'calisma'
                    and not exists (select 1 from public.gonderimler g
                                     where g.odev_id = d.id and g.ogrenci_id = o.id)
               ),
               'puanlar', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'odev_id', d.id,
                          'puan', g.p,
                          'durum', case
                                     when g.var then 'gonderdi'
                                     -- 0064: sınıfa gelmeden önce son tarihi dolan ödev.
                                     when not public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
                                       then 'kapsam_disi'
                                     when d.son_tarih < bugun_tr then 'gondermedi'
                                     else 'suresi_devam'
                                   end
                        ) order by d.son_tarih, d.created_at, d.id)
                   from public.odevler d
                   left join lateral (
                     select true as var, coalesce(gg.ogretmen_puan, gg.puan) as p
                       from public.gonderimler gg
                      where gg.odev_id = d.id and gg.ogrenci_id = o.id
                   ) g on true
                  where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id)) and d.yayinda
                    -- 0086: sütun yoksa hücre de yok.
                    and d.tur <> 'calisma'
               ), '[]'::jsonb)
             )
             -- SIRA: öğretmenin sınıf sayfasıyla aynı (0044, sayısal numara).
             order by public._numara_sira(o.ogrenci_no) nulls last, o.ad)
        from public.ogrenciler o
        cross join lateral (
          select
            -- 0086: her sayıda çalışma kağıdı DIŞARIDA.
            (count(*) filter (where d.tur <> 'calisma'))::integer as beklenen,
            (count(g.id) filter (where d.tur <> 'calisma'))::integer as yapti,
            round(avg(coalesce(g.ogretmen_puan, g.puan))
                  filter (where g.id is not null and d.tur <> 'calisma'), 1) as ortalama_yapan,
            case when count(*) filter (where d.tur <> 'calisma') > 0 then
              round(sum(coalesce(g.ogretmen_puan, g.puan, 0)) filter (where d.tur <> 'calisma')
                    / count(*) filter (where d.tur <> 'calisma'), 1)
            end as ortalama_tum,
            (count(*) filter (where d.tur = 'calisma'))::integer as calisma_sayisi,
            (count(g.id) filter (where d.tur = 'calisma'))::integer as calisma_yapilan
          from public.odevler d
          left join public.gonderimler g
            on g.odev_id = d.id and g.ogrenci_id = o.id
          where d.sinif_id = p_sinif_id
            and d.yayinda
            and d.son_tarih < bugun_tr
            and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id))
            and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
        ) i
       where o.sinif_id = p_sinif_id and (o.aktif and not o.deneme)
    ), '[]'::jsonb),
    -- SINIFIN AYLIK GELİŞİMİ — süresi dolmuş ödevler, aktif öğrenciler.
    'aylar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ay', a.ay,
               'odev_sayisi', (select count(*)::integer from public.odevler d
                                where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id)) and d.yayinda
                                  and date_trunc('month', d.son_tarih)::date = a.ay),
               'ortalama', (
                 select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1)
                   from public.odevler d
                   join public.gonderimler g on g.odev_id = d.id
                   join public.ogrenciler o on o.id = g.ogrenci_id
                  where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id)) and d.yayinda and d.son_tarih < bugun_tr
                    and date_trunc('month', d.son_tarih)::date = a.ay
                    and (o.aktif and not o.deneme) and o.sinif_id = p_sinif_id
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
                    and coalesce(g.ogretmen_puan, g.puan) is not null),
               'gonderim_orani', (
                 -- 0064: payda öğrenci × ödev ÇİFTLERİ; sınıfa sonradan gelenin
                 -- gelmeden önceki ödevi paydada yok.
                 select round(100.0 * count(g.id) / nullif(
                          (select count(*) from public.odevler d2
                             join public.ogrenciler o2
                               on o2.sinif_id = p_sinif_id and (o2.aktif and not o2.deneme)
                              and public._odev_ogrenciye_dusar(o2.sinif_giris, d2.son_tarih, d2.created_at)
                            where d2.sinif_id = p_sinif_id
                              and (v_hepsi or public._odeve_erisir(v_okuyan, d2.ogretmen_id, d2.sinif_id)) and d2.yayinda
                              and d2.son_tarih < bugun_tr
                              and date_trunc('month', d2.son_tarih)::date = a.ay), 0))
                   from public.odevler d
                   join public.gonderimler g on g.odev_id = d.id
                   join public.ogrenciler o on o.id = g.ogrenci_id
                  where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id)) and d.yayinda and d.son_tarih < bugun_tr
                    and date_trunc('month', d.son_tarih)::date = a.ay
                    and (o.aktif and not o.deneme) and o.sinif_id = p_sinif_id
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at))
             ) order by a.ay)
        from (select generate_series(v_yil_bas, date_trunc('month', bugun_tr)::date,
                                     interval '1 month')::date as ay) a
    ), '[]'::jsonb)
  );
end;
$$;

-- veli_paneli — veli ödevin TÜRÜNÜ de görüyor
-- kopya: 0085_odev_tarihleri.sql
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

  select ogr2.id, ogr2.ad, ogr2.tur, s.ad as sinif, ogr2.sinif_id, ogr2.sinif_giris into ogr
  from public.ogrenciler ogr2
  left join public.siniflar s on s.id = ogr2.sinif_id
  where ogr2.id = o.ogrenci_id;

  return jsonb_build_object(
    'ogrenci', jsonb_build_object('ad', ogr.ad, 'sinif', ogr.sinif, 'tur', ogr.tur),

    -- GENEL ORTALAMA (0029) — YALNIZ ÇOCUĞUN KENDİSİ.
    --
    -- 0047'YE KADAR BURADA ŞU YAZIYORDU: "Sınıf ortalaması, sıralama,
    -- başka öğrencinin verisi BURAYA DA eklenmiyor." O CÜMLE ARTIK
    -- DOĞRU DEĞİL ve silinmek yerine düzeltiliyor: öğretmen ve okul
    -- müdürü 0047'de ödev BAZINDA sınıf/seviye ortalamasının görünmesine
    -- karar verdi (aşağıdaki 'kiyas' alanı).
    --
    -- DEĞİŞMEYEN KISIM: bu alan, yani ÇOCUĞUN GENEL ortalaması, hâlâ
    -- yalnız çocuğun kendisi. Sıralama hiçbir yerde yok, başka bir
    -- öğrencinin verisi hiçbir yerde yok. Kıyas ödev bazında ve
    -- İSİMSİZ bir toplamdan ibaret.
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
        -- 0086: TÜR VELİYE DE GİDİYOR (öğretmenin kararı: veli görsün).
        -- Olmasaydı veli puansız bir satır görür ve "daha
        -- değerlendirilmedi" sanırdı; oysa çalışma kağıdı puanlanmıyor.
        'tur', d.tur,
        'son_tarih', d.son_tarih,
        -- 0085: VERİLİŞ TARİHİ + UZATMA. Hesap tek yerde; öğretmenin,
        -- öğrencinin ve velinin gördüğü tarih ayrışamıyor.
        'tarihler', public._odev_tarihleri(d.id, d.son_tarih),
        'olusturma', d.created_at,
        'gonderildi', (g.id is not null),
        'gonderim_zamani', g.created_at,
        'puan', coalesce(g.ogretmen_puan, g.puan),
        'durum', g.durum,
        'konu_analizi', case when g.id is not null
          then public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
          else '[]'::jsonb end,
        -- ÖDEV KIYASI (0047) — satırın İÇİNE gömülü, çünkü veliye ödev
        -- kimliği gitmiyor ve kimlikle ayrı bir çağrı yapamıyor.
        -- `konu_analizi` ile aynı desen, hesabı `_odev_kiyasi` yapıyor:
        -- öğrencinin gördüğü sayıyla veliye giden sayı AYNI koddan.
        'kiyas', public._odev_kiyasi(d.id),
        -- VELİYE YALNIZ NUMARA. Şık gitmiyor (Kural 6).
        'yanlis_sorular', case when g.id is not null and d.tur = 'test'
          then public._soru_dokumu(d.cevap_anahtari, g.cevaplar, d.soru_sayisi) -> 'yanlis'
          else '[]'::jsonb end,
        'bos_sorular', case when g.id is not null and d.tur = 'test'
          then public._soru_dokumu(d.cevap_anahtari, g.cevaplar, d.soru_sayisi) -> 'bos'
          else '[]'::jsonb end,
        -- 0071 — VELİ SORULARI VE ÇOCUĞUN ÇÖZÜMÜNÜ AÇABİLSİN. Yalnız YOL
        -- gidiyor; imzalı adresi `dosya-url` her dokunuşta yeniden üretiyor
        -- ve izni `dosya_erisim_izni` orada yeniden denetliyor. Cevap
        -- anahtarının yolu buraya EKLENMİYOR (Kural 6).
        'odev_yolu', d.odev_url,
        'cozum_yollari', case when g.id is not null and g.foto_yolu is not null
          then to_jsonb(array[g.foto_yolu] || coalesce(g.ek_sayfa_yollari, '{}'::text[]))
          else '[]'::jsonb end
      ) order by d.son_tarih desc)
      from public.odevler d
      left join public.gonderimler g
        on g.odev_id = d.id and g.ogrenci_id = ogr.id
      where d.yayinda and d.sinif_id = ogr.sinif_id
        and public._odev_ogrenciye_dusar(ogr.sinif_giris, d.son_tarih, d.created_at)
    ), '[]'::jsonb),
    -- YALNIZ VELİ YAZIŞMASI. Öğrencinin öğretmenle yazdıkları buradan
    -- ÇIKMIYOR: çocuk da öğretmenine velisinin okumayacağını varsayarak
    -- yazıyor. Ayrım tabloda, arayüzde değil.
    'mesajlar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kimden', m.kimden, 'metin', m.metin, 'zaman', m.created_at,
               -- 0058: mesaj hangi öğretmenle olan yazışmaya ait.
               'ogretmen_id', m.ogretmen_id,
               'ogretmen', (select g.ad from public.ogretmenler g where g.id = m.ogretmen_id))
             order by m.created_at)
      from public.mesajlar m
      where m.ogrenci_id = ogr.id and m.kanal = 'veli'
    ), '[]'::jsonb),
    -- 0058: velinin mesaj yazabileceği öğretmenler (sınıf öğretmeni önce).
    'ogretmenler', public._ogrencinin_ogretmenleri(ogr.id),
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

-- _odev_kiyasi — çalışma kağıdında kıyas yok
-- kopya: 0073_deneme_hesabi.sql
create or replace function public._odev_kiyasi(p_odev_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  d record;
  v_seviye smallint;
  v_ozel boolean;
  v_sinif_ort numeric;
  v_sinif_adet integer;
  v_seviye_ort numeric;
  v_seviye_adet integer;
  v_sube_adet integer;
begin
  select * into d from public.odevler where id = p_odev_id and yayinda;
  if not found then
    return jsonb_build_object('durum', 'kiyas_yok');
  end if;

  select s.seviye, s.ozel into v_seviye, v_ozel
    from public.siniflar s where s.id = d.sinif_id;

  -- Özel ders grubunda sınıf ortalamasının anlamı yok (bkz. başlık).
  if v_ozel then
    return jsonb_build_object('durum', 'kiyas_yok');
  end if;

  -- 0086: ÇALIŞMA KAĞIDINDA KIYAS YOK. Puan olmadığı için aşağıdaki
  -- ortalamalar zaten boş dönerdi; erken dönüş, veliye ve öğrenciye
  -- "0 öğrenci üzerinden" gibi anlamsız bir kart çizilmesini önlüyor.
  if d.tur = 'calisma' then
    return jsonb_build_object('durum', 'kiyas_yok');
  end if;

  if d.son_tarih >= (now() at time zone 'Europe/Istanbul')::date then
    return jsonb_build_object('durum', 'sure_dolmadi');
  end if;

  -- KENDİ SINIFI
  select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1), count(*)
    into v_sinif_ort, v_sinif_adet
    from public.gonderimler g
    -- 0064: SINIF LİSTESİ ESAS — giden öğrencinin puanı sınıf ortalamasında yok.
    join public.ogrenciler k on k.id = g.ogrenci_id
                            and (k.aktif and not k.deneme) and k.sinif_id = d.sinif_id
                            and public._odev_ogrenciye_dusar(k.sinif_giris, d.son_tarih, d.created_at)
   where g.odev_id = d.id
     and coalesce(g.ogretmen_puan, g.puan) is not null;

  -- SEVİYE — öğretmenin üç koşulu. Kendi ödevi de dâhil; "tüm 9'lar"
  -- ortalaması kendi sınıfını dışarıda bırakırsa o sayı gerçeği
  -- göstermez.
  select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1),
         count(*), count(distinct d2.sinif_id)
    into v_seviye_ort, v_seviye_adet, v_sube_adet
    from public.odevler d2
    join public.siniflar s2 on s2.id = d2.sinif_id
    join public.gonderimler g on g.odev_id = d2.id
    join public.ogrenciler k on k.id = g.ogrenci_id
                            and (k.aktif and not k.deneme) and k.sinif_id = d2.sinif_id
                            and public._odev_ogrenciye_dusar(k.sinif_giris, d2.son_tarih, d2.created_at)
   where d2.yayinda
     and btrim(d2.baslik) = btrim(d.baslik)
     and d2.created_at::date = d.created_at::date
     and s2.seviye = v_seviye
     and not s2.ozel
     and coalesce(g.ogretmen_puan, g.puan) is not null;

  -- TESLİM SAYISI GÖNDERİLMİYOR — öğretmenin kararı: "Teslim sayısı
  -- veliye ya da öğrenciye gösterilmesin."
  --
  -- EKRANDAN GİZLEMEK YETMEZ, YANITTAN DA ÇIKIYOR. Bu deponun kuralı
  -- (Part XXI): göstermediğin şeyi göndermezsin. Sayı yanıtta dursa
  -- tarayıcının geliştirici araçlarını açan herkes onu okurdu; "ekranda
  -- yok" demek "kimse göremez" demek değil. Ödeme bilgisinde ve cevap
  -- anahtarında verilen kararın aynısı.
  --
  -- HESAP YİNE YAPILIYOR (`v_sinif_adet`, `v_seviye_adet`): bir gün alt
  -- sınır kararı değişirse dönülecek yer belli olsun. Sadece dışarı
  -- çıkmıyor.
  return jsonb_build_object(
    'durum', 'hazir',
    'sinif', jsonb_build_object(
      'ad',      (select s.ad from public.siniflar s where s.id = d.sinif_id),
      'ortalama', v_sinif_ort
    ),
    -- Kardeş şube yoksa (yalnız kendi sınıfına verilmiş) bu alan null
    -- ve ekran o satırı hiç çizmiyor. Öğretmenin kuralı: "diğer şubelere
    -- verilmemişse sadece ödevin verildiği sınıf ortalaması alınsın."
    --
    -- `v_sube_adet` de gönderilmiyor: ekranda görünmüyor, yalnız bu
    -- koşulu kuruyor.
    'seviye', case when v_sube_adet > 1 then jsonb_build_object(
      'ad',       v_seviye::text || '. sınıflar',
      'ortalama', v_seviye_ort
    ) else null end
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. YETKİLER — imzalar değişmedi, yine de açıkça yazılıyor
-- -----------------------------------------------------------------------------
grant execute on function public.odev_olustur(text, text, text, uuid, text, date,
  integer, jsonb, text, text, boolean, smallint, jsonb, smallint) to anon, authenticated;
grant execute on function public.odev_gonder(text, uuid, text, jsonb, text[])
  to anon, authenticated;
grant execute on function public.acik_puanla(text, uuid, numeric, text) to anon, authenticated;
grant execute on function public.puan_duzelt(text, uuid, numeric, text) to anon, authenticated;
grant execute on function public.kendi_karnem(text) to anon, authenticated;
grant execute on function public.sinif_ogrencileri(text, uuid) to anon, authenticated;
grant execute on function public.odevler_listesi(text, uuid, boolean) to anon, authenticated;

-- Hesap yardımcıları istemciye KAPALI kalmalı.
revoke all on function public._ogrenci_ortalamalari(uuid, uuid, date)
  from public, anon, authenticated;
revoke all on function public._odev_kiyasi(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. ÖZ-DENETİM
-- -----------------------------------------------------------------------------
do $$
declare
  eksik text[] := '{}';
  t text;
begin
  -- KISITLAR GENİŞLEDİ Mİ.
  if pg_get_constraintdef(
       (select oid from pg_constraint
         where conrelid = 'public.odevler'::regclass and conname = 'odevler_tur_check'))
     not like '%calisma%' then
    eksik := eksik || 'odevler.tur üçüncü türü kabul etmiyor'::text;
  end if;
  if pg_get_constraintdef(
       (select oid from pg_constraint
         where conrelid = 'public.gonderimler'::regclass and conname = 'gonderimler_durum_check'))
     not like '%tamamlandi%' then
    eksik := eksik || 'gonderimler.durum tamamlandi''yı kabul etmiyor'::text;
  end if;
  -- Anahtar yasağı VERİTABANINDA mı.
  if pg_get_constraintdef(
       (select oid from pg_constraint
         where conrelid = 'public.odevler'::regclass and conname = 'odev_test_tutarli'))
     not like '%calisma%' then
    eksik := eksik || 'odev_test_tutarli çalışma kağıdını tanımıyor'::text;
  end if;

  -- PUANLAMA KAPILARI — ikisi de tür denetlemeli.
  if pg_get_functiondef('public.acik_puanla'::regproc) not like '%Çalışma kağıdı puanlanmaz%' then
    eksik := eksik || 'acik_puanla çalışma kağıdını reddetmiyor'::text;
  end if;
  if pg_get_functiondef('public.puan_duzelt'::regproc) not like '%Çalışma kağıdı puanlanmaz%' then
    eksik := eksik || 'puan_duzelt çalışma kağıdını reddetmiyor'::text;
  end if;

  -- GÖNDERİM ÜÇÜNCÜ DALI.
  if pg_get_functiondef('public.odev_gonder'::regproc) not like '%''tamamlandi''%' then
    eksik := eksik || 'odev_gonder çalışma kağıdı dalını taşımıyor'::text;
  end if;
  -- 0082 ve 0078 KORUNDU MU (kopyalama geriye almasın).
  --
  -- 0082'nin izi `odev_gonder`'de DENEME NUMARASI olarak duruyor
  -- (`v_deneme`); `_cozum_deneme`'yi bu uç değil, `_cozum_yolu_gecerli`
  -- çağırıyor — ilk yazdığım iddia onu arıyordu ve yanlış yere baktığı
  -- için temiz kodda bile kırmızı yandı.
  if pg_get_functiondef('public.odev_gonder'::regproc) not like '%v_deneme%'
     or pg_get_functiondef('public.odev_gonder'::regproc)
          not like '%_cozum_yolu_gecerli%'
     or pg_get_functiondef('public.odev_gonder'::regproc)
          not like '%d.tum_sayfalar and 1 + v_ek_sayi < d.sayfa_limiti%' then
    eksik := eksik || 'odev_gonder''in eski kuralları kayboldu'::text;
  end if;

  -- SAYIMLAR — çalışma kağıdı dışarıda VE kendi sayacı var.
  t := pg_get_functiondef('public._ogrenci_ortalamalari'::regproc);
  if t not like '%filter (where not calisma)%' then
    eksik := eksik || 'ortalamalar çalışma kağıdını hâlâ sayıyor'::text;
  end if;
  if t not like '%calisma_yapilan%' then
    eksik := eksik || 'çalışma kağıdının ayrı sayacı yok'::text;
  end if;

  for t in
    select unnest(array['kendi_karnem', 'sinif_ogrenci_ozeti', 'sinif_ogrencileri'])
  loop
    if pg_get_functiondef(('public.' || t)::regproc) not like '%calisma%' then
      eksik := eksik || (t || ' çalışma kağıdını ayırmıyor')::text;
    end if;
  end loop;

  if pg_get_functiondef('public.odevler_listesi'::regproc)
       not like '%d.tur <> ''calisma'' and d.son_tarih < bugun_tr%' then
    eksik := eksik || 'odevler_listesi çalışma kağıdına ortalama yazıyor'::text;
  end if;
  -- 0085 KORUNDU MU.
  if pg_get_functiondef('public.odevler_listesi'::regproc) not like '%_odev_tarihleri%' then
    eksik := eksik || 'odevler_listesi 0085''i geriye aldı'::text;
  end if;
  if pg_get_functiondef('public._odev_kiyasi'::regproc)
       not like '%d.tur = ''calisma''%' then
    eksik := eksik || '_odev_kiyasi çalışma kağıdında kıyas çiziyor'::text;
  end if;

  -- OLUŞTURMA: puanlama alanları zorla null.
  if pg_get_functiondef('public.odev_olustur'::regproc)
       not like '%p_cevap_anahtari := null%' then
    eksik := eksik || 'odev_olustur çalışma kağıdında anahtarı temizlemiyor'::text;
  end if;

  if array_length(eksik, 1) > 0 then
    raise exception '0086 eksik: %', array_to_string(eksik, ' | ');
  end if;
end $$;

select public._migration_kaydet('0086');
