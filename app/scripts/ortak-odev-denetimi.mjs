/**
 * 0055 — YÖNETİCİNİN ÖDEVİ SINIF ÖĞRETMENİNDE · PANO · PUAN DÜZELTME
 *
 * A. GÖVDE FARKI (tarayıcısız). 0055 on bir fonksiyonu yeniden tanımlıyor.
 *    Her gövde, kaynağına AŞAĞIDAKİ DEĞİŞİMLER uygulanarak yeniden üretilip
 *    depodakiyle birebir karşılaştırılıyor (0054 deseni). Erişim kuralının
 *    dışında bir satıra — puanlamaya, anahtara, yetkiye — dokunulursa düşer.
 *
 * B. ARAYÜZ (Chromium, taklit RPC).
 *    - Pano: adın yanında SINIF; ada tıklayınca ÇÖZÜM açılıyor. 0055 öncesi
 *      cevapta (alan yok) ad düz metin, ekran bozulmuyor.
 *    - "Puanı düzelt" YALNIZ sahipte (kendi oturumu ya da vekâlet); sıradan
 *      öğretmende düğme yok. Sebepsiz kayıt AĞA GİTMİYOR.
 *    - Öğretmende "Yönetici düzeltti" + sebep; 0055 öncesi satırda işaret yok.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/ortak-odev-denetimi.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIG = resolve(dirname(fileURLToPath(import.meta.url)), '../../supabase/migrations');
const HEDEF = '0055_yonetici_odevi_ve_duzeltme.sql';
let hata = 0;
const tamam = (m) => console.log(`    ${m}: OK`);
const bozuk = (m) => {
  console.log(`    HATA: ${m}`);
  hata++;
};

// ============================================================================
// A. GÖVDE FARKI
// ============================================================================
const KAYNAK = {
  _odev_sahibi: '0033_ogretmen_kimligi.sql',
  odevler_listesi: '0033_ogretmen_kimligi.sql',
  ogretmen_panosu: '0033_ogretmen_kimligi.sql',
  sinif_ogrencileri: '0044_numara_sirasi.sql',
  bildirim_sayilari: '0033_ogretmen_kimligi.sql',
  gonderim_foto_yolu: '0054_sayfa_siniri.sql',
  acik_puanla: '0033_ogretmen_kimligi.sql',
  odev_detay: '0054_sayfa_siniri.sql',
  odev_kardeslere_yay: '0054_sayfa_siniri.sql',
  odev_guncelle: '0054_sayfa_siniri.sql',
  odev_gonderimleri: '0033_ogretmen_kimligi.sql',
};

/** 0055'in kaynak gövdelere uyguladığı değişimlerin TAMAMI. */
const DEGISIMLER = [
  {
    fn: '_odev_sahibi',
    eski: `    where d.id = p_odev_id and d.ogretmen_id = p_ogretmen_id
`,
    yeni: `    where d.id = p_odev_id
      -- 0055: oluşturan YA DA yöneticinin verdiği ödevde o sınıfın öğretmeni.
      and public._odeve_erisir(p_ogretmen_id, d.ogretmen_id, d.sinif_id)
`,
    adet: 1,
  },
  {
    fn: 'odevler_listesi',
    eski: `    where d.ogretmen_id = v_ogretmen
      and not s.arsiv
`,
    yeni: `    where public._odeve_erisir(v_ogretmen, d.ogretmen_id, d.sinif_id)
      and not s.arsiv
`,
    adet: 1,
  },
  {
    fn: 'ogretmen_panosu',
    eski: `                       and d.ogretmen_id = v_ogretmen)
`,
    yeni: `                       and public._odeve_erisir(v_ogretmen, d.ogretmen_id, d.sinif_id))
`,
    adet: 1,
  },
  {
    fn: 'ogretmen_panosu',
    eski: `                     and d.ogretmen_id = v_ogretmen
                     and not public._sinif_arsivde(d.sinif_id)),
`,
    yeni: `                     and public._odeve_erisir(v_ogretmen, d.ogretmen_id, d.sinif_id)
                     and not public._sinif_arsivde(d.sinif_id)),
`,
    adet: 1,
  },
  {
    fn: 'ogretmen_panosu',
    eski: `                                 and o.ogretmen_id = v_ogretmen
`,
    yeni: `                                 and public._odeve_erisir(v_ogretmen, o.ogretmen_id, o.sinif_id)
`,
    adet: 1,
  },
  {
    fn: 'ogretmen_panosu',
    eski: `        and o.ogretmen_id = v_ogretmen
        and not public._sinif_arsivde(o.sinif_id)
        and not exists`,
    yeni: `        and public._odeve_erisir(v_ogretmen, o.ogretmen_id, o.sinif_id)
        and not public._sinif_arsivde(o.sinif_id)
        and not exists`,
    adet: 1,
  },
  {
    fn: 'ogretmen_panosu',
    eski: `                 'ogrenci', ogr.ad, 'odev', o.baslik,
`,
    yeni: `                 'ogrenci', ogr.ad, 'odev', o.baslik,
                 -- 0055: panoda adın yanında sınıf, ada tıklayınca çözüm.
                 'sinif', (select s.ad from public.siniflar s where s.id = o.sinif_id),
                 'gonderim_id', g.id,
`,
    adet: 1,
  },
  {
    fn: 'ogretmen_panosu',
    eski: `          and o.ogretmen_id = v_ogretmen
        order by g.created_at desc limit 10
`,
    yeni: `          and public._odeve_erisir(v_ogretmen, o.ogretmen_id, o.sinif_id)
        order by g.created_at desc limit 10
`,
    adet: 1,
  },
  {
    fn: 'sinif_ogrencileri',
    eski: `    and d.ogretmen_id = v_ogretmen;
`,
    yeni: `    and public._odeve_erisir(v_ogretmen, d.ogretmen_id, d.sinif_id);
`,
    adet: 1,
  },
  {
    fn: 'sinif_ogrencileri',
    eski: `          and d.son_tarih < bugun_tr
      ) i
`,
    yeni: `          and d.son_tarih < bugun_tr
          -- 0055: AYNI KÜME. Önceden \`yapti\` sınıfın BÜTÜN ödevlerinden,
          -- \`v_odev_sayisi\` yalnız öğretmenin kendi ödevlerinden sayılıyordu;
          -- yönetici o sınıfa ödev verince "yapmadı" eksiye düşüyordu.
          and public._odeve_erisir(v_ogretmen, d.ogretmen_id, d.sinif_id)
      ) i
`,
    adet: 1,
  },
  {
    fn: 'bildirim_sayilari',
    eski: `        and o.ogretmen_id = v_ogretmen
        and g.durum = 'incelemede'
`,
    yeni: `        and public._odeve_erisir(v_ogretmen, o.ogretmen_id, o.sinif_id)
        and g.durum = 'incelemede'
`,
    adet: 1,
  },
  {
    fn: 'gonderim_foto_yolu',
    eski: `  where g.id = p_gonderim and d.ogretmen_id = v_ogretmen;
`,
    yeni: `  where g.id = p_gonderim
    and public._odeve_erisir(v_ogretmen, d.ogretmen_id, d.sinif_id);
`,
    adet: 1,
  },
  {
    fn: 'acik_puanla',
    eski: `  where g.id = p_gonderim and d.ogretmen_id = v_ogretmen;
`,
    yeni: `  where g.id = p_gonderim
    and public._odeve_erisir(v_ogretmen, d.ogretmen_id, d.sinif_id);
`,
    adet: 1,
  },
  {
    fn: 'acik_puanla',
    // Sonradan puan değiştirme YALNIZ SAHİPTE: bu uç yalnız ilk puanı verir.
    eski: `  if p_puan < 0 or p_puan > 100 then
`,
    yeni: `  -- 0055: bu uç YALNIZ İLK puanı verir — açık uçlu, henüz puanlanmamış
  -- (\`incelemede\`) gönderim. Sistemin puanladığı test (\`puanlandi\`) ve daha
  -- önce puanlanmış gönderim (\`onaylandi\`) buradan DEĞİŞTİRİLEMEZ: sonradan
  -- ya da sistemden farklı puan yazmak yalnız platform sahibinin işi ve
  -- \`puan_duzelt\` ile, sebebiyle, denetim izine yazılarak yapılır. Sahip de
  -- bu uçtan geçemez — her sonradan değişikliğin bir sebebi olsun.
  if eski.durum <> 'incelemede' then
    raise exception 'Verilmiş puanı yalnız platformun sahibi değiştirebilir.'
      using errcode = '42501';
  end if;

  if p_puan < 0 or p_puan > 100 then
`,
    adet: 1,
  },
  {
    fn: 'odev_detay',
    eski: `case when d.grup_id is not null then (`,
    yeni: `case when d.grup_id is not null and d.ogretmen_id = v_ogretmen then (`,
    adet: 2,
  },
  {
    fn: 'odev_kardeslere_yay',
    eski: `  -- SESSİZ "TAMAM" YOK.`,
    yeni: `  -- 0055: YAYMA YALNIZ ÖDEVİ VERENE. Yöneticinin birden çok sınıfa
  -- verdiği bir ödevi o sınıflardan birinin öğretmeni de açabiliyor; ama
  -- kardeşler BAŞKA öğretmenlerin sınıflarında. Yayabilseydi onların
  -- öğrencilerinin notunu değiştirirdi.
  if d.ogretmen_id <> v_ogretmen then
    raise exception 'Bu ödevi kardeş sınıflara yalnız ödevi veren öğretmen yayabilir.'
      using errcode = '42501';
  end if;

  -- SESSİZ "TAMAM" YOK.`,
    adet: 1,
  },
  {
    fn: 'odev_guncelle',
    eski: `    raise exception 'Sınıf ve son tarih zorunludur.' using errcode = '22023';
  end if;
`,
    yeni: `    raise exception 'Sınıf ve son tarih zorunludur.' using errcode = '22023';
  end if;
  -- 0055: ödev yalnız öğretmenin KENDİ sınıfına taşınabilir. Önceden hiç
  -- denetlenmiyordu; sınıf öğretmeni yöneticinin ödevini düzenleyebildiği
  -- için artık gerekli. Sınıf değişmiyorsa aranmıyor.
  if p_sinif_id is distinct from d.sinif_id
     and not public._ogretmenin_sinifi(v_ogretmen, p_sinif_id) then
    raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
  end if;
`,
    adet: 1,
  },
  {
    fn: 'odev_gonderimleri',
    eski: `        'foto_var', (g.foto_yolu is not null)
      ) order by o.ad)
`,
    yeni: `        'foto_var', (g.foto_yolu is not null),
        -- 0055: yönetici düzeltmesi öğretmende işaretli.
        'duzeltildi', (g.duzelten_yonetici is not null),
        'duzeltme_nedeni', g.duzeltme_nedeni
      ) order by o.ad)
`,
    adet: 1,
  },
];

function govdeCikar(dosya, fn) {
  const metin = readFileSync(resolve(MIG, dosya), 'utf8');
  const bas = `create or replace function public.${fn}(`;
  const i = metin.indexOf(bas);
  if (i < 0 || metin.indexOf(bas, i + 1) >= 0) throw new Error(`${dosya}: ${fn} tam bir kez olmalı`);
  return metin.slice(i, metin.indexOf('\n$$;', i) + 4);
}

console.log('ORTAK ÖDEV DENETİMİ (0055)\n');
console.log('--- A1. Kaynaklar 0055 öncesinin EN SON tanımları mı ---');
{
  const dosyalar = readdirSync(MIG).filter((d) => d.endsWith('.sql')).sort();
  let sapma = 0;
  for (const [fn, kaynak] of Object.entries(KAYNAK)) {
    const arada = dosyalar.filter(
      (d) => d > kaynak && d < HEDEF &&
        readFileSync(resolve(MIG, d), 'utf8').includes(`function public.${fn}(`),
    );
    if (arada.length) { bozuk(`${fn}: ${kaynak} ile 0055 arasında ${arada.join(', ')}`); sapma++; }
  }
  if (!sapma) tamam('on bir kaynağın hiçbiri arada yeniden tanımlanmamış');
}
console.log('--- A2. 0055 gövdeleri = kaynak + listelenen değişimler, BİREBİR ---');
for (const [fn, kaynak] of Object.entries(KAYNAK)) {
  let g = govdeCikar(kaynak, fn);
  const liste = DEGISIMLER.filter((x) => x.fn === fn);
  for (const d of liste) {
    const n = g.split(d.eski).length - 1;
    if (n !== d.adet) bozuk(`${fn}: değişim ${n} kez eşleşti (beklenen ${d.adet})`);
    g = g.split(d.eski).join(d.yeni);
  }
  const depoda = govdeCikar(HEDEF, fn);
  if (g === depoda) tamam(`${fn} (${liste.length} değişim)`);
  else {
    const a = g.split('\n'), b = depoda.split('\n');
    const k = a.findIndex((s, i) => s !== b[i]);
    bozuk(`${fn} listede olmayan bir farkla ayrışmış — ${k + 1}. satır:\n      beklenen: ${a[k]}\n      depoda:   ${b[k]}`);
  }
}

// ============================================================================
// B. ARAYÜZ
// ============================================================================
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const KOK = 'http://127.0.0.1:8788/yeni/';
const YOL = 'cozum/o1/g1.jpg';

const PANO = (alanlar) => ({
  ogrenci_sayisi: 24, odev_verilen_ogrenci: 24, acik_odev: 2,
  bekleyen_degerlendirme: 0, gecikmis_eksik: 0,
  son_gonderimler: [{
    ogrenci: 'Elif Ortak', odev: 'Türev testi', puan: 90,
    zaman: '2026-09-20T10:00:00Z', gecikmeli: false,
    ...(alanlar ? { sinif: '10U', gonderim_id: 'g1' } : {}),
  }],
});

const SATIR = (isaret) => ({
  ogrenci_id: 'o1', ogrenci: 'Elif Ortak', gonderim_id: 'g1', gonderdi: true,
  zaman: '2026-09-20T10:00:00Z', gecikmeli: false, durum: 'puanlandi',
  dogru: 9, yanlis: 1, bos: 0, puan: 90, ogretmen_puan: isaret ? 95 : null,
  ogretmen_yorum: null, yanlis_sorular: [3], bos_sorular: [], foto_var: true,
  ...(isaret === undefined ? {} : { duzeltildi: !!isaret,
       duzeltme_nedeni: isaret ? 'Kâğıdın arkasında ek çözüm var' : null }),
});

/**
 * @param a.ben         ben_kimim cevabı
 * @param a.pano        ogretmen_panosu cevabı
 * @param a.satir       odev_gonderimleri satırı
 */
async function kur(a, yolSon) {
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: 390, height: 900 } });
  await s.addInitScript((a) => {
    localStorage.setItem('sekiz_oturum', JSON.stringify({ rol: 'ogretmen', token: 't'.repeat(64) }));
    window.__cagrilar = [];
    window.__acilan = [];
    // Sekme dokunuş anında BOŞ açılıp sonra adrese yönlendiriliyor
    // (`services/dosya-ac.ts`): sahte sekme yönlendirilen adresi kaydediyor.
    window.open = (u) => {
      if (u) { window.__acilan.push(String(u)); return null; }
      const w = { closed: false, opener: null, document: { title: '', body: { style: {}, textContent: '' } },
        location: { replace: (x) => window.__acilan.push(String(x)) }, close() { w.closed = true; } };
      return w;
    };
    const asil = window.fetch;
    const json = (o, st = 200) =>
      new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
    window.fetch = async (u, o) => {
      const url = String(typeof u === 'string' ? u : u.url);
      let govde = null;
      try { govde = JSON.parse(String(o?.body ?? 'null')); } catch { /* yok */ }
      if (/functions\/v1\/dosya-url/.test(url)) {
        window.__cagrilar.push({ ad: 'dosya-url', govde });
        return json({ imzaliUrl: 'https://depo.sahte/oku/' + govde.yol, gecerlilikSn: 60 });
      }
      const m = url.match(/\/rpc\/([a-z_]+)/);
      if (!m) return asil(u, o);
      window.__cagrilar.push({ ad: m[1], govde });
      switch (m[1]) {
        case 'ben_kimim': return json(a.ben);
        case 'ogretmen_panosu': return json(a.pano);
        case 'gonderim_foto_yolu': return json({ yol: a.YOL, yollar: [a.YOL] });
        case 'puan_duzelt': return json({ durum: 'tamam', puan: govde.p_puan });
        case 'odev_gonderimleri':
          return json({
            odev: { id: 'a1', baslik: 'Türev testi', tur: 'test', sinif: '10U',
                    son_tarih: '2099-12-31', soru_sayisi: 10, gec_teslim: true, yayinda: true },
            ozet: { mevcut: 1, gonderen: 1, gecikmeli: 0, puan_bekleyen: 0 },
            konu_ozeti: [], satirlar: [a.satir],
          });
        default: return json({});
      }
    };
  }, { ...a, YOL });
  const p = await s.newPage();
  await p.goto(KOK + '#' + yolSon, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  return { b, p };
}
const metin = (p) => p.evaluate(() => document.body.innerText);
const cagrilar = (p) => p.evaluate(() => window.__cagrilar);
const acilan = (p) => p.evaluate(() => window.__acilan);
const SAHIP = { id: 's', ad: 'Buket Topuzoğlu', sahip: true, vekalet: false, vekil: null };
const OGRETMEN = { id: 'x', ad: 'Xeda Ortak', sahip: false, vekalet: false, vekil: null };
const VEKALET = { id: 'x', ad: 'Xeda Ortak', sahip: false, vekalet: true,
                  vekil: { id: 's', ad: 'Buket Topuzoğlu' } };

// ---------------------------------------------------------------------------
console.log('--- B1. Pano: adın yanında sınıf, ada tıklayınca çözüm ---');
{
  const { b, p } = await kur({ ben: OGRETMEN, pano: PANO(true) }, '/ogretmen');
  const m = await metin(p);
  if (!/Elif Ortak\s*10U/.test(m)) bozuk('adın yanında sınıf yok');
  else tamam('"Elif Ortak 10U"');
  await p.getByRole('button', { name: 'Elif Ortak — çözümü aç' }).click();
  await p.waitForTimeout(600);
  const a = await acilan(p);
  if (a.length !== 1 || !a[0].endsWith(YOL)) bozuk(`ada tıklayınca çözüm açılmadı: ${JSON.stringify(a)}`);
  else tamam('ada tıklayınca çözüm açıldı');
  await b.close();
}
console.log('--- B2. Pano, 0055 ÖNCESİ cevap: ad düz metin, ekran sağlam ---');
{
  const { b, p } = await kur({ ben: OGRETMEN, pano: PANO(false) }, '/ogretmen');
  const m = await metin(p);
  if (!m.includes('Elif Ortak') || !m.includes('Son gönderimler')) bozuk('0055 öncesi panoda ekran bozuldu');
  else if (await p.getByRole('button', { name: /Elif Ortak/ }).count()) bozuk('gonderim_id yokken ad tıklanabilir');
  else tamam('alan yokken ad düz metin, pano çiziliyor');
  await b.close();
}

// ---------------------------------------------------------------------------
console.log('--- B3. "Puanı düzelt" yalnız SAHİPTE (kendi oturumu ve vekâlet) ---');
for (const [ad, ben, olmali] of [['sahip', SAHIP, true], ['vekâlet', VEKALET, true], ['sıradan öğretmen', OGRETMEN, false]]) {
  const { b, p } = await kur({ ben, satir: SATIR(false) }, '/ogretmen/odevler/a1/gonderimler');
  const var_ = (await p.getByRole('button', { name: 'Puanı düzelt' }).count()) > 0;
  if (var_ !== olmali) bozuk(`${ad}: düğme ${var_ ? 'VAR' : 'yok'} (beklenen ${olmali ? 'var' : 'yok'})`);
  else tamam(`${ad}: düğme ${olmali ? 'var' : 'yok'}`);
  await b.close();
}

// ---------------------------------------------------------------------------
console.log('--- B4. Sebepsiz düzeltme AĞA GİTMİYOR; sebeple gidiyor ---');
{
  const { b, p } = await kur({ ben: SAHIP, satir: SATIR(false) }, '/ogretmen/odevler/a1/gonderimler');
  await p.getByRole('button', { name: 'Puanı düzelt' }).click();
  await p.getByRole('textbox', { name: 'Yeni puan (zorunlu)' }).fill('95');
  await p.getByRole('button', { name: 'Düzeltmeyi kaydet' }).click();
  await p.waitForTimeout(400);
  const gitti = (await cagrilar(p)).filter((c) => c.ad === 'puan_duzelt').length;
  if (gitti || !(await metin(p)).includes('Düzeltmenin sebebini yazın.')) bozuk('sebepsiz düzeltme gitti ya da sebep istenmedi');
  else tamam('sebep istenip çağrı yapılmadı');
  await p.getByRole('textbox', { name: 'Sebep (zorunlu)' }).fill('Kâğıdın arkasında ek çözüm var');
  await p.getByRole('button', { name: 'Düzeltmeyi kaydet' }).click();
  await p.waitForTimeout(600);
  const c = (await cagrilar(p)).filter((x) => x.ad === 'puan_duzelt');
  if (c.length !== 1 || c[0].govde.p_puan !== 95 || c[0].govde.p_neden !== 'Kâğıdın arkasında ek çözüm var' || c[0].govde.p_gonderim !== 'g1') {
    bozuk(`puan_duzelt gövdesi yanlış: ${JSON.stringify(c)}`);
  } else tamam('puan 95, sebep ve gönderim kimliği gitti');
  await b.close();
}

// ---------------------------------------------------------------------------
console.log('--- B5. Öğretmende "Yönetici düzeltti" + sebep; eski satırda işaret yok ---');
{
  const { b, p } = await kur({ ben: OGRETMEN, satir: SATIR(true) }, '/ogretmen/odevler/a1/gonderimler');
  const m = await metin(p);
  if (!m.includes('Yönetici düzeltti: Kâğıdın arkasında ek çözüm var') || !m.includes('95 puan')) bozuk('işaret, sebep ya da 95 görünmüyor');
  else tamam('"Yönetici düzeltti: …" ve 95 puan');
  await b.close();
}
{
  const { b, p } = await kur({ ben: OGRETMEN, satir: SATIR(undefined) }, '/ogretmen/odevler/a1/gonderimler');
  const m = await metin(p);
  if (m.includes('Yönetici düzeltti') || !m.includes('90 puan')) bozuk('0055 öncesi satırda işaret çıktı ya da puan yok');
  else tamam('0055 öncesi satır: işaret yok, 90 puan');
  await b.close();
}

console.log('');
if (hata) { console.log(`ORTAK ÖDEV DENETİMİ BAŞARISIZ — ${hata} sapma`); process.exit(1); }
console.log('ORTAK ÖDEV DENETİMİ GEÇTİ');
