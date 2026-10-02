/**
 * PUAN EKRANDA MI — DAR TELEFON VE BÜYÜK YAZI (Chromium, taklit RPC)
 *
 * Olay: bir veli Samsung telefonda çocuğunun puanını ancak SAĞA
 * KAYDIRINCA görebildiğini söyledi. Ölçüldü: Pano'daki "Son puanı"
 * kartında başlık tek satıra zorlanıyordu (`truncate`) ve kart bir
 * grid'in içindeydi; uzun ödev adı sayfayı 419 px'e açıyor, puan ekran
 * dışında kalıyordu — 412 px'lik telefonda bile.
 *
 * Samsung'un "ekran yakınlaştırma" ayarı CSS genişliğini 280–320 px'e
 * indirebiliyor, büyük yazı ayarı da yazıyı büyütüyor. O yüzden dört
 * genişlik × iki yazı ölçeği ölçülüyor:
 *
 *  P1. Hiçbir ekranda yatay taşma yok (scrollWidth = genişlik).
 *  P2. Puanın sayısı ekranın İÇİNDE (sağ kenarı genişliği aşmıyor):
 *      veli Pano, veli Ödevler, öğrenci Pano.
 *
 * Ödev adı bilerek UZUN: olayın kendisi uzun bir addı.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/puan-gorunurluk-denetimi.mjs
 */
let hata = 0;
const tamam = (m) => console.log(`  ✓ ${m}`);
const bozuk = (m) => { hata++; console.log(`  ✗ ${m}`); };

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const KOK = 'http://127.0.0.1:8788/yeni/';

const gun = (d) => { const t = new Date(); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10); };
const BASLIK = '9. Sınıf Üslü ve Köklü İfadeler Deneme Testi Birinci Dönem';
const konular = ['Köklü İfadeler ve Üslü Sayılarda Sadeleştirme', 'Mutlak Değer'].map((k) => ({ konu: k, toplam: 10, dogru: 6, yanlis: 3, bos: 1 }));
const PANEL = {
  ogrenci: { ad: 'Duru Dilara Aygün', sinif: '9C', tur: 'okul' }, okunmamis_mesaj: 1, genel_ortalama: 72.3,
  mesajlar: [], odemeler: [], son_gorulme: null,
  odevler: [{ baslik: BASLIK, son_tarih: gun(-2), olusturma: gun(-10), gonderildi: true,
    gonderim_zamani: gun(-3) + 'T10:00:00Z', puan: 87, durum: 'puanlandi', konu_analizi: konular,
    kiyas: { durum: 'hazir', sinif: { ad: '9C', ortalama: 64.5 }, seviye: { ad: '9. sınıflar', ortalama: 61.2 } },
    yanlis_sorular: [2, 5, 7, 11, 13, 17, 19, 23, 29, 31], bos_sorular: [3, 8, 9, 12, 33, 44] }],
};
const OGRENCI = {
  ogrenci: { id: 'o1', ad: 'Duru Dilara Aygün', sinif: '9C', tur: 'okul' }, dersler: [], okunmamis_mesaj: 0,
  odevler: [{ id: 'a1', baslik: BASLIK, aciklama: null, tur: 'test', son_tarih: gun(-2), soru_sayisi: 10,
    gec_teslim: false, sik_sayisi: 5, sinif_arsiv: false, odev_yolu: null, konu_analizi: [],
    cevap_anahtari: null, anahtar_yolu: null,
    gonderim: { id: 'g1', puan: 87, dogru: 9, yanlis: 1, bos: 0, durum: 'puanlandi', zaman: gun(-3) } }],
};

async function ac(rol, yol, en, olcek) {
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: en, height: 800 }, isMobile: true, hasTouch: true });
  await s.addInitScript(({ rol, PANEL, OGRENCI, olcek }) => {
    localStorage.setItem('sekiz_oturum', JSON.stringify({ rol, token: 't'.repeat(64),
      ogrenci: { id: 'o1', ad: 'Duru Dilara Aygün', tur: 'okul', sinif: '9C' } }));
    // Büyük yazı ayarının taklidi: kök yazı boyutu büyüyor.
    if (olcek !== 1) {
      document.addEventListener('DOMContentLoaded', () => {
        const st = document.createElement('style');
        st.textContent = `html{font-size:${olcek * 100}%}`;
        document.head.appendChild(st);
      });
    }
    const asil = window.fetch;
    const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
    window.fetch = async (u, o) => {
      const m = String(typeof u === 'string' ? u : u.url).match(/\/rpc\/([a-z_]+)/);
      if (!m) return asil(u, o);
      if (m[1] === 'veli_paneli') return json(PANEL);
      if (m[1] === 'ogrenci_odevleri') return json(OGRENCI);
      if (m[1] === 'ewalu_mesajlari') return json([]);
      if (m[1] === 'kendi_karnem') return json({ kapsam: { ad: 'Duru', sinif: '9C' }, odev_sayisi: 1, genel_ortalama: 87, konular: [], gelisim: [] });
      return json({});
    };
  }, { rol, PANEL, OGRENCI, olcek });
  const p = await s.newPage();
  p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
  await p.goto(KOK + '#' + yol, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => {
    const W = document.documentElement.clientWidth;
    // Puanın SAYISI: içinde yalnız "87" olan öğe.
    const sayi = [...document.querySelectorAll('main *')].find((e) => e.children.length === 0 && e.textContent.trim() === '87');
    return { W, sw: document.documentElement.scrollWidth, sag: sayi ? sayi.getBoundingClientRect().right : null };
  });
  await b.close();
  return r;
}

const EKRANLAR = [
  ['veli', '/veli', 'veli Pano', true],
  ['veli', '/veli/odevler', 'veli Ödevler', true],
  ['veli', '/veli/konular', 'veli Konular', false],
  ['ogrenci', '/ogrenci', 'öğrenci Pano', true],
];

for (const en of [280, 320, 360, 412]) {
  for (const olcek of [1, 1.3]) {
    console.log(`--- ${en} px, yazı ×${olcek} ---`);
    for (const [rol, yol, ad, puanVar] of EKRANLAR) {
      const r = await ac(rol, yol, en, olcek);
      if (r.sw > r.W) bozuk(`${ad}: yatay taşma ${r.sw} px > ${r.W} px`);
      else if (puanVar && r.sag === null) bozuk(`${ad}: puan (87) bulunamadı`);
      else if (puanVar && r.sag > r.W) bozuk(`${ad}: puan ekran dışında (sağ ${Math.round(r.sag)} > ${r.W})`);
      else tamam(`${ad}: taşma yok${puanVar ? `, puan ekranda (sağ ${Math.round(r.sag)})` : ''}`);
    }
  }
}

console.log('');
if (hata) { console.log(`PUAN GÖRÜNÜRLÜK DENETİMİ BAŞARISIZ — ${hata} sapma`); process.exit(1); }
console.log('PUAN GÖRÜNÜRLÜK DENETİMİ GEÇTİ');
