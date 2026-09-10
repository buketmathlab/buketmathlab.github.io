import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { kunyeyiOku, type KunyeRaporu } from '@/lib/odev-kunye';
import type { SonSecenek } from '@/lib/cevap-anahtari';
import type { Konular } from '@/lib/konu-atama';

type Props = {
  soruSayisi: number;
  sonSecenek: SonSecenek;
  onUygula: (anahtar: Record<number, string>, konular: Konular) => void;
};

/**
 * KÜNYEDEN DOLDUR — Claude'da üretilen soru kâğıdının anahtarını ve
 * SORU BAŞINA KONUSUNU tek yapıştırmayla alır.
 *
 * Neden gerekiyor: öğretmenin gerçek ödev PDF'lerinde sorular GÖRSEL
 * olarak gömülü (`odev-pdf-ozeti.ts`'teki ölçüm). Yani konu, PDF'ten
 * çıkarılamıyor ve bugün her ödevde tek tek elle giriliyor — oysa konu
 * karnesi tamamen o alana dayanıyor. Kâğıdı üreten Claude hangi sorunun
 * hangi konu olduğunu zaten biliyor; künye o bilgiyi taşıyor.
 *
 * ÖNİZLEME ZORUNLU, OTOMATİK DOLDURMA YOK (Part XXVIII). Yapıştırmak
 * hiçbir şeyi değiştirmiyor; ekran ne okuduğunu söylüyor, uygulayan
 * öğretmen. `PdfOnerileri` ve `AnahtarIzgarasi` ile aynı kural.
 *
 * Bu, 5. kuralın ("notlandırmada asla yapay zekâ kullanma") korunma
 * noktası: anahtarı yapay zekâ önerse de yayına öğretmenin gözünden
 * geçerek gidiyor.
 */
export function KunyePaneli({ soruSayisi, sonSecenek, onUygula }: Props) {
  const [acik, setAcik] = useState(false);
  const [metin, setMetin] = useState('');

  // Rapor her tuşta yeniden hesaplanıyor — saf bir fonksiyon, ucuz.
  const rapor: KunyeRaporu | null =
    metin.trim() === '' ? null : kunyeyiOku(metin, { soruSayisi, sonSecenek });

  if (!acik) {
    return (
      <div className="mt-6 border-t border-line pt-5">
        <Button tur="sade" olcu="sm" onClick={() => setAcik(true)}>
          Künyeden doldur
        </Button>
        <p className="mt-2 text-[12px] text-muted">
          Soru kâğıdını hazırlarken aldığınız künyeyi yapıştırın; cevap anahtarı ve her
          sorunun konusu birlikte dolsun.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-sk-sm border border-line bg-line-soft p-3">
      <p className="mb-1 text-[14px] font-bold text-ink">Künyeden doldur</p>
      <p className="mb-3 text-[12px] text-muted">
        Her satır: soru numarası, cevap, konu. Örnek: <code>1 A Türev</code>. Word’deki cevap
        anahtarı tablosunu doğrudan yapıştırabilirsiniz.
      </p>

      <label className="sr-only" htmlFor="kunye-metni">
        Künye metni
      </label>
      <textarea
        id="kunye-metni"
        value={metin}
        onChange={(e) => setMetin(e.target.value)}
        rows={6}
        spellCheck={false}
        placeholder={'1  A  Türev\n2  C  Türev\n3  B  Limit'}
        className="w-full rounded-sk-sm border border-line bg-surface p-2 font-mono text-[13px] text-ink"
      />

      {rapor && (
        <div className="mt-3">
          {rapor.bos ? (
            /* "BU KÜNYE DEĞİL" DURUMU. Sessizce boş bir önizleme
               göstermek, öğretmene yanlış dosyayı yapıştırdığını
               söylemezdi. */
            <p className="rounded-sk-sm bg-warning-bg p-3 text-[13px] text-warning">
              Bu metinden hiçbir satır okunamadı. Her satırın{' '}
              <strong>numara, cevap, konu</strong> düzeninde olması gerekiyor — örnek:{' '}
              <code>1 A Türev</code>.
            </p>
          ) : (
            <>
              <p className="text-[13px] text-ink">
                <strong>{rapor.bulunan.length}</strong> sorunun cevabı,{' '}
                <strong>{Object.keys(rapor.konular).length}</strong> sorunun konusu okundu.
              </p>

              {rapor.eksik.length > 0 && (
                <p className="mt-2 text-[13px] text-muted">
                  Künyede geçmeyen soru: {rapor.eksik.join(', ')}. Bunlar boş kalacak.
                </p>
              )}
              {rapor.konusuz.length > 0 && (
                <p className="mt-2 text-[13px] text-muted">
                  Konusu yazılmamış soru: {rapor.konusuz.join(', ')}.
                </p>
              )}
              {rapor.celiskili.length > 0 && (
                <p className="mt-2 text-[13px] text-warning">
                  Şu sorular künyede iki kez geçiyor: {rapor.celiskili.join(', ')}.{' '}
                  <strong>İlk satır</strong> kullanılacak.
                </p>
              )}
              {rapor.okunamayan.length > 0 && (
                <div className="mt-2 rounded-sk-sm bg-warning-bg p-2">
                  <p className="text-[13px] text-warning">
                    {rapor.okunamayan.length} satır okunamadı:
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-[12px] text-warning">
                    {rapor.okunamayan.slice(0, 5).map((h) => (
                      <li key={h.satirNo}>
                        {h.satirNo}. satır — {h.sebep}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
        <Button
          tur="sade"
          onClick={() => {
            setAcik(false);
            setMetin('');
          }}
          tamGenislik
        >
          Vazgeç
        </Button>
        <Button
          onClick={() => {
            if (!rapor || rapor.bos) return;
            onUygula(rapor.anahtar, rapor.konular);
            setAcik(false);
            setMetin('');
          }}
          // Okunacak bir şey yokken düğme çalışmıyor: basıldığında hiçbir
          // şeyin değişmemesi, öğretmene "uygulandı" hissi verirdi.
          disabled={!rapor || rapor.bos}
          tamGenislik
        >
          Uygula
        </Button>
      </div>
    </div>
  );
}
