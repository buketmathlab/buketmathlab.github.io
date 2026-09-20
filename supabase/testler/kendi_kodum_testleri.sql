-- =============================================================================
-- SEKİZ — 0046 KENDİ KODUMU YENİLE TESTLERİ
--
-- 0045'in testleriyle aynı soruları sormuyor. Oradaki kapı öğretmendi ve
-- öğretmen o oturumların İÇİNDE DEĞİLDİ. Burada işi yapan kişi kendi
-- oturumunun içinde, ve bu iki yeni soru doğuruyor:
--
--   1. KENDİ OTURUMU AYAKTA KALIYOR MU. Kalmazsa kullanıcı yeni kodu
--      okumadan dışarı atılır — ekranda kod göstermenin anlamı kalmaz.
--   2. ÖTEKİ OTURUMLAR DÜŞÜYOR MU. Düşmezse özellik hiçbir işe yaramaz:
--      sızdıran kişi içeride kalır. Bu ikisi BİRBİRİNİN TERSİ ve tek bir
--      `id <> v_oturum_id` süzgecine bağlı; ikisi ayrı ayrı ölçülüyor,
--      çünkü süzgeci kaldıran bir kusur yalnız birini kırar.
--
-- Ayrıca 0045'te olmayan bir iddia ölçülüyor: ÖĞRETMENE VERİLEN SÖZ.
-- Ona "hiçbir kayıp olmaz, ödevler koda değil öğrenciye bağlı" dedim.
-- 9. grup bunu sayıyor — söz verdiğim şeyi ölçmeden bırakmak olmazdı.
--
-- İZOLASYON: kendi sınıfını (9K) ve öğrencisini kuruyor.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text;            -- öğretmen
  jo text;            -- öğrencinin KENDİ oturumu (işi yapan)
  jo2 text;           -- öğrencinin İKİNCİ oturumu (sızan kişi)
  jv text;            -- veli oturumu
  v_sinif uuid;
  v_ogr uuid;
  v_odev uuid;
  v jsonb;
  n integer;
  n_once integer;
  eski_ogr text;
  eski_veli text;
  yeni_ogr text;
  iz_metni text;
begin
  -- ---------------------------------------------------------------------------
  -- Hazırlık
  -- ---------------------------------------------------------------------------
  update public.ogretmenler
     set pin_hash = extensions.crypt('Kendim!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Kendim!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (9, 'K')
    on conflict (seviye, sube) do update set arsiv = false
    returning id into v_sinif;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    select g.id, v_sinif from public.ogretmenler g where g.yonetici
    on conflict do nothing;

  v_ogr := (public.ogrenci_ekle(jt, 'Kendi Kodu Denegi', 'okul', v_sinif))->>'id';

  select kod into eski_ogr  from public.giris_kodlari where ogrenci_id = v_ogr and rol = 'ogrenci';
  select kod into eski_veli from public.giris_kodlari where ogrenci_id = v_ogr and rol = 'veli';

  -- ÖĞRENCİ İKİ KEZ GİRİYOR. Birincisi "kendisi", ikincisi "sızan kişi".
  -- Tuzak burada kuruluyor: iki oturum da açıkken yenileme yapılacak ve
  -- SONUCUN biri ayakta, öteki düşmüş olması gerekiyor.
  jo  := (public.giris(eski_ogr))->>'token';
  jo2 := (public.giris(eski_ogr))->>'token';
  jv  := (public.giris(eski_veli))->>'token';

  if jo is null or jo2 is null or jv is null then
    raise exception '0a: hazırlık başarısız, oturumlar açılamadı';
  end if;
  if jo = jo2 then
    raise exception '0b: ölçüm kurulamadı — iki giriş aynı jetonu verdi';
  end if;

  -- ÖĞRENCİNİN GERÇEK BİR İŞİ OLSUN — 9. grup bunu sayacak.
  -- Yalnız ödev yaratmak yetmez: "kayıp yok" iddiası, öğrencinin KENDİ
  -- ürettiği kaydın (gönderimin) yenilemeden sağ çıkmasıyla ölçülür.
  v_odev := (public.odev_olustur(
              jt, 'Kendi kodu ödevi', null, v_sinif, 'test',
              (current_date + 3), 2, '{"1":"A","2":"B"}'::jsonb))->>'id';
  perform public.odev_yayinla(jt, v_odev);
  perform public.odev_gonder(
    jo, v_odev,
    'cozum/' || v_odev::text || '/' || v_ogr::text || '.jpg',
    '{"1":"A","2":"B"}'::jsonb);

  select count(*) into n_once
    from public.gonderimler g where g.ogrenci_id = v_ogr;
  if n_once < 1 then
    raise exception '0c: ölçüm kurulamadı — gönderim oluşmadı';
  end if;

  raise notice '0 OK — dünya kuruldu: iki öğrenci oturumu, bir veli oturumu';

  -- ---------------------------------------------------------------------------
  -- 1. ESKİ KOD ÖLÜYOR
  --
  -- `giris()` bilinmeyen kodda İSTİSNA ATMIYOR, `{"rol":"yok"}` döndürüyor
  -- (0045'te öğrenilen ders: hata mesajı kodun varlığını ele verirdi).
  -- Doğru iddia: jeton VERİLMEMELİ.
  -- ---------------------------------------------------------------------------
  v := public.kendi_kodumu_yenile(jo);
  yeni_ogr := v->>'kod';

  if yeni_ogr is null or length(yeni_ogr) <> 8 then
    raise exception '1a: yeni kod üretilmedi (%)', coalesce(yeni_ogr, 'null');
  end if;
  if yeni_ogr = eski_ogr then
    raise exception '1b: kod değişmedi';
  end if;
  if v->>'rol' is distinct from 'ogrenci' then
    raise exception '1c: dönen rol yanlış (%)', v->>'rol';
  end if;

  v := public.giris(eski_ogr);
  if v->>'token' is not null then
    raise exception '1d: ESKİ KOD HÂLÂ GİRİŞ VERİYOR';
  end if;
  raise notice '1 OK — eski kod artık giriş vermiyor';

  -- ---------------------------------------------------------------------------
  -- 2. YENİ KOD ÇALIŞIYOR — POZİTİF KONTROL
  --
  -- 1. grup tek başına ölü olabilirdi: kodu bozup hiçbir kodun
  -- çalışmamasını sağlamak da o testi geçirirdi.
  -- ---------------------------------------------------------------------------
  if (public.giris(yeni_ogr))->>'token' is null then
    raise exception '2: yeni kodla giriş yapılamadı';
  end if;
  raise notice '2 OK — yeni kod giriyor (negatif ölçüm ölü değil)';

  -- ---------------------------------------------------------------------------
  -- 3. KENDİ OTURUMU AYAKTA
  --
  -- Jetonun kendisiyle bir uç çağrılıyor — "oturumlar tablosunda iptal
  -- değil" demek yetmezdi, asıl iddia jetonun HÂLÂ İŞE YARADIĞI.
  -- ---------------------------------------------------------------------------
  begin
    perform public.ogrenci_odevleri(jo);
  exception
    when others then
      raise exception '3: YENİLEYEN KİŞİNİN KENDİ OTURUMU DÜŞTÜ (%)', sqlerrm;
  end;
  raise notice '3 OK — yenileyenin kendi oturumu ayakta';

  -- ---------------------------------------------------------------------------
  -- 4. ÖTEKİ OTURUM DÜŞTÜ
  --
  -- BU DOSYANIN ÇEKİRDEK ÖLÇÜMÜ. Özelliğin varlık sebebi bu: sızan kişi
  -- dışarı atılmalı. 3. ve 4. grup aynı süzgece bağlı ve BİRBİRİNİN
  -- TERSİ; süzgeci kaldıran kusur yalnız 3'ü, süzgeci hiç yazmayan kusur
  -- yalnız 4'ü kırar.
  -- ---------------------------------------------------------------------------
  begin
    perform public.ogrenci_odevleri(jo2);
    raise exception '4: SIZAN OTURUM HÂLÂ ÇALIŞIYOR — yenileme kimseyi atmıyor';
  exception
    when others then
      if sqlerrm like '%4:%' then raise; end if;
      -- Beklenen: oturum iptal edildiği için `_oturum` reddediyor.
      null;
  end;
  raise notice '4 OK — aynı rolün öteki oturumu kapandı';

  -- ---------------------------------------------------------------------------
  -- 5. ÖTEKİ ROL HİÇ ETKİLENMEDİ
  --
  -- Öğrenci kendi kodunu yeniledi; velinin kodu da oturumu da yerinde
  -- kalmalı. Rol süzgeci düşerse hiçbir hata çıkmaz.
  -- ---------------------------------------------------------------------------
  if (select kod from public.giris_kodlari where ogrenci_id = v_ogr and rol = 'veli')
     is distinct from eski_veli then
    raise exception '5a: öğrenci kendi kodunu yenileyince VELİ kodu değişti';
  end if;

  begin
    perform public.veli_paneli(jv);
  exception
    when others then
      raise exception '5b: öğrenci yenileyince VELİ OTURUMU kapandı (%)', sqlerrm;
  end;
  raise notice '5 OK — öteki rolün kodu ve oturumu yerinde';

  -- ---------------------------------------------------------------------------
  -- 6. ÖĞRETMEN JETONU REDDEDİLİYOR
  --
  -- Vekâlet notunun testteki karşılığı: `vekil_id is null` diye ölü bir
  -- kontrol eklemek yerine, rol kapısının gerçekten ısırdığı ölçülüyor.
  -- ---------------------------------------------------------------------------
  begin
    perform public.kendi_kodumu_yenile(jt);
    raise exception '6a: ÖĞRETMEN JETONU KABUL EDİLDİ';
  exception
    when others then
      if sqlerrm like '%6a:%' then raise; end if;
      if sqlerrm not like '%yalnızca öğrenci ve veli%' then
        raise exception '6b: red bizim kapımızdan gelmedi: %', sqlerrm;
      end if;
  end;
  raise notice '6 OK — öğretmen jetonu reddedildi, mesaj bizim';

  -- ---------------------------------------------------------------------------
  -- 7. GEÇERSİZ VE BOŞ JETON
  -- ---------------------------------------------------------------------------
  begin
    perform public.kendi_kodumu_yenile('kisa');
    raise exception '7a: geçersiz jeton kabul edildi';
  exception
    when others then
      if sqlerrm like '%7a:%' then raise; end if;
      if sqlerrm not like '%Oturum geçersiz%' then
        raise exception '7b: beklenmeyen mesaj: %', sqlerrm;
      end if;
  end;

  begin
    perform public.kendi_kodumu_yenile(null);
    raise exception '7c: null jeton kabul edildi';
  exception
    when others then
      if sqlerrm like '%7c:%' then raise; end if;
      null;
  end;
  raise notice '7 OK — geçersiz ve boş jeton reddediliyor';

  -- ---------------------------------------------------------------------------
  -- 8. İZ KAYDI — İŞLEM ADI AYRI, KOD DEĞERİ YOK
  --
  -- İşlem adının 0045'ten ayrı olması öğretmenin işine yarıyor: denetim
  -- izinde "ben mi yeniledim, onlar mı" ayırt edilebiliyor.
  -- ---------------------------------------------------------------------------
  select count(*) into n
    from public.denetim_izi
   where islem = 'kendi_kodu_yenilendi' and kayit_id = v_ogr
     and tablo = 'giris_kodlari'
     and aktor = 'ogrenci'
     and yeni->>'rol' = 'ogrenci';
  if n < 1 then
    raise exception '8a: iz kaydı yok ya da alanları eksik';
  end if;

  -- NEGATİF KONTROL: hiçbir kod değeri ize yazılmamalı.
  select string_agg(coalesce(eski::text, '') || coalesce(yeni::text, ''), ' ')
    into iz_metni
    from public.denetim_izi
   where islem = 'kendi_kodu_yenilendi' and kayit_id = v_ogr;

  if iz_metni like '%' || eski_ogr || '%' then
    raise exception '8b: İZ KAYDINDA ESKİ KOD GEÇİYOR';
  end if;
  if iz_metni like '%' || yeni_ogr || '%' then
    raise exception '8c: İZ KAYDINDA YENİ KOD GEÇİYOR';
  end if;
  raise notice '8 OK — iz kaydı ayrı işlem adıyla düştü, kod değeri yok';

  -- ---------------------------------------------------------------------------
  -- 9. ÖĞRETMENE VERİLEN SÖZ: HİÇBİR KAYIP YOK
  --
  -- "Ödevler koda değil öğrenciye bağlı" dedim. Söz verilen şey
  -- ölçülmeden bırakılmaz. Kod birkaç kez daha yenilenip sayı
  -- karşılaştırılıyor.
  -- ---------------------------------------------------------------------------
  jo := (public.giris(yeni_ogr))->>'token';
  perform public.kendi_kodumu_yenile(jo);

  select count(*) into n from public.gonderimler g where g.ogrenci_id = v_ogr;
  if n <> n_once then
    raise exception '9a: yenileme sonrası GÖNDERİM sayısı değişti (% → %)', n_once, n;
  end if;

  select count(*) into n from public.ogrenciler where id = v_ogr and aktif;
  if n <> 1 then
    raise exception '9b: öğrenci kaydı yenilemeden etkilendi';
  end if;

  select count(*) into n from public.giris_kodlari where ogrenci_id = v_ogr;
  if n <> 2 then
    raise exception '9c: kod satırı sayısı bozuldu (% satır, 2 bekleniyordu)', n;
  end if;
  raise notice '9 OK — ödev, öğrenci ve kod satırları yerinde (kayıp yok)';

  -- ---------------------------------------------------------------------------
  -- 10. İMZA TEKLİĞİ
  -- ---------------------------------------------------------------------------
  select count(*) into n
    from pg_proc p
    join pg_namespace nsp on nsp.oid = p.pronamespace
   where nsp.nspname = 'public' and p.proname = 'kendi_kodumu_yenile';
  if n <> 1 then
    raise exception '10a: kendi_kodumu_yenile % imza', n;
  end if;

  if pg_catalog.oidvectortypes(
       (select p.proargtypes from pg_proc p
          join pg_namespace nsp on nsp.oid = p.pronamespace
         where nsp.nspname = 'public' and p.proname = 'kendi_kodumu_yenile')
     ) <> 'text' then
    raise exception '10b: imza beklenenden farklı';
  end if;
  raise notice '10 OK — tek imza, beklenen tip listesi';

  -- ---------------------------------------------------------------------------
  -- 11. ONAMSIZ VELİ GİREMİYOR, ONAM VERİNCE GİRİYOR
  --
  -- Bu grup, `onam_testleri.sql` 9. grubun bu ucu yakalamasıyla doğdu.
  -- Muafiyet istenmedi; kural korundu. Ölçüm İKİ YÖNLÜ olmak zorunda:
  -- yalnız reddi ölçmek, ucu tamamen bozan bir kusurda da yeşil kalırdı.
  -- ---------------------------------------------------------------------------
  begin
    perform public.kendi_kodumu_yenile(jv);
    raise exception '11a: ONAMSIZ VELİ KODUNU YENİLEYEBİLDİ';
  exception
    when others then
      if sqlerrm like '%11a:%' then raise; end if;
      if sqlerrm not like '%onam metnini onaylamanız%' then
        raise exception '11b: red onam kapısından gelmedi: %', sqlerrm;
      end if;
  end;

  -- POZİTİF KONTROL: onam verilince aynı çağrı çalışmalı.
  perform public.onam_ver(jv, public._gecerli_onam_surumu(), 'Kendi Kodu Velisi');
  v := public.kendi_kodumu_yenile(jv);
  if v->>'kod' is null or v->>'rol' is distinct from 'veli' then
    raise exception '11c: onamdan sonra veli kendi kodunu yenileyemedi';
  end if;
  if v->>'kod' = eski_veli then
    raise exception '11d: veli kodu değişmedi';
  end if;
  raise notice '11 OK — onamsız veli reddediliyor, onamlı veli yenileyebiliyor';

  raise notice '';
  raise notice 'KENDİ KODUM TESTLERİ: 11 GRUP GEÇTİ';
end;
$$;
