-- =============================================================================
-- SEKİZ — GÖNDERMEYEN ÖĞRENCİYE EK SÜRE (0084)
--
-- Öğretmenin isteği: "Son teslim tarihi içerisinde ödevini göndermeyen
-- öğrenciye daha sonradan SADECE O ÖĞRENCİ BAZINDA gönderme hakkı
-- verebilen bir seçeneğim olsun."
--
-- 0081 kişisel son tarihi ve kapıyı kurmuştu ama satırı oluşturmanın tek
-- yolu "Gönderimi yeniden aç"tı ve o VAR OLAN bir gönderim istiyordu.
--
-- ASIL ÖLÇÜM 2. GRUPTA: ek süre verilen öğrenci GERÇEKTEN gönderebiliyor,
-- verilmeyen sınıf arkadaşı gönderemiyor. Satırın yazılması tek başına
-- hiçbir şey kanıtlamaz.
--
-- Tekrar çalıştırılabilir: adlar ve PIN'ler her çalıştırmada farklı.
-- Hiçbir blokta `exception when others` YOK.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  ek   text := substr(md5(random()::text), 1, 6);
  js text; jx text; jo1 text; jo2 text; jo3 text; jveli text;
  s_id uuid; x_id uuid; sa uuid; sb uuid;
  o1 uuid; o2 uuid; o3 uuid; o_pasif uuid; o_baska uuid; o_gonderen uuid;
  d uuid; kod text;
  v jsonb; n integer; t date; m text;
begin
  raise notice '--- Kurulum ---';
  update public.ogretmenler set pin_hash =
    extensions.crypt('EkSure!2026', extensions.gen_salt('bf', 10)) where yonetici;
  js := (public.giris('EkSure!2026'))->>'token';
  select id into s_id from public.ogretmenler where yonetici;
  x_id := (public.ogretmen_ekle(js, 'Xeda EkSure ' || ek, 'XEk!' || ek))->>'id';
  jx := (public.giris('XEk!' || ek))->>'token';

  insert into public.siniflar (seviye, sube) values (12, 'EA')
    on conflict (seviye, sube) do update set arsiv = false returning id into sa;
  insert into public.siniflar (seviye, sube) values (12, 'EB')
    on conflict (seviye, sube) do update set arsiv = false returning id into sb;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    values (s_id, sa), (s_id, sb) on conflict do nothing;

  o1 := (public.ogrenci_ekle(js, 'Ek Süre Bir ' || ek, 'okul', sa))->>'id';
  kod := (select k.kod from public.giris_kodlari k where k.ogrenci_id = o1 and k.rol = 'ogrenci');
  jo1 := (public.giris(kod))->>'token';
  kod := (select k.kod from public.giris_kodlari k where k.ogrenci_id = o1 and k.rol = 'veli');
  jveli := (public.giris(kod))->>'token';
  perform public.onam_ver(jveli, public._gecerli_onam_surumu(), 'Test Velisi');

  o2 := (public.ogrenci_ekle(js, 'Ek Süre İki ' || ek, 'okul', sa))->>'id';
  kod := (select k.kod from public.giris_kodlari k where k.ogrenci_id = o2 and k.rol = 'ogrenci');
  jo2 := (public.giris(kod))->>'token';
  o3 := (public.ogrenci_ekle(js, 'Ek Süre Üç ' || ek, 'okul', sa))->>'id';
  kod := (select k.kod from public.giris_kodlari k where k.ogrenci_id = o3 and k.rol = 'ogrenci');
  jo3 := (public.giris(kod))->>'token';
  o_gonderen := (public.ogrenci_ekle(js, 'Gönderen ' || ek, 'okul', sa))->>'id';
  o_pasif    := (public.ogrenci_ekle(js, 'Pasif Olan ' || ek, 'okul', sa))->>'id';
  o_baska    := (public.ogrenci_ekle(js, 'Başka Sınıf ' || ek, 'okul', sb))->>'id';

  -- SÜRESİ DOLMUŞ, GEÇ TESLİM KAPALI ödev: ek süre olmadan kimse gönderemez.
  d := (public.odev_olustur(js, 'Ek Süre Testi ' || ek, null, sa, 'test',
        current_date + 7, 2, '{"1":"A","2":"B"}'::jsonb, null, null,
        false))->>'id';
  perform public.odev_yayinla(js, d);
  -- Gönderen öğrenci süre dolmadan gönderiyor.
  perform public.odev_gonder(
    (public.giris((select k.kod from public.giris_kodlari k
                   where k.ogrenci_id = o_gonderen and k.rol = 'ogrenci')))->>'token',
    d, 'cozum/' || d || '/' || o_gonderen || '.jpg', '{"1":"A","2":"B"}'::jsonb);
  update public.odevler set son_tarih = current_date - 3 where id = d;
  update public.ogrenciler set aktif = false where id = o_pasif;

  ------------------------------------------------------------------
  raise notice '--- 1. Ek süre satırı oluşuyor ---';
  v := public.ogrencilere_ek_sure(js, d, jsonb_build_array(o1::text),
                                  current_date + 5, 'Rahatsızdın, sonradan gönderebilirsin.');
  select son_tarih into t from public.odev_ek_sure where odev_id = d and ogrenci_id = o1;
  if t is null then
    raise exception 'HATA 1a: EK SÜRE SATIRI YAZILMADI';
  end if;
  if t <> current_date + 5 then
    raise exception 'HATA 1b: tarih yanlış: % (beklenen %)', t, current_date + 5;
  end if;
  if (select veren_id from public.odev_ek_sure where odev_id = d and ogrenci_id = o1) <> s_id then
    raise exception 'HATA 1c: veren yanlış';
  end if;
  if (v->'ogrenciler')->0->>'ogrenci' is null then
    raise exception 'HATA 1d: dönüşte öğrenci adı yok: %', v;
  end if;
  raise notice '    satır, tarih, veren ve dönüş doğru: OK';

  ------------------------------------------------------------------
  raise notice '--- 2. ASIL ÖLÇÜM: öğrenci GERÇEKTEN gönderebiliyor ---';
  -- Ek süresi OLMAYAN sınıf arkadaşı gönderemiyor (süre dolmuş, geç teslim kapalı).
  begin
    perform public.odev_gonder(jo2, d, 'cozum/' || d || '/' || o2 || '.jpg',
                               '{"1":"A"}'::jsonb);
    raise exception 'HATA 2a: kurulum — ek süresiz öğrenci gönderebildi';
  exception when invalid_parameter_value then null; end;
  -- Ek süresi OLAN gönderiyor.
  perform public.odev_gonder(jo1, d, 'cozum/' || d || '/' || o1 || '.jpg',
                             '{"1":"A","2":"B"}'::jsonb);
  if (select puan from public.gonderimler where odev_id = d and ogrenci_id = o1) <> 100 then
    raise exception 'HATA 2b: EK SÜRE VERİLEN ÖĞRENCİ GÖNDEREMEDİ ya da puanlanmadı';
  end if;
  raise notice '    istisna yalnız seçilene: ek süreli gönderdi, ötekine kapalı: OK';

  ------------------------------------------------------------------
  raise notice '--- 3. Ek süre dolunca kapı yine kapanıyor ---';
  perform public.ogrencilere_ek_sure(js, d, jsonb_build_array(o3::text),
                                     current_date + 1, 'Kısa bir ek süre.');
  update public.odev_ek_sure set son_tarih = current_date - 1
   where odev_id = d and ogrenci_id = o3;
  begin
    perform public.odev_gonder(jo3, d, 'cozum/' || d || '/' || o3 || '.jpg',
                               '{"1":"A"}'::jsonb);
    raise exception 'HATA 3a: EK SÜRE DOLMUŞKEN GÖNDERİLDİ — kapı kapanmıyor';
  exception when invalid_parameter_value then null; end;
  raise notice '    süresi dolan ek süre kapıyı açmıyor: OK';

  ------------------------------------------------------------------
  raise notice '--- 4. Mesaj öğrenciye gitti, veliye gitmedi ---';
  select count(*)::integer into n from public.mesajlar
   where ogrenci_id = o1 and kanal = 'ogrenci' and kimden = 'ogretmen'
     and metin like '%ek süre verildi%';
  if n < 1 then
    raise exception 'HATA 4a: EK SÜRE MESAJI ÖĞRENCİYE GİTMEDİ';
  end if;
  if exists (select 1 from public.mesajlar
              where ogrenci_id = o1 and kanal = 'veli'
                and metin like '%ek süre verildi%') then
    raise exception 'HATA 4b: EK SÜRE MESAJI VELİYE DE GİTTİ!';
  end if;
  select metin into m from public.mesajlar
   where ogrenci_id = o1 and kanal = 'ogrenci' and metin like '%ek süre verildi%'
   order by created_at desc limit 1;
  if m not like '%Ek Süre Testi%'
     or m not like '%' || to_char(current_date + 5, 'DD.MM.YYYY') || '%'
     or m not like '%Rahatsızdın, sonradan gönderebilirsin.%' then
    raise exception 'HATA 4c: mesaj ödev adını, tarihi ya da sebebi taşımıyor: %', m;
  end if;
  raise notice '    yalnız öğrenci kanalı; metin ödev, tarih ve sebebi taşıyor: OK';

  ------------------------------------------------------------------
  raise notice '--- 5. Çoklu: tek çağrıda üç öğrenci ---';
  -- Temiz bir ödev: üçü de göndermemiş olsun.
  declare d2 uuid; begin
    d2 := (public.odev_olustur(js, 'Ek Süre Çoklu ' || ek, null, sa, 'test',
           current_date + 7, 1, '{"1":"A"}'::jsonb, null, null, false))->>'id';
    perform public.odev_yayinla(js, d2);
    update public.odevler set son_tarih = current_date - 3 where id = d2;
    v := public.ogrencilere_ek_sure(js, d2,
         jsonb_build_array(o1::text, o2::text, o3::text),
         current_date + 4, 'Üçünüze de ek süre.');
    if jsonb_array_length(v->'ogrenciler') <> 3 then
      raise exception 'HATA 5a: dönüşte üç öğrenci yok: %', v;
    end if;
    if (select count(*) from public.odev_ek_sure where odev_id = d2) <> 3 then
      raise exception 'HATA 5b: üç satır oluşmadı';
    end if;
    if (select count(*) from public.mesajlar
         where ogrenci_id in (o1, o2, o3) and kanal = 'ogrenci'
           and metin like '%Üçünüze de ek süre.%') <> 3 then
      raise exception 'HATA 5c: üç mesaj gitmedi';
    end if;
  end;
  raise notice '    üç satır, üç mesaj: OK';

  ------------------------------------------------------------------
  raise notice '--- 6. İkinci kez verince TARİH GÜNCELLENİYOR ---';
  perform public.ogrencilere_ek_sure(js, d, jsonb_build_array(o3::text),
                                     current_date + 9, 'Süreni uzattım.');
  if (select count(*) from public.odev_ek_sure where odev_id = d and ogrenci_id = o3) <> 1 then
    raise exception 'HATA 6a: ikinci satır oluştu (çift kayıt)';
  end if;
  if (select son_tarih from public.odev_ek_sure where odev_id = d and ogrenci_id = o3)
     <> current_date + 9 then
    raise exception 'HATA 6b: TARİH GÜNCELLENMEDİ — ekranda yeni, kapıda eski tarih olurdu';
  end if;
  raise notice '    tek satır, tarih güncel: OK';

  ------------------------------------------------------------------
  raise notice '--- 7. Zaten göndermiş öğrenci reddediliyor ---';
  begin
    perform public.ogrencilere_ek_sure(js, d, jsonb_build_array(o_gonderen::text),
                                       current_date + 5, 'Gönderene süre.');
    raise exception 'HATA 7a: ZATEN GÖNDERMİŞ ÖĞRENCİYE EK SÜRE VERİLDİ';
  exception when invalid_parameter_value then null; end;
  raise notice '    gönderen reddedildi: OK';

  ------------------------------------------------------------------
  raise notice '--- 8. Başka sınıf, pasif öğrenci, tekrarlı ve boş liste ---';
  begin
    perform public.ogrencilere_ek_sure(js, d, jsonb_build_array(o_baska::text),
                                       current_date + 5, 'Başka sınıfa.');
    raise exception 'HATA 8a: BAŞKA SINIFIN ÖĞRENCİSİNE EK SÜRE VERİLDİ';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.ogrencilere_ek_sure(js, d, jsonb_build_array(o_pasif::text),
                                       current_date + 5, 'Pasife.');
    raise exception 'HATA 8b: LİSTEDEN ÇIKARILMIŞ ÖĞRENCİYE EK SÜRE VERİLDİ';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.ogrencilere_ek_sure(js, d, jsonb_build_array(o2::text, o2::text),
                                       current_date + 5, 'Tekrarlı.');
    raise exception 'HATA 8c: TEKRARLI LİSTE KABUL EDİLDİ';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.ogrencilere_ek_sure(js, d, '[]'::jsonb, current_date + 5, 'Boş.');
    raise exception 'HATA 8d: BOŞ LİSTE KABUL EDİLDİ';
  exception when invalid_parameter_value then null; end;
  raise notice '    dördü de 22023: OK';

  ------------------------------------------------------------------
  raise notice '--- 9. Geçmiş tarih ve geçersiz sebep ---';
  begin
    perform public.ogrencilere_ek_sure(js, d, jsonb_build_array(o2::text),
                                       current_date - 1, 'Geçmiş tarih.');
    raise exception 'HATA 9a: GEÇMİŞ TARİH KABUL EDİLDİ';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.ogrencilere_ek_sure(js, d, jsonb_build_array(o2::text),
                                       null, 'Tarihsiz.');
    raise exception 'HATA 9b: TARİHSİZ ÇAĞRI KABUL EDİLDİ';
  exception when invalid_parameter_value then null; end;
  foreach m in array array['', '  ', 'ab', repeat('x', 501)] loop
    begin
      perform public.ogrencilere_ek_sure(js, d, jsonb_build_array(o2::text),
                                         current_date + 5, m);
      raise exception 'HATA 9c: geçersiz sebep kabul edildi: "%"', left(m, 10);
    exception when invalid_parameter_value then null; end;
  end loop;
  raise notice '    geçmiş/boş tarih ve boş/kısa/uzun sebep 22023: OK';

  ------------------------------------------------------------------
  raise notice '--- 10. Yetki: başka öğretmen ve öğrenci ---';
  perform public.ogretmen_sinif_ata(js, x_id, jsonb_build_array(sa::text));
  begin
    perform public.ogrencilere_ek_sure(jx, d, jsonb_build_array(o2::text),
                                       current_date + 5, 'Başka öğretmen.');
    raise exception 'HATA 10a: BAŞKA ÖĞRETMEN EK SÜRE VERDİ';
  exception when insufficient_privilege then null; end;
  begin
    perform public.ogrencilere_ek_sure(jo1, d, jsonb_build_array(o2::text),
                                       current_date + 5, 'Öğrenci verdi.');
    raise exception 'HATA 10b: ÖĞRENCİ KENDİNE EK SÜRE VERDİ';
  exception when insufficient_privilege then null; end;
  raise notice '    ikisi de 42501: OK';

  ------------------------------------------------------------------
  raise notice '--- 11. ATOMİK: biri geçersizse hiçbiri yazılmıyor ---';
  select count(*)::integer into n from public.odev_ek_sure where odev_id = d;
  begin
    -- o2 geçerli, o_baska geçersiz: ikisi birlikte verilince HİÇBİRİ olmamalı.
    perform public.ogrencilere_ek_sure(js, d,
      jsonb_build_array(o2::text, o_baska::text), current_date + 5, 'Karışık liste.');
    raise exception 'HATA 11a: geçersiz öğrenci içeren liste kabul edildi';
  exception when invalid_parameter_value then null; end;
  if (select count(*) from public.odev_ek_sure where odev_id = d) <> n then
    raise exception 'HATA 11b: YARIM YAZMA — % iken % oldu', n,
      (select count(*) from public.odev_ek_sure where odev_id = d);
  end if;
  if exists (select 1 from public.mesajlar
              where ogrenci_id = o2 and metin like '%Karışık liste.%') then
    raise exception 'HATA 11c: reddedilen çağrıda mesaj gitti';
  end if;
  raise notice '    satır da mesaj da oluşmadı: OK';

  ------------------------------------------------------------------
  raise notice '--- 12. Öğretmenin listesinde ek_sure görünüyor ---';
  v := public.odev_gonderimleri(js, d);
  if (select x->>'ek_sure' from jsonb_array_elements(v->'satirlar') x
       where (x->>'ogrenci_id')::uuid = o3) is null then
    raise exception 'HATA 12a: ek süre verilen öğrencide ek_sure boş geliyor';
  end if;
  if (select x->>'ek_sure' from jsonb_array_elements(v->'satirlar') x
       where (x->>'ogrenci_id')::uuid = o2) is not null then
    raise exception 'HATA 12b: ek süresi olmayan öğrencide ek_sure dolu';
  end if;
  raise notice '    0081''in etiketi doğru satırlarda: OK';

  raise notice '';
  raise notice '=========================================';
  raise notice 'EK SÜRE VERME TESTLERİ: 12 GRUP GEÇTİ';
  raise notice '=========================================';
end;
$$;
