-- SEKİZ — "BU SINIF ÖDEVİNİ GÖNDEREMİYOR" RAPORU
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
--
-- BU DOSYA HİÇBİR ŞEYİ SİLMEZ, DEĞİŞTİRMEZ, EKLEMEZ. Yalnız bakar ve bir
-- tablo döndürür. Güvenle çalıştırabilirsiniz.
--
-- NE SORUYOR: "Bir sınıfın öğrencileri ödevlerini neden gönderemiyor?"
--
-- NEDEN BÖYLE BİR RAPOR GEREKİYOR
--
-- Bir sınıfın TAMAMI tek bir ödevde takılıyorsa bu tek tek öğrenci
-- sorunu değildir: bir kapı kapanmıştır. Sunucuda gönderimi engelleyen
-- dokuz ayrı kapı var ve öğrencinin ekranında hepsi birbirine benziyor.
-- En kötüsü YÜKLEME kapıları: beşi de reddedilince Edge Function tek bir
-- genel cümle söylüyor ("Bu dosyaya erişim izniniz yok") ve hangi kapının
-- kapandığını SÖYLEMİYOR.
--
-- Bu rapor kapıları sunucunun baktığı SIRAYLA tek tek ölçüyor ve ilk
-- satırda tek cümleyle söylüyor.
--
-- ## Nasıl kullanılır
--
-- Aşağıdaki ilk satırda `ARANAN_SINIF` yazan yere sınıfın adını yazın:
-- '10B' gibi. Büyük/küçük harf ve Türkçe harf farkı önemli değil.
-- Boş bırakırsanız ('') bütün sınıflar taranır ve yalnız engeli olanlar
-- listelenir.
--
-- İkinci ayar `KAC_ODEV`: sınıfın en son kaç ödevine bakılacağı
-- (varsayılan 3). "Son ödev" hangisi belirsiz kalmasın diye birkaçı
-- birden listeleniyor.
--
-- ## Neden tek bir sorgu
--
-- Supabase panelinde yalnız SON ifadenin sonucu görünüyor. Rapor birkaç
-- ayrı `select` olsaydı yalnız sonuncuyu görürdünüz. Bu yüzden her şey
-- tek tabloda, `bolum` sütunuyla ayrılmış hâlde dönüyor.
--
-- İLK SATIRDAN BAŞLAYIN: `0 · OZET` tek cümlede durumu söylüyor.
-- =============================================================================

with ayar as (
  select '10B'::text as aranan_sinif,  -- ←←← SINIFIN ADI (boş = hepsi)
         3::integer  as kac_odev,      -- ←←← son kaç ödeve bakılsın
         (now() at time zone 'Europe/Istanbul')::date as bugun
),

-- Türkçe harfler elle çevriliyor: `lower()` veritabanının diline bağlı ve
-- "İ" harfini bozabiliyor (0041'in dersi).
sinif as (
  select s.id, s.ad, s.arsiv, s.ozel
    from public.siniflar s, ayar a
   where a.aranan_sinif = ''
      or lower(translate(s.ad, 'İIĞÜŞÖÇ', 'iığüşöç'))
         = lower(translate(btrim(a.aranan_sinif), 'İIĞÜŞÖÇ', 'iığüşöç'))
),

-- Her sınıfın EN SON verilen `kac_odev` kadar ödevi. Sıralama
-- `created_at`e göre: "son ödev" öğretmenin en son VERDİĞİ ödevdir,
-- son tarihi en ileri olan değil.
odev as (
  select d.*, s.ad as sinif_ad, s.arsiv as sinif_arsiv,
         row_number() over (partition by d.sinif_id order by d.created_at desc) as sira
    from public.odevler d
    join sinif s on s.id = d.sinif_id
),
son_odev as (
  select o.* from odev o, ayar a where o.sira <= a.kac_odev
),

-- Sınıf listesi esası (0064): ödev, o tarihte sınıfta olan öğrencinin.
ogrenci as (
  select o.id, o.ad, o.aktif, o.deneme, o.sinif_giris, o.ogrenci_no, o.sinif_id
    from public.ogrenciler o
    join sinif s on s.id = o.sinif_id
),

-- -----------------------------------------------------------------------------
-- HER ÖDEV–ÖĞRENCİ ÇİFTİ İÇİN İLK KAPANAN KAPI
--
-- Sıra SUNUCUNUNKİYLE AYNI. Başka bir sırada bakmak, iki kapı birden
-- kapalıyken yanlış olanı suçlamak olurdu.
-- -----------------------------------------------------------------------------
cift as (
  select d.id as odev_id, d.baslik, d.sinif_ad, d.sinif_arsiv,
         d.yayinda, d.son_tarih, d.gec_teslim, d.sayfa_limiti, d.tur,
         d.grup_id, d.created_at as verilis,
         o.id as ogrenci_id, o.ad as ogrenci, o.aktif, o.deneme,
         o.sinif_giris, a.bugun,
         g.id as gonderim_id,
         e.son_tarih as ek_sure,
         public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at) as dusuyor,
         public._cozum_deneme(d.id, o.id) as deneme_no
    from son_odev d
    cross join ayar a
    join ogrenci o on o.sinif_id = d.sinif_id
    left join public.gonderimler g on g.odev_id = d.id and g.ogrenci_id = o.id
    left join public.odev_ek_sure e on e.odev_id = d.id and e.ogrenci_id = o.id
),

kapi as (
  select c.*,
         case
           -- GÖNDERDİ: ortada engel yok.
           when c.gonderim_id is not null then 'GÖNDERDİ'
           -- GÖRÜNÜRLÜK — bu ikisinde ödev öğrencinin ekranında HİÇ ÇIKMAZ.
           when not c.yayinda then 'ÖDEV YAYINDA DEĞİL'
           when not c.dusuyor then 'ÖDEV BU ÖĞRENCİYE DÜŞMÜYOR'
           -- YÜKLEME — Edge Function tek genel cümle söylüyor.
           when not c.aktif then 'ÖĞRENCİ PASİF'
           -- GÖNDERİM — mesajları açık.
           when c.sinif_arsiv then 'SINIF ARŞİVDE'
           when not c.gec_teslim
                and c.bugun > c.son_tarih
                and (c.ek_sure is null or c.bugun > c.ek_sure)
                and not c.deneme
             then 'SON TARİH GEÇTİ, GEÇ TESLİM KAPALI'
           else 'ENGEL YOK'
         end as durum
    from cift c
),

-- Yalnız EN SON verilen ödevin özeti: ilk satırdaki cümle bunu anlatıyor.
en_son as (
  select k.* from kapi k
   where k.odev_id in (select id from son_odev where sira = 1)
),
ozet as (
  select count(*) filter (where durum not in ('GÖNDERDİ', 'ENGEL YOK')) as engelli,
         count(*) as toplam,
         -- SAYFA SINIRI ÖĞRENCİ BAŞINA BİR "ENGEL" DEĞİL: kimse engellenmiş
         -- görünmez, buna rağmen çözümü iki sayfa olan bir sınıfın tamamı
         -- yükleyemez. Bu yüzden özet onu ayrıca söylüyor.
         (select sayfa_limiti from en_son limit 1) as sinir,
         (select durum from en_son e2
           where e2.durum not in ('GÖNDERDİ', 'ENGEL YOK')
           group by durum order by count(*) desc limit 1) as baskin,
         (select baslik from en_son limit 1) as baslik,
         (select sinif_ad from en_son limit 1) as sinif_ad
    from en_son
),

-- 3. BÖLÜM — KARDEŞ ŞUBELER. Aynı `grup_id`'deki bütün kopyalar.
-- Şubeler arasındaki tarih/yayın farkı burada tek bakışta görünüyor.
kardes as (
  select d2.id, d2.baslik, s2.ad as sinif_ad, d2.son_tarih, d2.yayinda,
         d2.gec_teslim, d2.sayfa_limiti, d2.grup_id,
         (select count(*) from public.gonderimler g2 where g2.odev_id = d2.id) as gonderen
    from public.odevler d2
    join public.siniflar s2 on s2.id = d2.sinif_id
   where d2.grup_id is not null
     and d2.grup_id in (select grup_id from son_odev where grup_id is not null)
),

-- 6. BÖLÜM — GÖNDERİLEN SAYFA SAYISI.
--
-- Sınırın DAR olup olmadığını ÖLÇÜYOR, çıkarmıyor: gönderenlerin hepsi
-- tam sınır kadar sayfa gönderdiyse sınır büyük olasılıkla dar (herkes
-- tavana dayanmış); sınırın altında kalanlar varsa dar değil.
-- `foto_yolu` her zaman 1. sayfa, `ek_sayfa_yollari` kalanlar (0054).
sayfa_sayim as (
  select g.odev_id,
         count(*) as gonderim,
         min(1 + coalesce(array_length(g.ek_sayfa_yollari, 1), 0)) as en_az,
         max(1 + coalesce(array_length(g.ek_sayfa_yollari, 1), 0)) as en_cok,
         count(*) filter (
           where 1 + coalesce(array_length(g.ek_sayfa_yollari, 1), 0) >= d.sayfa_limiti
         ) as tavanda
    from public.gonderimler g
    join son_odev d on d.id = g.odev_id
   group by g.odev_id
),

-- 5. BÖLÜM — DEPODA DURAN AMA GÖNDERİMİ OLMAYAN DOSYA.
-- Dolu çıkarsa yükleme ÇALIŞMIŞ, gönderim DÜŞMÜŞ demektir.
--
-- `created_at` satırdan JSON üzerinden okunuyor: yerel test ortamındaki
-- `storage.objects` taklidinde o sütun yok ve doğrudan okunsaydı sorgu
-- orada sınanamazdı (`oksuz-cozum-raporu.sql`in gerekçesi).
--
-- Öğrenci kimliği `-` ile AYRILAMAZ: UUID'nin kendisinde de tire var.
-- İlk yazımda `split_part(..., '-', 1)` kimliği ortadan kesiyordu ve
-- rapor hiçbir şey bulamıyordu; prova yakaladı. UUID 36 karakter.
depo as (
  select o.name,
         (to_jsonb(o) ->> 'created_at')::timestamptz as yuklendi,
         nullif(split_part(o.name, '/', 2), '')::uuid as odev_id,
         nullif(left(split_part(split_part(o.name, '/', 3), '.', 1), 36), '')::uuid
           as ogrenci_id
    from storage.objects o
   where o.bucket_id = 'odev-dosyalari'
     and o.name like 'cozum/%'
     and split_part(o.name, '/', 2) ~ '^[0-9a-f-]{36}$'
     and left(split_part(split_part(o.name, '/', 3), '.', 1), 36) ~ '^[0-9a-f-]{36}$'
),
oksuz as (
  select p.name, p.yuklendi, p.odev_id, p.ogrenci_id
    from depo p
   where p.odev_id in (select id from son_odev)
     and not exists (
       select 1 from public.gonderimler g
       where g.odev_id = p.odev_id and g.ogrenci_id = p.ogrenci_id
     )
)

select * from (
  -- ---------------------------------------------------------------- 0
  select '0 · OZET' as bolum, 1 as sira, ''::text as kim,
         case
           when (select count(*) from sinif) = 0 then
             'SINIF BULUNAMADI. Adı doğru yazdınız mı? (örnek: 10B)'
           when (select count(*) from son_odev) = 0 then
             'Bu sınıfta hiç ödev yok.'
           when (select engelli from ozet) = 0 then
             'ÖĞRENCİ BAŞINA ENGEL YOK. "' || coalesce((select baslik from ozet), '—')
               || '" ödevinde ' || (select toplam from ozet)::text
               || ' öğrencinin hiçbirinin önünde sunucu tarafında engel yok.'
               -- İKİ OLASILIK DA SÖYLENİYOR, BİRİ SEÇİLMİYOR. Hangisinin
               -- doğru olduğu alttaki bölümlerin sayılarından çıkar.
               || case when (select sinir from ozet) = 1
                       then ' AMA SAYFA SINIRI 1: öğrenci yalnız TEK fotoğraf'
                            || ' yükleyebiliyor. Çözümü iki sayfa olan öğrenci'
                            || ' ikincisini EKLEYEMEZ ve "yükleyemiyorum" der.'
                            || ' Bkz. "1 · ÖDEV" ve "6 · GÖNDERİLEN SAYFA SAYISI".'
                       else '' end
               || ' Gönderim yarıda da kalmış olabilir:'
               || ' bkz. "5 · DEPODA DURAN DOSYA".'
           else
             'DİKKAT: "' || coalesce((select baslik from ozet), '—')
               || '" ödevinde ' || (select toplam from ozet)::text
               || ' öğrenciden ' || (select engelli from ozet)::text
               || '''i gönderemiyor. En yaygın sebep: '
               || coalesce((select baskin from ozet), '—')
               || '. Ayrıntı aşağıdaki bölümlerde.'
         end as ayrinti,
         ''::text as zaman
  union all
  -- ---------------------------------------------------------------- 1
  select '1 · ÖDEV', 2,
         d.sinif_ad || ' · ' || d.baslik,
         'tür: ' || d.tur
           || ' · yayında: ' || d.yayinda::text
           || ' · son tarih: ' || d.son_tarih::text
           || ' (bugün ' || (select bugun from ayar)::text || ')'
           || ' · geç teslim: ' || d.gec_teslim::text
           || ' · sayfa sınırı: ' || d.sayfa_limiti::text
           || case when d.grup_id is null then ' · tek sınıflık'
                   else ' · kardeş şubeleri VAR (3. bölüm)' end
           || case
                when not d.yayinda then '  →  TASLAK: öğrenci bu ödevi HİÇ GÖRMÜYOR'
                when not d.gec_teslim and (select bugun from ayar) > d.son_tarih
                  then '  →  TESLİM KAPALI'
                -- SINIR 1 SESSİZ BİR KAPI. `sayfa_limiti` varsayılanı 1;
                -- ödev sayfa sayısı verilmeden açıldıysa öğrenci tek
                -- fotoğrafla sınırlı kalıyor ve bunu hiçbir öğretmen
                -- ekranı söylemiyor.
                when d.sayfa_limiti = 1
                  then '  →  SAYFA SINIRI 1: öğrenci yalnız TEK fotoğraf'
                       || ' yükleyebilir; çözümü iki sayfaysa ikincisi EKLENMİYOR'
                else '' end,
         to_char(d.created_at at time zone 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI')
    from son_odev d
  union all
  -- ---------------------------------------------------------------- 2
  select '2 · SINIF', 3, s.ad,
         'arşivde: ' || s.arsiv::text
           || ' · özel: ' || s.ozel::text
           || ' · kayıtlı öğrenci: '
           || (select count(*) from ogrenci o where o.sinif_id = s.id)::text
           || ' · aktif: '
           || (select count(*) from ogrenci o where o.sinif_id = s.id and o.aktif)::text
           || case when s.arsiv
                   then '  →  ARŞİVDEKİ SINIFA GÖNDERİM YAPILAMAZ' else '' end,
         ''
    from sinif s
  union all
  -- ---------------------------------------------------------------- 3
  select '3 · KARDEŞ ŞUBELER', 4,
         k.sinif_ad || ' · ' || k.baslik,
         'son tarih: ' || k.son_tarih::text
           || ' · yayında: ' || k.yayinda::text
           || ' · geç teslim: ' || k.gec_teslim::text
           || ' · sayfa sınırı: ' || k.sayfa_limiti::text
           || ' · gönderen: ' || k.gonderen::text
           || case when k.id in (select id from son_odev)
                   then '   ←←← BU SINIF' else '' end,
         ''
    from kardes k
  union all
  -- ---------------------------------------------------------------- 4
  -- Yalnız ENGELİ OLAN öğrenciler. Gönderenleri listelemek otuz satırlık
  -- gürültü olurdu; sayıları 0. bölümde zaten var.
  select '4 · ÖĞRENCİ', 5,
         k.ogrenci || ' (' || k.sinif_ad || ' · ' || k.baslik || ')',
         k.durum
           || case when k.ek_sure is not null
                   then ' · kişisel süre: ' || k.ek_sure::text else '' end
           || case when k.deneme_no > 1
                   then ' · ' || k.deneme_no::text || '. deneme (gönderimi yeniden açılmış)'
                   else '' end
           || case when not k.dusuyor
                   then ' · sınıfa giriş: ' || coalesce(k.sinif_giris::text, '—')
                        || ' (ödevin son tarihinden sonra)'
                   else '' end,
         ''
    from kapi k
   where k.durum not in ('GÖNDERDİ', 'ENGEL YOK')
  union all
  -- ---------------------------------------------------------------- 5
  select '5 · DEPODA DURAN DOSYA', 6,
         coalesce((select ad from public.ogrenciler x where x.id = y.ogrenci_id),
                  y.ogrenci_id::text),
         'YÜKLENDİ AMA GÖNDERİM YOK · ' || y.name
           || '  →  fotoğraf depoda duruyor, gönderim kaydı oluşmamış'
           || ' (bağlantı koptu ya da "Gönder" adımı düştü)',
         to_char(y.yuklendi at time zone 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI')
    from oksuz y
  union all
  -- ---------------------------------------------------------------- 6
  -- SINIR DAR MI: ÖLÇÜM, ÇIKARIM DEĞİL. Gönderenlerin hepsi tavana
  -- dayandıysa sınır büyük olasılıkla dar; altında kalanlar varsa
  -- değil. Rapor sayıyı veriyor, kararı öğretmen veriyor.
  select '6 · GÖNDERİLEN SAYFA SAYISI', 7,
         d.sinif_ad || ' · ' || d.baslik,
         'sayfa sınırı: ' || d.sayfa_limiti::text
           || ' · gönderen: ' || y.gonderim::text
           || ' · gönderilen sayfa: en az ' || y.en_az::text
           || ', en çok ' || y.en_cok::text
           || ' · sınıra DAYANAN: ' || y.tavanda::text || '/' || y.gonderim::text
           || case
                when d.sayfa_limiti > 1 and y.tavanda = y.gonderim
                  then '  →  GÖNDERENLERİN HEPSİ TAVANDA: sınır dar olabilir'
                when d.sayfa_limiti = 1
                  then '  →  SINIR 1 OLDUĞU İÇİN HERKES ZORUNLU OLARAK TAVANDA;'
                       || ' bu sayı sınırın dar olup olmadığını SÖYLEMEZ'
                else '' end,
         ''
    from sayfa_sayim y
    join son_odev d on d.id = y.odev_id
) r
order by sira, kim, ayrinti;
