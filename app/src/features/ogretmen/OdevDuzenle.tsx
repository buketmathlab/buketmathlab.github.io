import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SayfaBasligi } from '@/components/layout/Kabuk';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { useToast } from '@/components/ui/toast-baglam';
import { useDosyaAc } from '@/components/DosyaAcici';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { rpc } from '@/services/supabase';
import {
  ODEV_PDF_EN_BUYUK,
  dosyaAdresi,
  dosyaYukle,
  odevDosyaYolu,
  dosyayiDenetle,
} from '@/services/dosya';
import { pdfSatirlariniOku } from '@/services/pdf-metin';
import { anahtarOku } from '@/services/anahtar-oku';
import { anahtarFarki, anahtarlariBirlestir, type Cikarim } from '@/lib/cevap-anahtari';
import { YukluDosya } from './YukluDosya';
import { AnahtarIzgarasi } from './AnahtarIzgarasi';
import { KonuAtama } from './KonuAtama';
import { PdfOnerileri } from './PdfOnerileri';
import { GecTeslimSecimi } from './GecTeslimSecimi';
import { SayfaSiniriSecimi } from './SayfaSiniriSecimi';
import { sayfaSiniriniOku } from '@/lib/cozum-sayfalari';
import { OdevFormAlanlari, type OdevFormDegerleri } from './OdevFormAlanlari';
import { KardeslereYayma } from './KardeslereYayma';
import { sunucudanOku, sunucuyaHazirla, type Konular } from '@/lib/konu-atama';
import { odevPdfOzeti, type PdfOzeti } from '@/lib/odev-pdf-ozeti';
import type { KardesDetay, Sinif } from '@/types/api';

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
  /** Soru numarası → konu adı (migration 0020). Girilmemişse null. */
  konular: Record<string, string> | null;
  anahtar_yolu: string | null;
  odev_yolu: string | null;
  yayinda: boolean;
  gonderim_sayisi: number;
  /**
   * Aynı anda verildiği DİĞER sınıfların adları (0030). Kardeşi yoksa —
   * ya da 0030 henüz çalıştırılmadıysa — gelmez.
   */
  kardesler?: string[] | null;
  /**
   * Kardeş başına karar bilgisi (0031). 0031 çalıştırılmadıysa gelmez ve
   * yayma kartı hiç çizilmez.
   */
  kardes_detay?: KardesDetay[] | null;
  /** Öğrencinin yükleyebileceği görsel sayısı (0054). 0054 çalıştırılmadıysa gelmez → 1. */
  sayfa_limiti?: number;
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
  const dosya = useDosyaAc();
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
  const [sayfaSiniri, setSayfaSiniri] = useState(1);
  const [anahtar, setAnahtar] = useState<Record<number, string>>({});
  const [konular, setKonular] = useState<Konular>({});
  const [pdfOzet, setPdfOzet] = useState<PdfOzeti | null>(null);
  const [onerilenKonu, setOnerilenKonu] = useState<string | undefined>(undefined);
  const [cikarim, setCikarim] = useState<Cikarim | null>(null);
  const [yeniAnahtarPdf, setYeniAnahtarPdf] = useState<File | null>(null);
  const [yeniOdevPdf, setYeniOdevPdf] = useState<File | null>(null);
  const [okuyor, setOkuyor] = useState(false);
  const [ilerleme, setIlerleme] = useState<string | null>(null);
  // Yeni anahtar PDF'i okunmadan önceki cevaplar: "Vazgeç" bunlara döner.
  const [anahtarOncesi, setAnahtarOncesi] = useState<Record<number, string> | null>(null);
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

  const { veri: konuOnerileri } = useVeri<string[]>('konu_onerileri', {
    p_token: oturum?.token,
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
    setSayfaSiniri(sayfaSiniriniOku(detay.sayfa_limiti));
    const a: Record<number, string> = {};
    for (const [k, v] of Object.entries(detay.cevap_anahtari ?? {})) {
      const n = Number(k);
      if (Number.isInteger(n)) a[n] = v;
    }
    setAnahtar(a);
    setKonular(sunucudanOku(detay.konular));
  }, [detay]);

  const n = Number(form.soruSayisi) || 0;
  const testMi = detay?.tur === 'test';

  function alanDegis<A extends keyof OdevFormDegerleri>(alan: A, deger: OdevFormDegerleri[A]) {
    setForm((f) => ({ ...f, [alan]: deger }));
  }

  /**
   * Ödev (soru) PDF'ini okuyup ÖNERİ üretir. Okuma hatası düzenlemeyi
   * engellemez; öneri kutusu çıkmaz, ekran bugünkü gibi çalışır.
   */
  async function odevPdfiniOku(dosya: File) {
    try {
      setPdfOzet(odevPdfOzeti(await pdfSatirlariniOku(dosya)));
    } catch {
      setPdfOzet(null);
    }
  }

  /**
   * Yeni anahtar PDF'i: okunan cevaplar MEVCUT CEVAPLARIN ÜSTÜNE yazılır,
   * yerine DEĞİL. Önceden `setAnahtar(sonuc.anahtar)` okunamayan bir PDF'te
   * kayıtlı 51 cevabın hepsini siliyordu; öğretmen hepsini yeniden
   * işaretliyordu. Artık PDF'in bulamadığı soru eski cevabını korur ve
   * değişen her cevap ekranda listelenir.
   */
  async function anahtarPdfSecildi(dosya: File | null) {
    if (!dosya) {
      // "Vazgeç": dosya da, PDF'ten gelen cevaplar da geri alınır.
      setYeniAnahtarPdf(null);
      if (anahtarOncesi) setAnahtar(anahtarOncesi);
      setAnahtarOncesi(null);
      setCikarim(null);
      setOkumaHatasi(null);
      return;
    }
    const sorun = dosyayiDenetle(dosya, ODEV_PDF_EN_BUYUK);
    if (sorun) return setOkumaHatasi(sorun);
    setYeniAnahtarPdf(dosya);
    setOkumaHatasi(null);
    setOkuyor(true);
    const onceki = anahtarOncesi ?? anahtar;
    try {
      const sonuc = await anahtarOku(dosya, {
        soruSayisi: n,
        sonSecenek: form.sonSecenek,
        ilerleme: (bitti, toplam) => setIlerleme(`Sayfa ${bitti}/${toplam}`),
      });
      setCikarim(sonuc);
      setAnahtarOncesi(onceki);
      setAnahtar(anahtarlariBirlestir(onceki, sonuc.anahtar));
    } catch (e) {
      setOkumaHatasi(e instanceof Error ? e.message : 'PDF okunamadı.');
      setCikarim(null);
    } finally {
      setOkuyor(false);
      setIlerleme(null);
    }
  }

  /** Yüklü dosyayı açar. Yol istemcide tutulmuyor; imzalı adres her seferinde. */
  function yukluDosyayiAc(tur: 'odev' | 'anahtar') {
    // Sekme dokunuş anında açılıyor (`useDosyaAc`).
    void dosya.ac(
      async () => {
        const { yol } = await rpc<{ yol: string | null }>('odev_dosya_yolu', {
          p_token: oturum?.token,
          p_id: id,
          p_tur: tur,
        });
        return yol ? dosyaAdresi(yol) : null;
      },
      { yokMetni: 'Bu ödevde o dosya yok.' },
    );
  }

  const degisenCevaplar = anahtarOncesi ? anahtarFarki(anahtarOncesi, anahtar) : [];

  async function kaydet() {
    if (!detay) return;
    setKaydediyor(true);
    setDegisenler(null);
    try {
      let odevYolu = detay.odev_yolu;
      let anahtarYolu = detay.anahtar_yolu;

      if (yeniOdevPdf) {
        bildir('Ödev PDF’i yükleniyor…');
        odevYolu = await dosyaYukle(yeniOdevPdf, odevDosyaYolu('sorular', yeniOdevPdf.name), ODEV_PDF_EN_BUYUK);
      }
      if (yeniAnahtarPdf) {
        bildir('Cevap anahtarı yükleniyor…');
        anahtarYolu = await dosyaYukle(yeniAnahtarPdf, odevDosyaYolu('anahtar', yeniAnahtarPdf.name), ODEV_PDF_EN_BUYUK);
      }

      const sinirDegisti = sayfaSiniri !== sayfaSiniriniOku(detay.sayfa_limiti);
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
        // BOŞ NESNE GÖNDERİLİYOR, null DEĞİL: sunucuda null "değiştirme"
        // demek. Öğretmen bütün konuları sildiyse silme kaydedilsin.
        p_konular: testMi ? sunucuyaHazirla(konular, n) : null,
        // YALNIZ DEĞİŞTİYSE (0054). Sunucuda null "dokunma" demek; ayrıca
        // 0054 çalıştırılmamış bir veritabanı bilinmeyen parametreyi
        // tanımaz ve HER kaydetme düşerdi. Değişmeyen sınır hiç gitmiyor.
        ...(sinirDegisti ? { p_sayfa_limiti: sayfaSiniri } : {}),
      }).catch((e: unknown) => {
        if (
          sinirDegisti &&
          e instanceof Error &&
          /could not find the function|schema cache/i.test(e.message)
        ) {
          throw new Error(
            'Birden fazla sayfa bu sistemde henüz açılmadı. ' +
              'Sayfa sınırını 1 bırakarak kaydedebilirsiniz.',
          );
        }
        throw e;
      });

      const degisti = sonuc.yeniden_puanlanan ?? [];
      // KARDEŞİ VARSA SAYFADA KALINIYOR. Yayma kararı kaydetmenin ARDINDAN
      // veriliyor (öğretmenin kararı: "kaydettikten sonra düğmeyle"); listeye
      // dönersek düğme, tam da gerektiği anda ekrandan kaybolurdu. Bu ödevin
      // kendi sınıfında hiç gönderim yokken bile kardeşlerde olabilir.
      const kardesVar = (detay.kardes_detay?.length ?? 0) > 0;
      if (degisti.length > 0) {
        // Not değiştiyse sayfada kal ve göster — bildirim kaybolur, bu bilgi
        // kaybolmamalı.
        setDegisenler(degisti);
        bildir(`Kaydedildi — ${degisti.length} öğrencinin puanı değişti`, 'basari');
        yenile();
      } else if (kardesVar) {
        bildir('Ödev güncellendi', 'basari');
        // `anahtar_ayni` yeniden ölçülsün: kaydetmeden önceki değere bakıp
        // "anahtar aynı" demek yanlış bilgi olurdu.
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
      {dosya.yedek}
      <SayfaBasligi
        baslik="Ödevi düzenle"
        aciklama={
          detay?.yayinda
            ? 'Bu ödev yayında. Cevap anahtarını değiştirirseniz gönderenler yeniden puanlanır.'
            : 'Taslak ödev. Yayınlamadan istediğiniz kadar değiştirebilirsiniz.'
        }
      />
      {/* ÖĞRETMENİN İSTEĞİ: "Neyi düzenlemek istiyorsam yalnız onu
          değiştirebilmeliyim." Ekran bunu zaten yapıyordu (bütün alanlar
          kayıttan dolu geliyor) ama bunu SÖYLEMİYORDU; boş dosya alanları
          tersini düşündürüyordu. */}
      <p className="-mt-2 mb-4 text-[14px] text-ink">
        Yalnız değiştirmek istediğiniz alanı değiştirin; diğer her şey olduğu gibi kalır.
      </p>

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

            {/* KARDEŞ ÖDEVLER.
                Bu ödev birden çok sınıfa birlikte verildiyse kopyalar
                BAĞIMSIZ: buradaki düzeltme kendiliğinden diğerlerine
                geçmiyor. 0030'da tehlike yalnız GÖRÜNÜR kılınmıştı
                ("onları ayrı ayrı düzenleyin"); 0031 ona bir çıkış yolu
                veriyor.

                İKİ AYRI DURUM, İKİ AYRI KART:

                - `kardes_detay` GELİYORSA (0031 çalıştırılmış): yayma
                  kartı çıkıyor, düğmesiyle birlikte.
                - GELMİYORSA (0031 henüz çalıştırılmamış): 0030'un
                  bugünkü uyarısı aynen duruyor. Ekran bozulmuyor, yalnız
                  düğme hiç çıkmıyor — `ucYok` deseni. */}
            {detay.kardes_detay && detay.kardes_detay.length > 0 ? (
              <KardeslereYayma
                odevId={detay.id}
                kaynakSinif={detay.sinif}
                kardesler={detay.kardes_detay}
                onYayildi={yenile}
              />
            ) : (
              detay.kardesler &&
              detay.kardesler.length > 0 && (
                <Card vurgu="uyari" className="mb-4">
                  <p className="text-[15px] text-ink">
                    Bu ödev <strong>{[detay.sinif, ...detay.kardesler].join(', ')}</strong>{' '}
                    sınıflarına birlikte verildi.
                  </p>
                  <p className="mt-1 text-[14px] text-muted">
                    Buradaki değişiklik yalnız <strong>{detay.sinif}</strong> sınıfını
                    etkiler. Diğerlerini de değiştirmek isterseniz onları ayrı ayrı
                    düzenleyin.
                  </p>
                </Card>
              )
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

              <SayfaSiniriSecimi deger={sayfaSiniri} onDegis={setSayfaSiniri} />
              {sayfaSiniri < sayfaSiniriniOku(detay.sayfa_limiti) && detay.gonderim_sayisi > 0 && (
                <p className="-mt-2 mb-4 text-[13px] text-muted">
                  Sınırı düşürmek yapılmış gönderimleri değiştirmez; yalnız bundan sonra
                  gönderenleri bağlar.
                </p>
              )}
              <GecTeslimSecimi deger={gecTeslim} onDegis={setGecTeslim} />

              <YukluDosya
                etiket="Ödev PDF’i (sorular)"
                baslik="Soru dosyası"
                ayrinti="Öğrencilerin çözeceği sorular"
                yuklu={!!detay.odev_yolu}
                onAc={() => void yukluDosyayiAc('odev')}
                secilen={yeniOdevPdf}
                onSec={(f) => {
                  // Boyut SEÇERKEN denetleniyor (bkz. OdevOlustur).
                  const sorun = f ? dosyayiDenetle(f, ODEV_PDF_EN_BUYUK) : null;
                  if (sorun) return bildir(sorun, 'hata');
                  setYeniOdevPdf(f);
                  if (f) void odevPdfiniOku(f);
                  else setPdfOzet(null);
                }}
              />

              {pdfOzet && (
                <PdfOnerileri
                  ozet={pdfOzet}
                  mevcutSoruSayisi={n}
                  secililer={[form.sinifId]}
                  siniflar={siniflar ?? []}
                  onSoruSayisi={(x) => alanDegis('soruSayisi', String(x))}
                  onKonu={setOnerilenKonu}
                  onSinif={(id) => alanDegis('sinifId', id)}
                />
              )}

              {testMi && (
                <YukluDosya
                  etiket="Cevap anahtarı PDF’i"
                  baslik="Cevap anahtarı"
                  ayrinti={
                    Object.keys(detay.cevap_anahtari ?? {}).length > 0
                      ? `${Object.keys(detay.cevap_anahtari ?? {}).length} sorunun cevabı kayıtlı`
                      : 'Çözümler ve doğru şıklar'
                  }
                  yuklu={!!detay.anahtar_yolu}
                  onAc={() => void yukluDosyayiAc('anahtar')}
                  secilen={yeniAnahtarPdf}
                  onSec={(f) => void anahtarPdfSecildi(f)}
                  kilitli={okuyor}
                  ipucu={
                    'Yeni PDF’ten okunan cevaplar mevcut cevapların üstüne yazılır; ' +
                    'PDF’te bulunamayan sorular olduğu gibi kalır.' +
                    (detay.gonderim_sayisi > 0
                      ? ' Anahtar değişirse gönderen öğrenciler yeniden puanlanır.'
                      : '')
                  }
                  {...(okumaHatasi ? { hata: okumaHatasi } : {})}
                />
              )}
              {okuyor && (
                <p className="mb-4 text-[13px] text-muted" role="status">
                  {ilerleme ? `PDF okunuyor… ${ilerleme}` : 'PDF okunuyor…'}
                </p>
              )}

              {/* DEĞİŞEN CEVAPLAR GÖRÜNÜR. Yeni PDF yalnız bulduğu soruları
                  değiştiriyor; hangileri değişti, kaydetmeden önce burada. */}
              {anahtarOncesi && !okuyor && (
                <Card vurgu={degisenCevaplar.length > 0 ? 'uyari' : 'yok'} className="mb-4">
                  <p className="mb-1 text-[14px] text-ink">
                    {cikarim && cikarim.bulunan.length > 0
                      ? `PDF’ten ${cikarim.bulunan.length} sorunun cevabı okundu.`
                      : 'Bu PDF’ten cevap okunamadı; kayıtlı cevaplar olduğu gibi duruyor.'}
                  </p>
                  {degisenCevaplar.length === 0 ? (
                    <p className="text-[14px] text-ink">Kayıtlı cevaplardan farklı cevap yok.</p>
                  ) : (
                    <>
                      <p className="mb-1 text-[14px] font-semibold text-ink">
                        {`${degisenCevaplar.length} soruda cevap değişti`}
                      </p>
                      <p className="text-[14px] text-ink">
                        {degisenCevaplar
                          .map((d) => `${d.no}. soru: ${d.eski ?? '—'} → ${d.yeni ?? '—'}`)
                          .join(' · ')}
                      </p>
                    </>
                  )}
                  <p className="mt-1 text-[13px] text-muted">
                    Kaydetmeden hiçbir şey değişmez. Vazgeçerseniz eski cevaplar geri gelir.
                  </p>
                </Card>
              )}

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

              {testMi && n > 0 && (
                <div className="mb-5 border-t border-line pt-5">
                  <KonuAtama
                    soruSayisi={n}
                    konular={konular}
                    oneriler={konuOnerileri ?? []}
                    onerilenKonu={onerilenKonu}
                    onDegis={setKonular}
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
