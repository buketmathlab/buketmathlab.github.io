import { describe, expect, it } from 'vitest';
import {
  ONCEKI_ETIKET,
  SECIM_BASLIGI,
  YENI_ACIKLAMA,
  YENI_ETIKET,
  gonderildiMetni,
  oncekiAciklama,
  oncekiSayfaEtiketi,
  sayfaAdedi,
} from './yeniden-yukleme-metni';
import { yasakKaliplariBul } from './urun-dili';

describe('yeniden yükleme metni', () => {
  it('iki seçeneğin etiketi dolu ve birbirinden ayrı', () => {
    expect(YENI_ETIKET).not.toBe(ONCEKI_ETIKET);
    for (const m of [SECIM_BASLIGI, YENI_ETIKET, YENI_ACIKLAMA, ONCEKI_ETIKET]) {
      expect(m.length).toBeGreaterThan(3);
    }
  });

  it('sayfa sayısı cümleye giriyor', () => {
    expect(sayfaAdedi(1)).toBe('1 sayfa');
    expect(sayfaAdedi(3)).toBe('3 sayfa');
    expect(oncekiAciklama(3)).toContain('3 sayfa');
    expect(oncekiSayfaEtiketi(2)).toBe('2. sayfa');
  });

  /**
   * HANGİ YOLUN KULLANILDIĞI SÖYLENİYOR.
   *
   * "Önceki sayfalarımı kullan" diyen öğrenci, gönderimden sonra hangi
   * fotoğrafların gittiğini bilmeli — sessiz kalsa "yenisini mi gönderdim"
   * diye tereddüt ederdi.
   */
  it('gönderim bildirimi yolu söylüyor', () => {
    expect(gonderildiMetni('onceki', 2)).toContain('Önceki 2 sayfa');
    expect(gonderildiMetni('yeni', 2)).toBe('Ödevin gönderildi.');
  });

  /**
   * SUÇLAMA YOK.
   *
   * Bu ekran öğrencinin gönderimi iptal edildikten SONRA açılıyor.
   * "Boş göndermiştin" türü bir hatırlatma durumu yeniden yaşatırdı;
   * ekran yalnız ne yapabileceğini söylüyor.
   */
  it('metinlerde yasak kalıp ve suçlayıcı söz yok', () => {
    const hepsi = [
      SECIM_BASLIGI,
      YENI_ETIKET,
      YENI_ACIKLAMA,
      ONCEKI_ETIKET,
      oncekiAciklama(3),
      gonderildiMetni('onceki', 3),
      gonderildiMetni('yeni', 3),
    ].join(' ');
    expect(yasakKaliplariBul(hepsi)).toEqual([]);
    expect(hepsi).not.toMatch(/boş göndermiş|başarısız|yetersiz|hata yapt|dikkatsiz/i);
  });
});
