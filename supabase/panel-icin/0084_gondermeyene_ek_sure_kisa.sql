-- SEKİZ — 0084: Göndermeyen öğrenciye sonradan ek süre verme
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Açıklamalı tam sürüm: supabase/migrations/0084_gondermeyene_ek_sure.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Ayarlar → Verinizin yedeği)
-- 0083 ÇALIŞMIŞ OLMALI. Edge Function DEĞİŞMİYOR.
--
-- NE YAPIYOR: Gönderim takibi ekranındaki "Göndermeyenler" listesinde her
-- öğrencinin yanına bir onay kutusu gelir. Birkaç öğrenci işaretleyip
-- "Seçilenlere ek süre ver" diyorsunuz: tek bir tarih ve kısa bir sebep.
--
-- O öğrenciler, sınıfın süresi dolmuş ve geç teslim kapalı olsa bile
-- verdiğiniz tarihe kadar ödevi gönderebilir. İstisna YALNIZ seçtiğiniz
-- öğrencilere açılır.
--
-- Yazdığınız sebep öğrenciye MESAJ olarak gider (yalnız öğrenciye;
-- veli görmez). Aynı öğrenciye ikinci kez verirseniz tarih güncellenir.
--
-- HİÇBİR VERİ SİLİNMEZ. Zaten göndermiş öğrenciye ek süre verilmez
-- (onun için "Gönderimi yeniden aç" var), geçmiş tarih kabul edilmez.
--
-- Beklenen sonuç: en altta tek satırlık bir tablo (_migration_kaydet → 0084).
-- =============================================================================


do $$
begin
  if to_regclass('public.odev_ek_sure') is null then
    raise exception '0084: önce 0081 çalıştırılmalı';
  end if;
  -- Kapının kişisel tarihe baktığından emin ol: bakmıyorsa bu dosya
  -- öğretmene "süre verdim" dedirtir ama öğrenci yine gönderemezdi.
  if pg_get_functiondef('public.odev_gonder'::regproc) not like '%odev_ek_sure%' then
    raise exception '0084: odev_gonder kişisel tarihe bakmıyor — önce 0081';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. ogrencilere_ek_sure — turun tek yeni ucu
-- -----------------------------------------------------------------------------
create or replace function public.ogrencilere_ek_sure(
  p_token text,
  p_odev uuid,
  p_ogrenci_idler jsonb,
  p_son_tarih date,
  p_neden text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ogretmen uuid;
  v_gercek   uuid;
  d          public.odevler;
  v_neden    text := nullif(btrim(coalesce(p_neden, '')), '');
  v_adet     integer;
  v_ham      text;
  v_ogr      uuid;
  v_ad       text;
  v_sonuc    jsonb := '[]'::jsonb;
  v_bugun    date := (now() at time zone 'Europe/Istanbul')::date;
begin
  v_ogretmen := public._ogretmen(p_token);
  perform public._odev_sahibi(v_ogretmen, p_odev);
  v_gercek := coalesce(nullif(current_setting('sekiz.vekil', true), '')::uuid, v_ogretmen);

  select * into d from public.odevler where id = p_odev;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  -- 0083'ün kuralı: ödevi yalnız onu VEREN öğretmen yönetir.
  if d.ogretmen_id <> v_ogretmen then
    raise exception 'Bu ödevde ek süreyi yalnız ödevi veren öğretmen verebilir.'
      using errcode = '42501';
  end if;

  if p_ogrenci_idler is null or jsonb_typeof(p_ogrenci_idler) <> 'array' then
    raise exception 'Öğrenci listesi gerekli.' using errcode = '22023';
  end if;
  v_adet := jsonb_array_length(p_ogrenci_idler);
  if v_adet < 1 then
    raise exception 'En az bir öğrenci seçin.' using errcode = '22023';
  end if;
  if v_adet > 60 then
    raise exception 'En fazla 60 öğrenci seçilebilir.' using errcode = '22023';
  end if;
  if (select count(distinct e) from jsonb_array_elements_text(p_ogrenci_idler) e)
     <> v_adet then
    raise exception 'Aynı öğrenci listede birden çok kez var.' using errcode = '22023';
  end if;

  -- SEBEP ZORUNLU, çünkü öğrenciye MESAJ olarak gidiyor (0081'in sınırları).
  if v_neden is null or char_length(v_neden) < 3 then
    raise exception 'Ek süre vermenin sebebini yazın.' using errcode = '22023';
  end if;
  if char_length(v_neden) > 500 then
    raise exception 'Sebep en fazla 500 karakter olabilir.' using errcode = '22023';
  end if;

  if p_son_tarih is null then
    raise exception 'Yeni son tarihi seçin.' using errcode = '22023';
  end if;
  -- GEÇMİŞ TARİH YOK (0081'in kuralı): kapıyı anında kapatan bir tarih,
  -- öğrenciye hak verilmiş gibi görünüp gönderememesi demekti.
  if p_son_tarih < v_bugun then
    raise exception 'Yeni son tarih bugünden önce olamaz.' using errcode = '22023';
  end if;

  -- ---------------------------------------------------------------------
  -- ÖN DENETİM — hepsi YAZMADAN ÖNCE (0030/0083'ün deseni). Atomikliği
  -- geri alma sağlıyor; bu geçiş boşa iş yapmayı önlüyor ve hata mesajı
  -- hangi öğrencide takıldığını söylüyor.
  -- ---------------------------------------------------------------------
  for v_ham in select value from jsonb_array_elements_text(p_ogrenci_idler) loop
    begin
      v_ogr := v_ham::uuid;
    exception when invalid_text_representation then
      raise exception 'Geçersiz öğrenci kimliği: %', v_ham using errcode = '22023';
    end;

    if not exists (
      select 1 from public.ogrenciler o
      where o.id = v_ogr and o.aktif and o.sinif_id = d.sinif_id
    ) then
      raise exception 'Öğrenci bu ödevin sınıfında değil ya da listeden çıkarılmış.'
        using errcode = '22023';
    end if;

    -- 0064: sınıfa ödevin son tarihinden sonra gelen öğrenciye bu ödev
    -- hiç düşmüyor; ona ek süre vermek öğretmeni yanıltırdı.
    if not exists (
      select 1 from public.ogrenciler o
      where o.id = v_ogr
        and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
    ) then
      raise exception 'Bu ödev o öğrenciye düşmüyor (sınıfa sonradan katılmış).'
        using errcode = '22023';
    end if;

    -- TURUN KONUSU GÖNDERMEYEN ÖĞRENCİ. Gönderen zaten ikinci kez
    -- gönderemiyor (0056'nın kuralı); ona süre vermek işe yaramayan bir
    -- hak vermek olurdu. Gönderimi geri almak ayrı bir iş:
    -- "Gönderimi yeniden aç" (0081).
    if exists (
      select 1 from public.gonderimler g
      where g.odev_id = p_odev and g.ogrenci_id = v_ogr
    ) then
      raise exception 'Bu öğrenci ödevi zaten göndermiş. Gönderimi değiştirmek için "Gönderimi yeniden aç" kullanın.'
        using errcode = '22023';
    end if;
  end loop;

  -- ---------------------------------------------------------------------
  -- YAZMA
  -- ---------------------------------------------------------------------
  for v_ham in select value from jsonb_array_elements_text(p_ogrenci_idler) loop
    v_ogr := v_ham::uuid;
    select ad into v_ad from public.ogrenciler where id = v_ogr;

    -- AYNI ÖĞRENCİYE İKİNCİ KEZ VERİLİRSE TARİH GÜNCELLENİYOR: öğretmen
    -- verdiği süreyi uzatmak isteyebilir. `do nothing` olsaydı ekranda
    -- yeni tarih yazar, kapı eski tarihte kapanırdı.
    insert into public.odev_ek_sure (odev_id, ogrenci_id, son_tarih, veren_id)
    values (p_odev, v_ogr, p_son_tarih, v_gercek)
    on conflict (odev_id, ogrenci_id) do update
      set son_tarih = excluded.son_tarih,
          veren_id  = excluded.veren_id,
          verildi   = now();

    -- SEBEP ÖĞRENCİYE MESAJ OLARAK GİDİYOR (öğretmenin kararı), AYNI
    -- İŞLEMDE: mesaj yazılamazsa süre de verilmiyor.
    insert into public.mesajlar (ogrenci_id, kimden, metin, kanal, ogretmen_id)
    values (
      v_ogr, 'ogretmen',
      coalesce(d.baslik, 'Ödev') || ' ödevi için sana '
        || to_char(p_son_tarih, 'DD.MM.YYYY') || ' tarihine kadar ek süre verildi. '
        || 'Öğretmeninin notu: ' || v_neden || ' '
        || 'Çözümünü bu tarihe kadar gönderebilirsin.',
      'ogrenci', v_gercek);

    perform public._denetim(
      'ogrenciye_ek_sure_verildi', 'odev_ek_sure', p_odev, public._aktor(v_ogretmen),
      null,
      jsonb_build_object('odev_id', p_odev, 'ogrenci_id', v_ogr,
                         'son_tarih', p_son_tarih, 'neden', v_neden));

    v_sonuc := v_sonuc || jsonb_build_object('ogrenci_id', v_ogr, 'ogrenci', v_ad);
  end loop;

  return jsonb_build_object('son_tarih', p_son_tarih, 'ogrenciler', v_sonuc);
end;
$$;

revoke all on function public.ogrencilere_ek_sure(text, uuid, jsonb, date, text)
  from public, anon, authenticated;
grant execute on function public.ogrencilere_ek_sure(text, uuid, jsonb, date, text)
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. ÖZ-DENETİM
-- -----------------------------------------------------------------------------
do $$
declare eksik text[] := '{}';
begin
  if to_regprocedure('public.ogrencilere_ek_sure(text,uuid,jsonb,date,text)') is null then
    eksik := eksik || 'ogrencilere_ek_sure kurulmadı'::text;
  end if;
  if not has_function_privilege('anon', 'public.ogrencilere_ek_sure(text, uuid, jsonb, date, text)', 'execute') then
    eksik := eksik || 'ogrencilere_ek_sure istemciye kapalı'::text;
  end if;

  -- MESAJ ÖĞRENCİ KANALINA (veli görmemeli).
  if pg_get_functiondef('public.ogrencilere_ek_sure(text,uuid,jsonb,date,text)'::regprocedure)
       not like '%''ogrenci'', v_gercek%' then
    eksik := eksik || 'ek süre mesajı öğrenci kanalına yazılmıyor'::text;
  end if;
  -- İKİNCİ KEZ VERİLİNCE TARİH GÜNCELLENMELİ.
  if pg_get_functiondef('public.ogrencilere_ek_sure(text,uuid,jsonb,date,text)'::regprocedure)
       not like '%on conflict (odev_id, ogrenci_id) do update%' then
    eksik := eksik || 'ikinci kez vermede tarih güncellenmiyor'::text;
  end if;
  -- 0081'İN KAPISI YERİNDE Mİ (bu uç ona dayanıyor).
  if pg_get_functiondef('public.odev_gonder'::regproc) not like '%odev_ek_sure%' then
    eksik := eksik || '0081''in kişisel tarih kapısı kayboldu'::text;
  end if;

  if array_length(eksik, 1) > 0 then
    raise exception '0084 eksik: %', array_to_string(eksik, ' | ');
  end if;
end $$;

select public._migration_kaydet('0084');
