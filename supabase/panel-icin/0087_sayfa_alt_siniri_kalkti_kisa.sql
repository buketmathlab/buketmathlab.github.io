-- SEKİZ — 0087: Çözüm sayfasında alt sınır kalkıyor
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Açıklamalı tam sürüm: supabase/migrations/0087_sayfa_alt_siniri_kalkti.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Ayarlar → Verinizin yedeği)
-- 0086 ÇALIŞMIŞ OLMALI. Edge Function DEĞİŞMİYOR.
--
-- NE YAPIYOR: 5 sayfalık ödev verdiğinizde öğrenciler artık 5 sayfa
-- göndermek ZORUNDA DEĞİL. Çözümünü 3 sayfaya sığdıran öğrenci 3 sayfa
-- gönderebiliyor.
--
-- ÜST SINIR DURUYOR: en fazla yazdığınız sayfa sayısı kadar gönderilebilir.
-- En az bir çözüm sayfası yine şart (fotoğrafsız gönderim yok).
--
-- Öğrenci sınırın altında gönderirken ekran bir kez soruyor: "5 sayfalık
-- ödeve 2 sayfa ekledin. Yine de gönderilsin mi?" — engel değil, kazara
-- eksik göndermeyi önleyen bir soru (sizin kararınız).
--
-- MEVCUT ÖDEVLER DE KAPSAMDA: bu dosya bütün ödevlerde eski kuralı
-- kapatıyor ve kaç ödevde kapattığını çalışırken yazıyor.
--
-- Beklenen sonuç: en altta tek satırlık bir tablo (_migration_kaydet → 0087).
-- =============================================================================

do $$
begin
  if to_regprocedure('public._odev_tarihleri(uuid,date)') is null then
    raise exception '0087: önce 0085 çalıştırılmalı';
  end if;
  if pg_get_functiondef('public.odev_gonder'::regproc) not like '%''tamamlandi''%' then
    raise exception '0087: önce 0086 çalıştırılmalı';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. VERİ — bayrak her ödevde kapanıyor
-- -----------------------------------------------------------------------------
do $$
declare v_kac integer;
begin
  update public.odevler set tum_sayfalar = false where tum_sayfalar;
  get diagnostics v_kac = row_count;
  -- Kaç ödevin kuralı gevşedi: öğretmen sayıyı görsün, sessiz bir
  -- davranış değişikliği olmasın.
  raise notice '0087: % ödevde alt sınır kaldırıldı.', v_kac;
end $$;

comment on column public.odevler.tum_sayfalar is
  'TARİHSEL — 0078''in "her sayfa zorunlu" bayrağı. 0087''den beri '
  'UYGULANMIYOR ve hiçbir uç true yazmıyor: çözüm sayfası için yalnız ÜST '
  'sınır (sayfa_limiti) var, alt sınır yok. Sütun, denetim izindeki eski '
  'satırların anlamı korunsun diye duruyor.';

-- -----------------------------------------------------------------------------
-- 2. UÇLAR — her biri EN SON tanımından kopyalandı, yalnız işaretli
--    satırlar değişti
-- -----------------------------------------------------------------------------
-- odev_gonder — alt sınır dalı kaldırıldı, üst sınır yerinde
-- kopya: 0086_calisma_kagidi.sql
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

  -- 0087: ALT SINIR YOK.
  --
  -- 0078 burada "tam sayfa_limiti kadar sayfa" istiyordu. Öğretmenin
  -- kararı: "çözüm sayfası en fazla soru kağıdının sayfası kadar olsun,
  -- fakat alt sınır olmasın." Kağıda çözen öğrenci 5 soruyu 3 sayfaya
  -- sığdırabiliyor; eski kural onu olmayan bir sayfayı uydurmaya
  -- zorluyordu.
  --
  -- EN AZ BİR SAYFA yine şart, ama bu ayrı bir kural değil: yukarıda
  -- `p_foto_yolu` boşsa gönderim zaten reddediliyor (çözüm fotoğrafı
  -- olmadan ödev gönderilemez).

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

-- odev_olustur — yeni ödev alt sınırsız doğuyor
-- kopya: 0086_calisma_kagidi.sql
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
     -- 0087: ALT SINIR YOK. 0078 burada `true` yazıyor ve öğrenciyi tam
     -- sayfa_limiti kadar sayfa göndermeye zorluyordu. Sayı artık yalnız
     -- ÜST sınır; bayrak tarihsel (bkz. sütun yorumu).
     false)
  returning id into yeni_id;

  perform public._denetim('odev_olusturuldu', 'odevler', yeni_id, public._aktor(v_ogretmen));
  return jsonb_build_object('id', yeni_id, 'yayinda', false);
end;
$$;

-- odev_guncelle — sayfa sayısı düzenlemesi bayrağı DİRİLTMİYOR
-- kopya: 0079_sayfa_sayisi_duzenleme.sql
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
  if p_sayfa_limiti is not null and p_sayfa_limiti not between 1 and 40 then
    raise exception 'Sayfa sayısı 1 ile 40 arasında olmalı.' using errcode = '22023';
  end if;
  -- 0079: gönderim yapılmış ödevde de sayfa sayısı DEĞİŞEBİLİR (öğretmenin
  -- kararı). Gönderilmiş çözümler ve puanlar değişmez; yeni sayı henüz
  -- göndermeyenler için geçerli. 0078'deki kilit kalktı.

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
         sayfa_limiti = coalesce(p_sayfa_limiti, d.sayfa_limiti),
         -- 0087: BAYRAK ARTIK DİRİLMİYOR.
         --
         -- 0079'daki satır, sayfa sayısı HER düzenlendiğinde bayrağı
         -- `true` yapıyordu; alt sınır kalktıktan sonra bu, kuralı tek bir
         -- düzenlemeyle geri getirirdi. Sayı artık yalnız üst sınır.
         tum_sayfalar = false
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
-- 3. YETKİLER — imzalar değişmedi, yine de açıkça yazılıyor
-- -----------------------------------------------------------------------------
grant execute on function public.odev_gonder(text, uuid, text, jsonb, text[])
  to anon, authenticated;
grant execute on function public.odev_olustur(text, text, text, uuid, text, date,
  integer, jsonb, text, text, boolean, smallint, jsonb, smallint) to anon, authenticated;
grant execute on function public.odev_guncelle(text, uuid, text, text, uuid, date,
  integer, jsonb, text, text, boolean, smallint, jsonb, smallint) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. ÖZ-DENETİM
-- -----------------------------------------------------------------------------
do $$
declare
  eksik text[] := '{}';
  t text;
begin
  -- ALT SINIR GİTTİ Mİ.
  t := pg_get_functiondef('public.odev_gonder'::regproc);
  if t like '%her sayfanın çözümünü eklemelisin%' then
    eksik := eksik || 'odev_gonder hâlâ alt sınır uyguluyor'::text;
  end if;
  -- ÜST SINIR DURUYOR MU — kaldırılan kuralın yanındaki kural.
  if t not like '%Bu ödevde en fazla % sayfa gönderilebilir%' then
    eksik := eksik || 'odev_gonder üst sınırı kaybetti'::text;
  end if;
  -- 0082 ve 0086 KORUNDU MU (kopyalama geriye almasın).
  if t not like '%v_deneme%' or t not like '%_cozum_yolu_gecerli%'
     or t not like '%''tamamlandi''%' then
    eksik := eksik || 'odev_gonder''in eski kuralları kayboldu'::text;
  end if;
  -- SIRA KURALI yerinde mi.
  if t not like '%SIRA BOŞLUKSUZ%' then
    eksik := eksik || 'odev_gonder sayfa sırası kuralını kaybetti'::text;
  end if;

  -- BAYRAĞI YAZAN İKİ UÇ.
  if pg_get_functiondef('public.odev_olustur'::regproc)
       not like '%0087: ALT SINIR YOK%' then
    eksik := eksik || 'odev_olustur hâlâ bayrağı true yazıyor'::text;
  end if;
  if pg_get_functiondef('public.odev_guncelle'::regproc)
       like '%tum_sayfalar = (d.tum_sayfalar or p_sayfa_limiti is not null)%' then
    eksik := eksik || 'odev_guncelle bayrağı hâlâ diriltiyor'::text;
  end if;
  -- 0086 KORUNDU MU: çalışma kağıdında anahtar temizleniyor.
  if pg_get_functiondef('public.odev_olustur'::regproc)
       not like '%p_cevap_anahtari := null%' then
    eksik := eksik || 'odev_olustur 0086''yı geriye aldı'::text;
  end if;

  -- VERİDE BAYRAK KALMADI MI.
  if exists (select 1 from public.odevler where tum_sayfalar) then
    eksik := eksik || 'bazı ödevlerde bayrak hâlâ açık'::text;
  end if;

  if array_length(eksik, 1) > 0 then
    raise exception '0087 eksik: %', array_to_string(eksik, ' | ');
  end if;
end $$;

select public._migration_kaydet('0087');
