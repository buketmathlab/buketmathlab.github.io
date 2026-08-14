import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { KonuListesi, SoruNumaralari } from '@/components/ui/KonuListesi';
import { Tag } from '@/components/ui/Tag';
import { Field, Textarea } from '@/components/ui/Field';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { EwaluFigure } from '@/components/brand/EwaluFigure';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { rpc } from '@/services/supabase';
import { sureDurumu } from '@/lib/son-tarih';
import type { VeliPaneli } from '@/types/api';

const TARIH = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' });
const ZAMAN = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});
const PARA = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });

/**
 * Veli paneli.
 *
 * KURAL 6 — VELİYE CEVAP ANAHTARI GİTMEZ. Bu bir arayüz tercihi değil:
 * `veli_paneli` anahtarı, anahtar dosya yolunu ve anahtarın içeriğini hiç
 * döndürmüyor; `veliler_testleri.sql` 7. grubu dördünü de ayrı ayrı ölçüyor.
 * Burada gizlenecek bir şey yok çünkü hiç gelmiyor.
 *
 * Velinin gördüğü: çocuğun ödevlerini yapıp yapmadığı, aldığı puan ve
 * öğretmenle yazışma. Yani SÜREÇ — çözümler değil.
 */
export function VeliPanel() {
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const [metin, setMetin] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const okunduYazildi = useRef(false);

  const { veri, durum, hata, yenile } = useVeri<VeliPaneli>('veli_paneli', {
    p_token: oturum?.token,
  });

  useEffect(() => {
    if (!veri || okunduYazildi.current || !oturum?.token) return;
    okunduYazildi.current = true;
    void rpc('okundu_isaretle', { p_token: oturum.token }).catch(() => {
      // Okundu kaydı yazılamazsa panel çalışmaya devam etmeli.
    });
  }, [veri, oturum?.token]);

  async function gonder() {
    const t = metin.trim();
    if (!t) return;
    setGonderiliyor(true);
    try {
      // p_ogrenci_id GÖNDERİLMİYOR: sunucu velide bu parametreyi zaten yok
      // sayıyor ve mesajı velinin kendi çocuğuna yazıyor. Göndermek, sanki
      // seçilebilirmiş izlenimi verirdi.
      await rpc('mesaj_gonder', { p_token: oturum?.token, p_metin: t });
      setMetin('');
      yenile();
      bildir('Mesajınız öğretmene iletildi', 'basari');
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Mesaj gönderilemedi.', 'hata');
    } finally {
      setGonderiliyor(false);
    }
  }

  return (
    <AsyncBoundary
      durum={durum}
      bosBaslik="Henüz bilgi yok"
      bosAciklama="Öğretmen ödev yayınlayınca burada göreceksiniz."
      {...(hata ? { hataAciklama: hata } : {})}
      tekrarDene={yenile}
    >
      {veri && (
        <>
          <div className="mb-5 flex items-center gap-3">
            <EwaluFigure poz="karsilama" boyut={56} dekoratif className="shrink-0" />
            <div className="min-w-0">
              <h1 className="text-[24px] text-ink">{veri.ogrenci.ad}</h1>
              <p className="mt-0.5 text-[14px] text-muted">
                {veri.ogrenci.sinif ?? 'Özel ders'} · ödev durumu ve öğretmen mesajları
              </p>
            </div>
          </div>

          <Ozet odevler={veri.odevler} />

          <h2 className="mb-3 mt-8 text-[18px] text-ink">Ödevler</h2>
          {veri.odevler.length === 0 ? (
            <Card>
              <p className="text-[14px] text-muted">Henüz yayınlanmış ödev yok.</p>
            </Card>
          ) : (
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
                        gelmez. Veli paneli o hâlde de açılmalı. */}
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

          {veri.odemeler.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 text-[18px] text-ink">Ödemeler</h2>
              <Card>
                <ul className="divide-y divide-line">
                  {veri.odemeler.map((p, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-[14px] text-ink">
                        {TARIH.format(new Date(p.tarih))}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="sk-sayi text-[14px] text-ink">
                          {PARA.format(p.tutar)}
                        </span>
                        <Tag tur={p.odendi ? 'basari' : 'uyari'}>
                          {p.odendi ? 'Ödendi' : 'Bekliyor'}
                        </Tag>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}

          <h2 className="mb-3 mt-8 text-[18px] text-ink">Öğretmenle yazışma</h2>
          <Card className="mb-4">
            {veri.mesajlar.length === 0 ? (
              <p className="text-[14px] text-muted">
                Henüz mesaj yok. Sormak istediğinizi aşağıdan yazabilirsiniz.
              </p>
            ) : (
              <ul className="space-y-3">
                {veri.mesajlar.map((m, i) => {
                  const benim = m.kimden === 'veli';
                  return (
                    <li key={i} className={benim ? 'text-right' : ''}>
                      <span className="mb-1 block text-[12px] font-bold text-muted">
                        {benim ? 'Siz' : 'Öğretmen'} · {ZAMAN.format(new Date(m.zaman))}
                      </span>
                      <span
                        className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-sk-md px-3 py-2 text-left text-[15px] ${
                          benim ? 'bg-ink text-paper' : 'bg-line-soft text-ink'
                        }`}
                      >
                        {m.metin}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <Field etiket="Öğretmene mesaj">
              {(kimlik) => (
                <Textarea
                  {...kimlik}
                  rows={3}
                  value={metin}
                  onChange={(e) => setMetin(e.target.value)}
                  maxLength={4000}
                  placeholder="Sormak istediğinizi yazın."
                />
              )}
            </Field>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="sk-sayi text-[12px] text-muted">{metin.length}/4000</span>
              <Button
                onClick={gonder}
                yukleniyor={gonderiliyor}
                yuklenmeMetni="Gönderiliyor"
                {...(metin.trim() ? {} : { disabled: true })}
              >
                Gönder
              </Button>
            </div>
          </Card>
        </>
      )}
    </AsyncBoundary>
  );
}

/**
 * Üç sayılık özet.
 *
 * Veli uzun listeyi okumadan "durum ne?" sorusuna cevap alsın. Ortalama
 * BİLEREK yok: veli için anlamlı olan çocuğun ödevini yapıp yapmadığı;
 * sınıf içi sıralama çağrıştıran bir sayı bu ekrana ait değil.
 */
function Ozet({ odevler }: { odevler: VeliPaneli['odevler'] }) {
  const gonderdi = odevler.filter((o) => o.gonderildi).length;
  const kacirdi = odevler.filter((o) => !o.gonderildi && sureDurumu(o.son_tarih).gecti).length;
  const bekleyen = odevler.filter((o) => !o.gonderildi && !sureDurumu(o.son_tarih).gecti).length;

  return (
    <div className="grid grid-cols-3 gap-3">
      <Kutu deger={gonderdi} etiket="Gönderdi" />
      <Kutu deger={bekleyen} etiket="Bekleyen" />
      <Kutu deger={kacirdi} etiket="Kaçırdı" tehlike />
    </div>
  );
}

function Kutu({
  deger,
  etiket,
  tehlike,
}: {
  deger: number;
  etiket: string;
  tehlike?: boolean;
}) {
  return (
    <Card className="text-center">
      <p
        className={`sk-sayi font-display text-[28px] font-semibold ${
          tehlike && deger > 0 ? 'text-danger' : 'text-ink'
        }`}
      >
        {deger}
      </p>
      <p className="mt-1 text-[13px] text-muted">{etiket}</p>
    </Card>
  );
}
