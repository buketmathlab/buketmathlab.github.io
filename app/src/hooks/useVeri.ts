import { useCallback, useEffect, useState } from 'react';
import { rpc } from '@/services/supabase';

export type Durum = 'yukleniyor' | 'hata' | 'bos' | 'hazir';

type Sonuc<T> = {
  veri: T | null;
  durum: Durum;
  hata: string | null;
  yenile: () => void;
};

/**
 * RPC'den veri çeker ve dört durumu (yükleniyor / hata / boş / hazır)
 * tek yerde yönetir.
 *
 * `bosMu` verilirse boş durum ayrı ele alınır; verilmezse veri geldiği anda
 * 'hazir' sayılır. Boşluk kararını çağıran tarafa bırakmak gerekiyor çünkü
 * "boş" her ekranda farklı şey demek: listede sıfır kayıt, panoda ise
 * sıfır sayı boş değil, geçerli bir durum.
 */
export function useVeri<T>(
  fn: string,
  args: Record<string, unknown>,
  bosMu?: (v: T) => boolean,
): Sonuc<T> {
  const [veri, setVeri] = useState<T | null>(null);
  const [durum, setDurum] = useState<Durum>('yukleniyor');
  const [hata, setHata] = useState<string | null>(null);
  const [sayac, setSayac] = useState(0);

  const yenile = useCallback(() => setSayac((s) => s + 1), []);
  const argAnahtari = JSON.stringify(args);

  useEffect(() => {
    let iptal = false;
    setDurum('yukleniyor');
    setHata(null);

    rpc<T>(fn, JSON.parse(argAnahtari) as Record<string, unknown>)
      .then((d) => {
        if (iptal) return;
        setVeri(d);
        setDurum(bosMu && bosMu(d) ? 'bos' : 'hazir');
      })
      .catch((e: unknown) => {
        if (iptal) return;
        // Oturum hatası ayrı ele alınır: sağlayıcı zaten giriş ekranına
        // döndürecek, burada hata ekranı göstermek yanıltıcı olurdu.
        if (e instanceof Error && e.name === 'OturumHatasi') return;
        setHata(e instanceof Error ? e.message : 'Veri alınamadı.');
        setDurum('hata');
      });

    return () => {
      iptal = true;
    };
    // bosMu her render'da yeni referans olabilir; kasıtlı olarak bağımlılık
    // listesinde değil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, argAnahtari, sayac]);

  return { veri, durum, hata, yenile };
}
