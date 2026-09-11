import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import type { AnalizKonu, AnalizKova, SinifAnalizi as Analiz } from '@/types/api';

const GUN = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });
const AY = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
// Ondalık ayracı VİRGÜL. `Gelisim.tsx` de böyle yazıyor; ortalamayı bir
// ekranda 71,4 bir ekranda 71.4 görmek öğretmene iki ayrı sayı gibi gelir.
const SAYI = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });

/**
 * Sınıfın haftalık, aylık ve dönemlik analizi (0040).
 *
 * Öğretmenin isteği: "o haftanın ödevlerinin ortalaması, haftalık olarak
 * iyi olan konular, çalışılması gereken konular… dönem sonunda da o
 * dönemin analizi."
 *
 * HESAP BURADA DEĞİL, SUNUCUDA. Ortalama ve konu oranları `sinif_analizi`
 * ucundan geliyor; eşikler bile yanıtın içinde (`esikler`). Arayüzde
 * hesaplasaydık aynı ödev bu ekranda ve konu karnesinde farklı sonuç
 * verebilirdi — öğretmen hangisine inanacağını bilemezdi.
 *
 * "ÇALIŞILMALI" BİR KONU DAMGASI, ÖĞRENCİ DAMGASI DEĞİL. Bu ekranda tek
 * bir öğrencinin adı geçmiyor: sınıfın konu durumu var. Öğrenci düzeyi
 * zaten konu karnesinde ve orada da gelişim gösteriliyor.
 *
 * AZ VERİ GİZLENMİYOR. Beş sorunun altındaki konu listede duruyor ama
 * "az veri" etiketiyle; iyi/çalışılmalı listelerine girmiyor. İki
 * soruluk bir konuya "çalışılması gerekiyor" demek, olmayan bir bilgi
 * vermek olurdu.
 */
export function SinifAnalizi() {
  const { id = '' } = useParams();
  const { oturum } = useOturum();
  const git = useNavigate();

  // Tarih aralığı: boşken sunucu son 12 haftayı veriyor. Dönem analizi
  // için öğretmen iki tarihi kendisi seçiyor (MEB takvimi her yıl
  // değiştiği için sabit dönem tarihi yazmadık).
  const [bas, setBas] = useState('');
  const [bit, setBit] = useState('');
  const [uygulanan, setUygulanan] = useState<{ bas: string; bit: string }>({
    bas: '',
    bit: '',
  });

  const { veri, durum, hata, yenile } = useVeri<Analiz>('sinif_analizi', {
    p_token: oturum?.token,
    p_sinif_id: id,
    p_baslangic: uygulanan.bas || null,
    p_bitis: uygulanan.bit || null,
  });

  return (
    <>
      <div className="print:hidden">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Button tur="sade" olcu="sm" onClick={() => git(`/ogretmen/siniflar/${id}`)}>
            ← Sınıf
          </Button>
          {veri && <Button onClick={() => window.print()}>Yazdır</Button>}
        </div>

        <Card className="mb-4">
          <h2 className="mb-1 text-[18px] text-ink">Dönem seçin</h2>
          <p className="mb-3 text-[14px] text-muted">
            Boş bırakırsanız son 12 hafta gösterilir. Dönem sonu analizi için
            dönemin başlangıç ve bitiş tarihlerini yazın.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-[14px] text-muted">
              Başlangıç
              <input
                type="date"
                value={bas}
                onChange={(e) => setBas(e.target.value)}
                className="mt-1 block h-12 rounded-lg border border-line bg-surface px-3 text-[16px] text-ink"
              />
            </label>
            <label className="text-[14px] text-muted">
              Bitiş
              <input
                type="date"
                value={bit}
                onChange={(e) => setBit(e.target.value)}
                className="mt-1 block h-12 rounded-lg border border-line bg-surface px-3 text-[16px] text-ink"
              />
            </label>
            <Button tur="ikincil" onClick={() => setUygulanan({ bas, bit })}>
              Uygula
            </Button>
            {(uygulanan.bas || uygulanan.bit) && (
              <Button
                tur="sade"
                onClick={() => {
                  setBas('');
                  setBit('');
                  setUygulanan({ bas: '', bit: '' });
                }}
              >
                Son 12 haftaya dön
              </Button>
            )}
          </div>
        </Card>
      </div>

      <AsyncBoundary
        durum={durum}
        bosBaslik="Bu aralıkta değerlendirilmiş ödev yok"
        bosAciklama="Son teslim tarihi geçmiş bir ödev olunca analiz burada belirir."
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {veri && (
          <article className="sk-analiz">
            <header className="border-b border-line pb-3">
              <h1 className="font-display text-[22px] font-semibold text-ink">
                {veri.sinif.ad} — ödev analizi
              </h1>
              <p className="mt-1 text-[13px] text-muted">
                {GUN.format(new Date(veri.aralik.baslangic))} –{' '}
                {GUN.format(new Date(veri.aralik.bitis))}
                {veri.aralik.varsayilan && ' (son 12 hafta)'} ·{' '}
                <span className="sk-sayi">{veri.mevcut}</span> öğrenci
              </p>
            </header>

            {/* DÖNEM ÖZETİ EN ÜSTTE. Öğretmenin ilk sorusu "genel durum
                ne" — haftalara inmeden önce onu görsün. */}
            <section className="mt-4">
              <h2 className="mb-2 font-display text-[18px] font-semibold text-ink">
                Dönem özeti
              </h2>
              <Card>
                <Ozet kova={veri.ozet} mevcut={veri.mevcut} />

                {veri.ozet.en_eksik_uc.length > 0 && (
                  <p className="mt-3 text-[15px] leading-relaxed text-ink">
                    En çok eksik kalan konular:{' '}
                    <strong>{veri.ozet.en_eksik_uc.join(', ')}</strong>
                  </p>
                )}

                <div className="mt-3 grid gap-2">
                  {veri.ozet.calisilmali.length > 0 && (
                    <p className="text-[14px] leading-relaxed text-ink">
                      <Tag tur="uyari">Çalışılmalı</Tag>{' '}
                      {veri.ozet.calisilmali.join(', ')}{' '}
                      <span className="text-muted">
                        (doğru oranı %{veri.esikler.calisilmali} altında)
                      </span>
                    </p>
                  )}
                  {veri.ozet.iyi.length > 0 && (
                    <p className="text-[14px] leading-relaxed text-ink">
                      <Tag tur="basari">İyi gidiyor</Tag> {veri.ozet.iyi.join(', ')}{' '}
                      <span className="text-muted">
                        (doğru oranı %{veri.esikler.iyi} ve üstü)
                      </span>
                    </p>
                  )}
                </div>

                <KonuListesi konular={veri.ozet.konular} esik={veri.esikler} />
              </Card>
            </section>

            <Kovalar
              baslik="Haftalık"
              bos="Bu aralıkta haftalık kırılım yok."
              satirlar={veri.haftalar.map((h) => ({
                anahtar: h.baslangic,
                etiket: `${GUN.format(new Date(h.baslangic))} – ${GUN.format(
                  new Date(h.bitis),
                )}`,
                kova: h,
              }))}
              mevcut={veri.mevcut}
              esik={veri.esikler}
            />

            <Kovalar
              baslik="Aylık"
              bos="Bu aralıkta aylık kırılım yok."
              satirlar={veri.aylar.map((a) => ({
                anahtar: a.ay,
                etiket: AY.format(new Date(a.ay)),
                kova: a,
              }))}
              mevcut={veri.mevcut}
              esik={veri.esikler}
            />

            <p className="mt-6 text-[13px] leading-relaxed text-muted">
              Analize yalnız <strong>son teslim tarihi geçmiş</strong> ödevler
              giriyor; ödev, son teslim tarihinin düştüğü haftaya sayılıyor.
              Konu dökümü yalnız test ödevlerinden çıkar — açık uçlu ödevin
              konu eşlemesi yoktur, ama puanı ortalamaya girer. Beş sorunun
              altındaki konular “az veri” diye işaretlenir.
            </p>
          </article>
        )}
      </AsyncBoundary>
    </>
  );
}

function Ozet({ kova, mevcut }: { kova: AnalizKova; mevcut: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {/* Ortalaması olmayan kova "0" DEĞİL "—" gösterir. "0" yazmak
          "sıfır aldılar" demek olurdu; oysa kimse göndermemiş. */}
      <Kutu
        etiket="Ortalama"
        deger={kova.ortalama === null ? '—' : SAYI.format(kova.ortalama)}
      />
      <Kutu etiket="Ödev" deger={SAYI.format(kova.odev_sayisi)} />
      <Kutu etiket="Gönderim" deger={SAYI.format(kova.gonderim)} />
      <Kutu etiket="Öğrenci" deger={SAYI.format(mevcut)} />
    </div>
  );
}

function Kutu({ etiket, deger }: { etiket: string; deger: string }) {
  return (
    <div className="rounded-lg border border-line p-3 text-center">
      <p className="sk-sayi font-display text-[24px] font-semibold text-ink">{deger}</p>
      <p className="mt-0.5 text-[13px] text-muted">{etiket}</p>
    </div>
  );
}

const DURUM_ETIKET: Record<AnalizKonu['durum'], string> = {
  iyi: 'İyi',
  orta: 'Orta',
  calisilmali: 'Çalışılmalı',
  az_veri: 'Az veri',
};

function KonuListesi({
  konular,
  esik,
}: {
  konular: AnalizKonu[];
  esik: { iyi: number; calisilmali: number; en_az_soru: number };
}) {
  if (konular.length === 0) {
    return (
      <p className="mt-3 text-[14px] text-muted">
        Bu aralıkta konu dökümü çıkaracak test ödevi yok.
      </p>
    );
  }
  return (
    <table className="mt-4 w-full border-collapse text-[14px]">
      <thead>
        <tr className="border-b border-line text-left text-muted">
          <th className="py-2 pr-3 font-semibold">Konu</th>
          <th className="py-2 pr-3 text-right font-semibold">Doğru</th>
          <th className="py-2 font-semibold">Durum</th>
        </tr>
      </thead>
      <tbody>
        {konular.map((k) => (
          <tr key={k.konu} className="border-b border-line">
            <td className="py-2 pr-3 text-ink">{k.konu}</td>
            <td className="py-2 pr-3 text-right text-ink">
              <span className="sk-sayi">
                {k.dogru}/{k.toplam}
              </span>{' '}
              <span className="text-muted">
                (%<span className="sk-sayi">{k.oran}</span>)
              </span>
            </td>
            <td className="py-2">
              {k.durum === 'calisilmali' ? (
                <Tag tur="uyari">{DURUM_ETIKET[k.durum]}</Tag>
              ) : k.durum === 'iyi' ? (
                <Tag tur="basari">{DURUM_ETIKET[k.durum]}</Tag>
              ) : (
                <Tag tur="notr">
                  {k.durum === 'az_veri'
                    ? `${DURUM_ETIKET[k.durum]} (${esik.en_az_soru} sorudan az)`
                    : DURUM_ETIKET[k.durum]}
                </Tag>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Kovalar({
  baslik,
  bos,
  satirlar,
  mevcut,
  esik,
}: {
  baslik: string;
  bos: string;
  satirlar: Array<{ anahtar: string; etiket: string; kova: AnalizKova }>;
  mevcut: number;
  esik: { iyi: number; calisilmali: number; en_az_soru: number };
}) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 font-display text-[18px] font-semibold text-ink">
        {baslik}
      </h2>
      {satirlar.length === 0 ? (
        <Card>
          <p className="text-[14px] text-muted">{bos}</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {satirlar.map((s) => (
            <Card key={s.anahtar}>
              <h3 className="mb-2 text-[15px] font-semibold text-ink">{s.etiket}</h3>
              <Ozet kova={s.kova} mevcut={mevcut} />
              <KonuListesi konular={s.kova.konular} esik={esik} />
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

/** Sınıf ekranından analizi açan kart. */
export function SinifAnaliziDugmesi({ sinifId }: { sinifId: string }) {
  const git = useNavigate();
  return (
    <Card>
      <p className="text-[15px] text-ink">
        Bu sınıfın haftalık, aylık ve dönemlik ödev analizi: ortalamalar, iyi
        giden ve çalışılması gereken konular.
      </p>
      <div className="mt-3">
        <Button
          tur="ikincil"
          olcu="sm"
          onClick={() => git(`/ogretmen/siniflar/${sinifId}/analiz`)}
        >
          Analiz
        </Button>
      </div>
    </Card>
  );
}
