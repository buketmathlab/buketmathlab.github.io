-- =============================================================================
-- SEKİZ — ANKET KAPSAMI TESTLERİ (0081)
--
-- Öğretmenin isteği: kendi derse girdiği sınıfların anketini ayrı, tüm
-- okulunkini ayrı görmek; diğer öğretmenler de aynısını kendi sınıfları
-- için görsün.
--
-- DOSYA ADI: `anket_testleri.sql` ZATEN VAR (0076'nın süiti). Geçen turda
-- bir süit var olan bir adla yazılıp 0022'ninkini SESSİZCE EZMİŞTİ ve
-- zincir yeşil kalmıştı. Bu dosyanın adı da, bitiş satırı da ayrı.
--
-- BU SÜİTİN ASIL SORUSU İKİ TANE:
--   1. Kapsam DOĞRU mu süzüyor — dar kapsamda başka sınıfın yanıtı var mı?
--   2. Kapsam bir KAPI mı — B öğretmeni A'nın sınıfını görebiliyor mu?
--
-- Hiçbir blokta `exception when others` YOK: öyle bir yakalayıcı kendinden
-- önceki bütün grupların hatalarını yutar ve test hiçbir şey ölçmemiş olur.
--
-- DÜNYA — iki sınıf, iki öğretmen:
--   9K  → sahip derse giriyor, "Kapsam Öğretmeni" de bağlı
--   9L  → YALNIZ sahip bağlı; sahip derse GİRMİYOR (işaret kapalı)
--   Her sınıfta 2 öğrenci + 1. öğrencinin velisi.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text;              -- sahip
  jo text;              -- düz öğretmen (yalnız 9K'ya bağlı)
  jm text;              -- müdür
  jvk text;             -- 9K'daki 1. öğrencinin velisi
  s_k uuid; s_l uuid;
  id_o uuid;            -- düz öğretmenin kimliği
  tk text[] := '{}';    -- 9K öğrenci jetonları
  tl text[] := '{}';    -- 9L öğrenci jetonları
  ek text := substr(md5(random()::text), 1, 6);
  r jsonb; v jsonb;
  i integer; n integer;
begin
  raise notice '--- Kurulum ---';
  update public.ogretmenler
     set pin_hash = extensions.crypt('Deneme!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Deneme!2026'))->>'token';

  if not exists (select 1 from public.ogretmenler where ad = 'Kapsam Öğretmeni') then
    perform public.ogretmen_ekle(jt, 'Kapsam Öğretmeni', 'KapsamOgr!26');
  end if;
  jo := (public.giris('KapsamOgr!26'))->>'token';
  select id into id_o from public.ogretmenler where ad = 'Kapsam Öğretmeni';

  if not exists (select 1 from public.ogretmenler where ad = 'Kapsam Müdürü') then
    perform public.mudur_ekle(jt, 'Kapsam Müdürü', 'KapsamMudur!26');
  end if;
  jm := (public.giris('KapsamMudur!26'))->>'token';

  -- Şube en çok iki BÜYÜK harf (`siniflar_sube_check`). Sabit kodlar
  -- kullanılıyor ve süit kendi sınıflarını önce siliyor: iki kez
  -- koşulabilmeli (0051'in dersi).
  delete from public.siniflar where seviye = 9 and sube in ('KX', 'LX');
  s_k := (public.sinif_ekle(jt,  9::smallint, 'KX'))->>'id';
  s_l := (public.sinif_ekle(jt,  9::smallint, 'LX'))->>'id';

  for i in 1 .. 2 loop
    r := public.ogrenci_ekle(jt, 'Kapsam K' || i || ' ' || ek, 'okul', s_k);
    tk := tk || ((public.giris(r->>'ogrenci_kodu'))->>'token');
    if i = 1 then jvk := (public.giris(r->>'veli_kodu'))->>'token'; end if;
    r := public.ogrenci_ekle(jt, 'Kapsam L' || i || ' ' || ek, 'okul', s_l);
    tl := tl || ((public.giris(r->>'ogrenci_kodu'))->>'token');
  end loop;

  -- Düz öğretmen YALNIZ 9K'ya bağlı. 5. grup bunun bir KAPI olduğunu ölçüyor.
  perform public.ogretmen_sinif_ata(jt, id_o, jsonb_build_array(s_k::text));

  -- Sahip 9L'ye derse GİRMİYOR. (0033 bütün sınıfları sahibe bağlamış;
  -- işaret bu yüzden var.)
  perform public.sinif_dersine_giriyor(jt, s_l, false);
  perform public.sinif_dersine_giriyor(jt, s_k, true);

  delete from public.anketler where kod = 'kapsam-anket';
  insert into public.anketler (kod, baslik) values ('kapsam-anket', 'Kapsam testi');
  update public.anketler set acik = false;
  perform public.anket_ac_kapat(jt, 'kapsam-anket', true);

  -- ===========================================================================
  raise notice '--- 1. Öğrenci ve veli yanıtı sınıfını taşıyor ---';
  perform public.anket_yanitla(tk[1],
    '{"m1":5,"m2":5,"m3":5,"m4":5,"m5":5,"m6":5,"m7":5,"acik":"K sınıfı görüşü"}'::jsonb);
  perform public.onam_ver(jvk, public._gecerli_onam_surumu(), 'Kapsam Velisi');
  perform public.anket_yanitla(jvk, '{"m1":4,"m2":4,"m3":4,"m4":4,"m5":4}'::jsonb);

  select count(*) into n from public.anket_yanitlari
   where anket = 'kapsam-anket' and rol = 'ogrenci' and sinif_id = s_k;
  if n <> 1 then raise exception '1a: öğrenci yanıtı sınıfını taşımıyor (%)', n; end if;

  -- VELİNİN SINIFI ÇOCUĞUNUN SINIFI.
  select count(*) into n from public.anket_yanitlari
   where anket = 'kapsam-anket' and rol = 'veli' and sinif_id = s_k;
  if n <> 1 then raise exception '1b: veli yanıtı çocuğunun sınıfını taşımıyor (%)', n; end if;
  raise notice '    öğrenci ve veli yanıtı 9K''ya bağlı: OK';

  -- ===========================================================================
  raise notice '--- 2. Öğretmen yanıtında sınıf YOK ---';
  perform public.anket_yanitla(jo, '{"m1":3,"m2":3,"m3":3,"m4":3,"m5":3,"acik":"Öğretmen görüşü"}'::jsonb);
  select count(*) into n from public.anket_yanitlari
   where anket = 'kapsam-anket' and rol = 'ogretmen' and sinif_id is not null;
  if n <> 0 then
    raise exception '2a: ÖĞRETMEN YANITI SINIF TAŞIYOR — 4 kişilik grupta kimliği ele verir (%)', n;
  end if;
  raise notice '    öğretmen yanıtı sınıfsız: OK';

  -- ===========================================================================
  raise notice '--- 3. Formda sınıf sorulmuyor ---';
  -- İmza değişmedi: ekran hâlâ yalnız cevapları gönderiyor.
  if to_regprocedure('public.anket_yanitla(text,jsonb)') is null then
    raise exception '3a: anket_yanitla imzası değişmiş — ekran sınıf göndermek zorunda kalır';
  end if;
  -- Gönderilen fazla anahtar alınmıyor (0076'nın kuralı sürüyor).
  perform public.anket_yanitla(tk[2],
    jsonb_build_object('m1',1,'m2',1,'m3',1,'m4',1,'m5',1,'m6',1,'m7',1,
                       'sinif_id', s_l::text, 'sinif', '9L'));
  if exists (select 1 from public.anket_yanitlari
              where anket = 'kapsam-anket' and (cevaplar ? 'sinif' or cevaplar ? 'sinif_id')) then
    raise exception '3b: GÖNDERİLEN SINIF ANAHTARI KAYDEDİLDİ';
  end if;
  -- Ve yanıt yine KENDİ sınıfına yazıldı, gönderilene değil.
  select count(*) into n from public.anket_yanitlari
   where anket = 'kapsam-anket' and rol = 'ogrenci' and sinif_id = s_k;
  if n <> 2 then raise exception '3c: yanıt gönderilen sınıfa yazıldı (%)', n; end if;
  raise notice '    sınıf sorulmuyor, gönderilen de dikkate alınmıyor: OK';

  -- ===========================================================================
  raise notice '--- 4. "Kendi sınıflarım" yalnız işaretli sınıfları topluyor ---';
  perform public.anket_yanitla(tl[1], '{"m1":2,"m2":2,"m3":2,"m4":2,"m5":2,"m6":2,"m7":2,"acik":"L sınıfı görüşü"}'::jsonb);

  select g into v from jsonb_array_elements(public.anket_sonuclari(jt, 'kendi')) a,
         jsonb_array_elements(a->'gruplar') g
   where a->>'anket' = 'kapsam-anket' and g->>'rol' = 'ogrenci';
  if (v->>'yanit')::int <> 2 then
    raise exception '4a: kendi kapsamında 9L sızdı ya da 9K eksik (%)', v->>'yanit';
  end if;
  if v->'gorusler' @> '["L sınıfı görüşü"]'::jsonb then
    raise exception '4b: DERSE GİRİLMEYEN SINIFIN GÖRÜŞÜ KENDİ KAPSAMINDA';
  end if;

  -- İşaret açılınca 9L de giriyor — bayrak gerçekten okunuyor.
  perform public.sinif_dersine_giriyor(jt, s_l, true);
  select g into v from jsonb_array_elements(public.anket_sonuclari(jt, 'kendi')) a,
         jsonb_array_elements(a->'gruplar') g
   where a->>'anket' = 'kapsam-anket' and g->>'rol' = 'ogrenci';
  if (v->>'yanit')::int <> 3 then
    raise exception '4c: işaret açılınca 9L girmedi (%)', v->>'yanit';
  end if;
  perform public.sinif_dersine_giriyor(jt, s_l, false);
  raise notice '    işaret kapalıyken dışarıda, açıkken içeride: OK';

  -- ===========================================================================
  raise notice '--- 5. Sınıf kapsamı bir KAPI ---';
  select g into v from jsonb_array_elements(public.anket_sonuclari(jt, 'sinif', s_k)) a,
         jsonb_array_elements(a->'gruplar') g
   where a->>'anket' = 'kapsam-anket' and g->>'rol' = 'ogrenci';
  if (v->>'yanit')::int <> 2 then raise exception '5a: 9K sınıf kapsamı yanlış (%)', v->>'yanit'; end if;

  -- Düz öğretmen YALNIZ 9K'ya bağlı: 9L'yi kimliğini bilse de göremiyor.
  begin
    perform public.anket_sonuclari(jo, 'sinif', s_l);
    raise exception '5b: ÖĞRETMEN BAŞKASININ SINIFININ ANKETİNİ GÖRDÜ';
  exception when insufficient_privilege then null; end;

  -- Sahip de derse girmediği sınıfı göremiyor: işaret gerçekten kapı.
  begin
    perform public.anket_sonuclari(jt, 'sinif', s_l);
    raise exception '5c: DERSE GİRİLMEYEN SINIF AÇILDI';
  exception when insufficient_privilege then null; end;

  -- Müdür her sınıfı görüyor (0060).
  if jsonb_array_length(public.anket_sonuclari(jm, 'sinif', s_l)) = 0 then
    raise exception '5d: müdür sınıf kapsamını göremedi';
  end if;
  raise notice '    kendi sınıfı açık, başkasınınki 42501, müdür hepsini görüyor: OK';

  -- ===========================================================================
  raise notice '--- 6. Dar kapsamlarda öğretmen grubu YOK ---';
  for i in 1 .. 2 loop
    v := case i when 1 then public.anket_sonuclari(jt, 'kendi')
                else public.anket_sonuclari(jt, 'sinif', s_k) end;
    -- İDDİALAR KENDİ ANKETİNE DARALTILDI: veritabanında gerçek anket
    -- ('2026-2027-1') da duruyor ve grupları sayıya karışıyordu.
    if exists (select 1 from jsonb_array_elements(v) a,
                            jsonb_array_elements(a->'gruplar') x
                where a->>'anket' = 'kapsam-anket' and x->>'rol' = 'ogretmen') then
      raise exception '6a: DAR KAPSAMDA ÖĞRETMEN GRUBU VAR (kapsam %)', i;
    end if;
    -- POZİTİF KONTROL: öğrenci ve veli grupları gerçekten geldi — yoksa
    -- "öğretmen grubu yok" iddiası boş bir sonuçta da doğru çıkardı.
    select count(*) into n from jsonb_array_elements(v) a,
           jsonb_array_elements(a->'gruplar') x
     where a->>'anket' = 'kapsam-anket' and x->>'rol' in ('ogrenci', 'veli');
    if n <> 2 then raise exception '6b: pozitif kontrol — öğrenci/veli grubu eksik (%)', n; end if;
  end loop;
  raise notice '    kendi ve sınıf kapsamında yalnız öğrenci ve veli: OK';

  -- ===========================================================================
  raise notice '--- 7. Öğretmen anketi yalnız sahip ve müdüre ---';
  if exists (select 1 from jsonb_array_elements(public.anket_sonuclari(jo, 'okul')) a,
                          jsonb_array_elements(a->'gruplar') x
              where x->>'rol' = 'ogretmen') then
    raise exception '7a: ÖĞRETMENE ÖĞRETMEN ANKETİ GÖRÜNDÜ';
  end if;
  -- Ama tüm okul sonucunu görüyor (öğretmenin kararı).
  select count(*) into n from jsonb_array_elements(public.anket_sonuclari(jo, 'okul')) a,
         jsonb_array_elements(a->'gruplar') x
   where a->>'anket' = 'kapsam-anket' and x->>'rol' in ('ogrenci', 'veli');
  if n <> 2 then raise exception '7b: öğretmen tüm okul sonucunu göremedi (%)', n; end if;

  for i in 1 .. 2 loop
    v := case i when 1 then public.anket_sonuclari(jt, 'okul')
                else public.anket_sonuclari(jm, 'okul') end;
    if not exists (select 1 from jsonb_array_elements(v) a,
                                jsonb_array_elements(a->'gruplar') x
                    where a->>'anket' = 'kapsam-anket' and x->>'rol' = 'ogretmen') then
      raise exception '7c: sahip/müdür öğretmen grubunu göremedi (%)', i;
    end if;
  end loop;
  raise notice '    öğretmende yok, sahip ve müdürde var: OK';

  -- ===========================================================================
  raise notice '--- 8. Sınıfsız (eski) yanıtlar ---';
  -- 0081 öncesinden kalma bir yanıt taklidi: sınıfı yok.
  insert into public.anket_yanitlari (anket, rol, cevaplar, hafta, sinif_id)
  values ('kapsam-anket', 'ogrenci',
          '{"m1":5,"m2":5,"m3":5,"m4":5,"m5":5,"m6":5,"m7":5,"acik":"Eski yanıt"}'::jsonb,
          date_trunc('week', now())::date, null);

  select a into v from jsonb_array_elements(public.anket_sonuclari(jt, 'okul')) a
   where a->>'anket' = 'kapsam-anket';
  if (v->>'sinifsiz_yanit')::int <> 1 then
    raise exception '8a: sınıfsız yanıt sayısı yanlış (%)', v->>'sinifsiz_yanit';
  end if;
  select g into v from jsonb_array_elements(public.anket_sonuclari(jt, 'okul')) a,
         jsonb_array_elements(a->'gruplar') g
   where a->>'anket' = 'kapsam-anket' and g->>'rol' = 'ogrenci';
  if not (v->'gorusler' @> '["Eski yanıt"]'::jsonb) then
    raise exception '8b: eski yanıt genel sonuçta yok — sessizce kayboldu';
  end if;

  -- Dar kapsamda YOK: sınıfı bilinmiyor, bir sınıfa sayılamaz.
  select g into v from jsonb_array_elements(public.anket_sonuclari(jt, 'kendi')) a,
         jsonb_array_elements(a->'gruplar') g
   where a->>'anket' = 'kapsam-anket' and g->>'rol' = 'ogrenci';
  if v->'gorusler' @> '["Eski yanıt"]'::jsonb then
    raise exception '8c: SINIFSIZ YANIT DAR KAPSAMA GİRDİ';
  end if;
  if (v->>'sinifsiz_yanit')::int <> 0 then
    raise exception '8d: dar kapsamda sınıfsız sayısı anılıyor';
  end if;
  raise notice '    genel sonuçta sayılıyor ve yazılı, dar kapsamda yok: OK';

  -- ===========================================================================
  raise notice '--- 9. Alt sınır yok (0077 sürüyor) ---';
  -- 9L'de TEK yanıt var; dağılım ve görüş yine de dönüyor.
  select g into v from jsonb_array_elements(public.anket_sonuclari(jm, 'sinif', s_l)) a,
         jsonb_array_elements(a->'gruplar') g
   where a->>'anket' = 'kapsam-anket' and g->>'rol' = 'ogrenci';
  if (v->>'yanit')::int <> 1 or not (v->>'yeterli')::boolean
     or jsonb_array_length(v->'maddeler') <> 7
     or not (v->'gorusler' @> '["L sınıfı görüşü"]'::jsonb) then
    raise exception '9a: tek yanıtta sonuç gösterilmedi: %', v;
  end if;
  raise notice '    tek yanıt da dağılım ve görüş döndürüyor: OK';

  -- ===========================================================================
  raise notice '--- 10. Anonimlik korunuyor ---';
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'anket_yanitlari'
                and column_name in ('ogrenci_id', 'ogretmen_id', 'kisi_ozeti', 'created_at')) then
    raise exception '10a: anket_yanitlari kimlik ya da saat taşıyor';
  end if;
  -- İki tablo arasında bağ YOK: katılım özetinde sınıf da yok.
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'anket_katilimlari'
                and column_name = 'sinif_id') then
    raise exception '10b: anket_katilimlari sınıf taşıyor — özet bir sınıfa bağlandı';
  end if;
  -- Yanıt gönderimi denetim izine yazılmıyor (0076'nın kuralı).
  if exists (select 1 from public.denetim_izi where islem like 'anket%yanit%') then
    raise exception '10c: anket yanıtı denetim izine yazıldı';
  end if;
  raise notice '    kimlik yok, saat yok, katılım özeti sınıfsız, iz yok: OK';

  -- ===========================================================================
  raise notice '--- 11. Eski kapsamsız uç düşürüldü (0007 tuzağı) ---';
  if to_regprocedure('public.anket_sonuclari(text)') is not null then
    raise exception '11a: ESKİ anket_sonuclari(text) DURUYOR — PostgREST onu çağırır';
  end if;
  if to_regprocedure('public.anket_sonuclari(text,text,uuid)') is null then
    raise exception '11b: kapsamlı uç yok';
  end if;
  -- Geçersiz kapsam sessizce "okul" sayılmıyor.
  begin
    perform public.anket_sonuclari(jt, 'hepsi');
    raise exception '11c: GEÇERSİZ KAPSAM KABUL EDİLDİ';
  exception when invalid_parameter_value or data_exception then null; end;
  raise notice '    eski uç yok, geçersiz kapsam reddediliyor: OK';

  -- ===========================================================================
  raise notice '--- 12. Sınıf silinince yanıt kaybolmuyor ---';
  --
  -- 0068: YALNIZ BOŞ SINIF SİLİNEBİLİYOR ve öğrenci silinmiyor, pasifleşiyor.
  -- Yani bu yol ürün akışından bugün ULAŞILAMAZ; `on delete set null` bir
  -- İKİNCİ GÜVENCE. Yine de ölçülüyor: sahip panelde elle SQL çalıştırıyor
  -- ve bir gün bir sınıfı oradan silebilir. O anda anket yanıtlarının
  -- sessizce yok olması, sayıların bir daha güvenilmez hâle gelmesi demek.
  --
  -- Senaryo gerçeğe sadık kuruluyor: önce sınıf GERÇEKTEN boşaltılıyor
  -- (yanıtların öğrenciyle bağı zaten yok — anonimlik), sonra sınıf
  -- ürünün kendi ucuyla siliniyor.
  select count(*) into n from public.anket_yanitlari where anket = 'kapsam-anket';
  delete from public.oturumlar o using public.ogrenciler g
   where o.ogrenci_id = g.id and g.sinif_id = s_l;
  delete from public.ogrenciler where sinif_id = s_l;
  perform public.sinif_sil(jt, s_l);
  if (select count(*) from public.anket_yanitlari where anket = 'kapsam-anket') <> n then
    raise exception '12a: SINIF SİLİNİNCE YANIT DA SİLİNDİ';
  end if;
  if exists (select 1 from public.anket_yanitlari
              where anket = 'kapsam-anket' and sinif_id = s_l) then
    raise exception '12b: silinen sınıfın kimliği yanıtta duruyor';
  end if;
  -- Ve genel sonuçta hâlâ sayılıyor, artık "sınıfsız" olarak.
  select a into v from jsonb_array_elements(public.anket_sonuclari(jt, 'okul')) a
   where a->>'anket' = 'kapsam-anket';
  if (v->>'sinifsiz_yanit')::int <> 2 then
    raise exception '12c: silinen sınıfın yanıtı sınıfsıza geçmedi (%)', v->>'sinifsiz_yanit';
  end if;
  raise notice '    yanıt duruyor, genel sonuca düştü: OK';

  -- Temizlik: süit iki kez koşulabilmeli (0051'in dersi). Anket gidince
  -- yanıtları da gidiyor (`on delete cascade`); sınıflar da siliniyor.
  delete from public.anketler where kod = 'kapsam-anket';
  delete from public.oturumlar o using public.ogrenciler g
   where o.ogrenci_id = g.id and g.sinif_id = s_k;
  delete from public.ogrenciler where sinif_id = s_k;
  perform public.sinif_sil(jt, s_k);

  raise notice 'ANKET KAPSAMI TESTLERİ: 12 GRUP GEÇTİ';
end $$;
