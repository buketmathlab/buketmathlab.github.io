type Ozellikler = {
  eksikler: readonly string[]
}

/**
 * Ortam değişkeni eksikse sessizce çalışmak yerine görünür uyarı verir.
 * Kullanıcı teknik değil: hangi dosyada hangi satırın eksik olduğu açıkça yazılır.
 */
export function KurulumUyarisi({ eksikler }: Ozellikler) {
  return (
    <div
      role="alert"
      className="border-b border-kirmizi/40 bg-kirmizi-soluk px-4 py-3 text-kucuk text-kirmizi-metin"
    >
      <p className="mx-auto max-w-5xl olcu">
        Bağlantı ayarı eksik: <span className="font-mono">{eksikler.join(', ')}</span>. Proje
        kökündeki <span className="font-mono">.env</span> dosyasını doldurup sayfayı yenileyin.
      </p>
    </div>
  )
}
