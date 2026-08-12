type Props = {
  no: number;
  siklar: readonly string[];
  secili: string | undefined;
  /** Satırın çerçeve rengi. Anlamı çağıran ekrana ait. */
  vurgu?: 'yok' | 'uyari' | 'tehlike';
  onDegis: (no: number, sik: string | null) => void;
};

/**
 * Tek bir sorunun şık satırı: numara + dokunmatik şık düğmeleri.
 *
 * Hem öğretmenin cevap anahtarı ızgarasında hem öğrencinin cevap
 * ızgarasında kullanılıyor. Ortak olmasının sebebi görsel benzerlik değil:
 * dokunma hedefi boyutu, `aria-label` metni ve "ikinci dokunuş seçimi
 * kaldırır" davranışı iki ekranda ayrışırsa biri erişilebilirlik denetimini
 * geçer, diğeri sessizce geçmez.
 *
 * İkinci dokunuş seçimi kaldırır: yanlış basmayı düzeltmek için ayrı bir
 * "temizle" düğmesi gerekmiyor — telefonda bu fark büyük.
 */
export function SikSatiri({ no, siklar, secili, vurgu = 'yok', onDegis }: Props) {
  const cerceve =
    vurgu === 'uyari'
      ? 'border-warning bg-warning-bg'
      : vurgu === 'tehlike'
        ? 'border-danger'
        : 'border-line';

  return (
    <li className={`flex items-center gap-2 rounded-sk-sm border px-2 py-1 ${cerceve}`}>
      <span className="sk-sayi w-7 shrink-0 text-right text-[13px] font-bold text-muted">
        {no}
      </span>
      <div className="flex flex-wrap gap-1">
        {siklar.map((s) => {
          const aktif = secili === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onDegis(no, aktif ? null : s)}
              aria-pressed={aktif}
              aria-label={`${no}. soru, ${s} şıkkı`}
              // 44 px: ürünün kendi dokunma hedefi kuralı. Önce 36 px'di ve
              // erişilebilirlik denetimi bunu öğrenci ekranında yakaladı —
              // öğrenci bir testte bu düğmeye onlarca kez basıyor, en çok
              // dokunulan öğede kuralı esnetmek yanlış yerde tasarruftu.
              className={
                'min-h-[44px] min-w-[44px] rounded-sk-sm border text-[14px] font-semibold ' +
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
                'focus-visible:outline-ink ' +
                (aktif
                  ? 'border-ink bg-ink text-paper'
                  : 'border-line bg-surface text-muted hover:border-ink-soft')
              }
            >
              {s}
            </button>
          );
        })}
      </div>
    </li>
  );
}

/** Şık harfleri. Tek yerde tanımlı ki iki ekran ayrışmasın. */
export const SIKLAR = {
  D: ['A', 'B', 'C', 'D'],
  E: ['A', 'B', 'C', 'D', 'E'],
} as const;
