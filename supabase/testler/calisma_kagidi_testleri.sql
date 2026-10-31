-- =============================================================================
-- SEKİZ — ÇALIŞMA KAĞIDI: PUANSIZ ÜÇÜNCÜ ÖDEV TÜRÜ (0086)
--
-- Öğretmenin isteği: "Çalışma kağıdı şeklinde de ödev verilebilsin. Puan
-- hesaplaması yapılmadan ödevi gönderip göndermediği şeklinde
-- tamamlansın... Ama bu ayrı bir kategoride olsun."
--
-- Ölçülen:
--   1. Oluşturma: soru sayısı, anahtar ve konu VERİLSE BİLE null
--   2. Anahtarsız yayınlanıyor (aynı eksiklik test ödevinde hata veriyor)
--   3. Gönderim: durum 'tamamlandi', puan ve doğru/yanlış/boş null
--   4. `acik_puanla` ve `puan_duzelt` 42501 ile reddediyor
--   5. ASIL ÖLÇÜM: çalışma kağıdı eklendikten SONRA dört ucun bütün
--      sayıları, çalışma kağıdı YOKKEN alınan fotoğrafla BİREBİR aynı
--   6. `puan_bekleyen` artmıyor
--   7. Ayrı sayaç doğru: gönderende 1/1, göndermeyende 1/0
--   8. `odevler_listesi`: ortalama null, gönderim sayısı doğru, 0085'in
--      tarihleri yerinde
--   9. Öğrenci ve veli ekranında görünüyor; velide puan null
--  10. Test ve açık uçlu davranışı DEĞİŞMEDİ (gerileme kapısı)
--  11. `odev_guncelle` çalışma kağıdına anahtar yazamıyor
--  12. Zincirin sonu 0086
--
-- Tekrar çalıştırılabilir. Hiçbir blokta `exception when others` YOK.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  ek text := substr(md5(random()::text), 1, 6);
  jt text; joa text; job text; jva text;
  s_id uuid; v_sinif uuid;
  o_a uuid; o_b uuid;
  d_test uuid; d_acik uuid; d_cal uuid;
  g_acik uuid; g_cal uuid;
  onceki jsonb; sonraki jsonb;
  onceki_liste jsonb; sonraki_liste jsonb;
  onceki_karne jsonb; sonraki_karne jsonb;
  onceki_ozet jsonb; sonraki_ozet jsonb;
  onceki_cizelge jsonb; sonraki_cizelge jsonb;
  v jsonb; n integer; hata text;
begin
  raise notice '--- Kurulum ---';
  update public.ogretmenler
     set pin_hash = extensions.crypt('Calisma!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Calisma!2026'))->>'token';
  select id into s_id from public.ogretmenler where yonetici;

  insert into public.siniflar (seviye, sube) values (11, 'K')
    on conflict (seviye, sube) do update set arsiv = false
    returning id into v_sinif;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    values (s_id, v_sinif) on conflict do nothing;

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

  -- A her şeyi gönderiyor, B hiçbir şeyi: iki uç da ölçülsün.
  o_a := (public.ogrenci_ekle(jt, 'Ahu Çalışkan ' || ek, 'okul', v_sinif))->>'id';
  o_b := (public.ogrenci_ekle(jt, 'Bora Yok ' || ek, 'okul', v_sinif))->>'id';
  joa := (public.giris((select kod from public.giris_kodlari
                         where ogrenci_id = o_a and rol = 'ogrenci')))->>'token';
  job := (public.giris((select kod from public.giris_kodlari
                         where ogrenci_id = o_b and rol = 'ogrenci')))->>'token';
  jva := (public.giris((select kod from public.giris_kodlari
                         where ogrenci_id = o_a and rol = 'veli')))->>'token';
  perform public.onam_ver(jva, public._gecerli_onam_surumu(), 'Çalışma Velisi');

  -- SÜRESİ DOLMUŞ iki normal ödev: biri test, biri açık uçlu.
  d_test := (public.odev_olustur(jt, 'Test ödevi ' || ek, null, v_sinif, 'test',
    current_date - 5, 2, '{"1":"A","2":"B"}'::jsonb, null, null, true, 4::smallint, null))->>'id';
  d_acik := (public.odev_olustur(jt, 'Açık uçlu ' || ek, null, v_sinif, 'acik',
    current_date - 4, null, null, null, null, true, 4::smallint, null))->>'id';
  perform public.odev_yayinla(jt, d_test);
  perform public.odev_yayinla(jt, d_acik);

  -- A ikisini de gönderiyor; testten 100, açık uçludan öğretmen 60 veriyor.
  perform public.odev_gonder(joa, d_test, 'cozum/' || d_test || '/' || o_a || '.jpg',
                             '{"1":"A","2":"B"}'::jsonb);
  perform public.odev_gonder(joa, d_acik, 'cozum/' || d_acik || '/' || o_a || '.jpg');
  select id into g_acik from public.gonderimler
   where odev_id = d_acik and ogrenci_id = o_a;
  perform public.acik_puanla(jt, g_acik, 60, 'Güzel.');

  -- ÖNCEKİ FOTOĞRAF — çalışma kağıdı henüz YOK.
  onceki       := public._ogrenci_ortalamalari(o_a, v_sinif, null);
  onceki_liste := public.sinif_ogrencileri(jt, v_sinif);
  onceki_karne := public.kendi_karnem(joa);
  onceki_ozet  := public.sinif_ogrenci_ozeti(jt, v_sinif);
  -- ÖĞRETMENİN SINIF SAYFASI BU UÇTAN besleniyor (`sinif_ogrencileri`
  -- değil — ekran taramasıyla bulundu).
  onceki_cizelge := public.sinif_not_cizelgesi(jt, v_sinif);

  -- ===========================================================================
  raise notice '--- 1. Oluşturma: puanlama alanları zorla null ---';
  -- ===========================================================================
  -- Anahtar, soru sayısı ve konu BİLEREK gönderiliyor: ekran göndermese
  -- de sunucu kabul etmemeli.
  d_cal := (public.odev_olustur(jt, 'Çalışma kağıdı ' || ek, 'Alıştırma', v_sinif,
    'calisma', current_date - 3, 10, '{"1":"A"}'::jsonb, null, null, true,
    4::smallint, '{"1":"Köklü sayılar"}'::jsonb))->>'id';

  select to_jsonb(o) into v from public.odevler o where o.id = d_cal;
  if v->>'tur' <> 'calisma' then
    raise exception '1a BAŞARISIZ — tür yazılmadı: %', v->>'tur';
  end if;
  if v->>'soru_sayisi' is not null then
    raise exception '1b BAŞARISIZ — soru sayısı kaldı: %', v->>'soru_sayisi';
  end if;
  if v->>'cevap_anahtari' is not null then
    raise exception '1c BAŞARISIZ — cevap anahtarı kaldı: %', v->>'cevap_anahtari';
  end if;
  if v->>'konular' is not null then
    raise exception '1d BAŞARISIZ — konular kaldı: %', v->>'konular';
  end if;
  raise notice '1 OK — tür calisma; soru sayısı, anahtar ve konular null';

  -- ===========================================================================
  raise notice '--- 2. Anahtarsız yayınlanıyor ---';
  -- ===========================================================================
  perform public.odev_yayinla(jt, d_cal);
  if not (select yayinda from public.odevler where id = d_cal) then
    raise exception '2a BAŞARISIZ — çalışma kağıdı yayınlanmadı';
  end if;

  -- KARŞITI: EKSİK anahtarlı TEST ödevi yayınlanamıyor. Bu olmadan 2a,
  -- "zaten hiçbir denetim yok" durumunda da yeşil yanardı.
  --
  -- Anahtarı tamamen BOŞ bir test ödevi oluşturulamıyor bile
  -- (`odev_test_tutarli`, 0001) — ölçüm bunu çalışırken gösterdi. O
  -- yüzden karşıt örnek 2 soruluk ödeve TEK cevap koyuyor:
  -- `odev_yayinla`'nın kendi denetimi tam burada bitiyor.
  declare
    d_eksik uuid;
  begin
    d_eksik := (public.odev_olustur(jt, 'Eksik anahtar ' || ek, null, v_sinif, 'test',
      current_date - 2, 2, '{"1":"A"}'::jsonb, null, null, true, 4::smallint, null))->>'id';
    begin
      perform public.odev_yayinla(jt, d_eksik);
      raise exception '2b BAŞARISIZ — eksik anahtarlı TEST ödevi yayınlandı';
    exception when sqlstate '22023' then
      null;
    end;
    delete from public.odevler where id = d_eksik;
  end;
  raise notice '2 OK — çalışma kağıdı anahtarsız yayınlanıyor, eksik anahtarlı test yayınlanmıyor';

  -- ===========================================================================
  raise notice '--- 3. Gönderim: durum tamamlandi, puan yok ---';
  -- ===========================================================================
  v := public.odev_gonder(joa, d_cal, 'cozum/' || d_cal || '/' || o_a || '.jpg',
                          '{"1":"A"}'::jsonb);
  if v->>'durum' <> 'tamamlandi' then
    raise exception '3a BAŞARISIZ — durum % döndü', v->>'durum';
  end if;
  select id into g_cal from public.gonderimler where odev_id = d_cal and ogrenci_id = o_a;
  select to_jsonb(g) into v from public.gonderimler g where g.id = g_cal;
  if v->>'durum' <> 'tamamlandi' then
    raise exception '3b BAŞARISIZ — kayıttaki durum %', v->>'durum';
  end if;
  -- CEVAPLAR GÖNDERİLDİ ama puanlanmadı: puan hesabı hiç çalışmamalı.
  if v->>'puan' is not null or v->>'dogru' is not null or v->>'yanlis' is not null then
    raise exception '3c BAŞARISIZ — puan hesaplanmış: %', v::text;
  end if;
  if v->>'foto_yolu' is null then
    raise exception '3d BAŞARISIZ — çözüm yolu yazılmadı (öğretmenin kararı: çözüm yüklensin)';
  end if;
  raise notice '3 OK — gönderildi, puan hesaplanmadı, çözüm yolu kayıtlı';

  -- ===========================================================================
  raise notice '--- 4. Puanlama kapıları reddediyor ---';
  -- ===========================================================================
  -- MESAJ DA ÖLÇÜLÜYOR, yalnız hata kodu değil.
  --
  -- `acik_puanla` zaten `durum='incelemede'` istiyor ve çalışma kağıdı o
  -- duruma hiç girmiyor; yani SADECE koda bakan bir ölçüm, tür kapısı
  -- silinse bile yeşil kalırdı (kusur provası bunu gösterdi). Öğretmenin
  -- gördüğü cümle farkın kendisi: "sahibe sor" demek yanlış olurdu,
  -- çünkü sahip de puanlayamaz.
  begin
    perform public.acik_puanla(jt, g_cal, 90, 'Olmaz.');
    raise exception '4a BAŞARISIZ — acik_puanla çalışma kağıdını puanladı';
  exception when sqlstate '42501' then
    get stacked diagnostics hata = message_text;
    if hata not like '%Çalışma kağıdı puanlanmaz%' then
      raise exception '4a BAŞARISIZ — yanlış gerekçe: %', hata;
    end if;
  end;
  begin
    perform public.puan_duzelt(jt, g_cal, 90, 'Olmaz olmaz.');
    raise exception '4b BAŞARISIZ — puan_duzelt çalışma kağıdını puanladı';
  exception when sqlstate '42501' then
    get stacked diagnostics hata = message_text;
    if hata not like '%Çalışma kağıdı puanlanmaz%' then
      raise exception '4b BAŞARISIZ — yanlış gerekçe: %', hata;
    end if;
  end;
  if (select ogretmen_puan from public.gonderimler where id = g_cal) is not null then
    raise exception '4c BAŞARISIZ — reddedildiği hâlde puan yazılmış';
  end if;
  raise notice '4 OK — iki puanlama ucu da 42501 ile reddetti, puan yazılmadı';

  -- ===========================================================================
  raise notice '--- 5. ASIL ÖLÇÜM: ortalamalar DEĞİŞMEDİ ---';
  -- ===========================================================================
  -- Çalışma kağıdı eklendi ve gönderildi. Dört ucun ÇALIŞMA KAĞIDI DIŞI
  -- bütün sayıları, kağıt hiç yokken alınan fotoğrafla birebir aynı
  -- olmalı. Yeni alanlar karşılaştırmadan çıkarılıyor; başka her şey
  -- aynı kalmak zorunda.
  sonraki       := public._ogrenci_ortalamalari(o_a, v_sinif, null);
  sonraki_liste := public.sinif_ogrencileri(jt, v_sinif);
  sonraki_karne := public.kendi_karnem(joa);
  sonraki_ozet  := public.sinif_ogrenci_ozeti(jt, v_sinif);
  sonraki_cizelge := public.sinif_not_cizelgesi(jt, v_sinif);

  if (sonraki - 'calisma_sayisi' - 'calisma_yapilan')
       is distinct from (onceki - 'calisma_sayisi' - 'calisma_yapilan') then
    raise exception '5a BAŞARISIZ — ortalamalar değişti.%  önce: %  sonra: %',
      chr(10), onceki::text, sonraki::text;
  end if;

  -- Listelerde yeni alanlar SATIR İÇİNDE; sıra `with ordinality` ile
  -- korunuyor (jsonb_agg sırayı garanti etmiyor, karşılaştırma da
  -- sırayla yapılıyor).
  if (select coalesce(jsonb_agg(e - 'calisma_sayisi' - 'calisma_yapilan' order by i), '[]'::jsonb)
        from jsonb_array_elements(sonraki_liste->'ogrenciler') with ordinality t(e, i))
     is distinct from
     (select coalesce(jsonb_agg(e - 'calisma_sayisi' - 'calisma_yapilan' order by i), '[]'::jsonb)
        from jsonb_array_elements(onceki_liste->'ogrenciler') with ordinality t(e, i)) then
    raise exception '5b BAŞARISIZ — sınıf listesi değişti.%  önce: %  sonra: %',
      chr(10), onceki_liste::text, sonraki_liste::text;
  end if;
  -- `degerlendirilen_odev` liste gövdesinde, satırlarda değil.
  if sonraki_liste->>'degerlendirilen_odev' is distinct from
     onceki_liste->>'degerlendirilen_odev' then
    raise exception '5b2 BAŞARISIZ — değerlendirilen ödev sayısı % → %',
      onceki_liste->>'degerlendirilen_odev', sonraki_liste->>'degerlendirilen_odev';
  end if;

  if (sonraki_karne - 'calisma_sayisi' - 'calisma_yapilan')
       is distinct from (onceki_karne - 'calisma_sayisi' - 'calisma_yapilan') then
    raise exception '5c BAŞARISIZ — karne değişti.%  önce: %  sonra: %',
      chr(10), onceki_karne::text, sonraki_karne::text;
  end if;

  if (select coalesce(jsonb_agg(e - 'calisma_sayisi' - 'calisma_yapilan' order by i), '[]'::jsonb)
        from jsonb_array_elements(sonraki_ozet->'ogrenciler') with ordinality t(e, i))
     is distinct from
     (select coalesce(jsonb_agg(e - 'calisma_sayisi' - 'calisma_yapilan' order by i), '[]'::jsonb)
        from jsonb_array_elements(onceki_ozet->'ogrenciler') with ordinality t(e, i)) then
    raise exception '5d BAŞARISIZ — sınıf özeti değişti.%  önce: %  sonra: %',
      chr(10), onceki_ozet::text, sonraki_ozet::text;
  end if;
  if (select coalesce(jsonb_agg(e - 'calisma_sayisi' - 'calisma_yapilan' order by i), '[]'::jsonb)
        from jsonb_array_elements(sonraki_cizelge->'ogrenciler') with ordinality t(e, i))
     is distinct from
     (select coalesce(jsonb_agg(e - 'calisma_sayisi' - 'calisma_yapilan' order by i), '[]'::jsonb)
        from jsonb_array_elements(onceki_cizelge->'ogrenciler') with ordinality t(e, i)) then
    raise exception '5e BAŞARISIZ — not çizelgesi değişti.%  önce: %  sonra: %',
      chr(10), onceki_cizelge->'ogrenciler', sonraki_cizelge->'ogrenciler';
  end if;
  if sonraki_cizelge->>'degerlendirilen_odev' is distinct from onceki_cizelge->>'degerlendirilen_odev' then
    raise exception '5e2 BAŞARISIZ — süresi dolan ödev sayısı % → %',
      onceki_cizelge->>'degerlendirilen_odev', sonraki_cizelge->>'degerlendirilen_odev';
  end if;
  raise notice '5 OK — BEŞ ucun da çalışma kağıdı dışı sayıları birebir aynı';

  -- ===========================================================================
  raise notice '--- 6. puan_bekleyen artmadı ---';
  -- ===========================================================================
  -- Ayrı yazılı: 5. grup yeşilken bile bu sayının yanlış olduğu bir
  -- dünya düşünülebilir (ikisi birlikte bozulursa fark görünmez).
  if (sonraki->>'puan_bekleyen')::integer <> 0 then
    raise exception '6 BAŞARISIZ — puan bekleyen % (çalışma kağıdı kuyruğa düştü)',
      sonraki->>'puan_bekleyen';
  end if;
  raise notice '6 OK — çalışma kağıdı değerlendirme kuyruğuna düşmüyor';

  -- ===========================================================================
  raise notice '--- 7. Ayrı sayaç ---';
  -- ===========================================================================
  if (sonraki->>'calisma_sayisi')::integer <> 1
     or (sonraki->>'calisma_yapilan')::integer <> 1 then
    raise exception '7a BAŞARISIZ — gönderende sayaç %/%',
      sonraki->>'calisma_sayisi', sonraki->>'calisma_yapilan';
  end if;
  v := public._ogrenci_ortalamalari(o_b, v_sinif, null);
  if (v->>'calisma_sayisi')::integer <> 1 or (v->>'calisma_yapilan')::integer <> 0 then
    raise exception '7b BAŞARISIZ — göndermeyende sayaç %/%',
      v->>'calisma_sayisi', v->>'calisma_yapilan';
  end if;
  -- Göndermeyenin ORTALAMASI da bozulmamalı: 0 girseydi burada görünürdü.
  if (v->>'odev_sayisi')::integer <> 2 then
    raise exception '7c BAŞARISIZ — göndermeyende ödev sayısı % (çalışma kağıdı sayıldı)',
      v->>'odev_sayisi';
  end if;
  select e into v
    from jsonb_array_elements(sonraki_liste->'ogrenciler') e
   where e->>'id' = o_a::text;
  if (v->>'calisma_yapilan')::integer <> 1 then
    raise exception '7d BAŞARISIZ — sınıf listesinde sayaç yok: %', v::text;
  end if;
  -- Öğretmenin GERÇEKTEN baktığı ekran: not çizelgesi.
  select e into v
    from jsonb_array_elements(sonraki_cizelge->'ogrenciler') e
   where e->>'id' = o_a::text;
  if (v->>'calisma_sayisi')::integer <> 1 or (v->>'calisma_yapilan')::integer <> 1 then
    raise exception '7e BAŞARISIZ — not çizelgesinde sayaç %/%',
      v->>'calisma_sayisi', v->>'calisma_yapilan';
  end if;
  raise notice '7 OK — gönderende 1/1, göndermeyende 1/0, liste de taşıyor';

  -- ===========================================================================
  raise notice '--- 8. Öğretmenin ödev listesi ---';
  -- ===========================================================================
  select e into v
    from jsonb_array_elements(public.odevler_listesi(jt, v_sinif, null)) e
   where (e->>'id')::uuid = d_cal;
  if v is null then
    raise exception '8a BAŞARISIZ — çalışma kağıdı listede yok';
  end if;
  if v->>'ortalama_yapan' is not null or v->>'ortalama_tum' is not null then
    raise exception '8b BAŞARISIZ — çalışma kağıdına ortalama yazıldı: %', v::text;
  end if;
  if (v->>'gonderim_sayisi')::integer <> 1 then
    raise exception '8c BAŞARISIZ — gönderim sayısı %', v->>'gonderim_sayisi';
  end if;
  -- 0085 GERİLEME KAPISI: kopyalama tarihleri düşürmemiş olmalı.
  if v->'tarihler' is null or v->'tarihler'->>'verilis' is null then
    raise exception '8d BAŞARISIZ — 0085''in tarihleri kayboldu: %', v::text;
  end if;
  raise notice '8 OK — ortalama yok, gönderim sayısı 1, tarihler yerinde';

  -- ===========================================================================
  raise notice '--- 9. Öğrenci ve veli ekranı ---';
  -- ===========================================================================
  select e into v
    from jsonb_array_elements((public.ogrenci_odevleri(joa))->'odevler') e
   where (e->>'id')::uuid = d_cal;
  if v is null or v->>'tur' <> 'calisma' then
    raise exception '9a BAŞARISIZ — öğrenci çalışma kağıdını görmüyor: %', coalesce(v::text, 'yok');
  end if;
  if v->'gonderim'->>'puan' is not null then
    raise exception '9b BAŞARISIZ — öğrencide puan görünüyor: %', v->'gonderim'::text;
  end if;

  select e into v
    from jsonb_array_elements((public.veli_paneli(jva))->'odevler') e
   where e->>'baslik' = 'Çalışma kağıdı ' || ek;
  if v is null then
    raise exception '9c BAŞARISIZ — veli çalışma kağıdını görmüyor';
  end if;
  if (v->>'gonderildi')::boolean is not true then
    raise exception '9d BAŞARISIZ — velide "gönderdi" yazmıyor: %', v::text;
  end if;
  if v->>'puan' is not null then
    raise exception '9e BAŞARISIZ — velide puan var: %', v->>'puan';
  end if;
  -- Kıyas kartı çizilmemeli (puan yok).
  if v->'kiyas'->>'durum' is distinct from 'kiyas_yok' then
    raise exception '9f BAŞARISIZ — çalışma kağıdında kıyas çizildi: %', v->'kiyas'::text;
  end if;
  raise notice '9 OK — öğrenci ve veli görüyor; puan ve kıyas yok';

  -- ===========================================================================
  raise notice '--- 10. Test ve açık uçlu davranışı değişmedi ---';
  -- ===========================================================================
  -- B öğrencisi teste gönderiyor: puan HÂLÂ hesaplanıyor.
  v := public.odev_gonder(job, d_test, 'cozum/' || d_test || '/' || o_b || '.jpg',
                          '{"1":"A","2":"X"}'::jsonb);
  if (v->>'puan')::numeric is distinct from 50 then
    raise exception '10a BAŞARISIZ — test puanı % (50 bekleniyordu)', v->>'puan';
  end if;
  if (select durum from public.gonderimler
       where odev_id = d_test and ogrenci_id = o_b) <> 'puanlandi' then
    raise exception '10b BAŞARISIZ — test gönderiminin durumu bozuldu';
  end if;
  -- Açık uçlu hâlâ puanlanabiliyor.
  perform public.odev_gonder(job, d_acik, 'cozum/' || d_acik || '/' || o_b || '.jpg');
  perform public.acik_puanla(jt,
    (select id from public.gonderimler where odev_id = d_acik and ogrenci_id = o_b),
    70, 'Olur.');
  if (select ogretmen_puan from public.gonderimler
       where odev_id = d_acik and ogrenci_id = o_b) is distinct from 70 then
    raise exception '10c BAŞARISIZ — açık uçlu puanlama bozuldu';
  end if;
  raise notice '10 OK — test kendi puanını veriyor, açık uçlu puanlanabiliyor';

  -- ===========================================================================
  raise notice '--- 11. Güncelleme anahtar yazamıyor ---';
  -- ===========================================================================
  -- `odev_guncelle`'ye DOKUNULMADI; bu grup o kararın doğru olduğunu
  -- ölçüyor. Yanlışsa buradan anahtar sızar ve puanlama yolları açılır.
  perform public.odev_guncelle(jt, d_cal, 'Çalışma kağıdı ' || ek, 'Alıştırma',
                               v_sinif, current_date - 3, 5, '{"1":"B"}'::jsonb);
  select to_jsonb(o) into v from public.odevler o where o.id = d_cal;
  if v->>'cevap_anahtari' is not null or v->>'soru_sayisi' is not null then
    raise exception '11 BAŞARISIZ — güncelleme çalışma kağıdına anahtar yazdı: %', v::text;
  end if;
  raise notice '11 OK — güncelleme de anahtar yazamıyor';

  -- ===========================================================================
  raise notice '--- 12. Zincirin sonu ---';
  -- ===========================================================================
  select count(*) into n from public.uygulanan_migrationlar where dosya = '0086';
  if n <> 1 then
    raise exception '12 BAŞARISIZ — 0086 kaydı yok';
  end if;
  raise notice '12 OK — zincir 0086''da';

  raise notice '=== 0086 çalışma kağıdı: 12 grubun hepsi geçti ===';
end $$;

-- =============================================================================
-- KUSUR PROVALARI — onunun da hepsi ısırdı
--
-- Her kusur 0086'ya tek tek yerleştirildi, migration uygulandı ve bu
-- dosya yeniden çalıştırıldı. Kusurun ÖZ-DENETİMDEN de geçmesi gereken
-- yerlerde o satır bilerek etkisizleştirildi — yoksa prova ölçümün
-- değil öz-denetimin ısırdığını gösterirdi.
--
--   A. Ortalamalardan `filter (where not calisma)` kaldırıldı
--      → 5a: "ortalamalar değişti"
--   B. `odev_gonder` üçüncü dalı 'incelemede' yazacak hâle getirildi
--      → 3a: "durum incelemede döndü"
--   C. `puan_duzelt`in tür kapısı kaldırıldı
--      → 4b: "puan_duzelt çalışma kağıdını puanladı"
--   D. `acik_puanla`nın tür kapısı kaldırıldı
--      → 4a: "yanlış gerekçe: Verilmiş puanı yalnız platformun sahibi
--        değiştirebilir." ÖĞRETİCİ: puan yine YAZILMIYOR (durum kapısı
--        tutuyor), yalnız öğretmene yanlış sebep söyleniyor. Ölçüm
--        başta yalnız hata KODUNA bakıyordu ve bu provada sessiz
--        kalmıştı; mesaj da ölçülmeye başlandı.
--   E. `sinif_ogrencileri` süzgeçleri kaldırıldı → 5b
--   F. `kendi_karnem` gelişim süzgeci kaldırıldı → 5c
--   G. `sinif_ogrenci_ozeti` sayım süzgeçleri kaldırıldı → 5d
--   H. `odevler_listesi` ortalama süzgeci kaldırıldı
--      → 8b: "çalışma kağıdına ortalama yazıldı"
--   I. `_odev_kiyasi` erken dönüşü kaldırıldı
--      → 9f: "çalışma kağıdında kıyas çizildi" (kart "hazir" durumuyla
--        ve boş ortalamayla çiziliyordu)
--   J. `odev_olustur`un anahtar temizlemesi kaldırıldı
--      → VERİTABANI ısırdı: `odev_test_tutarli`. Kural yalnız
--        fonksiyonda değil, tabloda da duruyor.
--
-- ÖLÇÜMÜN KENDİ BULDUĞU İKİ KUSUR (yazarken değil, ÇALIŞTIRIRKEN):
--   • `odev_test_tutarli` çalışma kağıdını reddediyordu ("test değilse
--     açık uçludur" diye yazılmıştı);
--   • `kendi_karnem`in gelişim grafiğine `deger: null` bir nokta
--     giriyordu — çocuğa olmayan bir düşüş gösterecekti.
-- İkisi de 5. grubun önce/sonra fotoğrafı sayesinde göründü.
-- =============================================================================
