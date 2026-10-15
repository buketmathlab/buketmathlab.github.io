import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EwaluFigure } from '@/components/brand/EwaluFigure';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { Field, Textarea } from '@/components/ui/Field';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import {
  ACIK_UCLU_SINIR,
  ACIK_UCLU_SORU,
  ANKET_MADDELERI,
  LIKERT,
  anketGovdesi,
  type AnketRolu,
} from '@/lib/anket-sorulari';
import { rpc } from '@/services/supabase';
import type { AnketDurumu } from '@/types/api';

/**
 * ANONİM ANKET SAYFASI (0076) — öğrenci, veli ve öğretmen aynı bileşen.
 *
 * Her madde beş seçenekli bir radyo grubu (`fieldset` + `legend`): ekran
 * okuyucu soruyu ve seçenekleri birlikte okuyor, klavyeyle oklarla
 * gezilebiliyor. Gönder düğmesi bütün maddeler yanıtlanmadan açılmıyor;
 * sunucu aynı kuralı ayrıca uyguluyor.
 *
 * Gönderdikten sonra "teşekkürler" ve panoya dönüş. Deneme hesabında
 * akış birebir, ama sunucu yanıtı KAYDETMİYOR — bunu ekranda da söylüyoruz.
 */
export function AnketSayfasi({ donus }: { donus: string }) {
  const { oturum } = useOturum();
  const durum = useVeri<AnketDurumu>('anket_durumu', { p_token: oturum?.token });
  const [secim, setSecim] = useState<Record<string, number>>({});
  const [acik, setAcik] = useState('');
  const [gonderiyor, setGonderiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bitti, setBitti] = useState<'kaydedildi' | 'deneme' | null>(null);

  const d = durum.veri;
  const rol = (d && d.acik ? d.rol : null) as AnketRolu | null;
  const govde = rol ? anketGovdesi(rol, secim, acik) : null;

  async function gonder() {
    if (!govde) return;
    setGonderiyor(true);
    setHata(null);
    try {
      const s = await rpc<{ kaydedildi: boolean; deneme?: boolean }>('anket_yanitla', {
        p_token: oturum?.token,
        p_cevaplar: govde,
      });
      setBitti(s.deneme ? 'deneme' : 'kaydedildi');
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Yanıt gönderilemedi.');
    } finally {
      setGonderiyor(false);
    }
  }

  const geri = (
    <Link
      to={donus}
      className="inline-flex min-h-[44px] items-center rounded-sk-md border border-line bg-surface px-4 text-[15px] font-semibold text-ink hover:border-ink-soft"
    >
      Panoya dön
    </Link>
  );

  if (bitti) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <EwaluFigure poz="kutlama" boyut={96} dekoratif />
          <h1 className="text-[22px] text-ink">Teşekkür ederiz!</h1>
          <p className="max-w-[44ch] text-[15px] text-muted">
            {bitti === 'deneme'
              ? 'Deneme hesabındasınız: akış gerçek gibi işledi ama yanıt kaydedilmedi.'
              : 'Görüşünüz isimsiz olarak kaydedildi. SEKİZ’i geliştirirken dikkate alacağız.'}
          </p>
          {geri}
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="mb-5">
        <h1 className="text-[24px] text-ink">Kısa anket</h1>
        <p className="mt-1 text-[14px] text-muted">
          İsimsizdir: adınız, sınıfınız ya da kodunuz sorulmaz ve yanıtlarınız kimliğinizle birlikte
          saklanmaz. Katılım gönüllüdür; yalnız bir kez yanıtlanabilir.
        </p>
      </div>
      <AsyncBoundary
        durum={durum.durum}
        bosBaslik="Anket yok"
        {...(durum.hata ? { hataAciklama: durum.hata } : {})}
        tekrarDene={durum.yenile}
      >
        {d && !d.acik ? (
          <Card>
            <p className="text-[15px] text-ink">Şu anda açık bir anket yok.</p>
            <div className="mt-3">{geri}</div>
          </Card>
        ) : d && d.acik && d.katildi ? (
          <Card>
            <p className="text-[15px] text-ink">Bu anketi yanıtladınız. Teşekkür ederiz!</p>
            <div className="mt-3">{geri}</div>
          </Card>
        ) : rol ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void gonder();
            }}
            className="flex flex-col gap-4"
          >
            {ANKET_MADDELERI[rol].map((madde, i) => {
              const ad = `m${i + 1}`;
              return (
                <Card key={ad}>
                  <fieldset>
                    <legend className="mb-3 text-[15px] font-semibold text-ink">
                      <span className="sk-sayi mr-1 text-muted">{i + 1}.</span> {madde}
                    </legend>
                    <div className="grid grid-cols-5 gap-1.5">
                      {LIKERT.map((l) => (
                        <label
                          key={l.deger}
                          className={`flex min-h-[64px] cursor-pointer flex-col items-center justify-center rounded-sk-sm border px-1 text-center text-[12px] leading-tight transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${
                            secim[ad] === l.deger
                              ? 'border-ink bg-ink text-paper'
                              : 'border-line bg-surface text-ink hover:border-ink-soft'
                          }`}
                        >
                          <input
                            type="radio"
                            name={ad}
                            value={l.deger}
                            checked={secim[ad] === l.deger}
                            onChange={() => setSecim({ ...secim, [ad]: l.deger })}
                            className="sr-only"
                          />
                          <span className="sk-sayi text-[16px] font-semibold">{l.deger}</span>
                          <span>{l.etiket}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </Card>
              );
            })}
            <Card>
              <Field
                etiket={`${ACIK_UCLU_SORU[rol]} (isteğe bağlı)`}
                ipucu={`En çok ${ACIK_UCLU_SINIR} karakter · ${acik.length}/${ACIK_UCLU_SINIR}. Ad ya da kişisel bilgi yazmayın.`}
              >
                {(p) => (
                  <Textarea
                    {...p}
                    value={acik}
                    maxLength={ACIK_UCLU_SINIR}
                    onChange={(e) => setAcik(e.target.value)}
                  />
                )}
              </Field>
            </Card>
            {hata && <p className="text-[14px] text-danger">{hata}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!govde} yukleniyor={gonderiyor}>
                Gönder
              </Button>
              {!govde && (
                <span className="text-[13px] text-muted">
                  Göndermek için bütün soruları yanıtlayın.
                </span>
              )}
            </div>
          </form>
        ) : null}
      </AsyncBoundary>
    </>
  );
}
