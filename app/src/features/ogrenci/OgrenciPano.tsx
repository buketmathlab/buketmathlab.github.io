import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { EwaluFigure } from '@/components/brand/EwaluFigure';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { sureDurumu } from '@/lib/son-tarih';
import type { OgrenciOdevleri } from '@/types/api';

const TARIH = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' });
const DERS_ZAMANI = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Öğrencinin Panosu — "şu an durum ne?" sorusunun tek ekranlık cevabı.
 *
 * ÜÇ SATIR, DAHA FAZLASI DEĞİL: yaklaşan ödev, son puan, (özel derste)
 * sıradaki ders. Ödevlerin tamamı Ödevler sekmesinde; buraya da liste
 * koymak iki sekmeyi birbirinin kopyası yapardı.
 *
 * EWALU YALNIZ BURADA (bir de ödev sonucu ekranında). Her sekmeye koymak
 * Part VII'nin açıkça uyardığı şey; karakter her yerdeyse hiçbir yerde
 * anlam taşımaz.
 *
 * PARA BİLGİSİ YOK ve olmayacak — öğretmenin kalıcı kuralı: "Ödeme
 * detaylarını öğrenci görmesin." Sınır sunucuda: `ogrenci_odevleri`
 * öğrenciye ödemeyle ilgili tek bir alan bile göndermiyor
 * (`ozel_ders_takibi_testleri.sql` 4. grubu ölçüyor). Burada gizlenen bir
 * şey yok çünkü hiç gelmiyor (Part XXI).
 */
export function OgrenciPano() {
  const { oturum } = useOturum();
  const git = useNavigate();

  const { veri, durum, hata, yenile } = useVeri<OgrenciOdevleri>('ogrenci_odevleri', {
    p_token: oturum?.token,
  });

  const odevler = veri?.odevler ?? [];

  // "Yapılacak" ödev: gönderilmemiş, sınıfı açık ve hâlâ gönderilebilir.
  // Ödevler sekmesindeki `oncelik()` ile aynı ölçüt — iki ekran aynı
  // şeye "bekleyen" demezse öğrenci hangisine inanacağını bilemez.
  const bekleyenler = odevler.filter(
    (o) =>
      o.gonderim === null &&
      !o.sinif_arsiv &&
      !(sureDurumu(o.son_tarih).gecti && !o.gec_teslim),
  );
  const siradaki = [...bekleyenler].sort((a, b) =>
    a.son_tarih.localeCompare(b.son_tarih),
  )[0];

  // Son puan: en son gönderilen ve PUANI OLAN ödev. Açık uçlu ödev
  // puanlanana kadar burada görünmüyor — "puanın yok" değil, "henüz
  // yok"; olmayan bir sayı uydurulmuyor.
  const puanli = odevler
    .filter((o) => o.gonderim !== null && (o.gonderim.ogretmen_puan ?? o.gonderim.puan) !== null)
    .sort((a, b) => (b.gonderim?.zaman ?? '').localeCompare(a.gonderim?.zaman ?? ''));
  const sonPuanli = puanli[0];
  const sonPuan = sonPuanli
    ? (sonPuanli.gonderim?.ogretmen_puan ?? sonPuanli.gonderim?.puan ?? null)
    : null;

  // Sıradaki ders — yalnız BİR tane. Listenin tamamı Ödevler sekmesinde
  // duruyor; iki yerde aynı listeyi göstermek gereksiz.
  const siradakiDers = (veri?.dersler ?? [])[0];

  return (
    <AsyncBoundary
      durum={durum}
      bosBaslik="Henüz bir şey yok"
      bosAciklama="Öğretmenin ödev yayınlayınca burada göreceksin."
      {...(hata ? { hataAciklama: hata } : {})}
      tekrarDene={yenile}
    >
      {veri && (
        <>
          <div className="mb-6 flex items-center gap-3">
            <EwaluFigure
              poz={bekleyenler.length === 0 ? 'kutlama' : 'calisma'}
              boyut={56}
              dekoratif
              className="shrink-0"
            />
            <div className="min-w-0">
              <h1 className="font-display text-[24px] font-semibold text-ink">
                Merhaba {veri.ogrenci.ad.split(' ')[0]}
              </h1>
              {/* Ewalu'nun sözü — öğretmenin seçimi: "Özet + Ewalu'nun
                  sözü". Bir İDDİA taşımıyor: ne "harikasın" ne
                  "geri kaldın", yalnız şu an ne olduğunu söylüyor. */}
              <p className="text-[14px] text-muted">
                {bekleyenler.length === 0
                  ? 'Bekleyen ödevin yok. Eline sağlık.'
                  : `${bekleyenler.length} ödevin seni bekliyor.`}
              </p>
            </div>
          </div>

          <ul className="grid gap-3">
            <li>
              <Card vurgu={siradaki && sureDurumu(siradaki.son_tarih).acil ? 'uyari' : 'yok'}>
                <p className="text-[13px] font-bold uppercase tracking-wide text-muted">
                  Yaklaşan ödev
                </p>
                {siradaki ? (
                  <button
                    type="button"
                    onClick={() => git(`/ogrenci/odev/${siradaki.id}`)}
                    className="mt-2 flex min-h-[44px] w-full items-center justify-between gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    <span className="min-w-0">
                      <span className="block font-display text-[18px] font-semibold text-ink">
                        {siradaki.baslik}
                      </span>
                      <span className="block text-[13px] text-muted">
                        Son tarih {TARIH.format(new Date(siradaki.son_tarih))}
                      </span>
                    </span>
                    <Tag tur={sureDurumu(siradaki.son_tarih).acil ? 'uyari' : 'notr'}>
                      {sureDurumu(siradaki.son_tarih).metin}
                    </Tag>
                  </button>
                ) : (
                  <p className="mt-2 text-[15px] text-ink">Şu an gönderilecek ödevin yok.</p>
                )}
              </Card>
            </li>

            <li>
              <Card>
                <p className="text-[13px] font-bold uppercase tracking-wide text-muted">
                  Son puanın
                </p>
                {sonPuan !== null && sonPuanli ? (
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-[15px] text-ink">
                      {sonPuanli.baslik}
                    </span>
                    <Tag tur="basari">
                      <span className="sk-sayi">{sonPuan} puan</span>
                    </Tag>
                  </div>
                ) : (
                  <p className="mt-2 text-[15px] text-ink">
                    Henüz puanlanmış ödevin yok.
                  </p>
                )}
              </Card>
            </li>

            {/* Ders satırı YALNIZ dersi olan öğrencide çıkıyor. Okul
                öğrencisinde "ders yok" yazan boş bir kutu göstermek,
                veli panelinde bir kez yaptığımız hatanın aynısı olurdu. */}
            {siradakiDers && (
              <li>
                <Card>
                  <p className="text-[13px] font-bold uppercase tracking-wide text-muted">
                    Sıradaki dersin
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[15px] font-semibold text-ink">
                      {DERS_ZAMANI.format(new Date(siradakiDers.zaman))}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-[13px] text-muted">
                        {siradakiDers.mod === 'online' ? 'Online' : 'Yüz yüze'}
                      </span>
                      {siradakiDers.link && (
                        <a
                          href={siradakiDers.link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-[44px] items-center text-[14px] font-bold text-link underline"
                        >
                          Derse katıl
                        </a>
                      )}
                    </span>
                  </div>
                </Card>
              </li>
            )}
          </ul>
        </>
      )}
    </AsyncBoundary>
  );
}
