import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Tag } from '@/components/ui/Tag';
import {
  araligaAta,
  araligiDenetle,
  konuOzeti,
  konusuzSorular,
  soruyaAta,
  type Konular,
} from '@/lib/konu-atama';

type Props = {
  soruSayisi: number;
  konular: Konular;
  /** `konu_onerileri` — öğretmenin daha önce kullandığı adlar. */
  oneriler: string[];
  onDegis: (konular: Konular) => void;
};

/**
 * Soru → konu eşlemesi.
 *
 * ÖĞRETMENİN İSTEĞİ İKİSİYDİ ("ikisi de olsun"): aralıkla toplu giriş VE
 * tek sorunun konusunu ayrıca değiştirebilme. Aralık pratik olan; 30 soruluk
 * bir testte konuyu soru soru yazmak kimsenin yapmayacağı bir iştir. Tek
 * soru düzeltmesi ise gerçeğe uyum: konu blokları her zaman düzgün
 * sıralanmaz, 7. soru araya sıkışmış başka bir konudan olabilir.
 *
 * KONU ZORUNLU DEĞİL. Konusu girilmemiş ödev bugünkü gibi çalışır, yalnız
 * analiz çıkmaz. Öğretmeni her ödevde konu girmeye mecbur etmek, konu
 * özelliğini ödev vermenin önünde bir engele çevirirdi.
 *
 * Öneri listesi otomatik tamamlama İÇİN, kısıt için değil: `datalist`
 * yazmayı engellemez, yalnız kolaylaştırır. Amaç aynı konunun "Türev" ve
 * "türev" diye ikiye bölünmesini azaltmak.
 */
export function KonuAtama({ soruSayisi, konular, oneriler, onDegis }: Props) {
  const listeId = useId();
  const [ilk, setIlk] = useState('1');
  const [son, setSon] = useState(String(soruSayisi));
  const [konu, setKonu] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [acik, setAcik] = useState(false);

  const eksikler = konusuzSorular(konular, soruSayisi);
  const ozet = konuOzeti(konular, soruSayisi);

  function ata() {
    const a = Number(ilk);
    const b = Number(son);
    const sorun = araligiDenetle(a, b, konu, soruSayisi);
    if (sorun) return setHata(sorun);
    setHata(null);
    onDegis(araligaAta(konular, a, b, konu, soruSayisi));
    // Konu adı KALIYOR, aralık ilerliyor: öğretmen çoğunlukla aynı konudan
    // sonraki bloğa değil, yeni bir konuya geçer — ama numarayı yeniden
    // yazmak zorunda kalmasın diye bir sonraki soru hazır geliyor.
    setIlk(String(Math.min(b + 1, soruSayisi)));
    setSon(String(soruSayisi));
    setKonu('');
  }

  return (
    <section aria-labelledby={`${listeId}-baslik`}>
      <h3 id={`${listeId}-baslik`} className="mb-1 text-[15px] font-bold text-ink">
        Soruların konuları
      </h3>
      <p className="mb-3 text-[13px] text-muted">
        İsteğe bağlı. Girerseniz öğrenci puanının yanında hangi konuya çalışması gerektiğini
        görür; siz de sınıfın en çok nerede takıldığını görürsünüz.
      </p>

      <datalist id={listeId}>
        {oneriler.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>

      {/* Aralıkla giriş */}
      <div className="mb-3 rounded-sk-sm border border-line bg-line-soft p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label
              htmlFor={`${listeId}-ilk`}
              className="mb-1 block text-[12px] font-bold text-muted"
            >
              İlk soru
            </label>
            <Input
              id={`${listeId}-ilk`}
              type="number"
              inputMode="numeric"
              min={1}
              max={soruSayisi}
              value={ilk}
              onChange={(e) => setIlk(e.target.value)}
              className="w-20"
            />
          </div>
          <span className="pb-3 text-[15px] text-muted" aria-hidden="true">
            –
          </span>
          <div>
            <label
              htmlFor={`${listeId}-son`}
              className="mb-1 block text-[12px] font-bold text-muted"
            >
              Son soru
            </label>
            <Input
              id={`${listeId}-son`}
              type="number"
              inputMode="numeric"
              min={1}
              max={soruSayisi}
              value={son}
              onChange={(e) => setSon(e.target.value)}
              className="w-20"
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <label
              htmlFor={`${listeId}-konu`}
              className="mb-1 block text-[12px] font-bold text-muted"
            >
              Konu
            </label>
            <Input
              id={`${listeId}-konu`}
              list={listeId}
              value={konu}
              placeholder="Örn. Türev"
              onChange={(e) => setKonu(e.target.value)}
              onKeyDown={(e) => {
                // Enter formu göndermesin; bu bir alt işlem.
                if (e.key === 'Enter') {
                  e.preventDefault();
                  ata();
                }
              }}
            />
          </div>
          <Button tur="ikincil" onClick={ata}>
            Ata
          </Button>
        </div>
        {hata && (
          <p role="alert" className="mt-2 text-[12px] font-semibold text-danger">
            {hata}
          </p>
        )}
      </div>

      {/* Ne atandı — öğretmen kaydetmeden önce görsün */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {ozet.length === 0 ? (
          <span className="text-[13px] text-muted">Henüz konu girilmedi.</span>
        ) : (
          ozet.map((o) => (
            // TEK METİN DÜĞÜMÜ. `Tag` `inline-flex` olduğu için ayrı
            // elemanlar arasındaki boşluk çöküyor ve "Türev ·1–3" diye
            // okunuyordu. Aynı hata daha önce "200eksik" ve "92puan"da
            // yaşandı; ölçüm ekran görüntüsünden geldi.
            <Tag key={o.konu} tur="bilgi">
              <span className="sk-sayi">{`${o.konu} · ${araliklariYaz(o.sorular)}`}</span>
            </Tag>
          ))
        )}
        {ozet.length > 0 && eksikler.length > 0 && (
          <Tag tur="uyari">
            <span className="sk-sayi">{`${eksikler.length} soru konusuz`}</span>
          </Tag>
        )}
      </div>

      {/* Tek soru düzeltmesi — uzun listede kapalı başlıyor */}
      <Button tur="sade" olcu="sm" onClick={() => setAcik((a) => !a)} aria-expanded={acik}>
        {acik ? 'Soru listesini gizle' : 'Tek tek düzenle'}
      </Button>

      {acik && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: soruSayisi }, (_, i) => i + 1).map((no) => (
            <li key={no} className="flex items-center gap-2">
              <label
                htmlFor={`${listeId}-s${no}`}
                className="sk-sayi w-8 shrink-0 text-right text-[13px] font-bold text-muted"
              >
                {no}
              </label>
              <Input
                id={`${listeId}-s${no}`}
                list={listeId}
                value={konular[no] ?? ''}
                placeholder="konu yok"
                onChange={(e) => onDegis(soruyaAta(konular, no, e.target.value))}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** [1,2,3,7] → "1–3, 7". Otuz numarayı alt alta yazmak yerine. */
function araliklariYaz(sorular: number[]): string {
  const parcalar: string[] = [];
  let bas = sorular[0];
  let onceki = sorular[0];
  if (bas === undefined || onceki === undefined) return '';
  for (const n of sorular.slice(1)) {
    if (n === onceki + 1) {
      onceki = n;
      continue;
    }
    parcalar.push(bas === onceki ? String(bas) : `${bas}–${onceki}`);
    bas = n;
    onceki = n;
  }
  parcalar.push(bas === onceki ? String(bas) : `${bas}–${onceki}`);
  return parcalar.join(', ');
}
