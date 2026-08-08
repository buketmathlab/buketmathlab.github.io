import { sinif } from '@/lib/sinif'

type Ozellikler = {
  boyut?: number
  /** Gözlüğü elle kapatmak için. Boyuta göre zaten kendiliğinden sadeleşir. */
  gozluk?: boolean
  /** Daire zemin üzerinde, uygulama simgesi düzeninde. */
  rozetli?: boolean
  /** Kollar ve bacaklar gecikmeli belirir (yalnız selamlama anında). */
  hareketli?: boolean
  ekSinif?: string
}

/**
 * 8 → ÖĞRENCİ
 *
 * Markanın üçüncü dönüşümü. 8 yana yattığında sonsuz olur; ayakta durduğunda
 * öğrenciye dönüşür.
 *
 * GEOMETRİ — figür serbest el çizim değil, ölçüdür:
 *   Baş   : merkez (36, 24), yarıçap 15
 *   Gövde : merkez (36, 56), yarıçap 17
 *   İki daire TAM TEĞETTİR (24+15 = 56−17 = 39). Yani figürün iskeleti birebir
 *   sekizin kendisidir; hiçbir halka bozulmaz, oynatılmaz, ölçeklenmez.
 *
 *   Kollar gövde çemberinin üstünde y=50'de başlar (x = 36 ± √(17²−6²) = 20,1 / 51,9).
 *   Bacaklar çemberin üstünde y=71,5'te başlar (x = 29 / 43).
 *   Gözlük camları başın tam genişliğini kaplar (21 → 51) — Madlen'in figüründeki
 *   gibi iri ve karakterli.
 *
 * Bütün çizgiler aynı kalınlıkta ve yuvarlak uçlu; tek renk. Karikatür yüz,
 * gülümseme, ten rengi ve giysi yok: 15 yaşındaki biri kendisine çocuk muamelesi
 * yapıldığını anında anlar. Ayrıca tek renkli çizgi marka 24px'te de 200px'te de
 * aynı netlikte okunur — illüstrasyon okunmaz.
 */
export function SekizFigur({
  boyut = 72,
  gozluk = true,
  rozetli = false,
  hareketli = false,
  ekSinif,
}: Ozellikler) {
  // Rozet düzeninde figür daireye nefes payı bırakacak biçimde küçülür.
  const cizimEni = rozetli ? boyut * 0.46 : boyut

  /*
   * OPTİK BOYUTLANDIRMA — figür küçüldükçe ayrıntı azalır.
   * Aynı çizimi ölçekleyip bırakmak amatör işidir: 32px'te gözlük camları başın
   * çizgisiyle birleşir, saplar antene benzer. Bu yüzden ayrıntı üç kademede
   * eleniyor; her kademede figür kendi boyutunda en net hâlini alıyor.
   */
  const gozlukVar = gozluk && cizimEni >= 40
  const sapVar = cizimEni >= 64

  const figur = (
    <svg
      viewBox="0 0 72 96"
      width={cizimEni}
      height={(cizimEni * 96) / 72}
      className="overflow-visible"
      aria-hidden={rozetli ? 'true' : undefined}
      role={rozetli ? undefined : 'img'}
      aria-label={rozetli ? undefined : 'SEKİZ öğrenci işareti'}
      fill="none"
      stroke="currentColor"
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Sekizin kendisi — baş ve gövde, tam teğet iki halka */}
      <circle cx="36" cy="24" r="15" />
      <circle cx="36" cy="56" r="17" />

      {/* Kollar ve bacaklar — sekizin çevresine eklenen dört çizgi */}
      <g
        className={hareketli ? 'animate-belir' : undefined}
        style={hareketli ? { animationDelay: '0.2s' } : undefined}
      >
        <path d="M20 50C13 53 9 59 10 65" />
        <path d="M52 50C59 53 63 59 62 65" />
        <path d="M29 71.5L27 89" />
        <path d="M43 71.5L45 89" />
      </g>

      {/* Gözlük — öğrenciyi söyleyen tek ayrıntı */}
      {gozlukVar && (
        <g
          className={hareketli ? 'animate-belir' : undefined}
          style={hareketli ? { animationDelay: '0.35s' } : undefined}
        >
          <circle cx="27" cy="25" r="6" />
          <circle cx="45" cy="25" r="6" />
          <path d="M33 25L39 25" />
          {sapVar && (
            <>
              <path d="M21 23.5L17.5 21.5" />
              <path d="M51 23.5L54.5 21.5" />
            </>
          )}
        </g>
      )}
    </svg>
  )

  if (!rozetli) {
    return <span className={sinif('inline-flex shrink-0', ekSinif)}>{figur}</span>
  }

  // Rozet düzeni: daire zemin + ortalanmış figür. Uygulama simgesinin taslağı.
  return (
    <span
      className={sinif(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-yuzey-yuksek',
        ekSinif,
      )}
      style={{ width: boyut, height: boyut }}
      role="img"
      aria-label="SEKİZ öğrenci işareti"
    >
      {figur}
    </span>
  )
}
