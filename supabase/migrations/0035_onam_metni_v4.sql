-- =============================================================================
-- 0035 — ONAM METNİ SÜRÜM 4
--
-- NEDEN AYRI BİR MIGRATION
-- 0034 CANLIDA ÇALIŞTIRILDI. Çalışmış bir migration'ı düzenlemek, o
-- dosyayı çalıştırmış bir veritabanıyla depodaki hâli arasında sessiz bir
-- ayrışma bırakır: dosya bir şey söyler, veritabanı başka şey yapar.
-- Sürüm sabiti bu yüzden yeni bir dosyada değişiyor.
--
-- NE DEĞİŞTİ
--
-- SÜRÜM 4 — FOTOĞRAF CÜMLESİ. Öğretmen metni okuyup sordu: "çözüm
-- fotoğrafları 60 saniye geçerli bir bağlantıyla açılıyor — yani öğretmen
-- ödev kâğıdına sadece altmış saniye mi bakabilecek?" Hayır: o süre
-- BAĞLANTININ ÖMRÜ, bakma süresi değil. Ekranlar fotoğrafı her açışta
-- yeniden adresliyor (`dosyaAdresi()`), öğretmen dilediği kadar bakıyor.
-- Ama cümle ürünün SAHİBİNİ yanılttıysa veliyi de yanıltır; rakam
-- metinden çıktı, cümle ne olduğunu ve ne OLMADIĞINI birlikte söylüyor.
--
-- Bu dosya önce sürüm 3 için yazılmıştı ve HİÇ ÇALIŞTIRILMADI — ne
-- canlıda ne öğretmende. O yüzden yeni bir 0036 açmak yerine yerinde
-- düzeltildi: öğretmen tek bir SQL çalıştırıyor. (0034 farklıydı, o
-- canlıda çalışmıştı ve düzenlenemezdi.)
--
-- SÜRÜM 3 — öğretmen dört düzeltme istemişti; üçü SİLME:
--   * "Özel ders alıyorsa ders planı ve ödeme kaydı." satırı
--   * "Cevap anahtarı veliye hiçbir zaman gösterilmez." cümlesi
--   * "Yapay zekâ" bölümünün tamamı
-- Dördüncüsü DÜZELTME: "Kim görebiliyor" kısmı "matematik zümresindeki
-- öğretmenler — dört kişi" diyordu, bu YANLIŞTI. Doğrusu 0033'ün kapsam
-- kuralı: her öğretmen yalnız KENDİ sınıflarındaki öğrenciyi görüyor
-- (`_ogretmenin_ogrencisi`), sahip ise yönetim için hepsini
-- (`_yonetici`). Metin artık bunu söylüyor.
--
-- Kural 5 (test puanlamasında yapay zekâ yok) ve Kural 6 (veli cevap
-- anahtarını görmez) ÜRÜNE ait ve yerlerinde duruyor; yalnız onam metni
-- artık onlardan söz etmiyor. Ölçümleri `guvenlik_testleri.sql` 8. ve 10.
-- gruplarında devam ediyor.
--
-- BU MIGRATION ÇALIŞTIĞI AN
--
-- AYNI ZAMANDA AÇIK BİR PENCEREYİ KAPATIYOR: site `2026-09-4` sürümünü
-- gösterirken veritabanı hâlâ `2026-09-2` beklediği için onam vermemiş
-- veliler onaylayamıyor ("Onam metni güncellenmiş"). Bu dosya çalıştığı
-- an ikisi eşitleniyor.
--
-- `2026-09-2`'yi onaylamış veliler onam ekranını BİR KEZ DAHA görür ve
-- yeni metni onaylar. İstenen davranış bu: metin değiştiğinde eski onayın
-- yeni metni sessizce kapsamaması için sürüm var. Eski onay satırları
-- SİLİNMİYOR — "hangi metni, ne zaman onayladı" kaydı duruyor.
--
-- YAYIN SIRASI (öğretmene ayrıca söylendi): ÖNCE SİTE, SONRA BU DOSYA.
-- Tersi olsaydı bütün veliler kapının arkasında kalır ve hiçbiri onay
-- veremezdi; bu sırada yalnız henüz onay vermemiş veli, birkaç dakikalık
-- pencerede "Onam metni güncellenmiş" uyarısı görür.
--
-- Yeni tablo, yeni yetki, yeni kapı YOK. 0034'ün kurduğu her şey yerinde.
-- =============================================================================

create or replace function public._gecerli_onam_surumu()
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select '2026-09-4'::text;
$$;

-- -----------------------------------------------------------------------------
-- KENDİ KENDİNİ DOĞRULAMA
--
-- `create or replace` sessizce eski tanımı bırakabilir; sürümün GERÇEKTEN
-- değiştiği ve 0034'ün kurduğu düzenin bozulmadığı ölçülüyor.
-- -----------------------------------------------------------------------------
do $$
declare
  eksik text[] := '{}';
begin
  if public._gecerli_onam_surumu() <> '2026-09-4' then
    eksik := eksik || ('sürüm hâlâ ' || public._gecerli_onam_surumu())::text;
  end if;

  -- 0034'ün kurduğu düzen yerinde mi (bu dosya yanlış sırada
  -- çalıştırılırsa erken ve anlaşılır bir hata versin).
  if to_regclass('public.veli_onaylari') is null then
    eksik := eksik || 'veli_onaylari yok — önce 0034 çalıştırılmalı'::text;
  end if;
  if not has_function_privilege('anon', 'public.onam_ver(text, text)', 'execute') then
    eksik := eksik || 'onam_ver anon''a kapalı'::text;
  end if;
  if has_function_privilege('anon', 'public._gecerli_onam_surumu()', 'execute') then
    eksik := eksik || '_gecerli_onam_surumu anon''a açık kalmış'::text;
  end if;

  if array_length(eksik, 1) is not null then
    raise exception '0035 EKSİK KALDI: %', array_to_string(eksik, ' | ');
  end if;

  raise notice '0035 tamam — onam metni sürümü %; bu sürümü onaylamamış '
               'veliler metni bir kez daha görecek.', public._gecerli_onam_surumu();
end;
$$;
