import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import type { AnketDurumu } from '@/types/api';

const GIZLE = 'sekiz.anket_gizle.';

function gizlendiMi(anket: string): boolean {
  try {
    return localStorage.getItem(GIZLE + anket) === '1';
  } catch {
    return false;
  }
}

/**
 * PANODA ANKET DAVETİ (0076) — öğrenci, veli ve öğretmen panosunda.
 *
 * Yalnız anket AÇIKSA ve kişi henüz YANITLAMADIYSA çıkıyor. "Şimdi değil"
 * kartı bu cihazda gizliyor (zorlayıcı olmasın: anket gönüllü); sunucuda
 * bir iz bırakmıyor.
 *
 * 0076 çalışmadıysa, onamsız velide ya da müdürde uç hata veriyor; kart
 * sessizce çizilmiyor — Pano düşmesin.
 *
 * `liste`: öğrenci panosundaki kart listesine `<li>` olarak giriyor;
 * diğer panolarda düz bir kart.
 */
export function AnketKarti({ yol, liste = false }: { yol: string; liste?: boolean }) {
  const { oturum } = useOturum();
  const { veri } = useVeri<AnketDurumu>('anket_durumu', { p_token: oturum?.token });
  const [gizli, setGizli] = useState(false);

  if (!veri || !veri.acik || veri.katildi || gizli || gizlendiMi(veri.anket)) return null;
  const anket = veri.anket;

  const kart = (
    <Card vurgu="basari">
      <section aria-labelledby="anket-davet-baslik">
        <h2 id="anket-davet-baslik" className="text-[16px] font-semibold text-ink">
          Kısa anket — 2 dakika, isimsiz
        </h2>
        <p className="mt-1 text-[14px] text-muted">
          SEKİZ'i geliştirmemize yardım edin. Adınız, sınıfınız ya da kodunuz sorulmaz; yanıtlarınız
          kimliğinizle birlikte saklanmaz.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Link
            to={yol}
            className="inline-flex min-h-[44px] items-center rounded-sk-md bg-ink px-4 text-[15px] font-semibold text-paper hover:bg-ink-soft"
          >
            Ankete katıl
          </Link>
          <button
            type="button"
            className="min-h-[44px] px-2 text-[14px] text-muted underline-offset-4 hover:underline"
            onClick={() => {
              try {
                localStorage.setItem(GIZLE + anket, '1');
              } catch {
                /* depolama kapalı: yalnız bu ziyarette gizlenir */
              }
              setGizli(true);
            }}
          >
            Şimdi değil
          </button>
        </div>
      </section>
    </Card>
  );
  return liste ? <li>{kart}</li> : <div className="mb-5">{kart}</div>;
}
