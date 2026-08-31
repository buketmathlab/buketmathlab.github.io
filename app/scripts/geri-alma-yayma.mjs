/**
 * 0031 arayüz denetiminin GERİ ALMA KANITI.
 *
 * Her ölçüm tek tek bozulup denetimin KIRILDIĞI gösteriliyor. Kırılmayan bir
 * ölçüm bir şey ölçmüyor demektir.
 *
 * DERLEME KIRILIRSA DURUYOR. 0030 turunda öğrenilen tuzak: derlemeyi kıran
 * bir yama sessizce ESKİ paketi ölçtürüyor ve yedi yamanın yedisi de
 * "yakalandı" görünüyordu — hiçbiri gerçekten koşmamıştı.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const DOSYALAR = ['src/features/ogretmen/KardeslereYayma.tsx', 'src/features/ogretmen/OdevDuzenle.tsx'];
const YEDEK = new Map(DOSYALAR.map((d) => [d, readFileSync(d, 'utf-8')]));
const geriAl = () => { for (const [d, i] of YEDEK) writeFileSync(d, i); };

let kusur = 0;

/** @param {string} ad @param {(s:string)=>string} yama @param {string} dosya */
function dene(ad, dosya, yama) {
  geriAl();
  const once = readFileSync(dosya, 'utf-8');
  const sonra = yama(once);
  if (sonra === once) {
    kusur++;
    console.log(`  ✗ ${ad} — YAMA UYGULANMADI (desen tutmadı)`);
    geriAl();
    return;
  }
  writeFileSync(dosya, sonra);

  try {
    execFileSync('npm', ['run', 'build'], { stdio: 'pipe' });
  } catch {
    // Derleme kırıldı: eski paketi ölçmek anlamsız olurdu.
    kusur++;
    console.log(`  ✗ ${ad} — DERLEME KIRILDI, ölçüm yapılmadı`);
    geriAl();
    execFileSync('npm', ['run', 'build'], { stdio: 'pipe' });
    return;
  }

  let kirildi = false;
  try {
    execFileSync('node', ['scripts/kardes-yayma-denetimi.mjs'], { stdio: 'pipe' });
  } catch {
    kirildi = true;
  }
  console.log(kirildi ? `  ✓ ${ad} — denetim kırıldı` : `  ✗ ${ad} — DENETİM GEÇTİ, ölçüm boş`);
  if (!kirildi) kusur++;

  geriAl();
  execFileSync('npm', ['run', 'build'], { stdio: 'pipe' });
}

const K = 'src/features/ogretmen/KardeslereYayma.tsx';
const O = 'src/features/ogretmen/OdevDuzenle.tsx';

console.log('0031 ARAYÜZ GERİ ALMA KANITI\n');

dene('onay diyaloğu atlanıp doğrudan yayılıyor', K, (s) =>
  s.replace('onClick={() => setOnayAcik(true)}', 'onClick={() => void yay()}'));

dene('arşivdeki kardeş de düğmede vaat ediliyor', K, (s) =>
  s.replace('const yayilabilir = kardesler.filter((k) => !k.arsiv);', 'const yayilabilir = kardesler;'));

dene('arşiv nedeniyle atlanan sessizce geçiliyor', K, (s) =>
  s.replace("s.atlandi === 'arsiv' ?", 'false ?'));

dene('puanı değişmeyen sınıf hiç yazılmıyor', K, (s) =>
  s.replace('s.yeniden_puanlanan.length === 0 ?', 'false ?'));

dene('taşınmayanlar diyalogdan kaldırıldı', K, (s) =>
  s.replace('<strong>Taşınmayacaklar:</strong>', '<strong>Notlar:</strong>'));

// Bu yamanın DERLENMESİ gerekiyor, yoksa ölçüm hiç koşmaz (yukarıdaki tuzak).
// O yüzden koşulu gevşetmekle yetinmiyor, `kardes_detay` yokken onu
// `kardesler`den uyduruyor — "uç yoksa düğme çıkmasın" kuralının tam tersi.
dene('0031 yokken de yayma kartı çiziliyor', O, (s) =>
  s
    .replace('{detay.kardes_detay && detay.kardes_detay.length > 0 ? (',
             '{detay.kardesler && detay.kardesler.length > 0 ? (')
    .replace('kardesler={detay.kardes_detay}',
             'kardesler={detay.kardes_detay ?? (detay.kardesler ?? []).map((x) => ' +
               '({ id: x, sinif: x, gonderim_sayisi: 0, anahtar_ayni: true, arsiv: false }))}'));

geriAl();
execFileSync('npm', ['run', 'build'], { stdio: 'pipe' });
const temiz = DOSYALAR.every((d) => readFileSync(d, 'utf-8') === YEDEK.get(d));
console.log(`\ndosyalar orijinaliyle birebir: ${temiz ? 'evet' : 'HAYIR'}`);
console.log(kusur === 0 ? 'GERİ ALMA KANITI TAM — 6/6' : `EKSİK — ${kusur} ölçüm kırılmadı`);
process.exit(kusur === 0 && temiz ? 0 : 1);
