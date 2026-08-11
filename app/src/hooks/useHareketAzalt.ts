import { useEffect, useState } from 'react';

const SORGU = '(prefers-reduced-motion: reduce)';

/**
 * Kullanıcının işletim sistemi düzeyindeki "hareketi azalt" tercihi.
 * Tercih değişirse canlı olarak güncellenir — sayfa yenilemesi gerekmez.
 */
export function useHareketAzalt(): boolean {
  const [azalt, setAzalt] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(SORGU).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(SORGU);
    const dinle = (e: MediaQueryListEvent) => setAzalt(e.matches);
    mql.addEventListener('change', dinle);
    return () => mql.removeEventListener('change', dinle);
  }, []);

  return azalt;
}
