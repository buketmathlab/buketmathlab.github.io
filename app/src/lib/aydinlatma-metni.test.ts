import { describe, expect, it } from 'vitest';
import {
  AYDINLATMA_BOLUMLERI,
  AYDINLATMA_GIRIS,
  SAKLAMA_SURESI,
  VERI_SORUMLUSU,
} from './aydinlatma-metni';
import { ONAM_SURUMU } from './onam-metni';

const TUMU = [
  AYDINLATMA_GIRIS,
  ...AYDINLATMA_BOLUMLERI.flatMap((b) => [b.baslik, ...b.maddeler]),
].join('\n');

describe('KVKK aydınlatma metni', () => {
  it('müfettiş incelemesinin eksik bulduğu alanların hepsi var', () => {
    const basliklar = AYDINLATMA_BOLUMLERI.map((b) => b.baslik);
    for (const b of [
      'Veri sorumlusu',
      'Hangi veriler işleniyor',
      'Kimler görebiliyor',
      'Nerede saklanıyor',
      'Ne kadar süre saklanıyor',
      'Haklarınız (KVKK madde 11)',
      'Başvuru ve onamın geri alınması',
    ]) {
      expect(basliklar).toContain(b);
    }
    expect(VERI_SORUMLUSU).toMatch(/Müdürlüğü$/);
    expect(TUMU).toMatch(/okul numarası/);
    expect(TUMU).toMatch(/Okul müdürü salt izleme/);
    expect(TUMU).toMatch(/İsviçre/);
  });

  it('doğrulanamayan iddia yok', () => {
    expect(TUMU).not.toMatch(/KVKK('ya)? uyumlu|tam güvenli|şifreli saklan|hash/i);
    expect(TUMU).not.toMatch(/yapay zek/i);
  });

  it('saklama süresi belirlenmediyse uydurulmuyor', () => {
    if (SAKLAMA_SURESI === null) expect(TUMU).toMatch(/okul müdürlüğünce belirlenecek/);
  });

  it('onam metnine ve sürümüne dokunmuyor (mevcut onamlar geçerli)', () => {
    expect(ONAM_SURUMU).toBe('2026-09-7');
  });
});
