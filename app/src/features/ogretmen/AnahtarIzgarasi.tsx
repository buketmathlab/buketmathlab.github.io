import { Tag } from '@/components/ui/Tag';
import type { Cikarim, SonSecenek } from '@/lib/cevap-anahtari';

type Props = {
  soruSayisi: number;
  sonSecenek: SonSecenek;
  anahtar: Record<number, string>;
  /** Çıkarım raporu. Elle giriliyorsa verilmez. */
  cikarim?: Cikarim | undefined;
  onDegis: (no: number, sik: string | null) => void;
};

const SIKLAR: Record<SonSecenek, string[]> = {
  D: ['A', 'B', 'C', 'D'],
  E: ['A', 'B', 'C', 'D', 'E'],
};

/**
 * Cevap anahtarı önizleme ve düzeltme ızgarası.
 *
 * PDF'ten çıkarılan anahtar BİR ÖNERİDİR (Part XXVIII). Bu ekran onu
 * öğretmenin önüne koyar; her şık değiştirilebilir, eksikler görünür.
 * Öğretmen onaylamadan hiçbir şey yayına gitmez — sunucu da eksik
 * anahtarlı ödevi reddediyor (`odev_yayinla`).
 *
 * Neden düğme ızgarası, açılır liste değil: 20-40 soruluk bir anahtarı
 * telefondan düzeltmek açılır listelerle çok yavaş. Tek dokunuşla şık
 * seçiliyor, ikinci dokunuş temizliyor.
 */
export function AnahtarIzgarasi({
  soruSayisi,
  sonSecenek,
  anahtar,
  cikarim,
  onDegis,
}: Props) {
  const siklar = SIKLAR[sonSecenek];
  const eksikler = Array.from({ length: soruSayisi }, (_, i) => i + 1).filter(
    (n) => !anahtar[n],
  );
  const celiskili = new Set(cikarim?.celiskili ?? []);

  return (
    <div>
      {/* Durum özeti — öğretmen "kaç tanesi tamam" sorusunu tek bakışta görsün. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Tag tur={eksikler.length === 0 ? 'basari' : 'uyari'}>
          <span className="sk-sayi">{soruSayisi - eksikler.length}</span>/
          <span className="sk-sayi">{soruSayisi}</span> cevap girildi
        </Tag>
        {eksikler.length > 0 && (
          <Tag tur="uyari">
            <span className="sk-sayi">{eksikler.length}</span> eksik
          </Tag>
        )}
        {celiskili.size > 0 && (
          <Tag tur="tehlike">
            <span className="sk-sayi">{celiskili.size}</span> soruda çelişki
          </Tag>
        )}
      </div>

      {/* Çıkarım zayıfsa açıkça söyle — sessizce güvenilir gibi gösterme. */}
      {cikarim?.yontem === 'harf-dizisi' && (
        <p className="mb-3 rounded-sk-sm bg-warning-bg p-3 text-[13px] text-warning">
          <strong>Dikkat:</strong> PDF'te soru numarası bulunamadı. Harfler sırayla
          eşlendi. Bu yöntem yanılabilir — lütfen cevapları tek tek doğrulayın.
        </p>
      )}
      {cikarim?.yontem === 'bulunamadi' && (
        <p className="mb-3 rounded-sk-sm bg-warning-bg p-3 text-[13px] text-warning">
          PDF'ten cevap çıkarılamadı. Cevapları aşağıdan elle girebilirsiniz.
        </p>
      )}
      {celiskili.size > 0 && (
        <p className="mb-3 rounded-sk-sm bg-danger-bg p-3 text-[13px] text-danger">
          <strong>{[...celiskili].join(', ')}</strong> numaralı sorularda PDF'te birden
          fazla farklı cevap görüldü. İlk bulunan yazıldı; bunları mutlaka kontrol edin.
        </p>
      )}

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: soruSayisi }, (_, i) => i + 1).map((no) => {
          const secili = anahtar[no];
          const eksik = !secili;
          return (
            <li
              key={no}
              className={
                'flex items-center gap-2 rounded-sk-sm border px-2 py-1 ' +
                (eksik
                  ? 'border-warning bg-warning-bg'
                  : celiskili.has(no)
                    ? 'border-danger'
                    : 'border-line')
              }
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
                      // İkinci dokunuş seçimi kaldırır: yanlış basmayı
                      // düzeltmek için ayrı bir "temizle" düğmesi gerekmiyor.
                      onClick={() => onDegis(no, aktif ? null : s)}
                      aria-pressed={aktif}
                      aria-label={`${no}. soru, ${s} şıkkı`}
                      className={
                        'min-h-[36px] min-w-[36px] rounded-sk-sm border text-[14px] font-semibold ' +
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
        })}
      </ul>
    </div>
  );
}
