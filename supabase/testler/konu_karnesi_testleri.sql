-- =============================================================================
-- SEKİZ — KONU KARNESİ TESTLERİ (0023)
--
-- Asıl soru TOPLAMA DOĞRU MU: dönem geneli döküm, tek tek ödevlerin
-- dökümlerinin toplamı mı? Yanlış toplayan bir karne, öğretmeni bir sonraki
-- dersinde YANLIŞ KONUYU anlatmaya götürür — sessiz ve pahalı bir hata.
--
-- İkinci soru TUTARLILIK: tek ödev varken karne, o ödevin `konu_ozeti`'yle
-- birebir aynı mı; `odev_sayisi`, `sinif_ogrencileri.degerlendirilen_odev`
-- ile aynı mı? Ayrışırlarsa öğretmen iki ekranda iki sayı görür.
--
-- Üçüncüsü SIRALAMA: "en zayıf konu başta" bir İDDİA ve ölçülmesi gerekiyor.
-- Sıralama yanlışsa ekran doğru veriyi yanlış öncelikle gösterir.
--
-- NOT: hiçbir blokta `exception when others` YOK. Böyle bir yakalayıcı
-- kendinden önceki bütün grupların hatalarını yutar ve test hiçbir şey
-- ölçmemiş olur (0022 turunda bu hata yapıldı, tekrarlanmıyor).
--
-- İZOLASYON: kendi sınıfımızı (6Z) kuruyoruz. Süit bütün test dosyalarını
-- AYNI veritabanında koşturuyor; başka dosyaların sınıfları karışmasın.
--
-- SAYILAR ELLE HESAPLANIP DOSYAYA YAZILDI. Beklenen değeri sorgunun
-- kendisinden üretmek, sorgu yanlışken de "geçen" bir test üretir.
-- =============================================================================
\set ON_ERROR_STOP on

-- -----------------------------------------------------------------------------
-- KURULUM + 1. ODEV, sonra 1. ve 4. gruplar
--
-- 4. grup (tutarlılık) BU BLOKTA, çünkü `konu_ozeti` TEK bir ödevin dökümü.
-- İkinci ödev eklendikten sonra karşılaştırma anlamını yitirirdi.
-- -----------------------------------------------------------------------------
do $$
declare
  jt text;
  v_s uuid; v_ada uuid; v_ege uuid; v_o1 uuid;
  v jsonb; k jsonb; oz jsonb;
begin
  update public.ayarlar
     set ogretmen_pin_hash = extensions.crypt('Karne!2026', extensions.gen_salt('bf', 10))
   where id = 1;
  jt := (public.giris('Karne!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (6, 'Z')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_s;

  v_ada := (public.ogrenci_ekle(jt, 'Ada Karne', 'okul', v_s))->>'id';
  v_ege := (public.ogrenci_ekle(jt, 'Ege Karne', 'okul', v_s))->>'id';

  -- ---------------------------------------------------------------------------
  -- 1 — SINIR: ikisinden TAM OLARAK biri
  -- ---------------------------------------------------------------------------
  begin
    perform public.konu_karnesi(jt, v_s, v_ada);
    raise exception '1a: sınıf ve öğrenci BİRLİKTE kabul edildi';
  exception when sqlstate '22023' then null;
  end;

  begin
    perform public.konu_karnesi(jt);
    raise exception '1b: hiçbir id verilmeden kabul edildi';
  exception when sqlstate '22023' then null;
  end;

  begin
    perform public.konu_karnesi(jt, null, gen_random_uuid());
    raise exception '1c: olmayan öğrenci kabul edildi';
  exception when sqlstate 'P0002' then null;
  end;

  raise notice '1 OK — ikisinden tam olarak biri isteniyor, olmayan kimlik reddediliyor';

  -- ---------------------------------------------------------------------------
  -- 1. ÖDEV — 4 soru, 1-2 Türev, 3-4 Limit. SÜRESİ DOLMUŞ.
  --
  -- Süresi dolmuş tarihle oluşturuluyor; `gec_teslim` varsayılanı `true`
  -- olduğu için gönderim yine kabul ediliyor (0010).
  -- ---------------------------------------------------------------------------
  v_o1 := (public.odev_olustur(jt, 'Karne testi 1', null, v_s, 'test',
      (current_date - 5)::date, 4,
      '{"1":"A","2":"B","3":"C","4":"D"}'::jsonb, null, null, true, 5::smallint,
      '{"1":"Türev","2":"Türev","3":"Limit","4":"Limit"}'::jsonb))->>'id';
  perform public.odev_yayinla(jt, v_o1);

  -- Ada: 1 doğru 2 yanlış(X) → Türev 1/2; 3 ve 4 doğru → Limit 2/2. Puan 75.
  perform public.odev_gonder(
    (public.giris((select kod from public.giris_kodlari
                   where ogrenci_id = v_ada and rol = 'ogrenci')))->>'token',
    v_o1, 'cozum/' || v_o1 || '/' || v_ada || '.jpg',
    '{"1":"A","2":"X","3":"C","4":"D"}'::jsonb);

  -- Ege: 1-2 doğru → Türev 2/2; 3 yanlış(Z), 4 BOŞ → Limit 0 doğru 1 yanlış
  -- 1 boş. Puan 50.
  perform public.odev_gonder(
    (public.giris((select kod from public.giris_kodlari
                   where ogrenci_id = v_ege and rol = 'ogrenci')))->>'token',
    v_o1, 'cozum/' || v_o1 || '/' || v_ege || '.jpg',
    '{"1":"A","2":"B","3":"Z","4":""}'::jsonb);

  -- ---------------------------------------------------------------------------
  -- 4 — TUTARLILIK: tek ödev varken karne = o ödevin konu özeti
  -- ---------------------------------------------------------------------------
  v  := public.konu_karnesi(jt, v_s);
  oz := public.odev_gonderimleri(jt, v_o1) -> 'konu_ozeti';

  if v->'konular' <> oz then
    raise exception '4a: karne (%) konu özetiyle (%) ayrıştı', v->'konular', oz;
  end if;

  -- DENETİMİN İŞE YARADIĞI KANITI: iki taraf da boş olsaydı eşitlik hiçbir
  -- şey söylemezdi.
  if jsonb_array_length(v->'konular') = 0 then
    raise exception '4b: karşılaştırma BOŞ veriyle yapıldı — test bir şey ölçmedi';
  end if;

  if (v->>'odev_sayisi')::int
     <> (public.sinif_ogrencileri(jt, v_s)->>'degerlendirilen_odev')::int then
    raise exception '4c: odev_sayisi (%) sinif_ogrencileri ile (%) ayrıştı',
      v->>'odev_sayisi',
      public.sinif_ogrencileri(jt, v_s)->>'degerlendirilen_odev';
  end if;

  -- Kapsam doğru anlatılıyor mu
  if v->'kapsam'->>'tur' <> 'sinif' or (v->'kapsam'->>'mevcut')::int <> 2 then
    raise exception '4d: kapsam yanlış: %', v->'kapsam';
  end if;

  raise notice '4 OK — karne konu özetiyle ve degerlendirilen_odev ile birebir aynı (% konu)',
    jsonb_array_length(v->'konular');

  -- ---------------------------------------------------------------------------
  -- 6 — AÇIK UÇLU: `konular`'da YOK, `gelisim`'de VAR
  --
  -- Açık uçluda cevap anahtarı yok; konu dökümüne girseydi `_konu_analizi`
  -- her soruyu "boş" sayar ve öğretmene uydurma bir eksik listesi çıkardı.
  -- Ama puanı var, dolayısıyla gelişimden çıkarmak resmin yarısını silerdi.
  --
  -- KONULAR ELLE YAZILIYOR — ve bu bilerek. İlk yazımda test yalnız normal
  -- yoldan açık uçlu ödev oluşturuyordu; `d.tur = 'test'` süzgecini kaldırıp
  -- denediğimde test YİNE GEÇTİ, yani süzgeci hiç ölçmüyordu. Sebebi ölçüldü:
  -- `odev_olustur`/`odev_guncelle`, açık uçluda `soru_sayisi`'yı null
  -- bırakıyor ve `_konu_temizle` bütün konuları eliyor — yani açık uçlu bir
  -- ödev normal yoldan KONU TAŞIYAMIYOR. Süzgeç bugün ikinci bir kapı; şema
  -- (`odev_test_tutarli`) açık uçlu dalı kısıtlamadığı için bozuk veriyle ya
  -- da ileride yapılacak bir değişiklikle o kapı gerekli hâle gelebilir.
  -- Aşağıdaki `update` tam olarak o durumu taklit ediyor.
  -- ---------------------------------------------------------------------------
  declare
    v_acik uuid; v_g uuid; n_once integer; n_sonra integer;
  begin
    n_once := jsonb_array_length(public.konu_karnesi(jt, v_s)->'konular');

    v_acik := (public.odev_olustur(jt, 'Karne açık uçlu', null, v_s, 'acik',
                                   (current_date - 4)::date))->>'id';
    perform public.odev_yayinla(jt, v_acik);
    perform public.odev_gonder(
      (public.giris((select kod from public.giris_kodlari
                     where ogrenci_id = v_ada and rol = 'ogrenci')))->>'token',
      v_acik, 'cozum/' || v_acik || '/' || v_ada || '.jpg');
    select id into v_g from public.gonderimler
     where odev_id = v_acik and ogrenci_id = v_ada;
    perform public.acik_puanla(jt, v_g, 90, 'Güzel.');

    -- Normal yoldan oluşamayan durum: konusu olan açık uçlu ödev.
    update public.odevler
       set konular = '{"1":"Karne Hayalet Konu","2":"Karne Hayalet Konu"}'::jsonb,
           soru_sayisi = 2
     where id = v_acik;

    v := public.konu_karnesi(jt, v_s);
    n_sonra := jsonb_array_length(v->'konular');
    if n_sonra <> n_once then
      raise exception '6a: açık uçlu ödev konu dökümüne girdi (%→%): %',
        n_once, n_sonra, v->'konular';
    end if;
    if exists (select 1 from jsonb_array_elements(v->'konular') e
                where e->>'konu' = 'Karne Hayalet Konu') then
      raise exception '6a2: anahtarsız ödevin konusu dökümde';
    end if;

    select e into k from jsonb_array_elements(v->'gelisim') e
     where e->>'odev' = 'Karne açık uçlu';
    if k is null then
      raise exception '6b: açık uçlu ödev gelişimde YOK: %', v->'gelisim';
    end if;
    if (k->>'deger')::numeric <> 90 then
      raise exception '6c: açık uçluda öğretmen puanı kullanılmadı: %', k;
    end if;

    raise notice '6 OK — açık uçlu konularda yok, gelişimde var ve öğretmen puanıyla';
  end;
end $$;

-- -----------------------------------------------------------------------------
-- 2. ÖDEV, sonra 2, 3, 5 ve 7. gruplar
-- -----------------------------------------------------------------------------
do $$
declare
  jt text;
  v_s uuid; v_ada uuid; v_ege uuid; v_o2 uuid; v_ileri uuid; v_taslak uuid;
  v jsonb; k jsonb;
begin
  jt := (public.giris('Karne!2026'))->>'token';
  select id into v_s from public.siniflar where seviye = 6 and sube = 'Z';
  select id into v_ada from public.ogrenciler where ad = 'Ada Karne';
  select id into v_ege from public.ogrenciler where ad = 'Ege Karne';

  -- 2. ÖDEV — 2 soru: 1 Türev, 2 Limit. Yalnız Ada gönderiyor, ikisi de doğru.
  v_o2 := (public.odev_olustur(jt, 'Karne testi 2', null, v_s, 'test',
      (current_date - 3)::date, 2,
      '{"1":"A","2":"B"}'::jsonb, null, null, true, 5::smallint,
      '{"1":"Türev","2":"Limit"}'::jsonb))->>'id';
  perform public.odev_yayinla(jt, v_o2);
  perform public.odev_gonder(
    (public.giris((select kod from public.giris_kodlari
                   where ogrenci_id = v_ada and rol = 'ogrenci')))->>'token',
    v_o2, 'cozum/' || v_o2 || '/' || v_ada || '.jpg',
    '{"1":"A","2":"B"}'::jsonb);

  -- ---------------------------------------------------------------------------
  -- 2 — ELLE TOPLANAN DÖNEM TOPLAMI
  --
  -- Türev:  ödev1 Ada 2/1d/1y  +  ödev1 Ege 2/2d  +  ödev2 Ada 1/1d
  --         = toplam 5, doğru 4, yanlış 1, boş 0
  -- Limit:  ödev1 Ada 2/2d     +  ödev1 Ege 2/0d/1y/1b + ödev2 Ada 1/1d
  --         = toplam 5, doğru 3, yanlış 1, boş 1
  -- ---------------------------------------------------------------------------
  v := public.konu_karnesi(jt, v_s);

  select e into k from jsonb_array_elements(v->'konular') e where e->>'konu' = 'Türev';
  if (k->>'toplam')::int <> 5 or (k->>'dogru')::int <> 4
     or (k->>'yanlis')::int <> 1 or (k->>'bos')::int <> 0 then
    raise exception '2a: Türev toplamı yanlış: %', k;
  end if;

  select e into k from jsonb_array_elements(v->'konular') e where e->>'konu' = 'Limit';
  if (k->>'toplam')::int <> 5 or (k->>'dogru')::int <> 3
     or (k->>'yanlis')::int <> 1 or (k->>'bos')::int <> 1 then
    raise exception '2b: Limit toplamı yanlış: %', k;
  end if;

  raise notice '2 OK — dönem toplamı elle hesaplanan sayılarla birebir tutuyor';

  -- ---------------------------------------------------------------------------
  -- 3 — EN ZAYIF KONU BAŞTA
  --
  -- Eksik (toplam - doğru): Limit 2, Türev 1. Limit önce gelmeli.
  -- ---------------------------------------------------------------------------
  if v->'konular'->0->>'konu' <> 'Limit' then
    raise exception '3a: en zayıf konu başta değil: %', v->'konular';
  end if;
  raise notice '3 OK — en zayıf konu başta (Limit 2 eksik, Türev 1 eksik)';

  -- ---------------------------------------------------------------------------
  -- 5 — SÜRESİ DOLMAMIŞ VE TASLAK ÖDEV SAYILMIYOR
  --
  -- 0013'ün ölçütü birebir korunuyor. Süresi devam eden ödevi saymak
  -- ortalamayı her gün oynatır ve öğretmen aynı sınıfa iki gün üst üste
  -- baktığında farklı sayı görürdü.
  -- ---------------------------------------------------------------------------
  declare
    n_once integer := (public.konu_karnesi(jt, v_s)->>'odev_sayisi')::int;
    n_sonra integer;
  begin
    v_ileri := (public.odev_olustur(jt, 'Karne ileri tarihli', null, v_s, 'test',
        (current_date + 7)::date, 2, '{"1":"A","2":"B"}'::jsonb, null, null,
        true, 5::smallint, '{"1":"Türev","2":"Türev"}'::jsonb))->>'id';
    perform public.odev_yayinla(jt, v_ileri);
    perform public.odev_gonder(
      (public.giris((select kod from public.giris_kodlari
                     where ogrenci_id = v_ege and rol = 'ogrenci')))->>'token',
      v_ileri, 'cozum/' || v_ileri || '/' || v_ege || '.jpg',
      '{"1":"Q","2":"Q"}'::jsonb);   -- iki yanlış: sızarsa Türev'i bozar

    -- Taslak: yayınlanmamış, süresi de dolmuş
    v_taslak := (public.odev_olustur(jt, 'Karne taslak', null, v_s, 'test',
        (current_date - 2)::date, 2, '{"1":"A","2":"B"}'::jsonb, null, null,
        true, 5::smallint, '{"1":"Limit","2":"Limit"}'::jsonb))->>'id';

    v := public.konu_karnesi(jt, v_s);
    n_sonra := (v->>'odev_sayisi')::int;
    if n_sonra <> n_once then
      raise exception '5a: süresi dolmamış/taslak ödev sayıldı (%→%)', n_once, n_sonra;
    end if;

    select e into k from jsonb_array_elements(v->'konular') e where e->>'konu' = 'Türev';
    if (k->>'toplam')::int <> 5 then
      raise exception '5b: süresi dolmamış ödevin cevapları konu dökümüne sızdı: %', k;
    end if;

    if exists (select 1 from jsonb_array_elements(v->'gelisim') e
                where e->>'odev' in ('Karne ileri tarihli', 'Karne taslak')) then
      raise exception '5c: süresi dolmamış ya da taslak ödev gelişimde görünüyor';
    end if;

    raise notice '5 OK — süresi dolmamış ve taslak ödev ne sayılıyor ne de dökümde';
  end;

  -- ---------------------------------------------------------------------------
  -- 7 — ÖĞRENCİ KAPSAMI
  --
  -- Ada:  Türev 3 toplam / 2 doğru;  Limit 3 toplam / 3 doğru
  --       → eksik Türev 1, Limit 0 → TÜREV BAŞTA (sınıfın tersi!)
  -- Ege:  ödev1'e gönderdi (50), ödev2'ye GÖNDERMEDİ → deger NULL, 0 DEĞİL
  -- ---------------------------------------------------------------------------
  v := public.konu_karnesi(jt, null, v_ada);
  if v->'kapsam'->>'tur' <> 'ogrenci' or v->'kapsam'->>'ad' <> 'Ada Karne' then
    raise exception '7a: kapsam yanlış: %', v->'kapsam';
  end if;
  select e into k from jsonb_array_elements(v->'konular') e where e->>'konu' = 'Türev';
  if (k->>'toplam')::int <> 3 or (k->>'dogru')::int <> 2 then
    raise exception '7b: Ada''nın Türev dökümü yanlış: %', k;
  end if;
  if v->'konular'->0->>'konu' <> 'Türev' then
    raise exception '7c: öğrencide sıralama sınıfınkini tekrarlıyor: %', v->'konular';
  end if;

  v := public.konu_karnesi(jt, null, v_ege);
  select e into k from jsonb_array_elements(v->'gelisim') e
   where e->>'odev' = 'Karne testi 1';
  if (k->>'deger')::numeric <> 50 or (k->>'gonderen')::int <> 1 then
    raise exception '7d: Ege''nin 1. ödev değeri yanlış: %', k;
  end if;

  select e into k from jsonb_array_elements(v->'gelisim') e
   where e->>'odev' = 'Karne testi 2';
  if k is null then
    raise exception '7e: göndermediği ödev gelişimden düştü — satır kalmalıydı';
  end if;
  -- GÖNDERMEMEK SIFIR ALMAK DEĞİLDİR. `deger` 0 dönseydi ekran "sıfır aldı"
  -- derdi; öğretmen o çocuk hakkında yanlış bir cümle kurardı.
  if k->'deger' <> 'null'::jsonb or (k->>'gonderen')::int <> 0 then
    raise exception '7f: göndermediği ödevde deger boş değil: %', k;
  end if;

  -- Sınıf ortalaması: ödev1'de Ada 75, Ege 50 → 62.5
  v := public.konu_karnesi(jt, v_s);
  select e into k from jsonb_array_elements(v->'gelisim') e
   where e->>'odev' = 'Karne testi 1';
  if (k->>'deger')::numeric <> 62.5 or (k->>'gonderen')::int <> 2
     or (k->>'mevcut')::int <> 2 then
    raise exception '7g: sınıf gelişim satırı yanlış: %', k;
  end if;

  -- Kronolojik sıra: ödev1 (bugün-5) ödev2'den (bugün-3) önce
  if v->'gelisim'->0->>'odev' <> 'Karne testi 1' then
    raise exception '7h: gelişim kronolojik değil: %', v->'gelisim';
  end if;

  raise notice '7 OK — öğrenci kapsamı kendi sayılarını veriyor, göndermemek sıfır sayılmıyor';
end $$;

-- -----------------------------------------------------------------------------
-- 8 — PASİF ÖĞRENCİ
--
-- Sınıf karnesinde SAYILMIYOR; ama adına tıklanınca karnesi YİNE ÇIKIYOR.
-- İkisi çelişki değil: biri toplama, öbürü kimlikle sorulan bir soru.
--
-- BİLİNEN VE KABUL EDİLEN AYRIŞMA burada ölçülüyor: `konu_ozeti` (0020)
-- gönderimleri hiç süzmüyor, yani pasif öğrencininki orada sayılıyor. Testi
-- "ikisi hep aynıdır" diye yazmak yanlış olurdu; farkın TAM OLARAK beklenen
-- kadar olduğunu ölçüyoruz.
-- -----------------------------------------------------------------------------
do $$
declare
  jt text; v_s uuid; v_p uuid; v_o1 uuid;
  v jsonb; k jsonb; oz jsonb;
  t_once integer; t_sonra integer;
begin
  jt := (public.giris('Karne!2026'))->>'token';
  select id into v_s  from public.siniflar where seviye = 6 and sube = 'Z';
  select id into v_o1 from public.odevler where baslik = 'Karne testi 1';

  select e->>'toplam' into t_once
  from jsonb_array_elements(public.konu_karnesi(jt, v_s)->'konular') e
  where e->>'konu' = 'Türev';

  v_p := (public.ogrenci_ekle(jt, 'Pınar Karne', 'okul', v_s))->>'id';
  perform public.odev_gonder(
    (public.giris((select kod from public.giris_kodlari
                   where ogrenci_id = v_p and rol = 'ogrenci')))->>'token',
    v_o1, 'cozum/' || v_o1 || '/' || v_p || '.jpg',
    '{"1":"A","2":"B","3":"C","4":"D"}'::jsonb);   -- hepsi doğru

  -- Aktifken sayılıyor: Türev 5 → 7
  select e->>'toplam' into t_sonra
  from jsonb_array_elements(public.konu_karnesi(jt, v_s)->'konular') e
  where e->>'konu' = 'Türev';
  if t_sonra <> t_once + 2 then
    raise exception '8a: aktif öğrencinin gönderimi sayılmadı (%→%)', t_once, t_sonra;
  end if;

  perform public.ogrenci_pasiflestir(jt, v_p);

  select e->>'toplam' into t_sonra
  from jsonb_array_elements(public.konu_karnesi(jt, v_s)->'konular') e
  where e->>'konu' = 'Türev';
  if t_sonra <> t_once then
    raise exception '8b: pasif öğrencinin gönderimi hâlâ sayılıyor (% yerine %)',
      t_once, t_sonra;
  end if;

  -- Kimlikle sorulunca karne yine çıkıyor — listede "Pasif" etiketiyle
  -- görünen bir öğrenciye tıklayınca hata almak sürpriz olurdu.
  v := public.konu_karnesi(jt, null, v_p);
  if (v->>'odev_sayisi')::int = 0 or jsonb_array_length(v->'konular') = 0 then
    raise exception '8c: pasif öğrencinin kendi karnesi boş döndü: %', v;
  end if;

  -- BİLİNEN AYRIŞMA: konu_ozeti pasifi de sayıyor, karne saymıyor.
  oz := public.odev_gonderimleri(jt, v_o1) -> 'konu_ozeti';
  select (e->>'toplam')::int into t_sonra
  from jsonb_array_elements(oz) e where e->>'konu' = 'Türev';
  if t_sonra <> 6 then   -- Ada 2 + Ege 2 + Pınar 2
    raise exception '8d: konu_ozeti''nin pasifi saydığı varsayımı bozuldu: %', oz;
  end if;

  raise notice '8 OK — pasif sınıf karnesinden düşüyor, kendi karnesi duruyor, konu_ozeti farkı beklenen kadar';
end $$;

-- -----------------------------------------------------------------------------
-- 9 — ARŞİV VE SIZINTI, 10 — ROL
-- -----------------------------------------------------------------------------
do $$
declare
  jt text; jo text; jv text;
  v_s uuid; v_baska uuid; v_ada uuid;
  v jsonb;
begin
  jt := (public.giris('Karne!2026'))->>'token';
  select id into v_s   from public.siniflar where seviye = 6 and sube = 'Z';
  select id into v_ada from public.ogrenciler where ad = 'Ada Karne';

  -- Başka bir sınıfın ödevi karneye SIZMAMALI
  --
  -- 8Z BİLEREK SEÇİLDİ: süit bütün test dosyalarını AYNI veritabanında
  -- koşturuyor ve 7Z'yi `arsiv_testleri.sql` zaten kullanıyor. İlk yazımda
  -- 7Z seçilmişti ve test o dosyadan kalan iki ödevi görüp kırıldı — kurgu
  -- hatası, ürün kusuru değil. Aşağıdaki arşiv denetimi yine de MUTLAK sayı
  -- değil, ÖNCE/SONRA farkı ölçüyor; bir gün 8Z de paylaşılsa kırılmasın.
  insert into public.siniflar (seviye, sube) values (8, 'Z')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_baska;
  declare
    v_o uuid; v_b uuid;
  begin
    v_b := (public.ogrenci_ekle(jt, 'Baran Karne', 'okul', v_baska))->>'id';
    v_o := (public.odev_olustur(jt, 'Başka sınıf ödevi', null, v_baska, 'test',
        (current_date - 1)::date, 2, '{"1":"A","2":"B"}'::jsonb, null, null,
        true, 5::smallint, '{"1":"Türev","2":"Türev"}'::jsonb))->>'id';
    perform public.odev_yayinla(jt, v_o);
    perform public.odev_gonder(
      (public.giris((select kod from public.giris_kodlari
                     where ogrenci_id = v_b and rol = 'ogrenci')))->>'token',
      v_o, 'cozum/' || v_o || '/' || v_b || '.jpg', '{"1":"Q","2":"Q"}'::jsonb);
  end;

  v := public.konu_karnesi(jt, v_s);
  if exists (select 1 from jsonb_array_elements(v->'gelisim') e
              where e->>'odev' = 'Başka sınıf ödevi') then
    raise exception '9a: başka sınıfın ödevi karneye sızdı';
  end if;

  -- ARŞİV REDDEDİLMİYOR — bilinçli. Bu uç bir liste değil, kimlikle
  -- çağrılıyor ve `sinif_ogrencileri` ile aynı yerde duruyor (0016). Arşiv
  -- sayfası hata kutusuyla açılmamalı.
  declare
    n_once integer := (public.konu_karnesi(jt, v_baska)->>'odev_sayisi')::int;
    n_sonra integer;
  begin
    if n_once = 0 then
      raise exception '9b: kurulum bozuk — arşiv denemesi boş karneyle yapılıyor';
    end if;
    perform public.sinif_arsivle(jt, v_baska, true);
    n_sonra := (public.konu_karnesi(jt, v_baska)->>'odev_sayisi')::int;
    if n_sonra <> n_once then
      raise exception '9c: arşivlenince karne değişti (%→%)', n_once, n_sonra;
    end if;
    perform public.sinif_arsivle(jt, v_baska, false);
  end;

  raise notice '9 OK — başka sınıf sızmıyor, arşivdeki sınıfın karnesi bilerek açık';

  -- ---------------------------------------------------------------------------
  -- 10 — ÖĞRENCİ VE VELİ ÇAĞIRAMIYOR
  --
  -- Dönem geneli "zayıf konular" listesi öğretmenin aracı. Bir çocuğa
  -- gösterilecekse bu ayrı bir karardır (ton, eşik, kimin ağzından) ve
  -- öğretmen istemedi.
  -- ---------------------------------------------------------------------------
  jo := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_ada and rol = 'ogrenci')))->>'token';
  begin
    perform public.konu_karnesi(jo, null, v_ada);
    raise exception '10a: ÖĞRENCİ kendi konu karnesini çağırabildi';
  exception when sqlstate '42501' then null;
  end;

  jv := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_ada and rol = 'veli')))->>'token';
  begin
    perform public.konu_karnesi(jv, null, v_ada);
    raise exception '10b: VELİ konu karnesini çağırabildi';
  exception when sqlstate '42501' then null;
  end;

  begin
    perform public.konu_karnesi(jo, v_s);
    raise exception '10c: ÖĞRENCİ sınıf karnesini çağırabildi';
  exception when sqlstate '42501' then null;
  end;

  raise notice '10 OK — öğrenci ve veli çağıramıyor';
  raise notice '';
  raise notice 'KONU KARNESİ TESTLERİ: 10 GRUP GEÇTİ';
end $$;
