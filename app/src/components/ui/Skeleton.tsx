import { cn } from '@/lib/cn';

/**
 * Yükleme iskeleti. `prefers-reduced-motion` açıkken darbe animasyonu
 * global temel katman tarafından zaten durdurulur.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-sk-sm bg-line-soft', className)}
    />
  );
}

/** Kart listesi beklerken kullanılacak hazır iskelet. */
export function KartIskeleti({ adet = 3 }: { adet?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: adet }, (_, i) => (
        <div key={i} className="rounded-sk-md border border-line bg-surface p-4">
          <Skeleton className="mb-3 h-4 w-2/5" />
          <Skeleton className="mb-2 h-3 w-4/5" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}
