import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useDosyaAc } from '@/components/DosyaAcici';
import { dosyaAdresi } from '@/services/dosya';
import { buCihazinYazdirmaAdimi } from '@/lib/yazdirma-yonergesi';

/**
 * Veli ödev kartı: "Soruları aç (PDF)" ve "Çocuğunuzun çözümünü aç" (0071).
 *
 * AD "ÇOCUĞUNUZUN": öğretmenin isteği — veli düğmeyi cevap anahtarı
 * sanmasın. Açılan şey çocuğun kendi gönderdiği kâğıt; ad bunu söylüyor.
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
  const yazdirmaAdimi = buCihazinYazdirmaAdimi();

  if (!odevYolu && cozumYollari.length === 0) return null;

  const ac = (yol: string, hataMetni: string) =>
    void dosya.ac(() => dosyaAdresi(yol), { hataMetni });

  function cozumuAc() {
    if (cozumYollari.length === 1) ac(cozumYollari[0]!, 'Çocuğunuzun çözümü açılamadı.');
    else setSayfalarAcik((a) => !a);
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex flex-wrap gap-2">
        {odevYolu && (
          <>
            <Button tur="sade" olcu="sm" onClick={() => ac(odevYolu, 'Sorular açılamadı.')}>
              Soruları aç (PDF)
            </Button>
            {/* SORULARI YAZDIR — öğretmenin kararı: çıktıyı öğrenci ya da
                VELİ alabilsin. Evde yazıcı çoğu zaman velinin elinde.

                Aynı dosyayı aynı yoldan açıyor; adım cümlesi öğrenci
                ekranıyla ORTAK (`lib/yazdirma-yonergesi.ts`) — ikinci bir
                kopya bir gün ayrışırdı. */}
            <Button tur="sade" olcu="sm" onClick={() => ac(odevYolu, 'Sorular açılamadı.')}>
              Soruları yazdır
            </Button>
          </>
        )}
        {cozumYollari.length > 0 && (
          <Button
            tur="sade"
            olcu="sm"
            onClick={cozumuAc}
            {...(cozumYollari.length > 1 ? { 'aria-expanded': sayfalarAcik } : {})}
          >
            Çocuğunuzun çözümünü aç
          </Button>
        )}
      </div>
      {/* Adım düğmenin altında, her zaman görünür: veli sekme
          değiştirmeden önce okusun (öğrenci ekranıyla aynı gerekçe). */}
      {odevYolu && (
        <p className="mt-2 text-[13px] text-muted" data-test="yazdirma-adimi">
          Çıktı almak için: {yazdirmaAdimi}
        </p>
      )}
      {sayfalarAcik && cozumYollari.length > 1 && (
        <div
          className="mt-2 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Çocuğunuzun çözüm sayfaları"
        >
          <span className="text-[13px] text-muted">
            <span className="sk-sayi">{cozumYollari.length}</span> sayfa:
          </span>
          {cozumYollari.map((y, i) => (
            <Button key={y} tur="sade" olcu="sm" onClick={() => ac(y, 'Çocuğunuzun çözümü açılamadı.')}>
              {`${i + 1}. sayfa`}
            </Button>
          ))}
        </div>
      )}
      {dosya.yedek}
    </div>
  );
}
