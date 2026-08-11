import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { oturumOku, oturumSil, oturumYaz, rpc, type Oturum } from '@/services/supabase';
import { OturumBaglami } from './oturum-baglam';

/**
 * Oturum durumu.
 *
 * Jeton `localStorage`'da tutulur — ama artık PIN değil, süresi dolan ve
 * iptal edilebilen bir jeton. Eski sistemde PIN'in kendisi düz metin olarak
 * saklanıyor ve her istekte gönderiliyordu.
 *
 * `sekiz:oturum-dustu` olayı `services/supabase.ts` tarafından, sunucu
 * oturumu reddettiğinde tetiklenir; burada dinleyip arayüzü giriş ekranına
 * döndürüyoruz. Böylece her çağrı noktasında ayrı ayrı kontrol gerekmiyor.
 */
export function OturumSaglayici({ children }: { children: ReactNode }) {
  const [oturum, setOturum] = useState<Oturum | null>(() => oturumOku());

  const girisYap = useCallback((o: Oturum) => {
    oturumYaz(o);
    setOturum(o);
  }, []);

  const cikisYap = useCallback(() => {
    const mevcut = oturumOku();
    // Sunucudaki jetonu da düşür; yalnız istemciden silmek yetmez.
    if (mevcut) void rpc('cikis', { p_token: mevcut.token }).catch(() => {});
    oturumSil();
    setOturum(null);
  }, []);

  useEffect(() => {
    const dinle = () => {
      oturumSil();
      setOturum(null);
    };
    window.addEventListener('sekiz:oturum-dustu', dinle);
    return () => window.removeEventListener('sekiz:oturum-dustu', dinle);
  }, []);

  const api = useMemo(() => ({ oturum, girisYap, cikisYap }), [oturum, girisYap, cikisYap]);

  return <OturumBaglami.Provider value={api}>{children}</OturumBaglami.Provider>;
}
