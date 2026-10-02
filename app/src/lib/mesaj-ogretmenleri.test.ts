import { describe, expect, it } from 'vitest';
import type { Mesaj } from '@/types/api';
import {
  okunmamisSayisi,
  ogretmeninMesajlari,
  varsayilanOgretmen,
  yazismaOgretmenleri,
} from './mesaj-ogretmenleri';

const BARIS = { id: 'b', ad: 'Barış Atmaca' };
const BUKET = { id: 's', ad: 'Buket Topuzoğlu' };

const m = (kimden: Mesaj['kimden'], ogretmen_id: string | null, zaman: string, ogretmen?: string): Mesaj => ({
  kimden,
  metin: `${kimden}-${ogretmen_id}-${zaman}`,
  zaman,
  ogretmen_id,
  ...(ogretmen ? { ogretmen } : {}),
});

describe('yazismaOgretmenleri', () => {
  it('liste gelmediyse (0058 öncesi) boş: ekran tek yazışma gösterir', () => {
    expect(yazismaOgretmenleri(undefined, [])).toEqual([]);
  });
  it('sunucunun sırası korunur, hepsi yazılabilir', () => {
    expect(yazismaOgretmenleri([BARIS, BUKET], [])).toEqual([
      { ...BARIS, yazilabilir: true },
      { ...BUKET, yazilabilir: true },
    ]);
  });
  it('yalnız eski mesajda geçen öğretmen sona, yazılamaz olarak eklenir', () => {
    const r = yazismaOgretmenleri([BARIS], [m('ogretmen', 'eski', '2026-09-01T10:00:00Z', 'Eski Hoca')]);
    expect(r).toEqual([
      { ...BARIS, yazilabilir: true },
      { id: 'eski', ad: 'Eski Hoca', yazilabilir: false },
    ]);
  });
});

describe('ogretmeninMesajlari', () => {
  const liste = [
    m('veli', 'b', '2026-09-01T10:00:00Z'),
    m('ogretmen', 's', '2026-09-02T10:00:00Z'),
    m('ogretmen', null, '2026-08-01T10:00:00Z'),
  ];
  it('yalnız o öğretmenin mesajları', () => {
    expect(ogretmeninMesajlari(liste, 's', 'b').map((x) => x.ogretmen_id)).toEqual(['s']);
  });
  it('öğretmensiz eski mesaj ilk öğretmenin yazışmasında kalır, kaybolmaz', () => {
    expect(ogretmeninMesajlari(liste, 'b', 'b')).toHaveLength(2);
  });
});

describe('okunmamisSayisi', () => {
  const liste = [
    m('ogretmen', 'b', '2026-09-01T10:00:00Z'),
    m('ogretmen', 'b', '2026-09-03T10:00:00Z'),
    m('veli', 'b', '2026-09-04T10:00:00Z'),
  ];
  it('son görülmeden sonraki öğretmen mesajları', () => {
    expect(okunmamisSayisi(liste, '2026-09-02T00:00:00Z')).toBe(1);
  });
  it('hiç görülmediyse öğretmenin bütün mesajları', () => {
    expect(okunmamisSayisi(liste, null)).toBe(2);
  });
});

describe('varsayilanOgretmen', () => {
  const ogretmenler = yazismaOgretmenleri([BARIS, BUKET], []);
  it('hiç mesaj yoksa listenin ilki (sınıf öğretmeni)', () => {
    expect(varsayilanOgretmen(ogretmenler, [])).toBe('b');
  });
  it('en son mesajlaşılan öğretmen', () => {
    expect(
      varsayilanOgretmen(ogretmenler, [m('veli', 'b', '2026-09-01T10:00:00Z'), m('ogretmen', 's', '2026-09-02T10:00:00Z')]),
    ).toBe('s');
  });
  it('en son mesaj artık yazılamayan öğretmendeyse yazılabilir olana döner', () => {
    const r = yazismaOgretmenleri([BARIS], [m('ogretmen', 'eski', '2026-09-05T10:00:00Z', 'Eski')]);
    expect(varsayilanOgretmen(r, [m('ogretmen', 'eski', '2026-09-05T10:00:00Z')])).toBe('b');
  });
});
