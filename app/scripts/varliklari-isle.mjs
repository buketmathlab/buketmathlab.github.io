/**
 * Görsel varlık hattı — `npm run varliklar`
 *
 * Kaynak dosyalar `kaynak-varliklar/` içinde durur (yayınlanmaz, sürüm
 * kontrolünde tutulur), çıktı `public/` altına üretilir. Böylece hat
 * tekrarlanabilir: çıktıyı silip yeniden üretebilirsiniz.
 *
 * Ewalu'nun kimliğine DOKUNULMAZ (Kural 9): yalnızca biçim, boyut ve kırpma
 * değişir; karakterin görünümü, kıyafeti, rengi olduğu gibi kalır.
 *
 * Okul mührü YENİDEN ÇİZİLMEZ (Kural 8): yalnızca beyaz kutu zemini dairesel
 * maskeyle kaldırılır, çizimin kendisi değişmez.
 *
 * Not: Yalnız WebP üretiyoruz. WebP 2020'den beri tüm hedef tarayıcılarda
 * destekleniyor; JPEG yedeği depoyu iki katına çıkarır ve karşılığı yok.
 */

import { mkdir, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const KAYNAK = join(kok, 'kaynak-varliklar');
const HEDEF_EWALU = join(kok, 'public', 'ewalu');
const HEDEF_MARKA = join(kok, 'public', 'marka');

/**
 * Yüz merkezli kare kırpma kutuları. Değerler kaynak görsellerin piksel
 * koordinatlarıdır ve gözle doğrulanarak ayarlanmıştır — sekizgen çerçeve
 * içinde Ewalu'nun yüzü ortalanmalı, kulakları kesilmemeli.
 */
const EWALU = [
  {
    ad: 'karsilama',
    dosya: 'ewalu-karsilama.jpeg',
    kirp: { left: 355, top: 30, width: 470, height: 470 },
    alt: 'Ewalu, bere ve gözlüğüyle gülümsüyor',
  },
  {
    ad: 'kesif',
    dosya: 'ewalu-kesif.jpeg',
    kirp: { left: 330, top: 80, width: 470, height: 470 },
    alt: 'Ewalu, şapkası ve haritasıyla yolunu arıyor',
  },
  {
    ad: 'kutlama',
    dosya: 'ewalu-kutlama.jpeg',
    kirp: { left: 350, top: 0, width: 470, height: 470 },
    alt: 'Ewalu, kolunu havaya kaldırmış seviniyor',
  },
  {
    ad: 'calisma',
    dosya: 'ewalu-calisma.jpeg',
    kirp: { left: 250, top: 10, width: 540, height: 540 },
    alt: 'Ewalu, ceketi ve kalemiyle defterine yazıyor',
  },
];

const PORTRE_BOYUTLARI = [128, 256, 512];
const TAM_BOYUTLARI = [640, 1200];
const MUHUR_BOYUTLARI = [256, 512, 1024];

async function klasorHazirla(yol) {
  await mkdir(yol, { recursive: true });
}

/** Ewalu portreleri — sekizgen çerçeve içinde kullanılacak yüz kırpması. */
async function ewaluPortreleri() {
  for (const e of EWALU) {
    const girdi = join(KAYNAK, e.dosya);
    for (const boyut of PORTRE_BOYUTLARI) {
      const cikti = join(HEDEF_EWALU, `${e.ad}-portre-${boyut}.webp`);
      await sharp(girdi)
        .extract(e.kirp)
        .resize(boyut, boyut, { fit: 'cover' })
        .webp({ quality: 82 })
        .toFile(cikti);
    }
  }
}

/** Ewalu tam figürleri — landing ve büyük boş durumlar için. */
async function ewaluTamFigurler() {
  for (const e of EWALU) {
    const girdi = join(KAYNAK, e.dosya);
    for (const boyut of TAM_BOYUTLARI) {
      const cikti = join(HEDEF_EWALU, `${e.ad}-tam-${boyut}.webp`);
      await sharp(girdi)
        .resize(boyut, null, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(cikti);
    }
  }
}

/**
 * Okul mührü — beyaz kutu zemini dairesel maskeyle kaldırılır.
 * Mühür zaten dairesel olduğu için bu bir yeniden tasarım değil, yalnızca
 * arka planın şeffaflaştırılmasıdır.
 */
async function okulMuhru() {
  // PNG kaynak tercih ediliyor: aynı mühür ama JPEG halkalanma bozulmaları
  // yok, dolayısıyla dairesel maskenin kenarı daha temiz çıkıyor.
  // Lacivert ölçümü: PNG'de #001637, JPEG'de #001737 — tek kanalda 1 birim
  // fark, algı eşiğinin altında. Token #001737 olarak bırakıldı.
  const girdi = join(KAYNAK, 'okul-muhru.png');
  const { width = 0, height = 0 } = await sharp(girdi).metadata();
  const kenar = Math.min(width, height);
  // Mühür karenin tamamını doldurmuyor; kenarda ince beyaz pay var.
  const yaricap = Math.round((kenar / 2) * 0.985);
  const maske = Buffer.from(
    `<svg width="${kenar}" height="${kenar}">
       <circle cx="${kenar / 2}" cy="${kenar / 2}" r="${yaricap}" fill="#fff"/>
     </svg>`,
  );

  // Maskeyi tam boyutta bir kez uygula. sharp'ta ikinci resize() çağrısı
  // birincisini ezdiği için maskeleme ve ölçekleme ayrı aşamalar olmalı.
  const maskeli = await sharp(girdi)
    .resize(kenar, kenar, { fit: 'cover' })
    .composite([{ input: maske, blend: 'dest-in' }])
    .png()
    .toBuffer();

  for (const boyut of MUHUR_BOYUTLARI) {
    await sharp(maskeli)
      .resize(boyut, boyut)
      .webp({ quality: 90, alphaQuality: 100 })
      .toFile(join(HEDEF_MARKA, `okul-muhru-${boyut}.webp`));
  }

  // PNG türevi: PDF/dışa aktarma gibi WebP kabul etmeyen bağlamlar için.
  await sharp(maskeli)
    .resize(512, 512)
    .png({ compressionLevel: 9 })
    .toFile(join(HEDEF_MARKA, 'okul-muhru-512.png'));
}

/** Ewalu tanıtım videosu için poster — video yüklenmeden gösterilir. */
async function videoPosteri() {
  // ffmpeg bu ortamda yok; videodan kare çıkaramıyoruz. Poster olarak
  // Ewalu'nun karşılama görselini kullanıyoruz — marka açısından tutarlı
  // ve videonun kendisiyle aynı karakteri gösteriyor.
  await sharp(join(KAYNAK, 'ewalu-karsilama.jpeg'))
    .resize(1200, null, { fit: 'inside' })
    .webp({ quality: 74 })
    .toFile(join(HEDEF_MARKA, 'ewalu-tanitim-poster.webp'));
}

async function ozet(klasor, etiket) {
  const dosyalar = await readdir(klasor);
  let toplam = 0;
  for (const d of dosyalar) {
    const s = await stat(join(klasor, d));
    if (s.isFile()) toplam += s.size;
  }
  console.log(`  ${etiket}: ${dosyalar.length} dosya, ${(toplam / 1024).toFixed(0)} KB`);
}

async function main() {
  await klasorHazirla(HEDEF_EWALU);
  await klasorHazirla(HEDEF_MARKA);

  console.log('Ewalu portreleri üretiliyor…');
  await ewaluPortreleri();
  console.log('Ewalu tam figürleri üretiliyor…');
  await ewaluTamFigurler();
  console.log('Okul mührü maskeleniyor…');
  await okulMuhru();
  console.log('Video posteri üretiliyor…');
  await videoPosteri();

  console.log('\nTamamlandı:');
  await ozet(HEDEF_EWALU, 'public/ewalu');
  await ozet(HEDEF_MARKA, 'public/marka');
}

main().catch((e) => {
  console.error('Varlık işleme başarısız:', e);
  process.exitCode = 1;
});
