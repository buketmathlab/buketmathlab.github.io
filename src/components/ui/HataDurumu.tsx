import { Buton } from './Buton'

type Ozellikler = {
  /** Ne olduğunu söyler; özür dilemez. */
  mesaj: string
  onTekrar?: () => void
}

/**
 * Hata hâli. Metin kuralı: ne olduğunu ve ne yapılacağını söyler.
 * Renk tek anlam taşıyıcısı değildir — çarpı simgesi de durumu söyler.
 */
export function HataDurumu({ mesaj, onTekrar }: Ozellikler) {
  return (
    <div role="alert" className="rounded-md border border-kiremit/30 bg-kiremit-sis p-4">
      <p className="flex gap-2 olcu text-kucuk text-olumsuz">
        <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0" aria-hidden="true">
          <path
            d="M4 4 L12 12 M12 4 L4 12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        <span>{mesaj}</span>
      </p>
      {onTekrar && (
        <Buton vurgu="ikincil" onClick={onTekrar} className="mt-3">
          Tekrar dene
        </Buton>
      )}
    </div>
  )
}
