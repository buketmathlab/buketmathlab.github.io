import { describe, expect, it } from 'vitest';
import {
  ANDROID_ADIMI,
  GENEL_ADIM,
  IOS_ADIMI,
  MAC_ADIMI,
  PC_ADIMI,
  yazdirmaAdimi,
} from './yazdirma-yonergesi';
import { yasakKaliplariBul } from './urun-dili';

/** Gerçek tarayıcı dizeleri — uydurma kısaltmalar değil. */
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD_MAC_GIBI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

describe('yazdırma adımı', () => {
  it('dört cihazın dördünü de tanıyor', () => {
    expect(yazdirmaAdimi({ ua: IPHONE })).toBe(IOS_ADIMI);
    expect(yazdirmaAdimi({ ua: ANDROID })).toBe(ANDROID_ADIMI);
    expect(yazdirmaAdimi({ ua: MAC })).toBe(MAC_ADIMI);
    expect(yazdirmaAdimi({ ua: WINDOWS })).toBe(PC_ADIMI);
  });

  /**
   * iPadOS 13'TEN BERİ iPad KENDİNİ Mac GİBİ TANITIYOR.
   *
   * Aynı dize, iki farklı cevap: ayrım `maxTouchPoints`'te. Bu ölçüm
   * olmasaydı iPad'li öğrenci "⌘ + P" okurdu — o tuşlar onda yok.
   */
  it('Mac gibi görünen iPad, dokunma noktasından ayrılıyor', () => {
    expect(yazdirmaAdimi({ ua: IPAD_MAC_GIBI, dokunmaNoktasi: 0 })).toBe(MAC_ADIMI);
    expect(yazdirmaAdimi({ ua: IPAD_MAC_GIBI, dokunmaNoktasi: 5 })).toBe(IOS_ADIMI);
  });

  /** Kendini açıkça iPad diyen eski cihaz da iOS adımını alıyor. */
  it('açıkça iPad diyen dize dokunma bilgisi olmadan da tanınıyor', () => {
    expect(yazdirmaAdimi({ ua: 'Mozilla/5.0 (iPad; CPU OS 12_0 like Mac OS X)' })).toBe(
      IOS_ADIMI,
    );
  });

  /**
   * TANINMAYAN CİHAZ BOŞ DÖNMÜYOR.
   *
   * Boş dönseydi bilinmeyen bir tarayıcıda öğrenci hiçbir şey okumazdı;
   * oysa her tarayıcıda bir yazdırma seçeneği var.
   */
  it('tanınmayan ve boş dizede nötr cümle dönüyor', () => {
    for (const ua of ['', 'SomeNewBrowser/1.0', 'KaiOS/2.5']) {
      const y = yazdirmaAdimi({ ua });
      expect(y).toBe(GENEL_ADIM);
      expect(y.length).toBeGreaterThan(10);
    }
  });

  /** Hiçbir cihazda boş cümle çıkmıyor — beş yolun beşi de dolu. */
  it('hiçbir yol boş dönmüyor', () => {
    for (const ua of [IPHONE, IPAD_MAC_GIBI, ANDROID, MAC, WINDOWS, 'bilinmeyen']) {
      expect(yazdirmaAdimi({ ua }).trim()).not.toBe('');
    }
  });

  /** Ürün dili nöbetçisi burada da geçerli. */
  it('metinlerde yasak kalıp yok', () => {
    const hepsi = [IOS_ADIMI, ANDROID_ADIMI, MAC_ADIMI, PC_ADIMI, GENEL_ADIM].join(' ');
    expect(yasakKaliplariBul(hepsi)).toEqual([]);
  });
});
