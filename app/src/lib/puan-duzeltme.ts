/**
 * YÖNETİCİ PUAN DÜZELTMESİ (0055) — formun yerel denetimi.
 *
 * Kurallar sunucudakiyle (`puan_duzelt`) AYNI: puan 0–100, sebep 3–500
 * karakter. Burada da denetleniyor ki sahip bir tur beklemeden neyin eksik
 * olduğunu görsün; asıl sınır sunucuda — bu denetim atlanabilir, o atlanamaz.
 *
 * SEBEP ZORUNLU: bir notu elle değiştirmenin nedeni sonradan sorulur ve
 * öğretmen puanın yanında görür.
 */

export const SEBEP_EN_AZ = 3;
export const SEBEP_EN_FAZLA = 500;

export type DuzeltmeSonucu = { puan: number; neden: string } | { hata: string };

export function duzeltmeyiDenetle(puanMetni: string, nedenMetni: string): DuzeltmeSonucu {
  const ham = puanMetni.trim().replace(',', '.');
  // Boş metin Number('') ile 0 olurdu — sessizce 0 puan vermek en kötüsü.
  if (ham === '') return { hata: 'Yeni puanı yazın.' };
  const puan = Number(ham);
  if (!Number.isFinite(puan) || puan < 0 || puan > 100) {
    return { hata: 'Puan 0 ile 100 arasında olmalı.' };
  }
  const neden = nedenMetni.trim();
  if (neden.length < SEBEP_EN_AZ) return { hata: 'Düzeltmenin sebebini yazın.' };
  if (neden.length > SEBEP_EN_FAZLA) {
    return { hata: `Sebep en fazla ${SEBEP_EN_FAZLA} karakter olabilir.` };
  }
  return { puan, neden };
}

/** Öğretmenin gönderim satırında gördüğü işaret metni. */
export function duzeltmeIsareti(neden: string | null | undefined): string {
  return neden ? `Yönetici düzeltti: ${neden}` : 'Yönetici düzeltti';
}
