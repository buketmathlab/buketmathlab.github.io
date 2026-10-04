/**
 * Öğrencinin PDF çözümünü görsele çevirme — yalnız tarayıcıda.
 *
 * PDF cihazda çiziliyor; ortaya çıkan JPEG, fotoğrafla AYNI yoldan
 * yükleniyor. Sunucu PDF görmüyor. Yerleşim hesabı `lib/pdf-cozum.ts`'te.
 *
 * pdf.js tembel yükleniyor (`pdfIleCalis`): PDF seçmeyen öğrenci onu hiç
 * indirmiyor.
 */

import {
  ARA_CIZGI,
  PDF_GENISLIK,
  TEK_GORSEL_EN_FAZLA_SAYFA,
  cokSayfaMetni,
  tekGorselDuzeni,
} from '@/lib/pdf-cozum';
import { KaranlikFotografHatasi, karanlikMi } from '@/lib/karanlik-fotograf';
import { EN_BUYUK_BOYUT } from './dosya';
import { pdfIleCalis, type PdfBelgesi } from './pdf-metin';

type Sayfa = Awaited<ReturnType<PdfBelgesi['getPage']>>;

/** Fotoğraf sıkıştırmasıyla aynı kalite (`lib/gorsel-sikistir.ts`). */
const KALITE = 0.72;

function tuvalAc(en: number, boy: number) {
  const tuval = document.createElement('canvas');
  tuval.width = en;
  tuval.height = boy;
  const ctx = tuval.getContext('2d');
  if (!ctx) throw new Error('PDF işlenemedi. Sayfayı yenileyip tekrar deneyin.');
  // PDF sayfalarının çoğu saydam zeminli: JPEG'de siyaha dönmesin.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, en, boy);
  return { tuval, ctx };
}

function bosalt(tuval: HTMLCanvasElement) {
  // iPad Safari tuval belleğini ancak boyut sıfırlanınca bırakıyor.
  tuval.width = 0;
  tuval.height = 0;
}

async function sayfayiCiz(sayfa: Sayfa, ctx: CanvasRenderingContext2D, en: number, y: number) {
  const ham = sayfa.getViewport({ scale: 1 });
  const vp = sayfa.getViewport({ scale: en / ham.width });
  // Sayfa kendi tuvaline çizilip büyük tuvale kopyalanıyor: pdf.js'in
  // `transform` ile doğrudan kaydırılmış çizimi bazı sürümlerde kırpıyor.
  const { tuval, ctx: sctx } = tuvalAc(Math.ceil(vp.width), Math.ceil(vp.height));
  try {
    await sayfa.render({ canvasContext: sctx, viewport: vp }).promise;
    ctx.drawImage(tuval, 0, y);
  } finally {
    bosalt(tuval);
    sayfa.cleanup();
  }
}

/**
 * Karanlık (siyah) sayfa gönderilmesin — fotoğraf yoluyla aynı kural
 * (`gorsel-sikistir.ts`). PDF içine konmuş siyah bir fotoğraf bu yoldan
 * kontrolsüz geçiyordu.
 */
function karanlikDenetle(tuval: HTMLCanvasElement) {
  const ctx = tuval.getContext('2d');
  if (ctx && karanlikMi(ctx.getImageData(0, 0, tuval.width, tuval.height).data)) {
    throw new KaranlikFotografHatasi();
  }
}

async function jpeg(tuval: HTMLCanvasElement, ad: string): Promise<File> {
  karanlikDenetle(tuval);
  // Depo sınırı 10 MB; uzun bir birleşik görsel sınırı aşarsa kalite düşer.
  for (const kalite of [KALITE, 0.6, 0.5]) {
    const blob = await new Promise<Blob | null>((c) => tuval.toBlob(c, 'image/jpeg', kalite));
    if (!blob) break;
    if (blob.size <= EN_BUYUK_BOYUT * 0.95) return new File([blob], ad, { type: 'image/jpeg' });
  }
  throw new Error('PDF çok büyük olduğu için görsele çevrilemedi. Daha az sayfalı bir PDF ya da fotoğraf dene.');
}

function acmaHatasi(e: unknown): Error {
  return new Error(
    e instanceof Error && /parola|bozuk|açılamadı/i.test(e.message)
      ? 'PDF açılamadı. Dosya bozuk ya da parola korumalı olabilir; fotoğraf olarak yüklemeyi dene.'
      : 'PDF okunamadı. Fotoğraf olarak yüklemeyi dene.',
  );
}

/**
 * Sayfa sınırı 1 olan ödev: PDF'in bütün sayfaları alt alta TEK görsel.
 */
export async function pdfiTekGorsele(dosya: File): Promise<{ dosya: File; sayfaSayisi: number }> {
  try {
    return await pdfIleCalis(dosya, async (belge) => {
      const n = belge.numPages;
      if (n > TEK_GORSEL_EN_FAZLA_SAYFA) throw new Error(cokSayfaMetni(n));

      const sayfalar: Sayfa[] = [];
      for (let i = 1; i <= n; i++) sayfalar.push(await belge.getPage(i));
      const duzen = tekGorselDuzeni(
        sayfalar.map((s) => {
          const v = s.getViewport({ scale: 1 });
          return { en: v.width, boy: v.height };
        }),
      );

      const { tuval, ctx } = tuvalAc(duzen.en, duzen.boy);
      try {
        // Sayfa ayraçları: öğretmen sayfa geçişlerini görsün.
        ctx.fillStyle = '#c8c8c8';
        for (const s of duzen.sayfalar.slice(1)) ctx.fillRect(0, s.y - ARA_CIZGI, duzen.en, ARA_CIZGI);
        for (let i = 0; i < n; i++) await sayfayiCiz(sayfalar[i]!, ctx, duzen.en, duzen.sayfalar[i]!.y);
        return { dosya: await jpeg(tuval, 'cozum.jpg'), sayfaSayisi: n };
      } finally {
        bosalt(tuval);
      }
    });
  } catch (e) {
    if (e instanceof KaranlikFotografHatasi) throw e;
    if (e instanceof Error && /sayfa; tek görsele|çok büyük/.test(e.message)) throw e;
    throw acmaHatasi(e);
  }
}

/**
 * Birden fazla sayfaya izin verilen ödev: her PDF sayfası ayrı görsel.
 * Yalnız ilk `enFazla` sayfa çiziliyor; `toplam` taşanı bildirmek için.
 */
export async function pdfSayfalariniGorsele(
  dosya: File,
  enFazla: number,
): Promise<{ dosyalar: File[]; toplam: number }> {
  try {
    return await pdfIleCalis(dosya, async (belge) => {
      const dosyalar: File[] = [];
      const cizilecek = Math.min(belge.numPages, Math.max(0, enFazla));
      for (let i = 1; i <= cizilecek; i++) {
        const sayfa = await belge.getPage(i);
        const v = sayfa.getViewport({ scale: 1 });
        const boy = Math.round(PDF_GENISLIK * (v.height / v.width));
        const { tuval, ctx } = tuvalAc(PDF_GENISLIK, boy);
        try {
          await sayfayiCiz(sayfa, ctx, PDF_GENISLIK, 0);
          dosyalar.push(await jpeg(tuval, `cozum-${i}.jpg`));
        } finally {
          bosalt(tuval);
        }
      }
      return { dosyalar, toplam: belge.numPages };
    });
  } catch (e) {
    if (e instanceof KaranlikFotografHatasi) throw e;
    if (e instanceof Error && /çok büyük/.test(e.message)) throw e;
    throw acmaHatasi(e);
  }
}
