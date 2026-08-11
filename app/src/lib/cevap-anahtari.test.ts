import { describe, expect, it } from 'vitest';
import { anahtariCikar } from './cevap-anahtari';

describe('anahtariCikar', () => {
  it('tek satırda numaralı çiftleri okur', () => {
    const s = anahtariCikar('1) A  2) B  3) C  4) D  5) E', { soruSayisi: 5 });
    expect(s.anahtar).toEqual({ 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E' });
    expect(s.eksik).toEqual([]);
    expect(s.yontem).toBe('numarali');
  });

  it('farklı ayraçları ve boşluksuz yazımı kabul eder', () => {
    const s = anahtariCikar(['1.A', '2 - B', '3: C', '4]D', '5   E'], { soruSayisi: 5 });
    expect(s.anahtar).toEqual({ 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E' });
  });

  it('küçük harfleri büyütür', () => {
    expect(anahtariCikar('1 a 2 b', { soruSayisi: 2 }).anahtar).toEqual({ 1: 'A', 2: 'B' });
  });

  it('SORU METNİNDEKİ ŞIKLARI cevap sanmaz', () => {
    // Eski algoritmanın (index.html:159) somut kusuru: bu cümlede
    // "5 → B" ve "6 → C" buluyordu. İkisi de yanlış — onlar şık.
    const s = anahtariCikar('1. Aşağıdakilerden hangisi doğrudur? A) 5 B) 6 C) 7', {
      soruSayisi: 10,
    });
    expect(s.anahtar).toEqual({});
    expect(s.bulunan).toEqual([]);
    // Hiçbiri bulunamadıysa hepsi eksiktir — arayüz "eksik yok" göstermemeli.
    expect(s.eksik).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('başlık satırı ile anahtar satırını birlikte doğru işler', () => {
    const s = anahtariCikar(['TÜREV TESTİ — CEVAP ANAHTARI', '1 C 2 A 3 E 4 B'], {
      soruSayisi: 4,
    });
    expect(s.anahtar).toEqual({ 1: 'C', 2: 'A', 3: 'E', 4: 'B' });
  });

  it('Türkçe kelimeyi şık sanmaz', () => {
    // "12 Bir" → 12 → B olmamalı; "3 CEVAP" → 3 → C olmamalı.
    const s = anahtariCikar(['12 Bir sonraki soruya geçin', '3 CEVAP yok'], { soruSayisi: 20 });
    expect(s.anahtar).toEqual({});
  });

  it('eksik soruları bildirir ve uydurmaz', () => {
    const s = anahtariCikar('1 A 2 B 5 C', { soruSayisi: 5 });
    expect(s.anahtar).toEqual({ 1: 'A', 2: 'B', 5: 'C' });
    expect(s.bulunan).toEqual([1, 2, 5]);
    expect(s.eksik).toEqual([3, 4]);
  });

  it('soru sayısının dışındaki numaraları yok sayar', () => {
    const s = anahtariCikar('1 A 2 B 99 C', { soruSayisi: 2 });
    expect(s.anahtar).toEqual({ 1: 'A', 2: 'B' });
  });

  it('A–D seçildiğinde E şıkkını kabul etmez', () => {
    const s = anahtariCikar('1 A 2 E 3 D', { soruSayisi: 3, sonSecenek: 'D' });
    expect(s.anahtar).toEqual({ 1: 'A', 3: 'D' });
    expect(s.eksik).toEqual([2]);
  });

  it('aynı soruya farklı şık gelirse çelişki olarak bildirir', () => {
    const s = anahtariCikar(['1 A 2 B', '1 C 3 D'], { soruSayisi: 3 });
    expect(s.anahtar[1]).toBe('A'); // ilk görülen kullanılır
    expect(s.celiskili).toEqual([1]);
  });

  it('aynı soru aynı şıkla tekrarlanırsa çelişki saymaz', () => {
    const s = anahtariCikar(['1 A 2 B', '1 A'], { soruSayisi: 2 });
    expect(s.celiskili).toEqual([]);
  });

  it('numara yoksa harf dizisini sırayla eşler ama yöntemi işaretler', () => {
    const s = anahtariCikar('ABCDE', { soruSayisi: 5 });
    expect(s.anahtar).toEqual({ 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E' });
    expect(s.yontem).toBe('harf-dizisi'); // arayüz bunu uyarı olarak göstermeli
  });

  it('harf sayısı soru sayısına eşit değilse dizi eşlemesi YAPMAZ', () => {
    // Belirsizlik varsa tahmin yok.
    const s = anahtariCikar('ABC', { soruSayisi: 5 });
    expect(s.anahtar).toEqual({});
    expect(s.yontem).toBe('bulunamadi');
    expect(s.eksik).toEqual([1, 2, 3, 4, 5]);
  });

  it('boş girdide çökmez ve tüm soruları eksik sayar', () => {
    const s = anahtariCikar('', { soruSayisi: 5 });
    expect(s.yontem).toBe('bulunamadi');
    expect(s.anahtar).toEqual({});
    expect(s.eksik).toEqual([1, 2, 3, 4, 5]);
  });

  it('geçersiz soru sayısında çökmez', () => {
    expect(anahtariCikar('1 A', { soruSayisi: 0 }).yontem).toBe('bulunamadi');
    expect(anahtariCikar('1 A', { soruSayisi: -3 }).yontem).toBe('bulunamadi');
  });

  it('çok sütunlu tablo düzenini okur', () => {
    const s = anahtariCikar(
      ['1  A    11 C    21 E', '2  B    12 D    22 A', '3  C    13 E    23 B'],
      { soruSayisi: 25 },
    );
    expect(s.anahtar[1]).toBe('A');
    expect(s.anahtar[11]).toBe('C');
    expect(s.anahtar[21]).toBe('E');
    expect(s.anahtar[23]).toBe('B');
    expect(s.eksik).toContain(24);
  });
});
