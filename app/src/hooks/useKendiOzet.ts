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
  /**
   * 0034 — veli henüz onam vermemiş. Sunucu bu durumda `veli_paneli`
   * yanıtında ÇOCUĞA AİT HİÇBİR ALAN döndürmüyor; kabuk da sekmelerin
   * yerine onam ekranını çiziyor.
   *
   * Öğrenci kabuğunda (`ogrenci_odevleri`) bu alan hiç gelmiyor ve `false`
   * kalıyor: kapı yalnız veliye ait.
   */
  onam_gerekli: boolean;
  /**
   * İlk yanıt geldi mi.
   *
   * Bu olmadan kabuk, cevap gelene kadar `onam_gerekli: false` varsayar ve
   * onam bekleyen veliye önce sekmeleri gösterip sonra onam ekranına
   * atlardı. Veri sızmazdı (sunucu zaten vermiyor) ama ekran titrerdi.
   */
  hazir: boolean;
};

const BOS: KendiOzet = {
  tur: null,
  okunmamis_mesaj: 0,
  onam_gerekli: false,
  hazir: false,
};

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
        onam_gerekli?: boolean;
      }>(uc, { p_token: token }, { oturumDusurmesin: true });
      setOzet({
        tur: v?.ogrenci?.tur ?? null,
        okunmamis_mesaj: Number(v?.okunmamis_mesaj ?? 0),
        onam_gerekli: v?.onam_gerekli === true,
        hazir: true,
      });
    } catch {
      // Sessiz — sekme çubuğu yan bir bilgi, kimlik akışını yönetmemeli.
      // `hazir` işaretleniyor ki kabuk sonsuza kadar beklemesin: 0034
      // çalıştırılmamış bir panelde uç eskisi gibi cevap veriyor ve onam
      // kapısı hiç görünmüyor.
      setOzet((eski) => ({ ...eski, hazir: true }));
    }
  }, [token, uc]);

  useEffect(() => {
    void bak();
  }, [bak, konum.pathname]);

  return ozet;
}
