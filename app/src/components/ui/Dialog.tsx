import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button';

type Props = {
  acik: boolean;
  onKapat: () => void;
  baslik: string;
  aciklama?: string;
  children?: ReactNode;
  /** Onay butonu; verilmezse yalnız kapatma gösterilir. */
  onayEtiketi?: string;
  onOnay?: () => void;
  onayTuru?: 'birincil' | 'tehlike';
  onayYukleniyor?: boolean;
};

/**
 * Modal diyalog.
 *
 * Yerel <dialog> öğesi kullanılıyor: odak tuzağı, Escape ile kapatma,
 * arka planın inert hâle gelmesi ve odağın geri verilmesi tarayıcı
 * tarafından sağlanıyor. Bunları elle yazmak hem daha fazla kod hem
 * daha fazla erişilebilirlik hatası demek olurdu.
 */
export function Dialog({
  acik,
  onKapat,
  baslik,
  aciklama,
  children,
  onayEtiketi,
  onOnay,
  onayTuru = 'birincil',
  onayYukleniyor = false,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (acik && !d.open) d.showModal();
    if (!acik && d.open) d.close();
  }, [acik]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onKapat();
      }}
      onClick={(e) => {
        // Yalnız arka plana (dialog'un kendisine) tıklanınca kapat.
        if (e.target === ref.current) onKapat();
      }}
      className="m-auto w-[min(92vw,440px)] rounded-sk-lg border border-line bg-surface p-0 text-ink shadow-sk-md backdrop:bg-ink/40"
    >
      <div className="p-5">
        <h2 className="text-[19px] font-semibold">{baslik}</h2>
        {aciklama && <p className="mt-2 text-[14px] text-muted">{aciklama}</p>}
        {children && <div className="mt-4">{children}</div>}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button tur="sade" onClick={onKapat}>
            Vazgeç
          </Button>
          {onayEtiketi && onOnay && (
            <Button tur={onayTuru} onClick={onOnay} yukleniyor={onayYukleniyor}>
              {onayEtiketi}
            </Button>
          )}
        </div>
      </div>
    </dialog>
  );
}
