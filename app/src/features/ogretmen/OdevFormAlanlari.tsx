import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { SikSayisiSecimi } from './SikSayisiSecimi';
import type { SonSecenek } from '@/lib/cevap-anahtari';
import { CALISMA_ACIKLAMASI, TUR_IPUCU, calismaMi, turAdi } from '@/lib/odev-turu';
import type { OdevTuru, Sinif } from '@/types/api';

export type OdevFormDegerleri = {
  baslik: string;
  aciklama: string;
  sinifId: string;
  sonTarih: string;
  soruSayisi: string;
  sonSecenek: SonSecenek;
};

type Props = {
  degerler: OdevFormDegerleri;
  onDegis: <A extends keyof OdevFormDegerleri>(alan: A, deger: OdevFormDegerleri[A]) => void;
  siniflar: readonly Sinif[];
  /** Test ödevinde soru sayısı ve şık sayısı görünür; açık uçluda anlamsız. */
  testMi: boolean;
  /** Düzenlemede tür kilitli — değiştirilirse mevcut gönderimlerin anlamı bozulur. */
  turDegistirilebilir: boolean;
  tur: OdevTuru;
  onTurDegis?: (t: OdevTuru) => void;
};

/**
 * Ödev bilgisi alanları — oluşturma ve düzenleme ekranlarının ortak parçası.
 *
 * Neden ayrı bileşen: iki ekranda kopyalanırsa zamanla ayrışır. Bir alanın
 * doğrulaması birinde düzeltilip diğerinde unutulur; bu tür sapmalar sonra
 * "bir ekranda çalışıyor, diğerinde çalışmıyor" hatası olarak geri döner.
 */
export function OdevFormAlanlari({
  degerler,
  onDegis,
  siniflar,
  testMi,
  turDegistirilebilir,
  tur,
  onTurDegis,
}: Props) {
  return (
    <>
      <Field etiket="Başlık" zorunlu>
        {(k) => (
          <Input
            {...k}
            value={degerler.baslik}
            onChange={(e) => onDegis('baslik', e.target.value)}
            placeholder="Örn. Üslü ve Köklü Sayılar"
          />
        )}
      </Field>

      <Field etiket="Açıklama" ipucu="İsteğe bağlı. Öğrenciye not düşmek isterseniz.">
        {(k) => (
          <Textarea
            {...k}
            rows={2}
            value={degerler.aciklama}
            onChange={(e) => onDegis('aciklama', e.target.value)}
          />
        )}
      </Field>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Field etiket="Sınıf" zorunlu>
            {(k) => (
              <Select
                {...k}
                value={degerler.sinifId}
                onChange={(e) => onDegis('sinifId', e.target.value)}
              >
                <option value="">Seçin…</option>
                {siniflar.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.ad}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <div className="flex-1">
          <Field etiket="Son tarih" zorunlu>
            {(k) => (
              <Input
                {...k}
                type="date"
                value={degerler.sonTarih}
                onChange={(e) => onDegis('sonTarih', e.target.value)}
              />
            )}
          </Field>
        </div>
      </div>

      {turDegistirilebilir ? (
        <Field etiket="Tür" ipucu={TUR_IPUCU}>
          {(k) => (
            <Select {...k} value={tur} onChange={(e) => onTurDegis?.(e.target.value as OdevTuru)}>
              <option value="test">Test (çoktan seçmeli)</option>
              <option value="acik">Açık uçlu</option>
              <option value="calisma">Çalışma kağıdı (puanlanmaz)</option>
            </Select>
          )}
        </Field>
      ) : (
        <p className="mb-4 text-[13px] text-muted">
          Tür: <strong className="text-ink">{turAdi(tur)}</strong> — oluşturulduktan sonra
          değiştirilemez, mevcut gönderimlerin anlamı bozulurdu.
        </p>
      )}

      {/* 0086: ÇALIŞMA KAĞIDININ KURALI SEÇİLİR SEÇİLMEZ YAZILI.
          Öğretmen "puanlanmaz"ı ödevi kaydettikten sonra değil, türü
          seçtiği anda görmeli; yoksa puan bekleyip bulamaz. */}
      {calismaMi(tur) && (
        <p data-test="calisma-aciklamasi" className="mb-4 text-[13px] text-ink">
          {CALISMA_ACIKLAMASI}
        </p>
      )}

      {testMi && (
        <>
          <Field etiket="Soru sayısı" zorunlu>
            {(k) => (
              <Input
                {...k}
                type="number"
                inputMode="numeric"
                min={1}
                max={200}
                value={degerler.soruSayisi}
                onChange={(e) => onDegis('soruSayisi', e.target.value)}
              />
            )}
          </Field>
          <SikSayisiSecimi
            deger={degerler.sonSecenek}
            onDegis={(v) => onDegis('sonSecenek', v)}
          />
        </>
      )}
    </>
  );
}
