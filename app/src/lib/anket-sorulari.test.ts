import { describe, expect, it } from 'vitest';
import { ANKET_MADDELERI, anketGovdesi } from './anket-sorulari';

describe('anket soruları', () => {
  it('madde sayısı sunucuyla aynı (öğrenci 7, veli ve öğretmen 5)', () => {
    expect(ANKET_MADDELERI.ogrenci).toHaveLength(7);
    expect(ANKET_MADDELERI.veli).toHaveLength(5);
    expect(ANKET_MADDELERI.ogretmen).toHaveLength(5);
  });

  it('eksik madde varsa gövde üretilmiyor', () => {
    expect(anketGovdesi('veli', { m1: 5, m2: 4 }, '')).toBeNull();
  });

  it('dolu yanıt sunucunun beklediği anahtarlarla; görüş kırpılıyor', () => {
    const g = anketGovdesi('veli', { m1: 5, m2: 4, m3: 3, m4: 2, m5: 1 }, `  ${'a'.repeat(400)} `);
    expect(Object.keys(g ?? {})).toEqual(['m1', 'm2', 'm3', 'm4', 'm5', 'acik']);
    expect(String(g?.acik)).toHaveLength(300);
  });

  it('boş görüş gönderilmiyor', () => {
    const g = anketGovdesi('ogretmen', { m1: 1, m2: 1, m3: 1, m4: 1, m5: 1 }, '   ');
    expect(g && 'acik' in g).toBe(false);
  });
});
