import { createContext, useContext } from 'react';
import type { Oturum } from '@/services/supabase';

export type OturumApi = {
  oturum: Oturum | null;
  girisYap: (o: Oturum) => void;
  cikisYap: () => void;
};

/**
 * Bağlam ve hook, sağlayıcı bileşeninden ayrı dosyada: bir dosya hem bileşen
 * hem yardımcı dışa aktarınca Fast Refresh bozuluyor.
 */
export const OturumBaglami = createContext<OturumApi | null>(null);

export function useOturum(): OturumApi {
  const b = useContext(OturumBaglami);
  if (!b) throw new Error('useOturum, OturumSaglayici içinde kullanılmalı');
  return b;
}
