import type { KonuAnalizi } from '@/types/api';

type Props = {
  analiz: KonuAnalizi[];
  /** Öğrenci ekranında "sen", veli ve öğretmen ekranında üçüncü tekil. */
  ses: 'ogrenci' | 'ucuncu';
};

/**
 * Konu analizi listesi — öğrenci, veli ve öğretmen ekranlarında aynı.
 *
 * SIRALAMA SUNUCUDAN GELİYOR ve burada bozulmuyor: en çok eksik olan konu
 * ilk sırada. Yeniden sıralasaydık "en zayıf konu" iddiası ekrandan ekrana
 * değişebilirdi.
 *
 * TAM YAPILAN KONU DA GÖSTERİLİYOR, ama sönük. Yalnız eksikleri listelemek
 * kötü giden bir ödevde ekranı bir eksik listesine çevirir; iyi giden konuyu
 * görmek öğrencinin nereye tutunacağını söyler.
 */
export function KonuListesi({ analiz, ses }: Props) {
  if (analiz.length === 0) return null;

  const eksikOlanlar = analiz.filter((k) => k.dogru < k.toplam);

  return (
    <div>
      <h3 className="mb-1 text-[15px] font-bold text-ink">
        {eksikOlanlar.length === 0
          ? 'Konular'
          : ses === 'ogrenci'
            ? 'Çalışılacak konular'
            : 'Eksik olunan konular'}
      </h3>
      <p className="mb-3 text-[13px] text-muted">
        {eksikOlanlar.length === 0
          ? ses === 'ogrenci'
            ? 'Bu ödevdeki bütün konuları tam yapmışsın.'
            : 'Bu ödevdeki bütün konular tam yapılmış.'
          : ses === 'ogrenci'
            ? 'En çok eksiğin olan konu en üstte.'
            : 'En çok eksik olan konu en üstte.'}
      </p>

      <ul className="space-y-2">
        {analiz.map((k) => {
          const eksik = k.toplam - k.dogru;
          return (
            <li
              key={k.konu}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-sk-sm border border-line px-3 py-2"
            >
              <span
                className={eksik > 0 ? 'text-[15px] font-semibold text-ink' : 'text-[15px] text-muted'}
              >
                {k.konu}
              </span>
              <span className="text-[13px] text-muted">
                <span className="sk-sayi font-semibold text-ink">{k.dogru}</span>
                {' / '}
                <span className="sk-sayi">{k.toplam}</span>
                {' doğru'}
                {k.bos > 0 && (
                  <>
                    {' · '}
                    <span className="sk-sayi">{k.bos}</span>
                    {' boş'}
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Yanlış ve boş SORU NUMARALARI.
 *
 * Öğretmenin isteği: "hangi soru/soruları yanlış yaptığını görsün. Veli de
 * görebilsin." Bileşen yalnız numara alıyor — şıkkı hiç almıyor, alamıyor.
 * Veli ekranında bu bir tercih değil sınır (Kural 6).
 */
export function SoruNumaralari({
  yanlis,
  bos,
}: {
  yanlis: number[];
  bos: number[];
}) {
  if (yanlis.length === 0 && bos.length === 0) return null;
  return (
    <p className="text-[13px] text-ink">
      {yanlis.length > 0 && (
        <>
          <span className="font-semibold">Yanlış: </span>
          <span className="sk-sayi">{yanlis.join(', ')}</span>
        </>
      )}
      {yanlis.length > 0 && bos.length > 0 && <span className="text-muted"> · </span>}
      {bos.length > 0 && (
        <>
          <span className="font-semibold">Boş: </span>
          <span className="sk-sayi">{bos.join(', ')}</span>
        </>
      )}
      <span className="text-muted"> (soru no)</span>
    </p>
  );
}
