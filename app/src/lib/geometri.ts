/**
 * Anadolu Selçuklu geometrisi — yapısal primitifler.
 *
 * Referans GEOMETRİKTİR, koloristik değildir (Kural 11): sekiz köşeli yıldız ve
 * sekizgen oranları burada hesaplanır, hiçbir yerde "sihirli" SVG yolu
 * elle yazılmaz. Böylece oranlar test edilebilir kalır.
 */

/** Kutupsal koordinattan kartezyene; SVG'de y aşağı doğru büyür. */
function nokta(merkez: number, yaricap: number, aciDerece: number): [number, number] {
  const a = (aciDerece * Math.PI) / 180;
  return [merkez + yaricap * Math.cos(a), merkez + yaricap * Math.sin(a)];
}

function yolaCevir(noktalar: ReadonlyArray<[number, number]>): string {
  const govde = noktalar
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(3)} ${y.toFixed(3)}`)
    .join(' ');
  return `${govde} Z`;
}

/**
 * Düzgün sekizgen. Köşeler 22.5° + k·45°'te olduğu için üst ve alt kenar
 * düzdür — mimaride ve Selçuklu planlarında görülen duruş.
 *
 * @param boyut viewBox kenar uzunluğu (kare varsayılır)
 */
export function sekizgenYolu(boyut = 100): string {
  const m = boyut / 2;
  const r = boyut / 2;
  const noktalar = Array.from({ length: 8 }, (_, k) => nokta(m, r, 22.5 + k * 45));
  return yolaCevir(noktalar);
}

/**
 * İç yarıçapın dış yarıçapa oranı — 45° döndürülmüş iki karenin üst üste
 * binmesiyle oluşan sekiz köşeli yıldız (Rub el Hizb) için tek doğru değer.
 *
 * Türetme: karenin merkeze uzaklığı (apotem) R·cos(45°); iç köşe, kenar
 * üzerinde 22.5°'de olduğundan uzaklığı apotem / cos(22.5°).
 */
export const YILDIZ_IC_ORAN = Math.cos(Math.PI / 4) / Math.cos(Math.PI / 8);

/**
 * Sekiz köşeli Selçuk yıldızı. 16 köşe, dış ve iç yarıçap dönüşümlü.
 *
 * @param boyut viewBox kenar uzunluğu
 * @param baslangicAcisi 0 → köşe sağda; -90 → köşe yukarıda
 */
export function sekizYildizYolu(boyut = 100, baslangicAcisi = -90): string {
  const m = boyut / 2;
  const dis = boyut / 2;
  const ic = dis * YILDIZ_IC_ORAN;
  const noktalar = Array.from({ length: 16 }, (_, k) =>
    nokta(m, k % 2 === 0 ? dis : ic, baslangicAcisi + k * 22.5),
  );
  return yolaCevir(noktalar);
}
