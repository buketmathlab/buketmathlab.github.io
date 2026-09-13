/**
 * ÜRETİLMİŞ DOSYA — ELLE DÜZENLEMEYİN.
 * Üreten: app/scripts/migration-listesi.mjs  (npm run migration-listesi)
 *
 * Depodaki migration dosyaları. Sürüm defteri ekranı bunu veritabanının
 * defteriyle karşılaştırıp "çalıştırılmamış dosyalar"ı buluyor.
 */
export type MigrationKaydi = { no: string; dosya: string };

export const MIGRATION_LISTESI: readonly MigrationKaydi[] = [
  { no: '0001', dosya: '0001_temel_sema.sql' },
  { no: '0002', dosya: '0002_yetkiler_rls.sql' },
  { no: '0003', dosya: '0003_guvenlik_fonksiyonlari.sql' },
  { no: '0004', dosya: '0004_rpc_katmani.sql' },
  { no: '0005', dosya: '0005_fonksiyon_yetkileri.sql' },
  { no: '0006', dosya: '0006_baslangic_verisi.sql' },
  { no: '0007', dosya: '0007_odev_pdf.sql' },
  { no: '0008', dosya: '0008_odev_duzenleme.sql' },
  { no: '0009', dosya: '0009_ogrenci_cozum_yukleme.sql' },
  { no: '0010', dosya: '0010_gec_teslim.sql' },
  { no: '0011', dosya: '0011_gonderim_takibi.sql' },
  { no: '0012', dosya: '0012_ozel_ders_sinifi.sql' },
  { no: '0013', dosya: '0013_ogrenci_istatistik.sql' },
  { no: '0014', dosya: '0014_ozel_sinif_korumasi.sql' },
  { no: '0015', dosya: '0015_pano_detay.sql' },
  { no: '0016', dosya: '0016_arsiv_her_yerde.sql' },
  { no: '0017', dosya: '0017_sinif_kodlari.sql' },
  { no: '0018', dosya: '0018_sinif_kodlari_kaldirildi.sql' },
  { no: '0019', dosya: '0019_veliler_ve_mesajlasma.sql' },
  { no: '0020', dosya: '0020_konu_analizi.sql' },
  { no: '0021', dosya: '0021_ozel_ders_takibi.sql' },
  { no: '0022', dosya: '0022_bildirim_sayilari.sql' },
  { no: '0023', dosya: '0023_konu_karnesi.sql' },
  { no: '0024', dosya: '0024_toplu_ogrenci.sql' },
  { no: '0025', dosya: '0025_iki_yazisma.sql' },
  { no: '0026', dosya: '0026_kendi_karnem.sql' },
  { no: '0027', dosya: '0027_bosluk_kirpma.sql' },
  { no: '0028', dosya: '0028_giris_kilidi.sql' },
  { no: '0029', dosya: '0029_genel_ortalama.sql' },
  { no: '0030', dosya: '0030_coklu_sinif_odev.sql' },
  { no: '0031', dosya: '0031_kardes_yayma.sql' },
  { no: '0032', dosya: '0032_ewalu_mesajlari.sql' },
  { no: '0033', dosya: '0033_ogretmen_kimligi.sql' },
  { no: '0034', dosya: '0034_veli_onami.sql' },
  { no: '0035', dosya: '0035_onam_metni_v4.sql' },
  { no: '0036', dosya: '0036_onam_metni_v5.sql' },
  { no: '0037', dosya: '0037_onam_metni_v6.sql' },
  { no: '0038', dosya: '0038_onam_veli_adi_ve_dokum.sql' },
  { no: '0039', dosya: '0039_okul_bilgilendirme.sql' },
  { no: '0040', dosya: '0040_donem_analizi.sql' },
  { no: '0041', dosya: '0041_surum_defteri.sql' },
];
