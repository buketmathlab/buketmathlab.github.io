/**
 * Türkçe dizgi ve biçimlendirme yardımcıları.
 * Kural: uygulamada hiçbir yerde ham `toUpperCase()` veya `toLocaleDateString()`
 * çağrılmaz — hepsi buradan geçer, böylece İ/ı ve tarih biçimi tek yerde doğrudur.
 */

const TR = 'tr-TR'

/** Türkçe büyük harf: "istanbul" → "İSTANBUL" (i → İ, ı → I). */
export function buyuk(metin: string): string {
  return metin.toLocaleUpperCase(TR)
}

/** Türkçe küçük harf: "İSTANBUL" → "istanbul". */
export function kucuk(metin: string): string {
  return metin.toLocaleLowerCase(TR)
}

/** Her kelimenin ilk harfi büyük: "buket topuzoğlu" → "Buket Topuzoğlu". */
export function basHarfBuyuk(metin: string): string {
  return metin
    .split(/\s+/)
    .filter(Boolean)
    .map((kelime) => buyuk(kelime.slice(0, 1)) + kucuk(kelime.slice(1)))
    .join(' ')
}

/** Türkçe alfabetik sıralama karşılaştırıcısı (ç, ğ, ı, ö, ş, ü doğru sıralanır). */
export const trKarsilastir = new Intl.Collator(TR, { sensitivity: 'base', numeric: true }).compare

/**
 * Sınıf adları için doğal sıralama: 9A, 9B, 9C, 10A…
 * Düz alfabetik sıralama "10A"yı "9A"nın önüne koyar; kademe önce sayısal karşılaştırılır.
 */
export function siniflariSirala<T extends { ad: string; kademe?: number | null }>(a: T, b: T): number {
  const kademeA = a.kademe ?? kademeCikar(a.ad)
  const kademeB = b.kademe ?? kademeCikar(b.ad)
  if (kademeA !== kademeB) return kademeA - kademeB
  return trKarsilastir(a.ad, b.ad)
}

function kademeCikar(ad: string): number {
  const eslesme = /^(\d+)/.exec(ad.trim())
  return eslesme?.[1] ? Number(eslesme[1]) : 99
}

/** 12,5 → "12,5" · 100 → "100" (Türkçe ondalık ayracı virgüldür). */
export function sayi(deger: number | null | undefined, basamak = 0): string {
  if (deger === null || deger === undefined || Number.isNaN(deger)) return '—'
  return new Intl.NumberFormat(TR, {
    minimumFractionDigits: basamak,
    maximumFractionDigits: basamak,
  }).format(deger)
}

/** 0.845 → "%85" (oranlar tam sayıya yuvarlanır, yüzde işareti Türkçede önde gelir). */
export function yuzde(oran: number | null | undefined): string {
  if (oran === null || oran === undefined || Number.isNaN(oran)) return '—'
  return `%${Math.round(oran * 100)}`
}

/** "7 Ağustos 2026" */
export function tarih(deger: string | Date | null | undefined): string {
  const d = tarihCevir(deger)
  if (!d) return '—'
  return new Intl.DateTimeFormat(TR, { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
}

/** "7 Ağu 14:30" — listelerde yer kazandırır. */
export function tarihSaat(deger: string | Date | null | undefined): string {
  const d = tarihCevir(deger)
  if (!d) return '—'
  return new Intl.DateTimeFormat(TR, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** "3 gün sonra", "dün", "2 saat önce" — teslim tarihlerinde okunurluğu artırır. */
export function goreliZaman(deger: string | Date | null | undefined): string {
  const d = tarihCevir(deger)
  if (!d) return '—'
  const farkMs = d.getTime() - Date.now()
  const bicimlendirici = new Intl.RelativeTimeFormat(TR, { numeric: 'auto' })
  const birimler: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365 * 24 * 60 * 60 * 1000],
    ['month', 30 * 24 * 60 * 60 * 1000],
    ['day', 24 * 60 * 60 * 1000],
    ['hour', 60 * 60 * 1000],
    ['minute', 60 * 1000],
  ]
  for (const [birim, ms] of birimler) {
    if (Math.abs(farkMs) >= ms || birim === 'minute') {
      return bicimlendirici.format(Math.round(farkMs / ms), birim)
    }
  }
  return 'şimdi'
}

function tarihCevir(deger: string | Date | null | undefined): Date | null {
  if (!deger) return null
  const d = deger instanceof Date ? deger : new Date(deger)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 1536000 → "1,5 MB" — depolama göstergesi ve yükleme boyutu için. */
export function dosyaBoyutu(bayt: number): string {
  if (bayt < 1024) return `${bayt} B`
  if (bayt < 1024 * 1024) return `${sayi(bayt / 1024, 0)} KB`
  return `${sayi(bayt / (1024 * 1024), 1)} MB`
}
