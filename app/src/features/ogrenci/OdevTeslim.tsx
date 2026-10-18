import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as EL_YAZISI from '@/lib/el-yazisi-metni';
import { buCihazinYazdirmaAdimi } from '@/lib/yazdirma-yonergesi';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { bosCevapUyarisi, type BosCevapUyarisi } from '@/lib/bos-cevap-uyarisi';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { SikListesi, SikSatiri, SIKLAR } from '@/components/ui/SikSatiri';
import { KonuListesi } from '@/components/ui/KonuListesi';
import { EwaluFigure } from '@/components/brand/EwaluFigure';
import { KiyasKarti } from '@/components/KiyasKarti';
import { puanMesaji, type OzelCumleler } from '@/lib/ewalu-puan';
import { useToast } from '@/components/ui/toast-baglam';
import { useDosyaAc } from '@/components/DosyaAcici';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { rpc } from '@/services/supabase';
import { cozumSayfasiYukle, dosyaAdresi } from '@/services/dosya';
import { gorseliSikistir } from '@/lib/gorsel-sikistir';
import { ekSureAcik, ogrenciEkSure } from '@/lib/iptal-metni';
import { KARANLIK_METNI, KaranlikFotografHatasi } from '@/lib/karanlik-fotograf';
import { pdfMi } from '@/lib/pdf-cozum';
import { sureDurumu } from '@/lib/son-tarih';
import { iptalMi, iptalSorulari, numaraListesi } from '@/lib/soru-iptali';
import {
  cozumSayfaYolu,
  eksikSayfaMetni,
  oncedenYuklenenMetni,
  sahnedenCikar,
  sahneyeEkle,
  sayfaKuraliniOku,
  tasmaMetni,
  yarimKalanMetni,
} from '@/lib/cozum-sayfalari';
import { SayfaSahnesi, type Sayfa } from './SayfaSahnesi';
import type { OdevKiyasi, OgrenciOdev, OgrenciOdevleri } from '@/types/api';

const TARIH = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

// Çözüm fotoğrafının yolu HESAPLANIR, uydurulmaz: `cozumSayfaYolu`
// (lib/cozum-sayfalari.ts). Sunucu (`_cozum_yolu_gecerli`, 0009 ve 0054)
// tam o kalıbı bekliyor — yol öğrencinin ve ödevin kimliğini taşıdığı için
// başkasının yoluna yükleme yapılamıyor. 1. sayfanın yolu 0009'dan beri
// aynı; ek sayfalar `-n` ekiyle.

/**
 * Öğrencinin ödev ekranı: soruları aç, cevapla, gönder, puanını gör.
 *
 * VERİ AYRI BİR RPC'DEN GELMİYOR. `ogrenci_odevleri` zaten öğrencinin tüm
 * ödevlerini veriyor; buradan kimliğe göre seçiyoruz. Tek ödev için ayrı bir
 * RPC yazmak öğretmenden bir SQL turu daha isterdi ve karşılığı yok — bir
 * sınıfın yayındaki ödevleri küçük bir liste.
 *
 * CEVAP ANAHTARI TESLİMDEN ÖNCE TARAYICIYA HİÇ GELMİYOR. Sunucu teslim yoksa
 * alanı `null` döndürüyor (Kural 6, Part XXI); burada gizlenen bir şey yok,
 * gönderimden sonra veri yeniden çekiliyor ve anahtar o zaman geliyor.
 */
export function OdevTeslim() {
  const { id = '' } = useParams();
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const dosya = useDosyaAc();
  const git = useNavigate();

  const [cevaplar, setCevaplar] = useState<Record<number, string>>({});
  const [fotoHatasi, setFotoHatasi] = useState<string | null>(null);
  const [gonderiyor, setGonderiyor] = useState(false);
  // Çözüm sayfaları (0054). 0078'den beri TEK YOL: her ödev sayfa sayfa
  // yükleniyor; tek görsele birleştirme kalktı (öğretmenin isteği).
  const [sayfalar, setSayfalar] = useState<Sayfa[]>([]);
  const [isliyor, setIsliyor] = useState(false);
  // Boş cevap uyarısı açıkken dolu; "Yine de gönder" onu onaylıyor.
  const [bosUyari, setBosUyari] = useState<BosCevapUyarisi | null>(null);
  // El yazısı onayı (öğretmenin kuralı). Saklanmıyor; gönderimin ön şartı.
  const [elYazisiOnay, setElYazisiOnay] = useState(false);
  const [onayEksik, setOnayEksik] = useState(false);

  const { veri, durum, hata, yenile } = useVeri<OgrenciOdevleri>('ogrenci_odevleri', {
    p_token: oturum?.token,
  });

  /**
   * SAYFA KURALI (0078) — ayrı uç, `ogrenci_odevleri`'ne EKLENMEDİ (aşağıdaki
   * iki ucun gerekçesiyle aynı: 300 satırlık gövdeyi kopyalamamak).
   *
   * `odev_sayfa_kurali` {sayfa, tum_sayfalar} döndürüyor. Eski uç
   * `odev_sayfa_siniri` yedek: 0078 henüz çalıştırılmamışsa sınır oradan
   * okunuyor, her sayfa zorunlu sayılmıyor. İkisi de okunamazsa {1, false}
   * — bir ayarın okunamaması ödev göndermeyi engellememeli (Part VIII).
   */
  const { veri: hamKural, durum: kuralDurumu } = useVeri<unknown>('odev_sayfa_kurali', {
    p_token: oturum?.token,
    p_odev_id: id,
  });
  const { veri: hamSinir, durum: sinirDurumu } = useVeri<number>('odev_sayfa_siniri', {
    p_token: oturum?.token,
    p_odev_id: id,
  });
  const { sayfa: sinir, tumSayfalar: zorunlu } = sayfaKuraliniOku(hamKural, hamSinir);
  // Kural gelmeden alan çizilmiyor: sayfa sayısı sonradan değişirse
  // öğrencinin o arada seçtiği sayfalar yanlış sayılırdı.
  const sinirHazir = kuralDurumu !== 'yukleniyor' && sinirDurumu !== 'yukleniyor';

  /**
   * Öğretmenin yazdığı Ewalu cümleleri (0032).
   *
   * AYRI BİR UÇ, `ogrenci_odevleri`'ne EKLENMEDİ: oraya eklemek 300
   * satırlık bir gövdeyi kopyalamayı gerektirirdi ve 0016'da ezberden
   * gövde yazmak iki hataya yol açmıştı.
   *
   * HATASI YUTULUYOR ve bu bilinçli: `useVeri`'nin hatası burada hiç
   * okunmuyor. 0032 çalıştırılmadıysa ya da uç bir an ulaşılamazsa
   * `ozelCumleler` boş kalıyor ve `puanMesaji` koddaki varsayılana
   * düşüyor. Bir AYAR ucunun erişilemez olması, öğrencinin sonuç
   * kartını bozmamalı (Part VIII).
   */
  const { veri: ozelListe } = useVeri<Array<{ bant: number; cumle: string }>>(
    'ewalu_mesajlari',
    { p_token: oturum?.token },
  );

  /**
   * ÖDEV KIYASI (0047) — ayrı uç, `ogrenci_odevleri`'ne EKLENMEDİ.
   *
   * Sebebi yukarıdakiyle aynı: o gövdeyi kopyalamak 0016'nın hatasını
   * tekrarlardı. Ayrıca kıyas yalnız BU ekranda gerekiyor; ödev
   * listesindeki her satıra ortalama hesaplatmanın anlamı yok.
   *
   * HATASI YUTULUYOR: kıyas ulaşılamazsa kart çizilmiyor, puan ve
   * Ewalu'nun cümlesi olduğu gibi duruyor. Bir ek bilginin gelmemesi
   * sonuç ekranını bozmamalı (Part VIII).
   */
  const { veri: kiyas } = useVeri<OdevKiyasi>(
    'odev_kiyasi',
    { p_token: oturum?.token, p_odev_id: id },
  );
  const ozelCumleler: OzelCumleler = {};
  for (const s of ozelListe ?? []) ozelCumleler[s.bant] = s.cumle;

  const odev: OgrenciOdev | undefined = veri?.odevler.find((o) => o.id === id);

  // Sekme dokunuş anında açılıyor; engellenirse ekranda bağlantı çıkıyor
  // (`useDosyaAc`). Eskiden adres gelince açılıyordu ve bazı telefonlar
  // bunu sessizce engelliyordu.
  function pdfAc(yol: string) {
    void dosya.ac(() => dosyaAdresi(yol));
  }

  /**
   * Çok sayfalı seçim (0054). Sıkıştırma SEÇİM ANINDA — tek alanlı yolla
   * aynı gerekçe: "Gönder"de beklenen süre kısalsın, okunamayan dosya
   * gönderimden önce anlaşılsın. Sınırı aşanlar hiç sıkıştırılmıyor.
   */
  async function sayfaEkle(dosyalar: File[]) {
    setFotoHatasi(null);
    const yer = Math.max(0, sinir - sayfalar.length);
    const alinacak = dosyalar.slice(0, yer);
    const hazir: Sayfa[] = [];
    const okunamayan: string[] = [];
    const karanlik: string[] = [];

    // PDF'in fazladan sayfaları: sınıra sığmayanlar hiç çizilmiyor.
    let pdfTasan = 0;

    setIsliyor(true);
    try {
      for (const d of alinacak) {
        try {
          if (pdfMi(d)) {
            // PDF: her sayfası ayrı çözüm sayfası (öğretmenin isteği).
            const { pdfSayfalariniGorsele } = await import('@/services/pdf-gorsel');
            const kalan = yer - hazir.length;
            const { dosyalar: gorseller, toplam } = await pdfSayfalariniGorsele(d, kalan);
            for (const g of gorseller) hazir.push({ id: crypto.randomUUID(), dosya: g });
            pdfTasan += toplam - gorseller.length;
            continue;
          }
          hazir.push({ id: crypto.randomUUID(), dosya: await gorseliSikistir(d) });
        } catch (e) {
          (e instanceof KaranlikFotografHatasi ? karanlik : okunamayan).push(d.name);
        }
      }
    } finally {
      setIsliyor(false);
    }

    // Ekleme `isliyor` süresince kapalı, yani `sayfalar` bu arada değişmedi.
    const { liste, tasan } = sahneyeEkle(sayfalar, hazir, sinir);
    setSayfalar(liste);

    const sorunlar: string[] = [];
    const disarida = tasan + pdfTasan + (dosyalar.length - alinacak.length);
    if (disarida > 0) sorunlar.push(tasmaMetni(sinir, disarida, zorunlu));
    if (okunamayan.length > 0) {
      sorunlar.push(`Okunamayan görsel: ${okunamayan.join(', ')}. Başka bir fotoğraf seçebilirsin.`);
    }
    if (karanlik.length > 0) sorunlar.push(`${karanlik.join(', ')}: ${KARANLIK_METNI}`);
    if (sorunlar.length > 0) setFotoHatasi(sorunlar.join(' '));
  }

  /**
   * Bir sayfayı YERİNDE değiştirir (0078). Her sayfası zorunlu ödevde sıra
   * sayfa numarası: yanlış çekilen 3. sayfa çıkarılıp sona eklenseydi 8.
   * sayfa olurdu. PDF seçilirse yalnız ilk sayfası alınır — tek sayfanın
   * yerine geçiyor.
   */
  async function sayfaDegistir(sira: number, d: File) {
    setFotoHatasi(null);
    setIsliyor(true);
    try {
      let yeni: File | undefined;
      if (pdfMi(d)) {
        const { pdfSayfalariniGorsele } = await import('@/services/pdf-gorsel');
        yeni = (await pdfSayfalariniGorsele(d, 1)).dosyalar[0];
      } else {
        yeni = await gorseliSikistir(d);
      }
      if (!yeni) throw new Error('Görsel okunamadı.');
      const dosya = yeni;
      setSayfalar((s) => s.map((x, i) => (i === sira ? { id: crypto.randomUUID(), dosya } : x)));
    } catch (e) {
      setFotoHatasi(
        e instanceof KaranlikFotografHatasi
          ? `${d.name}: ${KARANLIK_METNI}`
          : `Okunamayan görsel: ${d.name}. Başka bir fotoğraf seçebilirsin.`,
      );
    } finally {
      setIsliyor(false);
    }
  }

  async function gonder(bosOnaylandi = false) {
    if (!odev || !oturum?.ogrenci) return;
    const dosyalar = sayfalar.map((s) => s.dosya);
    if (dosyalar.length === 0) {
      return setFotoHatasi('Çözüm fotoğrafı olmadan ödev gönderilemez.');
    }
    // HER SAYFA ZORUNLU (0078). Sunucu da reddediyor; burada söylemek
    // öğrenciyi boşuna yüklemeden kurtarıyor. Düğme kapatılmıyor: öğrenci
    // bastığında neyin eksik olduğunu görsün (el yazısı onayındaki kural).
    if (zorunlu && dosyalar.length < sinir) {
      return setFotoHatasi(eksikSayfaMetni(sinir - dosyalar.length));
    }
    // EL YAZISI ONAYI — sunucuya gitmeden. Düğme kapatılmıyor: öğrenci
    // bastığında neyin eksik olduğunu görsün.
    if (!elYazisiOnay) {
      setOnayEksik(true);
      return;
    }
    // BOŞ SORU VARSA ÖNCE SOR. Gönderim sonradan değiştirilemiyor; bir
    // öğrencinin cevapları boş gitti ve 0 aldı (51 sorudan 51'i boş).
    if (odev.tur === 'test' && !bosOnaylandi) {
      const uyari = bosCevapUyarisi(odev.soru_sayisi ?? 0, cevaplar);
      if (uyari) return setBosUyari(uyari);
    }
    setBosUyari(null);

    setGonderiyor(true);
    const yollar: string[] = [];
    const onceden: number[] = [];
    try {
      // SIRALI, paralel değil: yarıda kalırsa kaçıncı sayfada kaldığı belli
      // olsun ve telefonun zayıf bağlantısı sekiz eşzamanlı yüklemeyle
      // boğulmasın. Hepsi yüklenmeden `odev_gonder` ÇAĞRILMIYOR — yarım
      // gönderim oluşamaz.
      for (let i = 0; i < dosyalar.length; i++) {
        const no = i + 1;
        bildir(
          dosyalar.length === 1
            ? 'Fotoğraf yükleniyor…'
            : `Sayfalar yükleniyor… ${no}/${dosyalar.length}`,
        );
        // "ZATEN VAR" HATA DEĞİL: önceki denemede yüklenmiş sayfa, olduğu
        // gibi kullanılıyor (`cozumSayfasiYukle`). Bu, tek sayfada da
        // geçerli — fotoğraf yüklenip gönderim ağ hatasıyla düşerse öğrenci
        // artık tekrar deneyebiliyor.
        const s = await cozumSayfasiYukle(
          dosyalar[i]!,
          cozumSayfaYolu(odev.id, oturum.ogrenci.id, no),
        ).catch((e: unknown) => {
          if (dosyalar.length > 1) throw new Error(yarimKalanMetni(i, dosyalar.length));
          throw e;
        });
        yollar.push(s.yol);
        if (s.oncedenVardi) onceden.push(no);
      }

      await rpc('odev_gonder', {
        p_token: oturum.token,
        p_odev: odev.id,
        p_foto_yolu: yollar[0],
        p_cevaplar: odev.tur === 'test' ? cevaplar : null,
        // YALNIZ EK SAYFA VARSA. Tek sayfada çağrı 0054 öncesiyle birebir
        // aynı; 0054 çalıştırılmamış bir veritabanında da çalışıyor.
        ...(yollar.length > 1 ? { p_ek_sayfa_yollari: yollar.slice(1) } : {}),
      });

      // Puanı ve cevap anahtarını sunucudan yeniden okuyoruz. Ekranda kendi
      // hesabımızı göstermiyoruz: puanı hesaplayan yer sunucu, gösterilen
      // sayı da oradan gelmeli.
      yenile();
      setSayfalar([]);
      const not = oncedenYuklenenMetni(onceden);
      bildir(not ? `Ödevin gönderildi. ${not}` : 'Ödevin gönderildi', 'basari');
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Gönderilemedi.', 'hata');
    } finally {
      setGonderiyor(false);
    }
  }

  return (
    <AsyncBoundary
      durum={durum}
      bosBaslik="Ödev bulunamadı"
      bosAciklama="Bu ödev kaldırılmış olabilir."
      {...(hata ? { hataAciklama: hata } : {})}
      tekrarDene={yenile}
    >
      <Dialog
        acik={bosUyari !== null}
        onKapat={() => setBosUyari(null)}
        baslik={bosUyari ? `${bosUyari.baslik}. Yine de gönderilsin mi?` : ''}
        {...(bosUyari ? { aciklama: bosUyari.metin } : {})}
        kapatEtiketi="Geri dön, işaretleyeyim"
        onayEtiketi="Yine de gönder"
        onayTuru={bosUyari?.hepsiBos ? 'tehlike' : 'birincil'}
        onOnay={() => void gonder(true)}
      />
      {!odev ? (
        <Card>
          <p className="mb-3 text-[15px] text-ink">Bu ödevi bulamadım.</p>
          <p className="mb-4 text-[14px] text-muted">
            Ödev kaldırılmış ya da artık senin sınıfına ait olmayabilir.
          </p>
          <Button tur="sade" onClick={() => git('/ogrenci')}>
            Ödevlerime dön
          </Button>
        </Card>
      ) : (
        <OdevIcerigi
          odev={odev}
          cevaplar={cevaplar}
          fotoHatasi={fotoHatasi}
          gonderiyor={gonderiyor}
          onCevap={(no, sik) =>
            setCevaplar((c) => {
              const y = { ...c };
              if (sik === null) delete y[no];
              else y[no] = sik;
              return y;
            })
          }
          sinir={sinir}
          zorunlu={zorunlu}
          sinirHazir={sinirHazir}
          sayfalar={sayfalar}
          isliyor={isliyor}
          onSayfaEkle={(d) => void sayfaEkle(d)}
          onSayfaCikar={(i) => {
            setFotoHatasi(null);
            setSayfalar((s) => sahnedenCikar(s, i));
          }}
          onSayfaDegistir={(i, d) => void sayfaDegistir(i, d)}
          onGonder={() => void gonder()}
          elYazisiOnay={elYazisiOnay}
          onElYazisiOnay={(v) => {
            setElYazisiOnay(v);
            if (v) setOnayEksik(false);
          }}
          onayEksik={onayEksik}
          onPdf={pdfAc}
          onGeri={() => git('/ogrenci')}
          ozelCumleler={ozelCumleler}
          kiyas={kiyas}
        />
      )}
      {dosya.yedek}
    </AsyncBoundary>
  );
}

type IcerikProps = {
  odev: OgrenciOdev;
  cevaplar: Record<number, string>;
  fotoHatasi: string | null;
  gonderiyor: boolean;
  onCevap: (no: number, sik: string | null) => void;
  /** Ödevin sayfa sayısı (0054/0078); okunamazsa 1. */
  sinir: number;
  /** Her sayfa zorunlu mu (0078 sonrası ödev). */
  zorunlu: boolean;
  /** Sınır yanıtı geldi mi (başarılı ya da hatalı). */
  sinirHazir: boolean;
  sayfalar: readonly Sayfa[];
  isliyor: boolean;
  onSayfaEkle: (d: File[]) => void;
  onSayfaCikar: (sira: number) => void;
  onSayfaDegistir: (sira: number, d: File) => void;
  onGonder: () => void;
  /** Öğrencinin "kendim, el yazımla çözdüm" onayı. */
  elYazisiOnay: boolean;
  onElYazisiOnay: (v: boolean) => void;
  /** Onaysız göndermeye çalıştı mı (uyarı gösterilir). */
  onayEksik: boolean;
  onPdf: (yol: string) => void;
  onGeri: () => void;
  /** Öğretmenin yazdığı Ewalu cümleleri (0032); boşsa varsayılanlar. */
  ozelCumleler: OzelCumleler;
  /** Sınıf/seviye ortalaması (0047); ulaşılamazsa null, kart çizilmez. */
  kiyas: OdevKiyasi | null;
};

function OdevIcerigi({
  odev,
  cevaplar,
  fotoHatasi,
  gonderiyor,
  onCevap,
  sinir,
  zorunlu,
  sinirHazir,
  sayfalar,
  isliyor,
  onSayfaEkle,
  onSayfaCikar,
  onSayfaDegistir,
  onGonder,
  elYazisiOnay,
  onElYazisiOnay,
  onayEksik,
  onPdf,
  onGeri,
  ozelCumleler,
  kiyas,
}: IcerikProps) {
  const sure = sureDurumu(odev.son_tarih);
  // Cihaza göre yazdırma adımı — kararın tamamı saf kütüphanede, burada
  // yalnız okunuyor (`lib/yazdirma-yonergesi.ts`).
  const yazdirmaAdimi = buCihazinYazdirmaAdimi();
  const gonderildi = odev.gonderim !== null;
  // İki AYRI kapanma sebebi. Aynı kutuya sıkıştırmıyoruz: "süren doldu" ile
  // "sınıfın kapandı" öğrenci için bambaşka iki şey, ilki onun elindeydi.
  const sinifKapali = odev.sinif_arsiv;
  // 0081: YALNIZ BU ÖĞRENCİYE VERİLMİŞ SÜRE. Gönderimi iptal edilirken
  // verilen tarih, sunucudaki kapıyı (`odev_gonder`) açık tutuyor; ekran
  // bunu bilmezse "Teslim kapandı" yazıp gönderme yolunu kapatır,
  // sunucu kabul ederken öğrenci gönderemediğini sanırdı.
  const ekSure = ekSureAcik(odev.ek_sure);
  const kapali = sinifKapali || (sure.gecti && !odev.gec_teslim && !ekSure);
  const testMi = odev.tur === 'test';
  const soruSayisi = odev.soru_sayisi ?? 0;
  // Şık sayısı ödevde saklı (migration 0010). Tahmin etmiyoruz: A–D'lik bir
  // testte olmayan bir E düğmesi göstermek öğrenciyi yanıltır.
  const siklar = odev.sik_sayisi === 4 ? SIKLAR.D : SIKLAR.E;
  const bosSayisi = testMi
    ? Array.from({ length: soruSayisi }, (_, i) => i + 1).filter((n) => !cevaplar[n]).length
    : 0;

  return (
    <>
      <div className="mb-4">
        <Button tur="sade" olcu="sm" onClick={onGeri}>
          ← Ödevlerim
        </Button>
      </div>

      <Card className="mb-4">
        <h1 className="font-display text-[22px] font-semibold text-ink">{odev.baslik}</h1>
        <p className="mt-1 text-[14px] text-muted">
          {testMi ? 'Test' : 'Açık uçlu'}
          {odev.soru_sayisi !== null && ` · ${odev.soru_sayisi} soru`}
          {' · Son tarih '}
          {TARIH.format(new Date(odev.son_tarih))}
        </p>
        {/* KİŞİSEL SÜRE (0081): sınıfın tarihi geçmiş olsa bile bu
            öğrenciye verilmiş tarih burada yazıyor. */}
        {!gonderildi && ogrenciEkSure(odev.ek_sure) && (
          <p data-test="ogrenci-ek-sure" className="mt-1 text-[14px] text-ink">
            {ogrenciEkSure(odev.ek_sure)}
          </p>
        )}
        {odev.aciklama && <p className="mt-3 text-[15px] text-ink">{odev.aciklama}</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          {gonderildi ? (
            <>
              <Tag tur="basari">Gönderildi</Tag>
              {odev.gonderim!.gecikmeli && <Tag tur="uyari">Gecikmeli teslim</Tag>}
            </>
          ) : (
            <Tag tur={sure.gecti ? 'notr' : sure.acil ? 'uyari' : 'notr'}>{sure.metin}</Tag>
          )}
          {!gonderildi && sinifKapali && <Tag tur="notr">Sınıf kapandı</Tag>}
          {/* Kişisel süresi açıkken "geç teslim kabul edilmiyor" yazmak
              öğrenciye yanlış söylerdi: ona tam da o istisna verildi. */}
          {!gonderildi && !sinifKapali && !odev.gec_teslim && !ekSure && (
            <Tag tur="uyari">Geç teslim kabul edilmiyor</Tag>
          )}
        </div>

        {odev.odev_yolu && (
          <div className="mt-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onPdf(odev.odev_yolu as string)}>Soruları aç (PDF)</Button>
              {/* SORULARI YAZDIR — öğretmenin isteği: çözüm boş kâğıtta
                  değil, çıktı alınmış soru kâğıdının üzerinde olsun.

                  AYNI DOSYAYI AYNI YOLDAN açıyor (`onPdf`). İkinci bir
                  açma mantığı yazılmadı: `dosya-ac.ts`'in başındaki nota
                  göre bu düğmede bir kez gerçek bir arıza yaşandı
                  (sekme dokunuş anında açılmazsa tarayıcı sessizce
                  engelliyor) ve o yol tek bir yerde duruyor.

                  SEKİZ YAZDIRMIYOR, TARAYICI YAZDIRIYOR. Gizli bir
                  `<iframe>`e PDF yükleyip `print()` çağırmak masaüstünde
                  çalışır, telefonda çalışmaz — ve bu ekranın öğrencileri
                  telefonda. Adım cümlesi bu boşluğu kapatıyor. */}
              <Button tur="sade" onClick={() => onPdf(odev.odev_yolu as string)}>
                Soruları yazdır
              </Button>
            </div>
            {/* ADIM DÜĞMENİN ALTINDA, HER ZAMAN GÖRÜNÜR.
                `DosyaAcici` kartına koymak düşünüldü ve bırakıldı: o kart
                dosya açıldıktan SONRA beliriyor, o anda öğrenci zaten
                öteki sekmede — adımı okumak için geri dönmesi gerekirdi.
                Burada dokunmadan önce okunuyor. */}
            <p className="mt-2 text-[13px] text-muted" data-test="yazdirma-adimi">
              Çıktı almak için: {yazdirmaAdimi}
            </p>
          </div>
        )}
      </Card>

      {gonderildi ? (
        <Sonuc odev={odev} onPdf={onPdf} ozelCumleler={ozelCumleler} kiyas={kiyas} />
      ) : sinifKapali ? (
        <Card vurgu="uyari">
          <p className="mb-2 font-semibold text-ink">Bu sınıf kapatılmış.</p>
          <p className="text-[14px] text-muted">
            Öğretmenin sınıfı arşivlemiş, bu yüzden şu an ödev gönderemiyorsun. Sorulara ve
            eski puanlarına bakmayı sürdürebilirsin; öğretmenin sınıfı geri açarsa
            gönderebilirsin.
          </p>
        </Card>
      ) : kapali ? (
        <Card vurgu="uyari">
          <p className="mb-2 font-semibold text-ink">Bu ödevin süresi doldu.</p>
          <p className="text-[14px] text-muted">
            Öğretmenin bu ödevde geç teslime izin vermemiş, bu yüzden gönderemiyorsun.
            Sorularla çalışmaya devam edebilir, takıldığın yeri öğretmenine sorabilirsin.
          </p>
        </Card>
      ) : (
        <Card>
          {sure.gecti && (
            <p className="mb-4 rounded-sk-sm bg-warning-bg p-3 text-[13px] text-warning">
              Süresi geçti ama öğretmenin geç teslime izin veriyor. Yine de gönderebilirsin.
            </p>
          )}

          {testMi && soruSayisi > 0 && (
            <div className="mb-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Tag tur={bosSayisi === 0 ? 'basari' : 'bilgi'}>
                  <span className="sk-sayi">{`${soruSayisi - bosSayisi}/${soruSayisi} soru işaretlendi`}</span>
                </Tag>
              </div>
              <SikListesi sutun={2}>
                {Array.from({ length: soruSayisi }, (_, i) => i + 1).map((no) => (
                  <SikSatiri
                    key={no}
                    no={no}
                    siklar={siklar}
                    secili={cevaplar[no]}
                    onDegis={onCevap}
                  />
                ))}
              </SikListesi>
              <p className="mt-3 text-[13px] text-muted">
                Boş bıraktığın sorular yanlış sayılmaz, boş sayılır.
              </p>
            </div>
          )}

          {/* EL YAZISI KURALI — yüklemeden ÖNCE okunsun. Üç yol da el
              yazısı; ÖNERİLEN yol (çıktı alınmış soru kâğıdı) birinci
              sırada ve görsel olarak ayrı. Sıra `YOLLAR` dizisinden
              geliyor ve burada yeniden sıralanmıyor: sıra öğretmenin
              kararı (bkz. `el-yazisi-metni.ts`). */}
          <section
            aria-labelledby="el-yazisi-baslik"
            className="mb-5 rounded-sk-sm border border-line bg-paper p-4"
          >
            <h2 id="el-yazisi-baslik" className="text-[16px] font-semibold text-ink">
              {EL_YAZISI.BASLIK}
            </h2>
            <p className="mt-1 text-[14px] text-ink">{EL_YAZISI.NEDEN}</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-3" data-test="el-yazisi-yollari">
              {EL_YAZISI.yollariSec(odev.odev_yolu !== null).map((y) => (
                <li
                  key={y.baslik}
                  className={
                    'rounded-sk-sm bg-surface p-3 text-[14px] text-ink' +
                    (y.onerilen ? ' border-l-[3px] border-l-success' : '')
                  }
                >
                  <strong className="block">{y.baslik}</strong>
                  {/* "Önerilen" YAZIYLA ve BAŞLIĞIN ALTINDA (öğretmenin
                      isteği). Yalnız renkli bir şerit, renk körü birine ve
                      ekran okuyucuya hiçbir şey söylemez.

                      Başlığın yanında "· Önerilen" olarak duruyordu ve dar
                      sütunda satır kırılınca nokta sallantıda kalıyordu;
                      kendi satırına inince hem o sorun kalktı hem de üç
                      kutu aynı hizada okunuyor. */}
                  {y.onerilen && (
                    <span className="block text-[12px] font-semibold text-success">
                      Önerilen
                    </span>
                  )}
                  {y.metin}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[14px] font-semibold text-ink">{EL_YAZISI.KABUL_EDILMEYEN}</p>
          </section>

          {/* ÇÖZÜM SAYFALARI — tek yol (0078). Eski 1 sayfalık ödevde de aynı
              alan, sınır 1. */}
          {!sinirHazir ? (
            <p className="mb-4 text-[13px] text-muted">Hazırlanıyor…</p>
          ) : (
            <SayfaSahnesi
              sayfalar={sayfalar}
              sinir={sinir}
              zorunlu={zorunlu}
              isliyor={isliyor}
              hata={fotoHatasi}
              onEkle={onSayfaEkle}
              onCikar={onSayfaCikar}
              onDegistir={onSayfaDegistir}
            />
          )}

          <p className="mb-4 rounded-sk-sm bg-line-soft p-3 text-[13px] text-muted">
            Gönderdikten sonra <strong>değiştiremezsin</strong>. Cevaplarını bir kez daha
            gözden geçir.
          </p>

          <label className="mb-1 flex min-h-[44px] items-start gap-2 text-[15px] text-ink">
            <input
              type="checkbox"
              className="mt-1 size-5 shrink-0 accent-ink"
              checked={elYazisiOnay}
              onChange={(e) => onElYazisiOnay(e.target.checked)}
              aria-describedby={onayEksik ? 'el-yazisi-uyari' : undefined}
            />
            <span>{EL_YAZISI.ONAY}</span>
          </label>
          {onayEksik && (
            <p id="el-yazisi-uyari" role="alert" className="mb-3 text-[14px] font-semibold text-danger">
              {EL_YAZISI.ONAY_EKSIK}
            </p>
          )}
          <div className="mb-3" />

          <Button
            onClick={onGonder}
            tamGenislik
            yukleniyor={gonderiyor}
            yuklenmeMetni="Gönderiliyor"
          >
            Ödevi gönder
          </Button>
        </Card>
      )}
    </>
  );
}

/** Teslimden sonraki görünüm: puan ve cevap anahtarı karşılaştırması. */
/**
 * Ewalu'nun puana göre söylediği.
 *
 * Poz da cümle de `lib/ewalu-puan.ts`'ten geliyor — metinler öğretmenin.
 * Figür `dekoratif`: cümle zaten yanında görünür metin olarak duruyor,
 * ekran okuyucunun ayrıca pozu tarif etmesi tekrar olurdu.
 */
function EwaluSozu({ puan, ozelCumleler }: { puan: number; ozelCumleler: OzelCumleler }) {
  const { poz, cumle } = puanMesaji(puan, ozelCumleler);
  return (
    <div className="mt-4 flex items-start gap-3 border-t border-line pt-4">
      <EwaluFigure poz={poz} boyut={52} dekoratif className="shrink-0" />
      <p className="text-[14px] leading-relaxed text-ink">{cumle}</p>
    </div>
  );
}

function Sonuc({
  odev,
  onPdf,
  ozelCumleler,
  kiyas,
}: {
  odev: OgrenciOdev;
  onPdf: (yol: string) => void;
  ozelCumleler: OzelCumleler;
  kiyas: OdevKiyasi | null;
}) {
  const g = odev.gonderim;
  if (!g) return null;

  const anahtar = odev.cevap_anahtari;
  const puan = g.ogretmen_puan ?? g.puan;
  // 0072 — iptal edilen sorular (anahtarda "IPTAL:<harf>"). Anahtar
  // teslimden SONRA geliyor; bu ekran da yalnız teslimden sonra çiziliyor.
  const iptaller = iptalSorulari(anahtar);

  return (
    <>
      {/* YEŞİL ŞERİT DE PUANA BAĞLI. Kutlama pozuyla aynı hata buradaydı:
          35 alan öğrencinin kartı da "başarı" yeşiliyle çerçeveleniyordu.
          85 ve üstü yeşil; altı NÖTR — kırmızı ya da sarı değil, çünkü
          cümlelerin özenle kaçındığı yargıyı renk geri getirirdi. Henüz
          puanlanmamış gönderim yeşil kalıyor: teslim etmek başlı başına
          olmuş bir iş. */}
      <Card vurgu={puan === null || puan >= 85 ? 'basari' : 'yok'} className="mb-4">
        {/* İKİ SES AYRI DURUYOR.
            Üstte SİSTEM: puan ve "ödevin alındı" — puan ne olursa olsun aynı
            cümle (öğretmenin kararı). Altta EWALU: puana göre değişen tek
            cümle. Sistem "ne oldu"yu söyler, Ewalu "şimdi ne yapmalı"yı;
            ikisini tek paragrafa karıştırmak hangisinin ne olduğunu
            belirsizleştirirdi. */}
        <div>
          <p className="font-display text-[20px] font-semibold text-ink">
            {puan !== null ? <span className="sk-sayi">{`${puan} puan`}</span> : 'Gönderildi'}
          </p>
          <p className="text-[14px] text-muted">
            {puan !== null
              ? 'Ödevin alındı ve puanlandı.'
              : 'Ödevin alındı. Öğretmenin değerlendirdikten sonra puanın görünecek.'}
          </p>
          {g.gecikmeli && (
            <p className="mt-1 text-[13px] font-semibold text-warning">
              Son tarihten sonra gönderildi — öğretmenin gecikmeli olarak görüyor.
            </p>
          )}
        </div>

        {/* Ewalu YALNIZ puan varsa konuşuyor. Açık uçlu ödev henüz
            puanlanmadıysa söyleyecek bir şeyi yok; olmayan bir puana cümle
            uydurmuyoruz. */}
        {puan !== null && <EwaluSozu puan={puan} ozelCumleler={ozelCumleler} />}

        {/* KIYAS (0047) — Ewalu'nun cümlesinden SONRA.
            Sıra bilinçli: önce "şimdi ne yapmalı", sonra çıplak
            sayılar. Tersi olsaydı ekran bir tabloyla açılır,
            öğretmenin cümlesi sayıların altında kalırdı.
            Kart kendi kendini gizliyor: süre dolmadıysa, özel ders
            öğrencisiyse ya da hiç puanlanmış teslim yoksa null. */}
        <KiyasKarti kiyas={kiyas} puan={puan} tur="ogrenci" />

        {g.dogru !== null && (
          <p className="mt-3 text-[14px] text-ink">
            <span className="sk-sayi font-semibold">{g.dogru}</span> doğru ·{' '}
            <span className="sk-sayi font-semibold">{g.yanlis}</span> yanlış ·{' '}
            <span className="sk-sayi font-semibold">{g.bos}</span> boş
          </p>
        )}
        {iptaller.length > 0 && odev.soru_sayisi !== null && (
          <p className="mt-1 text-[13px] text-muted">
            {`${numaraListesi(iptaller)}. ${iptaller.length > 1 ? 'sorular' : 'soru'} iptal edildi; puanın ${odev.soru_sayisi - iptaller.length} soru üzerinden hesaplandı.`}
          </p>
        )}

        {g.ogretmen_yorum && (
          <p className="mt-3 rounded-sk-sm bg-line-soft p-3 text-[14px] text-ink">
            <strong>Öğretmenin notu:</strong> {g.ogretmen_yorum}
          </p>
        )}
      </Card>

      {/* ÇALIŞILACAK KONULAR — öğretmenin isteği: "hangi konuda eksiği olduğu,
          yani hangi konuya çalışması gerektiği bildirilmeli."

          Ewalu'nun cümlesinden SONRA ve AYRI kartta: Ewalu "şimdi ne yapmalı"
          der, bu liste "tam olarak nereye" der. Aynı kartın içinde olsaydı
          cümle listenin başlığı gibi okunurdu.

          Konusu girilmemiş ödevde liste hiç çıkmıyor — boş bir "konular"
          başlığı, eksik bir şey varmış izlenimi verirdi. */}
      {/* `?? []`: SQL'i öğretmen panelden elle çalıştırıyor, arayüz ondan
          önce yayına girebiliyor. 0020 uygulanmamışken alan hiç gelmez;
          okunmayan bir alan yüzünden ekranın tamamının beyaz kalması kabul
          edilemez — konu listesi çıkmaz, ödev ekranı çalışmaya devam eder. */}
      {(odev.konu_analizi ?? []).length > 0 && (
        <Card className="mb-4">
          <KonuListesi analiz={odev.konu_analizi ?? []} ses="ogrenci" />
        </Card>
      )}

      {/* Anahtar teslimden SONRA sunucudan geliyor; teslim etmemiş bir
          öğrencinin tarayıcısında bu veri hiç bulunmuyor.

          KARŞILAŞTIRMALI gösteriliyor: yalnız doğru cevapları listelemek
          "8 doğru 1 yanlış" bilgisini işe yaramaz kılıyordu — öğrenci hangi
          soruyu kaçırdığını göremiyordu. Öğrenmenin olduğu yer tam burası. */}
      {anahtar && Object.keys(anahtar).length > 0 && (
        <Card className="mb-4">
          <h2 className="mb-1 font-display text-[18px] font-semibold text-ink">Cevaplar</h2>
          <p className="mb-3 text-[13px] text-muted">
            Senin cevabın solda, doğrusu sağda. Kaçırdığın sorular işaretli.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {Object.entries(anahtar)
              .map(([k, v]) => [Number(k), v] as const)
              .filter(([n]) => Number.isInteger(n))
              .sort((a, b) => a[0] - b[0])
              .map(([no, dogru]) => {
                const benim = g.cevaplar?.[String(no)] ?? null;
                if (iptalMi(dogru)) {
                  return (
                    <li
                      key={no}
                      className="flex items-center gap-2 rounded-sk-sm border border-line px-2 py-1 text-[14px]"
                    >
                      <span className="sk-sayi w-7 shrink-0 text-right font-bold text-muted">
                        {no}
                      </span>
                      <span className="text-muted">{benim ?? '—'}</span>
                      <span className="ml-auto text-muted">iptal edildi</span>
                    </li>
                  );
                }
                // ÜÇ DURUM, ikisi değil. Boş bırakmak yanlış cevap vermekle
                // aynı şey değil: puanlama da ikisini ayırıyor (`_puanla`),
                // ekran da ayırmalı. Her boşluğu kırmızıya boyamak öğrenciye
                // yapmadığı bir hatayı yüklerdi.
                const durum = benim === null ? 'bos' : benim === dogru ? 'dogru' : 'yanlis';
                return (
                  <li
                    key={no}
                    className={
                      'flex items-center gap-2 rounded-sk-sm border px-2 py-1 text-[14px] ' +
                      (durum === 'dogru'
                        ? 'border-line'
                        : durum === 'yanlis'
                          ? 'border-danger bg-danger-bg'
                          : 'border-warning bg-warning-bg')
                    }
                  >
                    <span className="sk-sayi w-7 shrink-0 text-right font-bold text-muted">
                      {no}
                    </span>
                    <span
                      className={
                        durum === 'dogru'
                          ? 'font-semibold text-ink'
                          : durum === 'yanlis'
                            ? 'font-semibold text-danger'
                            : 'font-semibold text-warning'
                      }
                    >
                      {benim ?? 'boş'}
                    </span>
                    {durum === 'dogru' ? (
                      <span className="ml-auto text-success">doğru</span>
                    ) : (
                      <span className="ml-auto text-muted">
                        doğrusu <strong className="text-ink">{dogru}</strong>
                      </span>
                    )}
                  </li>
                );
              })}
          </ul>
        </Card>
      )}

      {odev.anahtar_yolu && (
        <Button tur="sade" onClick={() => onPdf(odev.anahtar_yolu as string)}>
          Çözümlü anahtarı aç (PDF)
        </Button>
      )}
    </>
  );
}
