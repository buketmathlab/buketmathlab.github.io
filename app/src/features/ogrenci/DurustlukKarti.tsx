import { Card } from '@/components/ui/Card';
import { EwaluFigure } from '@/components/brand/EwaluFigure';
import { BASLIK, ILKELER, PARAGRAFLAR } from '@/lib/durustluk-metni';

/**
 * Dürüstlük kartı ("Yapay değil, kendi zekâm") — öğrenci panosunda SABİT.
 *
 * KAPATMA DÜĞMESİ YOK (öğretmenin isteği: "sabit kalacağı bir yazı").
 * Duyuru gibi okunup geçilen bir haber değil; her açılışta aynı yerde
 * duran bir ilke. Metin ve dil kuralları `lib/durustluk-metni.ts`'te.
 *
 * YERİ: panonun günlük işlerinden (yaklaşan ödev, son puan) SONRA. Her gün
 * açılan ekranın ilk satırını kaplasaydı öğrenci ödevine ulaşmak için onu
 * her gün kaydırır ve bir süre sonra görmez olurdu; listenin sonunda,
 * sakin bir kart olarak duruyor.
 */
export function DurustlukKarti() {
  return (
    <Card>
      <section aria-labelledby="durustluk-baslik">
        {/* Ewalu SEKİZGENDE, başlığın solunda (öğretmenin isteği: okul
            önündeki görsel, bayrak görünsün, Ewalu boydan). 96 px: boydan figür
            daha küçükte seçilmiyor. Panonun
            "Merhaba" satırıyla aynı düzen. Dekoratif: anlamı başlık taşıyor. */}
        <div className="flex items-center gap-3">
          <EwaluFigure poz="okul" boyut={96} dekoratif className="shrink-0" />
          <h2 id="durustluk-baslik" className="font-display text-[18px] font-semibold text-ink">
            {BASLIK}
          </h2>
        </div>
        <div className="mt-2 space-y-2 text-[14px] leading-relaxed text-ink">
          {PARAGRAFLAR.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </div>
        <ul className="mt-3 space-y-1.5 border-l-2 border-line pl-3 text-[14px] text-ink">
          {ILKELER.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </section>
    </Card>
  );
}
