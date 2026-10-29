import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SON_TESLIM_ETIKETI,
  VERILIS_ETIKETI,
  gunYaz,
  sonTeslimMetni,
  tarihSatiri,
  uzatmaEtiketi,
  uzatmaMetni,
  verilisMetni,
} from './odev-tarihleri';
import { yasakKaliplariBul } from './urun-dili';
import type { OdevTarihleri } from '@/types/api';

/** Yayınlanmış, tarihi hiç değişmemiş ödev. */
const duz: OdevTarihleri = {
  verilis: '2026-10-19T08:30:00+03:00',
  son_tarih: '2026-11-05',
  ilk_son_tarih: null,
  degisiklik: 0,
  yon: null,
};

const taslak: OdevTarihleri = {
  verilis: null,
  son_tarih: '2026-11-05',
  ilk_son_tarih: null,
  degisiklik: 0,
  yon: null,
};

const uzatilmis: OdevTarihleri = {
  verilis: '2026-10-19T08:30:00+03:00',
  son_tarih: '2026-11-05',
  ilk_son_tarih: '2026-11-01',
  degisiklik: 1,
  yon: 'uzatildi',
};

const oneAlinmis: OdevTarihleri = {
  verilis: '2026-10-19T08:30:00+03:00',
  son_tarih: '2026-11-02',
  ilk_son_tarih: '2026-11-07',
  degisiklik: 1,
  yon: 'one_alindi',
};

describe('ödev tarihleri metni', () => {
  it('gün biçimi yıl da yazıyor', () => {
    expect(gunYaz('2026-11-05')).toBe('5 Kasım 2026');
    expect(gunYaz('2026-10-19T08:30:00+03:00')).toMatch(/19 Ekim 2026|20 Ekim 2026/);
  });

  /**
   * YIL ŞART. Öğretmenin isteği "geriye dönüp baktığımda" — yılsız bir
   * tarih iki öğretim yılını birbirine karıştırır.
   */
  it('etiketler ve satır dolu', () => {
    expect(VERILIS_ETIKETI).toBe('Verildi');
    expect(SON_TESLIM_ETIKETI).toBe('Son teslim');
    expect(verilisMetni(duz)).toMatch(/^Verildi: \d+ \S+ 2026$/);
    expect(sonTeslimMetni(duz)).toBe('Son teslim: 5 Kasım 2026');
    expect(tarihSatiri(duz)).toMatch(/^Verildi: .* · Son teslim: 5 Kasım 2026$/);
  });

  /**
   * TASLAKTA VERİLİŞ TARİHİ UYDURULMUYOR.
   *
   * `created_at` ile veriliş tarihi aynı şey değil: taslak pazartesi
   * açılıp perşembe yayınlanabilir. Ödev henüz verilmediyse o satır hiç
   * yazılmıyor.
   */
  it('taslakta yalnız son teslim yazılıyor', () => {
    expect(verilisMetni(taslak)).toBeNull();
    expect(tarihSatiri(taslak)).toBe('Son teslim: 5 Kasım 2026');
  });

  /**
   * 0085 ÇALIŞMAMIŞ SUNUCU. Alan hiç gelmiyor; ekran bugünkü hâlinden
   * geriye gitmemeli, yedek tarihle yalnız son teslim yazılmalı.
   */
  it('alan gelmezse yedek tarih kullanılıyor', () => {
    expect(verilisMetni(undefined)).toBeNull();
    expect(uzatmaMetni(undefined)).toBeNull();
    expect(uzatmaEtiketi(null)).toBeNull();
    expect(tarihSatiri(undefined, '2026-11-05')).toBe('Son teslim: 5 Kasım 2026');
    expect(tarihSatiri(undefined)).toBeNull();
  });

  it('uzatma cümlesi iki tarihi de taşıyor', () => {
    expect(uzatmaEtiketi(uzatilmis)).toBe('uzatıldı');
    expect(uzatmaMetni(uzatilmis)).toBe(
      'Son teslim tarihi uzatıldı: 1 Kasım 2026 → 5 Kasım 2026',
    );
  });

  /**
   * ÖNE ALMA DA YAZILIYOR.
   *
   * Yalnız uzatmayı yazmak, öğrencinin elindeki sürenin sessizce
   * kısaldığı tek durum olurdu — dil kuralı: GERÇEĞİ GİZLEME.
   */
  it('tarih öne alındıysa da söyleniyor', () => {
    expect(uzatmaEtiketi(oneAlinmis)).toBe('öne alındı');
    expect(uzatmaMetni(oneAlinmis)).toBe(
      'Son teslim tarihi öne alındı: 7 Kasım 2026 → 2 Kasım 2026',
    );
  });

  it('değişmemiş tarihte uzatma cümlesi yok', () => {
    expect(uzatmaMetni(duz)).toBeNull();
    expect(uzatmaEtiketi(duz)).toBeNull();
  });

  it('birden fazla değişiklikte sayı da yazılıyor', () => {
    expect(uzatmaMetni({ ...uzatilmis, degisiklik: 3 })).toMatch(/\(3 kez değiştirildi\)$/);
    expect(uzatmaMetni(uzatilmis)).not.toMatch(/kez değiştirildi/);
  });

  it('okunamayan tarih ekrana "Invalid Date" yazmıyor', () => {
    expect(gunYaz('abc')).toBeNull();
    expect(gunYaz('')).toBeNull();
    expect(uzatmaMetni({ ...uzatilmis, ilk_son_tarih: 'abc' })).toBeNull();
  });

  it('metinlerde yasak kalıp ve suçlayıcı söz yok', () => {
    const hepsi = [
      tarihSatiri(duz),
      uzatmaMetni(uzatilmis),
      uzatmaMetni(oneAlinmis),
      VERILIS_ETIKETI,
      SON_TESLIM_ETIKETI,
    ].join(' ');
    expect(yasakKaliplariBul(hepsi)).toEqual([]);
    expect(hepsi).not.toMatch(/başarısız|yetersiz|tembel|ihmal|ceza|geç kaldı/i);
  });
});

/**
 * SÖZLEŞME: 0085 DÖRT UCU GERİYE ALMADI.
 *
 * 0085 `odev_detay`, `odevler_listesi`, `ogrenci_odevleri` ve
 * `veli_paneli`'yi EN SON tanımlarından kopyalıyor. Kopyalama elle
 * yapılsaydı önceki turların alanları sessizce düşebilirdi (0007 ailesinin
 * klasik tuzağı). Bu iddia, kopyaların kaynak migration'larla BİREBİR
 * olduğunu — yalnız 0085'in eklediği üç satırın fark olduğunu — dosyaların
 * GERÇEK metnini okuyarak sabitliyor.
 */
describe('0085 kopyaları kaynaklarıyla birebir', () => {
  const kok = resolve(process.cwd(), '../supabase/migrations');

  function govde(dosya: string, ad: string): string[] {
    const satirlar = readFileSync(resolve(kok, dosya), 'utf8').split('\n');
    let bas = -1;
    for (let i = 0; i < satirlar.length; i++) {
      if ((satirlar[i] ?? '').startsWith(`create or replace function public.${ad}(`)) bas = i;
    }
    expect(bas, `${dosya} içinde ${ad} yok`).toBeGreaterThan(-1);
    let son = -1;
    for (let i = bas; i < satirlar.length; i++) {
      if (satirlar[i] === '$$;') {
        son = i;
        break;
      }
    }
    return satirlar.slice(bas, son + 1);
  }

  const uclar: Array<[string, string]> = [
    ['0083_odevi_siniflara_ver.sql', 'odev_detay'],
    ['0073_deneme_hesabi.sql', 'odevler_listesi'],
    ['0082_yeniden_yukleme.sql', 'ogrenci_odevleri'],
    ['0071_veli_odev_dosyalari.sql', 'veli_paneli'],
  ];

  for (const [kaynak, ad] of uclar) {
    it(`${ad} — ${kaynak}`, () => {
      const eski = govde(kaynak, ad);
      const yeni = govde('0085_odev_tarihleri.sql', ad).filter(
        (l) =>
          !l.includes('0085: VERİLİŞ TARİHİ') &&
          !l.includes('öğrencinin ve velinin gördüğü') &&
          !l.includes("'tarihler', public._odev_tarihleri"),
      );
      expect(yeni).toEqual(eski);
    });

    it(`${ad} — tarihler alanı eklendi`, () => {
      expect(govde('0085_odev_tarihleri.sql', ad).join('\n')).toContain(
        "'tarihler', public._odev_tarihleri(d.id, d.son_tarih),",
      );
    });
  }
});
