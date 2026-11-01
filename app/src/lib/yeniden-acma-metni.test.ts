import { describe, it, expect } from 'vitest';
import type { YenidenAcma } from '@/types/api';
import {
  BASLIK,
  oncekiPuanMetni,
  oncekiGonderimMetni,
  yenidenAcmaSatiri,
  yeniTarihMetni,
  ogretmenDurumu,
} from './yeniden-acma-metni';

const TAM: YenidenAcma = {
  zaman: '2026-10-31T09:14:00+03:00',
  neden: 'Soruda düzeltme yapıldı.',
  yeni_son_tarih: '2026-11-12',
  onceki_puan: 75,
  onceki_durum: 'puanlandi',
};

/** Veliye giden hâl: sunucu `neden` ve `onceki_durum` göndermiyor. */
const VELIYE: YenidenAcma = {
  zaman: TAM.zaman,
  yeni_son_tarih: TAM.yeni_son_tarih,
  onceki_puan: TAM.onceki_puan,
};

describe('oncekiPuanMetni', () => {
  it('puanı Türkçe ayraçla yazıyor', () => {
    expect(oncekiPuanMetni({ ...TAM, onceki_puan: 62.5 })).toBe('62,5 puan');
    expect(oncekiPuanMetni({ ...TAM, onceki_puan: 100 })).toBe('100 puan');
  });

  it('puan yoksa null — 0 UYDURMUYOR', () => {
    // Açık uçlu ödev yeniden açılmadan önce puanlanmamışsa böyle oluyor.
    // "0 puan" yazmak öğrenciyi yapmadığı bir şeyden kalmış gibi gösterirdi.
    expect(oncekiPuanMetni({ ...TAM, onceki_puan: null })).toBeNull();
    expect(oncekiPuanMetni(null)).toBeNull();
    expect(oncekiPuanMetni(undefined)).toBeNull();
  });

  it('gerçek 0 puanı yazıyor (null ile aynı şey değil)', () => {
    expect(oncekiPuanMetni({ ...TAM, onceki_puan: 0 })).toBe('0 puan');
  });
});

describe('oncekiGonderimMetni', () => {
  it('puan varsa birlikte, yoksa yalnız "önceki gönderim"', () => {
    expect(oncekiGonderimMetni(TAM)).toBe('önceki gönderim 75 puan');
    expect(oncekiGonderimMetni({ ...TAM, onceki_puan: null })).toBe(
      'önceki gönderim',
    );
  });
});

describe('yenidenAcmaSatiri', () => {
  it('öğretmen ve öğrenci: sebep cümlede', () => {
    expect(yenidenAcmaSatiri(TAM, { sebepGoster: true })).toBe(
      `${BASLIK} — önceki gönderim 75 puan · soruda düzeltme yapıldı · 31 Ekim 2026`,
    );
  });

  it('VELİ: sebep cümlede YOK', () => {
    const satir = yenidenAcmaSatiri(VELIYE, { sebepGoster: false });
    expect(satir).toBe(`${BASLIK} — önceki gönderim 75 puan · 31 Ekim 2026`);
    expect(satir).not.toContain('düzeltme');
  });

  it('sebep yanlışlıkla gelse bile veli biçiminde yazılmıyor', () => {
    // Bayrak ikinci kat: asıl kapı sunucuda (`veli_paneli` jsonb'den
    // `neden`i çıkarıyor). Kapılardan biri açılırsa öbürü tutuyor.
    const satir = yenidenAcmaSatiri(TAM, { sebepGoster: false });
    expect(satir).not.toContain('düzeltme');
    expect(satir).toBe(`${BASLIK} — önceki gönderim 75 puan · 31 Ekim 2026`);
  });

  it('sondaki nokta atılıyor, ilk harf küçültülüyor', () => {
    // Sebep cümlenin ORTASINDA duruyor. Öğretmenin onayladığı hedef cümle
    // böyle: "… · soruda düzeltme yapıldı · 31 Ekim 2026".
    expect(
      yenidenAcmaSatiri(
        { ...TAM, neden: 'Çözüm kağıdı sisteme siyah görüntü olarak ulaştı...' },
        { sebepGoster: true },
      ),
    ).toContain('· çözüm kağıdı sisteme siyah görüntü olarak ulaştı ·');
  });

  it('TÜRKÇE İ doğru küçülüyor', () => {
    // `toLowerCase()` "İ"yi "i̇" (i + birleşen nokta) yapıyor; 0041'de
    // `lower()` aynı harfi bozmuştu. `toLocaleLowerCase('tr')` şart.
    const satir = yenidenAcmaSatiri(
      { ...TAM, neden: 'İkinci sayfa eksik geldi.' },
      { sebepGoster: true },
    );
    expect(satir).toContain('· ikinci sayfa eksik geldi ·');
    expect(satir).not.toContain('i̇kinci');
  });

  it('kısaltmayla başlayan sebep bozulmuyor', () => {
    expect(
      yenidenAcmaSatiri(
        { ...TAM, neden: 'PDF bozuk geldi.' },
        { sebepGoster: true },
      ),
    ).toContain('· PDF bozuk geldi ·');
  });

  it('boş sebep parça eklemiyor', () => {
    expect(yenidenAcmaSatiri({ ...TAM, neden: '   ' }, { sebepGoster: true })).toBe(
      `${BASLIK} — önceki gönderim 75 puan · 31 Ekim 2026`,
    );
  });

  it('0090 çalışmamış sunucuda null — ekran bugünkü hâlinde kalıyor', () => {
    expect(yenidenAcmaSatiri(null, { sebepGoster: true })).toBeNull();
    expect(yenidenAcmaSatiri(undefined, { sebepGoster: false })).toBeNull();
  });

  it('zaman okunamazsa gün parçası düşüyor, cümle yine yazılıyor', () => {
    expect(
      yenidenAcmaSatiri({ ...TAM, zaman: 'bozuk-zaman' }, { sebepGoster: true }),
    ).toBe(`${BASLIK} — önceki gönderim 75 puan · soruda düzeltme yapıldı`);
  });
});

describe('yeniTarihMetni', () => {
  it('verilen kişisel tarihi yazıyor', () => {
    expect(yeniTarihMetni(TAM)).toBe('Yeni son tarih: 12 Kasım 2026');
  });

  it('0056 döneminde açılmış gönderimde tarih yok → null', () => {
    expect(yeniTarihMetni({ ...TAM, yeni_son_tarih: null })).toBeNull();
  });
});

describe('ogretmenDurumu', () => {
  it('yeniden açıldı ve göndermedi → bekliyor', () => {
    // Asıl kusur buydu: liste yalnız "göndermedi" yazıyordu ve öğretmen
    // veliye ödevin yapılmadığını söylüyordu.
    expect(ogretmenDurumu(false, TAM)).toBe('bekliyor');
  });

  it('yeniden açıldı ve yeniden gönderdi → gonderdi', () => {
    expect(ogretmenDurumu(true, TAM)).toBe('gonderdi');
  });

  it('hiç açılmamış → null, ekran bugünkü hâlinde', () => {
    expect(ogretmenDurumu(false, null)).toBeNull();
    expect(ogretmenDurumu(true, undefined)).toBeNull();
  });
});
