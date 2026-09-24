import { describe, expect, it } from 'vitest';
import {
  BOS_SINIF,
  FIS_BASLIGI,
  KAPSAM_NOTU,
  KONU_BASLIGI,
  LISTE_BASLIGI,
  OKUL_ADI,
  SAYFA_ACIKLAMASI,
  YAZDIR_FIS,
  YAZDIR_LISTE,
  fisAltNotu,
  konuSatiri,
  odevSayilariYazisi,
  ortalamaSatiri,
  tarihYazisi,
} from './sinif-yazdirma-metni';
import { yasakKaliplariBul } from './urun-dili';

const AN = new Date('2026-09-24T14:35:00+03:00');

describe('sinif-yazdirma-metni', () => {
  /** Ürün dili nöbetçisi kâğıtta da geçerli. */
  it('metinlerde yasak kalıp yok', () => {
    const hepsi = [
      OKUL_ADI,
      LISTE_BASLIGI,
      FIS_BASLIGI,
      SAYFA_ACIKLAMASI,
      KONU_BASLIGI,
      KAPSAM_NOTU,
      BOS_SINIF,
      YAZDIR_LISTE,
      YAZDIR_FIS,
      odevSayilariYazisi(6, 4, 2),
      ortalamaSatiri(54.5),
      ortalamaSatiri(null),
      konuSatiri(['Köklü Sayılar']) ?? '',
      fisAltNotu('9A', AN),
    ].join(' ');
    expect(yasakKaliplariBul(hepsi)).toEqual([]);
  });

  /**
   * OKULUN ADI ÖĞRETMENİN YAZDIĞI HÂLİYLE.
   *
   * Armanın erişilebilirlik metni ("Beşiktaş …") BİLEREK ayrı; bu dize
   * çıktıya basılan ad ve öğretmen onu böyle verdi.
   */
  it('okul adı öğretmenin verdiği hâlde', () => {
    expect(OKUL_ADI).toBe('Arnavutköy Korkmaz Yiğit Anadolu Lisesi');
    expect(OKUL_ADI).not.toMatch(/Beşiktaş/);
  });

  /**
   * TARİH VE SAAT BİRLİKTE.
   *
   * Öğretmenin isteği "yazdırdığım tarih olsun". Saat de yazılıyor:
   * sayılar gün içinde değişiyor, iki çıktıdan hangisinin yeni olduğu
   * kâğıttan okunabilmeli.
   */
  it('tarih Türkçe, saatiyle birlikte', () => {
    const y = tarihYazisi(AN);
    expect(y).toMatch(/2026/);
    expect(y).toMatch(/Eylül/);
    expect(y).toMatch(/\d{2}:\d{2}/);
  });

  /** Kâğıt tek başına okunuyor: "verilen" kelimesi yazılı. */
  it('ödev sayıları üçünü de etiketiyle söylüyor', () => {
    const y = odevSayilariYazisi(6, 4, 2);
    expect(y).toContain('Verilen ödev: 6');
    expect(y).toContain('Yapılan: 4');
    expect(y).toContain('Yapılmayan: 2');
  });

  /** Sıfır olan taraf gizlenmiyor — bir bilgidir. */
  it('sıfır olan taraf da yazılıyor', () => {
    expect(odevSayilariYazisi(6, 6, 0)).toContain('Yapılmayan: 0');
  });

  it('ortalama Türkçe ondalıkla ve etiketiyle', () => {
    expect(ortalamaSatiri(54.5)).toBe('Ortalama: 54,5');
    expect(ortalamaSatiri(0)).toBe('Ortalama: 0,0');
  });

  /**
   * ORTALAMASI OLMAYAN ÖĞRENCİNİN FİŞİNE SIFIR BASILMIYOR.
   *
   * Dönem başında süresi dolmuş hiç ödev yoktur; her fişe "0,0" basmak,
   * ödev vermediğimiz için çocuğu başarısız göstermek olurdu. Kâğıt geri
   * alınamaz, bu yüzden burada ekrandan daha da dikkatli olmak gerekir.
   */
  it('ortalama yoksa sıfır basılmıyor', () => {
    expect(ortalamaSatiri(null)).toBe('Ortalama: henüz ödev yok');
    expect(ortalamaSatiri(null)).not.toContain('0');
  });

  /** Öğretmenin isteği: konu BAŞLIKLARI — çoğul, hepsi yan yana. */
  it('konu başlıklarının hepsi yazılıyor', () => {
    const y = konuSatiri(['Köklü Sayılar', 'Üslü İfadeler', 'Çarpanlara Ayırma']);
    expect(y).toContain('Köklü Sayılar');
    expect(y).toContain('Üslü İfadeler');
    expect(y).toContain('Çarpanlara Ayırma');
  });

  /**
   * LİSTE BOŞKEN CÜMLE KURULMUYOR.
   *
   * Boşluğun iki ayrı sebebi var (5 soruluk birikim yok / yanlışı yok) ve
   * kâğıt ikisini ayırt edemiyor.
   */
  it('konu yokken satır hiç basılmıyor', () => {
    expect(konuSatiri([])).toBeNull();
  });

  /**
   * BAŞLIK ÇOCUĞU NİTELEMİYOR.
   *
   * Veliye giden kâğıtta "eksik" ya da "başarısız" gibi bir etiket yok;
   * bir sonraki adım yazılı. Öğretmenin dil kuralı: ÖĞRENCİYİ ETİKETLEME,
   * GELİŞİMİ GÖSTER.
   */
  it('konu başlığı etiket değil, bir sonraki adım', () => {
    expect(KONU_BASLIGI).toMatch(/çalışılacak/);
    expect(KONU_BASLIGI).not.toMatch(/başarısız|yetersiz|zayıf/i);
  });

  /** Sayıların kapsamı kâğıtta yazılı — toplantıda yanlış okunmasın. */
  it('kapsam notu süre kapısını söylüyor', () => {
    expect(KAPSAM_NOTU).toMatch(/süresi dolmuş/);
    expect(KAPSAM_NOTU).toMatch(/devam eden/);
  });

  /**
   * FİŞ KESİLDİKTEN SONRA DA NEREDEN GELDİĞİNİ SÖYLÜYOR.
   *
   * Sayfa başlığı kesilince gidiyor; okul, sınıf ve tarih fişin kendi
   * içinde de duruyor.
   */
  it('fiş alt notu okul, sınıf ve tarihi taşıyor', () => {
    const y = fisAltNotu('9A', AN);
    expect(y).toContain(OKUL_ADI);
    expect(y).toContain('9A');
    expect(y).toMatch(/2026/);
  });
});
