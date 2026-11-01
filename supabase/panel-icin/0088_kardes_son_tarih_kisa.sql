-- SEKİZ — 0088: Yayarken son tarih de taşınsın
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Açıklamalı tam sürüm: supabase/migrations/0088_kardes_son_tarih.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Ayarlar → Verinizin yedeği)
-- 0087 ÇALIŞMIŞ OLMALI. Edge Function DEĞİŞMİYOR.
--
-- NE YAPIYOR: "Bu düzeltmeyi diğer şubelere de uygula" dediğinizde artık
-- SON TARİH de taşınıyor. Bugüne kadar taşınmıyordu; teslim tarihini
-- uzattığınızda her şubeyi tek tek düzeltmek zorunda kalıyordunuz.
--
-- SEÇENEKLİ: onay penceresinde "Son tarihi de bu şubelere uygula" kutusu
-- VARSAYILAN İŞARETLİ gelir. Şubelerin dersi farklı günlerdeyse kutuyu
-- kaldırırsınız; o zaman yalnız içerik eşitlenir, her şube kendi tarihini
-- korur.
--
-- DEĞİŞMEYENLER: geç teslim izni ve yayında/taslak durumu hâlâ
-- taşınmıyor; sınıf hiçbir koşulda değişmiyor.
--
-- ÖĞRENCİ SESSİZ KALMIYOR: tarih yayma ile değişince kardeş şubedeki
-- öğrenci ve veli ödev sayfasında "Son teslim tarihi uzatıldı" satırını
-- görür. (Bu satır olmasaydı tarih sessizce değişmiş olurdu.)
--
-- Beklenen sonuç: en altta tek satırlık bir tablo (_migration_kaydet → 0088).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. ÖNKOŞUL — zincir sırayla uygulanmalı
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public._odev_tarihleri(uuid,date)') is null then
    raise exception '0088: önce 0085 çalıştırılmalı';
  end if;
  if pg_get_functiondef('public.odev_gonder'::regproc)
       like '%her sayfanın çözümünü eklemelisin%' then
    raise exception '0088: önce 0087 çalıştırılmalı';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. ESKİ İMZA DÜŞÜYOR (0007 tuzağı)
-- -----------------------------------------------------------------------------
drop function if exists public.odev_kardeslere_yay(text, uuid);

-- -----------------------------------------------------------------------------
-- 2. YAYMA — son tarih seçenekli
-- -----------------------------------------------------------------------------
create or replace function public.odev_kardeslere_yay(
  p_token text,
  p_id uuid,
  -- 0088: VARSAYILAN true BİLEREK. Önbellekteki eski istemci iki
  -- argümanla çağırsa bile uç çözülür ve öğretmenin istediği gibi
  -- davranır; panel SQL ile site birbirini beklemek zorunda kalmaz.
  p_son_tarih_de boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  d       public.odevler;   -- kaynak
  k       record;           -- kardeş
  eski    public.odevler;   -- kardeşin yayma ÖNCESİ hâli (denetim izi için)
  g       record;
  yeni    record;
  anahtar_degisti boolean;
  rapor   jsonb := '[]'::jsonb;
  puanlar jsonb;
  v_ogretmen uuid;
  -- 0088: kardeşin yaymadan SONRAKİ son tarihi. Rapora yalnız
  -- gerçekten değiştiyse yazılıyor — "değişti" demek, değişmediği
  -- hâlde öğretmeni yanıltırdı.
  v_yeni_tarih date;
begin
  v_ogretmen := public._ogretmen(p_token);
  -- Kardeşlere yayma NOT DEĞİŞTİRİYOR: kaynağın sahibi olmayan
  -- kimse başlatamaz.
  perform public._odev_sahibi(v_ogretmen, p_id);

  select * into d from public.odevler where id = p_id;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  -- 0055: YAYMA YALNIZ ÖDEVİ VERENE. Yöneticinin birden çok sınıfa
  -- verdiği bir ödevi o sınıflardan birinin öğretmeni de açabiliyor; ama
  -- kardeşler BAŞKA öğretmenlerin sınıflarında. Yayabilseydi onların
  -- öğrencilerinin notunu değiştirirdi.
  if d.ogretmen_id <> v_ogretmen then
    raise exception 'Bu ödevi kardeş sınıflara yalnız ödevi veren öğretmen yayabilir.'
      using errcode = '42501';
  end if;

  -- SESSİZ "TAMAM" YOK. Kardeşi olmayan bir ödevde hiçbir şey yapmayıp
  -- başarı dönmek, öğretmene yayıldığını sandırırdı.
  if d.grup_id is null then
    raise exception 'Bu ödev tek sınıfa verilmiş; yayılacak kardeş ödev yok.'
      using errcode = '22023';
  end if;

  for k in
    select d2.id, d2.sinif_id, s2.ad as sinif_ad
      from public.odevler d2
      join public.siniflar s2 on s2.id = d2.sinif_id
     where d2.grup_id = d.grup_id and d2.id <> p_id
     order by s2.seviye, s2.sube
  loop
    -- ARŞİVDEKİ SINIF ATLANIYOR (0016 kuralı).
    -- Arşivdeki sınıf öğretmenin hiçbir listesinde görünmüyor; görünmeyen bir
    -- sınıfın notunu sessizce değiştirmek o kuralı delerdi. Atlandığı raporda
    -- yazıyor — sessiz atlama da yok.
    if public._sinif_arsivde(k.sinif_id) then
      rapor := rapor || jsonb_build_object(
        'sinif', k.sinif_ad, 'odev_id', k.id,
        'yeniden_puanlanan', '[]'::jsonb, 'atlandi', 'arsiv',
        -- Atlanan kardeşte tarih de değişmedi; alanlar yine de
        -- GÖNDERİLİYOR ki raporun şekli her satırda aynı olsun.
        'son_tarih_eski', null, 'son_tarih_yeni', null);
      continue;
    end if;

    select * into eski from public.odevler where id = k.id;

    -- Anahtar bu kardeş için gerçekten değişiyor mu? Yalnız test ödevinde
    -- anlamlı; açık uçluda anahtar da soru sayısı da null.
    anahtar_degisti := eski.tur = 'test'
      and ((d.cevap_anahtari is distinct from eski.cevap_anahtari)
        or (d.soru_sayisi is distinct from eski.soru_sayisi));

    -- TAŞINAN ALANLAR — öğretmenin kararı, birebir.
    -- sinif_id, gec_teslim, yayinda ve grup_id BİLEREK YOK.
    --
    -- 0088: SON TARİH ARTIK SEÇENEKLİ. 0031–0079 boyunca hiç
    -- taşınmıyordu ("her sınıfın kendi programı var"). Öğretmen bunun
    -- işine yaramadığını bildirdi: teslim tarihini uzattığında her
    -- şubeyi tek tek düzeltmek zorunda kalıyordu. Kararı: onay
    -- penceresinde işaretlenebilir olsun, VARSAYILAN İŞARETLİ. Eski
    -- davranış `p_son_tarih_de => false` ile hâlâ erişilebilir —
    -- şubelerin dersi farklı günlerdeyse tarihleri zorla eşitlemek
    -- yanlış olurdu.
    update public.odevler
       set baslik         = d.baslik,
           son_tarih      = case when p_son_tarih_de then d.son_tarih
                                 else eski.son_tarih end,
           aciklama       = d.aciklama,
           soru_sayisi    = d.soru_sayisi,
           cevap_anahtari = d.cevap_anahtari,
           sik_sayisi     = d.sik_sayisi,
           -- 0054: sayfa sınırı da ödevin İÇERİĞİ — aynı çözüm her sınıfta
           -- aynı sayıda sayfa tutar. Şık sayısı gibi taşınıyor; geç teslim
           -- gibi sınıfa özgü bir ayar DEĞİL.
           sayfa_limiti   = d.sayfa_limiti,
           -- 0078: "her sayfa zorunlu" bayrağı da içerik. 0079: gönderimi
           -- olan kardeşe de taşınıyor (odev_guncelle'deki kilit kalktı);
           -- gönderilmiş çözümler değişmez.
           tum_sayfalar   = d.tum_sayfalar,
           konular        = public._konu_temizle(d.konular, d.soru_sayisi),
           anahtar_url    = d.anahtar_url,
           odev_url       = d.odev_url
     where id = k.id;

    select o2.son_tarih into v_yeni_tarih
      from public.odevler o2 where o2.id = k.id;

    perform public._denetim('kardeslere_yayildi', 'odevler', k.id, public._aktor(v_ogretmen),
                            to_jsonb(eski),
                            (select to_jsonb(o) from public.odevler o where o.id = k.id));

    -- -------------------------------------------------------------------
    -- YENİDEN PUANLAMA — gövde odev_guncelle'den (0020) BİREBİR kopyalandı.
    -- Ezberden yazmak 0016'da iki hataya yol açmıştı; o adım atlanmıyor.
    -- -------------------------------------------------------------------
    puanlar := '[]'::jsonb;
    if anahtar_degisti then
      for g in
        select gn.id, gn.ogrenci_id, gn.cevaplar, gn.puan, gn.dogru, gn.yanlis, gn.bos,
               o.ad as ogrenci_ad
          from public.gonderimler gn
          join public.ogrenciler o on o.id = gn.ogrenci_id
         where gn.odev_id = k.id
      loop
        select * into yeni
        from public._puanla(coalesce(d.cevap_anahtari, '{}'::jsonb),
                            coalesce(g.cevaplar, '{}'::jsonb),
                            d.soru_sayisi);

        if yeni.puan is distinct from g.puan then
          update public.gonderimler
             set dogru = yeni.dogru, yanlis = yeni.yanlis,
                 bos = yeni.bos, puan = yeni.puan
           where id = g.id;

          -- Not değişikliği HER ZAMAN iz bırakır (Part XLIII).
          perform public._denetim(
            'yeniden_puanlandi', 'gonderimler', g.id, public._aktor(v_ogretmen),
            jsonb_build_object('puan', g.puan, 'dogru', g.dogru,
                               'yanlis', g.yanlis, 'bos', g.bos),
            jsonb_build_object('puan', yeni.puan, 'dogru', yeni.dogru,
                               'yanlis', yeni.yanlis, 'bos', yeni.bos));

          puanlar := puanlar || jsonb_build_object(
            'ogrenci', g.ogrenci_ad,
            'eski_puan', g.puan,
            'yeni_puan', yeni.puan);
        end if;
      end loop;
    end if;

    rapor := rapor || jsonb_build_object(
      'sinif', k.sinif_ad, 'odev_id', k.id,
      'yeniden_puanlanan', puanlar, 'atlandi', null,
      -- 0088: tarih GERÇEKTEN değiştiyse söyleniyor, yoksa null.
      'son_tarih_eski', case when eski.son_tarih is distinct from v_yeni_tarih
                             then eski.son_tarih end,
      'son_tarih_yeni', case when eski.son_tarih is distinct from v_yeni_tarih
                             then v_yeni_tarih end);
  end loop;

  return rapor;
end;
$$;

revoke all on function public.odev_kardeslere_yay(text, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.odev_kardeslere_yay(text, uuid, boolean)
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. 0085'İN YARDIMCISI — yayma da tarihi değiştirebiliyor
-- -----------------------------------------------------------------------------
create or replace function public._odev_tarihleri(p_odev uuid, p_son_tarih date)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  with verilis as (
    -- `min`: `odev_yayinla` ikinci kez çağrılırsa ikinci satır da yazılır;
    -- öğrenciye düştüğü an İLK olanıdır.
    select min(z.zaman) as zaman
      from public.denetim_izi z
     where z.tablo = 'odevler'
       and z.kayit_id = p_odev
       and z.islem = 'odev_yayinlandi'
  ),
  degisim as (
    select z.id, z.zaman, (z.eski ->> 'son_tarih')::date as eski_tarih
      from public.denetim_izi z
      cross join verilis v
     where z.tablo = 'odevler'
       and z.kayit_id = p_odev
       -- 0088: YAYMA DA TARİHİ DEĞİŞTİREBİLİYOR. `kardeslere_yayildi`
       -- satırı tam satırı `eski`/`yeni` olarak yazdığı için aşağıdaki
       -- karşılaştırma olduğu gibi çalışıyor. Sayılmasaydı kardeş
       -- şubedeki öğrenci ve veli tarihin değiştiğini HİÇ görmez,
       -- sessizce yeni tarihi bulurdu.
       and z.islem in ('odev_guncellendi', 'kardeslere_yayildi')
       -- 3. tuzak: taslaktayken yapılan değişiklik sayılmıyor.
       and v.zaman is not null
       and z.zaman >= v.zaman
       -- 1. tuzak: tarihi değiştirmeyen düzenleme uzatma değil.
       and (z.eski ->> 'son_tarih') is distinct from (z.yeni ->> 'son_tarih')
  ),
  ilk as (
    -- `zaman` eşitse `id` karar veriyor: denetim izi kimlikleri artan
    -- sırada verildiği için gerçek sıra budur. Aynı saniyeyi iki ayrı RPC
    -- çağrısı paylaşamaz, ama sıralamayı tesadüfe bırakmanın bedeli
    -- "ilk tarih" diye YANLIŞ tarihi yazmak olurdu.
    select eski_tarih from degisim order by zaman, id limit 1
  )
  select jsonb_build_object(
    -- Taslakta null: veriliş tarihi UYDURULMUYOR.
    'verilis', (select zaman from verilis),
    'son_tarih', p_son_tarih,
    -- Yayından sonra hiç değişmediyse null.
    'ilk_son_tarih', (select eski_tarih from ilk),
    'degisiklik', (select count(*) from degisim),
    -- 2. tuzak: iki yön de söyleniyor.
    'yon', case
             when (select eski_tarih from ilk) is null then null
             when p_son_tarih > (select eski_tarih from ilk) then 'uzatildi'
             when p_son_tarih < (select eski_tarih from ilk) then 'one_alindi'
           end
  );
$$;

-- -----------------------------------------------------------------------------
-- 4. ODEV_DETAY — kardeşin kendi son tarihi ekrana gidiyor
-- -----------------------------------------------------------------------------
create or replace function public.odev_detay(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  d public.odevler;
  s public.siniflar;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  perform public._odev_sahibi(v_ogretmen, p_id);

  select * into d from public.odevler where id = p_id;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;
  select * into s from public.siniflar where id = d.sinif_id;

  return jsonb_build_object(
    'id', d.id,
    'baslik', d.baslik,
    'aciklama', d.aciklama,
    'tur', d.tur,
    'sinif_id', d.sinif_id,
    'sinif', s.ad,
    'son_tarih', d.son_tarih,
    -- 0085: VERİLİŞ TARİHİ + UZATMA. Hesap tek yerde; öğretmenin,
    -- öğrencinin ve velinin gördüğü tarih ayrışamıyor.
    'tarihler', public._odev_tarihleri(d.id, d.son_tarih),
    'soru_sayisi', d.soru_sayisi,
    'gec_teslim', d.gec_teslim,
    'konular', coalesce(d.konular, '{}'::jsonb),
    'sik_sayisi', d.sik_sayisi,
    'sayfa_limiti', d.sayfa_limiti,
    'tum_sayfalar', d.tum_sayfalar,
    'cevap_anahtari', coalesce(d.cevap_anahtari, '{}'::jsonb),
    'anahtar_yolu', d.anahtar_url,
    'odev_yolu', d.odev_url,
    'yayinda', d.yayinda,
    'kardesler', case when d.grup_id is not null and d.ogretmen_id = v_ogretmen then (
      select coalesce(jsonb_agg(s2.ad order by s2.seviye, s2.sube), '[]'::jsonb)
        from public.odevler d2
        join public.siniflar s2 on s2.id = d2.sinif_id
       where d2.grup_id = d.grup_id and d2.id <> d.id
    ) end,
    'kardes_detay', case when d.grup_id is not null and d.ogretmen_id = v_ogretmen then (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', d2.id,
               'sinif', s2.ad,
               -- 0088: kardeşin KENDİ son tarihi. Öğretmen neyin
               -- üzerine yazacağını yaymadan ÖNCE görsün.
               'son_tarih', d2.son_tarih,
               'gonderim_sayisi', (select count(*) from public.gonderimler g
                                    where g.odev_id = d2.id
                                      and not public._deneme_mi(g.ogrenci_id)),
               'anahtar_ayni', (d2.cevap_anahtari is not distinct from d.cevap_anahtari),
               'arsiv', public._sinif_arsivde(d2.sinif_id)
             ) order by s2.seviye, s2.sube), '[]'::jsonb)
        from public.odevler d2
        join public.siniflar s2 on s2.id = d2.sinif_id
       where d2.grup_id = d.grup_id and d2.id <> d.id
    ) end,
    -- 0083: BU ÖDEVİN HENÜZ VERİLMEDİĞİ, öğretmenin kendi, arşivde
    -- olmayan sınıfları. Yalnız ödevi VEREN öğretmene dolu geliyor;
    -- başkası (yönetici dâhil) kopyalayamadığı için liste de boş.
    'verilebilir_siniflar', case when d.ogretmen_id = v_ogretmen then (
      select coalesce(jsonb_agg(jsonb_build_object('id', s3.id, 'ad', s3.ad)
                                order by s3.seviye, s3.sube), '[]'::jsonb)
        from public.siniflar s3
        join public.ogretmen_siniflari os
          on os.sinif_id = s3.id and os.ogretmen_id = v_ogretmen
       where not s3.arsiv
         and s3.id <> d.sinif_id
         and not exists (
           select 1 from public.odevler d3
           where d3.grup_id is not null
             and d3.grup_id = d.grup_id
             and d3.sinif_id = s3.id
         )
    ) end,
    'gonderim_sayisi', (select count(*) from public.gonderimler g where g.odev_id = d.id
                          and not public._deneme_mi(g.ogrenci_id)),
    'gec_gonderim_sayisi', (
      select count(*) from public.gonderimler g
      where g.odev_id = d.id and public._gecikmeli(g.created_at, d.son_tarih)
        and not public._deneme_mi(g.ogrenci_id)
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. ÖZ-DENETİM
-- -----------------------------------------------------------------------------
do $$
declare
  eksik text[] := '{}';
  t     text;
begin
  -- ESKİ İMZA GERÇEKTEN GİTTİ Mİ. Kalsaydı PostgREST iki fonksiyon görür,
  -- çağrı belirsizleşir ve yayma düğmesi 300 ile düşerdi.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'odev_kardeslere_yay'
       -- Kimlik dizgisi parametre ADLARINI da taşıyor (ölçümle görüldü;
       -- yalnız tiplerle karşılaştıran ilk yazım eşleşmedi).
       and pg_get_function_identity_arguments(p.oid) = 'p_token text, p_id uuid'
  ) then
    eksik := eksik || 'iki argümanlı odev_kardeslere_yay hâlâ duruyor'::text;
  end if;

  -- YENİ İMZA VAR MI, VARSAYILANI true MU.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'odev_kardeslere_yay'
       and pg_get_function_identity_arguments(p.oid)
             = 'p_token text, p_id uuid, p_son_tarih_de boolean'
  ) then
    eksik := eksik || 'üç argümanlı odev_kardeslere_yay yok'::text;
  else
    t := pg_get_functiondef('public.odev_kardeslere_yay(text, uuid, boolean)'::regprocedure);
    -- `pg_get_functiondef` DEFAULT'u BÜYÜK harf yazıyor.
    if t not like '%p_son_tarih_de boolean DEFAULT true%' then
      eksik := eksik || 'p_son_tarih_de varsayılanı true değil'::text;
    end if;
    -- SON TARİH ARTIK TAŞINIYOR.
    if t not like '%son_tarih      = case when p_son_tarih_de%' then
      eksik := eksik || 'yayma son tarihi hâlâ taşımıyor'::text;
    end if;
    -- TAŞINMAYANLAR TAŞINMAMAYA DEVAM EDİYOR (öğretmenin kararı).
    if t like '%gec_teslim     = d.gec_teslim%' or t like '%yayinda        = d.yayinda%'
       or t like '%sinif_id       = d.sinif_id%' then
      eksik := eksik || 'yayma taşımaması gereken bir alanı taşıyor'::text;
    end if;
    -- ÖNCEKİ TURLAR KORUNDU MU (kopyalama geriye almasın).
    if t not like '%sayfa_limiti   = d.sayfa_limiti%' or t not like '%tum_sayfalar   = d.tum_sayfalar%'
       or t not like '%_sinif_arsivde%' or t not like '%yeniden_puanlandi%' then
      eksik := eksik || 'yayma''nın eski kuralları kayboldu'::text;
    end if;
    -- RAPOR TARİHİ SÖYLÜYOR MU.
    if t not like '%son_tarih_eski%' or t not like '%son_tarih_yeni%' then
      eksik := eksik || 'rapor tarih değişimini söylemiyor'::text;
    end if;
  end if;

  -- 0085 ROZETİ KARDEŞTE ÇALIŞIYOR MU.
  t := pg_get_functiondef('public._odev_tarihleri'::regproc);
  if t not like '%''odev_guncellendi'', ''kardeslere_yayildi''%' then
    eksik := eksik || '_odev_tarihleri yaymayı saymıyor'::text;
  end if;
  -- 0085'in üç tuzağı yerinde mi.
  if t not like '%odev_yayinlandi%' or t not like '%z.zaman >= v.zaman%'
     or t not like '%one_alindi%' then
    eksik := eksik || '_odev_tarihleri''nin 0085 kuralları kayboldu'::text;
  end if;

  -- KARDEŞİN KENDİ TARİHİ EKRANA GİDİYOR MU.
  t := pg_get_functiondef('public.odev_detay'::regproc);
  if t not like '%''son_tarih'', d2.son_tarih%' then
    eksik := eksik || 'odev_detay kardeşin son tarihini göndermiyor'::text;
  end if;
  if t not like '%verilebilir_siniflar%' or t not like '%kardes_detay%' then
    eksik := eksik || 'odev_detay 0083''ü geriye aldı'::text;
  end if;
  -- 0085'İ GERİYE ALMA KAPISI. Bu dosyanın ilk yazımında `odev_detay`
  -- 0083'ten kopyalanmıştı ve `tarihler` alanı sessizce kayboluyordu.
  -- Kod okumak yakalamadı; ölçüm yakaladı. Kapı artık burada.
  if t not like '%''tarihler'', public._odev_tarihleri%' then
    eksik := eksik || 'odev_detay 0085''i geriye aldı (tarihler alanı yok)'::text;
  end if;

  if array_length(eksik, 1) > 0 then
    raise exception '0088 eksik: %', array_to_string(eksik, ' | ');
  end if;
end $$;

select public._migration_kaydet('0088');
