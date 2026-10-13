/**
 * Deneme hesabına tek tıkla geçiş — saf yardımcı, React'siz.
 *
 * Öğretmenin isteği: "Öğretmen ve müdür hesaplarının olduğu yerden deneme
 * hesabı açabileyim ve ordan tıklayınca anında deneme hesaplarına giriş
 * yapabileyim."
 *
 * Geçiş, gerçek bir öğrencinin ya da velinin yaptığı girişin AYNISI:
 * `giris` ucu deneme koduyla çağrılıyor ve sunucu sıradan bir öğrenci/veli
 * oturumu açıyor. Ayrı bir "sahip öğrenci gibi gezinsin" yetkisi YOK —
 * birebir olması istenen şey de bu; sunucuda yeni bir kapı açılmıyor.
 *
 * Dönüş yolu vekâletle aynı depoda: sahibin jetonu `sessionStorage`'da
 * (gerekçe `lib/vekalet.ts`'te). Yanına deneme öğrencinin kimliği
 * yazılıyor: şerit yalnız O öğrencinin oturumunda çıksın. Sahip "Çıkış"a
 * basıp aynı sekmede gerçek bir öğrenci girerse şerit görünmemeli.
 */
import { sahipJetonunuOku, sahipJetonunuSakla, sahipJetonunuUnut } from '@/lib/vekalet';

const ANAHTAR = 'sekiz.deneme_ogrenci';

export function denemeyeGecildi(sahipJetonu: string, ogrenciId: string): void {
  sahipJetonunuSakla(sahipJetonu);
  try {
    sessionStorage.setItem(ANAHTAR, ogrenciId);
  } catch {
    /* depolama kapalı: şerit çıkmaz, sahip çıkış yapıp PIN'le döner */
  }
}

/** Bu oturum, sahibin tek tıkla açtığı deneme oturumu mu? */
export function denemeOturumuMu(ogrenciId: string | undefined): boolean {
  if (!ogrenciId) return false;
  try {
    return sessionStorage.getItem(ANAHTAR) === ogrenciId;
  } catch {
    return false;
  }
}

/** Dönüş jetonunu verir ve iki kaydı da siler: dönüş tek seferlik. */
export function denemedenDon(): string | null {
  const jeton = sahipJetonunuOku();
  sahipJetonunuUnut();
  try {
    sessionStorage.removeItem(ANAHTAR);
  } catch {
    /* yok sayılır */
  }
  return jeton;
}
