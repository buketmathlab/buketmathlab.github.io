import { describe, expect, it } from 'vitest';
import { tazelemeAdresi } from '@/lib/tazele';

const ADRES = 'https://buketmathlab.github.io/yeni/tanitim/';

describe('tazelemeAdresi', () => {
  it('sürüm okunamadıysa hiçbir şey yapmıyor', () => {
    // Çevrimdışı olmak normal bir durum: sayfa açılmaya devam etmeli.
    expect(tazelemeAdresi(ADRES, '20260821195609', null)).toBeNull();
  });

  it('sürümler aynıysa tazelemiyor', () => {
    expect(tazelemeAdresi(ADRES, '20260821195609', '20260821195609')).toBeNull();
  });

  it('sürüm farklıysa adrese ?s ekliyor', () => {
    const y = tazelemeAdresi(ADRES, '20260821195609', '20260822090000');
    expect(y).toBe(`${ADRES}?s=20260822090000`);
  });

  /* SONSUZ DÖNGÜ KİLİDİ — bu dosyanın asıl testi.
   *
   * `?s=` eklenmiş adres önbelleği atladığı için normalde yeni paket
   * gelir ve sürümler eşitlenir. Eşitlenmezse (yayın yarım kalmış,
   * `surum.json` paketten önce güncellenmiş, araya vekil sunucu girmiş)
   * kilit olmadan sayfa kendini sonsuza kadar yeniden yüklerdi. */
  it('adres istenen ?s değerini ZATEN taşıyorsa ikinci kez tazelemiyor', () => {
    const bir = tazelemeAdresi(ADRES, 'eski', 'yeni');
    expect(bir).toBe(`${ADRES}?s=yeni`);
    // İkinci tur: paket hâlâ eski, ama adres artık `?s=yeni` taşıyor.
    expect(tazelemeAdresi(bir as string, 'eski', 'yeni')).toBeNull();
  });

  it('adreste BAŞKA bir ?s varsa yenisiyle değiştiriyor', () => {
    const y = tazelemeAdresi(`${ADRES}?s=cokEski`, 'eski', 'yeni');
    expect(y).toBe(`${ADRES}?s=yeni`);
  });

  it('diğer sorgu parametreleri korunuyor', () => {
    const y = tazelemeAdresi(`${ADRES}?y=1&kaynak=veli`, 'eski', 'yeni');
    // Elle birleştirseydik bu ikisi kaybolurdu.
    const u = new URL(y as string);
    expect(u.searchParams.get('y')).toBe('1');
    expect(u.searchParams.get('kaynak')).toBe('veli');
    expect(u.searchParams.get('s')).toBe('yeni');
  });

  it('# çapası korunuyor', () => {
    // "Sistemi Keşfet ↓" ziyaretçiyi `#ekosistem`e götürüyor; tazeleme
    // onu sayfanın başına atmamalı.
    const y = tazelemeAdresi(`${ADRES}#ekosistem`, 'eski', 'yeni');
    expect(new URL(y as string).hash).toBe('#ekosistem');
  });
});
