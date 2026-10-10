/**
 * SORU İPTALİ (0072) — anahtardaki iptal işareti.
 *
 * İptal edilen soru cevap anahtarında `"8": "IPTAL:B"` olarak duruyor:
 * asıl harf saklanıyor ki iptal geri alınabilsin. Sunucudaki
 * `_iptal_mi` ile AYNI kural (büyük/küçük harf ve boşluk önemsiz); ikisi
 * ayrışırsa ekran "iptal" der, puan saymaya devam ederdi.
 *
 * İptal edilen soru DEĞERLENDİRME DIŞI (öğretmenin kararı): puan kalan
 * sorular üzerinden hesaplanıyor (65 soruda 2 iptal → 63).
 */

export function iptalMi(deger: string | null | undefined): boolean {
  return (deger ?? '').trim().toUpperCase().startsWith('IPTAL');
}

/** "IPTAL:B" → "B"; iptal değilse değerin kendisi. */
export function asilHarf(deger: string | null | undefined): string | null {
  if (deger == null) return null;
  if (!iptalMi(deger)) return deger;
  const h = deger.trim().slice('IPTAL:'.length).trim();
  return h === '' ? null : h;
}

/** Anahtardaki iptal edilmiş soru numaraları, küçükten büyüğe. */
export function iptalSorulari(anahtar: Record<string, string> | null | undefined): number[] {
  return Object.entries(anahtar ?? {})
    .filter(([no, v]) => /^\d+$/.test(no) && iptalMi(v))
    .map(([no]) => Number(no))
    .sort((a, b) => a - b);
}

/** [8, 35] → "8 ve 35"; [3, 8, 35] → "3, 8 ve 35". */
export function numaraListesi(nolar: number[]): string {
  if (nolar.length <= 1) return nolar.join('');
  return `${nolar.slice(0, -1).join(', ')} ve ${nolar.at(-1)}`;
}

export type OkunanNumaralar = { sorular: number[]; hata: null } | { sorular: null; hata: string };

/**
 * Öğretmenin yazdığı "8, 35" / "8 35" / "8;35" → [8, 35].
 * Hata metni öğretmene doğrudan gösteriliyor.
 */
export function soruNumaralariniOku(metin: string, soruSayisi: number): OkunanNumaralar {
  const parcalar = metin
    .split(/[\s,;.]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parcalar.length === 0)
    return { sorular: null, hata: 'İptal edilecek soru numarasını yazın.' };
  const bozuk = parcalar.find((p) => !/^\d+$/.test(p));
  if (bozuk) return { sorular: null, hata: `"${bozuk}" bir soru numarası değil.` };
  const sayilar = parcalar.map(Number);
  const disarida = sayilar.find((n) => n < 1 || n > soruSayisi);
  if (disarida !== undefined) {
    return {
      sorular: null,
      hata: `Soru numaraları 1 ile ${soruSayisi} arasında olmalı (${disarida}).`,
    };
  }
  if (new Set(sayilar).size !== sayilar.length) {
    return { sorular: null, hata: 'Aynı soru numarası birden fazla yazılmış.' };
  }
  return { sorular: [...sayilar].sort((a, b) => a - b), hata: null };
}
