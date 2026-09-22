-- SEKİZ — 0047: Ödev kıyası (sınıf ve seviye ortalaması)
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Açıklamalı tam sürüm: supabase/migrations/0047_odev_kiyasi.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Yedek)
-- BU SQL ÖNCE ÇALIŞMALI, SİTE SONRA YAYINA ALINMALI.
--
-- NE YAPIYOR: Bir ödevin teslim süresi dolduğunda öğrenci (ve veli)
-- ödev sonucunda üç sayıyı yan yana görüyor:
--
--     Puanın            80
--     9A ortalaması     65
--     9. sınıflar       61
--
-- Sizin ve müdürün kararı. Ekranda "üstündesin/altındasın" diye bir
-- cümle YOK; yalnız sayılar var. Yorumu öğrenci ve siz yapıyorsunuz.
--
-- NE ZAMAN GÖRÜNÜYOR: ödevin teslim süresi dolduktan sonra. Süre
-- dolmadan kart hiç çizilmiyor — sizin kararınız.
--
-- "TÜM 9'LAR" NASIL BULUNUYOR: aynı ADI taşıyan ve AYNI GÜN
-- oluşturduğunuz ödevler, aynı SEVİYENİN şubelerinde. Üçü birden.
--   * Tek seferde 9A+9B+9C seçerseniz üçü de aynı anda oluşur → eşleşir.
--   * 9A'yı pazartesi, 9B'yi salı oluşturursanız EŞLEŞMEZ; o ödevde
--     yalnız kendi sınıf ortalaması görünür, "tüm 9'lar" satırı çıkmaz.
--   * Aynı adla 10. sınıfa da ödev verdiyseniz 10'lar KARIŞMAZ.
--
-- ALT SINIR YOK — sizin kararınız. Size şu bildirilmişti: bir ödevi
-- yalnız iki kişi teslim ettiyse, öğrenci kendi puanından arkadaşının
-- notunu hesaplayabilir. "Gerek yok" dediniz; öyle yapıldı. Fikrinizi
-- değiştirirseniz tek satırlık bir ekleme yeter, bana söyleyin.
--
-- ÖZEL DERS öğrencisinde kart hiç çıkmıyor (tek grup, her seviye
-- karışık — orada "sınıf ortalaması" bir şey ifade etmez).
--
-- TESLİM SAYISI GÖSTERİLMİYOR — sizin kararınız. Ekrandan kaldırmakla
-- kalmadık, sunucu yanıtından da çıkardık: "ekranda yok" ile "kimse
-- göremez" aynı şey değil.
--
-- ONAM KURALI KORUNDU: onam vermemiş veli bunu da göremez.
--
-- Veri silinmiyor, hiçbir tablo değişmiyor; yalnız iki fonksiyon
-- ekleniyor/güncelleniyor.

-- -----------------------------------------------------------------------------
-- HESAP TEK YERDE: `_odev_kiyasi`
--
-- İki yüzey bu sayıyı gösteriyor — öğrencinin ödev sonuç ekranı (uç:
-- `odev_kiyasi`) ve velinin ödev listesi (uç: `veli_paneli`). Veli
-- ekranında ÖDEV KİMLİĞİ YOK (`VeliOdevi`'de `id` alanı bilerek
-- tutulmuyor), o yüzden veli kimlikle ayrı bir çağrı yapamıyor; kıyas
-- satırın içine gömülüyor — tıpkı `konu_analizi` gibi.
--
-- ORTALAMA HESABI İKİ KEZ YAZILMIYOR. 0030'un dersi: "ikinci bir insert
-- yazsaydık iki yol bir gün ayrışırdı." Burada ayrışma daha sinsi
-- olurdu — kimse çökmez, yalnız veliye ve öğrenciye FARKLI iki sayı
-- gider. `odev_kiyasi_testleri.sql` 13c ikisinin eşit olduğunu ayrıca
-- ölçüyor.
--
-- YETKİ YOK, KAPI YOK: bu dahili bir hesap. Kapılar çağıranda.
-- -----------------------------------------------------------------------------
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

  if d.son_tarih >= (now() at time zone 'Europe/Istanbul')::date then
    return jsonb_build_object('durum', 'sure_dolmadi');
  end if;

  -- KENDİ SINIFI
  select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1), count(*)
    into v_sinif_ort, v_sinif_adet
    from public.gonderimler g
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
   where d2.yayinda
     and btrim(d2.baslik) = btrim(d.baslik)
     and d2.created_at::date = d.created_at::date
     and s2.seviye = v_seviye
     and not s2.ozel
     and coalesce(g.ogretmen_puan, g.puan) is not null;

  return jsonb_build_object(
    'durum', 'hazir',
    'sinif', jsonb_build_object(
      'ad',      (select s.ad from public.siniflar s where s.id = d.sinif_id),
      'ortalama', v_sinif_ort,
      'adet',     v_sinif_adet
    ),
    -- Kardeş şube yoksa (yalnız kendi sınıfına verilmiş) bu alan null
    -- ve ekran o satırı hiç çizmiyor. Öğretmenin kuralı: "diğer şubelere
    -- verilmemişse sadece ödevin verildiği sınıf ortalaması alınsın."
    'seviye', case when v_sube_adet > 1 then jsonb_build_object(
      'ad',       v_seviye::text || '. sınıflar',
      'ortalama', v_seviye_ort,
      'adet',     v_seviye_adet,
      'sube',     v_sube_adet
    ) else null end
  );
end;
$$;

revoke all on function public._odev_kiyasi(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- HESAP TEK YERDE: `_odev_kiyasi`
--
-- İki yüzey bu sayıyı gösteriyor — öğrencinin ödev sonuç ekranı (uç:
-- `odev_kiyasi`) ve velinin ödev listesi (uç: `veli_paneli`). Veli
-- ekranında ÖDEV KİMLİĞİ YOK (`VeliOdevi`'de `id` alanı bilerek
-- tutulmuyor), o yüzden veli kimlikle ayrı bir çağrı yapamıyor; kıyas
-- satırın içine gömülüyor — tıpkı `konu_analizi` gibi.
--
-- ORTALAMA HESABI İKİ KEZ YAZILMIYOR. 0030'un dersi: "ikinci bir insert
-- yazsaydık iki yol bir gün ayrışırdı." Burada ayrışma daha sinsi
-- olurdu — kimse çökmez, yalnız veliye ve öğrenciye FARKLI iki sayı
-- gider. `odev_kiyasi_testleri.sql` 13c ikisinin eşit olduğunu ayrıca
-- ölçüyor.
--
-- YETKİ YOK, KAPI YOK: bu dahili bir hesap. Kapılar çağıranda.
-- -----------------------------------------------------------------------------
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

  if d.son_tarih >= (now() at time zone 'Europe/Istanbul')::date then
    return jsonb_build_object('durum', 'sure_dolmadi');
  end if;

  -- KENDİ SINIFI
  select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1), count(*)
    into v_sinif_ort, v_sinif_adet
    from public.gonderimler g
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

revoke all on function public._odev_kiyasi(uuid) from public, anon, authenticated;

create or replace function public.odev_kiyasi(p_token text, p_odev_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  d record;
begin
  select * into o from public._oturum(p_token);

  if o.rol not in ('ogrenci', 'veli') then
    raise exception 'Bu işlem yalnızca öğrenci ve veli içindir.'
      using errcode = '42501';
  end if;

  -- Onam kapısı 0034/0046 deseniyle: onam vermemiş veli hiçbir veli
  -- ucunu kullanamaz ve bu uç da istisna değil.
  perform public._onam_kapisi(o.rol, o.ogrenci_id);

  select * into d from public.odevler where id = p_odev_id and yayinda;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  -- SAHİPLİK: ödev öğrencinin KENDİ sınıfının ödevi olmalı. `odev_gonder`
  -- (0004) ile birebir aynı denetim; başka sınıfın ödev kimliğini
  -- göndererek o sınıfın ortalamasını okumak mümkün olmamalı.
  if not exists (
    select 1 from public.ogrenciler ogr
    where ogr.id = o.ogrenci_id and ogr.sinif_id = d.sinif_id
  ) then
    raise exception 'Bu ödev sizin sınıfınıza ait değil.' using errcode = '42501';
  end if;

  return public._odev_kiyasi(p_odev_id);
end;
$$;

-- 0005 deseni: jeton İÇERİDE denetleniyor, kapı `_oturum`. Yetkinin
-- kaynağı anahtar değil jeton.
revoke all on function public.odev_kiyasi(text, uuid) from public, anon, authenticated;
grant execute on function public.odev_kiyasi(text, uuid) to anon;

-- -----------------------------------------------------------------------------
-- VELİ PANELİNE KIYAS ALANI
--
-- Gövde 0034'ten BİREBİR KOPYALANDI, ezberden yeniden yazılmadı (0016 ve
-- 0029'un dersi: `create or replace` için gövdeyi yeniden yazmak iki kez
-- hataya yol açtı). Diff ölçüldü: yalnız TEK bir alan eklendi ve artık
-- doğru olmayan bir yorum düzeltildi; başka hiçbir satır değişmedi.
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
        'son_tarih', d.son_tarih,
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
-- KENDİNİ DENETLEME
--
-- 0007 tuzağı yok (yeni ad). "Tek imza" iddiası yine de ölçülüyor ve
-- `pg_get_function_identity_arguments()` KULLANILMIYOR: o fonksiyon
-- parametre ADLARINI da döndürdüğü için çıplak tip listesiyle
-- karşılaştırmak ASLA tutmayan bir iddia kurar (0042'de ölü bulundu).
-- -----------------------------------------------------------------------------
do $$
declare
  v_sayi integer;
begin
  select count(*) into v_sayi
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'odev_kiyasi';

  if v_sayi <> 1 then
    raise exception '0047: odev_kiyasi % imzayla duruyor, 1 olmalı', v_sayi;
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'odev_kiyasi'
     and pg_catalog.oidvectortypes(p.proargtypes) = 'text, uuid'
  ) then
    raise exception '0047: odev_kiyasi imzası beklenen (text, uuid) değil';
  end if;
end $$;

select public._migration_kaydet('0047');
