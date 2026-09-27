-- =============================================================================
-- SEKİZ — 0055 TESTLERİ: YÖNETİCİNİN ÖDEVİ SINIF ÖĞRETMENİNDE · PUAN DÜZELTME
--
-- Asıl ölçüm İKİ YÖNLÜ:
--   1. Yöneticinin X'in sınıfına verdiği ödev X'te "kendisi vermiş gibi":
--      liste, detay, gönderimler, pano, çözüm, puanlama, düzenleme, silme.
--   2. KAPI FAZLA AÇILMIYOR: Y (sınıfa atanmamış) göremiyor; aynı sınıftaki
--      sıradan Z'nin ödevi X'e, X'inki Z'ye ve vekâletsiz sahibe görünmüyor;
--      özel ders asla; kardeş sınıflara yalnız ödevi veren yayıyor.
--
-- Tekrar çalıştırılabilir: öğretmen/öğrenci adları ve PIN'ler her çalıştırmada
-- farklı (mutasyon provası aynı veritabanında art arda koşuyor).
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  ek   text := substr(md5(random()::text), 1, 6);
  s_id uuid; x_id uuid; y_id uuid; z_id uuid;
  js text; jx text; jy text; jz text; jv text; jo text; jveli text;
  sa uuid; sb uuid; sc uuid; v_ozel uuid;
  o1 uuid; oz uuid;
  d_s uuid; d_acik uuid; d_sil uuid; d_z uuid; d_x uuid; d_ozel uuid;
  d_ga uuid; d_gc uuid;
  hs uuid; hx uuid; hz uuid;
  g_s uuid; g_acik uuid; g_x uuid;
  v jsonb; r record; n integer; t text; kod text;
begin
  raise notice '--- Kurulum ---';
  update public.ogretmenler set pin_hash =
    extensions.crypt('Ortak!2026', extensions.gen_salt('bf', 10)) where yonetici;
  js := (public.giris('Ortak!2026'))->>'token';
  select id into s_id from public.ogretmenler where yonetici;
  x_id := (public.ogretmen_ekle(js, 'Xeda Ortak ' || ek, 'XOrtak!' || ek))->>'id';
  y_id := (public.ogretmen_ekle(js, 'Yavuz Ortak ' || ek, 'YOrtak!' || ek))->>'id';
  z_id := (public.ogretmen_ekle(js, 'Zerrin Ortak ' || ek, 'ZOrtak!' || ek))->>'id';
  jx := (public.giris('XOrtak!' || ek))->>'token';
  jy := (public.giris('YOrtak!' || ek))->>'token';
  jz := (public.giris('ZOrtak!' || ek))->>'token';

  insert into public.siniflar (seviye, sube) values (11, 'OA')
    on conflict (seviye, sube) do update set arsiv = false returning id into sa;
  insert into public.siniflar (seviye, sube) values (11, 'OB')
    on conflict (seviye, sube) do update set arsiv = false returning id into sb;
  insert into public.siniflar (seviye, sube) values (11, 'OC')
    on conflict (seviye, sube) do update set arsiv = false returning id into sc;
  -- Sahip üç sınıfta da (atamasını SİLMEDEN ekliyoruz; sonraki dosyalar etkilenmesin).
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    select s_id, x from unnest(array[sa, sb, sc]) x on conflict do nothing;
  -- X ve Z aynı sınıfta (11OA), Y başka sınıfta (11OB) — gerçek atama ucuyla.
  perform public.ogretmen_sinif_ata(js, x_id, jsonb_build_array(sa::text));
  perform public.ogretmen_sinif_ata(js, z_id, jsonb_build_array(sa::text));
  perform public.ogretmen_sinif_ata(js, y_id, jsonb_build_array(sb::text));

  o1 := (public.ogrenci_ekle(js, 'Ortak Öğrenci ' || ek, 'okul', sa))->>'id';
  kod := (select k.kod from public.giris_kodlari k where k.ogrenci_id = o1 and k.rol = 'ogrenci');
  jo := (public.giris(kod))->>'token';
  kod := (select k.kod from public.giris_kodlari k where k.ogrenci_id = o1 and k.rol = 'veli');
  jveli := (public.giris(kod))->>'token';

  -- Sahibin 11OA ödevleri
  d_s := (public.odev_olustur(js, 'Sahip Testi', null, sa, 'test', current_date + 7, 2,
          '{"1":"A","2":"B"}'::jsonb))->>'id';
  d_acik := (public.odev_olustur(js, 'Sahip Açık', null, sa, 'acik', current_date + 7))->>'id';
  d_sil := (public.odev_olustur(js, 'Sahip Silinecek', null, sa, 'acik', current_date + 7))->>'id';
  perform public.odev_yayinla(js, d_s);
  perform public.odev_yayinla(js, d_acik);
  -- Aynı sınıfta sıradan Z'nin ve X'in kendi ödevi
  d_z := (public.odev_olustur(jz, 'Zerrin Ödevi', null, sa, 'acik', current_date + 7))->>'id';
  d_x := (public.odev_olustur(jx, 'Xeda Ödevi', null, sa, 'acik', current_date + 7))->>'id';
  perform public.odev_yayinla(jz, d_z);
  perform public.odev_yayinla(jx, d_x);
  -- Sahibin iki sınıflı (kardeşli) ödevi: 11OA (X'in) + 11OC (kimsenin)
  v := public.odevler_coklu_olustur(p_token => js, p_sinif_idler => jsonb_build_array(sa, sc),
         p_baslik => 'Sahip Kardeş', p_aciklama => null, p_tur => 'acik',
         p_son_tarih => current_date + 7);
  select (e->>'odev_id')::uuid into d_ga from jsonb_array_elements(v->'odevler') e
   where (e->>'sinif_id')::uuid = sa;
  select (e->>'odev_id')::uuid into d_gc from jsonb_array_elements(v->'odevler') e
   where (e->>'sinif_id')::uuid = sc;

  perform public.odev_gonder(jo, d_s, 'cozum/' || d_s || '/' || o1 || '.jpg',
                             '{"1":"A","2":"B"}'::jsonb);
  perform public.odev_gonder(jo, d_acik, 'cozum/' || d_acik || '/' || o1 || '.jpg');
  perform public.odev_gonder(jo, d_x, 'cozum/' || d_x || '/' || o1 || '.jpg');
  select id into g_s    from public.gonderimler where odev_id = d_s    and ogrenci_id = o1;
  select id into g_acik from public.gonderimler where odev_id = d_acik and ogrenci_id = o1;
  select id into g_x    from public.gonderimler where odev_id = d_x    and ogrenci_id = o1;

  ------------------------------------------------------------------
  raise notice '--- 1. X, sahibin ödevini LİSTEDE ve DETAYDA görüyor ---';
  v := public.odevler_listesi(jx);
  if not exists (select 1 from jsonb_array_elements(v) e where (e->>'id')::uuid = d_s) then
    raise exception 'HATA: sahibin X''in sınıfına verdiği ödev X''in listesinde yok!';
  end if;
  if (public.odev_detay(jx, d_s)->>'baslik') <> 'Sahip Testi' then
    raise exception 'HATA: X sahibin ödevinin detayını açamıyor!';
  end if;
  raise notice '    liste ve detay: OK';

  ------------------------------------------------------------------
  raise notice '--- 2. X, gönderimleri, sonuçları ve ÇÖZÜMÜ görüyor ---';
  v := public.odev_gonderimleri(jx, d_s);
  if not exists (select 1 from jsonb_array_elements(v->'satirlar') e
                  where (e->>'gonderim_id')::uuid = g_s and (e->>'puan')::numeric = 100) then
    raise exception 'HATA: X gönderimi ve puanını görmüyor: %', v->'satirlar';
  end if;
  if (public.gonderim_foto_yolu(jx, g_s)->>'yol') <> 'cozum/' || d_s || '/' || o1 || '.jpg' then
    raise exception 'HATA: X çözüm fotoğrafının yolunu alamıyor!';
  end if;
  raise notice '    gönderim, puan 100 ve çözüm yolu: OK';

  ------------------------------------------------------------------
  raise notice '--- 3. PANO: sayaçlar ve son gönderimlerde SINIF + gönderim kimliği ---';
  v := public.ogretmen_panosu(jx);
  if not exists (select 1 from jsonb_array_elements(v->'son_gonderimler') e
                  where (e->>'gonderim_id')::uuid = g_s and e->>'sinif' = '11OA') then
    raise exception 'HATA: panoda sahibin ödevine gelen gönderim sınıfıyla yok: %', v->'son_gonderimler';
  end if;
  if (v->>'bekleyen_degerlendirme')::int < 1 then
    raise exception 'HATA: sahibin açık uçlu ödevi X''in bekleyen sayısına girmedi!';
  end if;
  if ((public.bildirim_sayilari(jx))->>'puan_bekleyen')::int < 1 then
    raise exception 'HATA: bildirim rozetinde sahibin puan bekleyen gönderimi yok!';
  end if;
  raise notice '    son gönderimlerde "11OA" ve gonderim_id; bekleyen sayaçları: OK';

  ------------------------------------------------------------------
  raise notice '--- 4. X TAM YETKİLİ: puanlar, düzenler, siler ---';
  perform public.acik_puanla(jx, g_acik, 80);
  if (select ogretmen_puan from public.gonderimler where id = g_acik) <> 80 then
    raise exception 'HATA: X sahibin açık uçlu ödevini puanlayamadı!';
  end if;
  perform public.odev_guncelle(p_token => jx, p_id => d_s, p_baslik => 'Sahip Testi (X düzeltti)',
    p_aciklama => null, p_sinif_id => sa, p_son_tarih => current_date + 7);
  if (select baslik from public.odevler where id = d_s) <> 'Sahip Testi (X düzeltti)' then
    raise exception 'HATA: X sahibin ödevini düzenleyemedi!';
  end if;
  if (select ogretmen_id from public.odevler where id = d_s) <> s_id then
    raise exception 'HATA: düzenleme ödevin SAHİBİNİ değiştirdi!';
  end if;
  perform public.odev_yayinla(jx, d_sil);
  perform public.odev_sil(jx, d_sil);
  if exists (select 1 from public.odevler where id = d_sil) then
    raise exception 'HATA: X sahibin ödevini silemedi!';
  end if;
  raise notice '    puanladı, düzenledi (sahip aynı), yayınladı, sildi: OK';

  ------------------------------------------------------------------
  raise notice '--- 5. X ödevi ATANMADIĞI sınıfa taşıyamıyor ---';
  begin
    perform public.odev_guncelle(p_token => jx, p_id => d_s, p_baslik => 'x',
      p_aciklama => null, p_sinif_id => sb, p_son_tarih => current_date + 7);
    raise exception 'HATA: X ödevi Y''NİN SINIFINA TAŞIDI!';
  exception when insufficient_privilege then null;
  end;
  raise notice '    başka öğretmenin sınıfına taşıma reddedildi: OK';

  ------------------------------------------------------------------
  raise notice '--- 6. Y (sınıfa atanmamış) HİÇBİR YOLDAN göremiyor ---';
  if exists (select 1 from jsonb_array_elements(public.odevler_listesi(jy)) e
              where (e->>'id')::uuid = d_s) then
    raise exception 'HATA: Y sahibin 11OA ödevini listesinde görüyor!';
  end if;
  begin perform public.odev_detay(jy, d_s); raise exception 'HATA: Y detayı açtı!';
  exception when insufficient_privilege then null; end;
  begin perform public.odev_gonderimleri(jy, d_s); raise exception 'HATA: Y gönderimleri açtı!';
  exception when insufficient_privilege then null; end;
  begin perform public.gonderim_foto_yolu(jy, g_s); raise exception 'HATA: Y çözümü açtı!';
  exception when no_data_found then null; end;
  begin perform public.acik_puanla(jy, g_acik, 10); raise exception 'HATA: Y PUANLADI!';
  exception when no_data_found then null; end;
  if exists (select 1 from jsonb_array_elements(public.ogretmen_panosu(jy)->'son_gonderimler') e
              where (e->>'gonderim_id')::uuid = g_s) then
    raise exception 'HATA: Y''nin panosunda 11OA gönderimi var!';
  end if;
  raise notice '    liste, detay, gönderimler, çözüm, puanlama, pano kapalı: OK';

  ------------------------------------------------------------------
  raise notice '--- 7. YALNIZ YÖNETİCİNİN ödevi: sıradan öğretmenler birbirini görmüyor ---';
  begin perform public.odev_detay(jx, d_z); raise exception 'HATA: X, Z''NİN ÖDEVİNİ açtı!';
  exception when insufficient_privilege then null; end;
  begin perform public.odev_detay(jz, d_x); raise exception 'HATA: Z, X''İN ÖDEVİNİ açtı!';
  exception when insufficient_privilege then null; end;
  begin perform public.odev_detay(js, d_x);
        raise exception 'HATA: sahip X''in ödevini VEKÂLETSİZ açtı — kural değişmiş!';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from jsonb_array_elements(public.odevler_listesi(jx)) e
              where (e->>'id')::uuid = d_z) then
    raise exception 'HATA: Z''nin ödevi X''in listesinde!';
  end if;
  raise notice '    X↔Z kapalı; sahip X''in ödevini yalnız vekâletle görür: OK';

  ------------------------------------------------------------------
  raise notice '--- 8. KARDEŞ YAYMA yalnız ödevi verene; kardeş bilgisi X''e gelmiyor ---';
  v := public.odev_detay(jx, d_ga);
  if v->'kardesler' <> 'null'::jsonb or v->'kardes_detay' <> 'null'::jsonb then
    raise exception 'HATA: X başka sınıfın kardeş bilgisini görüyor: %', v->'kardes_detay';
  end if;
  if jsonb_array_length(public.odev_detay(js, d_ga)->'kardes_detay') <> 1 then
    raise exception 'HATA: sahip kardeş bilgisini kaybetti!';
  end if;
  begin
    perform public.odev_kardeslere_yay(jx, d_ga);
    raise exception 'HATA: X KARDEŞ SINIFA (11OC) YAYDI!';
  exception when insufficient_privilege then null;
  end;
  perform public.odev_kardeslere_yay(js, d_ga);   -- sahip yayabiliyor
  raise notice '    X yayamıyor, kardeş bilgisi X''e kapalı, sahip yayıyor: OK';

  ------------------------------------------------------------------
  raise notice '--- 9. ÖZEL DERS HİÇBİR ZAMAN (atama tabloya elle yazılsa bile) ---';
  oz := (public.ogrenci_ekle(js, 'Ortak Özel ' || ek, 'ozel', null))->>'id';
  select sinif_id into v_ozel from public.ogrenciler where id = oz;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id) values (s_id, v_ozel)
    on conflict do nothing;
  d_ozel := (public.odev_olustur(js, 'Sahip Özel Ders', null, v_ozel, 'acik',
             current_date + 7))->>'id';
  -- Uç reddediyor (0033); kapıyı zorlamak için doğrudan yazıyoruz.
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id) values (x_id, v_ozel)
    on conflict do nothing;
  begin perform public.odev_detay(jx, d_ozel);
        raise exception 'HATA: X SAHİBİN ÖZEL DERS ÖDEVİNİ AÇTI!';
  exception when insufficient_privilege then null; end;
  delete from public.ogretmen_siniflari where ogretmen_id = x_id and sinif_id = v_ozel;
  raise notice '    elle atanmış olsa da özel ders ödevi kapalı: OK';

  ------------------------------------------------------------------
  raise notice '--- 10. SINIF ÖZETİ: "verilen" ve "yaptı" AYNI kümeden (eksi yok) ---';
  hs := (public.odev_olustur(js, 'Geçmiş Sahip', null, sa, 'acik', current_date - 2))->>'id';
  hx := (public.odev_olustur(jx, 'Geçmiş Xeda',  null, sa, 'acik', current_date - 2))->>'id';
  hz := (public.odev_olustur(jz, 'Geçmiş Zerrin', null, sa, 'acik', current_date - 2))->>'id';
  perform public.odev_yayinla(js, hs);
  perform public.odev_yayinla(jx, hx);
  perform public.odev_yayinla(jz, hz);
  perform public.odev_gonder(jo, hs, 'cozum/' || hs || '/' || o1 || '.jpg');
  perform public.odev_gonder(jo, hz, 'cozum/' || hz || '/' || o1 || '.jpg');
  -- Beklenen, kuraldan BAĞIMSIZ hesaplanıyor (yardımcı kullanılmadan).
  select count(*) into n from public.odevler d
   where d.sinif_id = sa and d.yayinda and d.son_tarih < current_date
     and d.ogretmen_id in (x_id, s_id);
  v := public.sinif_ogrencileri(jx, sa);
  select e into v from jsonb_array_elements(v->'ogrenciler') e where (e->>'id')::uuid = o1;
  if (v->>'yapti')::int <> 1 then
    raise exception 'HATA: Z''nin ödevi X''in "yaptı" sayısına girdi (yapti=%)', v->>'yapti';
  end if;
  if (v->>'yapmadi')::int <> n - 1 or (v->>'yapmadi')::int < 0 then
    raise exception 'HATA: yapmadı yanlış: % (beklenen %)', v->>'yapmadi', n - 1;
  end if;
  raise notice '    yaptı 1, yapmadı % (≥ 0), Z''nin ödevi sayılmadı: OK', n - 1;

  ------------------------------------------------------------------
  raise notice '--- 11. PUAN DÜZELTME: yalnız sahip, sebep zorunlu, iz bırakıyor ---';
  foreach t in array array[jx, jy, jo, jveli] loop
    begin
      perform public.puan_duzelt(t, g_s, 95, 'deneme sebebi');
      raise exception 'HATA: SAHİP OLMAYAN PUAN DÜZELTTİ!';
    exception when insufficient_privilege then null;
    end;
  end loop;
  begin perform public.puan_duzelt(js, g_s, 95, '  '); raise exception 'HATA: sebepsiz düzeltme!';
  exception when invalid_parameter_value then null; end;
  begin perform public.puan_duzelt(js, g_s, 101, 'aralık dışı'); raise exception 'HATA: 101 kabul!';
  exception when invalid_parameter_value then null; end;
  begin perform public.puan_duzelt(js, gen_random_uuid(), 50, 'olmayan gönderim');
        raise exception 'HATA: olmayan gönderim düzeltildi!';
  exception when no_data_found then null; end;

  perform public.puan_duzelt(js, g_s, 95, 'Kâğıtta ek çözüm var');
  select * into r from public.gonderimler where id = g_s;
  if r.ogretmen_puan <> 95 or r.duzelten_yonetici <> s_id or r.duzeltme_nedeni <> 'Kâğıtta ek çözüm var' then
    raise exception 'HATA: düzeltme yazılmadı: %', row_to_json(r);
  end if;
  if not exists (select 1 from public.denetim_izi
                  where islem = 'puan_duzeltildi' and kayit_id = g_s
                    and (eski->>'puan')::numeric = 100 and (yeni->>'ogretmen_puan')::numeric = 95) then
    raise exception 'HATA: denetim izine eski/yeni puan yazılmadı!';
  end if;
  raise notice '    X/Y/öğrenci/veli 42501; sebepsiz/101 22023; 95 yazıldı, iz var: OK';

  ------------------------------------------------------------------
  raise notice '--- 12. Düzeltme HER YERE yansıyor; öğretmende İŞARETLİ ---';
  v := public.odev_gonderimleri(jx, d_s);
  if not exists (select 1 from jsonb_array_elements(v->'satirlar') e
                  where (e->>'gonderim_id')::uuid = g_s and (e->>'duzeltildi')::boolean
                    and e->>'duzeltme_nedeni' = 'Kâğıtta ek çözüm var'
                    and (e->>'ogretmen_puan')::numeric = 95) then
    raise exception 'HATA: X düzeltme işaretini görmüyor!';
  end if;
  if not exists (select 1 from jsonb_array_elements(public.ogrenci_odevleri(jo)->'odevler') e
                  where (e->>'id')::uuid = d_s
                    and (e->'gonderim'->>'ogretmen_puan')::numeric = 95) then
    raise exception 'HATA: öğrenci düzeltilmiş puanı görmüyor!';
  end if;
  if exists (select 1 from jsonb_array_elements(public.ogretmen_panosu(jx)->'son_gonderimler') e
              where (e->>'gonderim_id')::uuid = g_s and (e->>'puan')::numeric <> 95) then
    raise exception 'HATA: panoda eski puan duruyor!';
  end if;
  raise notice '    gönderimlerde işaret+sebep, öğrencide ve panoda 95: OK';

  ------------------------------------------------------------------
  raise notice '--- 13. VEKÂLETTE de sahip düzeltebiliyor; iz "sahip → X" ---';
  jv := (public.ogretmen_olarak_gir(js, x_id))->>'token';
  perform public.puan_duzelt(jv, g_x, 60, 'Vekâletle düzeltme');
  if (select duzelten_yonetici from public.gonderimler where id = g_x) <> s_id then
    raise exception 'HATA: vekâlette düzelten SAHİP olarak yazılmadı!';
  end if;
  if not exists (select 1 from public.denetim_izi
                  where islem = 'puan_duzeltildi' and kayit_id = g_x and aktor like '%→%') then
    raise exception 'HATA: vekâlet denetim izinde görünmüyor!';
  end if;
  raise notice '    vekâlette düzeltme, düzelten = sahip, iz vekâleti taşıyor: OK';

  ------------------------------------------------------------------
  raise notice '--- 14. SONRADAN PUAN DEĞİŞTİRME YALNIZ SAHİPTE (puan_duzelt) ---';
  -- X, 4. grupta ilk puanı (80) verdi. Aynı gönderimi yeniden puanlayamaz.
  begin perform public.acik_puanla(jx, g_acik, 90);
        raise exception 'HATA: X VERİLMİŞ PUANI DEĞİŞTİRDİ!';
  exception when insufficient_privilege then null; end;
  -- Sistemin puanladığı TEST gönderimini ezemez (önceden API'yle ezebiliyordu).
  begin perform public.acik_puanla(jx, g_x, 5);
        raise exception 'HATA: X SİSTEMİN TEST PUANINI EZDİ!';
  exception when insufficient_privilege then null; end;
  -- Sahip de bu uçtan geçemez — sonradan her değişiklik sebebiyle, puan_duzelt'ten.
  begin perform public.acik_puanla(js, g_acik, 90);
        raise exception 'HATA: sahip acik_puanla ile sebepsiz yeniden puanladı!';
  exception when insufficient_privilege then null; end;
  begin perform public.acik_puanla(jv, g_acik, 90);
        raise exception 'HATA: vekâletle acik_puanla yeniden puanladı!';
  exception when insufficient_privilege then null; end;
  if (select ogretmen_puan from public.gonderimler where id = g_acik) <> 80 then
    raise exception 'HATA: reddedilen yeniden puanlama yine de notu değiştirdi!';
  end if;
  -- Sahip puan_duzelt ile değiştirir; öğretmen işaretin üstüne yazamaz.
  perform public.puan_duzelt(js, g_acik, 70, 'Sınav günü düzeltme');
  begin perform public.acik_puanla(jx, g_acik, 85);
        raise exception 'HATA: X YÖNETİCİ DÜZELTMESİNİN ÜSTÜNE YAZDI!';
  exception when insufficient_privilege then null; end;
  select * into r from public.gonderimler where id = g_acik;
  if r.ogretmen_puan <> 70 or r.duzelten_yonetici is distinct from s_id then
    raise exception 'HATA: düzeltme korunmadı: %', row_to_json(r);
  end if;
  raise notice '    X yeniden puanlayamaz, testi ezemez; sahip yalnız puan_duzelt ile: OK';

  ------------------------------------------------------------------
  raise notice '--- 15. Anahtar düzeltilince DÜZELTME ÜSTÜN kalıyor ---';
  perform public.odev_guncelle(p_token => js, p_id => d_s, p_baslik => 'Sahip Testi',
    p_aciklama => null, p_sinif_id => sa, p_son_tarih => current_date + 7,
    p_cevap_anahtari => '{"1":"C","2":"B"}'::jsonb);
  select * into r from public.gonderimler where id = g_s;
  if r.puan <> 50 or r.ogretmen_puan <> 95 or r.duzelten_yonetici is null then
    raise exception 'HATA: anahtar düzeltmesi sonrası beklenmeyen: puan=% ogretmen_puan=%',
      r.puan, r.ogretmen_puan;
  end if;
  raise notice '    otomatik puan 50''ye indi, gösterilen 95 (düzeltme) kaldı: OK';

  ------------------------------------------------------------------
  raise notice '--- 16. Dahili yardımcı kapalı, yeni uç açık ---';
  if has_function_privilege('anon', 'public._odeve_erisir(uuid,uuid,uuid)', 'execute') then
    raise exception 'HATA: _odeve_erisir anon''a açık!';
  end if;
  if not has_function_privilege('anon', 'public.puan_duzelt(text,uuid,numeric,text)', 'execute') then
    raise exception 'HATA: puan_duzelt anon''a kapalı — istemci çağıramaz!';
  end if;
  raise notice '    _odeve_erisir kapalı, puan_duzelt açık (yetki içeride): OK';

  raise notice '';
  raise notice '=========================================';
  raise notice 'ORTAK ÖDEV VE PUAN DÜZELTME TESTLERİ GEÇTİ';
  raise notice '=========================================';
end;
$$;
