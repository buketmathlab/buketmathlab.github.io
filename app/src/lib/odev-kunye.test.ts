import { describe, expect, it } from 'vitest';
import { kunyeyiOku } from '@/lib/odev-kunye';

describe('kunyeyiOku', () => {
  it('düz künyeyi okuyor', () => {
    const r = kunyeyiOku('1  A  Türev\n2  C  Türev\n3  B  Limit', { soruSayisi: 3 });
    expect(r.anahtar).toEqual({ 1: 'A', 2: 'C', 3: 'B' });
    expect(r.konular).toEqual({ 1: 'Türev', 2: 'Türev', 3: 'Limit' });
    expect(r.eksik).toEqual([]);
    expect(r.okunamayan).toEqual([]);
    expect(r.bos).toBe(false);
  });

  // WORD TABLOSU YAPIŞTIRMASI. Öğretmenin gerçek yolu bu: hücreler
  // sekmeyle geliyor ve ilk satır başlık oluyor.
  it('sekmeli Word tablosunu ve başlık satırını kabul ediyor', () => {
    const r = kunyeyiOku('Soru\tCevap\tKonu\n1\tA\tÜslü Sayılar\n2\tD\tKöklü Sayılar', {
      soruSayisi: 2,
    });
    expect(r.anahtar).toEqual({ 1: 'A', 2: 'D' });
    expect(r.konular).toEqual({ 1: 'Üslü Sayılar', 2: 'Köklü Sayılar' });
    expect(r.okunamayan).toEqual([]);
  });

  it('numara ayraçlarının hepsini kabul ediyor', () => {
    const r = kunyeyiOku('1) A - Türev\n2. b : Limit\n3 - C — Türev', { soruSayisi: 3 });
    expect(r.anahtar).toEqual({ 1: 'A', 2: 'B', 3: 'C' });
    // Şıktan sonraki ayraç konuya SIZMAMALI; sızsaydı "Türev" ile
    // "— Türev" iki ayrı konu olur ve konu karnesi ikiye bölünürdü.
    expect(r.konular).toEqual({ 1: 'Türev', 2: 'Limit', 3: 'Türev' });
  });

  it('küçük harf şıkkı büyütüyor', () => {
    const r = kunyeyiOku('1 a Türev', { soruSayisi: 1 });
    expect(r.anahtar).toEqual({ 1: 'A' });
  });

  it('konu adındaki fazla boşlukları tek boşluğa indiriyor', () => {
    const r = kunyeyiOku('1 A   Üslü    Sayılar  ', { soruSayisi: 1 });
    expect(r.konular).toEqual({ 1: 'Üslü Sayılar' });
  });

  it('boş satırları sessizce atlıyor, şikâyet etmiyor', () => {
    const r = kunyeyiOku('\n1 A Türev\n\n\n2 B Limit\n\n', { soruSayisi: 2 });
    expect(r.bulunan).toEqual([1, 2]);
    expect(r.okunamayan).toEqual([]);
  });

  // EKSİK SORU UYDURULMUYOR. Anahtarı olmayan soru boş kalır ve
  // bildirilir; `odev_yayinla` zaten eksik anahtarlı ödevi reddediyor.
  it('atlanan soruyu eksik olarak bildiriyor', () => {
    const r = kunyeyiOku('1 A Türev\n3 B Limit', { soruSayisi: 3 });
    expect(r.bulunan).toEqual([1, 3]);
    expect(r.eksik).toEqual([2]);
  });

  it('konusuz satırı kabul ediyor ama ayrıca bildiriyor', () => {
    const r = kunyeyiOku('1 A Türev\n2 B', { soruSayisi: 2 });
    expect(r.anahtar).toEqual({ 1: 'A', 2: 'B' });
    expect(r.konular).toEqual({ 1: 'Türev' });
    expect(r.konusuz).toEqual([2]);
  });

  // İLK KAYIT KAZANIR. Sessizce üzerine yazsaydık, öğretmenin gördüğü
  // önizlemeyle kaydedilen farklı olurdu.
  it('aynı soruya ikinci kaydı yok sayıyor ve çelişkiyi bildiriyor', () => {
    const r = kunyeyiOku('1 A Türev\n1 C Limit\n2 B Limit', { soruSayisi: 2 });
    expect(r.anahtar).toEqual({ 1: 'A', 2: 'B' });
    expect(r.konular[1]).toBe('Türev');
    expect(r.celiskili).toEqual([1]);
  });

  it('aralık dışı numarayı gerekçesiyle reddediyor', () => {
    const r = kunyeyiOku('1 A Türev\n11 B Limit', { soruSayisi: 10 });
    expect(r.anahtar).toEqual({ 1: 'A' });
    expect(r.okunamayan).toHaveLength(1);
    expect(r.okunamayan[0]?.satirNo).toBe(2);
    expect(r.okunamayan[0]?.sebep).toContain('10 soruluk');
  });

  it('okunamayan satırı numarasıyla birlikte bildiriyor', () => {
    const r = kunyeyiOku('1 A Türev\nbu bir cümle\n2 B Limit', { soruSayisi: 2 });
    expect(r.bulunan).toEqual([1, 2]);
    expect(r.okunamayan).toHaveLength(1);
    expect(r.okunamayan[0]?.satirNo).toBe(2);
    expect(r.okunamayan[0]?.metin).toBe('bu bir cümle');
  });

  // "BU KÜNYE DEĞİL" DURUMU. Arayüz hiçbir şey uygulamamalı; bunu
  // ayırt edebilmesi için ayrı bir bayrak var.
  it('hiçbir satır okunamazsa boş bildiriyor', () => {
    const r = kunyeyiOku('Merhaba, bu bir soru kâğıdı.\nİkinci cümle.', { soruSayisi: 5 });
    expect(r.bos).toBe(true);
    expect(r.bulunan).toEqual([]);
    expect(r.okunamayan).toHaveLength(2);
  });

  it('boş metinde çökmüyor', () => {
    const r = kunyeyiOku('', { soruSayisi: 3 });
    expect(r.bos).toBe(true);
    expect(r.eksik).toEqual([1, 2, 3]);
    expect(r.okunamayan).toEqual([]);
  });

  // ŞIK SINIRI ÖDEVE AİT. 4 şıklı bir testte "E" bir şık değildir;
  // sessizce kabul etmek yanlış anahtar kaydetmek olurdu.
  it('sonSecenek D iken E şıkkını reddediyor', () => {
    const r = kunyeyiOku('1 D Türev\n2 E Limit', { soruSayisi: 2, sonSecenek: 'D' });
    expect(r.anahtar).toEqual({ 1: 'D' });
    expect(r.okunamayan).toHaveLength(1);
    expect(r.okunamayan[0]?.satirNo).toBe(2);
  });

  it('konu adı rakam içerebiliyor', () => {
    const r = kunyeyiOku('1 A 2. Dereceden Denklemler', { soruSayisi: 1 });
    expect(r.konular).toEqual({ 1: '2. Dereceden Denklemler' });
  });

  // Başlıkta rakam varsa (ör. "Soru 1") başlık sanıp atlamak, gerçek bir
  // satırı yutmak olurdu — o yüzden rakamlı başlık normal satır gibi
  // ayrıştırılmaya çalışılıyor.
  it('rakam içeren başlık satırını körü körüne atlamıyor', () => {
    const r = kunyeyiOku('Soru 1 A Türev', { soruSayisi: 1 });
    expect(r.bulunan).toEqual([]);
    expect(r.okunamayan).toHaveLength(1);
  });
});
