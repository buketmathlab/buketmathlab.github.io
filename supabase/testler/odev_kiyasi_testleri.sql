-- =============================================================================
-- SEKİZ — 0047 ÖDEV KIYASI TESTLERİ
--
-- Bu turun tehlikesi başka turlardan farklı: uç YANLIŞ BİR SAYI
-- döndürürse kimse fark etmez. Bir kapı açık kalsa test kırmızı yanar,
-- ama 58,3 yerine 43,8 yazan bir ortalama sessizce yanlış olur ve bir
-- çocuk kendini olduğundan kötü/iyi sanır.
--
-- Bu yüzden ortalamalar ELLE HESAPLANMIŞ değerlerle karşılaştırılıyor,
-- "bir sayı döndü mü" diye bakılmıyor. Kurulumdaki üç puan kümesi
-- BİLEREK birbirinden farklı sonuç verecek şekilde seçildi:
--
--   9X kendi sınıfı      → (100 + 50) / 2            = 75,0
--   9. sınıflar (9X+9Y)  → (100 + 50 + 25) / 3       = 58,3
--   10'lar karışırsa     → (100 + 50 + 25 + 0) / 4   = 43,8   ← kusur
--   farklı gün karışırsa → (100 + 50 + 25 + 100) / 4 = 68,8   ← kusur
--
-- Dördü de ayrı sayı: hangi süzgecin kırıldığı sonucun kendisinden
-- okunuyor. Tek bir "yanlış" değer olsaydı iki ayrı kusur aynı
-- görünürdü.
--
-- İZOLASYON: kendi sınıflarını kuruyor (9X, 9Y, 9Z, 10X).
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text;                 -- öğretmen
  j_ox1 text;              -- 9X öğrencisi (100 alan) — sorgulayan
  j_veli text;             -- aynı öğrencinin velisi
  bugun date := (now() at time zone 'Europe/Istanbul')::date;

  s_9x uuid; s_9y uuid; s_9z uuid; s_10x uuid;
  ox1 uuid; ox2 uuid; oy1 uuid; oz1 uuid; o10 uuid;
  d_9x uuid; d_9y uuid; d_9z uuid; d_10x uuid;
  d_gelecek uuid;          -- süresi dolmamış
  d_bos uuid;              -- hiç teslim yok
  d_tek uuid;              -- tek teslim

  c_baslik  text := 'Kıyas Denegi Ödevi';
  c_anahtar jsonb := '{"1":"A","2":"A","3":"B","4":"B"}'::jsonb;
  c_100 jsonb := '{"1":"A","2":"A","3":"B","4":"B"}'::jsonb;
  c_50  jsonb := '{"1":"A","2":"A","3":"C","4":"C"}'::jsonb;
  c_25  jsonb := '{"1":"A","2":"C","3":"C","4":"C"}'::jsonb;
  c_0   jsonb := '{"1":"C","2":"C","3":"C","4":"C"}'::jsonb;

  v jsonb;
begin
  -- ---------------------------------------------------------------------------
  -- Hazırlık
  -- ---------------------------------------------------------------------------
  update public.ogretmenler
     set pin_hash = extensions.crypt('Kiyas!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Kiyas!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (9, 'X')
    on conflict (seviye, sube) do update set arsiv = false returning id into s_9x;
  insert into public.siniflar (seviye, sube) values (9, 'Y')
    on conflict (seviye, sube) do update set arsiv = false returning id into s_9y;
  insert into public.siniflar (seviye, sube) values (9, 'Z')
    on conflict (seviye, sube) do update set arsiv = false returning id into s_9z;
  insert into public.siniflar (seviye, sube) values (10, 'X')
    on conflict (seviye, sube) do update set arsiv = false returning id into s_10x;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    select g.id, s.id from public.ogretmenler g, public.siniflar s
     where g.yonetici and s.id in (s_9x, s_9y, s_9z, s_10x)
    on conflict do nothing;

  ox1 := (public.ogrenci_ekle(jt, 'Kiyas X Bir', 'okul', s_9x))->>'id';
  ox2 := (public.ogrenci_ekle(jt, 'Kiyas X Iki', 'okul', s_9x))->>'id';
  oy1 := (public.ogrenci_ekle(jt, 'Kiyas Y Bir', 'okul', s_9y))->>'id';
  oz1 := (public.ogrenci_ekle(jt, 'Kiyas Z Bir', 'okul', s_9z))->>'id';
  o10 := (public.ogrenci_ekle(jt, 'Kiyas On Bir', 'okul', s_10x))->>'id';

  -- AYNI AD, AYNI GÜN, dört sınıf. `created_at` varsayılanı now(), yani
  -- dördü de bugün oluşuyor; 9Z'ninki aşağıda geriye çekilecek.
  d_9x  := (public.odev_olustur(jt, c_baslik, null, s_9x,  'test', bugun + 3, 4, c_anahtar,
             null, null, true, 4::smallint, null))->>'id';
  d_9y  := (public.odev_olustur(jt, c_baslik, null, s_9y,  'test', bugun + 3, 4, c_anahtar,
             null, null, true, 4::smallint, null))->>'id';
  d_9z  := (public.odev_olustur(jt, c_baslik, null, s_9z,  'test', bugun + 3, 4, c_anahtar,
             null, null, true, 4::smallint, null))->>'id';
  d_10x := (public.odev_olustur(jt, c_baslik, null, s_10x, 'test', bugun + 3, 4, c_anahtar,
             null, null, true, 4::smallint, null))->>'id';
  perform public.odev_yayinla(jt, d_9x);
  perform public.odev_yayinla(jt, d_9y);
  perform public.odev_yayinla(jt, d_9z);
  perform public.odev_yayinla(jt, d_10x);

  -- Gönderimler son tarih geriye çekilmeden ÖNCE (analiz_testleri deseni).
  perform public.odev_gonder(
    (public.giris((select kod from public.giris_kodlari where ogrenci_id = ox1 and rol='ogrenci')))->>'token',
    d_9x, 'cozum/' || d_9x::text || '/' || ox1::text || '.jpg', c_100);
  perform public.odev_gonder(
    (public.giris((select kod from public.giris_kodlari where ogrenci_id = ox2 and rol='ogrenci')))->>'token',
    d_9x, 'cozum/' || d_9x::text || '/' || ox2::text || '.jpg', c_50);
  perform public.odev_gonder(
    (public.giris((select kod from public.giris_kodlari where ogrenci_id = oy1 and rol='ogrenci')))->>'token',
    d_9y, 'cozum/' || d_9y::text || '/' || oy1::text || '.jpg', c_25);
  perform public.odev_gonder(
    (public.giris((select kod from public.giris_kodlari where ogrenci_id = oz1 and rol='ogrenci')))->>'token',
    d_9z, 'cozum/' || d_9z::text || '/' || oz1::text || '.jpg', c_100);
  perform public.odev_gonder(
    (public.giris((select kod from public.giris_kodlari where ogrenci_id = o10 and rol='ogrenci')))->>'token',
    d_10x, 'cozum/' || d_10x::text || '/' || o10::text || '.jpg', c_0);

  -- 9Z AYNI ADI taşıyor ama BAŞKA GÜN verilmiş: tarih süzgecinin ölçümü.
  update public.odevler set created_at = created_at - interval '3 days' where id = d_9z;

  update public.odevler set son_tarih = bugun - 1
   where id in (d_9x, d_9y, d_9z, d_10x);

  j_ox1  := (public.giris((select kod from public.giris_kodlari where ogrenci_id=ox1 and rol='ogrenci')))->>'token';
  j_veli := (public.giris((select kod from public.giris_kodlari where ogrenci_id=ox1 and rol='veli')))->>'token';

  -- ---------------------------------------------------------------------------
  -- 1 — SÜRE DOLMADAN ORTALAMA GELMİYOR
  --
  -- Öğretmenin kuralı: "ödev teslim süresi bittiğinde hesaplansın."
  -- Süre dolmadan göstermek, erken teslim edenin kendi puanıyla
  -- ortalamayı birebir görmesi demekti — üstelik o an ortalama tek
  -- kişiden oluşuyor olurdu.
  -- ---------------------------------------------------------------------------
  d_gelecek := (public.odev_olustur(jt, 'Kiyas Gelecek', null, s_9x, 'test', bugun + 5, 4,
                 c_anahtar, null, null, true, 4::smallint, null))->>'id';
  perform public.odev_yayinla(jt, d_gelecek);
  perform public.odev_gonder(j_ox1, d_gelecek,
    'cozum/' || d_gelecek::text || '/' || ox1::text || '.jpg', c_100);

  v := public.odev_kiyasi(j_ox1, d_gelecek);
  if v->>'durum' <> 'sure_dolmadi' then
    raise exception '1: süre dolmadan kıyas geldi: %', v::text;
  end if;
  if v ? 'sinif' then
    raise exception '1b: süre dolmadan sınıf ortalaması sızdı: %', v::text;
  end if;
  raise notice '1 OK — süre dolmadan ortalama gelmiyor';

  -- ---------------------------------------------------------------------------
  -- 2 — SÜRE DOLUNCA GELİYOR (pozitif kontrol)
  --
  -- 1. grubun ölü olmadığının kanıtı: aynı uç, süresi dolmuş ödevde
  -- gerçekten cevap veriyor.
  -- ---------------------------------------------------------------------------
  v := public.odev_kiyasi(j_ox1, d_9x);
  if v->>'durum' <> 'hazir' then
    raise exception '2: süre dolmuş ödevde kıyas gelmedi: %', v::text;
  end if;
  raise notice '2 OK — süre dolunca kıyas geliyor';

  -- ---------------------------------------------------------------------------
  -- 3 — TEK TESLİMDE DE GELİYOR — ALT SINIR YOK
  --
  -- Bu, öğretmenin AÇIK kararının ölçümü. Kendisine şu risk somut
  -- sayılarla bildirildi: iki kişi teslim ettiyse öğrenci kendi
  -- puanından arkadaşının notunu hesaplayabilir. Cevabı "alt sınıra
  -- gerek yok" oldu.
  --
  -- Bu test o kararın SESSİZCE geri alınmasını engelliyor. Biri bir gün
  -- "güvenli olsun" diye bir eşik eklerse burası kırmızı yanar ve karar
  -- yeniden öğretmene sorulur.
  -- ---------------------------------------------------------------------------
  d_tek := (public.odev_olustur(jt, 'Kiyas Tek Teslim', null, s_9x, 'test', bugun + 3, 4,
             c_anahtar, null, null, true, 4::smallint, null))->>'id';
  perform public.odev_yayinla(jt, d_tek);
  perform public.odev_gonder(j_ox1, d_tek,
    'cozum/' || d_tek::text || '/' || ox1::text || '.jpg', c_100);
  update public.odevler set son_tarih = bugun - 1 where id = d_tek;

  v := public.odev_kiyasi(j_ox1, d_tek);
  if v->>'durum' <> 'hazir' then
    raise exception '3: TEK teslimde kıyas gelmedi — sessiz bir alt sınır eklenmiş: %', v::text;
  end if;
  -- Adet artık gönderilmiyor (öğretmenin kararı); "tek teslim" olduğunu
  -- ortalamanın KENDİSİ kanıtlıyor: iki kişi olsaydı 100,0 çıkmazdı.
  if (v->'sinif'->>'ortalama')::numeric <> 100.0 then
    raise exception '3c: tek teslimde ortalama 100,0 olmalı, gelen %', v->'sinif'->>'ortalama';
  end if;
  raise notice '3 OK — tek teslimde de geliyor (alt sınır yok, öğretmenin kararı)';

  -- ---------------------------------------------------------------------------
  -- 4 — HİÇ TESLİM YOKSA ORTALAMA null, UÇ ÇÖKMÜYOR
  --
  -- Alt sınır değil, aritmetik: bölünecek bir şey yok. Ekranın boş
  -- kalması gerekiyor, hata vermesi değil.
  -- ---------------------------------------------------------------------------
  d_bos := (public.odev_olustur(jt, 'Kiyas Bos', null, s_9x, 'test', bugun + 3, 4,
             c_anahtar, null, null, true, 4::smallint, null))->>'id';
  perform public.odev_yayinla(jt, d_bos);
  update public.odevler set son_tarih = bugun - 1 where id = d_bos;

  v := public.odev_kiyasi(j_ox1, d_bos);
  if v->>'durum' <> 'hazir' then
    raise exception '4: teslimsiz ödevde durum % ', v->>'durum';
  end if;
  if v->'sinif'->>'ortalama' is not null then
    raise exception '4b: teslim yokken ortalama uydurulmuş: %', v::text;
  end if;
  raise notice '4 OK — teslim yokken ortalama null, uç çökmüyor';

  -- ---------------------------------------------------------------------------
  -- 5 — SINIF ORTALAMASI ELLE HESAPLANMIŞ DEĞERLE BİREBİR
  --
  -- (100 + 50) / 2 = 75,0. "Bir sayı geldi" değil, DOĞRU sayı.
  -- ---------------------------------------------------------------------------
  v := public.odev_kiyasi(j_ox1, d_9x);
  if (v->'sinif'->>'ortalama')::numeric <> 75.0 then
    raise exception '5: 9X ortalaması 75,0 olmalı, gelen %', v->'sinif'->>'ortalama';
  end if;
  if v->'sinif'->>'ad' <> '9X' then
    raise exception '5c: sınıf adı 9X olmalı, gelen %', v->'sinif'->>'ad';
  end if;
  raise notice '5 OK — sınıf ortalaması elle hesaplananla birebir (75,0)';

  -- ---------------------------------------------------------------------------
  -- 6 — SEVİYE: AYNI AD + AYNI GÜN + AYNI SEVİYE
  --
  -- (100 + 50 + 25) / 3 = 58,3. 9X ve 9Y; 9Z farklı gün, 10X farklı
  -- seviye — ikisi de dışarıda. Kendi sınıfı DÂHİL: "tüm 9'lar"
  -- ortalaması kendi şubesini dışarıda bırakırsa o sayı gerçek değil.
  -- ---------------------------------------------------------------------------
  if v->'seviye' = 'null'::jsonb or v->'seviye' is null then
    raise exception '6: kardeş şube varken seviye satırı gelmedi: %', v::text;
  end if;
  if (v->'seviye'->>'ortalama')::numeric <> 58.3 then
    raise exception '6b: seviye ortalaması 58,3 olmalı, gelen % (43,8 ise 10''lar, 68,8 ise farklı gün karıştı)',
      v->'seviye'->>'ortalama';
  end if;
  raise notice '6 OK — seviye ortalaması ad + gün + seviye ile doğru (58,3)';

  -- ---------------------------------------------------------------------------
  -- 7 — AYNI AD, FARKLI GÜN → KARDEŞ DEĞİL
  --
  -- 9Z aynı başlığı taşıyor ve 100 puanlı bir teslimi var. Tarih koşulu
  -- kaldırılsaydı seviye ortalaması 68,8 olurdu. 6. grup zaten 58,3
  -- bekliyor; bu grup aynı şeyi TERS yönden, 9Z'nin kendi sorgusuyla
  -- ölçüyor: 9Z'li öğrenci sorduğunda 9X/9Y karışmamalı.
  -- ---------------------------------------------------------------------------
  declare
    j_oz1 text := (public.giris((select kod from public.giris_kodlari
                                  where ogrenci_id = oz1 and rol='ogrenci')))->>'token';
    vz jsonb;
  begin
    vz := public.odev_kiyasi(j_oz1, d_9z);
    if vz->'seviye' <> 'null'::jsonb and vz->'seviye' is not null then
      raise exception '7: farklı gün verilen ödev kardeş sayıldı: %', vz::text;
    end if;
    if (vz->'sinif'->>'ortalama')::numeric <> 100.0 then
      raise exception '7b: 9Z kendi ortalaması 100,0 olmalı, gelen %', vz->'sinif'->>'ortalama';
    end if;
  end;
  raise notice '7 OK — aynı ad farklı gün kardeş sayılmıyor';

  -- ---------------------------------------------------------------------------
  -- 8 — FARKLI SEVİYE KARIŞMIYOR
  --
  -- 10X aynı adı ve AYNI GÜNÜ taşıyor, teslimi 0 puanlı. Seviye süzgeci
  -- kalkarsa 9'ların ortalaması 43,8'e düşer. 6b bunu sayıyla yakalar;
  -- burada 10. sınıf öğrencisinin kendi sorgusu ölçülüyor: ona da
  -- 9'lar karışmamalı.
  -- ---------------------------------------------------------------------------
  declare
    j_o10 text := (public.giris((select kod from public.giris_kodlari
                                  where ogrenci_id = o10 and rol='ogrenci')))->>'token';
    v10 jsonb;
  begin
    v10 := public.odev_kiyasi(j_o10, d_10x);
    if v10->'seviye' <> 'null'::jsonb and v10->'seviye' is not null then
      raise exception '8: 10. sınıfa 9''lar kardeş sayıldı: %', v10::text;
    end if;
    if (v10->'sinif'->>'ortalama')::numeric <> 0.0 then
      raise exception '8b: 10X ortalaması 0,0 olmalı, gelen %', v10->'sinif'->>'ortalama';
    end if;
  end;
  raise notice '8 OK — farklı seviye karışmıyor';

  -- ---------------------------------------------------------------------------
  -- 9 — KARDEŞ YOKSA seviye null
  --
  -- Öğretmenin kuralı: "diğer şubelere verilmemişse sadece ödevin
  -- verildiği sınıf ortalaması alınsın." `d_tek` yalnız 9X'e verildi.
  -- ---------------------------------------------------------------------------
  v := public.odev_kiyasi(j_ox1, d_tek);
  if v->'seviye' <> 'null'::jsonb and v->'seviye' is not null then
    raise exception '9: tek sınıfa verilen ödevde seviye satırı çıktı: %', v::text;
  end if;
  raise notice '9 OK — kardeş yoksa seviye satırı yok';

  -- ---------------------------------------------------------------------------
  -- 10 — ogretmen_puan VARSA ORTALAMAYA O GİRİYOR
  --
  -- Ekran öğrenciye `coalesce(ogretmen_puan, puan)` gösteriyor. Ortalama
  -- ham `puan`'ı kullansaydı öğrenci kendi puanıyla ortalamayı
  -- karşılaştırıp tutarsız bir tablo görürdü.
  --
  -- ox2'nin 50'si öğretmen eliyle 90'a çekiliyor → (100 + 90) / 2 = 95,0.
  -- Ham puanla kalsaydı 75,0 olurdu (5. grubun değeri) — yani bu ölçüm
  -- kusuru DEĞERDEN ayırt edebiliyor.
  -- ---------------------------------------------------------------------------
  update public.gonderimler set ogretmen_puan = 90
   where odev_id = d_9x and ogrenci_id = ox2;

  v := public.odev_kiyasi(j_ox1, d_9x);
  if (v->'sinif'->>'ortalama')::numeric <> 95.0 then
    raise exception '10: ogretmen_puan ortalamaya girmedi; 95,0 beklenirken %',
      v->'sinif'->>'ortalama';
  end if;
  update public.gonderimler set ogretmen_puan = null
   where odev_id = d_9x and ogrenci_id = ox2;
  raise notice '10 OK — ogretmen_puan ortalamaya giriyor';

  -- ---------------------------------------------------------------------------
  -- 11 — BAŞKA SINIFIN ÖDEV KİMLİĞİ REDDEDİLİYOR
  --
  -- Uç bir ödev kimliği alıyor; o kimliği elle değiştiren bir öğrenci
  -- başka sınıfın ortalamasını okuyabilmemeli. `odev_gonder`'deki
  -- denetimin aynısı.
  -- ---------------------------------------------------------------------------
  begin
    perform public.odev_kiyasi(j_ox1, d_10x);
    raise exception '11: 9X öğrencisi 10X ödevinin kıyasını okuyabildi';
  exception when insufficient_privilege then null;
  end;
  raise notice '11 OK — başka sınıfın ödev kimliği reddediliyor';

  -- ---------------------------------------------------------------------------
  -- 12 — ÖĞRETMEN JETONU REDDEDİLİYOR
  --
  -- Muafiyetin "öğretmen ucu öğrenciye açıldı" demek OLMADIĞININ ölçümü
  -- (güvenlik denetimindeki notun karşılığı). Öğretmenin kendi analiz
  -- ekranları ayrı.
  -- ---------------------------------------------------------------------------
  begin
    perform public.odev_kiyasi(jt, d_9x);
    raise exception '12: öğretmen jetonu kabul edildi';
  exception when insufficient_privilege then null;
  end;
  raise notice '12 OK — öğretmen jetonu reddediliyor';

  -- ---------------------------------------------------------------------------
  -- 13 — ONAM KAPISI: ONAMSIZ VELİ REDDEDİLİYOR, ONAMLI VELİ GÖREBİLİYOR
  --
  -- 0034'ün değişmezi: onam verilmeden hiçbir veli ucu çalışmaz. Bu uç
  -- da istisna değil. İki yanı birden ölçülüyor — yalnız reddi ölçmek,
  -- onamdan sonra da reddeden bir kusuru görmezdi.
  -- ---------------------------------------------------------------------------
  begin
    perform public.odev_kiyasi(j_veli, d_9x);
    raise exception '13: ONAMSIZ veli kıyası okuyabildi';
  exception when insufficient_privilege then null;
  end;

  perform public.onam_ver(j_veli, public._gecerli_onam_surumu(), 'Kıyas Velisi');
  v := public.odev_kiyasi(j_veli, d_9x);
  if v->>'durum' <> 'hazir' then
    raise exception '13b: ONAMLI veli kıyası göremedi: %', v::text;
  end if;
  if (v->'sinif'->>'ortalama')::numeric <> 75.0 then
    raise exception '13c: veliye giden ortalama öğrencininkiyle aynı olmalı, gelen %',
      v->'sinif'->>'ortalama';
  end if;
  raise notice '13 OK — onamsız veli reddediliyor, onamlı veli aynı sayıyı görüyor';

  -- ---------------------------------------------------------------------------
  -- 14 — VELİNİN GERÇEKTEN KULLANDIĞI YOL: `veli_paneli`
  --
  -- 13. grup `odev_kiyasi`'yi veli jetonuyla çağırıyor — ama VELİ EKRANI
  -- o ucu HİÇ ÇAĞIRMIYOR. `VeliOdevi`'de ödev kimliği yok; veli kıyası
  -- `veli_paneli` satırının içine gömülü `kiyas` alanından alıyor.
  --
  -- Yani 13. grup tek başına ölü bir güvence olurdu: velinin ekranında
  -- yanlış bir sayı dursa bile yeşil kalırdı. Bu grup GERÇEK yolu
  -- ölçüyor ve iki yolun AYNI sayıyı verdiğini sınıyor — hesabın tek
  -- yerde (`_odev_kiyasi`) durmasının karşılığı budur.
  -- ---------------------------------------------------------------------------
  declare
    vp jsonb;
    satir jsonb;
    ogrenci_ort numeric := (public.odev_kiyasi(j_ox1, d_9x)->'sinif'->>'ortalama')::numeric;
  begin
    vp := public.veli_paneli(j_veli);

    select o into satir
      from jsonb_array_elements(vp->'odevler') o
     where o->>'baslik' = c_baslik
     limit 1;

    if satir is null then
      raise exception '14: veli panelinde kıyas ödevi bulunamadı';
    end if;
    if satir->'kiyas' is null or satir->'kiyas' = 'null'::jsonb then
      raise exception '14b: veli satırında kiyas alanı yok: %', satir::text;
    end if;
    if satir->'kiyas'->>'durum' <> 'hazir' then
      raise exception '14c: veli satırındaki kıyas hazır değil: %', satir->'kiyas'::text;
    end if;
    if (satir->'kiyas'->'sinif'->>'ortalama')::numeric <> ogrenci_ort then
      raise exception '14d: VELİYE ve ÖĞRENCİYE farklı ortalama gitti — % / %',
        satir->'kiyas'->'sinif'->>'ortalama', ogrenci_ort;
    end if;
    if (satir->'kiyas'->'seviye'->>'ortalama')::numeric <> 58.3 then
      raise exception '14e: veli satırında seviye ortalaması 58,3 olmalı, gelen %',
        satir->'kiyas'->'seviye'->>'ortalama';
    end if;
    -- Teslim sayısı VELİYE de gitmiyor.
    if satir->'kiyas'->'sinif' ? 'adet' or satir->'kiyas'->'seviye' ? 'adet' then
      raise exception '14g: veli satırında teslim sayısı var: %', satir->'kiyas'::text;
    end if;

    -- SÜRESİ DOLMAMIŞ ödev velinin panelinde de ortalama taşımamalı.
    select o into satir
      from jsonb_array_elements(vp->'odevler') o
     where o->>'baslik' = 'Kiyas Gelecek'
     limit 1;
    if satir is not null and satir->'kiyas'->>'durum' <> 'sure_dolmadi' then
      raise exception '14f: veli paneli süresi dolmamış ödevde ortalama taşıdı: %',
        satir->'kiyas'::text;
    end if;
  end;
  raise notice '14 OK — velinin GERÇEK yolu (veli_paneli) öğrenciyle aynı sayıyı veriyor';

  -- ---------------------------------------------------------------------------
  -- 15 — TESLİM SAYISI YANITTA HİÇ YOK
  --
  -- Öğretmenin kararı: "Teslim sayısı veliye ya da öğrenciye
  -- gösterilmesin." Ekrandan kaldırmak YETMEZ — bu depo gizlemeyi
  -- arayüzde yapmıyor (Part XXI). Sayı yanıtta dursaydı tarayıcının
  -- geliştirici araçlarını açan herkes okurdu.
  --
  -- Ölçüm alanın VARLIĞINA bakıyor (`?`), değerine değil: 0 ya da null
  -- göndermek de "göndermemek" sayılmaz.
  -- ---------------------------------------------------------------------------
  v := public.odev_kiyasi(j_ox1, d_9x);
  if v->'sinif' ? 'adet' then
    raise exception '15: sınıf teslim sayısı yanıtta: %', v::text;
  end if;
  if v->'seviye' ? 'adet' then
    raise exception '15b: seviye teslim sayısı yanıtta: %', v::text;
  end if;
  if v->'seviye' ? 'sube' then
    raise exception '15c: şube sayısı yanıtta: %', v::text;
  end if;
  -- POZİTİF KONTROL: ortalama HÂLÂ geliyor. Yukarıdaki üç iddia, uç
  -- boş bir nesne döndürse de yeşil kalırdı.
  if (v->'sinif'->>'ortalama')::numeric <> 75.0 then
    raise exception '15d: sayı kalkarken ortalama da kaybolmuş: %', v::text;
  end if;
  raise notice '15 OK — teslim sayısı yanıtta hiç yok, ortalama duruyor';

  raise notice '';
  raise notice 'ÖDEV KIYASI TESTLERİ: 15 GRUP GEÇTİ';
end $$;
