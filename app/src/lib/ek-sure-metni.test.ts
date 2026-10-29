import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACIKLAMA,
  BASLIK,
  OGRENCI_EKSIK,
  SEBEP_EKSIK,
  SEBEP_UYARISI,
  TARIH_EKSIK,
  TARIH_ETIKETI,
  TARIH_GECMIS,
  ekSureMesaji,
  kimlereMetni,
  secimSayaci,
  sonucMetni,
} from './ek-sure-metni';
import { yasakKaliplariBul } from './urun-dili';

describe('ek süre verme metni', () => {
  it('başlık ve açıklama dolu', () => {
    expect(BASLIK.length).toBeGreaterThan(5);
    expect(ACIKLAMA).toMatch(/süresi dolmuş olsa bile/);
  });

  /**
   * ÖĞRETMEN SEBEBİN ÖĞRENCİYE GİDECEĞİNİ BİLMELİ (0081'deki gerekçe).
   */
  it('sebebin öğrenciye gideceği yazılı', () => {
    expect(SEBEP_UYARISI).toMatch(/öğrenciye mesaj olarak gönderilir/);
  });

  it('alan etiketleri ve hataları dolu', () => {
    expect(TARIH_ETIKETI.length).toBeGreaterThan(3);
    expect(TARIH_EKSIK).toMatch(/seçin/);
    expect(TARIH_GECMIS).toMatch(/bugünden önce olamaz/);
    expect(SEBEP_EKSIK).toMatch(/sebebini yazın/);
    expect(OGRENCI_EKSIK).toMatch(/[Ee]n az bir öğrenci/);
  });

  it('sayaç yalnız seçim varken çıkıyor', () => {
    expect(secimSayaci(0)).toBeNull();
    expect(secimSayaci(1)).toBe('1 öğrenci seçildi');
    expect(secimSayaci(3)).toBe('3 öğrenci seçildi');
  });

  /**
   * ADLAR TEK TEK YAZILIYOR.
   *
   * "3 öğrenciye" demek, yanlış öğrenci işaretlendiğinde öğretmenin
   * bunu fark etmesini imkânsız kılardı.
   */
  it('kimlere verildiği adlarla yazılı', () => {
    expect(kimlereMetni(['Duru', 'Ali'])).toBe('Duru, Ali');
    expect(kimlereMetni([])).toBe('');
  });

  it('mesaj ödev adını, tarihi ve sebebi taşıyor', () => {
    const m = ekSureMesaji('Köklü Sayılar', 'Rahatsızdın.', '2026-11-05');
    expect(m).toContain('Köklü Sayılar');
    expect(m).toContain('05.11.2026');
    expect(m).toContain('Rahatsızdın.');
    expect(m).toMatch(/bu tarihe kadar gönderebilirsin/);
  });

  it('adsız ödevde cümle yarım kalmıyor', () => {
    for (const ad of [null, '', '   ']) {
      expect(ekSureMesaji(ad, 'Sebep.', '2026-11-05')).toMatch(/^Ödev ödevi için/);
    }
  });

  it('sonuç cümlesi tek öğrencide adı, çoklukta sayıyı söylüyor', () => {
    expect(sonucMetni(['Duru'], '2026-11-05')).toMatch(/^Duru 5 Kasım 2026/);
    expect(sonucMetni(['Duru', 'Ali'], '2026-11-05')).toMatch(/^2 öğrenci/);
  });

  /**
   * SÖZLEŞME: ÖNİZLEME İLE SUNUCUNUN YAZDIĞI AYNI CÜMLE.
   *
   * Mesajı sunucu yazıyor; buradaki kopya yalnız önizleme. Ayrışırlarsa
   * öğretmenin gördüğü ile öğrencinin aldığı farklı olurdu. Bu iddia
   * migration'ın GERÇEK metnini okuyor (0081'deki desen).
   */
  it('sunucudaki cümleyle birebir', () => {
    const sql = readFileSync(
      resolve(process.cwd(), '../supabase/migrations/0084_gondermeyene_ek_sure.sql'),
      'utf8',
    );
    for (const parca of [
      "' ödevi için sana '",
      "' tarihine kadar ek süre verildi. '",
      "'Öğretmeninin notu: '",
      "'Çözümünü bu tarihe kadar gönderebilirsin.'",
      "to_char(p_son_tarih, 'DD.MM.YYYY')",
    ]) {
      expect(sql, `migration'da eksik: ${parca}`).toContain(parca);
    }
  });

  it('metinlerde yasak kalıp ve suçlayıcı söz yok', () => {
    const hepsi = [
      BASLIK,
      ACIKLAMA,
      SEBEP_UYARISI,
      TARIH_ETIKETI,
      TARIH_EKSIK,
      TARIH_GECMIS,
      SEBEP_EKSIK,
      OGRENCI_EKSIK,
      ekSureMesaji('Köklü Sayılar', 'Sebep.', '2026-11-05'),
      sonucMetni(['Duru'], '2026-11-05'),
    ].join(' ');
    expect(yasakKaliplariBul(hepsi)).toEqual([]);
    expect(hepsi).not.toMatch(/başarısız|yetersiz|tembel|ihmal|ceza/i);
  });
});
