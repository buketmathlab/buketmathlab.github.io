import { OkulOdevleri } from '@/features/genel/OkulOdevleri';
import { useMudurPaneli } from './mudur-baglam';

/** Müdür → Genel → "Yayınlanan ödev" (0067). Sahibin önizlemesinde de aynı. */
export function MudurOkulOdevleri() {
  const { kok, onizleme } = useMudurPaneli();
  return <OkulOdevleri geri={kok} onizleme={onizleme} />;
}
