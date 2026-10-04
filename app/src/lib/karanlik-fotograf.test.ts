import { describe, expect, it } from 'vitest';
import { karanlikMi } from './karanlik-fotograf';

/** n piksellik RGBA; her pikselin parlaklığı `deger(i)`. */
function gorsel(n: number, deger: (i: number) => number) {
  const d = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const v = deger(i);
    d.set([v, v, v, 255], i * 4);
  }
  return d;
}

describe('karanlık fotoğraf', () => {
  it('gerçek olaydaki gibi: 0–13 arası gürültü → karanlık', () => {
    expect(karanlikMi(gorsel(40000, (i) => (i * 7) % 14))).toBe(true);
  });

  it('beyaz kâğıt üzerinde koyu yazı → karanlık DEĞİL', () => {
    expect(karanlikMi(gorsel(40000, (i) => (i % 10 === 0 ? 30 : 210)))).toBe(false);
  });

  it('loş odada çekilmiş kâğıt (kâğıt ~90) → karanlık DEĞİL', () => {
    expect(karanlikMi(gorsel(40000, (i) => (i % 5 === 0 ? 20 : 90)))).toBe(false);
  });

  it('çoğu karanlık ama kâğıdın bir köşesi görünüyor (%5) → karanlık DEĞİL', () => {
    expect(karanlikMi(gorsel(40000, (i) => (i % 20 === 0 ? 180 : 5)))).toBe(false);
  });

  it('boş veri → karanlık sayılmaz', () => {
    expect(karanlikMi(new Uint8ClampedArray(0))).toBe(false);
  });
});
