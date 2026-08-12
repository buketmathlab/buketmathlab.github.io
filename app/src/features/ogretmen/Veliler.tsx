import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SayfaBasligi } from '@/components/layout/Kabuk';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { Field, Textarea } from '@/components/ui/Field';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { rpc } from '@/services/supabase';
import type { SinifVelileri, VelilerListesi, Yazisma } from '@/types/api';

const ZAMAN = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Veliler sekmesi.
 *
 * İKİ SORUYA BİRDEN CEVAP VERİYOR ve bu yüzden diğer sekmelerden farklı:
 *
 *   1. "Kim bana yazmış?" → en üstte **Yanıt bekleyenler**, sınıf ayrımı
 *      olmadan, en uzun süredir cevapsız duran üstte. Mesajlaşmada asıl iş
 *      bu; sınıfların altına gömseydik öğretmen bekleyen bir veliyi ancak o
 *      sınıfa girerse görürdü.
 *   2. "Filanca velinin yazışması nerede?" → altında sınıf listesi, diğer
 *      sekmelerdeki desenin aynısı.
 *
 * Yani gezinme sınıf sınıf, ama acil olan yukarı çıkıyor.
 */
export function Veliler() {
  const { oturum } = useOturum();
  const git = useNavigate();

  const { veri, durum, hata, yenile } = useVeri<VelilerListesi>(
    'veliler_listesi',
    { p_token: oturum?.token },
    (v) => v.gruplar.length === 0,
  );

  return (
    <>
      <SayfaBasligi
        baslik="Veliler"
        aciklama="Mesajlar uygulama içinde gider; veli kendi çocuğunun panelinde görür."
      />

      <AsyncBoundary
        durum={durum}
        bosBaslik="Henüz veli yok"
        bosAciklama="Öğrenci ekleyince velisi de burada belirir."
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {veri && (
          <>
            {veri.yanit_bekleyen.length > 0 && (
              <section className="mb-6">
                <h2 className="mb-2 font-display text-[18px] font-semibold text-ink">
                  Yanıt bekleyenler
                </h2>
                <Card vurgu="uyari">
                  <ul className="divide-y divide-line">
                    {veri.yanit_bekleyen.map((v) => (
                      <li key={v.ogrenci_id}>
                        <button
                          type="button"
                          onClick={() => git(`/ogretmen/veliler/yazisma/${v.ogrenci_id}`)}
                          className="flex min-h-[44px] w-full items-center justify-between gap-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                        >
                          <span className="min-w-0">
                            <span className="block font-semibold text-ink">{v.ad}</span>
                            <span className="block text-[13px] text-muted">
                              {v.sinif}
                              {v.son_mesaj && ` · ${ZAMAN.format(new Date(v.son_mesaj))}`}
                            </span>
                          </span>
                          <Tag tur="uyari">
                            <span className="sk-sayi">{v.okunmamis} yeni</span>
                          </Tag>
                        </button>
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            )}

            <h2 className="mb-2 font-display text-[18px] font-semibold text-ink">Sınıflar</h2>
            <Card>
              <ul className="divide-y divide-line">
                {veri.gruplar.map((g) => (
                  <li key={g.sinif_id}>
                    <button
                      type="button"
                      onClick={() => git(`/ogretmen/veliler/sinif/${g.sinif_id}`)}
                      className="flex min-h-[44px] w-full items-center justify-between gap-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    >
                      <span className="font-display text-[18px] font-semibold text-ink">
                        {g.sinif}
                      </span>
                      <span className="flex items-center gap-2 text-[14px] text-muted">
                        {g.okunmamis > 0 && (
                          <Tag tur="uyari">
                            <span className="sk-sayi">{g.okunmamis} yeni</span>
                          </Tag>
                        )}
                        <span className="sk-sayi">{g.veli_sayisi}</span> veli
                        <Ok />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </AsyncBoundary>
    </>
  );
}

/** Bir sınıfın velileri. Kodlar sekmesindeki desenin aynısı. */
export function SinifVelileriEkrani() {
  const { id = '' } = useParams();
  const { oturum } = useOturum();
  const git = useNavigate();

  const { veri, durum, hata, yenile } = useVeri<SinifVelileri>(
    'sinif_velileri',
    { p_token: oturum?.token, p_sinif_id: id },
    (v) => v.veliler.length === 0,
  );

  return (
    <>
      <div className="mb-4">
        <Button tur="sade" olcu="sm" onClick={() => git('/ogretmen/veliler')}>
          ← Veliler
        </Button>
      </div>

      <AsyncBoundary
        durum={durum}
        bosBaslik="Bu sınıfta öğrenci yok"
        bosAciklama="Öğrenciler bölümünden bu sınıfa öğrenci ekleyebilirsiniz."
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {veri && (
          <>
            <h1 className="mb-4 font-display text-[24px] font-semibold text-ink">
              {veri.sinif.ad}
            </h1>
            <Card>
              <ul className="divide-y divide-line">
                {veri.veliler.map((v) => (
                  <li key={v.ogrenci_id}>
                    <button
                      type="button"
                      onClick={() => git(`/ogretmen/veliler/yazisma/${v.ogrenci_id}`)}
                      className="flex min-h-[44px] w-full items-center justify-between gap-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold text-ink">{v.ad}</span>
                        <span className="block text-[13px] text-muted">
                          {v.mesaj_sayisi === 0
                            ? 'Henüz yazışma yok'
                            : `${v.mesaj_sayisi} mesaj${
                                v.son_mesaj ? ` · ${ZAMAN.format(new Date(v.son_mesaj))}` : ''
                              }`}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {/* Veli kodu yoksa mesaj yazmak boşa gider: veli
                            giriş bile yapamaz. Öğretmen bunu yazmadan
                            ÖNCE görsün. */}
                        {!v.veli_kodu_var && <Tag tur="notr">Veli kodu yok</Tag>}
                        {v.okunmamis > 0 && (
                          <Tag tur="uyari">
                            <span className="sk-sayi">{v.okunmamis} yeni</span>
                          </Tag>
                        )}
                        <Ok />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </AsyncBoundary>
    </>
  );
}

/**
 * Bir veliyle yazışma.
 *
 * Ekran açılır açılmaz `ogretmen_okudu` çağrılıyor: öğretmen mesajı GÖRDÜ,
 * sayaç sıfırlansın. Ayrı bir "okundu işaretle" düğmesi koymak öğretmene
 * hiçbir şey kazandırmayan bir iş yükü olurdu.
 */
export function VeliYazismasi() {
  const { id = '' } = useParams();
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const git = useNavigate();
  const [metin, setMetin] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const okunduYazildi = useRef(false);

  const { veri, durum, hata, yenile } = useVeri<Yazisma>('mesajlar_ogretmen', {
    p_token: oturum?.token,
    p_ogrenci_id: id,
  });

  useEffect(() => {
    // Bir kez: her yeniden çizimde istek atmasın.
    if (!veri || okunduYazildi.current || !oturum?.token) return;
    okunduYazildi.current = true;
    void rpc('ogretmen_okudu', { p_token: oturum.token, p_ogrenci_id: id }).catch(() => {
      // Okundu kaydı yazılamazsa ekran çalışmaya devam etmeli; öğretmene
      // hata göstermek burada gürültü olur, en kötü sayaç bir sonraki
      // açılışta düşer.
    });
  }, [veri, oturum?.token, id]);

  async function gonder() {
    const t = metin.trim();
    if (!t) return;
    setGonderiliyor(true);
    try {
      await rpc('mesaj_gonder', {
        p_token: oturum?.token,
        p_metin: t,
        p_ogrenci_id: id,
      });
      setMetin('');
      yenile();
      bildir('Mesaj gönderildi', 'basari');
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Mesaj gönderilemedi.', 'hata');
    } finally {
      setGonderiliyor(false);
    }
  }

  return (
    <>
      <div className="mb-4">
        <Button tur="sade" olcu="sm" onClick={() => git('/ogretmen/veliler')}>
          ← Veliler
        </Button>
      </div>

      <AsyncBoundary
        durum={durum}
        bosBaslik="Yazışma açılamadı"
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {veri && (
          <>
            <div className="mb-4">
              <h1 className="font-display text-[24px] font-semibold text-ink">
                {veri.ogrenci.ad}
              </h1>
              <p className="mt-1 text-[14px] text-muted">
                {veri.ogrenci.sinif ?? 'Sınıfsız'} · velisiyle yazışma
              </p>
            </div>

            {!veri.veli_kodu_var && (
              <Card vurgu="uyari" className="mb-4">
                <p className="font-semibold text-ink">Bu öğrencinin veli kodu yok.</p>
                <p className="mt-1 text-[14px] text-muted">
                  Veli giriş yapamadığı için yazdığınız mesajı göremez. Kodlar bölümünden
                  öğrenciye bakıp veli kodunu paylaşabilirsiniz.
                </p>
              </Card>
            )}

            <Card className="mb-4">
              {veri.mesajlar.length === 0 ? (
                <p className="text-[14px] text-muted">
                  Henüz mesaj yok. İlk mesajı siz yazabilirsiniz.
                </p>
              ) : (
                <ul className="space-y-3">
                  {veri.mesajlar.map((m, i) => {
                    const benim = m.kimden === 'ogretmen';
                    return (
                      <li key={i} className={benim ? 'text-right' : ''}>
                        {/* Kim yazdı bilgisi RENKLE DEĞİL, yazıyla da
                            veriliyor: renk körlüğünde hizalama ve renk tek
                            başına ayırt edici olmaz. */}
                        <span className="mb-1 block text-[12px] font-bold text-muted">
                          {benim ? 'Siz' : 'Veli'} · {ZAMAN.format(new Date(m.zaman))}
                        </span>
                        <span
                          className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-sk-md px-3 py-2 text-left text-[15px] ${
                            benim ? 'bg-ink text-paper' : 'bg-line-soft text-ink'
                          }`}
                        >
                          {m.metin}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card>
              <Field etiket="Yeni mesaj">
                {(kimlik) => (
                  <Textarea
                    {...kimlik}
                    rows={3}
                    value={metin}
                    onChange={(e) => setMetin(e.target.value)}
                    maxLength={4000}
                    placeholder="Veliye iletmek istediğinizi yazın."
                  />
                )}
              </Field>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="sk-sayi text-[12px] text-muted">{metin.length}/4000</span>
                <Button
                  onClick={gonder}
                  yukleniyor={gonderiliyor}
                  yuklenmeMetni="Gönderiliyor"
                  {...(metin.trim() ? {} : { disabled: true })}
                >
                  Gönder
                </Button>
              </div>
            </Card>
          </>
        )}
      </AsyncBoundary>
    </>
  );
}

function Ok() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
}
