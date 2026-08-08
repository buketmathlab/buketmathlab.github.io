type Ozellikler = {
  eksikler: readonly string[]
}

/**
 * Ortam değişkeni eksikse sessizce çalışmak yerine görünür uyarı verir.
 * Kullanıcı teknik değil: hangi dosyada neyin eksik olduğu açıkça yazılır.
 */
export function KurulumUyarisi({ eksikler }: Ozellikler) {
  return (
    <div role="alert" className="border-b border-kizil/30 bg-kizil-sis px-4 py-3">
      <p className="mx-auto max-w-5xl olcu text-kucuk text-kizil">
        Bağlantı ayarı eksik: <span className="font-mono">{eksikler.join(', ')}</span>. Proje
        kökündeki <span className="font-mono">.env</span> dosyasını doldurup sayfayı yenileyin.
      </p>
    </div>
  )
}
