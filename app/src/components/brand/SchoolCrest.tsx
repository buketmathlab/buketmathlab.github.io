type Props = {
  /** Piksel cinsinden kenar. 96'nın altına inilemez — aşağıdaki nota bakın. */
  boyut?: 96 | 120 | 160 | 240 | 320;
  className?: string;
};

const TAM_AD = 'Beşiktaş Arnavutköy Korkmaz Yiğit Anadolu Lisesi';

/**
 * Okul mührü.
 *
 * NEDEN BOYUT KISITLI: Mühür çok detaylı — dış halkada okul adı, içeride
 * köprü, bina, meşale, defne dalları ve "MATEMATİK" yazısı var. 48px'in
 * altında bu detaylar okunmaz hâle gelir. Mührü yeniden çizmek yasak
 * olduğuna göre (Kural 8) doğru çözüm kullanım boyutunu sınırlamaktır.
 *
 * Küçük bağlamlarda (header, favicon, avatar) okul mührü DEĞİL, SEKİZ marka
 * işareti kullanılır. Bu kural yorumla değil, tip sistemiyle uygulanır:
 * `boyut` propu 96'nın altını kabul etmez.
 *
 * Görsel, beyaz kutu zemini dairesel maskeyle kaldırılmış hâlde üretilir
 * (bkz. scripts/varliklari-isle.mjs) — çizimin kendisine dokunulmaz.
 */
export function SchoolCrest({ boyut = 120, className }: Props) {
  const taban = import.meta.env.BASE_URL;
  // En yakın üst çözünürlüğü seç, retina için 2 kat pay bırak.
  const kaynak = boyut <= 128 ? 256 : boyut <= 256 ? 512 : 1024;

  return (
    <img
      src={`${taban}marka/okul-muhru-${kaynak}.webp`}
      width={boyut}
      height={boyut}
      alt={TAM_AD}
      loading="lazy"
      decoding="async"
      className={className}
      style={{ width: boyut, height: boyut, display: 'block' }}
    />
  );
}
