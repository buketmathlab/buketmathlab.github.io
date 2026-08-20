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
import { KonuAtama } from './KonuAtama';
import { PdfOnerileri } from './PdfOnerileri';
import { GecTeslimSecimi } from './GecTeslimSecimi';
import { SikSayisiSecimi } from './SikSayisiSecimi';
import { sunucuyaHazirla, type Konular } from '@/lib/konu-atama';
import { odevPdfOzeti, type PdfOzeti } from '@/lib/odev-pdf-ozeti';
import type { CokluOdevSonucu, Sinif } from '@/types/api';

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
  // ÇOKLU SINIF (0030). Aynı ödevi 9A, 9B ve 9C'ye vermek için akıştan üç kez
  // geçmek gerekiyordu; PDF'ler de üç kez yükleniyordu. Artık seçim bir küme.
  const [sinifIdler, setSinifIdler] = useState<string[]>([]);
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
  const [konular, setKonular] = useState<Konular>({});
  const [pdfOzet, setPdfOzet] = useState<PdfOzeti | null>(null);
  const [onerilenKonu, setOnerilenKonu] = useState<string | undefined>(undefined);

  const [kaydediyor, setKaydediyor] = useState(false);

  const { veri: siniflar, durum, hata, yenile } = useVeri<Sinif[]>(
    'siniflar_listesi',
    { p_token: oturum?.token, p_arsiv: false },
    (v) => v.length === 0,
  );

  // Otomatik tamamlama listesi. Gelmezse konu alanı çalışmaya devam eder —
  // öneri bir kolaylık, koşul değil (Part VIII: yedek davranış).
  const { veri: konuOnerileri } = useVeri<string[]>('konu_onerileri', {
    p_token: oturum?.token,
  });

  const n = Number(soruSayisi) || 0;

  function ilerle() {
    if (!baslik.trim()) return setFormHatasi('Ödeve bir başlık yazın.');
    if (sinifIdler.length === 0) return setFormHatasi('En az bir sınıf seçin.');
    if (!sonTarih) return setFormHatasi('Son tarih seçin.');
    if (tur === 'test' && (n < 1 || n > 200)) {
      return setFormHatasi('Soru sayısı 1 ile 200 arasında olmalı.');
    }
    setFormHatasi(null);
    // Açık uçlu ödevde cevap anahtarı kavramı yok; doğrudan son adıma.
    setAdim(tur === 'test' ? 2 : 3);
  }

  /**
   * Ödev (soru) PDF'ini okuyup ÖNERİ üretir.
   *
   * OKUMA HATASI ÖDEV OLUŞTURMAYI ENGELLEMEZ. Bu bir kolaylık; PDF taranmış
   * olabilir, şablonu tanımayabiliriz, dosya bozuk olabilir. Hepsinde
   * öneri kutusu çıkmaz ve ekran bugünkü gibi çalışır (Part VIII).
   * Öğretmene hata da göstermiyoruz: istemediği bir işin başarısızlığını
   * bildirmek, olmayan bir sorunu varmış gibi gösterirdi.
   */
  async function odevPdfiniOku(dosya: File) {
    try {
      setPdfOzet(odevPdfOzeti(await pdfSatirlariniOku(dosya)));
    } catch {
      setPdfOzet(null);
    }
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
      // PDF'LER BİR KEZ YÜKLENİYOR — kaç sınıf seçilmiş olursa olsun.
      // Dosya yolu ödevin id'sinden bağımsız üretiliyor (`odevDosyaYolu`),
      // dolayısıyla kopyalar aynı yolu paylaşabiliyor. Anahtarın paylaşılması
      // Kural 6'yı delmiyor: `dosya_erisim_izni` öğrenciye erişimi KENDİ
      // gönderimi üzerinden veriyor ve `coklu_sinif_testleri.sql` 7. grubu
      // başka sınıfın teslimiyle anahtarın açılmadığını ayrıca ölçüyor.
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

      const ortak = {
        p_token: oturum?.token,
        p_baslik: baslik.trim(),
        p_aciklama: aciklama.trim() || null,
        p_tur: tur,
        p_son_tarih: sonTarih,
        p_soru_sayisi: tur === 'test' ? n : null,
        p_cevap_anahtari: tur === 'test' ? anahtar : null,
        p_anahtar_yolu: anahtarYolu,
        p_odev_yolu: odevYolu,
        p_gec_teslim: gecTeslim,
        p_sik_sayisi: tur === 'test' ? (sonSecenek === 'D' ? 4 : 5) : 5,
        // Açık uçlu ödevde konu analizi yapılamaz: anahtar yok, hangi sorunun
        // yanlış olduğu bilinmiyor. Konu alanı da o yüzden yalnız testte var.
        p_konular: tur === 'test' ? sunucuyaHazirla(konular, n) : null,
      };

      try {
        const sonuc = await rpc<CokluOdevSonucu>('odevler_coklu_olustur', {
          ...ortak,
          p_sinif_idler: sinifIdler,
        });
        const adlar = sonuc.odevler.map((o) => o.sinif).join(', ');
        bildir(
          sonuc.odevler.length === 1
            ? 'Ödev taslak olarak kaydedildi'
            : `${sonuc.odevler.length} ödev taslak olarak kaydedildi (${adlar})`,
          'basari',
        );
      } catch (e) {
        // 0030 PANELDE HENÜZ ÇALIŞTIRILMADIYSA. PostgREST'in cevabı İngilizce
        // ve teknik; ekranı bozmak yerine tek sınıflık eski yola düşüyoruz —
        // ödev oluşturmak, yeni bir SQL dosyasının çalıştırılmasına bağlı
        // olmamalı (Part VIII: yedek davranış).
        const ucYok =
          e instanceof Error && /could not find the function|schema cache/i.test(e.message);
        if (!ucYok) throw e;
        if (sinifIdler.length > 1) {
          throw new Error(
            'Birden çok sınıfa ödev verme bu sistemde henüz açılmadı. ' +
              'Tek sınıf seçerek kaydedebilirsiniz.',
          );
        }
        await rpc('odev_olustur', { ...ortak, p_sinif_id: sinifIdler[0] });
        bildir('Ödev taslak olarak kaydedildi', 'basari');
      }

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

            {/* SINIFLAR — ONAY KUTUSU, `select multiple` DEĞİL.
                Çoklu `select` dokunmatikte kullanılamaz: seçimi korumak için
                ctrl/cmd basılı tutmak gerekiyor ve telefonda öyle bir tuş yok.
                Kutular ayrıca kaç sınıfın seçili olduğunu tek bakışta veriyor. */}
            <fieldset className="mb-4">
              <legend className="mb-1 block text-[14px] font-medium text-ink">
                Sınıflar <span aria-hidden="true">*</span>
              </legend>
              <p className="mb-2 text-[13px] text-muted">
                Birden çok sınıf seçebilirsiniz; her sınıf için ayrı bir ödev oluşur.
                PDF’ler bir kez yüklenir.
              </p>
              <div className="flex flex-wrap gap-2">
                {siniflar?.map((s) => {
                  const secili = sinifIdler.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={
                        'flex min-h-[44px] cursor-pointer items-center gap-2 rounded-sk-sm border px-3 ' +
                        'text-[15px] focus-within:outline focus-within:outline-2 ' +
                        'focus-within:outline-offset-2 focus-within:outline-ink ' +
                        (secili
                          ? 'border-ink bg-ink font-semibold text-paper'
                          : 'border-line text-ink')
                      }
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={secili}
                        onChange={() =>
                          setSinifIdler((y) =>
                            y.includes(s.id) ? y.filter((x) => x !== s.id) : [...y, s.id],
                          )
                        }
                      />
                      {/* Seçim rengin YANINDA yazıyla da veriliyor: renk tek
                          başına bilgi taşımamalı. */}
                      <span aria-hidden="true">{secili ? '✓' : '+'}</span>
                      <span>{s.ad}</span>
                    </label>
                  );
                })}
              </div>
              {sinifIdler.length > 1 && (
                <p className="mt-2 text-[13px] text-muted">
                  <span className="sk-sayi">{sinifIdler.length}</span> sınıf seçildi — her
                  birinin gönderimleri ve karnesi ayrı tutulur.
                </p>
              )}
            </fieldset>

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
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setOdevPdf(f);
                  if (f) void odevPdfiniOku(f);
                  else setPdfOzet(null);
                }}
              />
            )}
          </Field>
          {odevPdf && (
            <p className="mb-2 text-[13px] text-success">Seçildi: {odevPdf.name}</p>
          )}
          {pdfOzet && (
            <PdfOnerileri
              ozet={pdfOzet}
              mevcutSoruSayisi={n}
              secililer={sinifIdler}
              siniflar={siniflar ?? []}
              onSoruSayisi={(x) => setSoruSayisi(String(x))}
              onKonu={setOnerilenKonu}
              // ÜZERİNE YAZMIYOR, EKLİYOR. Öğretmen 1. adımda üç şube seçmiş
              // olabilir; PDF'ten okunan tek sınıf o seçimi silseydi, önerinin
              // "hiçbir şey değiştirmez" sözü bozulurdu.
              onSinif={(id) => setSinifIdler((y) => (y.includes(id) ? y : [...y, id]))}
            />
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

              {n > 0 && (
                <div className="mt-6 border-t border-line pt-5">
                  <KonuAtama
                    soruSayisi={n}
                    konular={konular}
                    oneriler={konuOnerileri ?? []}
                    onerilenKonu={onerilenKonu}
                    onDegis={setKonular}
                  />
                </div>
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
              {sinifIdler.length > 1
                ? `${sinifIdler.length} sınıf için taslak kaydet`
                : 'Taslağı kaydet'}
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
