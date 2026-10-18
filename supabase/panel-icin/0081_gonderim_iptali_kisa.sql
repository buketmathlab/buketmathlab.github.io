-- SEKİZ — 0081: Gönderimi iptal ederken yeni son tarih ve öğrenciye haber
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Açıklamalı tam sürüm: supabase/migrations/0081_gonderim_iptali.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Ayarlar → Verinizin yedeği)
-- 0080 ÇALIŞMIŞ OLMALI. Edge Function DEĞİŞMİYOR.
--
-- NE YAPIYOR: "Gönderimi yeniden aç" artık YENİ BİR SON TARİH istiyor;
-- öğrenci o tarihe kadar gönderebilir, sonra kapı yine kapanır. Yazdığınız
-- sebep öğrenciye MESAJ olarak gider (yalnız öğrenciye; veli görmez).
-- Gönderim listesinde "ek süre verildi · <tarih>" görünür.
--
-- "Gecikmeli" damgası DEĞİŞMEZ: öğrenci sınıfın son tarihini gerçekten
-- kaçırdı, kayıt dürüst kalıyor; ek süre onun yanında ayrıca yazıyor.
--
-- HİÇBİR VERİ SİLİNMEZ. 0081 öncesinde yeniden açılmış ve henüz
-- göndermemiş öğrenciler eski yoldan göndermeye devam eder; kaç kişi
-- olduğunu çalıştırma sonunda bir not olarak görürsünüz.
--
-- Beklenen sonuç: en altta tek satırlık bir tablo (_migration_kaydet → 0081).
-- =============================================================================


do $$
begin
  if to_regprocedure('public.gonderimi_yeniden_ac(text,uuid,text)') is null
     and to_regprocedure('public.gonderimi_yeniden_ac(text,uuid,text,date)') is null then
    raise exception '0081: önce 0056 çalıştırılmalı';
  end if;
  -- `odev_gonder` GÖVDESİ 0078'DEN KOPYALANDI. 0078 çalışmamışsa bu dosya
  -- onun kuralını (her sayfa zorunlu) geri yazar ve `odevler.tum_sayfalar`
  -- sütunu olmadığı için gönderim ÇALIŞMA ANINDA patlardı. plpgsql gövdesi
  -- kurulurken sütun denetlenmez; bu yüzden kapı burada.
  if pg_get_functiondef('public.odev_gonder'::regproc)
       not like '%d.tum_sayfalar and 1 + v_ek_sayi < d.sayfa_limiti%' then
    raise exception '0081: önce 0078 çalıştırılmalı';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. KİŞİSEL SON TARİH
--
-- NEDEN DENETİM İZİNDEN TÜRETİLMİYOR: 0056 bir BOOLEAN türetiyordu ("süre
-- hiç bakılmasın") ve bu yeterliydi. Bir KAPIYI YÖNETEN TARİH ise her
-- gönderim denemesinde okunuyor ve öğrencinin ekranında yazıyor; jsonb
-- içinden ayıklanan bir tarih hem kırılgan hem sorgulanamaz olurdu.
-- -----------------------------------------------------------------------------
create table if not exists public.odev_ek_sure (
  odev_id    uuid not null references public.odevler(id) on delete cascade,
  ogrenci_id uuid not null references public.ogrenciler(id) on delete cascade,
  son_tarih  date not null,
  veren_id   uuid not null references public.ogretmenler(id),
  verildi    timestamptz not null default now(),
  primary key (odev_id, ogrenci_id)
);

alter table public.odev_ek_sure enable row level security;
alter table public.odev_ek_sure force row level security;
revoke all on public.odev_ek_sure from public, anon, authenticated;
drop policy if exists odev_ek_sure_kapali on public.odev_ek_sure;
create policy odev_ek_sure_kapali on public.odev_ek_sure for all using (false);

do $$
declare n integer;
begin
  -- 0081 ÖNCESİ AÇILMIŞ, HÂLÂ GÖNDERMEMİŞ ÖĞRENCİLER. Onların tarihi
  -- hiçbir yerde yazmıyor; uydurmak veri uydurmak olurdu. Eski dal
  -- (`_gonderim_yeniden_acildi`) onlar için duruyor.
  select count(*) into n
    from public.denetim_izi z
   where z.islem = 'gonderim_yeniden_acildi';
  raise notice '0081: eski yoldan yeniden açılmış % gönderim — kişisel tarihleri yok, eski dal onlar için duruyor', n;
end $$;

-- -----------------------------------------------------------------------------
-- 1b. ESKİ YOLDAN (TARİHSİZ) AÇILMIŞ MI
--
-- BU AYRIM BİR KUSURDAN DOĞDU ve testin 3. grubu buldu. İlk yazımda kapı
-- hem kişisel tarihe hem de 0056'nın `_gonderim_yeniden_acildi`sine
-- bakıyordu. Ama 0081 de her açmada aynı denetim izi satırını yazıyor —
-- yani eski dal HER yeniden açmada doğru oluyor ve verilen tarih
-- anlamsızlaşıyordu: ek süre dolduktan sonra bile gönderim geçiyordu.
--
-- Ayırt edici işaret denetim izinin kendisinde: 0081 açarken `yeni`
-- alanına `son_tarih` yazıyor, 0056 yazmıyordu. Dolayısıyla "eski yol" =
-- `son_tarih` anahtarı OLMAYAN kayıt. Uydurma değil, kaydın kendi izi.
--
-- Eski ad düşürülüyor: adı ("yeniden açıldı mı") artık yaptığı işi
-- söylemiyor ve tek kullanıcısı buydu.
-- -----------------------------------------------------------------------------
create or replace function public._tarihsiz_yeniden_acildi(p_odev uuid, p_ogrenci uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.denetim_izi z
     where z.islem = 'gonderim_yeniden_acildi'
       and z.tablo = 'gonderimler'
       and z.eski ->> 'odev_id' = p_odev::text
       and z.eski ->> 'ogrenci_id' = p_ogrenci::text
       and not (coalesce(z.yeni, '{}'::jsonb) ? 'son_tarih')
  );
$$;
revoke all on function public._tarihsiz_yeniden_acildi(uuid, uuid)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. YENİDEN AÇMA — İMZA DEĞİŞİYOR (0007 TUZAĞI)
--
-- `p_son_tarih` eklenince bu YENİ bir fonksiyon oluyor. Eski üç argümanlı
-- sürüm bırakılsaydı PostgREST `{p_token, p_gonderim, p_neden}` çağrısını
-- ona çözerdi: ekran yeni tarihi gönderdiğini sanırken hiçbir tarih
-- kaydedilmez, öğrenciye de mesaj gitmezdi. AÇIKÇA DÜŞÜRÜLÜYOR ve
-- düşürüldüğü öz-denetimde sayılıyor.
--
-- Gövde: 0056_gonderimi_yeniden_ac.sql — eklenen: tarih, ek süre satırı,
-- öğrenciye mesaj.
-- -----------------------------------------------------------------------------
drop function if exists public.gonderimi_yeniden_ac(text, uuid, text);

create or replace function public.gonderimi_yeniden_ac(
  p_token text,
  p_gonderim uuid,
  p_neden text,
  p_son_tarih date
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
  v_ogrenci  text;
  v_odev     text;
  v_bugun    date := (now() at time zone 'Europe/Istanbul')::date;
begin
  -- `_ogretmen` önce: öğrenci/veli jetonu burada 42501 ile düşer ve vekâlet
  -- ayarı kurulur (`_aktor` denetim izine "sahip → öğretmen" yazsın).
  v_ogretmen := public._ogretmen(p_token);

  -- GERÇEK KİŞİ: vekâletteyse vekil (sahip), değilse oturumun öğretmeni.
  v_gercek := coalesce(nullif(current_setting('sekiz.vekil', true), '')::uuid, v_ogretmen);
  if not exists (select 1 from public.ogretmenler y where y.id = v_gercek and y.yonetici) then
    raise exception 'Gönderimi yalnız platformun sahibi yeniden açabilir.' using errcode = '42501';
  end if;

  if v_neden is null or char_length(v_neden) < 3 then
    raise exception 'Yeniden açmanın sebebini yazın.' using errcode = '22023';
  end if;
  if char_length(v_neden) > 500 then
    raise exception 'Sebep en fazla 500 karakter olabilir.' using errcode = '22023';
  end if;

  -- 0081: YENİ SON TARİH ZORUNLU VE GEÇMİŞ OLAMAZ.
  --
  -- Geçmiş bir tarih kapıyı anında kapatırdı: öğrenci gönderim hakkı
  -- verildiğini sanıp gönderemezdi. "Gönderemesin" ayrı bir karardır ve
  -- bu turda yok (bkz. docs/mimari.md → açık kalanlar).
  if p_son_tarih is null then
    raise exception 'Yeni son tarihi seçin.' using errcode = '22023';
  end if;
  if p_son_tarih < v_bugun then
    raise exception 'Yeni son tarih bugünden önce olamaz.' using errcode = '22023';
  end if;

  -- Satır kilitleniyor: aynı anda iki açma, ya da açma sırasında puanlama,
  -- yarım bir iz bırakmasın.
  select * into eski from public.gonderimler where id = p_gonderim for update;
  if not found then
    raise exception 'Gönderim bulunamadı.' using errcode = 'P0002';
  end if;

  select ad into v_ogrenci from public.ogrenciler where id = eski.ogrenci_id;
  select baslik into v_odev from public.odevler where id = eski.odev_id;

  -- ÖNCE İZ, SONRA SİLME. İz yazılamazsa (hata) silme de olmaz: ikisi aynı
  -- işlemde. 0081: verilen tarih de ize giriyor.
  perform public._denetim(
    'gonderim_yeniden_acildi', 'gonderimler', p_gonderim, public._aktor(v_ogretmen),
    to_jsonb(eski),
    jsonb_build_object('neden', v_neden, 'acan', v_gercek, 'son_tarih', p_son_tarih));

  delete from public.gonderimler where id = p_gonderim;

  -- KİŞİSEL SON TARİH. `on conflict`: aynı ödev ikinci kez açılırsa tarih
  -- güncelleniyor, ikinci bir satır doğmuyor.
  insert into public.odev_ek_sure (odev_id, ogrenci_id, son_tarih, veren_id)
  values (eski.odev_id, eski.ogrenci_id, p_son_tarih, v_gercek)
  on conflict (odev_id, ogrenci_id)
    do update set son_tarih = excluded.son_tarih,
                  veren_id  = excluded.veren_id,
                  verildi   = now();

  -- SEBEP ÖĞRENCİYE MESAJ OLARAK GİDİYOR (öğretmenin kararı).
  --
  -- `kanal = 'ogrenci'`: öğrencinin kendi yazışmasına düşüyor, VELİ
  -- GÖRMÜYOR (0025'in ayrımı). Bugüne kadar gönderim öğrencinin
  -- ekranından sessizce kayboluyordu ve öğrenci ne olduğunu bilmiyordu.
  --
  -- Cümle `app/src/lib/iptal-metni.ts` ile BİREBİR aynı ve sözleşme
  -- testiyle kilitli: iki yazım bir gün ayrışırdı.
  insert into public.mesajlar (ogrenci_id, kimden, metin, kanal, ogretmen_id)
  values (
    eski.ogrenci_id, 'ogretmen',
    coalesce(v_odev, 'Ödev') || ' ödevinin gönderimi iptal edildi. '
      || 'Öğretmeninin notu: ' || v_neden || ' '
      || 'Yeni son tarih: ' || to_char(p_son_tarih, 'DD.MM.YYYY') || '. '
      || 'Çözümünü bu tarihe kadar yeniden gönderebilirsin.',
    'ogrenci', v_gercek);

  return jsonb_build_object('durum', 'tamam', 'ogrenci', v_ogrenci, 'odev', v_odev,
                            'son_tarih', p_son_tarih);
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. KAPI — boolean yerine TARİH (gövde: 0078_tum_sayfalar_zorunlu.sql)
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

  -- Yol kendi kimliğini ve bu ödevi taşımalı.
  --
  -- 0054: 1. SAYFA EKSİZ OLMALI. 0054'ten önce `_cozum_yolu_gecerli`
  -- yalnız eksiz yolu tanıdığı için `like` yetiyordu. Artık `-2` gibi ek
  -- sayfa yolları da geçerli ve `like` onları da kabul ederdi. `foto_yolu`
  -- her zaman 1. sayfa — onu okuyan her yer (öğretmen, veli) buna güveniyor.
  if not public._cozum_yolu_gecerli(o.ogrenci_id, btrim(p_foto_yolu))
     or btrim(p_foto_yolu) !~ ('^cozum/' || p_odev::text || '/' || o.ogrenci_id::text
                              || '\.(jpg|jpeg|png|webp)$') then
    raise exception 'Geçersiz dosya yolu.' using errcode = '42501';
  end if;

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
  for i in 1 .. v_ek_sayi loop
    if v_ek[i] is null
       or btrim(v_ek[i]) !~ ('^cozum/' || p_odev::text || '/' || o.ogrenci_id::text
                            || '-' || (i + 1)::text || '\.(jpg|jpeg|png|webp)$')
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
      (p_odev, o.ogrenci_id, p_cevaplar, btrim(p_foto_yolu), nullif(v_ek, '{}'::text[]),
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
      (p_odev, o.ogrenci_id, btrim(p_foto_yolu), nullif(v_ek, '{}'::text[]), 'incelemede')
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
-- 4. EKRANLARA DÜŞEN ALAN — iki ucun İMZASI AYNI, yalnız alan ekleniyor
--    ogrenci_odevleri  kopya: 0074_deneme_duzeyleri.sql
--    odev_gonderimleri kopya: 0073_deneme_hesabi.sql
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
      -- 0064: SINIF LİSTESİ ESAS (bugün sınıfta olan, ödevin son
      -- tarihinde sınıfa gelmiş öğrenciler).
      'mevcut', (select count(*) from public.ogrenciler o
                  where o.sinif_id = d.sinif_id and (o.aktif and not o.deneme)
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)),
      'gonderen', (select count(*) from public.gonderimler g
                    join public.ogrenciler o on o.id = g.ogrenci_id
                    where g.odev_id = d.id and o.sinif_id = d.sinif_id and (o.aktif and not o.deneme)
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)),
      'gecikmeli', (select count(*) from public.gonderimler g
                     join public.ogrenciler o on o.id = g.ogrenci_id
                     where g.odev_id = d.id
                       and public._gecikmeli(g.created_at, d.son_tarih)
                       and o.sinif_id = d.sinif_id and (o.aktif and not o.deneme)
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)),
      'puan_bekleyen', (select count(*) from public.gonderimler g
                         join public.ogrenciler o on o.id = g.ogrenci_id
                         where g.odev_id = d.id and g.durum = 'incelemede'
                           and o.sinif_id = d.sinif_id and (o.aktif and not o.deneme)
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at))
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
        join public.ogrenciler o on o.id = g.ogrenci_id
        cross join lateral jsonb_array_elements(
          public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
        ) e
        where g.odev_id = d.id and o.sinif_id = d.sinif_id and (o.aktif and (not o.deneme or public._deneme_gorur(v_ogretmen)))
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
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
        -- 0081: EK SÜRE VERİLDİ Mİ. `gecikmeli` DEĞİŞMİYOR (öğretmenin
        -- kararı; 43 çağrı noktası var ve kayıt dürüst kalmalı) — ek süre
        -- onun yanında ayrı bir bilgi olarak duruyor.
        'ek_sure', (select e.son_tarih from public.odev_ek_sure e
                     where e.odev_id = d.id and e.ogrenci_id = o.id),
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
      where o.sinif_id = d.sinif_id and (o.aktif and (not o.deneme or public._deneme_gorur(v_ogretmen)))
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
    ), '[]'::jsonb)
  );
end;
$$;

drop function if exists public._gonderim_yeniden_acildi(uuid, uuid);

-- -----------------------------------------------------------------------------
-- 5. YETKİLER
-- -----------------------------------------------------------------------------
do $$
declare ad text;
begin
  foreach ad in array array['gonderimi_yeniden_ac(text,uuid,text,date)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', ad);
    execute format('grant execute on function public.%s to anon, authenticated', ad);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 6. ÖZ-DENETİM
-- -----------------------------------------------------------------------------
do $$
declare eksik text[] := '{}';
begin
  -- 0007 TUZAĞI: eski üç argümanlı sürüm gerçekten gitti mi.
  if to_regprocedure('public.gonderimi_yeniden_ac(text,uuid,text)') is not null then
    eksik := eksik || 'eski gonderimi_yeniden_ac(text,uuid,text) duruyor — PostgREST onu çağırır'::text;
  end if;
  if to_regprocedure('public.gonderimi_yeniden_ac(text,uuid,text,date)') is null then
    eksik := eksik || 'tarihli gonderimi_yeniden_ac kurulmadı'::text;
  end if;

  if to_regclass('public.odev_ek_sure') is null then
    eksik := eksik || 'odev_ek_sure tablosu yok'::text;
  end if;
  if has_table_privilege('anon', 'public.odev_ek_sure', 'select') then
    eksik := eksik || 'odev_ek_sure anon''a açık'::text;
  end if;

  -- KAPI TARİHE BAKIYOR MU.
  if pg_get_functiondef('public.odev_gonder(text,uuid,text,jsonb,text[])'::regprocedure)
       not like '%odev_ek_sure%' then
    eksik := eksik || 'odev_gonder kişisel tarihe bakmıyor'::text;
  end if;
  -- ESKİ DAL DURUYOR MU (0081 öncesi açılmış gönderimler).
  if pg_get_functiondef('public.odev_gonder(text,uuid,text,jsonb,text[])'::regprocedure)
       not like '%_tarihsiz_yeniden_acildi%' then
    eksik := eksik || 'eski dal silinmiş — 0081 öncesi açılanlar gönderemez'::text;
  end if;
  -- Kapı ESKİ yardımcıya bakmamalı: o her açmada doğru dönüyor ve verilen
  -- tarihi anlamsız kılıyordu (testin 3. grubu bu kusuru buldu).
  if pg_get_functiondef('public.odev_gonder(text,uuid,text,jsonb,text[])'::regprocedure)
       like '%_gonderim_yeniden_acildi%' then
    eksik := eksik || 'kapı eski yardımcıya bakıyor — ek süre dolsa da geçer'::text;
  end if;

  -- `gecikmeli` DEĞİŞMEDİ: ek süre gecikme hesabına KARIŞMAMALI (öğretmenin
  -- kararı; 43 çağrı noktası var ve kayıt dürüst kalmalı).
  if pg_get_functiondef('public._gecikmeli(timestamptz,date)'::regprocedure)
       like '%odev_ek_sure%' then
    eksik := eksik || '_gecikmeli ek süreye bakıyor — 43 çağrı noktası ayrışır'::text;
  end if;

  -- MESAJ ÖĞRENCİ KANALINA.
  if pg_get_functiondef('public.gonderimi_yeniden_ac(text,uuid,text,date)'::regprocedure)
       not like '%''ogrenci'', v_gercek%' then
    eksik := eksik || 'iptal mesajı öğrenci kanalına yazılmıyor'::text;
  end if;

  if array_length(eksik, 1) > 0 then
    raise exception '0081 eksik: %', array_to_string(eksik, ' | ');
  end if;
end $$;

select public._migration_kaydet('0081');
