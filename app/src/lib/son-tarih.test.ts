import { describe, expect, it } from 'vitest';
import { gunFarki, sureDurumu } from './son-tarih';

const BUGUN = '2026-08-12';

describe('gunFarki', () => {
  it('aynı gün için 0 döner', () => {
    expect(gunFarki('2026-08-12', BUGUN)).toBe(0);
  });

  it('gelecek ve geçmiş günleri doğru sayar', () => {
    expect(gunFarki('2026-08-15', BUGUN)).toBe(3);
    expect(gunFarki('2026-08-09', BUGUN)).toBe(-3);
  });

  it('ay ve yıl sınırını aşar', () => {
    expect(gunFarki('2026-09-01', BUGUN)).toBe(20);
    expect(gunFarki('2027-01-01', BUGUN)).toBe(142);
  });

  /**
   * `new Date('2026-08-12')` bu metni UTC gece yarısı sayar; `new Date()` ise
   * yereldir. İkisi karıştırılırsa negatif ofsetli bir cihazda (örn. UTC-05)
   * "bugün son gün" olan ödev "süresi doldu" görünür.
   *
   * BU TESTİN KARŞILAŞTIRMA TARAFI YOK: bugünü parametre olarak verirsek iki
   * taraf da aynı yoldan geçer ve hata gizlenir. Bu yüzden gerçek "bugün"
   * kullanılıyor. Testin gerçekten yakaladığı `TZ=America/New_York` altında
   * ölçüldü — yerel kurulum kaldırılınca bu satır kırmızıya döner.
   */
  it('bugünün kendi tarihiyle farkı her saat diliminde 0 olmalı', () => {
    const b = new Date();
    const bugununMetni = `${b.getFullYear()}-${String(b.getMonth() + 1).padStart(2, '0')}-${String(
      b.getDate(),
    ).padStart(2, '0')}`;
    expect(gunFarki(bugununMetni)).toBe(0);
    expect(sureDurumu(bugununMetni).gecti).toBe(false);
  });

  it('zaman damgalı değeri de kabul eder', () => {
    expect(gunFarki('2026-08-14T21:30:00Z', BUGUN)).toBe(2);
  });
});

describe('sureDurumu', () => {
  it('bugün, yarın ve kalan günleri insan diliyle anlatır', () => {
    expect(sureDurumu('2026-08-12', BUGUN).metin).toBe('Bugün son gün');
    expect(sureDurumu('2026-08-13', BUGUN).metin).toBe('Yarın son gün');
    expect(sureDurumu('2026-08-15', BUGUN).metin).toBe('3 gün kaldı');
  });

  it('süresi geçmişi işaretler', () => {
    const s = sureDurumu('2026-08-11', BUGUN);
    expect(s.gecti).toBe(true);
    expect(s.metin).toBe('Süresi doldu');
    // Geçmiş ödev "acil" değil: aciliyet yetişilebilecek ödev içindir.
    expect(s.acil).toBe(false);
  });

  it('son gün hâlâ süre içindedir', () => {
    expect(sureDurumu('2026-08-12', BUGUN).gecti).toBe(false);
  });

  it('aciliyet yalnız son üç günde', () => {
    expect(sureDurumu('2026-08-15', BUGUN).acil).toBe(true);
    expect(sureDurumu('2026-08-16', BUGUN).acil).toBe(false);
  });
});
