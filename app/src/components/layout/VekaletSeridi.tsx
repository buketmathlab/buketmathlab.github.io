import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useOturum } from '@/hooks/oturum-baglam';
import { sahipJetonunuOku, sahipJetonunuUnut } from '@/lib/vekalet';
import type { BenKimim } from '@/types/api';

/**
 * VEKÂLET ŞERİDİ — sahip başka bir öğretmenin hesabındayken kalıcı uyarı.
 *
 * VEKÂLET SESSİZ OLAMAZ. Sahip hangi hesapta olduğunu unutursa yanlış
 * sınıfa ödev verir, yanlış öğrencinin notunu değiştirir. Bu yüzden şerit
 * kapatılamıyor: bir "×" düğmesi koysaydım, en çok ihtiyaç duyulan anda
 * kapatılmış olurdu.
 *
 * Rozet şeridi gibi geçici değil, sayfanın üstünde sabit duruyor ve
 * uyarı rengini taşıyor — bilgi değil, DURUM bildiriyor.
 */
export function VekaletSeridi({ ben }: { ben: BenKimim | null }) {
  const { girisYap } = useOturum();
  const git = useNavigate();

  if (!ben?.vekalet) return null;

  const geriDon = () => {
    const sahipJetonu = sahipJetonunuOku();
    sahipJetonunuUnut();
    if (sahipJetonu) {
      girisYap({ rol: 'ogretmen', token: sahipJetonu });
      git('/ogretmen', { replace: true });
    } else {
      // Dönüş jetonu yoksa (sekme yenilenmiş, depolama kapalı) tek dürüst
      // yol yeniden giriş. Sessizce vekâlette bırakmak daha kötü olurdu.
      git('/', { replace: true });
    }
  };

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-warning bg-warning-bg px-4 py-2"
    >
      <p className="text-[14px] font-semibold text-ink">
        <span className="font-bold">{ben.ad}</span> olarak görüntülüyorsunuz
        {ben.vekil ? ` — ${ben.vekil.ad}` : ''}.{' '}
        <span className="font-normal text-muted">
          Bu hesapta mesaj gönderemezsiniz.
        </span>
      </p>
      <Button tur="sade" olcu="sm" onClick={geriDon}>
        Kendi hesabıma dön
      </Button>
    </div>
  );
}
