/**
 * GÖNDERMEYENE EK SÜRE CÜMLELERİ (0084) — React'siz, doğrudan test edilebilir.
 *
 * Öğretmenin isteği: "Son teslim tarihi içerisinde ödevini göndermeyen
 * öğrenciye daha sonradan sadece o öğrenci bazında gönderme hakkı
 * verebilen bir seçeneğim olsun."
 *
 * -----------------------------------------------------------------------------
 * SEBEP ÖĞRENCİYE GİDİYOR — ve öğretmen bunu ÖNCEDEN biliyor
 *
 * Öğretmenin kararı: öğrenci haberdar olsun. Hakkının verildiğini
 * bilmeyen öğrenci onu kullanmaz. Bu yüzden diyalogda `SEBEP_UYARISI`
 * var — 0081'deki aynı gerekçeyle: olmasaydı öğretmen oraya kendine not
 * yazar ve notu öğrenci okurdu.
 *
 * -----------------------------------------------------------------------------
 * MESAJ CÜMLESİ SUNUCUDAKİYLE BİREBİR
 *
 * Mesajı SUNUCU yazıyor (`ogrencilere_ek_sure`, aynı işlemde). Buradaki
 * kopya yalnız ÖNİZLEME; testi ikisinin aynı kaldığını migration'ın
 * GERÇEK metnini okuyarak sabitliyor.
 */

import { gunMetni, noktali } from './iptal-metni';

export const BASLIK = 'Seçilenlere ek süre ver';

export const ACIKLAMA =
  'Seçtiğiniz öğrenciler, sınıfın süresi dolmuş olsa bile ' +
  'aşağıda verdiğiniz tarihe kadar ödevi gönderebilir.';

/** Diyalogdaki uyarı — sebep öğrenciye gidiyor. */
export const SEBEP_UYARISI =
  'Yazdığınız sebep öğrenciye mesaj olarak gönderilir.';

export const TARIH_ETIKETI = 'Son gönderim tarihi';
export const TARIH_EKSIK = 'Son gönderim tarihini seçin.';
export const TARIH_GECMIS = 'Son gönderim tarihi bugünden önce olamaz.';
export const SEBEP_EKSIK = 'Ek süre vermenin sebebini yazın.';
export const OGRENCI_EKSIK = 'En az bir öğrenci seçin.';

/** Göndermeyenler bölümündeki düğmenin yanındaki sayaç. */
export function secimSayaci(adet: number): string | null {
  return adet === 0 ? null : `${adet} öğrenci seçildi`;
}

/**
 * Diyalogda kime verildiği yazılı.
 *
 * Adlar tek tek yazılıyor: "3 öğrenciye" demek, yanlış öğrenci
 * işaretlendiğinde öğretmenin bunu fark etmesini imkânsız kılardı.
 */
export function kimlereMetni(adlar: readonly string[]): string {
  if (adlar.length === 0) return '';
  return adlar.join(', ');
}

/**
 * Öğrenciye gidecek mesajın önizlemesi.
 *
 * SUNUCUDAKİ CÜMLENİN AYNISI (`0084_gondermeyene_ek_sure.sql`). Tarih
 * orada `DD.MM.YYYY` biçiminde yazılıyor; burada da öyle.
 */
export function ekSureMesaji(
  odevAdi: string | null | undefined,
  sebep: string,
  sonTarih: string | null | undefined,
): string {
  const ad = (odevAdi ?? '').trim() === '' ? 'Ödev' : (odevAdi as string).trim();
  return (
    `${ad} ödevi için sana ${noktali(sonTarih)} tarihine kadar ek süre verildi. ` +
    `Öğretmeninin notu: ${sebep.trim()} ` +
    'Çözümünü bu tarihe kadar gönderebilirsin.'
  );
}

/** Kaydettikten sonraki bildirim — kime ve hangi tarihe kadar. */
export function sonucMetni(adlar: readonly string[], sonTarih: string): string {
  const g = gunMetni(sonTarih);
  const kim = adlar.length === 1 ? adlar[0] : `${adlar.length} öğrenci`;
  return g === null
    ? `${kim} için ek süre verildi.`
    : `${kim} ${g} tarihine kadar gönderebilir.`;
}
