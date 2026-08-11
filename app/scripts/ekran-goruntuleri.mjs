import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const PANO = { ogrenci_sayisi: 137, acik_odev: 4, bekleyen_degerlendirme: 6, gecikmis_eksik: 11,
  son_gonderimler: [
    { ogrenci:'Elif Yıldırım', odev:'Türev testi — sayfa 84', puan:92, zaman:'2026-08-11T09:12:00Z' },
    { ogrenci:'Mert Çağlar',   odev:'Türev testi — sayfa 84', puan:76, zaman:'2026-08-11T08:40:00Z' },
    { ogrenci:'Zeynep Şahin',  odev:'Limit — açık uçlu',      puan:null, zaman:'2026-08-10T19:05:00Z' }]};
const SINIFLAR = [9,10,11,12].flatMap(s=>['A','B','C'].map((h,i)=>({
  id:`${s}${h}`, ad:`${s}${h}`, seviye:s, sube:h, arsiv:false, ogrenci_sayisi:8+((s+i*3)%14)})));
const ADLAR=['Elif Yıldırım','Mert Çağlar','Zeynep Şahin','Ahmet Öztürk','Buğra Kılıç','Ceren Aydın','Deniz Şen','Ece Güneş'];
const OGRENCILER = { toplam:137, sayfa:1, toplam_sayfa:6,
  kayitlar: ADLAR.map((ad,i)=>({ id:'o'+i, ad, tur: i===7?'ozel':'okul', sinif: i===7?null:SINIFLAR[i%12].ad }))};

const CEVAP = { ogretmen_panosu:PANO, siniflar_listesi:SINIFLAR, ogrenciler_listesi:OGRENCILER,
  giris:{rol:'ogretmen',token:'t'.repeat(64)} };

const b = await chromium.launch();
async function cek(ad, genislik, yol, oturumVar) {
  const p = await b.newPage({ viewport:{width:genislik,height:900}, deviceScaleFactor:2 });
  await p.route('**/rest/v1/rpc/*', async (route) => {
    const fn = route.request().url().split('/').pop().split('?')[0];
    await route.fulfill({ status:200, contentType:'application/json',
      body: JSON.stringify(CEVAP[fn] ?? {}) });
  });
  if (oturumVar) await p.addInitScript(() => localStorage.setItem('sekiz_oturum',
    JSON.stringify({rol:'ogretmen',token:'t'.repeat(64)})));
  await p.goto('http://127.0.0.1:8788/yeni/#'+yol, { waitUntil:'networkidle' });
  await p.waitForTimeout(1400);
  const tasma = await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  await p.screenshot({ path:`/tmp/f2-${ad}.png`, fullPage:true });
  console.log(`${ad.padEnd(22)} ${String(genislik).padStart(4)}px  tasma=${tasma}px`);
  await p.close();
}
await cek('giris-360',        360, '/', false);
await cek('pano-360',         360, '/ogretmen', true);
await cek('siniflar-360',     360, '/ogretmen/siniflar', true);
await cek('ogrenciler-360',   360, '/ogretmen/ogrenciler', true);
await cek('pano-1280',       1280, '/ogretmen', true);
await cek('ogrenciler-1280', 1280, '/ogretmen/ogrenciler', true);
await b.close();
