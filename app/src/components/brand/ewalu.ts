/**
 * Ewalu katalogu — hangi poz nerede kullanılır.
 *
 * Poz eşlemesi kaynak dosyalar TEK TEK AÇILARAK doğrulandı, dosya adından
 * tahmin edilmedi.
 *
 * Ewalu bir ASİSTANDIR, ürünün kahramanı değil (Part VII). Karakteri her
 * ekrana koymak yasak; yalnız kişilik ya da açıklık kattığı yerde görünür.
 */

export const EWALU_POZLARI = {
  karsilama: {
    ad: 'Karşılama',
    alt: 'Ewalu, bere ve gözlüğüyle gülümsüyor',
    nerede: 'Karşılama, ilk kurulum, giriş ekranı, landing tanıtımı',
  },
  kesif: {
    ad: 'Keşif',
    alt: 'Ewalu, şapkası ve haritasıyla yolunu arıyor',
    nerede: 'Boş durumlar — henüz ödev yok, henüz mesaj yok, henüz sınıf yok',
  },
  kutlama: {
    ad: 'Kutlama',
    alt: 'Ewalu, kolunu havaya kaldırmış seviniyor',
    nerede: 'Ödev teslim edildi, tüm ödevler tamam, başarı anları',
  },
  calisma: {
    ad: 'Çalışma',
    alt: 'Ewalu, ceketi ve kalemiyle defterine yazıyor',
    nerede: 'Ödev hatırlatması, değerlendirme bekleniyor, çalışma bağlamı',
  },
} as const;

export type EwaluPoz = keyof typeof EWALU_POZLARI;

export const PORTRE_BOYUTLARI = [128, 256, 512] as const;
export const TAM_BOYUTLARI = [640, 1200] as const;
