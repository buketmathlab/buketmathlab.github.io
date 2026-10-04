import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ortalamaYazisi } from '@/lib/odev-kiyasi-metni';
import type { SinifNotCizelgesi } from '@/types/api';

const TARIH = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });
const gun = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);

export type OdevSatirVerisi = SinifNotCizelgesi['odevler'][number];

/**
 * Ödev satırı. 0063: "Müdür verilen ödevleri de cevap anahtarını da
 * görebilsin" — soru PDF'i ve anahtar (harfler + varsa PDF) burada.
 * Dosyalar `dosya_erisim_izni` üzerinden imzalı adresle açılıyor; müdüre
 * yalnız yayındaki ödevlerin soru ve anahtar PDF'leri açık.
 */
export function OdevSatiri({
  odev: o,
  mevcut,
  ac,
}: {
  odev: OdevSatirVerisi;
  mevcut: number;
  ac: (yol: string) => void;
}) {
  const [anahtarAcik, setAnahtarAcik] = useState(false);
  const harfler = Object.entries(o.cevap_anahtari ?? {})
    .map(([no, sik]) => [Number(no), sik] as const)
    .filter(([no]) => Number.isFinite(no))
    .sort((a, b) => a[0] - b[0]);
  const anahtarVar = harfler.length > 0 || !!o.anahtar_yolu;
  const panelId = `anahtar-${o.id}`;

  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="break-words text-[15px] font-semibold text-ink">{o.baslik}</p>
          <p className="text-[13px] text-muted">
            {o.ogretmen ?? '—'} · {o.tur === 'test' ? 'test' : 'açık uçlu'} · son tarih{' '}
            {TARIH.format(gun(o.son_tarih))}
          </p>
        </div>
        <p className="shrink-0 text-right text-[13px] text-muted">
          <span className="sk-sayi text-[15px] font-semibold text-ink">
            {o.soru_sayisi === null ? 'soru sayısı yok' : `${o.soru_sayisi} soru`}
          </span>
          <br />
          <span className="sk-sayi">
            {o.gonderim}/{o.beklenen ?? mevcut}
          </span>{' '}
          gönderdi
          {o.sure_doldu ? <> · ort. {ortalamaYazisi(o.ortalama) ?? '—'}</> : <> · süresi sürüyor</>}
        </p>
      </div>

      {(o.odev_yolu || anahtarVar) && (
        <div className="mt-1 flex flex-wrap gap-2">
          {o.odev_yolu && (
            <Button tur="sade" olcu="sm" onClick={() => ac(o.odev_yolu as string)}>
              Soruları aç (PDF)
            </Button>
          )}
          {anahtarVar && (
            <Button
              tur="sade"
              olcu="sm"
              aria-expanded={anahtarAcik}
              aria-controls={panelId}
              onClick={() => setAnahtarAcik((a) => !a)}
            >
              Cevap anahtarı {anahtarAcik ? '▴' : '▾'}
            </Button>
          )}
        </div>
      )}

      {anahtarAcik && (
        <div id={panelId} className="mt-2 rounded-sk-sm bg-paper p-3">
          {harfler.length > 0 ? (
            <ol
              aria-label={`${o.baslik} cevap anahtarı`}
              className="grid grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-1.5"
            >
              {harfler.map(([no, sik]) => (
                <li
                  key={no}
                  className="sk-sayi rounded border border-line bg-surface px-2 py-1 text-center text-[13px] text-ink"
                >
                  <span className="text-muted">{no}.</span> <strong>{sik}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[13px] text-muted">Bu ödevde harf anahtarı yok.</p>
          )}
          {o.anahtar_yolu && (
            <Button
              tur="sade"
              olcu="sm"
              className="mt-2"
              onClick={() => ac(o.anahtar_yolu as string)}
            >
              Anahtar PDF'ini aç
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
