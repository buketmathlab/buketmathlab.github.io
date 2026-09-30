-- =============================================================================
-- 0057 — VELİ ADI LİSTELERDE (Veliler sınıf listesi, Mesajlar, yazışma)
--
-- Öğretmenin isteği: Veliler sekmesinde sınıfa girince öğrencinin yanında
-- velisinin adı görünsün; Mesajlar bölümünde de öyle. Ad, velinin ONAM
-- VERİRKEN KENDİ YAZDIĞI ad olsun.
--
-- VERİ ZATEN VARDI: 0038'den beri `onam_ver` adı `veli_onaylari.veli_adi`
-- sütununa yazıyor; yalnız onam dökümü onu okuyordu. Tablo değişmiyor,
-- yedeğin biçimi değişmiyor.
--
-- HANGİ AD: velinin ad yazdığı EN SON onay satırı — sürüm şartı YOK.
-- Onam metni ileride yükselir de veli henüz yeniden onaylamazsa, daha önce
-- yazdığı ad görünmeye devam eder; onamın güncel olup olmadığı ayrıca
-- "Onam bekliyor" etiketiyle gösteriliyor. 0038 öncesi adsız satırlar
-- atlanıyor; hiç ad yoksa null ve ekran bir şey uydurmuyor.
--
-- YALNIZ ÖĞRETMEN UÇLARI. Aşağıdaki üç uç kapsam kuralını AYNEN koruyor
-- (`_ogretmenin_sinifi`, `_ogretmenin_ogrencisi`, `_ogrenci_sahibi`):
-- bir öğretmen başka öğretmenin öğrencisinin velisinin adını göremez.
-- `_veli_adi` istemciye kapalı.
--
-- Gövdeler son kaynaklardan MEKANİK olarak kopyalandı; tek fark `veli_adi`:
--   sinif_velileri    ← 0049
--   yazisma_listesi   ← 0048  (yalnız veli kanalında dolu)
--   mesajlar_ogretmen ← 0033  (yalnız veli kanalında dolu)
--
-- Bu dosya tekrar çalıştırılabilir.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. _veli_adi — velinin onamda yazdığı en son ad (dahili)
-- -----------------------------------------------------------------------------
create or replace function public._veli_adi(p_ogrenci uuid)
returns text
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select v.veli_adi
    from public.veli_onaylari v
   where v.ogrenci_id = p_ogrenci
     and v.veli_adi is not null
   order by v.onay_zamani desc
   limit 1;
$$;

-- -----------------------------------------------------------------------------
-- 2. sinif_velileri — Veliler → sınıf (0049 + veli_adi)
-- -----------------------------------------------------------------------------
create or replace function public.sinif_velileri(p_token text, p_sinif_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sinif record;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  if not public._ogretmenin_sinifi(v_ogretmen, p_sinif_id) then
    raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
  end if;

  select s.id, s.ad, s.ozel, s.arsiv into v_sinif
  from public.siniflar s where s.id = p_sinif_id;
  if not found then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'sinif', jsonb_build_object('id', v_sinif.id, 'ad', v_sinif.ad, 'ozel', v_sinif.ozel),
    'veliler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ogrenci_id', o.id,
               'ad', o.ad,
               'tur', o.tur,
               -- 0057: velinin onam verirken KENDİ yazdığı ad (yoksa null).
               'veli_adi', public._veli_adi(o.id),
               -- ONAM DURUMU (0034). Onaylamayan veli panele giremiyor;
               -- öğretmen kimin beklediğini buradan görüyor. SALT OKUNUR:
               -- öğretmen onamı ne verebilir ne geri alabilir — onam
               -- velinin kendi iradesi, başkası adına tıklanamaz.
               'onam_var', exists (select 1 from public.veli_onaylari v
                                    where v.ogrenci_id = o.id
                                      and v.metin_surumu = public._gecerli_onam_surumu()),
               -- Veli kodu yoksa veli hiç giriş yapamaz; öğretmen bunu
               -- mesaj yazmadan önce bilsin.
               'veli_kodu_var', exists (select 1 from public.giris_kodlari k
                                         where k.ogrenci_id = o.id and k.rol = 'veli'),
               'mesaj_sayisi', (select count(*)::integer from public.mesajlar m
                                 where m.ogrenci_id = o.id
                                   and m.kanal = 'veli'
                                   and m.ogretmen_id = v_ogretmen),
               'son_mesaj', (select max(m.created_at) from public.mesajlar m
                              where m.ogrenci_id = o.id
                                and m.kanal = 'veli'
                                and m.ogretmen_id = v_ogretmen),
               'okunmamis', (select count(*)::integer from public.mesajlar m
                              where m.ogrenci_id = o.id and m.kimden = 'veli'
                                and m.kanal = 'veli'
                                and m.ogretmen_id = v_ogretmen
                                and m.created_at > coalesce(
                                      -- 0049: anahtarın DÖRT sütunu da
                                      -- süzülüyor; kanal ya da ogretmen_id
                                      -- eksikken bu alt sorgu tek satır
                                      -- döndürmek zorunda değildi.
                                      (select k.zaman from public.okundu k
                                        where k.ogrenci_id = o.id
                                          and k.rol = 'ogretmen'
                                          and k.kanal = 'veli'
                                          and k.ogretmen_id = v_ogretmen),
                                      '-infinity'::timestamptz))
             ) order by o.ad)
      from public.ogrenciler o
      where o.sinif_id = p_sinif_id and o.aktif
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. yazisma_listesi — Mesajlar (0048 + veli_adi)
-- -----------------------------------------------------------------------------
create or replace function public.yazisma_listesi(p_token text, p_kanal text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ogretmen uuid;
  sonuc jsonb;
begin
  v_ogretmen := public._ogretmen(p_token);

  if p_kanal is null or p_kanal not in ('ogrenci', 'veli') then
    raise exception 'Kanal ''ogrenci'' ya da ''veli'' olmalı.'
      using errcode = '22023';
  end if;

  with ozet as (
    select o.id as ogrenci_id, o.ad,
           s.id as sinif_id, s.ad as sinif, s.seviye, s.sube,
           (select max(m.created_at) from public.mesajlar m
             where m.ogrenci_id = o.id and m.kanal = p_kanal
               and m.ogretmen_id = v_ogretmen) as son_mesaj,
           (select count(*)::integer from public.mesajlar m
             where m.ogrenci_id = o.id and m.kimden = p_kanal and m.kanal = p_kanal
               and m.ogretmen_id = v_ogretmen
               and m.created_at > coalesce(
                     (select k.zaman from public.okundu k
                       where k.ogrenci_id = o.id and k.rol = 'ogretmen'
                         and k.kanal = p_kanal
                         and k.ogretmen_id = v_ogretmen),
                     '-infinity'::timestamptz)) as okunmamis
    from public.ogrenciler o
    join public.siniflar s on s.id = o.sinif_id
    where o.aktif and not s.arsiv
      and public._ogretmenin_ogrencisi(v_ogretmen, o.id)
  ),
  -- YALNIZ YAZIŞMASI OLANLAR (öğretmenin kararı).
  dolu as (
    select * from ozet where son_mesaj is not null
  )
  select jsonb_build_object(
    'kanal', p_kanal,
    'toplam_okunmamis', (select coalesce(sum(okunmamis), 0)::integer from dolu),
    'gruplar', coalesce((
      select jsonb_agg(g order by g_taze desc)
      from (
        select sinif_id, sinif,
               max(son_mesaj) as g_taze,
               jsonb_build_object(
                 'sinif_id', sinif_id,
                 'sinif', sinif,
                 'okunmamis', coalesce(sum(okunmamis), 0)::integer,
                 -- SINIF İÇİNDE de tazeliğe göre.
                 'satirlar', jsonb_agg(jsonb_build_object(
                     'ogrenci_id', ogrenci_id,
                     'ad', ad,
                     -- 0057: yalnız veli kanalında; öğrenci kanalında null.
                     'veli_adi', case when p_kanal = 'veli'
                                      then public._veli_adi(ogrenci_id) end,
                     'son_mesaj', son_mesaj,
                     'okunmamis', okunmamis
                   ) order by son_mesaj desc)
               ) as g
        from dolu
        group by sinif_id, sinif
      ) t
    ), '[]'::jsonb)
  ) into sonuc;

  return sonuc;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. mesajlar_ogretmen — yazışma ekranı (0033 + ogrenci.veli_adi)
-- -----------------------------------------------------------------------------
create or replace function public.mesajlar_ogretmen(
  p_token text, p_ogrenci_id uuid, p_kanal text default 'veli'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  ogr record;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);

  if coalesce(p_kanal, '') not in ('veli', 'ogrenci') then
    raise exception 'Yazışma ''veli'' ya da ''ogrenci'' olmalı.' using errcode = '22023';
  end if;

  select o.id, o.ad, o.tur, s.ad as sinif into ogr
  from public.ogrenciler o
  left join public.siniflar s on s.id = o.sinif_id
  where o.id = p_ogrenci_id;

  if not found then
    raise exception 'Öğrenci bulunamadı.' using errcode = 'P0002';
  end if;

  perform public._ogrenci_sahibi(v_ogretmen, p_ogrenci_id);

  return jsonb_build_object(
    -- 0057: veli kanalında velinin onamda yazdığı ad; öğrenci kanalında null.
    'ogrenci', jsonb_build_object('id', ogr.id, 'ad', ogr.ad, 'sinif', ogr.sinif,
                                  'veli_adi', case when p_kanal = 'veli'
                                                   then public._veli_adi(ogr.id) end),
    'kanal', p_kanal,
    -- Karşı tarafın giriş kodu var mı: yoksa yazdığı mesaj kimseye ulaşmaz
    -- ve öğretmen bunu önceden bilmeli.
    'veli_kodu_var', exists (select 1 from public.giris_kodlari k
                              where k.ogrenci_id = ogr.id
                                and k.rol = case when p_kanal = 'ogrenci'
                                                 then 'ogrenci' else 'veli' end),
    'mesajlar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kimden', m.kimden, 'metin', m.metin, 'zaman', m.created_at)
             order by m.created_at)
      from public.mesajlar m
      where m.ogrenci_id = p_ogrenci_id and m.kanal = p_kanal
        and m.ogretmen_id = v_ogretmen
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. YETKİLER (0005 deseni; uçların yetkileri önceki hâliyle aynı)
-- -----------------------------------------------------------------------------
revoke all on function public._veli_adi(uuid) from public, anon, authenticated;

revoke all on function public.sinif_velileri(text, uuid) from public, anon, authenticated;
grant execute on function public.sinif_velileri(text, uuid) to anon, authenticated;

revoke all on function public.yazisma_listesi(text, text) from public, anon, authenticated;
grant execute on function public.yazisma_listesi(text, text) to anon;

revoke all on function public.mesajlar_ogretmen(text, uuid, text) from public, anon, authenticated;
grant execute on function public.mesajlar_ogretmen(text, uuid, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. KENDİ KENDİNİ DENETLEME
-- -----------------------------------------------------------------------------
do $$
declare
  ad text;
begin
  foreach ad in array array['sinif_velileri', 'yazisma_listesi', 'mesajlar_ogretmen'] loop
    if (select count(*) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
         where ns.nspname = 'public' and p.proname = ad) <> 1 then
      raise exception '0057: % için birden fazla tanım var', ad;
    end if;
    if not exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = ad
         and pg_get_functiondef(p.oid) like '%_veli_adi(%'
    ) then
      raise exception '0057: % veli adını döndürmüyor', ad;
    end if;
  end loop;

  if has_function_privilege('anon', 'public._veli_adi(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public._veli_adi(uuid)', 'execute') then
    raise exception '0057: _veli_adi istemciye açık';
  end if;
  if not has_function_privilege('anon', 'public.sinif_velileri(text, uuid)', 'execute')
     or not has_function_privilege('anon', 'public.yazisma_listesi(text, text)', 'execute')
     or not has_function_privilege('anon', 'public.mesajlar_ogretmen(text, uuid, text)', 'execute') then
    raise exception '0057: öğretmen uçlarından biri istemciye kapandı';
  end if;
end $$;

select public._migration_kaydet('0057');
