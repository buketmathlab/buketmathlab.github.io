-- =============================================================================
-- 0045 — KODU YENİLE (iptal ve yeniden verme)
--
-- NEDEN VAR
-- Öğretmen sordu: "Veliler, öğrenciler giriş kodlarını sonra kendileri
-- değiştirebiliyorlar mı?" Cevap hayırdı — ve daha kötüsü, ÖĞRETMEN DE
-- değiştiremiyordu. `giris_kodlari` kişi başına tek satır tutuyor
-- (`unique (ogrenci_id, rol)`) ve kod yalnız öğrenci eklenirken bir kez
-- üretiliyordu (0004/0012/0024). Sonrasında değiştiren hiçbir yol yoktu.
--
-- SORUN TAHMİN DEĞİL, SIZMA. Kod 31 harflik alfabeden 8 karakter
-- (~8,5×10^11) ve 0028'in kilidi kod başına 15 dakikada 8 deneme; kimse
-- kodu bilemez. Ama fişler öğrenci eliyle dağıtılacak. Bir öğrenci
-- velisinin fişini açarsa o ailenin veli kanalı KALICI olarak açık
-- kalıyordu: 0025'in ayırdığı öğretmen↔veli yazışması ve özel derste
-- ödemeler. Elde kapatacak bir düğme yoktu.
--
-- ÜÇ KRİTİK KARAR
--
--   1. AÇIK OTURUM DA ÖLÜYOR. Yalnız kodu değiştirmek yetmez: sızdıran
--      kişinin açık oturumu varsa kod ölse de içeride kalırdı.
--      `ogrenci_pasiflestir`'in (0033) zaten kullandığı yol.
--
--   2. AMA YALNIZ O ROLÜN OTURUMU. `oturumlar.rol` süzgeci ŞART — veli
--      kodunu yenilemek öğrenciyi sistemden atmamalı, tersi de. Süzgeç
--      unutulursa hiçbir şey hata vermez, ürün sessizce yanlış davranır;
--      bu yüzden testte ayrıca ölçülüyor.
--
--   3. İZ KAYDINA KOD YAZILMIYOR. `denetim_izi` yalnız rolü ve işlemi
--      taşıyor. Kodları yazmak, ölmüş şifrelerin kalıcı bir arşivini
--      kurardı — hiçbir işe yaramaz, riski gerçek.
--
-- KAPI `ogrenci_kodlari` İLE AYNI (`_ogretmen` + `_ogrenci_sahibi`).
-- Gerekçe: kodu GÖREBİLEN öğretmen onu zaten sızdırabilir. Yenilemeyi
-- daha dar bir kapıya koymak güvenlik katmaz, yalnız meslektaşı kendi
-- öğrencisinde çaresiz bırakırdı.
--
-- DÜRÜST SINIRLAR
--   - Yenileme GEÇMİŞİ GERİ ALMAZ: sızdıran kişi daha önce okuduğunu
--     okumuş olur. Koruma ileriye dönüktür.
--   - Döngü, aile YENİ FİŞİ eline alana kadar kapanmaz. Ürün burada
--     öğretmene yalnız düğmeyi verir.
--   - Toplu yenileme (örn. dönem sonunda bütün sınıf) YOK; bilerek
--     kapsam dışı.
-- =============================================================================

create or replace function public.kod_yenile(p_token text, p_id uuid, p_rol text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ogretmen uuid;
  v_kod text;
begin
  -- ROL ÖNCE, VARLIK SONRA (0033'te ölçülerek bulunan sıra kuralı):
  -- tersi sırada yetkisiz biri, rastgele kimlik deneyerek bir öğrencinin
  -- VAR OLDUĞUNU öğrenebilirdi.
  v_ogretmen := public._ogretmen(p_token);
  perform public._ogrenci_sahibi(v_ogretmen, p_id);

  if p_rol is distinct from 'ogrenci' and p_rol is distinct from 'veli' then
    -- `is distinct from`: p_rol null ise `<>` NULL döner ve koşul hiç
    -- tutmazdı — kontrol sessizce atlanırdı (0043'te öğrenilen ders).
    raise exception 'Rol yalnız "ogrenci" ya da "veli" olabilir.'
      using errcode = '22023';
  end if;

  v_kod := public._yeni_kod();

  update public.giris_kodlari
     set kod = v_kod, created_at = now()
   where ogrenci_id = p_id and rol = p_rol;

  if not found then
    -- Kodu hiç üretilmemiş eski kayıtlar için. Yenileme burada aynı
    -- zamanda "ilk kez ver" işini görüyor; öğretmenin gözünde ikisi de
    -- "bu kişinin kodu olsun" demek.
    insert into public.giris_kodlari (kod, ogrenci_id, rol)
    values (v_kod, p_id, p_rol);
  end if;

  -- 1. ve 2. karar burada: oturum iptali VAR, ama ROLE BAĞLI.
  update public.oturumlar
     set iptal = true
   where ogrenci_id = p_id and rol = p_rol and not iptal;

  -- 3. karar: kod DEĞERİ hiçbir alana yazılmıyor, yalnız hangi rolün
  -- kodunun yenilendiği.
  perform public._denetim(
    'kod_yenilendi',
    'giris_kodlari',
    p_id,
    public._aktor(v_ogretmen),
    jsonb_build_object('rol', p_rol),
    jsonb_build_object('rol', p_rol, 'yenilendi', true)
  );

  return jsonb_build_object('rol', p_rol, 'kod', v_kod);
end;
$$;

-- 0005 deseni: jeton İÇERİDE denetleniyor, kapı `_ogretmen`. PostgREST
-- anon anahtarıyla çağırıyor; yetkinin kaynağı anahtar değil jeton.
revoke all on function public.kod_yenile(text, uuid, text) from public, anon, authenticated;
grant execute on function public.kod_yenile(text, uuid, text) to anon;

-- -----------------------------------------------------------------------------
-- KENDİNİ DENETLEME
--
-- 0007 tuzağı bu dosyada YOK: `kod_yenile` yepyeni bir ad, düşürülecek
-- eski imza yok. Yine de "tek imza" iddiası ölçülüyor — ve
-- `pg_get_function_identity_arguments()` KULLANILMIYOR: o fonksiyon
-- parametre ADLARINI da döndürüyor, çıplak tip listesiyle karşılaştırmak
-- ASLA tutmayan bir iddia kuruyor (0042'de ölü bulundu).
-- -----------------------------------------------------------------------------
do $$
declare
  v_sayi integer;
begin
  select count(*) into v_sayi
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'kod_yenile';

  if v_sayi <> 1 then
    raise exception 'kod_yenile tek imza değil: % adet bulundu', v_sayi;
  end if;

  if pg_catalog.oidvectortypes(
       (select p.proargtypes from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'kod_yenile')
     ) <> 'text, uuid, text' then
    raise exception 'kod_yenile imzası beklenenden farklı';
  end if;
end;
$$;

select public._migration_kaydet('0045');
