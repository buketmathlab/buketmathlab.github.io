/**
 * KARDEŞ ŞUBELERE YAYMA — EKRANDA GÖRÜNEN CÜMLELER (0031; 0088 son tarih).
 *
 * Öğretmenin bildirimi: "Bir sınıfa yaptığım değişiklik diğer şubelere de
 * uygulansın dediğimde uygulanmıyor. Her şubeyi tek tek düzeltmem
 * gerekiyor." Sebep kırık kod değildi: yayma 0031'den beri son tarihi
 * BİLEREK taşımıyordu. 0088 onu seçenekli yaptı, varsayılan açık.
 *
 * METİNLER NEDEN BURADA: aynı cümleler hem kartta, hem onay penceresinde,
 * hem raporda geçiyor. İki yere kopyalanan bir cümlenin biri değişip
 * diğeri kalır ve öğretmen aynı kuralı iki farklı biçimde okur
 * (`YUKLEME_IPUCU` dersi).
 *
 * 0088 ÇALIŞMAMIŞ SUNUCUDA: `son_tarih` ve rapor alanları hiç gelmez;
 * buradaki her cümle o durumda `null` dönüyor ve ekran bugünkü hâlinde
 * kalıyor. Tarih UYDURULMUYOR.
 */

import { gunYaz } from '@/lib/odev-tarihleri';
import type { KardesDetay, YaymaRaporu } from '@/types/api';

/** Onay kutusunun başlığı. */
export const SON_TARIH_KUTUSU = 'Son tarihi de bu şubelere uygula';

/**
 * Kutunun altındaki açıklama — iki yönü de söylüyor.
 *
 * VARSAYILAN AÇIK, çünkü öğretmenin bildirdiği sorun buydu. Ama kapalı
 * hâli de anlamlı: şubelerin dersi farklı günlerdeyse tarihleri zorla
 * eşitlemek yanlış olurdu. Kutu, o iki durumu da öğretmenin eline
 * veriyor; metin hangisinde ne olacağını açıkça yazıyor.
 */
export function sonTarihKutuAciklamasi(acik: boolean, kaynakTarih: string | null | undefined): string {
  const gun = gunYaz(kaynakTarih);
  return acik
    ? `Bu şubelerin son tarihi ${gun ?? 'buradaki tarih'} olacak. Öğrenciler ve veliler tarihin uzatıldığını ödev sayfasında görecek.`
    : 'Her şube kendi son tarihini koruyacak; yalnız içerik eşitlenecek.';
}

/** Onay penceresinde "neler taşınıyor" — kutuya göre değişiyor. */
export function tasinacaklarMetni(sonTarihDe: boolean): string {
  const temel =
    'Taşınacaklar: başlık, açıklama, cevap anahtarı, soru ve şık sayısı, ' +
    'sayfa sayısı, konular, iki PDF';
  return sonTarihDe ? `${temel} ve SON TARİH.` : `${temel}.`;
}

/** Onay penceresinde "neler taşınmıyor" — kutuya göre değişiyor. */
export function tasinmayacaklarMetni(sonTarihDe: boolean): string {
  return sonTarihDe
    ? 'Taşınmayacaklar: geç teslim izni ve yayında olma durumu. Her şubenin kendi programı korunuyor.'
    : 'Taşınmayacaklar: son tarih, geç teslim izni ve yayında olma durumu. Her şubenin kendi programı korunuyor.';
}

/**
 * Kardeş satırında o şubenin KENDİ son tarihi — "Son teslim: 5 Kasım 2026".
 *
 * 0088 çalışmamışsa (`son_tarih` gelmez) `null`: boş bir "Son teslim:"
 * yazmak, tarihi okuyamadığımızı değil tarih olmadığını düşündürürdü.
 */
export function kardesTarihSatiri(k: KardesDetay): string | null {
  const gun = gunYaz(k.son_tarih);
  return gun === null ? null : `Son teslim: ${gun}`;
}

/**
 * Raporda tarih değişimi — "Son tarih 1 Kasım 2026 → 5 Kasım 2026 oldu".
 *
 * Yalnız GERÇEKTEN değiştiyse; sunucu değişmediğinde iki alanı da null
 * gönderiyor. Değişmediği hâlde "değişti" demek öğretmeni yanıltırdı.
 */
export function raporTarihSatiri(s: YaymaRaporu): string | null {
  const eski = gunYaz(s.son_tarih_eski);
  const yeni = gunYaz(s.son_tarih_yeni);
  if (eski === null || yeni === null) return null;
  return `Son tarih ${eski} → ${yeni} oldu.`;
}
