/**
 * "EN ÇOK ZORLANILAN KONULAR" BOŞSA NEDENİ (0069).
 *
 * Öğretmenin sorusu: "10. sınıfların en çok zorlandığı konular neden
 * gösterilmiyor? Neden yeteri kadar veri yok yazıyor?" Genel cümle yerine
 * nedeni söylüyoruz; sıra, konu analizinin kendi koşullarının sırası:
 * test ödevi → süresi dolmuş → sorularına konu girilmiş → konu başına
 * yeterli cevap → yanlış/boş var mı.
 *
 * Metin müdüre de gösteriliyor; bu yüzden "ödevi düzenleyin" gibi yalnız
 * öğretmenin yapabileceği bir talimat yok, yalnız durum.
 */
export type KonuVerisi = {
  test_odev: number;
  dolan_test: number;
  konulu_dolan_test: number;
  yeterli_konu: number;
  en_az_cevap: number;
};

export const ESKI_METIN = 'Henüz yeterli veri yok.';

export function konuYokNedeni(seviye: number, v: KonuVerisi | undefined | null): string {
  if (!v) return ESKI_METIN; // 0069 çalıştırılmamış sunucu
  const ad = `${seviye}. sınıflarda`;
  if (v.test_odev === 0) {
    return `${ad} henüz test ödevi yok. Konu analizi test ödevlerinden çıkar.`;
  }
  if (v.dolan_test === 0) {
    return `${ad} test ödevlerinin süresi henüz dolmadı. Son tarih geçince konular burada görünür.`;
  }
  if (v.konulu_dolan_test === 0) {
    return `${ad} süresi dolan testlerde sorulara konu girilmemiş. Konu girilince burada görünür.`;
  }
  if (v.yeterli_konu === 0) {
    return `${ad} henüz hiçbir konuda yeterli cevap yok (konu başına en az ${v.en_az_cevap} cevap gerekiyor).`;
  }
  return `${ad} yanlış ya da boş bırakılan konu yok.`;
}
