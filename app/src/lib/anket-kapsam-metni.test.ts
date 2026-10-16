import { describe, expect, it } from 'vitest';
import {
  BOS_DAR,
  KAPSAM_KENDI,
  KAPSAM_OKUL,
  OGRETMEN_GRUBU_NOTU,
  SINIF_SECIMI_ACIKLAMA,
  SINIF_SECIMI_BASLIK,
  SINIF_SECIMI_GUVENCE,
  gizlilikNotu,
  kapsamAdi,
  sinifsizNotu,
} from './anket-kapsam-metni';
import { yasakKaliplariBul } from './urun-dili';

describe('anket kapsamı metni', () => {
  it('sekme adları üç kapsam için de dolu', () => {
    expect(kapsamAdi('okul')).toBe(KAPSAM_OKUL);
    expect(kapsamAdi('kendi')).toBe(KAPSAM_KENDI);
    expect(kapsamAdi('sinif', '9A')).toBe('9A');
    // Adı gelmeyen sınıfta sekme boş kalmıyor.
    expect(kapsamAdi('sinif', null)).toBe('Sınıf');
    expect(kapsamAdi('sinif', '  ')).toBe('Sınıf');
  });

  /**
   * GİZLİLİK NOTU DAR KAPSAMDA VAR, GENELDE YOK.
   *
   * Genelde yanıt bütün okula ait; orada "tahmin edilebilir" demek yanlış
   * olurdu. Dar kapsamda ise bu turun bedeli tam olarak budur.
   */
  it('gizlilik notu yalnız dar kapsamda', () => {
    expect(gizlilikNotu('okul')).toBeNull();
    expect(gizlilikNotu('kendi')).not.toBeNull();
    expect(gizlilikNotu('sinif', '9A')).not.toBeNull();
  });

  /** İki doğru AYNI cümlede: kimlik saklı, ama tahmin edilebilir. */
  it('gizlilik notu iki şeyi birden söylüyor', () => {
    const n = gizlilikNotu('sinif', '9A') ?? '';
    expect(n).toContain('9A');
    expect(n).toMatch(/kimlik saklı/i);
    expect(n).toMatch(/tahmin edilebilir/);
  });

  it('kendi kapsamında not sınıf adı uydurmuyor', () => {
    const n = gizlilikNotu('kendi') ?? '';
    expect(n).toMatch(/derse girdiğiniz sınıflarla/);
    expect(n).toMatch(/tahmin edilebilir/);
  });

  /**
   * SIFIRDA CÜMLE YOK.
   *
   * Her açılışta "0 yanıt sınıfsız" yazmak gürültü olurdu; ama bir tane
   * bile varsa söylenmeli — yoksa toplamlar tutmaz ve öğretmen sayılara
   * güvenmez.
   */
  it('sınıfsız notu yalnız sayı varken çıkıyor', () => {
    expect(sinifsizNotu(0)).toBeNull();
    expect(sinifsizNotu(-3)).toBeNull();
    expect(sinifsizNotu(Number.NaN)).toBeNull();
    const n = sinifsizNotu(7) ?? '';
    expect(n).toContain('7');
    expect(n).toMatch(/sınıfı bilinmiyor/);
  });

  /** Öğretmene eksik grubun sebebi söyleniyor; sessizce gizlenmiyor. */
  it('öğretmen grubunun yokluğu açıklanıyor', () => {
    expect(OGRETMEN_GRUBU_NOTU).toMatch(/öğretmen görünümünde yer almaz/i);
  });

  /**
   * AYARLAR KARTININ GÜVENCESİ.
   *
   * Bu cümle olmadan öğretmen, işareti kaldırınca o sınıfı tamamen
   * kaybedeceğini sanabilir — hiç işaretlemez ve özellik ölü doğardı.
   */
  it('sınıf seçimi kartı yalnız anketi kapsadığını söylüyor', () => {
    expect(SINIF_SECIMI_GUVENCE).toMatch(/yalnız anket/i);
    expect(SINIF_SECIMI_GUVENCE).toMatch(/görmeye devam/);
  });

  it('boş durum söz vermiyor', () => {
    expect(BOS_DAR).toMatch(/henüz yanıt yok/i);
    expect(BOS_DAR).not.toMatch(/yakında|birazdan|gelecek/i);
  });

  /** Ürün dili nöbetçisi burada da geçerli. */
  it('metinlerde yasak kalıp yok', () => {
    const hepsi = [
      KAPSAM_OKUL,
      KAPSAM_KENDI,
      BOS_DAR,
      OGRETMEN_GRUBU_NOTU,
      SINIF_SECIMI_BASLIK,
      SINIF_SECIMI_ACIKLAMA,
      SINIF_SECIMI_GUVENCE,
      gizlilikNotu('kendi') ?? '',
      gizlilikNotu('sinif', '9A') ?? '',
      sinifsizNotu(3) ?? '',
    ].join(' ');
    expect(yasakKaliplariBul(hepsi)).toEqual([]);
  });
});
