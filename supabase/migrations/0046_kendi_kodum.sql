-- =============================================================================
-- 0046 — KENDİ KODUMU YENİLE (öğrenci/veli tarafı)
--
-- NEDEN VAR
-- Öğretmenin sorusu iki parçalıydı: "Veliler, öğrenciler giriş kodlarını
-- sonra kendileri değiştirebiliyorlar mı?" 0045 birinci parçayı verdi —
-- ÖĞRETMEN bir kodu iptal edip yenisini verebiliyor. Bu dosya ikincisi:
-- kişinin kendi kodunu, öğretmene ulaşmayı beklemeden yenileyebilmesi.
--
-- ÇÖZDÜĞÜ İHTİYAÇ SIZINTI, HATIRLANABİLİRLİK DEĞİL. Oturum cihazda
-- saklanıyor (`sekiz_oturum`), yani kod bir kez yazılıyor ve uygulama
-- açık kalıyor; "kodumu hatırlayamıyorum" göründüğü kadar büyük bir sorun
-- değil, üstelik kod fişte de yazıyor. Asıl senaryo şu: *kardeşim kodumu
-- gördü*, *fişimi kaybettim*. O anda öğretmene ulaşamayan kişi 0045'ten
-- sonra bile çaresizdi.
--
-- KODU KİŞİ SEÇMİYOR, SİSTEM ÜRETİYOR — ÖĞRETMENİN KARARI, VE ÖLÇÜLDÜ.
-- Kendi yazabilseydi 0028'in bütün güvenlik hesabı çökerdi: o dosya
-- "31 harflik alfabeden 8 karakter → ~8,5×10^11 olasılık, ilk isabet
-- milyon yıl mertebesinde" diyor ve kilidi (kod başına 15 dakikada 8
-- deneme) buna göre ayarlıyor. Üstelik `kod` sütunu `giris_kodlari`
-- tablosunun BİRİNCİL ANAHTARI (0001:107) — kodlar bütün aileler
-- arasında tekil. Yani "ANNE2024" gibi bir kod, belirli bir YABANCININ
-- kapısını açan zayıf bir koddur; tutturan kişi başka bir ailenin
-- çocuğunun verisine girer.
--
-- KİŞİ KENDİ MEVCUT KODUNU GÖREMİYOR — bu da öğretmenin kararı. Böyle
-- bir uç YOK ve bilerek yok: açık bırakılmış bir telefonu eline alan
-- kişi bugün yalnız o oturumu görebiliyor; kodu okuyabilseydi kendi
-- telefonundan KALICI giriş sağlardı. Geçici erişimi kalıcıya çevirmek,
-- bu özelliğin çözdüğü sorunun ta kendisini üretirdi.
--
-- ÜÇ KARAR
--
--   1. KOD YOKSA ÜRETİLMEZ, HATA VERİLİR. 0045 eksik kodu `insert` ile
--      yaratıyor ve orada doğru: öğretmen "bu kişinin kodu olsun" diyor.
--      Burada tersi — geçerli bir oturum varsa o kod zaten vardı. Yoksa
--      bir şey bozuk demektir ve sessizce yaratmak onu gizler.
--
--   2. ÖTEKİ OTURUMLAR KAPANIR, KENDİSİNİNKİ KALIR. Özelliğin bütün
--      amacı sızan kişiyi dışarı atmak. Kendi oturumunu da kapatmak
--      kullanıcıyı YENİ KODU OKUMADAN dışarı atardı; ekranda kodu
--      göstermenin anlamı kalmazdı. 0045'te bu gerekmiyordu çünkü
--      öğretmen o oturumların içinde değil.
--
--   3. İZ KAYDINA KOD YAZILMIYOR ve işlem adı 0045'ten AYRI:
--      `kendi_kodu_yenilendi`. Öğretmen denetim izine bakınca "ben mi
--      yeniledim, onlar mı" sorusunu ayırt edebilsin diye.
--
-- VEKÂLET BURAYA SIZMIYOR — VE FAZLADAN KORUMA EKLENMEDİ.
-- `oturumlar.vekil_id` yalnız ÖĞRETMEN oturumunda dolu (0033:193;
-- vekâlet öğretmen→öğretmen). Aşağıdaki rol süzgeci öğretmeni zaten
-- eliyor. `vekil_id is null` diye bir kontrol eklemek, hiçbir zaman
-- kırılamayacak bir ölçüm olurdu — bu deponun tekrar tekrar ayıkladığı
-- ölü ölçüm deseninin ta kendisi (0042). Bunun yerine testte ÖĞRETMEN
-- JETONUNUN REDDEDİLDİĞİ ölçülüyor.
--
-- DÜRÜST SINIRLAR
--   - Geçmişi geri almaz: sızdıran kişi daha önce ne okuduysa okumuştur.
--   - Kişi yeni kodu not almazsa kilitlenmez ama sürtünme yaşar:
--     öğretmen `ogrenci_kodlari` ile yürürlükteki kodu görüp söyler.
--     Ekran bunu açıkça yazıyor, panik olmasın diye.
--   - Fişteki kod ölür. Kâğıt güncellenmez; bu kaçınılmaz.
-- =============================================================================

create or replace function public.kendi_kodumu_yenile(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  v_kod text;
  v_oturum_id uuid;
begin
  -- Kapı: 0004_rpc_katmani.sql:421 ile birebir aynı desen. Giriş
  -- yapmamış kimse buraya gelemez — öğretmenin "düğme giriş yaptıktan
  -- sonra mı çıkıyor?" sorusunun asıl cevabı burada, arayüzde değil.
  select * into o from public._oturum(p_token);

  if o.rol not in ('ogrenci', 'veli') then
    raise exception 'Bu işlem yalnızca öğrenci ve veli içindir.'
      using errcode = '42501';
  end if;

  -- ONAM KAPISI (0034) — MUAFİYET İSTENMEDİ, KURAL KORUNDU.
  --
  -- Bu satır yazılmadan önce `onam_testleri.sql` 9. grup bu ucu yakaladı:
  -- "onamsız veli 1 uca girebildi". Muafiyet listesine eklemek mümkündü;
  -- eklenmedi, ve sebebi kayda değer.
  --
  -- Kapının değişmezi şu: ONAM VERİLMEDEN HİÇBİR VELİ UCU ÇALIŞMAZ. Tek
  -- bir istisna, kuralı "bir istisnası olan kural"a çevirir ve bir
  -- sonraki uçta aynı tartışmayı yeniden açar. Karşılığında kazanılan
  -- şey küçük: onam vermemiş velinin zaten ulaşabildiği hiçbir veri yok,
  -- yani kodunu yenilemenin aciliyeti düşük. Yol da kapanmıyor — önce
  -- onam, sonra yenileme. Acil durumda öğretmen 0045 ile zaten
  -- yenileyebiliyor.
  --
  -- Öğrencide bu çağrı sessizce dönüyor (`_onam_kapisi` rol süzgeci).
  perform public._onam_kapisi(o.rol, o.ogrenci_id);

  v_kod := public._yeni_kod();

  update public.giris_kodlari
     set kod = v_kod, created_at = now()
   where ogrenci_id = o.ogrenci_id and rol = o.rol;

  if not found then
    -- 1. karar. Buraya düşmek ürünün bozuk olduğu anlamına gelir:
    -- oturum var ama kod yok. Sessizce yaratmak onu gizlerdi.
    raise exception 'Kodunuz bulunamadı. Öğretmeninize başvurun.'
      using errcode = 'P0002';
  end if;

  -- 2. karar. Kendi oturumunun kimliği jetonun özetinden bulunuyor;
  -- `_oturum` bunu döndürmüyor (dönüş tipi rol/ogrenci_id/ogretmen_id/
  -- vekil_id), o yüzden aynı özet burada yeniden hesaplanıyor.
  select id into v_oturum_id
    from public.oturumlar
   where token_hash = public._token_hash(p_token);

  update public.oturumlar
     set iptal = true
   where ogrenci_id = o.ogrenci_id
     and rol = o.rol
     and not iptal
     and id <> v_oturum_id;

  -- 3. karar. Aktör 0034:159 deseniyle düz rol adı — bu işi yapan bir
  -- öğretmen yok, `_aktor()` burada anlamsız olurdu.
  perform public._denetim(
    'kendi_kodu_yenilendi',
    'giris_kodlari',
    o.ogrenci_id,
    o.rol,
    jsonb_build_object('rol', o.rol),
    jsonb_build_object('rol', o.rol, 'yenilendi', true)
  );

  return jsonb_build_object('rol', o.rol, 'kod', v_kod);
end;
$$;

-- 0005 deseni: jeton İÇERİDE denetleniyor, kapı `_oturum`. PostgREST
-- anon anahtarıyla çağırıyor; yetkinin kaynağı anahtar değil jeton.
revoke all on function public.kendi_kodumu_yenile(text) from public, anon, authenticated;
grant execute on function public.kendi_kodumu_yenile(text) to anon;

-- -----------------------------------------------------------------------------
-- KENDİNİ DENETLEME
--
-- 0007 tuzağı yok (yeni ad, düşürülecek eski imza yok). Yine de "tek
-- imza" iddiası ölçülüyor ve `pg_get_function_identity_arguments()`
-- KULLANILMIYOR: o fonksiyon parametre ADLARINI da döndürüyor, çıplak
-- tip listesiyle karşılaştırmak ASLA tutmayan bir iddia kurar — 0042'de
-- ölü bulunmuştu.
-- -----------------------------------------------------------------------------
do $$
declare
  v_sayi integer;
begin
  select count(*) into v_sayi
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'kendi_kodumu_yenile';

  if v_sayi <> 1 then
    raise exception 'kendi_kodumu_yenile tek imza değil: % adet bulundu', v_sayi;
  end if;

  if pg_catalog.oidvectortypes(
       (select p.proargtypes from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'kendi_kodumu_yenile')
     ) <> 'text' then
    raise exception 'kendi_kodumu_yenile imzası beklenenden farklı';
  end if;
end;
$$;

select public._migration_kaydet('0046');
