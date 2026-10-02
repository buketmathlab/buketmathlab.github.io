-- =============================================================================
-- SEKİZ — 0058: VELİ VE ÖĞRENCİ MESAJINDA ÖĞRETMEN SEÇİMİ
--
-- Canlı olay: başka öğretmenin sınıfındaki veli mesaj gönderemedi
-- ("Birden çok öğretmeniniz var…"), çünkü platform sahibi her sınıfa bağlı.
-- Bu dosya o durumu BİREBİR kuruyor: sahibin açtığı sınıf bir meslektaşa
-- atanıyor, öğrencinin iki öğretmeni oluyor.
--
--  1. Öğretmen listesi: iki öğretmen, sınıf öğretmeni önce.
--  2. Seçimsiz veli mesajı açık bir Türkçe hatayla reddediliyor.
--  3. Veli → meslektaş: yalnız meslektaş görüyor.
--  4. Veli → sahip: yalnız sahip görüyor.
--  5. Velinin ekranında iki mesaj, doğru öğretmen adlarıyla.
--  6. O öğrencinin öğretmeni olmayan birine yazmak 42501.
--  7. Öğrenci kanalı aynı kurallarla.
--  8. okundu_isaretle iki öğretmende hata vermiyor.
--  9. Tek öğretmenli öğrencide seçimsiz mesaj eskisi gibi gidiyor.
-- 10. Öğretmen rolünde p_ogretmen_id yok sayılıyor.
-- 11. Özel ders öğrencisinin listesinde yalnız sahip.
-- 12. Eski imza yok, yardımcılar istemciye kapalı.
--
-- İZOLASYON: kendi sınıflarını kuruyor (11R, 11T).
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text; jb text; jc text;
  v_ben uuid; v_baris uuid; v_cem uuid;
  s_r uuid; s_t uuid;
  ece uuid; tek uuid; oz uuid;
  jv text; jo text; jv_tek text;
  v jsonb; y jsonb; liste jsonb;
  patladi boolean; mesaj text;
  ek text := to_char(clock_timestamp(), 'HH24MISSUS');
begin
  -- ---------------------------------------------------------------------------
  -- Hazırlık
  -- ---------------------------------------------------------------------------
  update public.ogretmenler
     set pin_hash = extensions.crypt('Secim!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Secim!2026'))->>'token';
  select id into v_ben from public.ogretmenler where yonetici;

  if not exists (select 1 from public.ogretmenler where ad = 'Barış Seçim') then
    perform public.ogretmen_ekle(jt, 'Barış Seçim', 'SecimBaris!2026');
  end if;
  if not exists (select 1 from public.ogretmenler where ad = 'Cem Seçim') then
    perform public.ogretmen_ekle(jt, 'Cem Seçim', 'SecimCem!2026');
  end if;
  select id into v_baris from public.ogretmenler where ad = 'Barış Seçim';
  select id into v_cem   from public.ogretmenler where ad = 'Cem Seçim';
  jb := (public.giris('SecimBaris!2026'))->>'token';
  jc := (public.giris('SecimCem!2026'))->>'token';

  -- Sahip açıyor (sahibe bağlanıyor), sonra 11R Barış'a atanıyor.
  s_r := (public.sinif_ekle(jt, 11::smallint, 'R'))->>'id';
  s_t := (public.sinif_ekle(jt, 11::smallint, 'T'))->>'id';
  perform public.ogretmen_sinif_ata(jt, v_baris, jsonb_build_array(s_r::text));

  ece := (public.ogrenci_ekle(jt, 'Ece Secim ' || ek, 'okul', s_r))->>'id';
  tek := (public.ogrenci_ekle(jt, 'Tek Secim ' || ek, 'okul', s_t))->>'id';
  oz  := (public.ogrenci_ekle(jt, 'Ozel Secim ' || ek, 'ozel', null))->>'id';

  jv := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = ece and rol = 'veli')))->>'token';
  jo := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = ece and rol = 'ogrenci')))->>'token';
  jv_tek := (public.giris((select kod from public.giris_kodlari
                            where ogrenci_id = tek and rol = 'veli')))->>'token';
  perform public.onam_ver(jv, public._gecerli_onam_surumu(), 'Ece Velisi');
  perform public.onam_ver(jv_tek, public._gecerli_onam_surumu(), 'Tek Velisi');

  -- ---------------------------------------------------------------------------
  -- 1. ÖĞRETMEN LİSTESİ
  -- ---------------------------------------------------------------------------
  v := public.veli_paneli(jv);
  liste := v->'ogretmenler';
  if jsonb_array_length(liste) <> 2 then
    raise exception '1a: iki öğretmen bekleniyordu: %', liste;
  end if;
  if (liste->0->>'id')::uuid <> v_baris or (liste->1->>'id')::uuid <> v_ben then
    raise exception '1b: sıra sınıf öğretmeni, sonra sahip olmalı: %', liste;
  end if;
  if liste::text like '%Cem Seçim%' then
    raise exception '1c: sınıfa atanmamış öğretmen listede';
  end if;
  raise notice '1 OK — veli listesi: Barış Seçim, sonra platform sahibi (Cem yok)';

  -- ---------------------------------------------------------------------------
  -- 2. SEÇİMSİZ MESAJ: AÇIK HATA (canlı olayın yeni hâli)
  -- ---------------------------------------------------------------------------
  begin
    perform public.mesaj_gonder(jv, 'Secimsiz mesaj');
    raise exception '2: seçimsiz mesaj iki öğretmende kabul edildi';
  exception when sqlstate '22023' then
    get stacked diagnostics mesaj = message_text;
    if mesaj not like '%hangi öğretmene%seçin%' then
      raise exception '2: beklenmeyen hata metni: %', mesaj;
    end if;
  end;
  raise notice '2 OK — seçimsiz: "Mesajın hangi öğretmene gideceğini seçin."';

  -- ---------------------------------------------------------------------------
  -- 3. VELİ → MESLEKTAŞ: yalnız meslektaş görüyor
  -- ---------------------------------------------------------------------------
  perform public.mesaj_gonder(jv, 'Barisa veli mesaji', null, 'veli', v_baris);
  if (select ogretmen_id from public.mesajlar
       where ogrenci_id = ece and metin = 'Barisa veli mesaji') <> v_baris then
    raise exception '3a: mesaj Barış''a bağlanmadı';
  end if;
  if (public.mesajlar_ogretmen(jb, ece, 'veli'))::text not like '%Barisa veli mesaji%' then
    raise exception '3b: Barış kendi mesajını görmüyor';
  end if;
  if (public.mesajlar_ogretmen(jt, ece, 'veli'))::text like '%Barisa veli mesaji%' then
    raise exception '3c: sahip, Barış''a yazılan mesajı görüyor';
  end if;
  raise notice '3 OK — Barış''a yazılan mesajı yalnız Barış görüyor';

  -- ---------------------------------------------------------------------------
  -- 4. VELİ → SAHİP: yalnız sahip görüyor
  -- ---------------------------------------------------------------------------
  perform public.mesaj_gonder(jv, 'Sahibe veli mesaji', null, 'veli', v_ben);
  if (public.mesajlar_ogretmen(jt, ece, 'veli'))::text not like '%Sahibe veli mesaji%' then
    raise exception '4a: sahip kendine yazılanı görmüyor';
  end if;
  if (public.mesajlar_ogretmen(jb, ece, 'veli'))::text like '%Sahibe veli mesaji%' then
    raise exception '4b: Barış, sahibe yazılan mesajı görüyor';
  end if;
  raise notice '4 OK — sahibe yazılan mesajı yalnız sahip görüyor';

  -- ---------------------------------------------------------------------------
  -- 5. VELİNİN EKRANI: iki mesaj, doğru öğretmen adları
  -- ---------------------------------------------------------------------------
  perform public.mesaj_gonder(jb, 'Baristan cevap', ece, 'veli');
  v := public.veli_paneli(jv);
  if not exists (select 1 from jsonb_array_elements(v->'mesajlar') m
                  where m->>'metin' = 'Barisa veli mesaji' and m->>'ogretmen' = 'Barış Seçim'
                    and (m->>'ogretmen_id')::uuid = v_baris) then
    raise exception '5a: Barış''a giden mesajda öğretmen adı yok: %', v->'mesajlar';
  end if;
  if not exists (select 1 from jsonb_array_elements(v->'mesajlar') m
                  where m->>'metin' = 'Sahibe veli mesaji' and (m->>'ogretmen_id')::uuid = v_ben) then
    raise exception '5b: sahibe giden mesaj ekranda yok';
  end if;
  if not exists (select 1 from jsonb_array_elements(v->'mesajlar') m
                  where m->>'metin' = 'Baristan cevap' and m->>'kimden' = 'ogretmen'
                    and m->>'ogretmen' = 'Barış Seçim') then
    raise exception '5c: Barış''ın cevabı adıyla gelmiyor';
  end if;
  raise notice '5 OK — velinin ekranında her mesaj kendi öğretmeninin adıyla';

  -- ---------------------------------------------------------------------------
  -- 6. ÖĞRENCİNİN ÖĞRETMENİ OLMAYANA YAZMAK: 42501
  -- ---------------------------------------------------------------------------
  patladi := false;
  begin
    perform public.mesaj_gonder(jv, 'Cem''e kacak mesaj', null, 'veli', v_cem);
  exception when sqlstate '42501' then patladi := true;
  end;
  if not patladi then raise exception '6a: atanmamış öğretmene mesaj gitti'; end if;
  patladi := false;
  begin
    perform public.mesaj_gonder(jv, 'Uydurma ogretmene', null, 'veli', gen_random_uuid());
  exception when sqlstate '42501' then patladi := true;
  end;
  if not patladi then raise exception '6b: uydurma öğretmen kimliği kabul edildi'; end if;
  if exists (select 1 from public.mesajlar where ogrenci_id = ece and metin in ('Cem''e kacak mesaj', 'Uydurma ogretmene')) then
    raise exception '6c: reddedilen mesaj kaydedilmiş';
  end if;
  raise notice '6 OK — atanmamış ya da uydurma öğretmene mesaj 42501, kayıt yok';

  -- ---------------------------------------------------------------------------
  -- 7. ÖĞRENCİ KANALI
  -- ---------------------------------------------------------------------------
  y := public.ogrenci_mesajlari(jo);
  if jsonb_array_length(y->'ogretmenler') <> 2 then
    raise exception '7a: öğrencinin listesi: %', y->'ogretmenler';
  end if;
  begin
    perform public.mesaj_gonder(jo, 'Ogrenci secimsiz', null, 'ogrenci');
    raise exception '7b: öğrencinin seçimsiz mesajı kabul edildi';
  exception when sqlstate '22023' then null;
  end;
  perform public.mesaj_gonder(jo, 'Ogrenciden Barisa', null, 'ogrenci', v_baris);
  if (public.mesajlar_ogretmen(jb, ece, 'ogrenci'))::text not like '%Ogrenciden Barisa%'
     or (public.mesajlar_ogretmen(jt, ece, 'ogrenci'))::text like '%Ogrenciden Barisa%' then
    raise exception '7c: öğrencinin Barış''a mesajı yanlış kutuda';
  end if;
  if (public.veli_paneli(jv))::text like '%Ogrenciden Barisa%' then
    raise exception '7d: öğrencinin mesajı velinin ekranına sızdı';
  end if;
  y := public.ogrenci_mesajlari(jo);
  if not exists (select 1 from jsonb_array_elements(y->'mesajlar') m
                  where m->>'metin' = 'Ogrenciden Barisa' and m->>'ogretmen' = 'Barış Seçim') then
    raise exception '7e: öğrencinin ekranında öğretmen adı yok';
  end if;
  raise notice '7 OK — öğrenci de seçiyor; mesaj yalnız Barış''ta, veliye sızmıyor';

  -- ---------------------------------------------------------------------------
  -- 8. OKUNDU İŞARETİ İKİ ÖĞRETMENDE
  -- ---------------------------------------------------------------------------
  perform public.okundu_isaretle(jv);
  perform public.okundu_isaretle(jo);
  if (public.veli_paneli(jv))->>'son_gorulme' is null then
    raise exception '8a: velinin okundu işareti yazılmadı';
  end if;
  if (public.veli_paneli(jv)->>'okunmamis_mesaj')::int <> 0 then
    raise exception '8b: okunduktan sonra okunmamış sayısı 0 değil';
  end if;
  if (public.ogrenci_mesajlari(jo))->>'son_gorulme' is null then
    raise exception '8c: öğrencinin okundu işareti yazılmadı';
  end if;
  raise notice '8 OK — okundu işareti iki öğretmende de yazılıyor, rozet düşüyor';

  -- ---------------------------------------------------------------------------
  -- 9. TEK ÖĞRETMEN: seçimsiz mesaj eskisi gibi
  -- ---------------------------------------------------------------------------
  if jsonb_array_length(public.veli_paneli(jv_tek)->'ogretmenler') <> 1 then
    raise exception '9a: tek öğretmenli öğrencide liste 1 olmalı';
  end if;
  perform public.mesaj_gonder(jv_tek, 'Tek ogretmene secimsiz');
  if (select ogretmen_id from public.mesajlar
       where ogrenci_id = tek and metin = 'Tek ogretmene secimsiz') <> v_ben then
    raise exception '9b: tek öğretmende seçimsiz mesaj sahibe gitmedi';
  end if;
  raise notice '9 OK — tek öğretmenli öğrencide eski çağrı aynen çalışıyor';

  -- ---------------------------------------------------------------------------
  -- 10. ÖĞRETMEN ROLÜNDE p_ogretmen_id YOK SAYILIYOR
  -- ---------------------------------------------------------------------------
  perform public.mesaj_gonder(jb, 'Baris adina sahip denemesi', ece, 'veli', v_ben);
  if (select ogretmen_id from public.mesajlar where ogrenci_id = ece and metin = 'Baris adina sahip denemesi') <> v_baris then
    raise exception '10: öğretmen başka öğretmen adına mesaj yazabildi';
  end if;
  raise notice '10 OK — öğretmen mesajı hep kendi adına';

  -- ---------------------------------------------------------------------------
  -- 11. ÖZEL DERS: yalnız sahip
  -- ---------------------------------------------------------------------------
  liste := public._ogrencinin_ogretmenleri(oz);
  if jsonb_array_length(liste) <> 1 or (liste->0->>'id')::uuid <> v_ben then
    raise exception '11: özel ders listesi yalnız sahip olmalı: %', liste;
  end if;
  raise notice '11 OK — özel ders öğrencisinin tek öğretmeni sahip';

  -- ---------------------------------------------------------------------------
  -- 12. İMZA VE YETKİLER
  -- ---------------------------------------------------------------------------
  if to_regprocedure('public.mesaj_gonder(text, text, uuid, text)') is not null then
    raise exception '12a: eski imza duruyor';
  end if;
  if has_function_privilege('anon', 'public._ogrencinin_ogretmenleri(uuid)', 'execute')
     or has_function_privilege('anon', 'public._mesaj_alicisi(uuid, uuid)', 'execute') then
    raise exception '12b: dahili yardımcı istemciye açık';
  end if;
  raise notice '12 OK — eski imza yok, yardımcılar istemciye kapalı';
end $$;

select 'MESAJ ÖĞRETMEN SEÇİMİ TESTLERİ GEÇTİ' as sonuc;
