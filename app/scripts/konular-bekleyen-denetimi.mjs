/**
 * "KONULAR" SAYFASINDA SÜRESİ DOLMAMIŞ GÖNDERİLMİŞ ÖDEV (Chromium, taklit RPC)
 *
 * Olay: bir veli çocuğunun eksik konularının görünmediğini yazdı. Ödev
 * gönderildiği anda konu dökümü ÖDEVLER bölümünde vardı; Konular sayfası
 * ise yalnız süresi dolmuş ödevleri sayıp "Henüz değerlendirilmiş ödev yok"
 * diyordu.
 *
 *  K1. Veli, değerlendirilmiş 0 + gönderilmiş/süresi dolmamış 1:
 *      açıklama var, eski cümle YOK, "Ödevlere git" → /veli/odevler.
 *  K2. Öğrenci aynı durumda: açıklama + "Ödevlerime git" → /ogrenci/odevler.
 *  K3. Gönderilmiş ama süresi dolmuş, ya da gönderilmemiş: açıklama yok.
 *  K4. Değerlendirilmiş 2 + bekleyen 1: özet cümle durur, altında ek kart.
 *  K5. Ek uç hata verirse sayfa bugünkü gibi (eski cümle, açıklama yok).
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/konular-bekleyen-denetimi.mjs
 */
let hata = 0;
const tamam = (m) => console.log(`  ✓ ${m}`);
const bozuk = (m) => { hata++; console.log(`  ✗ ${m}`); };

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const KOK = 'http://127.0.0.1:8788/yeni/';

const gun = (d) => {
  const t = new Date();
  t.setDate(t.getDate() + d);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};
const KARNE = (n) => ({
  kapsam: { ad: 'Ada Yıldırım', sinif: '9C' }, odev_sayisi: n, genel_ortalama: n ? 80 : null,
  konular: n ? [{ konu: 'Köklü İfadeler', toplam: 10, dogru: 9, yanlis: 1, bos: 0 }] : [],
  gelisim: [],
});
const veliOdevi = (sonTarih, gonderildi) => ({
  baslik: 'Üslü ve köklü', son_tarih: sonTarih, olusturma: gun(-10), gonderildi,
  gonderim_zamani: gonderildi ? gun(-1) + 'T10:00:00Z' : null, puan: gonderildi ? 90 : null,
  durum: gonderildi ? 'puanlandi' : null, konu_analizi: [], kiyas: null, yanlis_sorular: [], bos_sorular: [],
});
const ogrenciOdevi = (sonTarih, gonderildi) => ({
  id: 'a1', baslik: 'Üslü ve köklü', aciklama: null, tur: 'test', son_tarih: sonTarih, soru_sayisi: 10,
  gec_teslim: true, sik_sayisi: 5, sinif_arsiv: false, odev_yolu: null,
  gonderim: gonderildi ? { id: 'g1', puan: 90, dogru: 9, yanlis: 1, bos: 0, durum: 'puanlandi', zaman: gun(-1) } : null,
  konu_analizi: [], cevap_anahtari: null, anahtar_yolu: null,
});

async function kur({ rol, karne, odevler, ucHatali = false }) {
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: 390, height: 900 } });
  await s.addInitScript(({ rol, karne, odevler, ucHatali }) => {
    localStorage.setItem('sekiz_oturum', JSON.stringify({ rol, token: 't'.repeat(64),
      ogrenci: { id: 'o1', ad: 'Ada Yıldırım', tur: 'okul', sinif: '9C' } }));
    const asil = window.fetch;
    const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
    window.fetch = async (u, o) => {
      const url = String(typeof u === 'string' ? u : u.url);
      const m = url.match(/\/rpc\/([a-z_]+)/);
      if (!m) return asil(u, o);
      switch (m[1]) {
        case 'kendi_karnem': return json(karne);
        case 'veli_paneli':
          if (ucHatali) return json({ code: 'XX000', message: 'hata' }, 500);
          return json({ ogrenci: { ad: 'Ada Yıldırım', sinif: '9C', tur: 'okul' }, okunmamis_mesaj: 0,
            genel_ortalama: null, odevler, mesajlar: [], odemeler: [], son_gorulme: null });
        case 'ogrenci_odevleri':
          if (ucHatali) return json({ code: 'XX000', message: 'hata' }, 500);
          return json({ ogrenci: { id: 'o1', ad: 'Ada Yıldırım', sinif: '9C', tur: 'okul' },
            odevler, dersler: [], okunmamis_mesaj: 0 });
        case 'ewalu_mesajlari': return json([]);
        default: return json({});
      }
    };
  }, { rol, karne, odevler, ucHatali });
  const p = await s.newPage();
  p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
  await p.goto(KOK + '#' + (rol === 'veli' ? '/veli/konular' : '/ogrenci/konularim'), { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  return { b, p };
}
const metin = (p) => p.evaluate(() => document.querySelector('main')?.innerText ?? document.body.innerText);
const ESKI = /Henüz değerlendirilmiş ödev(in)? yok/;

console.log('--- K1. Veli: değerlendirilmiş 0, bekleyen 1 ---');
{
  const { b, p } = await kur({ rol: 'veli', karne: KARNE(0), odevler: [veliOdevi(gun(3), true)] });
  const m = await metin(p);
  if (!m.includes('1 ödev gönderildi, teslim süresi henüz dolmadı. O ödevin eksik konularını Ödevler bölümünde görebilirsiniz')) bozuk(`açıklama yok: ${m.slice(0, 300)}`);
  else tamam('"1 ödev gönderildi, teslim süresi henüz dolmadı…"');
  if (ESKI.test(m)) bozuk('yanıltıcı eski cümle hâlâ var');
  else tamam('"Henüz değerlendirilmiş ödev yok" yok');
  await p.getByRole('link', { name: 'Ödevlere git' }).click();
  await p.waitForTimeout(300);
  if (!p.url().endsWith('#/veli/odevler')) bozuk(`bağlantı: ${p.url()}`);
  else tamam('"Ödevlere git" → /veli/odevler');
  await b.close();
}

console.log('--- K2. Öğrenci: değerlendirilmiş 0, bekleyen 1 ---');
{
  const { b, p } = await kur({ rol: 'ogrenci', karne: KARNE(0), odevler: [ogrenciOdevi(gun(0), true)] });
  const m = await metin(p);
  if (!m.includes('Gönderdiğin 1 ödevin teslim süresi henüz dolmadı')) bozuk(`açıklama yok: ${m.slice(0, 300)}`);
  else tamam('"Gönderdiğin 1 ödevin teslim süresi henüz dolmadı…" (bugün son gün de bekliyor)');
  if (ESKI.test(m)) bozuk('eski cümle var');
  await p.getByRole('link', { name: 'Ödevlerime git' }).click();
  await p.waitForTimeout(300);
  if (!p.url().endsWith('#/ogrenci/odevler')) bozuk(`bağlantı: ${p.url()}`);
  else tamam('"Ödevlerime git" → /ogrenci/odevler');
  await b.close();
}

console.log('--- K3. Süresi dolmuş ya da gönderilmemiş: açıklama yok ---');
for (const [ad, rol, odevler] of [
  ['veli, süresi dolmuş', 'veli', [veliOdevi(gun(-1), true)]],
  ['veli, gönderilmemiş', 'veli', [veliOdevi(gun(3), false)]],
  ['öğrenci, gönderilmemiş', 'ogrenci', [ogrenciOdevi(gun(3), false)]],
]) {
  const { b, p } = await kur({ rol, karne: KARNE(0), odevler });
  const m = await metin(p);
  if (/teslim süresi henüz dolmadı/.test(m) || !ESKI.test(m)) bozuk(`${ad}: ${m.slice(0, 200)}`);
  else tamam(`${ad}: açıklama yok, bugünkü cümle`);
  await b.close();
}

console.log('--- K4. Değerlendirilmiş 2 + bekleyen 1: özet durur, ek kart ---');
{
  const { b, p } = await kur({ rol: 'veli', karne: KARNE(2), odevler: [veliOdevi(gun(-3), true), veliOdevi(gun(4), true)] });
  const m = await metin(p);
  if (!/En çok Köklü İfadeler konusunda takılmış/.test(m) || !m.includes('1 ödev gönderildi, teslim süresi henüz dolmadı')) {
    bozuk(`özet ya da ek kart eksik: ${m.slice(0, 300)}`);
  } else tamam('özet cümle + "1 ödev gönderildi…" ek kartı');
  await b.close();
}

console.log('--- K5. Ek uç hata verirse sayfa bugünkü gibi ---');
for (const rol of ['veli', 'ogrenci']) {
  const { b, p } = await kur({ rol, karne: KARNE(0), odevler: [], ucHatali: true });
  const m = await metin(p);
  if (!ESKI.test(m) || /teslim süresi henüz dolmadı/.test(m)) bozuk(`${rol}: ${m.slice(0, 200)}`);
  else tamam(`${rol}: uç hatasında sayfa bozulmadı`);
  await b.close();
}

console.log('');
if (hata) { console.log(`KONULAR BEKLEYEN DENETİMİ BAŞARISIZ — ${hata} sapma`); process.exit(1); }
console.log('KONULAR BEKLEYEN DENETİMİ GEÇTİ');
