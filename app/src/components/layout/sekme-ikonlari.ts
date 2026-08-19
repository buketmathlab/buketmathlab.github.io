/**
 * Sekme ikonları — kendi setimiz, ikon paketi bağımlılığı eklenmiyor.
 *
 * SAF VERİ, JSX DEĞİL: her ikon bir `<path d="…">` değeri. SVG sarmalını
 * `SekmeCubugu` çiziyor.
 *
 * Neden böyle: JSX döndüren büyük harfli bir sabiti lint "bileşen" sayıyor
 * ve aynı dosyadaki yardımcıyla birlikte hızlı yenilemeyi (fast refresh)
 * bozduğu uyarısını veriyor. Veriyi veri olarak tutmak hem uyarıyı
 * kaldırıyor hem de dosyayı `.ts` yapıyor.
 */
export const SEKME_IKON = {
  pano: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm9 0h7v-9h-7v9Zm0-16v5h7V4h-7Z',
  sinif:
    'M12 3 2 8l10 5 8-4v6h2V8L12 3ZM6 13.2V17c0 1.7 2.7 3 6 3s6-1.3 6-3v-3.8l-6 3-6-3Z',
  ogrenci:
    'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4 0-8 2-8 4.5V21h16v-2.5C20 16 16 14 12 14Z',
  odev:
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 2.5L17.5 8H14V4.5ZM8 13h8v2H8v-2Zm0 4h8v2H8v-2Z',
  veli:
    'M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 2c-2.7 0-6 1.3-6 3.5V19h8v-2.5c0-.9.5-1.7 1.3-2.4A9.7 9.7 0 0 0 8 13Zm8 0c-.6 0-1.3.1-2 .2 1.2.8 2 1.8 2 3.3V19h6v-2.5c0-2.2-3.3-3.5-6-3.5Z',
  // Anahtar: kod bir şifredir, ikon da bunu söylesin.
  kod: 'M14 2a6 6 0 0 0-5.7 7.9L2 16.2V22h5.8l1.4-1.4v-2h2v-2h2l1.3-1.3A6 6 0 1 0 14 2Zm2.5 5.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z',
  // Konu karnesi: çubuk grafik — içerideki `Gelisim` ile aynı fikir.
  karne:
    'M4 20h16v2H4v-2Zm2-8h3v7H6v-7Zm4.5-6h3v13h-3V6ZM15 9h3v10h-3V9Z',
  mesaj:
    'M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-6 4V6a2 2 0 0 1 2-2Zm3 5h10v2H7V9Zm0 4h7v2H7v-2Z',
  // Ödeme ikonu yalnız VELİDE ve yalnız özel derste çıkıyor.
  odeme:
    'M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm1 3v6h16V9H4Zm2 1h4v2H6v-2Z',
} as const;
