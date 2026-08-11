import { StarEight } from './StarEight';

type Props = {
  className?: string;
};

/**
 * Bölüm ayırıcı: ince çizgi + ortada sekiz köşeli yıldız düğümü.
 * Görsel olarak dekoratiftir, bu yüzden erişilebilirlik ağacından çıkarılır;
 * anlamsal ayrım gerekiyorsa çağıran taraf başlık kullanmalıdır.
 */
export function GeometricDivider({ className }: Props) {
  return (
    <div className={`flex items-center gap-4 text-line ${className ?? ''}`} aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      <StarEight boyut={14} className="text-amber" />
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
