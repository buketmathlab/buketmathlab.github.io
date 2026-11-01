/**
 * 0089 — ÖDEV SİLME İZİ VE YEDEĞİN EKSİKSİZLİĞİ (Chromium, taklit RPC)
 *
 * Öğretmenin bildirimi: "Öğrenciler daha önceden gönderdikleri ödevleri
 * gönderilmemiş olarak görüyorlar. Göndermişler, hatta puanlandırılmış."
 *
 * ASIL ÖLÇÜM İKİ TANE:
 *
 *  S1. Gönderimi olan ödev SEBEPSİZ silinemiyor. Sunucu da reddediyor
 *      (22023) ama ekran basmadan önce söylüyor; ÖNEMLİSİ: sebep boşken
 *      ağa TEK BİR `odev_sil` çağrısı bile gitmiyor. Başkasının notunu
 *      silen bir işlemde "düğmeye basıldı ama bir şey olmadı" yetmez.
 *  S2. Pencere artık "geri alınamaz" DEMİYOR. 0089'dan beri her gönderim
 *      tam satırıyla denetim izine yazılıyor ve geri getirilebiliyor;
 *      eski cümle bugün YANLIŞ bir kesinlik söylüyordu.
 *  S3. Sebep yazılınca çağrı `p_neden` ile gidiyor ve sonuç kaç
 *      gönderimin ize yazıldığını söylüyor.
 *  S4. Gönderimi OLMAYAN ödevde sebep SORULMUYOR (öğretmeni boşuna
 *      yavaşlatmamak) ve `p_neden` null gidiyor.
 *  S5. Yedek kartı denetim izinin kaç satır alındığını söylüyor;
 *      KESİLDİYSE uyarı rengiyle söylüyor. Sessizce eksik yedek vermek,
 *      öğretmene elinde tam bir kopya olduğunu sandırırdı.
 *  S6. 0089 çalıştırılmamış sunucuda (alan hiç gelmez) kart "0 satır"
 *      demiyor, "bu yedekte YOK" diyor — ikisi aynı şey değil.
 *
 * KUSUR PROVALARI (0089). Dördü de yeniden derlenerek ölçüldü:
 *   U1. `silmeSebebiHatasi` hep null döndü → S1 düştü (sebepsiz çağrı
 *       ağa gitti).
 *   U2. `p_neden` çağrıdan çıkarıldı → S3 düştü.
 *   U3. `silmeUyarisi`ya "Bu işlem geri alınamaz." geri kondu → S2 düştü.
 *   U4. `yedekIzNotu` sayıları ve kesilme uyarısını kaybetti → S5/S6'nın
 *       üç iddiası da düştü.
 *
 * KOŞUM TAKIMI DERSİ: U4'ün ilk iki yazımı DERLEMEYİ BOZDU (tip hatası) ve
 * denetim eski paketi ölçtü — "ısırdı" sanılan sonuç aslında U3'ün
 * sonucuydu. Prova artık ancak `npm run build` "built in" dedikten sonra
 * koşturuluyor. Derlemeden geçmeyen bir yama prova değildir.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/silme-izi-denetimi.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/';

let hata = 0;
const de = (ok, m, ek = '') => {
  if (!ok) { hata++; console.log(`  ✗ ${m}${ek ? ` :: ${ek}` : ''}`); }
  else console.log(`  ✓ ${m}`);
};

const gun = (d) => {
  const t = new Date();
  t.setDate(t.getDate() + d);
  return t.toISOString().slice(0, 10);
};

const odev = (id, baslik, gonderim) => ({
  id, baslik, aciklama: null, tur: 'test', sinif_id: 's1', sinif: '9A', sinif_ozel: false,
  son_tarih: gun(3), soru_sayisi: 10, gec_teslim: true, sik_sayisi: 5, yayinda: true,
  olusturma: '2026-09-01T10:00:00Z', kardesler: null, odev_pdf_var: false,
  anahtar_pdf_var: false, gonderim_sayisi: gonderim, gec_gonderim_sayisi: 0,
  sinif_mevcudu: 24, ortalama_yapan: null, ortalama_tum: null,
});

/** Her ölçüm TEK ödevle koşuyor: "Sil" düğmesi tekil olsun, seçici
 *  karmaşıklaşmasın. Satırdaki düğme `.first()`, penceredeki `.last()`. */
const DOLU = [odev('d1', 'Dörtgenler', 24)];
const BOS = [odev('d2', 'Taslak ödev', 0)];

/** @param {{yedek?: object, odevler?: object[]}} a */
async function kur(a = {}) {
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: 390, height: 900 } });
  await s.addInitScript(([odevler, yedek]) => {
    localStorage.setItem('sekiz_oturum', JSON.stringify({
      rol: 'ogretmen', token: 't'.repeat(64), ad: 'Buket Topuzoğlu', yonetici: true,
    }));
    window.__c = [];
    const asil = window.fetch;
    const json = (o) => new Response(JSON.stringify(o), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
    window.fetch = async (u, o) => {
      const url = String(typeof u === 'string' ? u : u.url);
      const m = url.match(/\/rpc\/([a-z_]+)/);
      if (!m) return asil(u, o);
      let g = null;
      try { g = JSON.parse(String(o?.body ?? 'null')); } catch { /* ikili */ }
      window.__c.push({ ad: m[1], g });
      switch (m[1]) {
        case 'odevler_listesi': return json(odevler);
        case 'siniflar_listesi':
          return json([{ id: 's1', ad: '9A', seviye: 9, sube: 'A', ozel: false,
                         arsiv: false, ogrenci_sayisi: 24 }]);
        case 'odev_sil': return json({ durum: 'tamam', silinen_gonderim: 24 });
        // Yedek kartı yalnız platform SAHİBİne çiziliyor (Ayarlar.tsx);
        // bayrak bu uçtan geliyor, oturum nesnesinden değil.
        case 'ben_kimim':
          return json({ id: 't1', ad: 'Buket Topuzoğlu', sahip: true,
                        vekalet: false, vekil: null });
        case 'disa_aktar': return json(yedek);
        default: return json({});
      }
    };
  }, [a.odevler ?? DOLU, a.yedek ?? null]);
  const p = await s.newPage();
  p.on('pageerror', (e) => de(false, 'sayfa hatası yok', e.message));
  return { b, p, s };
}

const metin = (p) => p.evaluate(() => document.body.innerText);
const cagri = async (p, ad) => (await p.evaluate(() => window.__c)).filter((c) => c.ad === ad);

/** Silme penceresini açar. */
async function silmeyiAc(p, baslik) {
  await p.goto(KOK + '#/ogretmen/odevler', { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  if (!(await metin(p)).includes(baslik)) throw new Error(`liste çizilmedi: ${baslik}`);
  await p.getByRole('button', { name: /^Sil$/ }).first().click();
  await p.waitForTimeout(400);
}

// ============================================================================
console.log('--- S1/S2. Gönderimli ödev: sebep zorunlu, "geri alınamaz" yok ---');
// ============================================================================
{
  const { b, p } = await kur();
  await silmeyiAc(p, 'Dörtgenler');
  const t = await metin(p);

  de(/24 gönderim/.test(t), 'pencere kaç gönderimin silineceğini söylüyor');
  de(/denetim izine/.test(t), 'gönderimlerin ize yazılacağı yazılı');
  // 0089: eski cümle bugün YANLIŞ bir kesinlik söylüyordu.
  de(!/geri alınamaz/.test(t), '"geri alınamaz" cümlesi YOK (0089)');

  const alan = p.getByLabel(/Neden siliyorsunuz/);
  de((await alan.count()) === 1, 'sebep alanı var');

  // ASIL KAPI: sebep boşken ağa TEK BİR çağRI bile gitmemeli.
  await p.getByRole('button', { name: /^Sil$/ }).last().click();
  await p.waitForTimeout(400);
  de((await cagri(p, 'odev_sil')).length === 0,
     'SEBEP BOŞKEN odev_sil ÇAĞRILMIYOR');
  de(/neden sildiğinizi yazın/i.test(await metin(p)), 'eksik sebep ekranda söyleniyor');
  await b.close();
}

// ============================================================================
console.log('\n--- S3. Sebep yazılınca çağrı `p_neden` ile gidiyor ---');
// ============================================================================
{
  const { b, p } = await kur();
  await silmeyiAc(p, 'Dörtgenler');
  await p.getByLabel(/Neden siliyorsunuz/).fill('Yanlış sınıfa verilmiş');
  await p.getByRole('button', { name: /^Sil$/ }).last().click();
  await p.waitForTimeout(700);

  const c = await cagri(p, 'odev_sil');
  de(c.length === 1, 'tam bir odev_sil çağrısı');
  de(c[0]?.g?.p_neden === 'Yanlış sınıfa verilmiş', '`p_neden` ağa gidiyor',
     JSON.stringify(c[0]?.g));
  de(/24 gönderim denetim izine yazıldı/.test(await metin(p)),
     'sonuç kaç gönderimin ize yazıldığını söylüyor');
  await b.close();
}

// ============================================================================
console.log('\n--- S4. Gönderimsiz ödevde sebep SORULMUYOR ---');
// ============================================================================
{
  const { b, p } = await kur({ odevler: BOS });
  await silmeyiAc(p, 'Taslak ödev');
  const t = await metin(p);
  de(/Henüz gönderim yok/.test(t), 'gönderim olmadığı yazılı');
  de((await p.getByLabel(/Neden siliyorsunuz/).count()) === 0,
     'sebep alanı ÇIKMIYOR — öğretmen boşuna yavaşlatılmıyor');
  await p.getByRole('button', { name: /^Sil$/ }).last().click();
  await p.waitForTimeout(700);
  const c = await cagri(p, 'odev_sil');
  de(c.length === 1 && c[0]?.g?.p_neden === null,
     'sebepsiz silme geçiyor, `p_neden: null` gidiyor', JSON.stringify(c[0]?.g));
  await b.close();
}

// ============================================================================
console.log('\n--- S5/S6. Yedek kartı denetim izini SÖYLÜYOR ---');
// ============================================================================
const yedekTemel = {
  alindi: '2026-11-01T10:00:00Z',
  siniflar: [], ogrenciler: [], giris_kodlari: [], odevler: [],
  gonderimler: [], mesajlar: [], dersler: [], odemeler: [],
};

for (const [ad, yedek, bekle, beklemE] of [
  ['tam alınmış',
    { ...yedekTemel, denetim_izi: [1, 2, 3], denetim_izi_toplam: 3, denetim_izi_kesildi: false },
    'Denetim izi tam alındı: 3 satır', /EN YENİ|YOK/],
  ['KESİLMİŞ',
    { ...yedekTemel, denetim_izi: [1], denetim_izi_toplam: 90000, denetim_izi_kesildi: true },
    '90000', /tam alındı/],
  ['0089 YOK (eski sunucu)', { ...yedekTemel }, 'bu yedekte YOK', /tam alındı|EN YENİ/],
]) {
  const { b, p } = await kur({ yedek });
  await p.goto(KOK + '#/ogretmen/ayarlar', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  await p.getByRole('button', { name: /Yedeği indir/ }).click();
  await p.waitForTimeout(800);
  const t = await metin(p);
  de(t.includes(bekle), `${ad}: "${bekle}" yazılı`, t.slice(-240));
  de(!beklemE.test(t), `${ad}: öbür durumun cümlesi YOK`);
  await b.close();
}

// ============================================================================
console.log('\n--- S7. 360 px: yatay taşma yok ---');
// ============================================================================
{
  const { b, p } = await kur();
  await p.setViewportSize({ width: 360, height: 780 });
  await silmeyiAc(p, 'Dörtgenler');
  const tasma = await p.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  de(tasma === 0, `yatay taşma 0 px (ölçülen ${tasma})`);
  await b.close();
}

console.log(
  hata === 0
    ? '\nSİLME İZİ DENETİMİ GEÇTİ — kusur yok'
    : `\nSİLME İZİ DENETİMİ KIRILDI — ${hata} kusur`,
);
process.exit(hata === 0 ? 0 : 1);
