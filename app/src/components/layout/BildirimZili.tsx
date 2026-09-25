import { NavLink } from 'react-router-dom';
import { Rozet } from '@/components/ui/Rozet';
import { zilEtiketi } from '@/lib/bildirim-metni';
import { useBildirimSayim } from '@/hooks/useBildirimSayim';

/**
 * Üst satırdaki bildirim zili (0054) — öğrenci ve veli kabuğunda aynısı.
 *
 * NEDEN SEKME DEĞİL. Öğrencide dört, velide beşe kadar sekme var; altıncı
 * sekme 360 px'de etiketleri kırıyor. Zil üst satırda tek bir dokunma
 * hedefi ve her ekranda duruyor — bildirim tam olarak bunu istiyor.
 *
 * 360 PX ÖLÇÜLDÜ. Üst satır `justify-between` ile kurulu ve öğrencinin adı
 * `min-w-0` + `truncate` ile daralabiliyor; zil `shrink-0` olduğu için
 * daralma adı kesmeye değil, adın kendi satırında kalmasına gidiyor.
 * `bildirim-denetimi.mjs` 1. grubu bunu tarayıcıda ölçüyor — karar masa
 * başında verilmedi.
 *
 * ROZET `aria-hidden` (bkz. `Rozet`): sayı bağlantının `aria-label`'ında
 * geçiyor (`zilEtiketi`), yoksa ekran okuyucu kullanan biri bekleyen
 * bildirimi hiç duymazdı.
 */
export function BildirimZili({ yol }: { yol: string }) {
  const yeni = useBildirimSayim();

  return (
    <NavLink
      to={yol}
      aria-label={zilEtiketi(yeni)}
      className={({ isActive }) =>
        [
          'relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sk-md',
          'transition-colors hover:bg-paper',
          isActive ? 'bg-paper text-ink' : 'text-muted',
        ].join(' ')
      }
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
        {/* Zil — kendi setimiz, ikon paketi bağımlılığı eklenmiyor. */}
        <path d="M12 2a6 6 0 0 0-6 6v3.6l-1.7 3.2A1 1 0 0 0 5.2 16h13.6a1 1 0 0 0 .9-1.2L18 11.6V8a6 6 0 0 0-6-6Zm0 19a3 3 0 0 0 2.8-2H9.2a3 3 0 0 0 2.8 2Z" />
      </svg>
      {yeni > 0 && (
        <span className="absolute -right-0.5 -top-0.5">
          <Rozet sayi={yeni} />
        </span>
      )}
    </NavLink>
  );
}
