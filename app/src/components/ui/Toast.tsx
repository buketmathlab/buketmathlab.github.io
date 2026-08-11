import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { ToastBaglami, type ToastTuru } from './toast-baglam';

type Kayit = { id: number; metin: string; tur: ToastTuru };

const RENKLER: Record<ToastTuru, string> = {
  bilgi: 'bg-ink text-paper',
  basari: 'bg-success text-paper',
  hata: 'bg-danger text-paper',
};

export function ToastSaglayici({ children }: { children: ReactNode }) {
  const [kayitlar, setKayitlar] = useState<Kayit[]>([]);

  const bildir = useCallback((metin: string, tur: ToastTuru = 'bilgi') => {
    const id = Date.now() + Math.random();
    setKayitlar((k) => [...k, { id, metin, tur }]);
    window.setTimeout(() => {
      setKayitlar((k) => k.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  const api = useMemo(() => ({ bildir }), [bildir]);

  return (
    <ToastBaglami.Provider value={api}>
      {children}
      {/* Hatalar assertive, diğerleri polite duyurulur. */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sk-alt-guvenli"
        role="region"
        aria-label="Bildirimler"
      >
        {kayitlar.map((k) => (
          <div
            key={k.id}
            role={k.tur === 'hata' ? 'alert' : 'status'}
            aria-live={k.tur === 'hata' ? 'assertive' : 'polite'}
            className={cn(
              'pointer-events-auto max-w-[92vw] rounded-sk-md px-4 py-3 text-[14px] font-semibold shadow-sk-md',
              RENKLER[k.tur],
            )}
          >
            {k.metin}
          </div>
        ))}
      </div>
    </ToastBaglami.Provider>
  );
}
