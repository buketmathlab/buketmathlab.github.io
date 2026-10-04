/**
 * SINIF LİSTESİYLE EŞİTLEME (Chromium, taklit RPC) — 0064
 *
 * Öğretmen: "Yeni listeyi eklediğimde tam olarak listedekilerden
 * oluşturmuyor sınıfı. Giden öğrencileri çıkarmıyor sistem."
 *
 *  E1. Varsayılan kip "Sınıfı bu listeyle eşitle"; yapıştırınca sunucudan
 *      plan geliyor ve kaydetmeden önce kim kalır, kim yeni, kim başka
 *      şubeden taşınır, kim çıkar ad ad yazılıyor.
 *  E2. Önizleme yalnız `p_uygula: false` ile; çıkacak öğrenci varken onay
 *      kutusu işaretlenmeden kaydet düğmesi kapalı.
 *  E3. Onay + kaydet → TEK çağrı `p_uygula: true`; sonuç ekranında
 *      çıkarılanlar ve "Şubesi değişti" etiketi.
 *  E4. Sunucu planı reddederse (belirsiz ad) neden yazıyor, kaydet kapalı.
 *  E5. Şubeli dosya: bütün şubeler TEK çağrıda (eskiden şube şube).
 *  E6. "Yalnız ekle" seçilince plan kayboluyor, eski uç kullanılıyor.
 *  E7. 360 px'de taşma yok.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/sinif-esitleme-denetimi.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/#';
let hata = 0;
const olc = (ad, kosul, ayrinti = '') => {
  if (!kosul) hata++;
  console.log(`  ${kosul ? '✓' : '✗'} ${ad}${!kosul && ayrinti ? ` — ${ayrinti}` : ''}`);
};

const SINIFLAR = [
  { id: 's9a', ad: '9A', seviye: 9, sube: 'A', ozel: false, arsiv: false, ogrenci_sayisi: 3 },
  { id: 's9b', ad: '9B', seviye: 9, sube: 'B', ozel: false, arsiv: false, ogrenci_sayisi: 1 },
];
const MEVCUT = {
  kayitlar: [
    { id: 'o1', ad: 'Ali Bir', ogrenci_no: '101', tur: 'okul', sinif: '9A' },
    { id: 'o2', ad: 'Ayşe İki', ogrenci_no: '102', tur: 'okul', sinif: '9A' },
    { id: 'o3', ad: 'Can Üç', ogrenci_no: '103', tur: 'okul', sinif: '9A' },
  ],
  toplam: 3, sayfa: 1, boyut: 100,
};
const plan9A = {
  sinif_id: 's9a', ad: '9A', kalan: 2,
  yeni: [{ ad: 'Ece Beş', no: '105' }],
  tasinan: [{ id: 'o4', ad: 'Deniz Dört', no: '201', eski_sinif: '9B' }],
  cikarilan: [{ id: 'o3', ad: 'Can Üç', ogrenci_no: '103' }],
};
// e-Okul biçimi: sıra, okul numarası, ad (numara sırayla karışmasın diye).
const LISTE = '1 101 Ali Bir\n2 102 Ayşe İki\n3 201 Deniz Dört\n4 105 Ece Beş';

const tarayici = await chromium.launch();

async function sayfa({ genislik = 390, planHatasi = false } = {}) {
  const s = await tarayici.newPage({ viewport: { width: genislik, height: 900 } });
  const cagrilar = [];
  s.on('pageerror', (e) => olc('sayfa hatası yok', false, e.message));
  await s.route('**/rest/v1/rpc/*', (r) => {
    const uc = r.request().url().split('/').pop().split('?')[0];
    const govde = JSON.parse(r.request().postData() ?? '{}');
    cagrilar.push({ uc, govde });
    const json = (o, st = 200) =>
      r.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(o) });
    if (uc === 'siniflar_listesi') return json(SINIFLAR);
    if (uc === 'ogrenciler_listesi') return json(MEVCUT);
    if (uc === 'siniflari_esitle') {
      if (planHatasi) {
        return json({ code: '22023', message: '"Fatma Altı" adında birden çok sınıfta öğrenci var (9B, 9C); hangisinin taşınacağı belirsiz.' }, 400);
      }
      const siniflar = govde.p_siniflar.map((c) =>
        c.sinif_id === 's9a' ? plan9A : { sinif_id: c.sinif_id, ad: '9B', kalan: c.adlar.length, yeni: [], tasinan: [], cikarilan: [] },
      );
      if (!govde.p_uygula) return json({ uygulandi: false, siniflar });
      return json({
        uygulandi: true,
        siniflar,
        eklenen: [
          { id: 'o1', ad: 'Ali Bir', ogrenci_no: '101', sinif: '9A', durum: 'degismedi', ogrenci_kodu: 'AAAA1111', veli_kodu: 'BBBB1111' },
          { id: 'o2', ad: 'Ayşe İki', ogrenci_no: '102', sinif: '9A', durum: 'degismedi', ogrenci_kodu: 'AAAA2222', veli_kodu: 'BBBB2222' },
          { id: 'o4', ad: 'Deniz Dört', ogrenci_no: '201', sinif: '9A', durum: 'tasindi', ogrenci_kodu: 'AAAA4444', veli_kodu: 'BBBB4444' },
          { id: 'o5', ad: 'Ece Beş', ogrenci_no: '105', sinif: '9A', durum: 'eklendi', ogrenci_kodu: 'AAAA5555', veli_kodu: 'BBBB5555' },
        ],
      });
    }
    if (uc === 'ogrenciler_toplu_ekle') {
      return json({ adet: 0, eklenen: [], eklendi: 0, guncellendi: 0, degismedi: 0 });
    }
    return json({});
  });
  await s.addInitScript(() =>
    localStorage.setItem('sekiz_oturum', JSON.stringify({ rol: 'ogretmen', token: 't'.repeat(64) })),
  );
  await s.goto(KOK + '/ogretmen/ogrenciler/toplu', { waitUntil: 'networkidle' });
  await s.waitForTimeout(400);
  return { s, cagrilar };
}
const metin = (s) => s.locator('body').innerText();
const kaydet = (s) => s.getByRole('button', { name: /Listeyi kaydet/ });

console.log('--- E1/E2. Plan kaydetmeden önce; onaysız kaydet kapalı ---');
{
  const { s, cagrilar } = await sayfa();
  await s.selectOption('select', 's9a');
  await s.fill('textarea', LISTE);
  await s.waitForTimeout(1200);
  olc('varsayılan kip: eşitle', await s.getByRole('radio', { name: /Sınıfı bu listeyle eşitle/ }).isChecked());
  const m = await metin(s);
  olc('plan kartı', m.includes('Kaydedince ne olacak') && /9A:\s*2\s*öğrenci kalıyor/.test(m), m.slice(0, 600));
  olc('yeni: Ece Beş', /Yeni\s*1:\s*Ece Beş/.test(m));
  olc("başka şubeden: Deniz Dört (9B'dan), kodları değişmez", m.includes("Deniz Dört (9B'dan)") && m.includes('giriş kodları ve geçmiş notları değişmez'));
  olc('çıkacak: Can Üç', /Sınıftan çıkacak\s*1:\s*Can Üç/.test(m));
  olc('çıkarılanın verisi silinmez yazıyor', m.includes('Ödevleri ve puanları silinmez'));
  const onizleme = cagrilar.filter((c) => c.uc === 'siniflari_esitle');
  olc('önizleme yalnız p_uygula:false', onizleme.length >= 1 && onizleme.every((c) => c.govde.p_uygula === false));
  olc('düğme sayıları yazıyor', (await kaydet(s).innerText()).includes('1 yeni, 1 taşınan, 1 çıkan'), await kaydet(s).innerText());
  olc('onay kutusu işaretlenmeden kaydet kapalı', await kaydet(s).isDisabled());

  console.log('--- E3. Onay + kaydet → tek çağrı, sonuç ---');
  await s.getByRole('checkbox', { name: /çıkarılmasını onaylıyorum/ }).check();
  olc('onaydan sonra kaydet açık', await kaydet(s).isEnabled());
  await kaydet(s).click();
  await s.waitForTimeout(800);
  const uygula = cagrilar.filter((c) => c.uc === 'siniflari_esitle' && c.govde.p_uygula === true);
  olc('tek uygulama çağrısı', uygula.length === 1, String(uygula.length));
  const y = uygula[0]?.govde.p_siniflar ?? [];
  olc('yük: 9A, 4 ad numarasıyla', y.length === 1 && y[0].sinif_id === 's9a' && y[0].adlar.length === 4 && y[0].adlar[0].no === '101', JSON.stringify(y));
  olc('eski uç çağrılmadı', !cagrilar.some((c) => c.uc === 'ogrenciler_toplu_ekle'));
  const r = await metin(s);
  olc('sonuç başlığı: taşındı ve çıkarıldı', r.includes('1 öğrenci başka şubeden taşındı') && r.includes('1 öğrenci sınıftan çıkarıldı'), r.slice(0, 300));
  olc('çıkarılanlar listesi', /Sınıftan çıkarılanlar \(1\)[\s\S]*Can Üç/.test(r));
  olc('"Şubesi değişti" etiketi', r.includes('Şubesi değişti'));
  await s.close();
}

console.log('--- E4. Plan reddedilirse neden yazıyor ---');
{
  const { s } = await sayfa({ planHatasi: true });
  await s.selectOption('select', 's9a');
  await s.fill('textarea', LISTE + '\n5 106 Fatma Altı');
  await s.waitForTimeout(1200);
  const m = await metin(s);
  olc('neden yazıyor', m.includes('Liste karşılaştırılamadı') && m.includes('birden çok sınıfta öğrenci var'));
  olc('kaydet kapalı', await kaydet(s).isDisabled());
  await s.close();
}

console.log('--- E5. Şubeli dosya tek çağrıda ---');
{
  const { s, cagrilar } = await sayfa();
  await s.fill(
    'textarea',
    [
      'AL - 9. Sınıf / A Şubesi (Sayısal) Sınıf Listesi',
      'S.No Öğrenci No Adı Soyadı Cinsiyeti',
      '1 101 ALİ BİR Erkek',
      '2 102 AYŞE İKİ Kız',
      'AL - 9. Sınıf / B Şubesi (Sözel) Sınıf Listesi',
      'S.No Öğrenci No Adı Soyadı Cinsiyeti',
      '1 301 FATMA ALTI Kız',
    ].join('\n'),
  );
  await s.waitForTimeout(1200);
  const onizleme = cagrilar.filter((c) => c.uc === 'siniflari_esitle').pop();
  const yuk = onizleme?.govde.p_siniflar ?? [];
  olc('iki şube tek çağrıda', yuk.length === 2 && yuk.map((c) => c.sinif_id).join(',') === 's9a,s9b', JSON.stringify(yuk));
  await s.close();
}

console.log('--- E6. Yalnız ekle ---');
{
  const { s, cagrilar } = await sayfa();
  await s.selectOption('select', 's9a');
  await s.fill('textarea', LISTE);
  await s.waitForTimeout(1000);
  await s.getByRole('radio', { name: /Yalnız ekle/ }).check();
  await s.waitForTimeout(300);
  olc('plan kartı kayboldu', !(await metin(s)).includes('Kaydedince ne olacak'));
  await s.getByRole('button', { name: /(öğrenci ekle|güncelle)$/i }).first().click();
  await s.waitForTimeout(700);
  olc('eski uç kullanıldı', cagrilar.some((c) => c.uc === 'ogrenciler_toplu_ekle'));
  olc('eşitleme uygulanmadı', !cagrilar.some((c) => c.uc === 'siniflari_esitle' && c.govde.p_uygula === true));
  await s.close();
}

console.log('--- E7. 360 px ---');
{
  const { s } = await sayfa({ genislik: 360 });
  await s.selectOption('select', 's9a');
  await s.fill('textarea', LISTE);
  await s.waitForTimeout(1200);
  const tasma = await s.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  olc('taşma yok', tasma <= 0, `${tasma}px`);
  await s.close();
}

await tarayici.close();
console.log('');
if (hata) {
  console.log(`SINIF EŞİTLEME DENETİMİ BAŞARISIZ — ${hata} sapma`);
  process.exit(1);
}
console.log('SINIF EŞİTLEME DENETİMİ GEÇTİ');
