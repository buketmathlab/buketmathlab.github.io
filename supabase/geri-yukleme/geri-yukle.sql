-- =============================================================================
-- SEKİZ — YEDEKTEN GERİ YÜKLEME
--
-- Bu dosya FELAKET İÇİNDİR. Normal kullanımda çalıştırılmaz.
--
-- Ne zaman: Supabase projesi silindiyse, veri bozulduysa ya da yeni bir
-- projeye taşınıyorsanız.
--
-- ÖN KOŞUL: yeni projede önce TÜM migration'lar çalıştırılmış olmalı
-- (supabase/migrations/ sırasıyla, ya da supabase/panel-icin/ dosyaları).
-- Tablolar var olmalı; içleri dolu olabilir, bu script onları temizler.
--
-- BU SCRIPT VERİ SİLER. Aşağıdaki sekiz tablodaki HER SATIRI siler ve
-- yerine yedektekileri yazar. Yanlışlıkla çalıştırmayı zorlaştırmak için
-- `onayliyorum` bayrağı var; elle true yapılmadan hiçbir şey yazılmaz.
--
-- -----------------------------------------------------------------------------
-- NEDEN KİMLİKLER (id) KORUNARAK YAZILIYOR
--
-- Temiz kurulum `siniflar` tablosunu 13 sınıfla dolduruyor ve bunlara YENİ
-- UUID'ler veriyor. Yedekteki `ogrenciler.sinif_id` ise ESKİ UUID'leri
-- gösteriyor. Sınıfları olduğu gibi bırakıp yalnız öğrencileri yazsaydık
-- her öğrencinin sınıf bağı kopardı. Bu yüzden önce siliniyor, sonra
-- yedekteki kimlikleriyle birlikte yazılıyor. Tüm yabancı anahtarlar
-- böyle tutarlı kalıyor.
--
-- `created_at` ve `updated_at` de korunuyor: tetikleyiciler yalnız UPDATE
-- üzerinde tanımlı, INSERT zaman damgalarını değiştirmiyor. Ölçüldü.
--
-- -----------------------------------------------------------------------------
-- YEDEĞİN İÇERMEDİKLERİ — geri yüklemeden sonra bunlar GELMEZ
--
--   * Çözüm fotoğrafları ve PDF'ler. Bunlar Supabase Storage'da durur;
--     yedek dosyasında yalnız ADRESLERİ vardır. Proje silindiyse dosyalar
--     da silinmiştir ve JSON onları geri getirmez.
--   * PIN. Geri yükledikten sonra siteye girip PIN'inizi yeniden
--     belirlersiniz (kurulum ekranı açılır).
--   * Denetim izi (`denetim_izi`) — not değişikliklerinin geçmişi.
--   * Okundu işaretleri ve oturumlar. Kayıpları önemsiz; oturumlar zaten
--     kimlik bilgisidir, yedeğe girmemeleri doğrudur.
--
-- =============================================================================

do $$
declare
  -- ---------------------------------------------------------------------------
  -- 1. ADIM — Yedek dosyasının TAMAMINI aşağıdaki iki işaretin arasına
  --           yapıştırın (aşağıda BURAYA-YAPISTIRIN yazan satırın yerine).
  --           Dosyayı bir metin düzenleyicide açıp hepsini kopyalayın;
  --           başındaki { ve sonundaki } dahil.
  --
  --           İşaretin kendisi bu yorumda YAZILMADI; yoksa yanlış yere
  --           yapıştırma ihtimali doğuyordu (kendi denememde tam bu oldu).
  -- ---------------------------------------------------------------------------
  yedek jsonb := $YEDEK$
BURAYA-YAPISTIRIN
  $YEDEK$::jsonb;

  -- ---------------------------------------------------------------------------
  -- 2. ADIM — Aşağıdaki satırı `true` yapın.
  --           Bunu yapmadan script HİÇBİR ŞEY yazmaz ve hiçbir şey silmez.
  -- ---------------------------------------------------------------------------
  onayliyorum boolean := false;

  -- Ebeveynden çocuğa yazma sırası; silme bunun tersi.
  --
  -- `ewalu_mesajlari` (0032) SONDA ve YABANCI ANAHTARI YOK — sırası
  -- serbest, kalabalık etmesin diye sona konuldu.
  tablolar text[] := array['siniflar','ogrenciler','giris_kodlari','odevler',
                           'gonderimler','mesajlar','dersler','odemeler',
                           'ewalu_mesajlari'];

  -- ESKİ YEDEKLER DE GERİ YÜKLENEBİLMELİ.
  --
  -- Aşağıdaki yapı denetimi, dizideki her tablonun dosyada BULUNMASINI
  -- şart koşuyor. 0032'den ÖNCE alınmış bir yedekte `ewalu_mesajlari`
  -- anahtarı yok; kural sıkı uygulansaydı öğretmenin elindeki mevcut
  -- yedek felaket gününde REDDEDİLİRDİ — tam da işe yarayacağı anda.
  --
  -- Bu yüzden 0032 ve sonrasında eklenen tablolar "isteğe bağlı": yoksa
  -- boş sayılıyor. Boş olması doğru sonucu veriyor — özel cümle yoksa
  -- Ewalu kodda duran varsayılanları söylüyor.
  --
  -- Sekiz çekirdek tablo İSTEĞE BAĞLI DEĞİL: biri eksikse dosya bozuktur
  -- ve hiçbir şeye dokunmadan reddedilir.
  istege_bagli text[] := array['ewalu_mesajlari'];
  t text;
  kolonlar text;
  n integer;
  toplam text := '';
begin
  -- Yapı denetimi ÖNCE. Bozuk ya da yarım bir dosyayla tabloları silmek,
  -- elde kalan tek kopyayı da yok etmek olurdu.
  if yedek is null then
    raise exception 'Yedek okunamadı: yapıştırdığınız metin geçerli JSON değil.';
  end if;

  -- `coalesce` ŞART. `jsonb_typeof(NULL)` NULL döner ve `NULL <> 'array'`
  -- de NULL'dur — yani `if` HİÇ TETİKLENMEZ. Bu denetim ilk yazılışında
  -- tam bu yüzden işe yaramıyordu: eksik tablolu bir dosya denetimden
  -- geçiyor, tablolar siliniyor ve o tablo SESSİZCE boş kalıyordu.
  -- Felaket provasında yakalandı.
  foreach t in array tablolar loop
    if coalesce(jsonb_typeof(yedek->t), 'yok') <> 'array' then
      -- İsteğe bağlı tablo eksikse dosya bozuk değil, yalnız ESKİ. Boş
      -- diziye tamamlanıyor; aşağıdaki yazma ve sayım döngüleri bunu
      -- normal bir "0 satır" gibi işliyor.
      if t = any(istege_bagli) then
        yedek := jsonb_set(yedek, array[t], '[]'::jsonb);
        raise notice 'Not: yedekte "%" yok (0032 öncesi dosya); boş kabul edildi.', t;
      else
        raise exception 'Bu dosya SEKİZ yedeği gibi görünmüyor: "%" tablosu eksik.', t;
      end if;
    end if;
  end loop;

  if not onayliyorum then
    raise exception E'ONAY GEREKİYOR.\n'
      '  Bu script şu tabloların TAMAMINI siler ve yedekten yazar:\n'
      '  siniflar, ogrenciler, giris_kodlari, odevler, gonderimler,\n'
      '  mesajlar, dersler, odemeler, ewalu_mesajlari.\n'
      '  Devam etmek için 2. ADIM''daki `onayliyorum` satırını true yapın.\n'
      '  Yedekte bulunan: % sınıf, % öğrenci, % ödev, % gönderim.',
      jsonb_array_length(yedek->'siniflar'),
      jsonb_array_length(yedek->'ogrenciler'),
      jsonb_array_length(yedek->'odevler'),
      jsonb_array_length(yedek->'gonderimler');
  end if;

  -- ---------------------------------------------------------------------------
  -- SİLME — yabancı anahtar sırasına göre, çocuktan ebeveyne.
  -- `okundu` ve `oturumlar` yedekte YOK ama `ogrenciler`e bağlılar; önce
  -- boşaltılmazlarsa öğrencileri silmek yabancı anahtara takılır.
  -- ---------------------------------------------------------------------------
  delete from public.okundu;
  delete from public.oturumlar;
  for i in reverse array_length(tablolar, 1) .. 1 loop
    execute format('delete from public.%I', tablolar[i]);
  end loop;

  -- ---------------------------------------------------------------------------
  -- YAZMA — ebeveynden çocuğa.
  --
  -- SÜTUN LİSTESİ ŞEMADAN OKUNUYOR, elle yazılmıyor. Sebebi ölçülmüş bir
  -- hata: `siniflar.ad` ÜRETİLMİŞ bir sütun (`generated always`) ve düz
  -- `insert ... select *` "cannot insert a non-DEFAULT value into column
  -- ad" ile patlıyor. Sütunları sabit yazsaydım ileride eklenen her
  -- üretilmiş sütun bu dosyayı yine bozardı; şemadan okumak bunu
  -- kendiliğinden doğru tutuyor.
  -- ---------------------------------------------------------------------------
  foreach t in array tablolar loop
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
      into kolonlar
      from information_schema.columns
     where table_schema = 'public' and table_name = t and is_generated = 'NEVER';

    execute format(
      'insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, $1)',
      t, kolonlar, kolonlar, t) using yedek->t;
    get diagnostics n = row_count;

    -- Sessizce eksik yazmak, felaket anında fark edilmeyen ikinci bir
    -- kayıp olurdu. Her tablo tek tek denetleniyor.
    -- `is distinct from`, `<>` DEĞİL: yedekte tablo yoksa
    -- `jsonb_array_length` NULL döner ve `0 <> NULL` yine NULL'dur.
    -- Yukarıdaki denetim bunu zaten eliyor; burada ikinci kez
    -- NULL'a karşı sağlamlaştırılıyor.
    if n is distinct from jsonb_array_length(yedek->t) then
      raise exception 'Geri yükleme eksik: "%" tablosuna % satır yazıldı, yedekte % var.',
        t, n, jsonb_array_length(yedek->t);
    end if;
    toplam := toplam || format('%s=%s ', t, n);
  end loop;

  raise notice 'GERİ YÜKLEME TAMAM — %', toplam;
  raise notice 'PIN yedekte yok: siteye girip yeniden belirleyin.';
  raise notice 'Çözüm fotoğrafları ve PDF''ler Storage''da kaldı; JSON onları geri getirmez.';
end $$;
