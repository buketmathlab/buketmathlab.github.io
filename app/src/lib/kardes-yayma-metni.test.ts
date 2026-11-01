import { describe, expect, it } from 'vitest';
import {
  SON_TARIH_KUTUSU,
  kardesTarihSatiri,
  raporTarihSatiri,
  sonTarihKutuAciklamasi,
  tasinacaklarMetni,
  tasinmayacaklarMetni,
} from '@/lib/kardes-yayma-metni';
import type { KardesDetay, YaymaRaporu } from '@/types/api';

const kardes = (son_tarih?: string | null): KardesDetay => ({
  id: 'k1',
  sinif: '10B',
  gonderim_sayisi: 3,
  anahtar_ayni: true,
  arsiv: false,
  ...(son_tarih === undefined ? {} : { son_tarih }),
});

const rapor = (eski?: string | null, yeni?: string | null): YaymaRaporu => ({
  sinif: '10B',
  odev_id: 'o1',
  yeniden_puanlanan: [],
  atlandi: null,
  ...(eski === undefined ? {} : { son_tarih_eski: eski }),
  ...(yeni === undefined ? {} : { son_tarih_yeni: yeni }),
});

describe('kardesTarihSatiri', () => {
  it('şubenin kendi tarihini Türkçe yazar', () => {
    expect(kardesTarihSatiri(kardes('2026-11-05'))).toBe('Son teslim: 5 Kasım 2026');
  });

  // 0088 ÇALIŞMAMIŞ SUNUCU: alan hiç gelmez. Boş bir "Son teslim:" yazmak,
  // tarihi okuyamadığımızı değil tarih OLMADIĞINI düşündürürdü.
  it('alan gelmezse ya da boşsa hiçbir şey yazmaz', () => {
    expect(kardesTarihSatiri(kardes())).toBeNull();
    expect(kardesTarihSatiri(kardes(null))).toBeNull();
    expect(kardesTarihSatiri(kardes('okunmaz'))).toBeNull();
  });
});

describe('raporTarihSatiri', () => {
  it('gerçekten değişen tarihi iki yönüyle söyler', () => {
    expect(raporTarihSatiri(rapor('2026-11-01', '2026-11-05')))
      .toBe('Son tarih 1 Kasım 2026 → 5 Kasım 2026 oldu.');
  });

  // Sunucu değişmediğinde İKİ alanı da null gönderiyor; "değişti" demek
  // öğretmeni yanıltırdı.
  it('değişmediyse (iki alan da null) susar', () => {
    expect(raporTarihSatiri(rapor(null, null))).toBeNull();
    expect(raporTarihSatiri(rapor())).toBeNull();
  });

  it('tek alan gelirse de susar — yarım cümle kurmuyor', () => {
    expect(raporTarihSatiri(rapor('2026-11-01', null))).toBeNull();
    expect(raporTarihSatiri(rapor(null, '2026-11-05'))).toBeNull();
  });
});

describe('kutu metinleri', () => {
  it('kutu açıkken hedef tarihi ve öğrencinin göreceğini söyler', () => {
    const m = sonTarihKutuAciklamasi(true, '2026-11-05');
    expect(m).toContain('5 Kasım 2026');
    expect(m).toContain('uzatıldığını');
  });

  it('tarih okunamazsa yine de anlamlı bir cümle kurar', () => {
    expect(sonTarihKutuAciklamasi(true, null)).toContain('buradaki tarih');
  });

  it('kutu kapalıyken her şubenin tarihini koruyacağını söyler', () => {
    expect(sonTarihKutuAciklamasi(false, '2026-11-05')).toContain('kendi son tarihini koruyacak');
  });

  // TAŞINAN/TAŞINMAYAN LİSTELERİ KUTUYLA TUTARLI OLMALI: son tarih aynı
  // anda iki listede birden görünemez, yoksa öğretmen hangisine
  // inanacağını bilemez.
  it('son tarih tek listede görünür', () => {
    expect(tasinacaklarMetni(true)).toContain('SON TARİH');
    expect(tasinmayacaklarMetni(true)).not.toContain('son tarih');
    expect(tasinacaklarMetni(false)).not.toContain('SON TARİH');
    expect(tasinmayacaklarMetni(false)).toContain('son tarih');
  });

  it('geç teslim ve yayında her iki durumda da taşınmayanlarda', () => {
    for (const acik of [true, false]) {
      expect(tasinmayacaklarMetni(acik)).toContain('geç teslim');
      expect(tasinmayacaklarMetni(acik)).toContain('yayında');
    }
  });

  it('kutu başlığı sabit', () => {
    expect(SON_TARIH_KUTUSU).toBe('Son tarihi de bu şubelere uygula');
  });
});
