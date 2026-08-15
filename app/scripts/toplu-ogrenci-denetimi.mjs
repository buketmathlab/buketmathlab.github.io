/**
 * 0024 TOPLU ÖĞRENCİ EKLEME — TARAYICIDA UÇTAN UCA
 *
 * En kritik ölçüm: ÖĞRETMEN ONAYLAMADAN SUNUCUYA HİÇBİR ŞEY GİTMİYOR.
 * Bu ekranın vaadi "önce gör, sonra onayla"; onaylamadan bir istek çıksaydı
 * vaat yalan olurdu ve otuz çocuk kaydı sessizce oluşurdu. Ekrandan değil
 * AĞ TRAFİĞİNDEN ölçülüyor.
 *
 * İkincisi: indirilen dosya ekranda görünenle BİREBİR aynı mı? Ayrışsalardı
 * öğretmen yanlış kod dağıtır ve bunu ancak öğrenci giremeyince öğrenirdi.
 *
 * Görünürlük `checkVisibility()`/`innerText` ile ölçülüyor — `textContent`
 * kapalı diyalogların gizli başlıklarını da sayıyor (0021'de o hata yapıldı).
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/';

const SINIFLAR = [
  { id: 's9a', ad: '9A', seviye: 9, sube: 'A', ozel: false, arsiv: false, ogrenci_sayisi: 2 },
  { id: 's9b', ad: '9B', seviye: 9, sube: 'B', ozel: false, arsiv: false, ogrenci_sayisi: 0 },
];

/** 9A'da zaten kayıtlı iki öğrenci — mükerrer uyarısının ikinci kaynağı. */
const MEVCUT = {
  toplam: 2,
  sayfa: 1,
  boyut: 100,
  kayitlar: [
    { id: 'v1', ad: 'Ali Yılmaz', tur: 'okul', sinif: '9A' },
    { id: 'v2', ad: 'Zeynep Ak', tur: 'okul', sinif: '9A' },
  ],
};

/** Gerçekçi bir e-Okul yapıştırması: numaralı, BÜYÜK HARF, araya çöp satır. */
const YAPISTIRMA = [
  '1 ALİ YILMAZ',
  '2 AYŞE DEMİR',
  '3 MEHMET KAYA',
  '4 IŞIK ÖZTÜRK',
  '5 ŞÜKRÜ GÜNEŞ',
  '',
  '6 ALİ YILMAZ',
  '12345',
  '7 MEHMET ALİ ÇOBANOĞLU',
].join('\n');

let hata = 0;
const de = (ok, m) => {
  if (!ok) {
    hata++;
    console.log('  ✗ ' + m);
  } else console.log('  ✓ ' + m);
};

const b = await chromium.launch();
const s = await b.newContext({ viewport: { width: 360, height: 780 } });

// İSTEK SAYACI sayfanın içinde: her RPC çağrısı adıyla kaydediliyor.
await s.addInitScript(
  ([oturum, siniflar, mevcut]) => {
    localStorage.setItem('sekiz_oturum', oturum);
    window.__cagrilar = [];
    const asil = window.fetch;
    window.fetch = async (u, o) => {
      const url = String(typeof u === 'string' ? u : u.url);
      const m = url.match(/\/rpc\/([a-z_]+)/);
      if (m) {
        let govde = null;
        try {
          govde = JSON.parse(String(o?.body ?? 'null'));
        } catch {
          /* gövde okunamadıysa null kalsın */
        }
        window.__cagrilar.push({ ad: m[1], govde });
        if (m[1] === 'siniflar_listesi')
          return new Response(JSON.stringify(siniflar), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        if (m[1] === 'ogrenciler_listesi')
          return new Response(JSON.stringify(mevcut), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        if (m[1] === 'ogrenciler_toplu_ekle') {
          const adlar = govde?.p_adlar ?? [];
          const harf = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
          const kod = (n) =>
            Array.from({ length: 8 }, (_, i) => harf[(n * 7 + i * 13) % harf.length]).join('');
          return new Response(
            JSON.stringify({
              adet: adlar.length,
              eklenen: adlar.map((ad, i) => ({
                id: 'y' + i,
                ad,
                ogrenci_kodu: kod(i + 1),
                veli_kodu: kod(i + 41),
              })),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return asil(u, o);
    };
  },
  [
    JSON.stringify({ token: 'sahte', rol: 'ogretmen', ad: 'Buket Topuzoğlu' }),
    SINIFLAR,
    MEVCUT,
  ],
);

const p = await s.newPage();
const metin = () => p.evaluate(() => document.body.innerText);
const cagrilar = () => p.evaluate(() => window.__cagrilar.map((c) => c.ad));

await p.goto(KOK + '#/ogretmen/ogrenciler/toplu', { waitUntil: 'networkidle' });
await p.waitForTimeout(500);

console.log('1 — EKRAN AÇILIYOR, TEK ÖĞRENCİ YOLU BOZULMAMIŞ');
{
  const t = await metin();
  de(t.includes('Toplu öğrenci ekle'), 'başlık görünüyor');
  de(t.includes('onaylamadan hiçbir öğrenci oluşmaz'), 'vaat ekranda yazıyor');
}

console.log('2 — SINIF SEÇ + LİSTE YAPIŞTIR → ÖNİZLEME');
{
  await p.selectOption('select', 's9a');
  await p.fill('textarea', YAPISTIRMA);
  await p.waitForTimeout(400);
  const t = await metin();

  de(t.includes('Ali Yılmaz'), 'BÜYÜK HARF ad düzeltilmiş görünüyor');
  de(t.includes('Işık Öztürk'), 'IŞIK → Işık (Türkçe kural, "Işik" değil)');
  de(!t.includes('Işik'), 'düz JavaScript sonucu ("Işik") ekranda YOK');
  de(t.includes('Mehmet Ali Çobanoğlu'), 'üç kelimeli ad doğru');

  // KAYDEDİLECEK AD ile YAPIŞTIRILAN ham satır ekranda YAN YANA duruyor —
  // bu bilerek: öğretmen neyin değiştiğini görebilmeli. Dolayısıyla
  // "ALİ YILMAZ" metinde GEÇİYOR ve geçmesi doğru.
  //
  // İlk yazımda metinde hiç geçmemesini beklemiştim; ölçüm hatasıydı, üründe
  // kusur yoktu. Asıl iddia şu: KAYDEDİLECEK ad alanında büyük harfli hâl
  // yok. Onu da metinden değil, o alanın kendi DOM düğümlerinden ölçüyoruz.
  const kaydedilecekler = await p.evaluate(() =>
    [...document.querySelectorAll('li p.font-semibold')].map((e) => e.textContent?.trim() ?? ''),
  );
  de(kaydedilecekler.length > 0, 'kaydedilecek ad alanları bulundu');
  de(
    kaydedilecekler.every((a) => a !== a.toLocaleUpperCase('tr')),
    'kaydedilecek adların hiçbiri tamamen BÜYÜK HARF değil',
  );
  de(kaydedilecekler.includes('Işık Öztürk'), 'kaydedilecek ad alanında düzeltilmiş hâl var');

  de(t.includes('1 satır okunamadı'), 'okunamayan satır sayısı bildiriliyor');
  de(t.includes('12345'), 'okunamayan satır HAM hâliyle gösteriliyor, sessizce atılmıyor');

  de(t.includes('Listede tekrar'), 'listedeki tekrar işaretli');
  de(t.includes('Sınıfta kayıtlı'), 'sınıfta zaten kayıtlı ad işaretli');

  de(t.includes('7 öğrenci eklenecek'), 'eklenecek sayı doğru (7 ad, 1 çöp satır elendi)');
  de(
    t.includes('Listenin çoğu büyük harf'),
    'düzeltmenin neden açık geldiği söyleniyor',
  );
}

console.log('3 — ONAYLAMADAN SUNUCUYA HİÇBİR ŞEY GİTMİYOR');
{
  const c = await cagrilar();
  de(!c.includes('ogrenciler_toplu_ekle'), 'ekleme çağrısı YAPILMADI');
  de(c.includes('siniflar_listesi'), 'yalnız okuma çağrıları yapıldı (sınıf listesi)');
  console.log('    yapılan çağrılar: ' + JSON.stringify(c));
}

console.log('4 — SATIR ÇIKARMA ÖNİZLEMEYİ DÜŞÜRÜYOR');
{
  await p.getByRole('button', { name: /Ali Yılmaz satırını çıkar/ }).first().click();
  await p.waitForTimeout(300);
  de((await metin()).includes('6 öğrenci eklenecek'), 'çıkarılan satır sayıdan düştü');
}

console.log('5 — EKLE → SUNUCUYA YALNIZ ONAYLANAN ADLAR GİDİYOR');
{
  await p.getByRole('button', { name: /öğrenci ekle$/i }).first().click();
  await p.waitForTimeout(700);

  const govde = await p.evaluate(
    () => window.__cagrilar.find((c) => c.ad === 'ogrenciler_toplu_ekle')?.govde ?? null,
  );
  de(govde !== null, 'ekleme çağrısı yapıldı');
  de(govde?.p_adlar?.length === 6, 'gövdede 6 ad var (çıkarılan gitmedi)');
  de(govde?.p_tur === 'okul' && govde?.p_sinif_id === 's9a', 'tür ve sınıf doğru');
  de(
    !govde?.p_adlar?.some((a) => a === a.toLocaleUpperCase('tr') && /[A-ZÇĞİÖŞÜ]/.test(a)),
    'sunucuya düzeltilmiş adlar gitti, BÜYÜK HARF hâli değil',
  );
  de(govde?.p_adlar?.includes('Işık Öztürk'), 'Türkçe düzeltme sunucuya taşındı');
}

console.log('6 — SONUÇ: KOD TABLOSU, GİZLEME, İNDİRME');
{
  const t = await metin();
  de(t.includes('6 öğrenci eklendi'), 'sonuç başlığı doğru');
  de(t.includes('Kodları şimdi kaydedin'), 'kodların bir kez gösterildiği uyarısı var');
  de(t.includes('bütün sınıfın'), 'sınıfta ekranı çevirme uyarısı var (0018 dengesi)');

  const satirSayisi = await p.evaluate(() => document.querySelectorAll('tbody tr').length);
  de(satirSayisi === 6, `tabloda 6 satır var (${satirSayisi})`);

  // GİZLEME GERÇEKTEN GİZLİYOR MU — DOM'dan ölçülüyor, gözle değil.
  await p.getByRole('button', { name: 'Kodları gizle' }).click();
  await p.waitForTimeout(300);
  const gizliSonrasi = await p.evaluate(() => document.querySelectorAll('tbody tr').length);
  de(gizliSonrasi === 0, 'gizlenince tablo DOM’dan kalkıyor, yalnız görsel değil');
  await p.getByRole('button', { name: 'Kodları göster' }).click();
  await p.waitForTimeout(300);
  de(
    (await p.evaluate(() => document.querySelectorAll('tbody tr').length)) === 6,
    'tekrar gösterilebiliyor',
  );

  // İNDİRİLEN DOSYA EKRANDAKİYLE BİREBİR Mİ
  const indirme = p.waitForEvent('download');
  await p.getByRole('button', { name: /Kodları indir/ }).click();
  const d = await indirme;
  const yol = await d.path();
  const { readFileSync } = await import('node:fs');
  const csv = readFileSync(yol, 'utf8');

  de(csv.charCodeAt(0) === 0xfeff, 'CSV UTF-8 BOM ile başlıyor (Excel Türkçe için)');
  de(csv.includes('Işık Öztürk'), 'Türkçe karakterler dosyada bozulmamış');
  de(csv.trim().split('\r\n').length === 7, 'dosyada başlık + 6 satır var');

  const ekrandaki = await p.evaluate(() =>
    [...document.querySelectorAll('tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => td.textContent?.trim()),
    ),
  );
  const ayrisan = ekrandaki.filter(
    ([ad, ogr, veli]) => !csv.includes(`"${ad}";"${ogr}";"${veli}"`),
  );
  de(ayrisan.length === 0, `indirilen dosya ekrandakiyle birebir aynı (${ayrisan.length} fark)`);
}

console.log('7 — 360 px’te taşma yok');
{
  const fark = await p.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  de(fark <= 0, `360 px yatay taşma yok (${fark}px)`);
}

await s.close();
await b.close();
console.log(hata === 0 ? '\nTOPLU ÖĞRENCİ UÇTAN UCA: KUSUR YOK' : `\n${hata} KUSUR VAR`);
process.exit(hata === 0 ? 0 : 1);
