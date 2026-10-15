/**
 * 0079 — SAYFA SAYISI DÜZENLEMEDE HER ZAMAN DEĞİŞTİRİLEBİLİR
 *
 * A. GÖVDE FARKI (tarayıcısız). 0079 iki fonksiyonu (odev_guncelle,
 *    odev_kardeslere_yay) 0078'den kopyalıyor. Her gövde 0078'deki gövdeye
 *    AŞAĞIDAKİ DEĞİŞİMLER uygulanarak yeniden üretiliyor ve depodakiyle
 *    birebir karşılaştırılıyor. 0078 ile 0079 arasında aynı fonksiyonu
 *    tanımlayan başka migration olmadığı da ölçülüyor.
 *
 * B. ARAYÜZ (Chromium, taklit RPC), 360 px.
 *    D1. Gönderimi olan ESKİ ödevin düzenleme ekranı: "önceki düzende" notu,
 *        AÇIK sayı kutusu, "gönderilmiş çözümler ve puanlar değişmez"
 *        uyarısı; yatay taşma yok.
 *    D2. Kaydedince `p_sayfa_limiti` gidiyor (yeni kurala geçiş).
 *    (Yeni ödevde gönderim varken 3 → 5: sayfa-siniri-denetimi B7.)
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/sayfa-duzenleme-denetimi.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIG = resolve(dirname(fileURLToPath(import.meta.url)), '../../supabase/migrations');
let hata = 0;
const tamam = (m) => console.log(`    ${m}: OK`);
const bozuk = (m) => { console.log(`    HATA: ${m}`); hata++; };

const KAYNAK = '0078_tum_sayfalar_zorunlu.sql';
const HEDEF = '0079_sayfa_sayisi_duzenleme.sql';
const FONKSIYONLAR = ['odev_guncelle', 'odev_kardeslere_yay'];

/** 0079'un 0078 gövdelerine uyguladığı değişimlerin TAMAMI. */
const DEGISIMLER = [
  {
    "fn": "odev_guncelle",
    "eski": "  -- 0078: HER SAYFASI ZORUNLU ödevde gönderim başladıktan sonra sayfa\n  -- sayısı değişmez. Değişseydi öğrencilerin bir kısmı 6, bir kısmı 8 sayfa\n  -- göndermiş olurdu — aynı ödevde iki farklı kural.\n  if d.tum_sayfalar and p_sayfa_limiti is not null and p_sayfa_limiti <> d.sayfa_limiti\n     and exists (select 1 from public.gonderimler g0 where g0.odev_id = p_id) then\n    raise exception 'Bu ödeve gönderim yapıldı; sayfa sayısı artık değiştirilemez.'\n      using errcode = '22023';\n  end if;\n",
    "yeni": "  -- 0079: gönderim yapılmış ödevde de sayfa sayısı DEĞİŞEBİLİR (öğretmenin\n  -- kararı). Gönderilmiş çözümler ve puanlar değişmez; yeni sayı henüz\n  -- göndermeyenler için geçerli. 0078'deki kilit kalktı.\n",
    "adet": 1
  },
  {
    "fn": "odev_guncelle",
    "eski": "         sayfa_limiti = coalesce(p_sayfa_limiti, d.sayfa_limiti)\n",
    "yeni": "         sayfa_limiti = coalesce(p_sayfa_limiti, d.sayfa_limiti),\n         -- 0079: sayfa sayısı yazılan ödev \"her sayfa zorunlu\" kurala geçer\n         -- (eski ödev de). Sayı gönderilmediyse bayrak olduğu gibi kalır.\n         tum_sayfalar = (d.tum_sayfalar or p_sayfa_limiti is not null)\n",
    "adet": 1
  },
  {
    "fn": "odev_kardeslere_yay",
    "eski": "           -- 0078: \"her sayfa zorunlu\" bayrağı da içerik. AMA kardeşte\n           -- gönderim varsa ve bayraklardan biri açıksa sayfa kuralı o\n           -- kardeşte KORUNUYOR: gönderen öğrencilerle gönderecekler aynı\n           -- kurala tabi kalsın (odev_guncelle'deki kilidin aynısı).\n",
    "yeni": "           -- 0078: \"her sayfa zorunlu\" bayrağı da içerik. 0079: gönderimi\n           -- olan kardeşe de taşınıyor (odev_guncelle'deki kilit kalktı);\n           -- gönderilmiş çözümler değişmez.\n",
    "adet": 1
  },
  {
    "fn": "odev_kardeslere_yay",
    "eski": "    if (eski.tum_sayfalar or d.tum_sayfalar)\n       and (eski.sayfa_limiti <> d.sayfa_limiti or eski.tum_sayfalar <> d.tum_sayfalar)\n       and exists (select 1 from public.gonderimler g0 where g0.odev_id = k.id) then\n      update public.odevler\n         set sayfa_limiti = eski.sayfa_limiti,\n             tum_sayfalar = eski.tum_sayfalar\n       where id = k.id;\n    end if;\n\n",
    "yeni": "",
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

console.log('SAYFA SAYISI DÜZENLEME DENETİMİ (0079)\n');
console.log('--- A1. Kaynak 0078, arada başka tanım yok ---');
{
  const dosyalar = readdirSync(MIG).filter((d) => d.endsWith('.sql')).sort();
  let sapma = 0;
  for (const fn of FONKSIYONLAR) {
    const arada = dosyalar.filter((d) => d > KAYNAK && d < HEDEF
      && readFileSync(resolve(MIG, d), 'utf8').includes(`function public.${fn}(`));
    if (arada.length) { bozuk(`${fn}: 0078'den sonra ${arada.join(', ')} içinde yeniden tanımlanmış`); sapma++; }
  }
  if (!sapma) tamam('iki fonksiyon da 0078 ile 0079 arasında yeniden tanımlanmamış');
}

console.log('--- A2. 0079 gövdeleri = 0078 + listelenen değişimler, BİREBİR ---');
for (const fn of FONKSIYONLAR) {
  let govde = govdeCikar(KAYNAK, fn);
  for (const d of DEGISIMLER.filter((x) => x.fn === fn)) {
    const n = govde.split(d.eski).length - 1;
    if (n !== d.adet) bozuk(`${fn}: değişim ${n} kez eşleşti (beklenen ${d.adet}): ${d.eski.slice(0, 60)}…`);
    govde = govde.split(d.eski).join(d.yeni);
  }
  const depoda = govdeCikar(HEDEF, fn);
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

console.log('--- D1. Gönderimi olan eski ödev, 360 px ---');
{
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: 360, height: 900 } });
  await s.addInitScript(() => {
    localStorage.setItem('sekiz_oturum', JSON.stringify({ rol: 'ogretmen', token: 'sahte', ad: 'Buket Topuzoğlu' }));
    window.__c = [];
    const asil = window.fetch;
    const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
    window.fetch = async (u, o) => {
      const url = String(typeof u === 'string' ? u : u.url);
      const m = url.match(/\/rpc\/([a-z_]+)/);
      if (!m) return asil(u, o);
      let g = null; try { g = JSON.parse(String(o?.body ?? 'null')); } catch { /* ikili */ }
      window.__c.push({ ad: m[1], g });
      switch (m[1]) {
        case 'odev_detay': return json({
          id: 'a1', baslik: 'Üçgende Açı', aciklama: null, tur: 'acik', sinif_id: 's10u', sinif: '10U',
          son_tarih: '2099-12-31', soru_sayisi: null, gec_teslim: true, sik_sayisi: 5,
          cevap_anahtari: {}, konular: null, anahtar_yolu: null, odev_yolu: null,
          yayinda: true, gonderim_sayisi: 7, kardesler: null, sayfa_limiti: 2, tum_sayfalar: false });
        case 'siniflar_listesi': return json([{ id: 's10u', ad: '10U', seviye: 10, sube: 'U', ozel: false, arsiv: false, ogrenci_sayisi: 24 }]);
        case 'konu_onerileri': case 'odevler_listesi': return json([]);
        case 'odev_guncelle': return json({ durum: 'tamam', yeniden_puanlanan: [] });
        default: return json({});
      }
    };
  });
  const p = await s.newPage();
  const sayfaHatasi = [];
  p.on('pageerror', (e) => sayfaHatasi.push(String(e.message)));
  await p.goto(KOK + '#/ogretmen/odevler/a1', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  const m = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  const k = p.getByLabel(/Ödevin sayfa sayısı/);
  if (!m.includes('önceki düzende') || !m.includes('en fazla 2 sayfa')) bozuk('eski düzen notu yok');
  else tamam('"önceki düzende … en fazla 2 sayfa" notu');
  if (!(await k.count()) || (await k.isDisabled()) || (await k.inputValue()) !== '2') bozuk('sayı kutusu açık değil ya da 2 değil');
  else tamam('sayı kutusu açık, 2');
  if (!m.includes('7 gönderim yapıldı') || !m.includes('gönderilmiş çözümler ve puanlar değişmez')) bozuk('gönderim uyarısı yok');
  else tamam('"7 gönderim yapıldı … gönderilmiş çözümler ve puanlar değişmez"');
  const tasma = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (tasma > 0) bozuk(`360 px'te ${tasma} px yatay taşma`);
  else tamam('360 px yatay taşma yok');

  console.log('--- D2. Kaydedince yeni kurala geçiş ---');
  await k.fill('4');
  await p.getByRole('button', { name: 'Değişiklikleri kaydet' }).click();
  await p.waitForTimeout(900);
  const c = (await p.evaluate(() => window.__c)).filter((x) => x.ad === 'odev_guncelle');
  if (!c.length || c[0].g.p_sayfa_limiti !== 4) bozuk(`kayıtta sayı gitmedi: ${JSON.stringify(c[0]?.g?.p_sayfa_limiti)}`);
  else tamam('`p_sayfa_limiti: 4` gönderildi');
  if (sayfaHatasi.length) bozuk(`sayfa hatası: ${sayfaHatasi.join(' | ')}`);
  await b.close();
}

console.log('');
if (hata) { console.log(`SAYFA SAYISI DÜZENLEME DENETİMİ BAŞARISIZ — ${hata} sapma`); process.exit(1); }
console.log('SAYFA SAYISI DÜZENLEME DENETİMİ GEÇTİ');
