import { describe, expect, it } from 'vitest';
import { karneSozu, YASAKLI_KELIMELER } from '@/lib/karne-sozu';
import type { KonuAnalizi } from '@/types/api';

const konu = (
  ad: string,
  toplam: number,
  dogru: number,
): KonuAnalizi => ({
  konu: ad,
  toplam,
  dogru,
  yanlis: toplam - dogru,
  bos: 0,
});

describe('karneSozu', () => {
  it('değerlendirilmiş ödev yokken "henüz" diyor, "eksiğin yok" demiyor', () => {
    const s = karneSozu([], 0);
    expect(s.ogrenci).toContain('Henüz');
    expect(s.veli).toContain('Henüz');
    // ÖLÇÜLEN ŞEY YOKKEN "tamsın" demek uydurma bir övgü olurdu.
    expect(s.ogrenci).not.toContain('tamsın');
  });

  it('ödev varsa ama konu dökümü boşsa yine "henüz" diyor', () => {
    // Yalnız açık uçlu ödev verilmiş olabilir: ödev sayısı 2, konu 0.
    expect(karneSozu([], 2).ogrenci).toContain('Henüz');
  });

  it('bütün konular tamken kutluyor ama abartmıyor', () => {
    const s = karneSozu([konu('Türev', 4, 4), konu('Limit', 3, 3)], 2);
    expect(s.ogrenci).toContain('tamsın');
    expect(s.veli).toContain('tam');
  });

  it('EN ZAYIF konuyu adıyla söylüyor ve sunucunun sırasını bozmuyor', () => {
    // Sunucu en zayıfı başa koyuyor; bileşen de fonksiyon da yeniden
    // sıralamıyor. İlk sıradaki eksik konu cümleye girmeli.
    const s = karneSozu([konu('Oran', 4, 0), konu('Kesirler', 4, 2)], 3);
    expect(s.ogrenci).toContain('Oran');
    expect(s.ogrenci).not.toContain('Kesirler');
  });

  it('tam yapılan konu başta olsa bile cümleye EKSİK olan giriyor', () => {
    // Savunma: bir gün sıralama değişirse cümle yine eksik bir konuyu
    // söylemeli, "Türev konusunda takılmışsın" deyip 4/4'ü göstermemeli.
    const s = karneSozu([konu('Türev', 4, 4), konu('Limit', 4, 1)], 2);
    expect(s.ogrenci).toContain('Limit');
    expect(s.ogrenci).not.toContain('Türev');
  });

  it('öğrenciye "sen", veliye üçüncü tekil sesleniyor', () => {
    const s = karneSozu([konu('Oran', 4, 1)], 2);
    expect(s.ogrenci).toMatch(/mışsın|başlayalım/);
    expect(s.veli).not.toContain('takılmışsın');
  });

  it('HİÇBİR cümlede kıyas ya da eğilim kelimesi yok', () => {
    const durumlar = [
      karneSozu([], 0),
      karneSozu([], 3),
      karneSozu([konu('Türev', 4, 4)], 2),
      karneSozu([konu('Oran', 4, 0), konu('Kesirler', 4, 3)], 5),
    ];
    for (const s of durumlar) {
      for (const kelime of YASAKLI_KELIMELER) {
        expect(s.ogrenci.toLocaleLowerCase('tr')).not.toContain(kelime);
        expect(s.veli.toLocaleLowerCase('tr')).not.toContain(kelime);
      }
    }
  });

  it('cümleler bir sonraki adımla bitiyor, hükümle değil', () => {
    const s = karneSozu([konu('Oran', 4, 0)], 2);
    expect(s.ogrenci).toMatch(/başlayalım\.$/);
    expect(karneSozu([], 0).ogrenci).toMatch(/göreceğiz\.$/);
  });
});
