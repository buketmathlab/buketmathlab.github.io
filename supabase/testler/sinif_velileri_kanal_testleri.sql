-- =============================================================================
-- SEKİZ — 0049: `sinif_velileri` KANAL ONARIMI TESTLERİ
--
-- Bu dosyanın var olma sebebi bir CANLI HATA. Öğretmen Veliler → 9A'ya
-- bastığında ekran "Bu bölüm yüklenemedi / more than one row returned by
-- a subquery used as an expression" dedi.
--
-- Hata bir yıl sessiz bekledi: `okundu` anahtarı
-- (ogrenci_id, rol, kanal, ogretmen_id) iken alt sorgu yalnız `rol`
-- süzüyordu. İkinci satırın oluşması için öğretmenin aynı öğrencinin
-- ÖĞRENCİ kanalını da açması gerekiyordu; 0048 iki kanalı yan yana iki
-- düğme yapınca bu sıradan bir davranış oldu ve hata uyandı.
--
-- BU YÜZDEN 1. GRUP HATAYI BİREBİR KURUYOR: önce veli kanalı, sonra
-- öğrenci kanalı açılıyor, sonra ekran isteniyor. Onarım geri alınırsa
-- bu grup 21000 ile patlar.
--
-- İZOLASYON: kendi sınıfını kuruyor (9V).
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text;                 -- öğretmen (sahip)
  jt2 text;                -- meslektaş
  v_ben uuid; v_o2 uuid;
  s_9v uuid;
  ali uuid; ayse uuid;
  v jsonb; satir jsonb; y jsonb;
  patladi boolean;
  kotu text[];
begin
  -- ---------------------------------------------------------------------------
  -- Hazırlık
  -- ---------------------------------------------------------------------------
  update public.ogretmenler
     set pin_hash = extensions.crypt('Kanal!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Kanal!2026'))->>'token';
  select id into v_ben from public.ogretmenler where yonetici;

  insert into public.siniflar (seviye, sube) values (9, 'V')
    on conflict (seviye, sube) do update set arsiv = false returning id into s_9v;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    values (v_ben, s_9v) on conflict do nothing;

  ali  := (public.ogrenci_ekle(jt, 'Ali Kanal',  'okul', s_9v))->>'id';
  ayse := (public.ogrenci_ekle(jt, 'Ayse Kanal', 'okul', s_9v))->>'id';

  -- Veli kanalında iki mesaj: biri öğretmenden, biri veliden.
  --
  -- VELİDEN GELEN MESAJ İKİ SAAT GERİYE ATILIYOR. Sebebi 4. grubun
  -- aritmetiği: orada okuma işareti bir saat geriye çekiliyor ve tek bir
  -- mesajın okunmamış kalması bekleniyor. Bu mesaj "şimdi" kalsaydı o da
  -- işaretin ilerisinde kalır, beklenen 1 yerine 2 çıkardı.
  perform public.mesaj_gonder(jt, 'Veliye merhaba', ali, 'veli');
  insert into public.mesajlar (ogrenci_id, kimden, metin, kanal, ogretmen_id, created_at)
    values (ali, 'veli', 'Veliden cevap', 'veli', v_ben, now() - interval '2 hours');

  -- Öğrenci kanalında da iki mesaj — VELİ EKRANINA KARIŞMAMALI.
  perform public.mesaj_gonder(jt, 'Ogrenciye merhaba', ali, 'ogrenci');
  insert into public.mesajlar (ogrenci_id, kimden, metin, kanal, ogretmen_id)
    values (ali, 'ogrenci', 'Ogrenciden cevap', 'ogrenci', v_ben);

  -- ---------------------------------------------------------------------------
  -- 1. CANLI HATANIN BİREBİR KURULUMU
  -- ---------------------------------------------------------------------------
  perform public.ogretmen_okudu(jt, ali, 'veli');
  v := public.sinif_velileri(jt, s_9v);
  raise notice '1a OK — yalnız veli kanalı açıkken ekran geliyor';

  -- İKİNCİ OKUMA İŞARETİ. Bundan sonrası eski kodda 21000 veriyordu.
  perform public.ogretmen_okudu(jt, ali, 'ogrenci');

  if (select count(*) from public.okundu
       where ogrenci_id = ali and rol = 'ogretmen') <> 2 then
    raise exception '1b: iki okuma işareti kurulamadı — test kendi dünyasını kuramıyor';
  end if;
  raise notice '1b OK — aynı öğrenci için İKİ okuma işareti var (kurulum doğru)';

  v := public.sinif_velileri(jt, s_9v);
  raise notice '1c OK — iki kanal da açıkken ekran geliyor (canlı hata giderildi)';

  -- ---------------------------------------------------------------------------
  -- 2. EKRANDAKİ SAYI = TIKLAYINCA GÖRÜLEN
  --
  -- Asıl kural bu. Liste "3 mesaj" deyip yazışmada 1 mesaj çıkarsa ekran
  -- çökmez ama yalan söyler; çökmeyen yalan daha tehlikeli.
  -- ---------------------------------------------------------------------------
  select e into satir from jsonb_array_elements(v->'veliler') e
   where e->>'ogrenci_id' = ali::text;

  y := public.mesajlar_ogretmen(jt, ali, 'veli');

  if (satir->>'mesaj_sayisi')::int <> jsonb_array_length(y->'mesajlar') then
    raise exception '2: listedeki sayı % ile yazışmadaki % tutmuyor',
      satir->>'mesaj_sayisi', jsonb_array_length(y->'mesajlar');
  end if;
  raise notice '2 OK — listedeki mesaj sayısı (%) yazışmadakiyle aynı',
    satir->>'mesaj_sayisi';

  -- ---------------------------------------------------------------------------
  -- 3. ÖĞRENCİ KANALI VELİ EKRANINA SIZMIYOR
  --
  -- Ali'nin öğrenci kanalında da iki mesajı var. Veli ekranı yalnız veli
  -- kanalını saymalı; eski kod dördünü birden sayıyordu.
  -- ---------------------------------------------------------------------------
  if (satir->>'mesaj_sayisi')::int <> 2 then
    raise exception '3: veli ekranı % mesaj sayıyor, 2 olmalı (öğrenci kanalı karışmış)',
      satir->>'mesaj_sayisi';
  end if;
  raise notice '3 OK — öğrenci kanalındaki iki mesaj veli ekranına karışmıyor';

  -- ---------------------------------------------------------------------------
  -- 4. OKUNMAMIŞ SAYISI — İKİ YÖNLÜ
  --
  -- ZAMANLAR ELLE KURULUYOR, DONUK `now()` YÜZÜNDEN. Bir işlem boyunca
  -- `now()` DEĞİŞMİYOR: `ogretmen_okudu` işareti hep aynı damgayla
  -- yazıyor. Mesajı `clock_timestamp()` ile ileri atarsam işaret onu bir
  -- daha asla geçemez ve "okundu" hiç olmaz; mesajı geri çekersem bu kez
  -- baştan okunmuş sayılır.
  --
  -- Çözüm: işareti GEÇMİŞE çekip mesajı ikisinin ARASINA koymak. Böylece
  -- önce okunmamış, `ogretmen_okudu`dan (yani `now()`dan) sonra okunmuş
  -- oluyor ve ikisi de gerçek uçla ölçülüyor.
  -- ---------------------------------------------------------------------------
  update public.okundu set zaman = now() - interval '1 hour'
   where ogrenci_id = ali and rol = 'ogretmen' and kanal = 'veli';

  insert into public.mesajlar (ogrenci_id, kimden, metin, kanal, ogretmen_id, created_at)
    values (ali, 'veli', 'Okunmamis olacak', 'veli', v_ben, now() - interval '30 minutes');

  v := public.sinif_velileri(jt, s_9v);
  select e into satir from jsonb_array_elements(v->'veliler') e
   where e->>'ogrenci_id' = ali::text;
  if (satir->>'okunmamis')::int <> 1 then
    raise exception '4a: okunmamış % , 1 olmalı', satir->>'okunmamis';
  end if;
  raise notice '4a OK — yeni veli mesajı okunmamış sayılıyor';

  -- ÖĞRENCİ kanalını okumak veli okunmamışını DÜŞÜRMEMELİ (0025 ayrımı).
  perform public.ogretmen_okudu(jt, ali, 'ogrenci');
  v := public.sinif_velileri(jt, s_9v);
  select e into satir from jsonb_array_elements(v->'veliler') e
   where e->>'ogrenci_id' = ali::text;
  if (satir->>'okunmamis')::int <> 1 then
    raise exception '4b: öğrenci kanalını okumak veli sayısını düşürdü (%)',
      satir->>'okunmamis';
  end if;
  raise notice '4b OK — öğrenci kanalını okumak veli okunmamışına dokunmuyor';

  -- VELİ kanalını okumak düşürmeli — pozitif kontrol.
  perform public.ogretmen_okudu(jt, ali, 'veli');
  v := public.sinif_velileri(jt, s_9v);
  select e into satir from jsonb_array_elements(v->'veliler') e
   where e->>'ogrenci_id' = ali::text;
  if (satir->>'okunmamis')::int <> 0 then
    raise exception '4c: veli kanalı okundu ama sayı hâlâ % (ölçüm ölü olabilir)',
      satir->>'okunmamis';
  end if;
  raise notice '4c OK — veli kanalını okumak sayıyı düşürüyor';

  -- ---------------------------------------------------------------------------
  -- 5. MESLEKTAŞIN YAZIŞMASI SAYIYA GİRMİYOR
  --
  -- `mesajlar_ogretmen` yazışmayı açarken `ogretmen_id` süzüyor; liste de
  -- süzmezse iki ekran farklı sayı gösterir.
  -- ---------------------------------------------------------------------------
  -- SABİT SAYI YERİNE "DEĞİŞMEDİ" ÖLÇÜLÜYOR. Önceki gruplar mesaj
  -- eklediği için beklenen rakam elle takip edilseydi her yeni grupta
  -- kırılırdı — ve asıl iddia zaten rakam değil: meslektaşın yazdığı
  -- şey bu öğretmenin sayısını DEĞİŞTİRMEMELİ.
  declare
    once_sayi integer;
    once_okunmamis integer;
  begin
    v := public.sinif_velileri(jt, s_9v);
    select e into satir from jsonb_array_elements(v->'veliler') e
     where e->>'ogrenci_id' = ali::text;
    once_sayi := (satir->>'mesaj_sayisi')::int;
    once_okunmamis := (satir->>'okunmamis')::int;

    perform public.ogretmen_ekle(jt, 'Meslektas Kanal', 'KanalMes!2026x');
    select id into v_o2 from public.ogretmenler where ad = 'Meslektas Kanal';

    insert into public.mesajlar (ogrenci_id, kimden, metin, kanal, ogretmen_id, created_at)
      values (ali, 'veli', 'Meslektasin yazismasi', 'veli', v_o2, clock_timestamp());

    v := public.sinif_velileri(jt, s_9v);
    select e into satir from jsonb_array_elements(v->'veliler') e
     where e->>'ogrenci_id' = ali::text;

    if (satir->>'mesaj_sayisi')::int <> once_sayi then
      raise exception '5a: meslektaşın mesajı sayıya girdi (% → %)',
        once_sayi, satir->>'mesaj_sayisi';
    end if;
    if (satir->>'okunmamis')::int <> once_okunmamis then
      raise exception '5b: meslektaşın mesajı okunmamışa girdi (% → %)',
        once_okunmamis, satir->>'okunmamis';
    end if;
    raise notice '5 OK — meslektaşın yazışması sayıyı da okunmamışı da değiştirmiyor (% mesaj)',
      once_sayi;
  end;

  -- MESLEKTAŞ DA OKURSA dördüncü bir `okundu` satırı doğuyor. Anahtarda
  -- `ogretmen_id` olduğu için alt sorgu yine tek satır almalı.
  -- Meslektaş sınıfa ATANIYOR — yoksa `ogretmen_okudu` haklı olarak
  -- 42501 veriyor. Buradaki iddia yetki değil, DÖRDÜNCÜ okuma işareti
  -- doğduğunda ekranın ayakta kalması.
  perform public.ogretmen_sinif_ata(jt, v_o2, jsonb_build_array(s_9v));
  perform public.ogretmen_okudu((public.giris('KanalMes!2026x'))->>'token', ali, 'veli');
  v := public.sinif_velileri(jt, s_9v);
  raise notice '5c OK — meslektaş da okuduktan sonra ekran yine geliyor';

  -- ---------------------------------------------------------------------------
  -- 6. HİÇ YAZIŞMASI OLMAYAN ÖĞRENCİ — sıfırla geliyor, kaybolmuyor
  -- ---------------------------------------------------------------------------
  select e into satir from jsonb_array_elements(v->'veliler') e
   where e->>'ogrenci_id' = ayse::text;
  if satir is null then
    raise exception '6: yazışması olmayan öğrenci listeden düştü';
  end if;
  if (satir->>'mesaj_sayisi')::int <> 0 or (satir->>'okunmamis')::int <> 0 then
    raise exception '6: yazışmasız öğrencide sayılar sıfır değil';
  end if;
  raise notice '6 OK — yazışması olmayan öğrenci listede, sayıları sıfır';

  -- ---------------------------------------------------------------------------
  -- 7. KAPILAR YERİNDE
  -- ---------------------------------------------------------------------------
  patladi := false;
  begin
    perform public.sinif_velileri('z' || repeat('x', 63), s_9v);
  exception when others then patladi := true;
  end;
  if not patladi then
    raise exception '7a: geçersiz jeton kabul edildi';
  end if;
  raise notice '7a OK — geçersiz jeton reddediliyor';

  -- ---------------------------------------------------------------------------
  -- 8. KATALOĞUN TAMAMI — bu hatanın şekli başka yerde kalmadı
  --
  -- Asıl ders bu. Hata tek bir uçta değildi; hata "kimse sormadı"
  -- olmasıydı. Bu grup soruyu her koşuda soruyor.
  -- ---------------------------------------------------------------------------
  kotu := '{}';
  declare r record; parca text;
  begin
    for r in
      select p.proname, pg_get_functiondef(p.oid) as govde
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prokind = 'f'
         and pg_get_functiondef(p.oid) like '%from public.okundu k%'
    loop
      parca := split_part(
        substr(r.govde, position('from public.okundu k' in r.govde)), ')', 1);
      -- YALNIZ ÖĞRETMEN ROLÜ METİNLE TARANIYOR. Öğrenci/veli tarafında
      -- çok satırı önleyen şey metin değil KISIT (aşağıdaki 9. grup).
      if parca like '%''ogretmen''%'
         and (parca not like '%kanal%' or parca not like '%ogretmen_id%') then
        kotu := kotu || r.proname;
      end if;
    end loop;
  end;
  if array_length(kotu, 1) > 0 then
    raise exception '8: öğretmen okuma işaretini eksik süzen uç(lar) → %',
      array_to_string(kotu, ', ');
  end if;
  raise notice '8 OK — öğretmen işaretini okuyan her uç anahtarın tamamını süzüyor';

  -- ---------------------------------------------------------------------------
  -- 9. ÖĞRENCİ/VELİ TARAFI: GÜVENCE KISITTA, SÖZDE DEĞİL
  --
  -- O taraftaki üç uç (`ogrenci_odevleri`, `ogrenci_mesajlari`,
  -- `veli_paneli`) işareti kanal ve rolle arıyor ama `ogretmen_id`
  -- süzmüyor — ve süzmemeli, çünkü işaret kişiye ait. Çok satırı
  -- imkânsız kılan şey `okundu_kisi_tek` dizini.
  --
  -- ÖNCE DİZİNİN VARLIĞI, SONRA GERÇEKTEN ISIRDIĞI ölçülüyor: var olduğu
  -- hâlde işlemeyen bir dizin, olmayan bir dizinden daha kötüdür.
  -- ---------------------------------------------------------------------------
  if not exists (select 1 from pg_indexes
                  where schemaname = 'public' and indexname = 'okundu_kisi_tek') then
    raise exception '9a: okundu_kisi_tek dizini yok';
  end if;
  raise notice '9a OK — okundu_kisi_tek dizini yerinde';

  patladi := false;
  begin
    -- Ali'nin veli rolü için ikinci bir satır: farklı öğretmenle bile
    -- olsa kısıt buna izin VERMEMELİ.
    insert into public.okundu (ogrenci_id, rol, kanal, ogretmen_id, zaman)
      values (ali, 'veli', 'veli', v_o2, now());
    insert into public.okundu (ogrenci_id, rol, kanal, ogretmen_id, zaman)
      values (ali, 'veli', 'veli', v_ben, now());
  exception when unique_violation then patladi := true;
  end;
  if not patladi then
    raise exception '9b: kısıt ısırmadı — öğrenci/veli tarafında çift satır hâlâ mümkün';
  end if;
  raise notice '9b OK — kısıt ikinci satırı reddediyor (güvence gerçek)';

  -- ---------------------------------------------------------------------------
  -- 10. ÖĞRETMEN TARAFINDA ÇOK SATIR HÂLÂ SERBEST — kısıt fazla geniş değil
  --
  -- Kısıt yanlışlıkla öğretmen rolünü de kapsasaydı iki öğretmen aynı
  -- öğrenciyi okuyamazdı. 5c bunu dolaylı gösteriyor; burası doğrudan.
  -- ---------------------------------------------------------------------------
  if (select count(*) from public.okundu
       where ogrenci_id = ali and rol = 'ogretmen') < 2 then
    raise exception '10: öğretmen tarafında çok satır kalmamış — kısıt fazla geniş';
  end if;
  raise notice '10 OK — öğretmen rolünde çok satır hâlâ mümkün (kısıt dar)';

  -- ---------------------------------------------------------------------------
  -- 11. ÖĞRETMEN DEĞİŞİNCE ÖĞRENCİ PANOSU AYAKTA KALIYOR
  --
  -- İKİNCİ TUZAĞIN REGRESYON TESTİ. `okundu_isaretle` satırı öğrencinin
  -- O ANKİ öğretmeniyle yazıyordu; sınıf devredilince ikinci satır doğup
  -- `ogrenci_odevleri` ve `ogrenci_mesajlari` 21000 ile patlıyordu.
  -- Ölçüldü ve onarımdan ÖNCE gerçekten patlıyordu.
  --
  -- Artık kısıt ikinci satırı imkânsız kılıyor ve yazıcı çakışmayı
  -- görüp GÜNCELLİYOR. Burada ikisi birden ölçülüyor: çağrı hata
  -- vermiyor, satır bir tane kalıyor ve pano açılıyor.
  -- ---------------------------------------------------------------------------
  declare
    kod text; jo text; d jsonb;
  begin
    -- ÖNCE TEK ÖĞRETMEN. 5c meslektaşı da bu sınıfa atamıştı; öğrencinin
    -- iki öğretmeni varken `okundu_isaretle` haklı olarak "mesajın kime
    -- gideceği seçilemiyor" diyor. Buradaki senaryo çok öğretmenlilik
    -- değil, DEVİR: önce sahip, sonra meslektaş.
    delete from public.ogretmen_siniflari
     where sinif_id = s_9v and ogretmen_id = v_o2;

    kod := (select k.kod from public.giris_kodlari k
             where k.ogrenci_id = ayse and k.rol = 'ogrenci');
    jo := (public.giris(kod))->>'token';

    perform public.okundu_isaretle(jo);

    -- SINIF DEVREDİLİYOR: artık öğrencinin öğretmeni meslektaş.
    delete from public.ogretmen_siniflari where sinif_id = s_9v;
    insert into public.ogretmen_siniflari (ogretmen_id, sinif_id) values (v_o2, s_9v);

    -- Öğrenci panosunu yeniden okuyor — eski kodda ikinci satır burada doğuyordu.
    perform public.okundu_isaretle(jo);

    if (select count(*) from public.okundu
         where ogrenci_id = ayse and rol = 'ogrenci' and kanal = 'ogrenci') <> 1 then
      raise exception '11a: öğretmen değişince ikinci okuma işareti doğdu';
    end if;
    raise notice '11a OK — öğretmen değişti, okuma işareti hâlâ TEK satır';

    d := public.ogrenci_odevleri(jo);
    d := public.ogrenci_mesajlari(jo);
    raise notice '11b OK — öğretmen değiştikten sonra öğrenci panosu açılıyor';

    -- Sınıfı sahibe geri veriyoruz: sonraki test dosyaları etkilenmesin.
    delete from public.ogretmen_siniflari where sinif_id = s_9v;
    insert into public.ogretmen_siniflari (ogretmen_id, sinif_id) values (v_ben, s_9v);
  end;

  raise notice '';
  raise notice 'SINIF VELİLERİ KANAL TESTLERİ: 11 GRUP GEÇTİ';
end $$;
