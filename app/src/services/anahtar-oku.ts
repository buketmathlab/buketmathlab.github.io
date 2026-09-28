/**
 * Cevap anahtarı PDF'ini okur: önce metin, gerekirse işaretli şıklar.
 *
 * İki biçim de öğretmenin gerçek dosyalarından:
 *  - "Çözüm.pdf": cevaplar metinde ("(D)", sonda "1-D 2-E …") →
 *    `lib/cevap-anahtari.ts`.
 *  - "…Üslü ve Köklü… Çözüm.pdf": sorular görsel, doğru şık pembe kutuyla
 *    işaretli; metinde cevap yok → `services/pdf-isaret.ts`.
 *
 * Metin bütün soruları bulduysa sayfalar hiç çizilmiyor (hızlı yol). Eksik
 * kaldıysa işaretler okunuyor ve YALNIZ BOŞLUKLARI dolduruyor: metin daha
 * kesin, onun bulduğu cevap değişmiyor; iki yol farklı derse soru çelişkili
 * işaretleniyor.
 */

import {
  anahtariCikar,
  cikarimlariBirlestir,
  type Cikarim,
  type SonSecenek,
} from '@/lib/cevap-anahtari';
import { belgeSatirlari, pdfIleCalis } from './pdf-metin';

export type AnahtarOkumaSecenekleri = {
  soruSayisi: number;
  sonSecenek?: SonSecenek;
  /** İşaretler okunurken sayfa ilerlemesi. */
  ilerleme?: (bitti: number, toplam: number) => void;
};

/**
 * @throws Açılamayan PDF'te, ya da ne metin ne işaret bulunduğunda Türkçe hata.
 */
export async function anahtarOku(dosya: File, s: AnahtarOkumaSecenekleri): Promise<Cikarim> {
  const { soruSayisi, sonSecenek = 'E' } = s;
  return pdfIleCalis(dosya, async (belge) => {
    const satirlar = await belgeSatirlari(belge);
    const metin = anahtariCikar(satirlar, { soruSayisi, sonSecenek });
    if (metin.eksik.length === 0 && metin.yontem === 'numarali') return metin;

    // TEMBEL: işaret okuyucu (harf şablonları dahil) yalnız gerektiğinde
    // iniyor; giriş ekranını her gün açan öğrenci onu hiç indirmiyor.
    const { isaretliSiklariOku } = await import('./pdf-isaret');
    const isaret = await isaretliSiklariOku(belge, { soruSayisi, sonSecenek }, s.ilerleme);
    if (isaret.isaretli === 0) {
      if (satirlar.length === 0) {
        throw new Error(
          'Bu PDF metin içermiyor — büyük olasılıkla taranmış bir görüntü. ' +
            'Cevapları elle girebilirsiniz.',
        );
      }
      return metin;
    }
    return cikarimlariBirlestir(
      // Harf dizisi eşlemesi (numarasız) işaretlerle birlikte güvenilmez.
      metin.yontem === 'harf-dizisi' ? { ...metin, anahtar: {}, bulunan: [], celiskili: [] } : metin,
      isaret,
      soruSayisi,
    );
  });
}
