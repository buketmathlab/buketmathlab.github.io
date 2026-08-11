import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RENKLER, KONTRAST_CIFTLERI, type RenkAdi } from './tokens';
import { kontrastOrani } from './kontrast';

const cssYolu = join(__dirname, '..', 'styles', 'index.css');
const css = readFileSync(cssYolu, 'utf8');

describe('renk tokenları', () => {
  it('CSS ile TS arasında kayma olmamalı', () => {
    // Her token, index.css içindeki @theme bloğunda aynı değerle tanımlı olmalı.
    // Bu test olmadan biri CSS'i, diğeri TS'i değiştirir ve fark sessizce yaşar.
    for (const [ad, deger] of Object.entries(RENKLER)) {
      expect(css, `--color-${ad} CSS'te bulunamadı ya da değeri farklı`).toContain(
        `--color-${ad}: ${deger};`,
      );
    }
  });

  it('okul mühründen ölçülen lacivert ana renk olmalı', () => {
    // Değer tahmin değil: mühür görselinin koyu piksellerinin baskın kümesi.
    expect(RENKLER.ink).toBe('#001737');
  });
});

describe('WCAG AA kontrastı', () => {
  it.each(KONTRAST_CIFTLERI)(
    '$aciklama ($on / $arka) en az $min olmalı',
    ({ on, arka, min }: { on: RenkAdi; arka: RenkAdi; min: number }) => {
      const oran = kontrastOrani(RENKLER[on], RENKLER[arka]);
      expect(oran).toBeGreaterThanOrEqual(min);
    },
  );
});

describe('kontrast hesabı', () => {
  it('bilinen uç değerleri doğru vermeli', () => {
    expect(kontrastOrani('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(kontrastOrani('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  it('geçersiz renk kodunu reddetmeli', () => {
    expect(() => kontrastOrani('kirmizi', '#fff')).toThrow(/Geçersiz renk kodu/);
  });
});
