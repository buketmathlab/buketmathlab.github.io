/**
 * Ödev kıyası kartının METNİ — React'siz, doğrudan test edilebilir.
 *
 * `kod-yenileme-metni.ts` / `ogrenci-ozet-metni.ts` deseninin aynısı:
 * öğretmen bir cümleyi beğenmezse tek dosyadan değişsin.
 *
 * -----------------------------------------------------------------------------
 * BU KARTTA YARGI CÜMLESİ YOK — ve bu, bir önceki turun kuralı
 *
 * Kart yalnız SAYILARI gösteriyor. Ne "sınıfın üstündesin, harikasın"
 * ne "gerideysin, çalışmalısın". Öğretmenin kalıcı kuralı çocuğu
 * etiketlememek; bir tur önce ürün dilinden hak edilmemiş övgüyü
 * (`Eline sağlık`) temizledik. Kıyas kartına yargı koymak o turu aynı
 * hafta içinde geri almak olurdu.
 *
 * Sayıyı okuyup ne anlama geldiğine karar vermek öğrencinin —
 * ve asıl olarak öğretmenin — işi.
 *
 * -----------------------------------------------------------------------------
 * "ÜSTÜNDE / ALTINDA" KELİMESİ DE YOK
 *
 * Öğretmenin isteği "ortalamanın üstünde mi altında mı görebilsin" idi;
 * ekran bunu KARŞILAŞTIRILABİLİR İKİ SAYI koyarak veriyor:
 *
 *     Puanın          80
 *     9A ortalaması   65
 *
 * "Üstündesin" diye ayrıca yazmak aynı bilgiyi bir İDDİAYA çevirirdi.
 * İki sayı yan yana durduğunda karşılaştırma zaten görünür; cümle
 * kurulunca ölçüm bir hükme dönüşür.
 *
 * -----------------------------------------------------------------------------
 * TESLİM SAYISI YOK — öğretmenin kararı
 *
 * İlk sürümde her satırın yanında "(24 teslimden)" yazıyordu. Öğretmen
 * kaldırttı: "Teslim sayısı veliye ya da öğrenciye gösterilmesin."
 *
 * Sayı YANITTAN da çıkarıldı (0047). Ekrandan gizlemek yetmezdi; bu
 * depo gizlemeyi arayüzde yapmıyor (Part XXI) — yanıtta dursa
 * geliştirici araçlarını açan herkes okurdu.
 *
 * -----------------------------------------------------------------------------
 * SEVİYE SATIRI KOŞULLU
 *
 * Aynı ödev başka şubelere verilmediyse `seviye` sunucudan `null`
 * geliyor ve satır HİÇ çizilmiyor. Öğretmenin kuralı: "diğer şubelere
 * verilmemişse sadece ödevin verildiği sınıf ortalaması alınsın."
 * Boş bir satır ya da "—" göstermek, olmayan bir kıyas varmış gibi
 * durur.
 */

export type KiyasTuru = 'ogrenci' | 'veli';

export type KiyasMetni = {
  /** Kartın başlığı. */
  baslik: string;
  /** Öğrencinin kendi puanının etiketi. */
  puanEtiketi: string;
};

const OGRENCI: KiyasMetni = {
  baslik: 'Bu ödevde durum',
  puanEtiketi: 'Puanın',
};

const VELI: KiyasMetni = {
  baslik: 'Bu ödevde durum',
  // Veliye çocuğun puanı "puanı" diye anlatılıyor: kart velinin
  // ekranında çocuğun hakkında, velinin kendisi hakkında değil.
  puanEtiketi: 'Puanı',
};

export function kiyasMetni(tur: KiyasTuru): KiyasMetni {
  return tur === 'ogrenci' ? OGRENCI : VELI;
}

/**
 * Ortalamayı ekrana yazılacak hâle getirir.
 *
 * Sunucu `numeric(5,2)`'den `round(…, 1)` ile geliyor ve PostgREST bunu
 * bazen sayı, bazen dize olarak veriyor; ikisi de kabul ediliyor.
 * `null` "hiç teslim yok" demek — uydurulmuş bir 0 YAZILMIYOR, çünkü
 * 0 gerçek bir ortalama değeri ve ikisi karışırsa öğrenci sınıfının
 * sıfır aldığını sanır.
 */
export function ortalamaYazisi(deger: number | string | null | undefined): string | null {
  if (deger === null || deger === undefined) return null;
  const s = typeof deger === 'number' ? deger : Number(deger);
  if (!Number.isFinite(s)) return null;
  // Tam sayıysa ondalık gösterilmiyor: "65" — "65,0" gereksiz gürültü.
  return Number.isInteger(s) ? String(s) : s.toFixed(1).replace('.', ',');
}
