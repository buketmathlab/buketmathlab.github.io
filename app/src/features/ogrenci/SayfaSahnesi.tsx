import { useEffect, useState } from 'react';
import { Field, Input } from '@/components/ui/Field';
import { Tag } from '@/components/ui/Tag';
import { sayfaSayacMetni } from '@/lib/cozum-sayfalari';

export type Sayfa = { id: string; dosya: File };

type Props = {
  sayfalar: readonly Sayfa[];
  sinir: number;
  /** Seçilen dosyalar sıkıştırılırken ekleme kapalı. */
  isliyor: boolean;
  hata: string | null;
  onEkle: (dosyalar: File[]) => void;
  onCikar: (sira: number) => void;
};

/**
 * Çok sayfalı çözüm seçimi (0054) — YALNIZ öğretmen sınırı 1'in üstüne
 * çıkardığında çiziliyor. Sınırı 1 olan ödevde `OdevTeslim` bugünkü tek
 * alanını gösteriyor; bu bileşen hiç devreye girmiyor.
 *
 * SIRA = SAYFA NUMARASI. Öğretmen sayfaları öğrencinin eklediği sırayla
 * görüyor; ortadan çıkarılan sayfa numara deliği bırakmıyor (sunucu da
 * ek sayfaları boşluksuz istiyor). Yeniden sıralama bilerek yok: çıkarıp
 * sona eklemek aynı işi görüyor ve telefonda sürükle-bırak hataya açık.
 *
 * `capture` YOK — tek alanlı yoldaki gerekçeyle aynı: iOS'ta galeriyi
 * seçenek olmaktan çıkarıyor. `multiple` ile öğrenci hem çoktan çekmiş
 * olduğu fotoğrafları birden seçebiliyor hem de kamerayla tek tek
 * ekleyebiliyor; her seçim listeye EKLENİYOR, üzerine yazmıyor.
 */
export function SayfaSahnesi({ sayfalar, sinir, isliyor, hata, onEkle, onCikar }: Props) {
  const dolu = sayfalar.length >= sinir;

  return (
    <div className="mb-4">
      {sayfalar.length > 0 && (
        <ol className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Seçilen sayfalar">
          {sayfalar.map((s, i) => (
            <li
              key={s.id}
              className="overflow-hidden rounded-sk-sm border border-line bg-line-soft"
            >
              <Onizleme dosya={s.dosya} alt={`${i + 1}. sayfa`} />
              <div className="flex items-center justify-between gap-1 pl-2">
                <span className="text-[13px] font-semibold text-ink">
                  <span className="sk-sayi">{i + 1}</span>. sayfa
                </span>
                <button
                  type="button"
                  onClick={() => onCikar(i)}
                  aria-label={`${i + 1}. sayfayı çıkar`}
                  className="min-h-[44px] px-3 text-[13px] font-semibold text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  Çıkar
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Sayaç CANLI BÖLGE: ekran okuyucu eklenen/çıkarılan sayfayı duysun. */}
      <p className="mb-2" aria-live="polite">
        <Tag tur={sayfalar.length === 0 ? 'bilgi' : 'basari'}>
          <span className="sk-sayi">{sayfaSayacMetni(sayfalar.length, sinir)}</span>
        </Tag>
      </p>

      {dolu ? (
        <p className="text-[13px] text-muted">
          Sınıra ulaştın. Başka bir sayfa eklemek için önce birini çıkar.
        </p>
      ) : (
        <Field
          etiket={sayfalar.length === 0 ? 'Çözüm sayfaları' : 'Sayfa ekle'}
          ipucu={`Zorunlu, en az bir sayfa. Fotoğraf ya da PDF ekleyebilirsin; PDF'in her sayfası ayrı sayfa olur. Bu ödevde en fazla ${sinir} sayfa gönderebilirsin — sırayla ekle, öğretmenin bu sırayla görecek.`}
          zorunlu={sayfalar.length === 0}
          {...(hata ? { hata } : {})}
        >
          {(k) => (
            <Input
              {...k}
              type="file"
              accept="image/*,application/pdf,.pdf"
              multiple
              disabled={isliyor}
              onChange={(e) => {
                const secilen = Array.from(e.target.files ?? []);
                // Aynı dosya yeniden seçilebilsin diye alan boşaltılıyor;
                // yoksa tarayıcı aynı seçimde `change` üretmiyor.
                e.target.value = '';
                if (secilen.length > 0) onEkle(secilen);
              }}
            />
          )}
        </Field>
      )}
      {dolu && hata && (
        <p role="alert" className="mt-1 text-[12px] font-semibold text-danger">
          {hata}
        </p>
      )}
      {isliyor && <p className="mt-1 text-[13px] text-muted">Görseller hazırlanıyor…</p>}
    </div>
  );
}

/**
 * Küçük önizleme. Geçici adres bileşen yaşadığı sürece duruyor ve
 * kaldırılınca bırakılıyor — sekiz büyük fotoğrafın belleği sızmasın.
 */
function Onizleme({ dosya, alt }: { dosya: File; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(dosya);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [dosya]);
  return url ? (
    <img src={url} alt={alt} className="block h-28 w-full object-cover" />
  ) : (
    <div className="h-28 w-full" aria-hidden="true" />
  );
}
