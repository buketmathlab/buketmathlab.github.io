import type { YoklamaHucresi } from '@/components/marka/YoklamaSeridi'

/**
 * Yalnız tasarım vitrini ve örnek ekranlarda kullanılan veri.
 * Gerçek ekranlarda kullanılmaz; veritabanı kurulduğunda sunucudan gelen
 * veriyle değiştirilecek.
 */

const adlar = [
  'Ada Yılmaz', 'Bora Şahin', 'Ceren Demir', 'Deniz Arslan', 'Ece Koç',
  'Furkan Aydın', 'Gökçe Öztürk', 'Hakan Çelik', 'Irmak Güneş', 'İpek Yalçın',
  'Kaan Doğan', 'Lale Kurt', 'Mert Şimşek', 'Nil Aksoy', 'Onur Bulut',
  'Pınar Ateş', 'Rüya Kaplan', 'Sinan Erdem', 'Şule Taş', 'Tuna Polat',
  'Umut Kara', 'Verda Ekin', 'Yaren Özkan', 'Zeynep Uçar',
]

const durumlar = ['teslim', 'teslim', 'teslim', 'yapmadi', 'teslim', 'teslim', 'bekliyor'] as const

export const ornekYoklama: readonly YoklamaHucresi[] = adlar.map((ad, i) => ({
  ogrenciId: `ornek-${i}`,
  ad,
  ogrenciNo: String(101 + i),
  durum: durumlar[i % durumlar.length] ?? 'bekliyor',
}))

/** Öğretmenin "bugün ilgilenmem gereken ne var?" akışı. */
export const ogretmeninGunu = {
  onayBekleyen: [
    { id: 'a1', ogrenci: 'Nil Aksoy', sinif: '9A', odev: 'Türev — 2. ödev', tur: 'Açık uçlu' },
    { id: 'a2', ogrenci: 'Kaan Doğan', sinif: '9A', odev: 'Türev — 2. ödev', tur: 'Açık uçlu' },
    { id: 'a3', ogrenci: 'Şule Taş', sinif: '10B', odev: 'Limit — 1. ödev', tur: 'Açık uçlu' },
  ],
  yeniGonderim: { sayi: 34, sinif: '3 sınıftan', sonSaat: '17.42' },
  suresiDolan: [
    { id: 'b1', odev: 'Limit — 1. ödev', sinif: '10B', yapmayan: 6, toplam: 27 },
    { id: 'b2', odev: 'Polinom — 3. ödev', sinif: '11A', yapmayan: 2, toplam: 25 },
  ],
  siniflar: [
    { ad: '9A', ogrenci: 24, oran: 0.79, ortalama: 78.4 },
    { ad: '9B', ogrenci: 26, oran: 0.92, ortalama: 81.2 },
    { ad: '10B', ogrenci: 27, oran: 0.63, ortalama: 68.9 },
    { ad: '11A', ogrenci: 25, oran: 0.88, ortalama: 84.1 },
  ],
} as const

/** 9A sınıf panosu. */
export const sinifPanosu = {
  ad: '9A',
  kademe: 9,
  ogrenciSayisi: 24,
  ortalama: 78.4,
  odevler: [
    { id: 'o1', baslik: 'Türev — 1. ödev', konu: 'Türev', tur: 'Test', sonTarih: '12 Eylül', yapan: 19, toplam: 24 },
    { id: 'o2', baslik: 'Türev — 2. ödev', konu: 'Türev', tur: 'Açık uçlu', sonTarih: '19 Eylül', yapan: 22, toplam: 24 },
    { id: 'o3', baslik: 'Limit — tekrar', konu: 'Limit', tur: 'Test', sonTarih: '26 Eylül', yapan: 24, toplam: 24 },
  ],
  zorSorular: [
    { soru: 7, yanlisOran: 0.62 },
    { soru: 12, yanlisOran: 0.54 },
  ],
} as const

/** Öğrencinin bugünü. */
export const ogrencininGunu = {
  ad: 'Ada',
  bugun: {
    baslik: 'Türev — 3. ödev',
    konu: 'Türev',
    tur: 'Test',
    soruSayisi: 15,
    kalanSaat: 6,
    sonTarih: 'bugün 23.59',
  },
  yaklasan: [
    { id: 'y1', baslik: 'Limit — tekrar', konu: 'Limit', ne: '3 gün sonra' },
    { id: 'y2', baslik: 'Polinom — 1. ödev', konu: 'Polinom', ne: '6 gün sonra' },
  ],
  sonPuan: { deger: 86, odev: 'Türev — 2. ödev', dogru: 12, yanlis: 2, bos: 1 },
  konular: [
    { ad: 'Limit', oran: 0.9 },
    { ad: 'Polinom', oran: 0.74 },
    { ad: 'Türev', oran: 0.45 },
  ],
  seri: 4,
} as const

/** Velinin özeti — sayı değil cümle. */
export const velininOzeti = {
  ogrenci: 'Ada',
  haftaCumlesi: 'Bu hafta iki ödev verildi, ikisi de yapıldı.',
  sonGonderim: { odev: 'Türev — 2. ödev', puan: 86, ne: 'dün 21.10' },
  bekleyen: { odev: 'Türev — 3. ödev', ne: 'bugün 23.59' },
  calisilacakKonu: 'Türev',
  ogretmenMesaji: 'Ada türev sorularında hız kazandı, tebrik ederim.',
} as const
