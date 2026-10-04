import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { useOturum } from '@/hooks/oturum-baglam';
import { OZET_YENILE } from '@/hooks/useKendiOzet';
import { useVeri } from '@/hooks/useVeri';
import { duyuruZamani } from '@/lib/duyuru-metni';
import { rpc } from '@/services/supabase';
import type { OgrenciDuyurusu } from '@/types/api';

/**
 * ÖĞRENCİNİN PANOSUNDA DUYURULAR (0065).
 *
 * Öğretmenin şubeye yaptığı TEK YÖNLÜ duyuru: yanıt düğmesi yok. Kart
 * yalnız son 30 günde duyuru varsa çıkıyor ve listenin EN BAŞINDA — acil
 * olabilir.
 *
 * Pano açıldığında duyurular okunmuş sayılıyor (`duyurulari_okudum`);
 * "Yeni" etiketi bu ziyarette kalıyor ki öğrenci hangisinin yeni geldiğini
 * görsün. Sekme rozeti hemen düşüyor (`OZET_YENILE`).
 *
 * Bir `<li>` döndürüyor: `OgrenciPano`'daki kart listesinin bir öğesi.
 * 0065 panelde çalıştırılmadıysa uç yoktur; kart sessizce çizilmiyor.
 */
export function DuyuruKarti() {
  const { oturum } = useOturum();
  const token = oturum?.token;
  const { veri } = useVeri<OgrenciDuyurusu[]>('ogrenci_duyurulari', {
    p_token: token,
  });
  const isaretlendi = useRef(false);
  // Uç yoksa ya da beklenmeyen bir yanıt gelirse kart yok — Pano düşmesin.
  const liste = Array.isArray(veri) ? veri : [];

  const yeniVar = liste.some((d) => d.yeni);
  useEffect(() => {
    if (!yeniVar || isaretlendi.current || !token) return;
    isaretlendi.current = true;
    rpc('duyurulari_okudum', { p_token: token }, { oturumDusurmesin: true })
      .then(() => window.dispatchEvent(new Event(OZET_YENILE)))
      .catch(() => {
        // Sessiz: bir dahaki açılışta yeniden denenir.
        isaretlendi.current = false;
      });
  }, [yeniVar, token]);

  if (liste.length === 0) return null;

  return (
    <li>
      <Card vurgu={yeniVar ? 'uyari' : 'yok'}>
        <section aria-labelledby="duyurular-baslik">
          <h2
            id="duyurular-baslik"
            className="text-[13px] font-bold uppercase tracking-wide text-muted"
          >
            Duyurular
          </h2>
          <ul className="mt-2 divide-y divide-line">
            {liste.map((d) => (
              <li key={d.id} className="py-2 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
                  <span className="font-semibold text-ink">{d.ogretmen}</span>
                  <span>{duyuruZamani(d.zaman)}</span>
                  {d.yeni && <Tag tur="uyari">Yeni</Tag>}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-[15px] text-ink">
                  {d.metin}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </Card>
    </li>
  );
}
