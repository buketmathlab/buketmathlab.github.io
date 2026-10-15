/**
 * 0078 — ÖDEVİN HER SAYFASI ZORUNLU: GÖVDE FARKI + TARAYICIDA UÇTAN UCA
 *
 * A. GÖVDE FARKI (tarayıcısız). 0078 yedi fonksiyonu yeniden tanımlıyor.
 *    Her gövde, kaynağındaki (en son tanım) gövdeye AŞAĞIDAKİ DEĞİŞİMLER
 *    uygulanarak yeniden üretiliyor ve depodakiyle birebir karşılaştırılıyor.
 *    Liste aynı zamanda 0078'in "neyi değiştirdi" belgesi. Kaynakla 0078
 *    arasında aynı fonksiyonu tanımlayan başka migration olmadığı da ölçülüyor.
 *
 * B. ARAYÜZ (Chromium, taklit RPC).
 *    Z1. Öğretmen soru PDF'i seçince sayfa sayısı OTOMATİK geliyor
 *        ("Soru PDF'i 4 sayfa; sayı oradan geldi"), düzeltilebiliyor ve ağa
 *        düzeltilen değer gidiyor.
 *    Z2. Öğrenci, her sayfası zorunlu ödev, 360 px: gerekçe, sayaç ve
 *        açıklama görünüyor; yatay taşma yok; "birleştir/tek görsel" yok.
 *    Z3. Öğrenci 2/2 sayfayla gönderiyor: odev_gonder 1 + 1 ek sayfa.
 *    Z4. Öğrenci 1/2 sayfayla gönderemiyor: çağrı yok, eksik uyarısı var.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/sayfa-zorunlu-denetimi.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIG = resolve(dirname(fileURLToPath(import.meta.url)), '../../supabase/migrations');
let hata = 0;
const tamam = (m) => console.log(`    ${m}: OK`);
const bozuk = (m) => { console.log(`    HATA: ${m}`); hata++; };

/** fonksiyon → [kaynak migration, kaynaktaki ad]. */
const KAYNAK = {
  "_cozum_yolu_gecerli": [
    "0054_sayfa_siniri.sql",
    "_cozum_yolu_gecerli"
  ],
  "odev_olustur": [
    "0054_sayfa_siniri.sql",
    "odev_olustur"
  ],
  "odev_gonder": [
    "0074_deneme_duzeyleri.sql",
    "odev_gonder"
  ],
  "odev_guncelle": [
    "0055_yonetici_odevi_ve_duzeltme.sql",
    "odev_guncelle"
  ],
  "odev_kardeslere_yay": [
    "0055_yonetici_odevi_ve_duzeltme.sql",
    "odev_kardeslere_yay"
  ],
  "odev_detay": [
    "0073_deneme_hesabi.sql",
    "odev_detay"
  ],
  "odev_sayfa_kurali": [
    "0054_sayfa_siniri.sql",
    "odev_sayfa_siniri"
  ]
};

/** 0078'in kaynak gövdelere uyguladığı değişimlerin TAMAMI. */
const DEGISIMLER = [
  {
    "fn": "_cozum_yolu_gecerli",
    "eski": "(?:-([2-8]))?",
    "yeni": "(?:-([2-9]|[1-3][0-9]|40))?",
    "adet": 1
  },
  {
    "fn": "_cozum_yolu_gecerli",
    "eski": "  --       ya: cozum/<uuid>/<uuid>-<2..8>.<uzanti>   (ek sayfa — 0054)",
    "yeni": "  --       ya: cozum/<uuid>/<uuid>-<2..40>.<uzanti>  (ek sayfa — 0054; 0078: 40'a kadar)",
    "adet": 1
  },
  {
    "fn": "odev_olustur",
    "eski": "  if coalesce(p_sayfa_limiti, 1) not between 1 and 8 then\n    raise exception 'Sayfa sınırı 1 ile 8 arasında olmalı.' using errcode = '22023';",
    "yeni": "  -- 0078: 1–40 (ödevin sayfa sayısı).\n  if coalesce(p_sayfa_limiti, 1) not between 1 and 40 then\n    raise exception 'Sayfa sayısı 1 ile 40 arasında olmalı.' using errcode = '22023';",
    "adet": 1
  },
  {
    "fn": "odev_olustur",
    "eski": "     ogretmen_id, sayfa_limiti)",
    "yeni": "     ogretmen_id, sayfa_limiti, tum_sayfalar)",
    "adet": 1
  },
  {
    "fn": "odev_olustur",
    "eski": "     coalesce(p_sayfa_limiti, 1))\n  returning id into yeni_id;",
    "yeni": "     coalesce(p_sayfa_limiti, 1),\n     -- 0078: YENİ ÖDEVDE HER SAYFA ZORUNLU. Öğrenci tam sayfa_limiti kadar\n     -- sayfa gönderir; eksik de fazla da kabul edilmez (odev_gonder).\n     true)\n  returning id into yeni_id;",
    "adet": 1
  },
  {
    "fn": "odev_gonder",
    "eski": "  if 1 + v_ek_sayi > d.sayfa_limiti then\n    raise exception 'Bu ödevde en fazla % sayfa gönderilebilir. Fazla sayfaları çıkarıp tekrar deneyin.',\n      d.sayfa_limiti using errcode = '22023';\n  end if;\n",
    "yeni": "  if 1 + v_ek_sayi > d.sayfa_limiti then\n    raise exception 'Bu ödevde en fazla % sayfa gönderilebilir. Fazla sayfaları çıkarıp tekrar deneyin.',\n      d.sayfa_limiti using errcode = '22023';\n  end if;\n\n  -- 0078: HER SAYFA ZORUNLU (yeni ödevler). Öğretmenin isteği: \"ödev kaç\n  -- sayfaysa öğrenci o kadar sayfa göndersin; her sayfayı göndermek\n  -- zorunda\". Eski ödevlerde (`tum_sayfalar` false) kural değişmedi: en az\n  -- 1, en fazla sayfa_limiti.\n  if d.tum_sayfalar and 1 + v_ek_sayi < d.sayfa_limiti then\n    raise exception 'Bu ödev % sayfa; her sayfanın çözümünü eklemelisin (% sayfa eksik).',\n      d.sayfa_limiti, d.sayfa_limiti - 1 - v_ek_sayi using errcode = '22023';\n  end if;\n",
    "adet": 1
  },
  {
    "fn": "odev_guncelle",
    "eski": "  if p_sayfa_limiti is not null and p_sayfa_limiti not between 1 and 8 then\n    raise exception 'Sayfa sınırı 1 ile 8 arasında olmalı.' using errcode = '22023';\n  end if;",
    "yeni": "  if p_sayfa_limiti is not null and p_sayfa_limiti not between 1 and 40 then\n    raise exception 'Sayfa sayısı 1 ile 40 arasında olmalı.' using errcode = '22023';\n  end if;\n  -- 0078: HER SAYFASI ZORUNLU ödevde gönderim başladıktan sonra sayfa\n  -- sayısı değişmez. Değişseydi öğrencilerin bir kısmı 6, bir kısmı 8 sayfa\n  -- göndermiş olurdu — aynı ödevde iki farklı kural.\n  if d.tum_sayfalar and p_sayfa_limiti is not null and p_sayfa_limiti <> d.sayfa_limiti\n     and exists (select 1 from public.gonderimler g0 where g0.odev_id = p_id) then\n    raise exception 'Bu ödeve gönderim yapıldı; sayfa sayısı artık değiştirilemez.'\n      using errcode = '22023';\n  end if;",
    "adet": 1
  },
  {
    "fn": "odev_kardeslere_yay",
    "eski": "           sayfa_limiti   = d.sayfa_limiti,",
    "yeni": "           sayfa_limiti   = d.sayfa_limiti,\n           -- 0078: \"her sayfa zorunlu\" bayrağı da içerik. AMA kardeşte\n           -- gönderim varsa ve bayraklardan biri açıksa sayfa kuralı o\n           -- kardeşte KORUNUYOR: gönderen öğrencilerle gönderecekler aynı\n           -- kurala tabi kalsın (odev_guncelle'deki kilidin aynısı).\n           tum_sayfalar   = d.tum_sayfalar,",
    "adet": 1
  },
  {
    "fn": "odev_kardeslere_yay",
    "eski": "     where id = k.id;\n\n    perform public._denetim('kardeslere_yayildi'",
    "yeni": "     where id = k.id;\n\n    if (eski.tum_sayfalar or d.tum_sayfalar)\n       and (eski.sayfa_limiti <> d.sayfa_limiti or eski.tum_sayfalar <> d.tum_sayfalar)\n       and exists (select 1 from public.gonderimler g0 where g0.odev_id = k.id) then\n      update public.odevler\n         set sayfa_limiti = eski.sayfa_limiti,\n             tum_sayfalar = eski.tum_sayfalar\n       where id = k.id;\n    end if;\n\n    perform public._denetim('kardeslere_yayildi'",
    "adet": 1
  },
  {
    "fn": "odev_detay",
    "eski": "    'sayfa_limiti', d.sayfa_limiti,",
    "yeni": "    'sayfa_limiti', d.sayfa_limiti,\n    'tum_sayfalar', d.tum_sayfalar,",
    "adet": 1
  },
  {
    "fn": "odev_sayfa_kurali",
    "eski": "create or replace function public.odev_sayfa_siniri(p_token text, p_odev_id uuid)\nreturns integer",
    "yeni": "create or replace function public.odev_sayfa_kurali(p_token text, p_odev_id uuid)\nreturns jsonb",
    "adet": 1
  },
  {
    "fn": "odev_sayfa_kurali",
    "eski": "  return d.sayfa_limiti;",
    "yeni": "  return jsonb_build_object('sayfa', d.sayfa_limiti, 'tum_sayfalar', d.tum_sayfalar);",
    "adet": 1
  }
];

function govdeCikar(dosya, fn) {
  const metin = readFileSync(resolve(MIG, dosya), 'utf8');
  const bas = `create or replace function public.${fn}(`;
  const i = metin.indexOf(bas);
  if (i < 0 || metin.indexOf(bas, i + 1) >= 0) throw new Error(`${dosya}: ${fn} tam bir kez tanımlı olmalı`);
  return metin.slice(i, metin.indexOf('\n$$;', i) + 4);
}

console.log('HER SAYFA ZORUNLU DENETİMİ (0078)\n');
console.log('--- A1. Kaynaklar 0078 öncesindeki EN SON tanımlar ---');
{
  const dosyalar = readdirSync(MIG).filter((d) => d.endsWith('.sql')).sort();
  let sapma = 0;
  for (const [fn, [kaynak, ad]] of Object.entries(KAYNAK)) {
    const sonra = dosyalar.filter((d) => d > kaynak && d < '0078'
      && readFileSync(resolve(MIG, d), 'utf8').includes(`function public.${ad}(`));
    if (sonra.length) { bozuk(`${fn}: ${kaynak}'ten sonra ${sonra.join(', ')} içinde yeniden tanımlanmış`); sapma++; }
  }
  if (!sapma) tamam('yedi kaynağın hiçbiri arada yeniden tanımlanmamış');
}

console.log('--- A2. 0078 gövdeleri = kaynak + listelenen değişimler, BİREBİR ---');
for (const [fn, [kaynak, ad]] of Object.entries(KAYNAK)) {
  let govde = govdeCikar(kaynak, ad);
  for (const d of DEGISIMLER.filter((x) => x.fn === fn)) {
    const n = govde.split(d.eski).length - 1;
    if (n !== d.adet) bozuk(`${fn}: değişim ${n} kez eşleşti (beklenen ${d.adet}): ${d.eski.slice(0, 60)}…`);
    govde = govde.split(d.eski).join(d.yeni);
  }
  const depoda = govdeCikar('0078_tum_sayfalar_zorunlu.sql', fn);
  if (govde === depoda) tamam(`${fn} (${DEGISIMLER.filter((x) => x.fn === fn).length} değişim)`);
  else {
    const a = govde.split('\n'); const b = depoda.split('\n');
    const k = a.findIndex((s, i) => s !== b[i]);
    bozuk(`${fn}: ${k + 1}. satırda fark\n      beklenen: ${a[k]}\n      depoda:   ${b[k]}`);
  }
}

// ============================================================================
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const KOK = 'http://127.0.0.1:8788/yeni/';
const ODEV = '11111111-1111-4111-8111-111111111111';
const OGR = '22222222-2222-4222-8222-222222222222';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const EKLE = 'input[type=file]:not([aria-label])';

/** n sayfalı geçerli PDF. */
function pdfUret(n) {
  const o = [];
  const ekle = (g) => { o.push(g); return o.length; };
  const kat = ekle(null); const say = ekle(null);
  const cocuk = [];
  for (let i = 1; i <= n; i++) {
    const ic = '0 g 100 300 400 60 re f';
    const ak = ekle(`<< /Length ${ic.length} >>\nstream\n${ic}\nendstream`);
    cocuk.push(ekle(`<< /Type /Page /Parent ${say} 0 R /MediaBox [0 0 595 842] /Contents ${ak} 0 R >>`));
  }
  o[kat - 1] = `<< /Type /Catalog /Pages ${say} 0 R >>`;
  o[say - 1] = `<< /Type /Pages /Kids [${cocuk.map((c) => `${c} 0 R`).join(' ')}] /Count ${n} >>`;
  let g = '%PDF-1.4\n'; const yer = [];
  o.forEach((x, i) => { yer.push(g.length); g += `${i + 1} 0 obj\n${x}\nendobj\n`; });
  const xr = g.length;
  g += `xref\n0 ${o.length + 1}\n0000000000 65535 f \n` + yer.map((y) => `${String(y).padStart(10, '0')} 00000 n \n`).join('')
    + `trailer\n<< /Size ${o.length + 1} /Root ${kat} 0 R >>\nstartxref\n${xr}\n%%EOF\n`;
  return Buffer.from(g, 'latin1');
}

async function kur(rol, yolSon, en = 390) {
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: en, height: 900 } });
  await s.addInitScript((a) => {
    localStorage.setItem('sekiz_oturum', JSON.stringify(a.rol === 'ogrenci'
      ? { rol: 'ogrenci', token: 't'.repeat(64), ogrenci: { id: a.OGR, ad: 'Elif Sayfa', sinif: '10U', tur: 'okul' } }
      : { rol: 'ogretmen', token: 'sahte', ad: 'Buket Topuzoğlu' }));
    window.__c = [];
    const asil = window.fetch;
    const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
    window.fetch = async (u, o) => {
      const url = String(typeof u === 'string' ? u : u.url);
      let g = null; try { g = JSON.parse(String(o?.body ?? 'null')); } catch { /* ikili */ }
      if (/depo\.sahte/.test(url)) return new Response('', { status: 200 });
      if (/functions\/v1\/dosya-url/.test(url)) {
        window.__c.push({ ad: 'dosya-url', g });
        return json({ imzaliUrl: 'https://depo.sahte/yukle/' + g.yol, jeton: 'j', yol: g.yol });
      }
      const m = url.match(/\/rpc\/([a-z_]+)/);
      if (!m) return asil(u, o);
      window.__c.push({ ad: m[1], g });
      switch (m[1]) {
        case 'ogrenci_odevleri': return json({ ogrenci: { id: a.OGR, ad: 'Elif Sayfa', sinif: '10U', tur: 'okul' }, okunmamis_mesaj: 0, dersler: [],
          odevler: [{ id: a.ODEV, baslik: 'İki sayfalık ödev', aciklama: null, tur: 'acik', son_tarih: '2099-12-31', soru_sayisi: null,
            gec_teslim: true, sik_sayisi: 5, sinif_arsiv: false, odev_yolu: null, gonderim: null, cevap_anahtari: null, anahtar_yolu: null, konu_analizi: [] }] });
        case 'odev_sayfa_kurali': return json({ sayfa: 2, tum_sayfalar: true });
        case 'odev_sayfa_siniri': return json(2);
        case 'odev_gonder': return json({ id: 'g1', durum: 'incelemede' });
        case 'siniflar_listesi': return json([{ id: 's10u', ad: '10U', seviye: 10, sube: 'U', ozel: false, arsiv: false, ogrenci_sayisi: 24 }]);
        case 'odevler_coklu_olustur': return json({ grup_id: null, odevler: [{ odev_id: 'y1', sinif_id: 's10u', sinif: '10U' }] });
        case 'ewalu_mesajlari': case 'konu_onerileri': case 'odevler_listesi': return json([]);
        case 'odev_kiyasi': return json(null);
        default: return json({});
      }
    };
  }, { rol, ODEV, OGR });
  const p = await s.newPage();
  p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
  await p.goto(KOK + '#' + yolSon, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  return { b, p };
}
const metin = (p) => p.evaluate(() => document.body.innerText);
const cagrilar = (p) => p.evaluate(() => window.__c);

console.log('--- Z1. Öğretmen: sayfa sayısı soru PDF\'inden otomatik, düzeltilebilir ---');
{
  const { b, p } = await kur('ogretmen', '/ogretmen/odevler/yeni');
  await p.getByRole('textbox', { name: 'Başlık (zorunlu)' }).fill('Dört sayfa');
  await p.getByText('10U', { exact: true }).click();
  await p.locator('input[type=date]').fill('2099-12-31');
  await p.getByLabel('Soru sayısı', { exact: false }).fill('2');
  await p.getByRole('button', { name: 'Devam' }).click();
  await p.locator('input[type=file][accept="application/pdf"]').first().setInputFiles({ name: 'sorular.pdf', mimeType: 'application/pdf', buffer: pdfUret(4) });
  await p.waitForTimeout(1500);
  await p.getByRole('button', { name: /Anahtarı elle gireceğim|Devam/ }).click();
  await p.waitForTimeout(400);
  const k = p.getByLabel(/Ödevin sayfa sayısı/);
  const m = await metin(p);
  if ((await k.inputValue()) !== '4' || !m.includes('Soru PDF’i 4 sayfa; sayı oradan geldi')) bozuk(`otomatik sayı gelmedi: ${await k.inputValue()}`);
  else tamam('PDF 4 sayfa → kutuda 4, "sayı oradan geldi" yazıyor');
  await k.fill('3');
  await p.getByRole('button', { name: /taslak kaydet|Taslağı kaydet/ }).click();
  await p.waitForTimeout(1000);
  const c = (await cagrilar(p)).find((x) => x.ad === 'odevler_coklu_olustur');
  if (!c || c.g.p_sayfa_limiti !== 3) bozuk(`düzeltilen değer gitmedi: ${c?.g.p_sayfa_limiti}`);
  else tamam('öğretmen 3\'e düzeltti → `p_sayfa_limiti: 3`');
  await b.close();
}

console.log('--- Z2. Öğrenci, 360 px: gerekçe, sayaç, açıklama; taşma yok ---');
{
  const { b, p } = await kur('ogrenci', `/ogrenci/odev/${ODEV}`, 360);
  const m = await metin(p);
  for (const [ad, parca] of [['gerekçe', 'çözüm yolunun tamamını görebilsin'], ['sayaç', '0 / 2 sayfa eklendi · 2 sayfa eksik'],
    ['açıklama', 'Bu ödev 2 sayfa. Her sayfanın çözümünü sırayla ekle']]) {
    if (!m.includes(parca)) bozuk(`${ad} yok`); else tamam(`${ad} görünüyor`);
  }
  if (/birleştir|tek görsel|tek PDF/i.test(m)) bozuk('birleştirme sözü var'); else tamam('"birleştir/tek görsel" yok');
  const tasma = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (tasma > 0) bozuk(`360 px'te yatay taşma: ${tasma}px`); else tamam('360 px\'te yatay taşma yok');
  await b.close();
}

console.log('--- Z3. Öğrenci 2/2 sayfayla gönderiyor ---');
{
  const { b, p } = await kur('ogrenci', `/ogrenci/odev/${ODEV}`);
  await p.locator(EKLE).setInputFiles([{ name: 'a.png', mimeType: 'image/png', buffer: PNG }, { name: 'b.png', mimeType: 'image/png', buffer: PNG }]);
  await p.waitForTimeout(1000);
  if (!(await metin(p)).includes('2 / 2 sayfa eklendi · tamam')) bozuk('sayaç tamam demedi');
  const k = p.getByRole('checkbox', { name: /Bu ödevi kendim çözdüm/ });
  await k.evaluate((e) => e.scrollIntoView({ block: 'center' })); await k.check();
  await p.getByRole('button', { name: 'Ödevi gönder' }).click();
  await p.waitForTimeout(1500);
  const g = (await cagrilar(p)).filter((x) => x.ad === 'odev_gonder');
  if (g.length !== 1 || g[0].g.p_ek_sayfa_yollari?.length !== 1) bozuk(`gönderim yanlış: ${JSON.stringify(g)}`);
  else tamam('odev_gonder: 1 + 1 ek sayfa');
  await b.close();
}

console.log('--- Z4. Öğrenci 1/2 sayfayla gönderemiyor ---');
{
  const { b, p } = await kur('ogrenci', `/ogrenci/odev/${ODEV}`);
  await p.locator(EKLE).setInputFiles([{ name: 'a.png', mimeType: 'image/png', buffer: PNG }]);
  await p.waitForTimeout(1000);
  if (!(await metin(p)).includes('1 / 2 sayfa eklendi · 1 sayfa eksik')) bozuk('sayaç eksik sayfayı söylemedi');
  const k = p.getByRole('checkbox', { name: /Bu ödevi kendim çözdüm/ });
  await k.evaluate((e) => e.scrollIntoView({ block: 'center' })); await k.check();
  await p.getByRole('button', { name: 'Ödevi gönder' }).click();
  await p.waitForTimeout(1000);
  const g = (await cagrilar(p)).filter((x) => x.ad === 'odev_gonder');
  if (g.length) bozuk('eksik sayfayla odev_gonder çağrıldı');
  else if (!(await metin(p)).includes('1 sayfa eksik. Ödevi gönderebilmek için')) bozuk('eksik uyarısı görünmedi');
  else tamam('gönderim yok, "1 sayfa eksik" uyarısı');
  await b.close();
}

console.log('');
if (hata) { console.log(`HER SAYFA ZORUNLU DENETİMİ BAŞARISIZ — ${hata} sapma`); process.exit(1); }
console.log('HER SAYFA ZORUNLU DENETİMİ GEÇTİ');
