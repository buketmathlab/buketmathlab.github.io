import { useNavigate } from 'react-router-dom';
import { SayfaBasligi } from '@/components/layout/Kabuk';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SurumDefteriDugmesi } from '@/features/ogretmen/SurumDefteri';
import { useBenKimim } from '@/hooks/useBenKimim';
import {
  KART_ACIKLAMASI as CIKARMA_KART_ACIKLAMASI,
  KART_BASLIGI as CIKARMA_KART_BASLIGI,
  KART_DUGMESI as CIKARMA_KART_DUGMESI,
} from '@/lib/ogrenci-cikarma-metni';
import { PinDegistirKarti } from '@/components/PinDegistirKarti';
import { Yedek } from './Yedek';

/**
 * Ayarlar — bugünlük tek işi PIN değiştirmek.
 *
 * NEDEN VAR: `pin_degistir` 0003'te yazıldı, 0005'te yetkisi verildi ve
 * arayüzde HİÇ ÇAĞRILMADI. Yani öğretmen PIN'ini değiştiremiyordu.
 *
 * KURTARMA YOLU 0033'TE DEĞİŞTİ. Eskiden tek yol panelde
 * `ayarlar.ogretmen_pin_hash`'i NULL'a çekmekti; o sütun artık yok, PIN'ler
 * `ogretmenler.pin_hash`'te duruyor. Bir öğretmen PIN'ini unutursa PLATFORM
 * SAHİBİ Öğretmenler ekranından sıfırlıyor — panelde SQL çalıştırmaya gerek
 * kalmadı. Sahip kendi PIN'ini unutursa kurtarma yolu hâlâ panelde:
 * `update public.ogretmenler set pin_hash = null where yonetici;` ve
 * ardından kurulum ekranından yeniden belirlemek. O aralık AÇIK BİR
 * PENCEREDİR (hash boşken siteye giren herkes kurulum ekranını görür);
 * dakikalarla sınırlayın.
 *
 * YENİ SEKME AÇILMADI. Menü zaten altı sekme; yedincisi 360 px'de alt
 * çubuğa sığmıyor (ölçüldü). Buraya yan menünün altından ve Pano'dan
 * geliniyor. PIN değiştirmek nadir ve kasıtlı bir iş; yedek gibi her gün
 * görünmesi gerekmiyor.
 */
export function Ayarlar() {
  const { ben } = useBenKimim();
  const git = useNavigate();

  return (
    <>
      {/* KİM OLARAK GİRDİM — dört öğretmenli bir sistemde bu soru ekranda
          cevaplanabilir olmalı. Vekâletteyken kabuktaki şerit zaten uyarıyor;
          burası kendi hesabındayken de adı gösteriyor. */}
      <SayfaBasligi
        baslik="Ayarlar"
        aciklama={
          ben
            ? `${ben.ad} olarak girdiniz${ben.sahip ? ' · platform sahibi' : ''}. Öğretmen PIN’iniz.`
            : 'Öğretmen PIN’iniz.'
        }
      />

      <PinDegistirKarti uc="pin_degistir" />

      {/* YEDEK BURAYA TAŞINDI (0065 — öğretmenin isteği: "Verinizin yedeği
          kısmı ayarların içine taşınsın"). Önceden her gün açılan panonun
          en altındaydı; eskidiğinde kart sarıya dönüp kendini hatırlatıyor.

          YALNIZ SAHİPTE (0033): `disa_aktar` bütün sistemi tek dosyada
          indiriyor; sunucu zaten reddediyor, ekran reddedilecek düğmeyi
          göstermiyor. VARSAYILAN GÜVENLİ TARAFTA: kart yalnız "bu kişi sahip
          DEĞİL" olduğunu BİLDİĞİMİZDE gizleniyor (`ben` null iken görünür). */}
      {(ben === null || ben.sahip) && (
        <div className="mt-4">
          <Yedek />
        </div>
      )}

      {/* 0032: Ewalu'nun puan cümleleri.
          Ayrı bir ekran, çünkü beş bant × (önizleme + metin kutusu + iki
          düğme) bu sayfayı PIN formu görünmeyecek kadar uzatırdı. Buradan
          giriliyor: ikisi de nadir ve kasıtlı işler. */}
      {/* KODLAR BURAYA TAŞINDI (0048 — öğretmenin isteği).
          Sekme çubuğundaki yerini Mesajlar aldı. Ekran ve adres
          değişmedi; yalnız oraya nereden gidildiği değişti. Kod
          dağıtmak yılda bir yapılan bir iş — Ayarlar onun yeri. */}
      <Card className="mt-4">
        <h2 className="mb-1 text-[18px] text-ink">Giriş kodları</h2>
        <p className="mb-3 text-[14px] text-muted">
          Sınıf sınıf kodları görün, fişleri yazdırın.
        </p>
        <Button tur="sade" onClick={() => git('/ogretmen/kodlar')}>
          Kodları aç
        </Button>
      </Card>

      {/* ÖĞRENCİ ÇIKARMA BURAYA TAŞINDI (öğretmenin isteği).
          Çıkar düğmesi Öğrenciler sekmesinde her satırın sağındaydı:
          geri alınamaz bir iş, en sık açılan listenin kenarında
          duruyordu. Kodlar da aynı gerekçeyle 0048'de buraya geldi. */}
      <Card className="mt-4">
        <h2 className="mb-1 text-[18px] text-ink">{CIKARMA_KART_BASLIGI}</h2>
        <p className="mb-3 text-[14px] text-muted">{CIKARMA_KART_ACIKLAMASI}</p>
        <Button tur="sade" onClick={() => git('/ogretmen/ogrenciler/cikar')}>
          {CIKARMA_KART_DUGMESI}
        </Button>
      </Card>

      <Card className="mt-4">
        <h2 className="mb-1 text-[18px] text-ink">Ewalu’nun söyledikleri</h2>
        <p className="mb-4 text-[14px] text-muted">
          Öğrenci ödevini gönderdiğinde puanına göre Ewalu bir cümle söyler. Bu
          cümleleri kendiniz yazabilir, istediğiniz zaman varsayılana
          dönebilirsiniz.
        </p>
        <Button tur="ikincil" onClick={() => git('/ogretmen/ayarlar/ewalu')}>
          Cümleleri düzenle
        </Button>
      </Card>

      {/* 0039: OKUL YÖNETİMİ BİLGİLENDİRMESİ — YALNIZ SAHİP.
          `docs/kvkk-notlari.md`'nin dikkat listesindeki ilk madde buydu
          ve metni yoktu. Kart sahip değilse hiç çizilmiyor; asıl sınır
          yine sunucuda (`okul_bilgilendirme` → `_yonetici`). */}
      {ben?.sahip && (
        <Card className="mt-4">
          <h2 className="mb-1 text-[18px] text-ink">Okul yönetimi bilgilendirmesi</h2>
          <p className="mb-4 text-[14px] text-muted">
            Uygulamanın ne yaptığını, hangi bilgileri tuttuğunu ve verilerin
            nerede saklandığını anlatan, yazdırılıp imzalatılabilen bir belge.
            Sayılar her yazdırmada o günkü duruma göre hesaplanır.
          </p>
          <Button tur="ikincil" onClick={() => git('/ogretmen/ayarlar/okul')}>
            Belgeyi hazırla
          </Button>
        </Card>
      )}

      {/* 0041: SÜRÜM DEFTERİ — YALNIZ SAHİP. Kurulum bilgisi, ders bilgisi
          değil; kadronun görmesine gerek yok. Asıl sınır yine sunucuda
          (`surum_defteri` → `_yonetici`). */}
      {ben?.sahip && <SurumDefteriDugmesi />}
    </>
  );
}
