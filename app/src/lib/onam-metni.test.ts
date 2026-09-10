import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
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
  // Yayına girecek ilk sürüm: izin cümlesi, ad-soyad-ödev-not dökümü,
  // "okul adı saklanmıyor" ve düğme üstündeki özet eklendi.
  '2026-09-2': '045b5636f4ff7d25602d471e7104f8db096758140efa872dd33a10672f433f14',
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
  const migration = readFileSync(
    resolve(process.cwd(), '../supabase/migrations/0034_veli_onami.sql'),
    'utf8',
  );

  it('migration dosyasında sürüm sabiti var', () => {
    expect(migration).toContain('_gecerli_onam_surumu');
  });

  it('migrationdaki sürüm ONAM_SURUMU ile aynı', () => {
    const m = /select\s+'([^']+)'::text;/.exec(migration);
    expect(m?.[1]).toBe(ONAM_SURUMU);
  });

  it('panele yapıştırılan kısa sürüm de aynı sürümü taşıyor', () => {
    const kisa = readFileSync(
      resolve(process.cwd(), '../supabase/panel-icin/0034_veli_onami_kisa.sql'),
      'utf8',
    );
    const m = /select\s+'([^']+)'::text;/.exec(kisa);
    expect(m?.[1]).toBe(ONAM_SURUMU);
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

  it('test puanlamasında yapay zekâ olmadığını söylüyor (Kural 5)', () => {
    expect(ONAM_METNI).toContain('yapay zekâ ile yapılmaz');
  });

  it('veliye cevap anahtarı gitmediğini söylüyor (Kural 6)', () => {
    expect(ONAM_METNI).toContain('Cevap anahtarı veliye hiçbir zaman');
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

  it('kodun bir şifre olduğunu söylüyor', () => {
    expect(ONAM_METNI).toContain('kod bir şifredir');
  });
});

describe('metnin yapısı', () => {
  it('altı bölüm var ve hiçbiri boş değil', () => {
    expect(ONAM_BOLUMLERI).toHaveLength(6);
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
