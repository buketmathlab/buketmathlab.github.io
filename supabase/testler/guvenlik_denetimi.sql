-- =============================================================================
-- SEKİZ — FAZ 11 GÜVENLİK DENETİMİ
--
-- `docs/guvenlik-testleri.md`'deki matris Faz 1'de yazıldı ve o gün 19 uç
-- vardı. Bugün anon'a açık 48 uç var; aradaki ~30 uç (0007–0026) o
-- matristen hiç geçmedi. Bu dosya o boşluğu kapatıyor.
--
-- BU DOSYANIN FARKI: ELLE LİSTE YOK.
--
-- Rol denetimi `pg_proc` gezilerek yapılıyor. Yarın yeni bir öğretmen ucu
-- eklenirse hiçbir şey yazmadan bu testin kapsamına giriyor — elle sayılan
-- bir liste ise sessizce eksik kalırdı. Aynı hatayı `eslint.config.js`'te
-- iki kez yaptım; burada baştan kalıp kuruluyor.
--
-- GRUPLAR
--   1. Her öğretmen ucu, öğrenci ve veli jetonuyla reddediliyor mu
--   2. Kimlik alan üç ucun çapraz erişim denemesi
--   3. Saldırgan girdisi: XSS yükleri, aşırı uzunluk, unicode
--   4. Kurulum kapısı, kilitleme ve oturum ömrü
-- =============================================================================
\set ON_ERROR_STOP on

-- =============================================================================
-- 1. SİSTEMATİK ROL DENETİMİ
-- =============================================================================
do $$
declare
  jt text; jo text; jv text;
  v_sinif uuid; v_a uuid;
  r record;
  cagri text;
  v_kod text;
  tipler text[];
  sapan text[] := '{}';
  sayac integer := 0;
  jeton text;
begin
  update public.ayarlar
     set ogretmen_pin_hash = extensions.crypt('Denetim!2026', extensions.gen_salt('bf', 10))
   where id = 1;
  jt := (public.giris('Denetim!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (11, 'D')
    on conflict (seviye, sube) do update set arsiv = false
    returning id into v_sinif;

  v_a := (public.ogrenci_ekle(jt, 'Denetim Öğrencisi', 'okul', v_sinif))->>'id';
  jo := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_a and rol = 'ogrenci')))->>'token';
  jv := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_a and rol = 'veli')))->>'token';

  -- ---------------------------------------------------------------------------
  -- Her öğretmen ucu, iki rolle de çağrılıyor.
  --
  -- Çağrı POZİSYONEL kuruluyor: ilk parametre jeton, kalan her parametre
  -- kendi tipinde NULL. Rol şartı gövdenin BAŞINDA olduğu için argümanların
  -- geçerli olması gerekmiyor; zaten testin ölçtüğü şey tam olarak bu —
  -- denetim argüman doğrulamasından ÖNCE mi çalışıyor.
  --
  -- 42501 dışında bir sqlstate dönen uç da rapor ediliyor: reddediliyor ama
  -- yanlış sebeple reddediliyor demektir ve incelenmeli.
  -- ---------------------------------------------------------------------------
  foreach jeton in array array[jo, jv] loop
    for r in
      -- BEYAZ LİSTE — GÖVDE METNİNE GÖRE SEÇMİYORUZ.
      --
      -- İlk sürüm uçları "gövdesinde `_ogretmen(` geçiyor mu" diye
      -- seçiyordu ve bunun KÖR NOKTASI geri alma kanıtında ortaya çıktı:
      -- bir ucun rol şartını silince o uç testin KAPSAMINDAN DA ÇIKIYOR,
      -- yani denetim tam da korumak istediği durumda susuyordu.
      --
      -- Mantık tersine çevrildi: anon'a açık HER uç, aşağıdaki listede
      -- değilse öğrenci/veli jetonunu reddetmek ZORUNDA. Liste öğrenci ve
      -- velinin meşru olarak kullandığı uçlar; yeni bir uç eklendiğinde
      -- varsayılan "reddetmeli" oluyor ve listeyi genişletmek bilinçli bir
      -- karar gerektiriyor.
      select p.proname, p.proargtypes::oid[] as argtipleri
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and has_function_privilege('anon', p.oid, 'execute')
         and p.proname not in (
               -- öğrenci/velinin kendi uçları
               'dosya_erisim_izni', 'kendi_karnem', 'mesaj_gonder',
               'odev_gonder', 'ogrenci_mesajlari', 'ogrenci_odevleri',
               'okundu_isaretle', 'veli_paneli',
               -- rol şartı taşımayan üçlü (1c ayrıca sayıyor)
               'giris', 'cikis', 'pin_ayarla'
             )
       order by p.proname
    loop
      select array_agg('null::' || format_type(t, null) order by i)
        into tipler
        from unnest(r.argtipleri) with ordinality u(t, i)
       where i > 1;

      cagri := format(
        'select public.%I(%s)',
        r.proname,
        array_to_string(array[quote_literal(jeton) || '::text'] || coalesce(tipler, '{}'), ', ')
      );

      sayac := sayac + 1;
      begin
        execute cagri;
        -- Hata VERMEDİ: öğretmen ucu öğrenci/veli jetonunu kabul etti.
        sapan := sapan || (r.proname || ' → HATA VERMEDİ');
      exception when others then
        get stacked diagnostics v_kod = returned_sqlstate;
        if v_kod <> '42501' then
          sapan := sapan || (r.proname || ' → ' || v_kod);
        end if;
      end;
    end loop;
  end loop;

  if array_length(sapan, 1) is not null then
    raise exception '1a BAŞARISIZ — % uçta sapma: %',
      array_length(sapan, 1), array_to_string(sapan, ' | ');
  end if;

  if sayac < 60 then
    raise exception '1a şüpheli: yalnız % çağrı yapıldı, uç sayısı beklenenden az', sayac;
  end if;
  raise notice '1a OK — % çağrı (beyaz liste dışı her uç × 2 rol), hepsi 42501', sayac;

  -- ---------------------------------------------------------------------------
  -- 1b — GEÇERSİZ JETON. Uydurma bir jetonla hiçbir uç açılmamalı.
  -- ---------------------------------------------------------------------------
  sayac := 0;
  sapan := '{}';
  for r in
    with hedef as materialized (
      select p.oid, p.proname, p.proargtypes::oid[] as argtipleri
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and has_function_privilege('anon', p.oid, 'execute')
    )
    select h.proname, h.argtipleri
      from hedef h
     where pg_get_functiondef(h.oid) ~ '_ogretmen\(|_oturum\('
     order by h.proname
  loop
    select array_agg('null::' || format_type(t, null) order by i)
      into tipler
      from unnest(r.argtipleri) with ordinality u(t, i)
     where i > 1;

    cagri := format('select public.%I(%s)', r.proname,
      array_to_string(array[quote_literal(repeat('z', 64)) || '::text'] || coalesce(tipler, '{}'), ', '));

    sayac := sayac + 1;
    begin
      execute cagri;
      sapan := sapan || (r.proname || ' → HATA VERMEDİ');
    exception when others then
      get stacked diagnostics v_kod = returned_sqlstate;
      -- 28000 = oturum geçersiz, 42501 = yetki. İkisi de kabul.
      if v_kod not in ('28000', '42501') then
        sapan := sapan || (r.proname || ' → ' || v_kod);
      end if;
    end;
  end loop;

  if array_length(sapan, 1) is not null then
    raise exception '1b BAŞARISIZ — uydurma jetonla sapma: %', array_to_string(sapan, ' | ');
  end if;
  raise notice '1b OK — % uç uydurma jetonu reddetti', sayac;

  -- ---------------------------------------------------------------------------
  -- 1c — ŞARTSIZ UÇLAR SAYILIYOR.
  --
  -- Bugün yalnız üç uç rol şartı taşımıyor ve üçünün de sebebi var:
  -- `giris` (henüz kimlik yok), `cikis` (kendi jetonunu iptal ediyor),
  -- `pin_ayarla` (ilk kurulum, hash doluyken kendini kapatıyor).
  --
  -- Dördüncüsü çıkarsa bu test kırılır. Yeni bir uç yanlışlıkla şartsız
  -- bırakılırsa sessiz kalmasın.
  -- ---------------------------------------------------------------------------
  with hedef as materialized (
    select p.oid
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and has_function_privilege('anon', p.oid, 'execute')
  )
  select count(*) into sayac
    from hedef h
   where pg_get_functiondef(h.oid) !~ '_ogretmen\(|_oturum\(';

  if sayac <> 3 then
    raise exception '1c BAŞARISIZ — rol şartı taşımayan uç sayısı 3 değil, %. Yeni bir uç şartsız kalmış olabilir.', sayac;
  end if;

  perform 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'giris'
     and has_function_privilege('anon', p.oid, 'execute');
  if not found then
    raise exception '1c: giris anon''a kapalı — kimse giriş yapamaz';
  end if;
  raise notice '1c OK — rol şartsız yalnız 3 uç (giris, cikis, pin_ayarla)';
end $$;

-- =============================================================================
-- 2. ÇAPRAZ ERİŞİM — KİMLİK ALAN ÜÇ UÇ
--
-- Öğrenci ve velinin ulaşabildiği 8 uçtan yalnız üçü kimlik alıyor:
--   dosya_erisim_izni(p_yol) · mesaj_gonder(p_ogrenci_id) · odev_gonder(p_odev, p_foto_yolu)
-- Kalan beşi hiç kimlik almıyor — başkasının verisini istemek YAPI GEREĞİ
-- imkânsız, denenecek bir şey yok.
--
-- HER OLUMSUZ ÖLÇÜM BİR OLUMLUYLA EŞLEŞTİRİLİYOR. "A, B'nin dosyasına
-- erişemiyor" tek başına hiçbir şey kanıtlamaz: fonksiyon her zaman false
-- dönüyor olabilir. Bu yüzden aynı yol B'nin kendi jetonuyla (ve
-- öğretmenle) DENENİYOR ve orada true çıkıyor.
-- =============================================================================
do $$
declare
  jt text; jA text; jvA text; jB text;
  s1 uuid; s2 uuid;
  a uuid; b uuid;
  odevA uuid; odevB uuid;
  yolB text; anahtarB text; soruB text;
  n_once integer; n_sonra integer;
  ok boolean;
  v_kod text;
begin
  update public.ayarlar
     set ogretmen_pin_hash = extensions.crypt('Capraz!2026', extensions.gen_salt('bf', 10))
   where id = 1;
  jt := (public.giris('Capraz!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (11, 'X')
    on conflict (seviye, sube) do update set arsiv = false returning id into s1;
  insert into public.siniflar (seviye, sube) values (11, 'Y')
    on conflict (seviye, sube) do update set arsiv = false returning id into s2;

  -- Tekrar çalıştırılabilirlik: bu iki sınıfın izlerini sil.
  delete from public.gonderimler
   where odev_id in (select id from public.odevler where sinif_id in (s1, s2));
  delete from public.odevler where sinif_id in (s1, s2);
  delete from public.mesajlar
   where ogrenci_id in (select id from public.ogrenciler where sinif_id in (s1, s2));

  a := (public.ogrenci_ekle(jt, 'Ayla Çapraz', 'okul', s1))->>'id';
  b := (public.ogrenci_ekle(jt, 'Berk Çapraz', 'okul', s2))->>'id';

  jA  := (public.giris((select kod from public.giris_kodlari where ogrenci_id = a and rol = 'ogrenci')))->>'token';
  jvA := (public.giris((select kod from public.giris_kodlari where ogrenci_id = a and rol = 'veli')))->>'token';
  jB  := (public.giris((select kod from public.giris_kodlari where ogrenci_id = b and rol = 'ogrenci')))->>'token';

  -- B'nin sınıfına ödev: soru PDF'i ve cevap anahtarı yolu ile
  odevB := (public.odev_olustur(jt, 'Berk Sınıfı Ödevi', null, s2, 'test',
              (current_date + 7), 2, '{"1":"A","2":"B"}'::jsonb,
              'anahtar/berk.pdf', 'odev/berk.pdf', true, 4::smallint, null))->>'id';
  perform public.odev_yayinla(jt, odevB);

  odevA := (public.odev_olustur(jt, 'Ayla Sınıfı Ödevi', null, s1, 'test',
              (current_date + 7), 2, '{"1":"C","2":"D"}'::jsonb,
              'anahtar/ayla.pdf', 'odev/ayla.pdf', true, 4::smallint, null))->>'id';
  perform public.odev_yayinla(jt, odevA);

  soruB    := 'odev/berk.pdf';
  anahtarB := 'anahtar/berk.pdf';
  yolB     := 'cozum/' || odevB || '/' || b || '.jpg';

  -- B kendi ödevini gönderiyor → foto_yolu oluşuyor
  perform public.odev_gonder(jB, odevB, yolB, '{"1":"A","2":"B"}'::jsonb);

  -- ---------------------------------------------------------------------------
  -- 2a — A, B'nin ÇÖZÜM FOTOĞRAFINA erişemiyor. B ve öğretmen erişebiliyor.
  -- ---------------------------------------------------------------------------
  if public.dosya_erisim_izni(jA, yolB) then
    raise exception '2a BAŞARISIZ — A, B''nin çözüm fotoğrafına erişebiliyor';
  end if;
  if public.dosya_erisim_izni(jvA, yolB) then
    raise exception '2a BAŞARISIZ — A''nın velisi B''nin fotoğrafına erişebiliyor';
  end if;
  -- Denetimin işe yaradığının kanıtı:
  if not public.dosya_erisim_izni(jB, yolB) then
    raise exception '2a ÖLÇÜM BOZUK — B kendi fotoğrafına da erişemiyor';
  end if;
  if not public.dosya_erisim_izni(jt, yolB) then
    raise exception '2a ÖLÇÜM BOZUK — öğretmen fotoğrafa erişemiyor';
  end if;
  raise notice '2a OK — çözüm fotoğrafı yalnız sahibine ve öğretmene açık';

  -- ---------------------------------------------------------------------------
  -- 2b — A, B'nin sınıfındaki ödevin SORU PDF'ine ve CEVAP ANAHTARINA
  --      erişemiyor. Anahtar B'ye teslimden sonra açılıyor (Kural 6).
  -- ---------------------------------------------------------------------------
  if public.dosya_erisim_izni(jA, soruB) then
    raise exception '2b BAŞARISIZ — A, başka sınıfın soru PDF''ine erişebiliyor';
  end if;
  if public.dosya_erisim_izni(jA, anahtarB) then
    raise exception '2b BAŞARISIZ — A, başka sınıfın cevap anahtarına erişebiliyor';
  end if;
  if not public.dosya_erisim_izni(jB, soruB) then
    raise exception '2b ÖLÇÜM BOZUK — B kendi sınıfının soru PDF''ini göremiyor';
  end if;
  if not public.dosya_erisim_izni(jB, anahtarB) then
    raise exception '2b ÖLÇÜM BOZUK — teslim eden B anahtarı göremiyor';
  end if;
  raise notice '2b OK — soru PDF''i ve anahtar sınıf ve teslim şartına bağlı';

  -- ---------------------------------------------------------------------------
  -- 2c — A, B'NİN YOLUNA YÜKLEYEMİYOR. `_cozum_yolu_gecerli` yoldaki
  --      kimliği jetondakiyle karşılaştırıyor.
  -- ---------------------------------------------------------------------------
  if public.dosya_erisim_izni(jA, 'cozum/' || odevA || '/' || b || '.jpg') then
    raise exception '2c BAŞARISIZ — A, kendi ödevine B''nin kimliğiyle yükleyebiliyor';
  end if;
  if not public.dosya_erisim_izni(jA, 'cozum/' || odevA || '/' || a || '.jpg') then
    raise exception '2c ÖLÇÜM BOZUK — A kendi yoluna yükleyemiyor';
  end if;
  raise notice '2c OK — yükleme yolundaki kimlik jetonla karşılaştırılıyor';

  -- ---------------------------------------------------------------------------
  -- 2d — A, BAŞKA SINIFIN ÖDEVİNE GÖNDERİM YAPAMIYOR.
  --      Red yetmiyor: tabloya satır yazılmadığı da sayılıyor.
  -- ---------------------------------------------------------------------------
  select count(*) into n_once from public.gonderimler where odev_id = odevB;
  begin
    perform public.odev_gonder(jA, odevB, 'cozum/' || odevB || '/' || a || '.jpg',
                               '{"1":"A","2":"B"}'::jsonb);
    raise exception '2d BAŞARISIZ — A başka sınıfın ödevine gönderim yapabildi';
  exception when others then
    get stacked diagnostics v_kod = returned_sqlstate;
    if v_kod = 'P0001' and sqlerrm like '%2d BAŞARISIZ%' then raise; end if;
  end;
  select count(*) into n_sonra from public.gonderimler where odev_id = odevB;
  if n_sonra <> n_once then
    raise exception '2d BAŞARISIZ — gönderim reddedildi ama satır yazıldı (% → %)', n_once, n_sonra;
  end if;
  raise notice '2d OK — başka sınıfın ödevine gönderim reddedildi, satır yazılmadı';

  -- ---------------------------------------------------------------------------
  -- 2e — MESAJ: A, `p_ogrenci_id = B` verse bile mesaj B'YE GİTMİYOR.
  --      Parametre yok sayılıyor; mesaj A'nın kendi öğrenci kanalına düşüyor.
  -- ---------------------------------------------------------------------------
  perform public.mesaj_gonder(jA, 'Ayla capraz denemesi', b, 'veli');

  if exists (select 1 from public.mesajlar
              where ogrenci_id = b and metin = 'Ayla capraz denemesi') then
    raise exception '2e BAŞARISIZ — A''nın mesajı B''nin yazışmasına düştü';
  end if;
  if not exists (select 1 from public.mesajlar
                  where ogrenci_id = a and kanal = 'ogrenci' and kimden = 'ogrenci'
                    and metin = 'Ayla capraz denemesi') then
    raise exception '2e BAŞARISIZ — mesaj A''nın öğrenci kanalına da yazılmadı';
  end if;

  -- Veli de aynı: `p_kanal='ogrenci'` istese bile veli kanalına yazıyor.
  perform public.mesaj_gonder(jvA, 'Veli capraz denemesi', b, 'ogrenci');
  if exists (select 1 from public.mesajlar
              where ogrenci_id = b and metin = 'Veli capraz denemesi') then
    raise exception '2e BAŞARISIZ — velinin mesajı başka öğrenciye düştü';
  end if;
  if not exists (select 1 from public.mesajlar
                  where ogrenci_id = a and kanal = 'veli' and kimden = 'veli'
                    and metin = 'Veli capraz denemesi') then
    raise exception '2e BAŞARISIZ — veli mesajı kendi kanalına yazılmadı';
  end if;
  raise notice '2e OK — p_ogrenci_id ve p_kanal öğrenci/veli için yok sayılıyor';

  -- ---------------------------------------------------------------------------
  -- 2f — A'NIN KARNESİNDE B YOK. Kimlik almayan uçların yapısal güvencesi
  --      burada bir kez ölçülüyor: B'nin adı A'ya giden hiçbir yanıtta
  --      geçmemeli.
  -- ---------------------------------------------------------------------------
  if (public.kendi_karnem(jA))::text like '%Berk Çapraz%' then
    raise exception '2f BAŞARISIZ — A''nın karnesinde B''nin adı geçiyor';
  end if;
  if (public.ogrenci_odevleri(jA))::text like '%Berk Çapraz%' then
    raise exception '2f BAŞARISIZ — A''nın ödev listesinde B''nin adı geçiyor';
  end if;
  if (public.veli_paneli(jvA))::text like '%Berk Çapraz%' then
    raise exception '2f BAŞARISIZ — A''nın velisinin panelinde B''nin adı geçiyor';
  end if;
  -- Kanıt: öğretmenin ucunda B'nin adı BULUNUYOR.
  if (public.ogrenciler_listesi(jt, 'Berk', null, 1, 50))::text not like '%Berk Çapraz%' then
    raise exception '2f ÖLÇÜM BOZUK — öğretmen de B''yi göremiyor, arama yanlış';
  end if;
  raise notice '2f OK — kimlik almayan uçlar başka öğrenciyi hiç taşımıyor';
end $$;

-- =============================================================================
-- 3. SALDIRGAN GİRDİSİ — SUNUCU TARAFI
--
-- Kalan risk #3'ün yarısı. Belgede şöyle yazıyordu: "React kaçış uyguluyor,
-- dangerouslySetInnerHTML yok" — doğru ama TASARIM İDDİASI. Bu grup sunucu
-- tarafını ölçüyor; tarayıcı tarafı `guvenlik-denetimi.mjs`'te.
--
-- BEKLENEN DAVRANIŞ: metin OLDUĞU GİBİ saklanıyor.
--
-- Sunucuda kaçış yapmak YANLIŞ olurdu: öğretmen "&lt;3" yazan bir mesaj
-- okurdu. Kaçış çizim anının işi. Sunucunun işi metni bozmamak ve uzunluk
-- sınırını uygulamak.
-- =============================================================================
do $$
declare
  jt text; jo text; jv text;
  s uuid; a uuid;
  yuk text;
  geri text;
  yukler text[] := array[
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>',
    'javascript:alert(document.cookie)',
    '"><script>alert(String.fromCharCode(88))</script>',
    '''; drop table public.ogrenciler; --',
    '{{7*7}}${7*7}<%= 7*7 %>',
    E'sag‮sola yon isareti',
    '😀🧮 emoji ve ünicode ĞÜŞİÖÇ'
  ];
  v_kod text;
  v_mesaj text;
  n integer;
begin
  update public.ayarlar
     set ogretmen_pin_hash = extensions.crypt('Yuk!2026', extensions.gen_salt('bf', 10))
   where id = 1;
  jt := (public.giris('Yuk!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (11, 'Z')
    on conflict (seviye, sube) do update set arsiv = false returning id into s;
  delete from public.mesajlar
   where ogrenci_id in (select id from public.ogrenciler where sinif_id = s);

  a := (public.ogrenci_ekle(jt, 'Yük Denemesi', 'okul', s))->>'id';
  jo := (public.giris((select kod from public.giris_kodlari where ogrenci_id = a and rol = 'ogrenci')))->>'token';
  jv := (public.giris((select kod from public.giris_kodlari where ogrenci_id = a and rol = 'veli')))->>'token';

  -- ---------------------------------------------------------------------------
  -- 3a — HER YÜK OLDUĞU GİBİ SAKLANIYOR VE GERİ GELİYOR.
  -- ---------------------------------------------------------------------------
  foreach yuk in array yukler loop
    perform public.mesaj_gonder(jo, yuk, null, 'ogrenci');

    -- ZAMANA GÖRE SIRALAMIYORUZ — ve bunun sebebi ölçülerek bulundu.
    -- İlk sürüm `order by created_at desc limit 1` diyordu ve test
    -- kırıldı: `now()` PostgreSQL'de İŞLEM başlangıç zamanıdır, yani bu
    -- blokta yazılan bütün mesajların created_at'i aynı ve sıralama
    -- rastgele bir satır döndürüyordu. Aynı tuzağa 0022'de de düşmüştüm.
    -- Doğru ölçüm zaten doğrudan: metin AYNEN saklandı mı.
    select metin into geri from public.mesajlar
     where ogrenci_id = a and kanal = 'ogrenci' and metin = yuk
     limit 1;

    if geri is distinct from yuk then
      raise exception '3a BAŞARISIZ — metin aynen saklanmadı. Giden: [%] Bulunan: [%]', yuk, coalesce(geri, '(yok)');
    end if;

    -- Uçtan okurken de bozulmamalı (jsonb kaçışı çözüldüğünde birebir aynı).
    if not exists (
      select 1 from jsonb_array_elements(public.ogrenci_mesajlari(jo)->'mesajlar') m
       where m->>'metin' = yuk
    ) then
      raise exception '3a BAŞARISIZ — yük uçtan geri gelmiyor: [%]', yuk;
    end if;
  end loop;
  raise notice '3a OK — % yükün hepsi birebir saklandı ve uçtan aynen döndü', array_length(yukler, 1);

  -- ---------------------------------------------------------------------------
  -- 3b — SQL ENJEKSİYONU İŞLEMEDİ. Yukarıdaki `drop table` yükü gönderildi;
  --      tablo hâlâ yerinde ve öğrenci hâlâ orada.
  -- ---------------------------------------------------------------------------
  if to_regclass('public.ogrenciler') is null then
    raise exception '3b BAŞARISIZ — ogrenciler tablosu düşürülmüş';
  end if;
  select count(*) into n from public.ogrenciler where id = a;
  if n <> 1 then
    raise exception '3b BAŞARISIZ — öğrenci kaydı kayboldu';
  end if;
  raise notice '3b OK — enjeksiyon yükü veri olarak saklandı, komut olarak çalışmadı';

  -- ---------------------------------------------------------------------------
  -- 3c — UZUNLUK SINIRI. 4000 kabul, 4001 red.
  --      Sınır olmazsa bir öğrenci veritabanını megabaytlarla doldurabilir.
  -- ---------------------------------------------------------------------------
  perform public.mesaj_gonder(jo, repeat('a', 4000), null, 'ogrenci');
  begin
    perform public.mesaj_gonder(jo, repeat('a', 4001), null, 'ogrenci');
    raise exception '3c BAŞARISIZ — 4001 karakterlik mesaj kabul edildi';
  exception when others then
    get stacked diagnostics v_kod = returned_sqlstate;
    if v_kod = 'P0001' and sqlerrm like '%3c BAŞARISIZ%' then raise; end if;
  end;
  raise notice '3c OK — 4000 kabul, 4001 reddedildi';

  -- ---------------------------------------------------------------------------
  -- 3d — BOŞ VE YALNIZ BOŞLUKTAN OLUŞAN MESAJ REDDEDİLİYOR.
  -- ---------------------------------------------------------------------------
  -- SQLSTATE'İ DE ÖLÇÜYORUZ, "herhangi bir hata"yı değil.
  --
  -- İlk sürüm yalnız "hata verdi mi" diye bakıyordu ve bu KÖRDÜ: uç
  -- denetimi geri alındığında şema kısıtı devreye girip 23514 fırlatıyor,
  -- test yine geçiyordu. Oysa ikisi aynı şey değil — 22023 öğrenciye
  -- "Mesaj boş olamaz." diye Türkçe dönüyor, 23514 ham kısıt ihlali.
  -- Öğrencinin gördüğü şey birincisi.
  foreach yuk in array array['', '   ', E'\t\n  '] loop
    begin
      perform public.mesaj_gonder(jo, yuk, null, 'ogrenci');
      raise exception '3d BAŞARISIZ — boş mesaj kabul edildi: [%]', yuk;
    exception when others then
      get stacked diagnostics v_kod = returned_sqlstate, v_mesaj = message_text;
      if v_kod = 'P0001' and sqlerrm like '%3d BAŞARISIZ%' then raise; end if;
      if v_kod <> '22023' or v_mesaj <> 'Mesaj boş olamaz.' then
        raise exception '3d BAŞARISIZ — uç denetimi devrede değil. Beklenen 22023/"Mesaj boş olamaz.", gelen %/"%"', v_kod, v_mesaj;
      end if;
    end;
  end loop;
  raise notice '3d OK — uç denetimi boş mesajı 22023 ve Türkçe mesajla reddediyor';

  -- ---------------------------------------------------------------------------
  -- 3e — YÜK VELİ KANALINA SIZMIYOR. 0025'in kanal sınırı saldırgan
  --      girdisiyle de geçerli mi.
  -- ---------------------------------------------------------------------------
  if (public.veli_paneli(jv))::text like '%onerror%' then
    raise exception '3e BAŞARISIZ — öğrencinin yükü veli paneline sızdı';
  end if;
  raise notice '3e OK — öğrencinin yükü veli kanalında görünmüyor';

  -- ---------------------------------------------------------------------------
  -- 3f — İKİNCİ KATMAN: ŞEMA KISITI DA TUTUYOR.
  --
  -- 3d ucu ölçüyor. Ama 0027'nin bulgusu tam olarak şuydu: uç denetimi ile
  -- şema kısıtı AYNI hatalı `btrim`'i paylaşıyordu, yani iki katman gibi
  -- görünüp tek katman kadar koruyorlardı. O yüzden kısıt burada UÇTAN
  -- BAĞIMSIZ olarak, doğrudan insert ile ölçülüyor.
  -- ---------------------------------------------------------------------------
  begin
    insert into public.mesajlar (ogrenci_id, kimden, metin, kanal)
    values (a, 'ogrenci', E'\t\n  ', 'ogrenci');
    raise exception '3f BAŞARISIZ — şema kısıtı boşluk mesajını kabul etti';
  exception when others then
    get stacked diagnostics v_kod = returned_sqlstate;
    if v_kod = 'P0001' and sqlerrm like '%3f BAŞARISIZ%' then raise; end if;
    if v_kod <> '23514' then
      raise exception '3f BAŞARISIZ — beklenen 23514 (check ihlali), gelen %', v_kod;
    end if;
  end;
  raise notice '3f OK — şema kısıtı da uçtan bağımsız olarak tutuyor';
end $$;

-- =============================================================================
-- 4. KURULUM KAPISI, KİLİTLEME VE OTURUM ÖMRÜ
-- =============================================================================
do $$
declare
  jt text; jo text; s uuid; a uuid; b uuid;
  kodA text; kodB text;
  i integer;
  sonuc jsonb;
  v_kod text; v_mesaj text;
  kilitlendi boolean;
begin
  update public.ayarlar
     set ogretmen_pin_hash = extensions.crypt('Kilit!2026', extensions.gen_salt('bf', 10))
   where id = 1;
  jt := (public.giris('Kilit!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (10, 'K')
    on conflict (seviye, sube) do update set arsiv = false returning id into s;

  a := (public.ogrenci_ekle(jt, 'Kilit A', 'okul', s))->>'id';
  b := (public.ogrenci_ekle(jt, 'Kilit B', 'okul', s))->>'id';
  select kod into kodA from public.giris_kodlari where ogrenci_id = a and rol = 'ogrenci';
  select kod into kodB from public.giris_kodlari where ogrenci_id = b and rol = 'ogrenci';

  -- ---------------------------------------------------------------------------
  -- 4a — KURULUM KAPISI KAPALI.
  --
  -- `pin_ayarla` hash doluyken çağrılabilseydi siteye giren HERKES
  -- öğretmen PIN'ini belirleyebilirdi. Bu, sistemdeki en kritik tek kapı.
  -- ---------------------------------------------------------------------------
  begin
    perform public.pin_ayarla('SaldirganPIN!2026');
    raise exception '4a BAŞARISIZ — pin_ayarla ikinci kez çalıştı, PIN ele geçirilebilir';
  exception when others then
    get stacked diagnostics v_kod = returned_sqlstate;
    if v_kod = 'P0001' and sqlerrm like '%4a BAŞARISIZ%' then raise; end if;
    if v_kod <> '42501' then
      raise exception '4a BAŞARISIZ — beklenen 42501, gelen %', v_kod;
    end if;
  end;
  -- Kanıt: PIN gerçekten değişmedi, eski PIN hâlâ çalışıyor.
  if (public.giris('Kilit!2026'))->>'rol' <> 'ogretmen' then
    raise exception '4a BAŞARISIZ — öğretmen PIN''i bozulmuş';
  end if;
  raise notice '4a OK — pin_ayarla hash doluyken 42501, PIN değişmedi';

  -- ---------------------------------------------------------------------------
  -- 4b — KOD BAZLI KİLİT (0028). Aynı koda 8 hatalı deneme → o kod kilitli.
  --      Kilit DOĞRU koddan sonra da sürüyor: yalnız yanlış denemeyi değil
  --      erişimi kilitliyor.
  -- ---------------------------------------------------------------------------
  delete from public.giris_denemeleri;

  kilitlendi := false;
  for i in 1..8 loop
    begin
      perform public.giris(kodA || 'X');   -- var olmayan, ama HEP AYNI kod
    exception when others then
      get stacked diagnostics v_kod = returned_sqlstate;
      if v_kod = '53400' then kilitlendi := true; end if;
    end;
  end loop;

  begin
    perform public.giris(kodA || 'X');
    raise exception '4b BAŞARISIZ — 9. denemede kod hâlâ açık';
  exception when others then
    get stacked diagnostics v_kod = returned_sqlstate, v_mesaj = message_text;
    if v_kod = 'P0001' and sqlerrm like '%4b BAŞARISIZ%' then raise; end if;
    if v_kod <> '53400' then
      raise exception '4b BAŞARISIZ — beklenen 53400, gelen % (%)', v_kod, v_mesaj;
    end if;
  end;
  raise notice '4b OK — aynı koda 8 hatalı denemeden sonra o kod kilitlendi';

  -- ---------------------------------------------------------------------------
  -- 4c — KİLİT KOMŞUYA BULAŞMIYOR. Faz 1'de belgeye yazılan kalan risk #5
  --      buydu: aynı IP'deki başka bir öğrenci kilitleniyordu.
  --
  --      Yukarıda 8 hatalı deneme yapıldı ve HEPSİ AYNI IP'den (testte
  --      kimlik sabit). Eski davranışta B de kilitlenirdi.
  -- ---------------------------------------------------------------------------
  -- ÇAĞRI SARMALANIYOR: kilit devredeyse `giris` 53400 fırlatıyor ve
  -- sarmalanmazsa o ham hata kaçıp testin adını söylemeden süiti
  -- düşürüyordu (geri alma kanıtında ölçüldü).
  begin
    sonuc := public.giris(kodB);
  exception when others then
    get stacked diagnostics v_kod = returned_sqlstate;
    raise exception '4c BAŞARISIZ — A''nın hatalı denemeleri B''yi kilitledi (sqlstate %)', v_kod;
  end;
  if sonuc->>'rol' <> 'ogrenci' then
    raise exception '4c BAŞARISIZ — B giriş yapamadı: %', sonuc;
  end if;
  raise notice '4c OK — bir kodun kilitlenmesi aynı ağdaki diğer öğrenciyi etkilemiyor';

  -- ---------------------------------------------------------------------------
  -- 4d — IP KİLİDİ HÂLÂ VAR. Kod bazlı sayaç, IP sayacının yerine geçmedi;
  --      eşik yükseldi ama koruma duruyor. 40 FARKLI hatalı kod denenince
  --      IP kilitlenmeli.
  -- ---------------------------------------------------------------------------
  delete from public.giris_denemeleri;

  for i in 1..40 loop
    begin
      perform public.giris('YOK' || lpad(i::text, 5, '0'));  -- her seferinde FARKLI kod
    exception when others then null;
    end;
  end loop;

  begin
    perform public.giris(kodB);
    raise exception '4d BAŞARISIZ — 40 farklı hatalı denemeden sonra IP hâlâ açık';
  exception when others then
    get stacked diagnostics v_kod = returned_sqlstate;
    if v_kod = 'P0001' and sqlerrm like '%4d BAŞARISIZ%' then raise; end if;
    if v_kod <> '53400' then
      raise exception '4d BAŞARISIZ — beklenen 53400, gelen %', v_kod;
    end if;
  end;
  raise notice '4d OK — IP kilidi duruyor: 40 farklı hatalı denemede devreye girdi';

  delete from public.giris_denemeleri;

  -- ---------------------------------------------------------------------------
  -- 4e — ÇIKIŞ JETONU GERÇEKTEN DÜŞÜRÜYOR.
  -- ---------------------------------------------------------------------------
  jo := (public.giris(kodA))->>'token';
  if (public.ogrenci_odevleri(jo))->'ogrenci'->>'ad' <> 'Kilit A' then
    raise exception '4e ÖLÇÜM BOZUK — jeton en baştan çalışmıyor';
  end if;

  perform public.cikis(jo);
  begin
    perform public.ogrenci_odevleri(jo);
    raise exception '4e BAŞARISIZ — çıkıştan sonra jeton hâlâ geçerli';
  exception when others then
    get stacked diagnostics v_kod = returned_sqlstate;
    if v_kod = 'P0001' and sqlerrm like '%4e BAŞARISIZ%' then raise; end if;
    if v_kod <> '28000' then
      raise exception '4e BAŞARISIZ — beklenen 28000, gelen %', v_kod;
    end if;
  end;
  raise notice '4e OK — çıkış jetonu düşürüyor';

  -- ---------------------------------------------------------------------------
  -- 4f — SÜRESİ DOLAN JETON REDDEDİLİYOR.
  --      Zamanı beklemek yerine oturumun bitişi geriye çekiliyor.
  -- ---------------------------------------------------------------------------
  jo := (public.giris(kodA))->>'token';
  update public.oturumlar
     set son_kullanma = now() - interval '1 minute'
   where token_hash = public._token_hash(jo);

  begin
    perform public.ogrenci_odevleri(jo);
    raise exception '4f BAŞARISIZ — süresi dolmuş jeton kabul edildi';
  exception when others then
    get stacked diagnostics v_kod = returned_sqlstate;
    if v_kod = 'P0001' and sqlerrm like '%4f BAŞARISIZ%' then raise; end if;
    if v_kod <> '28000' then
      raise exception '4f BAŞARISIZ — beklenen 28000, gelen %', v_kod;
    end if;
  end;
  raise notice '4f OK — süresi dolan jeton reddediliyor';

  -- ---------------------------------------------------------------------------
  -- 4g — PASİFLEŞTİRİLEN ÖĞRENCİ ANINDA DÜŞÜYOR (matris madde 14).
  -- ---------------------------------------------------------------------------
  jo := (public.giris(kodA))->>'token';
  perform public.ogrenci_pasiflestir(jt, a);
  begin
    perform public.ogrenci_odevleri(jo);
    raise exception '4g BAŞARISIZ — pasifleştirilen öğrencinin jetonu çalışıyor';
  exception when others then
    get stacked diagnostics v_kod = returned_sqlstate;
    if v_kod = 'P0001' and sqlerrm like '%4g BAŞARISIZ%' then raise; end if;
    if v_kod <> '28000' then
      raise exception '4g BAŞARISIZ — beklenen 28000, gelen %', v_kod;
    end if;
  end;
  -- Kodu da düşmüş olmalı: yeniden giriş yapılamamalı.
  if (public.giris(kodA))->>'rol' <> 'yok' then
    raise exception '4g BAŞARISIZ — pasif öğrencinin kodu hâlâ giriş yapıyor';
  end if;
  raise notice '4g OK — pasifleştirme oturumu ve kodu birlikte düşürüyor';
end $$;
