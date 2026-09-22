-- =============================================================================
-- SEKİZ — 0048 YAZIŞMA LİSTESİ TESTLERİ
--
-- Bu turun tehlikesi SIRALAMA. Uç doğru kişileri döndürüp yanlış sırada
-- dizerse hiçbir şey çökmez; öğretmen yalnız "en son yazan kim"i
-- bulamaz ve neden bulamadığını da anlamaz.
--
-- Bu yüzden dünya, sıralaması ELLE BİLİNEN bir zaman çizgisiyle
-- kuruluyor. Mesajlar `created_at` geriye çekilerek şöyle dizildi:
--
--   9M · Melis   →  1 saat önce   (EN YENİ)
--   9M · Mert    →  5 gün önce
--   10M · Zeynep →  2 saat önce
--   9N · Kaan    →  3 gün önce
--   9N · Ada     →  10 gün önce
--
-- Beklenen sınıf sırası:  9M (1 saat) · 10M (2 saat) · 9N (3 gün)
-- Beklenen 9M içi sırası: Melis · Mert
--
-- SINIF ADLARI BİLEREK TERS: alfabetik sıralansaydı 10M, 9M, 9N çıkardı;
-- tazeliğe göre 9M, 10M, 9N. İki sıra FARKLI, yani ölçüm ayırt ediyor.
-- Aynı şekilde 9M içinde alfabetik "Melis, Mert" ile tazelik "Melis,
-- Mert" aynı olurdu — bu yüzden Mert'in mesajı ESKİ ve isim sırası
-- bilerek ters kuruldu (aşağıda ayrıca ölçülüyor).
--
-- İZOLASYON: kendi sınıflarını kuruyor (9M, 9N, 10M).
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text;                  -- öğretmen (sahip)
  s_9m uuid; s_9n uuid; s_10m uuid;
  melis uuid; mert uuid; kaan uuid; ada uuid; zeynep uuid; sessiz uuid;
  v jsonb; g jsonb;
begin
  -- ---------------------------------------------------------------------------
  -- Hazırlık
  -- ---------------------------------------------------------------------------
  update public.ogretmenler
     set pin_hash = extensions.crypt('Yazisma!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Yazisma!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (9, 'M')
    on conflict (seviye, sube) do update set arsiv = false returning id into s_9m;
  insert into public.siniflar (seviye, sube) values (9, 'N')
    on conflict (seviye, sube) do update set arsiv = false returning id into s_9n;
  insert into public.siniflar (seviye, sube) values (10, 'M')
    on conflict (seviye, sube) do update set arsiv = false returning id into s_10m;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    select o.id, s.id from public.ogretmenler o, public.siniflar s
     where o.yonetici and s.id in (s_9m, s_9n, s_10m)
    on conflict do nothing;

  melis  := (public.ogrenci_ekle(jt, 'Melis Yaz', 'okul', s_9m))->>'id';
  mert   := (public.ogrenci_ekle(jt, 'Mert Yaz',  'okul', s_9m))->>'id';
  kaan   := (public.ogrenci_ekle(jt, 'Kaan Yaz',  'okul', s_9n))->>'id';
  ada    := (public.ogrenci_ekle(jt, 'Ada Yaz',   'okul', s_9n))->>'id';
  zeynep := (public.ogrenci_ekle(jt, 'Zeynep Yaz','okul', s_10m))->>'id';
  -- HİÇ MESAJLAŞILMAYAN öğrenci: 3. grubun ölçtüğü şey.
  sessiz := (public.ogrenci_ekle(jt, 'Sessiz Yaz', 'okul', s_9m))->>'id';

  perform public.mesaj_gonder(jt, 'Melis ogrenci', melis,  'ogrenci');
  perform public.mesaj_gonder(jt, 'Mert ogrenci',  mert,   'ogrenci');
  perform public.mesaj_gonder(jt, 'Kaan ogrenci',  kaan,   'ogrenci');
  perform public.mesaj_gonder(jt, 'Ada ogrenci',   ada,    'ogrenci');
  perform public.mesaj_gonder(jt, 'Zeynep ogrenci',zeynep, 'ogrenci');
  -- VELİ kanalına yalnız Ada: kanal ayrımının ölçümü (4. grup).
  perform public.mesaj_gonder(jt, 'Ada veli', ada, 'veli');

  -- Zaman çizgisi (başlıktaki tablo).
  update public.mesajlar set created_at = now() - interval '1 hour'  where ogrenci_id = melis;
  update public.mesajlar set created_at = now() - interval '5 days'  where ogrenci_id = mert;
  update public.mesajlar set created_at = now() - interval '2 hours' where ogrenci_id = zeynep;
  update public.mesajlar set created_at = now() - interval '3 days'  where ogrenci_id = kaan;
  update public.mesajlar set created_at = now() - interval '10 days' where ogrenci_id = ada;

  -- ---------------------------------------------------------------------------
  -- 1 — SINIFLAR TAZELİĞE GÖRE
  --
  -- Beklenen: 9M (1 saat) · 10M (2 saat) · 9N (3 gün).
  -- Alfabetik olsaydı 10M, 9M, 9N çıkardı — iki sıra farklı.
  -- ---------------------------------------------------------------------------
  v := public.yazisma_listesi(jt, 'ogrenci');

  if (v->'gruplar'->0->>'sinif') <> '9M'
     or (v->'gruplar'->1->>'sinif') <> '10M'
     or (v->'gruplar'->2->>'sinif') <> '9N' then
    raise exception '1: sınıf sırası 9M,10M,9N olmalı; gelen %/%/%',
      v->'gruplar'->0->>'sinif', v->'gruplar'->1->>'sinif', v->'gruplar'->2->>'sinif';
  end if;
  raise notice '1 OK — sınıflar tazeliğe göre (9M, 10M, 9N)';

  -- ---------------------------------------------------------------------------
  -- 2 — SINIF İÇİNDE ÖĞRENCİLER TAZELİĞE GÖRE
  --
  -- 9M içinde Melis (1 saat) önce, Mert (5 gün) sonra.
  --
  -- NEGATİF KONTROL AYNI GRUPTA: Mert'in mesajı Melis'inkinden ESKİ
  -- yapılıp sıra yeniden okunuyor. Sıralama sabit bir şeye (ada, kimliğe,
  -- ekleme sırasına) bağlıysa bu ikinci okuma da aynı çıkar ve ölçüm
  -- kırmızı yanar.
  -- ---------------------------------------------------------------------------
  g := v->'gruplar'->0->'satirlar';
  if (g->0->>'ad') <> 'Melis Yaz' or (g->1->>'ad') <> 'Mert Yaz' then
    raise exception '2: 9M içinde sıra Melis,Mert olmalı; gelen %/%',
      g->0->>'ad', g->1->>'ad';
  end if;

  update public.mesajlar set created_at = now() - interval '10 minutes'
   where ogrenci_id = mert and kanal = 'ogrenci';
  g := public.yazisma_listesi(jt, 'ogrenci')->'gruplar'->0->'satirlar';
  if (g->0->>'ad') <> 'Mert Yaz' then
    raise exception '2b: Mert en yeni olduğu hâlde başa geçmedi — sıralama '
                    'tazeliğe bağlı değil; gelen %', g->0->>'ad';
  end if;
  -- Dünyayı geri al.
  update public.mesajlar set created_at = now() - interval '5 days'
   where ogrenci_id = mert and kanal = 'ogrenci';
  raise notice '2 OK — sınıf içinde öğrenciler tazeliğe göre (iki yönlü ölçüldü)';

  -- ---------------------------------------------------------------------------
  -- 3 — HİÇ MESAJLAŞILMAMIŞ ÖĞRENCİ LİSTEDE YOK
  --
  -- Öğretmenin kararı: "yalnız yazışması olanlar". `sessiz` 9M'de ve
  -- aktif; yalnız hiç mesajı yok.
  -- ---------------------------------------------------------------------------
  if v::text like '%Sessiz Yaz%' then
    raise exception '3: yazışması olmayan öğrenci listede: %', v::text;
  end if;
  -- POZİTİF KONTROL: aynı sınıftaki yazışmalı öğrenciler DURUYOR, yani
  -- süzgeç sınıfı toptan elemiş değil.
  if v::text not like '%Melis Yaz%' then
    raise exception '3b: süzgeç fazla eledi, yazışmalı öğrenci de gitti';
  end if;
  raise notice '3 OK — mesajsız öğrenci listede yok, mesajlı olan duruyor';

  -- ---------------------------------------------------------------------------
  -- 4 — KANAL AYRIMI
  --
  -- Veli kanalında YALNIZ Ada var. Öğrenci kanalı onu veli mesajı
  -- yüzünden göstermemeli, veli kanalı da ötekileri göstermemeli.
  -- ---------------------------------------------------------------------------
  declare vv jsonb := public.yazisma_listesi(jt, 'veli');
  begin
    if vv::text not like '%Ada Yaz%' then
      raise exception '4: veli kanalında Ada yok: %', vv::text;
    end if;
    if vv::text like '%Melis Yaz%' or vv::text like '%Zeynep Yaz%' then
      raise exception '4b: veli kanalına öğrenci kanalı sızdı: %', vv::text;
    end if;
    if (vv->>'kanal') <> 'veli' then
      raise exception '4c: dönen kanal etiketi yanlış: %', vv->>'kanal';
    end if;
  end;
  raise notice '4 OK — iki kanal birbirine karışmıyor';

  -- ---------------------------------------------------------------------------
  -- 5 — OKUNMAMIŞ SAYISI VE OKUNDU İŞARETİ
  --
  -- Karşı taraftan gelen mesaj sayılıyor; öğretmenin kendi yazdığı
  -- sayılmıyor. Yukarıdaki mesajların HEPSİNİ öğretmen yazdı, yani
  -- şu an okunmamış sıfır olmalı — bu da kendi başına bir ölçüm.
  -- ---------------------------------------------------------------------------
  if (v->>'toplam_okunmamis')::int <> 0 then
    raise exception '5: öğretmenin kendi mesajları okunmamış sayıldı: %',
      v->>'toplam_okunmamis';
  end if;

  declare
    j_melis text := (public.giris((select kod from public.giris_kodlari
                                    where ogrenci_id = melis and rol='ogrenci')))->>'token';
    v5 jsonb;
  begin
    perform public.mesaj_gonder(j_melis, 'Ogretmenim bir sorum var.', null, null);
    v5 := public.yazisma_listesi(jt, 'ogrenci');
    if (v5->>'toplam_okunmamis')::int <> 1 then
      raise exception '5b: öğrenciden gelen mesaj okunmamışa yazılmadı: %',
        v5->>'toplam_okunmamis';
    end if;

    perform public.ogretmen_okudu(jt, melis, 'ogrenci');
    v5 := public.yazisma_listesi(jt, 'ogrenci');
    if (v5->>'toplam_okunmamis')::int <> 0 then
      raise exception '5c: okundu işaretlendi ama sayaç düşmedi: %',
        v5->>'toplam_okunmamis';
    end if;
  end;
  raise notice '5 OK — okunmamış sayısı doğru, okundu işareti düşürüyor';

  -- ---------------------------------------------------------------------------
  -- 6 — MESLEKTAŞIN YAZIŞMASI GÖRÜNMÜYOR
  --
  -- Aynı öğrenciye iki öğretmen ders verebiliyor (0033). Her biri YALNIZ
  -- kendi yazışmasını görmeli; `mesajlar.ogretmen_id` süzgeci bunun için.
  -- ---------------------------------------------------------------------------
  declare
    v_b uuid;
    jb text;
    vb jsonb;
  begin
    v_b := (public.ogretmen_ekle(jt, 'Yazisma Meslektas', 'Meslek!2026'))->>'id';
    perform public.ogretmen_sinif_ata(jt, v_b, jsonb_build_array(s_9m::text));
    jb := (public.giris('Meslek!2026'))->>'token';

    vb := public.yazisma_listesi(jb, 'ogrenci');
    if vb::text like '%Melis Yaz%' then
      raise exception '6: meslektaş, sahibin yazışmasını gördü: %', vb::text;
    end if;

    -- POZİTİF KONTROL: meslektaş KENDİ yazdığında listesinde görüyor.
    perform public.mesaj_gonder(jb, 'Meslektas yazdi', melis, 'ogrenci');
    vb := public.yazisma_listesi(jb, 'ogrenci');
    if vb::text not like '%Melis Yaz%' then
      raise exception '6b: meslektaş kendi yazışmasını göremedi: %', vb::text;
    end if;

    -- OKUNMAMIŞ SAYISI DA ÖĞRETMENE GÖRE SÜZÜLÜYOR.
    --
    -- Bu ölçüm KUSUR PROVASIYLA doğdu: `ogretmen_id` süzgecini yalnız
    -- okunmamış alt sorgusundan silmek testlerin hiçbirini kırmıyordu.
    -- 6a/6b GÖRÜNÜRLÜĞÜ ölçüyor (`son_mesaj`), sayıyı değil. Eksik
    -- ölçümün gerçek bedeli şu olurdu: öğrencinin MESLEKTAŞA yazdığı
    -- mesaj, sahibin rozetini şişirir; rozete basıp açan öğretmen
    -- ortada okunacak bir şey bulamaz.
    --
    -- SATIR DOĞRUDAN YAZILIYOR ve sebebi ölçüldü: `mesaj_gonder`
    -- öğrenciden gelen mesajı `_ogrencinin_ogretmeni` ile TEK bir
    -- öğretmene bağlıyor, yani normal yoldan meslektaşın kutusuna mesaj
    -- düşürülemiyor. Burada ölçülen şey uç değil, SÜZGEÇ.
    declare v_once integer;
    begin
      v_once := (public.yazisma_listesi(jt, 'ogrenci')->>'toplam_okunmamis')::int;

      -- `clock_timestamp()` — `now()` DEĞİL. Bu ölçüm bir kez ÖLÜ doğdu
      -- ve sebebi tam buydu:
      --
      --   Bütün dosya TEK bir dolar-tırnaklı blok, yani TEK İŞLEM;
      --   `now()` işlem boyunca DONUK.
      --   5. grupta yazılan okundu işareti ile buradaki satır AYNI T'yi
      --   alıyordu; süzgeç `created_at > zaman`, yani `T > T` = false.
      --   Satır sahibin sayacına hiç girmiyordu — süzgeç kalksa bile.
      --   Kusur provası "ısırmadı" dedi, sebebi de buydu.
      --
      -- `clock_timestamp()` gerçek saati okuyor ve işlemden etkilenmiyor.
      insert into public.mesajlar (ogrenci_id, kimden, metin, kanal, ogretmen_id, created_at)
      values (melis, 'ogrenci', 'Meslektasa yazilmis mesaj', 'ogrenci', v_b,
              clock_timestamp() + interval '1 second');

      if (public.yazisma_listesi(jt, 'ogrenci')->>'toplam_okunmamis')::int <> v_once then
        raise exception '6c: meslektaşa yazılan mesaj SAHİBİN okunmamış '
                        'sayacına eklendi (% → %)',
          v_once, (public.yazisma_listesi(jt, 'ogrenci')->>'toplam_okunmamis')::int;
      end if;

      -- POZİTİF KONTROL: aynı satır MESLEKTAŞIN sayacında görünüyor.
      --
      -- DÜRÜST NOT: bu iddia tek başına zayıf. Meslektaşın hiç okundu
      -- işareti yok, yani karşılaştırma `-infinity` ile yapılıyor ve
      -- satır her hâlükârda sayılıyor. 6c ölü doğduğunda bu yeşil
      -- kalmıştı. Asıl güvence 6c'nin `clock_timestamp()` ile
      -- onarılmış hâli; bu satır yalnız "satır gerçekten yazıldı mı"
      -- sorusuna cevap veriyor.
      if (public.yazisma_listesi(jb, 'ogrenci')->>'toplam_okunmamis')::int < 1 then
        raise exception '6d: satır meslektaşın sayacında da görünmüyor — '
                        'ölçüm hiçbir şey ölçmüyor';
      end if;
    end;
  end;
  raise notice '6 OK — meslektaşın yazışması ve SAYACI ayrı (kusur provasıyla bulundu)';

  -- ---------------------------------------------------------------------------
  -- 7 — ARŞİVDEKİ SINIF LİSTEDE YOK (0016 kuralı)
  -- ---------------------------------------------------------------------------
  perform public.sinif_arsivle(jt, s_10m, true);
  v := public.yazisma_listesi(jt, 'ogrenci');
  if v::text like '%Zeynep Yaz%' then
    raise exception '7: arşivdeki sınıfın öğrencisi listede: %', v::text;
  end if;
  perform public.sinif_arsivle(jt, s_10m, false);
  v := public.yazisma_listesi(jt, 'ogrenci');
  if v::text not like '%Zeynep Yaz%' then
    raise exception '7b: arşivden çıkınca geri gelmedi';
  end if;
  raise notice '7 OK — arşivdeki sınıf listede yok, çıkınca geri geliyor';

  -- ---------------------------------------------------------------------------
  -- 8 — GEÇERSİZ KANAL REDDEDİLİYOR
  -- ---------------------------------------------------------------------------
  begin
    perform public.yazisma_listesi(jt, 'ogretmen');
    raise exception '8: geçersiz kanal kabul edildi';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.yazisma_listesi(jt, null);
    raise exception '8b: null kanal kabul edildi';
  exception when invalid_parameter_value then null;
  end;
  raise notice '8 OK — geçersiz ve null kanal reddediliyor';

  -- ---------------------------------------------------------------------------
  -- 9 — ÖĞRENCİ VE VELİ JETONU REDDEDİLİYOR
  --
  -- Bu bir ÖĞRETMEN ucu. `guvenlik_denetimi.sql` beyaz listesine
  -- eklenmedi, çünkü eklenmemesi gereken tam olarak budur — burada
  -- ayrıca ölçülüyor.
  -- ---------------------------------------------------------------------------
  declare
    j_o text := (public.giris((select kod from public.giris_kodlari
                                where ogrenci_id = melis and rol='ogrenci')))->>'token';
    j_v text := (public.giris((select kod from public.giris_kodlari
                                where ogrenci_id = melis and rol='veli')))->>'token';
  begin
    begin
      perform public.yazisma_listesi(j_o, 'ogrenci');
      raise exception '9: öğrenci jetonu kabul edildi';
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.yazisma_listesi(j_v, 'veli');
      raise exception '9b: veli jetonu kabul edildi';
    exception when insufficient_privilege then null;
    end;
  end;
  raise notice '9 OK — öğrenci ve veli jetonu reddediliyor';

  -- ---------------------------------------------------------------------------
  -- 10 — SINIF TOPLAMI SATIRLARIN TOPLAMIYLA TUTUYOR
  --
  -- Grup başlığındaki `okunmamis` ile içindeki satırların toplamı
  -- ayrışırsa öğretmen rozeti açıp hiçbir şey bulamaz.
  -- ---------------------------------------------------------------------------
  declare j_ada text := (public.giris((select kod from public.giris_kodlari
                                        where ogrenci_id = ada and rol='ogrenci')))->>'token';
  begin
    perform public.mesaj_gonder(j_ada, 'Ada da yaziyor.', null, null);
    v := public.yazisma_listesi(jt, 'ogrenci');
    if (select count(*) from jsonb_array_elements(v->'gruplar') gr
         where (gr->>'okunmamis')::int
               <> (select coalesce(sum((s->>'okunmamis')::int), 0)
                     from jsonb_array_elements(gr->'satirlar') s)) > 0 then
      raise exception '10: sınıf toplamı satır toplamıyla tutmuyor: %', v::text;
    end if;
  end;
  raise notice '10 OK — sınıf toplamı satırların toplamıyla tutuyor';

  -- ---------------------------------------------------------------------------
  -- 11 — `ogrenci_yazismalari` İLE AYNI SAYI
  --
  -- İki uç aynı kaynaktan hesaplıyor; ayrışırlarsa öğretmen aynı öğrenci
  -- için iki farklı "okunmamış" görür. 0048 o hesabı yeniden yazmak
  -- yerine genelleştirdi; bu ölçüm o kararın karşılığı.
  -- ---------------------------------------------------------------------------
  if (public.yazisma_listesi(jt, 'ogrenci')->>'toplam_okunmamis')::int
     <> (public.ogrenci_yazismalari(jt)->>'toplam_okunmamis')::int then
    raise exception '11: iki uç farklı okunmamış sayısı veriyor: % / %',
      public.yazisma_listesi(jt, 'ogrenci')->>'toplam_okunmamis',
      public.ogrenci_yazismalari(jt)->>'toplam_okunmamis';
  end if;
  raise notice '11 OK — ogrenci_yazismalari ile aynı sayı';

  raise notice '';
  raise notice 'YAZIŞMA LİSTESİ TESTLERİ: 11 GRUP GEÇTİ';
end $$;
