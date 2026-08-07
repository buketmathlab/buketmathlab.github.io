/** Koşullu sınıf adlarını birleştirir. Küçük ve bağımlılıksız. */
export function sinif(...parcalar: Array<string | false | null | undefined>): string {
  return parcalar.filter(Boolean).join(' ')
}
