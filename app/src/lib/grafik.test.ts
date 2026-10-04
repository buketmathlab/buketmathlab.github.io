import { describe, expect, it } from 'vitest';
import {
  ayEtiketi,
  cizgiYolu,
  degerYazisi,
  enYakin,
  gorunenEtiketler,
  sayiya,
  xKonumu,
  yKonumu,
  type Alan,
} from './grafik';

const A: Alan = { genislik: 120, yukseklik: 120, sol: 10, sag: 10, ust: 10, alt: 10 };

describe('grafik hesapları', () => {
  it('sunucudan metin gelen sayı okunuyor, boş değer null kalıyor', () => {
    expect(sayiya('72.50')).toBe(72.5);
    expect(sayiya(80)).toBe(80);
    expect(sayiya(null)).toBeNull();
    expect(sayiya('abc')).toBeNull();
  });

  it('ay etiketi Türkçe ve saat dilimiyle kaymıyor', () => {
    expect(ayEtiketi('2026-09-01')).toBe('Eyl');
    expect(ayEtiketi('2027-01-01')).toBe('Oca');
  });

  it('0 tabana, 100 tepeye; aralık dışı kırpılıyor', () => {
    expect(yKonumu(0, A)).toBe(110);
    expect(yKonumu(100, A)).toBe(10);
    expect(yKonumu(150, A)).toBe(10);
    expect(yKonumu(50, A)).toBe(60);
  });

  it('kategoriler iki uca yayılıyor; tek kategori ortada', () => {
    expect(xKonumu(0, 3, A)).toBe(10);
    expect(xKonumu(2, 3, A)).toBe(110);
    expect(xKonumu(0, 1, A)).toBe(60);
  });

  it('boş değer çizgiyi KESİYOR (sıfıra inmiyor)', () => {
    const yol = cizgiYolu([50, null, 100], A);
    expect(yol).toBe('M10.0 60.0M110.0 10.0');
    expect(cizgiYolu([0, 100], A)).toBe('M10.0 110.0L110.0 10.0');
  });

  it('dar ekranda etiket seyreltiliyor; ilk ve son hep görünür', () => {
    expect(gorunenEtiketler(4, 6)).toEqual([true, true, true, true]);
    const g = gorunenEtiketler(10, 4);
    expect(g[0]).toBe(true);
    expect(g[9]).toBe(true);
    expect(g.filter(Boolean).length).toBeLessThanOrEqual(5);
  });

  it('imleç en yakın kategoriye oturuyor', () => {
    expect(enYakin(0, 3, A)).toBe(0);
    expect(enYakin(58, 3, A)).toBe(1);
    expect(enYakin(500, 3, A)).toBe(2);
  });

  it('değer yazısı: Türkçe ondalık, yüzde, boş', () => {
    expect(degerYazisi(72.5, '')).toBe('72,5');
    expect(degerYazisi(84, '%')).toBe('%84');
    expect(degerYazisi(null, '%')).toBe('—');
  });
});
