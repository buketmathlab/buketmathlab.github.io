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
 * ÜÇ BANT ÖĞRETMENİN DİL DÜZELTMESİYLE YENİDEN YAZILDI:
 *   85–99  "hatanı fark edip üzerine çalışırsan" → hatanın üzerine değil,
 *          SORUYA dönülür: "birkaç soruyu yeniden gözden geçirirsen".
 *   70–84  "yanlışlarını çalışırsan" → Türkçede yanlışa çalışılmaz;
 *          yanlış yapılan SORU yeniden çözülür.
 *   50–69  "nerede zorlandığını bulalım" ile bitiyordu; öğretmenin isteği
 *          üzerine cümle umutla kapanıyor: "konu tamamlanacak".
 * Üçünde de yanlışın kendisi GİZLENMİYOR — "yanlış yaptığın sorular"
 * açıkça duruyor. Değişen, oradan nereye bakıldığı.
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
      'Çok iyi gidiyorsun! Birkaç soruyu yeniden gözden geçirirsen konuya tam hâkim olursun.',
  },
  {
    enAz: 70,
    poz: 'calisma',
    cumle:
      'İyi bir sonuç aldın. Yanlış yaptığın soruları yeniden çözersen konuyu çok daha iyi pekiştirirsin.',
  },
  {
    enAz: 50,
    poz: 'calisma',
    cumle:
      'Konunun bir kısmını öğrenmişsin; bazı noktalar henüz tam oturmamış. Yanlış yaptığın soruları birlikte inceleyelim, eksik kalan yeri gördükçe konu tamamlanacak.',
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
