import { useNavigate } from 'react-router-dom';
import { SayfaBasligi } from '@/components/layout/Kabuk';
import { useDosyaAc } from '@/components/DosyaAcici';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { dosyaAdresi } from '@/services/dosya';
import type { SinifNotCizelgesi } from '@/types/api';
import { OdevSatiri } from './OdevSatiri';

const SAYI = new Intl.NumberFormat('tr-TR');

/**
 * BİR ŞUBENİN ÖDEVLERİ VE CEVAP ANAHTARLARI (0067).
 *
 * Öğretmenin isteği: Sınıflar sekmesindeki şube kutusunda "Konu analizi"nden
 * sonra "Ödevler ve cevap anahtarları" gelsin. Sınıf sayfasının "Ödevler"
 * bölümünün kendi sayfası: veri aynı uçtan (`sinif_not_cizelgesi`), satır
 * aynı bileşen (`OdevSatiri`). Kapsam da aynı: öğretmen erişebildiği
 * ödevleri, müdür ve sahibin önizlemesi şubenin bütün ödevlerini görür.
 */
export function SinifOdevleri({
  sinifId,
  geri,
  onizleme = false,
}: {
  sinifId: string;
  geri: string;
  onizleme?: boolean;
}) {
  const git = useNavigate();
  const { oturum } = useOturum();
  const dosya = useDosyaAc();
  const { veri, durum, hata, yenile } = useVeri<SinifNotCizelgesi>('sinif_not_cizelgesi', {
    p_token: oturum?.token,
    p_sinif_id: sinifId,
    ...(onizleme ? { p_onizleme: true } : {}),
  });
  const soru = veri?.odevler.reduce((t, o) => t + (o.soru_sayisi ?? 0), 0) ?? 0;

  return (
    <>
      <div className="mb-4">
        <Button tur="sade" olcu="sm" onClick={() => git(geri)}>
          ← Sınıflar
        </Button>
      </div>
      <AsyncBoundary
        durum={durum}
        bosBaslik="Sınıf bulunamadı"
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {veri && (
          <>
            <SayfaBasligi
              baslik={`${veri.sinif.ad} — Ödevler ve cevap anahtarları`}
              aciklama={`${veri.odevler.length} ödev · ${SAYI.format(soru)} soru. Soru dosyası ve cevap anahtarı her ödevin altında.`}
            />
            <Card>
              {veri.odevler.length === 0 ? (
                <p className="text-[14px] text-muted">Bu sınıfta yayınlanmış ödev yok.</p>
              ) : (
                <ul className="divide-y divide-line-soft">
                  {veri.odevler.map((o) => (
                    <OdevSatiri
                      key={o.id}
                      odev={o}
                      mevcut={veri.mevcut}
                      ac={(yol) => void dosya.ac(() => dosyaAdresi(yol))}
                    />
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </AsyncBoundary>
      {dosya.yedek}
    </>
  );
}
