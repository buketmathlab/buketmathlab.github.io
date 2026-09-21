import { describe, expect, it } from 'vitest';
import { ogrenciOzeti } from './ogrenci-ozet-metni';

describe('ogrenciOzeti', () => {
  /**
   * BU TURUN SEBEBİ OLAN KUSUR.
   *
   * Önceki hâlinde tek koşul (`bekleyen === 0`) iki ayrı durumu birden
   * anlatıyordu; hiç ödev verilmemiş öğrenci tebrik ediliyordu. Ölçüm
   * ikisinin AYRI cümle verdiğini arıyor — aynı cümleye geri dönen bir
   * değişiklik burada kırmızı yanar.
   */
  it('hiç ödev yokken "hepsini gönderdin" demiyor', () => {
    const hic = ogrenciOzeti(0, 0);
    const hepsi = ogrenciOzeti(3, 0);

    expect(hic.cumle).toBe('Henüz ödev yayınlanmadı.');
    expect(hepsi.cumle).toBe('Bütün ödevlerini gönderdin.');
    expect(hic.cumle).not.toBe(hepsi.cumle);
  });

  /**
   * POZ DA AYRIŞIYOR — ve cümleyle AYNI çağrıdan geliyor.
   *
   * Kusur zaten cümlenin bir koşulda, pozun başka bir koşulda durmasından
   * doğmuştu. Üç durumun üçünde de ikisi birlikte ölçülüyor.
   */
  it('her durumun pozu ayrı ve cümlesiyle aynı yerden geliyor', () => {
    expect(ogrenciOzeti(0, 0).poz).toBe('kesif');
    expect(ogrenciOzeti(3, 0).poz).toBe('kutlama');
    expect(ogrenciOzeti(3, 1).poz).toBe('calisma');
  });

  /**
   * KUTLAMA YALNIZ HAK EDİLDİĞİNDE. Ewalu'nun kolunu havaya kaldırdığı
   * tek durum "gönderilmiş ödevler var ve hepsi gönderilmiş".
   */
  it('kutlama pozu yalnız gerçekten gönderilmiş ödev varken çıkıyor', () => {
    for (const [odev, bekleyen] of [
      [0, 0],
      [1, 1],
      [5, 2],
      [5, 5],
    ] as const) {
      expect(ogrenciOzeti(odev, bekleyen).poz).not.toBe('kutlama');
    }
    expect(ogrenciOzeti(1, 0).poz).toBe('kutlama');
  });

  /** Bekleyen sayısı cümlede AYNEN geçiyor — uydurulmuş bir sayı yok. */
  it('bekleyen sayısı cümlenin içinde', () => {
    expect(ogrenciOzeti(3, 1).cumle).toBe('1 ödevin seni bekliyor.');
    expect(ogrenciOzeti(9, 4).cumle).toBe('4 ödevin seni bekliyor.');
  });

  /**
   * SIRA ÖNEMLİ: "hiç ödev yok" sorusu ÖNCE soruluyor. Tersi olsaydı
   * sıfır ödevli öğrenci `bekleyen === 0` dalına düşerdi ve düzeltilen
   * kusur aynen geri gelirdi. Bu ölçüm o sırayı kilitliyor.
   */
  it('sıfır ödev, "bekleyen yok" dalına DÜŞMÜYOR', () => {
    expect(ogrenciOzeti(0, 0)).toEqual({
      cumle: 'Henüz ödev yayınlanmadı.',
      poz: 'kesif',
    });
  });

  /**
   * SAVUNMA. İkisi de bir dizinin `length`'i olduğu için negatif değer
   * beklenmiyor; yine de bozuk bir sayı ekranı boş bırakmamalı.
   */
  it('bozuk sayılarda bile bir cümle dönüyor', () => {
    for (const [odev, bekleyen] of [
      [-1, 0],
      [0, -3],
      [2, -1],
    ] as const) {
      const o = ogrenciOzeti(odev, bekleyen);
      expect(o.cumle.length).toBeGreaterThan(0);
      expect(['kesif', 'kutlama', 'calisma']).toContain(o.poz);
    }
  });

  /**
   * ÖVGÜ YOK. Üç cümlenin hiçbiri çocuk hakkında bir iddia taşımıyor —
   * ne "harikasın" ne "geri kaldın". `OgrenciPano`'nun yorumunda yazılı
   * olan ama cümlenin tutmadığı kural artık ölçülüyor.
   */
  it('hiçbir cümle çocuk hakkında iddia taşımıyor', () => {
    const hepsi = [ogrenciOzeti(0, 0), ogrenciOzeti(3, 0), ogrenciOzeti(3, 2)]
      .map((o) => o.cumle)
      .join(' ')
      .toLocaleLowerCase('tr');

    for (const yasak of [
      'eline sağlık',
      'aferin',
      'harikasın',
      'tebrikler',
      'geri kaldın',
      'başarılı',
      'başarısız',
    ]) {
      expect(hepsi).not.toContain(yasak);
    }
  });
});
