import { useParams } from 'react-router-dom';
import { SinifOdevleri } from '@/features/siniflar/SinifOdevleri';
import { useMudurPaneli } from './mudur-baglam';

/** Müdür → Sınıflar → şube → "Ödevler ve cevap anahtarları" (0067). */
export function MudurSinifOdevleri() {
  const { id = '' } = useParams();
  const { kok, onizleme } = useMudurPaneli();
  return <SinifOdevleri sinifId={id} geri={`${kok}/siniflar`} onizleme={onizleme} />;
}
