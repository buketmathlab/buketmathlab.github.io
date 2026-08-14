import { Button } from '@/components/ui/Button';
import { ozetBos, type PdfOzeti } from '@/lib/odev-pdf-ozeti';
import type { Sinif } from '@/types/api';

type Props = {
  ozet: PdfOzeti;
  /** Öğretmenin şu an girdiği soru sayısı — üzerine YAZILMAZ, karşılaştırılır. */
  mevcutSoruSayisi: number;
  mevcutSinifId: string;
  siniflar: readonly Sinif[];
  onSoruSayisi: (n: number) => void;
  onKonu: (konu: string) => void;
  onSinif: (sinifId: string) => void;
};

/**
 * Ödev PDF'inden okunanlar.
 *
 * ÇIKARIM BİR ÖNERİDİR (Part XXVIII). Hiçbir alan kendiliğinden dolmuyor;
 * bu kutu ne bulunduğunu söylüyor, uygulayan öğretmenin kendisi. Cevap
 * anahtarı ızgarasında uygulanan kuralın aynısı — orada da PDF'ten okunan
 * anahtar öğretmen onaylamadan yayına gitmiyor.
 *
 * Otomatik doldurmanın neden yanlış olacağı somut: soru sayısı 1. adımda
 * giriliyor, PDF 2. adımda seçiliyor. Sessizce üzerine yazsaydık öğretmenin
 * bilerek girdiği sayı, tanımadığımız bir şablondan okunmuş bir sayıyla
 * değişirdi ve haberi olmazdı. Üstelik soru sayısı cevap anahtarını
 * kırpıyor (`odev_guncelle`), yani sessiz bir hata veri kaybı demek.
 *
 * HİÇBİR SİNYAL YOKSA KUTU HİÇ ÇIKMAZ. Taranmış PDF, farklı şablon, bozuk
 * dosya — hepsinde ekran bugünkü gibi çalışır (Part VIII: yedek davranış).
 */
export function PdfOnerileri({
  ozet,
  mevcutSoruSayisi,
  mevcutSinifId,
  siniflar,
  onSoruSayisi,
  onKonu,
  onSinif,
}: Props) {
  if (ozetBos(ozet)) return null;

  const eslesenSinif = ozet.sinif ? siniflar.find((s) => s.ad === ozet.sinif) : undefined;
  const sinifFarkli = eslesenSinif !== undefined && eslesenSinif.id !== mevcutSinifId;
  const sayiFarkli = ozet.soruSayisi !== null && ozet.soruSayisi !== mevcutSoruSayisi;
  const celiski = ozet.soruSayisiKaynak === 'celiskili';

  return (
    <div className="mb-4 rounded-sk-sm border border-line bg-line-soft p-3">
      <p className="mb-1 text-[14px] font-bold text-ink">PDF’ten okunanlar</p>
      <p className="mb-3 text-[12px] text-muted">
        Bunlar birer öneri. Basmadığınız hiçbir şey değişmez.
      </p>

      <ul className="space-y-2">
        {/* SORU SAYISI — iki sinyal birbirini denetliyor */}
        {ozet.soruSayisi !== null && (
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[14px] text-ink">
              Soru sayısı: <span className="sk-sayi font-semibold">{ozet.soruSayisi}</span>
              {!sayiFarkli && <span className="text-muted"> — girdiğinizle aynı</span>}
            </span>
            {sayiFarkli && (
              <Button
                tur="sade"
                olcu="sm"
                onClick={() => {
                  if (ozet.soruSayisi !== null) onSoruSayisi(ozet.soruSayisi);
                }}
              >
                {`Soru sayısını ${ozet.soruSayisi} yap`}
              </Button>
            )}
          </li>
        )}

        {/* ÇELİŞKİ — sessizce birini seçmiyoruz */}
        {celiski && (
          <li className="rounded-sk-sm bg-warning-bg p-2">
            <p className="mb-2 text-[13px] text-warning">
              PDF’te iki farklı soru sayısı görüldü: puan tablosu{' '}
              <strong className="sk-sayi">{ozet.puanTablosu}</strong>, soru başlıkları{' '}
              <strong className="sk-sayi">{ozet.soruBasliklari}</strong>. Hangisinin doğru
              olduğuna siz karar verin.
            </p>
            <div className="flex flex-wrap gap-2">
              {ozet.puanTablosu !== null && (
                <Button
                  tur="sade"
                  olcu="sm"
                  onClick={() => {
                    if (ozet.puanTablosu !== null) onSoruSayisi(ozet.puanTablosu);
                  }}
                >
                  {`${ozet.puanTablosu} yap`}
                </Button>
              )}
              {ozet.soruBasliklari !== null && (
                <Button
                  tur="sade"
                  olcu="sm"
                  onClick={() => {
                    if (ozet.soruBasliklari !== null) onSoruSayisi(ozet.soruBasliklari);
                  }}
                >
                  {`${ozet.soruBasliklari} yap`}
                </Button>
              )}
            </div>
          </li>
        )}

        {/* KONU — ödevin genel konusu. Soru başına konu PDF'te YOK:
            sorular görsel, metin katmanında soru metni bulunmuyor. Bu yüzden
            tek bir aday öneriliyor, öğretmen aralıkla bölüyor. */}
        {ozet.konu && (
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[14px] text-ink">
              Konu: <span className="font-semibold">{ozet.konu}</span>
            </span>
            <Button
              tur="sade"
              olcu="sm"
              onClick={() => {
                if (ozet.konu) onKonu(ozet.konu);
              }}
            >
              Konu olarak kullan
            </Button>
          </li>
        )}

        {/* SINIF — yalnız öğretmenin listesinde GERÇEKTEN varsa ve
            seçilenden farklıysa. PDF'te yazan bir ad, olmayan bir sınıfı
            önermek için yeterli değil. */}
        {eslesenSinif && (
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[14px] text-ink">
              Sınıf: <span className="font-semibold">{eslesenSinif.ad}</span>
              {!sinifFarkli && <span className="text-muted"> — seçtiğinizle aynı</span>}
            </span>
            {sinifFarkli && (
              <Button tur="sade" olcu="sm" onClick={() => onSinif(eslesenSinif.id)}>
                {`${eslesenSinif.ad} seç`}
              </Button>
            )}
          </li>
        )}
      </ul>
    </div>
  );
}
