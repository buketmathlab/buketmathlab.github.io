/**
 * `Promise.withResolvers` polyfill'i.
 *
 * NEDEN VAR — canlıda yaşanan çökme:
 * `pdfjs-dist@6` bu metodu ana pakette 27, worker'da 13 kez kullanıyor.
 * Metot Safari'ye **17.4**'te geldi. Daha eski bir iPad'de pdf.js daha ilk
 * adımda `undefined is not a function` diye ölüyor ve cevap anahtarı
 * çıkarımı hiç başlamıyor.
 *
 * Chromium'da metot var; bu yüzden buradaki tüm testlerim yeşil geçiyordu.
 * Hata ancak öğretmenin iPad'inde göründü.
 *
 * DİKKAT — İKİ YERDE ÇAĞRILMALI: worker'ın kendi global kapsamı vardır.
 * Ana iş parçacığına polyfill koymak worker'ı kurtarmaz; ikisinde de
 * ayrı ayrı kurulur (bkz. `services/pdf-worker.ts`).
 */

type Cozucu<T> = {
  promise: Promise<T>;
  resolve: (deger: T | PromiseLike<T>) => void;
  reject: (sebep?: unknown) => void;
};

export function withResolversKur(): void {
  const P = Promise as unknown as { withResolvers?: unknown };
  if (typeof P.withResolvers === 'function') return;

  P.withResolvers = function <T>(): Cozucu<T> {
    let resolve!: (deger: T | PromiseLike<T>) => void;
    let reject!: (sebep?: unknown) => void;
    const promise = new Promise<T>((c, r) => {
      resolve = c;
      reject = r;
    });
    return { promise, resolve, reject };
  };
}
