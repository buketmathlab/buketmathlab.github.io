-- =============================================================================
-- ÖĞRETMEN KAPSAMI TESTLERİ (0033)
--
-- Bu dosyanın işi "çalışıyor mu" değil, **SIZDIRIYOR MU**.
--
-- Dört öğretmenli bir sistemde asıl soru şu: A öğretmeni, B öğretmeninin
-- öğrencisini, notunu, veli yazışmasını ya da sahibin ÖZEL DERS ÖDEMESİNİ
-- herhangi bir uçtan görebiliyor mu? Bir tek uç unutulsa, bir meslektaşın
-- verisi ötekine açılır — ve bu, projenin sonu olurdu.
--
-- YÖNTEM: alan adına değil GERÇEK DEĞERE bakıyoruz. `'tutar' in yanit`
-- demek yetmez; B'nin gerçek tutarını, gerçek öğrenci adını, gerçek mesaj
-- metnini metinde arıyoruz (0021/0026 deseni). Ve denetimin kendisinin
-- çalıştığını, AYNI değerin sahibinin kendi yanıtında BULUNDUĞUNU
-- göstererek kanıtlıyoruz.
--
-- İZOLASYON: testler tek veritabanını paylaşıyor. Kendi sınıflarımızı
-- (5A/5B/5C) ve kendi öğretmenlerimizi kuruyoruz; toplam sayılara değil
-- kendi kayıtlarımıza bakıyoruz.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  -- kimlikler
  s_id   uuid;   -- SAHİP (Buket)
  a_id   uuid;   -- öğretmen A
  b_id   uuid;   -- öğretmen B
  -- jetonlar
  js text; ja text; jb text;
  s_kimliksiz text;   -- `s`'in UUID'leri çıkarılmış hâli (1e)
  -- sınıflar
  sa uuid; sb uuid; ss uuid;
  -- öğrenciler
  oa uuid; ob uuid; oz uuid;       -- A'nın, B'nin, sahibin özel ders öğrencisi
  -- ödevler
  da uuid; db uuid;
  -- gönderimler
  ga uuid; gb uuid;
  -- ödeme
  od uuid;
  v jsonb; n integer; s text; kod text;
  v_kod text;
begin
  -- ---------------------------------------------------------------------------
  -- HAZIRLIK
  -- ---------------------------------------------------------------------------
  update public.ogretmenler set pin_hash =
    extensions.crypt('Sahip!2026', extensions.gen_salt('bf', 10)) where yonetici;
  js := (public.giris('Sahip!2026'))->>'token';
  select id into s_id from public.ogretmenler where yonetici;

  a_id := (public.ogretmen_ekle(js, 'Ahmet Kapsam', 'AKapsam!2026'))->>'id';
  b_id := (public.ogretmen_ekle(js, 'Berna Kapsam', 'BKapsam!2026'))->>'id';
  ja := (public.giris('AKapsam!2026'))->>'token';
  jb := (public.giris('BKapsam!2026'))->>'token';
  if ja is null or jb is null then
    raise exception '0: yeni öğretmenler kendi PIN''leriyle giremedi';
  end if;

  sa := (public.sinif_ekle(js, 5::smallint, 'A'))->>'id';
  sb := (public.sinif_ekle(js, 5::smallint, 'B'))->>'id';
  ss := (public.sinif_ekle(js, 5::smallint, 'C'))->>'id';

  -- Sınıfları paylaştır. Sahip yalnız KENDİ sınıfını (5C) tutuyor;
  -- `sinif_ekle` oluşturana otomatik bağladığı için burada geri alıyoruz.
  perform public.ogretmen_sinif_ata(js, a_id, jsonb_build_array(sa::text));
  perform public.ogretmen_sinif_ata(js, b_id, jsonb_build_array(sb::text));
  perform public.ogretmen_sinif_ata(js, s_id, jsonb_build_array(ss::text));

  -- Öğrenciler okul düzeyinde: hepsini SAHİP ekliyor.
  oa := (public.ogrenci_ekle(js, 'Ayla Kapsam', 'okul', sa))->>'id';
  ob := (public.ogrenci_ekle(js, 'Baran Kapsam', 'okul', sb))->>'id';
  oz := (public.ogrenci_ekle(js, 'Zeynep Ozelders', 'ozel', null))->>'id';

  -- Her öğretmen kendi sınıfına ödev veriyor.
  da := (public.odev_olustur(ja, 'A Ödevi Kapsam', null, sa, 'test',
          current_date + 7, 2, '{"1":"A","2":"B"}'::jsonb))->>'id';
  db := (public.odev_olustur(jb, 'B Ödevi Kapsam', null, sb, 'test',
          current_date + 7, 2, '{"1":"C","2":"D"}'::jsonb))->>'id';
  perform public.odev_yayinla(ja, da);
  perform public.odev_yayinla(jb, db);

  -- Gönderimler
  kod := (select k.kod from public.giris_kodlari k where k.ogrenci_id = oa and k.rol = 'ogrenci');
  perform public.odev_gonder((public.giris(kod))->>'token', da,
            'cozum/' || da::text || '/' || oa::text || '.jpg', '{"1":"A","2":"B"}'::jsonb);
  kod := (select k.kod from public.giris_kodlari k where k.ogrenci_id = ob and k.rol = 'ogrenci');
  perform public.odev_gonder((public.giris(kod))->>'token', db,
            'cozum/' || db::text || '/' || ob::text || '.jpg', '{"1":"C","2":"D"}'::jsonb);
  select id into ga from public.gonderimler where odev_id = da;
  select id into gb from public.gonderimler where odev_id = db;

  -- Veli mesajları (her öğretmene kendi velisinden)
  kod := (select k.kod from public.giris_kodlari k where k.ogrenci_id = ob and k.rol = 'veli');
  -- ONAM (0034): veli, metni onaylamadan mesaj da yazamıyor.
  perform public.onam_ver((public.giris(kod))->>'token',
                          public._gecerli_onam_surumu(), 'Test Velisi');
  perform public.mesaj_gonder((public.giris(kod))->>'token',
            'BERNANIN GIZLI VELI MESAJI 4242');

  -- Sahibin özel ders ödemesi
  od := (public.odeme_ekle(js, oz, 7777.77, current_date))->>'id';

  raise notice '--- Hazırlık: sahip + 2 öğretmen + 3 sınıf + 3 öğrenci kuruldu ---';

  -- ---------------------------------------------------------------------------
  -- 1 — LİSTELERDE ÇAPRAZ YOK
  --
  -- A'nın gördüğü hiçbir listede B'nin ya da sahibin verisi geçmemeli.
  -- Alan adına değil GERÇEK DEĞERE bakıyoruz.
  -- ---------------------------------------------------------------------------
  -- SAYFA BOYUTU BÜYÜK: `ogrenciler_listesi` varsayılan 25 kayıt döndürüyor
  -- ve testler tek veritabanını paylaşıyor. Geri alma kanıtı bunu yakaladı —
  -- süzgeci kaldırdığımda bile test geçiyordu, çünkü B'nin öğrencisi ikinci
  -- sayfaya düşüyordu. Kör bir ölçümdü; 100 kayıtla kapatıldı.
  s := public.siniflar_listesi(ja)::text
    || public.ogrenciler_listesi(ja, null, null, 1, 100)::text
    || public.odevler_listesi(ja)::text
    || public.ogretmen_panosu(ja)::text
    || public.veliler_listesi(ja)::text
    || public.ogrenci_yazismalari(ja)::text
    || public.bildirim_sayilari(ja)::text
    || public.konu_onerileri(ja)::text;

  if position('Baran Kapsam' in s) > 0 then
    raise exception '1a: A, B''nin öğrencisini görüyor';
  end if;

  -- ARAMAYLA DOĞRUDAN SONDA. Yukarıdaki dize sayfalamaya takılıyordu:
  -- testler tek veritabanını paylaşıyor ve sayfa boyutunun tavanı 100.
  -- Geri alma kanıtı bunu yakaladı — süzgeci kaldırdığımda bile test
  -- geçiyordu. Adı arayarak sorduğumuzda sayfalama devre dışı kalıyor.
  if position('Baran Kapsam'
              in public.ogrenciler_listesi(ja, 'Baran Kapsam', null, 1, 100)::text) > 0 then
    raise exception '1a2: A, aramayla B''nin öğrencisini buluyor';
  end if;
  if position('Baran Kapsam'
              in public.ogrenciler_listesi(jb, 'Baran Kapsam', null, 1, 100)::text) = 0 then
    raise exception '1a3: denetim kör — B kendi öğrencisini aramayla da bulamıyor';
  end if;

  -- `toplam` ALANI DA ÖLÇÜLÜYOR — geri alma kanıtının üçüncü bulgusu.
  -- `ogrenciler_listesi` iki ayrı sorgu çalıştırıyor: biri satırlar, biri
  -- sayaç. Süzgeci yalnız sayaçtan kaldırdığımda satırlar hâlâ doğru
  -- geliyordu ve test geçiyordu — yani sayaç ölçülmüyordu. Bir sayı da
  -- bilgidir: A, okulun kaç öğrencisi olduğunu kendi listesinden
  -- öğrenmemeli. A'nın tek öğrencisi var.
  n := (public.ogrenciler_listesi(ja, null, null, 1, 100)->>'toplam')::int;
  if n <> 1 then
    raise exception '1a4: A''nın öğrenci listesi toplamı 1 değil, %', n;
  end if;
  if position('B Ödevi Kapsam' in s) > 0 then
    raise exception '1b: A, B''nin ödevini görüyor';
  end if;
  if position('Zeynep Ozelders' in s) > 0 then
    raise exception '1c: A, sahibin özel ders öğrencisini görüyor';
  end if;
  if position('BERNANIN GIZLI VELI MESAJI 4242' in s) > 0 then
    raise exception '1d: A, B''nin veli mesajını görüyor';
  end if;
  -- KİMLİKLER ÇIKARILARAK ARANIYOR — ölçülmüş bir KARARSIZLIK düzeltmesi.
  --
  -- Burası önce ham `s` içinde '7777' arıyordu. `s` onlarca UUID taşıyor
  -- ve UUID onaltılık: içinde '7777' geçmesi mümkün. Ölçüldü —
  -- 10.000 rastgele UUID'nin 2'si bu diziyi içeriyor. Yani test, kodda
  -- hiçbir şey bozulmadan, üretilen kimliklerin şansına göre kırmızı
  -- yanabiliyordu; bir kez de öyle yandı.
  --
  -- Çözüm iddiayı ZAYIFLATMIYOR: UUID biçimindeki diziler metinden
  -- siliniyor, arama yine hem '7777.77' hem de yalın '7777' için
  -- yapılıyor. Tutar biçimi değişse bile (7777, 7777.7700) yakalanır;
  -- yalnız kimliklerle çakışma ihtimali kalkıyor.
  s_kimliksiz := regexp_replace(
    s, '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}',
    '', 'g');
  if position('7777.77' in s_kimliksiz) > 0 or position('7777' in s_kimliksiz) > 0 then
    raise exception '1e: A, sahibin ödeme tutarını görüyor';
  end if;

  -- SINIF LİSTESİ ayrıca ölçülüyor. Yukarıdaki dizede sınıf ADI aranmıyordu;
  -- geri alma kanıtı sınıf süzgecini kaldırdığında test geçiyordu.
  if position('"5B"' in public.siniflar_listesi(ja)::text) > 0
     or position('"5C"' in public.siniflar_listesi(ja)::text) > 0 then
    raise exception '1e2: A, başkasının sınıfını görüyor';
  end if;
  if position('"5A"' in public.siniflar_listesi(ja)::text) = 0 then
    raise exception '1e3: denetim kör — A kendi sınıfını da görmüyor';
  end if;

  -- VELİ LİSTESİ ayrıca ölçülüyor — ve BURASI İKİ KEZ DÜZELTİLDİ.
  --
  -- Önce mesaj metnini aradım: `veliler_listesi` metin taşımıyor, ölçüm
  -- kördü. Sonra öğrenci adını aradım: ad yalnız `yanit_bekleyen`de geçiyor
  -- ve oraya girmek için okunmamış mesaj gerekiyor — mesaj süzgeci ayrı
  -- olduğu için öğrenci süzgeci kaldırılsa bile ad görünmüyordu. Yine kördü.
  --
  -- Öğrenci süzgecinin GÖZLENEBİLİR tek etkisi `gruplar`da: süzgeç kalkarsa
  -- A, B'nin SINIFINI kendi veli listesinde görür. Ölçüm oraya taşındı.
  if position('"5B"' in public.veliler_listesi(ja)::text) > 0
     or position('"5C"' in public.veliler_listesi(ja)::text) > 0 then
    raise exception '1e4: A, başkasının sınıfını veli listesinde görüyor';
  end if;
  if position('"5B"' in public.veliler_listesi(jb)::text) = 0 then
    raise exception '1e5: denetim kör — B kendi sınıfını da görmüyor';
  end if;
  if position('BERNANIN GIZLI VELI MESAJI 4242'
              in public.mesajlar_ogretmen(jb, ob, 'veli')::text) = 0 then
    raise exception '1e5b: denetim kör — B kendi veli mesajını da okuyamıyor';
  end if;

  -- PANO SAYISI ayrıca ölçülüyor. Sayı bir dize değil; metinde aramak onu
  -- hiç ölçmüyordu. A'nın tek öğrencisi var (Ayla).
  n := (public.ogretmen_panosu(ja)->>'ogrenci_sayisi')::int;
  if n <> 1 then
    raise exception '1e6: A''nın pano öğrenci sayısı 1 değil, %', n;
  end if;

  -- DENETİMİN KENDİSİ ÇALIŞIYOR MU: aynı değerler SAHİBİNİN yanıtında var mı
  if position('Baran Kapsam' in public.ogrenciler_listesi(jb)::text) = 0 then
    raise exception '1f: denetim kör — B kendi öğrencisini de görmüyor';
  end if;
  if position('B Ödevi Kapsam' in public.odevler_listesi(jb)::text) = 0 then
    raise exception '1g: denetim kör — B kendi ödevini de görmüyor';
  end if;
  if position('7777.77' in public.ozel_ders_detay(js, oz)::text) = 0 then
    raise exception '1h: denetim kör — sahip kendi ödemesini de görmüyor';
  end if;

  raise notice '1 OK — listelerde çapraz yok, denetimin kendisi ısırıyor';

  -- ---------------------------------------------------------------------------
  -- 2 — KİMLİKLE ÇAPRAZ YOK
  --
  -- Bu yarısı daha tehlikeli: A, B'nin ödev kimliğini listede görmese bile
  -- eline geçirip doğrudan çağırabilir. Her uç ayrı ayrı deneniyor ve
  -- yazma denemelerinden sonra SATIRIN DEĞİŞMEDİĞİ ayrıca ölçülüyor.
  -- ---------------------------------------------------------------------------
  begin
    perform public.odev_detay(ja, db);
    raise exception '2a: A, B''nin ödev detayını okuyabildi';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.odev_gonderimleri(ja, db);
    raise exception '2b: A, B''nin gönderimlerini okuyabildi';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.odev_dosya_yolu(ja, db, 'anahtar');
    raise exception '2c: A, B''nin cevap anahtarı dosyasına ulaştı';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.ogrenci_kodlari(ja, ob);
    raise exception '2d: A, B''nin öğrencisinin GİRİŞ KODUNU aldı';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.mesajlar_ogretmen(ja, ob, 'veli');
    raise exception '2e: A, B''nin veli yazışmasını okudu';
  exception when insufficient_privilege then null;
  end;

  -- YAZMA denemeleri: reddedilmeli VE satır değişmemeli
  select count(*) into n from public.odevler where id = db and baslik = 'B Ödevi Kapsam';
  begin
    perform public.odev_guncelle(ja, db, 'CALINDI', null, sa, current_date + 7, 2,
              '{"1":"A","2":"A"}'::jsonb);
    raise exception '2f: A, B''nin ödevini değiştirebildi';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from public.odevler where id = db and baslik = 'B Ödevi Kapsam') <> n then
    raise exception '2g: red edilen çağrı yine de satırı değiştirdi';
  end if;

  begin
    perform public.odev_sil(ja, db);
    raise exception '2h: A, B''nin ödevini sildi';
  exception when insufficient_privilege then null;
  end;
  if not exists (select 1 from public.odevler where id = db) then
    raise exception '2i: red edilen silme yine de satırı sildi';
  end if;

  begin
    perform public.acik_puanla(ja, gb, 100);
    raise exception '2j: A, B''nin öğrencisine not verdi';
  exception when others then
    get stacked diagnostics v_kod = returned_sqlstate;
    if v_kod = 'P0001' then raise; end if;
  end;
  if exists (select 1 from public.gonderimler where id = gb and ogretmen_puan is not null) then
    raise exception '2k: red edilen puanlama yine de notu değiştirdi';
  end if;

  begin
    perform public.gonderim_foto_yolu(ja, gb);
    raise exception '2l: A, B''nin öğrencisinin çözüm fotoğrafına ulaştı';
  exception when others then
    get stacked diagnostics v_kod = returned_sqlstate;
    if v_kod = 'P0001' then raise; end if;
  end;

  raise notice '2 OK — kimlikle çapraz erişim yok, red sonrası satır değişmiyor';

  -- ---------------------------------------------------------------------------
  -- 3 — ÖZEL DERS TAMAMEN SAHİPTE
  --
  -- Öğretmenin açık kuralı: "özel ders sınıfı ve özel ders öğrencisinin
  -- veli özellikleri sadece bende olmalı. Diğer öğretmenlerde asla
  -- olmamalı." Yedi ucun yedisi de deneniyor.
  -- ---------------------------------------------------------------------------
  begin
    perform public.ozel_ders_detay(ja, oz);
    raise exception '3a: A, sahibin özel ders öğrencisinin detayını gördü';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.ders_ekle(ja, oz, now());
    raise exception '3b: A, ders ekleyebildi';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.odeme_ekle(ja, oz, 100, current_date);
    raise exception '3c: A, ödeme ekleyebildi';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.odeme_degistir(ja, od);
    raise exception '3d: A, ödeme durumunu değiştirebildi';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.odeme_sil(ja, od);
    raise exception '3e: A, ödeme silebildi';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.ogrenci_ekle(ja, 'Kacak Ozel', 'ozel', null);
    raise exception '3f: A, kendine özel ders öğrencisi ekleyebildi';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.ogretmen_sinif_ata(js, a_id,
      jsonb_build_array((select id::text from public.siniflar where ozel)));
    raise exception '3g: özel ders grubu başka öğretmene atanabildi';
  exception when insufficient_privilege then null;
  end;

  if exists (select 1 from public.odemeler where id = od and odendi) then
    raise exception '3h: reddedilen çağrı ödeme durumunu değiştirdi';
  end if;
  if not exists (select 1 from public.odemeler where id = od) then
    raise exception '3i: reddedilen çağrı ödemeyi sildi';
  end if;

  raise notice '3 OK — özel ders yedi uçta da yalnız sahipte, tutar sızmıyor';

  -- ---------------------------------------------------------------------------
  -- 4 — YÖNETİM UÇLARI YALNIZ SAHİPTE
  -- ---------------------------------------------------------------------------
  begin
    perform public.ogretmenler_listesi(ja);
    raise exception '4a: A, öğretmen listesini gördü';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.ogretmen_ekle(ja, 'Sahte', 'Sahte!2026');
    raise exception '4b: A, öğretmen ekleyebildi';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.ogretmen_olarak_gir(ja, b_id);
    raise exception '4c: A, B''nin hesabına girebildi';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.disa_aktar(ja);
    raise exception '4d: A, bütün sistemin yedeğini indirebildi';
  exception when insufficient_privilege then null;
  end;

  -- 0039: OKUL YÖNETİMİ BİLGİLENDİRMESİ DE SAHİPTE.
  --
  -- Bu uç bütün okulun sayılarını (öğretmen, sınıf, öğrenci, onam)
  -- veriyor. Bir öğretmene açık olsaydı 0033'ün kapsam kuralı sessizce
  -- delinmiş olurdu: kendi sınıfını göremediği öğrencilerin sayısını
  -- öğrenirdi.
  begin
    perform public.okul_bilgilendirme(ja);
    raise exception '4f: A, okul bilgilendirmesini alabildi';
  exception when insufficient_privilege then null;
  end;

  -- POZİTİF KONTROL: sahip GERÇEKTEN alabiliyor. Bu olmadan yukarıdaki
  -- ölçüm, uç hiç çalışmıyor olsa da yeşil kalırdı.
  declare
    ob jsonb := public.okul_bilgilendirme(js);
  begin
    if (ob->>'ogretmen_sayisi')::int < 1
       or (ob->>'ogrenci_sayisi')::int < 1
       or (ob->>'alan') is null then
      raise exception '4g: sahip aldı ama belge boş: %', ob::text;
    end if;
    -- KİŞİSEL VERİ SIZMIYOR: belge okul yönetimine gidiyor, öğrenci
    -- listesi değil. Tek bir öğrenci adı bile içinde olmamalı.
    if ob::text like '%Bernanın%' or ob::text like '%Kacak%' then
      raise exception '4h: okul belgesine öğrenci adı sızdı: %', ob::text;
    end if;
  end;

  begin
    perform public.ogrenci_ekle(ja, 'Kacak Okul', 'okul', sa);
    raise exception '4e: A, okul öğrencisi ekleyebildi';
  exception when insufficient_privilege then null;
  end;

  raise notice '4 OK — yönetim, yedek ve öğrenci ekleme yalnız sahipte';

  raise notice '';
  raise notice 'ÖĞRETMEN KAPSAMI TESTLERİ: 4 GRUP GEÇTİ';
end $$;
