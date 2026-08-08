import { Buton } from './Buton'

type Ozellikler = {
  /** Ne olduğunu söyler; özür dilemez. */
  mesaj: string
  onTekrar?: () => void
}

/**
 * Hata hâli. Metin kuralı: ne olduğunu ve ne yapılacağını söyler.
 * "Bir şeyler ters gitti" gibi boş cümleler kullanılmaz.
 */
export function HataDurumu({ mesaj, onTekrar }: Ozellikler) {
  return (
    <div role="alert" className="rounded-md border border-kizil/30 bg-kizil-sis p-4">
      <p className="olcu text-kucuk text-kizil">{mesaj}</p>
      {onTekrar && (
        <Buton vurgu="ikincil" onClick={onTekrar} className="mt-3">
          Tekrar dene
        </Buton>
      )}
    </div>
  )
}
