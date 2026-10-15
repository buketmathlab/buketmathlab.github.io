import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { ACIK_UCLU_SORU, ANKET_MADDELERI, LIKERT, ROL_ADI } from '@/lib/anket-sorulari';
import { rpc } from '@/services/supabase';
import type { AnketSonucu } from '@/types/api';

const SAYI = new Intl.NumberFormat('tr-TR');
const IKI_HANE = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });

/** Likert ortalaması iki haneyle: 3,75 — tek hane 3,8 dağılımı gizlerdi. */
function ortalama5(v: number | string | null): string | null {
  const n = v === null ? NaN : Number(v);
  return Number.isFinite(n) ? IKI_HANE.format(n) : null;
}

/**
 * PAYDAŞ GÖRÜŞLERİ (0076) — Proje raporunun bölümü; sahip ve müdür.
 *
 * Her madde için 1–5 dağılımı METİN olarak yazılı (n ve yüzde); çubuk onun
 * görsel karşılığı. Grup başına yanıt sayısı eşiğin (5) altındaysa sunucu
 * dağılım göndermiyor ve burada "henüz yeterli yanıt yok" yazıyor —
 * küçük grupta ortalama bir kişiyi işaret ederdi.
 *
 * `yonetim`: yalnız sahipte "Anketi aç / kapat" düğmesi (sunucuda
 * `_yonetici`).
 */
export function AnketSonuclari({ yonetim = false }: { yonetim?: boolean }) {
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const sonuc = useVeri<AnketSonucu[]>('anket_sonuclari', { p_token: oturum?.token });
  const [calisiyor, setCalisiyor] = useState(false);
  const liste = Array.isArray(sonuc.veri) ? sonuc.veri : null;
  const ucYok = sonuc.hata !== null && /could not find the function|schema cache/i.test(sonuc.hata);

  async function acKapat(a: AnketSonucu) {
    setCalisiyor(true);
    try {
      await rpc('anket_ac_kapat', { p_token: oturum?.token, p_anket: a.anket, p_acik: !a.acik });
      bildir(a.acik ? 'Anket kapatıldı.' : 'Anket açıldı; panolarda davet görünür.', 'basari');
      sonuc.yenile();
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'İşlem yapılamadı.', 'hata');
    } finally {
      setCalisiyor(false);
    }
  }

  if (ucYok) {
    return (
      <Card>
        <p className="text-[14px] text-ink">
          Paydaş anketi, SQL 0076 Supabase panelinde çalıştırıldıktan sonra kullanılabilir.
        </p>
      </Card>
    );
  }
  if (!liste) return null;
  const a = liste[0];
  if (!a) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-ink">{a.baslik}</p>
          <p className="text-[13px] text-muted">
            {a.acik ? 'Açık — panolarda davet görünüyor.' : 'Kapalı.'} İsimsiz; bir grupta en az{' '}
            {a.esik} yanıt olmadan sonuç gösterilmez.
          </p>
        </div>
        {yonetim && (
          <Button
            tur={a.acik ? 'sade' : 'birincil'}
            olcu="sm"
            yukleniyor={calisiyor}
            onClick={() => void acKapat(a)}
          >
            {a.acik ? 'Anketi kapat' : 'Anketi aç'}
          </Button>
        )}
      </div>

      {a.gruplar.map((g) => (
        <Card key={g.rol}>
          <h3 className="text-[16px] font-semibold text-ink">
            {ROL_ADI[g.rol]} anketi{' '}
            <span className="font-normal text-muted">
              · <span className="sk-sayi">{SAYI.format(g.yanit)}</span> yanıt
            </span>
          </h3>
          {!g.yeterli ? (
            <p className="mt-1 text-[14px] text-muted">
              Henüz yeterli yanıt yok (en az {a.esik}). Sonuçlar eşik aşılınca görünür.
            </p>
          ) : (
            <ol className="mt-3 flex flex-col gap-3">
              {g.maddeler.map((m, i) => {
                const toplam = m.dagilim.reduce((x, y) => x + y, 0);
                const katilan = (m.dagilim[3] ?? 0) + (m.dagilim[4] ?? 0);
                return (
                  <li key={m.madde} className="break-inside-avoid">
                    <p className="text-[14px] text-ink">
                      <span className="sk-sayi text-muted">{i + 1}.</span>{' '}
                      {ANKET_MADDELERI[g.rol][i]}
                    </p>
                    <div
                      aria-hidden="true"
                      className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-line-soft"
                    >
                      {m.dagilim.map((n, j) => (
                        <div
                          key={j}
                          style={{
                            width: `${toplam ? (100 * n) / toplam : 0}%`,
                            opacity: 0.35 + j * 0.16,
                          }}
                          className="h-full bg-[#2a78d6]"
                        />
                      ))}
                    </div>
                    <p className="mt-0.5 text-[12px] text-muted">
                      Ortalama {ortalama5(m.ortalama) ?? '—'} / 5 · katılıyorum ve tamamen
                      katılıyorum: %{toplam ? Math.round((100 * katilan) / toplam) : 0} ({katilan}/
                      {toplam}) · {m.dagilim.map((n, j) => `${LIKERT[j]?.deger}: ${n}`).join(', ')}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
          {g.yeterli && g.gorusler.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[14px] font-semibold text-ink">
                {ACIK_UCLU_SORU[g.rol]} ({g.gorusler.length} görüş)
              </summary>
              <ul className="mt-2 list-disc pl-5 text-[14px] text-ink">
                {g.gorusler.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      ))}
    </div>
  );
}
