import { describe, expect, it } from 'vitest';
import { farkCumlesi, puanBekleyenNotu, puanYazisi, TUM_ACIKLAMA } from './ortalama-farki-metni';
import { yasakKaliplariBul } from './urun-dili';

const ornek = { yapilan: 78, tum: 62.4, yapilmayan: 2, puanBekleyen: 0 };

describe('ortalama-farki-metni (0080)', () => {
  it('fark, ekrandaki iki sayının farkı ve Türkçe ondalıkla', () => {
    const c = farkCumlesi(ornek, 'ogrenci');
    expect(c).toContain('Yapmadığın 2 ödev 0 sayıldığı için');
    expect(c).toContain('15,6 puan daha düşük');
  });

  it('kayan nokta artığı cümleye sızmıyor', () => {
    // 70.1 - 46.7 = 23.399999999999995
    expect(farkCumlesi({ ...ornek, yapilan: 70.1, tum: 46.7 }, 'ogrenci')).toContain('23,4 puan');
  });

  it('veli cümlesi üçüncü tekil, "sen" yok', () => {
    const c = farkCumlesi(ornek, 'veli') ?? '';
    expect(c).toContain('Yapmadığı 2 ödev');
    expect(c).not.toMatch(/Yapmadığın|yaptın/);
  });

  it('yapılmayan yoksa fark cümlesi yerine "iki ortalama aynı"', () => {
    const o = { yapilan: 80, tum: 80, yapilmayan: 0, puanBekleyen: 0 };
    expect(farkCumlesi(o, 'ogrenci')).toBe('Süresi dolan bütün ödevlerini yaptın; iki ortalama aynı.');
    expect(farkCumlesi(o, 'veli')).toBe('Süresi dolan bütün ödevlerini yapmış; iki ortalama aynı.');
  });

  it('puanlı ödev yoksa ya da alan gelmediyse cümle yok', () => {
    expect(farkCumlesi({ ...ornek, yapilan: null }, 'ogrenci')).toBeNull();
    expect(farkCumlesi({ ...ornek, tum: null }, 'veli')).toBeNull();
  });

  it('gelecek için iddia yok: "olur", "kapanır", "yükselir" denmiyor', () => {
    const c = `${farkCumlesi(ornek, 'ogrenci')} ${farkCumlesi(ornek, 'veli')}`;
    expect(c).not.toMatch(/olur\b|kapanır|yükselir|artar/);
  });

  it('puan bekleyen notu', () => {
    expect(puanBekleyenNotu(0, 'ogrenci')).toBeNull();
    expect(puanBekleyenNotu(1, 'ogrenci')).toBe('1 ödevin puan bekliyor; puanı verilince iki ortalamaya da girer.');
    expect(puanBekleyenNotu(2, 'veli')).toBe('2 ödevi puan bekliyor; puanı verilince iki ortalamaya da girer.');
  });

  it('puanYazisi', () => {
    expect(puanYazisi(78)).toBe('78,0');
    expect(puanYazisi(46.67)).toBe('46,7');
  });

  it('ürün dili kurallarına uyuyor', () => {
    const hepsi = [
      farkCumlesi(ornek, 'ogrenci'),
      farkCumlesi(ornek, 'veli'),
      farkCumlesi({ ...ornek, yapilmayan: 0 }, 'ogrenci'),
      puanBekleyenNotu(1, 'ogrenci'),
      puanBekleyenNotu(1, 'veli'),
      TUM_ACIKLAMA,
    ].join(' ');
    expect(yasakKaliplariBul(hepsi)).toEqual([]);
  });
});
