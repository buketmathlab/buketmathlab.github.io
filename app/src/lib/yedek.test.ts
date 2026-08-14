import { describe, expect, it } from 'vitest';
import {
  yedekDosyaAdi,
  yedekGecerliMi,
  yedekOzeti,
  yedekTazelik,
  yedekYasiGun,
} from './yedek';

/** `disa_aktar`'ın (0004) gerçek çıktı şekli. */
const TAM = {
  alindi: '2026-08-14T10:00:00Z',
  siniflar: [{ id: '1' }, { id: '2' }],
  ogrenciler: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
  giris_kodlari: [{ kod: 'X' }, { kod: 'Y' }],
  odevler: [{ id: 'o1' }],
  gonderimler: [{ id: 'g1' }, { id: 'g2' }],
  mesajlar: [],
  dersler: [],
  odemeler: [],
};

describe('yedekDosyaAdi', () => {
  it('tarihi ada yazıyor', () => {
    expect(yedekDosyaAdi(new Date(2026, 7, 14))).toBe('sekiz-yedek-2026-08-14.json');
  });

  it('tek haneli ay ve günü sıfırla dolduruyor', () => {
    // Doldurmasaydı "2026-1-5" ile "2026-11-5" ada göre yanlış sıralanırdı.
    expect(yedekDosyaAdi(new Date(2026, 0, 5))).toBe('sekiz-yedek-2026-01-05.json');
  });

  it('YEREL tarihi kullanıyor, UTC değil', () => {
    // Gece yarısına yakın alınan yedek, öğretmenin gününe göre adlanmalı.
    const t = new Date(2026, 11, 31, 23, 30);
    expect(yedekDosyaAdi(t)).toBe('sekiz-yedek-2026-12-31.json');
  });
});

describe('yedekGecerliMi', () => {
  it('tam yanıtı kabul ediyor', () => {
    expect(yedekGecerliMi(TAM)).toBe(true);
  });

  it('BOŞ ama tam yapılı yanıtı da kabul ediyor', () => {
    // Yeni kurulmuş bir sistemde tablolar boştur; bu geçerli bir yedektir.
    const bos = {
      siniflar: [], ogrenciler: [], giris_kodlari: [], odevler: [],
      gonderimler: [], mesajlar: [], dersler: [], odemeler: [],
    };
    expect(yedekGecerliMi(bos)).toBe(true);
  });

  it('bir tablo bile eksikse REDDEDİYOR', () => {
    // Asıl korunan şey bu: alan adı değişirse ya da sunucu yarım yanıt
    // dönerse, öğretmen işe yaramaz bir dosyayı yedek sanmamalı.
    for (const ad of Object.keys(TAM)) {
      if (ad === 'alindi') continue;
      const eksik: Record<string, unknown> = { ...TAM };
      delete eksik[ad];
      expect(yedekGecerliMi(eksik)).toBe(false);
    }
  });

  it('dizi yerine başka bir şey gelirse reddediyor', () => {
    expect(yedekGecerliMi({ ...TAM, ogrenciler: 3 })).toBe(false);
    expect(yedekGecerliMi({ ...TAM, ogrenciler: null })).toBe(false);
  });

  it('bozuk girdide çökmüyor', () => {
    expect(yedekGecerliMi(null)).toBe(false);
    expect(yedekGecerliMi(undefined)).toBe(false);
    expect(yedekGecerliMi('yedek')).toBe(false);
    expect(yedekGecerliMi([])).toBe(false);
  });
});

describe('yedekOzeti', () => {
  it('gerçekte ne alındığını sayıyor', () => {
    expect(yedekOzeti(TAM)).toEqual({
      ogrenci: 3, sinif: 2, odev: 1, gonderim: 2, mesaj: 0, kod: 2,
    });
  });

  it('bozuk girdide sıfırlarla dönüyor, çökmüyor', () => {
    expect(yedekOzeti(null).ogrenci).toBe(0);
    expect(yedekOzeti({ ogrenciler: 'çok' }).ogrenci).toBe(0);
  });
});

describe('yedekYasiGun', () => {
  const simdi = new Date(2026, 7, 14, 12, 0).getTime();

  it('gün farkını veriyor', () => {
    expect(yedekYasiGun(simdi, simdi)).toBe(0);
    expect(yedekYasiGun(simdi - 86_400_000, simdi)).toBe(1);
    expect(yedekYasiGun(simdi - 10 * 86_400_000, simdi)).toBe(10);
  });

  it('hiç yedek yoksa null', () => {
    expect(yedekYasiGun(null, simdi)).toBeNull();
    expect(yedekYasiGun(Number.NaN, simdi)).toBeNull();
  });
});

describe('yedekTazelik', () => {
  it('hiç yedek alınmadıysa UYARIYOR', () => {
    expect(yedekTazelik(null)).toEqual({
      metin: 'Bu cihazdan hiç yedek almadınız.',
      uyar: true,
    });
  });

  it('taze yedekte uyarmıyor', () => {
    expect(yedekTazelik(0).uyar).toBe(false);
    expect(yedekTazelik(1).uyar).toBe(false);
    expect(yedekTazelik(7).uyar).toBe(false);
  });

  it('eşiğin bir günü aşınca uyarıyor', () => {
    // Sınır sessiz hata yeridir: 7 sessiz, 8 uyarmalı.
    expect(yedekTazelik(8).uyar).toBe(true);
    expect(yedekTazelik(30).uyar).toBe(true);
  });

  it('bugün / dün ayrı cümle', () => {
    expect(yedekTazelik(0).metin).toBe('Bugün yedek aldınız.');
    expect(yedekTazelik(1).metin).toBe('Son yedek dün alındı.');
    expect(yedekTazelik(3).metin).toBe('Son yedek 3 gün önce alındı.');
  });
});
