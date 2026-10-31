import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CALISMA_ACIKLAMASI,
  TUR_ADLARI,
  TUR_IPUCU,
  calismaMi,
  calismaSatiri,
  gonderimDurumu,
  optikVarMi,
  puanlanirMi,
  turAdi,
  turAdiKucuk,
} from './odev-turu';
import { yasakKaliplariBul } from './urun-dili';

describe('ödev türleri', () => {
  it('üç tür de adlı', () => {
    expect(turAdi('test')).toBe('Test');
    expect(turAdi('acik')).toBe('Açık uçlu');
    expect(turAdi('calisma')).toBe('Çalışma kağıdı');
  });

  /**
   * BİLİNMEYEN TÜR EKRANI BOZMAMALI. 0086 çalışmamış bir sunucudan ya da
   * ileride eklenecek bir türden ham değer gelirse ekranda `calisma`
   * yazmaktansa "Ödev" yazsın.
   */
  it('bilinmeyen tür ham değeri ekrana yazmıyor', () => {
    expect(turAdi('bilinmeyen')).toBe('Ödev');
    expect(turAdi(null)).toBe('Ödev');
    expect(turAdi(undefined)).toBe('Ödev');
  });

  /** Türkçe küçük harf: "Açık uçlu" → "açık uçlu" (I/İ tuzağı). */
  it('küçük harf Türkçe kurallarıyla', () => {
    expect(turAdiKucuk('test')).toBe('test');
    expect(turAdiKucuk('acik')).toBe('açık uçlu');
    expect(turAdiKucuk('calisma')).toBe('çalışma kağıdı');
  });

  it('yalnız çalışma kağıdı puansız', () => {
    expect(puanlanirMi('test')).toBe(true);
    expect(puanlanirMi('acik')).toBe(true);
    expect(puanlanirMi('calisma')).toBe(false);
  });

  it('optik yalnız testte', () => {
    expect(optikVarMi('test')).toBe(true);
    expect(optikVarMi('acik')).toBe(false);
    expect(optikVarMi('calisma')).toBe(false);
  });

  it('calismaMi yalnız çalışma kağıdında', () => {
    expect(calismaMi('calisma')).toBe(true);
    expect(calismaMi('acik')).toBe(false);
    expect(calismaMi(null)).toBe(false);
  });

  it('durum iki kelimeyle', () => {
    expect(gonderimDurumu(true)).toBe('Gönderdi');
    expect(gonderimDurumu(false)).toBe('Göndermedi');
  });

  /**
   * HİÇ ÇALIŞMA KAĞIDI YOKSA SATIR ÇIKMIYOR. "0/0 gönderdi" yazmak,
   * öğretmene olmayan bir işi varmış gibi göstermek olurdu.
   */
  it('satır yalnız çalışma kağıdı varken', () => {
    expect(calismaSatiri(0, 0)).toBeNull();
    expect(calismaSatiri(null, null)).toBeNull();
    expect(calismaSatiri(0, 5)).toBe('Çalışma kağıdı: 0/5 gönderdi');
    expect(calismaSatiri(4, 5)).toBe('Çalışma kağıdı: 4/5 gönderdi');
    expect(calismaSatiri(null, 3)).toBe('Çalışma kağıdı: 0/3 gönderdi');
  });

  it('açıklamalar puansızlığı söylüyor', () => {
    expect(TUR_IPUCU).toMatch(/puanlanmaz/);
    expect(CALISMA_ACIKLAMASI).toMatch(/puanlanmaz/);
    expect(CALISMA_ACIKLAMASI).toMatch(/[Oo]rtalamalara girmez/);
  });

  it('metinlerde yasak kalıp ve suçlayıcı söz yok', () => {
    const hepsi = [
      ...Object.values(TUR_ADLARI),
      TUR_IPUCU,
      CALISMA_ACIKLAMASI,
      gonderimDurumu(false),
      calismaSatiri(2, 5) ?? '',
    ].join(' ');
    expect(yasakKaliplariBul(hepsi)).toEqual([]);
    expect(hepsi).not.toMatch(/başarısız|yetersiz|tembel|ihmal|ceza/i);
  });
});

/**
 * SÖZLEŞME: SUNUCUNUN TÜR DEĞERLERİYLE AYNI.
 *
 * Arayüzdeki üçlü ile veritabanının kabul ettiği üçlü ayrışırsa ekran
 * kaydedilemeyecek bir tür gönderir. İddia migration'ın GERÇEK metnini
 * okuyor (0084 ve 0085'teki desen).
 */
describe('türler sunucudakiyle birebir', () => {
  const sql = readFileSync(
    resolve(process.cwd(), '../supabase/migrations/0086_calisma_kagidi.sql'),
    'utf8',
  );

  it('tablo kısıtı üç türü sayıyor', () => {
    expect(sql).toContain("check (tur in ('test', 'acik', 'calisma'))");
    for (const t of Object.keys(TUR_ADLARI)) {
      expect(sql, `kısıtta eksik: ${t}`).toContain(`'${t}'`);
    }
  });

  it('çalışma kağıdında anahtar yasağı veritabanında', () => {
    expect(sql).toContain("tur = 'calisma' and soru_sayisi is null and cevap_anahtari is null");
  });

  it('gönderim durumu tamamlandi kabul ediliyor', () => {
    expect(sql).toContain("'tamamlandi'");
  });
});
