import { describe, expect, it } from 'vitest';
import {
  asilHarf,
  iptalMi,
  iptalSorulari,
  numaraListesi,
  soruNumaralariniOku,
} from './soru-iptali';

describe('iptal işareti', () => {
  it('sunucudaki _iptal_mi ile aynı kural', () => {
    expect(iptalMi('IPTAL:B')).toBe(true);
    expect(iptalMi(' iptal:c ')).toBe(true);
    expect(iptalMi('IPTAL:')).toBe(true);
    expect(iptalMi('B')).toBe(false);
    expect(iptalMi('')).toBe(false);
    expect(iptalMi(undefined)).toBe(false);
  });

  it('asıl harf geri okunuyor', () => {
    expect(asilHarf('IPTAL:B')).toBe('B');
    expect(asilHarf('IPTAL:')).toBeNull();
    expect(asilHarf('C')).toBe('C');
  });

  it('iptal edilmiş sorular sıralı', () => {
    expect(iptalSorulari({ '35': 'IPTAL:A', '1': 'B', '8': 'IPTAL:D' })).toEqual([8, 35]);
    expect(iptalSorulari(null)).toEqual([]);
  });

  it('numara listesi Türkçe', () => {
    expect(numaraListesi([8])).toBe('8');
    expect(numaraListesi([8, 35])).toBe('8 ve 35');
    expect(numaraListesi([3, 8, 35])).toBe('3, 8 ve 35');
  });
});

describe('soruNumaralariniOku', () => {
  it('"8, 35" ve benzerleri', () => {
    expect(soruNumaralariniOku('8, 35', 65)).toEqual({ sorular: [8, 35], hata: null });
    expect(soruNumaralariniOku('35 8', 65)).toEqual({ sorular: [8, 35], hata: null });
    expect(soruNumaralariniOku('8;35.', 65)).toEqual({ sorular: [8, 35], hata: null });
  });

  it('hatalı girişte öğretmene ne olduğunu söylüyor', () => {
    expect(soruNumaralariniOku('', 65).hata).toMatch(/numarasını yazın/);
    expect(soruNumaralariniOku('8, x', 65).hata).toMatch(/"x" bir soru numarası değil/);
    expect(soruNumaralariniOku('0', 65).hata).toMatch(/1 ile 65 arasında/);
    expect(soruNumaralariniOku('66', 65).hata).toMatch(/1 ile 65 arasında olmalı \(66\)/);
    expect(soruNumaralariniOku('8, 8', 65).hata).toMatch(/birden fazla/);
  });
});
