-- =============================================================================
-- SEKİZ — PIN DEĞİŞTİRME TESTLERİ
--
-- `pin_degistir` 0003'te yazıldı, 0005'te yetkisi verildi ve arayüzde HİÇ
-- ÇAĞRILMADI. Arayüze bağlanırken davranışı ilk kez ölçülüyor.
--
-- Üç asıl soru:
--   1. Yanlış eski PIN'le değişebiliyor mu? (değişebiliyorsa jetonu ele
--      geçiren biri PIN'i de ele geçirir)
--   2. Değişimden sonra ESKİ PIN hâlâ çalışıyor mu?
--   3. Diğer cihazlardaki oturumlar gerçekten düşüyor mu — ve öğretmenin
--      KENDİ oturumu ayakta kalıyor mu? (düşerse ekran kendini kilitler)
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text; jt2 text; jo text; jv text;
  v_s uuid; v_a uuid;
  n integer; s text;
begin
  -- Kurulum: bilinen bir PIN ve bir öğrenci/veli
  update public.ayarlar
     set ogretmen_pin_hash = extensions.crypt('PinEski!2026', extensions.gen_salt('bf', 10))
   where id = 1;

  insert into public.siniflar (seviye, sube) values (6, 'N')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_s;
  jt := (public.giris('PinEski!2026'))->>'token';
  v_a := (public.ogrenci_ekle(jt, 'Nur Pinli', 'okul', v_s))->>'id';
  jo := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_a and rol = 'ogrenci')))->>'token';
  jv := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_a and rol = 'veli')))->>'token';

  -- ---------------------------------------------------------------------------
  -- 1 — YANLIŞ ESKİ PIN reddediliyor VE PIN değişmiyor
  --
  -- Reddedilmesi yetmez; reddederken PIN'i değiştirmediği de ölçülmeli.
  -- ---------------------------------------------------------------------------
  begin
    perform public.pin_degistir(jt, 'YanlisPin!', 'YeniPin!2026');
    raise exception '1a: yanlış eski PIN kabul edildi';
  exception when sqlstate '28000' then null;
  end;

  if (public.giris('PinEski!2026'))->>'rol' <> 'ogretmen' then
    raise exception '1b: başarısız denemeden sonra eski PIN bozuldu';
  end if;

  raise notice '1 OK — yanlış eski PIN reddediliyor, PIN bozulmuyor';

  -- ---------------------------------------------------------------------------
  -- 2 — KISA YENİ PIN reddediliyor (sunucu sınırı, arayüze güvenilmiyor)
  -- ---------------------------------------------------------------------------
  begin
    perform public.pin_degistir(jt, 'PinEski!2026', 'kisa1');  -- 5 karakter
    raise exception '2a: 5 karakterlik PIN kabul edildi';
  exception when sqlstate '22023' then null;
  end;

  -- Tam sınır: 6 karakter GEÇMELİ. Sınır hataları sessizdir.
  perform public.pin_degistir(jt, 'PinEski!2026', 'alti66');
  if (public.giris('alti66'))->>'rol' <> 'ogretmen' then
    raise exception '2b: 6 karakterlik PIN reddedildi, oysa sınır 6';
  end if;
  -- Geri al
  perform public.pin_degistir(jt, 'alti66', 'PinEski!2026');

  raise notice '2 OK — 5 karakter reddediliyor, 6 karakter kabul ediliyor';

  -- ---------------------------------------------------------------------------
  -- 3 — DEĞİŞİM SONRASI: yeni PIN çalışıyor, ESKİ ÇALIŞMIYOR
  --
  -- Asıl güvenlik sorusu bu: PIN'i sızdığı için değiştiren öğretmenin eski
  -- PIN'i hâlâ çalışıyorsa değiştirmenin hiçbir anlamı kalmaz.
  -- ---------------------------------------------------------------------------
  -- İkinci bir cihaz açıyoruz (aynı PIN, ayrı oturum)
  jt2 := (public.giris('PinEski!2026'))->>'token';
  if jt2 is null then raise exception '3a: ikinci oturum açılamadı'; end if;

  perform public.pin_degistir(jt, 'PinEski!2026', 'PinYeni!2026');

  if (public.giris('PinEski!2026'))->>'rol' <> 'yok' then
    raise exception '3b: ESKİ PIN hâlâ çalışıyor';
  end if;
  if (public.giris('PinYeni!2026'))->>'rol' <> 'ogretmen' then
    raise exception '3c: yeni PIN çalışmıyor';
  end if;

  raise notice '3 OK — yeni PIN çalışıyor, eski PIN artık geçmiyor';

  -- ---------------------------------------------------------------------------
  -- 4 — OTURUMLAR: diğer cihazlar düşüyor, MEVCUT oturum ayakta kalıyor
  --
  -- İkisi birden önemli. Mevcut oturum da düşseydi öğretmen PIN'ini
  -- değiştirir değiştirmez ekrandan atılır, "değişti mi?" diye bilemezdi.
  -- ---------------------------------------------------------------------------
  begin
    perform public.ogretmen_panosu(jt2);
    raise exception '4a: DİĞER cihazın oturumu düşmedi';
  exception when sqlstate '28000' then null;
  end;

  perform public.ogretmen_panosu(jt);  -- düşerse burada patlar
  raise notice '4 OK — diğer cihaz düştü, PIN''i değiştiren oturum ayakta';

  -- ---------------------------------------------------------------------------
  -- 5 — ÖĞRENCİ VE VELİ OTURUMLARI ETKİLENMİYOR
  --
  -- `pin_degistir` yalnız `rol = 'ogretmen'` oturumlarını iptal ediyor.
  -- Hepsini düşürseydi öğretmen PIN'ini değiştirdiğinde bütün sınıf
  -- ödevin ortasında dışarı atılırdı.
  -- ---------------------------------------------------------------------------
  perform public.ogrenci_odevleri(jo);
  perform public.veli_paneli(jv);
  raise notice '5 OK — öğrenci ve veli oturumları etkilenmiyor';

  -- ---------------------------------------------------------------------------
  -- 6 — DENETİM İZİ (Part XLIII)
  -- ---------------------------------------------------------------------------
  select count(*) into n from public.denetim_izi where islem = 'pin_degistirildi';
  if n < 1 then raise exception '6a: PIN değişimi denetim izine yazılmadı'; end if;
  raise notice '6 OK — değişim denetim izine yazılıyor';

  -- ---------------------------------------------------------------------------
  -- 7 — ÖĞRENCİ VE VELİ pin_degistir'i ÇAĞIRAMAZ
  -- ---------------------------------------------------------------------------
  begin
    perform public.pin_degistir(jo, 'PinYeni!2026', 'HackPin!2026');
    raise exception '7a: ÖĞRENCİ PIN değiştirebildi';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.pin_degistir(jv, 'PinYeni!2026', 'HackPin!2026');
    raise exception '7b: VELİ PIN değiştirebildi';
  exception when sqlstate '42501' then null;
  end;

  -- Öğrencinin denemesi PIN'i bozmuş olmamalı
  if (public.giris('PinYeni!2026'))->>'rol' <> 'ogretmen' then
    raise exception '7c: başarısız denemeler PIN''i bozdu';
  end if;

  raise notice '7 OK — öğrenci ve veli PIN değiştiremiyor';

  -- ---------------------------------------------------------------------------
  -- 8 — PIN DÜZ METİN OLARAK HİÇBİR YERDE DURMUYOR
  -- ---------------------------------------------------------------------------
  select ogretmen_pin_hash into s from public.ayarlar where id = 1;
  if s like '%PinYeni!2026%' then
    raise exception '8a: PIN düz metin saklanıyor';
  end if;
  if s not like '$2%' then
    raise exception '8b: PIN bcrypt ile saklanmıyor: %', left(s, 4);
  end if;
  -- Denetim izinde de geçmemeli
  select count(*) into n from public.denetim_izi
   where coalesce(eski::text, '') || coalesce(yeni::text, '') like '%PinYeni!2026%';
  if n > 0 then raise exception '8c: PIN denetim izine yazılmış'; end if;

  raise notice '8 OK — PIN bcrypt ile saklanıyor, hiçbir yerde düz metin yok';

  raise notice '';
  raise notice 'PIN DEĞİŞTİRME TESTLERİ: 8 GRUP GEÇTİ';
end $$;
