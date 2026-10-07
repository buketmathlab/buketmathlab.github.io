-- =============================================================================
-- 0071 — VELİ ÖDEV KARTINDAN SORU PDF'İ VE ÇOCUĞUN ÇÖZÜMÜ
--
-- Öğretmenin bildirimi: veli hesabında ödev kartına dokununca hiçbir şey
-- açılmıyordu. Öğretmenin kararı: "Çözüm + soru PDF'i" — veli ödevin soru
-- PDF'ini ve çocuğunun gönderdiği çözümü açabilsin. Cevap anahtarı ASLA.
--
-- 1. dosya_erisim_izni — veli dalına soru PDF'i (çocuğun sınıfı, yayında,
--    çocuğa düşen ödev; dosya depoda var). Çözüm sayfaları izni zaten vardı.
--    Kopya: 0063.
-- 2. veli_paneli — her ödev satırına `odev_yolu` ve `cozum_yollari`.
--    Kopya: 0064.
--
-- Bu dosya tekrar çalıştırılabilir. Ön koşul: 0070.
-- =============================================================================

create or replace function public.dosya_erisim_izni(p_token text, p_yol text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
begin
  select * into o from public._oturum(p_token);
  -- ONAM KAPISI (0034). Veli dışındaki rollerde etkisiz: bu iki uç
  -- öğrenci tarafından da kullanılıyor.
  perform public._onam_kapisi(o.rol, o.ogrenci_id);

  if o.rol = 'ogretmen' then
    return true;
  end if;

  if o.rol = 'ogrenci' then
    return
      -- kendi gönderdiği çözüm kâğıdı (teslimden sonra görüntülemek için)
      exists (
        select 1 from public.gonderimler g
        where g.ogrenci_id = o.ogrenci_id
          and (g.foto_yolu = p_yol or p_yol = any(g.ek_sayfa_yollari))
      )
      -- teslim ettiği ödevin cevap anahtarı
      or exists (
        select 1 from public.odevler d
        join public.gonderimler g on g.odev_id = d.id and g.ogrenci_id = o.ogrenci_id
        where d.anahtar_url = p_yol
      )
      -- kendi sınıfındaki yayındaki ödevin soru PDF'i (teslim şartı yok)
      or exists (
        select 1 from public.odevler d
        join public.ogrenciler ogr on ogr.id = o.ogrenci_id
        where d.odev_url = p_yol
          and d.yayinda
          and d.sinif_id = ogr.sinif_id
      )
      -- YENİ: henüz göndermeden, kendi çözüm fotoğrafını YÜKLEMEK için
      or public._cozum_yolu_gecerli(o.ogrenci_id, p_yol);
  end if;

  -- 0063 — MÜDÜR: özel ders dışındaki YAYINDAKİ ödevlerin soru PDF'i ve
  -- cevap anahtarı PDF'i (öğretmenin isteği). Öğrencinin çözüm kâğıdı yok.
  --
  -- DOSYA DEPODA VAR OLMALI. Edge Function bu izinle OKUMA da YÜKLEME de
  -- adresi üretebiliyor (`islem`); yükleme üzerine yazmıyor (upsert yok).
  -- Var olan dosyaya yükleme her zaman reddedildiği için müdür bu kapıdan
  -- hiçbir dosya oluşturamıyor — salt izleme depoda da geçerli.
  if o.rol = 'mudur' then
    return exists (
      select 1 from public.odevler d
      join public.siniflar s on s.id = d.sinif_id
      where d.yayinda and not s.ozel
        and (d.odev_url = p_yol or d.anahtar_url = p_yol)
    ) and exists (
      select 1 from storage.objects so
      where so.bucket_id = 'odev-dosyalari' and so.name = p_yol
    );
  end if;

  if o.rol = 'veli' then
    return
      -- çocuğun kendi gönderdiği çözüm sayfaları (0034'ten beri)
      exists (
        select 1 from public.gonderimler g
        where g.ogrenci_id = o.ogrenci_id
            and (g.foto_yolu = p_yol or p_yol = any(g.ek_sayfa_yollari))
      )
      -- 0071 — ÖDEVİN SORU PDF'İ (öğretmenin isteği: "Çözüm + soru PDF'i").
      -- Kapsam veli listesinin AYNISI: çocuğun sınıfında, yayında ve
      -- çocuğa düşen (`_odev_ogrenciye_dusar`) ödev. CEVAP ANAHTARI YOK
      -- (`anahtar_url` bu dalda hiç geçmiyor — Kural 6).
      --
      -- DOSYA DEPODA VAR OLMALI — müdür dalıyla aynı gerekçe: Edge Function
      -- bu izinle yükleme adresi de üretebiliyor; upsert olmadığı için var
      -- olan dosyaya yükleme reddediliyor. Veli bu kapıdan dosya OLUŞTURAMAZ.
      or (exists (
            select 1 from public.odevler d
            join public.ogrenciler ogr on ogr.id = o.ogrenci_id
            where d.odev_url = p_yol
              and d.yayinda
              and d.sinif_id = ogr.sinif_id
              and public._odev_ogrenciye_dusar(ogr.sinif_giris, d.son_tarih, d.created_at)
          )
          and exists (
            select 1 from storage.objects so
            where so.bucket_id = 'odev-dosyalari' and so.name = p_yol
          ));
  end if;

  return false;
end;
$$;

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

  select ogr2.id, ogr2.ad, ogr2.tur, s.ad as sinif, ogr2.sinif_id, ogr2.sinif_giris into ogr
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
          else '[]'::jsonb end,
        -- 0071 — VELİ SORULARI VE ÇOCUĞUN ÇÖZÜMÜNÜ AÇABİLSİN. Yalnız YOL
        -- gidiyor; imzalı adresi `dosya-url` her dokunuşta yeniden üretiyor
        -- ve izni `dosya_erisim_izni` orada yeniden denetliyor. Cevap
        -- anahtarının yolu buraya EKLENMİYOR (Kural 6).
        'odev_yolu', d.odev_url,
        'cozum_yollari', case when g.id is not null and g.foto_yolu is not null
          then to_jsonb(array[g.foto_yolu] || coalesce(g.ek_sayfa_yollari, '{}'::text[]))
          else '[]'::jsonb end
      ) order by d.son_tarih desc)
      from public.odevler d
      left join public.gonderimler g
        on g.odev_id = d.id and g.ogrenci_id = ogr.id
      where d.yayinda and d.sinif_id = ogr.sinif_id
        and public._odev_ogrenciye_dusar(ogr.sinif_giris, d.son_tarih, d.created_at)
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

revoke all on function public.dosya_erisim_izni(text, text) from public, anon, authenticated;
grant execute on function public.dosya_erisim_izni(text, text) to anon, authenticated, service_role;

revoke all on function public.veli_paneli(text) from public, anon, authenticated;
grant execute on function public.veli_paneli(text) to anon, authenticated;

do $$
declare
  t_izin text;
  t_veli text;
begin
  select pg_get_functiondef('public.dosya_erisim_izni(text, text)'::regprocedure) into t_izin;
  select pg_get_functiondef('public.veli_paneli(text)'::regprocedure) into t_veli;
  if t_izin not like '%0071 — ÖDEVİN SORU PDF%' then
    raise exception '0071: dosya_erisim_izni veliye soru PDF''ini açmıyor';
  end if;
  if t_veli not like '%''odev_yolu''%' or t_veli not like '%''cozum_yollari''%' then
    raise exception '0071: veli_paneli dosya yollarını döndürmüyor';
  end if;
  -- Kural 6: veliye giden gövdede anahtar YOLU yok.
  if t_veli like '%anahtar_url%' then
    raise exception '0071: veli_paneli cevap anahtarı yolunu içeriyor';
  end if;
end $$;

select public._migration_kaydet('0071');
