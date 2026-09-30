/**
 * ÖĞRENCİ CEVABINI DEĞİŞTİREBİLİYOR MU (Chromium, iPhone öykünmesi, dokunma)
 *
 * Olay: 51 soruluk testte bir öğrenci 8. soruya yanlışlıkla D işaretledi,
 * B'ye çeviremedi ("sistem izin vermedi") ve yanlış cevapla gönderdi. Kod
 * değişikliğe izin veriyordu; muhtemel sebep iPhone'un ÇİFT DOKUNMA
 * YAKINLAŞTIRMASI: bitişik iki şıkka hızlı art arda dokunuşta ikinci dokunuş
 * düğmeye gitmiyor. Düğmelerde `touch-action: manipulation` yoktu.
 *
 *  S1. Şık düğmelerinin HESAPLANAN stilinde `touch-action: manipulation`
 *      (öykünücü iPhone Safari'nin yakınlaştırmasını taklit etmiyor; bu
 *      yüzden davranışın kaynağı olan stil ölçülüyor).
 *  S2. 8 sayfa yüklüyken 8. soru: D → B → (B'ye yeniden) boş → D.
 *  S3. Boş cevap uyarısı açılıp kapandıktan sonra da değişiyor.
 *  S4. Yönlendirme görünür: "başka bir şıkka dokunman yeterli" ve
 *      "Gönderene kadar … istediğin kadar değiştirebilirsin".
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/sik-degistirme-denetimi.mjs
 */
import sharp from 'sharp';

let hata = 0;
const tamam = (m) => console.log(`  ✓ ${m}`);
const bozuk = (m) => { hata++; console.log(`  ✗ ${m}`); };

const { chromium, devices } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const KOK = 'http://127.0.0.1:8788/yeni/';
const N = 51;
const ODEVLER = {
  ogrenci: { id: 'o1', ad: 'Öğrenci', sinif: '9C', tur: 'okul' },
  odevler: [{
    id: 'a1', baslik: 'Üslü ve köklü', aciklama: null, tur: 'test', son_tarih: '2099-10-02',
    soru_sayisi: N, gec_teslim: true, sik_sayisi: 5, sinif_arsiv: false, odev_yolu: null,
    gonderim: null, konu_analizi: [], cevap_anahtari: null, anahtar_yolu: null,
  }],
  dersler: [], okunmamis_mesaj: 0,
};

const b = await chromium.launch();
const s = await b.newContext({ ...devices['iPhone 13'] });
await s.addInitScript((ODEVLER) => {
  localStorage.setItem('sekiz_oturum', JSON.stringify({ rol: 'ogrenci', token: 't'.repeat(64),
    ogrenci: { id: 'o1', ad: 'Öğrenci', tur: 'okul', sinif: '9C' } }));
  const asil = window.fetch;
  const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
  window.fetch = async (u, o) => {
    const url = String(typeof u === 'string' ? u : u.url);
    const m = url.match(/\/rpc\/([a-z_]+)/);
    if (!m) return asil(u, o);
    if (m[1] === 'ogrenci_odevleri') return json(ODEVLER);
    if (m[1] === 'odev_sayfa_siniri') return json(8);
    if (m[1] === 'ewalu_mesajlari') return json([]);
    return json({});
  };
}, ODEVLER);
const p = await s.newPage();
p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
await p.goto(KOK + '#/ogrenci/odev/a1', { waitUntil: 'networkidle' });
await p.waitForTimeout(400);

const secili = (no) => p.evaluate((no) => [...document.querySelectorAll(`button[aria-label^="${no}. soru,"]`)]
  .filter((x) => x.getAttribute('aria-pressed') === 'true').map((x) => x.textContent).join(''), no);
async function dokun(no, h) {
  const l = p.getByRole('button', { name: `${no}. soru, ${h} şıkkı`, exact: true });
  await l.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await l.tap();
  await p.waitForTimeout(120);
}

console.log('--- S1. Şık düğmelerinde touch-action: manipulation ---');
{
  const degerler = await p.evaluate(() => [...new Set(
    [...document.querySelectorAll('button[aria-label*=". soru,"]')].map((x) => getComputedStyle(x).touchAction))]);
  if (degerler.length !== 1 || degerler[0] !== 'manipulation') bozuk(`touch-action: ${degerler.join(', ')}`);
  else tamam(`${N * 5} şık düğmesinin hepsi "manipulation"`);
  const gonder = await p.getByRole('button', { name: 'Ödevi gönder' }).evaluate((e) => getComputedStyle(e).touchAction);
  if (gonder !== 'manipulation') bozuk(`"Ödevi gönder": ${gonder}`);
  else tamam('genel kural: "Ödevi gönder" de "manipulation"');
}

console.log('--- S2. 8 sayfa yüklü; 8. soru D → B → boş → D ---');
{
  const foto = await sharp({ create: { width: 3000, height: 4000, channels: 3, background: '#eee' } }).jpeg().toBuffer();
  await p.locator('input[type=file]').setInputFiles(
    Array.from({ length: 8 }, (_, i) => ({ name: `s${i}.jpg`, mimeType: 'image/jpeg', buffer: foto })));
  await p.waitForFunction(() => !/Görseller hazırlanıyor/.test(document.body.innerText), null, { timeout: 60000 });
  for (let i = 1; i <= 7; i++) await dokun(i, 'A');
  const adimlar = [];
  await dokun(8, 'D'); adimlar.push(await secili(8));
  await dokun(8, 'B'); adimlar.push(await secili(8));
  await dokun(8, 'B'); adimlar.push(await secili(8) || 'boş');
  await dokun(8, 'D'); adimlar.push(await secili(8));
  if (adimlar.join(' → ') !== 'D → B → boş → D') bozuk(`adımlar: ${adimlar.join(' → ')}`);
  else tamam('D → B → boş → D');
}

console.log('--- S3. Uyarı açılıp kapandıktan sonra da değişiyor ---');
{
  const g = p.getByRole('button', { name: 'Ödevi gönder' });
  await g.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await g.tap();
  await p.waitForTimeout(300);
  await p.locator('dialog[open]').getByRole('button', { name: 'Geri dön, işaretleyeyim' }).tap();
  await p.waitForTimeout(300);
  await dokun(8, 'B');
  if ((await secili(8)) !== 'B') bozuk('uyarıdan sonra değişmedi');
  else tamam('uyarıdan sonra 8 → B');
}

console.log('--- S4. Yönlendirme görünür ---');
{
  const m = await p.evaluate(() => document.body.innerText);
  if (!m.includes('Cevabını değiştirmek için başka bir şıkka dokunman yeterli')) bozuk('ızgara yönlendirmesi yok');
  else tamam('"Cevabını değiştirmek için başka bir şıkka dokunman yeterli…"');
  if (!m.includes('Gönderene kadar cevaplarını istediğin kadar değiştirebilirsin')) bozuk('gönder notu eski');
  else tamam('"Gönderene kadar cevaplarını istediğin kadar değiştirebilirsin…"');
}

await b.close();
console.log('');
if (hata) { console.log(`ŞIK DEĞİŞTİRME DENETİMİ BAŞARISIZ — ${hata} sapma`); process.exit(1); }
console.log('ŞIK DEĞİŞTİRME DENETİMİ GEÇTİ');
