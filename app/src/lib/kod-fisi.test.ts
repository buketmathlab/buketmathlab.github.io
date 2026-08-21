import { describe, expect, it } from 'vitest';
import { ADRES, fisMetni, fisleriUret, sayfalaraBol, SAYFA_BASINA } from './kod-fisi';

const KAYITLAR = [
  { ad: 'Ali Yılmaz', sinif: '9A', kodlar: { ogrenci: 'ABC12345', veli: 'XYZ98765' } },
  { ad: 'Ayşe Demir', sinif: '9A', kodlar: { ogrenci: 'DEF67890', veli: 'UVW54321' } },
  // Kodu eksik öğrenci: fiş üretmemeli.
  { ad: 'Kodsuz Çocuk', sinif: '9A', kodlar: {} },
  // Yalnız öğrenci kodu var; veli sayfasında yer almamalı.
  { ad: 'Velisiz Kayıt', sinif: '9A', kodlar: { ogrenci: 'GHI11111' } },
];

describe('fisleriUret', () => {
  it('öğrenci fişleri yalnız ÖĞRENCİ kodunu taşır', () => {
    const fisler = fisleriUret(KAYITLAR, 'ogrenci');
    expect(fisler.map((f) => f.kod)).toEqual(['ABC12345', 'DEF67890', 'GHI11111']);
  });

  it('veli fişleri yalnız VELİ kodunu taşır', () => {
    const fisler = fisleriUret(KAYITLAR, 'veli');
    expect(fisler.map((f) => f.kod)).toEqual(['XYZ98765', 'UVW54321']);
  });

  /**
   * TURUN ÇEKİRDEK GÜVENCESİ. Öğrenci fişlerinin hiçbirinde bir veli kodu
   * geçmemeli — tersi de. Alan adına değil GERÇEK DEĞERE bakılıyor
   * (0021/0026'daki sızıntı testi deseni).
   */
  it('iki sayfa birbirinin kodunu HİÇ taşımıyor', () => {
    const ogrenciKodlari = KAYITLAR.map((k) => k.kodlar.ogrenci).filter(Boolean);
    const veliKodlari = KAYITLAR.map((k) => k.kodlar.veli).filter(Boolean);

    const ogrenciFisleri = fisleriUret(KAYITLAR, 'ogrenci').map((f) => f.kod);
    const veliFisleri = fisleriUret(KAYITLAR, 'veli').map((f) => f.kod);

    for (const veliKodu of veliKodlari) {
      expect(ogrenciFisleri).not.toContain(veliKodu);
    }
    for (const ogrenciKodu of ogrenciKodlari) {
      expect(veliFisleri).not.toContain(ogrenciKodu);
    }
  });

  it('kodu olmayan öğrenci fiş üretmiyor', () => {
    expect(fisleriUret(KAYITLAR, 'ogrenci').some((f) => f.ad === 'Kodsuz Çocuk')).toBe(false);
    expect(fisleriUret(KAYITLAR, 'veli').some((f) => f.ad === 'Velisiz Kayıt')).toBe(false);
  });

  it('veli fişi de çocuğun adını taşıyor — kimin velisi olduğu belli olsun', () => {
    expect(fisleriUret(KAYITLAR, 'veli')[0]).toMatchObject({ ad: 'Ali Yılmaz', sinif: '9A' });
  });

  it('boş listede fiş üretmiyor', () => {
    expect(fisleriUret([], 'ogrenci')).toEqual([]);
  });
});

describe('fisMetni', () => {
  it('iki tür farklı başlık ve etiket veriyor', () => {
    expect(fisMetni('ogrenci').baslik).toBe('Öğrenci girişi');
    expect(fisMetni('veli').baslik).toBe('Veli girişi');
    expect(fisMetni('ogrenci').kodEtiketi).not.toBe(fisMetni('veli').kodEtiketi);
  });

  it('her iki fişte de adres yazıyor', () => {
    expect(fisMetni('ogrenci').satirlar.join(' ')).toContain(ADRES);
    expect(fisMetni('veli').satirlar.join(' ')).toContain(ADRES);
  });

  /**
   * Öğrenciye "sen", veliye "siz" — 0026'da karne cümlelerinde verilen
   * kararın aynısı. Yanlış muhatap, fişi tuhaf yapar.
   */
  it('öğrenciye sen, veliye siz diye sesleniyor', () => {
    expect(fisMetni('ogrenci').satirlar.join(' ')).toContain('git');
    expect(fisMetni('veli').satirlar.join(' ')).toContain('girin');
  });

  it('fiş metni kısa kalıyor — kesilip dağıtılan bir kâğıt', () => {
    for (const tur of ['ogrenci', 'veli'] as const) {
      for (const satir of fisMetni(tur).satirlar) {
        expect(satir.length).toBeLessThanOrEqual(60);
      }
    }
  });
});

describe('sayfalaraBol', () => {
  const fis = (i: number) => ({ tur: 'ogrenci' as const, ad: 'Ö' + i, sinif: '9A', kod: 'K' + i });

  it('A4 başına 10 fiş', () => {
    expect(SAYFA_BASINA).toBe(10);
    const sayfalar = sayfalaraBol(Array.from({ length: 25 }, (_, i) => fis(i)));
    expect(sayfalar.map((s) => s.length)).toEqual([10, 10, 5]);
  });

  it('tam sayfa dolduğunda boş sayfa açmıyor', () => {
    expect(sayfalaraBol(Array.from({ length: 20 }, (_, i) => fis(i)))).toHaveLength(2);
  });

  it('boş listede sayfa yok', () => {
    expect(sayfalaraBol([])).toEqual([]);
  });

  it('hiçbir fiş kaybolmuyor', () => {
    const hepsi = Array.from({ length: 37 }, (_, i) => fis(i));
    expect(sayfalaraBol(hepsi).flat().map((f) => f.kod)).toEqual(hepsi.map((f) => f.kod));
  });
});
