import { Card } from '@/components/ui/Card';
import { KonuListesi, SoruNumaralari } from '@/components/ui/KonuListesi';
import { Tag } from '@/components/ui/Tag';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { sureDurumu } from '@/lib/son-tarih';
import type { VeliPaneli } from '@/types/api';

const TARIH = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' });
const ZAMAN = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Velinin ödev listesi.
 *
 * Velinin gördüğü SÜREÇ: çocuğun ödevini yapıp yapmadığı, aldığı puan,
 * hangi konuda ve hangi soruda eksik kaldığı. ÇÖZÜMLER DEĞİL.
 *
 * KURAL 6 iki kademede: cevap anahtarı `veli_paneli`'nden hiç gelmiyor,
 * ve gelen "yanlış sorular" bilgisi yalnız NUMARA — ne çocuğun
 * işaretlediği şık ne de doğrusu.
 */
export function VeliOdevler() {
  const { oturum } = useOturum();

  const { veri, durum, hata, yenile } = useVeri<VeliPaneli>(
    'veli_paneli',
    { p_token: oturum?.token },
    (v) => v.odevler.length === 0,
  );

  return (
    <>
      <h1 className="mb-5 text-[24px] text-ink">Ödevler</h1>

      <AsyncBoundary
        durum={durum}
        bosBaslik="Henüz yayınlanmış ödev yok"
        bosAciklama="Öğretmen ödev yayınlayınca burada göreceksiniz."
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {veri && (
          <div className="space-y-2">
            {veri.odevler.map((o, i) => {
              const sure = sureDurumu(o.son_tarih);
              return (
                <Card key={i}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{o.baslik}</p>
                      <p className="mt-1 text-[13px] text-muted">
                        Son tarih {TARIH.format(new Date(o.son_tarih))}
                        {o.gonderildi && o.gonderim_zamani && (
                          <> · {ZAMAN.format(new Date(o.gonderim_zamani))} tarihinde gönderdi</>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      {o.gonderildi ? (
                        <Tag tur="basari">Gönderdi</Tag>
                      ) : sure.gecti ? (
                        <Tag tur="tehlike">Göndermedi</Tag>
                      ) : (
                        <Tag tur="notr">{sure.metin}</Tag>
                      )}
                      {o.puan !== null && (
                        <Tag tur="basari">
                          <span className="sk-sayi">{o.puan} puan</span>
                        </Tag>
                      )}
                      {o.gonderildi && o.puan === null && (
                        <Tag tur="uyari">Öğretmen bakıyor</Tag>
                      )}
                    </div>
                  </div>

                  {/* NUMARA GİDİYOR, ŞIK GİTMİYOR (Kural 6).
                      Öğretmenin isteği "veli de hangi soruları yanlış
                      yaptığını görebilsin"di. Numara velinin işine yarar:
                      çocuğuyla o soruya bakabilir. Şıkları göstermek —
                      çocuğun verdiği cevabı da, doğrusunu da — dört
                      seçenekli bir soruda anahtarı vermeye doğru bir
                      adımdır. Sunucu da zaten göndermiyor. */}
                  {/* `?? []`: 0020 panelde çalıştırılmadan önce bu alanlar
                      gelmez. Veli ekranı o hâlde de açılmalı. */}
                  {((o.yanlis_sorular ?? []).length > 0 ||
                    (o.bos_sorular ?? []).length > 0) && (
                    <div className="mt-3 border-t border-line pt-3">
                      <SoruNumaralari
                        yanlis={o.yanlis_sorular ?? []}
                        bos={o.bos_sorular ?? []}
                      />
                    </div>
                  )}

                  {(o.konu_analizi ?? []).length > 0 && (
                    <div className="mt-3 border-t border-line pt-3">
                      <KonuListesi analiz={o.konu_analizi ?? []} ses="ucuncu" />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </AsyncBoundary>
    </>
  );
}
