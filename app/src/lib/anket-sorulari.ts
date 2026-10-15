/**
 * ANONİM ANKET SORULARI (0076) — saf veri.
 *
 * Okul Gelişim Projesi izleme-değerlendirmesi için paydaş görüşü. Madde
 * SAYISI sunucuyla aynı olmalı (`_anket_madde_sayisi`: öğrenci 7, veli ve
 * öğretmen 5); sunucu her maddenin 1–5 arasında olduğunu doğruluyor.
 *
 * Ölçme dili: maddeler davranış ve algı soruyor, kişiyi değil. 7. öğrenci
 * maddesi ("çoğunlukla kendi bilgimle yaptım") sosyal beğenirlik yanlılığı
 * taşır; raporda dürüstlüğün KANITI değil, ALGISI olarak okunmalı.
 *
 * Ad, sınıf, şube, kod SORULMUYOR — anonimliğin yarısı sunucuda (yanıtta
 * kimlik ve saat yok), yarısı burada (tanınmayı sağlayacak soru yok).
 */
export type AnketRolu = 'ogrenci' | 'veli' | 'ogretmen';

export const LIKERT = [
  { deger: 1, etiket: 'Hiç katılmıyorum' },
  { deger: 2, etiket: 'Katılmıyorum' },
  { deger: 3, etiket: 'Kararsızım' },
  { deger: 4, etiket: 'Katılıyorum' },
  { deger: 5, etiket: 'Tamamen katılıyorum' },
] as const;

export const ANKET_MADDELERI: Record<AnketRolu, readonly string[]> = {
  ogrenci: [
    "SEKİZ'e girip ödev göndermek kolaydı.",
    'Ödevimi gönderdikten sonra yanlış ya da boş sorularımın çözümünü inceledim.',
    'Çözümlü cevap anahtarı, hatamın nerede olduğunu anlamama yardım etti.',
    'Konularım sayfası, hangi konuya çalışmam gerektiğini gösterdi.',
    'Bir yanlışımı inceledikten sonra benzer bir soruyu yeniden çözmeyi denedim.',
    '“Yapay değil, kendi zekâm” kartı, ödevi kendi emeğimle yapmanın önemini düşündürdü.',
    'Ödevlerimi çoğunlukla kendi bilgimle yaptım.',
  ],
  veli: [
    'Çocuğumun ödev durumunu izlemek kolay.',
    'Konu analizi, çocuğumla ne üzerine konuşacağımı gösterdi.',
    'Çocuğumun eksik konusunu öğrendiğimde onunla bu konuyu konuştum.',
    'Gerektiğinde öğretmene ulaşabildim.',
    'Kişisel verilerin nasıl kullanıldığı bana açıkça anlatıldı.',
  ],
  ogretmen: [
    'Ödev hazırlamak ve vermek makul bir zaman aldı.',
    'Konu analizi, bir sonraki dersimi planlarken işe yaradı.',
    'Çözümlü cevap anahtarı, öğrenciye verdiğim geri bildirimi güçlendirdi.',
    'Soru iptali, adil değerlendirmeye katkı sağladı.',
    'Çözüm fotoğrafları, öğrencinin sürecini görmemi kolaylaştırdı.',
  ],
};

export const ACIK_UCLU_SORU: Record<AnketRolu, string> = {
  ogrenci: "SEKİZ'de neyi değiştirirdin?",
  veli: 'Öneriniz var mı?',
  ogretmen: 'En büyük güçlük nedir?',
};

export const ACIK_UCLU_SINIR = 300;

export const ROL_ADI: Record<AnketRolu, string> = {
  ogrenci: 'Öğrenci',
  veli: 'Veli',
  ogretmen: 'Öğretmen',
};

/** Gönderilecek yanıt: her madde dolu mu? Doluysa sunucunun beklediği gövde. */
export function anketGovdesi(
  rol: AnketRolu,
  secimler: Record<string, number>,
  acik: string,
): Record<string, number | string> | null {
  const n = ANKET_MADDELERI[rol].length;
  const govde: Record<string, number | string> = {};
  for (let i = 1; i <= n; i++) {
    const v = secimler[`m${i}`];
    if (!v || v < 1 || v > 5) return null;
    govde[`m${i}`] = v;
  }
  const t = acik.trim();
  if (t) govde.acik = t.slice(0, ACIK_UCLU_SINIR);
  return govde;
}
