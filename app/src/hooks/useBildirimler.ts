import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useOturum } from '@/hooks/oturum-baglam';
import { rpc } from '@/services/supabase';

/**
 * Kabuktaki rozetlerin sayıları.
 *
 * NEDEN AYRI BİR UÇ: rozet her ekranda duruyor ve aralıklı yokleniyor.
 * `veliler_listesi` bütün aktif öğrencileri dolaşıp her biri için iki alt
 * sorgu çalıştırıyor — 300 öğrencide her yoklamada 600 alt sorgu demek.
 * `bildirim_sayilari` (0022) yalnız iki tam sayı döndürüyor.
 *
 * NE ZAMAN YOKLANIYOR:
 *  - açılışta
 *  - ROTA DEĞİŞİNCE — öğretmen yazışmayı okuyup çıktığında rozet hemen
 *    düşsün; yarım saat beklemek "okudum ama hâlâ 3 diyor" hissi verirdi
 *  - sekmeye geri dönüldüğünde
 *  - yarım saatte bir (uygulama gün boyu açık kalıyor)
 *
 * HATA SESSİZ: rozet gösterememek ekranı bozmamalı. Uç henüz
 * çalıştırılmadıysa (`PGRST202`) ya da ağ yoksa sayılar sıfır kalır ve
 * hiçbir rozet çizilmez — arayüz eskisi gibi çalışmaya devam eder.
 */

const ARALIK_MS = 30 * 60 * 1000;

export type BildirimSayilari = {
  okunmamis_mesaj: number;
  puan_bekleyen: number;
};

const BOS: BildirimSayilari = { okunmamis_mesaj: 0, puan_bekleyen: 0 };

export function useBildirimler(): BildirimSayilari {
  const { oturum } = useOturum();
  const konum = useLocation();
  const [sayilar, setSayilar] = useState<BildirimSayilari>(BOS);
  const token = oturum?.token;

  const bak = useCallback(async () => {
    if (!token) return;
    try {
      const v = await rpc<BildirimSayilari>(
        'bildirim_sayilari',
        { p_token: token },
        // Oturum düşmesin: rozet yan bir bilgi, kimlik akışını
        // yönetmemeli. Asıl ekranın çağrısı zaten oturumu denetliyor.
        { oturumDusurmesin: true },
      );
      setSayilar({
        okunmamis_mesaj: Number(v?.okunmamis_mesaj ?? 0),
        puan_bekleyen: Number(v?.puan_bekleyen ?? 0),
      });
    } catch {
      // Sessiz: 0022 henüz çalıştırılmamışsa da ekran çalışmaya devam etsin.
    }
  }, [token]);

  useEffect(() => {
    void bak();
  }, [bak, konum.pathname]);

  useEffect(() => {
    const zamanlayici = window.setInterval(() => void bak(), ARALIK_MS);
    const gorunurluk = () => {
      if (document.visibilityState === 'visible') void bak();
    };
    document.addEventListener('visibilitychange', gorunurluk);
    return () => {
      window.clearInterval(zamanlayici);
      document.removeEventListener('visibilitychange', gorunurluk);
    };
  }, [bak]);

  return sayilar;
}
