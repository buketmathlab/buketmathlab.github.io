-- =============================================================================
-- 0090 — YENİDEN AÇMANIN GEÇMİŞİ EKRANDA GÖRÜNSÜN
--
-- Öğretmenin bildirimi: "Öğrenciler daha önceden gönderdikleri ödevleri
-- gönderilmemiş olarak görüyorlar. Göndermişler, hatta puanlandırılmış."
-- Soruşturma kapandı: SİSTEMDE VERİ KAYBI YOK. Altı yedek (27 Eylül →
-- 1 Kasım) ve denetim izi birlikte okundu; beş hafta boyunca hiç ödev ve
-- hiç öğrenci silinmemiş, iki gönderim kaybolmuş ve ikisi de öğretmenin
-- kendi "Gönderimi yeniden aç"ı.
--
-- Denetim izindeki 19 satırın 17'si onun kendi yeniden açmaları, kendi
-- yazdığı gerekçelerle: "Soruda düzeltme yapıldı.", "Kaydırma yapmış,
-- düzeltme imkanı verildi.", "Çözüm kağıdı sisteme siyah görüntü olarak
-- ulaştı." Tek bir örnekte — "1. Tema Tekrarı"nda bir soru düzeltilince —
-- altı öğrencinin gönderimi aynı anda yeniden açılmış; önceki puanları
-- 62.50 ile 100.00 arasındaydı.
--
-- ASIL KUSUR BURADA: `gonderimi_yeniden_ac` (0081) gönderim satırını
-- SİLİYOR. Teknik olarak bilinçli bir karar; ama sonucunda öğrenci
-- ekranında ödev "gönderilmedi"ye dönüyor, puanı kayboluyor, öğretmen
-- listesinde öğrenci "göndermemiş" görünüyor ve VELİ ÇOCUĞUNUN ÖDEVİ HİÇ
-- YAPMADIĞINI SANIYOR. Öğretmen "sil" demedi, "yeniden aç" dedi; öğrenci
-- gerçekten göndermişti ve puanı hesaplanmıştı. İKİSİ DE HAKLI; ÜRÜN
-- İKİSİNE DE YANLIŞ ŞEY SÖYLÜYOR.
--
-- Öğretmenin kaygısı buydu: "Velilere, öğrencilerin ödevlerini yapıp
-- yapmadığını belirtirken böyle bir hata varsa çok büyük haksızlık ve
-- güvensizlik oluşur."
--
-- BU TUR YENİ VERİ ÜRETMİYOR. Veri zaten denetim izinde duruyor: `eski`
-- silinen gönderimin tam satırını (puanı dahil), `yeni` sebebi ve verilen
-- yeni tarihi taşıyor. Tur onu EKRANA taşıyor.
--
-- Hedef cümle:
--   "Yeniden açıldı — önceki gönderim 75 puan · soruda düzeltme yapıldı
--    · 31 Ekim 2026"
--
-- -----------------------------------------------------------------------------
-- 1. HESAP TEK YERDE: `_gonderim_yeniden_acma`
--
-- 0085'in `_odev_tarihleri` deseni birebir: `stable`, `security definer`,
-- istemciye KAPALI (`revoke`). Üç ucun da aynı yardımcıyı çağırması, aynı
-- gerçeğin öğretmene, öğrenciye ve veliye farklı görünmesini imkânsız
-- kılıyor. 0085'in kendi gerekçesi: "Hesap tek yerde; öğretmenin,
-- öğrencinin ve velinin gördüğü tarih ayrışamıyor."
--
-- Sorgu kalıbı UYDURULMUYOR: `ogrenci_odevleri`'nin `onceki_sayfalar`
-- alanı 0082'den beri AYNI izi AYNI biçimde okuyor
-- (`eski ->> 'odev_id'`, `eski ->> 'ogrenci_id'`, `zaman desc limit 1`).
-- Aynı eşleşmeyi iki yerde iki türlü yazmak bir gün ayrışırdı.
--
-- -----------------------------------------------------------------------------
-- 2. İMZA DEĞİŞMİYOR → 0007 TUZAĞI YOK
--
-- Üç ucun imzası aynı kalıyor, yani `create or replace` yetiştiriyor ve
-- eski bir imza geride kalmıyor. Gövdeler EN SON tanımlarından programla
-- kopyalandı — 0088'in dersi: `odev_detay` 0083'ten kopyalanıp 0085'i
-- sessizce geri almıştı ve bunu okuyarak değil ÖLÇEREK bulduk. Kaynaklar
-- ölçülerek doğrulandı:
--     odev_gonderimleri ← 0081   (0088, 0089 dokunmuyor)
--     ogrenci_odevleri  ← 0085   (0088, 0089 dokunmuyor)
--     veli_paneli       ← 0086   (0088, 0089 dokunmuyor)
-- Öz-denetim bu üç ucun ESKİ alanlarını da tek tek arıyor.
--
-- -----------------------------------------------------------------------------
-- 3. VELİYE SEBEP GİTMİYOR
--
-- Bu yeni bir karar değil, 0081'de verilmiş bir kararın sürdürülmesi.
-- 0081 sebebi öğrenciye `kanal = 'ogrenci'` mesajı olarak gönderiyor ve
-- gövdesinde açıkça yazıyor: "VELİ GÖRMÜYOR (0025'in ayrımı)". Sebep çoğu
-- zaman öğrencinin kendi hatasını anlatıyor ("kaydırma yapmış", "cevaplar
-- boş kaydedildi"); o cümle öğrenciyle öğretmen arasında.
--
-- Veli yine de GÖRMEK ZORUNDA ki çocuğunun ödevi hiç yapmadığını
-- sanmasın: `zaman`, `onceki_puan` ve `yeni_son_tarih` ona da gidiyor.
-- `neden` ve `onceki_durum` gitmiyor; `veli_paneli` gövdesinde jsonb'den
-- `- 'neden' - 'onceki_durum'` ile çıkarılıyor. Part XXI: GÖSTERMEDİĞİNİ
-- GÖNDERME — arayüzde saklamak yetmez, sunucu zaten göndermiyor.
--
-- -----------------------------------------------------------------------------
-- 4. ALAN GELMEZSE EKRAN BOZULMUYOR (Part VIII)
--
-- Site ve panel SQL'i birbirinin sırasına bağlı olamaz. 0090
-- uygulanmadıysa üç uç `yeniden_acma` alanını hiç döndürmez; arayüz
-- `yeniden_acma` yoksa bugünkü hâlinde kalıyor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. YARDIMCI — SON YENİDEN AÇMA
--
-- "SON" olması önemli: aynı ödev iki kez açılabiliyor (0081'in
-- `on conflict` dalı bunu bekliyor). Öğrenciye ve veliye söylenecek şey en
-- son olan; ilk açmanın puanını göstermek yanlış bilgi olurdu.
--
-- `zaman` eşitse `id` karar veriyor — 0085'in `ilk` dalındaki gerekçenin
-- aynısı: denetim izi kimlikleri artan sırada verilir ve sıralamayı
-- tesadüfe bırakmanın bedeli YANLIŞ puanı ekrana yazmak olurdu.
--
-- `onceki_puan` kuralı `coalesce(ogretmen_puan, puan)`: `veli_paneli`'nin
-- bugünkü hesabıyla BİREBİR aynı. Açık uçlu ödevde `puan` null, puan
-- öğretmenin verdiği `ogretmen_puan`ta; testte ayrı bir grup bunu
-- ölçüyor. Henüz puanlanmamışsa null kalıyor ve arayüz puan UYDURMUYOR.
--
-- `gonderim_odevle_silindi` (0089) de `eski`ye tam satırı yazıyor ama
-- `islem`i farklı: burada karışmıyor. Ödevle birlikte silinen gönderim
-- "yeniden açıldı" değildir.
-- -----------------------------------------------------------------------------
create or replace function public._gonderim_yeniden_acma(p_odev uuid, p_ogrenci uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select jsonb_build_object(
           'zaman', z.zaman,
           'neden', z.yeni ->> 'neden',
           -- 0056 döneminde açılmış satırlarda `son_tarih` anahtarı yok
           -- (`_tarihsiz_yeniden_acildi` 0081'de tam bunu ayırt ediyor);
           -- o satırlarda null kalıyor, tarih uydurulmuyor.
           'yeni_son_tarih', (z.yeni ->> 'son_tarih')::date,
           'onceki_puan', coalesce(z.eski ->> 'ogretmen_puan',
                                   z.eski ->> 'puan')::numeric,
           'onceki_durum', z.eski ->> 'durum'
         )
    from public.denetim_izi z
   where z.islem = 'gonderim_yeniden_acildi'
     and z.tablo = 'gonderimler'
     and z.eski ->> 'odev_id'    = p_odev::text
     and z.eski ->> 'ogrenci_id' = p_ogrenci::text
   order by z.zaman desc, z.id desc
   limit 1;
$$;
revoke all on function public._gonderim_yeniden_acma(uuid, uuid)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. ÖĞRETMENİN GÖNDERİMLER LİSTESİ — 0081'den kopya + `yeniden_acma`
-- -----------------------------------------------------------------------------
create or replace function public.odev_gonderimleri(p_token text, p_id uuid)
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
    'odev', jsonb_build_object(
      'id', d.id,
      'baslik', d.baslik,
      'tur', d.tur,
      'sinif', s.ad,
      'son_tarih', d.son_tarih,
      'soru_sayisi', d.soru_sayisi,
      'gec_teslim', d.gec_teslim,
      'yayinda', d.yayinda
    ),
    'ozet', jsonb_build_object(
      -- 0064: SINIF LİSTESİ ESAS (bugün sınıfta olan, ödevin son
      -- tarihinde sınıfa gelmiş öğrenciler).
      'mevcut', (select count(*) from public.ogrenciler o
                  where o.sinif_id = d.sinif_id and (o.aktif and not o.deneme)
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)),
      'gonderen', (select count(*) from public.gonderimler g
                    join public.ogrenciler o on o.id = g.ogrenci_id
                    where g.odev_id = d.id and o.sinif_id = d.sinif_id and (o.aktif and not o.deneme)
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)),
      'gecikmeli', (select count(*) from public.gonderimler g
                     join public.ogrenciler o on o.id = g.ogrenci_id
                     where g.odev_id = d.id
                       and public._gecikmeli(g.created_at, d.son_tarih)
                       and o.sinif_id = d.sinif_id and (o.aktif and not o.deneme)
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)),
      'puan_bekleyen', (select count(*) from public.gonderimler g
                         join public.ogrenciler o on o.id = g.ogrenci_id
                         where g.odev_id = d.id and g.durum = 'incelemede'
                           and o.sinif_id = d.sinif_id and (o.aktif and not o.deneme)
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at))
    ),
    -- SINIF KONU ÖZETİ: "bu sınıf en çok hangi konuda takıldı?"
    -- Öğretmenin bir sonraki dersini planlarken bakacağı sayı bu. Tek tek
    -- öğrencilerin analizini toplamak yerine sunucuda toplanıyor; aksi hâlde
    -- otuz öğrencinin cevapları tarayıcıya inerdi.
    'konu_ozeti', coalesce((
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
        from public.gonderimler g
        join public.ogrenciler o on o.id = g.ogrenci_id
        cross join lateral jsonb_array_elements(
          public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
        ) e
        where g.odev_id = d.id and o.sinif_id = d.sinif_id and (o.aktif and (not o.deneme or public._deneme_gorur(v_ogretmen)))
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
        group by e->>'konu'
      ) t
    ), '[]'::jsonb),
    'satirlar', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ogrenci_id', o.id,
        'ogrenci', o.ad,
        'gonderim_id', g.id,
        'gonderdi', (g.id is not null),
        'zaman', g.created_at,
        'gecikmeli', case when g.id is null then false
                     else public._gecikmeli(g.created_at, d.son_tarih) end,
        -- 0081: EK SÜRE VERİLDİ Mİ. `gecikmeli` DEĞİŞMİYOR (öğretmenin
        -- kararı; 43 çağrı noktası var ve kayıt dürüst kalmalı) — ek süre
        -- onun yanında ayrı bir bilgi olarak duruyor.
        'ek_sure', (select e.son_tarih from public.odev_ek_sure e
                     where e.odev_id = d.id and e.ogrenci_id = o.id),
        -- 0090: GÖNDERİMİ YENİDEN AÇILDI MI, ÖNCEKİ PUANI NEYDİ.
        -- Yeniden açmak gönderimi siliyor (0081); o öğrenci bu
        -- listede "göndermedi" olarak görünüyordu ve öğretmen
        -- veliye bunu söylüyordu. Oysa göndermişti ve puanı
        -- hesaplanmıştı. Bilgi denetim izinde zaten duruyordu;
        -- burada EKRANA taşınıyor.
        'yeniden_acma', public._gonderim_yeniden_acma(d.id, o.id),
        'durum', g.durum,
        'dogru', g.dogru,
        'yanlis', g.yanlis,
        'bos', g.bos,
        'puan', g.puan,
        'ogretmen_puan', g.ogretmen_puan,
        'ogretmen_yorum', g.ogretmen_yorum,
        -- HANGİ SORULAR YANLIŞ: sayı değil, numara. "5 yanlış" öğretmene
        -- ne yapacağını söylemez; "3, 7 ve 9 yanlış" söyler. Yalnız test
        -- ödevinde anlamlı — açık uçluda anahtar yok, her soru "boş"
        -- görünür ve bu bilgi gürültüden ibaret olurdu.
        'yanlis_sorular', case when g.id is not null and d.tur = 'test'
          then public._soru_dokumu(d.cevap_anahtari, g.cevaplar, d.soru_sayisi) -> 'yanlis'
          else '[]'::jsonb end,
        'bos_sorular', case when g.id is not null and d.tur = 'test'
          then public._soru_dokumu(d.cevap_anahtari, g.cevaplar, d.soru_sayisi) -> 'bos'
          else '[]'::jsonb end,
        'foto_var', (g.foto_yolu is not null),
        -- 0055: yönetici düzeltmesi öğretmende işaretli.
        'duzeltildi', (g.duzelten_yonetici is not null),
        'duzeltme_nedeni', g.duzeltme_nedeni
      ) order by o.ad)
      from public.ogrenciler o
      left join public.gonderimler g
        on g.odev_id = d.id and g.ogrenci_id = o.id
      where o.sinif_id = d.sinif_id and (o.aktif and (not o.deneme or public._deneme_gorur(v_ogretmen)))
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
    ), '[]'::jsonb)
  );
end;
$$;
-- -----------------------------------------------------------------------------
-- 3. ÖĞRENCİNİN ÖDEV LİSTESİ — 0085'ten kopya + `yeniden_acma`
-- -----------------------------------------------------------------------------
create or replace function public.ogrenci_odevleri(p_token text)
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
  if o.rol <> 'ogrenci' then
    raise exception 'Bu bölüm yalnızca öğrenciler içindir.' using errcode = '42501';
  end if;

  select ogr2.id, ogr2.ad, ogr2.tur, s.ad as sinif, ogr2.sinif_id, ogr2.sinif_giris, ogr2.deneme,
         coalesce(s.arsiv, false) as sinif_arsiv
    into ogr
  from public.ogrenciler ogr2
  left join public.siniflar s on s.id = ogr2.sinif_id
  where ogr2.id = o.ogrenci_id;

  return jsonb_build_object(
    'ogrenci', jsonb_build_object('id', ogr.id, 'ad', ogr.ad, 'sinif', ogr.sinif,
                                  'tur', ogr.tur),
    -- 0065: okunmamış duyuru — öğrenci sekme çubuğundaki Pano rozeti.
    'okunmamis_duyuru', public._okunmamis_duyuru(ogr.id, ogr.sinif_id, ogr.sinif_giris),
    'okunmamis_mesaj', (
      select count(*)::integer from public.mesajlar m
      where m.ogrenci_id = ogr.id and m.kanal = 'ogrenci' and m.kimden = 'ogretmen'
        and m.created_at > coalesce(
              (select k.zaman from public.okundu k
                where k.ogrenci_id = ogr.id and k.rol = 'ogrenci' and k.kanal = 'ogrenci'),
              '-infinity'::timestamptz)
    ),
    'odevler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'baslik', d.baslik,
        'aciklama', d.aciklama,
        'tur', d.tur,
        'son_tarih', d.son_tarih,
        -- 0085: VERİLİŞ TARİHİ + UZATMA. Hesap tek yerde; öğretmenin,
        -- öğrencinin ve velinin gördüğü tarih ayrışamıyor.
        'tarihler', public._odev_tarihleri(d.id, d.son_tarih),
        -- 0081: KİŞİSEL SON TARİH. Sahip gönderimi yeniden açarken tarih
        -- verdiyse öğrenci bunu görmeli; yoksa geçmiş bir tarihe bakıp
        -- "gönderemem" sanır. Yoksa null — bugünkü davranış.
        'ek_sure', (select e.son_tarih from public.odev_ek_sure e
                     where e.odev_id = d.id and e.ogrenci_id = ogr.id),
        -- 0082: KAÇINCI DENEME. İstemci yükleme yolunu buradan kuruyor;
        -- 1 ise yol 0009'dan beri kullanılanla birebir aynı.
        'deneme_no', public._cozum_deneme(d.id, ogr.id),
        -- 0090: ÖĞRENCİ NEDEN YENİDEN GÖNDERMESİ GEREKTİĞİNİ
        -- EKRANDA GÖRÜYOR. Bugüne kadar sebep yalnız mesaj
        -- kutusuna düşüyordu (0081); ödev sayfasında ödev
        -- sessizce "gönderilmedi"ye dönüyor ve puanı kayboluyordu.
        'yeniden_acma', public._gonderim_yeniden_acma(d.id, ogr.id),
        -- 0082: SON İPTALİN SAYFALARI. Öğrenci isterse bunları yeniden
        -- gönderebiliyor (öğretmenin kararı: "öğrenci seçsin") — cevapları
        -- yanlışlıkla boş giden öğrenci sayfaları yeniden çekmesin.
        'onceki_sayfalar', (
          select jsonb_build_array(z.eski ->> 'foto_yolu')
                 -- `ek_sayfa_yollari` tek sayfalık gönderimde JSON null;
                 -- doğrudan eklemek diziye bir `null` sokardı.
                 || case when jsonb_typeof(z.eski -> 'ek_sayfa_yollari') = 'array'
                         then z.eski -> 'ek_sayfa_yollari'
                         else '[]'::jsonb end
          from public.denetim_izi z
          where z.islem = 'gonderim_yeniden_acildi'
            and z.tablo = 'gonderimler'
            and z.eski ->> 'odev_id'    = d.id::text
            and z.eski ->> 'ogrenci_id' = ogr.id::text
            and coalesce(z.eski ->> 'foto_yolu', '') <> ''
          order by z.zaman desc
          limit 1
        ),
        'soru_sayisi', d.soru_sayisi,
        -- 0074: deneme hesabında her ödev açık — arayüzün üç "teslim
        -- kapandı" kapısı bu alanı okuyor; gerçek öğrencide değişmiyor.
        'gec_teslim', d.gec_teslim or ogr.deneme,
        'sik_sayisi', d.sik_sayisi,
        'sinif_arsiv', ogr.sinif_arsiv,
        'odev_yolu', d.odev_url,
        'gonderim', case when g.id is null then null else jsonb_build_object(
          'id', g.id, 'zaman', g.created_at, 'durum', g.durum,
          'dogru', g.dogru, 'yanlis', g.yanlis, 'bos', g.bos,
          'puan', g.puan, 'ogretmen_puan', g.ogretmen_puan,
          'ogretmen_yorum', g.ogretmen_yorum,
          'cevaplar', coalesce(g.cevaplar, '{}'::jsonb),
          'gecikmeli', public._gecikmeli(g.created_at, d.son_tarih)
        ) end,
        -- Anahtar ve konu analizi YALNIZ teslimden sonra.
        'konu_analizi', case when g.id is not null
          then public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
          else '[]'::jsonb end,
        'cevap_anahtari', case when g.id is not null then d.cevap_anahtari else null end,
        'anahtar_yolu',   case when g.id is not null then d.anahtar_url    else null end
      ) order by d.son_tarih)
      from public.odevler d
      left join public.gonderimler g
        on g.odev_id = d.id and g.ogrenci_id = ogr.id
      where d.yayinda and d.sinif_id = ogr.sinif_id
        -- 0064: sınıfa gelmeden önce son tarihi dolan ödev bu öğrencinin değil.
        and public._odev_ogrenciye_dusar(ogr.sinif_giris, d.son_tarih, d.created_at)
    ), '[]'::jsonb),
    'dersler', coalesce((
      select jsonb_agg(jsonb_build_object('zaman', l.zaman, 'mod', l.mod, 'link', l.link)
                       order by l.zaman)
      from public.dersler l
      where l.ogrenci_id = ogr.id and l.zaman > now()
    ), '[]'::jsonb)
  );
end;
$$;
-- -----------------------------------------------------------------------------
-- 4. VELİ PANELİ — 0086'dan kopya + SEBEPSİZ `yeniden_acma`
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
        -- 0086: TÜR VELİYE DE GİDİYOR (öğretmenin kararı: veli görsün).
        -- Olmasaydı veli puansız bir satır görür ve "daha
        -- değerlendirilmedi" sanırdı; oysa çalışma kağıdı puanlanmıyor.
        'tur', d.tur,
        'son_tarih', d.son_tarih,
        -- 0085: VERİLİŞ TARİHİ + UZATMA. Hesap tek yerde; öğretmenin,
        -- öğrencinin ve velinin gördüğü tarih ayrışamıyor.
        'tarihler', public._odev_tarihleri(d.id, d.son_tarih),
        'olusturma', d.created_at,
        'gonderildi', (g.id is not null),
        'gonderim_zamani', g.created_at,
        'puan', coalesce(g.ogretmen_puan, g.puan),
        -- 0090: VELİYE DE GİDİYOR AMA SEBEPSİZ.
        --
        -- Veli, çocuğunun ödevi yeniden açıldığı için "gönderilmedi"
        -- göründüğünü bilmeli; yoksa ödevi hiç yapmadığını sanıyor.
        -- Önceki puanı da görüyor — zaten kendi çocuğunun puanı.
        --
        -- AMA SEBEP VELİYE GİTMİYOR. 0081 sebebi öğrenciye
        -- `kanal = 'ogrenci'` mesajı olarak gönderiyor ve orada
        -- açıkça yazıyor: "VELİ GÖRMÜYOR (0025'in ayrımı)".
        -- Sebep çoğu zaman öğrencinin hatasını anlatıyor
        -- ("kaydırma yapmış", "cevaplar boş kaydedildi"); o cümle
        -- öğrenciyle öğretmen arasında. Aynı sınır burada da
        -- korunuyor: `- 'neden' - 'onceki_durum'` ile çıkarılıyor.
        'yeniden_acma', (public._gonderim_yeniden_acma(d.id, ogr.id)
                          - 'neden' - 'onceki_durum'),
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
-- İmzalar değişmedi; yetkiler yine de açıkça yeniden veriliyor (0085'in
-- deseni) ki bir gün imza değişirse 0007 tuzağı sessizce kurulmasın.
grant execute on function public.odev_gonderimleri(text, uuid) to anon, authenticated;
grant execute on function public.ogrenci_odevleri(text)        to anon, authenticated;
grant execute on function public.veli_paneli(text)             to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. ÖZ-DENETİM
-- -----------------------------------------------------------------------------
do $$
declare
  eksik text[] := '{}';
  t     text;
begin
  -- YARDIMCI VAR VE İSTEMCİYE KAPALI.
  if to_regprocedure('public._gonderim_yeniden_acma(uuid,uuid)') is null then
    eksik := eksik || '_gonderim_yeniden_acma kurulmadı'::text;
  else
    if has_function_privilege('anon', 'public._gonderim_yeniden_acma(uuid, uuid)', 'execute') then
      eksik := eksik || '_gonderim_yeniden_acma anon''a açık'::text;
    end if;
    t := pg_get_functiondef('public._gonderim_yeniden_acma(uuid,uuid)'::regprocedure);
    if t not like '%gonderim_yeniden_acildi%' then
      eksik := eksik || 'yardımcı yeniden açma izini okumuyor'::text;
    end if;
    -- SON OLANI DÖNDÜRÜYOR MU (ilki değil).
    if t not like '%order by z.zaman desc, z.id desc%' or t not like '%limit 1%' then
      eksik := eksik || 'yardımcı en son açmayı seçmiyor'::text;
    end if;
    -- `veli_paneli`in puan kuralıyla aynı.
    if t not like '%ogretmen_puan%' or t not like '%coalesce%' then
      eksik := eksik || 'yardımcı önceki puanı coalesce kuralıyla okumuyor'::text;
    end if;
  end if;

  -- ÜÇ UÇ DA ALANI DÖNDÜRÜYOR MU.
  if pg_get_functiondef('public.odev_gonderimleri'::regproc) not like '%yeniden_acma%' then
    eksik := eksik || 'odev_gonderimleri yeniden_acma vermiyor'::text;
  end if;
  if pg_get_functiondef('public.ogrenci_odevleri'::regproc) not like '%yeniden_acma%' then
    eksik := eksik || 'ogrenci_odevleri yeniden_acma vermiyor'::text;
  end if;
  t := pg_get_functiondef('public.veli_paneli'::regproc);
  if t not like '%yeniden_acma%' then
    eksik := eksik || 'veli_paneli yeniden_acma vermiyor'::text;
  end if;
  -- VELİYE SEBEP GİTMİYOR. Çıkarma ifadesi gövdede DURMAK ZORUNDA;
  -- kaldırılırsa sebep veliye sızar ve bu kapı ısırır. Çalışma anındaki
  -- karşılığını testin 6. grubu ölçüyor (çıktıda `neden` anahtarı yok).
  if t not like '%- ''neden'' - ''onceki_durum''%' then
    eksik := eksik || 'veli_paneli sebebi çıkarmıyor'::text;
  end if;

  -- 0088'İN DERSİ: KOPYA ESKİ BİR ALANI SESSİZCE GERİ ALMASIN.
  t := pg_get_functiondef('public.odev_gonderimleri'::regproc);
  if t not like '%odev_ek_sure%' then                 -- 0081
    eksik := eksik || 'odev_gonderimleri ek süreyi kaybetti'::text;
  end if;
  if t not like '%konu_ozeti%' then                   -- 0038
    eksik := eksik || 'odev_gonderimleri konu özetini kaybetti'::text;
  end if;
  if t not like '%duzeltme_nedeni%' then              -- 0055
    eksik := eksik || 'odev_gonderimleri yönetici düzeltmesini kaybetti'::text;
  end if;
  if t not like '%_odev_ogrenciye_dusar%' then        -- 0064
    eksik := eksik || 'odev_gonderimleri sınıf listesi esasını kaybetti'::text;
  end if;

  t := pg_get_functiondef('public.ogrenci_odevleri'::regproc);
  if t not like '%_odev_tarihleri%' then              -- 0085
    eksik := eksik || 'ogrenci_odevleri tarihleri kaybetti'::text;
  end if;
  if t not like '%onceki_sayfalar%' or t not like '%_cozum_deneme%' then   -- 0082
    eksik := eksik || 'ogrenci_odevleri yeniden yüklemeyi kaybetti'::text;
  end if;
  if t not like '%_okunmamis_duyuru%' then            -- 0065
    eksik := eksik || 'ogrenci_odevleri duyuru rozetini kaybetti'::text;
  end if;

  t := pg_get_functiondef('public.veli_paneli'::regproc);
  if t not like '%_odev_tarihleri%' then              -- 0085
    eksik := eksik || 'veli_paneli tarihleri kaybetti'::text;
  end if;
  if t not like '%onam_gerekli%' then                 -- 0034
    eksik := eksik || 'veli_paneli onam kapısını kaybetti'::text;
  end if;
  if t not like '%_odev_kiyasi%' then                 -- 0047
    eksik := eksik || 'veli_paneli ödev kıyasını kaybetti'::text;
  end if;
  if t not like '%cozum_yollari%' then                -- 0071
    eksik := eksik || 'veli_paneli çözüm yollarını kaybetti'::text;
  end if;
  if t not like '%''tur'', d.tur%' then               -- 0086
    eksik := eksik || 'veli_paneli çalışma kağıdı türünü kaybetti'::text;
  end if;
  -- KURAL 6: veliye cevap anahtarı gitmiyor.
  if t like '%anahtar_url%' then
    eksik := eksik || 'veli_paneli cevap anahtarını sızdırıyor'::text;
  end if;

  if array_length(eksik, 1) > 0 then
    raise exception '0090 eksik: %', array_to_string(eksik, ' | ');
  end if;
end $$;

select public._migration_kaydet('0090');
