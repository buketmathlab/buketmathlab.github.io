import type { GelisimSatiri } from '@/types/api';

const TARIH = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });
const SAYI = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });

type Props = {
  satirlar: GelisimSatiri[];
  /** Sınıfta "gönderen sayısı", öğrencide "gönderdi / göndermedi". */
  kapsam: 'sinif' | 'ogrenci';
};

/**
 * Ödev ödev puan gelişimi.
 *
 * GRAFİK KÜTÜPHANESİ YOK. Gereken şey yatay bir çubuk; bunun için pakete
 * yüzlerce kilobayt eklemek Part XVIII'e aykırı olurdu.
 *
 * HİÇBİR EĞİLİM İDDİASI TAŞIMIYOR. Ne ok, ne "yükseliyor", ne "düşüyor".
 * Üç ödevden yön çıkarmak ölçemeyeceğim bir iddia olurdu ve o iddia
 * yanlışsa öğretmen bir çocuk hakkında yanlış bir cümle kurar. Ekran
 * sayıları gösteriyor, yorumu öğretmen yapıyor.
 *
 * ÇUBUKLAR SÜSTÜR, VERİ DEĞİL. `aria-hidden`; her satırın puanı ve gönderim
 * durumu METİN olarak da yazıyor. Ekran okuyucu kullanan biri "3. ödev, 72"
 * bilgisini çubuğu göremeden alabilmeli.
 *
 * RENK PUANA GÖRE DEĞİŞMİYOR. Düşük puanı kırmızıya boyamak, dönem boyunca
 * aynı çocuğu damgalayan bir ekran üretirdi — `SinifDetay`'daki aynı gerekçe.
 */
export function Gelisim({ satirlar, kapsam }: Props) {
  if (satirlar.length === 0) return null;

  return (
    <ol className="space-y-3">
      {satirlar.map((s, i) => {
        const deger = s.deger;
        const gonderildi = deger !== null;
        // Puan 0–100; genişlik doğrudan o oran. 0 puan alan bir gönderim de
        // görünsün diye taban 2 px.
        const oran = deger === null ? 0 : Math.max(0, Math.min(100, deger));

        return (
          <li key={`${s.tarih}-${s.odev}-${i}`}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[14px] font-semibold text-ink">
                {s.odev}
              </span>
              <span className="shrink-0 text-[14px]">
                {deger !== null ? (
                  <span className="sk-sayi font-display font-semibold text-ink">
                    {SAYI.format(deger)}
                  </span>
                ) : (
                  <span className="text-[13px] text-muted">Gönderilmedi</span>
                )}
              </span>
            </div>

            <div
              aria-hidden="true"
              className="mt-1 h-2 w-full overflow-hidden rounded-full bg-line"
            >
              {gonderildi && (
                <div
                  className="h-full rounded-full bg-ink"
                  style={{ width: `max(2px, ${oran}%)` }}
                />
              )}
            </div>

            <p className="mt-1 text-[12px] text-muted">
              {TARIH.format(new Date(s.tarih))}
              {s.tur === 'acik' && ' · açık uçlu'}
              {kapsam === 'sinif' && (
                <>
                  {' · '}
                  <span className="sk-sayi">{s.gonderen}</span>
                  {'/'}
                  <span className="sk-sayi">{s.mevcut}</span>
                  {' gönderdi'}
                </>
              )}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
