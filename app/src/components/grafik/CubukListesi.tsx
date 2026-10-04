import { degerYazisi } from '@/lib/grafik';

export type Cubuk = {
  anahtar: string;
  etiket: string;
  /** 0–100; boşsa çubuk çizilmez, "—" yazılır (sıfır değil). */
  deger: number | null;
  /** Çubuğun altında küçük açıklama: "%84 gönderim · 28 öğrenci". */
  ek?: string;
};

/**
 * YATAY ÇUBUK LİSTESİ — sınıf karşılaştırması, eksik konular (0061).
 *
 * Değer her satırda METİN olarak yazılı; çubuk onun görsel karşılığı ve
 * `aria-hidden`. Tek seri, tek renk: renk kimlik değil, büyüklük taşıyor
 * ve puana göre DEĞİŞMİYOR (düşük sınıf kırmızıya boyanmıyor).
 */
export function CubukListesi({
  satirlar,
  birim,
  etiketGenisligi = 'w-14',
}: {
  satirlar: Cubuk[];
  birim: '' | '%';
  etiketGenisligi?: string;
}) {
  return (
    <ul className="space-y-2.5">
      {satirlar.map((s) => (
        <li key={s.anahtar} className="min-w-0">
          <div className="flex items-center gap-3">
            <span className={`${etiketGenisligi} shrink-0 truncate text-[14px] font-semibold text-ink`}>
              {s.etiket}
            </span>
            <div aria-hidden="true" className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-line-soft">
              {s.deger !== null && (
                <div
                  className="h-full rounded-full bg-[#2a78d6]"
                  style={{ width: `max(2px, ${Math.max(0, Math.min(100, s.deger))}%)` }}
                />
              )}
            </div>
            <span className="sk-sayi w-12 shrink-0 text-right text-[14px] font-semibold text-ink">
              {degerYazisi(s.deger, birim)}
            </span>
          </div>
          {s.ek && <p className={`mt-0.5 text-[12px] text-muted`}>{s.ek}</p>}
        </li>
      ))}
    </ul>
  );
}
