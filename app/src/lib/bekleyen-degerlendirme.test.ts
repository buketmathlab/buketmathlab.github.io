import { describe, expect, it } from 'vitest';
import { bekleyenMetni, bekleyenSayisi } from './bekleyen-degerlendirme';

const BUGUN = '2026-09-30';

describe('bekleyenSayisi', () => {
  it('gönderilmiş ve süresi dolmamış ödevleri sayar', () => {
    expect(
      bekleyenSayisi(
        [
          { gonderildi: true, son_tarih: '2026-10-02' }, // bekliyor
          { gonderildi: true, son_tarih: '2026-09-30' }, // bugün son gün → bekliyor
          { gonderildi: true, son_tarih: '2026-09-29' }, // süresi doldu → değerlendirildi
          { gonderildi: false, son_tarih: '2026-10-02' }, // gönderilmedi
        ],
        BUGUN,
      ),
    ).toBe(2);
  });
  it('boş listede 0', () => {
    expect(bekleyenSayisi([], BUGUN)).toBe(0);
  });
});

describe('bekleyenMetni', () => {
  it('veli: Ödevler bölümünü gösterir', () => {
    expect(bekleyenMetni(1, 'veli')).toBe(
      '1 ödev gönderildi, teslim süresi henüz dolmadı. O ödevin eksik konularını Ödevler bölümünde görebilirsiniz; süre dolunca bu sayfaya da eklenecek.',
    );
    expect(bekleyenMetni(2, 'veli')).toMatch(/^2 ödev gönderildi.*Bu ödevlerin/);
  });
  it('öğrenci: "sen" diliyle', () => {
    expect(bekleyenMetni(1, 'ogrenci')).toMatch(/^Gönderdiğin 1 ödevin teslim süresi henüz dolmadı\. Eksik konularını o ödevin sonucunda/);
  });
});
