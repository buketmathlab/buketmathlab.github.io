-- =============================================================================
-- SEKİZ — 0073/0074 DENEME HESABI TESTLERİ
--
-- Öğretmenin isteği: gerçek olmayan bir öğrenci ve velisiyle, gerçek
-- öğrenci ve veli gibi birebir deneme. Deneme hiçbir sayıya karışmamalı.
--
--  1. Yetki: yalnız sahip; ikinci deneme reddediliyor; özel/arşiv sınıf yok.
--  2. Birebir: deneme öğrenci ve velisi giriyor; öğrenci ödevini görüyor,
--     gönderiyor, puan alıyor; veli onam verip panelini görüyor.
--  3. HİÇBİR SAYIYA GİRMİYOR: deneme oluşturulup ödev gönderdikten SONRA
--     sınıf/okul/müdür/öğretmen uçlarının çıktısı ÖNCEKİYLE BİREBİR AYNI.
--  4. Listeler: sahip görüyor, başka öğretmen görmüyor; gönderimler
--     sayfasında sayılar aynı, satırda yalnız sahip görüyor.
--  5. E-okul eşitlemesi deneme öğrenciyi "listede yok" diye pasifleştirmiyor.
--  6. Sınıf değiştirme; sıfırlama (gönderim gider, KODLAR AYNI kalır);
--     silme.
--  7. 0074 — HER DÜZEYE AYRI HESAP, GEÇMİŞ ÖDEVLERİN HEPSİ AÇIK:
--     a) aynı düzeyde ikinci hesap ve o düzeye taşıma reddediliyor;
--     b) 10 gün önce verilmiş, dün dolmuş ödev BUGÜN oluşturulan deneme
--        hesabında (öğrenci ve veli) görünüyor; bugün eklenen GERÇEK
--        öğrencide görünmüyor (kural korunuyor);
--     c) geç teslimi kapalı, süresi dolmuş ödeve deneme gönderiyor ve
--        puan alıyor; gerçek öğrenci "süresi doldu" alıyor;
--     d) sıfırlama yalnız o hesabı siliyor, öbür düzey duruyor;
--        sinif_giris NULL kalıyor.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt   text;   -- sahip
  jb   text;   -- başka öğretmen (sınıfın öğretmeni)
  jo1  text; jo2 text; jod text; jvd text;
  o1   uuid; o2 uuid;
  s_a  uuid; s_b uuid;
  d1   uuid;
  r    jsonb; v jsonb;
  dn jsonb; dl jsonb;
  s_c  uuid; d2 uuid; o3 uuid; jo3 text; dn2 jsonb; jod2 text; jvd2 text;
  once jsonb; sonra jsonb;
  kod_ogr text; kod_veli text;
  ek text := substr(md5(random()::text), 1, 6);
  uc text;
  n integer;
begin
  raise notice '--- Kurulum ---';
  update public.ogretmenler
     set pin_hash = extensions.crypt('Deneme!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Deneme!2026'))->>'token';

  r := public.sinif_ekle(jt, 11::smallint, 'DN'); s_a := (r->>'id')::uuid;
  r := public.sinif_ekle(jt, 11::smallint, 'DM'); s_b := (r->>'id')::uuid;
  if not exists (select 1 from public.ogretmenler where ad = 'Deneme Yabancı') then
    perform public.ogretmen_ekle(jt, 'Deneme Yabancı', 'DenemeY!2026');
  end if;
  jb := (public.giris('DenemeY!2026'))->>'token';
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    select id, s_a from public.ogretmenler where ad = 'Deneme Yabancı'
    on conflict do nothing;

  r := public.ogrenci_ekle(jt, 'Deneme Testi Ali ' || ek, 'okul', s_a);
  o1 := (r->>'id')::uuid; jo1 := (public.giris(r->>'ogrenci_kodu'))->>'token';
  r := public.ogrenci_ekle(jt, 'Deneme Testi Ece ' || ek, 'okul', s_a);
  o2 := (r->>'id')::uuid; jo2 := (public.giris(r->>'ogrenci_kodu'))->>'token';

  r := public.odev_olustur(jt, 'DENEME Testi', null, s_a, 'test', current_date + 3, 4,
                           '{"1":"A","2":"B","3":"C","4":"D"}'::jsonb, null, null, true);
  d1 := (r->>'id')::uuid;
  perform public.odev_yayinla(jt, d1);
  perform public.odev_gonder(jo1, d1, 'cozum/' || d1 || '/' || o1 || '.jpg', '{"1":"A","2":"B","3":"C","4":"D"}'::jsonb);
  perform public.odev_gonder(jo2, d1, 'cozum/' || d1 || '/' || o2 || '.jpg', '{"1":"A","2":"A"}'::jsonb);
  -- Süre dolsun: ortalama, kıyas ve gönderim oranı süresi dolanlardan.
  update public.odevler set son_tarih = current_date - 1 where id = d1;

  -- ===========================================================================
  raise notice '--- ÖNCE: sayıların fotoğrafı ---';
  -- ===========================================================================
  once := jsonb_build_object(
    'okul_geneli', public.okul_geneli(jt),
    'mudur_paneli', public.mudur_paneli(jt),
    'sinif_kartlari', public.sinif_kartlari(jt),
    'ogretmen_panosu', public.ogretmen_panosu(jt) - 'son_gonderimler',
    'okul_bilgilendirme', public.okul_bilgilendirme(jt),
    'ogretmen_duyurulari', public.ogretmen_duyurulari(jt),
    'siniflar_listesi', public.siniflar_listesi(jt, false),
    'sinif_not_cizelgesi', public.sinif_not_cizelgesi(jt, s_a, false),
    'sinif_ogrenci_ozeti', public.sinif_ogrenci_ozeti(jt, s_a),
    'sinif_analizi', public.sinif_analizi(jt, s_a, null, null),
    'konu_karnesi', public.konu_karnesi(jt, s_a, null),
    'odevler_listesi', public.odevler_listesi(jt, s_a, null),
    'odev_detay_sayi', public.odev_detay(jt, d1)->'gonderim_sayisi',
    'onam_dokumu', public.onam_dokumu(jt, s_a),
    'kiyas', public._odev_kiyasi(d1),
    'gonderimler_sayilar', (select jsonb_object_agg(k, v2) from jsonb_each(public.odev_gonderimleri(jt, d1)) e(k, v2)
                             where k in ('mevcut', 'gonderen', 'gecikmeli', 'puan_bekleyen')),
    'baska_ogrenciler', public.ogrenciler_listesi(jb, null, s_a, 1, 50, 'ad'),
    'baska_veliler', public.sinif_velileri(jb, s_a));

  -- ===========================================================================
  raise notice '--- 1. Yetki ---';
  -- ===========================================================================
  begin perform public.deneme_hesabi_olustur(jb, s_a);
    raise exception '1a: BAŞKA ÖĞRETMEN DENEME HESABI AÇTI';
  exception when insufficient_privilege then null; end;
  begin perform public.deneme_hesabi_olustur(jo1, s_a);
    raise exception '1b: ÖĞRENCİ DENEME HESABI AÇTI';
  exception when insufficient_privilege then null; end;
  begin perform public.deneme_hesabi_olustur(jt, (select id from public.siniflar where ozel));
    raise exception '1c: özel ders grubuna deneme açıldı';
  exception when invalid_parameter_value then null; end;
  if jsonb_array_length(public.deneme_hesaplari(jt)) <> 0 then
    raise exception '1d: başlangıçta deneme hesabı var görünüyor';
  end if;

  dl := public.deneme_hesabi_olustur(jt, s_a);
  dn := dl->0;
  if jsonb_array_length(dl) <> 1 or dn->>'sinif' <> '11DN' or (dn->>'seviye')::int <> 11
     or dn->>'ogrenci_kodu' is null or dn->>'veli_kodu' is null then
    raise exception '1e: oluşturma yanıtı eksik (%)', dn;
  end if;
  -- 0074: aynı düzeyin başka şubesi de reddediliyor (11DM).
  begin perform public.deneme_hesabi_olustur(jt, s_b);
    raise exception '1f: AYNI DÜZEYDE İKİNCİ DENEME HESABI AÇILDI';
  exception when unique_violation then null; end;
  raise notice '    yalnız sahip; özel grup ve ikinci hesap reddedildi; kodlar döndü: OK';

  -- ===========================================================================
  raise notice '--- 2. Birebir öğrenci ve veli ---';
  -- ===========================================================================
  v := public.giris(dn->>'ogrenci_kodu');
  if v->>'rol' <> 'ogrenci' then raise exception '2a: deneme öğrenci girişi: %', v; end if;
  jod := v->>'token';
  v := public.giris(dn->>'veli_kodu');
  if v->>'rol' <> 'veli' then raise exception '2b: deneme veli girişi: %', v; end if;
  jvd := v->>'token';

  if not exists (select 1 from jsonb_array_elements(public.ogrenci_odevleri(jod)->'odevler') e
                  where e->>'baslik' = 'DENEME Testi') then
    raise exception '2c: deneme öğrenci sınıfının ödevini görmüyor';
  end if;
  perform public.odev_gonder(jod, d1, 'cozum/' || d1 || '/' || (dn->>'id') || '.jpg',
                             '{"1":"D","2":"D","3":"D","4":"D"}'::jsonb);
  if (select puan from public.gonderimler where odev_id = d1 and ogrenci_id = (dn->>'id')::uuid) is distinct from 25 then
    raise exception '2d: deneme gönderimi puanlanmadı';
  end if;
  perform public.onam_ver(jvd, public._gecerli_onam_surumu(), 'Deneme Veli');
  if public.veli_paneli(jvd)->'ogrenci'->>'ad' <> 'Deneme Öğrenci' then
    raise exception '2e: deneme veli panelini göremiyor';
  end if;
  raise notice '    öğrenci ve veli girdi; ödev görüldü, gönderildi, puanlandı; onam ve veli paneli: OK';

  -- ===========================================================================
  raise notice '--- 3. HİÇBİR SAYIYA GİRMİYOR (önce = sonra) ---';
  -- ===========================================================================
  sonra := jsonb_build_object(
    'okul_geneli', public.okul_geneli(jt),
    'mudur_paneli', public.mudur_paneli(jt),
    'sinif_kartlari', public.sinif_kartlari(jt),
    'ogretmen_panosu', public.ogretmen_panosu(jt) - 'son_gonderimler',
    'okul_bilgilendirme', public.okul_bilgilendirme(jt),
    'ogretmen_duyurulari', public.ogretmen_duyurulari(jt),
    'siniflar_listesi', public.siniflar_listesi(jt, false),
    'sinif_not_cizelgesi', public.sinif_not_cizelgesi(jt, s_a, false),
    'sinif_ogrenci_ozeti', public.sinif_ogrenci_ozeti(jt, s_a),
    'sinif_analizi', public.sinif_analizi(jt, s_a, null, null),
    'konu_karnesi', public.konu_karnesi(jt, s_a, null),
    'odevler_listesi', public.odevler_listesi(jt, s_a, null),
    'odev_detay_sayi', public.odev_detay(jt, d1)->'gonderim_sayisi',
    'onam_dokumu', public.onam_dokumu(jt, s_a),
    'kiyas', public._odev_kiyasi(d1),
    'gonderimler_sayilar', (select jsonb_object_agg(k, v2) from jsonb_each(public.odev_gonderimleri(jt, d1)) e(k, v2)
                             where k in ('mevcut', 'gonderen', 'gecikmeli', 'puan_bekleyen')),
    'baska_ogrenciler', public.ogrenciler_listesi(jb, null, s_a, 1, 50, 'ad'),
    'baska_veliler', public.sinif_velileri(jb, s_a));

  n := 0;
  for uc in select jsonb_object_keys(once) loop
    if once->uc is distinct from sonra->uc then
      raise notice '    FARK %: önce % / sonra %', uc, left((once->uc)::text, 400), left((sonra->uc)::text, 400);
      raise notice '    FARK ANAHTARLARI: %', (select string_agg(k, ', ') from jsonb_object_keys(once->uc) k
                                              where (once->uc)->k is distinct from (sonra->uc)->k);
      n := n + 1;
    end if;
  end loop;
  if n > 0 then
    raise exception '3a: DENEME ÖĞRENCİ % UÇTA SAYILARA KARIŞTI', n;
  end if;
  -- Son gönderimler AYRI: aynı işlemde eklenen gönderimlerin zamanı eşit,
  -- sıraları belirsiz. Ölçülen şey sıra değil, deneme satırının YOKLUĞU.
  if (public.ogretmen_panosu(jt)->'son_gonderimler')::text like '%Deneme Öğrenci%' then
    raise exception '3b: deneme gönderimi panodaki son gönderimlerde';
  end if;
  raise notice '    % uç birebir aynı (deneme öğrenci ve gönderimi hiçbir yerde yok): OK',
    (select count(*) from jsonb_object_keys(once));

  -- ===========================================================================
  raise notice '--- 4. Listeler: sahip görüyor ---';
  -- ===========================================================================
  if not exists (select 1 from jsonb_array_elements(public.ogrenciler_listesi(jt, null, s_a, 1, 50, 'ad')->'kayitlar') e
                  where e->>'ad' = 'Deneme Öğrenci') then
    raise exception '4a: sahip deneme öğrenciyi öğrenci listesinde görmüyor';
  end if;
  if (public.odev_gonderimleri(jt, d1))::text not like '%Deneme Öğrenci%' then
    raise exception '4b: sahip deneme gönderimini gönderimler sayfasında görmüyor';
  end if;
  if (public.odev_gonderimleri(jb, d1))::text like '%Deneme Öğrenci%' then
    raise exception '4c: BAŞKA ÖĞRETMEN deneme gönderimini görüyor';
  end if;
  raise notice '    sahip listede ve gönderimlerde görüyor; başka öğretmen görmüyor: OK';

  -- ===========================================================================
  raise notice '--- 5. E-okul eşitlemesi deneme öğrenciye dokunmuyor ---';
  -- ===========================================================================
  v := public.siniflari_esitle(jt, jsonb_build_array(jsonb_build_object(
         'sinif_id', s_a, 'adlar', jsonb_build_array(
           jsonb_build_object('ad', 'Deneme Testi Ali ' || ek), jsonb_build_object('ad', 'Deneme Testi Ece ' || ek)))), true);
  if not (select aktif from public.ogrenciler where deneme) then
    raise exception '5a: EŞİTLEME DENEME ÖĞRENCİYİ PASİFLEŞTİRDİ';
  end if;
  if v::text like '%Deneme Öğrenci%' then
    raise exception '5b: eşitleme raporunda deneme öğrenci geçiyor: %', v;
  end if;
  raise notice '    aktif kaldı, raporda yok: OK';

  -- ===========================================================================
  raise notice '--- 6. Sınıf değiştir, sıfırla, sil ---';
  -- ===========================================================================
  dn := public.deneme_sinifi_degistir(jt, (dn->>'id')::uuid, s_b)->0;
  if dn->>'sinif' <> '11DM' then raise exception '6a: sınıf değişmedi (%)', dn; end if;
  kod_ogr := dn->>'ogrenci_kodu'; kod_veli := dn->>'veli_kodu';
  dn := public.deneme_sinifi_degistir(jt, (dn->>'id')::uuid, s_a)->0;

  dn := public.deneme_sifirla(jt, (dn->>'id')::uuid)->0;
  if dn->>'ogrenci_kodu' <> kod_ogr or dn->>'veli_kodu' <> kod_veli then
    raise exception '6b: sıfırlamada kodlar değişti';
  end if;
  if exists (select 1 from public.gonderimler g join public.ogrenciler o on o.id = g.ogrenci_id where o.deneme) then
    raise exception '6c: sıfırlamadan sonra deneme gönderimi duruyor';
  end if;
  if (select count(*) from public.gonderimler where odev_id = d1) <> 2 then
    raise exception '6d: SIFIRLAMA GERÇEK GÖNDERİMLERE DOKUNDU';
  end if;
  if (public.giris(kod_ogr))->>'rol' <> 'ogrenci' then
    raise exception '6e: sıfırlamadan sonra aynı kodla girilemiyor';
  end if;
  if not exists (select 1 from public.denetim_izi where islem = 'deneme_hesabi_sifirlandi') then
    raise exception '6f: sıfırlama izi yok';
  end if;

  perform public.deneme_hesabi_sil(jt, (dn->>'id')::uuid);
  if exists (select 1 from public.ogrenciler where deneme) or jsonb_array_length(public.deneme_hesaplari(jt)) <> 0 then
    raise exception '6g: deneme hesabı silinmedi';
  end if;
  if (select count(*) from public.ogrenciler where id in (o1, o2) and aktif) <> 2 then
    raise exception '6h: SİLME GERÇEK ÖĞRENCİLERE DOKUNDU';
  end if;
  raise notice '    sınıf değişti; sıfırlama kodları korudu, yalnız deneme verisini sildi; silme: OK';

  -- ===========================================================================
  raise notice '--- 7. 0074: her düzeye ayrı hesap, geçmiş ödevlerin hepsi açık ---';
  -- ===========================================================================
  r := public.sinif_ekle(jt, 10::smallint, 'DN'); s_c := (r->>'id')::uuid;
  -- GEÇMİŞ ÖDEV: 10 gün önce verilmiş, dün dolmuş, geç teslim KAPALI.
  r := public.odev_olustur(jt, 'DENEME Geçmiş', null, s_c, 'test', current_date + 3, 4,
                           '{"1":"A","2":"B","3":"C","4":"D"}'::jsonb, null, null, false);
  d2 := (r->>'id')::uuid;
  perform public.odev_yayinla(jt, d2);
  update public.odevler set son_tarih = current_date - 1, created_at = now() - interval '10 days'
   where id = d2;

  -- a) İki düzey birlikte; aynı düzeye taşıma reddediliyor; yetki.
  dl := public.deneme_hesabi_olustur(jt, s_a);
  dl := public.deneme_hesabi_olustur(jt, s_c);
  if jsonb_array_length(dl) <> 2 or dl->0->>'seviye' <> '10' or dl->1->>'seviye' <> '11' then
    raise exception '7a: iki düzeyin hesabı listede yok ya da sırasız (%)', dl;
  end if;
  dn := dl->1; dn2 := dl->0;   -- dn: 11DN, dn2: 10DN
  begin perform public.deneme_sinifi_degistir(jt, (dn->>'id')::uuid, s_c);
    raise exception '7a: 10. SINIFTA HESAP VARKEN İKİNCİSİ TAŞINDI';
  exception when unique_violation then null; end;
  begin perform public.deneme_sinifi_degistir(jb, (dn->>'id')::uuid, s_b);
    raise exception '7a: BAŞKA ÖĞRETMEN DENEME SINIFINI DEĞİŞTİRDİ';
  exception when insufficient_privilege then null; end;
  begin perform public.deneme_sifirla(jb, (dn->>'id')::uuid);
    raise exception '7a: BAŞKA ÖĞRETMEN DENEMEYİ SIFIRLADI';
  exception when insufficient_privilege then null; end;
  begin perform public.deneme_hesabi_sil(jb, (dn->>'id')::uuid);
    raise exception '7a: BAŞKA ÖĞRETMEN DENEMEYİ SİLDİ';
  exception when insufficient_privilege then null; end;
  begin perform public.deneme_hesaplari(jb);
    raise exception '7a: BAŞKA ÖĞRETMEN DENEME KODLARINI GÖRDÜ';
  exception when insufficient_privilege then null; end;
  -- Gerçek öğrenci kimliğiyle silme ve sıfırlama hiçbir şey yapmıyor.
  perform public.deneme_hesabi_sil(jt, o1);
  begin perform public.deneme_sifirla(jt, o1);
    raise exception '7a: GERÇEK ÖĞRENCİ SIFIRLANDI';
  exception when no_data_found then null; end;
  begin perform public.deneme_sinifi_degistir(jt, o1, s_b);
    raise exception '7a: GERÇEK ÖĞRENCİNİN SINIFI DEĞİŞTİ';
  exception when no_data_found then null; end;
  if not exists (select 1 from public.ogrenciler where id = o1 and aktif and sinif_id = s_a) then
    raise exception '7a: GERÇEK ÖĞRENCİYE DOKUNULDU';
  end if;
  raise notice '    düzey başına bir hesap; yetki; gerçek öğrenciye dokunulmuyor: OK';

  -- b) Geçmiş ödev deneme hesabında görünüyor; bugün gelen gerçek öğrencide görünmüyor.
  jod2 := (public.giris(dn2->>'ogrenci_kodu'))->>'token';
  jvd2 := (public.giris(dn2->>'veli_kodu'))->>'token';
  if not exists (select 1 from jsonb_array_elements(public.ogrenci_odevleri(jod2)->'odevler') e
                  where (e->>'id')::uuid = d2) then
    raise exception '7b: DENEME HESABI EN BAŞTAN BERİ VERİLEN ÖDEVİ GÖRMÜYOR';
  end if;
  perform public.onam_ver(jvd2, public._gecerli_onam_surumu(), 'Deneme Veli');
  -- Veliye ödev kimliği gitmiyor (0047 notu); başlıkla aranıyor.
  if not exists (select 1 from jsonb_array_elements(public.veli_paneli(jvd2)->'odevler') e
                  where e->>'baslik' = 'DENEME Geçmiş') then
    raise exception '7b: deneme veli geçmiş ödevi görmüyor';
  end if;
  r := public.ogrenci_ekle(jt, 'Deneme Testi Yeni ' || ek, 'okul', s_c);
  o3 := (r->>'id')::uuid; jo3 := (public.giris(r->>'ogrenci_kodu'))->>'token';
  if exists (select 1 from jsonb_array_elements(public.ogrenci_odevleri(jo3)->'odevler') e
              where (e->>'id')::uuid = d2) then
    raise exception '7b: KURAL BOZULDU — bugün gelen gerçek öğrenci sınıfa gelmeden dolan ödevi görüyor';
  end if;
  raise notice '    geçmiş ödev deneme öğrenci ve velide var, bugün gelen gerçek öğrencide yok: OK';

  -- c) Süresi dolmuş, geç teslimi kapalı ödev.
  if (select (e->>'gec_teslim')::boolean from jsonb_array_elements(public.ogrenci_odevleri(jod2)->'odevler') e
       where (e->>'id')::uuid = d2) is distinct from true then
    raise exception '7c: deneme hesabında ödev teslime açık görünmüyor';
  end if;
  perform public.odev_gonder(jod2, d2, 'cozum/' || d2 || '/' || (dn2->>'id') || '.jpg',
                             '{"1":"A","2":"B","3":"D","4":"D"}'::jsonb);
  if (select puan from public.gonderimler where odev_id = d2 and ogrenci_id = (dn2->>'id')::uuid) is distinct from 75 then
    raise exception '7c: deneme gönderimi süresi geçmiş ödevde puanlanmadı';
  end if;
  -- Gerçek öğrenci en baştan beri sınıfta olsun ki ödev ona düşsün.
  update public.ogrenciler set sinif_giris = null where id = o3;
  if (select (e->>'gec_teslim')::boolean from jsonb_array_elements(public.ogrenci_odevleri(jo3)->'odevler') e
       where (e->>'id')::uuid = d2) is distinct from false then
    raise exception '7c: GERÇEK ÖĞRENCİDE geç teslim açık görünüyor';
  end if;
  begin
    perform public.odev_gonder(jo3, d2, 'cozum/' || d2 || '/' || o3 || '.jpg', '{"1":"A"}'::jsonb);
    raise exception '7c: GERÇEK ÖĞRENCİ SÜRESİ DOLMUŞ ÖDEVE GÖNDERDİ';
  exception when invalid_parameter_value then null; end;
  raise notice '    deneme süresi geçmiş ödeve gönderdi ve puan aldı; gerçek öğrenci reddedildi: OK';

  -- d) Sıfırlama yalnız o hesap.
  dl := public.deneme_sifirla(jt, (dn->>'id')::uuid);
  if not exists (select 1 from public.gonderimler where odev_id = d2 and ogrenci_id = (dn2->>'id')::uuid) then
    raise exception '7d: 11. sınıf sıfırlaması 10. sınıfın deneme gönderimini sildi';
  end if;
  if jsonb_array_length(dl) <> 2
     or exists (select 1 from public.ogrenciler where deneme and sinif_giris is not null) then
    raise exception '7d: sıfırlamadan sonra hesap eksik ya da sinif_giris dolu';
  end if;
  raise notice '    sıfırlama yalnız o hesabı sildi; sinif_giris NULL: OK';

  -- Temizlik: deneme hesapları bu testten sonra kalmasın.
  for dn in select * from jsonb_array_elements(public.deneme_hesaplari(jt)) loop
    perform public.deneme_hesabi_sil(jt, (dn->>'id')::uuid);
  end loop;

  raise notice '';
  raise notice 'DENEME HESABI TESTLERİ GEÇTİ';
end;
$$;
