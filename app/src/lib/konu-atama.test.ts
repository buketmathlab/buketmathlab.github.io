import { describe, expect, it } from 'vitest';
import {
  araligaAta,
  araligiDenetle,
  konuAdiniDuzelt,
  konuOzeti,
  konusuzSorular,
  soruyaAta,
  sunucudanOku,
  sunucuyaHazirla,
} from './konu-atama';

describe('araligaAta', () => {
  it('KAPALI aralık: 1–5 beş soruyu da kapsıyor', () => {
    // Bir eksik atamak sessiz bir hatadır: 5. sorunun konusu boş kalır,
    // öğrenci o konuda eksiği olduğunu hiç öğrenmez.
    const k = araligaAta({}, 1, 5, 'Türev', 10);
    expect(Object.keys(k)).toEqual(['1', '2', '3', '4', '5']);
    expect(k[5]).toBe('Türev');
    expect(k[6]).toBeUndefined();
  });

  it('tek soruluk aralık çalışıyor', () => {
    expect(araligaAta({}, 3, 3, 'Limit', 10)).toEqual({ 3: 'Limit' });
  });

  it('üstüne yazıyor, öncekini bırakmıyor', () => {
    const k = araligaAta({ 2: 'Türev', 3: 'Türev' }, 2, 3, 'Limit', 5);
    expect(k[2]).toBe('Limit');
    expect(k[3]).toBe('Limit');
  });

  it('girdiyi DEĞİŞTİRMİYOR', () => {
    const once = { 1: 'Türev' };
    araligaAta(once, 1, 3, 'Limit', 5);
    expect(once).toEqual({ 1: 'Türev' });
  });

  it('geçersiz aralıkta hiçbir şey atamıyor', () => {
    const once = { 1: 'Türev' };
    expect(araligaAta(once, 4, 2, 'Limit', 5)).toBe(once);
    expect(araligaAta(once, 1, 99, 'Limit', 5)).toBe(once);
    expect(araligaAta(once, 1, 3, '   ', 5)).toBe(once);
  });
});

describe('araligiDenetle', () => {
  it('sınır değerleri kabul ediyor', () => {
    expect(araligiDenetle(1, 10, 'Türev', 10)).toBeNull();
    expect(araligiDenetle(10, 10, 'Türev', 10)).toBeNull();
  });

  it('sınırın bir dışını reddediyor', () => {
    expect(araligiDenetle(0, 5, 'Türev', 10)).not.toBeNull();
    expect(araligiDenetle(1, 11, 'Türev', 10)).not.toBeNull();
    expect(araligiDenetle(6, 5, 'Türev', 10)).not.toBeNull();
  });

  it('konu adı boşsa reddediyor', () => {
    expect(araligiDenetle(1, 5, '', 10)).toBe('Önce konu adını yazın.');
    expect(araligiDenetle(1, 5, '   ', 10)).toBe('Önce konu adını yazın.');
  });

  it('tam sayı olmayan numarayı reddediyor', () => {
    expect(araligiDenetle(Number.NaN, 5, 'Türev', 10)).not.toBeNull();
    expect(araligiDenetle(1.5, 5, 'Türev', 10)).not.toBeNull();
  });
});

describe('konuAdiniDuzelt', () => {
  it('aynı konunun ikiye bölünmesini engelliyor', () => {
    // "Türev" ve "Türev " iki ayrı satır olsaydı analiz bölünürdü.
    expect(konuAdiniDuzelt('  Türev  ')).toBe('Türev');
    expect(konuAdiniDuzelt('Belirli   İntegral')).toBe('Belirli İntegral');
  });
});

describe('soruyaAta', () => {
  it('tek soruyu aralıktan bağımsız değiştiriyor', () => {
    const k = soruyaAta({ 1: 'Türev', 2: 'Türev', 3: 'Türev' }, 2, 'Limit');
    expect(k).toEqual({ 1: 'Türev', 2: 'Limit', 3: 'Türev' });
  });

  it('boş metin konuyu siliyor', () => {
    expect(soruyaAta({ 1: 'Türev' }, 1, '')).toEqual({});
    expect(soruyaAta({ 1: 'Türev' }, 1, '  ')).toEqual({});
  });
});

describe('konusuzSorular', () => {
  it('eksikleri sırayla veriyor', () => {
    expect(konusuzSorular({ 1: 'Türev', 3: 'Limit' }, 4)).toEqual([2, 4]);
    expect(konusuzSorular({ 1: 'a', 2: 'a' }, 2)).toEqual([]);
  });
});

describe('konuOzeti', () => {
  it('konuları ilk göründükleri sıraya göre topluyor', () => {
    const o = konuOzeti({ 1: 'Türev', 2: 'Limit', 3: 'Türev' }, 3);
    expect(o).toEqual([
      { konu: 'Türev', sorular: [1, 3] },
      { konu: 'Limit', sorular: [2] },
    ]);
  });

  it('soru sayısının dışındakileri saymıyor', () => {
    expect(konuOzeti({ 1: 'Türev', 9: 'Limit' }, 3)).toEqual([{ konu: 'Türev', sorular: [1] }]);
  });
});

describe('sunucuyaHazirla', () => {
  it('boş nesne döndürüyor, null DEĞİL', () => {
    // Sunucuda null "DEĞİŞTİRME" demek. Öğretmen hepsini sildiyse boş nesne
    // gitmeli, yoksa silme sessizce kaydedilmez.
    expect(sunucuyaHazirla({}, 5)).toEqual({});
  });

  it('soru sayısının dışında kalanları göndermiyor', () => {
    expect(sunucuyaHazirla({ 1: 'Türev', 7: 'Limit' }, 3)).toEqual({ '1': 'Türev' });
  });
});

describe('sunucudanOku', () => {
  it('metin anahtarları sayıya çeviriyor', () => {
    expect(sunucudanOku({ '1': 'Türev', '2': 'Limit' })).toEqual({ 1: 'Türev', 2: 'Limit' });
  });

  it('null ve bozuk girdide çökmüyor', () => {
    expect(sunucudanOku(null)).toEqual({});
    expect(sunucudanOku(undefined)).toEqual({});
    expect(sunucudanOku({ abc: 'Türev', '0': 'Limit', '2': '  ' })).toEqual({});
  });

  it('gidip gelince aynı kalıyor', () => {
    const k = { 1: 'Türev', 2: 'Türev', 3: 'Limit' };
    expect(sunucudanOku(sunucuyaHazirla(k, 3))).toEqual(k);
  });
});
