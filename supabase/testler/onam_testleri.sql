-- =============================================================================
-- SEKİZ — 0034 VELİ ONAMI TESTLERİ
--
-- Öğretmenin kararı netti: onam UYGULAMA İÇİNDE alınacak ve ONAYLAMAYAN
-- VELİ GİREMEYECEK. Bu dosya o kapının gerçekten var olduğunu ölçüyor.
--
-- BU DOSYANIN DÖRT SORUSU:
--
--   1. KAPI GERÇEKTEN KAPALI MI. Onamsız veli hiçbir uca giremiyor ve
--      `veli_paneli` çocuğa ait TEK BİR ALAN bile döndürmüyor.
--   2. KAPI AÇILIYOR MU (pozitif kontrol). Onam verilince aynı çağrıların
--      hepsi çalışıyor. Bu olmadan "hepsi reddedildi" ölçümü, her şeyi
--      kırmış olmakla ayırt edilemezdi.
--   3. YANLIŞ KİMSEYİ VURMUYOR MU (negatif kontrol). Öğrenci ve öğretmen
--      onamdan hiç etkilenmiyor — `kendi_karnem` ve `okundu_isaretle` iki
--      rol tarafından da kullanılıyor; kapıyı role bakmadan kursaydık onam,
--      öğrencinin karnesini de kapatırdı.
--   4. YENİ BİR VELİ UCU KAPISIZ EKLENİRSE YAKALANIR MI. 9. grup bunu
--      varsayılan-ret mantığıyla ölçüyor: beyaz liste dışında kalan HER
--      anon ucu, onamsız veli jetonunu reddetmek ZORUNDA.
--
-- İZOLASYON: kendi sınıfını ve öğrencisini kuruyor, sonunda siliyor.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text;          -- öğretmen (sahip)
  jo text;          -- öğrenci
  jv text;          -- veli
  v_sinif uuid;
  v_ogr   uuid;
  v_odev  uuid;
  v jsonb;
  n integer;
  v_kod text;
  sapan text[] := '{}';
  r record;
  cagri text;
  tipler text[];
begin
  -- ---------------------------------------------------------------------------
  -- Hazırlık
  -- ---------------------------------------------------------------------------
  update public.ogretmenler
     set pin_hash = extensions.crypt('Onam!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Onam!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (11, 'N')
    on conflict (seviye, sube) do update set arsiv = false
    returning id into v_sinif;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    select g.id, v_sinif from public.ogretmenler g where g.yonetici
    on conflict do nothing;

  v_ogr := (public.ogrenci_ekle(jt, 'Onam Deneği', 'okul', v_sinif))->>'id';

  v_odev := (public.odev_olustur(jt, 'Onam turu ödevi', 'Açıklama',
      v_sinif, 'test', (current_date + 5)::date, 2,
      '{"1":"A","2":"B"}'::jsonb, 'odev/onam-anahtar.pdf', 'odev/onam-soru.pdf',
      true, 4::smallint, '{"1":"Türev","2":"Limit"}'::jsonb))->>'id';
  perform public.odev_yayinla(jt, v_odev);

  jo := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_ogr and rol = 'ogrenci')))->>'token';
  perform public.odev_gonder(jo, v_odev,
    'cozum/' || v_odev::text || '/' || v_ogr::text || '.jpg', '{"1":"A","2":"B"}'::jsonb);
  perform public.mesaj_gonder(jt, 'Veliye bir cümle.', v_ogr);

  v_kod := (select kod from public.giris_kodlari
             where ogrenci_id = v_ogr and rol = 'veli');
  jv := (public.giris(v_kod))->>'token';

  -- ---------------------------------------------------------------------------
  -- 1. ONAMSIZ VELİ: `veli_paneli` yalnız kapıyı gösteriyor
  --
  -- Burada asıl ölçülen "hata verdi mi" değil, ÇOCUĞUN VERİSİ SIZDI MI.
  -- Yanıtın tamamı metne çevrilip çocuğun adı, ödev başlığı ve mesajı
  -- ayrı ayrı aranıyor: alan adı değişse bile sızıntı yakalanır.
  -- ---------------------------------------------------------------------------
  v := public.veli_paneli(jv);

  if (v->>'onam_gerekli') is distinct from 'true' then
    raise exception '1: onamsız veli panele girdi (yanıt: %)', v::text;
  end if;
  if (v->>'surum') is distinct from public._gecerli_onam_surumu() then
    raise exception '1: yanıt sürümü söylemiyor, arayüz hangi metni göstereceğini bilemez';
  end if;
  if v ? 'ogrenci' or v ? 'odevler' or v ? 'mesajlar' or v ? 'genel_ortalama' then
    raise exception '1: onamsız yanıtta çocuğa ait alanlar var: %', v::text;
  end if;
  if v::text like '%Onam Deneği%'
     or v::text like '%Onam turu ödevi%'
     or v::text like '%Veliye bir cümle%' then
    raise exception '1: onamsız yanıta çocuğun verisi sızdı: %', v::text;
  end if;
  raise notice '1 OK — onamsız veli yalnız kapıyı görüyor, çocuğun verisi hiç gelmiyor';

  -- ---------------------------------------------------------------------------
  -- 2. ONAMSIZ VELİ: diğer uçların HER BİRİ reddediyor
  --
  -- Tek tek, çünkü "biri kapalı" ile "hepsi kapalı" aynı şey değil.
  -- ---------------------------------------------------------------------------
  begin
    perform public.kendi_karnem(jv);
    raise exception '2a: onamsız veli kendi_karnem''e girdi';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.okundu_isaretle(jv);
    raise exception '2b: onamsız veli okundu_isaretle''ye girdi';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.mesaj_gonder(jv, 'Onamsız mesaj denemesi.');
    raise exception '2c: onamsız veli mesaj yazdı';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.dosya_erisim_izni(jv,
      'cozum/' || v_odev::text || '/' || v_ogr::text || '.jpg');
    raise exception '2d: onamsız veli dosya izni aldı';
  exception when insufficient_privilege then null;
  end;

  -- Mesaj gerçekten YAZILMADI mı? Reddedilirken satır bırakmamalı.
  select count(*) into n from public.mesajlar
   where ogrenci_id = v_ogr and metin = 'Onamsız mesaj denemesi.';
  if n <> 0 then
    raise exception '2e: reddedilen mesaj yine de yazıldı (% satır)', n;
  end if;
  raise notice '2 OK — dört uç da reddetti, reddederken satır bırakmadı';

  -- ---------------------------------------------------------------------------
  -- 3. ÇIKIŞ KAPALI DEĞİL
  --
  -- Onaylamayan veliyi ekranda kilitlemek olurdu. Bilerek açık bırakıldı.
  -- ---------------------------------------------------------------------------
  declare
    jv_gecici text := (public.giris(v_kod))->>'token';
  begin
    perform public.cikis(jv_gecici);
    if exists (select 1 from public.oturumlar o
                where o.token_hash = public._token_hash(jv_gecici) and not o.iptal) then
      raise exception '3: çıkış çalışmadı — onaylamayan veli ekranda kilitli kalıyor';
    end if;
  end;
  raise notice '3 OK — onaylamayan veli en azından çıkabiliyor';

  -- ---------------------------------------------------------------------------
  -- 4. SÜRÜM DENETİMİ
  -- ---------------------------------------------------------------------------
  begin
    perform public.onam_ver(jv, 'olmayan-surum');
    raise exception '4a: yanlış sürümle onam kabul edildi';
  exception when invalid_parameter_value then null;
  end;

  select count(*) into n from public.veli_onaylari where ogrenci_id = v_ogr;
  if n <> 0 then
    raise exception '4b: reddedilen onam yine de yazıldı';
  end if;
  raise notice '4 OK — yanlış sürüm reddediliyor ve satır bırakmıyor';

  -- ---------------------------------------------------------------------------
  -- 5. POZİTİF KONTROL — kapı AÇILIYOR mu
  --
  -- Bu grup olmasaydı 1. ve 2. gruplar "her şeyi kırdım" durumunda da
  -- yeşil kalırdı.
  -- ---------------------------------------------------------------------------
  perform public.onam_ver(jv, public._gecerli_onam_surumu());

  v := public.veli_paneli(jv);
  if v ? 'onam_gerekli' then
    raise exception '5a: onam verildi ama kapı hâlâ kapalı';
  end if;
  if (v->'ogrenci'->>'ad') <> 'Onam Deneği' then
    raise exception '5b: onamdan sonra panel çocuğu göstermiyor: %', v::text;
  end if;
  if jsonb_array_length(v->'mesajlar') <> 1 then
    raise exception '5c: onamdan sonra mesajlar gelmiyor';
  end if;

  perform public.kendi_karnem(jv);
  perform public.okundu_isaretle(jv);
  perform public.mesaj_gonder(jv, 'Onamlı mesaj.');
  if not public.dosya_erisim_izni(jv,
       'cozum/' || v_odev::text || '/' || v_ogr::text || '.jpg') then
    raise exception '5d: onamdan sonra veli kendi çocuğunun fotoğrafına erişemiyor';
  end if;
  raise notice '5 OK — onamdan sonra beş ucun hepsi çalışıyor';

  -- İki kez onaylamak ikinci satır açmıyor.
  perform public.onam_ver(jv, public._gecerli_onam_surumu());
  select count(*) into n from public.veli_onaylari where ogrenci_id = v_ogr;
  if n <> 1 then
    raise exception '5e: iki kez onay % satır bıraktı', n;
  end if;
  raise notice '5b OK — iki kez onay tek satır';

  -- ---------------------------------------------------------------------------
  -- 6. ROL — onamı veli verir, başkası onun adına veremez
  -- ---------------------------------------------------------------------------
  begin
    perform public.onam_ver(jo, public._gecerli_onam_surumu());
    raise exception '6a: öğrenci veli adına onam verdi';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.onam_ver(jt, public._gecerli_onam_surumu());
    raise exception '6b: öğretmen veli adına onam verdi';
  exception when insufficient_privilege then null;
  end;
  raise notice '6 OK — onamı yalnız velinin kendisi verebiliyor';

  -- ---------------------------------------------------------------------------
  -- 7. NEGATİF KONTROL — öğrenci ve öğretmen etkilenmiyor
  --
  -- ÖĞRENCİNİN HİÇ ONAMI YOK; buna rağmen kendi uçları çalışmalı.
  -- ---------------------------------------------------------------------------
  perform public.kendi_karnem(jo);
  perform public.okundu_isaretle(jo);
  perform public.ogrenci_odevleri(jo);
  if not public.dosya_erisim_izni(jo,
       'cozum/' || v_odev::text || '/' || v_ogr::text || '.jpg') then
    raise exception '7a: öğrenci kendi çözümüne erişemiyor — kapı yanlış rolü vurdu';
  end if;
  perform public.ogretmen_panosu(jt);
  perform public.konu_karnesi(jt, null, v_ogr);
  raise notice '7 OK — öğrenci ve öğretmen onamdan hiç etkilenmiyor';

  -- ---------------------------------------------------------------------------
  -- 8. DENETİM İZİ ve ÖĞRETMENİN GÖRDÜĞÜ
  -- ---------------------------------------------------------------------------
  select count(*) into n from public.denetim_izi
   where islem = 'onam_verildi' and kayit_id = v_ogr;
  if n < 1 then
    raise exception '8a: onam denetim izine düşmedi';
  end if;

  v := public.sinif_velileri(jt, v_sinif);
  if not exists (select 1 from jsonb_array_elements(v->'veliler') e
                  where (e->>'ogrenci_id')::uuid = v_ogr and (e->>'onam_var')::boolean) then
    raise exception '8b: öğretmen onam durumunu göremiyor: %', (v->'veliler')::text;
  end if;

  -- Onamı olmayan bir veli `onam_var = false` görünmeli. Bu ikinci öğrenci
  -- olmadan 8b, "alan hep true dönüyor" durumunda da yeşil kalırdı.
  declare
    v_ogr2 uuid := (public.ogrenci_ekle(jt, 'Onamsız Deneği', 'okul', v_sinif))->>'id';
  begin
    v := public.sinif_velileri(jt, v_sinif);
    if not exists (select 1 from jsonb_array_elements(v->'veliler') e
                    where (e->>'ogrenci_id')::uuid = v_ogr2
                      and (e->>'onam_var')::boolean = false) then
      raise exception '8c: onamsız veli de onaylı görünüyor — alan sabit true';
    end if;
    perform public.ogrenci_pasiflestir(jt, v_ogr2);
    delete from public.ogrenciler where id = v_ogr2;
  end;
  raise notice '8 OK — denetim izi düştü, öğretmen kimin beklediğini görüyor';

  -- ---------------------------------------------------------------------------
  -- 9. KAPSAM — VARSAYILAN RET
  --
  -- `guvenlik_denetimi.sql` 1a grubunun mantığı: uçları gövde metnine göre
  -- SEÇMİYORUZ. `anon`'a açık HER uç, ONAMSIZ bir veli jetonunu reddetmek
  -- zorunda; beyaz listede olanlar hariç. Böylece yarın kapısız yeni bir
  -- veli ucu eklenirse varsayılan "kırmızı" oluyor ve listeyi genişletmek
  -- bilinçli bir karar gerektiriyor.
  -- ---------------------------------------------------------------------------
  declare
    jv_onamsiz text;
    v_ogr3 uuid;
  begin
    v_ogr3 := (public.ogrenci_ekle(jt, 'Kapsam Deneği', 'okul', v_sinif))->>'id';
    jv_onamsiz := (public.giris((select kod from public.giris_kodlari
                     where ogrenci_id = v_ogr3 and rol = 'veli')))->>'token';

    for r in
      select p.proname, p.proargtypes::oid[] as argtipleri
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and has_function_privilege('anon', p.oid, 'execute')
         and p.proname not in (
               -- Onamdan ÖNCE de çalışması gereken üç uç:
               --   giris  — veli zaten girmiş olmalı ki metni görebilsin
               --   cikis  — kilitli bırakmamak için
               --   onam_ver — kapının kendisi
               'giris', 'cikis', 'onam_ver',
               -- `veli_paneli` hata DEĞİL, `onam_gerekli` döndürüyor;
               -- sızdırmadığı 1. grupta ayrıca ölçülüyor.
               'veli_paneli',
               -- `pin_ayarla` rol şartı taşımıyor (PIN doluyken zaten
               -- 42501 veriyor, `guvenlik_denetimi.sql` 4a ölçüyor).
               'pin_ayarla'
             )
       order by p.proname
    loop
      select array_agg('null::' || format_type(t, null) order by i)
        into tipler
        from unnest(r.argtipleri) with ordinality u(t, i)
       where i > 1;

      cagri := format('select public.%I(%s)', r.proname,
        array_to_string(array[quote_literal(jv_onamsiz) || '::text']
                        || coalesce(tipler, '{}'), ', '));
      begin
        execute cagri;
        sapan := sapan || (r.proname || ' → HATA VERMEDİ');
      exception when others then null;
      end;
    end loop;

    if array_length(sapan, 1) is not null then
      raise exception '9: onamsız veli % uca girebildi: %',
        array_length(sapan, 1), array_to_string(sapan, ' | ');
    end if;

    perform public.ogrenci_pasiflestir(jt, v_ogr3);
    delete from public.ogrenciler where id = v_ogr3;
  end;
  raise notice '9 OK — beyaz liste dışı hiçbir uç onamsız veliyi kabul etmiyor';

  -- ---------------------------------------------------------------------------
  -- Temizlik
  -- ---------------------------------------------------------------------------
  delete from public.ogrenciler where id = v_ogr;
  update public.siniflar set arsiv = true where id = v_sinif;

  raise notice '';
  raise notice 'ONAM TESTLERİ: 9 GRUP GEÇTİ';
end $$;
