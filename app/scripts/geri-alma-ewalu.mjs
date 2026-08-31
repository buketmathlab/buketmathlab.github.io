/**
 * 0032 arayüz denetiminin GERİ ALMA KANITI.
 *
 * Her ölçüm tek tek bozulup denetimin KIRILDIĞI gösteriliyor. Kırılmayan
 * bir ölçüm bir şey ölçmüyor demektir.
 *
 * DERLEME KIRILIRSA DURUYOR. 0030 turunda öğrenilen tuzak: derlemeyi kıran
 * bir yama sessizce ESKİ paketi ölçtürüyor ve yedi yamanın yedisi de
 * "yakalandı" görünüyordu — hiçbiri gerçekten koşmamıştı.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const E = 'src/features/ogretmen/EwaluMesajlari.tsx';
const T = 'src/features/ogrenci/OdevTeslim.tsx';
const L = 'src/lib/ewalu-puan.ts';
const DOSYALAR = [E, T, L];
const YEDEK = new Map(DOSYALAR.map((d) => [d, readFileSync(d, 'utf-8')]));
const geriAl = () => { for (const [d, i] of YEDEK) writeFileSync(d, i); };

let kusur = 0;

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
    kusur++;
    console.log(`  ✗ ${ad} — DERLEME KIRILDI, ölçüm yapılmadı`);
    geriAl();
    execFileSync('npm', ['run', 'build'], { stdio: 'pipe' });
    return;
  }

  let kirildi = false;
  try {
    execFileSync('node', ['scripts/ewalu-mesaj-denetimi.mjs'], { stdio: 'pipe' });
  } catch {
    kirildi = true;
  }
  console.log(kirildi ? `  ✓ ${ad} — denetim kırıldı` : `  ✗ ${ad} — DENETİM GEÇTİ, ölçüm boş`);
  if (!kirildi) kusur++;

  geriAl();
  execFileSync('npm', ['run', 'build'], { stdio: 'pipe' });
}

console.log('0032 ARAYÜZ GERİ ALMA KANITI\n');

// Turun SÖZLEŞMESİ: özel cümle varsayılanı ezmeli.
// Yamalar DERLENEBİLİR olmak zorunda, yoksa ölçüm hiç koşmaz (yukarıdaki
// tuzak). Kullanılmayan değişken bırakmak lint'i kırıyor; o yüzden değişken
// duruyor, yalnız SONUCA hiç girmiyor.
dene('özel cümle varsayılanı ezmiyor', L, (s) =>
  s.replace('return { poz: bant.poz, cumle: yazilan ? yazilan : bant.cumle };',
            'void yazilan;\n  return { poz: bant.poz, cumle: bant.cumle };'));

// Öğrencinin kartına ULAŞMASI — turun asıl amacı.
dene('cümle öğrencinin kartına taşınmıyor', T, (s) =>
  s.replace('const { poz, cumle } = puanMesaji(puan, ozelCumleler);',
            'void ozelCumleler;\n  const { poz, cumle } = puanMesaji(puan);'));

// Uç yokken sessizce varsayılana düşme (Part VIII).
dene('uç yokken öğrencinin kartı bozuluyor', T, (s) =>
  s.replace('for (const s of ozelListe ?? []) ozelCumleler[s.bant] = s.cumle;',
            "for (const s of ozelListe ?? [{ bant: 50, cumle: '' }]) ozelCumleler[s.bant] = s.cumle;\n" +
            "  if (!ozelListe) ozelCumleler[50] = 'UÇ YOK';"));

// "Varsayılana dön" yalnız özelleştirilmiş bantta çıkmalı.
dene('dönülecek bir şey yokken de düğme çıkıyor', E, (s) =>
  s.replace('const ozellestirilmis = kayitli[bant] !== undefined;',
            'const ozellestirilmis = true;'));

// Geri alma `null` göndermeli (satır silinsin).
dene('geri alma null yerine varsayılan METNİ yazıyor', E, (s) =>
  s.replace('        p_cumle: null,\n      });',
            '        p_cumle: varsayilanCumle(bant),\n      });'));

// Uyarı ENGELLEMEMELİ — öğretmenin kendi kuralı, son söz onda.
dene('yasaklı kelime kaydetmeyi ENGELLİYOR', E, (s) =>
  s.replace('disabled={!degisti || yazilan.trim() === \'\'}',
            'disabled={!degisti || yazilan.trim() === \'\' || uyari.length > 0}'));

// Boş cümle sunucuya gitmemeli.
dene('boş cümle kaydedilebiliyor', E, (s) =>
  s.replace('disabled={!degisti || yazilan.trim() === \'\'}', 'disabled={!degisti}'));

// 0032 yokken sakin Türkçe kart (Part VIII).
dene('uç yokken İngilizce hata sızıyor', E, (s) =>
  s.replace('const ucYok = hata !== null && /could not find the function|schema cache/i.test(hata);',
            'const ucYok = false;'));

geriAl();
execFileSync('npm', ['run', 'build'], { stdio: 'pipe' });
const temiz = DOSYALAR.every((d) => readFileSync(d, 'utf-8') === YEDEK.get(d));
console.log(`\ndosyalar orijinaliyle birebir: ${temiz ? 'evet' : 'HAYIR'}`);
console.log(kusur === 0 ? 'GERİ ALMA KANITI TAM — 8/8' : `EKSİK — ${kusur} ölçüm kırılmadı`);
process.exit(kusur === 0 && temiz ? 0 : 1);
