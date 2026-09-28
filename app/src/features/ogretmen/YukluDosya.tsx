import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { Field, Input } from '@/components/ui/Field';

type Props = {
  etiket: string;
  /** Ödevde bu dosya zaten yüklü mü (kayıtta yol var mı). */
  yuklu: boolean;
  /** Yüklü dosyayı yeni sekmede açar. */
  onAc: () => void;
  /** Yeni dosya seçildiğinde (ya da seçim temizlendiğinde null). */
  onSec: (dosya: File | null) => void;
  /** Seçilen yeni dosya — adı gösterilir. */
  secilen: File | null;
  /** Dosya alanının altındaki açıklama. */
  ipucu?: string;
  hata?: string;
  kilitli?: boolean;
};

/**
 * Düzenlemede dosya alanı: yüklü dosya GÖRÜNÜR, değiştirmek isteğe bağlı.
 *
 * ## Neden
 *
 * Önceden düzenleme ekranında her iki dosya için boş bir `<input
 * type=file>` duruyordu — tarayıcı "Dosya seçilmedi" yazıyor. Yüklü
 * dosyanın korunduğu yalnız küçük ipucunda yazılıydı. Öğretmen yalnız son
 * tarihi uzatmak isterken soruları ve anahtarı yeniden yüklemesi
 * gerektiğini sandı (kendisi söyledi). Sunucu dosyayı zaten koruyordu;
 * eksik olan bunun GÖRÜNMESİYDİ.
 *
 * Artık: "Yüklü" etiketi + "Aç" + "Değiştir". Dosya alanı ancak
 * "Değiştir"e basılınca çıkıyor; "Vazgeç" seçimi geri alıyor ve yüklü
 * dosya olduğu gibi kalıyor.
 */
export function YukluDosya({ etiket, yuklu, onAc, onSec, secilen, ipucu, hata, kilitli }: Props) {
  const [degistiriyor, setDegistiriyor] = useState(!yuklu);

  if (yuklu && !degistiriyor) {
    return (
      <div className="mb-4">
        <p className="mb-1 block text-[13px] font-bold text-muted">{etiket}</p>
        <div className="flex flex-wrap items-center gap-2 rounded-sk-sm border border-line bg-line-soft p-3">
          <Tag tur="basari">Yüklü</Tag>
          <span className="text-[14px] text-ink">Değiştirmezseniz bu dosya aynen kalır.</span>
          <span className="ml-auto flex gap-2">
            <Button tur="sade" olcu="sm" onClick={onAc} aria-label={`${etiket} — yüklü dosyayı aç`}>
              Aç
            </Button>
            <Button
              tur="sade"
              olcu="sm"
              onClick={() => setDegistiriyor(true)}
              aria-label={`${etiket} — değiştir`}
              disabled={kilitli}
            >
              Değiştir
            </Button>
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Field etiket={etiket} {...(ipucu ? { ipucu } : {})} {...(hata ? { hata } : {})}>
        {(k) => (
          <Input
            {...k}
            type="file"
            accept="application/pdf"
            disabled={kilitli}
            onChange={(e) => onSec(e.target.files?.[0] ?? null)}
          />
        )}
      </Field>
      {(secilen || yuklu) && (
        <div className="-mt-2 mb-4 flex flex-wrap items-center gap-2">
          {secilen && (
            <p className="text-[13px] text-ink">
              Yeni dosya: <strong>{secilen.name}</strong>
              {yuklu ? ' — kaydedince yüklü dosyanın yerini alır.' : ''}
            </p>
          )}
          {yuklu && (
            <Button
              tur="sade"
              olcu="sm"
              onClick={() => {
                onSec(null);
                setDegistiriyor(false);
              }}
            >
              Vazgeç — yüklü dosya kalsın
            </Button>
          )}
        </div>
      )}
    </>
  );
}
