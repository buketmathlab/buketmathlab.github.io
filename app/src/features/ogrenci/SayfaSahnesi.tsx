import { useEffect, useState } from 'react';
import { Field, Input } from '@/components/ui/Field';
import { Tag } from '@/components/ui/Tag';
import { HER_SAYFA_GEREKCESI, sayfaIpucuMetni, sayfaSayacMetni } from '@/lib/cozum-sayfalari';

export type Sayfa = { id: string; dosya: File };

type Props = {
  sayfalar: readonly Sayfa[];
  sinir: number;
  /** Her sayfa zorunlu mu (0078): sayaç eksik sayfayı söyler. */
  zorunlu: boolean;
  /** Seçilen dosyalar sıkıştırılırken ekleme kapalı. */
  isliyor: boolean;
  hata: string | null;
  onEkle: (dosyalar: File[]) => void;
  onCikar: (sira: number) => void;
  /** Bir sayfayı YERİNDE değiştirir (0078): sıra bozulmasın. */
  onDegistir: (sira: number, dosya: File) => void;
};

/**
 * Çözüm sayfaları (0054). 0078'den beri TEK YOL: her ödev burada sayfa
 * sayfa yükleniyor (tek görsele birleştirme kalktı). Her sayfası zorunlu
 * ödevde sayaç eksik sayfayı söylüyor ve gerekçe bir kez yazıyor.
 *
 * SIRA = SAYFA NUMARASI. Öğretmen sayfaları öğrencinin eklediği sırayla
 * görüyor; ortadan çıkarılan sayfa numara deliği bırakmıyor (sunucu da
 * ek sayfaları boşluksuz istiyor). Sürükle-bırak bilerek yok (telefonda
 * hataya açık); bunun yerine her sayfanın "Değiştir"i var: yanlış çekilen
 * 3. sayfa yerinde yenilenir, sıra bozulmaz.
 *
 * `capture` YOK — tek alanlı yoldaki gerekçeyle aynı: iOS'ta galeriyi
 * seçenek olmaktan çıkarıyor. `multiple` ile öğrenci hem çoktan çekmiş
 * olduğu fotoğrafları birden seçebiliyor hem de kamerayla tek tek
 * ekleyebiliyor; her seçim listeye EKLENİYOR, üzerine yazmıyor.
 */
export function SayfaSahnesi({ sayfalar, sinir, zorunlu, isliyor, hata, onEkle, onCikar, onDegistir }: Props) {
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
                <label className="flex min-h-[44px] cursor-pointer items-center px-2 text-[13px] font-semibold text-link focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink">
                  Değiştir
                  <input
                    type="file"
                    accept="image/*,application/pdf,.pdf"
                    className="sr-only"
                    aria-label={`${i + 1}. sayfayı değiştir`}
                    disabled={isliyor}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) onDegistir(i, f);
                    }}
                  />
                </label>
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
        <Tag tur={sayfalar.length === 0 ? 'bilgi' : zorunlu && !dolu ? 'uyari' : 'basari'}>
          <span className="sk-sayi">{sayfaSayacMetni(sayfalar.length, sinir, zorunlu)}</span>
        </Tag>
      </p>
      {zorunlu && sayfalar.length === 0 && (
        <p className="mb-2 text-[13px] text-ink">{HER_SAYFA_GEREKCESI}</p>
      )}

      {dolu ? (
        <p className="text-[13px] text-muted">
          {zorunlu
            ? 'Bütün sayfalar eklendi. Bir sayfayı yenilemek istersen “Değiştir”e dokun.'
            : 'Sınıra ulaştın. Başka bir sayfa eklemek için önce birini çıkar.'}
        </p>
      ) : (
        <Field
          etiket={sayfalar.length === 0 ? 'Çözüm sayfaları' : `${sayfalar.length + 1}. sayfayı ekle`}
          ipucu={sayfaIpucuMetni(sinir, zorunlu)}
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
