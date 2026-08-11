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

describe('öğretmenin biçimi — "1C 2B"', () => {
  // Öğretmen cevap anahtarını bu biçimde yazacağını bildirdi. Gerçek PDF'lerle
  // uçtan uca ölçüldü; burada biçimin kendisi regresyona karşı kilitleniyor.
  const CEVAPLAR = 'CBADECABDEACEBDCAEBD';
  const bekle = (s: ReturnType<typeof anahtariCikar>) =>
    Array.from({ length: 20 }, (_, i) => s.anahtar[i + 1] ?? '_').join('');

  it('tek satır, ayraçsız: "1C 2B 3A…"', () => {
    const metin = CEVAPLAR.split('')
      .map((h, i) => `${i + 1}${h}`)
      .join(' ');
    expect(bekle(anahtariCikar(metin, { soruSayisi: 20 }))).toBe(CEVAPLAR);
  });

  it('alt alta, her satırda bir cevap', () => {
    const satirlar = CEVAPLAR.split('').map((h, i) => `${i + 1}${h}`);
    expect(bekle(anahtariCikar(satirlar, { soruSayisi: 20 }))).toBe(CEVAPLAR);
  });

  it('başlık satırı ve tarih anahtarı bozmuyor', () => {
    const satirlar = [
      'MATEMATİK — CEVAP ANAHTARI',
      '9A / 9B    Son teslim: 20.08.2026',
      ...CEVAPLAR.split('').map((h, i) => `${i + 1}${h}`),
    ];
    expect(bekle(anahtariCikar(satirlar, { soruSayisi: 20 }))).toBe(CEVAPLAR);
  });

  it('boşluklu yazım: "1 C  2 B"', () => {
    const metin = CEVAPLAR.split('')
      .map((h, i) => `${i + 1} ${h}`)
      .join('  ');
    expect(bekle(anahtariCikar(metin, { soruSayisi: 20 }))).toBe(CEVAPLAR);
  });

  it('tek/çift haneli geçişte kayma yok (9 → 10)', () => {
    const s = anahtariCikar('8B 9D 10E 11A', { soruSayisi: 12 });
    expect(s.anahtar[8]).toBe('B');
    expect(s.anahtar[9]).toBe('D');
    expect(s.anahtar[10]).toBe('E');
    expect(s.anahtar[11]).toBe('A');
  });

  it('PDF eksik kalırsa uydurmaz, eksiği bildirir', () => {
    // Gerçekte yaşandı: metin sayfa kenarından taştı, son cevap PDF'te yoktu.
    const s = anahtariCikar('1C 2B 3A', { soruSayisi: 5 });
    expect(s.eksik).toEqual([4, 5]);
    expect(s.anahtar[4]).toBeUndefined();
  });
});

describe('öğretmenin gerçek biçimi — çözümlü anahtar', () => {
  // Öğretmenin PDF'inden BİREBİR okunan satırlar (10C üslü-köklü, 2026).
  // Cevap bir satırda "Cevap: C)", soru numarası BİR SONRAKİ satırda "01".
  // İlk sürüm bu biçimde 0/10 buluyordu; kendi ürettiğim örneklerin hiçbiri
  // böyle değildi. Gerçek dosya gelince ortaya çıktı.
  const SATIRLAR = [
    'B E Ş İ K T A Ş',
    'ARNAVUTKÖY KORKMAZ YİĞİT ANADOLU LİSESİ',
    'Üslü ve Köklü Sayılar · Cevap Anahtarı · 10. Sınıf · 2026',
    'Cevap Anahtarı',
    '6·6·6·6=6⁴ doğru; (1/3)³=3⁻³ doğru → I ve II doğru Cevap: C) I ve II',
    '01',
    '-3²=-9 (yanlış); (-3)⁻³=-1/27 (doğru) → yalnız II doğru Cevap: B) Yalnız II',
    '02',
    '√200-√288+√98 = 5√2 Cevap: B) 5√2',
    '03',
    'm⁻ⁿ-n⁻ᵐ = (-2)³-(-3)² = -17 Cevap: -17',
    '04',
    '⁵√-32=-2, ³√64=4 → -4 Cevap: B) -4',
    '05',
    'Buket Topuzoğlu · Matematik Öğretmeni MATEMATİK · 10C · CEVAP ANAHTARI 01',
  ];

  it('cevabı bir sonraki satırdaki numarayla eşler', () => {
    const s = anahtariCikar(SATIRLAR, { soruSayisi: 5 });
    expect(s.anahtar[1]).toBe('C');
    expect(s.anahtar[2]).toBe('B');
    expect(s.anahtar[3]).toBe('B');
    expect(s.anahtar[5]).toBe('B');
  });

  it('harf içermeyen cevabı UYDURMAZ, eksik bırakır', () => {
    // 4. soruda "Cevap: -17" var — şık harfi yok. Anahtarın kendisinde
    // eksik; sistem burayı boş bırakıp öğretmene göstermeli.
    const s = anahtariCikar(SATIRLAR, { soruSayisi: 5 });
    expect(s.anahtar[4]).toBeUndefined();
    expect(s.eksik).toEqual([4]);
  });

  it('"CEVAP ANAHTARI" başlığını cevap sanmaz', () => {
    // Alt bilgi satırında "CEVAP ANAHTARI 01" geçiyor ama iki nokta yok.
    const s = anahtariCikar(['CEVAP ANAHTARI 01', 'MATEMATİK · CEVAP ANAHTARI'], {
      soruSayisi: 3,
    });
    expect(s.anahtar).toEqual({});
  });

  it('sıfırla başlayan numarayı doğru okur (01 → 1)', () => {
    const s = anahtariCikar(['… Cevap: D) 5', '07'], { soruSayisi: 10 });
    expect(s.anahtar[7]).toBe('D');
  });

  it('numara cevaptan ÖNCE gelirse de eşler', () => {
    const s = anahtariCikar(['03', 'çözüm … Cevap: E) 12'], { soruSayisi: 5 });
    expect(s.anahtar[3]).toBe('E');
  });

  it('ana desen tuttuğunda çözümlü yola hiç gitmez', () => {
    // Karışık bir dosyada ana desen daha kesin; öncelik onda kalmalı.
    const s = anahtariCikar(['1A 2B 3C'], { soruSayisi: 3 });
    expect(s.anahtar).toEqual({ 1: 'A', 2: 'B', 3: 'C' });
  });
});
