/**
 * Boş cevapla gönderme uyarısı — saf mantık.
 *
 * Olay (öğretmenin öğrencisi): cevaplar işaretlenmiş sanıldı ama gönderim
 * BOŞ kaydedildi; 51 sorunun 51'i "boş", puan 0. Ekranda küçük bir
 * "0/51 soru işaretlendi" etiketi vardı ama "Gönder" hiçbir şey sormadan
 * gönderiyordu. Gönderim sonradan değiştirilemediği için bu an, sormanın
 * tek fırsatı.
 *
 * Boş soru yoksa `null`: hiçbir şey sorulmaz, akış bugünkü gibi.
 */
export type BosCevapUyarisi = {
  bos: number;
  toplam: number;
  hepsiBos: boolean;
  baslik: string;
  metin: string;
};

export function bosCevapUyarisi(
  soruSayisi: number,
  cevaplar: Readonly<Record<number, string>>,
): BosCevapUyarisi | null {
  if (!Number.isInteger(soruSayisi) || soruSayisi < 1) return null;
  let bos = 0;
  for (let i = 1; i <= soruSayisi; i++) if (!cevaplar[i]) bos++;
  if (bos === 0) return null;

  const hepsiBos = bos === soruSayisi;
  return {
    bos,
    toplam: soruSayisi,
    hepsiBos,
    baslik: `${soruSayisi} sorudan ${bos}'${ek(bos)} boş`,
    metin: hepsiBos
      ? 'Hiç soru işaretlemedin. Böyle gönderirsen puanın 0 olur ve gönderimi sonradan değiştiremezsin. ' +
        'Cevaplarını işaretlediysen ve burada görmüyorsan sayfa yenilenmiş olabilir; geri dönüp yeniden işaretle.'
      : 'Boş sorular puan almaz. Gönderdikten sonra cevaplarını değiştiremezsin.',
  };
}

/**
 * Sayıya gelen iyelik eki: "51'i", "3'ü", "10'u", "6'sı" … Türkçe ses
 * uyumu sayının OKUNUŞUNUN son hecesine bakar.
 */
export function ek(n: number): string {
  const son = Math.abs(n) % 10;
  const onlar = Math.abs(n) % 100;
  if (n === 0) return 'ı';
  if (son === 0) {
    // 10 on-u, 20 yirmi-si, 30 otuz-u, 40 kırk-ı, 50 elli-si, 60 altmış-ı,
    // 70 yetmiş-i, 80 seksen-i, 90 doksan-ı; 100 yüz-ü, 1000 bin-i.
    if (onlar === 0) return Math.abs(n) % 1000 === 0 ? 'i' : 'ü';
    return ({ 10: 'u', 20: 'si', 30: 'u', 40: 'ı', 50: 'si', 60: 'ı', 70: 'i', 80: 'i', 90: 'ı' } as Record<number, string>)[onlar]!;
  }
  // 1 bir-i, 2 iki-si, 3 üç-ü, 4 dört-ü, 5 beş-i, 6 altı-sı, 7 yedi-si,
  // 8 sekiz-i, 9 dokuz-u
  return ['', 'i', 'si', 'ü', 'ü', 'i', 'sı', 'si', 'i', 'u'][son]!;
}
