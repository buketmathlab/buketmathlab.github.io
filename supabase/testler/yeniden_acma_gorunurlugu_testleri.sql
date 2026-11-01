-- =============================================================================
-- SEKİZ — YENİDEN AÇMANIN GEÇMİŞİ ÜÇ EKRANDA GÖRÜNÜYOR (0090)
--
-- Gerçek olay: öğretmen "1. Tema Tekrarı"nda bir soruyu düzeltti ve altı
-- öğrencinin gönderimini aynı anda yeniden açtı. Önceki puanları 62.50 ile
-- 100.00 arasındaydı. Yeniden açma gönderim satırını SİLİYOR (0081), yani
-- o altı öğrenci hem kendi ekranında hem öğretmenin listesinde hem de
-- velisinin ekranında "göndermedi" oldu. Öğretmen velilere ödevin
-- yapılmadığını söyleyecekti; öğrenci ödevi yapmıştı ve puanı
-- hesaplanmıştı. İKİSİ DE HAKLIYDI.
--
-- 0090 yeni veri üretmiyor: bilgi `denetim_izi`de duruyordu, ekrana
-- taşınıyor.
--
-- Ölçülen:
--   1. HİÇ AÇILMAMIŞ gönderimde üç uçta da `yeniden_acma` null
--   2. Açıldıktan sonra ÜÇ UÇ da dolduruyor; `onceki_puan` SİLİNEN puanı
--      veriyor
--   3. Açık uçlu ödevde `onceki_puan` = `ogretmen_puan`
--      (`coalesce` kuralı `veli_paneli`inkiyle birebir aynı)
--   4. İKİ KEZ açılmışsa EN SON açılma dönüyor (ilki değil)
--   5. Öğrenci yeniden gönderdikten sonra alan HÂLÂ dolu; ama `gonderdi`
--      artık true — ekran iki durumu ayırabiliyor
--   6. VELİ SEBEBİ GÖRMÜYOR: `neden` ve `onceki_durum` veliye gitmiyor,
--      öğretmene ve öğrenciye gidiyor
--   7. Yardımcı istemciye KAPALI (anon çağıramıyor)
--   8. BAŞKA ÖĞRENCİNİN açması bu öğrencinin satırına sızmıyor
--   9. Üç ucun ESKİ alanları bozulmadı (0088'in dersi)
--  10. Zincirin sonu 0090
--
-- NEDEN DENETİM İZİNİN ZAMANI ELLE GERİYE ALINIYOR
--
-- `now()` bir işlem boyunca DONUK. Tek işlemde iki kez yeniden açılınca
-- iki iz satırının `zaman`ı birebir aynı oluyor; gerçekte araya günler
-- giriyor. 4. grup "en son olan" sözünü ölçeceği için ilk satırın zamanını
-- geriye alıyor — 0085'in test dosyasındaki aynı gerekçe.
--
-- Tekrar çalıştırılabilir. Hiçbir blokta `exception when others` YOK:
-- öyle bir yakalayıcı kendinden önceki bütün grupların hatalarını yutar.
--
-- -----------------------------------------------------------------------------
-- KUSUR PROVALARI — HER KAPI GERÇEKTEN ISIRIYOR MU (ölçüldü)
--
--   A  Yardımcı İLK açmayı okuyor (`order by ... asc`)
--        → 4b ısırdı: "ilk açma dönüyor (puan 100.00)"
--   B  Önceki puan yalnız `puan`dan okunuyor (`coalesce` düşüyor)
--        → 3b ısırdı: "öğretmen puanı okunmadı: <NULL>"
--        İLK YAZIMINDA ISIRMADI. Kapı `(…)::numeric <> 75` yazıyordu ve
--        `null <> 75` SQL'de NULL döner: `if` HİÇ tetiklenmiyordu. Kusur
--        üründe değil ÖLÇÜMDE'ydi. Bu dosyadaki bütün karşılaştırmalar
--        bu yüzden `is distinct from`.
--   C  Sebep veliye sızıyor (`- 'neden' - 'onceki_durum'` kalkıyor)
--        → 6a ısırdı + 0090'ın öz-denetimi ısırdı
--   D  Yardımcı öğrenci eşleşmesini düşürüyor
--        → 8a ısırdı: "komşunun satırına geçmiş sızdı"
--   E  Yardımcı istemciye açık kalıyor (`revoke` kalkıyor)
--        → TAM SÜİTTE Faz 11 güvenlik denetimi DAHA ÖNCE ısırıyor; yani
--        bu kapının asıl bekçisi o ve 7. grup üstüne bir kat. 7. grubun
--        kendisi yalnız o dosya koşturulup yetki elle verilerek ölçüldü:
--        "7a BAŞARISIZ — _gonderim_yeniden_acma anon'a açık".
--   F  0088'İN KUSURU BİREBİR: kopya 0081'in `ek_sure`sini sessizce
--      düşürüyor
--        → 9b ısırdı + öz-denetim ısırdı ("ek süreyi kaybetti")
--   G  Bir uç alanı hiç vermiyor (öğrenci ekranı)
--        → 1c ısırdı: "ogrenci_odevleri yeniden_acma alanını hiç vermiyor"
--
-- Provada bir kapı ısırmazsa ÖNCE KOŞUM TAKIMINA bakılıyor: bu oturumda
-- koşum takımı üç kez yanılttı (`calistir.sh` olumsuz testlerde bilerek
-- `ERROR` bastırıyor, ölü PostgreSQL "ısırdı" sandırdı, derlemeyi bozan
-- bir yama denetimi eski pakete baktırdı).
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  ek   text := substr(md5(random()::text), 1, 6);
  js text; jo text; jv text; jo2 text; jv2 text;
  s_id uuid; sa uuid; o1 uuid; o2 uuid; kod text;
  d uuid; d_acik uuid; g uuid; g2 uuid;
  ogt jsonb; ogr jsonb; vel jsonb;
  z timestamptz; n integer;
begin
  raise notice '--- Kurulum ---';
  update public.ogretmenler set pin_hash =
    extensions.crypt('Acma!2026', extensions.gen_salt('bf', 10)) where yonetici;
  js := (public.giris('Acma!2026'))->>'token';
  select id into s_id from public.ogretmenler where yonetici;

  insert into public.siniflar (seviye, sube) values (11, 'YA')
    on conflict (seviye, sube) do update set arsiv = false returning id into sa;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    values (s_id, sa) on conflict do nothing;

  -- Dosya tekrar çalıştırılabilir olmalı: bu sınıfın bütün izi silinir.
  delete from public.odev_ek_sure
   where odev_id in (select id from public.odevler where sinif_id = sa);
  delete from public.denetim_izi
   where tablo = 'gonderimler'
     and (eski ->> 'odev_id') in
         (select id::text from public.odevler where sinif_id = sa);
  delete from public.gonderimler
   where odev_id in (select id from public.odevler where sinif_id = sa);
  delete from public.denetim_izi
   where tablo = 'odevler'
     and kayit_id in (select id from public.odevler where sinif_id = sa);
  delete from public.odevler where sinif_id = sa;
  delete from public.giris_kodlari
   where ogrenci_id in (select id from public.ogrenciler where sinif_id = sa);
  delete from public.ogrenciler where sinif_id = sa;

  o1 := (public.ogrenci_ekle(js, 'Açma Deneği ' || ek, 'okul', sa))->>'id';
  kod := (select k.kod from public.giris_kodlari k where k.ogrenci_id = o1 and k.rol = 'ogrenci');
  jo := (public.giris(kod))->>'token';
  kod := (select k.kod from public.giris_kodlari k where k.ogrenci_id = o1 and k.rol = 'veli');
  jv := (public.giris(kod))->>'token';
  perform public.onam_ver(jv, public._gecerli_onam_surumu(), 'Açma Velisi');

  o2 := (public.ogrenci_ekle(js, 'Komşu Deneği ' || ek, 'okul', sa))->>'id';
  kod := (select k.kod from public.giris_kodlari k where k.ogrenci_id = o2 and k.rol = 'ogrenci');
  jo2 := (public.giris(kod))->>'token';
  kod := (select k.kod from public.giris_kodlari k where k.ogrenci_id = o2 and k.rol = 'veli');
  jv2 := (public.giris(kod))->>'token';
  perform public.onam_ver(jv2, public._gecerli_onam_surumu(), 'Komşu Velisi');

  d := (public.odev_olustur(js, 'Tema Tekrarı ' || ek, null, sa, 'test',
        current_date + 7, 2, '{"1":"A","2":"B"}'::jsonb))->>'id';
  perform public.odev_yayinla(js, d);

  -- ===========================================================================
  raise notice '--- 1. Hiç açılmamış gönderimde alan NULL ---';
  -- ===========================================================================
  -- Önce gönderim bile yok.
  select (select r->'yeniden_acma' from jsonb_array_elements(x->'satirlar') r
           where r->>'ogrenci_id' = o1::text)
    into ogt from (select public.odev_gonderimleri(js, d) as x) q;
  if ogt is null then
    raise exception '1a BAŞARISIZ — odev_gonderimleri yeniden_acma alanını hiç vermiyor';
  end if;
  if ogt <> 'null'::jsonb then
    raise exception '1b BAŞARISIZ — açılmamış satırda bilgi var: %', ogt::text;
  end if;

  select (select e->'yeniden_acma' from jsonb_array_elements(x->'odevler') e
           where e->>'id' = d::text)
    into ogr from (select public.ogrenci_odevleri(jo) as x) q;
  if ogr is null then
    raise exception '1c BAŞARISIZ — ogrenci_odevleri yeniden_acma alanını hiç vermiyor';
  end if;
  if ogr <> 'null'::jsonb then
    raise exception '1d BAŞARISIZ — öğrencide açılmamış ödevde bilgi var: %', ogr::text;
  end if;

  -- Veli ödev satırını BAŞLIKTAN buluyor: ona ödev kimliği gitmiyor (0047).
  select (select e->'yeniden_acma' from jsonb_array_elements(x->'odevler') e
           where e->>'baslik' = 'Tema Tekrarı ' || ek)
    into vel from (select public.veli_paneli(jv) as x) q;
  if vel is null then
    raise exception '1e BAŞARISIZ — veli_paneli yeniden_acma alanını hiç vermiyor';
  end if;
  if vel <> 'null'::jsonb then
    raise exception '1f BAŞARISIZ — velide açılmamış ödevde bilgi var: %', vel::text;
  end if;

  -- Gönderim VAR ama açılmamış: alan yine null olmalı.
  perform public.odev_gonder(jo, d, 'cozum/' || d || '/' || o1 || '.jpg',
                             '{"1":"A","2":"B"}'::jsonb);
  select (select r->'yeniden_acma' from jsonb_array_elements(x->'satirlar') r
           where r->>'ogrenci_id' = o1::text)
    into ogt from (select public.odev_gonderimleri(js, d) as x) q;
  if ogt <> 'null'::jsonb then
    raise exception '1g BAŞARISIZ — gönderen ama açılmamış öğrencide bilgi var: %', ogt::text;
  end if;
  raise notice '    üç uç alanı veriyor, açılmamışta null: OK';

  -- ===========================================================================
  raise notice '--- 2. Açıldıktan sonra üç uç da SİLİNEN puanı söylüyor ---';
  -- ===========================================================================
  select id into g from public.gonderimler where odev_id = d and ogrenci_id = o1;
  -- İki soruluk testte ikisi de doğru: puan 100.
  if (select puan from public.gonderimler where id = g) is distinct from 100 then
    raise exception '2a BAŞARISIZ — kurulum puanı beklenmedik: %',
      (select puan from public.gonderimler where id = g);
  end if;
  perform public.gonderimi_yeniden_ac(js, g, 'Soruda düzeltme yapıldı.',
                                      current_date + 12);

  -- Gönderim gerçekten silindi mi (0081'in davranışı).
  if exists (select 1 from public.gonderimler where id = g) then
    raise exception '2b BAŞARISIZ — kurulum varsayımı yanlış: gönderim silinmemiş';
  end if;

  select (select r->'yeniden_acma' from jsonb_array_elements(x->'satirlar') r
           where r->>'ogrenci_id' = o1::text)
    into ogt from (select public.odev_gonderimleri(js, d) as x) q;
  select (select e->'yeniden_acma' from jsonb_array_elements(x->'odevler') e
           where e->>'id' = d::text)
    into ogr from (select public.ogrenci_odevleri(jo) as x) q;
  select (select e->'yeniden_acma' from jsonb_array_elements(x->'odevler') e
           where e->>'baslik' = 'Tema Tekrarı ' || ek)
    into vel from (select public.veli_paneli(jv) as x) q;

  if ogt = 'null'::jsonb or ogr = 'null'::jsonb or vel = 'null'::jsonb then
    raise exception '2c BAŞARISIZ — bir uç boş: öğretmen=% öğrenci=% veli=%',
      ogt::text, ogr::text, vel::text;
  end if;
  -- EN ÖNEMLİ SATIR: silinen puan üç ekranda da duruyor.
  -- `is distinct from`: `null <> 100` SQL'de NULL döner ve bu kapı HİÇ
  -- tetiklenmezdi. B provası ilk yazımda tam bu yüzden ısırmadı.
  if (ogt->>'onceki_puan')::numeric is distinct from 100
     or (ogr->>'onceki_puan')::numeric is distinct from 100
     or (vel->>'onceki_puan')::numeric is distinct from 100 then
    raise exception '2d BAŞARISIZ — silinen puan kayboldu: % / % / %',
      ogt->>'onceki_puan', ogr->>'onceki_puan', vel->>'onceki_puan';
  end if;
  if (ogt->>'yeni_son_tarih')::date is distinct from current_date + 12
     or (vel->>'yeni_son_tarih')::date is distinct from current_date + 12 then
    raise exception '2e BAŞARISIZ — yeni son tarih yanlış: % / %',
      ogt->>'yeni_son_tarih', vel->>'yeni_son_tarih';
  end if;
  if ogt->>'zaman' is null or ogr->>'zaman' is null or vel->>'zaman' is null then
    raise exception '2f BAŞARISIZ — açılma zamanı bir uçta yok';
  end if;
  -- Öğretmenin listesinde o satır hâlâ "göndermedi" (0081 silince öyle
  -- oluyor); ARTIK yanında NEDENİ var. Ekran bu ikisini birlikte okuyor.
  select (select (r->>'gonderdi')::boolean::integer
            from jsonb_array_elements(x->'satirlar') r
           where r->>'ogrenci_id' = o1::text)
    into n from (select public.odev_gonderimleri(js, d) as x) q;
  if n is distinct from 0 then
    raise exception '2g BAŞARISIZ — kurulum varsayımı yanlış: gonderdi hâlâ true';
  end if;
  raise notice '    silinen 100 puan öğretmende, öğrencide ve velide duruyor: OK';

  -- ===========================================================================
  raise notice '--- 3. Açık uçluda onceki_puan = ogretmen_puan ---';
  -- ===========================================================================
  -- `veli_paneli` puanı `coalesce(ogretmen_puan, puan)` ile okuyor.
  -- Yardımcı başka bir kural kullansaydı aynı ödev iki ekranda iki ayrı
  -- puan gösterirdi.
  d_acik := (public.odev_olustur(js, 'Açık Uçlu ' || ek, null, sa, 'acik',
             current_date + 7, 2, null))->>'id';
  perform public.odev_yayinla(js, d_acik);
  perform public.odev_gonder(jo, d_acik, 'cozum/' || d_acik || '/' || o1 || '.jpg',
                             '{}'::jsonb);
  select id into g from public.gonderimler where odev_id = d_acik and ogrenci_id = o1;
  perform public.acik_puanla(js, g, 75, 'Üçüncü adımda işlem hatası var.');
  -- Açık uçluda `puan` null, puan `ogretmen_puan`ta. Yardımcı `puan`ı
  -- okusaydı burada null dönerdi ve ekran "önceki gönderim" deyip puanı
  -- hiç söylemezdi.
  if (select puan from public.gonderimler where id = g) is not null then
    raise exception '3a BAŞARISIZ — kurulum varsayımı yanlış: açık uçluda puan dolu';
  end if;
  perform public.gonderimi_yeniden_ac(js, g, 'Çözüm kağıdı siyah geldi.',
                                      current_date + 12);

  select (select r->'yeniden_acma' from jsonb_array_elements(x->'satirlar') r
           where r->>'ogrenci_id' = o1::text)
    into ogt from (select public.odev_gonderimleri(js, d_acik) as x) q;
  select (select e->'yeniden_acma' from jsonb_array_elements(x->'odevler') e
           where e->>'baslik' = 'Açık Uçlu ' || ek)
    into vel from (select public.veli_paneli(jv) as x) q;
  if (ogt->>'onceki_puan')::numeric is distinct from 75 then
    raise exception '3b BAŞARISIZ — öğretmen puanı okunmadı: %', ogt->>'onceki_puan';
  end if;
  if (vel->>'onceki_puan')::numeric is distinct from 75 then
    raise exception '3c BAŞARISIZ — velide öğretmen puanı okunmadı: %', vel->>'onceki_puan';
  end if;
  raise notice '    açık uçluda 75 puan (ogretmen_puan) üç ekranda: OK';

  -- ===========================================================================
  raise notice '--- 4. İki kez açıldıysa EN SON olan dönüyor ---';
  -- ===========================================================================
  -- Birinci açmanın zamanı geriye alınıyor: `now()` işlem boyunca donuk ve
  -- iki satır aynı saniyeyi paylaşıyor.
  z := now() - interval '9 days';
  update public.denetim_izi set zaman = z
   where tablo = 'gonderimler' and islem = 'gonderim_yeniden_acildi'
     and (eski ->> 'odev_id') = d::text and (eski ->> 'ogrenci_id') = o1::text;

  -- İkinci tur: öğrenci yeniden gönderiyor, bu kez bir soru yanlış (50),
  -- öğretmen yine açıyor.
  perform public.odev_gonder(jo, d, 'cozum/' || d || '/' || o1 || '.jpg',
                             '{"1":"A","2":"C"}'::jsonb);
  select id into g from public.gonderimler where odev_id = d and ogrenci_id = o1;
  if (select puan from public.gonderimler where id = g) is distinct from 50 then
    raise exception '4a BAŞARISIZ — kurulum puanı beklenmedik: %',
      (select puan from public.gonderimler where id = g);
  end if;
  perform public.gonderimi_yeniden_ac(js, g, 'Kaydırma yapmış, düzeltme imkanı verildi.',
                                      current_date + 20);

  select (select e->'yeniden_acma' from jsonb_array_elements(x->'odevler') e
           where e->>'id' = d::text)
    into ogr from (select public.ogrenci_odevleri(jo) as x) q;
  -- İlk açmanın puanı 100, ikincinin 50. 100 dönerse eski satır okunuyor.
  if (ogr->>'onceki_puan')::numeric is distinct from 50 then
    raise exception '4b BAŞARISIZ — ilk açma dönüyor (puan %)', ogr->>'onceki_puan';
  end if;
  if ogr->>'neden' is distinct from 'Kaydırma yapmış, düzeltme imkanı verildi.' then
    raise exception '4c BAŞARISIZ — eski sebep dönüyor: %', ogr->>'neden';
  end if;
  if (ogr->>'yeni_son_tarih')::date is distinct from current_date + 20 then
    raise exception '4d BAŞARISIZ — eski tarih dönüyor: %', ogr->>'yeni_son_tarih';
  end if;
  if (ogr->>'zaman')::timestamptz is null or (ogr->>'zaman')::timestamptz <= z then
    raise exception '4e BAŞARISIZ — eski satırın zamanı dönüyor: %', ogr->>'zaman';
  end if;
  raise notice '    iki açmadan sonuncusu (50 puan, ikinci sebep): OK';

  -- ===========================================================================
  raise notice '--- 5. Yeniden gönderdikten sonra geçmiş KAYBOLMUYOR ---';
  -- ===========================================================================
  -- Ama `gonderdi` artık true: ekran "yeniden açıldı, yeniden gönderdi"
  -- ile "yeniden açıldı, hâlâ bekliyor"u ayırabiliyor. Panelde elle
  -- sorguladığımız `yeniden-acilan-bekleyenler.sql` listesi tam bu ayrımı
  -- kullanıyor; artık öğretmen onu sorgu çalıştırmadan görüyor.
  perform public.odev_gonder(jo, d, 'cozum/' || d || '/' || o1 || '.jpg',
                             '{"1":"A","2":"B"}'::jsonb);
  select (select r->'yeniden_acma' from jsonb_array_elements(x->'satirlar') r
           where r->>'ogrenci_id' = o1::text)
    into ogt from (select public.odev_gonderimleri(js, d) as x) q;
  if ogt = 'null'::jsonb then
    raise exception '5a BAŞARISIZ — yeniden gönderince geçmiş silindi';
  end if;
  if (ogt->>'onceki_puan')::numeric is distinct from 50 then
    raise exception '5b BAŞARISIZ — geçmiş puan bozuldu: %', ogt->>'onceki_puan';
  end if;
  select (select (r->>'gonderdi')::boolean::integer
            from jsonb_array_elements(x->'satirlar') r
           where r->>'ogrenci_id' = o1::text)
    into n from (select public.odev_gonderimleri(js, d) as x) q;
  if n is distinct from 1 then
    raise exception '5c BAŞARISIZ — yeniden gönderim görünmüyor';
  end if;
  raise notice '    geçmiş duruyor, gonderdi true: OK';

  -- ===========================================================================
  raise notice '--- 6. VELİ SEBEBİ GÖRMÜYOR ---';
  -- ===========================================================================
  -- 0081 sebebi öğrenciye `kanal = ''ogrenci''` mesajı olarak gönderiyor ve
  -- gövdesinde yazıyor: "VELİ GÖRMÜYOR (0025''in ayrımı)". Sebep çoğu zaman
  -- öğrencinin hatasını anlatıyor; o cümle öğrenciyle öğretmen arasında.
  -- Part XXI: GÖSTERMEDİĞİNİ GÖNDERME — arayüzde saklamak yetmez.
  select (select e->'yeniden_acma' from jsonb_array_elements(x->'odevler') e
           where e->>'baslik' = 'Tema Tekrarı ' || ek)
    into vel from (select public.veli_paneli(jv) as x) q;
  if vel ? 'neden' then
    raise exception '6a BAŞARISIZ — SEBEP VELİYE GİTTİ: %', vel::text;
  end if;
  if vel ? 'onceki_durum' then
    raise exception '6b BAŞARISIZ — önceki durum veliye gitti: %', vel::text;
  end if;
  -- Ama veli ÖDEVİN AÇILDIĞINI ve önceki puanı görüyor; yoksa çocuğunun
  -- ödevi hiç yapmadığını sanır. Asıl şikâyet buydu.
  if vel->>'zaman' is null or vel->>'onceki_puan' is null then
    raise exception '6c BAŞARISIZ — veli yeniden açmayı hiç görmüyor: %', vel::text;
  end if;
  -- Öğretmen ve öğrenci sebebi GÖRÜYOR.
  select (select r->'yeniden_acma' from jsonb_array_elements(x->'satirlar') r
           where r->>'ogrenci_id' = o1::text)
    into ogt from (select public.odev_gonderimleri(js, d) as x) q;
  select (select e->'yeniden_acma' from jsonb_array_elements(x->'odevler') e
           where e->>'id' = d::text)
    into ogr from (select public.ogrenci_odevleri(jo) as x) q;
  if ogt->>'neden' is null or ogr->>'neden' is null then
    raise exception '6d BAŞARISIZ — sebep öğretmende ya da öğrencide yok';
  end if;
  if ogt->>'onceki_durum' is null then
    raise exception '6e BAŞARISIZ — önceki durum öğretmende yok';
  end if;
  raise notice '    veli sebebi görmüyor, puanı görüyor; öğretmen ve öğrenci ikisini de: OK';

  -- ===========================================================================
  raise notice '--- 8. Başka öğrencinin açması sızmıyor ---';
  -- ===========================================================================
  -- 7. grup anon kapısını ayrı blokta ölçüyor (rol değişiyor).
  perform public.odev_gonder(jo2, d, 'cozum/' || d || '/' || o2 || '.jpg',
                             '{"1":"A","2":"B"}'::jsonb);
  select id into g2 from public.gonderimler where odev_id = d and ogrenci_id = o2;
  -- o2 HİÇ açılmadı; o1 iki kez açıldı. Eşleşme `ogrenci_id`yi okumasaydı
  -- o2'nin satırına o1'in geçmişi düşerdi.
  select (select r->'yeniden_acma' from jsonb_array_elements(x->'satirlar') r
           where r->>'ogrenci_id' = o2::text)
    into ogt from (select public.odev_gonderimleri(js, d) as x) q;
  if ogt is distinct from 'null'::jsonb then
    raise exception '8a BAŞARISIZ — komşunun satırına geçmiş sızdı: %', ogt::text;
  end if;
  select (select e->'yeniden_acma' from jsonb_array_elements(x->'odevler') e
           where e->>'id' = d::text)
    into ogr from (select public.ogrenci_odevleri(jo2) as x) q;
  if ogr is distinct from 'null'::jsonb then
    raise exception '8b BAŞARISIZ — komşu öğrenci başkasının geçmişini görüyor: %', ogr::text;
  end if;
  select (select e->'yeniden_acma' from jsonb_array_elements(x->'odevler') e
           where e->>'baslik' = 'Tema Tekrarı ' || ek)
    into vel from (select public.veli_paneli(jv2) as x) q;
  if vel is distinct from 'null'::jsonb then
    raise exception '8c BAŞARISIZ — komşu veli başkasının geçmişini görüyor: %', vel::text;
  end if;
  -- Şimdi o2 açılıyor: o1'in geçmişi değişmemeli (ödev eşleşmesi de doğru).
  perform public.gonderimi_yeniden_ac(js, g2, 'Komşunun sayfası eksik.',
                                      current_date + 15);
  select (select r->'yeniden_acma' from jsonb_array_elements(x->'satirlar') r
           where r->>'ogrenci_id' = o1::text)
    into ogt from (select public.odev_gonderimleri(js, d) as x) q;
  if ogt->>'neden' is distinct from 'Kaydırma yapmış, düzeltme imkanı verildi.' then
    raise exception '8d BAŞARISIZ — komşunun açması o1''in satırını değiştirdi: %', ogt::text;
  end if;
  -- Aynı öğrencinin BAŞKA ödevdeki açması da karışmamalı: o1 hem `d`de hem
  -- `d_acik`te açıldı ve sebepleri ayrı.
  select (select r->'yeniden_acma' from jsonb_array_elements(x->'satirlar') r
           where r->>'ogrenci_id' = o1::text)
    into ogr from (select public.odev_gonderimleri(js, d_acik) as x) q;
  if ogr->>'neden' is distinct from 'Çözüm kağıdı siyah geldi.' then
    raise exception '8e BAŞARISIZ — ödevler karıştı: %', ogr::text;
  end if;
  raise notice '    öğrenci ve ödev eşleşmesi ayrı duruyor: OK';

  -- ===========================================================================
  raise notice '--- 9. Üç ucun ESKİ alanları yerinde (0088''in dersi) ---';
  -- ===========================================================================
  -- 0088'de `odev_detay` yanlış migration'dan kopyalanıp 0085'i sessizce
  -- geri almıştı; okuyarak değil ÖLÇEREK bulduk. Bu grup kopyanın bir alanı
  -- düşürmediğini çalışma anında ölçüyor; öz-denetim gövde metnine bakıyor,
  -- bu grup çıktıya.
  select public.odev_gonderimleri(js, d) into ogt;
  if ogt->'ozet'->>'mevcut' is null or ogt->'konu_ozeti' is null then
    raise exception '9a BAŞARISIZ — öğretmen özeti ya da konu özeti gitti';
  end if;
  select (select r from jsonb_array_elements(ogt->'satirlar') r
           where r->>'ogrenci_id' = o1::text) into ogr;
  if not (ogr ? 'ek_sure') or not (ogr ? 'yanlis_sorular')
     or not (ogr ? 'duzeltildi') then
    raise exception '9b BAŞARISIZ — öğretmen satırının eski alanları eksik: %', ogr::text;
  end if;
  -- Ek süre gerçekten dolu olmalı: 0081 açarken yazıyor.
  if ogr->>'ek_sure' is null then
    raise exception '9c BAŞARISIZ — ek süre kayboldu';
  end if;

  select (select e from jsonb_array_elements((public.ogrenci_odevleri(jo))->'odevler') e
           where e->>'id' = d::text) into ogr;
  if ogr->'tarihler' is null or ogr->'tarihler' = 'null'::jsonb then
    raise exception '9d BAŞARISIZ — öğrencide 0085''in tarihleri gitti';
  end if;
  if not (ogr ? 'onceki_sayfalar') or not (ogr ? 'deneme_no')
     or not (ogr ? 'konu_analizi') then
    raise exception '9e BAŞARISIZ — öğrencinin eski alanları eksik: %',
      (select string_agg(k, ', ') from jsonb_object_keys(ogr) k);
  end if;

  select (select e from jsonb_array_elements((public.veli_paneli(jv))->'odevler') e
           where e->>'baslik' = 'Tema Tekrarı ' || ek) into vel;
  if vel->'tarihler' is null or vel->'tarihler' = 'null'::jsonb then
    raise exception '9f BAŞARISIZ — velide 0085''in tarihleri gitti';
  end if;
  if not (vel ? 'kiyas') or not (vel ? 'cozum_yollari') or not (vel ? 'tur') then
    raise exception '9g BAŞARISIZ — velinin eski alanları eksik: %',
      (select string_agg(k, ', ') from jsonb_object_keys(vel) k);
  end if;
  -- KURAL 6: veliye cevap anahtarı hiç gitmiyor.
  if vel ? 'cevap_anahtari' or vel ? 'anahtar_yolu' then
    raise exception '9h BAŞARISIZ — veliye cevap anahtarı sızdı';
  end if;
  raise notice '    öğretmen, öğrenci ve veli eski alanlarını koruyor: OK';

  raise notice '';
  raise notice 'YENİDEN AÇMA GÖRÜNÜRLÜĞÜ TESTLERİ GEÇTİ (0090)';
end $$;

-- =============================================================================
-- 7. YARDIMCI İSTEMCİYE KAPALI — rol değiştiği için ayrı blok
-- =============================================================================
do $$
begin
  if has_function_privilege('anon', 'public._gonderim_yeniden_acma(uuid, uuid)', 'execute') then
    raise exception '7a BAŞARISIZ — _gonderim_yeniden_acma anon''a açık';
  end if;
  if has_function_privilege('authenticated',
        'public._gonderim_yeniden_acma(uuid, uuid)', 'execute') then
    raise exception '7b BAŞARISIZ — _gonderim_yeniden_acma authenticated''a açık';
  end if;
  -- Yardımcı `security definer`: açık kalsaydı herhangi bir istemci
  -- herhangi bir öğrencinin silinen puanını ve sebebini okuyabilirdi.
  if not (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = '_gonderim_yeniden_acma') then
    raise exception '7c BAŞARISIZ — yardımcı security definer değil';
  end if;
  raise notice '7 OK — yardımcı istemciye kapalı';
end $$;

-- =============================================================================
-- 10. ZİNCİRİN SONU
-- =============================================================================
do $$
declare son text;
begin
  select dosya into son from public.uygulanan_migrationlar order by dosya desc limit 1;
  if son is distinct from '0090' then
    raise exception '10 BAŞARISIZ — zincirin sonu % (0090 bekleniyordu)', son;
  end if;
  raise notice '10 OK — zincirin sonu 0090';
end $$;
