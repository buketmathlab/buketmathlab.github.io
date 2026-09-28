/**
 * PDF'teki işaretli şıkları okuma — yalnız tarayıcıda.
 *
 * Her sayfa bir canvas'a çiziliyor, pikseller `lib/isaretli-sik.ts`'e
 * veriliyor. Karar mantığının tamamı orada (birim testli); burası yalnız
 * çizim ve metin katmanı.
 *
 * PDF hiçbir yere gönderilmiyor: çizim de, harf tanıma da öğretmenin
 * cihazında. Yapay zekâ servisi yok.
 */

import {
  harfiTani,
  isaretlerdenAnahtar,
  pembeKutular,
  type IsaretCikarimi,
  type Numara,
  type SayfaBulgusu,
} from '@/lib/isaretli-sik';
import type { SonSecenek } from '@/lib/cevap-anahtari';
import { sayfaParcalari, type PdfBelgesi } from './pdf-metin';

/**
 * Çizimin uzun kenarı en fazla bu kadar piksel. A4 için ~3 kat: en küçük
 * işaret ("B)" etrafı, ~11 punto) harfi 30 piksel civarında çıkıyor.
 * iPad'de sayfa başına ~18 MB; sayfa bitince canvas bırakılıyor.
 */
const EN_UZUN_KENAR = 2600;

type Aday = { no: number; x: number; y: number; grup: string };

/** Numara adayı: "07", "12", "3." gibi yalnız bir sayıdan oluşan parça. */
const NUMARA = /^0*(\d{1,3})[.)]?$/;

/**
 * Metin katmanındaki soru numarası rozetleri.
 *
 * Sayfada başka sayılar da var (sayfa numarası, tablo değerleri). Soru
 * numaraları AYNI yazı tipinde ve boyda yazılır: adaylar (yazı tipi, boy)
 * grubuna ayrılıyor ve 1..n aralığında EN ÇOK FARKLI değeri taşıyan grup
 * seçiliyor. Alt kenar (altbilgi) hiç aday sayılmıyor.
 */
async function numaralariTopla(belge: PdfBelgesi, soruSayisi: number) {
  const sayfalar: Aday[][] = [];
  const gruplar = new Map<string, Set<number>>();
  for (let i = 1; i <= belge.numPages; i++) {
    const sayfa = await belge.getPage(i);
    const [, , , ust] = sayfa.view as [number, number, number, number];
    const adaylar: Aday[] = [];
    for (const p of await sayfaParcalari(sayfa)) {
      const m = p.str.trim().match(NUMARA);
      if (!m) continue;
      const no = Number.parseInt(m[1]!, 10);
      const x = p.transform[4] ?? 0;
      const y = p.transform[5] ?? 0;
      if (no < 1 || no > soruSayisi || y < ust * 0.06) continue;
      const grup = `${p.fontName ?? ''}|${Math.round(p.height ?? Math.abs(p.transform[0] ?? 0))}`;
      adaylar.push({ no, x, y, grup });
      const g = gruplar.get(grup) ?? new Set<number>();
      g.add(no);
      gruplar.set(grup, g);
    }
    sayfalar.push(adaylar);
  }
  const [secilen] = [...gruplar.entries()].sort((a, z) => z[1].size - a[1].size)[0] ?? [];
  return sayfalar.map((a) => a.filter((n) => n.grup === secilen));
}

/**
 * Belgedeki pembe kutularla işaretli şıkları okur.
 *
 * @param ilerleme Her sayfa bitince (bitti, toplam) — "Sayfa 3/9".
 */
export async function isaretliSiklariOku(
  belge: PdfBelgesi,
  { soruSayisi, sonSecenek = 'E' }: { soruSayisi: number; sonSecenek?: SonSecenek },
  ilerleme?: (bitti: number, toplam: number) => void,
): Promise<IsaretCikarimi> {
  const numaralar = await numaralariTopla(belge, soruSayisi);
  const bulgular: SayfaBulgusu[] = [];

  for (let i = 1; i <= belge.numPages; i++) {
    const sayfa = await belge.getPage(i);
    const ham = sayfa.getViewport({ scale: 1 });
    const olcek = Math.min(3, EN_UZUN_KENAR / Math.max(ham.width, ham.height));
    const vp = sayfa.getViewport({ scale: olcek });

    const tuval = document.createElement('canvas');
    tuval.width = Math.ceil(vp.width);
    tuval.height = Math.ceil(vp.height);
    try {
      const ctx = tuval.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Tarayıcı çizim alanı açamadı.');
      await sayfa.render({ canvasContext: ctx, viewport: vp }).promise;
      const { data, width, height } = ctx.getImageData(0, 0, tuval.width, tuval.height);
      const goruntu = { veri: data, genislik: width, yukseklik: height };

      const kutular = pembeKutular(goruntu, olcek).map((kutu) => ({
        kutu,
        sonuc: harfiTani(goruntu, kutu, sonSecenek),
      }));
      const sayfaNumaralari: Numara[] = (numaralar[i - 1] ?? []).map((n) => {
        const [x, y] = vp.convertToViewportPoint(n.x, n.y) as [number, number];
        return { no: n.no, x, y };
      });
      bulgular.push({ sayfa: i, kutular, numaralar: sayfaNumaralari, olcek });
    } finally {
      // iPad Safari canvas belleğini ancak boyut sıfırlanınca bırakıyor.
      tuval.width = 0;
      tuval.height = 0;
      sayfa.cleanup();
    }
    ilerleme?.(i, belge.numPages);
  }

  return isaretlerdenAnahtar(bulgular, soruSayisi);
}
