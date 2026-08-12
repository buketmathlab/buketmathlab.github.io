import type { EwaluPoz } from '@/components/brand/ewalu';

/**
 * Puana göre Ewalu'nun pozu ve cümlesi.
 *
 * CÜMLELER ÖĞRETMENİNDİR. Bantları da metinleri de o yazdı; burada
 * uydurulmuş tek bir kelime yok (Kural 9: Ewalu'nun kimliği değiştirilemez).
 * Değiştirmek gerekirse tek yer burası.
 *
 * POZ KURALI İKİ DEĞERLİ: `kutlama` yalnız 85 ve üstünde; altında `calisma`.
 * Bundan önce sonuç kartı puan ne olursa olsun `kutlama` gösteriyordu — 20
 * alan öğrenciyi kutlayan bir ayı alay gibi okunur.
 *
 * Sistem cümlesi ("Ödevin alındı ve puanlandı.") bundan BAĞIMSIZ ve sabit;
 * o "ne oldu"yu söyler, buradaki cümle "şimdi ne yapmalı"yı.
 */

export type PuanMesaji = { poz: EwaluPoz; cumle: string };

/**
 * Bantlar ARTAN sırada; `bul` ilk eşleşeni döndürür.
 *
 * `enAz` dahildir: 85 → 85–99 bandı. Sınırların hepsi birim testte tek tek
 * ölçülüyor (0, 49, 50, 69, 70, 84, 85, 99, 100) — aralık sınırı hatası
 * sessizdir ve ekranda yanlış cümleyle karşımıza çıkar.
 */
const BANTLAR: ReadonlyArray<{ enAz: number; poz: EwaluPoz; cumle: string }> = [
  {
    enAz: 100,
    poz: 'kutlama',
    cumle:
      'Harika! Konuyu gerçekten iyi kavramışsın. Emeğinin karşılığını tam puanla almışsın.',
  },
  {
    enAz: 85,
    poz: 'kutlama',
    cumle:
      'Çok iyi gidiyorsun! Birkaç noktadaki hatanı fark edip üzerine çalışırsan çok daha sağlam bir sonuca ulaşabilirsin.',
  },
  {
    enAz: 70,
    poz: 'calisma',
    cumle:
      'İyi bir sonuç aldın. Eksiklerini fark edip yanlışlarını çalışırsan konuyu çok daha iyi pekiştirebilirsin.',
  },
  {
    enAz: 50,
    poz: 'calisma',
    cumle:
      'Konunun bir kısmını öğrenmişsin, ama bazı noktalar henüz tam oturmamış. Yanlışlarını inceleyerek nerede zorlandığını bulalım.',
  },
  {
    enAz: 0,
    poz: 'calisma',
    cumle:
      'Bu ödev seni zorlamış. Önce anlamadığın konuları belirleyip adım adım çalışalım; eksiklerini gördükçe ilerlemen kolaylaşacak.',
  },
];

/**
 * Puanı olan bir gönderim için Ewalu'nun söyleyeceği.
 *
 * Puan 0–100 dışına çıkamaz (sunucu `_puanla` ve `acik_puanla` bunu
 * zorluyor) ama savunmacı davranıyoruz: aralık dışı bir değer gelirse en
 * yakın bant seçilir, ekran boş kalmaz.
 */
export function puanMesaji(puan: number): PuanMesaji {
  const p = Number.isFinite(puan) ? Math.min(100, Math.max(0, Math.round(puan))) : 0;
  // BANTLAR azalan `enAz` sırasında; ilk eşleşen doğru bant.
  const bant = BANTLAR.find((b) => p >= b.enAz) ?? BANTLAR[BANTLAR.length - 1]!;
  return { poz: bant.poz, cumle: bant.cumle };
}
