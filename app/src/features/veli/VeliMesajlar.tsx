import { useEffect, useRef } from 'react';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { Yazisma } from '@/components/ui/Yazisma';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { rpc } from '@/services/supabase';
import type { VeliPaneli } from '@/types/api';

/**
 * Velinin öğretmenle yazışması (0025).
 *
 * ÇOCUĞUN YAZIŞMASI BURADA YOK. `veli_paneli` yalnız `kanal = 'veli'`
 * satırlarını döndürüyor; çocuğun öğretmenine yazdıkları bu uçtan hiç
 * çıkmıyor. Ayrım tabloda, arayüzde değil — çocuk da öğretmenine
 * velisinin okumayacağını bilerek yazıyor.
 */
export function VeliMesajlar() {
  const { oturum } = useOturum();
  const okunduYazildi = useRef(false);

  const { veri, durum, hata, yenile } = useVeri<VeliPaneli>('veli_paneli', {
    p_token: oturum?.token,
  });

  useEffect(() => {
    if (!veri || okunduYazildi.current || !oturum?.token) return;
    okunduYazildi.current = true;
    void rpc('okundu_isaretle', { p_token: oturum.token }).catch(() => {
      // Okundu kaydı yazılamazsa ekran çalışmaya devam etmeli.
    });
  }, [veri, oturum?.token]);

  return (
    <>
      <h1 className="mb-1 text-[24px] text-ink">Öğretmenle yazışma</h1>
      <p className="mb-5 text-[14px] text-muted">
        Bu yazışmayı yalnız siz ve öğretmen görüyorsunuz.
      </p>

      <AsyncBoundary
        durum={durum}
        bosBaslik="Mesajlar açılamadı"
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {veri && (
          <Yazisma
            mesajlar={veri.mesajlar}
            benKimim="veli"
            adlar={{ ogretmen: 'Öğretmen' }}
            yazmaEtiketi="Öğretmene mesaj"
            yerTutucu="Sormak istediğinizi yazın."
            // p_ogrenci_id GÖNDERİLMİYOR: sunucu velide bu parametreyi
            // zaten yok sayıyor ve mesajı velinin kendi çocuğuna yazıyor.
            // Göndermek, sanki seçilebilirmiş izlenimi verirdi.
            gonderParametreleri={{ p_token: oturum?.token }}
            gonderildi={yenile}
            bosMetin="Henüz mesaj yok. Sormak istediğinizi aşağıdan yazabilirsiniz."
          />
        )}
      </AsyncBoundary>
    </>
  );
}
