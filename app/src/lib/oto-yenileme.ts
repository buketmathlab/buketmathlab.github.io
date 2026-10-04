/**
 * Öğrenci ve velide eski sürüm KENDİNİ yeniler.
 *
 * NEDEN: 4 Ekim'de karanlık fotoğraf denetimi yayına girdikten saatler
 * sonra simsiyah bir çözüm yine kabul edildi. Yeni sürüm yalnız
 * kapatılabilir bir şerit gösteriyordu; öğrencinin açık kalmış eski
 * sekmesinde yeni denetim hiç çalışmıyordu. Öğrenci şeride bakmaz; o
 * yüzden yenilemeyi uygulama yapıyor.
 *
 * YALNIZ LİSTEDEKİ EKRANLARDA. Teslim ekranı (`/ogrenci/odev/:id`) ve
 * mesajlar listede YOK: seçilmiş fotoğraf ya da yazılmış mesaj yenilemede
 * kaybolurdu. Orada şerit görünür; öğrenci o ekrandan çıkınca yenilenir.
 * Liste bilerek "izin verilenler" — yarın eklenecek bir giriş ekranı
 * kendiliğinden güvenli tarafta kalsın.
 */
const GUVENLI = new Set([
  '/ogrenci',
  '/ogrenci/odevler',
  '/ogrenci/konularim',
  '/veli',
  '/veli/odevler',
  '/veli/konular',
  '/veli/odemeler',
]);

/** `#/ogrenci/odevler?x=1` → `/ogrenci/odevler` */
function yol(hash: string): string {
  const y = hash.replace(/^#/, '').split('?')[0] ?? '';
  return y.length > 1 ? y.replace(/\/+$/, '') : y;
}

export function otoYenilenebilir(hash: string): boolean {
  return GUVENLI.has(yol(hash));
}

/** Aynı sürüm için yalnız BİR kez kendiliğinden yenile: döngü olmasın. */
const YAPILDI = 'sekiz_oto_yenileme';

export function otoYenilemeYapildiMi(surum: string): boolean {
  try {
    return sessionStorage.getItem(YAPILDI) === surum;
  } catch {
    // Depolama kapalıysa döngü riskine girmiyoruz: yenileme yok, şerit var.
    return true;
  }
}

export function otoYenilemeIsaretle(surum: string): void {
  try {
    sessionStorage.setItem(YAPILDI, surum);
  } catch {
    // `otoYenilemeYapildiMi` zaten `true` döner; buraya düşülmez.
  }
}
