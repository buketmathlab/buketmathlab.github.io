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
    { id: 'v1', ad: 'Ali Yılmaz', ogrenci_no: null, tur: 'okul', sinif: '9A' },
    { id: 'v2', ad: 'Zeynep Ak', ogrenci_no: null, tur: 'okul', sinif: '9A' },
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
        // TAKLİT GERÇEĞE SADIK: `sinif_ekle` idempotent ve eklediği sınıfı
        // listeye katıyor — gerçek sunucu da öyle yapıyor. Katmasaydı
        // "oluştur"dan sonra şube hâlâ eksik görünür ve denetim ürünü
        // haksız yere suçlardı.
        if (m[1] === 'sinif_ekle') {
          const ad = `${govde.p_seviye}${govde.p_sube}`;
          if (!siniflar.some((s) => s.ad === ad)) {
            siniflar.push({
              id: 's' + ad.toLowerCase(),
              ad,
              seviye: govde.p_seviye,
              sube: govde.p_sube,
              ozel: false,
              arsiv: false,
              ogrenci_sayisi: 0,
            });
          }
          return new Response(JSON.stringify({ ad }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
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
          // TAKLİT GERÇEĞE SADIK OLMALI (0043).
          //
          // Sahte sunucu `p_mevcutlari_guncelle`yi yok saysaydı, ekran
          // "güncellendi" diyemez ve bayrağın bir işe yaradığı hiç
          // ölçülmezdi — denetim, bayrak sunucuda hiç okunmasa da yeşil
          // kalırdı. Burada eşleştirme gerçek kuralla yapılıyor: aynı
          // sınıfta, Türkçe küçük harfe indirgenmiş aynı ad, ve aynı
          // çağrıda bir kez.
          const eslestir = govde?.p_mevcutlari_guncelle === true;
          const anah = (a) => a.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr');
          const kayitli = new Map(mevcut.kayitlar.map((k) => [anah(k.ad), k]));
          const dokunulan = new Set();
          const satirlar = adlar.map((e, i) => {
            // 0042'den sonra eleman ya dizgi ya `{ad, no}`; gerçek sunucu
            // da tam bu ayrımı yapıyor (`_toplu_ad`).
            const ad = typeof e === 'string' ? e : e.ad;
            const no = typeof e === 'string' ? null : (e.no ?? null);
            const m2 = eslestir ? kayitli.get(anah(ad)) : undefined;
            if (m2 && !dokunulan.has(m2.id)) {
              dokunulan.add(m2.id);
              return {
                id: m2.id,
                ad: m2.ad, // kayıttaki ad değişmiyor
                ogrenci_no: no ?? m2.ogrenci_no ?? null,
                durum: no ? 'guncellendi' : 'degismedi',
                // MEVCUT kodlar — yenilenmiyor.
                ogrenci_kodu: kod(m2.id.length + 3),
                veli_kodu: kod(m2.id.length + 9),
              };
            }
            return {
              id: 'y' + i,
              ad,
              ogrenci_no: no,
              durum: 'eklendi',
              ogrenci_kodu: kod(i + 1),
              veli_kodu: kod(i + 41),
            };
          });
          return new Response(
            JSON.stringify({
              adet: satirlar.length,
              eklenen: satirlar,
              eklendi: satirlar.filter((r) => r.durum === 'eklendi').length,
              guncellendi: satirlar.filter((r) => r.durum === 'guncellendi').length,
              degismedi: satirlar.filter((r) => r.durum === 'degismedi').length,
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

/**
 * GÖNDER DÜĞMESİ. Etiketi 0043'ten sonra KARARA göre değişiyor
 * ("6 öğrenci ekle" ya da "5 ekle, 1 güncelle"); sabit bir ada bağlanan
 * seçici, etiket doğru değiştiği için kırılırdı. Etiketin kendisi ayrı
 * bir ölçüm (4b) — burada yalnız düğmeye basılıyor.
 */
const gonder = () =>
  p.getByRole('button', { name: /(öğrenci ekle|güncelle)$/i }).first();

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
  // 0043: etiket artık NE OLACAĞINI söylüyor. "Sınıfta kayıtlı" tek başına
  // bir bilgiydi; öğretmen ondan sonuca varamıyordu.
  de(t.includes('Numarası güncellenecek'), 'kayıtlı ad için sonuç etiketi var');

  de(t.includes('7 öğrenci eklenecek'), 'eklenecek sayı doğru (7 ad, 1 çöp satır elendi)');
  // EŞLEŞEN SAYISI, LİSTEDE TEKRAR EDEN KAYITLI ADI DA SAYIYOR.
  //
  // Listede "ALİ YILMAZ" iki kez var ve ikisi de sınıfta kayıtlı bir adın
  // karşılığı. Sayım `mukerrer` alanına dayansaydı ikincisi 'liste'
  // yazdığı için düşerdi ve önizleme "1 eşleşti" derdi — sunucu ise iki
  // satırı da eşleştirirdi. Önizleme, olacak şeyi anlatmalı.
  de(/2 öğrenci sınıfta zaten kayıtlı/.test(t), 'eşleşen sayısı 2 (ikinci Ali de sayıldı)');
  de(/5 tanesi yeni/.test(t), 'yeni sayısı 5');
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

console.log('4b — EŞLEŞME KARARI KAYDETMEDEN ÖNCE SORULUYOR (0043)');
{
  // Öğretmenin bütün sınıfları iki katına çıktı çünkü bu karar hiç
  // sorulmuyordu: "Sınıfta kayıtlı" bir uyarıydı, bir yol değil.
  const t = await metin();
  de(/1 öğrenci sınıfta zaten kayıtlı/.test(t), 'eşleşen sayısı yazıyor');
  de(/5 tanesi yeni/.test(t), 'yeni sayısı yazıyor');
  de(t.includes('Mevcut öğrencilerin numarasını güncelle'), 'güncelleme seçeneği var');
  de(t.includes('Yeni öğrenci olarak ekle'), 'ikinci kayıt seçeneği var');
  de(t.includes('giriş kodları değişmez'), 'kodun değişmeyeceği söyleniyor');

  const secili = await p.evaluate(() =>
    [...document.querySelectorAll('input[name="eslestirme"]')].map((e) => e.checked),
  );
  de(
    JSON.stringify(secili) === JSON.stringify([true, false]),
    `eşleşen varken varsayılan GÜNCELLE (${JSON.stringify(secili)})`,
  );

  // KARAR DÜĞMEYE DE YANSIYOR: ne olacağı tıklamadan önce okunuyor.
  const etiket = await p.evaluate(
    () => [...document.querySelectorAll('button')].map((b) => b.textContent?.trim()),
  );
  de(
    etiket.some((e) => e === '5 ekle, 1 güncelle'),
    `düğme kararı yazıyor: ${JSON.stringify(etiket.filter((e) => /ekle|güncelle/.test(e ?? '')))}`,
  );

  // ÖTEKİ SEÇENEK: etiket ve düğme birlikte değişmeli.
  await p.locator('input[name="eslestirme"]').nth(1).check();
  await p.waitForTimeout(300);
  const t2 = await metin();
  de(t2.includes('İkinci kayıt açılacak'), 'seçenek değişince satır etiketi de değişti');
  de(!t2.includes('Numarası güncellenecek'), 'eski etiket kalkmış');
  de(t2.includes('6 öğrenci ekle'), 'düğme eski davranışı yazıyor');

  // Kaydetmeden karar değiştirmek sunucuya hiçbir şey göndermemeli.
  const c = await cagrilar();
  de(!c.includes('ogrenciler_toplu_ekle'), 'karar değiştirmek yazma yapmadı');
}

console.log('4c — KAPALI SEÇENEKLE GÖNDERİLEN BAYRAK false');
{
  await p.getByRole('button', { name: /6 öğrenci ekle/ }).first().click();
  await p.waitForTimeout(700);
  const govde = await p.evaluate(
    () => window.__cagrilar.find((c) => c.ad === 'ogrenciler_toplu_ekle')?.govde ?? null,
  );
  de(govde?.p_mevcutlari_guncelle === false, `bayrak false gitti (${govde?.p_mevcutlari_guncelle})`);
  const t = await metin();
  de(/6 yeni öğrenci eklendi/.test(t), `sonuç "6 yeni öğrenci eklendi" diyor`);
  de(!/numarası güncellendi/.test(t), 'güncelleme iddiası yok — hiçbiri güncellenmedi');

  // Aynı ekrana temiz dönüp asıl yolu (güncelleme) ölçeceğiz.
  await p.goto(KOK + '#/ogretmen/ogrenciler/toplu', { waitUntil: 'networkidle' });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  await p.selectOption('select', 's9a');
  await p.fill('textarea', YAPISTIRMA);
  await p.waitForTimeout(400);
  await p.getByRole('button', { name: /Ali Yılmaz satırını çıkar/ }).first().click();
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    window.__cagrilar.length = 0;
  });
}

console.log('5 — EKLE → SUNUCUYA YALNIZ ONAYLANAN ADLAR GİDİYOR');
{
  await p.getByRole('button', { name: '5 ekle, 1 güncelle' }).first().click();
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
  de(
    govde?.p_mevcutlari_guncelle === true,
    `eşleşen varken bayrak true gitti (${govde?.p_mevcutlari_guncelle})`,
  );
}

console.log('6 — SONUÇ: KOD TABLOSU, GİZLEME, İNDİRME');
{
  const t = await metin();
  // 0043: başlık artık NE OLDUĞUNU ayırıyor. Yapıştırmada numara yok, o
  // yüzden eşleşen satır "zaten kayıtlıydı" — ve ASIL KAZANÇ bu:
  // ikinci bir Ali Yılmaz kaydı AÇILMADI.
  de(t.includes('5 yeni öğrenci eklendi'), 'yeni sayısı başlıkta');
  de(t.includes('1 öğrenci zaten kayıtlıydı'), 'eşleşen satır kopya olarak açılmadı');
  de(t.includes('YENİ KAYIT AÇILMADI'), 'ne yapılmadığı açıkça yazıyor');
  de(t.includes('kodları'), 'kod uyarısı duruyor');
  de(t.includes('Zaten kayıtlı'), 'satır durumu tabloda etiketli');
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
  // 0043: tabloya "Durum" sütunu girdi; CSV karşılaştırması ad/kod
  // sütunlarını ADIYLA alıyor, sıraya güvenmiyor.
  const ayrisan = ekrandaki.filter(
    ([ad, , ogr, veli]) => !csv.includes(`"${ad}";"${ogr}";"${veli}"`),
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
      'AL - 9. Sınıf / A Şubesi (Sayısal) Sınıf Listesi',
      'Sınıf Öğretmeni: NURAY ÖRNEK Sınıf Başkanı:',
      // PANSİYON SÜTUNU. Öğretmenin bildirdiği kusur buradaydı: cinsiyetten
      // SONRA bir sütun daha var ve YALNIZ yatılı öğrencilerde dolu. Bu
      // yüzden otuz kişilik bir listede tek çocukta görünüyordu — tek
      // şubelik, pansiyonsuz bir fixture o kusuru hiç göremezdi.
      'S.No Öğrenci No Adı Soyadı Cinsiyeti Pansiyon',
      '1 601 ALİ YILMAZ Erkek',
      '2 602 AYŞE ÖZTÜRK Kız Yatılı',
      // "Pansiyonlu" değeri: eski kodda bu satır "tablo başlığı" sanılıp
      // TAMAMEN atılıyordu, yani öğrenci sessizce kayboluyordu.
      '3 603 MEHMET ÇOBAN Erkek Pansiyonlu',
      // AYNI ŞUBEDE aynı numara: uyarı çıkmalı, satır DÜŞMEMELİ.
      '4 601 ZEYNEP ÖZ Kız',
      'Kız Öğrenci Sayısı : 2 Erkek Öğrenci Sayısı : 2',
      // İKİNCİ ŞUBE. Öğretmenin gerçek dosyası üç şube taşıyordu; tek
      // şubelik bir fixture o kusuru hiç göremezdi.
      // 9C BİLEREK: sahte sınıf listesinde 9A ve 9B var, 9C YOK.
      // Depoda olmayan şubenin uyarıldığı ve oluşturma yolu sunulduğu
      // ölçülüyor.
      'AL - 9. Sınıf / C Şubesi (Sözel) Sınıf Listesi',
      'S.No Öğrenci No Adı Soyadı Cinsiyeti',
      // 601 BURADA DA VAR: şubeler arası çakışma UYARI OLMAMALI.
      '1 601 KEREM ÇELİK Erkek',
      '2 604 SELİN DEMİR Kız',
      'Kız Öğrenci Sayısı : 1 Erkek Öğrenci Sayısı : 1',
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
      // TÜM rozetler çıkarılıyor: numara rozeti `sk-sayi` taşıyor ama ŞUBE
      // rozeti ("9A") taşımıyor ve onda da rakam var. Yalnız `sk-sayi`
      // çıkarılsaydı "adda rakam yok" ölçümü şube yüzünden kırmızı yanardı.
      kopya.querySelectorAll('span').forEach((s) => s.remove());
      return kopya.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    }),
  );
  de(adlar.length === 6, `6 öğrenci önizlemede (${adlar.length})`);
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
  // PANSİYON SÜTUNU DA KALMAMALI — öğretmenin bildirdiği kusur buydu:
  // "AYŞE SARI" yerine "Ayşe Sarı Kız Yatılı" kaydedilmişti. `\b` Türkçe
  // harflerde çalışmadığı için kelimeler AÇIKÇA aranıyor.
  de(
    !/(yat\u0131l\u0131|pansiyonlu|g\u00fcnd\u00fczl\u00fc)/i.test(hepsi),
    `pansiyon sütunu adın içinde kalmamış: ${hepsi}`,
  );

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
  // NUMARA ROZETİ `sk-sayi` taşıyor; ŞUBE rozeti taşımıyor. İkisi ayrı
  // okunuyor ki biri ötekinin yerine geçmesin.
  const rozetler = await p.evaluate(() =>
    [...document.querySelectorAll('ul.divide-y > li > div > p.font-semibold > span.sk-sayi')]
      .map((e) => e.textContent?.trim() ?? ''),
  );
  de(
    JSON.stringify(rozetler) === JSON.stringify(['601', '602', '603', '601', '601', '604']),
    `numaralar ayrı rozette: ${JSON.stringify(rozetler)}`,
  );

  // AYNI NUMARA UYARI VERİYOR AMA SATIR DURUYOR — öğretmenin kararı.
  const uyarilar = await p.evaluate(() =>
    [...document.querySelectorAll('ul.divide-y > li')]
      .map((li) => li.textContent ?? '')
      .filter((s) => s.includes('Numara tekrarı')).length,
  );
  // TAM BİR KEZ: 9A içindeki 601 çakışması. 9B'deki 601 BAŞKA bir şube,
  // uyarı vermemeli — ilk yazımda kapsam genel olsaydı burada 2 çıkardı.
  de(uyarilar === 1, `numara tekrarı uyarısı yalnız aynı şubede (${uyarilar})`);

  // ASIL ÖLÇÜM: uyarı ENGEL DEĞİL. Dört satırın dördü de duruyor.
  de(adlar.length === 6, 'numara tekrarı satırı düşürmedi');

  // --- ŞUBE TANIMA ---
  const subeMetni = await p.evaluate(() => document.body.innerText);
  de(/2 şube var/.test(subeMetni), 'dosyadaki şube sayısı bildiriliyor');
  de(/9A/.test(subeMetni) && /9C/.test(subeMetni), 'şube adları yazılıyor');
  // Depoda 9A var (sahte sunucu veriyor), 9B YOK: ayrım görünmeli.
  de(/Sınıf yok/.test(subeMetni), 'depoda olmayan şube uyarılıyor');
  de(/9C oluştur/.test(subeMetni), 'eksik şube için oluşturma yolu var');

  // SUNUCUYA {ad, no} GİDİYOR: ekranda görünmesi yetmez, kaydedilecek
  // olan şey numarayı taşımalı.
  // İSTEK AĞA ÇIKMIYOR: bu denetim `fetch`i sayfanın içinde taklit ediyor
  // (`window.__cagrilar`). İlk yazımda `p.route` kullanılmıştı ve hiç
  // tetiklenmedi — ölçüm boş dizi görüp kırmızı yandı. Kayıt sayfanın
  // kendisinde; oradan okunuyor.
  // EKSİK ŞUBE VARKEN EKLEME YAPILMAMALI. Yapılsaydı 9A yazılır, 9C
  // yazılmaz ve öğretmen yarım bir aktarımla baş başa kalırdı.
  await p.evaluate(() => {
    window.__cagrilar.length = 0;
  });
  await gonder().click();
  await p.waitForTimeout(700);
  const eksikVarkenCagri = await p.evaluate(
    () => window.__cagrilar.filter((c) => c.ad === 'ogrenciler_toplu_ekle').length,
  );
  de(eksikVarkenCagri === 0, `eksik şube varken hiç yazma yapılmadı (${eksikVarkenCagri})`);
  de(
    /depoda yok/i.test(await p.evaluate(() => document.body.innerText)),
    'eksik sınıf adıyla söyleniyor',
  );

  // ŞUBEYİ OLUŞTUR → sonra ekleme ŞUBE ŞUBE gitmeli.
  await p.getByRole('button', { name: /9C oluştur/i }).click();
  await p.waitForTimeout(700);
  await p.evaluate(() => {
    window.__cagrilar.length = 0;
  });
  await gonder().click();
  await p.waitForTimeout(1200);

  const cagrilar = await p.evaluate(() =>
    window.__cagrilar
      .filter((c) => c.ad === 'ogrenciler_toplu_ekle')
      .map((c) => ({ sinif: c.govde.p_sinif_id, adlar: c.govde.p_adlar })),
  );
  de(cagrilar.length === 2, `her şube için ayrı çağrı (${cagrilar.length})`);
  de(
    JSON.stringify(cagrilar[0]?.adlar) ===
      JSON.stringify([
        { ad: 'Ali Yılmaz', no: '601' },
        { ad: 'Ayşe Öztürk', no: '602' },
        { ad: 'Mehmet Çoban', no: '603' },
        { ad: 'Zeynep Öz', no: '601' },
      ]),
    `9A çağrısı ad+numara taşıyor: ${JSON.stringify(cagrilar[0]?.adlar)}`,
  );
  de(
    JSON.stringify(cagrilar[1]?.adlar) ===
      JSON.stringify([
        { ad: 'Kerem Çelik', no: '601' },
        { ad: 'Selin Demir', no: '604' },
      ]),
    `9C çağrısı ayrı gitti: ${JSON.stringify(cagrilar[1]?.adlar)}`,
  );
  de(
    cagrilar[0]?.sinif !== cagrilar[1]?.sinif,
    'iki çağrı FARKLI sınıflara gitti',
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
