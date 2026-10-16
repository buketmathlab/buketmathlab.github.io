-- =============================================================================
-- SEKİZ — 0080: İKİ ORTALAMA (YAPTIĞI ÖDEVLER · TÜM ÖDEVLER)
--
-- Öğretmenin isteği: "Öğrenciler sekmesinde yaptığı ödevden aldığı
-- ortalaması ve yapılan yapılmayan tüm ödevlerden aldığı ortalaması ayrı
-- ayrı yazılsın… amacım ödevini yaparsa ortalamasının ne kadar
-- yükseleceğini görmesi."
--
-- Öğretmenin kararları (sorulup alındı):
--   • İki ortalamayı öğretmen, öğrenci ve veli birlikte görür.
--   • Puanlanmamış gönderim (puan bekleyen) puan verilene kadar İKİ
--     ortalamaya da girmez. Yalnız hiç gönderilmemiş ödev 0 sayılır.
--     (0051'den beri öğretmen listesi puanlanmamış gönderimi 0 sayıyordu;
--     bu, gönderen öğrenciyi göndermemiş gibi gösteriyordu.)
--
-- NE DEĞİŞİYOR
--   1. Yeni dahili yardımcı `_ogrenci_ortalamalari`: iki ortalama ve
--      sayılar TEK yerde hesaplanır. Ödev kümesi `sinif_ogrenci_ozeti` ile
--      aynı: sınıfın yayındaki, süresi dolmuş ve öğrenciye düşen ödevleri.
--      Dışarıya kapalı; yalnız aşağıdaki uçlar çağırır.
--   2. `sinif_ogrenci_ozeti`: `ortalama` yardımcının tüm ödevler
--      ortalaması; yeni alanlar `yapilan_ortalama`, `puan_bekleyen`.
--   3. `kendi_karnem`: `genel_ortalama` (yaptığı ödevler) yardımcıdan;
--      yeni alanlar `tum_ortalama`, `yapilmayan`, `puan_bekleyen`.
--      Yalnız çocuğun kendi verisi; sınıf ortalaması, sıralama yok.
--
-- Fonksiyon gövdeleri MEKANİK kopya (sinif_ogrenci_ozeti: 0073,
-- kendi_karnem: 0064); yalnız işaretli satırlar değişti. İmzalar ve
-- yetkiler değişmedi.
--
-- Bu dosya tekrar çalıştırılabilir. Ön koşul: 0079.
-- =============================================================================

do $$
begin
  if pg_get_functiondef('public.odev_guncelle'::regproc)
       not like '%tum_sayfalar = (d.tum_sayfalar or p_sayfa_limiti is not null)%' then
    raise exception '0080: önce 0079 çalıştırılmalı';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. _ogrenci_ortalamalari — iki ortalama, tek tanım
-- -----------------------------------------------------------------------------
-- Puan: `coalesce(ogretmen_puan, puan)` (arayüzdeki hesabın aynısı).
--   yapilan_ortalama = puanlı gönderimlerin ortalaması
--   tum_ortalama     = (puanlı gönderimler + gönderilmemişler 0) ortalaması
-- Puanlanmamış gönderim iki ortalamada da YOK (avg null'ı atlar).
-- Ortalamalar yuvarlanmadan döner; uçlar kendi hassasiyetinde yuvarlar.
create or replace function public._ogrenci_ortalamalari(
  p_ogrenci uuid,
  p_sinif uuid,
  p_sinif_giris date
)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  with o as (
    select g.id is not null as gonderdi,
           coalesce(g.ogretmen_puan, g.puan) as puan
      from public.odevler d
      left join public.gonderimler g
        on g.odev_id = d.id and g.ogrenci_id = p_ogrenci
     where d.sinif_id = p_sinif
       and d.yayinda
       and d.son_tarih < (now() at time zone 'Europe/Istanbul')::date
       and public._odev_ogrenciye_dusar(p_sinif_giris, d.son_tarih, d.created_at)
  )
  select jsonb_build_object(
    'odev_sayisi',      count(*)::integer,
    'yapilan',          (count(*) filter (where gonderdi))::integer,
    'yapilmayan',       (count(*) filter (where not gonderdi))::integer,
    'puan_bekleyen',    (count(*) filter (where gonderdi and puan is null))::integer,
    'yapilan_ortalama', avg(puan) filter (where gonderdi),
    'tum_ortalama',     avg(case when gonderdi then puan else 0 end)
  )
  from o;
$$;

revoke all on function public._ogrenci_ortalamalari(uuid, uuid, date)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. sinif_ogrenci_ozeti — iki ortalama ve puan bekleyen (gövde: 0073)
-- -----------------------------------------------------------------------------
create or replace function public.sinif_ogrenci_ozeti(p_token text, p_sinif_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun_tr date := (now() at time zone 'Europe/Istanbul')::date;
  v_ogretmen uuid;
  v_sinif record;
begin
  v_ogretmen := public._ogretmen(p_token);
  if not public._ogretmenin_sinifi(v_ogretmen, p_sinif_id) then
    raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
  end if;

  select s.id, s.ad, s.ozel into v_sinif
    from public.siniflar s where s.id = p_sinif_id and not s.arsiv;
  if not found then
    raise exception 'Sınıf bulunamadı ya da arşivde.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'sinif', jsonb_build_object('id', v_sinif.id, 'ad', v_sinif.ad, 'ozel', v_sinif.ozel),
    'ogrenciler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id,
               'ad', o.ad,
               'ogrenci_no', o.ogrenci_no,
               'tur', o.tur,

               -- ORTALAMA — öğretmenin 1. kararı (0051): TÜM ödevler,
               -- yapılmayan 0. 0080: puanlanmamış gönderim (puan bekleyen)
               -- artık 0 sayılmıyor; puan verilene kadar hesaba girmiyor.
               'ortalama', round((oo.x->>'tum_ortalama')::numeric, 2),

               -- 0080: YAPTIĞI ödevlerin ortalaması (puanlı gönderimler).
               -- İki sayı arasındaki fark, yapılmayan ödevlerin bedeli.
               'yapilan_ortalama', round((oo.x->>'yapilan_ortalama')::numeric, 2),

               -- 0080: gönderdiği ama henüz puanı olmayan ödev sayısı.
               'puan_bekleyen', (oo.x->>'puan_bekleyen')::integer,

               -- SÜRESİ DOLMUŞ ÖDEV SAYISI — ortalamanın paydası.
               'odev_sayisi', (
                 select count(*)::integer from public.odevler d
                  where d.sinif_id = p_sinif_id and d.yayinda
                    and d.son_tarih < bugun_tr
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
               ),

               -- YAPILAN (0052) — bu ödevlerin kaçında GÖNDERİM VAR.
               -- Puanına bakılmıyor: sıfır alan da yapmıştır.
               'yapilan', (
                 select count(*)::integer from public.odevler d
                  where d.sinif_id = p_sinif_id and d.yayinda
                    and d.son_tarih < bugun_tr
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
                    and exists (select 1 from public.gonderimler g
                                 where g.odev_id = d.id and g.ogrenci_id = o.id)
               ),

               -- YAPILMAYAN (0052) — aynı kümenin geri kalanı.
               'yapilmayan', (
                 select count(*)::integer from public.odevler d
                  where d.sinif_id = p_sinif_id and d.yayinda
                    and d.son_tarih < bugun_tr
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
                    and not exists (select 1 from public.gonderimler g
                                     where g.odev_id = d.id and g.ogrenci_id = o.id)
               ),

               -- EKSİK KONULAR (0053) — en fazla 3, en eksikten başlayarak.
               -- Ölçüt ve alt sınır 0051'den değişmedi; yalnız `limit 1`
               -- `limit 3` oldu ve sonuç bir DİZİ.
               'eksik_konular', coalesce((
                 select jsonb_agg(t.konu order by t.eksik desc, t.konu)
                   from (
                     select e->>'konu' as konu,
                            sum((e->>'toplam')::integer) as toplam,
                            sum((e->>'dogru')::integer)  as dogru,
                            sum((e->>'toplam')::integer) - sum((e->>'dogru')::integer)
                              as eksik
                       from public.odevler d
                       join public.gonderimler g
                         on g.odev_id = d.id and g.ogrenci_id = o.id
                       cross join lateral jsonb_array_elements(
                         public._konu_analizi(d.konular, d.cevap_anahtari,
                                              g.cevaplar, d.soru_sayisi)
                       ) e
                      where d.sinif_id = p_sinif_id
                        and d.yayinda
                        and d.son_tarih < bugun_tr
                        and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
                        and d.tur = 'test'
                      group by e->>'konu'
                     having sum((e->>'toplam')::integer) >= 5
                        and sum((e->>'toplam')::integer) - sum((e->>'dogru')::integer) > 0
                      order by sum((e->>'toplam')::integer) - sum((e->>'dogru')::integer) desc,
                               e->>'konu'
                      limit 3
                   ) t
               ), '[]'::jsonb)
             )
             -- SINIF LİSTESİ SIRASI (öğretmenin isteği): okul numarası.
             order by o.ogrenci_no is null, o.ogrenci_no, o.ad)
      from public.ogrenciler o
      -- 0080: iki ortalama tek yardımcıdan, öğrenci başına bir kez.
      cross join lateral (
        select public._ogrenci_ortalamalari(o.id, p_sinif_id, o.sinif_giris) as x
      ) oo
      where o.sinif_id = p_sinif_id and (o.aktif and not o.deneme)
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. kendi_karnem — tüm ödevler ortalaması da (gövde: 0064)
-- -----------------------------------------------------------------------------
create or replace function public.kendi_karnem(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun_tr      date := (now() at time zone 'Europe/Istanbul')::date;
  o             record;
  v_ogrenci_id  uuid;
  v_ad          text;
  v_sinif_id    uuid;
  v_sinif_ad    text;
  v_odev_sayisi integer;
  v_giris       date;
  v_ort         jsonb;
begin
  select * into o from public._oturum(p_token);
  -- ONAM KAPISI (0034). Veli dışındaki rollerde etkisiz: bu iki uç
  -- öğrenci tarafından da kullanılıyor.
  perform public._onam_kapisi(o.rol, o.ogrenci_id);

  -- ÖĞRETMEN BURAYA GİRMİYOR. Onun ucu `konu_karnesi` ve orada sınıf ya da
  -- öğrenci seçebiliyor; burada seçilecek bir şey yok.
  if o.rol not in ('ogrenci', 'veli') then
    raise exception 'Bu bölüm öğrenci ve veli içindir.' using errcode = '42501';
  end if;
  if o.ogrenci_id is null then
    raise exception 'Geçersiz oturum.' using errcode = '42501';
  end if;

  v_ogrenci_id := o.ogrenci_id;

  select g.ad, g.sinif_id, g.sinif_giris into v_ad, v_sinif_id, v_giris
    from public.ogrenciler g where g.id = v_ogrenci_id;
  if v_ad is null then
    raise exception 'Öğrenci bulunamadı.' using errcode = 'P0002';
  end if;

  -- 0080: iki ortalama, öğretmenin listesiyle AYNI yardımcıdan.
  v_ort := public._ogrenci_ortalamalari(v_ogrenci_id, v_sinif_id, v_giris);

  select s.ad into v_sinif_ad from public.siniflar s where s.id = v_sinif_id;

  -- 0013 VE 0023 İLE BİREBİR AYNI ÖLÇÜT.
  select count(*)::integer into v_odev_sayisi
  from public.odevler d
  where d.sinif_id = v_sinif_id and public._odev_ogrenciye_dusar(v_giris, d.son_tarih, d.created_at) and d.yayinda and d.son_tarih < bugun_tr;

  return jsonb_build_object(
    -- `mevcut` YOK (0023'te var). Sınıfın kaç kişi olduğu bu ekrana ait
    -- değil; kıyasın en küçük tohumu bile gönderilmiyor.
    'kapsam', jsonb_build_object('ad', v_ad, 'sinif', v_sinif_ad),

    -- "Kaç ödev üzerinden konuşuyoruz" — iki konu arasındaki farkı
    -- yorumlayabilmek için gereken tek bağlam sayısı.
    'odev_sayisi', v_odev_sayisi,

    -- GENEL ORTALAMA (0029) — YALNIZ ÇOCUĞUN KENDİSİ.
    --
    -- Sınıf ortalaması, sıralama, başka öğrencinin verisi BURAYA DA
    -- eklenmiyor; 0026'da bilerek dışarıda bırakılmışlardı ve o karar
    -- değişmedi. Çocuk kendi gidişatını görüyor, kimseyle
    -- karşılaştırılmıyor.
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
    --
    -- 0080: hesap `_ogrenci_ortalamalari`'na taşındı (anlam aynı: yaptığı
    -- ve puanlanmış ödevler). Ödev kümesi öğretmenin listesiyle birleşti:
    -- sınıfa gelmeden önce kapanmış ödev buraya da girmiyor.
    'genel_ortalama', round((v_ort->>'yapilan_ortalama')::numeric, 1),

    -- 0080 — TÜM ÖDEVLER ORTALAMASI (öğretmenin isteği): yapılmayan ödev
    -- 0 sayılır. Amaç kıyas değil; çocuk, ödevlerini yaparsa kendi
    -- ortalamasının ne kadar yükseleceğini görsün. Yine YALNIZ kendisi.
    -- Puanlanmamış gönderim puan verilene kadar ikisine de girmez.
    'tum_ortalama', round((v_ort->>'tum_ortalama')::numeric, 1),
    'yapilmayan', (v_ort->>'yapilmayan')::integer,
    'puan_bekleyen', (v_ort->>'puan_bekleyen')::integer,

    -- -----------------------------------------------------------------
    -- KONU DÖKÜMÜ — yalnız TEST ödevlerinden (0023 ile aynı gerekçe)
    --
    -- Açık uçlu ödevin konu eşlemesi yok: anahtarı olmayan bir ödevde
    -- `_konu_analizi` her soruyu "boş" sayardı ve döküm, öğretmenin hiç
    -- sormadığı bir soruya uydurma bir cevap verirdi.
    --
    -- Sıralama da aynı: en çok eksik olan konu başta. Arayüz bu sırayı
    -- bozmuyor — bozsaydı "en zayıf konu" iddiası ekrandan ekrana
    -- değişebilirdi.
    -- -----------------------------------------------------------------
    'konular', coalesce((
      select jsonb_agg(jsonb_build_object(
               'konu', t.konu, 'toplam', t.toplam,
               'dogru', t.dogru, 'yanlis', t.yanlis, 'bos', t.bos)
             order by (t.toplam - t.dogru) desc, t.konu)
      from (
        select e->>'konu' as konu,
               sum((e->>'toplam')::integer)::integer as toplam,
               sum((e->>'dogru')::integer)::integer  as dogru,
               sum((e->>'yanlis')::integer)::integer as yanlis,
               sum((e->>'bos')::integer)::integer    as bos
        from public.odevler d
        join public.gonderimler g on g.odev_id = d.id
        cross join lateral jsonb_array_elements(
          public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
        ) e
        where d.sinif_id = v_sinif_id and public._odev_ogrenciye_dusar(v_giris, d.son_tarih, d.created_at)
          and d.yayinda
          and d.son_tarih < bugun_tr
          and d.tur = 'test'
          -- TEK BAĞ: kendi gönderimleri. Başka öğrencinin cevabı bu
          -- toplama hiçbir koşulda giremez.
          and g.ogrenci_id = v_ogrenci_id
        group by e->>'konu'
      ) t
    ), '[]'::jsonb),

    -- -----------------------------------------------------------------
    -- GELİŞİM — ödev ödev, kronolojik
    --
    -- AÇIK UÇLU ÖDEV BURADA VAR: konu eşlemesi yok ama puanı var, ve
    -- "dönem boyunca nereye gidiyorum" sorusunun cevabından açık uçlu
    -- ödevleri çıkarmak resmin yarısını silerdi.
    --
    -- GÖNDERİLMEYEN ÖDEV 0 DEĞİL, BOŞ (`deger: null`). Sıfır yazmak
    -- "sıfır aldı" demektir; göndermemek başka bir şeydir.
    --
    -- `gonderen` VE `mevcut` YOK (0023'te var). Onlar sınıf bilgisi;
    -- burada "kaç kişiden kaçı gönderdi" demek kıyas kapısını açardı.
    -- `Gelisim` bileşeni `kapsam='ogrenci'` iken o alanları zaten
    -- çizmiyor (ölçüldü), yani ekranda bir eksiklik oluşmuyor.
    --
    -- HİÇBİR EĞİLİM İDDİASI YOK: ne "yükseliyor" ne "düşüyor". Üç
    -- noktadan yön çıkarmak ölçemeyeceğim bir iddia olurdu.
    -- -----------------------------------------------------------------
    'gelisim', coalesce((
      select jsonb_agg(jsonb_build_object(
               'odev', d.baslik,
               'tarih', d.son_tarih,
               'tur', d.tur,
               'deger', i.deger)
             order by d.son_tarih, d.baslik)
      from public.odevler d
      cross join lateral (
        select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1) as deger
        from public.gonderimler g
        where g.odev_id = d.id and g.ogrenci_id = v_ogrenci_id
      ) i
      where d.sinif_id = v_sinif_id and public._odev_ogrenciye_dusar(v_giris, d.son_tarih, d.created_at)
        and d.yayinda
        and d.son_tarih < bugun_tr
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Kendi kendini doğrulama
-- -----------------------------------------------------------------------------
do $$
begin
  if pg_get_functiondef('public.sinif_ogrenci_ozeti(text, uuid)'::regprocedure)
       not like '%_ogrenci_ortalamalari(o.id, p_sinif_id, o.sinif_giris)%' then
    raise exception '0080: sinif_ogrenci_ozeti yardımcıyı kullanmıyor';
  end if;
  if pg_get_functiondef('public.sinif_ogrenci_ozeti(text, uuid)'::regprocedure)
       like '%0)), 2)%' then
    raise exception '0080: sinif_ogrenci_ozeti eski formülü taşıyor';
  end if;
  if pg_get_functiondef('public.kendi_karnem(text)'::regprocedure)
       not like '%''tum_ortalama''%' then
    raise exception '0080: kendi_karnem tum_ortalama dönmüyor';
  end if;
  if has_function_privilege('anon', 'public._ogrenci_ortalamalari(uuid, uuid, date)', 'execute')
     or has_function_privilege('authenticated', 'public._ogrenci_ortalamalari(uuid, uuid, date)', 'execute') then
    raise exception '0080: _ogrenci_ortalamalari dışarıya açık';
  end if;
end $$;

select public._migration_kaydet('0080');
