-- =============================================================================
-- SEKİZ — 0045 KODU YENİLE TESTLERİ
--
-- Bu dosyanın asıl sorusu "yeni kod üretiliyor mu" DEĞİL. O kolay kısım.
-- Asıl sorular şunlar:
--
--   1. ESKİ KOD GERÇEKTEN ÖLÜYOR MU. Yenileme, iptal demek. Eski kodla
--      giriş hâlâ çalışıyorsa hiçbir işe yaramaz.
--   2. AÇIK OTURUM KAPANIYOR MU. Kodu değiştirip oturumu bırakmak,
--      kapıyı kilitleyip hırsızı içeride unutmaktır.
--   3. ÖTEKİ ROL ETKİLENİYOR MU. Veli kodunu yenilemek öğrenciyi
--      sistemden ATMAMALI. `oturumlar.rol` süzgeci unutulursa hiçbir şey
--      hata vermez; ürün sessizce yanlış davranır. 4. grup tam bunu
--      ölçüyor ve süzgeç kaldırılarak ısırdığı gösterildi.
--   4. İZ KAYDINA KOD SIZIYOR MU. Ölmüş şifrelerin kalıcı arşivi
--      olmamalı — 6. grup NEGATİF kontrol.
--   5. KAPI KİMDE. Başka öğretmenin öğrencisi, öğrenci/veli jetonu,
--      geçersiz rol.
--
-- İZOLASYON: kendi sınıfını (9Y) ve öğrencilerini kuruyor; toplam
-- sayılara değil kendi kayıtlarına bakıyor.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text;            -- öğretmen (sahip)
  jt2 text;           -- ikinci öğretmen (kapsam dışı)
  jo text;            -- öğrenci oturumu
  jv text;            -- veli oturumu
  v_sinif uuid;
  v_ogr uuid;
  v_ogr2 uuid;
  v_ogretmen2 uuid;
  v jsonb;
  n integer;
  eski_ogr text;
  eski_veli text;
  yeni_ogr text;
  yeni_veli text;
  iz_metni text;
begin
  -- ---------------------------------------------------------------------------
  -- Hazırlık
  -- ---------------------------------------------------------------------------
  update public.ogretmenler
     set pin_hash = extensions.crypt('Yenile!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Yenile!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (9, 'Y')
    on conflict (seviye, sube) do update set arsiv = false
    returning id into v_sinif;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    select g.id, v_sinif from public.ogretmenler g where g.yonetici
    on conflict do nothing;

  v_ogr := (public.ogrenci_ekle(jt, 'Yenileme Deneği', 'okul', v_sinif))->>'id';

  select kod into eski_ogr  from public.giris_kodlari where ogrenci_id = v_ogr and rol = 'ogrenci';
  select kod into eski_veli from public.giris_kodlari where ogrenci_id = v_ogr and rol = 'veli';

  -- İKİ ROL DE GİRİŞ YAPIYOR: 3. ve 4. grup için canlı oturum gerekiyor.
  jo := (public.giris(eski_ogr))->>'token';
  jv := (public.giris(eski_veli))->>'token';

  if jo is null or jv is null then
    raise exception '0: hazırlık başarısız, oturum açılamadı';
  end if;
  raise notice '0 OK — dünya kuruldu, iki rol de içeride';

  -- ---------------------------------------------------------------------------
  -- 1. YENİ KOD ÇALIŞIYOR, ESKİ KOD ÖLÜYOR
  -- ---------------------------------------------------------------------------
  v := public.kod_yenile(jt, v_ogr, 'ogrenci');
  yeni_ogr := v->>'kod';

  if yeni_ogr is null or length(yeni_ogr) <> 8 then
    raise exception '1a: yeni kod üretilmedi (%)', coalesce(yeni_ogr, 'null');
  end if;
  if yeni_ogr = eski_ogr then
    raise exception '1b: kod değişmedi';
  end if;

  -- Pozitif kontrol: yeni kod gerçekten giriyor.
  if (public.giris(yeni_ogr))->>'token' is null then
    raise exception '1c: yeni kodla giriş yapılamadı';
  end if;

  -- ASIL ÖLÇÜM: eski kod artık reddedilmeli.
  --
  -- ÖLÇÜM ÖNCE YANLIŞ KURULMUŞTU, kayda geçiyor: istisna bekliyordum.
  -- `giris()` bilinmeyen kodda İSTİSNA ATMIYOR, `{"rol": "yok"}`
  -- döndürüyor — ve bu bilinçli: hata mesajı, kodun var olup olmadığını
  -- ele verirdi. Yani "hata fırlattı mı" diye bakan ölçüm, ürün doğru
  -- çalışırken de kırmızı yanıyordu. Doğru iddia: jeton VERİLMEMELİ.
  v := public.giris(eski_ogr);
  if v->>'token' is not null then
    raise exception '1d: ESKİ KOD HÂLÂ GİRİŞ VERİYOR — yenileme iptal etmiyor';
  end if;
  if v->>'rol' is distinct from 'yok' then
    raise exception '1e: eski kod tanınmaya devam ediyor (rol=%)', v->>'rol';
  end if;
  raise notice '1 OK — yeni kod giriyor, eski kod artık tanınmıyor';

  -- ---------------------------------------------------------------------------
  -- 2. ÖTEKİ ROLÜN KODU ETKİLENMİYOR
  --
  -- Süzgeçsiz bir `update giris_kodlari ... where ogrenci_id = p_id`
  -- iki satırı birden ezerdi ve bunu hiçbir hata haber vermezdi.
  -- ---------------------------------------------------------------------------
  if (select kod from public.giris_kodlari where ogrenci_id = v_ogr and rol = 'veli')
     is distinct from eski_veli then
    raise exception '2a: öğrenci kodu yenilenince VELİ kodu da değişti';
  end if;

  -- Ters yön de ölçülüyor: tek yönü ölçmek, öteki yönde aynı hatayı
  -- görmezdi.
  v := public.kod_yenile(jt, v_ogr, 'veli');
  yeni_veli := v->>'kod';

  if (select kod from public.giris_kodlari where ogrenci_id = v_ogr and rol = 'ogrenci')
     is distinct from yeni_ogr then
    raise exception '2b: veli kodu yenilenince ÖĞRENCİ kodu da değişti';
  end if;
  raise notice '2 OK — roller birbirinin kodunu ezmiyor (iki yön de)';

  -- ---------------------------------------------------------------------------
  -- 3. O ROLÜN AÇIK OTURUMU İPTAL EDİLDİ
  --
  -- TUZAK KESİN KURULUYOR. "Açık oturum kalmadı" iddiası, hiç açık
  -- oturum yokken de doğrudur — ölçüm boş kümede sessizce geçerdi.
  --
  -- ÖNCE "var mı" diye BAKIYORDUM, sonra oturumu burada AÇMAYA çevirdim
  -- ve sebebi ölçüldü: rol süzgeci kaldırılınca bu grup "açık oturum
  -- yok" diye erken patlıyor ve 4. GRUP HİÇ ÇALIŞMIYORDU. Yani 4. grup,
  -- yakaladığını sandığım kusuru hiç göremiyordu. Oturumu burada açınca
  -- 3. grup kendi işini ölçüyor, 4. grup da erişilebilir kalıyor.
  -- ---------------------------------------------------------------------------
  jo := (public.giris(yeni_ogr))->>'token';
  if jo is null then
    raise exception '3a: ölçüm kurulamadı — öğrenci yeni kodla giremedi';
  end if;

  v := public.kod_yenile(jt, v_ogr, 'ogrenci');
  yeni_ogr := v->>'kod';

  select count(*) into n
    from public.oturumlar
   where ogrenci_id = v_ogr and rol = 'ogrenci' and not iptal;
  if n <> 0 then
    raise exception '3b: öğrenci kodu yenilendi ama % açık oturum kaldı', n;
  end if;
  raise notice '3 OK — yenilenen rolün açık oturumu kapandı';

  -- ---------------------------------------------------------------------------
  -- 4. ÖTEKİ ROLÜN OTURUMU AYAKTA
  --
  -- BU DOSYANIN EN DEĞERLİ ÖLÇÜMÜ. `oturumlar.rol` süzgeci kaldırılırsa
  -- veli kodunu yenilemek öğrenciyi de sistemden atar; hiçbir hata
  -- çıkmaz, öğretmen bunu ancak öğrenci "atıldım" deyince öğrenir.
  --
  -- Burada da tuzak önce kuruluyor: veli taze bir oturum açıyor, SONRA
  -- ÖĞRENCİ kodu yenileniyor. Veli oturumu ayakta kalmalı.
  -- ---------------------------------------------------------------------------
  jv := (public.giris(yeni_veli))->>'token';   -- veli yeniden içeride
  if jv is null then
    raise exception '4a: hazırlık, veli yeni kodla giremedi';
  end if;

  select count(*) into n
    from public.oturumlar
   where ogrenci_id = v_ogr and rol = 'veli' and not iptal;
  if n < 1 then
    raise exception '4b: ölçüm kurulamadı — açık veli oturumu yok';
  end if;

  v := public.kod_yenile(jt, v_ogr, 'ogrenci');
  yeni_ogr := v->>'kod';

  select count(*) into n
    from public.oturumlar
   where ogrenci_id = v_ogr and rol = 'veli' and not iptal;
  if n < 1 then
    raise exception '4c: ÖĞRENCİ kodu yenilenince VELİ oturumu da kapandı';
  end if;
  raise notice '4 OK — öteki rolün oturumu ayakta (rol süzgeci çalışıyor)';

  -- ---------------------------------------------------------------------------
  -- 5. İZ KAYDI YAZILDI
  -- ---------------------------------------------------------------------------
  select count(*) into n
    from public.denetim_izi
   where islem = 'kod_yenilendi' and kayit_id = v_ogr;
  if n < 3 then
    raise exception '5: iz kaydı eksik (% adet, en az 3 bekleniyordu)', n;
  end if;

  select count(*) into n
    from public.denetim_izi
   where islem = 'kod_yenilendi' and kayit_id = v_ogr
     and tablo = 'giris_kodlari'
     and aktor is not null and aktor <> ''
     and yeni->>'rol' in ('ogrenci', 'veli');
  if n < 3 then
    raise exception '5b: iz kaydı alanları eksik (tablo/aktör/rol)';
  end if;
  raise notice '5 OK — iz kaydı işlemi, tabloyu, aktörü ve rolü taşıyor';

  -- ---------------------------------------------------------------------------
  -- 6. NEGATİF KONTROL — İZ KAYDINDA KOD GEÇMİYOR
  --
  -- Ölmüş şifrelerin kalıcı arşivi olmamalı. Kodu iz kaydına yazmak
  -- kolay ve cazip: "ne olduğunu görelim". Karşılığı, denetim izini
  -- okuyabilen herkesin geçmiş bütün kodları görmesi olurdu.
  -- ---------------------------------------------------------------------------
  select string_agg(coalesce(eski::text, '') || coalesce(yeni::text, ''), ' ')
    into iz_metni
    from public.denetim_izi
   where islem = 'kod_yenilendi' and kayit_id = v_ogr;

  if iz_metni like '%' || eski_ogr  || '%' then
    raise exception '6a: İZ KAYDINDA ESKİ ÖĞRENCİ KODU GEÇİYOR';
  end if;
  if iz_metni like '%' || eski_veli || '%' then
    raise exception '6b: İZ KAYDINDA ESKİ VELİ KODU GEÇİYOR';
  end if;
  if iz_metni like '%' || yeni_veli || '%' then
    raise exception '6c: İZ KAYDINDA YENİ KOD GEÇİYOR';
  end if;
  raise notice '6 OK — iz kaydında hiçbir kod değeri yok';

  -- ---------------------------------------------------------------------------
  -- 7. GEÇERSİZ ROL REDDEDİLİYOR (Türkçe mesajla)
  -- ---------------------------------------------------------------------------
  begin
    perform public.kod_yenile(jt, v_ogr, 'ogretmen');
    raise exception '7a: geçersiz rol kabul edildi';
  exception
    when others then
      if sqlerrm like '%7a:%' then raise; end if;
      if sqlerrm not like '%Rol yalnız%' then
        raise exception '7b: mesaj Türkçe ve anlaşılır değil: %', sqlerrm;
      end if;
  end;

  -- NULL ROL — VE BU ÖLÇÜM ÖNCE YANLIŞ KURULMUŞTU, kayda geçiyor.
  --
  -- Önce yalnız "istisna attı mı" diye bakıyordum. `is distinct from`
  -- yerine `<>` yazılan kusurlu sürümü denedim: BÜTÜN TESTLER GEÇTİ.
  -- Sebep şu — NULL'da bizim kontrolümüz sessizce atlanıyor, ama
  -- `giris_kodlari.rol` sütunundaki `not null` kısıtı araya girip hata
  -- veriyor. Yani ölçüm "biz reddettik" ile "veritabanı kurtardı"yı
  -- ayırt edemiyordu.
  --
  -- Artık MESAJ aranıyor: reddin bizim kapımızdan gelmesi gerekiyor.
  -- (Tablo kısıtı yine ikinci savunma hattı olarak duruyor; buradaki
  -- iddia onun yerine geçmiyor, önünde duruyor.)
  begin
    perform public.kod_yenile(jt, v_ogr, null);
    raise exception '7c: NULL rol kabul edildi';
  exception
    when others then
      if sqlerrm like '%7c:%' then raise; end if;
      if sqlerrm not like '%Rol yalnız%' then
        raise exception '7d: NULL rolü BİZ reddetmedik, hata başka yerden geldi: %', sqlerrm;
      end if;
  end;
  raise notice '7 OK — geçersiz ve NULL rol BİZİM kapımızdan reddedildi';

  -- ---------------------------------------------------------------------------
  -- 8. KAPSAM — BAŞKA ÖĞRETMENİN ÖĞRENCİSİ
  -- ---------------------------------------------------------------------------
  insert into public.ogretmenler (ad, yonetici, aktif)
  values ('Yenileme Meslektaşı', false, true)
  returning id into v_ogretmen2;

  update public.ogretmenler
     set pin_hash = extensions.crypt('Meslek!2026', extensions.gen_salt('bf', 10))
   where id = v_ogretmen2;
  jt2 := (public.giris('Meslek!2026'))->>'token';

  if jt2 is not null then
    begin
      perform public.kod_yenile(jt2, v_ogr, 'veli');
      raise exception '8: kapsam dışı öğretmen başkasının öğrencisinin kodunu yeniledi';
    exception
      when others then
        if sqlerrm like '%8:%' then raise; end if;
    end;
    raise notice '8 OK — kapsam dışı öğretmen reddedildi';
  else
    raise notice '8 ATLANDI — ikinci öğretmen oturumu açılamadı';
  end if;

  -- ---------------------------------------------------------------------------
  -- 9. ÖĞRENCİ VE VELİ JETONU ÇAĞIRAMIYOR
  -- ---------------------------------------------------------------------------
  jo := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_ogr and rol = 'ogrenci')))->>'token';
  begin
    perform public.kod_yenile(jo, v_ogr, 'veli');
    raise exception '9a: ÖĞRENCİ kendi velisinin kodunu yenileyebildi';
  exception
    when others then
      if sqlerrm like '%9a:%' then raise; end if;
  end;

  begin
    perform public.kod_yenile(jv, v_ogr, 'ogrenci');
    raise exception '9b: VELİ öğrencinin kodunu yenileyebildi';
  exception
    when others then
      if sqlerrm like '%9b:%' then raise; end if;
  end;
  raise notice '9 OK — öğrenci ve veli jetonu reddedildi';

  -- ---------------------------------------------------------------------------
  -- 10. KODU HİÇ OLMAYAN KAYITTA KOD ÜRETİLİYOR
  --
  -- Yenileme burada "ilk kez ver" işini de görüyor: öğretmenin gözünde
  -- ikisi de "bu kişinin kodu olsun" demek.
  -- ---------------------------------------------------------------------------
  v_ogr2 := (public.ogrenci_ekle(jt, 'Kodsuz Deneği', 'okul', v_sinif))->>'id';
  delete from public.giris_kodlari where ogrenci_id = v_ogr2 and rol = 'veli';

  v := public.kod_yenile(jt, v_ogr2, 'veli');
  if v->>'kod' is null then
    raise exception '10a: kodsuz kayıtta kod üretilmedi';
  end if;
  select count(*) into n
    from public.giris_kodlari where ogrenci_id = v_ogr2 and rol = 'veli';
  if n <> 1 then
    raise exception '10b: kodsuz kayıtta % satır oluştu, 1 bekleniyordu', n;
  end if;
  raise notice '10 OK — kodu olmayan kayıtta kod üretildi';

  -- ---------------------------------------------------------------------------
  -- Temizlik
  -- ---------------------------------------------------------------------------
  delete from public.ogrenciler where id in (v_ogr, v_ogr2);
  delete from public.ogretmenler where id = v_ogretmen2;
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. TEK İMZA VE ANON YETKİSİ
--
-- `pg_get_function_identity_arguments()` KULLANILMIYOR: parametre
-- ADLARINI da döndürüyor ve çıplak tip listesiyle karşılaştırmak ASLA
-- tutmayan bir iddia kurardı (0042'de ölü bulunmuştu).
-- -----------------------------------------------------------------------------
do $$
declare
  n integer;
  t text;
begin
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'kod_yenile';
  if n <> 1 then
    raise exception '11a: kod_yenile % imzaya sahip, 1 olmalı', n;
  end if;

  select pg_catalog.oidvectortypes(p.proargtypes) into t
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'kod_yenile';
  if t <> 'text, uuid, text' then
    raise exception '11b: imza beklenenden farklı: %', t;
  end if;

  if not has_function_privilege('anon', 'public.kod_yenile(text, uuid, text)', 'execute') then
    raise exception '11c: kod_yenile anon tarafından çağrılamıyor — arayüz erişemez';
  end if;
  raise notice '11 OK — tek imza, doğru tipler, anon çağırabiliyor';
end;
$$;

select 'KOD YENİLEME TESTLERİ: 11 GRUP GEÇTİ' as sonuc;
