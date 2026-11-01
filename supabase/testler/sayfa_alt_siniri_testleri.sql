-- =============================================================================
-- SEKİZ — ÇÖZÜM SAYFASINDA ALT SINIR KALKTI (0087)
--
-- Öğretmenin isteği: "Çözüm sayfası EN FAZLA gönderdiğim soru kağıdının
-- sayfası kadar olsun. Fakat ALT SINIR OLMASIN."
--
-- Ölçülen:
--   1. 5 sayfalık ödeve 2 sayfa gönderiliyor (0078'de hata veriyordu)
--   2. 1 sayfa da gönderiliyor; çözüm fotoğrafsız gönderim HÂLÂ reddediliyor
--   3. ÜST SINIR DURUYOR: 6 sayfa reddediliyor
--   4. Yeni ödev `tum_sayfalar = false` doğuyor
--   5. Sayfa sayısı düzenlenince bayrak DİRİLMİYOR
--   6. Yayma ve kopyalama bayrağı taşımıyor (o iki uç bilerek
--      kopyalanmadı — bu grup o kararı sınıyor)
--   7. BAYRAK ARTIK GÜÇSÜZ: elle `true` yapılsa bile 2 sayfa geçiyor
--   8. Gerileme kapıları: sayfa SIRASI, 0082 deneme yolu, 0086 çalışma
--      kağıdı puansızlığı
--   9. Zincirin sonu 0087
--
-- Tekrar çalıştırılabilir. Hiçbir blokta `exception when others` YOK.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  ek text := substr(md5(random()::text), 1, 6);
  jt text; jo text;
  s_id uuid; v_sinif uuid; v_sinif2 uuid; o_id uuid;
  d5 uuid; d1 uuid; d6 uuid; d_yeni uuid; d_kopya uuid; d_cal uuid;
  v jsonb; n integer; hata text; v_yol text;
begin
  raise notice '--- Kurulum ---';
  update public.ogretmenler
     set pin_hash = extensions.crypt('Sayfa!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Sayfa!2026'))->>'token';
  select id into s_id from public.ogretmenler where yonetici;

  insert into public.siniflar (seviye, sube) values (10, 'S')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_sinif;
  insert into public.siniflar (seviye, sube) values (10, 'T')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_sinif2;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    values (s_id, v_sinif), (s_id, v_sinif2) on conflict do nothing;

  delete from public.gonderimler
   where odev_id in (select id from public.odevler where sinif_id in (v_sinif, v_sinif2));
  delete from public.denetim_izi
   where tablo = 'odevler'
     and kayit_id in (select id from public.odevler where sinif_id in (v_sinif, v_sinif2));
  delete from public.odevler where sinif_id in (v_sinif, v_sinif2);
  delete from public.giris_kodlari
   where ogrenci_id in (select id from public.ogrenciler where sinif_id in (v_sinif, v_sinif2));
  delete from public.ogrenciler where sinif_id in (v_sinif, v_sinif2);

  o_id := (public.ogrenci_ekle(jt, 'Sayfa Öğrencisi ' || ek, 'okul', v_sinif))->>'id';
  jo := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = o_id and rol = 'ogrenci')))->>'token';

  -- ===========================================================================
  raise notice '--- 1. Beş sayfalık ödeve iki sayfa ---';
  -- ===========================================================================
  d5 := (public.odev_olustur(jt, 'Beş sayfa ' || ek, null, v_sinif, 'acik',
    current_date + 7, null, null, null, null, true, 5::smallint, null, 5::smallint))->>'id';
  perform public.odev_yayinla(jt, d5);

  v_yol := 'cozum/' || d5 || '/' || o_id;
  v := public.odev_gonder(jo, d5, v_yol || '.jpg', null,
                          array[v_yol || '-2.jpg']);
  if v->>'id' is null then
    raise exception '1a BAŞARISIZ — iki sayfalık gönderim kabul edilmedi';
  end if;
  if (select array_length(ek_sayfa_yollari, 1) from public.gonderimler
       where odev_id = d5 and ogrenci_id = o_id) <> 1 then
    raise exception '1b BAŞARISIZ — ek sayfa kaydedilmedi';
  end if;
  raise notice '1 OK — 5 sayfalık ödeve 2 sayfa gönderildi';

  -- ===========================================================================
  raise notice '--- 2. Tek sayfa geçiyor, fotoğrafsız geçmiyor ---';
  -- ===========================================================================
  d1 := (public.odev_olustur(jt, 'Tek sayfa ' || ek, null, v_sinif, 'acik',
    current_date + 7, null, null, null, null, true, 5::smallint, null, 4::smallint))->>'id';
  perform public.odev_yayinla(jt, d1);
  v := public.odev_gonder(jo, d1, 'cozum/' || d1 || '/' || o_id || '.jpg');
  if v->>'id' is null then
    raise exception '2a BAŞARISIZ — 4 sayfalık ödeve tek sayfa kabul edilmedi';
  end if;

  -- EN AZ BİR SAYFA ŞART. Bu ayrı bir "alt sınır" değil: çözüm
  -- fotoğrafı olmadan ortada gönderilecek bir şey yok.
  d6 := (public.odev_olustur(jt, 'Fotoğrafsız ' || ek, null, v_sinif, 'acik',
    current_date + 7, null, null, null, null, true, 5::smallint, null, 3::smallint))->>'id';
  perform public.odev_yayinla(jt, d6);
  begin
    perform public.odev_gonder(jo, d6, null);
    raise exception '2b BAŞARISIZ — fotoğrafsız gönderim kabul edildi';
  exception when sqlstate '22023' then
    get stacked diagnostics hata = message_text;
    if hata not like '%Çözüm fotoğrafı olmadan%' then
      raise exception '2b BAŞARISIZ — yanlış gerekçe: %', hata;
    end if;
  end;
  raise notice '2 OK — tek sayfa geçiyor, fotoğrafsız gönderim reddediliyor';

  -- ===========================================================================
  raise notice '--- 3. Üst sınır duruyor ---';
  -- ===========================================================================
  -- Kaldırılan kuralın YANINDAKİ kural. Bu olmadan 1. grup, "hiçbir
  -- sayfa denetimi kalmadı" durumunda da yeşil yanardı.
  v_yol := 'cozum/' || d6 || '/' || o_id;
  begin
    perform public.odev_gonder(jo, d6, v_yol || '.jpg', null,
      array[v_yol || '-2.jpg', v_yol || '-3.jpg', v_yol || '-4.jpg']);
    raise exception '3 BAŞARISIZ — 3 sayfalık ödeve 4 sayfa kabul edildi';
  exception when sqlstate '22023' then
    get stacked diagnostics hata = message_text;
    if hata not like '%en fazla%sayfa gönderilebilir%' then
      raise exception '3 BAŞARISIZ — yanlış gerekçe: %', hata;
    end if;
  end;
  raise notice '3 OK — üst sınır hâlâ uygulanıyor';

  -- ===========================================================================
  raise notice '--- 4. Yeni ödev alt sınırsız doğuyor ---';
  -- ===========================================================================
  d_yeni := (public.odev_olustur(jt, 'Yeni ödev ' || ek, null, v_sinif, 'acik',
    current_date + 7, null, null, null, null, true, 5::smallint, null, 6::smallint))->>'id';
  if (select tum_sayfalar from public.odevler where id = d_yeni) then
    raise exception '4 BAŞARISIZ — yeni ödev bayrağı true doğdu';
  end if;
  raise notice '4 OK — yeni ödevde bayrak kapalı';

  -- ===========================================================================
  raise notice '--- 5. Sayfa sayısı düzenlemesi bayrağı diriltmiyor ---';
  -- ===========================================================================
  -- 0079'un satırı (`tum_sayfalar = (d.tum_sayfalar or p_sayfa_limiti is
  -- not null)`) kalsaydı, tek bir düzenleme kuralı geri getirirdi.
  perform public.odev_guncelle(jt, d_yeni, 'Yeni ödev ' || ek, null,
                               v_sinif, current_date + 7, null, null, null, null,
                               null, null, null, 3::smallint);
  if (select tum_sayfalar from public.odevler where id = d_yeni) then
    raise exception '5a BAŞARISIZ — düzenleme bayrağı diriltti';
  end if;
  if (select sayfa_limiti from public.odevler where id = d_yeni) <> 3 then
    raise exception '5b BAŞARISIZ — sayfa sayısı yazılmadı';
  end if;
  raise notice '5 OK — düzenleme sayfa sayısını yazıyor, bayrağı diriltmiyor';

  -- ===========================================================================
  raise notice '--- 6. Yayma ve kopyalama bayrağı taşımıyor ---';
  -- ===========================================================================
  -- `odev_kardeslere_yay` ve `odev_siniflara_kopyala` BİLEREK
  -- kopyalanmadı: ikisi de bayrağı kaynaktan alıyor ve kaynak artık hep
  -- false. Bu grup o kararın doğruluğunu sınıyor.
  v := public.odev_siniflara_kopyala(jt, d_yeni, jsonb_build_array(v_sinif2::text),
                                     current_date + 10);
  d_kopya := ((v->'odevler')->0->>'odev_id')::uuid;
  if (select tum_sayfalar from public.odevler where id = d_kopya) then
    raise exception '6a BAŞARISIZ — kopyada bayrak açık';
  end if;
  if (select sayfa_limiti from public.odevler where id = d_kopya) <> 3 then
    raise exception '6b BAŞARISIZ — kopyaya sayfa sayısı taşınmadı: %',
      (select sayfa_limiti from public.odevler where id = d_kopya);
  end if;
  raise notice '6 OK — kopyada bayrak kapalı, sayfa sayısı taşındı';

  -- ===========================================================================
  raise notice '--- 7. Bayrak artık güçsüz ---';
  -- ===========================================================================
  -- Veriyi temizlemek tek başına yetmez: kural KODDAN da gitmeli. Bayrak
  -- elle açılıyor ve eksik sayfalı gönderim yine geçmeli.
  update public.odevler set tum_sayfalar = true where id = d1;
  v_yol := 'cozum/' || d1 || '/' || o_id;
  delete from public.gonderimler where odev_id = d1 and ogrenci_id = o_id;
  v := public.odev_gonder(jo, d1, v_yol || '.jpg', null, array[v_yol || '-2.jpg']);
  if v->>'id' is null then
    raise exception '7 BAŞARISIZ — bayrak açıkken eksik sayfa reddedildi';
  end if;
  update public.odevler set tum_sayfalar = false where id = d1;
  raise notice '7 OK — bayrak açıkken bile 4 sayfalık ödeve 2 sayfa geçiyor';

  -- ===========================================================================
  raise notice '--- 8. Gerileme kapıları ---';
  -- ===========================================================================
  -- 8a — SAYFA SIRASI: 2. sayfa `-2` ekini taşımak zorunda.
  v_yol := 'cozum/' || d5 || '/' || o_id;
  delete from public.gonderimler where odev_id = d5 and ogrenci_id = o_id;
  begin
    perform public.odev_gonder(jo, d5, v_yol || '.jpg', null,
                               array[v_yol || '-3.jpg']);
    raise exception '8a BAŞARISIZ — sıra atlayan sayfa kabul edildi';
  exception when sqlstate '42501' then
    null;
  end;

  -- 8b — 0082: başka öğrencinin yolu reddediliyor.
  begin
    perform public.odev_gonder(jo, d5, 'cozum/' || d5 || '/' || s_id || '.jpg');
    raise exception '8b BAŞARISIZ — başkasının yolu kabul edildi';
  exception when sqlstate '42501' then
    null;
  end;

  -- 8c — 0086: çalışma kağıdı hâlâ puansız ve tek sayfayla gönderilebiliyor.
  d_cal := (public.odev_olustur(jt, 'Çalışma ' || ek, null, v_sinif, 'calisma',
    current_date + 7, null, null, null, null, true, 5::smallint, null, 4::smallint))->>'id';
  perform public.odev_yayinla(jt, d_cal);
  v := public.odev_gonder(jo, d_cal, 'cozum/' || d_cal || '/' || o_id || '.jpg');
  if v->>'durum' <> 'tamamlandi' then
    raise exception '8c BAŞARISIZ — çalışma kağıdı dalı bozuldu: %', v::text;
  end if;
  if (select puan from public.gonderimler where odev_id = d_cal and ogrenci_id = o_id)
       is not null then
    raise exception '8c BAŞARISIZ — çalışma kağıdına puan yazıldı';
  end if;
  raise notice '8 OK — sıra, yol sahipliği ve çalışma kağıdı bozulmadı';

  -- ===========================================================================
  raise notice '--- 9. Zincirin sonu ---';
  -- ===========================================================================
  select count(*) into n from public.uygulanan_migrationlar where dosya = '0087';
  if n <> 1 then
    raise exception '9 BAŞARISIZ — 0087 kaydı yok';
  end if;
  raise notice '9 OK — zincir 0087''de';

  raise notice '=== 0087 sayfa alt sınırı: 9 grubun hepsi geçti ===';
end $$;

-- =============================================================================
-- KUSUR PROVALARI — altısının da ısırdığı doğrulandı
--
--   A. Alt sınır dalı `odev_gonder`'e geri kondu
--      → "Bu ödev 4 sayfa; her sayfanın çözümünü eklemelisin (2 sayfa
--        eksik)." 1. grup ısırdı.
--   B. ÜST sınır da kaldırıldı
--      → ısırdı, ama mesaj "Geçersiz dosya yolu". ÖĞRETİCİ: üst sınır İKİ
--        yerde duruyor — `odev_gonder`'in kendi kapısı ve
--        `_cozum_yolu_gecerli`'nin yol kalıbı. Birini silmek gönderimi
--        yine engelliyor, yalnız öğrenciye yanlış sebep söyleniyor.
--   C. `odev_olustur` yine bayrağı açıyor → 4. grup.
--   D. `odev_guncelle` bayrağı yine diriltiyor → 5. grup.
--   E. Eski satırları temizleyen güncelleme kaldırıldı
--      → İLK DENEMEDE ISIRMADI ve sebebi koşum takımındaydı: o anki test
--        veritabanında bayrağı açık satır KALMAMIŞTI, dolayısıyla
--        temizlenecek bir şey yoktu. Bir satırın bayrağı elle açılıp
--        prova tekrarlandığında öz-denetim ısırdı: "bazı ödevlerde bayrak
--        hâlâ açık".
--   F. Sayfa SIRASI kuralı bozuldu
--      → İlk yama regex'in tırnaklarını bozup SQL'i geçersiz kıldı; o bir
--        prova değil, koşum takımı arızasıydı. `(i + 1)` yerine `i`
--        yazılarak tekrarlandı ve ölçüm ısırdı.
--
-- İKİ DERS, AÇIKÇA: bir prova ısırmadığında önce KOŞUM TAKIMINA bakılıyor
-- (E ve F'nin ikisi de oradan çıktı), ve bir kuralın tek yerde durduğu
-- varsayılmıyor (B).
-- =============================================================================
