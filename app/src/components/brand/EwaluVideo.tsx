type Props = {
  className?: string;
};

/**
 * Ewalu tanıtım videosu.
 *
 * KALICI ÖĞE: Öğretmenin kararıyla giriş ekranında sürekli duracak. Faz 9'da
 * genel tanıtım sayfası gelse bile buradan KALDIRILMAYACAK — giriş ekranı
 * öğrenci, veli ve dışarıdan bakan herkesin gördüğü tek ortak yüzey.
 *
 * PERFORMANS: `preload="none"` kritik. Video 8.6 MB ve bu ekran her gün
 * açılıyor; kullanıcı oynat'a basmadıkça tek bayt inmiyor. Sayfa açılışında
 * yalnız 82 KB'lik poster görseli yükleniyor. Otomatik oynatma yok.
 *
 * ERİŞİLEBİLİRLİK — BİLİNEN EKSİK: Videonun altyazısı yok. Konuşma metnini
 * bilmediğim için altyazı uydurmadım; metin iletildiğinde `.vtt` altyazı ve
 * görünür döküm eklenecek. Eksik olduğunu gizlemek yerine yazıyorum.
 */
export function EwaluVideo({ className }: Props) {
  const taban = import.meta.env.BASE_URL;

  return (
    <figure className={className}>
      <video
        controls
        preload="none"
        playsInline
        poster={`${taban}marka/ewalu-tanitim-poster.webp`}
        className="w-full rounded-sk-lg border border-line bg-ink shadow-sk-sm"
        aria-label="Ewalu tanıtım videosu"
      >
        <source src={`${taban}marka/ewalu-tanitim.mp4`} type="video/mp4" />
        {/* Video oynatılamazsa bu metin görünür (Part VIII: yedek davranış) */}
        Tarayıcınız video oynatmayı desteklemiyor.{' '}
        <a href={`${taban}marka/ewalu-tanitim.mp4`} className="underline">
          Videoyu indirerek izleyebilirsiniz.
        </a>
      </video>
      <figcaption className="mt-2 text-center text-[13px] text-muted">
        Ewalu'yu tanıyın — SEKİZ'in yardımcısı
      </figcaption>
    </figure>
  );
}
