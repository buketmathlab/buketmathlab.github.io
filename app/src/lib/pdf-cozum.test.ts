import { describe, expect, it } from 'vitest';
import {
  ARA_CIZGI,
  EN_FAZLA_PIKSEL,
  PDF_GENISLIK,
  birlesimNotu,
  cokSayfaMetni,
  pdfMi,
  tekGorselDuzeni,
} from './pdf-cozum';

const A4 = { en: 595, boy: 842 };

describe('pdfMi', () => {
  it('türden ya da uzantıdan tanır', () => {
    expect(pdfMi({ name: 'cozum.pdf', type: 'application/pdf' })).toBe(true);
    expect(pdfMi({ name: 'COZUM.PDF', type: '' })).toBe(true);
    expect(pdfMi({ name: 'cozum.jpg', type: 'image/jpeg' })).toBe(false);
  });
});

describe('tekGorselDuzeni', () => {
  it('tek A4 sayfa: 1400 px genişlik, orana uygun boy', () => {
    const d = tekGorselDuzeni([A4]);
    expect(d.en).toBe(PDF_GENISLIK);
    expect(d.boy).toBe(Math.round(1400 * (842 / 595)));
    expect(d.sayfalar).toEqual([{ y: 0, en: 1400, boy: d.boy }]);
  });

  it('üç sayfa alt alta, aralarında çizgi payı', () => {
    const d = tekGorselDuzeni([A4, A4, A4]);
    const s = d.sayfalar;
    expect(s[1]!.y).toBe(s[0]!.boy + ARA_CIZGI);
    expect(s[2]!.y).toBe(s[1]!.y + s[1]!.boy + ARA_CIZGI);
    expect(d.boy).toBe(s[2]!.y + s[2]!.boy);
  });

  it('sekiz A4 sayfa iOS tuval sınırını AŞMIYOR (genişlik küçülüyor)', () => {
    const d = tekGorselDuzeni(Array(8).fill(A4));
    expect(d.en * d.boy).toBeLessThanOrEqual(EN_FAZLA_PIKSEL);
    expect(d.en).toBeLessThan(PDF_GENISLIK);
    expect(d.en).toBeGreaterThan(900); // el yazısı okunur kalıyor
  });

  it('yatay sayfa orantılı', () => {
    const d = tekGorselDuzeni([{ en: 842, boy: 595 }]);
    expect(d.boy).toBe(Math.round(1400 * (595 / 842)));
  });
});

it('notlar', () => {
  expect(birlesimNotu(1)).toBeNull();
  expect(birlesimNotu(3)).toBe("PDF'in 3 sayfası tek görsele birleştirildi.");
  expect(cokSayfaMetni(12)).toMatch(/12 sayfa/);
});
