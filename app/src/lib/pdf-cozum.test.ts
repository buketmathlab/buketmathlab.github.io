import { describe, expect, it } from 'vitest';
import * as PDF from './pdf-cozum';

describe('pdfMi', () => {
  it('türden ya da uzantıdan tanır', () => {
    expect(PDF.pdfMi({ name: 'cozum.pdf', type: 'application/pdf' })).toBe(true);
    expect(PDF.pdfMi({ name: 'COZUM.PDF', type: '' })).toBe(true);
    expect(PDF.pdfMi({ name: 'cozum.jpg', type: 'image/jpeg' })).toBe(false);
  });
});

describe('0078: tek görsele birleştirme kalktı', () => {
  it('birleştirme yardımcıları artık yok', () => {
    const adlar = Object.keys(PDF);
    for (const ad of ['tekGorselDuzeni', 'birlesimNotu', 'cokSayfaMetni', 'TEK_GORSEL_EN_FAZLA_SAYFA', 'ARA_CIZGI']) {
      expect(adlar).not.toContain(ad);
    }
  });

  it('sayfa genişliği fotoğrafla aynı', () => {
    expect(PDF.PDF_GENISLIK).toBe(1400);
  });
});
