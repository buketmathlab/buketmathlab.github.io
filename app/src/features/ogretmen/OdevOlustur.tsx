import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SayfaBasligi } from '@/components/layout/Kabuk';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { rpc } from '@/services/supabase';
import { dosyaYukle, odevDosyaYolu, dosyayiDenetle } from '@/services/dosya';
import { pdfSatirlariniOku } from '@/services/pdf-metin';
import { anahtariCikar, type Cikarim, type SonSecenek } from '@/lib/cevap-anahtari';
import { AnahtarIzgarasi } from './AnahtarIzgarasi';
import { GecTeslimSecimi } from './GecTeslimSecimi';
import { SikSayisiSecimi } from './SikSayisiSecimi';
import type { Sinif } from '@/types/api';

type Adim = 1 | 2 | 3;

/**
 * Ödev oluşturma.
 *
 * ÜÇ ADIM, ÜÇÜ DE GERİ ALINABİLİR. Ödev TASLAK olarak kaydedilir; yayınlama
 * ayrı ve bilinçli bir eylemdir (Part XXVIII). Böylece doğrulanmamış bir
 * cevap anahtarı öğrenciye düşemez.
 *
 * İKİ PDF, İKİ FARKLI AMAÇ:
 *   Ödev PDF'i    → sorular. Öğrenci teslim etmeden de görür.
 *   Anahtar PDF'i → cevaplar. Sistem buradan çıkarım yapar; öğrenci yalnız
 *                   teslim ettikten sonra görebilir, veli hiçbir zaman.
 *
 * Anahtar PDF'i yüklemek ZORUNLU DEĞİL: çıkarım tutmazsa ya da elde PDF
 * yoksa öğretmen cevapları ızgaradan elle girebilir. Sistemin çıkaramaması
 * ödev oluşturmayı engellememeli.
 */
export function OdevOlustur() {
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const git = useNavigate();

  const [adim, setAdim] = useState<Adim>(1);

  // 1. adım
  const [baslik, setBaslik] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [sinifId, setSinifId] = useState('');
  const [tur, setTur] = useState<'test' | 'acik'>('test');
  const [sonTarih, setSonTarih] = useState('');
  const [soruSayisi, setSoruSayisi] = useState('20');
  const [sonSecenek, setSonSecenek] = useState<SonSecenek>('E');
  // VARSAYILAN KAPALI. Öğretmen: "Ben genelde süre dolduktan sonra ödev
  // kabul etmiyorum. Nadiren bu seçimi işaretlerim." Varsayılan, sık olanı
  // temsil etmeli; nadir olanı her ödevde elle kapatmak zorunda kalmasın.
  const [gecTeslim, setGecTeslim] = useState(false);
  const [formHatasi, setFormHatasi] = useState<string | null>(null);

  // 2. adım
  const [odevPdf, setOdevPdf] = useState<File | null>(null);
  const [anahtarPdf, setAnahtarPdf] = useState<File | null>(null);
  const [okuyor, setOkuyor] = useState(false);
  const [okumaHatasi, setOkumaHatasi] = useState<string | null>(null);
  const [cikarim, setCikarim] = useState<Cikarim | null>(null);
  const [anahtar, setAnahtar] = useState<Record<number, string>>({});

  const [kaydediyor, setKaydediyor] = useState(false);

  const { veri: siniflar, durum, hata, yenile } = useVeri<Sinif[]>(
    'siniflar_listesi',
    { p_token: oturum?.token, p_arsiv: false },
    (v) => v.length === 0,
  );

  const n = Number(soruSayisi) || 0;

  function ilerle() {
    if (!baslik.trim()) return setFormHatasi('Ödeve bir başlık yazın.');
    if (!sinifId) return setFormHatasi('Sınıf seçin.');
    if (!sonTarih) return setFormHatasi('Son tarih seçin.');
    if (tur === 'test' && (n < 1 || n > 200)) {
      return setFormHatasi('Soru sayısı 1 ile 200 arasında olmalı.');
    }
    setFormHatasi(null);
    // Açık uçlu ödevde cevap anahtarı kavramı yok; doğrudan son adıma.
    setAdim(tur === 'test' ? 2 : 3);
  }

  /** Anahtar PDF'i seçildiğinde tarayıcıda okunur ve çıkarım yapılır. */
  async function anahtarSecildi(dosya: File) {
    const sorun = dosyayiDenetle(dosya);
    if (sorun) {
      setOkumaHatasi(sorun);
      return;
    }
    setAnahtarPdf(dosya);
    setOkumaHatasi(null);
    setOkuyor(true);
    try {
      const satirlar = await pdfSatirlariniOku(dosya);
      const sonuc = anahtariCikar(satirlar, { soruSayisi: n, sonSecenek });
      setCikarim(sonuc);
      setAnahtar(sonuc.anahtar);
      setAdim(3);
    } catch (e) {
      // Okunamayan PDF ödev oluşturmayı bitirmez: elle girmeye devam.
      setOkumaHatasi(e instanceof Error ? e.message : 'PDF okunamadı.');
      setCikarim(null);
    } finally {
      setOkuyor(false);
    }
  }

  function anahtariDegistir(no: number, sik: string | null) {
    setAnahtar((a) => {
      const y = { ...a };
      if (sik === null) delete y[no];
      else y[no] = sik;
      return y;
    });
  }

  async function taslagiKaydet() {
    setKaydediyor(true);
    try {
      let odevYolu: string | null = null;
      let anahtarYolu: string | null = null;

      if (odevPdf) {
        bildir('Ödev PDF’i yükleniyor…');
        odevYolu = await dosyaYukle(odevPdf, odevDosyaYolu('sorular', odevPdf.name));
      }
      if (anahtarPdf) {
        bildir('Cevap anahtarı yükleniyor…');
        anahtarYolu = await dosyaYukle(anahtarPdf, odevDosyaYolu('anahtar', anahtarPdf.name));
      }

      await rpc('odev_olustur', {
        p_token: oturum?.token,
        p_baslik: baslik.trim(),
        p_aciklama: aciklama.trim() || null,
        p_sinif_id: sinifId,
        p_tur: tur,
        p_son_tarih: sonTarih,
        p_soru_sayisi: tur === 'test' ? n : null,
        p_cevap_anahtari: tur === 'test' ? anahtar : null,
        p_anahtar_yolu: anahtarYolu,
        p_odev_yolu: odevYolu,
        p_gec_teslim: gecTeslim,
        p_sik_sayisi: tur === 'test' ? (sonSecenek === 'D' ? 4 : 5) : 5,
      });

      bildir('Ödev taslak olarak kaydedildi', 'basari');
      git('/ogretmen/odevler');
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Ödev kaydedilemedi.', 'hata');
    } finally {
      setKaydediyor(false);
    }
  }

  const eksikSayisi =
    tur === 'test' ? Array.from({ length: n }, (_, i) => i + 1).filter((i) => !anahtar[i]).length : 0;

  return (
    <>
      <SayfaBasligi
        baslik="Yeni ödev"
        aciklama="Ödev taslak olarak kaydedilir. Yayınlamak ayrı bir adımdır."
      />

      {/* Adım göstergesi. Ekran okuyucu için sıra ve toplam açıkça yazılı. */}
      <ol className="mb-5 flex gap-2 text-[13px]" aria-label="Adımlar">
        {(['Bilgiler', 'Dosyalar', 'Cevap anahtarı'] as const).map((ad, i) => {
          const no = (i + 1) as Adim;
          const aktif = adim === no;
          const gecildi = adim > no;
          return (
            <li
              key={ad}
              aria-current={aktif ? 'step' : undefined}
              className={
                'flex-1 rounded-sk-sm border px-2 py-1 text-center ' +
                (aktif
                  ? 'border-ink bg-ink font-semibold text-paper'
                  : gecildi
                    ? 'border-line bg-line-soft text-muted'
                    : 'border-line text-muted')
              }
            >
              <span className="sk-sayi">{no}</span>. {ad}
            </li>
          );
        })}
      </ol>

      {adim === 1 && (
        <AsyncBoundary
          durum={durum}
          bosBaslik="Önce sınıf ekleyin"
          bosAciklama="Ödev oluşturmak için en az bir sınıf gerekiyor."
          bosEylem={<Button onClick={() => git('/ogretmen/siniflar')}>Sınıflara git</Button>}
          {...(hata ? { hataAciklama: hata } : {})}
          tekrarDene={yenile}
        >
          <Card>
            <Field etiket="Başlık" zorunlu>
              {(k) => (
                <Input
                  {...k}
                  value={baslik}
                  onChange={(e) => setBaslik(e.target.value)}
                  placeholder="Örn. Türev testi — sayfa 84"
                />
              )}
            </Field>

            <Field etiket="Açıklama" ipucu="İsteğe bağlı. Öğrenciye not düşmek isterseniz.">
              {(k) => (
                <Textarea
                  {...k}
                  rows={2}
                  value={aciklama}
                  onChange={(e) => setAciklama(e.target.value)}
                />
              )}
            </Field>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <Field etiket="Sınıf" zorunlu>
                  {(k) => (
                    <Select {...k} value={sinifId} onChange={(e) => setSinifId(e.target.value)}>
                      <option value="">Seçin…</option>
                      {siniflar?.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.ad}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
              <div className="flex-1">
                <Field etiket="Son tarih" zorunlu>
                  {(k) => (
                    <Input
                      {...k}
                      type="date"
                      value={sonTarih}
                      onChange={(e) => setSonTarih(e.target.value)}
                    />
                  )}
                </Field>
              </div>
            </div>

            <Field etiket="Tür" ipucu="Testte puanı sistem hesaplar; açık uçluda siz verirsiniz.">
              {(k) => (
                <Select
                  {...k}
                  value={tur}
                  onChange={(e) => setTur(e.target.value as 'test' | 'acik')}
                >
                  <option value="test">Test (çoktan seçmeli)</option>
                  <option value="acik">Açık uçlu</option>
                </Select>
              )}
            </Field>

            {tur === 'test' && (
              <>
                <Field etiket="Soru sayısı" zorunlu>
                  {(k) => (
                    <Input
                      {...k}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={200}
                      value={soruSayisi}
                      onChange={(e) => setSoruSayisi(e.target.value)}
                    />
                  )}
                </Field>
                <SikSayisiSecimi deger={sonSecenek} onDegis={setSonSecenek} />
              </>
            )}

            <GecTeslimSecimi deger={gecTeslim} onDegis={setGecTeslim} />

            {formHatasi && (
              <p role="alert" className="mb-3 text-[13px] font-semibold text-danger">
                {formHatasi}
              </p>
            )}

            <Button onClick={ilerle} tamGenislik>
              Devam
            </Button>
          </Card>
        </AsyncBoundary>
      )}

      {adim === 2 && (
        <Card>
          <Field
            etiket="Ödev PDF’i (sorular)"
            ipucu="Öğrenci bunu teslim etmeden de görebilir. İsteğe bağlı."
          >
            {(k) => (
              <Input
                {...k}
                type="file"
                accept="application/pdf"
                onChange={(e) => setOdevPdf(e.target.files?.[0] ?? null)}
              />
            )}
          </Field>
          {odevPdf && (
            <p className="mb-4 text-[13px] text-success">Seçildi: {odevPdf.name}</p>
          )}

          <Field
            etiket="Cevap anahtarı PDF’i"
            ipucu="Cevaplar bundan çıkarılır. Öğrenci yalnız teslim ettikten sonra görebilir."
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
                  if (f) void anahtarSecildi(f);
                }}
              />
            )}
          </Field>

          {okuyor && <p className="mb-4 text-[13px] text-muted">PDF okunuyor…</p>}

          <p className="mb-4 rounded-sk-sm bg-line-soft p-3 text-[13px] text-muted">
            PDF’ler cihazınızda okunur; cevap çıkarımı için hiçbir yere gönderilmez.
            Anahtar PDF’i yüklemek zorunlu değil — cevapları bir sonraki adımda elle
            de girebilirsiniz.
          </p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button tur="sade" onClick={() => setAdim(1)} tamGenislik>
              Geri
            </Button>
            <Button onClick={() => setAdim(3)} tamGenislik disabled={okuyor}>
              {anahtarPdf ? 'Devam' : 'Anahtarı elle gireceğim'}
            </Button>
          </div>
        </Card>
      )}

      {adim === 3 && (
        <Card>
          {tur === 'test' ? (
            <>
              <AnahtarIzgarasi
                soruSayisi={n}
                sonSecenek={sonSecenek}
                anahtar={anahtar}
                cikarim={cikarim ?? undefined}
                onDegis={anahtariDegistir}
              />
              {eksikSayisi > 0 && (
                <p className="mt-4 rounded-sk-sm bg-warning-bg p-3 text-[13px] text-warning">
                  Taslağı eksik anahtarla kaydedebilirsiniz, ama <strong>yayınlayamazsınız</strong> —
                  sunucu eksik anahtarlı ödevi reddeder. Kalan {eksikSayisi} cevabı sonra da
                  tamamlayabilirsiniz.
                </p>
              )}
            </>
          ) : (
            <p className="text-[14px] text-muted">
              Açık uçlu ödevde cevap anahtarı yok. Öğrenci çözümünü gönderir, puanı siz
              verirsiniz.
            </p>
          )}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
            <Button tur="sade" onClick={() => setAdim(tur === 'test' ? 2 : 1)} tamGenislik>
              Geri
            </Button>
            <Button
              onClick={taslagiKaydet}
              tamGenislik
              yukleniyor={kaydediyor}
              yuklenmeMetni="Kaydediliyor"
            >
              Taslağı kaydet
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
