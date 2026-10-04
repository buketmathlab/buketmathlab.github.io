-- =============================================================================
-- SEKİZ — 0065: ÖĞRETMENİN GENEL SAYFASI ve TEK YÖNLÜ DUYURU
--
--  1. okul_geneli: öğretmen alıyor; müdür, öğrenci ve veli 42501 alıyor.
--     okul / seviyeler / aylar `mudur_paneli` ile BİREBİR aynı; öğretmene
--     öğretmen listesi ve şube kartlarındaki öğretmen adları gitmiyor.
--  2. Duyuru seçilen şubelerin öğrencisine gidiyor; başka şubeye gitmiyor.
--     Veli görmüyor (veli ucu yok; öğrenci ucu veli jetonunu reddediyor).
--  3. Yazma kuralları: kendi şubesi olmayan, arşivdeki şube, özel ders grubu
--     (yönetici dışında), boş şube listesi, boş ve 1000'den uzun metin
--     reddediliyor; vekâletle yazılamıyor; müdür ve öğrenci yazamıyor.
--  4. Okundu: `okunmamis_duyuru` (ogrenci_odevleri) ve "yeni" doğru;
--     `duyurulari_okudum` sonrası sıfır; öğretmende "gören" sayısı doğru.
--  5. Kaldırma: yalnız yazan öğretmen; kaldırılan öğrencide görünmüyor.
--  6. Sınıfa sonradan gelen öğrenci, gelmeden önceki duyuruyu görmüyor;
--     30 günden eski duyuru görünmüyor.
--
-- İZOLASYON: kendi sınıflarını (12DA, 12DB, 12DC) kuruyor; önceki koşunun
-- öğrencileri pasif, duyuruları kaldırılmış sayılıyor.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text; jd text; jm text; jo_a text; jo_b text; jv_a text; jvek text; jo_yeni text;
  s_a uuid; s_b uuid; s_c uuid; s_ozel uuid;
  v_duy uuid; v_mudur uuid;
  o_a1 uuid; o_a2 uuid; o_b1 uuid; o_yeni uuid;
  d1 uuid; d2 uuid; d_eski uuid;
  v jsonb; m jsonb; x jsonb;
  ek text := to_char(clock_timestamp(), 'HH24MISSUS');
  hata text;
begin
  update public.ogretmenler
     set pin_hash = extensions.crypt('Duyuru!Sahip26', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Duyuru!Sahip26'))->>'token';

  if not exists (select 1 from public.ogretmenler where ad = 'Duyuru Öğretmeni') then
    perform public.ogretmen_ekle(jt, 'Duyuru Öğretmeni', 'DuyuruOgr!26');
  end if;
  select id into v_duy from public.ogretmenler where ad = 'Duyuru Öğretmeni';
  jd := (public.giris('DuyuruOgr!26'))->>'token';

  if not exists (select 1 from public.ogretmenler where ad = 'Duyuru Müdürü') then
    perform public.mudur_ekle(jt, 'Duyuru Müdürü', 'DuyuruMudur!26');
  end if;
  jm := (public.giris('DuyuruMudur!26'))->>'token';

  s_a := (public.sinif_ekle(jt, 12::smallint, 'DA'))->>'id';
  s_b := (public.sinif_ekle(jt, 12::smallint, 'DB'))->>'id';
  s_c := (public.sinif_ekle(jt, 12::smallint, 'DC'))->>'id';
  update public.siniflar set arsiv = false where id in (s_a, s_b, s_c);
  update public.ogrenciler set aktif = false where sinif_id in (s_a, s_b, s_c);
  update public.duyurular set kaldirildi = now()
   where kaldirildi is null
     and id in (select duyuru_id from public.duyuru_siniflari where sinif_id in (s_a, s_b, s_c));
  select id into s_ozel from public.siniflar where ozel limit 1;
  -- Duyuru öğretmeni 12DA ve 12DB'de; 12DC'de değil.
  perform public.ogretmen_sinif_ata(jt, v_duy, jsonb_build_array(s_a::text, s_b::text));

  o_a1 := (public.ogrenci_ekle(jt, 'Ada Bir ' || ek, 'okul', s_a))->>'id';
  o_a2 := (public.ogrenci_ekle(jt, 'Ada İki ' || ek, 'okul', s_a))->>'id';
  o_b1 := (public.ogrenci_ekle(jt, 'Bora Bir ' || ek, 'okul', s_b))->>'id';
  update public.ogrenciler set sinif_giris = null where id in (o_a1, o_a2, o_b1);
  jo_a := (public.giris((select kod from public.giris_kodlari where ogrenci_id = o_a1 and rol = 'ogrenci')))->>'token';
  jo_b := (public.giris((select kod from public.giris_kodlari where ogrenci_id = o_b1 and rol = 'ogrenci')))->>'token';
  jv_a := (public.giris((select kod from public.giris_kodlari where ogrenci_id = o_a1 and rol = 'veli')))->>'token';
  perform public.onam_ver(jv_a, public._gecerli_onam_surumu(), 'Test Velisi');

  -- ---------------------------------------------------------------------------
  -- 1. okul_geneli
  -- ---------------------------------------------------------------------------
  v := public.okul_geneli(jd);
  m := public.mudur_paneli(jm);
  if v->'okul' <> m->'okul' or v->'seviyeler' <> m->'seviyeler' or v->'aylar' <> m->'aylar'
     or v->'yil_baslangici' <> m->'yil_baslangici' then
    raise exception '1a: okul_geneli müdürün hesabından farklı';
  end if;
  if jsonb_array_length(v->'siniflar') <> jsonb_array_length(m->'siniflar') then
    raise exception '1b: şube sayısı farklı';
  end if;
  if v ? 'ogretmenler' or exists (select 1 from jsonb_array_elements(v->'siniflar') k where k ? 'ogretmenler') then
    raise exception '1c: öğretmene öğretmen listesi gitti';
  end if;
  foreach hata in array array[jm, jo_a, jv_a] loop
    begin
      perform public.okul_geneli(hata);
      raise exception '1d: okul_geneli yanlış role açıldı';
    exception when insufficient_privilege then null;
    end;
  end loop;
  raise notice '1 OK — okul_geneli: müdürle aynı rakamlar, öğretmen listesi yok; müdür/öğrenci/veli 42501';

  -- ---------------------------------------------------------------------------
  -- 2. Duyuru yalnız seçilen şubeye
  -- ---------------------------------------------------------------------------
  d1 := (public.duyuru_yayinla(jd, E'  Yarın okul tatil.\nDers yok.  ', array[s_a]))->>'id';
  v := public.ogrenci_duyurulari(jo_a);
  if jsonb_array_length(v) <> 1 or v->0->>'metin' <> E'Yarın okul tatil.\nDers yok.'
     or v->0->>'ogretmen' <> 'Duyuru Öğretmeni' or not (v->0->>'yeni')::boolean then
    raise exception '2a: 12DA öğrencisi duyuruyu doğru görmüyor: %', v;
  end if;
  if jsonb_array_length(public.ogrenci_duyurulari(jo_b)) <> 0 then
    raise exception '2b: 12DB öğrencisi 12DA duyurusunu gördü';
  end if;
  begin
    perform public.ogrenci_duyurulari(jv_a);
    raise exception '2c: veli duyuruları okudu';
  exception when insufficient_privilege then null;
  end;
  -- Birden çok şube; tekrar eden şube bir kez.
  d2 := (public.duyuru_yayinla(jd, 'İki şubeye', array[s_a, s_b, s_a]))->>'id';
  if (select count(*) from public.duyuru_siniflari where duyuru_id = d2) <> 2 then
    raise exception '2d: tekrar eden şube iki kez yazıldı';
  end if;
  if jsonb_array_length(public.ogrenci_duyurulari(jo_b)) <> 1
     or jsonb_array_length(public.ogrenci_duyurulari(jo_a)) <> 2 then
    raise exception '2e: çok şubeli duyuru yanlış dağıldı';
  end if;
  raise notice '2 OK — duyuru yalnız seçilen şubelere; veli göremiyor; tekrar eden şube bir kez';

  -- ---------------------------------------------------------------------------
  -- 3. Yazma kuralları
  -- ---------------------------------------------------------------------------
  begin
    perform public.duyuru_yayinla(jd, 'x', array[s_c]);
    raise exception '3a: başka öğretmenin şubesine yazıldı';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.duyuru_yayinla(jd, 'x', array[s_ozel]);
    raise exception '3b: öğretmen özel ders grubuna yazdı';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.duyuru_yayinla(jd, 'x', array[gen_random_uuid()]);
    raise exception '3c: olmayan şubeye yazıldı';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.duyuru_yayinla(jd, 'x', array[]::uuid[]);
    raise exception '3d: şubesiz duyuru';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.duyuru_yayinla(jd, E' \n\t ', array[s_a]);
    raise exception '3e: boş duyuru';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.duyuru_yayinla(jd, repeat('a', 1001), array[s_a]);
    raise exception '3f: 1000 karakterden uzun duyuru';
  exception when invalid_parameter_value then null;
  end;
  perform public.duyuru_yayinla(jd, repeat('a', 1000), array[s_a]);
  update public.siniflar set arsiv = true where id = s_b;
  begin
    perform public.duyuru_yayinla(jd, 'x', array[s_b]);
    raise exception '3g: arşivdeki şubeye yazıldı';
  exception when invalid_parameter_value then null;
  end;
  update public.siniflar set arsiv = false where id = s_b;
  jvek := (public.ogretmen_olarak_gir(jt, v_duy))->>'token';
  begin
    perform public.duyuru_yayinla(jvek, 'x', array[s_a]);
    raise exception '3h: vekâletle duyuru yazıldı';
  exception when insufficient_privilege then null;
  end;
  foreach hata in array array[jm, jo_a, jv_a] loop
    begin
      perform public.duyuru_yayinla(hata, 'x', array[s_a]);
      raise exception '3i: öğretmen olmayan duyuru yazdı';
    exception when insufficient_privilege then null;
    end;
  end loop;
  -- Yönetici özel ders grubuna yazabiliyor (öğrenci sahipliği kuralı).
  perform public.duyurulari_okudum(jo_a);
  x := public.duyuru_yayinla(jt, 'Özel ders duyurusu', array[s_ozel]);
  update public.duyurular set kaldirildi = now() where id = (x->>'id')::uuid;
  if not exists (select 1 from public.denetim_izi where tablo = 'duyurular' and kayit_id = d1
                   and islem = 'duyuru_yayinlandi') then
    raise exception '3j: denetim izi yok';
  end if;
  raise notice '3 OK — başka/arşiv/olmayan şube, özel grup, boş, uzun, vekâlet, müdür/öğrenci/veli reddedildi; yönetici özel gruba yazabiliyor; denetim izi var';

  -- ---------------------------------------------------------------------------
  -- 4. Okundu ve "gören"
  -- ---------------------------------------------------------------------------
  -- Test tek işlemde koşuyor ve `now()` sabit; gerçek hayattaki zaman
  -- sırası elle kuruluyor: önceki duyurular 2 dk önce, Ada Bir'in "gördüm"ü
  -- 1 dk önce (yukarıda okudu), yeni duyuru şimdi.
  update public.duyurular set created_at = now() - interval '2 minutes'
   where kaldirildi is null
     and id in (select duyuru_id from public.duyuru_siniflari where sinif_id in (s_a, s_b));
  update public.duyuru_okundu set zaman = now() - interval '1 minute' where ogrenci_id = o_a1;
  perform public.duyuru_yayinla(jd, 'Okundu deneme', array[s_a, s_b]);
  if (public.ogrenci_odevleri(jo_a)->>'okunmamis_duyuru')::int <> 1
     or (public.ogrenci_odevleri(jo_b)->>'okunmamis_duyuru')::int <> 2 then
    raise exception '4a: okunmamış sayısı yanlış: a=% b=%',
      public.ogrenci_odevleri(jo_a)->>'okunmamis_duyuru', public.ogrenci_odevleri(jo_b)->>'okunmamis_duyuru';
  end if;
  v := public.ogrenci_duyurulari(jo_a);
  if (v->0->>'yeni')::boolean is not true or (v->1->>'yeni')::boolean is not false then
    raise exception '4b: "yeni" işareti yanlış: %', v;
  end if;
  v := public.ogretmen_duyurulari(jd);
  -- En yeni duyuru: 12DA'da 2 kişiden 0'ı gördü (Ada Bir yeniden önce okudu).
  x := (select s from jsonb_array_elements(v->0->'siniflar') s where s->>'ad' = '12DA');
  if (x->>'mevcut')::int <> 2 or (x->>'goren')::int <> 0 then
    raise exception '4c: gören/mevcut yanlış: %', x;
  end if;
  -- d1: Ada Bir gördü → 1/2
  x := (select s from jsonb_array_elements(
          (select d->'siniflar' from jsonb_array_elements(v) d where d->>'id' = d1::text)) s);
  if (x->>'goren')::int <> 1 or (x->>'mevcut')::int <> 2 then
    raise exception '4d: d1 gören yanlış: %', x;
  end if;
  perform public.duyurulari_okudum(jo_a);
  if (public.ogrenci_odevleri(jo_a)->>'okunmamis_duyuru')::int <> 0 then
    raise exception '4e: okuduktan sonra hâlâ okunmamış var';
  end if;
  begin
    perform public.duyurulari_okudum(jd);
    raise exception '4f: öğretmen duyurulari_okudum çağırabildi';
  exception when insufficient_privilege then null;
  end;
  raise notice '4 OK — okunmamış sayısı, "yeni", gören/mevcut doğru; okudum sonrası 0';

  -- ---------------------------------------------------------------------------
  -- 5. Kaldırma
  -- ---------------------------------------------------------------------------
  begin
    perform public.duyuru_kaldir(jt, d1);
    raise exception '5a: başka öğretmen (yönetici) duyuruyu kaldırdı';
  exception when insufficient_privilege then null;
  end;
  perform public.duyuru_kaldir(jd, d1);
  if exists (select 1 from jsonb_array_elements(public.ogrenci_duyurulari(jo_a)) d where d->>'id' = d1::text)
     or exists (select 1 from jsonb_array_elements(public.ogretmen_duyurulari(jd)) d where d->>'id' = d1::text) then
    raise exception '5b: kaldırılan duyuru hâlâ görünüyor';
  end if;
  if (select kaldirildi from public.duyurular where id = d1) is null then
    raise exception '5c: kayıt silinmiş ya da işaretlenmemiş';
  end if;
  raise notice '5 OK — yalnız yazan kaldırıyor; kaldırılan görünmüyor, kayıt duruyor';

  -- ---------------------------------------------------------------------------
  -- 6. Sonradan gelen öğrenci ve 30 gün
  -- ---------------------------------------------------------------------------
  update public.duyurular set created_at = now() - interval '2 days' where id = d2;
  o_yeni := (public.ogrenci_ekle(jt, 'Yeni Gelen ' || ek, 'okul', s_b))->>'id';
  jo_yeni := (public.giris((select kod from public.giris_kodlari where ogrenci_id = o_yeni and rol = 'ogrenci')))->>'token';
  if exists (select 1 from jsonb_array_elements(public.ogrenci_duyurulari(jo_yeni)) d where d->>'id' = d2::text) then
    raise exception '6a: sonradan gelen öğrenci eski duyuruyu gördü';
  end if;
  if not exists (select 1 from jsonb_array_elements(public.ogrenci_duyurulari(jo_b)) d where d->>'id' = d2::text) then
    raise exception '6b: eski öğrenci duyuruyu göremedi';
  end if;
  d_eski := (public.duyuru_yayinla(jd, 'Eski duyuru', array[s_b]))->>'id';
  update public.duyurular set created_at = now() - interval '31 days' where id = d_eski;
  if exists (select 1 from jsonb_array_elements(public.ogrenci_duyurulari(jo_b)) d where d->>'id' = d_eski::text) then
    raise exception '6c: 30 günden eski duyuru göründü';
  end if;
  raise notice '6 OK — sonradan gelen eski duyuruyu görmüyor; 30 günden eski görünmüyor';
end $$;

select 'DUYURU VE GENEL TESTLERİ GEÇTİ';
