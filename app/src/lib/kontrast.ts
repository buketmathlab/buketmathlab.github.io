/**
 * WCAG 2.1 kontrast oranı hesabı.
 * Kaynak: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */

export type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string): Rgb {
  const t = hex.trim().replace('#', '');
  const tam =
    t.length === 3
      ? t
          .split('')
          .map((c) => c + c)
          .join('')
      : t;

  if (!/^[0-9a-fA-F]{6}$/.test(tam)) {
    throw new Error(`Geçersiz renk kodu: ${hex}`);
  }

  return {
    r: parseInt(tam.slice(0, 2), 16),
    g: parseInt(tam.slice(2, 4), 16),
    b: parseInt(tam.slice(4, 6), 16),
  };
}

/** sRGB kanalını doğrusallaştırır (WCAG tanımı). */
function kanal(deger: number): number {
  const s = deger / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Bağıl parlaklık (relative luminance). */
export function parlaklik(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
}

/** İki renk arasındaki kontrast oranı (1 ile 21 arası). */
export function kontrastOrani(hexA: string, hexB: string): number {
  const a = parlaklik(hexA);
  const b = parlaklik(hexB);
  const acik = Math.max(a, b);
  const koyu = Math.min(a, b);
  return (acik + 0.05) / (koyu + 0.05);
}
