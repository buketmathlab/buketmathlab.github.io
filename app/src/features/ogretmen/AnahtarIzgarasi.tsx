import { useState } from 'react';
import { Tag } from '@/components/ui/Tag';
import { Button } from '@/components/ui/Button';
import { SikSatiri, SIKLAR } from '@/components/ui/SikSatiri';
import type { Cikarim, SonSecenek } from '@/lib/cevap-anahtari';

type Props = {
  soruSayisi: number;
  sonSecenek: SonSecenek;
  anahtar: Record<number, string>;
  /** Çıkarım raporu. Elle giriliyorsa verilmez. */
  cikarim?: Cikarim | undefined;
  onDegis: (no: number, sik: string | null) => void;
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
export function AnahtarIzgarasi({ soruSayisi, sonSecenek, anahtar, cikarim, onDegis }: Props) {
  const siklar = SIKLAR[sonSecenek];
  const eksikler = Array.from({ length: soruSayisi }, (_, i) => i + 1).filter((n) => !anahtar[n]);
  const celiskili = new Set(cikarim?.celiskili ?? []);

  /**
   * Izgara ne zaman kapalı başlar.
   *
   * Ölçüm: 200 soruda ızgara 360 px'de 11.463 px yüksekliğinde — 11 ekran
   * kaydırma. Öğretmen cevapları elle GİRMİYOR, PDF'ten geliyor; her şey
   * bulunduysa 200 satırı gözden geçirmeye zorlamak boş yük.
   *
   * Dikkat gerektiren bir durum varsa (eksik ya da çelişki) ızgara AÇIK
   * başlar — orada gerçekten bakması gerekiyor. Uzun listelerde bile.
   */
  const dikkatGerek = eksikler.length > 0 || celiskili.size > 0;
  const [acik, setAcik] = useState(dikkatGerek || soruSayisi <= 30);

  return (
    <div>
      {/* Durum özeti — öğretmen "kaç tanesi tamam" sorusunu tek bakışta görsün.
          Sayı ve sözcük TEK metin düğümünde: Tag `inline-flex` olduğu için
          ayrı elemanlar arasındaki boşluk çöküyor ve "200eksik" gibi
          okunuyordu. Aynı hata daha önce "92puan"da yaşandı. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Tag tur={eksikler.length === 0 ? 'basari' : 'uyari'}>
          <span className="sk-sayi">{`${soruSayisi - eksikler.length}/${soruSayisi} cevap girildi`}</span>
        </Tag>
        {eksikler.length > 0 && (
          <Tag tur="uyari">
            <span className="sk-sayi">{`${eksikler.length} eksik`}</span>
          </Tag>
        )}
        {celiskili.size > 0 && (
          <Tag tur="tehlike">
            <span className="sk-sayi">{`${celiskili.size} soruda çelişki`}</span>
          </Tag>
        )}
      </div>

      {/* Çıkarım zayıfsa açıkça söyle — sessizce güvenilir gibi gösterme. */}
      {cikarim?.yontem === 'harf-dizisi' && (
        <p className="mb-3 rounded-sk-sm bg-warning-bg p-3 text-[13px] text-warning">
          <strong>Dikkat:</strong> PDF'te soru numarası bulunamadı. Harfler sırayla eşlendi. Bu
          yöntem yanılabilir — lütfen cevapları tek tek doğrulayın.
        </p>
      )}
      {cikarim?.yontem === 'bulunamadi' && (
        <p className="mb-3 rounded-sk-sm bg-warning-bg p-3 text-[13px] text-warning">
          PDF'ten cevap çıkarılamadı. Cevapları aşağıdan elle girebilirsiniz.
        </p>
      )}
      {celiskili.size > 0 && (
        <p className="mb-3 rounded-sk-sm bg-danger-bg p-3 text-[13px] text-danger">
          <strong>{[...celiskili].join(', ')}</strong> numaralı sorularda PDF'te birden fazla farklı
          cevap görüldü. İlk bulunan yazıldı; bunları mutlaka kontrol edin.
        </p>
      )}

      {!acik && (
        <div className="rounded-sk-sm border border-line bg-line-soft p-4">
          <p className="mb-1 text-[14px] font-semibold text-ink">
            Cevapların tamamı PDF’ten okundu.
          </p>
          <p className="mb-3 text-[13px] text-muted">
            Kontrol etmek isterseniz açabilirsiniz; gerek görmüyorsanız doğrudan kaydedebilirsiniz.
          </p>
          <Button tur="sade" olcu="sm" onClick={() => setAcik(true)}>
            {`${soruSayisi} cevabı göster`}
          </Button>
        </div>
      )}

      {acik && (
        <>
          {soruSayisi > 30 && !dikkatGerek && (
            <div className="mb-3">
              <Button tur="sade" olcu="sm" onClick={() => setAcik(false)}>
                Listeyi gizle
              </Button>
            </div>
          )}

          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: soruSayisi }, (_, i) => i + 1).map((no) => (
              <SikSatiri
                key={no}
                no={no}
                siklar={siklar}
                secili={anahtar[no]}
                vurgu={!anahtar[no] ? 'uyari' : celiskili.has(no) ? 'tehlike' : 'yok'}
                onDegis={onDegis}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
