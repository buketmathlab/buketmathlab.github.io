/**
 * PDF'ten metin okuma — yalnız tarayıcıda.
 *
 * ## PDF hiçbir yere gönderilmiyor
 * Ayrıştırma tamamen kullanıcının cihazında yapılır. Cevap anahtarı dosyası
 * çıkarım için sunucuya, bize ya da üçüncü bir tarafa gitmez.
 *
 * ## CDN yerine npm — bilinçli
 * Eski uygulama pdf.js'i cdnjs'ten çekiyordu (`index.html:10`). İki sorun:
 * her ziyaretçinin IP'si üçüncü tarafa gidiyordu (KVKK) ve yayın dışarıdaki
 * bir servisin ayakta olmasına bağlıydı. Paket artık npm'den geliyor.
 *
 * ## Tembel yükleme
 * pdf.js büyük bir kütüphane. `import()` ile yalnız öğretmen bir PDF
 * seçtiğinde iniyor; giriş ekranını her gün açan öğrenci onu hiç indirmiyor.
 *
 * ## Neden satır satır
 * `getTextContent()` parçaları düz bir liste olarak verir; birleştirince
 * sayfa tek bir metin yığınına dönüşür ve "soru numarası mı, şık mı"
 * ayrımı kaybolur. Parçalar y koordinatına göre satırlara ayrılıyor;
 * `lib/cevap-anahtari.ts` bu yapıya dayanarak soru metnini eliyor.
 */

import { withResolversKur } from '@/lib/promise-polyfill';

/** Aynı satır sayılmak için y koordinatları arasındaki en büyük fark (punto). */
const SATIR_TOLERANSI = 3;

type MetinParcasi = { str: string; transform: number[] };

/** Parçaları y koordinatına göre satırlara böler, her satırı x'e göre sıralar. */
export function parcalariSatirlaraBol(parcalar: readonly MetinParcasi[]): string[] {
  const satirlar: Array<{ y: number; parcalar: Array<{ x: number; str: string }> }> = [];

  for (const p of parcalar) {
    if (p.str.trim() === '') continue;
    const x = p.transform[4] ?? 0;
    const y = p.transform[5] ?? 0;

    const mevcut = satirlar.find((s) => Math.abs(s.y - y) <= SATIR_TOLERANSI);
    if (mevcut) {
      mevcut.parcalar.push({ x, str: p.str });
    } else {
      satirlar.push({ y, parcalar: [{ x, str: p.str }] });
    }
  }

  // PDF'te y yukarı doğru büyür: en üstteki satır en büyük y'ye sahiptir.
  satirlar.sort((a, b) => b.y - a.y);

  return satirlar.map((s) =>
    s.parcalar
      .sort((a, b) => a.x - b.x)
      .map((p) => p.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

/**
 * PDF dosyasını satırlara çevirir.
 *
 * @throws Okunamayan, şifreli ya da bozuk dosyada Türkçe, eyleme dönük hata.
 */
export async function pdfSatirlariniOku(dosya: File): Promise<string[]> {
  // pdf.js YÜKLENMEDEN ÖNCE. Aksi hâlde Safari 17.4 öncesinde modülün
  // kendisi değerlendirilirken çöküyor (bkz. lib/promise-polyfill.ts).
  withResolversKur();

  const pdfjs = await import('pdfjs-dist');

  // Worker dosyası Vite tarafından paketlenir; dışarıdan indirilmez.
  //
  // Worker'ın KENDİ global kapsamı var ve oraya polyfill koyamıyoruz
  // (pdf.js'in worker dosyasını biz yazmıyoruz). Eski Safari'de worker
  // çökecek — ama bu kabul edilebilir: pdf.js worker başarısız olunca
  // `_setupFakeWorker` ile ana iş parçacığına düşüyor, orası da
  // polyfill'li. Sonuç: biraz daha yavaş, ama çalışıyor.
  //
  // Sarmalayıcı bir worker denendi ve BIRAKILDI: dinamik import top-level
  // await gerektiriyor, pdf.js'in test mesajına yanıt gecikince akış
  // donuyordu (ölçüldü). Basit yol daha sağlam.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  // `destroy()` yükleme görevinde, belge nesnesinde değil.
  const gorev = pdfjs.getDocument({ data: new Uint8Array(await dosya.arrayBuffer()) });

  try {
    let belge;
    try {
      belge = await gorev.promise;
    } catch {
      throw new Error(
        'PDF açılamadı. Dosya bozuk ya da parola korumalı olabilir. ' +
          'Başka bir dosya deneyin veya cevapları elle girin.',
      );
    }

    const tumSatirlar: string[] = [];
    for (let i = 1; i <= belge.numPages; i++) {
      const sayfa = await belge.getPage(i);
      const icerik = await sayfa.getTextContent();
      // `items` metin parçaları ve işaretleme düğümleri karışık gelir;
      // yalnız `str` taşıyanlar bizi ilgilendiriyor.
      const parcalar: MetinParcasi[] = [];
      for (const x of icerik.items) {
        if ('str' in x && 'transform' in x) {
          parcalar.push({ str: x.str, transform: x.transform });
        }
      }
      tumSatirlar.push(...parcalariSatirlaraBol(parcalar));
    }

    if (tumSatirlar.length === 0) {
      throw new Error(
        'Bu PDF metin içermiyor — büyük olasılıkla taranmış bir görüntü. ' +
          'Cevapları elle girebilirsiniz.',
      );
    }

    return tumSatirlar;
  } finally {
    // Görevi ve worker'ı birlikte serbest bırak: her çağrıda yeni bir
    // worker açıldığı için kapatılmazsa birikir.
    await gorev.destroy();
  }
}
