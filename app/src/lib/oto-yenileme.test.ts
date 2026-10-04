import { afterEach, describe, expect, it } from 'vitest';
import { otoYenilemeIsaretle, otoYenilemeYapildiMi, otoYenilenebilir } from './oto-yenileme';

afterEach(() => sessionStorage.clear());

describe('otoYenilenebilir', () => {
  it('öğrenci ve veli okuma ekranlarında yeniler', () => {
    for (const h of [
      '#/ogrenci',
      '#/ogrenci/',
      '#/ogrenci/odevler',
      '#/ogrenci/konularim',
      '#/veli',
      '#/veli/odevler?a=1',
      '#/veli/konular',
      '#/veli/odemeler',
    ]) {
      expect(otoYenilenebilir(h), h).toBe(true);
    }
  });

  it('teslim ve mesaj ekranında YENİLEMEZ: seçilen fotoğraf, yazılan mesaj kaybolmasın', () => {
    for (const h of ['#/ogrenci/odev/abc', '#/ogrenci/mesajlar', '#/veli/mesajlar']) {
      expect(otoYenilenebilir(h), h).toBe(false);
    }
  });

  it('öğretmen, müdür ve giriş ekranında yenilemez (şerit sürer)', () => {
    for (const h of ['', '#/', '#/ogretmen', '#/mudur', '#/giris', '#/ogrenciler']) {
      expect(otoYenilenebilir(h), h).toBe(false);
    }
  });
});

describe('döngü koruması', () => {
  it('aynı sürüm için bir kez', () => {
    expect(otoYenilemeYapildiMi('v2')).toBe(false);
    otoYenilemeIsaretle('v2');
    expect(otoYenilemeYapildiMi('v2')).toBe(true);
    expect(otoYenilemeYapildiMi('v3')).toBe(false);
  });
});
