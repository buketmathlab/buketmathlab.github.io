import { describe, expect, it } from 'vitest';
import { bosCevapUyarisi, ek } from './bos-cevap-uyarisi';

describe('bosCevapUyarisi', () => {
  it('boş soru yoksa hiçbir şey sorulmaz', () => {
    expect(bosCevapUyarisi(3, { 1: 'A', 2: 'B', 3: 'C' })).toBeNull();
  });

  it('HEPSİ BOŞ: öğretmenin öğrencisindeki olay — 51 sorudan 51\'i boş', () => {
    const u = bosCevapUyarisi(51, {})!;
    expect(u.baslik).toBe("51 sorudan 51'i boş");
    expect(u.hepsiBos).toBe(true);
    expect(u.metin).toMatch(/puanın 0 olur/);
    expect(u.metin).toMatch(/sayfa yenilenmiş olabilir/);
  });

  it('kısmen boş: sayı ve daha yumuşak metin', () => {
    const u = bosCevapUyarisi(10, { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'A', 7: 'B' })!;
    expect(u.baslik).toBe("10 sorudan 3'ü boş");
    expect(u.hepsiBos).toBe(false);
    expect(u.metin).not.toMatch(/0 olur/);
  });

  it('geçersiz soru sayısında sormaz', () => {
    expect(bosCevapUyarisi(0, {})).toBeNull();
  });
});

describe('ek — sayıya iyelik eki', () => {
  it.each([
    [1, 'i'], [2, 'si'], [3, 'ü'], [4, 'ü'], [5, 'i'], [6, 'sı'], [7, 'si'], [8, 'i'], [9, 'u'],
    [10, 'u'], [20, 'si'], [30, 'u'], [40, 'ı'], [50, 'si'], [60, 'ı'], [70, 'i'], [80, 'i'],
    [90, 'ı'], [51, 'i'], [100, 'ü'], [200, 'ü'],
  ])('%i → %s', (n, beklenen) => {
    expect(ek(n)).toBe(beklenen);
  });
});
