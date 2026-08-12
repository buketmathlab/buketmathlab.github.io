import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SayfaBasligi } from '@/components/layout/Kabuk';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { Field, Input } from '@/components/ui/Field';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { rpc } from '@/services/supabase';
import { dosyaYukle, odevDosyaYolu, dosyayiDenetle } from '@/services/dosya';
import { pdfSatirlariniOku } from '@/services/pdf-metin';
import { anahtariCikar, type Cikarim } from '@/lib/cevap-anahtari';
import { AnahtarIzgarasi } from './AnahtarIzgarasi';
import { GecTeslimSecimi } from './GecTeslimSecimi';
import { OdevFormAlanlari, type OdevFormDegerleri } from './OdevFormAlanlari';
import type { Sinif } from '@/types/api';

type OdevDetay = {
  id: string;
  baslik: string;
  aciklama: string | null;
  tur: 'test' | 'acik';
  sinif_id: string;
  sinif: string;
  son_tarih: string;
  soru_sayisi: number | null;
  gec_teslim: boolean;
  sik_sayisi: number;
  cevap_anahtari: Record<string, string>;
  anahtar_yolu: string | null;
  odev_yolu: string | null;
  yayinda: boolean;
  gonderim_sayisi: number;
};

type PuanDegisimi = { ogrenci: string; eski_puan: number | null; yeni_puan: number };

/**
 * Ödev düzenleme.
 *
 * Oluşturma akışının aksine TEK SAYFA: öğretmen değerleri zaten biliyor,
 * üç adımda gezdirmek gereksiz sürtünme olurdu.
 *
 * YENİDEN PUANLAMA GÖRÜNÜR OLMALI. Cevap anahtarı düzeltilip gönderim
 * varsa sunucu tüm gönderimleri yeniden hesaplıyor. Bu, öğrencilerin notunu
 * değiştiren bir işlem — sessizce yapılamaz. Değişen her not ekranda
 * listeleniyor (denetim izine de yazılıyor).
 */
export function OdevDuzenle() {
  const { id = '' } = useParams();
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const git = useNavigate();

  const [form, setForm] = useState<OdevFormDegerleri>({
    baslik: '',
    aciklama: '',
    sinifId: '',
    sonTarih: '',
    soruSayisi: '',
    sonSecenek: 'E',
  });
  const [gecTeslim, setGecTeslim] = useState(true);
  const [anahtar, setAnahtar] = useState<Record<number, string>>({});
  const [cikarim, setCikarim] = useState<Cikarim | null>(null);
  const [yeniAnahtarPdf, setYeniAnahtarPdf] = useState<File | null>(null);
  const [yeniOdevPdf, setYeniOdevPdf] = useState<File | null>(null);
  const [okuyor, setOkuyor] = useState(false);
  const [okumaHatasi, setOkumaHatasi] = useState<string | null>(null);
  const [kaydediyor, setKaydediyor] = useState(false);
  const [degisenler, setDegisenler] = useState<PuanDegisimi[] | null>(null);

  const { veri: detay, durum, hata, yenile } = useVeri<OdevDetay>('odev_detay', {
    p_token: oturum?.token,
    p_id: id,
  });

  const { veri: siniflar } = useVeri<Sinif[]>('siniflar_listesi', {
    p_token: oturum?.token,
    p_arsiv: false,
  });

  // Sunucudan gelen kaydı forma yaz. Sadece ilk yüklemede: sonrasında
  // öğretmenin yazdıklarının üzerine yazmamalı.
  useEffect(() => {
    if (!detay) return;
    setForm({
      baslik: detay.baslik,
      aciklama: detay.aciklama ?? '',
      sinifId: detay.sinif_id,
      sonTarih: detay.son_tarih,
      soruSayisi: String(detay.soru_sayisi ?? ''),
      // Şık sayısı artık kayıtta (0010). Önceden her açılışta 'E' varsayılıyordu;
      // A–D'lik bir ödevi düzenleyen öğretmen seçimini yeniden yapmak zorundaydı.
      sonSecenek: detay.sik_sayisi === 4 ? 'D' : 'E',
    });
    setGecTeslim(detay.gec_teslim);
    const a: Record<number, string> = {};
    for (const [k, v] of Object.entries(detay.cevap_anahtari ?? {})) {
      const n = Number(k);
      if (Number.isInteger(n)) a[n] = v;
    }
    setAnahtar(a);
  }, [detay]);

  const n = Number(form.soruSayisi) || 0;
  const testMi = detay?.tur === 'test';

  function alanDegis<A extends keyof OdevFormDegerleri>(alan: A, deger: OdevFormDegerleri[A]) {
    setForm((f) => ({ ...f, [alan]: deger }));
  }

  async function anahtarPdfSecildi(dosya: File) {
    const sorun = dosyayiDenetle(dosya);
    if (sorun) return setOkumaHatasi(sorun);
    setYeniAnahtarPdf(dosya);
    setOkumaHatasi(null);
    setOkuyor(true);
    try {
      const satirlar = await pdfSatirlariniOku(dosya);
      const sonuc = anahtariCikar(satirlar, { soruSayisi: n, sonSecenek: form.sonSecenek });
      setCikarim(sonuc);
      setAnahtar(sonuc.anahtar);
    } catch (e) {
      setOkumaHatasi(e instanceof Error ? e.message : 'PDF okunamadı.');
      setCikarim(null);
    } finally {
      setOkuyor(false);
    }
  }

  async function kaydet() {
    if (!detay) return;
    setKaydediyor(true);
    setDegisenler(null);
    try {
      let odevYolu = detay.odev_yolu;
      let anahtarYolu = detay.anahtar_yolu;

      if (yeniOdevPdf) {
        bildir('Ödev PDF’i yükleniyor…');
        odevYolu = await dosyaYukle(yeniOdevPdf, odevDosyaYolu('sorular', yeniOdevPdf.name));
      }
      if (yeniAnahtarPdf) {
        bildir('Cevap anahtarı yükleniyor…');
        anahtarYolu = await dosyaYukle(yeniAnahtarPdf, odevDosyaYolu('anahtar', yeniAnahtarPdf.name));
      }

      const sonuc = await rpc<{ yeniden_puanlanan: PuanDegisimi[] }>('odev_guncelle', {
        p_token: oturum?.token,
        p_id: detay.id,
        p_baslik: form.baslik.trim(),
        p_aciklama: form.aciklama.trim() || null,
        p_sinif_id: form.sinifId,
        p_son_tarih: form.sonTarih,
        p_soru_sayisi: testMi ? n : null,
        p_cevap_anahtari: testMi ? anahtar : null,
        p_anahtar_yolu: anahtarYolu,
        p_odev_yolu: odevYolu,
        p_gec_teslim: gecTeslim,
        p_sik_sayisi: testMi ? (form.sonSecenek === 'D' ? 4 : 5) : null,
      });

      const degisti = sonuc.yeniden_puanlanan ?? [];
      if (degisti.length > 0) {
        // Not değiştiyse sayfada kal ve göster — bildirim kaybolur, bu bilgi
        // kaybolmamalı.
        setDegisenler(degisti);
        bildir(`Kaydedildi — ${degisti.length} öğrencinin puanı değişti`, 'basari');
        yenile();
      } else {
        bildir('Ödev güncellendi', 'basari');
        git('/ogretmen/odevler');
      }
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Kaydedilemedi.', 'hata');
    } finally {
      setKaydediyor(false);
    }
  }

  return (
    <>
      <SayfaBasligi
        baslik="Ödevi düzenle"
        aciklama={
          detay?.yayinda
            ? 'Bu ödev yayında. Cevap anahtarını değiştirirseniz gönderenler yeniden puanlanır.'
            : 'Taslak ödev. Yayınlamadan istediğiniz kadar değiştirebilirsiniz.'
        }
      />

      <AsyncBoundary
        durum={durum}
        bosBaslik="Ödev bulunamadı"
        bosAciklama="Bu ödev silinmiş olabilir."
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {detay && (
          <>
            {degisenler && degisenler.length > 0 && (
              <Card vurgu="uyari" className="mb-4">
                <p className="mb-2 font-semibold text-ink">
                  {`Cevap anahtarı değişti — ${degisenler.length} öğrencinin puanı yeniden hesaplandı`}
                </p>
                <ul className="mb-2 space-y-1">
                  {degisenler.map((d) => (
                    <li key={d.ogrenci} className="text-[14px] text-ink">
                      {d.ogrenci}:{' '}
                      <span className="sk-sayi text-muted">{d.eski_puan ?? '—'}</span>
                      {' → '}
                      <span className="sk-sayi font-semibold">{d.yeni_puan}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[13px] text-muted">
                  Bu değişiklikler denetim izine kaydedildi.
                </p>
              </Card>
            )}

            <Card>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Tag tur={detay.yayinda ? 'basari' : 'uyari'}>
                  {detay.yayinda ? 'Yayında' : 'Taslak'}
                </Tag>
                {detay.gonderim_sayisi > 0 && (
                  <Tag tur="bilgi">
                    <span className="sk-sayi">{`${detay.gonderim_sayisi} gönderim var`}</span>
                  </Tag>
                )}
              </div>

              <OdevFormAlanlari
                degerler={form}
                onDegis={alanDegis}
                siniflar={siniflar ?? []}
                testMi={testMi}
                turDegistirilebilir={false}
                tur={detay.tur}
              />

              <GecTeslimSecimi deger={gecTeslim} onDegis={setGecTeslim} />

              <Field
                etiket="Ödev PDF’i (sorular)"
                ipucu={
                  detay.odev_yolu
                    ? 'Yüklü bir dosya var. Yenisini seçerseniz onun yerini alır.'
                    : 'Henüz dosya yok.'
                }
              >
                {(k) => (
                  <Input
                    {...k}
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setYeniOdevPdf(e.target.files?.[0] ?? null)}
                  />
                )}
              </Field>

              {testMi && (
                <Field
                  etiket="Cevap anahtarı PDF’i"
                  ipucu={
                    detay.gonderim_sayisi > 0
                      ? 'Anahtar değişirse gönderen öğrenciler yeniden puanlanır.'
                      : 'Yeni bir PDF seçerseniz cevaplar yeniden okunur.'
                  }
                  {...(okumaHatasi ? { hata: okumaHatasi } : {})}
                >
                  {(k) => (
                    <Input
                      {...k}
                      type="file"
                      accept="application/pdf"
                      disabled={okuyor}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void anahtarPdfSecildi(f);
                      }}
                    />
                  )}
                </Field>
              )}
              {okuyor && <p className="mb-4 text-[13px] text-muted">PDF okunuyor…</p>}

              {testMi && n > 0 && (
                <div className="mb-4">
                  <AnahtarIzgarasi
                    soruSayisi={n}
                    sonSecenek={form.sonSecenek}
                    anahtar={anahtar}
                    cikarim={cikarim ?? undefined}
                    onDegis={(no, sik) =>
                      setAnahtar((a) => {
                        const y = { ...a };
                        if (sik === null) delete y[no];
                        else y[no] = sik;
                        return y;
                      })
                    }
                  />
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button tur="sade" onClick={() => git('/ogretmen/odevler')} tamGenislik>
                  Vazgeç
                </Button>
                <Button
                  onClick={kaydet}
                  tamGenislik
                  yukleniyor={kaydediyor}
                  yuklenmeMetni="Kaydediliyor"
                >
                  Değişiklikleri kaydet
                </Button>
              </div>
            </Card>
          </>
        )}
      </AsyncBoundary>
    </>
  );
}
