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
