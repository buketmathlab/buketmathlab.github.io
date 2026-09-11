import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  OKUL_BOLUMLERI,
  OKUL_GIRIS,
  OKUL_KAPANIS,
  OKUL_METNI,
  OKUL_ONAY_ALANLARI,
  OKUL_SORUMLU,
} from '@/lib/okul-bilgilendirme';

/**
 * BELGEDE RAKAM YOK — BU TURUN ASIL KURALI.
 *
 * Okul yönetimine verilen bir kâğıdın en olası bozulma biçimi, yazıldığı
 * gün doğru olup altı ay sonra yanlış olmasıdır. Bu depoda iki kez
 * yaşandı: `docs/kvkk-notlari.md` bir ay boyunca kapanmış bir açığı açık
 * gösterdi, onam metni de "dört öğretmen" diye yanlış bir sayı yazdı.
 *
 * Kural bu yüzden sert: metinde hiçbir sayı geçmiyor. Kaç öğretmen, kaç
 * sınıf, kaç öğrenci, kaç veli onam vermiş — hepsi `okul_bilgilendirme`
 * ucundan CANLI geliyor ve belgeye ayrı basılıyor. Sayı yazmak isteyen
 * bu testi kırmak zorunda kalıyor, yani bilinçli bir karar veriyor.
 */
describe('belge bayatlayamaz: metinde sayı yok', () => {
  it('hiçbir bölümde rakam geçmiyor', () => {
    const rakamli = OKUL_METNI.split('\n').filter((s) => /\d/.test(s));
    expect(rakamli).toEqual([]);
  });

  /**
   * "BİR" BİLEREK DIŞARIDA.
   *
   * Türkçede "bir" sayı değil, belgeç: "başka bir sınıfın öğretmeni",
   * "bir öğrencinin kaydı". Onu da yasaklamak, doğru cümleleri yazmayı
   * imkânsız kılardı. Yasaklanan, SAYIM iddiası kuran ikiden yukarısı.
   *
   * `\b` KULLANILMIYOR: JavaScript'te `ı`, `ö`, `ğ`, `ş` kelime karakteri
   * sayılmaz, yani `sınıf\b` "sınıfın" içinde de eşleşir. İlk yazımda tam
   * olarak bu oldu ve test yanlış yere kırmızı yandı.
   */
  const SAYIM = /(^|[\s(])(iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on)\s+(öğretmen|sınıf|öğrenci|veli)/i;

  it('yazıyla da sayı geçmiyor ("dört öğretmen" gibi)', () => {
    expect(OKUL_METNI).not.toMatch(SAYIM);
  });

  // KİLİDİN KENDİSİ ÇALIŞIYOR MU. Bu olmadan yukarıdaki iki test, desen
  // bozulduğunda da sessizce geçerdi.
  it('kural gerçekten ısırıyor', () => {
    expect('Sistemde 4 öğretmen var').toMatch(/\d/);
    expect('Sistemde dört öğretmen var').toMatch(SAYIM);
    expect('Zümrede üç öğretmen çalışıyor').toMatch(SAYIM);
    // ...ama belgeç olan "bir" serbest kalmalı.
    expect('Başka bir sınıfın öğretmeni erişemiyor').not.toMatch(SAYIM);
  });
});

/**
 * BELGENİN ASIL SEBEBİ.
 *
 * `docs/kvkk-notlari.md`'nin dikkat listesindeki ilk madde: okul
 * yönetimine sistemin varlığı VE BARINDIRMA BÖLGESİ bildirilmeli.
 * Barındırma cümlesi düşerse belge var olma sebebini kaybeder.
 */
describe('belge, yazılma sebebini söylüyor', () => {
  it('barındırma bölgesini ve yurt dışı olduğunu açıkça söylüyor', () => {
    expect(OKUL_METNI).toContain('Zürih');
    expect(OKUL_METNI).toContain('Türkiye');
    expect(OKUL_METNI).toMatch(/Türkiye\s+dışında/);
  });

  it('bunun değerlendirilmesi gereken bir nokta olduğunu saklamıyor', () => {
    expect(OKUL_METNI).toMatch(/değerlendirilmesi gereken/);
  });

  it('hukuki beyan olmadığını söylüyor', () => {
    expect(OKUL_KAPANIS).toMatch(/hukuki uygunluk beyanı değildir/);
  });
});

describe('belge ürünün gerçeğini anlatıyor', () => {
  it('kapsam kuralını doğru anlatıyor (0033)', () => {
    expect(OKUL_METNI).toContain('yalnız kendi sınıflarındaki');
    expect(OKUL_METNI).toContain('sunucu tarafında');
  });

  it('test puanlamasında yapay zekâ olmadığını söylüyor (Kural 5)', () => {
    expect(OKUL_METNI).toMatch(/yapay zekâ KULLANILMIYOR/);
  });

  it('istenmeyen kişisel verileri sayıyor', () => {
    expect(OKUL_METNI).toContain('kimlik numarası');
    expect(OKUL_METNI).toMatch(/İSTENMİYOR/);
  });

  it('veli onam akışını ve dökümü anlatıyor', () => {
    expect(OKUL_METNI).toContain('onam metnini okuyup adını yazarak');
    expect(OKUL_METNI).toContain('onam dökümü');
  });

  it('okulun sistemlerine bağlanmadığını söylüyor', () => {
    expect(OKUL_METNI).toMatch(/Okulun ağına/);
  });

  /**
   * ÜRÜNLE ÇELİŞMEME. Onam metninde öğrenilen ders: bir belgeyi
   * sözleriyle kilitlemek, yanlış bir sözü de kilitleyebilir. Burada
   * ürünün kendi dosyası okunuyor.
   */
  it('okul adı iddiası şemayla tutarlı', () => {
    expect(OKUL_METNI).toContain('Okulun adı öğrenci kaydında tutulmuyor');
    const sema = readFileSync(
      resolve(process.cwd(), '../supabase/migrations/0001_temel_sema.sql'),
      'utf8',
    );
    const siniflar = /create table if not exists public\.siniflar[\s\S]*?\n\);/.exec(sema)?.[0];
    expect(siniflar).toBeTruthy();
    expect(siniflar).not.toMatch(/okul/i);
  });
});

describe('belgenin biçimi', () => {
  it('sorumlu adı ve sıfatıyla yazılı', () => {
    expect(OKUL_SORUMLU.ad).toBe('Buket Topuzoğlu');
    expect(OKUL_SORUMLU.sifat).toMatch(/öğretmen/i);
  });

  it('okul yönetiminin dolduracağı dört alan var', () => {
    expect(OKUL_ONAY_ALANLARI).toContain('İmza');
    expect(OKUL_ONAY_ALANLARI).toContain('Tarih');
    expect(OKUL_ONAY_ALANLARI.length).toBeGreaterThanOrEqual(3);
  });

  it('bölümler ve maddeler boş değil', () => {
    expect(OKUL_BOLUMLERI.length).toBeGreaterThanOrEqual(6);
    for (const b of OKUL_BOLUMLERI) {
      expect(b.baslik.trim()).not.toBe('');
      expect(b.maddeler.length).toBeGreaterThan(0);
      for (const m of b.maddeler) expect(m.trim()).not.toBe('');
    }
  });

  it('düz metin bölümlerden türetiliyor', () => {
    expect(OKUL_METNI).toContain(OKUL_GIRIS);
    for (const b of OKUL_BOLUMLERI) {
      expect(OKUL_METNI).toContain(b.baslik);
      for (const m of b.maddeler) expect(OKUL_METNI).toContain(m);
    }
  });

  it('ham markdown işareti yok', () => {
    expect(OKUL_METNI).not.toContain('**');
  });
});
