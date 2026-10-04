import { CizgiGrafik } from '@/components/grafik/CizgiGrafik';
import { CubukListesi } from '@/components/grafik/CubukListesi';
import { Card } from '@/components/ui/Card';
import { ayEtiketi, sayiya } from '@/lib/grafik';
import { ortalamaYazisi } from '@/lib/odev-kiyasi-metni';
import type { OkulGeneli } from '@/types/api';

const SAYI = new Intl.NumberFormat('tr-TR');
const AY_UZUN = new Intl.DateTimeFormat('tr-TR', {
  month: 'long',
  year: 'numeric',
});

/** Müdür ve öğretmen Genel sayfasının ortak gövdesindeki açıklama. */
export const GENEL_ACIKLAMA =
  'Okulun bugüne kadarki ödev, soru ve not özeti. Özel ders grupları dahil değil.';

/**
 * OKULUN GENEL ÖZETİ — müdürün Genel sekmesi (0061) ve öğretmenin Genel
 * sayfası (0065) AYNI bileşen.
 *
 * Öğretmenin isteği (0065): "Müdürün genel sekmesinde olan bilgiler
 * öğretmenlerin pano sayfasında olsun." Kapsam okulun tamamı; veri
 * müdürde `mudur_paneli`, öğretmende `okul_geneli` — ikisi sunucuda aynı
 * hesap (SQL testiyle bağlı).
 *
 * Sıra, bir yöneticinin soracağı sırayla: ne kadar iş yapıldı
 * (kutucuklar), aylar içinde nasıl gidiyor (grafik), seviyeler ve şubeler
 * nerede duruyor, okul hangi konularda zorlanıyor.
 *
 * "Toplam soru" bir ödevi kaç şubeye verildiyse o kadar sayıyor: 9A'ya ve
 * 9B'ye verilen 20 soruluk ödev 40 soru. Şube toplamlarıyla tutarlı olan bu.
 */
export function GenelOzet({ veri }: { veri: OkulGeneli }) {
  return (
    <div className="flex flex-col gap-4">
      {/* KUTUCUKLAR */}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kutucuk ad="Öğrenci" deger={SAYI.format(veri.okul.ogrenci_sayisi)} />
        <Kutucuk ad="Yayınlanan ödev" deger={SAYI.format(veri.okul.odev_sayisi)} />
        <Kutucuk
          ad="Toplam soru"
          deger={SAYI.format(veri.okul.soru_toplami)}
          {...(veri.okul.soru_sayisiz > 0
            ? { not: `+${veri.okul.soru_sayisiz} ödevde soru sayısı yok` }
            : {})}
        />
        <Kutucuk
          ad="Gönderim oranı"
          deger={veri.okul.gonderim_orani === null ? '—' : `%${veri.okul.gonderim_orani}`}
        />
        <Kutucuk ad="Okul ortalaması" deger={ortalamaYazisi(veri.okul.ortalama) ?? '—'} />
      </dl>

      {/* AYLIK GELİŞİM */}
      <Card>
        <h2 className="text-[18px] text-ink">Aylık gelişim</h2>
        <p className="mb-3 text-[13px] text-muted">
          Ödevin son tarihine göre; yalnız süresi dolmuş ödevler. Boş ay: o ay değerlendirilen ödev
          yok.
        </p>
        <CizgiGrafik
          baslik="Okulun aylık ortalaması ve gönderim oranı"
          etiketler={veri.aylar.map((a) => ayEtiketi(a.ay))}
          uzunEtiketler={veri.aylar.map((a) => AY_UZUN.format(new Date(`${a.ay}T12:00:00`)))}
          seriler={[
            {
              ad: 'Ortalama',
              renk: 'mavi',
              birim: '',
              degerler: veri.aylar.map((a) => sayiya(a.ortalama)),
            },
            {
              ad: 'Gönderim oranı',
              renk: 'turuncu',
              birim: '%',
              degerler: veri.aylar.map((a) => sayiya(a.gonderim_orani)),
            },
          ]}
          ekSutunlar={[
            { ad: 'Ödev', degerler: veri.aylar.map((a) => a.odev_sayisi) },
            {
              ad: 'Soru',
              degerler: veri.aylar.map((a) => SAYI.format(a.soru_toplami)),
            },
          ]}
          bosMetni="Bu eğitim yılında süresi dolmuş ödev yok; grafik ilk değerlendirmeden sonra dolacak."
        />
      </Card>

      {/* SEVİYELER */}
      <Card>
        <h2 className="mb-3 text-[18px] text-ink">Sınıf seviyeleri</h2>
        <ul className="grid gap-3 sm:grid-cols-2 [&>li]:min-w-0">
          {veri.seviyeler.map((v) => (
            <li key={v.seviye} className="rounded-sk-sm border border-line p-3">
              <p className="font-display text-[18px] font-semibold text-ink">
                {v.seviye}. sınıflar
              </p>
              <p className="text-[13px] text-muted">
                <span className="sk-sayi">{v.sinif_sayisi}</span> şube ·{' '}
                <span className="sk-sayi">{v.ogrenci_sayisi}</span> öğrenci
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[14px]">
                <dt className="text-muted">Ödev</dt>
                <dd className="sk-sayi text-right font-semibold text-ink">{v.odev_sayisi}</dd>
                <dt className="text-muted">Toplam soru</dt>
                <dd className="sk-sayi text-right font-semibold text-ink">
                  {SAYI.format(v.soru_toplami)}
                </dd>
                <dt className="text-muted">Gönderim</dt>
                <dd className="sk-sayi text-right font-semibold text-ink">
                  {v.gonderim_orani === null ? '—' : `%${v.gonderim_orani}`}
                </dd>
                <dt className="text-muted">Ortalama</dt>
                <dd className="sk-sayi text-right font-semibold text-ink">
                  {ortalamaYazisi(v.ortalama) ?? '—'}
                </dd>
              </dl>
            </li>
          ))}
        </ul>
      </Card>

      {/* ŞUBE KARŞILAŞTIRMASI */}
      <Card>
        <h2 className="text-[18px] text-ink">Şubelerin ortalaması</h2>
        <p className="mb-3 text-[13px] text-muted">
          Süresi dolmuş ödevlerde gönderilen çözümlerin ortalaması. Altında gönderim oranı ve toplam
          soru.
        </p>
        <CubukListesi
          birim=""
          satirlar={veri.siniflar.map((s) => ({
            anahtar: s.id,
            etiket: s.ad,
            deger: sayiya(s.ortalama),
            ek: `${s.gonderim_orani === null ? 'henüz değerlendirilen ödev yok' : `%${s.gonderim_orani} gönderim`} · ${SAYI.format(s.soru_toplami)} soru · ${s.odev_sayisi} ödev`,
          }))}
        />
      </Card>

      {/* ZORLANILAN KONULAR — SEVİYE SEVİYE (0063, öğretmenin isteği:
          "dokuzuncu sınıfların en çok zorlandığı konular, onuncu ..."). */}
      <Card>
        <h2 className="text-[18px] text-ink">En çok zorlanılan konular</h2>
        <p className="mb-3 text-[13px] text-muted">
          Her sınıf seviyesinde, test ödevlerinde en çok yanlış ya da boş bırakılan beş konu; çubuk
          doğru yüzdesi. Az soru çözülmüş konular sayılmadı.
        </p>
        <div className="flex flex-col gap-5">
          {veri.seviyeler.map((v) => (
            <section key={v.seviye} aria-labelledby={`konu-${v.seviye}`}>
              <h3 id={`konu-${v.seviye}`} className="mb-2 text-[15px] font-semibold text-ink">
                {v.seviye}. sınıfların en çok zorlandığı konular
              </h3>
              {v.eksik_konular.length === 0 ? (
                <p className="text-[14px] text-muted">Henüz yeterli veri yok.</p>
              ) : (
                <CubukListesi
                  birim="%"
                  etiketGenisligi="w-28"
                  satirlar={v.eksik_konular.map((k) => ({
                    anahtar: `${v.seviye}-${k.konu}`,
                    etiket: k.konu,
                    deger: k.oran,
                    ek: `doğru: ${SAYI.format(k.dogru)} / ${SAYI.format(k.toplam)} cevap`,
                  }))}
                />
              )}
            </section>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Kutucuk({ ad, deger, not }: { ad: string; deger: string; not?: string }) {
  return (
    <div className="rounded-sk-md border border-line bg-surface p-3">
      <dt className="text-[13px] text-muted">{ad}</dt>
      <dd className="sk-sayi mt-1 font-display text-[26px] font-semibold leading-none text-ink">
        {deger}
      </dd>
      {not && <dd className="mt-1 text-[12px] text-muted">{not}</dd>}
    </div>
  );
}
