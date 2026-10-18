import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SEBEP_UYARISI,
  TARIH_EKSIK,
  TARIH_ETIKETI,
  TARIH_GECMIS,
  ekSureAcik,
  ekSureEtiketi,
  gunMetni,
  iptalMesaji,
  noktali,
  ogrenciEkSure,
} from './iptal-metni';
import { yasakKaliplariBul } from './urun-dili';

describe('gönderim iptali metni', () => {
  it('tarih okunaklı yazılıyor, okunamayanda null', () => {
    expect(gunMetni('2026-10-25')).toBe('25 Ekim 2026');
    expect(gunMetni(null)).toBeNull();
    expect(gunMetni('')).toBeNull();
    // "Invalid Date" yazmaktansa hiç yazmamak doğru.
    expect(gunMetni('abc')).toBeNull();
  });

  it('ek süre etiketleri yalnız tarih varken çıkıyor', () => {
    expect(ekSureEtiketi('2026-10-25')).toBe('ek süre verildi · 25 Ekim 2026');
    expect(ekSureEtiketi(null)).toBeNull();
    expect(ogrenciEkSure('2026-10-25')).toBe('Sana verilen süre: 25 Ekim 2026');
    expect(ogrenciEkSure(undefined)).toBeNull();
  });

  /**
   * EKRANIN KAPISI SUNUCUNUNKİYLE AYNI GÜNDE KAPANMALI.
   *
   * Sunucu `bugün <= son_tarih` diyor; ekran bir gün erken kapatırsa
   * öğrenci son günü gönderemediğini sanır, bir gün geç kapatırsa
   * yükleyip reddedilir.
   */
  it('kişisel süre son gün hâlâ açık, ertesi gün kapalı', () => {
    expect(ekSureAcik('2026-10-25', '2026-10-20')).toBe(true);
    expect(ekSureAcik('2026-10-25', '2026-10-25')).toBe(true); // son gün
    expect(ekSureAcik('2026-10-25', '2026-10-26')).toBe(false);
    // Ek süre verilmemiş: bugünkü davranış, kapı sınıfın tarihinde.
    expect(ekSureAcik(null, '2026-10-20')).toBe(false);
    expect(ekSureAcik(undefined, '2026-10-20')).toBe(false);
    expect(ekSureAcik('abc', '2026-10-20')).toBe(false);
  });

  /**
   * ÖĞRETMEN SEBEBİN ÖĞRENCİYE GİDECEĞİNİ BİLMELİ.
   *
   * 0056'da iptal sessizdi. Artık sebep mesaj olarak gidiyor; bu uyarı
   * olmasa öğretmen oraya kendine not yazar ve notu öğrenci okurdu.
   */
  it('sebebin öğrenciye gideceği yazılı', () => {
    expect(SEBEP_UYARISI).toMatch(/öğrenciye mesaj olarak gönderilir/);
  });

  it('tarih alanının etiketi ve hataları dolu', () => {
    expect(TARIH_ETIKETI.length).toBeGreaterThan(3);
    expect(TARIH_EKSIK).toMatch(/seçin/);
    expect(TARIH_GECMIS).toMatch(/bugünden önce olamaz/);
  });

  it('mesaj ödev adını, sebebi ve tarihi taşıyor', () => {
    const m = iptalMesaji('Köklü Sayılar', 'Boş sayfa gönderilmiş.', '2026-10-25');
    expect(m).toContain('Köklü Sayılar');
    expect(m).toContain('Boş sayfa gönderilmiş.');
    expect(m).toContain('25.10.2026');
    expect(m).toMatch(/yeniden gönderebilirsin/);
  });

  it('adsız ödevde cümle yarım kalmıyor', () => {
    for (const ad of [null, '', '   ']) {
      const m = iptalMesaji(ad, 'Sebep.', '2026-10-25');
      expect(m).toMatch(/^Ödev ödevinin/);
    }
  });

  it('noktalı tarih sunucunun biçimiyle aynı', () => {
    expect(noktali('2026-10-25')).toBe('25.10.2026');
    expect(noktali(null)).toBe('');
  });

  /**
   * SÖZLEŞME: ÖNİZLEME İLE SUNUCUNUN YAZDIĞI AYNI CÜMLE.
   *
   * Mesajı sunucu yazıyor; buradaki kopya yalnız önizleme. Ayrışırlarsa
   * öğretmenin gördüğü ile öğrencinin aldığı farklı olurdu. Bu iddia
   * migration'ın GERÇEK metnini okuyor.
   */
  it('sunucudaki cümleyle birebir', () => {
    const sql = readFileSync(
      resolve(process.cwd(), '../supabase/migrations/0081_gonderim_iptali.sql'),
      'utf8',
    );
    for (const parca of [
      "' ödevinin gönderimi iptal edildi. '",
      "'Öğretmeninin notu: '",
      "'Yeni son tarih: '",
      "'Çözümünü bu tarihe kadar yeniden gönderebilirsin.'",
      "to_char(p_son_tarih, 'DD.MM.YYYY')",
    ]) {
      expect(sql, `migration'da eksik: ${parca}`).toContain(parca);
    }
  });

  /** Ürün dili nöbetçisi: suçlama, övgü, etiket yok. */
  it('metinlerde yasak kalıp ve suçlayıcı söz yok', () => {
    const hepsi = [
      SEBEP_UYARISI,
      TARIH_ETIKETI,
      TARIH_EKSIK,
      TARIH_GECMIS,
      ekSureEtiketi('2026-10-25') ?? '',
      ogrenciEkSure('2026-10-25') ?? '',
      iptalMesaji('Köklü Sayılar', 'Sebep.', '2026-10-25'),
    ].join(' ');
    expect(yasakKaliplariBul(hepsi)).toEqual([]);
    expect(hepsi).not.toMatch(/başarısız|yetersiz|tembel|hile|ceza/i);
  });
});
