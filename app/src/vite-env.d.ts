
// pdf.js worker'ı tip bildirimi taşımıyor; yalnız yan etkisi için
// (kendini worker kapsamına kurmak üzere) import ediliyor.
declare module 'pdfjs-dist/build/pdf.worker.min.mjs';

/**
 * Yapı sırasında gömülen sürüm damgası (vite.config.ts → surumDamgasi).
 * Çalışan paketin kendi kimliği; `surum.json` ile karşılaştırılır.
 */
declare const __SEKIZ_SURUM__: string;
