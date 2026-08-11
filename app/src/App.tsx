import { ToastSaglayici } from '@/components/ui/Toast';
import { TasarimSistemi } from '@/pages/TasarimSistemi';

/**
 * FAZ 0 — uygulama henüz yok.
 *
 * Bu sürüm yalnızca tasarım sistemini ve marka dilini görünür kılar.
 * Öğretmen, öğrenci ve veli ekranları Faz 2–4'te gelecek. Mevcut canlı
 * uygulama kök adreste çalışmaya devam ediyor; burası /yeni/ altında.
 */
export function App() {
  return (
    <ToastSaglayici>
      <TasarimSistemi />
    </ToastSaglayici>
  );
}
