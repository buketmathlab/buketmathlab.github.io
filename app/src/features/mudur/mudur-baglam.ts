import { useOutletContext } from 'react-router-dom';
import type { Durum, Sonuc } from '@/hooks/useVeri';
import type { MudurPaneli } from '@/types/api';

/**
 * Müdür panosu kabukta BİR KEZ çekiliyor ve sekmelere `Outlet` bağlamıyla
 * geçiyor: Genel, Sınıflar ve Öğretmenler aynı yanıtı okuyor, sekme
 * değiştirmek sunucuya yeniden gitmiyor ve üç ekran aynı anın sayılarını
 * gösteriyor.
 */
export function useMudurPaneli(): Sonuc<MudurPaneli> {
  return useOutletContext<Sonuc<MudurPaneli>>();
}

/** Liste boşsa 'bos' — `useVeri`'nin `bosMu`'su kabukta verilemiyor. */
export function listeDurumu(durum: Durum, bos: boolean): Durum {
  return durum === 'hazir' && bos ? 'bos' : durum;
}
