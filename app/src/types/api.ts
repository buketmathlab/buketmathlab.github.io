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
  /** Sınıfına en az bir ödev yayınlanmış öğrenci sayısı (migration 0015). */
  odev_verilen_ogrenci: number;
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
  /** Özel ders grubu. Kimlik değil, ödev hedefleme aracı (migration 0012). */
  ozel: boolean;
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
  sinif_ozel: boolean;
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
  /**
   * Ortalamalar YALNIZ son tarih geçtikten sonra dolu; öncesinde `null`.
   * `yapan` gönderenlerin ortalaması, `tum` göndermeyeni 0 sayar.
   */
  ortalama_yapan: number | null;
  ortalama_tum: number | null;
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
  /**
   * Öğrencinin sınıfı arşivde mi (migration 0016).
   *
   * Ödev GİZLENMİYOR — öğrenci geçmişini ve puanını görmeye devam ediyor.
   * Yalnız yeni gönderim kapalı; arayüz nedenini önden söylesin diye burada.
   * Kararın kendisi sunucuda: `odev_gonder` arşivdeki sınıfı reddediyor.
   */
  sinif_arsiv: boolean;
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

/** `odev_gonderimleri` içindeki tek satır — sınıftaki HER öğrenci için bir tane. */
export type GonderimSatiri = {
  ogrenci_id: string;
  ogrenci: string;
  /** Göndermeyen öğrencide null. Satır yine de listede yer alır. */
  gonderim_id: string | null;
  gonderdi: boolean;
  zaman: string | null;
  gecikmeli: boolean;
  durum: 'incelemede' | 'onaylandi' | 'puanlandi' | null;
  dogru: number | null;
  yanlis: number | null;
  bos: number | null;
  puan: number | null;
  ogretmen_puan: number | null;
  ogretmen_yorum: string | null;
  /** Dosyanın kendisi değil, varlığı. Yol `gonderim_foto_yolu` ile istenir. */
  foto_var: boolean;
};

export type OdevGonderimleri = {
  odev: {
    id: string;
    baslik: string;
    tur: 'test' | 'acik';
    sinif: string;
    son_tarih: string;
    soru_sayisi: number | null;
    gec_teslim: boolean;
    yayinda: boolean;
  };
  ozet: {
    mevcut: number;
    gonderen: number;
    gecikmeli: number;
    puan_bekleyen: number;
  };
  satirlar: GonderimSatiri[];
};

/** `sinif_ogrencileri` — bir öğrencinin ödev karnesi (migration 0013). */
export type SinifOgrencisi = {
  id: string;
  ad: string;
  tur: 'okul' | 'ozel';
  yapti: number;
  yapmadi: number;
  /** Yalnız yaptığı ödevlerin ortalaması. Hiç yapmadıysa null — 0 değil. */
  ortalama_yapan: number | null;
  /** Yapmadıkları 0 sayılarak tüm ödevlerin ortalaması. */
  ortalama_tum: number | null;
};

export type SinifDetayi = {
  sinif: { id: string; ad: string; ozel: boolean; arsiv: boolean };
  /** Ortalamaların hesaplandığı ödev sayısı: yayında VE süresi dolmuş. */
  degerlendirilen_odev: number;
  ogrenciler: SinifOgrencisi[];
};

/** `pano_detay` satırı. Alanlar türe göre dolu; zarf dört tür için aynı. */
export type PanoSatiri = {
  ad: string;
  /** gondermeyen: eksik ödev sayısı */
  eksik?: number;
  /** acik_odev */
  id?: string;
  son_tarih?: string;
  gonderim_sayisi?: number;
  /** puan_bekleyen */
  odev?: string;
  odev_id?: string;
  zaman?: string;
};

export type PanoDetayi = {
  tur: string;
  baslik: string;
  aciklama: string;
  toplam: number;
  gruplar: Array<{ sinif: string; ozel: boolean; satirlar: PanoSatiri[] }>;
};
