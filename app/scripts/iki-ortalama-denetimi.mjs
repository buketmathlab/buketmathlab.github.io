/**
 * 0080 — İKİ ORTALAMA (YAPTIĞI ÖDEVLER · TÜM ÖDEVLER)
 *
 * A. GÖVDE FARKI (tarayıcısız). 0080 iki fonksiyonu kopyalıyor:
 *    sinif_ogrenci_ozeti (kaynak 0073) ve kendi_karnem (kaynak 0064). Her
 *    gövde kaynağına AŞAĞIDAKİ DEĞİŞİMLER uygulanarak yeniden üretiliyor ve
 *    depodakiyle birebir karşılaştırılıyor. Kaynak ile 0080 arasında aynı
 *    fonksiyonu tanımlayan başka migration olmadığı da ölçülüyor.
 *
 * B. ARAYÜZ (Chromium, taklit RPC), 360 px.
 *    D1. Öğretmen → Öğrenciler → sınıf: her satırda iki etiketli ortalama,
 *        sayılar satırı, "puan bekliyor" notu, iki ortalamanın tanımı;
 *        yatay taşma yok.
 *    D2. Öğrenci karnesi: iki ortalama ve fark cümlesi ("sen" dili).
 *    D3. Veli karnesi: aynı sayılar, üçüncü tekil.
 *    D5. Sınıf çıktısı: tabloda iki sütun, veli fişinde iki ortalama.
 *    D4. Eski sunucu (alanlar yok): öğretmen listesinde tek sayı, karnede
 *        eski "Genel ortalaman" satırı.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/iki-ortalama-denetimi.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const MIG = resolve(dirname(fileURLToPath(import.meta.url)), '../../supabase/migrations');
const KOK = 'http://127.0.0.1:8788/yeni/#';
let hata = 0;
const tamam = (m) => console.log(`    ${m}: OK`);
const bozuk = (m) => { console.log(`    HATA: ${m}`); hata++; };

const HEDEF = '0080_iki_ortalama.sql';
const KAYNAK = {
  sinif_ogrenci_ozeti: '0073_deneme_hesabi.sql',
  kendi_karnem: '0064_sinif_listesi_esas.sql',
};

/** 0080'in kaynak gövdelere uyguladığı değişimlerin TAMAMI. */
const DEGISIMLER = [
  {
    "fn": "sinif_ogrenci_ozeti",
    "eski": "               -- ORTALAMA — öğretmenin 1. kararı (0051).\n               'ortalama', (\n                 select round(avg(coalesce(\n                          (select coalesce(g.ogretmen_puan, g.puan)\n                             from public.gonderimler g\n                            where g.odev_id = d.id and g.ogrenci_id = o.id),\n                          0)), 2)\n                   from public.odevler d\n                  where d.sinif_id = p_sinif_id\n                    and d.yayinda\n                    and d.son_tarih < bugun_tr\n                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)\n               ),\n",
    "yeni": "               -- ORTALAMA — öğretmenin 1. kararı (0051): TÜM ödevler,\n               -- yapılmayan 0. 0080: puanlanmamış gönderim (puan bekleyen)\n               -- artık 0 sayılmıyor; puan verilene kadar hesaba girmiyor.\n               'ortalama', round((oo.x->>'tum_ortalama')::numeric, 2),\n\n               -- 0080: YAPTIĞI ödevlerin ortalaması (puanlı gönderimler).\n               -- İki sayı arasındaki fark, yapılmayan ödevlerin bedeli.\n               'yapilan_ortalama', round((oo.x->>'yapilan_ortalama')::numeric, 2),\n\n               -- 0080: gönderdiği ama henüz puanı olmayan ödev sayısı.\n               'puan_bekleyen', (oo.x->>'puan_bekleyen')::integer,\n",
    "adet": 1
  },
  {
    "fn": "sinif_ogrenci_ozeti",
    "eski": "      from public.ogrenciler o\n      where o.sinif_id = p_sinif_id and (o.aktif and not o.deneme)\n",
    "yeni": "      from public.ogrenciler o\n      -- 0080: iki ortalama tek yardımcıdan, öğrenci başına bir kez.\n      cross join lateral (\n        select public._ogrenci_ortalamalari(o.id, p_sinif_id, o.sinif_giris) as x\n      ) oo\n      where o.sinif_id = p_sinif_id and (o.aktif and not o.deneme)\n",
    "adet": 1
  },
  {
    "fn": "kendi_karnem",
    "eski": "  v_giris       date;\n",
    "yeni": "  v_giris       date;\n  v_ort         jsonb;\n",
    "adet": 1
  },
  {
    "fn": "kendi_karnem",
    "eski": "    from public.ogrenciler g where g.id = v_ogrenci_id;\n  if v_ad is null then\n    raise exception 'Öğrenci bulunamadı.' using errcode = 'P0002';\n  end if;\n",
    "yeni": "    from public.ogrenciler g where g.id = v_ogrenci_id;\n  if v_ad is null then\n    raise exception 'Öğrenci bulunamadı.' using errcode = 'P0002';\n  end if;\n\n  -- 0080: iki ortalama, öğretmenin listesiyle AYNI yardımcıdan.\n  v_ort := public._ogrenci_ortalamalari(v_ogrenci_id, v_sinif_id, v_giris);\n",
    "adet": 1
  },
  {
    "fn": "kendi_karnem",
    "eski": "    'genel_ortalama', (\n      select round(avg(coalesce(g2.ogretmen_puan, g2.puan)), 1)\n        from public.gonderimler g2\n        join public.odevler d2 on d2.id = g2.odev_id\n       where g2.ogrenci_id = v_ogrenci_id\n         and d2.sinif_id = v_sinif_id\n         and d2.yayinda\n         and d2.son_tarih < bugun_tr\n         and coalesce(g2.ogretmen_puan, g2.puan) is not null\n    ),\n",
    "yeni": "    --\n    -- 0080: hesap `_ogrenci_ortalamalari`'na taşındı (anlam aynı: yaptığı\n    -- ve puanlanmış ödevler). Ödev kümesi öğretmenin listesiyle birleşti:\n    -- sınıfa gelmeden önce kapanmış ödev buraya da girmiyor.\n    'genel_ortalama', round((v_ort->>'yapilan_ortalama')::numeric, 1),\n\n    -- 0080 — TÜM ÖDEVLER ORTALAMASI (öğretmenin isteği): yapılmayan ödev\n    -- 0 sayılır. Amaç kıyas değil; çocuk, ödevlerini yaparsa kendi\n    -- ortalamasının ne kadar yükseleceğini görsün. Yine YALNIZ kendisi.\n    -- Puanlanmamış gönderim puan verilene kadar ikisine de girmez.\n    'tum_ortalama', round((v_ort->>'tum_ortalama')::numeric, 1),\n    'yapilmayan', (v_ort->>'yapilmayan')::integer,\n    'puan_bekleyen', (v_ort->>'puan_bekleyen')::integer,\n",
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

console.log('İKİ ORTALAMA DENETİMİ (0080)\n');
console.log('--- A1. Kaynaktan sonra arada başka tanım yok ---');
{
  const dosyalar = readdirSync(MIG).filter((d) => d.endsWith('.sql')).sort();
  for (const [fn, kaynak] of Object.entries(KAYNAK)) {
    const arada = dosyalar.filter((d) => d > kaynak && d < HEDEF
      && readFileSync(resolve(MIG, d), 'utf8').includes(`function public.${fn}(`));
    (arada.length ? bozuk : tamam)(`${fn}: kaynak ${kaynak.slice(0, 4)}${arada.length ? ` — arada ${arada.join(', ')}` : ''}`);
  }
}

console.log('--- A2. 0080 gövdesi = kaynak + listelenen değişimler ---');
for (const [fn, kaynak] of Object.entries(KAYNAK)) {
  let g = govdeCikar(kaynak, fn);
  let sapma = false;
  for (const d of DEGISIMLER.filter((x) => x.fn === fn)) {
    const adet = g.split(d.eski).length - 1;
    if (adet !== d.adet) { bozuk(`${fn}: değişim ${adet} kez bulundu, ${d.adet} bekleniyordu`); sapma = true; }
    g = g.split(d.eski).join(d.yeni);
  }
  const depo = govdeCikar(HEDEF, fn);
  if (!sapma) (g === depo ? tamam : bozuk)(`${fn}: gövde birebir`);
}

// -----------------------------------------------------------------------------
// B. Arayüz
// -----------------------------------------------------------------------------
const OGR = { id: 'o1', ad: 'Ada Örnek', tur: 'okul', sinif: '9A' };
const SINIF = { id: 's9a', ad: '9A', seviye: 9, sube: 'A', ozel: false, arsiv: false, ogrenci_sayisi: 2 };

const ozet = (yeni) => ({
  sinif: { id: 's9a', ad: '9A', ozel: false },
  ogrenciler: [
    { id: 'o1', ad: 'Ada Örnek', ogrenci_no: '101', tur: 'okul',
      ortalama: 46.67, odev_sayisi: 4, yapilan: 3, yapilmayan: 1, eksik_konular: [],
      ...(yeni ? { yapilan_ortalama: 70, puan_bekleyen: 1 } : {}) },
    { id: 'o2', ad: 'Can Örnek', ogrenci_no: '102', tur: 'okul',
      ortalama: 0, odev_sayisi: 4, yapilan: 0, yapilmayan: 4, eksik_konular: [],
      ...(yeni ? { yapilan_ortalama: null, puan_bekleyen: 0 } : {}) },
  ],
});

const karne = (yeni) => ({
  kapsam: { ad: OGR.ad, sinif: '9A' },
  odev_sayisi: 4,
  genel_ortalama: 78,
  ...(yeni ? { tum_ortalama: 62.4, yapilmayan: 2, puan_bekleyen: 1 } : {}),
  konular: [],
  gelisim: [],
});

async function ac({ rol, yol, yeni }) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 360, height: 900 } });
  p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
  await p.route('**/rest/v1/rpc/*', (r) => {
    const uc = r.request().url().split('/').pop().split('?')[0];
    const yanit = {
      ben_kimim: { id: 't1', ad: 'Buket Topuzoğlu', sahip: true, vekalet: false, vekil: null },
      siniflar_listesi: [SINIF],
      sinif_ogrenci_ozeti: ozet(yeni),
      ogrenciler_listesi: { toplam: 0, sayfa: 1, boyut: 25, kayitlar: [] },
      bildirim_sayilari: {},
      kendi_karnem: karne(yeni),
      ogrenci_odevleri: { ogrenci: OGR, odevler: [], dersler: [], okunmamis_mesaj: 0, okunmamis_duyuru: 0 },
      ogrenci_duyurulari: [],
      veli_paneli: { ogrenci: OGR, tur: 'okul', onam_gerekli: false, odevler: [], mesajlar: [], ogretmenler: [],
        okunmamis_mesaj: 0, odemeler: [], son_gorulme: null, genel_ortalama: null },
      anket_durumu: { acik: false },
    }[uc] ?? {};
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(yanit) });
  });
  await p.addInitScript(([rl, o]) => {
    localStorage.setItem('sekiz_oturum', JSON.stringify({ rol: rl, token: 't'.repeat(64), ...(rl === 'ogretmen' ? { ad: 'Buket Topuzoğlu' } : { ogrenci: o }) }));
  }, [rol, OGR]);
  await p.goto(KOK + yol, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  return { b, p };
}

async function sinifaGir(p) {
  await p.evaluate(() => {
    const d = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim().startsWith('9A'));
    d?.click();
  });
  await p.waitForTimeout(800);
}
const tasma = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

console.log('--- D1. Öğretmen listesi: iki ortalama (360 px) ---');
{
  const { b, p } = await ac({ rol: 'ogretmen', yol: '/ogretmen/ogrenciler', yeni: true });
  await sinifaGir(p);
  const m = await p.locator('main').innerText();
  (/Yaptığı ödevler\s*70,0/.test(m) ? tamam : bozuk)('Ada: "Yaptığı ödevler 70,0"');
  (/Tüm ödevler\s*46,7/.test(m) ? tamam : bozuk)('Ada: "Tüm ödevler 46,7"');
  (m.includes('4 ödev · 3 yapıldı · 1 yapılmadı') ? tamam : bozuk)('sayılar satırı');
  (m.includes('1 ödev puan bekliyor') ? tamam : bozuk)('puan bekleyen notu');
  (/Yaptığı ödevler\s*—/.test(m) ? tamam : bozuk)('Can: yaptığı ödev ortalaması tire (sıfır değil)');
  (!m.includes('Henüz ödev yok') ? tamam : bozuk)('ödev varken "Henüz ödev yok" yazmıyor');
  (m.includes('yapılmayan ödev 0 sayılır') && m.includes('puan verilene kadar iki ortalamaya da girmez') ? tamam : bozuk)('iki ortalamanın tanımı yazılı');
  const t = await tasma(p);
  (t <= 0 ? tamam : bozuk)(`360 px yatay taşma yok (${t} px)`);
  await p.screenshot({ path: '/tmp/iki-ortalama-ogretmen.png', fullPage: true });
  await b.close();
}

console.log('--- D2. Öğrenci karnesi ---');
{
  const { b, p } = await ac({ rol: 'ogrenci', yol: '/ogrenci/konularim', yeni: true });
  const m = await p.locator('main').innerText();
  (/Yaptığın ödevlerin ortalaması\s*78,0/.test(m) ? tamam : bozuk)('"Yaptığın ödevlerin ortalaması 78,0"');
  (/Tüm ödevlerin ortalaması\s*62,4/.test(m) ? tamam : bozuk)('"Tüm ödevlerin ortalaması 62,4"');
  (m.includes('Yapmadığın 2 ödev 0 sayıldığı için tüm ödevlerin ortalaması 15,6 puan daha düşük') ? tamam : bozuk)('fark cümlesi');
  (m.includes('1 ödevin puan bekliyor') ? tamam : bozuk)('puan bekleyen notu');
  (!m.includes('Genel ortalaman') ? tamam : bozuk)('eski tek satır yok');
  (!/sınıf ortalaması|sıralama/i.test(m) ? tamam : bozuk)('kıyas yok');
  const t = await tasma(p);
  (t <= 0 ? tamam : bozuk)(`360 px yatay taşma yok (${t} px)`);
  await p.screenshot({ path: '/tmp/iki-ortalama-ogrenci.png', fullPage: true });
  await b.close();
}

console.log('--- D3. Veli karnesi ---');
{
  const { b, p } = await ac({ rol: 'veli', yol: '/veli/konular', yeni: true });
  const m = await p.locator('main').innerText();
  (/Yaptığı ödevlerin ortalaması\s*78,0/.test(m) && /Tüm ödevlerin ortalaması\s*62,4/.test(m) ? tamam : bozuk)('iki ortalama');
  (m.includes('Yapmadığı 2 ödev 0 sayıldığı için') ? tamam : bozuk)('fark cümlesi üçüncü tekil');
  (!/Yapmadığın|ödevin puan/.test(m) ? tamam : bozuk)('veliye "sen" diye seslenmiyor');
  const t = await tasma(p);
  (t <= 0 ? tamam : bozuk)(`360 px yatay taşma yok (${t} px)`);
  await b.close();
}

console.log('--- D5. Sınıf çıktısı: tabloda ve veli fişinde iki ortalama ---');
{
  const { b, p } = await ac({ rol: 'ogretmen', yol: '/ogretmen/ogrenciler/yazdir/s9a', yeni: true });
  const m = await p.locator('main').innerText();
  (m.includes('Yaptığı ödevler ort.') && m.includes('Tüm ödevler ort.') ? tamam : bozuk)('tabloda iki sütun');
  (m.includes('Yaptığı ödevlerin ortalaması: 70,0 · Tüm ödevlerin ortalaması (yapılmayan 0): 46,7') ? tamam : bozuk)('veli fişinde iki ortalama');
  (m.includes('Henüz puanlanmamış ödev iki ortalamaya da girmez') ? tamam : bozuk)('kâğıtta tanım');
  await b.close();
}

console.log('--- D4. Eski sunucu: alanlar yok ---');
{
  const { b, p } = await ac({ rol: 'ogretmen', yol: '/ogretmen/ogrenciler', yeni: false });
  await sinifaGir(p);
  const m = await p.locator('main').innerText();
  (!m.includes('Yaptığı ödevler') && m.includes('46,7') ? tamam : bozuk)('öğretmen: tek ortalama');
  await b.close();
}
{
  const { b, p } = await ac({ rol: 'ogrenci', yol: '/ogrenci/konularim', yeni: false });
  const m = await p.locator('main').innerText();
  (m.includes('Genel ortalaman') && !m.includes('Tüm ödevlerin ortalaması') ? tamam : bozuk)('öğrenci: eski "Genel ortalaman" satırı');
  await b.close();
}

console.log(hata ? `\n${hata} HATA` : '\nİKİ ORTALAMA DENETİMİ: HEPSİ GEÇTİ');
process.exit(hata ? 1 : 0);
