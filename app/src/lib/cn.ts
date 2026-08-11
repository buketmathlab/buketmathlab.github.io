/** Koşullu sınıf birleştirme. Harici bağımlılık eklememek için yerel. */
export function cn(...parcalar: Array<string | false | null | undefined>): string {
  return parcalar.filter(Boolean).join(' ');
}
