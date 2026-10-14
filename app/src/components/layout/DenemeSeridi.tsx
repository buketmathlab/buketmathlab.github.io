import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useOturum } from '@/hooks/oturum-baglam';
import { denemedenDon, denemeOturumuMu } from '@/lib/deneme-oturumu';
import { oturumYaz, rpc } from '@/services/supabase';

/**
 * DENEME ŞERİDİ — sahip, Öğretmenler sayfasından tek tıkla deneme
 * öğrencinin ya da velisinin hesabına geçtiğinde kalıcı uyarı.
 *
 * `VekaletSeridi` ile aynı gerekçe: hangi hesapta olduğu sessiz olamaz ve
 * şerit kapatılamaz. Fark, dönüş hedefi: sahip denemeye Öğretmenler
 * sayfasından geldi, oraya dönüyor.
 *
 * Gerçek öğrenci ve veli bu şeridi HİÇ görmez: yalnız aynı sekmede,
 * sahibin açtığı deneme oturumunda çıkıyor (`denemeOturumuMu`).
 */
export function DenemeSeridi() {
  const { oturum, cikisYap } = useOturum();
  const git = useNavigate();

  if (!denemeOturumuMu(oturum?.ogrenci?.id)) return null;

  const geriDon = () => {
    const sahipJetonu = denemedenDon();
    if (sahipJetonu && oturum) {
      // Deneme oturumu sunucuda da kapanıyor; yoksa 30 gün açık kalırdı.
      // `oturumDusurmesin`: deneme jetonu zaten düşmüşse (sıfırlandı,
      // silindi) gelen 28000, az önce geri yüklenen SAHİP oturumunu
      // silmesin.
      void rpc('cikis', { p_token: oturum.token }, { oturumDusurmesin: true }).catch(() => {});
      // TAM YENİLEME, `girisYap` + `git` değil: rotalar role göre ayrı
      // ağaçlar (App.tsx). Rol değişince öğrenci ağacının "*" yönlendirmesi
      // `git`i eziyor ve sahip Pano'ya düşüyordu (denetim H7 yakaladı).
      // Yenileme ayrıca öğrenci ekranından kalan önbelleği de temizliyor.
      oturumYaz({ rol: 'ogretmen', token: sahipJetonu });
      window.location.replace('#/ogretmen/ogretmenler');
      window.location.reload();
    } else {
      cikisYap();
      git('/', { replace: true });
    }
  };

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-warning bg-warning-bg px-4 py-2"
    >
      <p className="text-[14px] font-semibold text-ink">
        Deneme hesabındasınız{oturum?.ogrenci?.sinif ? ` · ${oturum.ogrenci.sinif}` : ''}.{' '}
        <span className="font-normal text-muted">
          {oturum?.rol === 'veli' ? 'Velinin' : 'Öğrencinin'} gördüğünün aynısı.
        </span>
      </p>
      <Button tur="sade" olcu="sm" onClick={geriDon}>
        Öğretmen hesabına dön
      </Button>
    </div>
  );
}
