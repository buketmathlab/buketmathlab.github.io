import { NavLink } from 'react-router-dom';
import { Rozet } from '@/components/ui/Rozet';
import { cn } from '@/lib/cn';

/**
 * Ortak sekme çubuğu.
 *
 * Öğretmen kabuğundan çıkarıldı ve üç kabuk da (öğretmen, öğrenci, veli)
 * bunu kullanıyor. ÖĞRETMEN KABUĞUNUN GÖRÜNÜMÜ DEĞİŞMİYOR — yalnız kod
 * ortak bir yere taşındı; üç kopya zamanla ayrışırdı ve rozet mantığı
 * (erişilebilirlik dahil) üç kez ayrı ayrı bozulabilirdi.
 *
 * Üç biçim var, çünkü üç farklı düzen var:
 *   - `yan`    geniş ekranda öğretmenin sol menüsü
 *   - `alt`    dar ekranda alt sekme çubuğu (üç kabukta da aynı)
 *   - `yatay`  geniş ekranda öğrenci/velinin yatay sekme satırı
 *
 * Öğrenci ve veli neden `yan` kullanmıyor: ikisinin de düzeni ortalanmış
 * 880 px'lik tek sütun. Sol menü açmak o sütunu kenara iterdi ve üç
 * sekme için koca bir kenar çubuğu boş yer kaplardı.
 */

export type SekmeTanim = {
  yol: string;
  etiket: string;
  /** İkonun `<path d="…">` değeri (`SEKME_IKON`). */
  ikon: string;
  /** `NavLink end` — yalnız kabuğun kök rotasında gerekli. */
  sonu?: boolean;
  /** Rozette gösterilecek sayı. 0 ise rozet hiç çizilmiyor. */
  rozet?: number;
  /** Ekran okuyucuya okunacak açıklama: "3 okunmamış mesaj". */
  rozetAdi?: (n: number) => string;
};

/**
 * Ekran okuyucu için sekme adı.
 *
 * Rozet `aria-hidden`; sayı BURADA geçmezse klavye/ekran okuyucu kullanan
 * biri bekleyen işi hiç duymaz.
 */
function etiketAdi(s: SekmeTanim): string | undefined {
  const n = s.rozet ?? 0;
  return n > 0 && s.rozetAdi ? `${s.etiket}, ${s.rozetAdi(n)}` : undefined;
}

export function SekmeCubugu({
  sekmeler,
  bicim,
  className,
}: {
  sekmeler: SekmeTanim[];
  bicim: 'yan' | 'alt' | 'yatay';
  className?: string;
}) {
  if (bicim === 'yan') {
    return (
      <nav className={cn('flex flex-col gap-1', className)} aria-label="Ana gezinme">
        {sekmeler.map((s) => (
          <NavLink
            key={s.yol}
            to={s.yol}
            end={s.sonu ?? false}
            className={({ isActive }) =>
              cn(
                'flex min-h-[44px] items-center gap-3 rounded-sk-sm px-3 text-[15px] font-semibold',
                isActive ? 'bg-ink text-paper' : 'text-muted hover:bg-line-soft',
              )
            }
            aria-label={etiketAdi(s)}
          >
            <Ikon d={s.ikon} />
            <span className="flex-1">{s.etiket}</span>
            <Rozet sayi={s.rozet ?? 0} />
          </NavLink>
        ))}
      </nav>
    );
  }

  if (bicim === 'yatay') {
    return (
      <nav
        className={cn('flex gap-1 border-b border-line', className)}
        aria-label="Ana gezinme"
      >
        {sekmeler.map((s) => (
          <NavLink
            key={s.yol}
            to={s.yol}
            end={s.sonu ?? false}
            className={({ isActive }) =>
              cn(
                'flex min-h-[44px] items-center gap-2 border-b-2 px-3 text-[15px] font-semibold',
                isActive
                  ? 'border-ink text-ink'
                  : 'border-transparent text-muted hover:text-ink',
              )
            }
            aria-label={etiketAdi(s)}
          >
            <Ikon d={s.ikon} />
            {s.etiket}
            <Rozet sayi={s.rozet ?? 0} />
          </NavLink>
        ))}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Ana gezinme"
      className={cn(
        'sk-alt-guvenli fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface',
        className,
      )}
    >
      {sekmeler.map((s) => (
        <NavLink
          key={s.yol}
          to={s.yol}
          end={s.sonu ?? false}
          className={({ isActive }) =>
            cn(
              'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-bold',
              isActive ? 'text-ink' : 'text-muted',
            )
          }
          aria-label={etiketAdi(s)}
        >
          {/* Rozet ikonun sağ üstünde. Alt çubuk dikey (ikon üstte, etiket
              altta); rozeti kardeş öğe olarak koymak onu etiketin ALTINA
              düşürüyordu. */}
          <span className="relative size-5">
            <Ikon d={s.ikon} />
            {(s.rozet ?? 0) > 0 && (
              <span className="absolute -right-2.5 -top-1.5">
                <Rozet sayi={s.rozet ?? 0} />
              </span>
            )}
          </span>
          {s.etiket}
        </NavLink>
      ))}
    </nav>
  );
}

/** Sekme ikonu — `SEKME_IKON`'daki yolu SVG'ye sarar. */
function Ikon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-5">
      <path d={d} />
    </svg>
  );
}
