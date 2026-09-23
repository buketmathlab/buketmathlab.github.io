-- =============================================================================
-- SEKİZ — 0050: ÖĞRETMENE ATANAN SINIFLAR TESTLERİ
--
-- Bu dosyanın var olma sebebi bir CANLI HATA: Öğretmenler → "Sınıfları"
-- penceresi, atanmış sınıfları işaretsiz açıyordu. Ekranın işaretleyecek
-- verisi yoktu — uç yalnız bir SAYI döndürüyordu.
--
-- HATA YALNIZ "GÖSTERMİYOR" DEĞİLDİ. `ogretmen_sinif_ata` listeyi
-- değiştiriyor (delete + insert); hepsi işaretsiz açılan bir pencerede
-- "Kaydet" demek bütün atamayı siliyordu. Bu yüzden 5. grup o yolu
-- ayrıca ölçüyor.
--
-- İZOLASYON: kendi sınıflarını kuruyor (11A, 11B, 11C).
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text;
  v_ben uuid; v_o2 uuid; v_o3 uuid;
  s_a uuid; s_b uuid; s_c uuid;
  v jsonb; satir jsonb;
  idler jsonb;
begin
  -- ---------------------------------------------------------------------------
  -- Hazırlık
  -- ---------------------------------------------------------------------------
  update public.ogretmenler
     set pin_hash = extensions.crypt('SinifGor!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('SinifGor!2026'))->>'token';
  select id into v_ben from public.ogretmenler where yonetici;

  insert into public.siniflar (seviye, sube) values (11, 'A')
    on conflict (seviye, sube) do update set arsiv = false returning id into s_a;
  insert into public.siniflar (seviye, sube) values (11, 'B')
    on conflict (seviye, sube) do update set arsiv = false returning id into s_b;
  insert into public.siniflar (seviye, sube) values (11, 'C')
    on conflict (seviye, sube) do update set arsiv = false returning id into s_c;

  perform public.ogretmen_ekle(jt, 'Sinif Gorunur Bir', 'SinifBir!2026x');
  perform public.ogretmen_ekle(jt, 'Sinif Gorunur Iki', 'SinifIki!2026x');
  select id into v_o2 from public.ogretmenler where ad = 'Sinif Gorunur Bir';
  select id into v_o3 from public.ogretmenler where ad = 'Sinif Gorunur Iki';

  -- ---------------------------------------------------------------------------
  -- 1. ATAMA YAPILDIKTAN SONRA KİMLİKLER YANITTA
  --
  -- ASIL İDDİA BU: "alan var" değil, "atadığım sınıflar geliyor".
  -- ---------------------------------------------------------------------------
  perform public.ogretmen_sinif_ata(jt, v_o2, jsonb_build_array(s_a, s_c));

  v := public.ogretmenler_listesi(jt);
  select e into satir from jsonb_array_elements(v) e where e->>'id' = v_o2::text;
  if satir is null then
    raise exception '1: öğretmen listede yok';
  end if;
  idler := satir->'sinif_idler';

  if not (idler ? s_a::text) or not (idler ? s_c::text) then
    raise exception '1a: atanan sınıflar kimliklerde yok → %', idler;
  end if;
  if idler ? s_b::text then
    raise exception '1b: atanmayan sınıf kimliklerde var → %', idler;
  end if;
  raise notice '1 OK — atanan iki sınıf kimlikte var, atanmayan yok';

  -- ---------------------------------------------------------------------------
  -- 2. SAYI İLE DİZİ AYRIŞMIYOR
  --
  -- 0030'un dersi: iki ayrı hesap bir gün ayrışır. Ekran satırda SAYIYI,
  -- pencerede DİZİYİ kullanıyor; ikisi farklı derse öğretmen "3 sınıf"
  -- yazan bir satıra basıp iki işaretli kutucuk görür.
  -- ---------------------------------------------------------------------------
  if (satir->>'sinif_sayisi')::int <> jsonb_array_length(idler) then
    raise exception '2: sayı % ile dizi uzunluğu % tutmuyor',
      satir->>'sinif_sayisi', jsonb_array_length(idler);
  end if;
  raise notice '2 OK — sinif_sayisi ile sinif_idler uzunluğu aynı (%)',
    jsonb_array_length(idler);

  -- ---------------------------------------------------------------------------
  -- 3. BAŞKA ÖĞRETMENİN SINIFI KARIŞMIYOR
  --
  -- Arayüzdeki ikinci kusur tam buydu: seçim pencereler arasında
  -- taşınıyordu. Sunucu tarafında da ayrıştığını ölçüyoruz.
  -- ---------------------------------------------------------------------------
  perform public.ogretmen_sinif_ata(jt, v_o3, jsonb_build_array(s_b));

  v := public.ogretmenler_listesi(jt);
  select e into satir from jsonb_array_elements(v) e where e->>'id' = v_o2::text;
  if satir->'sinif_idler' ? s_b::text then
    raise exception '3a: ikinci öğretmenin sınıfı birincide göründü';
  end if;
  select e into satir from jsonb_array_elements(v) e where e->>'id' = v_o3::text;
  if not (satir->'sinif_idler' ? s_b::text)
     or jsonb_array_length(satir->'sinif_idler') <> 1 then
    raise exception '3b: ikinci öğretmenin kendi sınıfı gelmedi → %',
      satir->'sinif_idler';
  end if;
  raise notice '3 OK — her öğretmen yalnız kendi sınıflarını taşıyor';

  -- ---------------------------------------------------------------------------
  -- 4. HİÇ SINIFI OLMAYAN ÖĞRETMEN — boş DİZİ, null değil
  --
  -- Arayüz `sinif_idler.includes(...)` diyecek; `null` gelirse ekran
  -- çöker. Boş dizi olduğu ayrıca ölçülüyor.
  -- ---------------------------------------------------------------------------
  perform public.ogretmen_sinif_ata(jt, v_o3, '[]'::jsonb);
  v := public.ogretmenler_listesi(jt);
  select e into satir from jsonb_array_elements(v) e where e->>'id' = v_o3::text;
  if jsonb_typeof(satir->'sinif_idler') <> 'array' then
    raise exception '4a: sinif_idler dizi değil → %', jsonb_typeof(satir->'sinif_idler');
  end if;
  if jsonb_array_length(satir->'sinif_idler') <> 0 then
    raise exception '4b: boş olmalıydı → %', satir->'sinif_idler';
  end if;
  if (satir->>'sinif_sayisi')::int <> 0 then
    raise exception '4c: sayı sıfır olmalıydı → %', satir->>'sinif_sayisi';
  end if;
  raise notice '4 OK — sınıfı olmayan öğretmende boş dizi ve sıfır';

  -- ---------------------------------------------------------------------------
  -- 5. BOŞ LİSTEYLE KAYDETMEK GERÇEKTEN SİLİYOR
  --
  -- Bu bir KUSUR DEĞİL, ucun tanımlı davranışı — ve tam da bu yüzden
  -- ekranın kazara tetiklememesi gerekiyor. Burada davranışı KAYDA
  -- GEÇİRİYORUZ: arayüz bir gün ek onayı kaldırırsa, bu satır o onayın
  -- neden var olduğunu söylüyor.
  -- ---------------------------------------------------------------------------
  perform public.ogretmen_sinif_ata(jt, v_o2, jsonb_build_array(s_a, s_c));
  v := public.ogretmenler_listesi(jt);
  select e into satir from jsonb_array_elements(v) e where e->>'id' = v_o2::text;
  if jsonb_array_length(satir->'sinif_idler') <> 2 then
    raise exception '5a: kurulum bozuk';
  end if;

  perform public.ogretmen_sinif_ata(jt, v_o2, '[]'::jsonb);
  v := public.ogretmenler_listesi(jt);
  select e into satir from jsonb_array_elements(v) e where e->>'id' = v_o2::text;
  if jsonb_array_length(satir->'sinif_idler') <> 0 then
    raise exception '5b: boş listeyle kaydetmek silmedi — ucun sözleşmesi değişmiş';
  end if;
  raise notice '5 OK — boş listeyle kaydetmek bütün atamayı siliyor (bilinen davranış)';

  -- ---------------------------------------------------------------------------
  -- 6. KAPI: yalnız SAHİP
  -- ---------------------------------------------------------------------------
  declare patladi boolean := false; jt2 text;
  begin
    jt2 := (public.giris('SinifBir!2026x'))->>'token';
    begin
      perform public.ogretmenler_listesi(jt2);
    exception when others then patladi := true;
    end;
    if not patladi then
      raise exception '6: sahip olmayan öğretmen listeyi okuyabildi';
    end if;
    raise notice '6 OK — sahip olmayan öğretmen reddediliyor';
  end;

  raise notice '';
  raise notice 'ÖĞRETMEN SINIFLARI TESTLERİ: 6 GRUP GEÇTİ';
end $$;
