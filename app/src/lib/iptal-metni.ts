/**
 * GÖNDERİM İPTALİ CÜMLELERİ (0081) — React'siz, doğrudan test edilebilir.
 *
 * Gerçek olay: öğrenci çözüm sayfalarını kaybetmiş, "özür dilerim" yazıp
 * boş sayfalar göndermiş. Öğretmen gönderimi kabul etmek istemiyor.
 *
 * -----------------------------------------------------------------------------
 * SEBEP ÖĞRENCİYE GİDİYOR — ve öğretmen bunu ÖNCEDEN biliyor
 *
 * 0056'da iptal sessizdi: gönderim öğrencinin ekranından kayboluyor,
 * öğrenci ne olduğunu bilmiyordu. Artık yazılan sebep öğrenciye mesaj
 * olarak gidiyor.
 *
 * Bu yüzden diyalogda `SEBEP_UYARISI` var. Olmasaydı öğretmen oraya
 * kendine not yazar ("bu çocuk sürekli yapıyor") ve notu öğrenci okurdu.
 *
 * -----------------------------------------------------------------------------
 * MESAJ CÜMLESİ SUNUCUDAKİYLE BİREBİR
 *
 * Mesajı SUNUCU yazıyor (`gonderimi_yeniden_ac`, aynı işlemde — mesaj
 * yazılamazsa iptal de olmaz). Buradaki kopya yalnız ÖNİZLEME ve testi
 * ikisinin aynı kaldığını sabitliyor; ayrışırlarsa öğretmenin gördüğü
 * önizleme ile öğrencinin aldığı mesaj farklı olurdu.
 */

import { gunFarki } from './son-tarih';

/** Diyalogdaki uyarı — sebep öğrenciye gidiyor. */
export const SEBEP_UYARISI =
  'Yazdığınız sebep öğrenciye mesaj olarak gönderilir.';

export const TARIH_ETIKETI = 'Yeni son tarih';
export const TARIH_EKSIK = 'Yeni son tarihi seçin.';
export const TARIH_GECMIS = 'Yeni son tarih bugünden önce olamaz.';

/** Gönderim listesinde gecikmeli etiketinin yanında. */
export function ekSureEtiketi(tarih: string | null | undefined): string | null {
  const g = gunMetni(tarih);
  return g === null ? null : `ek süre verildi · ${g}`;
}

/** Öğrencinin ekranında, sınıf tarihi geçmiş olsa bile. */
export function ogrenciEkSure(tarih: string | null | undefined): string | null {
  const g = gunMetni(tarih);
  return g === null ? null : `Sana verilen süre: ${g}`;
}

/**
 * Kişisel süre HÂLÂ AÇIK MI — bugün dâhil.
 *
 * SUNUCUDAKİ KAPININ EKRANDAKİ KARŞILIĞI (`odev_gonder`,
 * `0081_gonderim_iptali.sql`: `bugün <= e.son_tarih`). Ekran bunu
 * bilmezse sınıfın tarihi geçmiş öğrenciye "Teslim kapandı" yazar ve
 * gönderme düğmesini kapatırdı — sunucu kabul ederken. Kararı yine
 * sunucu veriyor; buradaki hesap yalnız ekranı doğru tutuyor.
 *
 * Tarih yoksa `false` — ek süre verilmemiş demektir, bugünkü davranış.
 */
export function ekSureAcik(
  tarih: string | null | undefined,
  bugunIso?: string,
): boolean {
  if (gunMetni(tarih) === null) return false;
  return gunFarki(tarih as string, bugunIso) >= 0;
}

const GUN = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * `YYYY-MM-DD` → "25 Ekim 2026". Okunamayan değerde `null` — ekranda
 * "Invalid Date" yazmasındansa hiç yazmamak doğru.
 */
export function gunMetni(tarih: string | null | undefined): string | null {
  if (!tarih) return null;
  const d = new Date(`${tarih}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : GUN.format(d);
}

/**
 * Öğrenciye gidecek mesajın önizlemesi.
 *
 * SUNUCUDAKİ CÜMLENİN AYNISI (`0081_gonderim_iptali.sql`). Tarih orada
 * `DD.MM.YYYY` biçiminde yazılıyor; burada da öyle — iki ayrı biçim,
 * öğretmene gösterilen önizlemeyi yanlış yapardı.
 */
export function iptalMesaji(
  odevAdi: string | null | undefined,
  sebep: string,
  sonTarih: string | null | undefined,
): string {
  const ad = (odevAdi ?? '').trim() === '' ? 'Ödev' : (odevAdi as string).trim();
  return (
    `${ad} ödevinin gönderimi iptal edildi. ` +
    `Öğretmeninin notu: ${sebep.trim()} ` +
    `Yeni son tarih: ${noktali(sonTarih)}. ` +
    'Çözümünü bu tarihe kadar yeniden gönderebilirsin.'
  );
}

/** `YYYY-MM-DD` → `DD.MM.YYYY` (sunucudaki `to_char(..., 'DD.MM.YYYY')`). */
export function noktali(tarih: string | null | undefined): string {
  const p = (tarih ?? '').split('-');
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : '';
}
