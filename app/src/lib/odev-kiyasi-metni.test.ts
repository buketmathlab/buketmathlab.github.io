import { describe, expect, it } from 'vitest';
import { kiyasMetni, ortalamaYazisi } from './odev-kiyasi-metni';
import { yasakKaliplariBul } from './urun-dili';

describe('kiyasMetni', () => {
  /**
   * BU TURUN BİR ÖNCEKİ TURU GERİ ALMADIĞININ ÖLÇÜMÜ.
   *
   * Bir tur önce üründen hak edilmemiş övgüyü temizledik. Kıyas kartı,
   * yargı cümlesi taşımaya en açık yer: "sınıfın üstündesin" demek çok
   * kolay. Bu ölçüm o kapıyı kapalı tutuyor.
   */
  it('kartta övgü ya da yargı kalıbı yok', () => {
    for (const tur of ['ogrenci', 'veli'] as const) {
      const m = kiyasMetni(tur);
      const hepsi = [m.baslik, m.puanEtiketi, m.ortalamaYok, m.adetNotu(3)].join(' ');
      expect(yasakKaliplariBul(hepsi)).toEqual([]);
    }
  });

  /**
   * "ÜSTÜNDE / ALTINDA" HÜKMÜ DE YOK. Karşılaştırmayı iki sayı yan yana
   * dururken öğrenci kendisi yapıyor; cümle kurulunca ölçüm bir hükme
   * dönüşür (dosyanın başındaki karar).
   */
  it('metin bir karşılaştırma HÜKMÜ kurmuyor', () => {
    for (const tur of ['ogrenci', 'veli'] as const) {
      const m = kiyasMetni(tur);
      const hepsi = [m.baslik, m.puanEtiketi, m.ortalamaYok, m.adetNotu(3)]
        .join(' ')
        .toLocaleLowerCase('tr');
      for (const hukum of ['üstünde', 'altında', 'geride', 'ileride', 'başarılı']) {
        expect(hepsi).not.toContain(hukum);
      }
    }
  });

  /** Muhatap ayrımı: öğrenciye "Puanın", veliye "Puanı". */
  it('öğrenciye ve veliye ayrı sesleniliyor', () => {
    expect(kiyasMetni('ogrenci').puanEtiketi).toBe('Puanın');
    expect(kiyasMetni('veli').puanEtiketi).toBe('Puanı');
  });

  /** Tekil/çoğul: "1 teslimden", "3 teslimden". */
  it('adet notu tekil ve çoğulda doğru', () => {
    expect(kiyasMetni('ogrenci').adetNotu(1)).toBe('1 teslimden');
    expect(kiyasMetni('ogrenci').adetNotu(24)).toBe('24 teslimden');
  });
});

describe('ortalamaYazisi', () => {
  /**
   * null "HİÇ TESLİM YOK" demek ve 0'dan ayrı tutulması şart: 0 gerçek
   * bir ortalama değeri. İkisi karışırsa öğrenci sınıfının sıfır
   * aldığını sanır.
   */
  it('null ile 0 birbirine karışmıyor', () => {
    expect(ortalamaYazisi(null)).toBeNull();
    expect(ortalamaYazisi(undefined)).toBeNull();
    expect(ortalamaYazisi(0)).toBe('0');
  });

  /** Tam sayıda ondalık yok, kesirlide virgüllü tek basamak. */
  it('sayı biçimi Türkçe ve gürültüsüz', () => {
    expect(ortalamaYazisi(65)).toBe('65');
    expect(ortalamaYazisi(58.3)).toBe('58,3');
    expect(ortalamaYazisi(100)).toBe('100');
  });

  /**
   * PostgREST `numeric`'i bazen DİZE olarak gönderiyor. Yalnız sayı
   * bekleyen bir kod o durumda "NaN" yazardı — bu depoda daha önce
   * yaşanmış bir tuzak.
   */
  it('sunucudan dize gelirse de çalışıyor', () => {
    expect(ortalamaYazisi('75.0')).toBe('75');
    expect(ortalamaYazisi('58.3')).toBe('58,3');
  });

  /** Bozuk değer ekranı kırmıyor, satır sessizce çizilmiyor. */
  it('bozuk değerde null dönüyor', () => {
    expect(ortalamaYazisi('abc')).toBeNull();
    expect(ortalamaYazisi(Number.NaN)).toBeNull();
  });
});
