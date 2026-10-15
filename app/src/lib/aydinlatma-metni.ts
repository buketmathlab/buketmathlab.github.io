/**
 * KVKK AYDINLATMA METNİ — onam metnini TAMAMLAYAN ayrı belge.
 *
 * NEDEN AYRI BELGE: denetim öncesi inceleme, onam metninde (sürüm
 * 2026-09-7) veri sorumlusunun, başvuru yolunun, saklama süresinin ve
 * hakların yazmadığını; öğrenci numarası ile müdür erişiminin de metne
 * hiç girmediğini buldu. Öğretmenin kararı: onam sürümü DEĞİŞMESİN
 * (veliler yeniden onaylamak zorunda kalmasın), eksikler bu belgede
 * tamamlansın. Onam metni ve sürüm testi bu dosyaya dokunmuyor.
 *
 * BURADAKİ HER CÜMLE ÜRÜNÜN GERÇEKTE YAPTIĞI ŞEY (onam metniyle aynı
 * ilke). Okulun KARAR VERECEĞİ alanlar aşağıdaki sabitlerde; boşsa metin
 * "okul müdürlüğünce belirlenecek" diyor, uydurma bir süre yazmıyor.
 *
 * BU METİN HUKUKİ GÖRÜŞ DEĞİLDİR (`docs/kvkk-notlari.md`).
 */
import { OKUL_ADI } from '@/lib/sinif-yazdirma-metni';

/** Belgenin tarihi; içerik değişince güncellenir. */
export const AYDINLATMA_TARIHI = '15.10.2026';

/** Veri sorumlusu — okul müdürlüğü (öğretmen uygulayıcı). */
export const VERI_SORUMLUSU = `${OKUL_ADI} Müdürlüğü`;

/** Okulun belirleyeceği saklama süresi; null ise "belirlenecek" yazılır. */
export const SAKLAMA_SURESI: string | null = null;

export type AydinlatmaBolumu = {
  readonly baslik: string;
  readonly maddeler: readonly string[];
};

export const AYDINLATMA_BASLIK = 'SEKİZ Kişisel Verilerin Korunması Aydınlatma Metni';

export const AYDINLATMA_GIRIS =
  `Bu metin, ${OKUL_ADI}nde kullanılan SEKİZ ödev uygulamasında öğrencilere ve ` +
  'velilere ait kişisel verilerin nasıl işlendiğini 6698 sayılı Kişisel Verilerin ' +
  'Korunması Kanunu kapsamında açıklar. Velinin uygulamaya ilk girişte onayladığı ' +
  'onam metnini tamamlar; onu değiştirmez.';

export const AYDINLATMA_BOLUMLERI: readonly AydinlatmaBolumu[] = [
  {
    baslik: 'Veri sorumlusu',
    maddeler: [
      `${VERI_SORUMLUSU}. Uygulama, okulun matematik öğretmeni tarafından geliştirilmiş ` +
        've okulda eğitim-öğretim amacıyla kullanılmaktadır; öğretmen uygulayıcıdır.',
    ],
  },
  {
    baslik: 'Hangi veriler işleniyor',
    maddeler: [
      'Öğrencinin adı, soyadı, okul numarası ve sınıfı (seviye ve şube, örneğin 9A).',
      'Ödevler: işaretlenen cevaplar, puan, öğretmen yorumu ve öğrencinin yüklediği çözüm ' +
        'kâğıdı fotoğrafı.',
      'Veli ile öğretmen ve öğrenci ile öğretmen arasındaki mesajlar.',
      'Velinin onam kaydı: onay tarihi ve velinin yazdığı ad.',
      'Giriş kodları ve oturum kayıtları (giriş zamanı).',
      'İsimsiz anket yanıtları: kimlikle birlikte saklanmaz; yalnız hangi hafta ' +
        'yanıtlandığı tutulur.',
      'Adres, telefon, T.C. kimlik numarası, doğum tarihi ve öğrenci fotoğrafı ' +
        'istenmez ve tutulmaz.',
    ],
  },
  {
    baslik: 'Hangi amaçla işleniyor',
    maddeler: [
      'Ödevlerin verilmesi, gönderilmesi ve değerlendirilmesi; öğrenciye ve veliye ' +
        'geri bildirim verilmesi.',
      'Konu bazında öğrenme eksiklerinin belirlenmesi ve okulun matematik ' +
        'çalışmalarının izlenmesi.',
      'Okul gelişim projesinin izlenmesi ve değerlendirilmesi; bu amaçla yalnız toplu ' +
        'sayılar kullanılır, öğrenci adı raporlara girmez.',
    ],
  },
  {
    baslik: 'Kimler görebiliyor',
    maddeler: [
      'Öğrenci kendi bilgilerini; veli kendi çocuğunun bilgilerini görür.',
      'Ders öğretmeni yalnız kendi sınıflarındaki öğrencileri görür.',
      'Uygulamayı yöneten öğretmen, yönetim amacıyla okul sınıflarının tamamını görür.',
      'Okul müdürü salt izleme yetkisiyle sınıf özetlerini, öğrencilerin ödev puanlarını ' +
        've veli onam durumunu görür; hiçbir bilgiyi değiştiremez. Mesajları görmez.',
      'Veriler üçüncü kişilerle paylaşılmaz, reklam ya da ticari amaçla kullanılmaz.',
    ],
  },
  {
    baslik: 'Nerede saklanıyor',
    maddeler: [
      'Veriler, Supabase hizmeti üzerinden İsviçre’de (Zürih) bulunan sunucularda ' +
        'tutulur. Uygulamanın sayfaları GitHub Pages üzerinden sunulur.',
      'Bu durum yurt dışına aktarım sayılır; aktarımın dayanağı okul yönetimince ' +
        'değerlendirilmektedir.',
      'Bağlantılar şifrelidir. Çözüm fotoğrafları herkese açık değildir; her açılışta ' +
        'yalnız yetkili kişiye kısa ömürlü bir bağlantıyla gösterilir.',
    ],
  },
  {
    baslik: 'Ne kadar süre saklanıyor',
    maddeler: [
      SAKLAMA_SURESI
        ? `Veriler ${SAKLAMA_SURESI} saklanır; süre sonunda silinir.`
        : 'Saklama süresi okul müdürlüğünce belirlenecek ve bu metinde duyurulacaktır. ' +
          'O zamana kadar veriler yalnız eğitim-öğretim yılı boyunca kullanılır.',
    ],
  },
  {
    baslik: 'Haklarınız (KVKK madde 11)',
    maddeler: [
      'Kişisel verinin işlenip işlenmediğini öğrenme ve işlenmişse bilgi isteme.',
      'İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme.',
      'Yurt içinde ya da yurt dışında aktarıldığı üçüncü kişileri bilme.',
      'Eksik ya da yanlış işlenmişse düzeltilmesini isteme.',
      'Silinmesini ya da yok edilmesini isteme ve bu işlemlerin aktarılan kişilere ' +
        'bildirilmesini isteme.',
      'Yalnız otomatik sistemlerle analiz edilmesi sonucu aleyhe bir sonuca itiraz etme.',
      'Kanuna aykırı işleme nedeniyle zarara uğranırsa zararın giderilmesini isteme.',
    ],
  },
  {
    baslik: 'Başvuru ve onamın geri alınması',
    maddeler: [
      `Başvurularınızı yazılı olarak ${VERI_SORUMLUSU}ne iletebilirsiniz.`,
      'Onamınızı geri almak isterseniz okul müdürlüğüne ya da ders öğretmenine ' +
        'bildirmeniz yeterlidir; çocuğunuzun hesabı kapatılır ve verileri silinir.',
    ],
  },
];
