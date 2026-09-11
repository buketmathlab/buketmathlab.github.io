import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ONAM_BOLUMLERI,
  ONAM_GIRIS,
  ONAM_METNI,
  ONAM_OZET,
  ONAM_SURUMU,
} from '@/lib/onam-metni';

const ozet = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

/**
 * SÜRÜM KİLİDİ.
 *
 * Kaydedilen şey metnin kendisi değil, SÜRÜMÜ. Metin değişip sürüm sabit
 * kalsaydı eski onaylar yeni metni sessizce kapsardı — veli, okumadığı bir
 * şeyi onaylamış sayılırdı. Sessizliği bozan şey bu kayıt.
 *
 * METNİ DEĞİŞTİRDİYSENİZ:
 *   1. `ONAM_SURUMU`'nu yükseltin (ör. '2026-09-2'),
 *   2. buraya YENİ bir satır ekleyin — eskisini SİLMEYİN,
 *   3. `_gecerli_onam_surumu()`'nü de aynı değere getiren yeni bir
 *      migration yazın.
 *
 * Sadece aşağıdaki hash'i güncellemek testi yeşile döndürür ama işi
 * yapmaz: veliler eski sürümde onaylı görünmeye devam eder.
 */
const SURUM_KAYDI: Record<string, string> = {
  // İlk taslak. Öğretmen okuyunca iki eksik çıktı: metin, velinin
  // ÇOCUĞUN UYGULAMAYI KULLANMASINA izin verdiğini söylemiyordu ve okul
  // adına hiç değinmiyordu. Bu sürüm hiç yayına çıkmadı, hiç onay almadı;
  // yine de kayıtta duruyor — silinmiş bir sürüm, olmamış sürüm demek
  // değil.
  '2026-09-1': '4adeba337e0dabc854a8c5645cc767df1ec1070dc9dfe341009dd0524df86d39',
  // Yayına giren ilk sürüm: izin cümlesi, ad-soyad-ödev-not dökümü,
  // "okul adı saklanmıyor" ve düğme üstündeki özet eklendi.
  '2026-09-2': '045b5636f4ff7d25602d471e7104f8db096758140efa872dd33a10672f433f14',
  // Öğretmen metni okuyup üç şey kaldırttı (özel ders satırı, cevap
  // anahtarı cümlesi, yapay zekâ bölümü) ve "kim görebiliyor" kısmını
  // düzelttirdi: "dört öğretmen" yanlıştı, her öğretmen yalnız kendi
  // sınıfını görüyor.
  '2026-09-3': '83fa21b48ef4c1aa05406c0a70eb72344f4868632d922c16255acf9eaab6ae38',
  // Bu sürüm siteye çıktı ama HİÇ ONAYLANAMADI: sunucu sürümü o sırada
  // hâlâ 2026-09-2'ydi (0035 çalıştırılmamıştı), yani `onam_ver` her
  // denemeyi reddediyordu. Yine de kayıtta duruyor — veli o metni OKUDU.
  //
  // Sürüm 4: fotoğraf cümlesi yeniden yazıldı. Öğretmen "yani öğretmen
  // ödev kâğıdına sadece altmış saniye mi bakabilecek?" diye sordu; o süre
  // bağlantının ömrü, bakma süresi değil. Ürünün sahibini yanıltan cümle
  // veliyi de yanıltır.
  '2026-09-4': '04e492b900484ca77770ae49108ecaa04b54ce5052895b16697be0dbe8598065',
};

describe('onam metni sürüm kilidi', () => {
  it('bu sürüm kayıtta var', () => {
    expect(Object.keys(SURUM_KAYDI)).toContain(ONAM_SURUMU);
  });

  it('metin bu sürümde kaydedilen metinle birebir aynı', () => {
    expect(ozet(ONAM_METNI)).toBe(SURUM_KAYDI[ONAM_SURUMU]);
  });

  // KİLİDİN KENDİSİ ÇALIŞIYOR MU. Bu olmadan hash karşılaştırması, iki
  // taraf da aynı boş değere düşerse sessizce geçerdi.
  it('metnin bir harfi değişse kilit tutmaz', () => {
    expect(ozet(ONAM_METNI + ' ')).not.toBe(SURUM_KAYDI[ONAM_SURUMU]);
  });
});

/**
 * SUNUCUYLA AYNI SÜRÜM.
 *
 * `onam_ver` istemcinin gönderdiği sürümü sunucununkiyle karşılaştırıyor.
 * İkisi ayrışırsa veli onam ekranını geçemez: düğmeye basar, "Onam metni
 * güncellenmiş" hatası alır ve döngüde kalır. Bu, arayüzde hiç görünmeyen
 * ama velinin uygulamayı hiç kullanamaması demek olan bir kusur — o yüzden
 * migration dosyası GERÇEKTEN okunuyor, sabit kopyalanmıyor.
 */
describe('sunucu ile istemci aynı sürümde', () => {
  /**
   * SON SÖZÜ SÖYLEYEN DOSYA ARANIYOR, sabit bir dosya adı DEĞİL.
   *
   * `create or replace` yüzünden geçerli tanım, `_gecerli_onam_surumu`'nü
   * tanımlayan EN YÜKSEK numaralı migration'dır. Test 0034'e çivili
   * kalsaydı, 0035 sürümü yükselttiği anda test eski dosyaya bakıp
   * "eşleşmiyor" derdi — ya da daha kötüsü, biri 0034'ü düzenleyip testi
   * yeşile döndürür ve gerçek sunucu sürümü başka kalırdı.
   */
  function sonSurum(klasor: string): { dosya: string; surum: string | undefined } {
    const dizin = resolve(process.cwd(), '..', klasor);
    const dosya = readdirSync(dizin)
      .filter((d) => d.endsWith('.sql'))
      .filter((d) =>
        readFileSync(resolve(dizin, d), 'utf8').includes(
          'function public._gecerli_onam_surumu',
        ),
      )
      .sort()
      .pop();
    if (!dosya) return { dosya: '', surum: undefined };
    const metin = readFileSync(resolve(dizin, dosya), 'utf8');
    // Tanımın GÖVDESİ okunuyor; doğrulama bloğundaki karşılaştırma değil.
    const govde = /function public\._gecerli_onam_surumu[\s\S]*?select\s+'([^']+)'::text;/.exec(
      metin,
    );
    return { dosya, surum: govde?.[1] };
  }

  it('migrationlar arasında sürüm sabitini tanımlayan bir dosya var', () => {
    expect(sonSurum('supabase/migrations').dosya).not.toBe('');
  });

  it('en son migrationdaki sürüm ONAM_SURUMU ile aynı', () => {
    const { dosya, surum } = sonSurum('supabase/migrations');
    expect(`${dosya}: ${surum}`).toBe(`${dosya}: ${ONAM_SURUMU}`);
  });

  it('panele yapıştırılan kısa sürüm de aynı sürümü taşıyor', () => {
    const { dosya, surum } = sonSurum('supabase/panel-icin');
    expect(`${dosya}: ${surum}`).toBe(`${dosya}: ${ONAM_SURUMU}`);
  });
});

/**
 * METNİN İÇERİĞİ.
 *
 * Onam metninin değeri, ürünün GERÇEKTE ne yaptığını söylemesinde. Aşağıdaki
 * maddeler bir düzenlemede sessizce düşerse veli eksik bilgilendirilmiş olur
 * ve kimse fark etmez.
 */
describe('metin ürünün gerçeğini söylüyor', () => {
  it('yurt dışı barındırmayı açıkça söylüyor', () => {
    expect(ONAM_METNI).toContain('İsviçre');
    expect(ONAM_METNI).toContain('Türkiye dışında');
  });

  it('öğrencinin yazışmasının veliye kapalı olduğunu söylüyor (0025)', () => {
    expect(ONAM_METNI).toContain('orayı siz görmezsiniz');
  });

  it('onaylamamanın sonucunu saklamıyor', () => {
    expect(ONAM_METNI).toContain('Veli paneline giremezsiniz');
    // Öğrencinin girişinin etkilenmediği de yazmalı: kapı yalnız veliye.
    expect(ONAM_METNI).toContain('kendi girişi bundan kendiliğinden etkilenmez');
    // ...ve velinin elinde gerçek bir yol olmalı. Bu cümle olmasaydı metin
    // "çocuğunuzun kullanmasına izin veriyorsunuz" der, sonra izin
    // vermeyene hiçbir şey sunmazdı.
    expect(ONAM_METNI).toContain('hesabı kapatılır');
  });

  /**
   * ÖĞRETMENİN İKİNCİ TURDAKİ İSTEĞİ.
   *
   * "Veli aynı zamanda öğrencisinin öğrenci uygulamasını kullanabileceğine
   * dair de izin vermeli; adının, soyadının, ödevlerinin, notlarının
   * depolanacağını kabul eden bir metin olmalı."
   *
   * Bu maddeler bir düzenlemede sessizce düşerse metin, öğretmenin
   * istediği şeyi söylemeyi bırakır ve kimse fark etmez.
   */
  it('çocuğun uygulamayı kullanmasına izin verildiğini söylüyor', () => {
    expect(ONAM_METNI).toContain('öğrenci uygulamasını kullanmasına');
    expect(ONAM_METNI).toContain('izin veriyorum');
  });

  it('ad, soyad, ödev ve notun saklandığını tek tek sayıyor', () => {
    expect(ONAM_METNI).toContain('adı ve soyadı');
    expect(ONAM_METNI).toContain('notu (puanı)');
    expect(ONAM_METNI).toContain('Ödevleri');
  });

  /**
   * OKUL ADI GERÇEKTEN SAKLANMIYOR.
   *
   * Öğretmen "okul adının depolanacağını kabul eden" bir metin istedi;
   * şemaya bakıldığında okul adı diye bir alan olmadığı görüldü —
   * `siniflar` yalnız seviye ve şube tutuyor, `ad` ondan türetiliyor.
   * Metin bu yüzden saklandığını DEĞİL, saklanmadığını söylüyor.
   *
   * Bu test ikisini birden tutuyor: ileride gerçekten bir okul adı alanı
   * eklenirse şema testi değil BU test kırmızı olur ve metnin de
   * güncellenmesi gerektiği ortaya çıkar.
   */
  it('okul adının saklanmadığını söylüyor ve şema bunu doğruluyor', () => {
    expect(ONAM_METNI).toContain('Okulun adı SEKİZ’de hiçbir yerde saklanmıyor');
    expect(ONAM_METNI).toContain('örneğin 9A');

    const sema = readFileSync(
      resolve(process.cwd(), '../supabase/migrations/0001_temel_sema.sql'),
      'utf8',
    );
    const siniflar = /create table if not exists public\.siniflar[\s\S]*?\n\);/.exec(sema)?.[0];
    expect(siniflar).toBeTruthy();
    expect(siniflar).not.toMatch(/okul/i);
  });

  it('istenmeyen kişisel verileri de sayıyor', () => {
    expect(ONAM_METNI).toContain('kimlik numarası');
    expect(ONAM_METNI).toContain('tutulmuyor');
  });

  /**
   * KAPSAM DOĞRU ANLATILIYOR MU (sürüm 3).
   *
   * Metin bir tur boyunca "matematik zümresindeki öğretmenler — dört
   * kişi" dedi ve bu YANLIŞTI: 0033'ten sonra her öğretmen yalnız KENDİ
   * sınıflarındaki öğrenciyi görüyor (`_ogretmenin_ogrencisi`), sahip ise
   * yönetim için hepsini (`_yonetici`). Veliye "dört kişi görüyor" demek,
   * ürünün yaptığından fazlasını söylemekti.
   */
  it('öğretmenin yalnız kendi sınıfını gördüğünü söylüyor', () => {
    expect(ONAM_METNI).toContain('dersine giren öğretmen');
    expect(ONAM_METNI).toContain('yalnız kendi sınıflarındaki öğrencileri');
    expect(ONAM_METNI).toContain('başka bir sınıfın öğretmeni');
  });

  it('yöneticinin tamamını gördüğünü saklamıyor', () => {
    expect(ONAM_METNI).toContain('Platformu yöneten öğretmen');
    expect(ONAM_METNI).toContain('sistemin tamamını');
  });

  /**
   * SİLİNENLER GERÇEKTEN SİLİNDİ Mİ.
   *
   * "Kaldırdım" bir iddia; ölçülmemiş iddia kanıt değil. Bu üç kontrol
   * olmadan bir düzenleme cümleleri geri getirebilir ve kimse fark etmez.
   *
   * DİKKAT — "dört kişi" ifadesi de burada: metin bir kez yanlış
   * söylemişti, geri gelmemeli.
   */
  it('öğretmenin kaldırttığı üç şey metinde YOK', () => {
    expect(ONAM_METNI).not.toMatch(/yapay zekâ/i);
    expect(ONAM_METNI).not.toMatch(/cevap anahtarı/i);
    expect(ONAM_METNI).not.toMatch(/ödeme kaydı/i);
    expect(ONAM_METNI).not.toMatch(/ders planı/i);
  });

  it('yanlış olan "dört kişi" ifadesi geri gelmemiş', () => {
    expect(ONAM_METNI).not.toMatch(/dört kişi/i);
    expect(ONAM_METNI).not.toMatch(/zümre/i);
  });

  /**
   * FOTOĞRAF CÜMLESİ YANILTMIYOR MU (sürüm 4).
   *
   * Metin bir tur boyunca "60 saniye geçerli tek kullanımlık bir
   * bağlantıyla açılıyor" diyordu. Öğretmen bunu okuyup sordu: "yani
   * öğretmen ödev kâğıdına sadece altmış saniye mi bakabilecek?"
   *
   * Cevap hayır — o süre BAĞLANTININ ÖMRÜ. Ama ürünün sahibi yanıldıysa
   * veli de yanılır. Bu yüzden metin artık ne olduğunu ve ne OLMADIĞINI
   * birlikte söylüyor; rakam da çıkarıldı, çünkü veliye bir şey
   * anlatmıyor, yalnız yanlış anlaşılıyordu.
   */
  it('fotoğraf bağlantısının bakma süresi olmadığını söylüyor', () => {
    expect(ONAM_METNI).toContain('ne kadar bakabildiğiyle ilgisi yok');
    expect(ONAM_METNI).toContain('dilediği kadar açabiliyor');
    expect(ONAM_METNI).toContain('başkasının eline geçerse çalışmasın');
  });

  it('yanıltan "60 saniye" rakamı metinde YOK', () => {
    expect(ONAM_METNI).not.toMatch(/60\s*saniye/i);
    expect(ONAM_METNI).not.toMatch(/altmış saniye/i);
  });

  it('kodun bir şifre olduğunu söylüyor', () => {
    expect(ONAM_METNI).toContain('kod bir şifredir');
  });
});

describe('metnin yapısı', () => {
  it('beş bölüm var ve hiçbiri boş değil', () => {
    expect(ONAM_BOLUMLERI).toHaveLength(5);
    for (const b of ONAM_BOLUMLERI) {
      expect(b.baslik.trim()).not.toBe('');
      expect(b.maddeler.length).toBeGreaterThan(0);
      for (const m of b.maddeler) expect(m.trim()).not.toBe('');
    }
  });

  it('düz metin bölümlerden türetiliyor', () => {
    expect(ONAM_METNI).toContain(ONAM_GIRIS);
    for (const b of ONAM_BOLUMLERI) {
      expect(ONAM_METNI).toContain(b.baslik);
      for (const m of b.maddeler) expect(ONAM_METNI).toContain(m);
    }
  });

  // Düğmenin üstündeki özet de hash kilidinin İÇİNDE olmalı: dışarıda
  // kalsaydı velinin "neye basıyorum" cümlesi sessizce değiştirilebilirdi.
  it('düğme üstündeki özet de kilitli metnin parçası', () => {
    expect(ONAM_METNI).toContain(ONAM_OZET);
  });

  it('metinde ham markdown işareti kalmamış', () => {
    // `**kalın**` yazsaydım ekranda yıldızlar görünürdü; metin düz metin
    // olarak çiziliyor.
    expect(ONAM_METNI).not.toContain('**');
  });
});
