/**
 * ÖDEV DOSYASINI AÇMA — AÇILIR PENCERE ENGELİNE KARŞI (Chromium, taklit RPC)
 *
 * Olay: bazı öğrenciler "Soruları aç (PDF)"a basınca hiçbir şey olmadığını
 * söyledi (üç cihazda). Sekme, sunucudan adres GELDİKTEN sonra açılıyordu;
 * iPhone Safari, uygulama içi tarayıcılar ve yavaş sunucuda Android Chrome
 * bunu sessizce engelliyor. Artık sekme dokunuş anında açılıyor, adres
 * gelince yönlendiriliyor; açılamazsa "Dosyayı aç" bağlantısı çıkıyor.
 *
 *  D1. Öğrenci: GERÇEK sekme açılıyor ve imzalı adrese gidiyor; altta
 *      "Açılmadıysa: Dosyayı aç" bağlantısı da var.
 *  D2. Sekme engellenirse (`window.open` null): "Dosya hazır. Açmak için
 *      dokunun" + bağlantı; dokununca imzalı adres açılıyor.
 *  D3. Sunucu 4 sn gecikse de sekme açılıyor (boş sekme önceden açık).
 *  D4. 403: "Bu dosyaya erişim izniniz yok." uyarısı; boş sekme kapanıyor.
 *  D5. Öğretmen (Düzenle → Görüntüle): aynı yol, sekme imzalı adrese gidiyor.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/dosya-acma-denetimi.mjs
 */
let hata = 0;
const tamam = (m) => console.log(`  ✓ ${m}`);
const bozuk = (m) => { hata++; console.log(`  ✗ ${m}`); };

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const KOK = 'http://127.0.0.1:8788/yeni/';
// "İmzalı adres": aynı sunucudaki gerçek bir dosya, sekme oraya gidebilsin.
const IMZALI = KOK + 'surum.json?imzali=1';

const gun = (d) => { const t = new Date(); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10); };
const OGRENCI_ODEVI = {
  id: 'a1', baslik: 'Sayılar', aciklama: null, tur: 'test', son_tarih: gun(3), soru_sayisi: 5,
  gec_teslim: true, sik_sayisi: 5, sinif_arsiv: false, odev_yolu: 'odev/x/sorular.pdf',
  gonderim: null, konu_analizi: [], cevap_anahtari: null, anahtar_yolu: null, sayfa_limiti: 1,
};
const DETAY = {
  id: 'a1', baslik: 'Sayılar', aciklama: null, tur: 'test', sinif_id: 's1', sinif: '9A',
  son_tarih: gun(3), soru_sayisi: 5, gec_teslim: true, sik_sayisi: 5,
  cevap_anahtari: { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E' }, konular: {},
  anahtar_yolu: 'odev/x/anahtar.pdf', odev_yolu: 'odev/x/sorular.pdf',
  yayinda: true, gonderim_sayisi: 0, sayfa_limiti: 1,
};

async function kur({ rol, yol, gecikme = 0, durum = 200, engel = false }) {
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: 390, height: 900 } });
  await s.addInitScript(({ rol, gecikme, durum, engel, IMZALI, OGRENCI_ODEVI, DETAY }) => {
    if (location.search.includes('imzali')) return;
    localStorage.setItem('sekiz_oturum', JSON.stringify({ rol, token: 't'.repeat(64),
      ogrenci: { id: 'o1', ad: 'Ada Yıldırım', tur: 'okul', sinif: '9A' } }));
    if (engel) window.open = () => null; // açılır pencere engelleyicisi
    const asil = window.fetch;
    const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
    window.fetch = async (u, o) => {
      const url = String(typeof u === 'string' ? u : u.url);
      if (/functions\/v1\/dosya-url/.test(url)) {
        await new Promise((c) => setTimeout(c, gecikme));
        if (durum !== 200) return json({ hata: 'Bu dosyaya erişim izniniz yok.' }, durum);
        return json({ imzaliUrl: IMZALI, gecerlilikSn: 60 });
      }
      const m = url.match(/\/rpc\/([a-z_]+)/);
      if (!m) return asil(u, o);
      switch (m[1]) {
        case 'ogrenci_odevleri':
          return json({ ogrenci: { id: 'o1', ad: 'Ada Yıldırım', sinif: '9A', tur: 'okul' }, odevler: [OGRENCI_ODEVI], dersler: [], okunmamis_mesaj: 0 });
        case 'ewalu_mesajlari': return json([]);
        case 'odev_kiyasi': return json({ durum: 'sure_dolmadi' });
        case 'odev_detay': return json(DETAY);
        case 'siniflar_listesi': return json([{ id: 's1', ad: '9A', seviye: 9, sube: 'A', ozel: false, arsiv: false }]);
        case 'ben_kimim': return json({ id: 'g', ad: 'Buket Topuzoğlu', sahip: true, vekalet: false, vekil: null });
        case 'odev_dosya_yolu': return json({ yol: 'odev/x/sorular.pdf' });
        case 'konu_onerileri': case 'odevler_listesi': return json([]);
        default: return json({});
      }
    };
  }, { rol, gecikme, durum, engel, IMZALI, OGRENCI_ODEVI, DETAY });
  const p = await s.newPage();
  p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
  await p.goto(KOK + '#' + yol, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  return { b, s, p };
}
const metin = (p) => p.evaluate(() => document.body.innerText);

/** Düğmeye basar; açılan sekmenin son adresini (ya da null) döndürür. */
async function basVeSekmeyiBekle(s, p, dugme, bekleme = 2000) {
  const sekmeSozu = s.waitForEvent('page', { timeout: bekleme + 3000 }).catch(() => null);
  await dugme.click();
  const sekme = await sekmeSozu;
  if (!sekme) return null;
  await sekme.waitForURL(/imzali=1/, { timeout: bekleme + 3000 }).catch(() => {});
  return sekme.url();
}

console.log('--- D1. Öğrenci: sekme imzalı adrese gidiyor ---');
{
  const { b, s, p } = await kur({ rol: 'ogrenci', yol: '/ogrenci/odev/a1' });
  const adres = await basVeSekmeyiBekle(s, p, p.getByRole('button', { name: 'Soruları aç (PDF)' }));
  if (adres !== IMZALI) bozuk(`sekme: ${adres}`);
  else tamam('yeni sekme açıldı ve imzalı adrese gitti');
  await p.waitForTimeout(300);
  const m = await metin(p);
  if (!m.includes('Açılmadıysa:') || (await p.getByRole('link', { name: 'Dosyayı aç' }).getAttribute('href')) !== IMZALI) {
    bozuk(`yedek bağlantı yok: ${m.slice(-300)}`);
  } else tamam('altta "Dosya yeni sekmede açıldı. Açılmadıysa: Dosyayı aç"');
  await b.close();
}

console.log('--- D2. Sekme engellenirse bağlantı ---');
{
  const { b, s, p } = await kur({ rol: 'ogrenci', yol: '/ogrenci/odev/a1', engel: true });
  await p.getByRole('button', { name: 'Soruları aç (PDF)' }).click();
  await p.waitForTimeout(600);
  const m = await metin(p);
  if (!m.includes('Dosya hazır. Açmak için dokunun:')) bozuk(`engel mesajı yok: ${m.slice(-300)}`);
  else tamam('"Dosya hazır. Açmak için dokunun: Dosyayı aç"');
  const adres = await basVeSekmeyiBekle(s, p, p.getByRole('link', { name: 'Dosyayı aç' }));
  if (adres !== IMZALI) bozuk(`bağlantı açmadı: ${adres}`);
  else tamam('bağlantıya dokununca imzalı adres açıldı');
  await b.close();
}

console.log('--- D3. Sunucu 4 sn gecikse de sekme açılıyor ---');
{
  const { b, s, p } = await kur({ rol: 'ogrenci', yol: '/ogrenci/odev/a1', gecikme: 4000 });
  const sekmeSozu = s.waitForEvent('page', { timeout: 1500 }).catch(() => null);
  await p.getByRole('button', { name: 'Soruları aç (PDF)' }).click();
  const sekme = await sekmeSozu;
  if (!sekme) bozuk('sekme dokunuş anında açılmadı');
  else {
    tamam('sekme dokunuş anında açıldı (adres henüz gelmeden)');
    await sekme.waitForURL(/imzali=1/, { timeout: 8000 }).catch(() => {});
    if (sekme.url() !== IMZALI) bozuk(`sonra yönlendirilmedi: ${sekme.url()}`);
    else tamam('4 sn sonra imzalı adrese yönlendirildi');
  }
  await b.close();
}

console.log('--- D4. 403: uyarı, boş sekme kapanıyor ---');
{
  const { b, s, p } = await kur({ rol: 'ogrenci', yol: '/ogrenci/odev/a1', durum: 403 });
  const sekmeSozu = s.waitForEvent('page', { timeout: 2000 }).catch(() => null);
  await p.getByRole('button', { name: 'Soruları aç (PDF)' }).click();
  const sekme = await sekmeSozu;
  await p.waitForTimeout(800);
  const m = await metin(p);
  if (!m.includes('Bu dosyaya erişim izniniz yok.')) bozuk(`uyarı yok: ${m.slice(-300)}`);
  else tamam('"Bu dosyaya erişim izniniz yok." uyarısı');
  if (sekme && !sekme.isClosed()) bozuk('boş sekme açık kaldı');
  else tamam('boş sekme kapandı');
  if (m.includes('Dosyayı aç')) bozuk('hata varken bağlantı gösterildi');
  await b.close();
}

console.log('--- D5. Öğretmen: Düzenle → Görüntüle ---');
{
  const { b, s, p } = await kur({ rol: 'ogretmen', yol: '/ogretmen/odevler/a1' });
  const adres = await basVeSekmeyiBekle(s, p, p.getByRole('button', { name: 'Ödev PDF’i (sorular) — dosyayı görüntüle' }));
  if (adres !== IMZALI) bozuk(`öğretmen sekmesi: ${adres}`);
  else tamam('"Görüntüle" sekmesi imzalı adrese gitti');
  await b.close();
}

console.log('');
if (hata) { console.log(`DOSYA AÇMA DENETİMİ BAŞARISIZ — ${hata} sapma`); process.exit(1); }
console.log('DOSYA AÇMA DENETİMİ GEÇTİ');
