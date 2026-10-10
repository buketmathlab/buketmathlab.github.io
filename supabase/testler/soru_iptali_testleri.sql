-- =============================================================================
-- SEKİZ — 0072 SORU İPTALİ TESTLERİ
--
-- Gerçek olay: 10. sınıflara 65 soruluk test; 8. ve 35. soruların şıkları
-- baskıda çıkmadı. Öğretmenin kararı: iki soru DEĞERLENDİRME DIŞI, puan 63
-- soru üzerinden; aynı ödevin bütün şubelerinde.
--
--  1. İptal: puan doğru ÷ 63; doğru/yanlış/boş 63 içinden; soru dökümü ve
--     konu analizi iptali saymıyor; kardeş şube de yeniden puanlandı;
--     arşivdeki şube atlandı; denetim izinde sebep var.
--  2. Elle düzeltilmiş puan korunuyor ve raporda listeleniyor.
--  3. İptalden sonra geç teslim 63 üzerinden puanlanıyor.
--  4. odev_guncelle işaretli anahtarı kaydedince işaret bozulmuyor.
--  5. Geri alma asıl harfi ve eski puanı geri getiriyor.
--  6. Reddedilenler: öğrenci, veli, başka öğretmen; 0 / 66 / tekrar;
--     bütün sorular; boş sebep; açık uçlu ödev.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt   text;            -- ödevi veren öğretmen (sahip)
  jb   text;            -- başka öğretmen
  jo1  text; jo2 text; jo3 text; jo4 text; jv1 text;
  o1   uuid; o2 uuid; o3 uuid; o4 uuid;
  s_a  uuid; s_b uuid; s_c uuid;
  d_a  uuid; d_b uuid; d_c uuid; d_acik uuid;
  v    jsonb; r jsonb;
  anahtar jsonb := '{}'::jsonb;
  tam     jsonb := '{}'::jsonb;   -- bütün sorular doğru (8 ve 35 BOŞ)
  yarim   jsonb := '{}'::jsonb;   -- ilk 30 doğru, gerisi boş
  konular jsonb := '{}'::jsonb;
  g    record;
  harfler text[] := array['A','B','C','D','E'];
  i    integer;
begin
  raise notice '--- Kurulum ---';
  update public.ogretmenler
     set pin_hash = extensions.crypt('Iptal!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Iptal!2026'))->>'token';
  if not exists (select 1 from public.ogretmenler where ad = 'İptal Yabancı') then
    perform public.ogretmen_ekle(jt, 'İptal Yabancı', 'IptalY!2026');
  end if;
  jb := (public.giris('IptalY!2026'))->>'token';

  for i in 1..65 loop
    anahtar := anahtar || jsonb_build_object(i::text, harfler[1 + (i % 5)]);
    if i not in (8, 35) then
      tam := tam || jsonb_build_object(i::text, harfler[1 + (i % 5)]);
    end if;
    if i <= 30 and i <> 8 then
      yarim := yarim || jsonb_build_object(i::text, harfler[1 + (i % 5)]);
    end if;
    konular := konular || jsonb_build_object(i::text, case when i <= 10 then 'Üslü' else 'Köklü' end);
  end loop;

  r := public.sinif_ekle(jt, 10::smallint, 'İA'); s_a := (r->>'id')::uuid;
  r := public.sinif_ekle(jt, 10::smallint, 'İB'); s_b := (r->>'id')::uuid;
  r := public.sinif_ekle(jt, 10::smallint, 'İC'); s_c := (r->>'id')::uuid;

  v := public.odevler_coklu_olustur(jt, jsonb_build_array(s_a, s_b, s_c),
         'İPTAL Üslü ve Köklü', null, 'test', current_date + 7,
         65, anahtar, null, null, true, 5::smallint, konular);
  d_a := (v->'odevler'->0->>'odev_id')::uuid;
  d_b := (v->'odevler'->1->>'odev_id')::uuid;
  d_c := (v->'odevler'->2->>'odev_id')::uuid;
  perform public.odev_yayinla(jt, d_a);
  perform public.odev_yayinla(jt, d_b);
  perform public.odev_yayinla(jt, d_c);

  r := public.ogrenci_ekle(jt, 'İptal Ada', 'okul', s_a);
  o1 := (r->>'id')::uuid; jo1 := (public.giris(r->>'ogrenci_kodu'))->>'token';
  jv1 := (public.giris(r->>'veli_kodu'))->>'token';
  perform public.onam_ver(jv1, public._gecerli_onam_surumu(), 'İptal Velisi');
  r := public.ogrenci_ekle(jt, 'İptal Efe', 'okul', s_a);
  o2 := (r->>'id')::uuid; jo2 := (public.giris(r->>'ogrenci_kodu'))->>'token';
  r := public.ogrenci_ekle(jt, 'İptal Can', 'okul', s_b);
  o3 := (r->>'id')::uuid; jo3 := (public.giris(r->>'ogrenci_kodu'))->>'token';
  r := public.ogrenci_ekle(jt, 'İptal Geç', 'okul', s_a);
  o4 := (r->>'id')::uuid; jo4 := (public.giris(r->>'ogrenci_kodu'))->>'token';

  -- Ada: 63 sorunun hepsi doğru, 8 ve 35 boş (işaretleyemedi).
  perform public.odev_gonder(jo1, d_a, 'cozum/' || d_a || '/' || o1 || '.jpg', tam);
  -- Efe: 1–30 doğru (8 hariç), gerisi boş.
  perform public.odev_gonder(jo2, d_a, 'cozum/' || d_a || '/' || o2 || '.jpg', yarim);
  -- Can (10İB): hepsi doğru.
  perform public.odev_gonder(jo3, d_b, 'cozum/' || d_b || '/' || o3 || '.jpg', tam);

  select * into g from public.gonderimler where odev_id = d_a and ogrenci_id = o1;
  if g.puan <> round(63 * 100.0 / 65, 2) then
    raise exception 'kurulum: Ada iptalden önce 63/65 olmalı (%)', g.puan;
  end if;

  -- Efe'nin puanını sahip elle düzeltiyor (2. grup).
  perform public.puan_duzelt(jt, (select id from public.gonderimler where odev_id = d_a and ogrenci_id = o2),
                             50, 'Test: elle düzeltme');

  -- 10İC arşive alınıyor (1. grup: atlanmalı).
  update public.siniflar set arsiv = true where id = s_c;

  -- ===========================================================================
  raise notice '--- 1. İptal: 63 soru üzerinden ---';
  -- ===========================================================================
  v := public.sorulari_iptal_et(jt, d_a, array[35, 8], 'Şıklar baskıda çıkmadı');

  if v->'sorular' <> '[8, 35]'::jsonb then
    raise exception '1a: sorular sıralı dönmedi (%)', v->'sorular';
  end if;

  select * into g from public.gonderimler where odev_id = d_a and ogrenci_id = o1;
  if g.puan <> 100 or g.dogru <> 63 or g.yanlis <> 0 or g.bos <> 0 then
    raise exception '1b: Ada 63/63 = 100 olmalı (puan %, d %, y %, b %)', g.puan, g.dogru, g.yanlis, g.bos;
  end if;
  raise notice '    Ada: 63/63 = 100, boş 0: OK';

  select * into g from public.gonderimler where odev_id = d_a and ogrenci_id = o2;
  if g.puan <> round(29 * 100.0 / 63, 2) or g.bos <> 34 then
    raise exception '1c: Efe 29/63 olmalı (puan %, boş %)', g.puan, g.bos;
  end if;
  raise notice '    Efe: 29/63, boş 34 (65 − 2 iptal − 29): OK';

  -- Kardeş şube (10İB) de yeniden puanlandı.
  select * into g from public.gonderimler where odev_id = d_b and ogrenci_id = o3;
  if g.puan <> 100 then
    raise exception '1d: KARDEŞ ŞUBE yeniden puanlanmadı (%)', g.puan;
  end if;
  if (select cevap_anahtari->>'8' from public.odevler where id = d_b) not like 'IPTAL:%' then
    raise exception '1e: kardeşin anahtarında iptal işareti yok';
  end if;
  raise notice '    kardeş şube 10İB: 100: OK';

  -- Arşivdeki şube atlandı, anahtarı değişmedi.
  if (select cevap_anahtari->>'8' from public.odevler where id = d_c) like 'IPTAL%' then
    raise exception '1f: ARŞİVDEKİ şubenin anahtarı değişti';
  end if;
  if not exists (select 1 from jsonb_array_elements(v->'subeler') e
                  where (e->>'odev_id')::uuid = d_c and e->>'atlandi' = 'arsiv') then
    raise exception '1g: arşivdeki şube raporda "atlandi" değil: %', v->'subeler';
  end if;
  raise notice '    arşivdeki şube atlandı ve raporlandı: OK';

  -- Asıl harf saklanıyor.
  if (select cevap_anahtari->>'8' from public.odevler where id = d_a) <> 'IPTAL:' || harfler[1 + (8 % 5)] then
    raise exception '1h: asıl harf saklanmadı (%)', (select cevap_anahtari->>'8' from public.odevler where id = d_a);
  end if;

  -- Soru dökümü: iptal yanlış/boş listesinde yok, ayrı listede.
  r := public._soru_dokumu((select cevap_anahtari from public.odevler where id = d_a), tam, 65);
  if r->'bos' <> '[]'::jsonb or r->'iptal' <> '[8, 35]'::jsonb then
    raise exception '1i: soru dökümü iptali ayırmıyor (%)', r;
  end if;
  -- Veli de "Boş: 8, 35" görmüyor.
  select e into r from jsonb_array_elements(public.veli_paneli(jv1)->'odevler') e
   where e->>'baslik' = 'İPTAL Üslü ve Köklü';
  if r->'bos_sorular' <> '[]'::jsonb or (r->>'puan')::numeric <> 100 then
    raise exception '1j: veli ekranı iptali yansıtmıyor (%)', r;
  end if;
  raise notice '    soru dökümü ve veli ekranı: iptal boş sayılmıyor: OK';

  -- Konu analizi: Üslü (1–10) konusu 9 soru (8 iptal), Köklü 54 (35 iptal).
  r := public._konu_analizi(konular, (select cevap_anahtari from public.odevler where id = d_a), tam, 65);
  if (select (e->>'toplam')::integer from jsonb_array_elements(r) e where e->>'konu' = 'Üslü') <> 9
     or (select (e->>'toplam')::integer from jsonb_array_elements(r) e where e->>'konu' = 'Köklü') <> 54 then
    raise exception '1k: konu analizi iptali sayıyor (%)', r;
  end if;
  raise notice '    konu analizi: Üslü 9, Köklü 54: OK';

  -- Denetim izi: ödev başına sebep, gönderim başına yeniden puanlama.
  if not exists (select 1 from public.denetim_izi dk
                  where dk.islem = 'soru_iptal_edildi' and dk.kayit_id = d_a
                    and dk.yeni->>'sebep' = 'Şıklar baskıda çıkmadı') then
    raise exception '1l: iptal izi (sebep) yok';
  end if;
  if not exists (select 1 from public.denetim_izi dk
                  where dk.islem = 'yeniden_puanlandi'
                    and dk.kayit_id = (select id from public.gonderimler where odev_id = d_a and ogrenci_id = o1)) then
    raise exception '1m: yeniden puanlama izi yok';
  end if;
  raise notice '    denetim izi: sebep ve yeniden puanlama: OK';

  -- ===========================================================================
  raise notice '--- 2. Elle düzeltilmiş puan korunuyor ---';
  -- ===========================================================================
  select * into g from public.gonderimler where odev_id = d_a and ogrenci_id = o2;
  if g.ogretmen_puan <> 50 then
    raise exception '2a: elle düzeltilmiş puan değişti (%)', g.ogretmen_puan;
  end if;
  if not exists (select 1 from jsonb_array_elements(v->'subeler') e,
                       jsonb_array_elements(e->'elle_duzeltilmis') x
                  where x->>'ogrenci' = 'İptal Efe') then
    raise exception '2b: elle düzeltilmiş puan raporda yok: %', v->'subeler';
  end if;
  raise notice '    ogretmen_puan korundu ve raporlandı: OK';

  -- ===========================================================================
  raise notice '--- 3. Geç teslim de 63 üzerinden ---';
  -- ===========================================================================
  perform public.odev_gonder(jo4, d_a, 'cozum/' || d_a || '/' || o4 || '.jpg', tam);
  if (select puan from public.gonderimler where odev_id = d_a and ogrenci_id = o4) <> 100 then
    raise exception '3a: iptalden sonraki teslim 63 üzerinden puanlanmadı';
  end if;
  raise notice '    yeni teslim 100: OK';

  -- ===========================================================================
  raise notice '--- 4. odev_guncelle işareti korur ---';
  -- ===========================================================================
  perform public.odev_guncelle(jt, d_a, 'İPTAL Üslü ve Köklü', null, s_a, current_date + 8, 65,
                               (select cevap_anahtari from public.odevler where id = d_a), null, null);
  if (select cevap_anahtari->>'35' from public.odevler where id = d_a) not like 'IPTAL:%'
     or (select puan from public.gonderimler where odev_id = d_a and ogrenci_id = o1) <> 100 then
    raise exception '4a: odev_guncelle iptal işaretini bozdu';
  end if;
  raise notice '    işaret ve puan korundu: OK';

  -- ===========================================================================
  raise notice '--- 5. Geri alma ---';
  -- ===========================================================================
  v := public.soru_iptalini_geri_al(jt, d_a, 35);
  if (select cevap_anahtari->>'35' from public.odevler where id = d_a) <> harfler[1 + (35 % 5)]
     or (select cevap_anahtari->>'35' from public.odevler where id = d_b) <> harfler[1 + (35 % 5)] then
    raise exception '5a: asıl harf iki şubede de geri gelmedi';
  end if;
  if (select puan from public.gonderimler where odev_id = d_a and ogrenci_id = o1) <> round(63 * 100.0 / 64, 2) then
    raise exception '5b: geri almadan sonra 63/64 olmalı';
  end if;
  if not exists (select 1 from public.denetim_izi where islem = 'soru_iptali_geri_alindi' and kayit_id = d_a) then
    raise exception '5c: geri alma izi yok';
  end if;
  raise notice '    35 geri geldi (iki şube), puan 63/64, iz var: OK';

  -- ===========================================================================
  raise notice '--- 6. Reddedilenler ---';
  -- ===========================================================================
  begin perform public.sorulari_iptal_et(jo1, d_a, array[1], 'deneme');
    raise exception '6a: ÖĞRENCİ İPTAL EDEBİLDİ';
  exception when insufficient_privilege then null; end;
  begin perform public.sorulari_iptal_et(jv1, d_a, array[1], 'deneme');
    raise exception '6b: VELİ İPTAL EDEBİLDİ';
  exception when insufficient_privilege then null; end;
  begin perform public.sorulari_iptal_et(jb, d_a, array[1], 'deneme');
    raise exception '6c: BAŞKA ÖĞRETMEN İPTAL EDEBİLDİ';
  exception when insufficient_privilege then null; end;
  begin perform public.soru_iptalini_geri_al(jb, d_a, 8);
    raise exception '6d: BAŞKA ÖĞRETMEN GERİ ALABİLDİ';
  exception when insufficient_privilege then null; end;
  if not exists (select 1 from public.ogretmenler where ad = 'İptal Müdür') then
    perform public.mudur_ekle(jt, 'İptal Müdür', 'IptalM!2026');
  end if;
  begin perform public.sorulari_iptal_et((public.giris('IptalM!2026'))->>'token', d_a, array[1], 'deneme');
    raise exception '6d2: MÜDÜR İPTAL EDEBİLDİ';
  exception when insufficient_privilege then null; end;
  raise notice '    öğrenci, veli, müdür, başka öğretmen: 42501: OK';

  begin perform public.sorulari_iptal_et(jt, d_a, array[0], 'deneme');
    raise exception '6e: 0 kabul edildi';
  exception when invalid_parameter_value then null; end;
  begin perform public.sorulari_iptal_et(jt, d_a, array[66], 'deneme');
    raise exception '6f: 66 kabul edildi';
  exception when invalid_parameter_value then null; end;
  begin perform public.sorulari_iptal_et(jt, d_a, array[3, 3], 'deneme');
    raise exception '6g: tekrar kabul edildi';
  exception when invalid_parameter_value then null; end;
  begin perform public.sorulari_iptal_et(jt, d_a, array[3], '  ');
    raise exception '6h: boş sebep kabul edildi';
  exception when invalid_parameter_value then null; end;
  begin perform public.sorulari_iptal_et(jt, d_a, array(select generate_series(1, 65)), 'hepsi');
    raise exception '6i: BÜTÜN SORULAR İPTAL EDİLEBİLDİ';
  exception when invalid_parameter_value then null; end;
  -- Reddedilen "hepsi" denemesi hiçbir şeyi değiştirmedi (işlem bütün).
  if (select cevap_anahtari->>'1' from public.odevler where id = d_a) like 'IPTAL%' then
    raise exception '6j: reddedilen iptal anahtarı yarım değiştirdi';
  end if;

  v := public.odev_olustur(jt, 'İPTAL Açık uçlu', null, s_a, 'acik', current_date + 7);
  d_acik := (v->>'id')::uuid;
  begin perform public.sorulari_iptal_et(jt, d_acik, array[1], 'deneme');
    raise exception '6k: açık uçlu ödevde iptal kabul edildi';
  exception when invalid_parameter_value then null; end;
  raise notice '    0 / 66 / tekrar / boş sebep / hepsi / açık uçlu: 22023: OK';

  raise notice '';
  raise notice 'SORU İPTALİ TESTLERİ GEÇTİ';
end;
$$;
