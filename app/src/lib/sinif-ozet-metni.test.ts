import { describe, expect, it } from 'vitest';
import {
  GERI,
  KONU_ACIKLAMASI,
  KONU_BOS,
  SINIF_KUTUSU_ACIKLAMASI,
  SINIF_KUTUSU_BASLIGI,
  SINIF_YOK,
  eksikKonuYazisi,
  odevSayisiYazisi,
  ortalamaYazisi,
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
    expect(eksikKonuYazisi(null)).toBe(KONU_BOS);
    expect(eksikKonuYazisi('')).toBe(KONU_BOS);
    expect(eksikKonuYazisi('   ')).toBe(KONU_BOS);
    expect(KONU_BOS).not.toMatch(/[a-zçğıöşü]/i);
  });

  it('konu varsa olduğu gibi yazılıyor', () => {
    expect(eksikKonuYazisi('Köklü Sayılar')).toBe('Köklü Sayılar');
  });

  /** Tirenin ne anlama geldiği listenin altında yazılı olmalı. */
  it('açıklama iki sebebi de söylüyor', () => {
    expect(KONU_ACIKLAMASI).toContain('5 soru');
    expect(KONU_ACIKLAMASI).toContain('yanlışı yoktur');
    expect(KONU_ACIKLAMASI).toContain(KONU_BOS);
  });
});
