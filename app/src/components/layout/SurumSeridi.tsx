import { useSurumDenetimi } from '@/hooks/useSurumDenetimi';

/**
 * Yeni sürüm şeridi.
 *
 * TOAST DEĞİL, ŞERİT. Toast 4 saniyede kayboluyor; öğretmen telefonu
 * cebindeyken ya da başka bir şeye bakarken kaçırırdı ve eski sürümde
 * çalışmaya devam ederdi. Şerit kullanıcı bir şey yapana kadar duruyor.
 *
 * Sayfanın en üstünde ve akışın İÇİNDE duruyor (`sticky`, örtmüyor):
 * içeriğin üstüne binen bir kutu, dokunma hedeflerini kapatır.
 */
export function SurumSeridi() {
  const { yeniSurum, yoksay, yenile } = useSurumDenetimi();
  if (!yeniSurum) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-ink/15 bg-ink px-4 py-2 text-paper"
    >
      <span className="text-[14px] font-semibold">Yeni sürüm hazır.</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={yenile}
          className="inline-flex min-h-[44px] items-center rounded-sk-sm px-3 text-[14px] font-bold underline underline-offset-4 focus-visible:outline-paper"
        >
          Yenile
        </button>
        <button
          type="button"
          onClick={yoksay}
          className="inline-flex min-h-[44px] items-center rounded-sk-sm px-3 text-[14px] text-paper/80 focus-visible:outline-paper"
        >
          Şimdi değil
        </button>
      </div>
    </div>
  );
}
