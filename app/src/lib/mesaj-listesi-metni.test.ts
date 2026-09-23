import { describe, expect, it } from 'vitest';
import {
  ARAMA_BOS,
  ARAMA_YER_TUTUCU,
  KANAL_ETIKETI,
  KANAL_NOTU,
  bosDurum,
  zamanYazisi,
} from './mesaj-listesi-metni';
import { yasakKaliplariBul } from './urun-dili';

describe('mesaj listesi metni', () => {
  /** Ürün dili nöbetçisi bu ekranda da geçerli. */
  it('metinlerde yasak kalıp yok', () => {
    const hepsi = [
      ...Object.values(KANAL_ETIKETI),
      ...Object.values(KANAL_NOTU),
      ARAMA_YER_TUTUCU,
      ARAMA_BOS,
      bosDurum('ogrenci').baslik,
      bosDurum('ogrenci').aciklama,
      bosDurum('veli').baslik,
      bosDurum('veli').aciklama,
    ].join(' ');
    expect(yasakKaliplariBul(hepsi)).toEqual([]);
  });

  /**
   * İKİ KANALA AYNI CÜMLE YAZILMIYOR. "Henüz yazışma yok" ikisinde de
   * doğru olurdu ama hiçbirinde yardımcı olmazdı; ölçüm ikisinin
   * FARKLI olduğunu arıyor.
   */
  it('boş durum cümlesi kanala göre ayrı', () => {
    const o = bosDurum('ogrenci');
    const v = bosDurum('veli');
    expect(o.baslik).not.toBe(v.baslik);
    expect(o.aciklama).not.toBe(v.aciklama);
    expect(o.baslik).toContain('öğrenci');
    expect(v.baslik).toContain('veli');
  });

  /**
   * KANAL NOTU — 0048'de Veliler ekranından taşınan cümle.
   *
   * Eski hâli "veli kendi ÇOCUĞUNUN panelinde görür" diyordu ve bu, iki
   * kanalın ayrı olduğu güvencesinin tersini ima ediyordu. Düzeltilen
   * cümleyi kilitleyen ölçüm `kabuk-denetimi.mjs`'te; burada metnin
   * kendisi, React'siz, iki yönlü kilitleniyor.
   */
  it('kanal notu doğru cümleyi taşıyor, yanlışını değil', () => {
    expect(KANAL_NOTU.veli).toContain('veli kendi koduyla girer, kendi panelinde okur');
    expect(KANAL_NOTU.ogrenci).toContain('öğrenci kendi koduyla girer, kendi panelinde okur');
    for (const n of Object.values(KANAL_NOTU)) {
      expect(n).not.toContain('çocuğunun panelinde');
    }
  });

  /** İki kanalın notu AYNI olamaz: her biri karşı tarafı adıyla anıyor. */
  it('kanal notu kanala göre ayrı ve karşı tarafı adıyla anıyor', () => {
    expect(KANAL_NOTU.ogrenci).not.toBe(KANAL_NOTU.veli);
    expect(KANAL_NOTU.ogrenci).toContain('Veli bu yazışmayı görmez');
    expect(KANAL_NOTU.veli).toContain('Öğrenci bu yazışmayı görmez');
  });

  /** Boş durum ne yapılacağını söylüyor, yalnız durumu bildirmiyor. */
  it('boş durum bir sonraki adımı söylüyor', () => {
    for (const k of ['ogrenci', 'veli'] as const) {
      expect(bosDurum(k).aciklama).toContain('ara');
    }
  });
});

describe('zamanYazisi', () => {
  // Sabit bir "şimdi": 15 Ekim 2026, Perşembe, 20:00.
  const simdi = new Date(2026, 9, 15, 20, 0, 0);

  /**
   * BUGÜN: yalnız saat. Gün zaten belli; "15 Ekim 14:20" yazmak satırı
   * uzatır ve hiçbir şey eklemez.
   */
  it('bugünkü mesajda yalnız saat', () => {
    expect(zamanYazisi(new Date(2026, 9, 15, 14, 20).toISOString(), simdi)).toBe('14:20');
    expect(zamanYazisi(new Date(2026, 9, 15, 9, 5).toISOString(), simdi)).toBe('09:05');
  });

  it('dünkü mesajda "dün" ve saat', () => {
    expect(zamanYazisi(new Date(2026, 9, 14, 19, 5).toISOString(), simdi)).toBe('dün 19:05');
  });

  /**
   * GÜN FARKI TAKVİM GÜNÜYLE. Dün 23:00'teki mesaj, şimdi 20:00 ise
   * 21 saat önce — 24 saatlik bir hesap onu "bugün" sayardı.
   */
  it('takvim günü kullanılıyor, 24 saat değil', () => {
    expect(zamanYazisi(new Date(2026, 9, 14, 23, 30).toISOString(), simdi)).toBe('dün 23:30');
    // Bu sabah 00:30 — 19,5 saat önce ama BUGÜN.
    expect(zamanYazisi(new Date(2026, 9, 15, 0, 30).toISOString(), simdi)).toBe('00:30');
  });

  it('daha eski mesajda gün ve ay, saat yok', () => {
    expect(zamanYazisi(new Date(2026, 9, 2, 11, 0).toISOString(), simdi)).toBe('2 Ekim');
    expect(zamanYazisi(new Date(2026, 0, 31, 8, 0).toISOString(), simdi)).toBe('31 Ocak');
  });

  /**
   * GEÇEN YILIN MESAJINDA YIL DA VAR. "2 Ekim" tek başına, geçen yılın
   * yazışmasını bu yılınki sanmaya yol açardı.
   */
  it('başka yıldaki mesajda yıl da yazıyor', () => {
    expect(zamanYazisi(new Date(2025, 9, 2, 11, 0).toISOString(), simdi)).toBe('2 Ekim 2025');
  });

  /** Sunucudan boş ya da bozuk değer gelirse satır kırılmıyor. */
  it('boş ve bozuk değerde boş dize dönüyor', () => {
    expect(zamanYazisi(null, simdi)).toBe('');
    expect(zamanYazisi(undefined, simdi)).toBe('');
    expect(zamanYazisi('bu bir tarih değil', simdi)).toBe('');
  });

  /**
   * SÜREKLİ DEĞİŞEN İFADE YOK. "az önce", "3 dakika önce" gibi
   * ifadeler ekran yenilenmeden eskiyip yalan söylemeye başlar.
   */
  it('"önce" ile biten göreli ifade üretilmiyor', () => {
    const ornekler = [
      new Date(2026, 9, 15, 19, 59),
      new Date(2026, 9, 15, 14, 20),
      new Date(2026, 9, 14, 19, 5),
      new Date(2026, 9, 2, 11, 0),
    ];
    for (const d of ornekler) {
      expect(zamanYazisi(d.toISOString(), simdi)).not.toContain('önce');
    }
  });
});
