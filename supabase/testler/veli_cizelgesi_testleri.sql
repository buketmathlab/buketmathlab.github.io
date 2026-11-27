-- =============================================================================
-- SEKİZ — VELİ ÇİZELGESİ: NOT ÇİZELGESİNİN YENİ ALANLARI (0091)
--
-- Öğretmenin isteği: "Veli toplantısı var... 1 A4'e 2 öğrenci olsun.
-- Hangi ödev ne zaman verilmiş. Kaç tanesini yapmış yapmamış. Kaç puan
-- almış. O ödevde sınıfının ortalaması kaçmış, o düzeydeki tüm sınıfların
-- ortalaması kaçmış. En çok eksik olduğu konular yazsın."
--
-- Bu süit YALNIZ 0091'in eklediklerini ölçüyor. `sinif_not_cizelgesi`in
-- kendi davranışı (kapsam, ızgara, aylar) 0061–0086'nın süitlerinde.
--
-- Ölçülen:
--   1.  VERİLİŞ TARİHİ — `created_at` DEĞİL, yayınlanma anı
--   2.  SINIF ortalaması ödev başına doğru
--   3.  DÜZEY ortalaması: iki şubede var, TEK şubede null
--   4.  TESLİM SAYILARI yanıtta YOK (öğretmenin kararı)
--   5.  Süresi dolmamış ödevde kıyas yok (`sure_dolmadi`)
--   6.  Çalışma kağıdında ve özel derste kıyas yok
--   7.  Soru dökümü: yalnız NUMARA, yalnız test ödevinde (Kural 6)
--   8.  Gecikmeli teslim işareti
--   9.  Eksik konular — `sinif_ogrenci_ozeti` ile AYNI sonuç
--  10.  0086'nın alanları yerinde (0088'in dersi) + 0091 zincirde
--
-- `now()` işlem boyunca DONUK: veriliş tarihini ölçmek için
-- `odev_yayinlandi` satırının zamanı geriye alınıyor (0085'in test
-- dosyasındaki aynı gerekçe).
--
-- Tekrar çalıştırılabilir. Hiçbir blokta `exception when others` YOK.
--
-- -----------------------------------------------------------------------------
-- KUSUR PROVALARI — HER KAPI GERÇEKTEN ISIRIYOR MU (ölçüldü)
--
--   V1  Veriliş tarihi `created_at`ten okunuyor (0085'in ayrımı siliniyor)
--         → 1c ısırdı: beklenen 18 Kasım, gelen 27 Kasım
--   V2  Kıyas hiç verilmiyor
--         → 2b ısırdı: "sınıf ortalaması 75 beklenirken <NULL>"
--   V3  Soru dökümünün tür süzgeci kalkıyor
--         → 7f ısırdı: açık uçluda döküm verildi
--       İLK YAZIMINDA `yanlis_sorular`ın süzgeci bozuluyordu ve prova
--       ISIRMADI. Kusur kapıda değil PROVADAYDI: açık uçlu ödevde cevap
--       anahtarı yok, dolayısıyla hiçbir soru "yanlış" çıkamaz — o yarı
--       süzgeçsiz bile yanlış bilgi üretmiyor. Sızdıran yarı `bos_sorular`:
--       anahtarsız bir ödevde HER soru "boş" görünür ve veli çocuğunun
--       bütün soruları boş bıraktığını sanırdı.
--   V4  KURAL 6 İHLALİ: işaretlenen şıklar hücreye konuyor
--         → 7e ısırdı: "ŞIK HÜCREYE SIZDI"
--   V5  Gecikmeli alanı hep false
--         → 8a ısırdı
--   V6  Eksik konuların 5 soruluk alt sınırı kalkıyor
--         → 9b ısırdı: tek ödevden "Köklü sayılar" çıkarıldı
--
-- Isırmayan — ya da beklenmedik yerden ısıran — provada önce koşum
-- takımına bakılıyor. V3 tam bunun örneği.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  ek    text := substr(md5(random()::text), 1, 6);
  jt text; jo1 text; kod text;
  s_id uuid;
  v_a uuid; v_b uuid; v_ozel uuid;
  o1 uuid; o2 uuid; o3 uuid;
  d_a uuid; d_b uuid; d_tek uuid; d_acik uuid; d_calisma uuid; d_gelecek uuid;
  d_ozel uuid; o_ozel uuid;
  c jsonb; o jsonb; p jsonb; k jsonb;
  z timestamptz; n integer;
begin
  raise notice '--- Kurulum ---';
  update public.ogretmenler set pin_hash =
    extensions.crypt('Cizelge!2026', extensions.gen_salt('bf', 10)) where yonetici;
  jt := (public.giris('Cizelge!2026'))->>'token';
  select id into s_id from public.ogretmenler where yonetici;

  -- İKİ ŞUBE: düzey ortalaması ancak kardeş şube varsa doluyor (0047).
  insert into public.siniflar (seviye, sube) values (7, 'C')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_a;
  insert into public.siniflar (seviye, sube) values (7, 'D')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_b;
  -- ÖZEL DERS SINIFI TEKTİR (`siniflar_tek_ozel`) ve seviyesi 99 olmak
  -- zorundadır (0012'nin kısıtı). İkisini de ilk yazımda kaçırdım:
  -- önce `seviye = 7` kısıttan düştü, sonra ikinci bir özel sınıf
  -- benzersizlik indeksinden. Var olanı kullanmak doğrusu.
  select id into v_ozel from public.siniflar where ozel limit 1;
  if v_ozel is null then
    insert into public.siniflar (seviye, sube, ozel) values (99, 'Z', true)
      returning id into v_ozel;
  else
    update public.siniflar set arsiv = false where id = v_ozel;
  end if;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    values (s_id, v_a), (s_id, v_b), (s_id, v_ozel) on conflict do nothing;

  delete from public.gonderimler
   where odev_id in (select id from public.odevler where sinif_id in (v_a, v_b, v_ozel));
  delete from public.denetim_izi
   where tablo = 'odevler'
     and kayit_id in (select id from public.odevler where sinif_id in (v_a, v_b, v_ozel));
  delete from public.odevler where sinif_id in (v_a, v_b, v_ozel);
  delete from public.giris_kodlari
   where ogrenci_id in (select id from public.ogrenciler where sinif_id in (v_a, v_b, v_ozel));
  delete from public.ogrenciler where sinif_id in (v_a, v_b, v_ozel);

  o1 := (public.ogrenci_ekle(jt, 'Çizelge Bir ' || ek, 'okul', v_a))->>'id';
  o2 := (public.ogrenci_ekle(jt, 'Çizelge İki ' || ek, 'okul', v_a))->>'id';
  o3 := (public.ogrenci_ekle(jt, 'Komşu Şube ' || ek, 'okul', v_b))->>'id';
  o_ozel := (public.ogrenci_ekle(jt, 'Özel Ders ' || ek, 'ozel', v_ozel))->>'id';
  kod := (select k.kod from public.giris_kodlari k
           where k.ogrenci_id = o1 and k.rol = 'ogrenci');
  jo1 := (public.giris(kod))->>'token';

  -- AYNI ÖDEV İKİ ŞUBEDE: `_odev_kiyasi` düzeyi başlık + veriliş GÜNÜ
  -- eşleşmesinden buluyor, o yüzden ikisi de aynı başlık ve aynı gün.
  d_a := (public.odev_olustur(jt, 'Tema 1 ' || ek, null, v_a, 'test',
          current_date - 2, 4, '{"1":"A","2":"B","3":"C","4":"D"}'::jsonb,
          null, null, false, 4::smallint,
          '{"1":"Üslü sayılar","2":"Üslü sayılar","3":"Köklü sayılar","4":"Köklü sayılar"}'::jsonb))->>'id';
  perform public.odev_yayinla(jt, d_a);
  d_b := (public.odev_olustur(jt, 'Tema 1 ' || ek, null, v_b, 'test',
          current_date - 2, 4, '{"1":"A","2":"B","3":"C","4":"D"}'::jsonb,
          null, null, false, 4::smallint,
          '{"1":"Üslü sayılar","2":"Üslü sayılar","3":"Köklü sayılar","4":"Köklü sayılar"}'::jsonb))->>'id';
  perform public.odev_yayinla(jt, d_b);

  -- GERÇEK HAYAT: ödev 9 gün önce verildi, bugün açılmadı.
  z := now() - interval '9 days';
  update public.denetim_izi set zaman = z
   where tablo = 'odevler' and kayit_id = d_a and islem = 'odev_yayinlandi';

  -- Gönderimler: o1 yarısını doğru (50), o2 hepsi doğru (100),
  -- komşu şubede o3 hepsi yanlış (0) → sınıf 75, düzey 50.
  insert into public.gonderimler (odev_id, ogrenci_id, cevaplar, foto_yolu,
                                  dogru, yanlis, bos, puan, durum)
  values (d_a, o1, '{"1":"A","2":"B","3":"X","4":"X"}'::jsonb,
          'cozum/' || d_a || '/' || o1 || '.jpg', 2, 2, 0, 50, 'puanlandi'),
         (d_a, o2, '{"1":"A","2":"B","3":"C","4":"D"}'::jsonb,
          'cozum/' || d_a || '/' || o2 || '.jpg', 4, 0, 0, 100, 'puanlandi'),
         (d_b, o3, '{"1":"X","2":"X","3":"X","4":"X"}'::jsonb,
          'cozum/' || d_b || '/' || o3 || '.jpg', 0, 4, 0, 0, 'puanlandi');

  -- ===========================================================================
  raise notice '--- 1. Veriliş tarihi `created_at` DEĞİL ---';
  -- ===========================================================================
  c := public.sinif_not_cizelgesi(jt, v_a);
  select e into o from jsonb_array_elements(c->'odevler') e where e->>'id' = d_a::text;
  if o is null then
    raise exception '1a BAŞARISIZ — ödev çizelgede yok';
  end if;
  if o->'tarihler' is null or o->'tarihler' = 'null'::jsonb then
    raise exception '1b BAŞARISIZ — tarihler alanı hiç gelmiyor';
  end if;
  if (o->'tarihler'->>'verilis')::timestamptz is distinct from z then
    raise exception '1c BAŞARISIZ — veriliş % beklenirken %', z, o->'tarihler'->>'verilis';
  end if;
  -- `created_at` BUGÜN. Alan ondan okunsaydı 1c geçer, bu ısırırdı.
  if (o->'tarihler'->>'verilis')::timestamptz::date = current_date then
    raise exception '1d BAŞARISIZ — veriliş created_at''ten okunuyor';
  end if;
  raise notice '    veriliş 9 gün önce, created_at bugün: OK';

  -- ===========================================================================
  raise notice '--- 2–3. Sınıf ve düzey ortalaması ---';
  -- ===========================================================================
  k := o->'kiyas';
  if k->>'durum' <> 'hazir' then
    raise exception '2a BAŞARISIZ — kıyas hazır değil: %', k::text;
  end if;
  if (k->'sinif'->>'ortalama')::numeric is distinct from 75 then
    raise exception '2b BAŞARISIZ — sınıf ortalaması 75 beklenirken %',
      k->'sinif'->>'ortalama';
  end if;
  -- DÜZEY: iki şube birden (50 + 100 + 0) / 3 = 50.
  if k->'seviye' = 'null'::jsonb or k->'seviye' is null then
    raise exception '3a BAŞARISIZ — iki şube varken düzey ortalaması yok: %', k::text;
  end if;
  if (k->'seviye'->>'ortalama')::numeric is distinct from 50 then
    raise exception '3b BAŞARISIZ — düzey ortalaması 50 beklenirken %',
      k->'seviye'->>'ortalama';
  end if;
  if k->'seviye'->>'ad' <> '7. sınıflar' then
    raise exception '3c BAŞARISIZ — düzey adı yanlış: %', k->'seviye'->>'ad';
  end if;
  raise notice '    sınıf 75, düzey 50 (7. sınıflar): OK';

  -- TEK ŞUBEYE verilmiş ödevde düzey satırı YOK (öğretmenin kuralı:
  -- "diğer şubelere verilmemişse sadece ödevin verildiği sınıf ortalaması").
  d_tek := (public.odev_olustur(jt, 'Yalnız C ' || ek, null, v_a, 'test',
            current_date - 1, 2, '{"1":"A","2":"B"}'::jsonb))->>'id';
  perform public.odev_yayinla(jt, d_tek);
  insert into public.gonderimler (odev_id, ogrenci_id, cevaplar, foto_yolu,
                                  dogru, yanlis, bos, puan, durum)
  values (d_tek, o1, '{"1":"A","2":"B"}'::jsonb,
          'cozum/' || d_tek || '/' || o1 || '.jpg', 2, 0, 0, 100, 'puanlandi');
  c := public.sinif_not_cizelgesi(jt, v_a);
  select e->'kiyas' into k from jsonb_array_elements(c->'odevler') e
   where e->>'id' = d_tek::text;
  if k->'seviye' is distinct from 'null'::jsonb then
    raise exception '3d BAŞARISIZ — tek şubede düzey ortalaması verildi: %', k::text;
  end if;
  if (k->'sinif'->>'ortalama')::numeric is distinct from 100 then
    raise exception '3e BAŞARISIZ — tek şubede sınıf ortalaması yanlış: %', k::text;
  end if;
  raise notice '    tek şubede düzey null, sınıf dolu: OK';

  -- ===========================================================================
  raise notice '--- 4. TESLİM SAYILARI yanıtta YOK ---';
  -- ===========================================================================
  -- Öğretmenin kararı: "Teslim sayısı veliye ya da öğrenciye
  -- gösterilmesin." Ekrandan gizlemek yetmez, yanıttan da çıkıyor
  -- (Part XXI). Hesap `_odev_kiyasi` içinde yapılmaya devam ediyor.
  select e->'kiyas' into k from jsonb_array_elements(c->'odevler') e
   where e->>'id' = d_a::text;
  if k->'sinif' ? 'adet' or k->'seviye' ? 'adet'
     or k ? 'sube_adet' or k ? 'teslim' then
    raise exception '4a BAŞARISIZ — TESLİM SAYISI KIYASTA SIZDI: %', k::text;
  end if;
  raise notice '    kıyasta teslim sayısı yok: OK';

  -- ===========================================================================
  raise notice '--- 5. Süresi dolmamış ödevde kıyas yok ---';
  -- ===========================================================================
  d_gelecek := (public.odev_olustur(jt, 'Gelecek ' || ek, null, v_a, 'test',
                current_date + 7, 2, '{"1":"A","2":"B"}'::jsonb))->>'id';
  perform public.odev_yayinla(jt, d_gelecek);
  c := public.sinif_not_cizelgesi(jt, v_a);
  select e->'kiyas' into k from jsonb_array_elements(c->'odevler') e
   where e->>'id' = d_gelecek::text;
  if k->>'durum' <> 'sure_dolmadi' then
    raise exception '5a BAŞARISIZ — süresi dolmadan kıyas verildi: %', k::text;
  end if;
  -- Hücre de "süresi devam ediyor" demeli: veliye "göndermedi" yazmak
  -- süresi dolmamış bir ödevde yanlış olurdu.
  select (select r->>'durum' from jsonb_array_elements(e->'puanlar') r
           where r->>'odev_id' = d_gelecek::text)
    into kod from jsonb_array_elements(c->'ogrenciler') e
   where e->>'id' = o2::text;
  if kod <> 'suresi_devam' then
    raise exception '5b BAŞARISIZ — süresi dolmamış ödevde durum %', kod;
  end if;
  raise notice '    süresi dolmadan kıyas yok, hücre "suresi_devam": OK';

  -- ===========================================================================
  raise notice '--- 6. Çalışma kağıdında ve özel derste kıyas yok ---';
  -- ===========================================================================
  d_calisma := (public.odev_olustur(jt, 'Alıştırma ' || ek, null, v_a, 'calisma',
                current_date - 1, null, null))->>'id';
  perform public.odev_yayinla(jt, d_calisma);
  c := public.sinif_not_cizelgesi(jt, v_a);
  -- 0086: çalışma kağıdı ızgarada sütun AÇMIYOR, yani çizelgede hiç yok.
  if exists (select 1 from jsonb_array_elements(c->'odevler') e
               where e->>'id' = d_calisma::text) then
    raise exception '6a BAŞARISIZ — çalışma kağıdı puan ızgarasına girdi';
  end if;

  d_ozel := (public.odev_olustur(jt, 'Özel ' || ek, null, v_ozel, 'test',
             current_date - 1, 2, '{"1":"A","2":"B"}'::jsonb))->>'id';
  perform public.odev_yayinla(jt, d_ozel);
  insert into public.gonderimler (odev_id, ogrenci_id, cevaplar, foto_yolu,
                                  dogru, yanlis, bos, puan, durum)
  values (d_ozel, o_ozel, '{"1":"A","2":"B"}'::jsonb,
          'cozum/' || d_ozel || '/' || o_ozel || '.jpg', 2, 0, 0, 100, 'puanlandi');
  select e->'kiyas' into k
    from jsonb_array_elements((public.sinif_not_cizelgesi(jt, v_ozel))->'odevler') e
   where e->>'id' = d_ozel::text;
  if k->>'durum' <> 'kiyas_yok' then
    raise exception '6b BAŞARISIZ — özel derste kıyas verildi: %', k::text;
  end if;
  raise notice '    çalışma kağıdı ızgarada yok, özel derste kıyas yok: OK';

  -- ===========================================================================
  raise notice '--- 7. Soru dökümü: yalnız NUMARA, yalnız testte (Kural 6) ---';
  -- ===========================================================================
  c := public.sinif_not_cizelgesi(jt, v_a);
  select (select r from jsonb_array_elements(e->'puanlar') r
           where r->>'odev_id' = d_a::text)
    into p from jsonb_array_elements(c->'ogrenciler') e where e->>'id' = o1::text;
  if p is null then
    raise exception '7a BAŞARISIZ — hücre yok';
  end if;
  -- o1: 1 ve 2 doğru, 3 ve 4 yanlış işaretlendi.
  if p->'yanlis_sorular' is null or p->'yanlis_sorular' = '[]'::jsonb then
    raise exception '7b BAŞARISIZ — yanlış soru numaraları gelmiyor: %', p::text;
  end if;
  if not (p->'yanlis_sorular' @> '[3,4]'::jsonb) then
    raise exception '7c BAŞARISIZ — yanlış sorular 3 ve 4 beklenirken %',
      p->'yanlis_sorular';
  end if;
  if (p->>'dogru')::integer is distinct from 2
     or (p->>'yanlis')::integer is distinct from 2 then
    raise exception '7d BAŞARISIZ — doğru/yanlış sayıları yanlış: %', p::text;
  end if;
  -- KURAL 6: işaretlenen şık ve cevap anahtarı HÜCREDE YOK.
  if p ? 'cevaplar' or p ? 'cevap_anahtari' or p ? 'secilen' then
    raise exception '7e BAŞARISIZ — ŞIK HÜCREYE SIZDI: %', p::text;
  end if;
  -- AÇIK UÇLUDA DÖKÜM YOK: anahtar olmadığı için her soru "boş" görünür
  -- ve o sayı veliye yanlış bilgi olurdu.
  d_acik := (public.odev_olustur(jt, 'Açık ' || ek, null, v_a, 'acik',
             current_date - 1, 3, null))->>'id';
  perform public.odev_yayinla(jt, d_acik);
  insert into public.gonderimler (odev_id, ogrenci_id, foto_yolu, ogretmen_puan, durum)
  values (d_acik, o1, 'cozum/' || d_acik || '/' || o1 || '.jpg', 80, 'puanlandi');
  c := public.sinif_not_cizelgesi(jt, v_a);
  select (select r from jsonb_array_elements(e->'puanlar') r
           where r->>'odev_id' = d_acik::text)
    into p from jsonb_array_elements(c->'ogrenciler') e where e->>'id' = o1::text;
  if p->'yanlis_sorular' is distinct from '[]'::jsonb
     or p->'bos_sorular' is distinct from '[]'::jsonb then
    raise exception '7f BAŞARISIZ — açık uçluda soru dökümü verildi: %', p::text;
  end if;
  if (p->>'puan')::numeric is distinct from 80 then
    raise exception '7g BAŞARISIZ — açık uçluda öğretmen puanı okunmuyor: %', p::text;
  end if;
  raise notice '    numara var, şık yok; açık uçluda döküm yok: OK';

  -- ===========================================================================
  raise notice '--- 8. Gecikmeli teslim işareti ---';
  -- ===========================================================================
  -- o2 `d_tek`i son tarihten SONRA gönderdi.
  insert into public.gonderimler (odev_id, ogrenci_id, cevaplar, foto_yolu,
                                  dogru, yanlis, bos, puan, durum, created_at)
  values (d_tek, o2, '{"1":"A","2":"B"}'::jsonb,
          'cozum/' || d_tek || '/' || o2 || '.jpg', 2, 0, 0, 100, 'puanlandi',
          now());
  c := public.sinif_not_cizelgesi(jt, v_a);
  select (select r from jsonb_array_elements(e->'puanlar') r
           where r->>'odev_id' = d_tek::text)
    into p from jsonb_array_elements(c->'ogrenciler') e where e->>'id' = o2::text;
  if (p->>'gecikmeli')::boolean is distinct from true then
    raise exception '8a BAŞARISIZ — gecikmeli teslim işaretlenmedi: %', p::text;
  end if;
  -- o1 zamanında gönderdi (son tarih dün, gönderim bugün değil) — 1. ödevde
  -- gönderim zamanı son tarihten sonra olduğu için bu ödev değil `d_a`
  -- üzerinden ölçülüyor: orada gönderim de son tarih de geçmişte.
  select (select (r->>'gecikmeli')::boolean::integer
            from jsonb_array_elements(e->'puanlar') r
           where r->>'odev_id' = d_a::text)
    into n from jsonb_array_elements(c->'ogrenciler') e where e->>'id' = o2::text;
  if n is null then
    raise exception '8b BAŞARISIZ — gecikmeli alanı hiç gelmiyor';
  end if;
  raise notice '    son tarihten sonra gönderim gecikmeli: OK';

  -- ===========================================================================
  raise notice '--- 9. Eksik konular — `sinif_ogrenci_ozeti` ile AYNI ---';
  -- ===========================================================================
  -- o1 "Köklü sayılar"da 2 soruyu da yanlış yaptı; alt sınır 5 soru
  -- olduğu için tek ödevle konu listeye GİRMEMELİ.
  select e->'eksik_konular' into k from jsonb_array_elements(c->'ogrenciler') e
   where e->>'id' = o1::text;
  if k is null then
    raise exception '9a BAŞARISIZ — eksik_konular alanı hiç gelmiyor';
  end if;
  if k <> '[]'::jsonb then
    raise exception '9b BAŞARISIZ — 5 soru altındaki konu listeye girdi: %', k::text;
  end if;
  -- İKİ UCUN SONUCU AYNI OLMALI. Ayrışırsa veliye başka, öğretmene başka
  -- konu yazılır.
  if k is distinct from (
       select e->'eksik_konular'
         from jsonb_array_elements((public.sinif_ogrenci_ozeti(jt, v_a))->'ogrenciler') e
        where e->>'id' = o1::text) then
    raise exception '9c BAŞARISIZ — çizelge ile özet AYRIŞTI';
  end if;
  raise notice '    alt sınır tutuyor, iki uç aynı: OK';

  -- ===========================================================================
  raise notice '--- 10. 0086''nın alanları yerinde + 0091 zincirde ---';
  -- ===========================================================================
  -- 0088'de kopya 0085'i sessizce geri almıştı; bu grup çalışma anında
  -- ölçüyor, öz-denetim gövde metnine bakıyor.
  if c->'aylar' is null or c->>'kapsam' is null
     or c->'sinif'->>'ad' is null then
    raise exception '10a BAŞARISIZ — çizelgenin gövde alanları eksik';
  end if;
  select e into o from jsonb_array_elements(c->'ogrenciler') e where e->>'id' = o1::text;
  if not (o ? 'ortalama_tum') or not (o ? 'ortalama_yapan')
     or not (o ? 'calisma_sayisi') or not (o ? 'yapti') or not (o ? 'yapmadi') then
    raise exception '10b BAŞARISIZ — öğrenci satırının eski alanları eksik: %',
      (select string_agg(x, ', ') from jsonb_object_keys(o) x);
  end if;
  select count(*) into n from public.uygulanan_migrationlar where dosya = '0091';
  if n <> 1 then
    raise exception '10c BAŞARISIZ — 0091 kaydı yok';
  end if;
  raise notice '    eski alanlar yerinde, 0091 zincirde: OK';

  raise notice '';
  raise notice 'VELİ ÇİZELGESİ TESTLERİ GEÇTİ (10 grup)';
end $$;
