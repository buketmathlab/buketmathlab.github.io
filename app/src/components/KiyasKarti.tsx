import { kiyasMetni, ortalamaYazisi, type KiyasTuru } from '@/lib/odev-kiyasi-metni';
import type { OdevKiyasi } from '@/types/api';

/**
 * Ödev kıyası kartı — öğrencinin ödev sonuç ekranında ve velinin ödev
 * satırında.
 *
 * ÜÇ SAYI YAN YANA, HÜKÜM YOK:
 *
 *     Puanın          80
 *     9A ortalaması   65
 *     9. sınıflar     61
 *
 * Öğretmenin isteği "ortalamanın üstünde mi altında mı görebilsin" idi.
 * Ekran bunu KARŞILAŞTIRILABİLİR SAYILAR koyarak veriyor; "üstündesin"
 * diye yazmıyor. Gerekçesi `lib/odev-kiyasi-metni.ts` başlığında:
 * cümle kurulunca ölçüm bir hükme dönüşür ve bir tur önce üründen
 * temizlediğimiz yargı dili geri gelir.
 *
 * NE ZAMAN HİÇ ÇİZİLMİYOR:
 *   - `sure_dolmadi` → öğretmenin kuralı, teslim süresi bitmeden yok
 *   - `kiyas_yok`    → özel ders öğrencisi (tek grup, her seviye karışık)
 *   - `seviye` null  → aynı ödev başka şubeye verilmemiş; SATIR yok,
 *                      boş bir satır ya da "—" olmayan bir kıyas varmış
 *                      gibi dururdu
 */
export function KiyasKarti({ kiyas, puan, tur }: {
  kiyas: OdevKiyasi | null | undefined;
  puan: number | null;
  tur: KiyasTuru;
}) {
  const m = kiyasMetni(tur);

  if (!kiyas || kiyas.durum !== 'hazir' || !kiyas.sinif) return null;

  const sinifOrt = ortalamaYazisi(kiyas.sinif.ortalama);
  // Sınıf ortalaması hesaplanamıyorsa (hiç puanlanmış teslim yok)
  // kıyasın tamamı anlamsız — kart çizilmiyor.
  if (sinifOrt === null) return null;

  const seviyeOrt = kiyas.seviye ? ortalamaYazisi(kiyas.seviye.ortalama) : null;

  return (
    <div className="mt-4 border-t border-line pt-4">
      <p className="text-[13px] font-bold uppercase tracking-wide text-muted">{m.baslik}</p>
      <dl className="mt-2 space-y-1">
        {puan !== null && (
          <Satir etiket={m.puanEtiketi} deger={String(puan)} kalin />
        )}
        <Satir
          etiket={`${kiyas.sinif.ad} ortalaması`}
          deger={sinifOrt}
          not={m.adetNotu(kiyas.sinif.adet)}
        />
        {kiyas.seviye && seviyeOrt !== null && (
          <Satir
            etiket={kiyas.seviye.ad}
            deger={seviyeOrt}
            not={m.adetNotu(kiyas.seviye.adet)}
          />
        )}
      </dl>
    </div>
  );
}

/**
 * Tek satır: solda etiket, sağda sayı.
 *
 * `dl/dt/dd` kullanılıyor çünkü bu gerçekten bir ad–değer listesi;
 * ekran okuyucu "9A ortalaması: 65" diye okuyor. Sayılar `sk-sayi`
 * sınıfıyla, ürünün geri kalanındaki rakamlarla aynı yüzde.
 */
function Satir({ etiket, deger, not, kalin = false }: {
  etiket: string;
  deger: string;
  not?: string;
  kalin?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={`text-[14px] ${kalin ? 'font-semibold text-ink' : 'text-muted'}`}>
        {etiket}
        {not && <span className="ml-1 text-[12px] text-muted">({not})</span>}
      </dt>
      <dd className={`sk-sayi text-[15px] ${kalin ? 'font-semibold text-ink' : 'text-ink'}`}>
        {deger}
      </dd>
    </div>
  );
}
