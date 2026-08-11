import { cn } from '@/lib/cn';

type Props = {
  sayfa: number;
  toplamSayfa: number;
  onDegis: (sayfa: number) => void;
  /** Ekran okuyucu için bağlam: "Öğrenci listesi" gibi. */
  etiket: string;
};

/**
 * Sayfalama.
 *
 * Part XVI gereği listeler ~200 öğrenci ölçeğinde tasarlanır; sayfalanmamış
 * uzun liste yok. Mobilde yalnız önceki/sonraki ve konum bilgisi gösterilir —
 * küçük ekranda sayfa numarası ızgarası dokunulabilir olmaktan çıkıyor.
 */
export function Pagination({ sayfa, toplamSayfa, onDegis, etiket }: Props) {
  if (toplamSayfa <= 1) return null;

  const geriPasif = sayfa <= 1;
  const ileriPasif = sayfa >= toplamSayfa;

  const dugme =
    'min-h-[44px] min-w-[44px] rounded-sk-sm border border-line px-4 text-[14px] font-semibold ' +
    'disabled:opacity-40 disabled:cursor-not-allowed hover:bg-line-soft';

  return (
    <nav aria-label={`${etiket} sayfalama`} className="mt-4 flex items-center justify-between gap-3">
      <button
        type="button"
        className={cn(dugme)}
        onClick={() => onDegis(sayfa - 1)}
        disabled={geriPasif}
      >
        ← Önceki
      </button>

      <p className="text-[13px] text-muted sk-sayi" aria-live="polite">
        <span className="sk-gizli-metin">{etiket}: </span>
        {sayfa} / {toplamSayfa}
      </p>

      <button
        type="button"
        className={cn(dugme)}
        onClick={() => onDegis(sayfa + 1)}
        disabled={ileriPasif}
      >
        Sonraki →
      </button>
    </nav>
  );
}
