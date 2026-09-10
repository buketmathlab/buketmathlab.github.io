import { useCallback, useEffect, useState } from 'react';
import { useOturum } from '@/hooks/oturum-baglam';
import { rpc } from '@/services/supabase';
import type { BenKimim } from '@/types/api';

/**
 * Giriş yapan öğretmenin kimliği — ad, sahip mi, ve VEKÂLETTE Mİ.
 *
 * Dört öğretmenli bir sistemde "kim olarak girdim" sorusu ekranda
 * cevaplanabilir olmalı. Vekâlet için ise bu bir konfor değil zorunluluk:
 * sahip başka bir öğretmenin hesabında olduğunu unutursa yanlış sınıfa
 * ödev verir. Kabuktaki şerit bu veriyi okuyor.
 *
 * HATA SESSİZ (`useBildirimler` deseni): 0033 henüz panelde
 * çalıştırılmadıysa uç yoktur; o zaman kimlik `null` kalır, şerit hiç
 * çizilmez ve ekran bugünkü gibi çalışmaya devam eder (Part VIII).
 */
export function useBenKimim(): { ben: BenKimim | null; yenile: () => void } {
  const { oturum } = useOturum();
  const [ben, setBen] = useState<BenKimim | null>(null);
  const token = oturum?.token;

  const bak = useCallback(async () => {
    if (!token) {
      setBen(null);
      return;
    }
    try {
      const v = await rpc<BenKimim>('ben_kimim', { p_token: token }, { oturumDusurmesin: true });
      setBen(v ?? null);
    } catch {
      setBen(null);
    }
  }, [token]);

  useEffect(() => {
    void bak();
  }, [bak]);

  return { ben, yenile: () => void bak() };
}
