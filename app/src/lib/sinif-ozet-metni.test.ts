import { describe, expect, it } from 'vitest';
import {
  GERI,
  KAPSAM_ACIKLAMASI,
  KONU_ACIKLAMASI,
  KONU_BOS,
  SINIF_KUTUSU_ACIKLAMASI,
  SINIF_KUTUSU_BASLIGI,
  SINIF_YOK,
  eksikKonuYazisi,
  odevSayisiYazisi,
  ortalamaYazisi,
  yapilanYazisi,
} from './sinif-ozet-metni';
import { yasakKaliplariBul } from './urun-dili';

describe('sinif-ozet-metni', () => {
  /** Ürün dili nöbetçisi bu ekranda da geçerli. */
  it('metinlerde yasak kalıp yok', () => {
    const hepsi = [
      KONU_ACIKLAMASI,
      SINIF_KUTUSU_BASLIGI,
      SINIF_KUTUSU_ACIKLAMASI,
      SINIF_YOK,
      GERI,
      ortalamaYazisi(null),
      ortalamaYazisi(48.5),
      odevSayisiYazisi(12),
    ].join(' ');
    expect(yasakKaliplariBul(hepsi)).toEqual([]);
  });

  /**
   * TÜRKÇE ONDALIK AYIRICI VİRGÜL. `toFixed` nokta koyardı ve "48.5"
   * öğretmenin okuduğu sayı değil.
   */
  it('ondalık ayırıcı virgül', () => {
    expect(ortalamaYazisi(48.5)).toBe('48,5');
    expect(ortalamaYazisi(0)).toBe('0,0');
    expect(ortalamaYazisi(100)).toBe('100,0');
  });

  /** Sunucu iki hane veriyor; ekran bir haneye yuvarlıyor. */
  it('tek ondalık haneye yuvarlanıyor', () => {
    expect(ortalamaYazisi(25.44)).toBe('25,4');
    expect(ortalamaYazisi(25.46)).toBe('25,5');
  });

  /**
   * ORTALAMASI OLMAYAN ÖĞRENCİ SIFIR DEĞİL.
   *
   * Dönem başında süresi dolmuş hiç ödev yoktur. Herkesin karşısına "0,0"
   * yazmak, ödev vermediğimiz için çocuğu başarısız göstermek olurdu.
   */
  it('ortalama yoksa sıfır yazılmıyor', () => {
    expect(ortalamaYazisi(null)).toBe('Henüz ödev yok');
    expect(ortalamaYazisi(null)).not.toContain('0');
  });

  /** Gerçekten sıfır olan ortalama ise sıfır yazılıyor — gerçeği gizleme. */
  it('gerçek sıfır gizlenmiyor', () => {
    expect(ortalamaYazisi(0)).toBe('0,0');
  });

  /**
   * KONU BOŞKEN CÜMLE KURULMUYOR.
   *
   * Boşluğun iki ayrı sebebi var (5 soruluk birikim yok / yanlışı yok) ve
   * ekran ikisini ayırt edemiyor. Hangi cümleyi yazsak öğrencilerin bir
   * kısmı için yanlış olurdu; tire hiçbir şey iddia etmiyor.
   */
  it('konu boşken tire, cümle değil', () => {
    expect(eksikKonuYazisi([])).toBe(KONU_BOS);
    expect(eksikKonuYazisi(null)).toBe(KONU_BOS);
    expect(eksikKonuYazisi([''])).toBe(KONU_BOS);
    expect(eksikKonuYazisi(['   '])).toBe(KONU_BOS);
    expect(KONU_BOS).not.toMatch(/[a-zçğıöşü]/i);
  });

  it('konu varsa olduğu gibi yazılıyor', () => {
    expect(eksikKonuYazisi(['Köklü Sayılar'])).toBe('Köklü Sayılar');
  });

  /**
   * EKRANDA DA BAŞLIKLARIN HEPSİ (öğretmenin düzeltmesi).
   *
   * Önce yalnız ilki yazılıyordu; öğretmen ekranın da kâğıtla aynı şeyi
   * söylemesini istedi. Bu ölçüm olmadan bir sonraki turda sessizce
   * tekile dönerdi.
   */
  it('konuların hepsi ekranda', () => {
    expect(eksikKonuYazisi(['Köklü Sayılar', 'Üslü İfadeler', 'Denklemler'])).toBe(
      'Köklü Sayılar · Üslü İfadeler · Denklemler',
    );
  });

  /** Tirenin ne anlama geldiği listenin altında yazılı olmalı. */
  it('açıklama iki sebebi de söylüyor', () => {
    expect(KONU_ACIKLAMASI).toContain('5 soru');
    expect(KONU_ACIKLAMASI).toContain('yanlışı yoktur');
    expect(KONU_ACIKLAMASI).toContain(KONU_BOS);
  });

  /**
   * AÇIKLAMA KONUNUN NE İŞE YARADIĞINI SÖYLÜYOR.
   *
   * Öğretmenin düzeltmesi: *"'En eksik konular' cümlesini bu şekilde
   * değil de daha pedagojik yaz."* İlk sürüm yalnız tireyi anlatan
   * teknik bir dipnottu. Cümle artık satırdaki konuyu bir BAŞLANGIÇ
   * NOKTASI olarak koyuyor; bu ölçüm olmadan bir sonraki turda sessizce
   * eski hâline dönerdi.
   */
  it('açıklama bir sonraki adımı gösteriyor', () => {
    expect(KONU_ACIKLAMASI).toMatch(/tekrara ihtiyaç/);
    expect(KONU_ACIKLAMASI).toMatch(/başlanabilir/);
  });

  /**
   * DAYATMIYOR. Çıkarım bir öneridir (Part XXVIII): cümle ne
   * yapılacağını emretmiyor, nereden başlanabileceğini söylüyor.
   */
  it('açıklama emir kipinde değil', () => {
    expect(KONU_ACIKLAMASI).not.toMatch(/başlayın|çalıştırın|vermelisiniz/);
  });

  /**
   * GERÇEĞİ GİZLEMİYOR.
   *
   * Öğretmenin kuralı: *"Yanlış kelimesini her durumda daha yumuşak bir
   * ifadeyle değiştirmeye çalışma."* Pedagojik yazmak, yanlışın nerede
   * biriktiğini söylememek demek değil.
   *
   * ÖLÇÜM NEDEN BU KADAR DAR: ilk yazdığım hâli `toContain('yanlışı')`
   * idi ve ISIRMIYORDU — cümlenin SONUNDAKİ "yanlışı yoktur" onu zaten
   * karşılıyordu, yani ilk yarıyı "eksikleri" diye yumuşatmak ölçümü
   * hiç kırmıyordu. Kırılabilen iddia şu: konunun neden seçildiği
   * yanlış ve boş sayılarak söyleniyor.
   */
  it('yanlışın nerede biriktiği söyleniyor', () => {
    expect(KONU_ACIKLAMASI).toMatch(/yanlışı ve boşu/);
  });

  /**
   * YAPILAN / YAPILMAYAN (0052) — öğretmenin isteği.
   *
   * İki sayı da yazılıyor; biri öbüründen çıkarılmıyor ve sıfır olan
   * taraf gizlenmiyor.
   */
  it('iki sayı da yazılıyor', () => {
    expect(yapilanYazisi(8, 2)).toBe('8 yapıldı · 2 yapılmadı');
  });

  /** Sıfır bir bilgidir, boşluk değil. */
  it('sıfır olan taraf gizlenmiyor', () => {
    expect(yapilanYazisi(0, 5)).toBe('0 yapıldı · 5 yapılmadı');
    expect(yapilanYazisi(5, 0)).toBe('5 yapıldı · 0 yapılmadı');
  });

  /**
   * SÜRESİ DOLMUŞ HİÇ ÖDEV YOKSA CÜMLE KURULMUYOR.
   *
   * "0 yapıldı · 0 yapılmadı" hiçbir şey söylemez; ortalama zaten "Henüz
   * ödev yok" diyor. İkisini birden yazmak dönem başında her satırı
   * anlamsız sıfırlarla doldururdu.
   */
  it('hiç ödev yokken cümle kurulmuyor', () => {
    expect(yapilanYazisi(0, 0)).toBeNull();
  });

  /**
   * SAYILARIN KAPSAMI YAZILI.
   *
   * Öğretmen "bu hafta verdiğim ödev neden görünmüyor" diye sorabilir;
   * cevabı ekranda durmalı. Süresi devam eden ödevin "yapılmadı"
   * sayılmadığı da burada söyleniyor.
   */
  it('kapsam açıklaması süre kapısını söylüyor', () => {
    expect(KAPSAM_ACIKLAMASI).toMatch(/süresi dolmuş/);
    expect(KAPSAM_ACIKLAMASI).toMatch(/devam eden ödev/);
    expect(yasakKaliplariBul(KAPSAM_ACIKLAMASI)).toEqual([]);
  });
});
