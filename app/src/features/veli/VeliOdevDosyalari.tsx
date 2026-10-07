import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useDosyaAc } from '@/components/DosyaAcici';
import { dosyaAdresi } from '@/services/dosya';

/**
 * Veli ödev kartı: "Soruları aç (PDF)" ve "Çözümü aç" (0071).
 *
 * Öğretmenin isteği: veli ödeve dokununca soru PDF'ini ve çocuğunun
 * gönderdiği çözümü açabilsin. CEVAP ANAHTARI YOK (Kural 6): `veli_paneli`
 * anahtarın yolunu hiç göndermiyor, `dosya_erisim_izni` de veliye anahtarı
 * hiçbir koşulda açmıyor.
 *
 * Çözüm `CozumDugmesi` (öğretmen) gibi: tek sayfa doğrudan açılır; birden
 * fazla sayfada "1. sayfa · 2. sayfa …" düğmeleri çıkar. Sekmeler TOPLU
 * açılmıyor: tarayıcının açılır pencere engelleyicisi ilkinden
 * sonrakileri sessizce yutar.
 */
export function VeliOdevDosyalari({
  odevYolu,
  cozumYollari,
}: {
  odevYolu: string | null;
  cozumYollari: string[];
}) {
  const dosya = useDosyaAc();
  const [sayfalarAcik, setSayfalarAcik] = useState(false);

  if (!odevYolu && cozumYollari.length === 0) return null;

  const ac = (yol: string, hataMetni: string) =>
    void dosya.ac(() => dosyaAdresi(yol), { hataMetni });

  function cozumuAc() {
    if (cozumYollari.length === 1) ac(cozumYollari[0]!, 'Çözüm açılamadı.');
    else setSayfalarAcik((a) => !a);
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex flex-wrap gap-2">
        {odevYolu && (
          <Button tur="sade" olcu="sm" onClick={() => ac(odevYolu, 'Sorular açılamadı.')}>
            Soruları aç (PDF)
          </Button>
        )}
        {cozumYollari.length > 0 && (
          <Button
            tur="sade"
            olcu="sm"
            onClick={cozumuAc}
            {...(cozumYollari.length > 1 ? { 'aria-expanded': sayfalarAcik } : {})}
          >
            Çözümü aç
          </Button>
        )}
      </div>
      {sayfalarAcik && cozumYollari.length > 1 && (
        <div
          className="mt-2 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Çözüm sayfaları"
        >
          <span className="text-[13px] text-muted">
            <span className="sk-sayi">{cozumYollari.length}</span> sayfa:
          </span>
          {cozumYollari.map((y, i) => (
            <Button key={y} tur="sade" olcu="sm" onClick={() => ac(y, 'Çözüm açılamadı.')}>
              {`${i + 1}. sayfa`}
            </Button>
          ))}
        </div>
      )}
      {dosya.yedek}
    </div>
  );
}
