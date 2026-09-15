/**
 * PDF'ten metin okuma — yalnız tarayıcıda.
 *
 * ## PDF hiçbir yere gönderilmiyor
 * Ayrıştırma tamamen kullanıcının cihazında yapılır. Cevap anahtarı dosyası
 * çıkarım için sunucuya, bize ya da üçüncü bir tarafa gitmez.
 *
 * ## CDN yerine npm — bilinçli
 * Eski uygulama pdf.js'i cdnjs'ten çekiyordu (`index.html:10`). İki sorun:
 * her ziyaretçinin IP'si üçüncü tarafa gidiyordu (KVKK) ve yayın dışarıdaki
 * bir servisin ayakta olmasına bağlıydı. Paket artık npm'den geliyor.
 *
 * ## Tembel yükleme
 * pdf.js büyük bir kütüphane. `import()` ile yalnız öğretmen bir PDF
 * seçtiğinde iniyor; giriş ekranını her gün açan öğrenci onu hiç indirmiyor.
 *
 * ## Neden satır satır
 * `getTextContent()` parçaları düz bir liste olarak verir; birleştirince
 * sayfa tek bir metin yığınına dönüşür ve "soru numarası mı, şık mı"
 * ayrımı kaybolur. Parçalar y koordinatına göre satırlara ayrılıyor;
 * `lib/cevap-anahtari.ts` bu yapıya dayanarak soru metnini eliyor.
 */

import { withResolversKur } from '@/lib/promise-polyfill';

/** Aynı satır sayılmak için y koordinatları arasındaki en büyük fark (punto). */
const SATIR_TOLERANSI = 3;

/**
 * Boşluk sayılmak için iki parça arasındaki en küçük yatay açıklık —
 * punto cinsinden değil, YAZI BOYUNUN ORANI olarak.
 *
 * Sabit bir punto eşiği, 8 puntoluk bir listede boşlukları kaçırır,
 * 20 puntoluk bir başlıkta olmayan boşluk uydururdu.
 */
const BOSLUK_ORANI = 0.2;

type MetinParcasi = { str: string; transform: number[]; width?: number };

/**
 * İki parça arasına boşluk girmeli mi.
 *
 * ## Bu fonksiyonun varlık sebebi ÖLÇÜLMÜŞ bir kusur
 *
 * Parçalar eskiden koşulsuz `' '` ile birleşiyordu. Gerçek bir e-Okul sınıf
 * listesinde ölçüldü: o PDF'te `ş`, `ğ`, `İ` gibi harfler AYRI parça olarak
 * geliyor ve koşulsuz boşluk şunları üretiyordu:
 *
 *     "K ı z"                    ← "Kız"
 *     "Beş ikta ş / Arnavutköy"  ← "Beşiktaş / Arnavutköy"
 *     "1 601 A Lİ YILMAZ"        ← öğrencinin adı ortadan ikiye bölünmüş
 *                                  (örnek ad uydurma: bu depo herkese açık)
 *
 * Yani öğrenci adları bozuk kaydedilecekti. Artık boşluk, parçanın nerede
 * BİTTİĞİNE bakılarak konuyor: bitişik gelen harf yapışık kalıyor.
 *
 * `width` yoksa (pdf.js her zaman verir, ama tip isteğe bağlı) eski
 * davranış sürüyor — bilgi olmadan tahmin etmektense boşluk koymak daha
 * güvenli: kelimeleri yanlışlıkla birbirine yapıştırmaz.
 */
function boslukGerekli(
  onceki: { x: number; str: string; genislik?: number; punto: number },
  sonraki: { x: number },
): boolean {
  if (onceki.genislik === undefined) return true;
  // Parça kendi boşluğunu taşıyorsa ikincisini eklemeye gerek yok.
  if (/\s$/.test(onceki.str)) return false;
  const bitis = onceki.x + onceki.genislik;
  return sonraki.x - bitis > Math.max(onceki.punto, 1) * BOSLUK_ORANI;
}

/** Parçaları y koordinatına göre satırlara böler, her satırı x'e göre sıralar. */
export function parcalariSatirlaraBol(parcalar: readonly MetinParcasi[]): string[] {
  type Parca = { x: number; str: string; genislik?: number; punto: number };
  const satirlar: Array<{ y: number; parcalar: Parca[] }> = [];

  for (const p of parcalar) {
    if (p.str.trim() === '') continue;
    const x = p.transform[4] ?? 0;
    const y = p.transform[5] ?? 0;
    // transform[0] yatay ölçek — pratikte yazı boyu.
    const punto = Math.abs(p.transform[0] ?? 0) || 10;
    const parca: Parca = { x, str: p.str, punto, ...(p.width === undefined ? {} : { genislik: p.width }) };

    const mevcut = satirlar.find((s) => Math.abs(s.y - y) <= SATIR_TOLERANSI);
    if (mevcut) {
      mevcut.parcalar.push(parca);
    } else {
      satirlar.push({ y, parcalar: [parca] });
    }
  }

  // PDF'te y yukarı doğru büyür: en üstteki satır en büyük y'ye sahiptir.
  satirlar.sort((a, b) => b.y - a.y);

  return satirlar.map((s) => {
    const sirali = [...s.parcalar].sort((a, b) => a.x - b.x);
    let metin = '';
    sirali.forEach((p, i) => {
      if (i > 0 && boslukGerekli(sirali[i - 1]!, p)) metin += ' ';
      metin += p.str;
    });
    return metin.replace(/\s+/g, ' ').trim();
  });
}

/**
 * PDF dosyasını satırlara çevirir.
 *
 * @throws Okunamayan, şifreli ya da bozuk dosyada Türkçe, eyleme dönük hata.
 */
export async function pdfSatirlariniOku(dosya: File): Promise<string[]> {
  // pdf.js YÜKLENMEDEN ÖNCE. Aksi hâlde Safari 17.4 öncesinde modülün
  // kendisi değerlendirilirken çöküyor (bkz. lib/promise-polyfill.ts).
  withResolversKur();

  const pdfjs = await import('pdfjs-dist');

  // Worker dosyası Vite tarafından paketlenir; dışarıdan indirilmez.
  //
  // Worker'ın KENDİ global kapsamı var ve oraya polyfill koyamıyoruz
  // (pdf.js'in worker dosyasını biz yazmıyoruz). Eski Safari'de worker
  // çökecek — ama bu kabul edilebilir: pdf.js worker başarısız olunca
  // `_setupFakeWorker` ile ana iş parçacığına düşüyor, orası da
  // polyfill'li. Sonuç: biraz daha yavaş, ama çalışıyor.
  //
  // Sarmalayıcı bir worker denendi ve BIRAKILDI: dinamik import top-level
  // await gerektiriyor, pdf.js'in test mesajına yanıt gecikince akış
  // donuyordu (ölçüldü). Basit yol daha sağlam.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  // `destroy()` yükleme görevinde, belge nesnesinde değil.
  const gorev = pdfjs.getDocument({ data: new Uint8Array(await dosya.arrayBuffer()) });

  try {
    let belge;
    try {
      belge = await gorev.promise;
    } catch {
      throw new Error(
        'PDF açılamadı. Dosya bozuk ya da parola korumalı olabilir. ' +
          'Başka bir dosya deneyin veya cevapları elle girin.',
      );
    }

    const tumSatirlar: string[] = [];
    for (let i = 1; i <= belge.numPages; i++) {
      const sayfa = await belge.getPage(i);
      const icerik = await sayfa.getTextContent();
      // `items` metin parçaları ve işaretleme düğümleri karışık gelir;
      // yalnız `str` taşıyanlar bizi ilgilendiriyor.
      const parcalar: MetinParcasi[] = [];
      for (const x of icerik.items) {
        if ('str' in x && 'transform' in x) {
          // `width` ŞART: boşlukların nereye gireceği buna bakılarak
          // kararlaştırılıyor. Geçirilmediği sürece okuyucu "K ı z" üretir
          // (gerçek bir sınıf listesinde ölçüldü).
          parcalar.push({
            str: x.str,
            transform: x.transform,
            ...(typeof x.width === 'number' ? { width: x.width } : {}),
          });
        }
      }
      tumSatirlar.push(...parcalariSatirlaraBol(parcalar));
    }

    if (tumSatirlar.length === 0) {
      throw new Error(
        'Bu PDF metin içermiyor — büyük olasılıkla taranmış bir görüntü. ' +
          'Cevapları elle girebilirsiniz.',
      );
    }

    return tumSatirlar;
  } finally {
    // Görevi ve worker'ı birlikte serbest bırak: her çağrıda yeni bir
    // worker açıldığı için kapatılmazsa birikir.
    await gorev.destroy();
  }
}
