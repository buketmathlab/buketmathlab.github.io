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
              // TAKLİT GERÇEĞE SADIK OLMALI. 0042'den sonra eleman ya
              // dizgi ya `{ad, no}`; sahte sunucu `ad`ı aynen yansıtınca
              // ekrana nesne basılıyordu ve sonuç tablosu boş çıkıyordu.
              // Gerçek sunucu da tam bu ayrımı yapıyor (`_toplu_ad`).
              eklenen: adlar.map((e, i) => ({
                id: 'y' + i,
                ad: typeof e === 'string' ? e : e.ad,
                ogrenci_no: typeof e === 'string' ? null : (e.no ?? null),
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
  // 0042'DEN SONRA GÖVDE NESNE TAŞIYOR: {ad, no}. Bu denetim eskiden
  // dizgi bekliyordu ve değişikliği yakaladı — bir ölçümün işi tam da bu.
  const gidenAdlar = (govde?.p_adlar ?? []).map((a) =>
    typeof a === 'string' ? a : a.ad,
  );
  de(
    gidenAdlar.every((a) => typeof a === 'string' && a.length > 0),
    'her satırda bir ad var',
  );
  de(
    !gidenAdlar.some((a) => a === a.toLocaleUpperCase('tr') && /[A-ZÇĞİÖŞÜ]/.test(a)),
    'sunucuya düzeltilmiş adlar gitti, BÜYÜK HARF hâli değil',
  );
  de(gidenAdlar.includes('Işık Öztürk'), 'Türkçe düzeltme sunucuya taşındı');
  // Yapıştırma yolunda numara yok: alan var ama null. Uydurulmamalı.
  de(
    (govde?.p_adlar ?? []).every((a) => typeof a === 'object' && a.no === null),
    'numarasız listede numara uydurulmuyor',
  );
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

console.log('8 — e-OKUL PDF\'İ YÜKLENİYOR (0042)');
{
  /**
   * SAHTE AMA GERÇEK YAPILI bir e-Okul listesi üretir.
   *
   * Depo herkese açık; buraya gerçek öğrenci adı konmaz. Yapı gerçek bir
   * 9. sınıf listesinden ölçülerek çıkarıldı: başlık, kurum, sınıf
   * öğretmeni satırı, tablo başlığı, öğrenci satırları, altbilgi.
   *
   * Harfler Latin-1'de bulunanlardan seçildi (Helvetica/WinAnsi): ş ve ğ
   * yok. O harflerin bitişik parça olarak gelmesi ayrı bir kusur ve yeri
   * `pdf-metin.test.ts` — orada ölçülüyor.
   */
  function eokulPdfi() {
    // TÜRKÇE HARFLER FONTA TANITILIYOR.
    //
    // Helvetica/WinAnsi'de ş, ğ, İ, ı YOK. İlk yazımda satırlar ASCII'ye
    // düşürülmüştü ("VALILIGI") ve denetim yanlış kırmızı yandı: kalıplar
    // haklı olarak tutmadı, ama kusur üründe değil ÖLÇÜMDEYDİ. Türkçesiz
    // bir liste, e-Okul listesi değildir.
    //
    // `/Differences` ile bu glifler kod noktalarına bağlanıyor; pdf.js
    // glif adlarını Unicode'a çeviriyor.
    const G = { 'ğ': '\\310', 'Ğ': '\\311', 'ş': '\\312', 'Ş': '\\313', 'ı': '\\314', 'İ': '\\315' };
    const kacir = (s) => s.replace(/[ğĞşŞıİ]/g, (c) => G[c]).replace(/[ç]/g, '\\347')
      .replace(/[Ç]/g, '\\307').replace(/[ö]/g, '\\366').replace(/[Ö]/g, '\\326')
      .replace(/[ü]/g, '\\374').replace(/[Ü]/g, '\\334');

    const satirlar = [
      'T.C.',
      'İSTANBUL VALİLİĞİ',
      'Örnek Anadolu Lisesi Müdürlüğü',
      'Sınıf Öğretmeni: NURAY ÖRNEK Sınıf Başkanı:',
      'S.No Öğrenci No Adı Soyadı Cinsiyeti',
      '1 601 ALİ YILMAZ Erkek',
      '2 602 AYŞE ÖZTÜRK Kız',
      '3 603 MEHMET ÇOBAN Erkek',
      // AYNI NUMARA BİLEREK: uyarının çıktığı ve satırın DÜŞMEDİĞİ ölçülüyor.
      '4 601 ZEYNEP ÖZ Kız',
      'Kız Öğrenci Sayısı : 2 Erkek Öğrenci Sayısı : 2',
    ];
    const icerik = satirlar
      .map((s, i) => `BT /F1 10 Tf 40 ${780 - i * 20} Td (${kacir(s)}) Tj ET`)
      .join('\n');
    const fark =
      '<</Type/Encoding/BaseEncoding/WinAnsiEncoding/Differences[' +
      '200/gbreve 201/Gbreve 202/scedilla 203/Scedilla 204/dotlessi 205/Idotaccent]>>';
    const nesneler = [
      '<</Type/Catalog/Pages 2 0 R>>',
      '<</Type/Pages/Kids[3 0 R]/Count 1>>',
      '<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>',
      `<</Length ${icerik.length}>>\nstream\n${icerik}\nendstream`,
      `<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding ${fark}>>`,
    ];
    let pdf = '%PDF-1.4\n';
    const yerler = [];
    nesneler.forEach((n, i) => {
      yerler.push(pdf.length);
      pdf += `${i + 1} 0 obj\n${n}\nendobj\n`;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${nesneler.length + 1}\n0000000000 65535 f \n`;
    for (const y of yerler) pdf += `${String(y).padStart(10, '0')} 00000 n \n`;
    pdf += `trailer\n<</Size ${nesneler.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf, 'latin1');
  }

  await p.goto(KOK + '#/ogretmen/ogrenciler/toplu', { waitUntil: 'networkidle' });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(600);

  // PDF ALANI İSTEĞE BAĞLI: yapıştırma yolu bozulmamalı.
  const pdfAlani = p.locator('input[type="file"]');
  de(await pdfAlani.count() === 1, 'PDF alanı ekranda var');
  de(
    (await pdfAlani.getAttribute('accept'))?.includes('pdf') === true,
    'yalnız PDF kabul ediyor',
  );
  de(
    await p.locator('textarea').isVisible(),
    'yapıştırma kutusu duruyor — PDF yolu onu değiştirmiyor',
  );

  // SINIF SEÇİLMELİ: yeniden yükleme seçimi sıfırlıyor ve `ekle()` sınıfsız
  // erken dönüyor. İlk yazımda bu atlanmıştı ve "sunucuya gitti mi" ölçümü
  // boş dizi görüp kırmızı yandı — kusur üründe değil ölçümdeydi.
  await p.selectOption('select', 's9a');
  await p.waitForTimeout(300);

  await pdfAlani.setInputFiles({
    name: '9A.pdf',
    mimeType: 'application/pdf',
    buffer: eokulPdfi(),
  });
  await p.waitForTimeout(1500);

  const kutu = await p.locator('textarea').inputValue();
  de(kutu.includes('ALİ YILMAZ'), 'PDF okundu ve metin kutusuna döküldü');
  de(kutu.includes('T.C.'), 'ham satırlar kutuda — öğretmen ne geldiğini görüyor');

  // ASIL ÖLÇÜM: KAYDEDİLECEK ADLAR.
  //
  // Yalnız önizlemedeki ad satırları okunuyor. İlk yazımda sayfadaki bütün
  // `li`'ler taranıyordu ve ölçüm yanlış kırmızı yandı: elenen satırlar da,
  // her adın ham hâli de ekranda BİLEREK gösteriliyor ("T.C." elenenler
  // listesinde durmalı). Ölçülmesi gereken şey ekranda ne yazdığı değil,
  // SUNUCUYA NE GİDECEĞİ.
  // ADI ROZETİ ÇIKARARAK OKU. 0042'den sonra numara adın `<p>`'si içinde
  // bir rozet; düz `textContent` alsaydık "adda rakam yok" ölçümü numara
  // yüzünden kırmızı yanardı — ölçülmek istenen şey KAYDEDİLECEK AD.
  const adlar = await p.evaluate(() =>
    [...document.querySelectorAll('ul.divide-y > li > div > p.font-semibold')].map((e) => {
      const kopya = e.cloneNode(true);
      kopya.querySelectorAll('span.sk-sayi').forEach((s) => s.remove());
      return kopya.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    }),
  );
  de(adlar.length === 4, `4 öğrenci önizlemede (${adlar.length})`);
  de(!adlar.some((a) => /nuray/i.test(a)), 'ÖĞRETMEN ADI öğrenci sayılmamış');
  de(adlar.some((a) => /ali y\u0131lmaz/i.test(a)), 'öğrenci adı önizlemede');

  const hepsi = adlar.join(' | ');
  de(!/T\.C\./.test(hepsi), '"T.C." öğrenci sayılmamış');
  de(!/valili/i.test(hepsi), 'kurum adı öğrenci sayılmamış');
  de(!/lisesi/i.test(hepsi), 'okul adı öğrenci sayılmamış');
  de(!/s\.no|cinsiyet/i.test(hepsi), 'tablo başlığı öğrenci sayılmamış');
  de(!/say\u0131s\u0131/i.test(hepsi), 'altbilgi öğrenci sayılmamış');
  de(!/\d/.test(hepsi), 'okul numarası adın içinde kalmamış');
  de(!/\b(erkek|k\u0131z)\b/i.test(hepsi), 'cinsiyet adın içinde kalmamış');

  // ELENENLER GÖRÜNÜYOR: sessizce yok olmamalı, öğretmen ne atıldığını
  // görüp itiraz edebilmeli.
  const elenen = await p.evaluate(
    () => document.body.innerText.includes('satır okunamadı'),
  );
  de(elenen, 'elenen satırlar sebebiyle ekranda gösteriliyor');

  // --- 0042: OKUL NUMARASI ---
  //
  // Numara ADIN İÇİNDE DEĞİL, AYRI bir rozette. Yukarıdaki `hepsi`
  // ölçümü zaten adda rakam olmadığını söylüyor; burada numaranın
  // GERÇEKTEN GÖRÜNDÜĞÜ ölçülüyor — yoksa "adda rakam yok" ölçümü,
  // numara tamamen kaybolsa da yeşil kalırdı.
  const rozetler = await p.evaluate(() =>
    [...document.querySelectorAll('ul.divide-y > li > div > p.font-semibold > span.sk-sayi')]
      .map((e) => e.textContent?.trim() ?? ''),
  );
  de(
    JSON.stringify(rozetler) === JSON.stringify(['601', '602', '603', '601']),
    `numaralar ayrı rozette: ${JSON.stringify(rozetler)}`,
  );

  // AYNI NUMARA UYARI VERİYOR AMA SATIR DURUYOR — öğretmenin kararı.
  const uyarilar = await p.evaluate(() =>
    [...document.querySelectorAll('ul.divide-y > li')]
      .map((li) => li.textContent ?? '')
      .filter((s) => s.includes('Numara tekrarı')).length,
  );
  de(uyarilar === 1, `numara tekrarı uyarısı bir kez çıktı (${uyarilar})`);

  // ASIL ÖLÇÜM: uyarı ENGEL DEĞİL. Dört satırın dördü de duruyor.
  de(adlar.length === 4, 'numara tekrarı satırı düşürmedi');

  // SUNUCUYA {ad, no} GİDİYOR: ekranda görünmesi yetmez, kaydedilecek
  // olan şey numarayı taşımalı.
  // İSTEK AĞA ÇIKMIYOR: bu denetim `fetch`i sayfanın içinde taklit ediyor
  // (`window.__cagrilar`). İlk yazımda `p.route` kullanılmıştı ve hiç
  // tetiklenmedi — ölçüm boş dizi görüp kırmızı yandı. Kayıt sayfanın
  // kendisinde; oradan okunuyor.
  await p.evaluate(() => {
    window.__cagrilar.length = 0;
  });
  await p.getByRole('button', { name: /öğrenci ekle$/i }).first().click();
  await p.waitForTimeout(700);
  const gonderilen = await p.evaluate(
    () =>
      window.__cagrilar.find((c) => c.ad === 'ogrenciler_toplu_ekle')?.govde?.p_adlar ?? [],
  );
  de(
    JSON.stringify(gonderilen) ===
      JSON.stringify([
        { ad: 'Ali Yılmaz', no: '601' },
        { ad: 'Ayşe Öztürk', no: '602' },
        { ad: 'Mehmet Çoban', no: '603' },
        { ad: 'Zeynep Öz', no: '601' },
      ]),
    `sunucuya ad ve numara birlikte gidiyor: ${JSON.stringify(gonderilen)}`,
  );
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
