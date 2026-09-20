-- SEKİZ — 0046: Kendi kodumu yenile
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Açıklamalı tam sürüm: supabase/migrations/0046_kendi_kodum.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Yedek)
-- BU SQL ÖNCE ÇALIŞMALI, SİTE SONRA YAYINA ALINMALI.
--
-- NE YAPIYOR: Öğrenci ve veli panosunun altına "Kodumu yenile" kartı
-- geliyor. Kişi kendi giriş kodunu, size ulaşmayı beklemeden
-- yenileyebiliyor. 0045'in (sizin yenilemeniz) ikinci yarısı.
--
-- YENİLEYİNCE NE OLUYOR:
--   - Eski kod O ANDA geçersiz olur; fişteki kod da dâhil.
--   - O koda AÇIK BAŞKA OTURUM varsa kapanır (sızan kişi dışarı atılır).
--   - Yenileyen kişinin KENDİ oturumu ayakta kalır — yeni kodu ekranda
--     okuyabilsin diye.
--   - Öteki rol etkilenmez: veli yenileyince öğrenci atılmaz.
--   - Denetim izine `kendi_kodu_yenilendi` diye düşer (sizin
--     yenilemeniz `kod_yenilendi`); ikisi ayrı, kimin yaptığı belli.
--     KOD DEĞERİ İZE YAZILMAZ.
--
-- SİZ HER ZAMAN GÖREBİLİRSİNİZ: Öğrenciler → Kodlar penceresi kodu
-- saklamıyor, her açılışta veritabanından okuyor. Kim değiştirirse
-- değiştirsin siz yürürlükteki kodu görürsünüz. Unutan kişiye
-- söyleyebilirsiniz; yeniden üretmeniz bile gerekmez.
--
-- HİÇBİR KAYIP OLMAZ: ödev, gönderim, karne, mesaj — hepsi öğrenciye
-- bağlı, koda değil. Kod yalnız bir kapı anahtarı.
--
-- ONAM KURALI KORUNDU: onam vermemiş veli bu ucu da kullanamaz. Önce
-- onam, sonra yenileme. (Acil durumda siz 0045 ile yenileyebilirsiniz.)
--
-- Veri silinmiyor; yalnız ilgili kod değişiyor.


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
