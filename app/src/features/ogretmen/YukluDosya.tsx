import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { Field, Input } from '@/components/ui/Field';

type Props = {
  etiket: string;
  /** Kartın başlığı: "Soru dosyası", "Cevap anahtarı". */
  baslik: string;
  /** Başlığın altındaki ayrıntı: "Ödevin soruları", "51 sorunun cevabı kayıtlı". */
  ayrinti: string;
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

/** Belge simgesi — köşesi kıvrık sayfa, üstünde "PDF". Süs; metin zaten yazıyor. */
function BelgeSimgesi() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 40 48"
      className="h-12 w-10 shrink-0 text-danger"
      fill="none"
    >
      <path d="M4 3h22l10 10v32H4z" className="fill-surface" stroke="currentColor" strokeWidth="2" />
      <path d="M26 3v10h10" stroke="currentColor" strokeWidth="2" />
      <rect x="4" y="27" width="26" height="12" rx="2" fill="currentColor" />
      <text x="17" y="36.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff" fontFamily="sans-serif">
        PDF
      </text>
    </svg>
  );
}

/** Yeni seçilen dosyanın boyutu, okunur biçimde. */
function boyut(bayt: number): string {
  return bayt >= 1024 * 1024
    ? `${(bayt / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
    : `${Math.max(1, Math.round(bayt / 1024))} KB`;
}

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
 * Artık bir belge kartı: simge, başlık, "Kayıtlı", ne olduğu (ör. "51
 * sorunun cevabı kayıtlı"), "Görüntüle" ve "Yenisiyle değiştir". Dosya alanı
 * ancak "Yenisiyle değiştir"e basılınca çıkıyor; "Vazgeç" seçimi geri alıyor
 * ve kayıtlı dosya olduğu gibi kalıyor.
 */
export function YukluDosya({
  etiket,
  baslik,
  ayrinti,
  yuklu,
  onAc,
  onSec,
  secilen,
  ipucu,
  hata,
  kilitli,
}: Props) {
  const [degistiriyor, setDegistiriyor] = useState(!yuklu);

  if (yuklu && !degistiriyor) {
    return (
      <div className="mb-5">
        <p className="mb-1 block text-[13px] font-bold text-muted">{etiket}</p>
        <div className="flex gap-3 rounded-sk-md border border-line bg-surface p-4">
          <BelgeSimgesi />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[15px] font-semibold text-ink">{baslik}</p>
              <Tag tur="basari">Kayıtlı</Tag>
            </div>
            <p className="mt-0.5 text-[13px] text-muted">{`PDF belgesi · ${ayrinti}`}</p>
            <p className="mt-2 text-[13px] text-ink">
              Değiştirmediğiniz sürece bu dosya ödevde aynen kalır; yeniden yüklemenize gerek yok.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button tur="sade" olcu="sm" onClick={onAc} aria-label={`${etiket} — dosyayı görüntüle`}>
                Görüntüle
              </Button>
              <Button
                tur="sade"
                olcu="sm"
                onClick={() => setDegistiriyor(true)}
                aria-label={`${etiket} — yenisiyle değiştir`}
                disabled={kilitli}
              >
                Yenisiyle değiştir
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-5">
      {yuklu && (
        <p className="mb-2 rounded-sk-sm bg-line-soft p-3 text-[13px] text-ink">
          Yeni bir PDF seçin. Seçmezseniz ya da vazgeçerseniz kayıtlı dosya kullanılmaya devam eder.
        </p>
      )}
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
        <div className="-mt-2 flex flex-wrap items-center gap-2">
          {secilen && (
            <p className="text-[13px] text-ink">
              Seçilen dosya: <strong>{secilen.name}</strong>
              {` (${boyut(secilen.size)})`}
              {yuklu ? ' — kaydettiğinizde kayıtlı dosyanın yerini alır.' : ''}
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
              Vazgeç — kayıtlı dosya kalsın
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
