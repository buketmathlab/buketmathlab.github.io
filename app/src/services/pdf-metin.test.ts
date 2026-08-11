import { describe, expect, it } from 'vitest';
import { parcalariSatirlaraBol } from './pdf-metin';

/** pdf.js parça biçimi: transform[4] = x, transform[5] = y. */
function p(str: string, x: number, y: number) {
  return { str, transform: [1, 0, 0, 1, x, y] };
}

describe('parcalariSatirlaraBol', () => {
  it('aynı y üzerindeki parçaları tek satırda birleştirir', () => {
    expect(parcalariSatirlaraBol([p('1', 10, 700), p('A', 30, 700), p('2', 50, 700)])).toEqual([
      '1 A 2',
    ]);
  });

  it('satırları x koordinatına göre sıralar — liste sırası önemsiz', () => {
    expect(parcalariSatirlaraBol([p('C', 90, 700), p('1', 10, 700), p('B', 50, 700)])).toEqual([
      '1 B C',
    ]);
  });

  it('satırları yukarıdan aşağıya sıralar (PDF y aşağı azalır)', () => {
    expect(parcalariSatirlaraBol([p('alt', 10, 100), p('üst', 10, 700)])).toEqual(['üst', 'alt']);
  });

  it('küçük y sapmalarını aynı satır sayar', () => {
    // Aynı satırdaki farklı yazı tipleri birkaç punto kayabiliyor.
    expect(parcalariSatirlaraBol([p('1', 10, 700), p('A', 30, 701.5)])).toEqual(['1 A']);
  });

  it('gerçek satır farkını ayrı satır sayar', () => {
    expect(parcalariSatirlaraBol([p('1 A', 10, 700), p('2 B', 10, 680)])).toEqual(['1 A', '2 B']);
  });

  it('boş parçaları atar', () => {
    expect(parcalariSatirlaraBol([p('1', 10, 700), p('   ', 20, 700), p('A', 30, 700)])).toEqual([
      '1 A',
    ]);
  });

  it('parça yoksa boş dizi döndürür', () => {
    expect(parcalariSatirlaraBol([])).toEqual([]);
  });
});
