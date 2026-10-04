import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  cizgiYolu,
  degerYazisi,
  enYakin,
  gorunenEtiketler,
  xKonumu,
  yKonumu,
  type Alan,
} from '@/lib/grafik';

/**
 * ÇİZGİ GRAFİĞİ — aylık gelişim (müdür ekranları, 0061).
 *
 * KÜTÜPHANE YOK (`Gelisim` ile aynı gerekçe): bir SVG ve birkaç satır
 * hesap (`lib/grafik.ts`).
 *
 * TEK EKSEN, 0–100: ortalama ve gönderim oranı aynı ölçekte; ikinci y
 * ekseni yok. Boş ay çizgiyi KESER — veri yoksa sıfır çizilmez.
 *
 * RENKLER kimlik taşır, puana göre değişmez (düşük ayı kırmızıya boyamak
 * yok). İki renk renk körlüğü denetiminden geçti (dataviz doğrulayıcısı:
 * en kötü ΔE 24.7). Renk tek başına taşımıyor: lejant, uçta değer
 * etiketi ve tablo görünümü var.
 *
 * EĞİLİM İDDİASI YOK — ok, "yükseliyor" cümlesi yok. Grafik sayıları
 * gösteriyor, yorumu okuyan yapıyor (`Gelisim`'deki ilke).
 */
export type Seri = {
  ad: string;
  renk: 'mavi' | 'turuncu';
  birim: '' | '%';
  degerler: (number | null)[];
};

const RENK: Record<Seri['renk'], string> = { mavi: '#2a78d6', turuncu: '#eb6834' };
const YUKSEKLIK = 200;

export function CizgiGrafik({
  baslik,
  etiketler,
  uzunEtiketler,
  seriler,
  ekSutunlar = [],
  bosMetni = 'Henüz gösterilecek veri yok.',
}: {
  baslik: string;
  /** Eksen etiketleri: "Eyl". */
  etiketler: string[];
  /** İpucu ve tabloda: "Eylül 2026". */
  uzunEtiketler?: string[];
  seriler: Seri[];
  /** Yalnız tablo görünümünde: ödev ve soru sayıları gibi. */
  ekSutunlar?: { ad: string; degerler: (string | number)[] }[];
  bosMetni?: string;
}) {
  const kutu = useRef<HTMLElement>(null);
  const [genislik, setGenislik] = useState(640);
  const [secili, setSecili] = useState<number | null>(null);
  const aciklamaId = useId();

  useEffect(() => {
    const el = kutu.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const g = new ResizeObserver((k) => {
      const w = k[0]?.contentRect.width;
      if (w && w > 0) setGenislik(Math.round(w));
    });
    g.observe(el);
    return () => g.disconnect();
  }, []);

  const uzun = uzunEtiketler ?? etiketler;
  const adet = etiketler.length;
  const veriVar = seriler.some((s) => s.degerler.some((d) => d !== null));

  const a: Alan = {
    genislik,
    yukseklik: YUKSEKLIK,
    sol: 34,
    sag: seriler.length > 0 ? 44 : 12,
    ust: 12,
    alt: 26,
  };
  const etiketGorunur = gorunenEtiketler(adet, Math.max(2, Math.floor((genislik - a.sol - a.sag) / 40)));

  // Uç etiketleri: her serinin SON değeri. İki etiket üst üste binerse
  // ikincisi kaydırılıyor.
  const uclar = seriler.map((s) => {
    let i = s.degerler.length - 1;
    while (i >= 0 && s.degerler[i] === null) i--;
    return i < 0 ? null : { i, d: s.degerler[i] as number, y: yKonumu(s.degerler[i] as number, a) };
  });
  if (uclar.length === 2 && uclar[0] && uclar[1] && Math.abs(uclar[0].y - uclar[1].y) < 13) {
    const [ust, alt] = uclar[0].y <= uclar[1].y ? [uclar[0], uclar[1]] : [uclar[1], uclar[0]];
    ust.y -= 7;
    alt.y += 7;
  }

  function imlec(e: PointerEvent<SVGRectElement>) {
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    setSecili(enYakin(((e.clientX - r.left) / r.width) * genislik, adet, a));
  }

  function tus(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setSecili((s) => {
      const simdi = s ?? adet - 1;
      return Math.max(0, Math.min(adet - 1, simdi + (e.key === 'ArrowRight' ? 1 : -1)));
    });
  }

  const ozet = seriler
    .map((s) => {
      const u = uclar[seriler.indexOf(s)];
      return u ? `${s.ad} son değer ${degerYazisi(u.d, s.birim)} (${uzun[u.i]})` : `${s.ad} verisi yok`;
    })
    .join('; ');

  return (
    <figure ref={kutu} className="m-0">
      <figcaption className="sr-only">{baslik}</figcaption>

      {seriler.length >= 2 && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted" aria-hidden="true">
          {seriler.map((s) => (
            <li key={s.ad} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: RENK[s.renk] }} />
              {s.ad}
            </li>
          ))}
        </ul>
      )}

      {!veriVar ? (
        <p className="py-6 text-center text-[14px] text-muted">{bosMetni}</p>
      ) : (
        <div className="relative w-full">
          <svg
            width="100%"
            height={YUKSEKLIK}
            viewBox={`0 0 ${genislik} ${YUKSEKLIK}`}
            role="img"
            aria-label={`${baslik}. ${ozet}.`}
            aria-describedby={aciklamaId}
            tabIndex={0}
            onKeyDown={tus}
            onFocus={() => setSecili((s) => s ?? adet - 1)}
            onBlur={() => setSecili(null)}
            className="block overflow-visible rounded-sk-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            {[0, 50, 100].map((t) => (
              <g key={t}>
                <line
                  x1={a.sol}
                  x2={genislik - a.sag}
                  y1={yKonumu(t, a)}
                  y2={yKonumu(t, a)}
                  stroke="var(--color-line)"
                  strokeWidth={1}
                />
                <text
                  x={a.sol - 6}
                  y={yKonumu(t, a)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={11}
                  fill="var(--color-muted)"
                >
                  {t}
                </text>
              </g>
            ))}

            {etiketler.map((et, i) =>
              etiketGorunur[i] ? (
                <text
                  key={i}
                  x={xKonumu(i, adet, a)}
                  y={YUKSEKLIK - 8}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--color-muted)"
                >
                  {et}
                </text>
              ) : null,
            )}

            {secili !== null && (
              <line
                x1={xKonumu(secili, adet, a)}
                x2={xKonumu(secili, adet, a)}
                y1={a.ust}
                y2={YUKSEKLIK - a.alt}
                stroke="var(--color-muted)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            )}

            {seriler.map((s) => (
              <g key={s.ad} data-seri={s.ad}>
                <path
                  d={cizgiYolu(s.degerler, a)}
                  fill="none"
                  stroke={RENK[s.renk]}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {s.degerler.map((d, i) =>
                  d === null ? null : (
                    <circle
                      key={i}
                      data-nokta=""
                      cx={xKonumu(i, adet, a)}
                      cy={yKonumu(d, a)}
                      r={secili === i ? 5 : 4}
                      fill={RENK[s.renk]}
                      stroke="var(--color-surface)"
                      strokeWidth={2}
                    />
                  ),
                )}
              </g>
            ))}

            {seriler.map((s, k) => {
              const u = uclar[k];
              if (!u) return null;
              return (
                <text
                  key={s.ad}
                  x={xKonumu(u.i, adet, a) + 8}
                  y={u.y}
                  dominantBaseline="middle"
                  fontSize={12}
                  fontWeight={600}
                  fill="var(--color-ink)"
                >
                  {degerYazisi(u.d, s.birim)}
                </text>
              );
            })}

            <rect
              x={a.sol}
              y={a.ust}
              width={Math.max(0, genislik - a.sol - a.sag)}
              height={YUKSEKLIK - a.ust - a.alt}
              fill="transparent"
              onPointerMove={imlec}
              onPointerDown={imlec}
              onPointerLeave={() => setSecili(null)}
            />
          </svg>

          <p id={aciklamaId} className="sr-only">
            Ok tuşlarıyla aylar arasında gezebilirsiniz. Bütün değerler aşağıdaki tabloda.
          </p>

          <div aria-live="polite" className="pointer-events-none">
            {secili !== null && (
              <div
                className="absolute top-0 z-10 min-w-[120px] rounded-sk-sm border border-line bg-surface px-3 py-2 text-[13px] shadow-sm"
                style={
                  xKonumu(secili, adet, a) > genislik / 2
                    ? { right: genislik - xKonumu(secili, adet, a) + 10 }
                    : { left: xKonumu(secili, adet, a) + 10 }
                }
              >
                <p className="mb-1 text-[12px] text-muted">{uzun[secili]}</p>
                {seriler.map((s) => (
                  <p key={s.ad} className="flex items-center gap-2">
                    <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: RENK[s.renk] }} />
                    <strong className="sk-sayi text-ink">{degerYazisi(s.degerler[secili] ?? null, s.birim)}</strong>
                    <span className="text-muted">{s.ad}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {veriVar && (
        <details className="mt-2 text-[13px]">
          <summary className="cursor-pointer text-link">Tablo olarak gör</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-muted">
                  <th className="py-1 pr-3 font-normal">Ay</th>
                  {seriler.map((s) => (
                    <th key={s.ad} className="py-1 pr-3 text-right font-normal">
                      {s.ad}
                    </th>
                  ))}
                  {ekSutunlar.map((e) => (
                    <th key={e.ad} className="py-1 pr-3 text-right font-normal">
                      {e.ad}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uzun.map((et, i) => (
                  <tr key={i} className="border-t border-line-soft">
                    <td className="py-1 pr-3 text-ink">{et}</td>
                    {seriler.map((s) => (
                      <td key={s.ad} className="sk-sayi py-1 pr-3 text-right text-ink">
                        {degerYazisi(s.degerler[i] ?? null, s.birim)}
                      </td>
                    ))}
                    {ekSutunlar.map((e) => (
                      <td key={e.ad} className="sk-sayi py-1 pr-3 text-right text-ink">
                        {e.degerler[i]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}
