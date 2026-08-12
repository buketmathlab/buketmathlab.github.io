import { describe, expect, it } from 'vitest';
import { puanMesaji } from './ewalu-puan';

/**
 * Aralık sınırı hatası SESSİZDİR: kod çalışır, test geçer, öğrenci yanlış
 * cümleyi görür. Bu yüzden sınırlar tek tek ölçülüyor.
 */
describe('puanMesaji', () => {
  it('her bandın sınırlarında doğru cümleyi veriyor', () => {
    // 100 tek başına bir bant
    expect(puanMesaji(100).cumle).toContain('tam puanla');

    // 85–99
    expect(puanMesaji(99).cumle).toContain('Çok iyi gidiyorsun');
    expect(puanMesaji(85).cumle).toContain('Çok iyi gidiyorsun');

    // 70–84
    expect(puanMesaji(84).cumle).toContain('İyi bir sonuç aldın');
    expect(puanMesaji(70).cumle).toContain('İyi bir sonuç aldın');

    // 50–69
    expect(puanMesaji(69).cumle).toContain('henüz tam oturmamış');
    expect(puanMesaji(50).cumle).toContain('henüz tam oturmamış');

    // 0–49
    expect(puanMesaji(49).cumle).toContain('Bu ödev seni zorlamış');
    expect(puanMesaji(0).cumle).toContain('Bu ödev seni zorlamış');
  });

  it('sınırın bir altı bir sonraki banda düşüyor', () => {
    // Kaymayı yakalayan asıl kontrol: 100→85, 85→84, 70→69, 50→49
    expect(puanMesaji(100).cumle).not.toEqual(puanMesaji(99).cumle);
    expect(puanMesaji(85).cumle).not.toEqual(puanMesaji(84).cumle);
    expect(puanMesaji(70).cumle).not.toEqual(puanMesaji(69).cumle);
    expect(puanMesaji(50).cumle).not.toEqual(puanMesaji(49).cumle);
  });

  it('85 ALTINDA kutlama pozu HİÇ çıkmıyor', () => {
    // Düzeltmenin asıl konusu bu: 20 alan öğrenciyi kutlayan ayı olmayacak.
    for (let p = 0; p < 85; p++) {
      expect(puanMesaji(p).poz).toBe('calisma');
    }
    for (let p = 85; p <= 100; p++) {
      expect(puanMesaji(p).poz).toBe('kutlama');
    }
  });

  it('beş bandın beşi de birbirinden farklı cümle veriyor', () => {
    const cumleler = [100, 90, 75, 60, 30].map((p) => puanMesaji(p).cumle);
    expect(new Set(cumleler).size).toBe(5);
  });

  it('her cümle bir sonraki adımı söylüyor', () => {
    // Yorum tek başına bir şey yaptırmaz; beş bandın beşi de eylem içeriyor.
    const eylem = /çalış|bak|incele|fark et|belirle|bul/i;
    for (const p of [90, 75, 60, 30]) {
      expect(puanMesaji(p).cumle).toMatch(eylem);
    }
  });

  it('aralık dışı ve bozuk değerlerde çökmüyor', () => {
    expect(puanMesaji(-5).poz).toBe('calisma');
    expect(puanMesaji(120).poz).toBe('kutlama');
    expect(puanMesaji(Number.NaN).cumle).toContain('Bu ödev seni zorlamış');
    expect(puanMesaji(84.6).cumle).toContain('Çok iyi gidiyorsun'); // 85'e yuvarlanır
  });
});
