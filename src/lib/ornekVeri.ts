import type { YoklamaHucresi } from '@/components/marka/YoklamaSeridi'

/**
 * Yalnız tasarım sistemi vitrininde kullanılan örnek veri.
 * Gerçek ekranlarda kullanılmaz; Faz 1'de sunucudan gelen veriyle değiştirilecek.
 */
const adlar = [
  'Ada Yılmaz', 'Bora Şahin', 'Ceren Demir', 'Deniz Arslan', 'Ece Koç',
  'Furkan Aydın', 'Gökçe Öztürk', 'Hakan Çelik', 'Irmak Güneş', 'İpek Yalçın',
  'Kaan Doğan', 'Lale Kurt', 'Mert Şimşek', 'Nil Aksoy', 'Onur Bulut',
  'Pınar Ateş', 'Rüya Kaplan', 'Sinan Erdem', 'Şule Taş', 'Tuna Polat',
  'Umut Kara', 'Ünsal Barış', 'Verda Ekin', 'Yaren Özkan', 'Zeynep Uçar',
  'Arda Sezer', 'Buse Tekin', 'Cem Yiğit',
]

const durumlar = ['teslim', 'teslim', 'teslim', 'yapmadi', 'teslim', 'teslim', 'bekliyor'] as const

export const ornekYoklama: readonly YoklamaHucresi[] = adlar.map((ad, i) => ({
  ogrenciId: `ornek-${i}`,
  ad,
  ogrenciNo: String(101 + i),
  durum: durumlar[i % durumlar.length] ?? 'bekliyor',
}))
