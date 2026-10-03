import { describe, expect, it } from 'vitest';
import { EN_BUYUK_BOYUT, ODEV_PDF_EN_BUYUK, dosyayiDenetle } from './dosya';

const MB = 1024 * 1024;

/** İçeriği önemsiz, yalnız boyutu ve türü olan sahte dosya. */
function dosya(boyutMb: number, tur = 'application/pdf'): File {
  const f = new File(['x'], 'deneme.pdf', { type: tur });
  Object.defineProperty(f, 'size', { value: Math.round(boyutMb * MB) });
  return f;
}

describe('dosya sınırları (0059)', () => {
  it('öğrenci sınırı 10 MB, öğretmen PDF sınırı 20 MB', () => {
    expect(EN_BUYUK_BOYUT).toBe(10 * MB);
    expect(ODEV_PDF_EN_BUYUK).toBe(20 * MB);
  });

  it('öğretmen: 18 MB soru kağıdı kabul', () => {
    expect(dosyayiDenetle(dosya(18), ODEV_PDF_EN_BUYUK)).toBeNull();
  });

  it('öğretmen: tam 20 MB kabul, 20 MB üstü ret ve metin 20 MB diyor', () => {
    expect(dosyayiDenetle(dosya(20), ODEV_PDF_EN_BUYUK)).toBeNull();
    expect(dosyayiDenetle(dosya(21.5), ODEV_PDF_EN_BUYUK)).toBe(
      'Dosya çok büyük (21.5 MB). En fazla 20 MB yükleyebilirsiniz.',
    );
  });

  it('öğrenci (varsayılan): 10 MB sınırı değişmedi', () => {
    expect(dosyayiDenetle(dosya(9.9, 'image/jpeg'))).toBeNull();
    expect(dosyayiDenetle(dosya(12, 'image/jpeg'))).toBe(
      'Dosya çok büyük (12.0 MB). En fazla 10 MB yükleyebilirsiniz.',
    );
  });

  it('tür denetimi aynen', () => {
    expect(dosyayiDenetle(dosya(1, 'application/zip'), ODEV_PDF_EN_BUYUK)).toBe(
      'Yalnız PDF ve görsel dosyaları yükleyebilirsiniz.',
    );
  });
});
