import { createContext, useContext } from 'react';

export type ToastTuru = 'bilgi' | 'basari' | 'hata';

export type ToastApi = {
  bildir: (metin: string, tur?: ToastTuru) => void;
};

/**
 * Bağlam ve hook, sağlayıcı bileşeninden ayrı dosyada duruyor: bir dosya hem
 * bileşen hem yardımcı dışa aktarınca Fast Refresh bozuluyor.
 */
export const ToastBaglami = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const b = useContext(ToastBaglami);
  if (!b) throw new Error('useToast, ToastSaglayici içinde kullanılmalı');
  return b;
}
