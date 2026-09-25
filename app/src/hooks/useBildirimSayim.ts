import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useOturum } from '@/hooks/oturum-baglam';
import { rpc } from '@/services/supabase';

/**
 * Zilin üstündeki sayı (0054).
 *
 * NEDEN AYRI BİR UÇ (`bildirim_sayim`): zil her ekranda duruyor ve
 * aralıklı yokleniyor; Bildirimler ekranı açılmadan bildirim metinlerini
 * indirmenin sebebi yok. `useBildirimler`'in (0022) gerekçesinin aynısı.
 *
 * AMA SUNUCUDA AYNI SORGU: `bildirim_sayim` `_bildirimlerim`'i çağırıp
 * sayıyor — ikinci bir sayma sorgusu yazılmadı. 0030'un dersi: iki yol bir
 * gün ayrışır ve rozet "3" derken listede 2 satır çıkar. Eşitliği
 * `bildirim_testleri.sql` 14. grubu ölçüyor.
 *
 * NE ZAMAN YOKLANIYOR (`useBildirimler`'in deseni):
 *  - açılışta
 *  - ROTA DEĞİŞİNCE — Bildirimler ekranından çıkınca rozet hemen düşsün;
 *    yarım saat beklemek "gördüm ama hâlâ 3 diyor" hissi verirdi
 *  - sekmeye geri dönüldüğünde
 *  - yarım saatte bir (uygulama gün boyu açık kalıyor)
 *
 * HATA SESSİZ: zil rozeti gösterememek ekranı bozmamalı. 0054 panelde
 * henüz çalıştırılmadıysa (`PGRST202`) ya da ağ yoksa sayı 0 kalır,
 * rozet çizilmez ve zil eskisi gibi çalışır.
 */

const ARALIK_MS = 30 * 60 * 1000;

export function useBildirimSayim(): number {
  const { oturum } = useOturum();
  const konum = useLocation();
  const [yeni, setYeni] = useState(0);
  const token = oturum?.token;

  const bak = useCallback(async () => {
    if (!token) return;
    try {
      const v = await rpc<{ yeni?: number }>(
        'bildirim_sayim',
        { p_token: token },
        // Oturum düşmesin: rozet yan bir bilgi, kimlik akışını
        // yönetmemeli. Asıl ekranın çağrısı zaten oturumu denetliyor.
        { oturumDusurmesin: true },
      );
      setYeni(Number(v?.yeni ?? 0));
    } catch {
      // Sessiz — 0054 çalıştırılmamış bir panelde de kabuk çizilsin.
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

  return yeni;
}
