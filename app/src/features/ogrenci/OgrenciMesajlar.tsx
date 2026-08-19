import { useEffect, useRef } from 'react';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { Yazisma } from '@/components/ui/Yazisma';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { rpc } from '@/services/supabase';
import type { OgrenciMesajlari } from '@/types/api';

/**
 * Öğrencinin öğretmeniyle yazışması (0025).
 *
 * VELİNİN YAZIŞMASI BURADA YOK — ve bu bir arayüz süzgeci değil.
 * `ogrenci_mesajlari` yalnız `kanal = 'ogrenci'` satırlarını döndürüyor;
 * velinin öğretmene yazdıkları bu uçtan hiç çıkmıyor. Çocuğun,
 * velisinin öğretmenle konuştuklarını ("son zamanlarda tembelleşti, ne
 * yapmalıyız?") okuması geri alınamaz bir şey; sınır bu yüzden şemada
 * (Part XXI: gizlenen veri gönderilmiş veridir).
 *
 * `iki_yazisma_testleri.sql` 2. grubu bunu GERÇEK METİN arayarak ölçüyor
 * ve denetimin çalıştığını aynı cümlenin öğretmenin doğru kanalında
 * bulunduğunu göstererek kanıtlıyor.
 *
 * AYRI BİR UÇ, çünkü Mesajlar sekmesi açılmadan mesaj metinlerini
 * indirmenin sebebi yok — Pano ve Ödevler sekmesi yalnız SAYIYI taşıyor.
 */
export function OgrenciMesajlar() {
  const { oturum } = useOturum();
  const okunduYazildi = useRef(false);

  const { veri, durum, hata, yenile } = useVeri<OgrenciMesajlari>('ogrenci_mesajlari', {
    p_token: oturum?.token,
  });

  useEffect(() => {
    // Bir kez: her yeniden çizimde istek atmasın. Ekran açıldı = öğrenci
    // mesajı gördü; ayrı bir "okundu" düğmesi hiçbir şey kazandırmaz.
    if (!veri || okunduYazildi.current || !oturum?.token) return;
    okunduYazildi.current = true;
    void rpc('okundu_isaretle', { p_token: oturum.token }).catch(() => {
      // Okundu kaydı yazılamazsa ekran çalışmaya devam etmeli; en kötü
      // rozet bir sonraki açılışta düşer.
    });
  }, [veri, oturum?.token]);

  return (
    <>
      <h1 className="mb-1 font-display text-[24px] font-semibold text-ink">
        Öğretmeninle mesajlar
      </h1>
      {/* Öğrenci bu yazışmanın KİMİNLE olduğunu bilmeli. "Öğretmenin
          görür" demek yetmez: velisinin de bir yazışması olduğunu, ama
          bunun ondan ayrı olduğunu bilsin. */}
      <p className="mb-5 text-[14px] text-muted">
        Bu yazışmayı yalnız sen ve öğretmenin görüyorsunuz.
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
            benKimim="ogrenci"
            adlar={{ ogretmen: 'Öğretmenin' }}
            yazmaEtiketi="Öğretmenine mesaj"
            yerTutucu="Sormak istediğini yaz."
            gonderParametreleri={{ p_token: oturum?.token }}
            gonderildi={yenile}
            bosMetin="Henüz mesaj yok. Sormak istediğini aşağıdan yazabilirsin."
          />
        )}
      </AsyncBoundary>
    </>
  );
}
