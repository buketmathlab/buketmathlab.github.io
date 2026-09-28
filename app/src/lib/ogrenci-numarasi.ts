/**
 * Tek öğrenci eklerken okul numarası — saf mantık.
 *
 * Öğretmenin isteği: "Manuel öğrenci eklerken öğrenci numarasını da
 * ekleyebilmeliyim." Sunucu numarayı 0042'den beri kabul ediyor
 * (`ogrenci_ekle(p_ogrenci_no)`); eksik olan formdaki alandı.
 *
 * Kurallar 0042'deki öğretmen kararlarıyla aynı:
 *  - Numara İSTEĞE BAĞLI (özel ders öğrencisinin okul numarası yok).
 *  - METİN: başındaki sıfır korunur ("0601").
 *  - En fazla 20 karakter (sunucudaki `ogrenci_no_gecerli` kısıtı).
 *  - Aynı sınıfta tekrar ederse UYARILIR, ENGELLENMEZ.
 */

export const NUMARA_EN_FAZLA = 20;

export type NumaraSonucu = { no: string | null } | { hata: string };

/** Boş → null (numarasız); fazlası hata. */
export function numarayiDenetle(metin: string): NumaraSonucu {
  const no = metin.trim();
  if (no === '') return { no: null };
  if (no.length > NUMARA_EN_FAZLA) {
    return { hata: `Öğrenci numarası en fazla ${NUMARA_EN_FAZLA} karakter olabilir.` };
  }
  return { no };
}

/** Sınıfta bu numarayı zaten taşıyan öğrencilerin adları. */
export function ayniNumaralilar(
  no: string,
  kayitlar: ReadonlyArray<{ ad: string; ogrenci_no?: string | null }>,
): string[] {
  const aranan = no.trim();
  if (!aranan) return [];
  return kayitlar.filter((k) => (k.ogrenci_no ?? '').trim() === aranan).map((k) => k.ad);
}

/** Uyarı cümlesi: "Bu sınıfta 601 numarası zaten var: Ali Yılmaz." */
export function tekrarUyarisi(no: string, adlar: readonly string[]): string {
  return `Bu sınıfta ${no.trim()} numarası zaten var: ${adlar.join(', ')}. ` +
    'Yine de eklemek için tekrar "Yine de ekle"ye basın.';
}
