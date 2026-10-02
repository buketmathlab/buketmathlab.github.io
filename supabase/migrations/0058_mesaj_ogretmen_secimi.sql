-- =============================================================================
-- 0058 — VELİ VE ÖĞRENCİ MESAJI: ÖĞRETMEN SEÇİMİ
--
-- OLAY (canlı): başka bir öğretmenin sınıfındaki bir veli mesaj
-- gönderemedi; ekran "Birden çok öğretmeniniz var; mesajın kime gideceği
-- henüz seçilemiyor." dedi.
--
-- SEBEP: platform sahibi her sınıfa bağlı (0033 bütün sınıfları ona
-- bağladı, `sinif_ekle` de her yeni sınıfı bağlıyor). Bir sınıf başka bir
-- öğretmene atanınca o sınıfın öğrencisinin İKİ öğretmeni oluyor.
-- `_ogrencinin_ogretmeni` 0033'ten beri bu durumda bilerek hata veriyordu
-- ("o gün mesaj_gonder hedef öğretmeni İSTEMEK zorunda kalacak") — o gün
-- geldi. Aynı hata ÖĞRENCİNİN mesajını da ve okundu işaretini de
-- engelliyordu.
--
-- ÖĞRETMENİN KARARI: veli (ve öğrenci) kendi sınıf öğretmenine de
-- platform sahibine de yazabilsin ve kime yazacağını SEÇSİN.
--
--   * `_ogrencinin_ogretmenleri(öğrenci)` — mesaj yazılabilecek aktif
--     öğretmenler [{id, ad}], sınıf öğretmeni önce, sahip sonra. Kural
--     `_ogretmenin_ogrencisi` (özel ders yalnız sahipte) — değişmedi.
--   * `mesaj_gonder(..., p_ogretmen_id)` — veli/öğrenci seçtiği öğretmene
--     yazıyor. Seçilen öğretmen o öğrencinin öğretmeni değilse 42501.
--     Seçim yoksa ve tek öğretmen varsa ona gidiyor (bugünkü davranış);
--     birden çok varsa "kime gideceğini seçin" hatası. Öğretmen rolünde
--     parametre yok sayılıyor.
--   * `veli_paneli` ve `ogrenci_mesajlari` — her mesajda `ogretmen_id` ve
--     `ogretmen` (ad); ayrıca `ogretmenler` listesi. Ekran yazışmayı
--     öğretmen öğretmen ayırıyor.
--   * `okundu_isaretle` — artık iki öğretmende hata vermiyor.
--
-- GİZLİLİK DEĞİŞMEDİ: öğretmen yalnız KENDİ `ogretmen_id`'li mesajlarını
-- görüyor (`mesajlar_ogretmen`, `yazisma_listesi`). Veli sınıf
-- öğretmenine yazdığında mesajı platform sahibi görmüyor; sahibe
-- yazdığında sınıf öğretmeni görmüyor.
--
-- ESKİ İMZA DÜŞÜYOR: `mesaj_gonder(text, text, uuid, text)` yanında
-- varsayılanlı ikinci bir imza dursaydı PostgREST hangisini çağıracağını
-- seçemezdi. Eski istemci yeni imzayı aynen çağırabiliyor (yeni
-- parametre varsayılanlı).
--
-- Gövdeler son kaynaklardan MEKANİK olarak kopyalandı:
--   mesaj_gonder ← 0034, okundu_isaretle ← 0049, veli_paneli ← 0047,
--   ogrenci_mesajlari ← 0025.
--
-- Tablo değişmiyor. Bu dosya tekrar çalıştırılabilir.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. _ogrencinin_ogretmenleri — mesaj yazılabilecek öğretmenler (dahili)
-- -----------------------------------------------------------------------------
create or replace function public._ogrencinin_ogretmenleri(p_ogrenci uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'ad', g.ad)
                            order by g.yonetici, g.ad), '[]'::jsonb)
    from public.ogretmenler g
   where g.aktif
     and public._ogretmenin_ogrencisi(g.id, p_ogrenci);
$$;

-- -----------------------------------------------------------------------------
-- 2. _mesaj_alicisi — veli/öğrenci mesajı hangi öğretmene gidiyor (dahili)
-- -----------------------------------------------------------------------------
create or replace function public._mesaj_alicisi(p_ogrenci uuid, p_secilen uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_liste jsonb := public._ogrencinin_ogretmenleri(p_ogrenci);
begin
  if p_secilen is not null then
    if not exists (select 1 from jsonb_array_elements(v_liste) e
                    where (e->>'id')::uuid = p_secilen) then
      raise exception 'Bu öğretmene mesaj gönderilemiyor. Sayfayı yenileyip listeden seçin.'
        using errcode = '42501';
    end if;
    return p_secilen;
  end if;

  if jsonb_array_length(v_liste) = 0 then
    raise exception 'Öğretmeniniz tanımlı değil. Lütfen öğretmeninizle iletişime geçin.'
      using errcode = '22023';
  end if;
  if jsonb_array_length(v_liste) > 1 then
    raise exception 'Mesajın hangi öğretmene gideceğini seçin.'
      using errcode = '22023';
  end if;
  return (v_liste->0->>'id')::uuid;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. mesaj_gonder — 0034 + p_ogretmen_id (eski imza düşüyor)
-- -----------------------------------------------------------------------------
drop function if exists public.mesaj_gonder(text, text, uuid, text);

create or replace function public.mesaj_gonder(
  p_token text,
  p_metin text,
  p_ogrenci_id uuid default null::uuid,
  p_kanal text default 'veli'::text,
  -- 0058: veli/öğrencinin seçtiği öğretmen. Öğretmen rolünde yok sayılır.
  p_ogretmen_id uuid default null::uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  o record;
  hedef uuid;
  kimden text;
  -- DEĞİŞKEN ADI SÜTUN ADIYLA AYNI OLMAMALI. `kanal` desem, PL/pgSQL onu
  -- `insert ... on conflict (…, kanal)` gibi yerlerde sütunla karıştırıp
  -- "column reference is ambiguous" hatası veriyor (ölçüldü).
  v_kanal text;
  v_ogretmen uuid;
begin
  select * into o from public._oturum(p_token);
  -- ONAM KAPISI (0034). Veli dışındaki rollerde etkisiz: bu iki uç
  -- öğrenci tarafından da kullanılıyor.
  perform public._onam_kapisi(o.rol, o.ogrenci_id);

  if o.rol = 'ogretmen' then
    if p_ogrenci_id is null then
      raise exception 'Mesajın gideceği öğrenci seçilmeli.' using errcode = '22023';
    end if;
    if coalesce(p_kanal, '') not in ('veli', 'ogrenci') then
      raise exception 'Yazışma ''veli'' ya da ''ogrenci'' olmalı.' using errcode = '22023';
    end if;
    -- VEKÂLETTE MESAJ YASAK — öğretmenin kararı. Sahip başka bir
    -- öğretmenin hesabındayken her şeyi görüp düzeltebiliyor, ama o kişi
    -- ADINA mesaj yazamıyor: bir veli, öğretmeninin yazdığını sandığı bir
    -- mesajı başkasından almış olmamalı.
    if o.vekil_id is not null then
      raise exception 'Başka bir öğretmenin hesabındayken onun adına mesaj gönderemezsiniz. '
                      'Kendi hesabınıza dönün.'
        using errcode = '42501';
    end if;

    -- Öğretmen yalnız KENDİ öğrencisine yazabilir.
    perform public._ogrenci_sahibi(o.ogretmen_id, p_ogrenci_id);
    hedef      := p_ogrenci_id;
    kimden     := 'ogretmen';
    v_kanal    := p_kanal;
    v_ogretmen := o.ogretmen_id;
  elsif o.rol = 'veli' then
    -- Veli yalnız kendi öğrencisi adına yazabilir; parametre yok sayılır.
    hedef      := o.ogrenci_id;
    kimden     := 'veli';
    v_kanal    := 'veli';
    -- 0058: alıcıyı veli SEÇİYOR; tek öğretmen varsa seçmesi gerekmiyor.
    v_ogretmen := public._mesaj_alicisi(o.ogrenci_id, p_ogretmen_id);
  elsif o.rol = 'ogrenci' then
    -- ÖĞRENCİ ARTIK YAZABİLİYOR — ama yalnız kendi yazışmasına.
    hedef      := o.ogrenci_id;
    kimden     := 'ogrenci';
    v_kanal    := 'ogrenci';
    v_ogretmen := public._mesaj_alicisi(o.ogrenci_id, p_ogretmen_id);
  else
    raise exception 'Bu bölümde mesaj gönderemezsiniz.' using errcode = '42501';
  end if;

  -- DEĞİŞEN SATIR (0027): ikinci argüman olmadan sekme ve satır sonu
  -- kırpılmıyordu; yalnız boşluktan oluşan mesaj buradan geçiyordu.
  if length(btrim(coalesce(p_metin, ''), E' \t\r\n')) = 0 then
    raise exception 'Mesaj boş olamaz.' using errcode = '22023';
  end if;

  -- DEĞİŞEN SATIR (0027): baştaki/sondaki satır sonları da kırpılıyor.
  -- İÇERİDEKİ satır sonlarına dokunulmuyor — çok satırlı mesaj meşru.
  insert into public.mesajlar (ogrenci_id, kimden, metin, kanal, ogretmen_id)
  values (hedef, kimden, btrim(p_metin, E' \t\r\n'), v_kanal, v_ogretmen);

  return jsonb_build_object('durum', 'tamam');
end;
$function$;

-- -----------------------------------------------------------------------------
-- 4. okundu_isaretle — 0049, iki öğretmende hata vermiyor
-- -----------------------------------------------------------------------------
create or replace function public.okundu_isaretle(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  v_kanal text;
  v_ogretmen uuid;
begin
  select * into o from public._oturum(p_token);
  if o.rol not in ('ogrenci', 'veli') then
    raise exception 'Bu işlem yalnız öğrenci ve veli içindir.' using errcode = '42501';
  end if;
  perform public._onam_kapisi(o.rol, o.ogrenci_id);

  -- Kanal adı rolle aynı (0025): öğrenci 'ogrenci', veli 'veli'.
  v_kanal := o.rol;

  -- 0058: `_ogrencinin_ogretmeni` İKİ ÖĞRETMENDE HATA VERİYORDU ve okundu
  -- işareti hiç yazılmıyordu (ekran hatayı yuttuğu için görünmedi; rozet
  -- düşmüyordu). Öğrenci/velinin işareti KİŞİ BAŞINA tek satır (0049);
  -- `ogretmen_id` yalnız birincil anahtar için dolu olmalı. Listenin
  -- başındaki öğretmen yazılıyor — hiç öğretmen yoksa eski satırın
  -- yalnız zamanı ilerliyor.
  select (e->>'id')::uuid into v_ogretmen
    from jsonb_array_elements(public._ogrencinin_ogretmenleri(o.ogrenci_id)) e
   limit 1;
  if v_ogretmen is null then
    update public.okundu set zaman = now()
     where ogrenci_id = o.ogrenci_id and rol = o.rol and kanal = v_kanal;
    return jsonb_build_object('durum', 'tamam');
  end if;

  insert into public.okundu (ogrenci_id, rol, kanal, ogretmen_id, zaman)
  values (o.ogrenci_id, o.rol, v_kanal, v_ogretmen, now())
  -- 0049: ÇAKIŞMA ARTIK KİŞİ ÜZERİNDEN. `ogretmen_id` de güncelleniyor
  -- ki satır öğrencinin bugünkü öğretmenini göstersin.
  on conflict (ogrenci_id, rol, kanal) where rol <> 'ogretmen'
  do update set zaman = now(), ogretmen_id = excluded.ogretmen_id;

  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. veli_paneli — 0047 + mesajda öğretmen + öğretmen listesi
-- -----------------------------------------------------------------------------
create or replace function public.veli_paneli(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  ogr record;
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'veli' then
    raise exception 'Bu bölüm yalnızca veliler içindir.' using errcode = '42501';
  end if;

  -- ONAM KAPISI (0034) — BURADA HATA DEĞİL, ERKEN DÖNÜŞ.
  --
  -- Bu uç hata verseydi veli kabuğu çöker, veli onam metnini bile
  -- göremeden beyaz ekranda kalırdı. Bunun yerine çocuğa ait TEK BİR
  -- ALAN bile okunmadan dönülüyor: aşağıdaki `select ... into ogr` hiç
  -- çalışmıyor. Kapı yine sunucuda; arayüz sadece ne çizeceğini
  -- öğreniyor.
  if not exists (
    select 1 from public.veli_onaylari v
    where v.ogrenci_id = o.ogrenci_id
      and v.metin_surumu = public._gecerli_onam_surumu()
  ) then
    return jsonb_build_object(
      'onam_gerekli', true,
      'surum', public._gecerli_onam_surumu()
    );
  end if;

  select ogr2.id, ogr2.ad, ogr2.tur, s.ad as sinif, ogr2.sinif_id into ogr
  from public.ogrenciler ogr2
  left join public.siniflar s on s.id = ogr2.sinif_id
  where ogr2.id = o.ogrenci_id;

  return jsonb_build_object(
    'ogrenci', jsonb_build_object('ad', ogr.ad, 'sinif', ogr.sinif, 'tur', ogr.tur),

    -- GENEL ORTALAMA (0029) — YALNIZ ÇOCUĞUN KENDİSİ.
    --
    -- 0047'YE KADAR BURADA ŞU YAZIYORDU: "Sınıf ortalaması, sıralama,
    -- başka öğrencinin verisi BURAYA DA eklenmiyor." O CÜMLE ARTIK
    -- DOĞRU DEĞİL ve silinmek yerine düzeltiliyor: öğretmen ve okul
    -- müdürü 0047'de ödev BAZINDA sınıf/seviye ortalamasının görünmesine
    -- karar verdi (aşağıdaki 'kiyas' alanı).
    --
    -- DEĞİŞMEYEN KISIM: bu alan, yani ÇOCUĞUN GENEL ortalaması, hâlâ
    -- yalnız çocuğun kendisi. Sıralama hiçbir yerde yok, başka bir
    -- öğrencinin verisi hiçbir yerde yok. Kıyas ödev bazında ve
    -- İSİMSİZ bir toplamdan ibaret.
    --
    -- GÖNDERİLMEYEN ÖDEV 0 OLARAK GİRMİYOR. Tanıtım metninin kendi
    -- cümlesi bunu söylüyor: "Yapılmayan ödevler puanlandırılmaz."
    -- Puanlanmamış bir işi ortalamaya sıfırla katmak, öğrenciyi
    -- yapmadığı bir sınavdan kalmış gibi gösterirdi.
    --
    -- Ölçüt `kendi_karnem.odev_sayisi` ile aynı pencereyi kullanıyor
    -- (yayında + süresi dolmuş) ki ekrandaki "N değerlendirilmiş ödev
    -- üzerinden" satırıyla aynı şeyden söz etsin.
    --
    -- Puan `coalesce(ogretmen_puan, puan)`: arayüzdeki ve
    -- `sinif_ogrencileri`'ndeki hesabın aynısı.
    'genel_ortalama', (
      select round(avg(coalesce(g2.ogretmen_puan, g2.puan)), 1)
        from public.gonderimler g2
        join public.odevler d2 on d2.id = g2.odev_id
       where g2.ogrenci_id = ogr.id
         and d2.sinif_id = ogr.sinif_id
         and d2.yayinda
         and d2.son_tarih < (now() at time zone 'Europe/Istanbul')::date
         and coalesce(g2.ogretmen_puan, g2.puan) is not null
    ),
    'odevler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'baslik', d.baslik,
        'son_tarih', d.son_tarih,
        'olusturma', d.created_at,
        'gonderildi', (g.id is not null),
        'gonderim_zamani', g.created_at,
        'puan', coalesce(g.ogretmen_puan, g.puan),
        'durum', g.durum,
        'konu_analizi', case when g.id is not null
          then public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
          else '[]'::jsonb end,
        -- ÖDEV KIYASI (0047) — satırın İÇİNE gömülü, çünkü veliye ödev
        -- kimliği gitmiyor ve kimlikle ayrı bir çağrı yapamıyor.
        -- `konu_analizi` ile aynı desen, hesabı `_odev_kiyasi` yapıyor:
        -- öğrencinin gördüğü sayıyla veliye giden sayı AYNI koddan.
        'kiyas', public._odev_kiyasi(d.id),
        -- VELİYE YALNIZ NUMARA. Şık gitmiyor (Kural 6).
        'yanlis_sorular', case when g.id is not null and d.tur = 'test'
          then public._soru_dokumu(d.cevap_anahtari, g.cevaplar, d.soru_sayisi) -> 'yanlis'
          else '[]'::jsonb end,
        'bos_sorular', case when g.id is not null and d.tur = 'test'
          then public._soru_dokumu(d.cevap_anahtari, g.cevaplar, d.soru_sayisi) -> 'bos'
          else '[]'::jsonb end
      ) order by d.son_tarih desc)
      from public.odevler d
      left join public.gonderimler g
        on g.odev_id = d.id and g.ogrenci_id = ogr.id
      where d.yayinda and d.sinif_id = ogr.sinif_id
    ), '[]'::jsonb),
    -- YALNIZ VELİ YAZIŞMASI. Öğrencinin öğretmenle yazdıkları buradan
    -- ÇIKMIYOR: çocuk da öğretmenine velisinin okumayacağını varsayarak
    -- yazıyor. Ayrım tabloda, arayüzde değil.
    'mesajlar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kimden', m.kimden, 'metin', m.metin, 'zaman', m.created_at,
               -- 0058: mesaj hangi öğretmenle olan yazışmaya ait.
               'ogretmen_id', m.ogretmen_id,
               'ogretmen', (select g.ad from public.ogretmenler g where g.id = m.ogretmen_id))
             order by m.created_at)
      from public.mesajlar m
      where m.ogrenci_id = ogr.id and m.kanal = 'veli'
    ), '[]'::jsonb),
    -- 0058: velinin mesaj yazabileceği öğretmenler (sınıf öğretmeni önce).
    'ogretmenler', public._ogrencinin_ogretmenleri(ogr.id),
    'okunmamis_mesaj', (
      select count(*)::integer from public.mesajlar m
      where m.ogrenci_id = ogr.id and m.kanal = 'veli' and m.kimden = 'ogretmen'
        and m.created_at > coalesce(
              (select k.zaman from public.okundu k
                where k.ogrenci_id = ogr.id and k.rol = 'veli' and k.kanal = 'veli'),
              '-infinity'::timestamptz)
    ),
    'odemeler', case when ogr.tur = 'ozel' then coalesce((
      select jsonb_agg(jsonb_build_object('tutar', p.tutar, 'tarih', p.tarih, 'odendi', p.odendi)
                       order by p.tarih desc)
      from public.odemeler p where p.ogrenci_id = ogr.id
    ), '[]'::jsonb) else '[]'::jsonb end,
    -- KANAL SÜZGECİ DE ŞART. 0019'da rol süzgeci unutulunca alt sorgu üç
    -- satır dönüp fonksiyon çökmüştü; anahtar üç sütuna çıkınca aynı tuzak
    -- kanal için yeniden kuruluyor.
    'son_gorulme', (select k.zaman from public.okundu k
                     where k.ogrenci_id = ogr.id and k.rol = 'veli' and k.kanal = 'veli')
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. ogrenci_mesajlari — 0025 + mesajda öğretmen + öğretmen listesi
-- -----------------------------------------------------------------------------
create or replace function public.ogrenci_mesajlari(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
begin
  select * into o from public._oturum(p_token);
  if o.rol <> 'ogrenci' then
    raise exception 'Bu bölüm yalnızca öğrenciler içindir.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'mesajlar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kimden', m.kimden, 'metin', m.metin, 'zaman', m.created_at,
               -- 0058: mesaj hangi öğretmenle olan yazışmaya ait.
               'ogretmen_id', m.ogretmen_id,
               'ogretmen', (select g.ad from public.ogretmenler g where g.id = m.ogretmen_id))
             order by m.created_at)
      from public.mesajlar m
      where m.ogrenci_id = o.ogrenci_id and m.kanal = 'ogrenci'
    ), '[]'::jsonb),
    -- 0058: öğrencinin mesaj yazabileceği öğretmenler (sınıf öğretmeni önce).
    'ogretmenler', public._ogrencinin_ogretmenleri(o.ogrenci_id),
    'son_gorulme', (select k.zaman from public.okundu k
                     where k.ogrenci_id = o.ogrenci_id
                       and k.rol = 'ogrenci' and k.kanal = 'ogrenci')
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. YETKİLER (0005 deseni)
-- -----------------------------------------------------------------------------
revoke all on function public._ogrencinin_ogretmenleri(uuid) from public, anon, authenticated;
revoke all on function public._mesaj_alicisi(uuid, uuid) from public, anon, authenticated;

revoke all on function public.mesaj_gonder(text, text, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.mesaj_gonder(text, text, uuid, text, uuid) to anon, authenticated;

revoke all on function public.okundu_isaretle(text) from public, anon, authenticated;
grant execute on function public.okundu_isaretle(text) to anon, authenticated;

revoke all on function public.veli_paneli(text) from public, anon, authenticated;
grant execute on function public.veli_paneli(text) to anon, authenticated;

revoke all on function public.ogrenci_mesajlari(text) from public, anon, authenticated;
grant execute on function public.ogrenci_mesajlari(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 8. KENDİ KENDİNİ DENETLEME
-- -----------------------------------------------------------------------------
do $$
declare
  ad text;
begin
  if to_regprocedure('public.mesaj_gonder(text, text, uuid, text)') is not null then
    raise exception '0058: eski mesaj_gonder imzası hâlâ ayakta';
  end if;
  if (select count(*) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'mesaj_gonder') <> 1 then
    raise exception '0058: mesaj_gonder için birden fazla tanım var';
  end if;

  -- Hiçbir canlı uç artık tek-öğretmen varsayımıyla patlamamalı.
  foreach ad in array array['mesaj_gonder', 'okundu_isaretle'] loop
    if exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = ad
         and pg_get_functiondef(p.oid) like '%public._ogrencinin_ogretmeni(%'
    ) then
      raise exception '0058: % hâlâ _ogrencinin_ogretmeni çağırıyor', ad;
    end if;
  end loop;

  foreach ad in array array['veli_paneli', 'ogrenci_mesajlari'] loop
    if not exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = ad
         and pg_get_functiondef(p.oid) like '%_ogrencinin_ogretmenleri(%'
    ) then
      raise exception '0058: % öğretmen listesini döndürmüyor', ad;
    end if;
  end loop;

  if has_function_privilege('anon', 'public._ogrencinin_ogretmenleri(uuid)', 'execute')
     or has_function_privilege('anon', 'public._mesaj_alicisi(uuid, uuid)', 'execute') then
    raise exception '0058: dahili yardımcı istemciye açık';
  end if;
  if not has_function_privilege('anon', 'public.mesaj_gonder(text, text, uuid, text, uuid)', 'execute') then
    raise exception '0058: mesaj_gonder istemciye kapalı';
  end if;
end $$;

select public._migration_kaydet('0058');
