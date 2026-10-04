/**
 * KARANLIK FOTOĞRAF — çözüm görünmeyen fotoğraf gönderilmeden yakalanır.
 *
 * Gerçek olay: 10C'den bir öğrencinin çözümü tamamen siyah geldi (parlaklık
 * 0–13, ortalama 4; karanlıkta ya da objektif kapalıyken çekilmiş gerçek
 * bir kamera fotoğrafı). Kâğıt fotoğrafında kâğıt açık renklidir; loş bir
 * odada bile parlak piksellerin üst dilimi 100'ün üstündedir. Bu yüzden
 * ölçü "en parlak %2": o bile KARANLIK_ESIK'in altındaysa fotoğrafta
 * okunacak bir şey yok.
 */

export const KARANLIK_ESIK = 40;

export const KARANLIK_METNI =
  'Fotoğraf çok karanlık; çözümün okunmuyor. Aydınlık bir ortamda yeniden çekip yükle.';

export class KaranlikFotografHatasi extends Error {
  constructor() {
    super(KARANLIK_METNI);
    this.name = 'KaranlikFotografHatasi';
  }
}

/** RGBA piksel verisinden: en parlak %2'lik dilim de karanlıksa `true`. */
export function karanlikMi(rgba: Uint8ClampedArray | Uint8Array): boolean {
  const sayac = new Uint32Array(256);
  let toplam = 0;
  // Her 4. piksel yeter (1400 px'lik görselde ~370 bin örnek).
  for (let i = 0; i + 2 < rgba.length; i += 16) {
    const p = Math.round(0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!);
    sayac[p]!++;
    toplam++;
  }
  if (toplam === 0) return false;
  let ust = 0;
  const hedef = toplam * 0.02;
  for (let v = 255; v >= 0; v--) {
    ust += sayac[v]!;
    if (ust >= hedef) return v < KARANLIK_ESIK;
  }
  return false;
}
