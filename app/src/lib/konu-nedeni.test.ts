import { describe, expect, it } from 'vitest';
import { ESKI_METIN, konuYokNedeni, type KonuVerisi } from './konu-nedeni';

const v = (o: Partial<KonuVerisi>): KonuVerisi => ({
  test_odev: 3,
  dolan_test: 2,
  konulu_dolan_test: 2,
  yeterli_konu: 1,
  en_az_cevap: 5,
  ...o,
});

describe('konu nedeni', () => {
  it('sunucu alanı göndermezse eski metin', () => {
    expect(konuYokNedeni(10, undefined)).toBe(ESKI_METIN);
  });
  it('sıra: test yok → süresi dolmadı → konu girilmemiş → yeterli cevap yok → zorlanılan yok', () => {
    expect(
      konuYokNedeni(10, v({ test_odev: 0, dolan_test: 0, konulu_dolan_test: 0, yeterli_konu: 0 })),
    ).toBe('10. sınıflarda henüz test ödevi yok. Konu analizi test ödevlerinden çıkar.');
    expect(konuYokNedeni(10, v({ dolan_test: 0, konulu_dolan_test: 0, yeterli_konu: 0 }))).toBe(
      '10. sınıflarda test ödevlerinin süresi henüz dolmadı. Son tarih geçince konular burada görünür.',
    );
    expect(konuYokNedeni(10, v({ konulu_dolan_test: 0, yeterli_konu: 0 }))).toBe(
      '10. sınıflarda süresi dolan testlerde sorulara konu girilmemiş. Konu girilince burada görünür.',
    );
    expect(konuYokNedeni(10, v({ yeterli_konu: 0 }))).toBe(
      '10. sınıflarda henüz hiçbir konuda yeterli cevap yok (konu başına en az 5 cevap gerekiyor).',
    );
    expect(konuYokNedeni(10, v({}))).toBe('10. sınıflarda yanlış ya da boş bırakılan konu yok.');
  });
  it('0070: konular süresi dolmamış testlerde → "konusu girilmiş testlerin süresi henüz dolmadı"', () => {
    expect(konuYokNedeni(10, v({ konulu_dolan_test: 0, yeterli_konu: 0, konulu_test: 2 }))).toBe(
      '10. sınıflarda konusu girilmiş testlerin süresi henüz dolmadı. Son tarih geçince konular burada görünür.',
    );
    // hiç konulu test yoksa eski yazı
    expect(konuYokNedeni(10, v({ konulu_dolan_test: 0, yeterli_konu: 0, konulu_test: 0 }))).toMatch(
      /sorulara konu girilmemiş/,
    );
    // alan gelmezse (0070 öncesi) eski davranış
    expect(konuYokNedeni(10, v({ konulu_dolan_test: 0, yeterli_konu: 0 }))).toMatch(
      /sorulara konu girilmemiş/,
    );
  });

  it('müdüre de uygun: talimat yok, yalnız durum', () => {
    for (const o of [
      { test_odev: 0 },
      { dolan_test: 0 },
      { konulu_dolan_test: 0 },
      { yeterli_konu: 0 },
      {},
    ]) {
      expect(konuYokNedeni(9, v(o))).not.toMatch(/düzenleyin|girin|ekleyin/);
    }
  });
});
