import { Buton } from './Buton'

type Ozellikler = {
  /** Ne olduğunu söyler; özür dilemez. */
  mesaj: string
  /** Kullanıcının atacağı adım. */
  onTekrar?: () => void
}

/**
 * Hata hâli. Metin kuralı: ne olduğunu ve ne yapılacağını söyler.
 * "Bir şeyler ters gitti" gibi boş cümleler kullanılmaz.
 */
export function HataDurumu({ mesaj, onTekrar }: Ozellikler) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-kirmizi/40 bg-kirmizi-soluk p-4 text-kirmizi-metin"
    >
      <p className="text-govde olcu">{mesaj}</p>
      {onTekrar && (
        <Buton vurgu="ikincil" onClick={onTekrar} className="mt-3">
          Tekrar dene
        </Buton>
      )}
    </div>
  )
}
