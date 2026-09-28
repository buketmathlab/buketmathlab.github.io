import { describe, expect, it } from 'vitest';
import { ayniNumaralilar, numarayiDenetle, tekrarUyarisi } from './ogrenci-numarasi';

describe('numarayiDenetle', () => {
  it('boş numara: numarasız öğrenci (null)', () => {
    expect(numarayiDenetle('')).toEqual({ no: null });
    expect(numarayiDenetle('   ')).toEqual({ no: null });
  });
  it('başındaki sıfır korunur, boşluk kırpılır', () => {
    expect(numarayiDenetle(' 0601 ')).toEqual({ no: '0601' });
  });
  it('20 karakteri aşan numara reddedilir', () => {
    expect(numarayiDenetle('1'.repeat(20))).toEqual({ no: '1'.repeat(20) });
    expect('hata' in numarayiDenetle('1'.repeat(21))).toBe(true);
  });
});

describe('ayniNumaralilar', () => {
  const kayitlar = [
    { ad: 'Ali Yılmaz', ogrenci_no: '601' },
    { ad: 'Ayşe Kaya', ogrenci_no: null },
    { ad: 'Can Demir', ogrenci_no: ' 602 ' },
  ];
  it('aynı numarayı taşıyanı bulur (boşluklar yok sayılır)', () => {
    expect(ayniNumaralilar('601', kayitlar)).toEqual(['Ali Yılmaz']);
    expect(ayniNumaralilar('602', kayitlar)).toEqual(['Can Demir']);
  });
  it('numarasız öğrenci ve farklı numara eşleşmez', () => {
    expect(ayniNumaralilar('603', kayitlar)).toEqual([]);
    expect(ayniNumaralilar('', kayitlar)).toEqual([]);
  });
  it('"0601" ile "601" farklı numaralardır (metin, sayı değil)', () => {
    expect(ayniNumaralilar('0601', kayitlar)).toEqual([]);
  });
});

it('uyarı cümlesi numara ve adları taşır', () => {
  expect(tekrarUyarisi('601', ['Ali Yılmaz'])).toMatch(/^Bu sınıfta 601 numarası zaten var: Ali Yılmaz\./);
});
