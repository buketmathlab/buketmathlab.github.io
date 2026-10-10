/**
 * DÜRÜST ÇALIŞMA İLKEMİZ — öğrenci panosunda SABİT duran kart.
 * React'siz, doğrudan test edilebilir (`el-yazisi-metni.ts` deseni).
 *
 * Öğretmenin cümlesi: "Bizim açımızdan en kritik konu öğrencilerin
 * ödevleri eksik yapmaları ya da yanlış yapmaları değil, yapay zekâ gibi
 * kısa yollara başvurmadan hazır, emeksiz cevaplar göndermemeleri.
 * Öğrencilerin aldıkları puanlar kendilerine bir çalışma programı
 * oluşturmaları açısından önemli; bizim için ise en önemli olan ödevleri
 * dürüst bir şekilde yapmaları ve onların eksiklerini şeffaf bir şekilde
 * görmemiz." İstek: hem ödev yapımına hem dürüstlük ve şahsiyet
 * kazanmaya katkı sağlayan, "çok profesyonel ve pedagojik" bir yazı.
 *
 * DİL KURALLARI (ölçülüyor, `durustluk-metni.test.ts`):
 *  - Tehdit ve suçlama yok ("ceza", "yakalanırsan" gibi). Yaptırım cümlesi
 *    ödev gönderme ekranında zaten var (`el-yazisi-metni.ts`); burada amaç
 *    korkutmak değil, NEDENİNİ anlatmak.
 *  - Yanlış ve boş suç değil: eksik, birlikte çalışılacak yerin işareti.
 *  - "Biz": kart öğretmenlerin ortak sesi (birden çok öğretmen var).
 *  - Öğrenciye "sen" diye, sıcak ama ciddi.
 */

export const BASLIK = 'Dürüst çalışma ilkemiz';

export const PARAGRAFLAR: readonly string[] = [
  'Her ödev, nerede olduğunu birlikte görebilmemiz için bir fırsattır. Aldığın puan, ' +
    'kendine bir çalışma programı kurman için yol gösterir; bizim için asıl değerli olan ise ' +
    'ödevini kendi emeğinle ve dürüstçe yapmandır.',
  'Yapay zekâdan, bir başkasından ya da hazır bir kaynaktan alınmış cevaplar kısa vadede ' +
    'yüksek bir puan getirebilir; ama eksiklerini gizler ve öğrenme fırsatını elinden alır. ' +
    'Kendi yaptığın bir yanlış sana neyi öğrenmen gerektiğini gösterir; kopyalanmış bir doğru ' +
    'ise hiçbir şey göstermez.',
  'Dürüstlük, kimse görmezken de doğru olanı yapabilmektir. Kendi emeğinle tamamladığın her ' +
    'ödev, bilginle birlikte karakterini de güçlendirir.',
];

/** Öğrencinin kendine verdiği sözler — birinci tekil şahıs. */
export const ILKELER: readonly string[] = [
  'Ödevlerimi kendi bilgim ve emeğimle yaparım.',
  'Bilmediğim soruyu yanlış yapmaktan ya da boş bırakmaktan çekinmem; bunlar öğrenmemin bir parçasıdır.',
  // Öğretmenin kendi cümlesi. Çözümlü anahtar öğrenciye ödevi GÖNDERDİKTEN
  // sonra açılıyor (Kural 6); sıra da bu: önce kendi emeği, sonra çözüm.
  'Ödevimi gönderdikten sonra takıldığım soruları çözümlü cevap anahtarından incelerim; ' +
    'anlamadığım yeri öğretmenime sorarım.',
];
