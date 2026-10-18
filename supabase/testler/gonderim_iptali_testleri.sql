-- =============================================================================
-- SEKİZ — GÖNDERİM İPTALİ: KİŞİSEL SON TARİH VE ÖĞRENCİYE HABER (0081)
--
-- Gerçek olay: öğrenci çözüm sayfalarını kaybetmiş, "özür dilerim" yazıp
-- BOŞ SAYFALAR göndermiş. Öğretmen gönderimi kabul etmek istemiyor.
--
-- 0056 gönderimi siliyor ve öğrencinin yeniden göndermesine izin
-- veriyordu, AMA süreyi sınırsız açıyordu ve öğrenciye hiçbir şey
-- söylemiyordu. 0081 ikisini de kapatıyor.
--
-- DOSYA ADI: `yeniden_acma_testleri.sql` ZATEN VAR (0056'nın süiti) ve
-- yetki/iz/silme tarafını ölçüyor. Bu süit YALNIZ 0081'in eklediklerini
-- ölçüyor; adı da bitiş satırı da ayrı.
--
-- Hiçbir blokta `exception when others` YOK: öyle bir yakalayıcı kendinden
-- önceki bütün grupların hatalarını yutar.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  ek   text := substr(md5(random()::text), 1, 6);
  js text; jo text; jveli text;
  s_id uuid; sa uuid; o1 uuid;
  d uuid; g uuid; kod text;
  v jsonb; n integer; t date;
begin
  raise notice '--- Kurulum ---';
  update public.ogretmenler set pin_hash =
    extensions.crypt('Iptal!2026', extensions.gen_salt('bf', 10)) where yonetici;
  js := (public.giris('Iptal!2026'))->>'token';
  select id into s_id from public.ogretmenler where yonetici;

  insert into public.siniflar (seviye, sube) values (10, 'İP')
    on conflict (seviye, sube) do update set arsiv = false returning id into sa;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    values (s_id, sa) on conflict do nothing;

  o1 := (public.ogrenci_ekle(js, 'İptal Deneği ' || ek, 'okul', sa))->>'id';
  kod := (select k.kod from public.giris_kodlari k where k.ogrenci_id = o1 and k.rol = 'ogrenci');
  jo := (public.giris(kod))->>'token';
  kod := (select k.kod from public.giris_kodlari k where k.ogrenci_id = o1 and k.rol = 'veli');
  jveli := (public.giris(kod))->>'token';
  perform public.onam_ver(jveli, public._gecerli_onam_surumu(), 'İptal Velisi');

  -- SÜRESİ DOLMUŞ ve GEÇ TESLİM KAPALI ödev: istisna olmadan gönderilemez.
  d := (public.odev_olustur(js, 'İptal Ödevi ' || ek, null, sa, 'test', current_date + 1, 2,
        '{"1":"A","2":"B"}'::jsonb))->>'id';
  perform public.odev_yayinla(js, d);
  perform public.odev_gonder(jo, d, 'cozum/' || d || '/' || o1 || '.jpg', '{}'::jsonb);
  select id into g from public.gonderimler where odev_id = d and ogrenci_id = o1;
  -- Son tarihi geriye çekiyoruz: artık süresi dolmuş ve geç teslim kapalı.
  update public.odevler set son_tarih = current_date - 3, gec_teslim = false where id = d;

  -- ===========================================================================
  raise notice '--- 1. Yeni tarih kaydediliyor ---';
  v := public.gonderimi_yeniden_ac(js, g, 'Boş sayfa gönderilmiş.', current_date + 5);
  select son_tarih into t from public.odev_ek_sure
   where odev_id = d and ogrenci_id = o1;
  if t is distinct from (current_date + 5) then
    raise exception '1a: kişisel son tarih kaydedilmedi (%)', t;
  end if;
  if (v->>'son_tarih')::date <> (current_date + 5) then
    raise exception '1b: uç verilen tarihi döndürmedi (%)', v->>'son_tarih';
  end if;
  raise notice '    odev_ek_sure satırı doğru: OK';

  -- ===========================================================================
  raise notice '--- 2. Öğrenci yeni tarihe kadar gönderebiliyor ---';
  -- Süre dolmuş VE geç teslim kapalı; yalnız ek süre sayesinde geçiyor.
  perform public.odev_gonder(jo, d, 'cozum/' || d || '/' || o1 || '.jpg',
                             '{"1":"A","2":"B"}'::jsonb);
  select id into g from public.gonderimler where odev_id = d and ogrenci_id = o1;
  if g is null then raise exception '2a: ek süreye rağmen gönderilemedi'; end if;
  raise notice '    süresi dolmuş ödeve ek süreyle gönderildi: OK';

  -- ===========================================================================
  raise notice '--- 3. Yeni tarih GEÇİNCE kapı kapanıyor ---';
  v := public.gonderimi_yeniden_ac(js, g, 'İkinci kez iptal.', current_date + 1);
  -- Tarihi geriye çekiyoruz: ek süre de doldu.
  update public.odev_ek_sure set son_tarih = current_date - 1
   where odev_id = d and ogrenci_id = o1;
  begin
    perform public.odev_gonder(jo, d, 'cozum/' || d || '/' || o1 || '.jpg',
                               '{"1":"A","2":"B"}'::jsonb);
    raise exception '3a: EK SÜRE DOLMUŞKEN GÖNDERİLDİ — kapı kapanmıyor';
  exception when invalid_parameter_value or data_exception then null; end;
  -- Geri açıyoruz ki sonraki gruplar çalışsın.
  update public.odev_ek_sure set son_tarih = current_date + 5
   where odev_id = d and ogrenci_id = o1;
  raise notice '    ek süre dolunca gönderim reddedildi: OK';

  -- ===========================================================================
  raise notice '--- 4. "gecikmeli" damgası KALIYOR ---';
  -- Öğretmenin kararı: ek süre gecikme hesabına karışmıyor; öğrenci
  -- sınıfın son tarihini gerçekten kaçırdı ve kayıt bunu söylüyor.
  perform public.odev_gonder(jo, d, 'cozum/' || d || '/' || o1 || '.jpg',
                             '{"1":"A","2":"B"}'::jsonb);
  select id into g from public.gonderimler where odev_id = d and ogrenci_id = o1;
  if not public._gecikmeli((select created_at from public.gonderimler where id = g),
                           (select son_tarih from public.odevler where id = d)) then
    raise exception '4a: EK SÜRE GECİKME DAMGASINI SİLDİ — 43 çağrı noktası ayrışır';
  end if;
  raise notice '    ek süreye rağmen gecikmeli: OK';

  -- ===========================================================================
  raise notice '--- 5. ek_sure iki uçta da görünüyor ---';
  select (select e->>'ek_sure' from jsonb_array_elements(x->'odevler') e
           where e->>'id' = d::text)
    into kod from (select public.ogrenci_odevleri(jo) as x) q;
  if kod is null or kod::date <> (current_date + 5) then
    raise exception '5a: öğrenci kişisel tarihi görmüyor (%)', kod;
  end if;

  -- Alan adı `satirlar` (0073'ün şekli); ilk yazımda `ogrenciler` okunuyordu
  -- ve ölçüm ürünü değil kendini kırıyordu.
  select (select r->>'ek_sure' from jsonb_array_elements(x->'satirlar') r
           where r->>'ogrenci_id' = o1::text)
    into kod from (select public.odev_gonderimleri(js, d) as x) q;
  if kod is null or kod::date <> (current_date + 5) then
    raise exception '5b: öğretmen ek süreyi görmüyor (%)', kod;
  end if;
  raise notice '    öğrenci ve öğretmen ucunda tarih var: OK';

  -- ===========================================================================
  raise notice '--- 6. Sebep öğrenciye MESAJ olarak gidiyor, veliye GİTMİYOR ---';
  select count(*) into n from public.mesajlar m
   where m.ogrenci_id = o1 and m.kanal = 'ogrenci' and m.kimden = 'ogretmen'
     and m.metin like '%Boş sayfa gönderilmiş.%';
  if n <> 1 then raise exception '6a: iptal sebebi öğrenciye mesaj olmadı (%)', n; end if;

  select count(*) into n from public.mesajlar m
   where m.ogrenci_id = o1 and m.kanal = 'veli'
     and m.metin like '%Boş sayfa gönderilmiş.%';
  if n <> 0 then raise exception '6b: İPTAL SEBEBİ VELİ KANALINA DA YAZILDI (%)', n; end if;
  raise notice '    öğrenci kanalında var, veli kanalında yok: OK';

  -- ===========================================================================
  raise notice '--- 7. Mesaj ödevin adını ve yeni tarihi taşıyor ---';
  select m.metin into kod from public.mesajlar m
   where m.ogrenci_id = o1 and m.kanal = 'ogrenci'
     and m.metin like '%Boş sayfa gönderilmiş.%' limit 1;
  if kod not like '%İptal Ödevi%' then
    raise exception '7a: mesaj ödevin adını taşımıyor: %', kod;
  end if;
  if kod not like ('%' || to_char(current_date + 5, 'DD.MM.YYYY') || '%') then
    raise exception '7b: mesaj yeni tarihi taşımıyor: %', kod;
  end if;
  raise notice '    mesaj ödev adını ve tarihi söylüyor: OK';

  -- ===========================================================================
  raise notice '--- 8. Geçmiş tarih ve sebep sınırları ---';
  begin
    perform public.gonderimi_yeniden_ac(js, g, 'Geçmiş tarih denemesi', current_date - 1);
    raise exception '8a: GEÇMİŞ TARİH KABUL EDİLDİ';
  exception when invalid_parameter_value or data_exception then null; end;
  begin
    perform public.gonderimi_yeniden_ac(js, g, 'Geçmiş tarih denemesi', null);
    raise exception '8b: TARİHSİZ ÇAĞRI KABUL EDİLDİ';
  exception when invalid_parameter_value or data_exception then null; end;
  begin
    perform public.gonderimi_yeniden_ac(js, g, 'ab', current_date + 2);
    raise exception '8c: ÜÇ HARFTEN KISA SEBEP KABUL EDİLDİ';
  exception when invalid_parameter_value or data_exception then null; end;
  raise notice '    geçmiş tarih, boş tarih ve kısa sebep reddedildi: OK';

  -- ===========================================================================
  raise notice '--- 9. Yetki: yalnız sahip ---';
  begin
    perform public.gonderimi_yeniden_ac(jo, g, 'Öğrenci denemesi', current_date + 2);
    raise exception '9a: ÖĞRENCİ GÖNDERİMİ İPTAL ETTİ';
  exception when insufficient_privilege then null; end;
  begin
    perform public.gonderimi_yeniden_ac(jveli, g, 'Veli denemesi', current_date + 2);
    raise exception '9b: VELİ GÖNDERİMİ İPTAL ETTİ';
  exception when insufficient_privilege then null; end;
  raise notice '    öğrenci ve veli reddedildi: OK';

  -- ===========================================================================
  raise notice '--- 10. Eski üç argümanlı uç düşürüldü (0007 tuzağı) ---';
  if to_regprocedure('public.gonderimi_yeniden_ac(text,uuid,text)') is not null then
    raise exception '10a: ESKİ İMZA DURUYOR — PostgREST onu çağırır, tarih kaydedilmez';
  end if;
  if to_regprocedure('public.gonderimi_yeniden_ac(text,uuid,text,date)') is null then
    raise exception '10b: tarihli uç yok';
  end if;
  raise notice '    yalnız tarihli imza var: OK';

  -- ===========================================================================
  raise notice '--- 11. 0081 ÖNCESİ açılanlar hâlâ gönderebiliyor ---';
  -- Eski dal 0081 ÖNCESİNDEN kalan, kişisel tarihi OLMAYAN öğrenciler
  -- için duruyor. Ayırt edici işaret: 0056'nın yazdığı denetim izinde
  -- `son_tarih` anahtarı YOK.
  --
  -- İlk yazımda yalnız `odev_ek_sure` satırı siliniyordu ve taklit
  -- yanlıştı: bu süitin yazdığı bütün izler 0081'e ait, yani hepsi
  -- `son_tarih` taşıyor. Gerçek bir 0056 kaydı elle kuruluyor.
  delete from public.gonderimler where id = g;
  delete from public.odev_ek_sure where odev_id = d and ogrenci_id = o1;
  delete from public.denetim_izi
   where islem = 'gonderim_yeniden_acildi' and eski ->> 'odev_id' = d::text;
  insert into public.denetim_izi (islem, tablo, kayit_id, aktor, eski, yeni)
  values ('gonderim_yeniden_acildi', 'gonderimler', gen_random_uuid(), 'test',
          jsonb_build_object('odev_id', d::text, 'ogrenci_id', o1::text),
          jsonb_build_object('neden', '0056 yolundan açılmış'));
  -- İstisna YAKALANIYOR: yakalanmazsa ürünün kendi hatası ("süresi doldu")
  -- benim etiketimin yerine geçiyor ve kusur provası hangi grubun
  -- kırıldığını söyleyemiyor.
  begin
    perform public.odev_gonder(jo, d, 'cozum/' || d || '/' || o1 || '.jpg',
                               '{"1":"A","2":"B"}'::jsonb);
  exception when others then
    raise exception '11a: ESKİ DAL ÖLDÜ — 0081 öncesi açılanlar gönderemiyor (%)', sqlerrm;
  end;
  if not exists (select 1 from public.gonderimler where odev_id = d and ogrenci_id = o1) then
    raise exception '11a: ESKİ DAL ÖLDÜ — gönderim oluşmadı';
  end if;
  raise notice '    eski kayıtlar mağdur olmadı: OK';

  -- Temizlik: süit iki kez koşulabilmeli.
  delete from public.mesajlar where ogrenci_id = o1;
  delete from public.denetim_izi
   where islem = 'gonderim_yeniden_acildi' and eski ->> 'odev_id' = d::text;
  delete from public.gonderimler where odev_id = d;
  delete from public.odev_ek_sure where odev_id = d;

  raise notice 'GÖNDERİM İPTALİ TESTLERİ: 11 GRUP GEÇTİ';
end $$;
