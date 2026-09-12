/**
 * DEPODAKİ MIGRATION LİSTESİNİ ÜRETİR
 *
 * Sürüm defteri ekranı iki listeyi karşılaştırıyor: veritabanının
 * söylediği (uç) ve deponun içerdiği (bu dosya). Fark, "çalıştırılmamış
 * dosyalar" demek.
 *
 * NEDEN ÜRETİLİYOR, ELLE YAZILMIYOR. Bu turun konusu zaten şu: elle
 * tutulan kayıt kayar. Listeyi elle yazsaydık, yeni bir migration eklenip
 * listeye işlenmediğinde ekran "veritabanınız güncel" derdi — yani defter
 * tam da işe yarayacağı anda susardı.
 *
 * Üretmeyi unutmak da bir ihtimal; ona karşı `migration-listesi.test.ts`
 * var: dosya dizinle birebir değilse test kırmızı yanıyor ve bu betiği
 * çalıştırmanızı söylüyor.
 *
 * Kullanım:  npm run migration-listesi
 */
import { readdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BURASI = dirname(fileURLToPath(import.meta.url));
const KAYNAK = resolve(BURASI, '../../supabase/migrations');
const HEDEF = resolve(BURASI, '../src/lib/migration-listesi.ts');

/** `0041_surum_defteri.sql` → `{ no: '0041', dosya: '…' }` */
export function migrationlariOku(dizin = KAYNAK) {
  return readdirSync(dizin)
    .filter((d) => d.endsWith('.sql'))
    .sort()
    .map((dosya) => {
      const no = /^(\d{4})_/.exec(dosya)?.[1];
      if (!no) throw new Error(`Migration adı dört haneli numarayla başlamıyor: ${dosya}`);
      return { no, dosya };
    });
}

export function dosyaMetni(liste) {
  const satirlar = liste
    .map((m) => `  { no: '${m.no}', dosya: '${m.dosya}' },`)
    .join('\n');
  return `/**
 * ÜRETİLMİŞ DOSYA — ELLE DÜZENLEMEYİN.
 * Üreten: app/scripts/migration-listesi.mjs  (npm run migration-listesi)
 *
 * Depodaki migration dosyaları. Sürüm defteri ekranı bunu veritabanının
 * defteriyle karşılaştırıp "çalıştırılmamış dosyalar"ı buluyor.
 */
export type MigrationKaydi = { no: string; dosya: string };

export const MIGRATION_LISTESI: readonly MigrationKaydi[] = [
${satirlar}
];
`;
}

// Doğrudan çalıştırıldığında yaz; testten `import` edildiğinde yazma.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const liste = migrationlariOku();
  writeFileSync(HEDEF, dosyaMetni(liste));
  console.log(`migration-listesi.ts yazıldı — ${liste.length} dosya, son: ${liste.at(-1).no}`);
}
