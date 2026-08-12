/** Veritabanı RPC'lerinin dönüş tipleri. supabase/migrations ile eşleşir. */

export type Rol = 'ogretmen' | 'ogrenci' | 'veli';

export type GirisSonucu =
  | { rol: 'kurulum' }
  | { rol: 'yok' }
  | { rol: 'ogretmen'; token: string }
  | {
      rol: 'ogrenci' | 'veli';
      token: string;
      ogrenci: { id: string; ad: string; tur: string; sinif: string | null };
    };

export type Pano = {
  ogrenci_sayisi: number;
  acik_odev: number;
  bekleyen_degerlendirme: number;
  gecikmis_eksik: number;
  son_gonderimler: Array<{
    ogrenci: string;
    odev: string;
    puan: number | null;
    zaman: string;
    gecikmeli: boolean;
  }>;
};

export type Sinif = {
  id: string;
  ad: string;
  seviye: number;
  sube: string;
  arsiv: boolean;
  ogrenci_sayisi: number;
};

export type OgrenciSatiri = {
  id: string;
  ad: string;
  tur: 'okul' | 'ozel';
  sinif: string | null;
};

export type OgrenciListesi = {
  toplam: number;
  sayfa: number;
  toplam_sayfa: number;
  kayitlar: OgrenciSatiri[];
};

export type YeniOgrenci = {
  id: string;
  ogrenci_kodu: string;
  veli_kodu: string;
};

export type Kodlar = { ogrenci?: string; veli?: string };

export type OdevSatiri = {
  id: string;
  baslik: string;
  aciklama: string | null;
  tur: 'test' | 'acik';
  sinif_id: string;
  sinif: string;
  son_tarih: string;
  soru_sayisi: number | null;
  /** Son tarih geçtikten sonra teslim alınıyor mu (migration 0010). */
  gec_teslim: boolean;
  /** 4 (A–D) ya da 5 (A–E). */
  sik_sayisi: number;
  yayinda: boolean;
  olusturma: string;
  /** Dosyanın kendisi değil, varlığı. Yol yalnız gerektiğinde istenir. */
  odev_pdf_var: boolean;
  anahtar_pdf_var: boolean;
  gonderim_sayisi: number;
  /** Son tarihten SONRA gelen teslim sayısı (migration 0010). */
  gec_gonderim_sayisi: number;
  sinif_mevcudu: number;
};

/** Öğrencinin kendi gönderimi. Puan yalnız test ödevinde dolu olur. */
export type OgrenciGonderim = {
  id: string;
  zaman: string;
  durum: string;
  dogru: number | null;
  yanlis: number | null;
  bos: number | null;
  puan: number | null;
  ogretmen_puan: number | null;
  ogretmen_yorum: string | null;
  /** Öğrencinin kendi verdiği cevaplar — hangi soruyu kaçırdığını görebilsin. */
  cevaplar: Record<string, string>;
  /** Son tarihten sonra mı gönderildi. Sunucuda türetiliyor, saklanmıyor. */
  gecikmeli: boolean;
};

/**
 * `ogrenci_odevleri` içindeki tek ödev.
 *
 * `cevap_anahtari` ve `anahtar_yolu` TİPTE DE `null` OLABİLİR: sunucu bu iki
 * alanı yalnız öğrenci teslim ettiyse dolduruyor (migration 0007). Tipin
 * bunu yansıtması bilinçli — "her zaman var" diye yazılmış bir arayüz kodu
 * derlenmesin.
 */
export type OgrenciOdev = {
  id: string;
  baslik: string;
  aciklama: string | null;
  tur: 'test' | 'acik';
  son_tarih: string;
  soru_sayisi: number | null;
  gec_teslim: boolean;
  /** 4 (A–D) ya da 5 (A–E). Öğrenci ızgarası kaç düğme çizeceğini buradan bilir. */
  sik_sayisi: number;
  /** Soru PDF'i. Teslimden bağımsız, yayındaki ödevde her zaman var. */
  odev_yolu: string | null;
  gonderim: OgrenciGonderim | null;
  cevap_anahtari: Record<string, string> | null;
  anahtar_yolu: string | null;
};

export type OgrenciOdevleri = {
  ogrenci: { id: string; ad: string; sinif: string | null };
  odevler: OgrenciOdev[];
  dersler: Array<{ zaman: string; mod: string; link: string | null }>;
};
