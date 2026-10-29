-- =============================================================================
-- SEKİZ — ÖDEVİN VERİLİŞ TARİHİ, SON TESLİM TARİHİ VE UZATMA (0085)
--
-- Öğretmenin isteği: "Ödevleri verdiğim tarih de ödevin üzerinde yazsın
-- geriye dönüp baktığımda. Yani veriliş tarihi ve son teslim tarihi
-- yazsın. Eğer teslim tarihinde uzatma yaptıysam o ekstra belirtilsin."
--
-- Ölçülen:
--   1. TASLAK: veriliş tarihi null — uydurulmuyor
--   2. YAYINLANAN: veriliş, `odev_yayinlandi` satırının ZAMANI (created_at
--      değil — ikisi bilerek ayrıştırılıyor)
--   3. Tarihi DEĞİŞTİRMEYEN düzenleme uzatma SAYILMIYOR (1. tuzak)
--   4. Gerçek uzatma: ilk tarih + `yon = uzatildi`
--   5. Tarih ÖNE alınırsa `yon = one_alindi` (2. tuzak)
--   6. İki kez değişti: `degisiklik = 2`, ilk tarih İLK olan
--   7. TASLAKTAYKEN değişen tarih uzatma sayılmıyor (3. tuzak)
--   8. Tarih ilk hâline geri dönerse `yon` null (bilinen sınır)
--   9. DÖRT UÇ AYNI nesneyi veriyor: öğretmen sayfası, öğretmen listesi,
--      öğrenci, veli
--  10. Kişisel ek süre (0081/0084) `tarihler`'e karışmıyor
--  11. `_odev_tarihleri` istemciye kapalı
--  12. Zincirin sonu 0085
--
-- ZAMAN ÇİZGİSİ NEDEN ELLE KURULUYOR
--
-- `now()` bir işlem boyunca DONUK. Tek işlemde yayınla + güncelle
-- yapılınca denetim izindeki iki satırın `zaman`'ı birebir aynı oluyor;
-- oysa gerçekte araya günler giriyor. Bu yüzden testler `odev_yayinlandi`
-- satırının zamanını GERİYE alıyor — ölçülen şeyi (yayından önce / sonra)
-- gerçek hayattaki gibi ayırmanın tek yolu bu.
--
-- Tekrar çalıştırılabilir. Hiçbir blokta `exception when others` YOK.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  ek text := substr(md5(random()::text), 1, 6);
  jt text; jo text; jv text;
  s_id uuid; v_sinif uuid; v_ogr uuid;
  d_taslak uuid; d_yayin uuid; d_sessiz uuid; d_uzatma uuid;
  d_one uuid; d_iki uuid; d_taslak_degisim uuid; d_geri uuid;
  t jsonb; t2 jsonb; v jsonb;
  z timestamptz; n integer;
begin
  raise notice '--- Kurulum ---';
  update public.ogretmenler
     set pin_hash = extensions.crypt('Tarih!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Tarih!2026'))->>'token';
  select id into s_id from public.ogretmenler where yonetici;

  insert into public.siniflar (seviye, sube) values (9, 'T')
    on conflict (seviye, sube) do update set arsiv = false
    returning id into v_sinif;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    values (s_id, v_sinif) on conflict do nothing;

  -- Dosya tekrar çalıştırılabilir olmalı.
  delete from public.odev_ek_sure
   where odev_id in (select id from public.odevler where sinif_id = v_sinif);
  delete from public.gonderimler
   where odev_id in (select id from public.odevler where sinif_id = v_sinif);
  delete from public.denetim_izi
   where tablo = 'odevler'
     and kayit_id in (select id from public.odevler where sinif_id = v_sinif);
  delete from public.odevler where sinif_id = v_sinif;
  delete from public.giris_kodlari
   where ogrenci_id in (select id from public.ogrenciler where sinif_id = v_sinif);
  delete from public.ogrenciler where sinif_id = v_sinif;

  v_ogr := (public.ogrenci_ekle(jt, 'Tarih Öğrencisi ' || ek, 'okul', v_sinif))->>'id';
  jo := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_ogr and rol = 'ogrenci')))->>'token';
  jv := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_ogr and rol = 'veli')))->>'token';
  -- ONAM (0034): veli gerçek akışta onam vermeden hiçbir uca giremiyor.
  perform public.onam_ver(jv, public._gecerli_onam_surumu(), 'Tarih Velisi');

  -- ===========================================================================
  raise notice '--- 1. Taslakta veriliş tarihi YOK ---';
  -- ===========================================================================
  d_taslak := (public.odev_olustur(jt, 'Taslak ' || ek, null, v_sinif, 'test',
    current_date + 10, 2, '{"1":"A","2":"B"}'::jsonb, null, null, true, 4::smallint, null))->>'id';
  t := (public.odev_detay(jt, d_taslak))->'tarihler';

  if t is null or t = 'null'::jsonb then
    raise exception '1a BAŞARISIZ — odev_detay tarihler alanını hiç döndürmüyor';
  end if;
  if t->>'verilis' is not null then
    raise exception '1b BAŞARISIZ — taslakta veriliş tarihi var: %', t->>'verilis';
  end if;
  if (t->>'son_tarih')::date <> current_date + 10 then
    raise exception '1c BAŞARISIZ — son tarih yanlış: %', t->>'son_tarih';
  end if;
  if (t->>'degisiklik')::integer <> 0 or t->>'yon' is not null then
    raise exception '1d BAŞARISIZ — taslakta uzatma kaydı var: %', t::text;
  end if;
  raise notice '1 OK — taslak: veriliş null, uzatma yok, son tarih dolu';

  -- ===========================================================================
  raise notice '--- 2. Veriliş tarihi denetim izinden okunuyor ---';
  -- ===========================================================================
  d_yayin := (public.odev_olustur(jt, 'Yayın ' || ek, null, v_sinif, 'test',
    current_date + 10, 2, '{"1":"A","2":"B"}'::jsonb, null, null, true, 4::smallint, null))->>'id';
  perform public.odev_yayinla(jt, d_yayin);
  -- GERÇEK HAYAT: taslak bugün açılmadı, 10 gün önce yayınlandı.
  z := now() - interval '10 days';
  update public.denetim_izi set zaman = z
   where tablo = 'odevler' and kayit_id = d_yayin and islem = 'odev_yayinlandi';

  t := (public.odev_detay(jt, d_yayin))->'tarihler';
  if (t->>'verilis')::timestamptz is distinct from z then
    raise exception '2a BAŞARISIZ — veriliş % beklenirken %', z, t->>'verilis';
  end if;
  -- `created_at` BUGÜN. Alan ondan okunsaydı 2a geçer, bu ısırırdı.
  if (t->>'verilis')::timestamptz::date = current_date then
    raise exception '2b BAŞARISIZ — veriliş created_at''ten okunuyor';
  end if;

  -- 2c — İKİ KEZ YAYINLANIRSA İLK AN GEÇERLİ.
  -- `odev_yayinla` ikinci çağrıda da çalışıyor ve ikinci bir iz satırı
  -- yazıyor. Öğrencinin ödevi GÖRDÜĞÜ an ilk olanıdır; ikincisi yazılsa
  -- öğretmene ödevi verdiğinden günler sonra verdiği söylenirdi.
  perform public.odev_yayinla(jt, d_yayin);
  t := (public.odev_detay(jt, d_yayin))->'tarihler';
  if (t->>'verilis')::timestamptz is distinct from z then
    raise exception '2c BAŞARISIZ — ikinci yayınlama veriliş tarihini kaydırdı: %',
      t->>'verilis';
  end if;
  raise notice '2 OK — veriliş odev_yayinlandi satırının zamanı (%), ikinci yayın kaydırmıyor', z::date;

  -- ===========================================================================
  raise notice '--- 3. Tarihi değiştirmeyen düzenleme uzatma değil (1. tuzak) ---';
  -- ===========================================================================
  d_sessiz := (public.odev_olustur(jt, 'Sessiz ' || ek, null, v_sinif, 'test',
    current_date + 10, 2, '{"1":"A","2":"B"}'::jsonb, null, null, true, 4::smallint, null))->>'id';
  perform public.odev_yayinla(jt, d_sessiz);
  update public.denetim_izi set zaman = now() - interval '10 days'
   where tablo = 'odevler' and kayit_id = d_sessiz and islem = 'odev_yayinlandi';
  -- Yalnız BAŞLIK değişiyor; tarih aynı. `odev_guncelle` yine
  -- `odev_guncellendi` satırı yazıyor — gerçek veride de böyle.
  perform public.odev_guncelle(jt, d_sessiz, 'Sessiz düzeltildi ' || ek, null,
                               v_sinif, current_date + 10);
  if not exists (select 1 from public.denetim_izi
                  where tablo = 'odevler' and kayit_id = d_sessiz
                    and islem = 'odev_guncellendi') then
    raise exception '3a BAŞARISIZ — kurulum bozuk: güncelleme izi yazılmamış';
  end if;

  t := (public.odev_detay(jt, d_sessiz))->'tarihler';
  if (t->>'degisiklik')::integer <> 0 then
    raise exception '3b BAŞARISIZ — tarih değişmediği hâlde % değişiklik sayıldı',
      t->>'degisiklik';
  end if;
  if t->>'yon' is not null or t->>'ilk_son_tarih' is not null then
    raise exception '3c BAŞARISIZ — tarih değişmediği hâlde uzatma yazıldı: %', t::text;
  end if;
  raise notice '3 OK — başlık düzeltmesi uzatma sayılmıyor';

  -- ===========================================================================
  raise notice '--- 4. Gerçek uzatma: ilk tarih + yön ---';
  -- ===========================================================================
  d_uzatma := (public.odev_olustur(jt, 'Uzatma ' || ek, null, v_sinif, 'test',
    current_date + 3, 2, '{"1":"A","2":"B"}'::jsonb, null, null, true, 4::smallint, null))->>'id';
  perform public.odev_yayinla(jt, d_uzatma);
  update public.denetim_izi set zaman = now() - interval '10 days'
   where tablo = 'odevler' and kayit_id = d_uzatma and islem = 'odev_yayinlandi';
  perform public.odev_guncelle(jt, d_uzatma, 'Uzatma ' || ek, null,
                               v_sinif, current_date + 7);

  t := (public.odev_detay(jt, d_uzatma))->'tarihler';
  if (t->>'degisiklik')::integer <> 1 then
    raise exception '4a BAŞARISIZ — bir uzatma beklenirken %', t->>'degisiklik';
  end if;
  if (t->>'ilk_son_tarih')::date <> current_date + 3 then
    raise exception '4b BAŞARISIZ — ilk tarih % beklenirken %',
      current_date + 3, t->>'ilk_son_tarih';
  end if;
  if (t->>'son_tarih')::date <> current_date + 7 then
    raise exception '4c BAŞARISIZ — bugünkü tarih % beklenirken %',
      current_date + 7, t->>'son_tarih';
  end if;
  if t->>'yon' <> 'uzatildi' then
    raise exception '4d BAŞARISIZ — yön uzatildi beklenirken %', coalesce(t->>'yon', 'null');
  end if;
  raise notice '4 OK — % → %, yön uzatildi', t->>'ilk_son_tarih', t->>'son_tarih';

  -- ===========================================================================
  raise notice '--- 5. Tarih öne alınırsa da söyleniyor (2. tuzak) ---';
  -- ===========================================================================
  -- GERÇEĞİ GİZLEME: yalnız uzatmayı yazıp öne almayı atlamak,
  -- öğrencinin elindeki süreyi sessizce kısaltmak olurdu.
  d_one := (public.odev_olustur(jt, 'Öne alma ' || ek, null, v_sinif, 'test',
    current_date + 9, 2, '{"1":"A","2":"B"}'::jsonb, null, null, true, 4::smallint, null))->>'id';
  perform public.odev_yayinla(jt, d_one);
  update public.denetim_izi set zaman = now() - interval '10 days'
   where tablo = 'odevler' and kayit_id = d_one and islem = 'odev_yayinlandi';
  perform public.odev_guncelle(jt, d_one, 'Öne alma ' || ek, null,
                               v_sinif, current_date + 4);

  t := (public.odev_detay(jt, d_one))->'tarihler';
  if t->>'yon' <> 'one_alindi' then
    raise exception '5a BAŞARISIZ — yön one_alindi beklenirken %', coalesce(t->>'yon', 'null');
  end if;
  if (t->>'ilk_son_tarih')::date <> current_date + 9 then
    raise exception '5b BAŞARISIZ — ilk tarih % beklenirken %',
      current_date + 9, t->>'ilk_son_tarih';
  end if;
  raise notice '5 OK — % → %, yön one_alindi', t->>'ilk_son_tarih', t->>'son_tarih';

  -- ===========================================================================
  raise notice '--- 6. İki kez değişti: sayı 2, ilk tarih İLK olan ---';
  -- ===========================================================================
  d_iki := (public.odev_olustur(jt, 'İki kez ' || ek, null, v_sinif, 'test',
    current_date + 2, 2, '{"1":"A","2":"B"}'::jsonb, null, null, true, 4::smallint, null))->>'id';
  perform public.odev_yayinla(jt, d_iki);
  update public.denetim_izi set zaman = now() - interval '10 days'
   where tablo = 'odevler' and kayit_id = d_iki and islem = 'odev_yayinlandi';
  perform public.odev_guncelle(jt, d_iki, 'İki kez ' || ek, null, v_sinif, current_date + 5);
  -- İKİ GÜNCELLEMENİN ZAMANI AYNI (donuk `now()`), sıra `id`'den geliyor.
  -- Gerçekte iki ayrı çağrı aynı saniyeyi paylaşamaz; burada sıralamanın
  -- tesadüfe bırakılmadığı ölçülüyor.
  perform public.odev_guncelle(jt, d_iki, 'İki kez ' || ek, null, v_sinif, current_date + 11);

  t := (public.odev_detay(jt, d_iki))->'tarihler';
  if (t->>'degisiklik')::integer <> 2 then
    raise exception '6a BAŞARISIZ — 2 değişiklik beklenirken %', t->>'degisiklik';
  end if;
  -- ARA TARİH (+5) DEĞİL, İLK TARİH (+2).
  if (t->>'ilk_son_tarih')::date <> current_date + 2 then
    raise exception '6b BAŞARISIZ — ilk tarih % beklenirken % (ara tarih yazılmış olabilir)',
      current_date + 2, t->>'ilk_son_tarih';
  end if;
  if t->>'yon' <> 'uzatildi' or (t->>'son_tarih')::date <> current_date + 11 then
    raise exception '6c BAŞARISIZ — % / %', t->>'yon', t->>'son_tarih';
  end if;
  raise notice '6 OK — 2 değişiklik, ilk tarih % (ara tarih değil)', t->>'ilk_son_tarih';

  -- ===========================================================================
  raise notice '--- 7. Taslaktayken değişen tarih uzatma değil (3. tuzak) ---';
  -- ===========================================================================
  -- Ödev henüz kimsede görünmüyordu; onu "uzatma" diye yazmak öğretmene
  -- hiç yapmadığı bir işi hatırlatırdı.
  d_taslak_degisim := (public.odev_olustur(jt, 'Taslak değişim ' || ek, null, v_sinif,
    'test', current_date + 2, 2, '{"1":"A","2":"B"}'::jsonb, null, null, true,
    4::smallint, null))->>'id';
  perform public.odev_guncelle(jt, d_taslak_degisim, 'Taslak değişim ' || ek, null,
                               v_sinif, current_date + 8);
  perform public.odev_yayinla(jt, d_taslak_degisim);
  -- Gerçek sıra: değişiklik ÖNCE, yayın SONRA. Donuk `now()` ikisini
  -- aynı ana yığdığı için değişiklik satırı geriye alınıyor.
  update public.denetim_izi set zaman = now() - interval '1 hour'
   where tablo = 'odevler' and kayit_id = d_taslak_degisim and islem = 'odev_guncellendi';

  t := (public.odev_detay(jt, d_taslak_degisim))->'tarihler';
  if (t->>'degisiklik')::integer <> 0 then
    raise exception '7a BAŞARISIZ — taslaktaki değişiklik uzatma sayıldı: %', t::text;
  end if;
  if t->>'yon' is not null then
    raise exception '7b BAŞARISIZ — taslaktaki değişiklik için yön yazıldı: %', t->>'yon';
  end if;
  if t->>'verilis' is null then
    raise exception '7c BAŞARISIZ — kurulum bozuk: ödev yayınlanmamış';
  end if;
  raise notice '7 OK — yayından önceki tarih değişikliği sayılmıyor';

  -- ===========================================================================
  raise notice '--- 8. Tarih ilk hâline dönerse yön yok (bilinen sınır) ---';
  -- ===========================================================================
  d_geri := (public.odev_olustur(jt, 'Geri dönen ' || ek, null, v_sinif, 'test',
    current_date + 6, 2, '{"1":"A","2":"B"}'::jsonb, null, null, true, 4::smallint, null))->>'id';
  perform public.odev_yayinla(jt, d_geri);
  update public.denetim_izi set zaman = now() - interval '10 days'
   where tablo = 'odevler' and kayit_id = d_geri and islem = 'odev_yayinlandi';
  perform public.odev_guncelle(jt, d_geri, 'Geri dönen ' || ek, null, v_sinif, current_date + 12);
  perform public.odev_guncelle(jt, d_geri, 'Geri dönen ' || ek, null, v_sinif, current_date + 6);

  t := (public.odev_detay(jt, d_geri))->'tarihler';
  -- Değişiklikler SAYILIYOR (iz duruyor) ama ekranda "uzatıldı"
  -- yazılmıyor: bugünkü tarih ilk tarihin aynısı.
  if (t->>'degisiklik')::integer <> 2 then
    raise exception '8a BAŞARISIZ — 2 değişiklik beklenirken %', t->>'degisiklik';
  end if;
  if t->>'yon' is not null then
    raise exception '8b BAŞARISIZ — aynı tarihe dönüldüğü hâlde yön yazıldı: %', t->>'yon';
  end if;
  raise notice '8 OK — ilk hâline dönen tarih için yön yazılmıyor (değişiklik: 2)';

  -- ===========================================================================
  raise notice '--- 9. Dört uç AYNI nesneyi veriyor ---';
  -- ===========================================================================
  -- Öğretmenin gördüğü tarihle öğrencinin ve velinin gördüğü tarih
  -- ayrışırsa ekranlar birbirini yalanlar.
  t := (public.odev_detay(jt, d_uzatma))->'tarihler';

  -- 9a — öğretmenin LİSTESİ
  select e->'tarihler' into t2
    from jsonb_array_elements(public.odevler_listesi(jt, v_sinif, null)) e
   where (e->>'id')::uuid = d_uzatma;
  if t2 is null then
    raise exception '9a BAŞARISIZ — odevler_listesi tarihleri döndürmüyor';
  end if;
  if t2 is distinct from t then
    raise exception '9a BAŞARISIZ — liste ile ödev sayfası ayrışıyor: % / %', t2::text, t::text;
  end if;
  raise notice '9a OK — öğretmen listesi ödev sayfasıyla aynı';

  -- 9b — ÖĞRENCİ
  select e->'tarihler' into t2
    from jsonb_array_elements((public.ogrenci_odevleri(jo))->'odevler') e
   where (e->>'id')::uuid = d_uzatma;
  if t2 is null then
    raise exception '9b BAŞARISIZ — ogrenci_odevleri tarihleri döndürmüyor';
  end if;
  if t2 is distinct from t then
    raise exception '9b BAŞARISIZ — öğrencinin gördüğü ayrışıyor: % / %', t2::text, t::text;
  end if;
  raise notice '9b OK — öğrenci öğretmenle aynı tarihleri görüyor';

  -- 9c — VELİ (velide ödev kimliği YOK, başlıkla bulunuyor)
  select e->'tarihler' into t2
    from jsonb_array_elements((public.veli_paneli(jv))->'odevler') e
   where e->>'baslik' = 'Uzatma ' || ek;
  if t2 is null then
    raise exception '9c BAŞARISIZ — veli_paneli tarihleri döndürmüyor';
  end if;
  if t2 is distinct from t then
    raise exception '9c BAŞARISIZ — velinin gördüğü ayrışıyor: % / %', t2::text, t::text;
  end if;
  raise notice '9c OK — veli de aynı tarihleri görüyor';

  -- 9d — TASLAK ÖĞRENCİYE VE VELİYE HİÇ DÜŞMÜYOR (0085 bunu bozmadı).
  if exists (select 1 from jsonb_array_elements((public.ogrenci_odevleri(jo))->'odevler') e
              where (e->>'id')::uuid = d_taslak) then
    raise exception '9d BAŞARISIZ — taslak öğrenciye düştü';
  end if;
  raise notice '9d OK — taslak öğrenciye düşmüyor';

  -- ===========================================================================
  raise notice '--- 10. Kişisel ek süre (0081/0084) tarihlere karışmıyor ---';
  -- ===========================================================================
  -- `ek_sure` O ÖĞRENCİYE özel; `tarihler` SINIFIN tarihleri. Biri
  -- diğerinin yerine yazılsa öğrenci sınıfın tarihini kendi tarihi sanar.
  perform public.ogrencilere_ek_sure(jt, d_uzatma, jsonb_build_array(v_ogr::text),
                                     current_date + 20, 'Rahatsızdın.');
  select e into v
    from jsonb_array_elements((public.ogrenci_odevleri(jo))->'odevler') e
   where (e->>'id')::uuid = d_uzatma;
  if (v->>'ek_sure')::date <> current_date + 20 then
    raise exception '10a BAŞARISIZ — kişisel ek süre yok: %', v->>'ek_sure';
  end if;
  if (v->'tarihler'->>'son_tarih')::date <> current_date + 7 then
    raise exception '10b BAŞARISIZ — kişisel süre sınıfın son tarihini ezdi: %',
      v->'tarihler'->>'son_tarih';
  end if;
  if (v->'tarihler'->>'degisiklik')::integer <> 1 then
    raise exception '10c BAŞARISIZ — ek süre uzatma sayısına karıştı: %',
      v->'tarihler'->>'degisiklik';
  end if;
  raise notice '10 OK — kişisel süre (%) ile sınıfın tarihi (%) ayrı',
    v->>'ek_sure', v->'tarihler'->>'son_tarih';

  -- ===========================================================================
  raise notice '--- 11. Hesap istemciye kapalı ---';
  -- ===========================================================================
  if has_function_privilege('anon', 'public._odev_tarihleri(uuid, date)', 'execute') then
    raise exception '11 BAŞARISIZ — _odev_tarihleri anon''a açık';
  end if;
  raise notice '11 OK — _odev_tarihleri yalnız definer uçlardan çağrılıyor';

  -- ===========================================================================
  raise notice '--- 12. Zincirin sonu ---';
  -- ===========================================================================
  select count(*) into n from public.uygulanan_migrationlar where dosya = '0085';
  if n <> 1 then
    raise exception '12 BAŞARISIZ — 0085 kaydı yok';
  end if;
  raise notice '12 OK — zincir 0085''te';

  raise notice '=== 0085 ödev tarihleri: 12 grubun hepsi geçti ===';
end $$;

-- =============================================================================
-- KUSUR PROVALARI — her kapı GERÇEKTEN baypas eden bir kusurla denendi
--
-- Yeşil bir ölçüm, ölçtüğünü sandığı şeyi ölçtüğünü KANITLAMAZ. Aşağıdaki
-- sekiz kusur `_odev_tarihleri`'ye tek tek yerleştirildi, migration
-- uygulandı ve bu dosya yeniden çalıştırıldı. Kusurun ÖZ-DENETİMDEN de
-- geçmesi gereken yerlerde o satır da bilerek etkisizleştirildi — yoksa
-- prova, ölçümün değil öz-denetimin ısırdığını gösterirdi.
--
-- SEKİZİNİN HEPSİ ISIRDI:
--
--   A. Tarih süzgeci (`is distinct from`) kaldırıldı
--      → 3b: "tarih değişmediği hâlde 1 değişiklik sayıldı"
--   B. `z.zaman >= v.zaman` kaldırıldı (taslak dönemi kapısı)
--      → 7a: "taslaktaki değişiklik uzatma sayıldı"
--   C. `min(z.zaman)` yerine `max(z.zaman)`
--      → 2c: "ikinci yayınlama veriliş tarihini kaydırdı"
--   D. Yön karşılaştırması ters çevrildi
--      → 4d: "yön uzatildi beklenirken one_alindi"
--   E. `order by zaman, id` yerine `desc` (ilk yerine son değişiklik)
--      → 6b: "ilk tarih 31 Ekim beklenirken 3 Kasım"
--   F. Veriliş `odevler.created_at`'ten okundu
--      → 1b: "taslakta veriliş tarihi var" (taslak ölçümü, 2b'den önce
--        ısırdı; aynı kusuru iki grup birden yakalıyor)
--   G. `veli_paneli` ucundan `tarihler` çıkarıldı
--      → 9c: "veli_paneli tarihleri döndürmüyor"
--   H. `_odev_tarihleri` anon'a açıldı
--      → 11: "_odev_tarihleri anon'a açık"
--
-- PROVA YAPILMAYAN BİR KUSUR VE SEBEBİ — `>=` yerine `>`
--
-- Denemedim, çünkü ISIRAMAZ ve bunu gizlemek yerine yazıyorum: iki ayrı
-- RPC çağrısının `now()`'ı aynı olamaz, bu dosyadaki zaman çizgisi de
-- elle ayrıldığı için eşitlik hiç oluşmuyor. `>=` yazılı olması yalnız
-- TEK İŞLEMDE yayınla+güncelle yapan bir çağrının (bugün yok) değişikliği
-- sessizce yutmaması için.
-- =============================================================================
