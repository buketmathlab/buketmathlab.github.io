-- =============================================================================
-- SEKİZ — 0068: BOŞ SINIFI SİLME
--
--  1. Boş sınıf siliniyor; öğretmen ataması da gidiyor; denetim izi düşüyor.
--  2. Aktif öğrencisi olan sınıf reddediliyor (22023).
--  3. Yalnız PASİF öğrencisi olan sınıf reddediliyor.
--  4. Yalnız TASLAK ödevi olan sınıf reddediliyor.
--  5. Özel ders grubu reddediliyor (42501).
--  6. Sahip olmayan öğretmen, müdür, vekâlet, öğrenci ve veli: 42501.
--  7. Silinen sınıf yeniden eklenebiliyor.
--
-- İZOLASYON: kendi sınıflarını (12ZQ…12ZT) kuruyor; her koşuda yeniden.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text; jx text; jm text; jvek text; jo text; jv text;
  v_x uuid; s_bos uuid; s_ogr uuid; s_pas uuid; s_tas uuid; s_ozel uuid; s_yeni uuid;
  o_a uuid; o_p uuid; hata text; patladi boolean;
  ek text := to_char(clock_timestamp(), 'HH24MISSUS');
begin
  update public.ogretmenler
     set pin_hash = extensions.crypt('SinifSil!Sahip26', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('SinifSil!Sahip26'))->>'token';
  if not exists (select 1 from public.ogretmenler where ad = 'Sınıf Silme Öğretmeni') then
    perform public.ogretmen_ekle(jt, 'Sınıf Silme Öğretmeni', 'SinifSilOgr!26');
  end if;
  select id into v_x from public.ogretmenler where ad = 'Sınıf Silme Öğretmeni';
  jx := (public.giris('SinifSilOgr!26'))->>'token';
  if not exists (select 1 from public.ogretmenler where ad = 'Sınıf Silme Müdürü') then
    perform public.mudur_ekle(jt, 'Sınıf Silme Müdürü', 'SinifSilMudur!26');
  end if;
  jm := (public.giris('SinifSilMudur!26'))->>'token';
  jvek := (public.ogretmen_olarak_gir(jt, v_x))->>'token';

  -- Önceki koşulardan kalan boş test sınıfları temizleniyor; dolu olanlar
  -- (öğrencisi/ödevi olan) sonraki koşuda da dolu kalır, sorun değil.
  delete from public.siniflar s
   where s.seviye = 12 and s.sube in ('ZQ', 'SE')
     and not exists (select 1 from public.ogrenciler g where g.sinif_id = s.id)
     and not exists (select 1 from public.odevler d where d.sinif_id = s.id);

  s_bos := (public.sinif_ekle(jt, 12::smallint, 'ZQ'))->>'id';
  s_ogr := (public.sinif_ekle(jt, 12::smallint, 'ZR'))->>'id';
  s_pas := (public.sinif_ekle(jt, 12::smallint, 'ZS'))->>'id';
  s_tas := (public.sinif_ekle(jt, 12::smallint, 'ZT'))->>'id';
  select id into s_ozel from public.siniflar where ozel limit 1;
  perform public.ogretmen_sinif_ata(jt, v_x, jsonb_build_array(s_bos::text, s_ogr::text));

  o_a := (public.ogrenci_ekle(jt, 'Silme Aktif ' || ek, 'okul', s_ogr))->>'id';
  o_p := (public.ogrenci_ekle(jt, 'Silme Pasif ' || ek, 'okul', s_pas))->>'id';
  update public.ogrenciler set aktif = false where sinif_id = s_pas;
  perform public.odev_olustur(jt, 'Silme taslak ' || ek, null, s_tas, 'test', (current_date + 3)::date, 2,
          '{"1":"A","2":"B"}'::jsonb);
  jo := (public.giris((select kod from public.giris_kodlari where ogrenci_id = o_a and rol = 'ogrenci')))->>'token';
  jv := (public.giris((select kod from public.giris_kodlari where ogrenci_id = o_a and rol = 'veli')))->>'token';

  -- ---------------------------------------------------------------------------
  -- 6. Yetkisizler (önce: boş sınıf hâlâ yerinde olmalı)
  -- ---------------------------------------------------------------------------
  foreach hata in array array[jx, jm, jvek, jo, jv] loop
    begin
      perform public.sinif_sil(hata, s_bos);
      raise exception '6: yetkisiz biri sınıf sildi';
    exception when insufficient_privilege then null;
    end;
  end loop;
  if not exists (select 1 from public.siniflar where id = s_bos) then
    raise exception '6b: yetkisiz çağrı sınıfı sildi';
  end if;
  raise notice '6 OK — sahip olmayan öğretmen, müdür, vekâlet, öğrenci, veli: 42501';

  -- ---------------------------------------------------------------------------
  -- 1. Boş sınıf siliniyor
  -- ---------------------------------------------------------------------------
  perform public.sinif_sil(jt, s_bos);
  if exists (select 1 from public.siniflar where id = s_bos)
     or exists (select 1 from public.ogretmen_siniflari where sinif_id = s_bos) then
    raise exception '1a: boş sınıf ya da ataması silinmedi';
  end if;
  if not exists (select 1 from public.denetim_izi where islem = 'sinif_silindi' and kayit_id = s_bos) then
    raise exception '1b: denetim izi yok';
  end if;
  raise notice '1 OK — boş sınıf silindi; atama gitti; denetim izi var';

  -- ---------------------------------------------------------------------------
  -- 2–5. Reddedilenler
  -- ---------------------------------------------------------------------------
  patladi := false;
  begin perform public.sinif_sil(jt, s_ogr);
  exception when invalid_parameter_value then patladi := true; end;
  if not patladi or not exists (select 1 from public.siniflar where id = s_ogr) then
    raise exception '2: öğrencisi olan sınıf silindi';
  end if;
  raise notice '2 OK — aktif öğrencisi olan sınıf silinmedi';

  patladi := false;
  begin perform public.sinif_sil(jt, s_pas);
  exception when invalid_parameter_value then patladi := true; end;
  if not patladi then raise exception '3: yalnız pasif öğrencisi olan sınıf silindi'; end if;
  raise notice '3 OK — pasif öğrencisi olan sınıf silinmedi';

  patladi := false;
  begin perform public.sinif_sil(jt, s_tas);
  exception when invalid_parameter_value then patladi := true; end;
  if not patladi then raise exception '4: taslak ödevi olan sınıf silindi'; end if;
  raise notice '4 OK — taslak ödevi olan sınıf silinmedi';

  begin
    perform public.sinif_sil(jt, s_ozel);
    raise exception '5: özel ders grubu silindi';
  exception when insufficient_privilege then null;
  end;
  raise notice '5 OK — özel ders grubu silinmedi';

  -- ---------------------------------------------------------------------------
  -- 7. Yeniden eklenebiliyor
  -- ---------------------------------------------------------------------------
  s_yeni := (public.sinif_ekle(jt, 12::smallint, 'ZQ'))->>'id';
  if s_yeni is null or s_yeni = s_bos then
    raise exception '7: silinen sınıf yeniden eklenemedi';
  end if;
  perform public.sinif_sil(jt, s_yeni);
  raise notice '7 OK — silinen sınıf yeniden eklenebiliyor';
end $$;

select 'SINIF SİLME TESTLERİ GEÇTİ';
