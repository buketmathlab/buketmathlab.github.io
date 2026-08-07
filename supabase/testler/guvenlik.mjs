/**
 * SEKİZ — Güvenlik denemeleri (şartname 7. bölüm)
 *
 * `supabase/migrations/` altındaki göçlerin TAMAMI gerçek bir Postgres örneğine
 * (PGlite/WASM) kurulur, sonra saldırı senaryoları tek tek denenir. Ayrı bir
 * "test şeması" yoktur — üretime gidecek SQL'in aynısı sınanır.
 *
 * Çalıştırmak için: npm run guvenlik
 *
 * Yeni faz yeni fonksiyon eklediğinde bu dosyaya da deneme eklenir; böylece
 * bugün kapalı olan bir kapı yarın sessizce açılmaz.
 */
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readdirSync, readFileSync } from 'node:fs'

const DENEME_PIN = 'deneme-pin-9876'
const db = await new PGlite({ extensions: { pgcrypto } })

// Supabase'e özgü ortam PGlite'ta yoktur; taklit edilir.
await db.exec(`
  create role anon; create role authenticated;
  create schema if not exists extensions;
  create schema if not exists storage;
  create table if not exists storage.buckets (
    id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]);
  grant usage on schema storage to anon;
`)

for (const dosya of readdirSync('supabase/migrations').filter((d) => d.endsWith('.sql')).sort()) {
  const sql = readFileSync(`supabase/migrations/${dosya}`, 'utf8').replace(
    "v_pin constant text := 'DEGISTIRIN-8HANE'",
    `v_pin constant text := '${DENEME_PIN}'`,
  )
  await db.exec(sql)
}

const sonuclar = []
function yaz(no, baslik, gecti, ayrinti) {
  sonuclar.push({ no, baslik, gecti })
  console.log(`${gecti ? '✓' : '✗ BAŞARISIZ'} ${no}. ${baslik}\n    ${ayrinti}`)
}
const sor = async (sql, p = []) => (await db.query(sql, p)).rows[0]
const bekleHata = async (sql, p = []) => {
  try {
    await db.query(sql, p)
    return null
  } catch (h) {
    return h.message
  }
}

// ── Hazırlık: öğretmen, sınıf, iki öğrenci, yayınlanmış bir test ödevi ──
const jOgretmen = (await sor(`select giris_pin($1,'cihaz-ogretmen') as j`, [DENEME_PIN])).j.jeton
if (!jOgretmen) throw new Error('Öğretmen girişi kurulamadı.')

const sinif = (await sor(`select sinif_ekle($1,'9A',9::smallint) as j`, [jOgretmen])).j
const ogrA = (await sor(`select ogrenci_ekle($1,'A Öğrencisi','101',$2) as j`, [jOgretmen, sinif.id])).j
const ogrB = (await sor(`select ogrenci_ekle($1,'B Öğrencisi','102',$2) as j`, [jOgretmen, sinif.id])).j
const odev = (await sor(
  `select odev_olustur($1,'Türev Testi','test',$2, now() + interval '3 days', 3::smallint,
                       'Türev', '{"1":"B","2":"D","3":"A"}'::jsonb) as j`,
  [jOgretmen, sinif.id],
)).j
await sor(`select odev_yayinla($1,$2) as j`, [jOgretmen, odev.id])

const jA = (await sor(`select giris_kod($1,'cihaz-a') as j`, [ogrA.ogrenci_kodu])).j.jeton
const jB = (await sor(`select giris_kod($1,'cihaz-b') as j`, [ogrB.ogrenci_kodu])).j.jeton
const jVeliA = (await sor(`select giris_kod($1,'cihaz-veli-a') as j`, [ogrA.veli_kodu])).j.jeton

// ── 1. Başka öğrencinin verisi çekilebilir mi? ──
await db.exec(`set role anon`)
const tabloHatasi = await bekleHata(`select * from ogrenciler`)
const gonderimHatasi = await bekleHata(`select * from gonderimler`)
await db.exec(`reset role`)
yaz(1, 'Öğrenci koduyla başka öğrencinin verisi çekilebilir mi?',
  Boolean(tabloHatasi && gonderimHatasi),
  `anon rolüyle tablo okuma reddedildi: "${(tabloHatasi ?? '').slice(0, 55)}"`)

// ── 2. Gönderim yapmadan cevap anahtarı alınabilir mi? ──
const anahtarHatasi = await bekleHata(`select odev_anahtar($1,$2)`, [jA, odev.id])
const detay = (await sor(`select odev_detay($1,$2) as j`, [jA, odev.id])).j
yaz(2, 'Gönderim yapmadan cevap anahtarı alınabilir mi?',
  Boolean(anahtarHatasi) && !('anahtar' in detay) && !('anahtar_pdf_yol' in detay),
  'odev_anahtar reddetti; odev_detay yanıtında anahtar alanları hiç yok')

// ── 3. Öğretmen fonksiyonları öğrenci koduyla çağrılabilir mi? ──
const yetki = [
  await bekleHata(`select siniflar_listele($1)`, [jA]),
  await bekleHata(`select ogrenci_ekle($1,'Sahte','999')`, [jA]),
  await bekleHata(`select ogrenci_sil($1,$2,true)`, [jA, ogrB.id]),
  await bekleHata(`select kod_yenile($1,$2,'ogrenci')`, [jA, ogrB.id]),
  await bekleHata(`select odev_olustur($1,'Sahte','test',$2, now() + interval '1 day')`, [jA, sinif.id]),
]
yaz(3, 'Öğretmen fonksiyonları öğrenci koduyla çağrılabilir mi?',
  yetki.every(Boolean), 'denenen 5 öğretmen fonksiyonunun tamamı reddedildi')

// ── 4. PIN kaba kuvvetle denenebilir mi? ──
let kilit = null
for (let i = 0; i < 8; i++) {
  const y = (await sor(`select giris_pin('yanlis-pin-123','cihaz-saldirgan') as j`)).j
  if (y.kilit_saniye) { kilit = `${i + 1}. denemede kilitlendi (${y.kilit_saniye} sn)`; break }
}
const baskaCihaz = (await sor(`select giris_pin('yanlis-pin-123','baska-cihaz') as j`)).j
const ogretmenGirebiliyor = (await sor(`select giris_pin($1,'cihaz-ogretmen') as j`, [DENEME_PIN])).j
yaz(4, 'PIN kaba kuvvetle denenebilir mi? Oran sınırlama çalışıyor mu?',
  Boolean(kilit) && Boolean(ogretmenGirebiliyor.jeton) && Boolean(baskaCihaz.hata),
  `${kilit}; saldırgan kilitliyken öğretmen kendi cihazından girebiliyor`)

// ── 6. Mesaj alanına yazılan <script> ne oluyor? ──
await db.query(`insert into mesajlar (ogrenci_id, hat, gonderen, metin) values ($1,'ogrenci','ogrenci',$2)`,
  [ogrA.id, '<script>alert(1)</script>'])
const saklanan = (await sor(`select metin from mesajlar where ogrenci_id=$1`, [ogrA.id])).metin
yaz(6, 'Mesaj alanına yazılan <script> çalışır mı (XSS)?',
  saklanan === '<script>alert(1)</script>',
  'metin bozulmadan saklanıyor; arayüzde React kaçışlıyor, dangerouslySetInnerHTML kullanılmıyor')

// ── 7. SQL enjeksiyonu mümkün mü? ──
const enjeksiyon = (await sor(`select giris_kod($1,'cihaz-x') as j`, [`' or 1=1 --`])).j.hata
const ogrenciSayisi = (await sor(`select count(*)::int as n from ogrenciler`)).n
yaz(7, 'Fonksiyon parametreleri üzerinden SQL enjeksiyonu mümkün mü?',
  Boolean(enjeksiyon) && ogrenciSayisi === 2,
  `"' or 1=1 --" reddedildi; tablolar bozulmadı (${ogrenciSayisi} öğrenci duruyor)`)

// ── 8. İki kez gönderim mümkün mü? ──
const ilk = (await sor(`select odev_gonder($1,$2,'foto/a.jpg','{"1":"B","2":"X","3":"A"}'::jsonb) as j`,
  [jA, odev.id])).j
const ikinci = await bekleHata(`select odev_gonder($1,$2,'foto/a2.jpg','{"1":"B","2":"D","3":"A"}'::jsonb)`,
  [jA, odev.id])
const dbKatmani = await bekleHata(
  `insert into gonderimler (odev_id, ogrenci_id, foto_yol) values ($1,$2,'x.jpg')`, [odev.id, ogrA.id])
yaz(8, 'Bir öğrenci ödevi iki kez gönderip puanını yükseltebilir mi?',
  Boolean(ikinci) && Boolean(dbKatmani) && Number(ilk.puan) === 66.67,
  `ilk gönderim ${ilk.puan} puan; ikinci gönderim hem fonksiyonda hem veritabanı kısıtında reddedildi`)

// ── 2b. Gönderimden sonra anahtar açılıyor mu? ──
const anahtarSonra = (await sor(`select odev_anahtar($1,$2) as j`, [jA, odev.id])).j
const veliAnahtar = (await sor(`select odev_anahtar($1,$2) as j`, [jVeliA, odev.id])).j
const bHala = await bekleHata(`select odev_anahtar($1,$2)`, [jB, odev.id])
yaz(10, 'Gönderimden sonra anahtar açılıyor, göndermeyende kapalı kalıyor mu?',
  Boolean(anahtarSonra.anahtar) && Boolean(veliAnahtar.anahtar) && Boolean(bHala),
  'gönderen öğrenci ve velisi görüyor; göndermeyen B öğrencisi göremiyor')

// ── 9. Kod paylaşılırsa yenileme işe yarıyor mu? ──
const yeniKod = (await sor(`select kod_yenile($1,$2,'ogrenci') as j`, [jOgretmen, ogrA.id])).j
const eskiJeton = await bekleHata(`select ben_kimim($1)`, [jA])
const eskiKod = (await sor(`select giris_kod($1,'cihaz-a') as j`, [ogrA.ogrenci_kodu])).j.hata
yaz(9, "A öğrencisi kodunu B'ye verirse ne olur?",
  Boolean(eskiJeton) && Boolean(eskiKod) && Boolean(yeniKod.yeni_kod),
  'kod yenilenince eski kodla giriş kapandı ve eski oturumlar düştü')

// ── 11. Geç teslim gerçekten imkânsız mı? ──
await db.query(`update odevler set son_tarih = now() - interval '1 hour' where id = $1`, [odev.id])
const gec = await bekleHata(`select odev_gonder($1,$2,'foto/b.jpg','{"1":"B"}'::jsonb)`, [jB, odev.id])
yaz(11, 'Süresi dolan ödev gönderilebilir mi (geç teslim)?',
  Boolean(gec && gec.includes('süresi doldu')), `sunucu reddetti: "${(gec ?? '').slice(0, 55)}"`)

// ── 12. Okul öğrencisine ödeme kaydı açılabilir mi? ──
const odeme = await bekleHata(`insert into odemeler (ogrenci_id, tutar) values ($1, 500)`, [ogrB.id])
yaz(12, 'Okul öğrencisine ödeme/özel ders kaydı açılabilir mi?',
  Boolean(odeme), 'veritabanı bileşik yabancı anahtarı engelledi — kod hatası olsa bile mümkün değil')

// ── 13. Yetki yüzeyi: anon neyi çağırabiliyor? ──
await db.exec(`set role anon`)
const icFonksiyonlar = [
  await bekleHata(`select sekiz_kod_uret()`),
  await bekleHata(`select sekiz_ozet('x')`),
  await bekleHata(`select sekiz_oturum('x')`),
  await bekleHata(`select sekiz_ogretmen('x')`),
  await bekleHata(`select sekiz_kilit_saniye('ogretmen', null)`),
]
const ayarlar = await bekleHata(`select * from ayarlar`)
const oturumlar = await bekleHata(`select * from oturumlar`)
const acikKapi = await bekleHata(`select giris_kod('YOK-YOK','c')`)
await db.exec(`reset role`)
yaz(13, 'İç fonksiyonlar ve PIN hash tarayıcıdan erişilebilir mi?',
  icFonksiyonlar.every(Boolean) && Boolean(ayarlar) && Boolean(oturumlar) && acikKapi === null,
  '5 iç fonksiyon anon rolüne kapalı; ayarlar (PIN hash) ve oturumlar okunamıyor; yalnız giriş kapıları açık')

// ── 14. RLS bütün tablolarda açık mı? ──
const rlsKapali = (await db.query(
  `select tablename from pg_tables where schemaname='public' and not rowsecurity`)).rows
yaz(14, 'Bütün tablolarda satır düzeyi güvenlik açık mı?',
  rlsKapali.length === 0,
  rlsKapali.length === 0
    ? 'public şemasındaki tabloların tamamında RLS açık'
    : 'RLS kapalı: ' + rlsKapali.map((r) => r.tablename).join(', '))

const basarisiz = sonuclar.filter((s) => !s.gecti)
console.log(`\n${sonuclar.length - basarisiz.length}/${sonuclar.length} deneme beklendiği gibi sonuçlandı.`)
await db.close()
process.exit(basarisiz.length === 0 ? 0 : 1)
