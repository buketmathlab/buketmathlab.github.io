import { describe, expect, it } from 'vitest';
import { parcalariSatirlaraBol } from './pdf-metin';

/** pdf.js parça biçimi: transform[4] = x, transform[5] = y. */
function p(str: string, x: number, y: number) {
  return { str, transform: [1, 0, 0, 1, x, y] };
}

describe('parcalariSatirlaraBol', () => {
  it('aynı y üzerindeki parçaları tek satırda birleştirir', () => {
    expect(parcalariSatirlaraBol([p('1', 10, 700), p('A', 30, 700), p('2', 50, 700)])).toEqual([
      '1 A 2',
    ]);
  });

  it('satırları x koordinatına göre sıralar — liste sırası önemsiz', () => {
    expect(parcalariSatirlaraBol([p('C', 90, 700), p('1', 10, 700), p('B', 50, 700)])).toEqual([
      '1 B C',
    ]);
  });

  it('satırları yukarıdan aşağıya sıralar (PDF y aşağı azalır)', () => {
    expect(parcalariSatirlaraBol([p('alt', 10, 100), p('üst', 10, 700)])).toEqual(['üst', 'alt']);
  });

  it('küçük y sapmalarını aynı satır sayar', () => {
    // Aynı satırdaki farklı yazı tipleri birkaç punto kayabiliyor.
    expect(parcalariSatirlaraBol([p('1', 10, 700), p('A', 30, 701.5)])).toEqual(['1 A']);
  });

  it('gerçek satır farkını ayrı satır sayar', () => {
    expect(parcalariSatirlaraBol([p('1 A', 10, 700), p('2 B', 10, 680)])).toEqual(['1 A', '2 B']);
  });

  it('boş parçaları atar', () => {
    expect(parcalariSatirlaraBol([p('1', 10, 700), p('   ', 20, 700), p('A', 30, 700)])).toEqual([
      '1 A',
    ]);
  });

  it('parça yoksa boş dizi döndürür', () => {
    expect(parcalariSatirlaraBol([])).toEqual([]);
  });
});

/**
 * Genişlikli parça: gerçek pdf.js her parçaya `width` verir. Boşluğun
 * nereye gireceği buna bakılarak kararlaştırılıyor.
 *
 * `punto` transform[0]'dan okunuyor; eşik yazı boyunun oranı.
 */
function g(str: string, x: number, y: number, width: number, punto = 10) {
  return { str, transform: [punto, 0, 0, punto, x, y], width };
}

describe('parcalariSatirlaraBol — boşluklar glif genişliğine göre', () => {
  /**
   * GERÇEK BİR e-OKUL LİSTESİNDE ÖLÇÜLEN KUSUR.
   *
   * O PDF'te `ş`, `ğ`, `İ` ayrı parça olarak geliyor. Parçalar koşulsuz
   * `' '` ile birleştiğinde "Kız" → "K ı z" oluyordu; öğrenci adları da
   * ortadan bölünüyordu. Ad bozuk kaydedilecekti.
   */
  it('bitişik parçaları YAPIŞTIRIYOR: "K"+"ı"+"z" → "Kız"', () => {
    expect(
      parcalariSatirlaraBol([g('K', 100, 700, 6), g('ı', 106, 700, 3), g('z', 109, 700, 5)]),
    ).toEqual(['Kız']);
  });

  it('gerçek açıklığı BOŞLUK sayıyor', () => {
    // "Ali" biter (x=100+14=114), "Yılmaz" 120'de başlar: 6 punto açıklık,
    // eşik 10×0.2 = 2 → boşluk.
    expect(
      parcalariSatirlaraBol([g('Ali', 100, 700, 14), g('Yılmaz', 120, 700, 28)]),
    ).toEqual(['Ali Yılmaz']);
  });

  it('eşik yazı boyuyla ölçekleniyor — büyük puntoda olmayan boşluk uydurmuyor', () => {
    // 30 puntoda 4 birimlik açıklık boşluk DEĞİL (eşik 6).
    expect(
      parcalariSatirlaraBol([g('Ka', 100, 700, 20, 30), g('ğıt', 124, 700, 30, 30)]),
    ).toEqual(['Kağıt']);
  });

  it('parça kendi boşluğunu taşıyorsa ikincisini eklemiyor', () => {
    expect(parcalariSatirlaraBol([g('Ali ', 100, 700, 16), g('Veli', 118, 700, 18)])).toEqual([
      'Ali Veli',
    ]);
  });

  it('genişlik yoksa eski davranış sürüyor — kelimeler yapışmıyor', () => {
    // Bilgi olmadan tahmin etmektense boşluk koymak güvenli: iki kelimeyi
    // yanlışlıkla birleştirmek, fazladan boşluktan daha kötü.
    expect(parcalariSatirlaraBol([p('Ali', 100, 700), p('Yılmaz', 103, 700)])).toEqual([
      'Ali Yılmaz',
    ]);
  });

  it('e-Okul satırının tamamı: numara, ad ve cinsiyet ayrı kalıyor', () => {
    expect(
      parcalariSatirlaraBol([
        g('1', 40, 700, 5),
        g('601', 70, 700, 15),
        g('AL', 110, 700, 12),
        g('İ', 122, 700, 3), // bitişik: ada yapışmalı
        g('YILMAZ', 140, 700, 35),
        g('Erkek', 200, 700, 25),
      ]),
    ).toEqual(['1 601 ALİ YILMAZ Erkek']);
  });
});
