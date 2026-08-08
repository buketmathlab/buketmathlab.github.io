/**
 * Tanıtım sayfasının anlatı bölümleri.
 * Her bölüm bir soruya cevap verir ve kendi ritmini taşır; ama hepsi aynı
 * ızgaradan ve aynı tipografik ölçekten çıkar.
 */

const aktorler = [
  {
    kim: 'Öğrenci',
    ne: 'Bugün ne yapmam gerekiyor?',
    ayrinti:
      'Soru kağıdını baştan görür, çözümünü telefonuyla gönderir, testte puanını ve cevap anahtarını aynı saniyede alır.',
  },
  {
    kim: 'Veli',
    ne: 'Çocuğum nerede duruyor?',
    ayrinti:
      'Ödev verildiğinde, gönderildiğinde ve gönderilmediğinde haber alır. İzlemez; sürece dahil olur.',
  },
  {
    kim: 'Öğretmen',
    ne: 'Sınıf ne durumda?',
    ayrinti:
      'Her sınıf kendi panosunda. Kimin yaptığı, kimin yapmadığı, hangi sorunun sınıfı zorladığı tek ekranda.',
  },
] as const

const yetenekler = [
  ['Ödev', 'Soru ve cevap anahtarı ayrı ayrı yüklenir; anahtar onaylanmadan ödev yayınlanmaz.'],
  ['Değerlendirme', 'Test puanı sunucuda anında hesaplanır; açık uçlunun son imzası öğretmende kalır.'],
  ['Gelişim', 'Konu bazlı güçlü ve zayıf taraflar; üç tarafa da kendi diliyle anlatılır.'],
  ['İletişim', 'Öğrenciyle ve veliyle birebir yazışma; duyurular ve bildirimler tek akışta.'],
  ['Takvim', 'Yaklaşan teslimler ve süresi dolanlar; geç teslim yok, tarih tarihtir.'],
  ['Kaynak', 'Çözümlü anlatım PDF’i gönderimden hemen sonra açılır.'],
] as const

export function Aktorler() {
  return (
    <section className="border-t border-kenar px-4 py-24">
      <div className="mx-auto max-w-5xl">
        <p className="text-etiket text-vurgu">TEK EKOSİSTEM, ÜÇ BAKIŞ</p>
        <div className="mt-12 flex flex-col divide-y divide-kenar border-y border-kenar">
          {aktorler.map((a) => (
            <article key={a.kim} className="grid gap-4 py-10 sm:grid-cols-[10rem_1fr] sm:gap-12">
              <h2 className="font-marka text-ekran leading-none text-metin">{a.kim}</h2>
              <div>
                <p className="text-b2 text-metin">{a.ne}</p>
                <p className="mt-3 olcu text-kucuk text-metin-ikincil">{a.ayrinti}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Yetenekler() {
  return (
    <section className="border-t border-kenar px-4 py-24">
      <div className="mx-auto max-w-5xl">
        <p className="text-etiket text-vurgu">NE YAPAR</p>
        <ul className="mt-12 grid gap-px overflow-hidden rounded-lg border border-kenar bg-kenar sm:grid-cols-2 lg:grid-cols-3">
          {yetenekler.map(([ad, aciklama]) => (
            <li key={ad} className="bg-zemin p-6">
              <h3 className="text-b3 font-semibold text-metin">{ad}</h3>
              <p className="mt-2 text-kucuk text-metin-ikincil">{aciklama}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
