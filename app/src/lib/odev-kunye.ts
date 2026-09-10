/**
 * SORU KÂĞIDI KÜNYESİ — saf ayrıştırıcı.
 *
 * React yok, DOM yok, PDF kütüphanesi yok. Girdi metin, çıktı bir rapor
 * (`lib/` ilkesi; `cevap-anahtari.ts` ile aynı desen).
 *
 * ## Neden var
 *
 * Öğretmen soru kâğıdını Claude'da üretiyor; çıktı PDF/Word. İki bilgi o
 * çıktıda VAR ama SEKİZ'e gelirken yolda kayboluyor:
 *
 *   1. Cevap anahtarı — bugün anahtar PDF'inin METNİNDEN çıkarılmaya
 *      çalışılıyor (`cevap-anahtari.ts`).
 *   2. SORU BAŞINA KONU — bugün öğretmen tek tek elle giriyor.
 *
 * İkincisi PDF'ten çıkarılamıyor ve bu ölçülmüş bir sınır:
 * `odev-pdf-ozeti.ts`'in başındaki nota göre öğretmenin gerçek
 * PDF'lerinde sorular GÖRSEL olarak gömülü, metin katmanında yok. Oysa
 * konu karnesi (`konu_karnesi`) tamamen bu alana dayanıyor.
 *
 * Künye o iki bilgiyi tek bir yapıştırmayla taşıyor.
 *
 * ## Biçim neden bu
 *
 *     1  A  Türev
 *     2  C  Türev
 *     3  B  Limit
 *
 * Bu, Word'deki cevap anahtarı TABLOSUNUN doğal hâli — öğretmen tablodan
 * doğrudan yapıştırabiliyor. JSON seçilseydi daha kesin olurdu ama tek
 * bir kırık tırnak bütün yapıştırmayı düşürürdü ve öğretmen neyin yanlış
 * olduğunu gözle göremezdi.
 *
 * AYRIŞTIRICI BİLEREK HOŞGÖRÜLÜ. Kopyala-yapıştırın en olası hasarı
 * fazladan boşluk, sekme ve başlık satırıdır; sıkı bir biçim tam da o
 * anda her şeyi düşürürdü. Ama hoşgörü SESSİZ DEĞİL: okunamayan her
 * satır rapora giriyor.
 *
 * ## ÇIKTI BİR ÖNERİDİR (Bölüm XXVIII)
 *
 * Bu dosya hiçbir şeyi kaydetmez. Öğretmen önizlemeyi görüp onaylamadan
 * tek alan dolmaz. 5. kuralın ("notlandırmada asla yapay zekâ kullanma")
 * korunma noktası burası: anahtarı yapay zekâ önerse de yayına öğretmen
 * onayıyla gidiyor, ve `odev_yayinla` eksik anahtarlı ödevi zaten
 * reddediyor.
 */

import { konuAdiniDuzelt, type Konular } from '@/lib/konu-atama';
import type { SonSecenek } from '@/lib/cevap-anahtari';

export type KunyeSecenekleri = {
  soruSayisi: number;
  sonSecenek?: SonSecenek;
};

export type KunyeSatirHatasi = {
  /** 1'den başlayan satır numarası — öğretmene "şu satıra bak" diyebilmek için. */
  satirNo: number;
  metin: string;
  sebep: string;
};

export type KunyeRaporu = {
  /** Soru numarası → şık. Yalnız güvenilen eşleşmeler. */
  anahtar: Record<number, string>;
  /** Soru numarası → konu adı. */
  konular: Konular;
  /** Anahtarı okunan soru numaraları, artan sırada. */
  bulunan: number[];
  /** Künyede hiç geçmeyen soru numaraları, artan sırada. */
  eksik: number[];
  /** Konusu yazılmamış ama anahtarı okunan sorular. Konu isteğe bağlı. */
  konusuz: number[];
  /** Aynı soru için ikinci kez kayıt görülen numaralar. İLK kayıt kullanılır. */
  celiskili: number[];
  /** Okunamayan satırlar — sessizce atılmıyor, öğretmene gösteriliyor. */
  okunamayan: KunyeSatirHatasi[];
  /** Hiçbir satır okunamadıysa `true`; arayüz "bu künye değil" diyebilsin. */
  bos: boolean;
};

/**
 * Başlık satırı gibi görünen satırlar. Öğretmen Word tablosunu
 * yapıştırdığında ilk satır çoğu zaman "Soru | Cevap | Konu" oluyor;
 * bunu "okunamayan satır" diye şikâyet etmek gürültü olurdu.
 */
const BASLIK_DESENI = /^\s*(soru|no|s\.?no|numara)\b/i;

/**
 * Bir künye satırı: numara, şık, sonrası konu.
 *
 * Ayraçlar isteğe bağlı ve çeşitli: "1 A Türev", "1) A - Türev",
 * "1.\tA\tTürev", "1 - a - türev". Şıktan sonra gelen ayraçlar konudan
 * ayrılırken siliniyor; "Türev" ile "- Türev" aynı konu olmalı, yoksa
 * konu listesi ikiye bölünür.
 */
function satirDeseni(sonSecenek: SonSecenek): RegExp {
  const kucuk = sonSecenek.toLowerCase();
  return new RegExp(
    `^\\s*(\\d{1,3})\\s*[-–—.:)\\]]?\\s+([A-${sonSecenek}a-${kucuk}])\\b\\s*[-–—.:|]?\\s*(.*)$`,
  );
}

export function kunyeyiOku(
  metin: string,
  { soruSayisi, sonSecenek = 'E' }: KunyeSecenekleri,
): KunyeRaporu {
  const desen = satirDeseni(sonSecenek);
  const anahtar: Record<number, string> = {};
  const konular: Konular = {};
  const celiskili: number[] = [];
  const okunamayan: KunyeSatirHatasi[] = [];

  const satirlar = (metin ?? '').split(/\r?\n/);

  satirlar.forEach((ham, i) => {
    const satirNo = i + 1;
    const satir = ham.trim();
    if (satir === '') return;
    if (BASLIK_DESENI.test(satir) && !/\d/.test(satir)) return;

    const esles = desen.exec(satir);
    if (!esles) {
      okunamayan.push({
        satirNo,
        metin: satir,
        sebep: `Satır "numara şık konu" düzeninde değil (örnek: 1 A Türev).`,
      });
      return;
    }

    const no = Number(esles[1]);
    const sik = (esles[2] ?? '').toUpperCase();
    const konu = konuAdiniDuzelt(esles[3] ?? '');

    // ARALIK DIŞI NUMARA SESSİZCE ATILMIYOR. Ödev 10 soruluk ama künyede
    // 11. soru varsa, ya soru sayısı yanlış girilmiştir ya künye başka
    // bir ödeve aittir. İkisi de öğretmenin bilmesi gereken şeyler.
    if (!Number.isInteger(no) || no < 1 || no > soruSayisi) {
      okunamayan.push({
        satirNo,
        metin: satir,
        sebep: `${no}. soru bu ödevde yok — ödev ${soruSayisi} soruluk.`,
      });
      return;
    }

    // İLK KAYIT KAZANIR ve ikincisi bildirilir. Sessizce üzerine yazmak,
    // öğretmenin gördüğü önizlemeyle kaydedilenin farklı olması demekti.
    if (anahtar[no] !== undefined) {
      if (!celiskili.includes(no)) celiskili.push(no);
      return;
    }

    anahtar[no] = sik;
    if (konu !== '') konular[no] = konu;
  });

  const bulunan = Object.keys(anahtar)
    .map(Number)
    .sort((a, b) => a - b);

  const eksik: number[] = [];
  for (let n = 1; n <= soruSayisi; n++) if (anahtar[n] === undefined) eksik.push(n);

  const konusuz = bulunan.filter((n) => konular[n] === undefined);

  celiskili.sort((a, b) => a - b);

  return {
    anahtar,
    konular,
    bulunan,
    eksik,
    konusuz,
    celiskili,
    okunamayan,
    bos: bulunan.length === 0,
  };
}
