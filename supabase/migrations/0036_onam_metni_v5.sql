-- =============================================================================
-- 0036 — ONAM METNİ SÜRÜM 5
--
-- NE DÜZELTİLDİ
-- Metin "Okulun adı SEKİZ'de hiçbir yerde saklanmıyor" diyordu. Öğretmen
-- fark etti: "ama logoda var." HAKLIYDI ve yanlışı ben yazmıştım.
--
--   * `SchoolCrest.tsx` mührün `alt` metninde okulun TAM adını taşıyor.
--   * `GirisEkrani.tsx` giriş ekranında, mührün hemen altında, okulun
--     adını GÖRÜNÜR METİN olarak yazıyor.
--
-- Yani okulun adı her velinin İLK GÖRDÜĞÜ ekranda yazılı.
--
-- Doğru olan gözlem şuydu: şemada okul adı diye bir alan yok — `siniflar`
-- yalnız `seviye` + `sube` tutuyor. Yani okul adı ÇOCUĞUN KAYDINA
-- yazılmıyor. Ama bunu "hiçbir yerde saklanmıyor" diye genellemek fazla
-- iddialıydı ve veliye yanlış bilgi veriyordu. Metin artık ikisini
-- ayırıyor.
--
-- DAHA ÖNEMLİ DERS: testler o yanlış cümleyi KİLİTLİYORDU
-- (`toContain('Okulun adı ... hiçbir yerde saklanmıyor')`). Bir ölçüm
-- yanlış bir iddiayı koruduğunda kusuru bulmaz, GİZLER. Testler bu turda
-- düzeltildi; artık `SchoolCrest.tsx` dosyadan okunup metnin bu
-- görünürlüğü inkâr ETMEDİĞİ ölçülüyor.
--
-- NEDEN YENİ DOSYA
-- 0035 canlıda ÇALIŞTIRILDI. Çalışmış bir migration düzenlenmez: dosyayla
-- veritabanı arasında sessiz bir ayrışma bırakır. (0035 kendisi yerinde
-- düzeltilebilmişti, çünkü o sırada hiçbir veritabanı onu uygulamamıştı.)
--
-- Bu dosya tek başına da doğru sonucu verir: içeriği yalnız bir
-- `create or replace`. 0035 çalışmamış olsa bile sürüm doğru yere oturur.
--
-- BU MIGRATION ÇALIŞTIĞI AN
-- Önceki sürümü onaylamış veliler onam ekranını BİR KEZ DAHA görür ve
-- yeni metni onaylar. Eski onay satırları SİLİNMİYOR.
--
-- YAYIN SIRASI: ÖNCE SİTE, SONRA BU DOSYA. Tersi olsaydı bütün veliler
-- kapının arkasında kalırdı; bu sırada yalnız henüz onay vermemiş veli,
-- kısa bir pencerede "Onam metni güncellenmiş" uyarısı görür.
--
-- Yeni tablo, yeni yetki, yeni kapı YOK.
-- =============================================================================

create or replace function public._gecerli_onam_surumu()
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select '2026-09-5'::text;
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
  if public._gecerli_onam_surumu() <> '2026-09-5' then
    eksik := eksik || ('sürüm hâlâ ' || public._gecerli_onam_surumu())::text;
  end if;

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
    raise exception '0036 EKSİK KALDI: %', array_to_string(eksik, ' | ');
  end if;

  raise notice '0036 tamam — onam metni sürümü %; bu sürümü onaylamamış '
               'veliler metni bir kez daha görecek.', public._gecerli_onam_surumu();
end;
$$;
