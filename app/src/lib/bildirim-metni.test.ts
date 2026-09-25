import { describe, expect, it } from 'vitest';
import {
  BOS_ACIKLAMA,
  BOS_BASLIK,
  KAPSAM_NOTU,
  SAYFA_BASLIGI,
  SINIR_NOTU,
  bildirimMetni,
  bildirimZamani,
  zilEtiketi,
  type BildirimTuru,
} from './bildirim-metni';
import { yasakKaliplariBul } from './urun-dili';

const TURLER: BildirimTuru[] = ['mesaj', 'odev', 'teslim', 'sonuc'];

describe('bildirim-metni', () => {
  /** Ürün dili nöbetçisi burada da geçerli. */
  it('metinlerde yasak kalıp yok', () => {
    const hepsi = [
      SAYFA_BASLIGI,
      BOS_BASLIK,
      BOS_ACIKLAMA,
      SINIR_NOTU,
      KAPSAM_NOTU,
      zilEtiketi(0),
      zilEtiketi(3),
      ...TURLER.flatMap((tur) => [
        bildirimMetni({ tur, baslik: 'Köklü Sayılar' }, 'ogrenci'),
        bildirimMetni({ tur, baslik: 'Köklü Sayılar' }, 'veli'),
      ]),
    ].join(' ');
    expect(yasakKaliplariBul(hepsi)).toEqual([]);
  });

  /** Dört türün dördü de cümle kuruyor — hiçbiri boş dönmüyor. */
  it('dört tür de cümle kuruyor', () => {
    for (const tur of TURLER) {
      for (const rol of ['ogrenci', 'veli'] as const) {
        expect(bildirimMetni({ tur, baslik: 'Köklü Sayılar' }, rol).length).toBeGreaterThan(5);
      }
    }
  });

  /**
   * İKİ SES. Veliye çocuk diliyle yazmak ürünün ciddiyetini düşürür.
   */
  it('mesaj cümlesi role göre değişiyor', () => {
    expect(bildirimMetni({ tur: 'mesaj', baslik: null }, 'ogrenci')).toBe(
      'Öğretmeninden yeni mesaj',
    );
    expect(bildirimMetni({ tur: 'mesaj', baslik: null }, 'veli')).toBe(
      'Öğretmeninizden yeni mesaj',
    );
  });

  it('ödev ve teslim cümleleri ödevin adını taşıyor', () => {
    expect(bildirimMetni({ tur: 'odev', baslik: 'Köklü Sayılar' }, 'ogrenci')).toContain(
      'Köklü Sayılar',
    );
    expect(bildirimMetni({ tur: 'teslim', baslik: 'Köklü Sayılar' }, 'ogrenci')).toContain(
      'Köklü Sayılar',
    );
  });

  /**
   * ADI OLMAYAN ÖDEVDE CÜMLE YARIM KALMIYOR.
   *
   * `baslik` boş gelirse "Yeni ödev: " diye biten bir satır çıkardı.
   */
  it('başlık boşken cümle yarım kalmıyor', () => {
    for (const baslik of [null, '', '   ']) {
      const y = bildirimMetni({ tur: 'odev', baslik }, 'ogrenci');
      expect(y).not.toMatch(/:\s*$/);
      expect(y).toContain('Ödev');
    }
  });

  /**
   * TESLİM CÜMLESİ EMİR KİPİNDE DEĞİL.
   *
   * Öğretmenin dil kuralı: gerçeği söyle, baskı kurma. "Yetiştir",
   * "acele et", "unutma" yok.
   */
  it('teslim cümlesi baskı kurmuyor', () => {
    const y = bildirimMetni({ tur: 'teslim', baslik: 'Köklü Sayılar' }, 'ogrenci');
    expect(y).toMatch(/teslimi yarın/);
    expect(y).not.toMatch(/yetiştir|acele|unutma|hemen|son şans/i);
  });

  /**
   * SONUÇ CÜMLESİ PUANI SÖYLEMİYOR.
   *
   * Listeye göz atan herkes (aynı telefona bakan bir kardeş) puanı
   * görürdü. Öğrenci puanı ödevin kendi ekranında görüyor.
   */
  it('sonuç cümlesi puan taşımıyor', () => {
    const y = bildirimMetni({ tur: 'sonuc', baslik: 'Köklü Sayılar' }, 'ogrenci');
    expect(y).toContain('değerlendirildi');
    expect(y).not.toMatch(/\d/);
  });

  /** Zil etiketi sayıyı da taşıyor — sayı tek başına ekran okuyucuda anlamsız. */
  it('zil etiketi yeni sayısını söylüyor', () => {
    expect(zilEtiketi(3)).toContain('3');
    expect(zilEtiketi(0)).not.toMatch(/\d/);
  });

  /**
   * ZAMAN YAZISI 0048'İN KENDİSİ.
   *
   * İkinci bir kopya yazılsaydı iki liste aynı anı iki farklı cümleyle
   * yazardı. Bu iddia, birinin sessizce yeni bir biçim uydurmasını
   * engelliyor.
   */
  it('zaman yazısı mesaj listesindekiyle aynı', () => {
    // SAAT DİLİMİ BAĞIMSIZ: ISO katarına "+03:00" yazmak testi koşan
    // makinenin dilimine bağlardı (0048'in deseni: yerel bileşenlerle kur).
    const simdi = new Date(2026, 8, 25, 12, 0);
    expect(bildirimZamani(new Date(2026, 8, 25, 9, 30).toISOString(), simdi)).toBe('09:30');
    expect(bildirimZamani(new Date(2026, 8, 24, 23, 0).toISOString(), simdi)).toBe('dün 23:00');
    expect(bildirimZamani(null, simdi)).toBe('');
  });

  /**
   * DÜRÜST SINIR YAZILI.
   *
   * Uygulama içi bildirim, uygulama açılmadıkça görünmez. Yazmamak
   * öğrencinin "bana haber gelir" diye beklemesine yol açardı.
   */
  it('telefona bildirim gitmediği açıkça yazıyor', () => {
    expect(SINIR_NOTU).toMatch(/telefona ayrıca bildirim gönderilmez/);
    expect(KAPSAM_NOTU).toMatch(/30 gün/);
  });

  /** Boş durum beklenti yaratmıyor. */
  it('boş durum söz vermiyor', () => {
    expect(BOS_BASLIK).toMatch(/Henüz bildirim yok/);
    expect(BOS_ACIKLAMA).not.toMatch(/yakında|birazdan|gelecek/i);
  });
});
