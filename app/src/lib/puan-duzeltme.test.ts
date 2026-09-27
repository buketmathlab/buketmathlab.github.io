import { describe, expect, it } from 'vitest';
import { duzeltmeIsareti, duzeltmeyiDenetle } from './puan-duzeltme';

describe('duzeltmeyiDenetle', () => {
  it('geçerli puan ve sebep', () => {
    expect(duzeltmeyiDenetle(' 95 ', '  Kâğıtta ek çözüm var ')).toEqual({
      puan: 95,
      neden: 'Kâğıtta ek çözüm var',
    });
  });

  it('virgüllü ondalık (Türkçe klavye) kabul', () => {
    expect(duzeltmeyiDenetle('87,5', 'sebep')).toEqual({ puan: 87.5, neden: 'sebep' });
  });

  it('BOŞ PUAN 0 SAYILMAZ — sessizce sıfır vermek en kötüsü', () => {
    expect(duzeltmeyiDenetle('', 'sebep')).toEqual({ hata: 'Yeni puanı yazın.' });
    expect(duzeltmeyiDenetle('   ', 'sebep')).toEqual({ hata: 'Yeni puanı yazın.' });
  });

  it('aralık ve sayı olmayan', () => {
    for (const p of ['-1', '101', 'abc', 'Infinity', '1e3']) {
      expect(duzeltmeyiDenetle(p, 'sebep')).toEqual({ hata: 'Puan 0 ile 100 arasında olmalı.' });
    }
    expect(duzeltmeyiDenetle('0', 'sebep')).toEqual({ puan: 0, neden: 'sebep' });
    expect(duzeltmeyiDenetle('100', 'sebep')).toEqual({ puan: 100, neden: 'sebep' });
  });

  it('sebep zorunlu ve sunucuyla aynı sınırda (3–500)', () => {
    expect(duzeltmeyiDenetle('90', '  ab ')).toEqual({ hata: 'Düzeltmenin sebebini yazın.' });
    expect(duzeltmeyiDenetle('90', 'abc')).toEqual({ puan: 90, neden: 'abc' });
    expect(duzeltmeyiDenetle('90', 'x'.repeat(501))).toEqual({
      hata: 'Sebep en fazla 500 karakter olabilir.',
    });
  });
});

describe('duzeltmeIsareti', () => {
  it('sebebi taşır, yoksa yalın', () => {
    expect(duzeltmeIsareti('Ek çözüm')).toBe('Yönetici düzeltti: Ek çözüm');
    expect(duzeltmeIsareti(null)).toBe('Yönetici düzeltti');
  });
});
