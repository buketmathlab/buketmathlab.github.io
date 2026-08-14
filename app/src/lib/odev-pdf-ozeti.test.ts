import { describe, expect, it } from 'vitest';
import {
  konuAdayi,
  odevPdfOzeti,
  ozetBos,
  puanTablosundanSoruSayisi,
  sinifAdayi,
  sorubasliklarindanSoruSayisi,
} from './odev-pdf-ozeti';

/**
 * ÖĞRETMENİN GERÇEK PDF'İ.
 *
 * `10C_uslu_koklu_SORULAR.pdf` dosyası `pdfSatirlariniOku` hattından
 * geçirildi; aşağıdaki 37 satır o koşunun BİREBİR çıktısı. Uydurulmuş
 * örnek değil — cevap anahtarı turunda kendi ürettiğim örneklere uyan bir
 * desenin gerçek PDF'te 0/10 çıkmasının dersi bu.
 *
 * Dikkat: 06 numaralı soruda satır İKİYE BÖLÜNMÜŞ (24-25. satırlar).
 * Gerçek veri bu; test onu düzeltmiyor.
 */
const GERCEK: string[] = [
  'B E Ş İ K T A Ş',
  'ARNAVUTKÖY KORKMAZ YİĞİT ANADOLU LİSESİ',
  'M A T E M A T İ K B Ö L Ü M Ü',
  'Üslü ve Köklü Sayılar · Değerlendirme Sınavı · 10. Sınıf · 2026',
  'Ad Soyad Sınıf / No Tarih',
  'UYGULAMA · İLERİ',
  'SORU 1 2 3 4 5 6 7 8 9 10 TOPLAM',
  'PUAN 10 10 10 10 10 10 10 10 10 10 100',
  'ALINAN / 100',
  'UYGULAMA',
  '01 10 Puan',
  'Buket Topuzoğlu · Matematik Öğretmeni MATEMATİK · 10C · ÜSLÜ-KÖKLÜ SAYILAR 01',
  'BEŞİKTAŞ ARNAVUTKÖY KORKMAZ YİĞİT ANADOLU LİSESİ',
  'UYGULAMA',
  '02 10 Puan',
  'UYGULAMA',
  '03 10 Puan',
  'UYGULAMA',
  '04 10 Puan',
  'Buket Topuzoğlu · Matematik Öğretmeni MATEMATİK · 10C · ÜSLÜ-KÖKLÜ SAYILAR 02',
  'BEŞİKTAŞ ARNAVUTKÖY KORKMAZ YİĞİT ANADOLU LİSESİ',
  'İLERI',
  '05 10 Puan',
  'İLERI',
  '10 Puan',
  '06',
  'İLERI',
  '07 10 Puan',
  'İLERI',
  '08 10 Puan',
  'Buket Topuzoğlu · Matematik Öğretmeni MATEMATİK · 10C · ÜSLÜ-KÖKLÜ SAYILAR 03',
  'BEŞİKTAŞ ARNAVUTKÖY KORKMAZ YİĞİT ANADOLU LİSESİ',
  'İLERI',
  '09 10 Puan',
  'İLERI',
  '10 10 Puan',
  'Buket Topuzoğlu · Matematik Öğretmeni MATEMATİK · 10C · ÜSLÜ-KÖKLÜ SAYILAR 04',
];

describe('öğretmenin gerçek PDF’i', () => {
  it('soru sayısını, konuyu ve sınıfı okuyor', () => {
    const o = odevPdfOzeti(GERCEK);
    expect(o.soruSayisi).toBe(10);
    expect(o.soruSayisiKaynak).toBe('puan-tablosu');
    expect(o.konu).toBe('Üslü ve Köklü Sayılar');
    expect(o.sinif).toBe('10C');
  });

  it('iki sinyal birbirini DOĞRULUYOR', () => {
    // Asıl güven buradan geliyor: bağımsız iki yol aynı sayıyı buluyor.
    expect(puanTablosundanSoruSayisi(GERCEK)).toBe(10);
    expect(sorubasliklarindanSoruSayisi(GERCEK)).toBe(10);
  });

  it('bölünmüş satırdaki 06 numaralı soruyu kaçırmıyor', () => {
    // Gerçek veride 06'nın numarası ile "10 Puan" ayrı satırlarda.
    // Komşu satır kontrolü olmasaydı sinyal 1..10 tamamlanmaz, düşerdi.
    expect(sorubasliklarindanSoruSayisi(GERCEK)).not.toBeNull();
  });

  it('konu olarak okul ya da öğretmen adını ALMIYOR', () => {
    // Alt bilgi de `·` taşıyor; eleme çalışmazsa konu
    // "Buket Topuzoğlu" çıkardı.
    expect(konuAdayi(GERCEK)).not.toMatch(/Topuzoğlu|LİSESİ|BEŞİKTAŞ/i);
  });
});

describe('bulunamama normal bir sonuçtur', () => {
  it('taranmış PDF (hiç satır yok) çökmüyor', () => {
    const o = odevPdfOzeti([]);
    expect(o.soruSayisi).toBeNull();
    expect(o.konu).toBeNull();
    expect(ozetBos(o)).toBe(true);
  });

  it('tanımadığımız bir şablonda sessizce boş dönüyor', () => {
    const o = odevPdfOzeti(['Matematik Ödevi', 'Aşağıdaki soruları çözünüz.', 'Başarılar.']);
    expect(o.soruSayisi).toBeNull();
    expect(ozetBos(o)).toBe(true);
  });
});

describe('yanlış eşleşmeye karşı', () => {
  it('düz metinde geçen "soru" kelimesi tabloya benzemiyor', () => {
    expect(
      puanTablosundanSoruSayisi(['SORU sayısı 12 olarak belirlenmiştir, süre 40 dakikadır.']),
    ).toBeNull();
  });

  it('ardışık olmayan sayılar tablo sayılmıyor', () => {
    expect(puanTablosundanSoruSayisi(['SORU 3 7 9 11 TOPLAM'])).toBeNull();
  });

  it('1’den başlamayan dizi tablo sayılmıyor', () => {
    expect(puanTablosundanSoruSayisi(['SORU 2 3 4 5 TOPLAM'])).toBeNull();
  });

  it('sondaki TOPLAM sütunu soru sayısını şişirmiyor', () => {
    // "SORU 1 2 3 TOPLAM" satırındaki 100, diziyi bozmadan dışarıda kalmalı.
    expect(puanTablosundanSoruSayisi(['SORU 1 2 3 TOPLAM', 'PUAN 10 10 10 30'])).toBe(3);
  });

  it('soru numaraları eksikse başlık sinyali düşüyor', () => {
    // 1, 2 ve 5 var; 3 ve 4 yok. Sayı uydurmak yerine sinyal düşer.
    expect(sorubasliklarindanSoruSayisi(['01 10 Puan', '02 10 Puan', '05 10 Puan'])).toBeNull();
  });

  it('şema sınırının dışındaki sayı öneri olmuyor', () => {
    const cok = ['SORU ' + Array.from({ length: 250 }, (_, i) => i + 1).join(' ') + ' TOPLAM'];
    expect(puanTablosundanSoruSayisi(cok)).toBeNull();
  });
});

describe('iki sinyal çelişirse', () => {
  const celiskili = [
    'SORU 1 2 3 4 5 TOPLAM',
    'PUAN 20 20 20 20 20 100',
    '01 20 Puan',
    '02 20 Puan',
    '03 20 Puan',
  ];

  it('HİÇBİRİ seçilmiyor', () => {
    // Sessizce birini seçmek yanlış soru sayısı demek; yanlış soru sayısı
    // cevap anahtarının kırpılması demek.
    const o = odevPdfOzeti(celiskili);
    expect(o.soruSayisi).toBeNull();
    expect(o.soruSayisiKaynak).toBe('celiskili');
  });

  it('ama iki değer de ekrana taşınıyor', () => {
    const o = odevPdfOzeti(celiskili);
    expect(o.puanTablosu).toBe(5);
    expect(o.soruBasliklari).toBe(3);
    expect(ozetBos(o)).toBe(false);
  });
});

describe('sinifAdayi', () => {
  it('alt bilgideki sınıfı okuyor', () => {
    expect(sinifAdayi(['... MATEMATİK · 10C · ÜSLÜ-KÖKLÜ SAYILAR 01'])).toBe('10C');
    expect(sinifAdayi(['x · 9 A · y'])).toBe('9A');
  });

  it('sınıf yoksa null', () => {
    expect(sinifAdayi(['Matematik · Değerlendirme · 2026'])).toBeNull();
  });
});

describe('konuAdayi', () => {
  it('parçayı kırpıyor ve boşlukları tekilleştiriyor', () => {
    expect(konuAdayi(['  Köklü   Sayılar  · Sınav · 2026'])).toBe('Köklü Sayılar');
  });

  it('ayraç yoksa null', () => {
    expect(konuAdayi(['Üslü Sayılar Sınavı'])).toBeNull();
  });

  it('sayıdan ibaret parçayı konu saymıyor', () => {
    expect(konuAdayi(['2026 · 10. Sınıf'])).toBeNull();
  });
});
