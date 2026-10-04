import { describe, expect, it } from 'vitest';
import {
  BOS_METIN,
  DUYURU_SINIRI,
  SUBE_YOK,
  UZUN_METIN,
  aliciOzeti,
  duyuruMetni,
  duyuruZamani,
  formHatasi,
  gorenMetni,
  onaySorusu,
} from './duyuru-metni';

describe('duyuru metni', () => {
  it('sınır sunucuyla aynı: 1000', () => {
    expect(DUYURU_SINIRI).toBe(1000);
  });

  it('kenar boşlukları kırpılıyor, içerideki satır sonları kalıyor', () => {
    expect(duyuruMetni('  \n Yarın tatil.\nDers yok. \t')).toBe('Yarın tatil.\nDers yok.');
  });

  it('form hatası: boş, uzun, şubesiz; geçerli olunca null', () => {
    expect(formHatasi(' \n ', 1)).toBe(BOS_METIN);
    expect(formHatasi('a'.repeat(1001), 1)).toBe(UZUN_METIN);
    expect(formHatasi('a'.repeat(1000), 1)).toBeNull();
    expect(formHatasi('Duyuru', 0)).toBe(SUBE_YOK);
    expect(formHatasi('Duyuru', 2)).toBeNull();
  });

  it('alıcı özeti ve onay sorusu: kime gidiyor, yanıt yok', () => {
    const o = aliciOzeti([
      { ad: '9A', ogrenci_sayisi: 28 },
      { ad: '9B', ogrenci_sayisi: 28 },
    ]);
    expect(o).toBe('9A, 9B — 56 öğrenci');
    expect(onaySorusu(o)).toBe(
      '9A, 9B — 56 öğrenci. Öğrenciler bu duyuruya yanıt veremez. Gönderilsin mi?',
    );
  });

  it('gören metni', () => {
    expect(gorenMetni('9A', 23, 28)).toBe('9A: 23/28 öğrenci gördü');
  });

  it('zaman İstanbul saatiyle', () => {
    expect(duyuruZamani('2026-10-04T11:05:00Z')).toBe('4 Ekim 14:05');
  });
});
