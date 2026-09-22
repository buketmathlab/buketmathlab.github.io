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
      const hepsi = [m.baslik, m.puanEtiketi].join(' ');
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
      const hepsi = [m.baslik, m.puanEtiketi]
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

  /**
   * TESLİM SAYISI METİNDE HİÇ YOK — öğretmenin kararı: "Teslim sayısı
   * veliye ya da öğrenciye gösterilmesin."
   *
   * Ölçüm metnin TAMAMINI tarıyor, kaldırdığım alanın yokluğunu değil:
   * biri bir gün "kaç kişiden" diye başka bir cümle eklerse burası
   * kırmızı yanar.
   */
  it('metinde teslim sayısından söz eden hiçbir şey yok', () => {
    for (const tur of ['ogrenci', 'veli'] as const) {
      const m = kiyasMetni(tur);
      const hepsi = Object.values(m).join(' ').toLocaleLowerCase('tr');
      for (const yasak of ['teslim', 'kişi', 'öğrenci sayısı', 'kaç']) {
        expect(hepsi, `"${yasak}" geçiyor: "${hepsi}"`).not.toContain(yasak);
      }
    }
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
