/**
 * Grafik hesapları — çizimden ayrı, test edilebilsin diye.
 *
 * Değerler 0–100 aralığında (puan ve yüzde ikisi de). Tek eksen: iki seri
 * aynı ölçekte, ikinci bir y ekseni hiç yok.
 */

/** Sunucunun `numeric` alanı JSON'da sayı ya da metin gelebiliyor. */
export function sayiya(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

const AY = new Intl.DateTimeFormat('tr-TR', { month: 'short' });

/** '2026-09-01' → 'Eyl'. Saat dilimi kaymasın diye öğlen alınıyor. */
export function ayEtiketi(iso: string): string {
  return AY.format(new Date(`${iso.slice(0, 10)}T12:00:00`));
}

export type Alan = { genislik: number; yukseklik: number; sol: number; sag: number; ust: number; alt: number };

/** i. kategorinin x merkezi. Tek kategori ortada. */
export function xKonumu(i: number, adet: number, a: Alan): number {
  const ic = a.genislik - a.sol - a.sag;
  if (adet <= 1) return a.sol + ic / 2;
  return a.sol + (ic * i) / (adet - 1);
}

/** 0–100 değeri y'ye; aralık dışı kırpılır. */
export function yKonumu(deger: number, a: Alan): number {
  const ic = a.yukseklik - a.ust - a.alt;
  const d = Math.max(0, Math.min(100, deger));
  return a.ust + ic * (1 - d / 100);
}

/**
 * Çizgi yolu. Boş değer (null) çizgiyi KESER — "veri yok" sıfır değil,
 * iki ay arasında var olmayan bir gidişi çizmemeli.
 */
export function cizgiYolu(degerler: (number | null)[], a: Alan): string {
  let yol = '';
  let kalem = false;
  degerler.forEach((d, i) => {
    if (d === null) {
      kalem = false;
      return;
    }
    const x = xKonumu(i, degerler.length, a).toFixed(1);
    const y = yKonumu(d, a).toFixed(1);
    yol += `${kalem ? 'L' : 'M'}${x} ${y}`;
    kalem = true;
  });
  return yol;
}

/**
 * Dar ekranda her ay etiketi sığmaz: en fazla `sigan` etiket, ilk ve son
 * her zaman görünür.
 */
export function gorunenEtiketler(adet: number, sigan: number): boolean[] {
  if (adet <= sigan) return Array.from({ length: adet }, () => true);
  const adim = Math.ceil((adet - 1) / Math.max(1, sigan - 1));
  return Array.from({ length: adet }, (_, i) => i === adet - 1 || i % adim === 0);
}

/** İmlecin x'ine en yakın kategori. */
export function enYakin(x: number, adet: number, a: Alan): number {
  if (adet <= 1) return 0;
  const ic = a.genislik - a.sol - a.sag;
  const i = Math.round(((x - a.sol) / ic) * (adet - 1));
  return Math.max(0, Math.min(adet - 1, i));
}

const SAYI = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });

/** 72.5 → "72,5"; yüzde için "%84". Boş değer "—". */
export function degerYazisi(d: number | null, birim: '' | '%'): string {
  if (d === null) return '—';
  return birim === '%' ? `%${SAYI.format(d)}` : SAYI.format(d);
}
