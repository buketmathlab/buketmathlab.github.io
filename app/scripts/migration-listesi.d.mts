/**
 * `migration-listesi.mjs` için tip bildirimi.
 *
 * Üretici sade bir Node betiği (derleme hattının dışında çalışıyor), ama
 * TEST ONU ÇAĞIRIYOR: listeyi testte yeniden türetseydik üreticinin
 * kusurlarını ölçemezdik. Çağırabilmek için imzası burada.
 */
export type MigrationKaydi = { no: string; dosya: string };
export function migrationlariOku(dizin?: string): MigrationKaydi[];
export function dosyaMetni(liste: MigrationKaydi[]): string;
