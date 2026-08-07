/**
 * Alan modeli — veritabanı Türkçe adlandırılmıştır, tipler de öyle.
 * Bu dosya Faz 1'deki şema ile birlikte kesinleşecek; Faz 0'da ekranların
 * konuşacağı sözlüğü sabitler.
 */

/** Okul öğrencisi mi, özel ders öğrencisi mi — ürünün en kritik ayrımı. */
export type OgrenciTipi = 'okul' | 'ozel'

/** Kimin gözünden bakıyoruz. */
export type Rol = 'ogretmen' | 'ogrenci' | 'veli'

export type Kademe = 9 | 10 | 11 | 12

export type Sinif = {
  id: string
  ad: string // "9A"
  kademe: Kademe
  aciklama: string | null
  arsivli: boolean
  ogrenci_sayisi?: number
}

export type Ogrenci = {
  id: string
  ad: string
  ogrenci_no: string // 200 öğrencide birincil ayırt edici
  tip: OgrenciTipi
  sinif_id: string | null
  sinif_adi?: string | null
  aktif: boolean
}

/** Ödev türü: test otomatik puanlanır, açık uçlu öğretmen onayı bekler. */
export type OdevTuru = 'test' | 'acik'

export type Odev = {
  id: string
  baslik: string
  konu: string | null // Türev, Limit…
  tur: OdevTuru
  sinif_id: string | null
  kademe: Kademe | null
  soru_sayisi: number
  /**
   * Son teslim anı. Bu an geçtikten sonra gönderim KAPANIR — geç teslim yoktur.
   * Kural sunucuda uygulanır (Faz 1): son tarihten sonra gelen gönderim reddedilir,
   * öğrenci "yapmadı" sayılır.
   */
  son_tarih: string
  soru_pdf_url: string | null // öğrenci baştan görür
  anahtar_pdf_url: string | null // yalnız gönderim sonrası açılır
  yayinda: boolean
}

/** Yapay zekâ denetimi (Faz 5) — alanlar Faz 1'de hazır açılır. */
export type AiDenetimDurumu = 'beklemede' | 'temiz' | 'incelenmeli' | 'kapali'

export type Gonderim = {
  id: string
  odev_id: string
  ogrenci_id: string
  gonderim_zamani: string
  puan: number | null
  onaylandi: boolean
  foto_url: string | null
  ai_denetim_durumu: AiDenetimDurumu
  ai_denetim_notu: string | null
}

/**
 * Sınıf panosundaki sekizgen yoklama şeridinin hücre durumu.
 * Geç teslim diye bir durum yoktur: süre dolduğunda ödev ya yapılmıştır ya yapılmamıştır.
 * `bekliyor` yalnız son tarihi henüz gelmemiş ödevler içindir.
 */
export type YoklamaDurumu = 'teslim' | 'yapmadi' | 'bekliyor'

/** Her etkileşimin dört hâli: boş · yükleniyor · hata · dolu. */
export type VeriDurumu = 'yukleniyor' | 'bos' | 'hata' | 'dolu'
