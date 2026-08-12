import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { EwaluFigure } from '@/components/brand/EwaluFigure';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { sureDurumu } from '@/lib/son-tarih';
import type { OgrenciOdevleri, OgrenciOdev } from '@/types/api';

const TARIH = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' });

/**
 * Öğrencinin ödev listesi.
 *
 * SIRALAMA BİLİNÇLİ: gönderilmemiş ve süresi yaklaşanlar en üstte. Öğrenci
 * bu ekranı "ne yapmam gerekiyor?" diye açıyor; gönderilmiş ödevler o
 * sorunun cevabı değil, aşağıda duruyorlar.
 */
export function Odevlerim() {
  const { oturum } = useOturum();
  const git = useNavigate();

  const { veri, durum, hata, yenile } = useVeri<OgrenciOdevleri>(
    'ogrenci_odevleri',
    { p_token: oturum?.token },
    (v) => v.odevler.length === 0,
  );

  /**
   * Sıralama önceliği: YAPILABİLİR olan en üstte.
   *
   *   0 — gönderilmemiş ve hâlâ gönderilebilir  → yakın tarihli önce
   *   1 — gönderilmemiş ama teslim kapanmış     → yeni tarihli önce
   *   2 — gönderilmiş                           → yeni tarihli önce
   *
   * İlk sürümde yalnız "gönderilmemişler önce, tarihe göre artan" vardı ve
   * listenin başına ARTIK GÖNDERİLEMEYEN eski bir ödev geliyordu. Öğrenci bu
   * ekranı "şimdi ne yapmalıyım" diye açıyor; cevabı olmayan bir kart en
   * üstte durmamalı.
   */
  function oncelik(o: OgrenciOdev): number {
    if (o.gonderim) return 2;
    return sureDurumu(o.son_tarih).gecti && !o.gec_teslim ? 1 : 0;
  }

  const odevler = [...(veri?.odevler ?? [])].sort((a, b) => {
    const fark = oncelik(a) - oncelik(b);
    if (fark !== 0) return fark;
    return oncelik(a) === 0
      ? a.son_tarih.localeCompare(b.son_tarih)
      : b.son_tarih.localeCompare(a.son_tarih);
  });

  const bekleyen = odevler.filter((o) => oncelik(o) === 0).length;

  return (
    <>
      <div className="mb-5 flex items-center gap-3">
        <EwaluFigure poz={bekleyen === 0 ? 'kutlama' : 'calisma'} boyut={56} dekoratif />
        <div>
          <h1 className="font-display text-[24px] font-semibold text-ink">Ödevlerim</h1>
          <p className="text-[14px] text-muted">
            {bekleyen === 0
              ? 'Bekleyen ödevin yok. Eline sağlık.'
              : `${bekleyen} ödevin seni bekliyor.`}
          </p>
        </div>
      </div>

      <AsyncBoundary
        durum={durum}
        bosBaslik="Henüz ödev yok"
        bosAciklama="Öğretmenin ödev yayınlayınca burada görünecek."
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        <ul className="grid gap-3">
          {odevler.map((o: OgrenciOdev) => {
            const s = sureDurumu(o.son_tarih);
            const gonderildi = o.gonderim !== null;
            return (
              <li key={o.id}>
                <Card vurgu={!gonderildi && s.acil ? 'uyari' : 'yok'}>
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display text-[18px] font-semibold text-ink">
                        {o.baslik}
                      </p>
                      <p className="text-[13px] text-muted">
                        {o.tur === 'test' ? 'Test' : 'Açık uçlu'}
                        {o.soru_sayisi !== null && ` · ${o.soru_sayisi} soru`}
                        {' · '}
                        {TARIH.format(new Date(o.son_tarih))}
                      </p>
                    </div>
                    {gonderildi ? (
                      <div className="flex flex-wrap justify-end gap-1">
                        {o.gonderim!.puan !== null ? (
                          <Tag tur="basari">
                            <span className="sk-sayi">{`${o.gonderim!.puan} puan`}</span>
                          </Tag>
                        ) : (
                          <Tag tur="bilgi">Değerlendiriliyor</Tag>
                        )}
                        {o.gonderim!.gecikmeli && <Tag tur="uyari">Gecikmeli</Tag>}
                      </div>
                    ) : (
                      <div className="flex flex-wrap justify-end gap-1">
                        <Tag tur={s.acil ? 'uyari' : 'notr'}>{s.metin}</Tag>
                        {/* Kapanmış ödevi "yapılacak" gibi göstermek boş umut
                            olurdu; öğrenci neden gönderemediğini burada görsün. */}
                        {s.gecti && !o.gec_teslim && <Tag tur="notr">Teslim kapandı</Tag>}
                      </div>
                    )}
                  </div>

                  {gonderildi && o.gonderim!.puan !== null && (
                    <p className="mb-3 text-[13px] text-muted">
                      <span className="sk-sayi">{o.gonderim!.dogru}</span> doğru ·{' '}
                      <span className="sk-sayi">{o.gonderim!.yanlis}</span> yanlış ·{' '}
                      <span className="sk-sayi">{o.gonderim!.bos}</span> boş
                    </p>
                  )}

                  <Button
                    tur={gonderildi ? 'sade' : 'birincil'}
                    olcu="sm"
                    onClick={() => git(`/ogrenci/odev/${o.id}`)}
                  >
                    {gonderildi ? 'Sonucu gör' : s.gecti ? 'Ödeve bak' : 'Ödevi yap'}
                  </Button>
                </Card>
              </li>
            );
          })}
        </ul>
      </AsyncBoundary>
    </>
  );
}
