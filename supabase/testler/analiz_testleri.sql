-- =============================================================================
-- SEKİZ — 0040 HAFTALIK / AYLIK / DÖNEMLİK ANALİZ TESTLERİ
--
-- Bu dosyanın işi "uç çalışıyor mu" değil, **SAYILAR DOĞRU MU**.
--
-- Bir analiz ekranının en tehlikeli kusuru çökmek değil, YANLIŞ SAYI
-- GÖSTERMEKTİR: öğretmen ona bakıp "Limit iyi gidiyor" der ve o konuyu
-- tekrar etmez. Bu yüzden testin tamamı ELDE HESAPLANMIŞ değerlere karşı
-- yazıldı — uçtan ne gelirse onu doğru saymıyoruz.
--
-- KURULAN DÜNYA (üç öğrenci, iki test ödevi):
--
--   1. HAFTA (son tarih: bugün - 10 gün) — 4 soru
--      anahtar {1:A, 2:A, 3:B, 4:B}   konular {1,2: Türev · 3,4: Limit}
--        Ö1: A A B B → 4 doğru → 100
--        Ö2: A A C C → 2 doğru →  50
--        Ö3: A A C C → 2 doğru →  50
--      ortalama = (100+50+50)/3 = 66.7
--      Türev: 6 soruda 6 doğru → %100 → iyi
--      Limit: 6 soruda 2 doğru → % 33 → calisilmali
--
--   2. HAFTA (son tarih: bugün - 3 gün) — 2 soru
--      anahtar {1:A, 2:B}             konular {1,2: Üslü}
--        Ö1: A B → 100 · Ö2: A C → 50 · Ö3: A B → 100
--      ortalama = 83.3
--      Üslü: 6 soruda 5 doğru → % 83 → iyi
--
--   ARALIĞIN TAMAMI: 2 ödev, 6 gönderim
--      ortalama = (100+50+50+100+50+100)/6 = 75.0
--      en_eksik_uc = Limit(4), Üslü(1), Türev(0)
--
-- İZOLASYON: kendi sınıfını, öğretmenini ve öğrencilerini kuruyor;
-- sonunda siliyor.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text;              -- sahip
  jb text;              -- BAŞKA öğretmen (kapsam denemesi için)
  b_id uuid;
  v_sinif uuid;
  o1 uuid; o2 uuid; o3 uuid;
  d1 uuid; d2 uuid;
  bugun date := (now() at time zone 'Europe/Istanbul')::date;
  a jsonb; h jsonb; ay jsonb; oz jsonb; k jsonb;
  n integer;

begin
  -- ---------------------------------------------------------------------------
  -- HAZIRLIK
  -- ---------------------------------------------------------------------------
  update public.ogretmenler
     set pin_hash = extensions.crypt('Analiz!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Analiz!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (12, 'Z')
    on conflict (seviye, sube) do update set arsiv = false
    returning id into v_sinif;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    select g.id, v_sinif from public.ogretmenler g where g.yonetici
    on conflict do nothing;

  o1 := (public.ogrenci_ekle(jt, 'Analiz Bir', 'okul', v_sinif))->>'id';
  o2 := (public.ogrenci_ekle(jt, 'Analiz İki', 'okul', v_sinif))->>'id';
  o3 := (public.ogrenci_ekle(jt, 'Analiz Üç', 'okul', v_sinif))->>'id';

  -- 1. HAFTA ödevi. `odev_olustur` geçmiş tarihi kabul etmiyor; ödev
  -- ileri tarihle kurulup son tarihi geriye çekiliyor. Gönderimler de
  -- son tarih geriye çekilmeden ÖNCE yapılıyor ki `odev_gonder` süre
  -- denetimine takılmasın.
  d1 := (public.odev_olustur(jt, 'Analiz 1. hafta', null, v_sinif, 'test',
          bugun + 3, 4, '{"1":"A","2":"A","3":"B","4":"B"}'::jsonb,
          null, null, true, 4::smallint,
          '{"1":"Türev","2":"Türev","3":"Limit","4":"Limit"}'::jsonb))->>'id';
  perform public.odev_yayinla(jt, d1);

  perform public.odev_gonder(
    (public.giris((select kod from public.giris_kodlari
                   where ogrenci_id = o1 and rol = 'ogrenci')))->>'token',
    d1, 'cozum/' || d1::text || '/' || o1::text || '.jpg', '{"1":"A","2":"A","3":"B","4":"B"}'::jsonb);
  perform public.odev_gonder(
    (public.giris((select kod from public.giris_kodlari
                   where ogrenci_id = o2 and rol = 'ogrenci')))->>'token',
    d1, 'cozum/' || d1::text || '/' || o2::text || '.jpg', '{"1":"A","2":"A","3":"C","4":"C"}'::jsonb);
  perform public.odev_gonder(
    (public.giris((select kod from public.giris_kodlari
                   where ogrenci_id = o3 and rol = 'ogrenci')))->>'token',
    d1, 'cozum/' || d1::text || '/' || o3::text || '.jpg', '{"1":"A","2":"A","3":"C","4":"C"}'::jsonb);

  update public.odevler set son_tarih = bugun - 10 where id = d1;

  -- 2. HAFTA ödevi
  d2 := (public.odev_olustur(jt, 'Analiz 2. hafta', null, v_sinif, 'test',
          bugun + 3, 2, '{"1":"A","2":"B"}'::jsonb,
          null, null, true, 4::smallint,
          '{"1":"Üslü","2":"Üslü"}'::jsonb))->>'id';
  perform public.odev_yayinla(jt, d2);

  perform public.odev_gonder(
    (public.giris((select kod from public.giris_kodlari
                   where ogrenci_id = o1 and rol = 'ogrenci')))->>'token',
    d2, 'cozum/' || d2::text || '/' || o1::text || '.jpg', '{"1":"A","2":"B"}'::jsonb);
  perform public.odev_gonder(
    (public.giris((select kod from public.giris_kodlari
                   where ogrenci_id = o2 and rol = 'ogrenci')))->>'token',
    d2, 'cozum/' || d2::text || '/' || o2::text || '.jpg', '{"1":"A","2":"C"}'::jsonb);
  perform public.odev_gonder(
    (public.giris((select kod from public.giris_kodlari
                   where ogrenci_id = o3 and rol = 'ogrenci')))->>'token',
    d2, 'cozum/' || d2::text || '/' || o3::text || '.jpg', '{"1":"A","2":"B"}'::jsonb);

  update public.odevler set son_tarih = bugun - 3 where id = d2;

  a := public.sinif_analizi(jt, v_sinif);

  -- ---------------------------------------------------------------------------
  -- 1. ARALIĞIN TAMAMI — elde hesaplanan sayılar
  -- ---------------------------------------------------------------------------
  oz := a->'ozet';

  if (oz->>'odev_sayisi')::int <> 2 then
    raise exception '1a: ödev sayısı 2 değil, %', oz->>'odev_sayisi';
  end if;
  if (oz->>'gonderim')::int <> 6 then
    raise exception '1b: gönderim 6 değil, %', oz->>'gonderim';
  end if;
  if (oz->>'ortalama')::numeric <> 75.0 then
    raise exception '1c: dönem ortalaması 75.0 değil, %', oz->>'ortalama';
  end if;
  raise notice '1 OK — dönem: 2 ödev, 6 gönderim, ortalama 75.0';

  -- ---------------------------------------------------------------------------
  -- 2. KONU ORANLARI VE EŞİKLER
  --
  -- Oran YANLIŞ hesaplanırsa öğretmen yanlış konuyu tekrar eder. Üç konu
  -- da tek tek ölçülüyor.
  -- ---------------------------------------------------------------------------
  select e into k from jsonb_array_elements(oz->'konular') e where e->>'konu' = 'Türev';
  if (k->>'toplam')::int <> 6 or (k->>'dogru')::int <> 6
     or (k->>'oran')::int <> 100 or (k->>'durum') <> 'iyi' then
    raise exception '2a: Türev yanlış: %', k::text;
  end if;

  select e into k from jsonb_array_elements(oz->'konular') e where e->>'konu' = 'Limit';
  if (k->>'toplam')::int <> 6 or (k->>'dogru')::int <> 2
     or (k->>'oran')::int <> 33 or (k->>'durum') <> 'calisilmali' then
    raise exception '2b: Limit yanlış: %', k::text;
  end if;

  select e into k from jsonb_array_elements(oz->'konular') e where e->>'konu' = 'Üslü';
  if (k->>'toplam')::int <> 6 or (k->>'dogru')::int <> 5
     or (k->>'oran')::int <> 83 or (k->>'durum') <> 'iyi' then
    raise exception '2c: Üslü yanlış: %', k::text;
  end if;
  raise notice '2 OK — Türev %%100 iyi, Limit %%33 çalışılmalı, Üslü %%83 iyi';

  -- ---------------------------------------------------------------------------
  -- 3. İKİ LİSTE BİRBİRİNİN YERİNE GEÇMİYOR
  --
  -- Öğretmen hem yüzde çizgisi hem "en çok eksik üç" istedi. Çizgi
  -- mutlak, sıralama görecelidir; ikisi ayrı ayrı ölçülüyor.
  -- ---------------------------------------------------------------------------
  if not (oz->'calisilmali' @> '["Limit"]'::jsonb)
     or jsonb_array_length(oz->'calisilmali') <> 1 then
    raise exception '3a: çalışılmalı listesi yanlış: %', (oz->'calisilmali')::text;
  end if;
  if not (oz->'iyi' @> '["Türev"]'::jsonb) or not (oz->'iyi' @> '["Üslü"]'::jsonb) then
    raise exception '3b: iyi listesi yanlış: %', (oz->'iyi')::text;
  end if;
  -- En çok eksik: Limit 4, Üslü 1, Türev 0 — SIRA ÖNEMLİ.
  if (oz->'en_eksik_uc'->>0) <> 'Limit' or (oz->'en_eksik_uc'->>1) <> 'Üslü' then
    raise exception '3c: en eksik üç sırası yanlış: %', (oz->'en_eksik_uc')::text;
  end if;
  raise notice '3 OK — çizgi ve sıralama ayrı ayrı doğru';

  -- ---------------------------------------------------------------------------
  -- 4. HAFTALIK KIRILIM
  --
  -- İki ödev iki AYRI haftaya düşmeli ve her haftanın ortalaması kendi
  -- ödevinden gelmeli.
  -- ---------------------------------------------------------------------------
  h := a->'haftalar';
  if jsonb_array_length(h) <> 2 then
    raise exception '4a: hafta sayısı 2 değil, %: %', jsonb_array_length(h), h::text;
  end if;

  -- Haftalar YENİDEN ESKİYE sıralı: ilk eleman 2. hafta (bugün - 3).
  if (h->0->>'ortalama')::numeric <> 83.3 then
    raise exception '4b: son haftanın ortalaması 83.3 değil, %', h->0->>'ortalama';
  end if;
  if (h->1->>'ortalama')::numeric <> 66.7 then
    raise exception '4c: önceki haftanın ortalaması 66.7 değil, %', h->1->>'ortalama';
  end if;

  -- Son haftada YALNIZ Üslü olmalı: Türev ve Limit o haftaya ait değil.
  if jsonb_array_length(h->0->'konular') <> 1
     or (h->0->'konular'->0->>'konu') <> 'Üslü' then
    raise exception '4d: son haftanın konuları yanlış: %', (h->0->'konular')::text;
  end if;
  raise notice '4 OK — iki hafta ayrı, ortalamalar ve konular haftasına ait';

  -- ---------------------------------------------------------------------------
  -- 5. AYLIK KIRILIM AYNI ÖDEVLERİ SAYIYOR
  --
  -- Hafta ve ay ayrı hesaplanıyor; ikisinin ödev sayısı toplamda
  -- tutmalı, yoksa biri sessizce ödev kaçırıyor demektir.
  -- ---------------------------------------------------------------------------
  ay := a->'aylar';
  select coalesce(sum((e->>'odev_sayisi')::int), 0) into n
    from jsonb_array_elements(ay) e;
  if n <> 2 then
    raise exception '5a: aylık kırılımda ödev sayısı 2 değil, %', n;
  end if;
  select coalesce(sum((e->>'odev_sayisi')::int), 0) into n
    from jsonb_array_elements(h) e;
  if n <> 2 then
    raise exception '5b: haftalık kırılımda ödev sayısı 2 değil, %', n;
  end if;
  raise notice '5 OK — haftalık ve aylık kırılım aynı ödevleri sayıyor';

  -- ---------------------------------------------------------------------------
  -- 6. TARİH ARALIĞI GERÇEKTEN SÜZÜYOR
  --
  -- "Dönem analizi" bu süzgece dayanıyor. Çalışmazsa öğretmen 1. dönemi
  -- seçer, 2. dönemin ödevlerini görür.
  -- ---------------------------------------------------------------------------
  a := public.sinif_analizi(jt, v_sinif, bugun - 5, bugun);
  if ((a->'ozet')->>'odev_sayisi')::int <> 1 then
    raise exception '6a: dar aralıkta 1 ödev beklenirdi, %',
      (a->'ozet')->>'odev_sayisi';
  end if;
  if ((a->'ozet')->>'ortalama')::numeric <> 83.3 then
    raise exception '6b: dar aralığın ortalaması 83.3 değil, %',
      (a->'ozet')->>'ortalama';
  end if;
  -- Limit o aralıkta HİÇ olmamalı.
  if exists (select 1 from jsonb_array_elements((a->'ozet')->'konular') e
              where e->>'konu' = 'Limit') then
    raise exception '6c: aralık dışı konu sızdı: %', ((a->'ozet')->'konular')::text;
  end if;

  -- Ters aralık reddediliyor.
  begin
    perform public.sinif_analizi(jt, v_sinif, bugun, bugun - 5);
    raise exception '6d: başlangıç bitişten sonra olduğu hâlde kabul edildi';
  exception when invalid_parameter_value then null;
  end;
  raise notice '6 OK — tarih aralığı süzüyor, ters aralık reddediliyor';

  -- ---------------------------------------------------------------------------
  -- 7. AÇIK UÇLU ÖDEV: ortalamaya GİRER, konu dökümüne GİRMEZ
  --
  -- Açık uçlu ödevin konu eşlemesi yok; konuya saysaydık `_konu_analizi`
  -- her soruyu "boş" sayar ve öğretmenin hiç sormadığı bir soruya
  -- uydurma cevap verirdik (0023'ün kararı).
  -- ---------------------------------------------------------------------------
  declare
    d3 uuid;
  begin
    d3 := (public.odev_olustur(jt, 'Analiz açık uçlu', null, v_sinif, 'acik',
            bugun + 3))->>'id';
    perform public.odev_yayinla(jt, d3);
    perform public.odev_gonder(
      (public.giris((select kod from public.giris_kodlari
                     where ogrenci_id = o1 and rol = 'ogrenci')))->>'token',
      d3, 'cozum/' || d3::text || '/' || o1::text || '.jpg', null);
    update public.odevler set son_tarih = bugun - 3 where id = d3;
    perform public.acik_puanla(jt,
      (select id from public.gonderimler where odev_id = d3 and ogrenci_id = o1),
      40, 'Deneme');

    a := public.sinif_analizi(jt, v_sinif);
    oz := a->'ozet';

    if (oz->>'odev_sayisi')::int <> 3 or (oz->>'test_sayisi')::int <> 2 then
      raise exception '7a: açık uçlu ödev sayılmadı: ödev=%, test=%',
        oz->>'odev_sayisi', oz->>'test_sayisi';
    end if;
    -- Ortalama artık (450 + 40) / 7 = 70.0
    if (oz->>'ortalama')::numeric <> 70.0 then
      raise exception '7b: açık uçlu puan ortalamaya girmedi: %', oz->>'ortalama';
    end if;
    -- Konu sayısı DEĞİŞMEMELİ: hâlâ üç konu.
    if jsonb_array_length(oz->'konular') <> 3 then
      raise exception '7c: açık uçlu ödev konu dökümüne sızdı: %',
        (oz->'konular')::text;
    end if;
  end;
  raise notice '7 OK — açık uçlu ödev ortalamaya giriyor, konu dökümüne girmiyor';

  -- ---------------------------------------------------------------------------
  -- 8. KAPSAM — başka öğretmen bu sınıfın analizini alamıyor
  -- ---------------------------------------------------------------------------
  b_id := (public.ogretmen_ekle(jt, 'Analiz Yabancı', 'AnalizY!2026'))->>'id';
  jb := (public.giris('AnalizY!2026'))->>'token';
  begin
    perform public.sinif_analizi(jb, v_sinif);
    raise exception '8a: başka öğretmen analizi aldı';
  exception when insufficient_privilege then null;
  end;

  -- POZİTİF KONTROL: sınıf atanınca GERÇEKTEN alabiliyor. Bu olmadan
  -- yukarıdaki ölçüm, uç hiç çalışmıyor olsa da yeşil kalırdı.
  perform public.ogretmen_sinif_ata(jt, b_id, jsonb_build_array(v_sinif::text));
  if ((public.sinif_analizi(jb, v_sinif)->'ozet')->>'odev_sayisi')::int <> 3 then
    raise exception '8b: sınıf atandığı hâlde analiz gelmedi';
  end if;
  raise notice '8 OK — kapsam dışı reddediliyor, kapsam içi çalışıyor';

  -- ---------------------------------------------------------------------------
  -- 9. AZ VERİ DAMGASI
  --
  -- Beş sorunun altındaki konu "çalışılmalı" diye damgalanmamalı:
  -- öğretmene olmayan bir bilgi vermek olurdu.
  -- ---------------------------------------------------------------------------
  if public._konu_durumu(4, 0) <> 'az_veri' then
    raise exception '9a: 4 soruluk konu az_veri sayılmadı';
  end if;
  if public._konu_durumu(5, 0) <> 'calisilmali' then
    raise exception '9b: 5 soruda 0 doğru çalışılmalı sayılmadı';
  end if;
  if public._konu_durumu(10, 7) <> 'iyi' then
    raise exception '9c: %%70 iyi sayılmadı';
  end if;
  if public._konu_durumu(10, 6) <> 'orta' then
    raise exception '9d: %%60 orta sayılmadı';
  end if;
  raise notice '9 OK — eşikler ve az veri damgası doğru';

  -- ---------------------------------------------------------------------------
  -- Temizlik
  -- ---------------------------------------------------------------------------
  delete from public.ogrenciler where id in (o1, o2, o3);
  delete from public.odevler where sinif_id = v_sinif;
  update public.ogretmenler set aktif = false where id = b_id;
  update public.siniflar set arsiv = true where id = v_sinif;

  raise notice '';
  raise notice 'ANALİZ TESTLERİ: 9 GRUP GEÇTİ';
end $$;
