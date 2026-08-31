-- =============================================================================
-- SEKİZ — 0032 EWALU MESAJ TESTLERİ
--
-- Öğretmenin isteği: "var olan mesajlar devam edecek, fakat istersem
-- istediğim zaman değiştirebileyim."
--
-- BU DOSYANIN ASIL SORULARI ÜÇ TANE:
--
--   1. YAZDIĞI GERİ GELİYOR MU, ve `null` gerçekten VARSAYILANA DÖNDÜRÜYOR
--      mu (satır siliniyor mu, yoksa boş bir cümle mi kalıyor).
--   2. KİM ÇAĞIRABİLİYOR: öğretmen yazar, öğrenci OKUR, veli HİÇBİRİNİ.
--      Veli sınırı `guvenlik_denetimi.sql` beyaz listesinde ölçülmüyor
--      (o liste rol ayrımı yapmıyor); dar kural BURADA ölçülüyor.
--   3. YEDEĞE GİRİYOR MU. Bu, turun sessiz ama en kritik maddesi:
--      ölçüldüğünde `disa_aktar` `ayarlar` tablosunu YEDEKLEMİYOR, yani
--      cümleler oraya konsaydı bir felakette sessizce kaybolurdu. Aynı
--      çağrıda PIN hash'inin yedeğe GİRMEDİĞİ de ölçülüyor — yeni tablo
--      eklerken eski güvenceyi bozmadığımızın kanıtı.
--
-- İZOLASYON: bu dosya `ewalu_mesajlari` tablosunun TAMAMINI kullanıyor
-- (beş satırlık, öğretmene ait tek bir ayar kümesi). Başlarken ve
-- bitirirken temizliyor, yani tekrar çalıştırılabilir ve başka testlerin
-- gördüğü dünyayı bozmadan bırakıyor.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text;   -- öğretmen
  jo text;   -- öğrenci
  jv text;   -- veli
  v_sinif uuid;
  v_o uuid;
  v jsonb;
  y jsonb;
  n integer;
  s text;

  -- Öğretmenin yazacağı cümle. Bilerek Türkçe karakterli, kesme işaretli
  -- ve alışılmadık: yedekte ve yanıtta ararken tesadüfen eşleşmesin.
  c_ozel text := 'Şimdilik böyle; Ada''nın dediği gibi yarın yine bakarız — 0032 özel cümlesi.';
begin
  -- ---------------------------------------------------------------------------
  -- Hazırlık
  -- ---------------------------------------------------------------------------
  update public.ayarlar
     set ogretmen_pin_hash = extensions.crypt('Ewalu!2026', extensions.gen_salt('bf', 10))
   where id = 1;
  jt := (public.giris('Ewalu!2026'))->>'token';

  -- TEKRAR ÇALIŞTIRILABİLİRLİK: önceki koşudan satır kalmasın.
  delete from public.ewalu_mesajlari;

  insert into public.siniflar (seviye, sube) values (6, 'W')
    on conflict (seviye, sube) do update set arsiv = false
    returning id into v_sinif;

  delete from public.ogrenciler where ad = 'Ewa Mesajlı';
  v_o := (public.ogrenci_ekle(jt, 'Ewa Mesajlı', 'okul', v_sinif))->>'id';
  jo := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_o and rol = 'ogrenci')))->>'token';
  jv := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_o and rol = 'veli')))->>'token';

  -- ===========================================================================
  raise notice '--- 1. Tablo BOŞ başlıyor: varsayılanlar kodda ---';
  -- ===========================================================================
  -- Bu, turun sözleşmesi. Migration hiçbir cümle yazmıyor; öğretmen o ekrana
  -- girmezse uç boş dizi döndürüyor ve öğrenci bugünkü cümleleri görüyor.
  v := public.ewalu_mesajlari(jt);
  if jsonb_typeof(v) is distinct from 'array' then
    raise exception '1a: uç dizi döndürmüyor (%)', coalesce(jsonb_typeof(v), 'yok');
  end if;
  if jsonb_array_length(v) is distinct from 0 then
    raise exception '1b: tablo boş başlamıyor, % satır var', jsonb_array_length(v);
  end if;

  raise notice '1 OK — uç boş dizi döndürüyor, varsayılanlar kodda kalıyor';

  -- ===========================================================================
  raise notice '--- 2. Yazma ve okuma: yazılan BİREBİR geri geliyor ---';
  -- ===========================================================================
  y := public.ewalu_mesaj_yaz(jt, 50::smallint, c_ozel);
  if (y ->> 'cumle') is distinct from c_ozel then
    raise exception '2a: yazma ucu cümleyi değiştirerek döndürdü: %', y ->> 'cumle';
  end if;
  if (y ->> 'degisti')::boolean is distinct from true then
    raise exception '2b: degisti bayrağı true değil';
  end if;

  v := public.ewalu_mesajlari(jt);
  if jsonb_array_length(v) is distinct from 1 then
    raise exception '2c: okuma ucu tam bir satır vermiyor';
  end if;
  select e ->> 'cumle' into s from jsonb_array_elements(v) e where (e ->> 'bant')::int = 50;
  if s is distinct from c_ozel then
    raise exception '2d: okunan cümle yazılanla aynı değil: %', s;
  end if;

  -- YALNIZ DEĞİŞTİRİLEN BANT DÖNÜYOR. Diğer dördü varsayılanda kalmalı;
  -- uç onları döndürseydi istemci "hepsi özelleştirilmiş" sanırdı.
  if exists (select 1 from jsonb_array_elements(v) e where (e ->> 'bant')::int <> 50) then
    raise exception '2e: değiştirilmemiş bant da dönüyor';
  end if;

  -- Baştaki/sondaki boşluk kırpılıyor (0027'de öğrenilen tuzağın kardeşi).
  perform public.ewalu_mesaj_yaz(jt, 100::smallint, '   Tam puan.   ');
  select e ->> 'cumle' into s
    from jsonb_array_elements(public.ewalu_mesajlari(jt)) e
   where (e ->> 'bant')::int = 100;
  if s is distinct from 'Tam puan.' then
    raise exception '2f: boşluk kırpılmadı: [%]', s;
  end if;

  raise notice '2 OK — yazılan birebir geri geliyor, yalnız o bant dönüyor, boşluk kırpılıyor';

  -- ===========================================================================
  raise notice '--- 3. null = VARSAYILANA DÖN (satır siliniyor) ---';
  -- ===========================================================================
  y := public.ewalu_mesaj_yaz(jt, 50::smallint, null);
  if (y ->> 'cumle') is not null then
    raise exception '3a: varsayılana dönüşte cümle null değil';
  end if;
  if (y ->> 'degisti')::boolean is distinct from true then
    raise exception '3b: gerçek bir dönüş "degisti=false" bildirdi';
  end if;

  -- SATIR GERÇEKTEN SİLİNDİ Mİ. Boş bir cümleyle satırı bırakmak, kısıt
  -- yüzünden zaten olamaz; ama satırın DURMASI hâlinde istemci "öğretmen
  -- burayı özelleştirmiş" sanır ve varsayılan bir daha hiç görünmezdi.
  if exists (select 1 from public.ewalu_mesajlari where bant = 50) then
    raise exception '3c: satır silinmedi, varsayılana dönüş yalnız görünürde';
  end if;
  if exists (select 1 from jsonb_array_elements(public.ewalu_mesajlari(jt)) e
              where (e ->> 'bant')::int = 50) then
    raise exception '3d: silinen bant uçtan hâlâ dönüyor';
  end if;

  -- Zaten varsayılandaki bandı tekrar döndürmek hata değil ama "değişti"
  -- de dememeli — öğretmene yanlış geri bildirim olurdu.
  y := public.ewalu_mesaj_yaz(jt, 70::smallint, null);
  if (y ->> 'degisti')::boolean is distinct from false then
    raise exception '3e: hiç değişmemiş bant "değişti" bildirdi';
  end if;

  raise notice '3 OK — null satırı siliyor, varsayılan geri geliyor, sahte "değişti" yok';

  -- ===========================================================================
  raise notice '--- 4. YETKİ: öğretmen yazar, öğrenci OKUR, veli hiçbiri ---';
  -- ===========================================================================
  -- Öğrenci OKUYABİLMELİ: sonuç kartındaki cümleyi o görüyor.
  begin
    v := public.ewalu_mesajlari(jo);
    if jsonb_typeof(v) is distinct from 'array' then
      raise exception '4a: öğrenci okuyamadı';
    end if;
  exception when sqlstate '42501' then
    raise exception '4a: öğrenci kendi cümlesini okuyamıyor — ekran boş kalırdı';
  end;

  -- Öğrenci YAZAMAMALI.
  begin
    perform public.ewalu_mesaj_yaz(jo, 0::smallint, 'öğrenci yazdı');
    raise exception '4b: ÖĞRENCİ CÜMLE YAZABİLDİ';
  exception when sqlstate '42501' then null;
  end;

  -- VELİ İKİSİNİ DE ÇAĞIRAMAMALI. Bu cümle velinin hiçbir ekranında yok;
  -- en dar yetki kuralı. `guvenlik_denetimi.sql` beyaz listesi rol ayrımı
  -- yapmadığı için bu ölçüm YALNIZ BURADA yapılıyor.
  begin
    perform public.ewalu_mesajlari(jv);
    raise exception '4c: VELİ OKUMA UCUNU ÇAĞIRABİLDİ';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.ewalu_mesaj_yaz(jv, 0::smallint, 'veli yazdı');
    raise exception '4d: VELİ CÜMLE YAZABİLDİ';
  exception when sqlstate '42501' then null;
  end;

  -- Yazma denemelerinden sonra tabloda satır oluşmamış olmalı: red yetmez,
  -- yazılmadığı da sayılmalı.
  select count(*) into n from public.ewalu_mesajlari where bant = 0;
  if n <> 0 then
    raise exception '4e: reddedilen çağrı yine de satır yazdı';
  end if;

  raise notice '4 OK — öğretmen yazar, öğrenci okur, veli hiçbirini; red sonrası satır yok';

  -- ===========================================================================
  raise notice '--- 5. Sınırlar: sqlstate VE Türkçe mesaj ---';
  -- ===========================================================================
  -- 0024'te öğrenildi: yalnız sqlstate ölçmek yetmiyor. Denetim kaldırılınca
  -- PostgreSQL''in kendi hatası da aynı sqlstate''i döndürebiliyor ve test
  -- yine geçiyor. Öğretmene giden şey MESAJ; o da ölçülüyor.
  begin
    perform public.ewalu_mesaj_yaz(jt, 42::smallint, 'geçersiz bant');
    raise exception '5a: GEÇERSİZ BANT KABUL EDİLDİ';
  exception when sqlstate '22023' then
    get stacked diagnostics s = message_text;
    if s not like '%puan bandı%' then
      raise exception '5a: yanlış gerekçeyle reddedildi: %', s;
    end if;
  end;

  begin
    perform public.ewalu_mesaj_yaz(jt, 85::smallint, '    ');
    raise exception '5b: YALNIZ BOŞLUKTAN OLUŞAN CÜMLE KABUL EDİLDİ';
  exception when sqlstate '22023' then
    get stacked diagnostics s = message_text;
    if s not like '%boş olamaz%' then
      raise exception '5b: yanlış gerekçe: %', s;
    end if;
  end;

  -- 400 kabul, 401 red — sınırın tam üstü ve tam altı.
  perform public.ewalu_mesaj_yaz(jt, 85::smallint, repeat('a', 400));
  begin
    perform public.ewalu_mesaj_yaz(jt, 85::smallint, repeat('a', 401));
    raise exception '5c: 401 KARAKTER KABUL EDİLDİ';
  exception when sqlstate '22023' then
    get stacked diagnostics s = message_text;
    if s not like '%400 karakter%' then
      raise exception '5c: yanlış gerekçe: %', s;
    end if;
  end;

  -- Reddedilen uzun cümle 400'lüğü EZMEMELİ.
  select e ->> 'cumle' into s
    from jsonb_array_elements(public.ewalu_mesajlari(jt)) e
   where (e ->> 'bant')::int = 85;
  if length(s) <> 400 then
    raise exception '5d: reddedilen çağrı mevcut cümleyi bozdu (% karakter)', length(s);
  end if;

  raise notice '5 OK — geçersiz bant, boş cümle ve 401 karakter Türkçe mesajla reddedildi';

  -- ===========================================================================
  raise notice '--- 6. Denetim izi: eski ve yeni cümle duruyor ---';
  -- ===========================================================================
  delete from public.denetim_izi where islem like 'ewalu_mesaji%';
  perform public.ewalu_mesaj_yaz(jt, 0::smallint, 'birinci hâli');
  perform public.ewalu_mesaj_yaz(jt, 0::smallint, 'ikinci hâli');

  select count(*) into n from public.denetim_izi
   where islem = 'ewalu_mesaji_degisti' and tablo = 'ewalu_mesajlari';
  if n <> 2 then
    raise exception '6a: iki değişiklik için % kayıt var', n;
  end if;

  -- ÖNCESİ DE YAZILI OLMALI. "Ne yazıldı" tek başına yetmez; eski metin
  -- olmadan bir değişikliği geri almak ya da açıklamak imkânsız olurdu.
  if not exists (
    select 1 from public.denetim_izi
     where islem = 'ewalu_mesaji_degisti'
       and eski ->> 'cumle' = 'birinci hâli'
       and yeni ->> 'cumle' = 'ikinci hâli')
  then
    raise exception '6b: denetim izinde eski/yeni cümle çifti yok';
  end if;

  perform public.ewalu_mesaj_yaz(jt, 0::smallint, null);
  if not exists (
    select 1 from public.denetim_izi
     where islem = 'ewalu_mesaji_varsayilana_dondu'
       and eski ->> 'cumle' = 'ikinci hâli')
  then
    raise exception '6c: varsayılana dönüş denetim izine yazılmadı';
  end if;

  raise notice '6 OK — değişiklik ve varsayılana dönüş, eski hâliyle birlikte izde';

  -- ===========================================================================
  raise notice '--- 7. YEDEK: cümle yedeğe giriyor, PIN girmiyor ---';
  -- ===========================================================================
  -- Turun en kritik ölçümü. Ölçüldü: `disa_aktar` `ayarlar` tablosunu
  -- yediliyor DEĞİL. Cümleler oraya konsaydı öğretmenin kendi yazdıkları
  -- bir felakette sessizce kaybolurdu.
  perform public.ewalu_mesaj_yaz(jt, 50::smallint, c_ozel);
  v := public.disa_aktar(jt);

  if jsonb_typeof(v -> 'ewalu_mesajlari') is distinct from 'array' then
    raise exception '7a: yedekte ewalu_mesajlari dizisi yok (%)',
      coalesce(jsonb_typeof(v -> 'ewalu_mesajlari'), 'alan yok');
  end if;
  if not exists (select 1 from jsonb_array_elements(v -> 'ewalu_mesajlari') e
                  where e ->> 'cumle' = c_ozel) then
    raise exception '7b: ÖĞRETMENİN YAZDIĞI CÜMLE YEDEKTE YOK';
  end if;
  -- Ham metinde de aransın: alan adı doğru ama değer boş kalırsa 7b
  -- yakalar, yine de iki yönlü ölçüyoruz.
  if position(c_ozel in v::text) = 0 then
    raise exception '7c: cümle yedeğin metninde hiç geçmiyor';
  end if;

  -- MEVCUT GÜVENCE BOZULMADI: PIN yedeğe girmiyor (docs/yedekleme.md).
  -- Yeni bir tablo eklerken eski bir sözü çiğnemediğimizin kanıtı.
  if position('ogretmen_pin_hash' in v::text) > 0
     or position('$2a$' in v::text) > 0 or position('$2b$' in v::text) > 0 then
    raise exception '7d: PIN HASH''İ YEDEĞE SIZDI';
  end if;

  raise notice '7 OK — cümle yedekte, PIN yedekte değil';

  -- ---------------------------------------------------------------------------
  -- Temizlik: bu dosya kendi dünyasını geride bırakmıyor.
  -- ---------------------------------------------------------------------------
  delete from public.ewalu_mesajlari;
  delete from public.denetim_izi where islem like 'ewalu_mesaji%';

  raise notice '';
  raise notice 'EWALU MESAJ TESTLERİ: 7 GRUP GEÇTİ';
end;
$$;

-- =============================================================================
-- 8. İMZA VE ŞEMA — `do` bloğunun DIŞINDA
--
-- Kısıtların gerçekten şemada olduğunu ölçüyoruz. Uç denetimi kaldırılsa
-- bile tablo kendini korumalı: iki katman.
-- =============================================================================
do $$
begin
  if to_regprocedure('public.ewalu_mesajlari(text)') is null
     or to_regprocedure('public.ewalu_mesaj_yaz(text,smallint,text)') is null then
    raise exception '8a: uçlar yok';
  end if;

  -- Beşli bant kümesi şemada kilitli: uç bozulsa bile 42 numaralı bir bant
  -- tabloya giremez.
  begin
    insert into public.ewalu_mesajlari (bant, cumle) values (42, 'olmaz');
    raise exception '8b: ŞEMA GEÇERSİZ BANDI KABUL ETTİ';
  exception when check_violation then null;
  end;

  begin
    insert into public.ewalu_mesajlari (bant, cumle) values (0, '   ');
    raise exception '8c: ŞEMA BOŞ CÜMLEYİ KABUL ETTİ';
  exception when check_violation then null;
  end;

  begin
    insert into public.ewalu_mesajlari (bant, cumle) values (0, repeat('a', 401));
    raise exception '8d: ŞEMA 401 KARAKTERİ KABUL ETTİ';
  exception when check_violation then null;
  end;

  delete from public.ewalu_mesajlari;
  raise notice '8 OK — bant kümesi, boş cümle ve uzunluk şemada da kilitli';
end;
$$;
