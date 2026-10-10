import type { ReactNode } from 'react';

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
    <li
      className={`flex break-inside-avoid items-center gap-2 rounded-sk-sm border px-2 py-1 ${cerceve}`}
    >
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

/**
 * Şık satırlarının listesi — numaralar YUKARIDAN AŞAĞI, sütun sütun.
 *
 * Öğretmen: "Öğrenci cevap optiklerinde numaralandırma yukarıdan aşağıya
 * olsun. Yatay olunca öğrenciler yanlış işaretliyorlar." Eskiden ızgara
 * satır satırdı (1 2 / 3 4 …); öğrenci 1'in altındakini 2 sanıyordu. Artık
 * kâğıt optik formu gibi: 1. sütun 1–10, 2. sütun 11–20.
 *
 * CSS ÇOK SÜTUNU, ızgara değil: tarayıcı önce aşağı doğru diziyor ve
 * sütunları kendisi dengeliyor (21 soru → 11 / 10); satır sayısını
 * ekran genişliğine göre hesaplamak gerekmiyor. DOM sırası 1…n, yani
 * klavye ve ekran okuyucu sırası da görsel sırayla aynı.
 *
 * Boşluk `[&>li]:mb-2`, `space-y` DEĞİL: `space-y` ikinci sütunun ilk
 * satırını 8 px aşağı iter, 1 ile 11 aynı hizada durmazdı.
 *
 * Öğrenci ekranı (2 sütun) ve öğretmenin anahtar ızgarası (geniş ekranda
 * 3 sütun) aynı bileşeni kullanıyor: iki ekranın sırası ayrışmasın.
 */
export function SikListesi({ sutun, children }: { sutun: 2 | 3; children: ReactNode }) {
  return (
    <ul
      className={`gap-x-2 sm:columns-2 [&>li]:mb-2 ${sutun === 3 ? 'lg:columns-3' : ''}`}
    >
      {children}
    </ul>
  );
}

/** Şık harfleri. Tek yerde tanımlı ki iki ekran ayrışmasın. */
export const SIKLAR = {
  D: ['A', 'B', 'C', 'D'],
  E: ['A', 'B', 'C', 'D', 'E'],
} as const;
