import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * jsdom `matchMedia` sağlamaz. Varsayılan olarak "hareket azaltma kapalı"
 * kabul ediyoruz; ilgili testler bunu kendi içinde değiştirir.
 */
export function matchMediaAyarla(eslesir: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (sorgu: string): MediaQueryList =>
      ({
        matches: eslesir,
        media: sorgu,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

matchMediaAyarla(false);

afterEach(() => {
  cleanup();
  matchMediaAyarla(false);
});
