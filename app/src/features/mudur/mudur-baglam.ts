import { useOutletContext } from 'react-router-dom';
import type { Durum, Sonuc } from '@/hooks/useVeri';
import type { MudurPaneli } from '@/types/api';

/** Müdürün kendi ekranı. */
export const MUDUR_KOKU = '/mudur';
/** Platform sahibinin önizlemesi (0062) — öğretmen oturumunda. */
export const ONIZLEME_KOKU = '/ogretmen/mudur-onizleme';

export type MudurBaglami = Sonuc<MudurPaneli> & {
  /** Bağlantıların kökü: '/mudur' ya da önizleme. */
  kok: string;
  onizleme: boolean;
};

/**
 * Müdür panosu kabukta BİR KEZ çekiliyor ve sekmelere `Outlet` bağlamıyla
 * geçiyor: Genel, Sınıflar ve Öğretmenler aynı yanıtı okuyor, sekme
 * değiştirmek sunucuya yeniden gitmiyor ve üç ekran aynı anın sayılarını
 * gösteriyor. Aynı bağlam, bağlantıların hangi kökten kurulacağını da
 * taşıyor (müdür mü, sahibin önizlemesi mi).
 */
export function useMudurPaneli(): MudurBaglami {
  return useOutletContext<MudurBaglami>();
}

/** Liste boşsa 'bos' — `useVeri`'nin `bosMu`'su kabukta verilemiyor. */
export function listeDurumu(durum: Durum, bos: boolean): Durum {
  return durum === 'hazir' && bos ? 'bos' : durum;
}
