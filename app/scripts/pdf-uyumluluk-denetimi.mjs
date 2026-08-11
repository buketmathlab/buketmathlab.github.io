/**
 * pdf.js tarayıcı uyumluluk denetimi — `npm run pdf-denetim`
 *
 * NEDEN VAR — canlıda iki kez ısırdı:
 *
 * 1. `pdfjs-dist@6` `Promise.withResolvers` kullanıyordu. Bu metot Safari'ye
 *    17.4'te geldi; öğretmenin iPad'inde pdf.js daha ilk adımda çöktü.
 *    Polyfill eklendi.
 * 2. Aynı sürüm `Iterator` global'inin var olduğunu da varsayıyordu
 *    (`Iterator.prototype.join` kontrolü). `Iterator` Safari'ye **18.4**'te
 *    geldi. Polyfill'in ardından ikinci çökme buydu.
 *
 * Tek tek polyfill kovalamak sürdürülebilir değil: bir sonraki sürüm yeni
 * bir API getirir ve aynı hata yeniden yaşanır. Bu yüzden paket
 * `4.0.379`'a sabitlendi — bu sürüm ikisini de kullanmıyor.
 *
 * Bu betik paketin gerçekten temiz kaldığını ölçer. Biri sürümü
 * yükseltirse burada kırmızıya düşer, canlıda öğretmenin ekranında değil.
 *
 * Ölçüt: ürün Tailwind 4 yüzünden zaten Safari 16.4+ istiyor. Bu listedeki
 * her şey 16.4'ten SONRA gelmiş API'ler.
 */

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** API → hangi Safari sürümünde geldi. */
const RISKLI = [
  ['Promise.withResolvers', '17.4'],
  ['Iterator.', '18.4'],
  ['Object.groupBy', '17.4'],
  ['Map.groupBy', '17.4'],
  ['ArrayBuffer.prototype.transfer', '17.4'],
  ['isWellFormed', '17.0'],
];

const DOSYALAR = ['build/pdf.min.mjs', 'build/pdf.worker.min.mjs'];

async function main() {
  const kok = require.resolve('pdfjs-dist/package.json').replace(/package\.json$/, '');
  const surum = JSON.parse(await readFile(kok + 'package.json', 'utf8')).version;

  console.log(`pdfjs-dist ${surum} taranıyor…\n`);

  const bulunanlar = [];
  for (const d of DOSYALAR) {
    const icerik = await readFile(kok + d, 'utf8');
    for (const [api, safari] of RISKLI) {
      const adet = icerik.split(api).length - 1;
      if (adet > 0) bulunanlar.push({ dosya: d, api, safari, adet });
    }
  }

  if (bulunanlar.length === 0) {
    console.log(`  Riskli API bulunamadı — ${surum} eski Safari'de çalışır.`);
    return;
  }

  console.error('  ESKİ SAFARI\'DE ÇÖKECEK API\'LER BULUNDU:\n');
  for (const b of bulunanlar) {
    console.error(`    ${b.api}  (Safari ${b.safari}+)  — ${b.dosya} içinde ${b.adet} kez`);
  }
  console.error(
    '\n  Bu sürüm öğretmenin iPad\'inde çökecek. Ya sürümü geri alın ya da\n' +
      '  her API için polyfill yazıp GERÇEKTEN denediğinizi kanıtlayın.\n' +
      '  Ayrıntı: app/scripts/pdf-uyumluluk-denetimi.mjs başlığı.',
  );
  process.exitCode = 1;
}

main().catch((e) => {
  console.error('Denetim çalıştırılamadı:', e);
  process.exitCode = 1;
});
