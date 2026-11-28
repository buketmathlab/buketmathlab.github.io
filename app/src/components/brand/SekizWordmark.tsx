import { Sekiz8Mark } from './Sekiz8Mark';

type Props = {
  /**
   * 'tam' iki satırlık imza; 'sade' yalnız ad;
   * 'ders' ad + yalnız branş.
   *
   * 'sahip' VELİ ÇİZELGESİ İÇİN EKLENDİ. Öğretmen "8 logosunun altına
   * Buket Topuzoğlu diye de yaz" dedi ve adın BRANŞSIZ, her kâğıtta
   * SABİT durmasını seçti. `tam` biçimi branşı da yazıyor ama çizelgenin
   * antetinde "MATEMATİK" zaten var; iki kez yazmak gürültü olurdu.
   *
   * Bu ad ÜRÜNÜN SAHİBİ, o sınıfın ders öğretmeni DEĞİL. Çizelgenin
   * antetindeki ad `sinif.ogretmenler`den geliyor ve başka bir
   * öğretmenin sınıfında onun adını yazıyor (0092); alt imza ise her
   * kâğıtta aynı kalıyor. Öğretmen bu ayrımı bilerek seçti.
   *
   * 'ders' KÂĞIT İÇİN EKLENDİ. Kod fişlerinde öğretmenin adı bilerek yok
   * (kendi kararı: fişi eline alan kimin verdiğini zaten biliyor) ama
   * ürünün adı yalnız 8 işaretiyle kalmamalı — işaret tek başına "bu
   * uygulamanın adı ne?" sorusunu cevaplamıyor. Bu biçim adı yazıyla
   * söylüyor, altına branşı koyuyor.
   */
  bicim?: 'tam' | 'sade' | 'ders' | 'sahip';
  boyut?: 'xs' | 'sm' | 'md' | 'lg';
  acilistaDonsun?: boolean;
  className?: string;
};

/**
 * `xs` KESİLİP DAĞITILAN KÂĞIT İÇİN. Fiş 66 mm'ye sığmak zorunda ve
 * `sm` (28 px işaret) orada başlığı ezip metne yer bırakmıyordu —
 * ölçüldü, tahmin edilmedi.
 */
/**
 * ÜRÜNÜN SAHİBİ — TEK KAYNAK.
 *
 * `tam` ve `sahip` biçimleri aynı adı yazıyor; iki yerde ayrı ayrı
 * durursa biri bir gün değişir öbürü kalır.
 */
const SAHIP_ADI = 'Buket Topuzoğlu';
const BRANS = 'Matematik';

const OLCU = {
  xs: { isaret: 16, ad: 'text-[12px]', alt: 'text-[9px]' },
  sm: { isaret: 28, ad: 'text-[18px]', alt: 'text-[11px]' },
  md: { isaret: 40, ad: 'text-[24px]', alt: 'text-[12px]' },
  lg: { isaret: 56, ad: 'text-[34px]', alt: 'text-[14px]' },
} as const;

/**
 * SEKİZ marka imzası — ürün kimliği ile öğretmen kimliğini birlikte taşır.
 * Küçük bağlamlarda okul mührü yerine bu kullanılır (bkz. SchoolCrest).
 */
export function SekizWordmark({
  bicim = 'tam',
  boyut = 'md',
  acilistaDonsun = false,
  className,
}: Props) {
  const o = OLCU[boyut];

  return (
    <span
      className={`inline-flex items-center ${boyut === 'xs' ? 'gap-2' : 'gap-3'} ${className ?? ''}`}
    >
      <Sekiz8Mark boyut={o.isaret} acilistaDonsun={acilistaDonsun} className="text-ink" />
      <span className="leading-tight">
        <span
          className={`block font-display font-semibold tracking-[0.14em] text-ink ${o.ad}`}
          // Türkçe'de "SEKİZ" büyük harfle yazılır; tracking okunurluğu artırır.
        >
          SEKİZ
        </span>
        {bicim === 'tam' && (
          <span className={`block text-muted ${o.alt}`}>{`${SAHIP_ADI} · ${BRANS}`}</span>
        )}
        {bicim === 'sahip' && (
          <span className={`block text-muted ${o.alt}`}>{SAHIP_ADI}</span>
        )}
        {bicim === 'ders' && <span className={`block text-muted ${o.alt}`}>{BRANS}</span>}
      </span>
    </span>
  );
}
