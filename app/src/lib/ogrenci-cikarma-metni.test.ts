import { describe, expect, it } from 'vitest';
import {
  ACIKLAMA,
  BASLIK,
  BOS_ACIKLAMA,
  BOS_BASLIK,
  CIKAR_DUGMESI,
  GERI_ALMA_YOK,
  KART_ACIKLAMASI,
  KART_BASLIGI,
  KART_DUGMESI,
  ONAY_BASLIGI,
  ONAY_DUGMESI,
  basariMetni,
  onayAciklamasi,
} from './ogrenci-cikarma-metni';
import { yasakKaliplariBul } from './urun-dili';

describe('ogrenci-cikarma-metni', () => {
  /** Ürün dili nöbetçisi bu ekranda da geçerli. */
  it('metinlerde yasak kalıp yok', () => {
    const hepsi = [
      BASLIK,
      ACIKLAMA,
      GERI_ALMA_YOK,
      BOS_BASLIK,
      BOS_ACIKLAMA,
      CIKAR_DUGMESI,
      ONAY_BASLIGI,
      ONAY_DUGMESI,
      KART_BASLIGI,
      KART_ACIKLAMASI,
      KART_DUGMESI,
      onayAciklamasi('Bir Öğrenci'),
      basariMetni('Bir Öğrenci'),
    ].join(' ');
    expect(yasakKaliplariBul(hepsi)).toEqual([]);
  });

  /**
   * VERİNİN SİLİNMEDİĞİ SÖYLENİYOR — İKİ YERDE.
   *
   * Sunucu gerçekten silmiyor (`ogrenci_pasiflestir` yalnız
   * `aktif = false` yapıyor). Ekran bunu söylemezse öğretmen, geri
   * alınamaz bir veri kaybı yaptığını sanarak korkar; söyler de yapmazsa
   * yalan söylemiş oluruz. İkisi de ölçülüyor.
   */
  it('verinin silinmediği hem girişte hem onayda yazıyor', () => {
    expect(ACIKLAMA).toMatch(/silinmez/);
    expect(onayAciklamasi('Ada')).toMatch(/silinmez/);
  });

  /** Kodların iptal edildiği de söyleniyor — asıl kaybolan şey erişim. */
  it('kodların iptal edildiği yazıyor', () => {
    expect(ACIKLAMA).toMatch(/kodları iptal/);
    expect(onayAciklamasi('Ada')).toMatch(/kodları iptal/);
  });

  /**
   * GERİ ALMA YOKSA YOK DENİYOR.
   *
   * Öğretmene bunu ayrıca söyledim; ürünün de söylemesi gerekiyor.
   * Uygulamada öğrenciyi yeniden aktif edecek bir uç YOK — cümle
   * ölçülmüş bir gerçeği aktarıyor, temkinli bir tahmini değil.
   */
  it('geri alınamadığı açıkça yazıyor', () => {
    expect(GERI_ALMA_YOK).toMatch(/geri alma yolu yoktur/);
    expect(onayAciklamasi('Ada')).toMatch(/geri alınamaz/);
  });

  /** Yeniden eklemenin eski geçmişi geri getirmediği de yazıyor. */
  it('yeniden eklemenin yeni kayıt açtığı yazıyor', () => {
    expect(GERI_ALMA_YOK).toMatch(/yeni bir kayıt/);
    expect(GERI_ALMA_YOK).toMatch(/bağlanmaz/);
  });

  /**
   * ONAY KİMİ ÇIKARDIĞINI ADIYLA SÖYLÜYOR.
   *
   * Uzun listede yanlış satıra basmak kolay; adsız bir onay penceresi
   * güvence değil formalitedir.
   */
  it('onay metni adı taşıyor', () => {
    expect(onayAciklamasi('Zeynep K.')).toContain('Zeynep K.');
    expect(basariMetni('Zeynep K.')).toContain('Zeynep K.');
  });

  /**
   * ONAY DÜĞMESİ NE OLACAĞINI SÖYLÜYOR.
   *
   * "Tamam" ya da "Evet" tek başına neyin onaylandığını söylemez.
   */
  it('onay düğmesi eylemi söylüyor', () => {
    expect(ONAY_DUGMESI).toMatch(/çıkar/i);
  });
});
