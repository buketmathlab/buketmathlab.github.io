import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { KonuListesi, SoruNumaralari } from '@/components/ui/KonuListesi';
import { Tag } from '@/components/ui/Tag';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { rpc } from '@/services/supabase';
import { dosyaAdresi } from '@/services/dosya';
import { sureDurumu } from '@/lib/son-tarih';
import type { OdevGonderimleri as Veri, GonderimSatiri } from '@/types/api';

const TARIH = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Bir ödevin gönderim takibi ve açık uçlu puanlama ekranı.
 *
 * ÜÇ GRUP, BU SIRADA — sıralama öğretmenin bir sonraki işine göre:
 *   1. Puan bekliyor   → asıl iş burada, açık uçlu gönderimler
 *   2. Göndermeyenler  → takip edilecek öğrenciler
 *   3. Gönderenler     → bilgi; puanı ve gecikmesi görünür
 *
 * Liste SINIFIN TAMAMINI taşıyor (sunucu böyle döndürüyor): "kim göndermedi"
 * sorusu bu ekranın var oluş sebeplerinden biri, yalnız bir sayı vermek onu
 * cevapsız bırakırdı.
 *
 * PUANI ÖĞRETMEN VERİR. Açık uçlu cevaba sistem puan önermiyor (Kural 5);
 * ekran yalnız fotoğrafı açar ve öğretmenin girdiği puanı sunucuya iletir.
 */
export function OdevGonderimleri() {
  const { id = '' } = useParams();
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const git = useNavigate();

  const { veri, durum, hata, yenile } = useVeri<Veri>('odev_gonderimleri', {
    p_token: oturum?.token,
    p_id: id,
  });

  async function fotoAc(gonderimId: string) {
    try {
      // Yol istemcide tutulmuyor; imzalı adres her seferinde yeniden alınır.
      const { yol } = await rpc<{ yol: string | null }>('gonderim_foto_yolu', {
        p_token: oturum?.token,
        p_gonderim: gonderimId,
      });
      if (!yol) return bildir('Bu gönderimde fotoğraf yok.', 'hata');
      window.open(await dosyaAdresi(yol), '_blank', 'noopener');
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Fotoğraf açılamadı.', 'hata');
    }
  }

  const satirlar = veri?.satirlar ?? [];
  const bekleyen = satirlar.filter((s) => s.gonderdi && s.durum === 'incelemede');
  const gondermeyen = satirlar.filter((s) => !s.gonderdi);
  const gonderen = satirlar.filter((s) => s.gonderdi && s.durum !== 'incelemede');

  return (
    <>
      <div className="mb-4">
        <Button tur="sade" olcu="sm" onClick={() => git('/ogretmen/odevler')}>
          ← Ödevler
        </Button>
      </div>

      <AsyncBoundary
        durum={durum}
        bosBaslik="Gönderim bilgisi yok"
        bosAciklama="Bu ödev silinmiş olabilir."
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {veri && (
          <>
            <div className="mb-5">
              <h1 className="font-display text-[24px] font-semibold text-ink">
                {veri.odev.baslik}
              </h1>
              <p className="mt-1 text-[14px] text-muted">
                {veri.odev.sinif} · {veri.odev.tur === 'test' ? 'Test' : 'Açık uçlu'} ·{' '}
                {sureDurumu(veri.odev.son_tarih).metin}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Tag tur={veri.ozet.gonderen === veri.ozet.mevcut ? 'basari' : 'notr'}>
                  <span className="sk-sayi">
                    {`${veri.ozet.gonderen}/${veri.ozet.mevcut} gönderdi`}
                  </span>
                </Tag>
                {veri.ozet.gecikmeli > 0 && (
                  <Tag tur="uyari">
                    <span className="sk-sayi">{`${veri.ozet.gecikmeli} gecikmeli`}</span>
                  </Tag>
                )}
                {veri.ozet.puan_bekleyen > 0 && (
                  <Tag tur="bilgi">
                    <span className="sk-sayi">{`${veri.ozet.puan_bekleyen} puan bekliyor`}</span>
                  </Tag>
                )}
              </div>
            </div>

            {/* SINIFIN KONU ÖZETİ. Öğretmenin bir sonraki dersini planlarken
                bakacağı yer burası: otuz öğrencinin analizini tek tek okumak
                yerine sınıf hangi konuda takıldı, tek bakışta. Sunucuda
                toplanıyor — aksi hâlde otuz öğrencinin cevapları tarayıcıya
                inerdi. */}
            {(veri.konu_ozeti ?? []).length > 0 && (
              <Card className="mb-4">
                <KonuListesi analiz={veri.konu_ozeti ?? []} ses="ucuncu" />
              </Card>
            )}

            {bekleyen.length > 0 && (
              <Bolum baslik="Puan bekliyor" aciklama="Açık uçlu gönderimler. Puanı siz verirsiniz.">
                {bekleyen.map((s) => (
                  <Puanlama
                    key={s.ogrenci_id}
                    satir={s}
                    onFoto={fotoAc}
                    onKaydedildi={yenile}
                    token={oturum?.token ?? ''}
                  />
                ))}
              </Bolum>
            )}

            {gondermeyen.length > 0 && (
              <Bolum
                baslik={`Göndermeyenler (${gondermeyen.length})`}
                aciklama="Bu öğrencilerden henüz gönderim yok."
              >
                <Card>
                  <ul className="divide-y divide-line">
                    {gondermeyen.map((s) => (
                      <li key={s.ogrenci_id} className="py-2 text-[15px] text-ink first:pt-0 last:pb-0">
                        {s.ogrenci}
                      </li>
                    ))}
                  </ul>
                </Card>
              </Bolum>
            )}

            {gonderen.length > 0 && (
              <Bolum baslik={`Gönderenler (${gonderen.length})`}>
                <div className="grid gap-2">
                  {gonderen.map((s) => (
                    <Card key={s.ogrenci_id}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">{s.ogrenci}</p>
                          {s.zaman && (
                            <p className="text-[13px] text-muted">
                              {TARIH.format(new Date(s.zaman))}
                            </p>
                          )}
                          {s.dogru !== null && (
                            <p className="mt-1 text-[13px] text-muted">
                              <span className="sk-sayi">{s.dogru}</span> doğru ·{' '}
                              <span className="sk-sayi">{s.yanlis}</span> yanlış ·{' '}
                              <span className="sk-sayi">{s.bos}</span> boş
                            </p>
                          )}
                          {/* HANGİ SORULAR — öğretmenin isteği. "4 yanlış"
                              hangi öğrenciyle neyi konuşacağını söylemez;
                              "3, 7, 9 yanlış" söyler. */}
                          {((s.yanlis_sorular ?? []).length > 0 ||
                            (s.bos_sorular ?? []).length > 0) && (
                            <div className="mt-1">
                              <SoruNumaralari
                                yanlis={s.yanlis_sorular ?? []}
                                bos={s.bos_sorular ?? []}
                              />
                            </div>
                          )}
                          {s.ogretmen_yorum && (
                            <p className="mt-1 text-[13px] text-muted">
                              Notunuz: {s.ogretmen_yorum}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap justify-end gap-1">
                          {s.gecikmeli && <Tag tur="uyari">Gecikmeli</Tag>}
                          <Tag tur="basari">
                            <span className="sk-sayi">
                              {`${s.ogretmen_puan ?? s.puan ?? '—'} puan`}
                            </span>
                          </Tag>
                        </div>
                      </div>
                      {s.gonderim_id && s.foto_var && (
                        <div className="mt-3">
                          <Button tur="sade" olcu="sm" onClick={() => fotoAc(s.gonderim_id!)}>
                            Çözümü aç
                          </Button>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </Bolum>
            )}
          </>
        )}
      </AsyncBoundary>
    </>
  );
}

function Bolum({
  baslik,
  aciklama,
  children,
}: {
  baslik: string;
  aciklama?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="font-display text-[18px] font-semibold text-ink">{baslik}</h2>
      {aciklama && <p className="mb-3 text-[13px] text-muted">{aciklama}</p>}
      {!aciklama && <div className="mb-3" />}
      {children}
    </section>
  );
}

/** Tek bir açık uçlu gönderimin puanlama kartı. */
function Puanlama({
  satir,
  token,
  onFoto,
  onKaydedildi,
}: {
  satir: GonderimSatiri;
  token: string;
  onFoto: (gonderimId: string) => void;
  onKaydedildi: () => void;
}) {
  const { bildir } = useToast();
  const [puan, setPuan] = useState('');
  const [yorum, setYorum] = useState('');
  const [kaydediyor, setKaydediyor] = useState(false);
  const [alanHatasi, setAlanHatasi] = useState<string | null>(null);

  async function kaydet() {
    const n = Number(puan);
    // Sunucu da sınırı zorluyor; buradaki kontrol öğretmeni bir tur
    // beklemekten kurtarıyor, kuralın kendisi değil.
    if (puan.trim() === '' || Number.isNaN(n) || n < 0 || n > 100) {
      return setAlanHatasi('Puan 0 ile 100 arasında bir sayı olmalı.');
    }
    setAlanHatasi(null);
    setKaydediyor(true);
    try {
      await rpc('acik_puanla', {
        p_token: token,
        p_gonderim: satir.gonderim_id,
        p_puan: n,
        p_yorum: yorum.trim() || null,
      });
      bildir(`${satir.ogrenci} için ${n} puan kaydedildi`, 'basari');
      onKaydedildi();
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Puan kaydedilemedi.', 'hata');
    } finally {
      setKaydediyor(false);
    }
  }

  return (
    <Card vurgu="uyari" className="mb-2">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{satir.ogrenci}</p>
          {satir.zaman && (
            <p className="text-[13px] text-muted">{TARIH.format(new Date(satir.zaman))}</p>
          )}
        </div>
        {satir.gecikmeli && <Tag tur="uyari">Gecikmeli</Tag>}
      </div>

      {satir.gonderim_id && satir.foto_var && (
        <div className="mb-3">
          <Button tur="sade" olcu="sm" onClick={() => onFoto(satir.gonderim_id!)}>
            Çözümü aç
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="sm:w-[140px]">
          <Field etiket="Puan" zorunlu {...(alanHatasi ? { hata: alanHatasi } : {})}>
            {(k) => (
              <Input
                {...k}
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={puan}
                onChange={(e) => setPuan(e.target.value)}
              />
            )}
          </Field>
        </div>
        <div className="flex-1">
          <Field etiket="Not" ipucu="İsteğe bağlı. Öğrenci bu notu görecek.">
            {(k) => (
              <Textarea {...k} rows={2} value={yorum} onChange={(e) => setYorum(e.target.value)} />
            )}
          </Field>
        </div>
      </div>

      <Button onClick={kaydet} yukleniyor={kaydediyor} yuklenmeMetni="Kaydediliyor">
        Puanı kaydet
      </Button>
    </Card>
  );
}
