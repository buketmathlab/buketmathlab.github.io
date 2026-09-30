/**
 * "Konular" sayfasında: gönderilmiş ama teslim süresi dolmamış ödevler.
 *
 * Olay: bir veli (Ayça Hanım) çocuğunun eksik konularının görünmediğini
 * yazdı. Ödev gönderildiği anda o ödevin konu dökümü Ödevler bölümünde
 * görünüyordu; ama Konular sayfası (`kendi_karnem`) yalnız SÜRESİ DOLMUŞ
 * ödevleri sayıyor ve o arada "Henüz değerlendirilmiş ödev yok" diyordu.
 * Çocuk ödevi göndermişken bu cümle yanıltıcı.
 *
 * Sınır sunucuyla aynı: `son_tarih < bugün` değerlendirilmiş; bugün son
 * günse ödev henüz BEKLEYEN (`sureDurumu`: "Bugün son gün" → gecti=false).
 */
import { sureDurumu } from './son-tarih';

export function bekleyenSayisi(
  odevler: ReadonlyArray<{ gonderildi: boolean; son_tarih: string }>,
  bugunIso?: string,
): number {
  return odevler.filter((o) => o.gonderildi && !sureDurumu(o.son_tarih, bugunIso).gecti).length;
}

export function bekleyenMetni(n: number, kime: 'veli' | 'ogrenci'): string {
  if (kime === 'veli') {
    return (
      `${n} ödev gönderildi, teslim süresi henüz dolmadı. ` +
      `${n === 1 ? 'O ödevin' : 'Bu ödevlerin'} eksik konularını Ödevler bölümünde görebilirsiniz; ` +
      'süre dolunca bu sayfaya da eklenecek.'
    );
  }
  return (
    `Gönderdiğin ${n} ödevin teslim süresi henüz dolmadı. ` +
    `Eksik konularını ${n === 1 ? 'o ödevin' : 'her ödevin'} sonucunda görebilirsin; ` +
    'süre dolunca burada da yer alacak.'
  );
}
