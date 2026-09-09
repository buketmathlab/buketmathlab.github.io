/**
 * Vekâlet jetonunun saklanması — saf yardımcı, React'siz.
 *
 * Sahip başka bir öğretmenin hesabına geçtiğinde sunucu YENİ bir jeton
 * veriyor. Kendi hesabına dönebilmesi için eski jetonun bir yerde durması
 * gerekiyor; aksi hâlde dönüş yolu "çıkış yap, PIN'i yeniden gir" olurdu.
 *
 * NEDEN `sessionStorage`: vekâlet oturumu geçici bir durum. Sekme
 * kapanınca dönüş jetonu da gitsin istiyoruz — kalıcı depoda unutulmuş bir
 * sahip jetonu, vekâlet oturumundan daha uzun yaşayan bir anahtar olurdu.
 * Sunucu tarafında zaten iki güvence var: vekâlet oturumu 8 saatlik ve
 * vekâletteyken o kişi adına mesaj gönderilemiyor.
 */

const ANAHTAR = 'sekiz.sahip_jetonu';

export function sahipJetonunuSakla(token: string): void {
  try {
    sessionStorage.setItem(ANAHTAR, token);
  } catch {
    // Depolama kapalıysa vekâlet yine çalışır; yalnız "geri dön" düğmesi
    // çıkmaz ve sahip çıkış yapıp yeniden girer. Sessiz düşmek doğru:
    // vekâlete girememek, ekranı çökertmekten iyidir.
  }
}

export function sahipJetonunuOku(): string | null {
  try {
    return sessionStorage.getItem(ANAHTAR);
  } catch {
    return null;
  }
}

export function sahipJetonunuUnut(): void {
  try {
    sessionStorage.removeItem(ANAHTAR);
  } catch {
    /* yok sayılır */
  }
}
