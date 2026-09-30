import { describe, expect, it } from 'vitest';
import { veliAdi, veliSatiri, veliYazismasiEtiketi } from './veli-adi';

describe('veliAdi', () => {
  it('adı kırparak döndürür', () => {
    expect(veliAdi('  Ayşe Yıldırım ')).toBe('Ayşe Yıldırım');
  });
  it('boş, null ya da gelmemiş ad → null', () => {
    expect(veliAdi('')).toBeNull();
    expect(veliAdi('   ')).toBeNull();
    expect(veliAdi(null)).toBeNull();
    expect(veliAdi(undefined)).toBeNull();
  });
});

describe('veliSatiri', () => {
  it('ad varsa "Veli: …"', () => {
    expect(veliSatiri('Ayşe Yıldırım')).toBe('Veli: Ayşe Yıldırım');
  });
  it('ad yoksa satır yok (uydurulmuyor)', () => {
    expect(veliSatiri(null)).toBeNull();
    expect(veliSatiri(undefined)).toBeNull();
  });
});

describe('veliYazismasiEtiketi', () => {
  it('ad varsa adıyla', () => {
    expect(veliYazismasiEtiketi('Ayşe Yıldırım')).toBe('velisi Ayşe Yıldırım ile yazışma');
  });
  it('ad yoksa bugünkü metin', () => {
    expect(veliYazismasiEtiketi(null)).toBe('velisiyle yazışma');
  });
});
