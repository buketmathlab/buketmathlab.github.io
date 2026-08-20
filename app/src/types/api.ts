/** Veritabanı RPC'lerinin dönüş tipleri. supabase/migrations ile eşleşir. */

export type Rol = 'ogretmen' | 'ogrenci' | 'veli';

export type GirisSonucu =
  | { rol: 'kurulum' }
  | { rol: 'yok' }
  | { rol: 'ogretmen'; token: string }
  | {
      rol: 'ogrenci' | 'veli';
      token: string;
      ogrenci: { id: string; ad: string; tur: string; sinif: string | null };
    };

export type Pano = {
  ogrenci_sayisi: number;
  /** Sınıfına en az bir ödev yayınlanmış öğrenci sayısı (migration 0015). */
  odev_verilen_ogrenci: number;
  acik_odev: number;
  bekleyen_degerlendirme: number;
  gecikmis_eksik: number;
  son_gonderimler: Array<{
    ogrenci: string;
    odev: string;
    puan: number | null;
    zaman: string;
    gecikmeli: boolean;
  }>;
};

export type Sinif = {
  id: string;
  ad: string;
  seviye: number;
  sube: string;
  /** Özel ders grubu. Kimlik değil, ödev hedefleme aracı (migration 0012). */
  ozel: boolean;
  arsiv: boolean;
  ogrenci_sayisi: number;
};

export type OgrenciSatiri = {
  id: string;
  ad: string;
  tur: 'okul' | 'ozel';
  sinif: string | null;
};

export type OgrenciListesi = {
  toplam: number;
  sayfa: number;
  toplam_sayfa: number;
  kayitlar: OgrenciSatiri[];
};

export type YeniOgrenci = {
  id: string;
  ogrenci_kodu: string;
  veli_kodu: string;
};

export type Kodlar = { ogrenci?: string; veli?: string };

/**
 * KOD TOPLU GELMEZ. `sinif_kodlari` (0017) bir sınıfın tüm kodlarını tek
 * yanıtta döndürüyordu; 0018 ile KALDIRILDI ve tipi de silindi.
 *
 * Öğretmenin isteği "bir öğrenciye kodunu gösterirken diğerlerininki
 * görünmesin"di. Toplu indirip birini göstermek kodları ağ yanıtında ve
 * bellekte bırakırdı. Artık tek yol `ogrenci_kodlari` → `Kodlar`, öğrenci
 * başına ve dokunuşla.
 */

export type OdevSatiri = {
  id: string;
  baslik: string;
  aciklama: string | null;
  tur: 'test' | 'acik';
  sinif_id: string;
  sinif: string;
  sinif_ozel: boolean;
  son_tarih: string;
  soru_sayisi: number | null;
  /** Son tarih geçtikten sonra teslim alınıyor mu (migration 0010). */
  gec_teslim: boolean;
  /** 4 (A–D) ya da 5 (A–E). */
  sik_sayisi: number;
  yayinda: boolean;
  olusturma: string;
  /** Dosyanın kendisi değil, varlığı. Yol yalnız gerektiğinde istenir. */
  odev_pdf_var: boolean;
  anahtar_pdf_var: boolean;
  gonderim_sayisi: number;
  /** Son tarihten SONRA gelen teslim sayısı (migration 0010). */
  gec_gonderim_sayisi: number;
  sinif_mevcudu: number;
  /**
   * Ortalamalar YALNIZ son tarih geçtikten sonra dolu; öncesinde `null`.
   * `yapan` gönderenlerin ortalaması, `tum` göndermeyeni 0 sayar.
   */
  ortalama_yapan: number | null;
  ortalama_tum: number | null;
};

/** Öğrencinin kendi gönderimi. Puan yalnız test ödevinde dolu olur. */
export type OgrenciGonderim = {
  id: string;
  zaman: string;
  durum: string;
  dogru: number | null;
  yanlis: number | null;
  bos: number | null;
  puan: number | null;
  ogretmen_puan: number | null;
  ogretmen_yorum: string | null;
  /** Öğrencinin kendi verdiği cevaplar — hangi soruyu kaçırdığını görebilsin. */
  cevaplar: Record<string, string>;
  /** Son tarihten sonra mı gönderildi. Sunucuda türetiliyor, saklanmıyor. */
  gecikmeli: boolean;
};

/**
 * Konu başına doğru/yanlış/boş (migration 0020).
 *
 * Sunucu `(toplam - dogru)` azalan sıralı döndürüyor: en çok eksik olan konu
 * HER ZAMAN ilk sırada. Sıralamayı arayüzde tekrarlamıyoruz — iki yerde iki
 * farklı sıra, "en zayıf konu" iddiasını ekrandan ekrana değiştirirdi.
 */
export type KonuAnalizi = {
  konu: string;
  toplam: number;
  dogru: number;
  yanlis: number;
  bos: number;
};

/**
 * `ogrenci_odevleri` içindeki tek ödev.
 *
 * `cevap_anahtari` ve `anahtar_yolu` TİPTE DE `null` OLABİLİR: sunucu bu iki
 * alanı yalnız öğrenci teslim ettiyse dolduruyor (migration 0007). Tipin
 * bunu yansıtması bilinçli — "her zaman var" diye yazılmış bir arayüz kodu
 * derlenmesin.
 */
export type OgrenciOdev = {
  id: string;
  baslik: string;
  aciklama: string | null;
  tur: 'test' | 'acik';
  son_tarih: string;
  soru_sayisi: number | null;
  gec_teslim: boolean;
  /** 4 (A–D) ya da 5 (A–E). Öğrenci ızgarası kaç düğme çizeceğini buradan bilir. */
  sik_sayisi: number;
  /**
   * Öğrencinin sınıfı arşivde mi (migration 0016).
   *
   * Ödev GİZLENMİYOR — öğrenci geçmişini ve puanını görmeye devam ediyor.
   * Yalnız yeni gönderim kapalı; arayüz nedenini önden söylesin diye burada.
   * Kararın kendisi sunucuda: `odev_gonder` arşivdeki sınıfı reddediyor.
   */
  sinif_arsiv: boolean;
  /** Soru PDF'i. Teslimden bağımsız, yayındaki ödevde her zaman var. */
  odev_yolu: string | null;
  gonderim: OgrenciGonderim | null;
  /**
   * Konu analizi (migration 0020). Teslim edilmediyse boş dizi — anahtar
   * gibi bu da teslimden önce hesaplanmıyor.
   */
  konu_analizi: KonuAnalizi[];
  cevap_anahtari: Record<string, string> | null;
  anahtar_yolu: string | null;
};

export type OgrenciOdevleri = {
  ogrenci: { id: string; ad: string; sinif: string | null; tur: 'okul' | 'ozel' };
  odevler: OgrenciOdev[];
  dersler: Array<{ zaman: string; mod: string; link: string | null }>;
  /**
   * Mesajlar sekmesinin rozeti (0025). Yalnız SAYI: yazışmanın kendisi
   * ayrı uçta (`ogrenci_mesajlari`), çünkü sekme açılmadan mesaj
   * metinlerini indirmenin sebebi yok.
   */
  okunmamis_mesaj: number;
};

/** `odev_gonderimleri` içindeki tek satır — sınıftaki HER öğrenci için bir tane. */
export type GonderimSatiri = {
  ogrenci_id: string;
  ogrenci: string;
  /** Göndermeyen öğrencide null. Satır yine de listede yer alır. */
  gonderim_id: string | null;
  gonderdi: boolean;
  zaman: string | null;
  gecikmeli: boolean;
  durum: 'incelemede' | 'onaylandi' | 'puanlandi' | null;
  dogru: number | null;
  yanlis: number | null;
  bos: number | null;
  puan: number | null;
  ogretmen_puan: number | null;
  ogretmen_yorum: string | null;
  /**
   * Hangi soruları yanlış yaptı / boş bıraktı (migration 0020).
   *
   * Sayı değil NUMARA: "5 yanlış" öğretmene ne yapacağını söylemez,
   * "3, 7 ve 9 yanlış" söyler. Göndermeyen öğrencide ve açık uçlu ödevde
   * boş dizi — sunucu orada hiç üretmiyor.
   */
  yanlis_sorular: number[];
  bos_sorular: number[];
  /** Dosyanın kendisi değil, varlığı. Yol `gonderim_foto_yolu` ile istenir. */
  foto_var: boolean;
};

export type OdevGonderimleri = {
  odev: {
    id: string;
    baslik: string;
    tur: 'test' | 'acik';
    sinif: string;
    son_tarih: string;
    soru_sayisi: number | null;
    gec_teslim: boolean;
    yayinda: boolean;
  };
  ozet: {
    mevcut: number;
    gonderen: number;
    gecikmeli: number;
    puan_bekleyen: number;
  };
  /** Sınıfın tamamı için konu başına toplam. En zayıf konu ilk sırada. */
  konu_ozeti: KonuAnalizi[];
  satirlar: GonderimSatiri[];
};

/** `sinif_ogrencileri` — bir öğrencinin ödev karnesi (migration 0013). */
export type SinifOgrencisi = {
  id: string;
  ad: string;
  tur: 'okul' | 'ozel';
  yapti: number;
  yapmadi: number;
  /** Yalnız yaptığı ödevlerin ortalaması. Hiç yapmadıysa null — 0 değil. */
  ortalama_yapan: number | null;
  /** Yapmadıkları 0 sayılarak tüm ödevlerin ortalaması. */
  ortalama_tum: number | null;
};

export type SinifDetayi = {
  sinif: { id: string; ad: string; ozel: boolean; arsiv: boolean };
  /** Ortalamaların hesaplandığı ödev sayısı: yayında VE süresi dolmuş. */
  degerlendirilen_odev: number;
  ogrenciler: SinifOgrencisi[];
};

/**
 * `konu_karnesi` — DÖNEM GENELİ konu dökümü ve gelişim (migration 0023).
 *
 * `konu_ozeti` (0020) tek bir ödevin dökümüdür; bu, dönemin tamamı.
 * Sınıf ya da öğrenci için çağrılır — ikisi birden değil.
 */
export type GelisimSatiri = {
  odev: string;
  tarih: string;
  tur: 'test' | 'acik';
  /**
   * Sınıfta gönderenlerin ortalaması, öğrencide kendi puanı.
   *
   * GÖNDERİLMEYEN ÖDEVDE `null` — 0 DEĞİL. Sıfır yazmak "sıfır aldı"
   * demektir; göndermemek başka bir şeydir ve ekran ikisini karıştırmamalı.
   */
  deger: number | null;
  /**
   * SINIF BİLGİSİ — yalnız öğretmenin ucunda (`konu_karnesi`) var.
   *
   * `kendi_karnem` (0026) bu iki alanı BİLEREK göndermiyor: öğrenciye ve
   * veliye "kaç kişiden kaçı gönderdi" demek kıyas kapısını açardı.
   * `Gelisim` bileşeni `kapsam='ogrenci'` iken onları zaten çizmiyor
   * (ölçüldü), yani ekranda bir eksiklik oluşmuyor.
   */
  gonderen?: number;
  /** Sınıfta aktif öğrenci sayısı; öğrenci kapsamında gönderilmiyor. */
  mevcut?: number;
};

export type KonuKarnesi = {
  kapsam: { tur: 'sinif' | 'ogrenci'; ad: string; sinif: string | null; mevcut: number };
  /** Karnenin dayandığı ödev sayısı: yayında VE süresi dolmuş (0013 ölçütü). */
  odev_sayisi: number;
  /** En zayıf konu başta. Yalnız test ödevlerinden. */
  konular: KonuAnalizi[];
  /** Kronolojik. Açık uçlu ödevler de burada. */
  gelisim: GelisimSatiri[];
};

/**
 * `kendi_karnem` (migration 0026) — öğrencinin ve velinin KENDİ karnesi.
 *
 * `KonuKarnesi`'nin kırpılmış hâli ve fark bilerek:
 *   - `kapsam.tur` yok — seçilecek bir kapsam yok, hep bu öğrenci
 *   - `kapsam.mevcut` yok — sınıfın kaç kişi olduğu bu ekrana ait değil
 *   - `gelisim` satırlarında `gonderen`/`mevcut` yok — sınıf bilgisi
 *
 * KIYAS ÇAĞRIŞTIRAN HİÇBİR SAYI GÖNDERİLMİYOR. Bir çocuğa "sınıfın
 * neresindesin" demek bu ekranın işi değil; sınır sunucuda
 * (`kendi_karnem_testleri.sql` 3. grubu ölçüyor), arayüzde gizleme değil.
 */
export type KendiKarnem = {
  kapsam: { ad: string; sinif: string | null };
  odev_sayisi: number;
  /**
   * Çocuğun KENDİ genel ortalaması (0029). Sınıf ortalaması değil — o
   * bu uçtan hiç gelmiyor ve gelmeyecek.
   *
   * `null` olabilir: değerlendirilmiş gönderim yoksa sunucu ortalama
   * üretmiyor, uydurma bir 0 göndermiyor. Alan optional DEĞİL ama
   * nullable — 0029 panelde çalıştırılmadıysa alan hiç gelmez ve
   * ekran `?? null` ile sessizce ortalamasız çalışır.
   */
  genel_ortalama: number | null;
  konular: KonuAnalizi[];
  gelisim: GelisimSatiri[];
};

/** `veliler_listesi` — öğretmenin veli sekmesi (migration 0019). */
export type VeliBekleyen = {
  ogrenci_id: string;
  ad: string;
  sinif: string;
  okunmamis: number;
  son_mesaj: string | null;
};

export type VeliGrubu = {
  sinif_id: string;
  sinif: string;
  ozel: boolean;
  veli_sayisi: number;
  okunmamis: number;
};

export type VelilerListesi = {
  toplam_okunmamis: number;
  /** Yanıt bekleyenler sınıf ayrımı olmadan, en eski bekleyen üstte. */
  yanit_bekleyen: VeliBekleyen[];
  gruplar: VeliGrubu[];
};

export type SinifVelisi = {
  ogrenci_id: string;
  ad: string;
  tur: 'okul' | 'ozel';
  /** Veli kodu yoksa veli hiç giriş yapamaz; öğretmen bunu önden bilsin. */
  veli_kodu_var: boolean;
  mesaj_sayisi: number;
  son_mesaj: string | null;
  okunmamis: number;
};

export type SinifVelileri = {
  sinif: { id: string; ad: string; ozel: boolean };
  veliler: SinifVelisi[];
};

/**
 * Hangi yazışma (migration 0025).
 *
 * İKİ AYRI YAZIŞMA VAR: öğrenci↔öğretmen ve veli↔öğretmen. Ayrım
 * SUNUCUDA, `mesajlar.kanal` sütununda; buradaki tip yalnız hangisini
 * istediğimizi söylemeye yarıyor. Arayüzde süzme YOK — çocuk, velisinin
 * öğretmenle yazdıklarını okuyamamalı ve bu bir görünürlük tercihi değil,
 * şemadan gelen bir sınır (Part XXI).
 */
export type Kanal = 'veli' | 'ogrenci';

/** Tek bir mesaj. `kimden` hangi tarafın yazdığını söyler. */
export type Mesaj = {
  kimden: 'ogretmen' | 'veli' | 'ogrenci';
  metin: string;
  zaman: string;
};

export type Yazisma = {
  ogrenci: { id: string; ad: string; sinif: string | null };
  kanal: Kanal;
  /**
   * O KANALIN karşı tarafının kodu var mı: veli kanalında veli kodu,
   * öğrenci kanalında öğrenci kodu. Kod yoksa yazılan mesajı kimse
   * göremez; öğretmen bunu yazmadan ÖNCE görsün.
   */
  veli_kodu_var: boolean;
  mesajlar: Mesaj[];
};

/** `ogrenci_yazismalari` — öğretmene "hangi öğrenciler yazmış" (0025). */
export type OgrenciBekleyen = {
  ogrenci_id: string;
  ad: string;
  sinif: string | null;
  okunmamis: number;
  son_mesaj: string | null;
};

export type OgrenciYazismalari = {
  toplam_okunmamis: number;
  /** MESAJ METNİ TAŞIMIYOR: ortak ekranda herkesin yazdığı yan yana durmasın. */
  yanit_bekleyen: OgrenciBekleyen[];
};

/** `ogrenci_mesajlari` — öğrencinin KENDİ yazışması (0025). */
export type OgrenciMesajlari = {
  mesajlar: Mesaj[];
  son_gorulme: string | null;
};

/**
 * `veli_paneli` — velinin gördüğü her şey.
 *
 * KURAL 6: cevap anahtarı BURADA YOK ve olmayacak. Ödev satırında yalnız
 * başlık, tarih, teslim durumu ve puan var; anahtar alanı, anahtar dosya
 * yolu ya da anahtarın içeriği hiçbir biçimde dönmüyor —
 * `veliler_testleri.sql` 7. grubu dördünü de ayrı ayrı ölçüyor.
 */
export type VeliOdevi = {
  baslik: string;
  son_tarih: string;
  olusturma: string;
  gonderildi: boolean;
  gonderim_zamani: string | null;
  puan: number | null;
  durum: string | null;
  /** Konu analizi (0020). Veli hangi konuda eksik olduğunu görüyor. */
  konu_analizi: KonuAnalizi[];
  /**
   * YALNIZ NUMARA. Öğrencinin işaretlediği şık da doğru şık da BURADA YOK
   * ve olmayacak: numara "hangi soruda takıldı" der, şık göndermek dört
   * şıklı bir soruda anahtara doğru bir adım olurdu (Kural 6).
   */
  yanlis_sorular: number[];
  bos_sorular: number[];
};

export type VeliPaneli = {
  ogrenci: { ad: string; sinif: string | null; tur: 'okul' | 'ozel' };
  /**
   * Çocuğun kendi genel ortalaması (0029) — `kendi_karnem` ile AYNI
   * sayı, aynı ölçütten. İki uçtan iki farklı ortalama çıkması en olası
   * hataydı; `genel_ortalama_testleri.sql` 3. grubu ikisinin eşit
   * olduğunu ayrıca ölçüyor.
   */
  genel_ortalama: number | null;
  odevler: VeliOdevi[];
  mesajlar: Mesaj[];
  odemeler: Array<{ tutar: number; tarih: string; odendi: boolean }>;
  /** Mesajlar sekmesinin rozeti (0025) — yalnız VELİ yazışmasından. */
  okunmamis_mesaj: number;
  son_gorulme: string | null;
};

/** `pano_detay` satırı. Alanlar türe göre dolu; zarf dört tür için aynı. */
export type PanoSatiri = {
  ad: string;
  /** gondermeyen: eksik ödev sayısı */
  eksik?: number;
  /** acik_odev */
  id?: string;
  son_tarih?: string;
  gonderim_sayisi?: number;
  /** puan_bekleyen */
  odev?: string;
  odev_id?: string;
  zaman?: string;
};

export type PanoDetayi = {
  tur: string;
  baslik: string;
  aciklama: string;
  toplam: number;
  gruplar: Array<{ sinif: string; ozel: boolean; satirlar: PanoSatiri[] }>;
};

/**
 * `ozel_ders_detay` (migration 0021) — ÖĞRETMENE ÖZEL.
 *
 * `id` alanları bu ucun varlık sebebi: `ders_sil`, `odeme_degistir` ve
 * `odeme_sil` bir `p_id` istiyor ve başka hiçbir uç id döndürmüyordu.
 *
 * ÖĞRETMENİN KURALI — ÖĞRENCİ PARAYI GÖRMEZ. Bu tip yalnız öğretmen
 * ekranında kullanılıyor. Öğrencinin ucu (`ogrenci_odevleri`) ödemeyle
 * ilgili hiçbir alan taşımıyor; sınır sunucuda, arayüzde gizleme yok
 * (Part XXI). `ozel_ders_takibi_testleri.sql` 4. grubu bunu alan adı ve
 * tutar değeri olarak ayrı ayrı ölçüyor.
 */
export type OzelDers = {
  id: string;
  zaman: string;
  mod: 'yuzyuze' | 'online';
  link: string | null;
  /** Zamanı geçmiş ders. Sunucuda türetiliyor, saklanmıyor. */
  gecti: boolean;
};

export type OzelOdeme = {
  id: string;
  tutar: number;
  tarih: string;
  odendi: boolean;
};

export type OzelDersDetayi = {
  ogrenci: {
    id: string;
    ad: string;
    tur: 'okul' | 'ozel';
    sinif: string | null;
    aktif: boolean;
  };
  dersler: OzelDers[];
  odemeler: OzelOdeme[];
  ozet: {
    toplam: number;
    odenen: number;
    /** Öğretmenin asıl bakacağı sayı: ödenmemiş toplam. */
    kalan: number;
    ders_toplam: number;
    gelecek_ders: number;
  };
};
