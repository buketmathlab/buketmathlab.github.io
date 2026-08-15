-- =============================================================================
-- SEKİZ — 0024 TOPLU ÖĞRENCİ EKLEME
--
-- ÖĞRETMENİN İHTİYACI: okullar açılıyor ve öğrenci eklemenin tek yolu var —
-- Öğrenciler → "Öğrenci ekle" → ad yaz → sınıf seç → kaydet → kodları not al
-- → kapat → tekrar. 12 sınıf × ~30 öğrenci = 360 kez.
--
-- Karnelerin, rozetlerin, konu analizinin hiçbiri öğrenci girilmeden bir şey
-- göstermiyor. Bu uç, bugüne kadar yapılan işin önündeki tıkacı açıyor.
--
-- -----------------------------------------------------------------------------
-- NEDEN YENİ UÇ — İSTEMCİDEN DÖNGÜ YETMEZ
--
-- `ogrenci_ekle` (0004) zaten var ve arayüz onu 30 kez çağırabilirdi. Ama o
-- 30 AYRI İŞLEM demek: ağ 17. öğrencide koparsa 16 öğrenci eklenmiş, 14'ü
-- eksik ve öğretmen hangisinin girdiğini bilmiyor. Elle temizlemesi
-- gereken yarım bir sınıfla baş başa kalır.
--
-- Bu uç TEK İŞLEM: hepsi ya da hiçbiri. Geçersiz tek bir ad bütün partiyi
-- reddeder ve kaçıncı satır olduğunu söyler.
--
-- -----------------------------------------------------------------------------
-- MÜKERRER AD REDDEDİLMİYOR — bilerek
--
-- Şemada `ogrenciler.ad` üzerinde UNIQUE yok (0001) ve olmamalı: bir okulda
-- aynı adda iki öğrenci gerçekten olur. Reddetseydik öğretmen gerçek bir
-- öğrenciyi sisteme hiç ekleyemezdi.
--
-- Sunucu ekler; UYARI ARAYÜZDE, karar öğretmenin. Arayüz hem yapıştırılan
-- listenin kendi içindeki hem o sınıfta zaten kayıtlı olan adları işaretler.
--
-- -----------------------------------------------------------------------------
-- KOD ÜRETİMİ KOPYALANMIYOR
--
-- `_yeni_kod()` (0003) çağrılıyor. O fonksiyon çakışma denetimini kendi
-- yapıyor; ikinci bir üretici yazmak, bir gün iki farklı alfabe ya da iki
-- farklı uzunluk demek olurdu.
--
-- Bu dosya tekrar çalıştırılabilir.
-- =============================================================================

create or replace function public.ogrenciler_toplu_ekle(
  p_token text,
  p_tur text,
  p_sinif_id uuid,
  p_adlar jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  ham        text;
  ad         text;
  sira       integer := 0;
  adet       integer;
  yeni_id    uuid;
  kod_ogr    text;
  kod_veli   text;
  sonuc      jsonb := '[]'::jsonb;
begin
  perform public._ogretmen(p_token);

  if p_tur is null or p_tur not in ('okul', 'ozel') then
    raise exception 'Öğrenci türü ''okul'' ya da ''ozel'' olmalı.'
      using errcode = '22023';
  end if;

  -- `ogrenci_ekle`'deki kuralın aynısı (0004): okul öğrencisi sınıfsız olamaz.
  -- Şema da bunu `ogrenci_sinif_tutarli` ile zorluyor; burada önden ve
  -- anlaşılır bir Türkçe mesajla söylüyoruz.
  if p_tur = 'okul' and p_sinif_id is null then
    raise exception 'Okul öğrencisi için sınıf seçilmeli.' using errcode = '22023';
  end if;

  if p_adlar is null or jsonb_typeof(p_adlar) <> 'array' then
    raise exception 'Ad listesi bir dizi olmalı.' using errcode = '22023';
  end if;

  adet := jsonb_array_length(p_adlar);
  if adet = 0 then
    raise exception 'Listede hiç ad yok.' using errcode = '22023';
  end if;

  -- ÜST SINIR. Bir sınıf ~35 kişi; 200 hem fazlasıyla rahat hem de tek bir
  -- isteğin veritabanında ne kadar iş yapabileceğini sınırlıyor.
  if adet > 200 then
    raise exception 'Tek seferde en fazla 200 öğrenci eklenebilir; % ad gönderildi.', adet
      using errcode = '22023';
  end if;

  -- ---------------------------------------------------------------------------
  -- ÖNCE HEPSİNİ DENETLE, SONRA YAZ
  --
  -- DÜRÜST OLMAK GEREKİRSE: atomikliği bu ayrı geçiş SAĞLAMIYOR. Fonksiyon
  -- hata fırlattığında PostgreSQL zaten bütün ifadeyi geri alıyor — tek
  -- geçişle yazsaydık da yarım kayıt kalmazdı. Ayrı geçişin kazandırdığı
  -- şey BOŞA İŞ YAPMAMAK: 200 adlık bir listede 200. ad bozuksa, önce 199
  -- öğrenci ve 398 kod üretip sonra hepsini çöpe atmıyoruz. `_yeni_kod`
  -- her çağrıda çakışma sorgusu yapıyor; o iş de boşa gitmiyor.
  -- ---------------------------------------------------------------------------
  for ham in select jsonb_array_elements_text(p_adlar) loop
    sira := sira + 1;
    ad := btrim(coalesce(ham, ''));
    if ad = '' then
      raise exception '%. satırdaki ad boş. Hiçbir öğrenci eklenmedi.', sira
        using errcode = '22023';
    end if;
    if length(ad) > 100 then
      raise exception '%. satırdaki ad 100 karakterden uzun. Hiçbir öğrenci eklenmedi.', sira
        using errcode = '22023';
    end if;
  end loop;

  -- ---------------------------------------------------------------------------
  -- YAZMA
  -- ---------------------------------------------------------------------------
  for ham in select jsonb_array_elements_text(p_adlar) loop
    ad := btrim(ham);

    -- `sinif_id` olduğu gibi geçiyor — `ogrenci_ekle` ile aynı davranış.
    -- Özel ders öğrencisi de bir sınıfa bağlanabiliyor (0012 "Özel ders"
    -- grubunu gerçek bir sınıf yaptı); burada karar arayüzün.
    insert into public.ogrenciler (ad, tur, sinif_id)
    values (ad, p_tur, p_sinif_id)
    returning id into yeni_id;

    kod_ogr  := public._yeni_kod();
    kod_veli := public._yeni_kod();

    insert into public.giris_kodlari (kod, ogrenci_id, rol)
    values (kod_ogr, yeni_id, 'ogrenci'), (kod_veli, yeni_id, 'veli');

    -- TOPLU İŞ DE İZ BIRAKIR. Öğrenci başına ayrı kayıt: "30 öğrenci
    -- eklendi" tek satırı, sonradan tek bir öğrencinin nereden geldiğini
    -- sormak gerektiğinde hiçbir şey söylemezdi (Part XLIII).
    perform public._denetim('ogrenci_eklendi', 'ogrenciler', yeni_id, 'ogretmen');

    sonuc := sonuc || jsonb_build_object(
      'id', yeni_id, 'ad', ad,
      'ogrenci_kodu', kod_ogr, 'veli_kodu', kod_veli
    );
  end loop;

  return jsonb_build_object('eklenen', sonuc, 'adet', jsonb_array_length(sonuc));
end;
$$;

-- -----------------------------------------------------------------------------
-- YETKİLER (0005 deseni)
-- -----------------------------------------------------------------------------
revoke all on function public.ogrenciler_toplu_ekle(text, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.ogrenciler_toplu_ekle(text, text, uuid, jsonb)
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- KENDİ KENDİNİ DENETLEME
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.ogrenciler_toplu_ekle(text, text, uuid, jsonb)') is null then
    raise exception 'ogrenciler_toplu_ekle oluşmadı.';
  end if;

  -- Bu uç kod üretmiyor, `_yeni_kod`'a GÜVENİYOR. O kaybolursa toplu ekleme
  -- kodsuz öğrenci üretirdi — sisteme hiç giremeyen otuz çocuk demek.
  if to_regprocedure('public._yeni_kod()') is null then
    raise exception '_yeni_kod yok; toplu ekleme kodsuz öğrenci üretirdi.';
  end if;

  -- Tek öğrenci ekleme yolu duruyor mu: arayüzde ikisi yan yana yaşıyor ve
  -- bir öğrenci eklemek tek tıklık bir iş olmayı sürdürmeli.
  if to_regprocedure('public.ogrenci_ekle(text, text, text, uuid)') is null then
    raise exception 'ogrenci_ekle kayboldu; tek öğrenci ekleme yolu kapanırdı.';
  end if;

  raise notice 'Toplu öğrenci ekleme hazır.';
end $$;
