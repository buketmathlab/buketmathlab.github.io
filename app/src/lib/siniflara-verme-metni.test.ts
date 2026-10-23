import { describe, expect, it } from 'vitest';
import {
  ACIKLAMA,
  BASLIK,
  KARDES_NOTU,
  SINIF_EKSIK,
  TASINAN,
  TASINMAYAN,
  TARIH_ETIKETI,
  TARIH_EKSIK,
  TARIH_GECMIS,
  TASLAK_UYARISI,
  secimSayaci,
  sonucMetni,
} from './siniflara-verme-metni';
import { yasakKaliplariBul } from './urun-dili';

describe('sınıflara verme metni', () => {
  it('başlık ve açıklama dolu', () => {
    expect(BASLIK.length).toBeGreaterThan(10);
    expect(ACIKLAMA).toMatch(/kopya/i);
  });

  /**
   * TASLAK OLDUĞU SÖYLENMELİ (öğretmenin kararı).
   *
   * Söylenmezse öğretmen kopyaların öğrenciye gittiğini sanır ve
   * yayınlamayı beklemez — ödev kimseye ulaşmaz.
   */
  it('taslak olduğu ve yayınlanması gerektiği yazılı', () => {
    expect(TASLAK_UYARISI).toMatch(/taslak/i);
    expect(TASLAK_UYARISI).toMatch(/yayınlar/i);
    expect(sonucMetni(['10D'])).toMatch(/[Yy]ayınlamayı unutmayın/);
  });

  /**
   * NE TAŞINIR / NE TAŞINMAZ — ikisi de yazılı.
   *
   * Son tarihin taşınmadığı özellikle önemli: öğretmen kaynağın tarihini
   * beklerse ve o tarih geçmişse ödev öğrenciye kapalı görünürdü.
   */
  it('taşınan ve taşınmayan listeleri anlamlı', () => {
    expect(TASINAN.length).toBeGreaterThanOrEqual(3);
    expect(TASINAN.join(' ')).toMatch(/anahtar/i);
    expect(TASINAN.join(' ')).toMatch(/yeniden yüklenmez/i);
    expect(TASINMAYAN.join(' ')).toMatch(/[Ss]on tarih/);
  });

  it('kardeş kalacağı söyleniyor', () => {
    expect(KARDES_NOTU).toMatch(/yayabilirsiniz/);
  });

  it('alan etiketleri ve hataları dolu', () => {
    expect(TARIH_ETIKETI.length).toBeGreaterThan(3);
    expect(TARIH_EKSIK).toMatch(/seçin/);
    expect(TARIH_GECMIS).toMatch(/bugünden önce olamaz/);
    expect(SINIF_EKSIK).toMatch(/[Ee]n az bir sınıf/);
  });

  it('sayaç yalnız seçim varken çıkıyor', () => {
    expect(secimSayaci(0)).toBeNull();
    expect(secimSayaci(1)).toBe('1 sınıf seçildi');
    expect(secimSayaci(3)).toBe('3 sınıf seçildi');
  });

  /** Sonuç cümlesi HANGİ sınıflar olduğunu söylüyor. */
  it('sonuç cümlesi sınıf adlarını taşıyor', () => {
    expect(sonucMetni(['10D', '10E'])).toContain('10D, 10E');
    expect(sonucMetni([])).toMatch(/Hiçbir sınıfa verilmedi/);
  });

  it('metinlerde yasak kalıp ve suçlayıcı söz yok', () => {
    const hepsi = [
      BASLIK,
      ACIKLAMA,
      TASLAK_UYARISI,
      KARDES_NOTU,
      ...TASINAN,
      ...TASINMAYAN,
      TARIH_ETIKETI,
      TARIH_EKSIK,
      TARIH_GECMIS,
      SINIF_EKSIK,
      sonucMetni(['10D']),
    ].join(' ');
    expect(yasakKaliplariBul(hepsi)).toEqual([]);
  });
});
