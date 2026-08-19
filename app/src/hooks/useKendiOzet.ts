import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useOturum } from '@/hooks/oturum-baglam';
import { rpc } from '@/services/supabase';

/**
 * Öğrenci ve veli kabuğunun ihtiyacı olan iki bilgi (0025).
 *
 * NEDEN AYRI BİR UÇ YOK. Öğretmende `bildirim_sayilari` yazılmıştı çünkü
 * `veliler_listesi` bütün okulu dolaşıyor. Burada durum farklı: `veri`
 * tek bir öğrencinin verisi — birkaç düzine ödev satırı. Sırf iki alan
 * için üçüncü bir uç açmak, 0007 tuzağını (yeni imza, yeni yetki) bedava
 * davet etmek olurdu.
 *
 * NE ZAMAN YOKLANIYOR: açılışta ve ROTA DEĞİŞİNCE. Mesajlar sekmesinden
 * çıkınca rozet hemen düşsün; "okudum ama hâlâ 1 diyor" hissi olmasın.
 *
 * HATA SESSİZ: rozet gösterememek ekranı bozmamalı. 0025 panelde henüz
 * çalıştırılmadıysa `okunmamis_mesaj` alanı hiç gelmez; o hâlde sayı 0
 * kalır, sekme çubuğu eskisi gibi çalışır.
 */

export type KendiOzet = {
  /** Özel ders mi: veli kabuğunda Ödemeler sekmesi buna göre çıkıyor. */
  tur: 'okul' | 'ozel' | null;
  okunmamis_mesaj: number;
};

const BOS: KendiOzet = { tur: null, okunmamis_mesaj: 0 };

export function useKendiOzet(uc: 'ogrenci_odevleri' | 'veli_paneli'): KendiOzet {
  const { oturum } = useOturum();
  const konum = useLocation();
  const [ozet, setOzet] = useState<KendiOzet>(BOS);
  const token = oturum?.token;

  const bak = useCallback(async () => {
    if (!token) return;
    try {
      const v = await rpc<{
        ogrenci?: { tur?: 'okul' | 'ozel' };
        okunmamis_mesaj?: number;
      }>(uc, { p_token: token }, { oturumDusurmesin: true });
      setOzet({
        tur: v?.ogrenci?.tur ?? null,
        okunmamis_mesaj: Number(v?.okunmamis_mesaj ?? 0),
      });
    } catch {
      // Sessiz — sekme çubuğu yan bir bilgi, kimlik akışını yönetmemeli.
    }
  }, [token, uc]);

  useEffect(() => {
    void bak();
  }, [bak, konum.pathname]);

  return ozet;
}
