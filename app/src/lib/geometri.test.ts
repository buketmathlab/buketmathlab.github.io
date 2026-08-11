import { describe, expect, it } from 'vitest';
import { sekizgenYolu, sekizYildizYolu, YILDIZ_IC_ORAN } from './geometri';

function noktaSayisi(yol: string): number {
  return (yol.match(/[ML]/g) ?? []).length;
}

describe('sekizgen', () => {
  it('sekiz köşesi olmalı', () => {
    expect(noktaSayisi(sekizgenYolu(100))).toBe(8);
  });

  it('kapalı bir yol üretmeli', () => {
    expect(sekizgenYolu(100).trimEnd().endsWith('Z')).toBe(true);
  });

  it('tüm köşeler verilen kutunun içinde kalmalı', () => {
    const sayilar = sekizgenYolu(100)
      .match(/-?\d+\.\d+/g)!
      .map(Number);
    for (const s of sayilar) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });

  it('üst ve alt kenarı düz olmalı (iki köşe aynı y değerinde)', () => {
    const yol = sekizgenYolu(100);
    const ler = [...yol.matchAll(/[ML](-?\d+\.\d+) (-?\d+\.\d+)/g)].map((m) => Number(m[2]));
    const enKucuk = Math.min(...ler);
    expect(ler.filter((y) => Math.abs(y - enKucuk) < 0.001)).toHaveLength(2);
  });
});

describe('sekiz köşeli yıldız', () => {
  it('on altı köşesi olmalı (sekiz dış, sekiz iç)', () => {
    expect(noktaSayisi(sekizYildizYolu(100))).toBe(16);
  });

  it('iç yarıçap oranı iki karenin kesişiminden gelmeli', () => {
    // apotem / cos(22.5°) = cos(45°) / cos(22.5°)
    expect(YILDIZ_IC_ORAN).toBeCloseTo(0.76537, 5);
  });
});
