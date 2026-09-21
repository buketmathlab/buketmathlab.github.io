/**
 * KURALIN NÖBETÇİSİ — bütün kaynak taranıyor.
 *
 * Öğretmenin bu turdaki kapanış cümlesi: *"Genel olarak tüm cümleler
 * öyle olmalı."* İki cümleyi düzeltmek bir turluk; kuralı ölçüye
 * bağlamak kalıcı.
 *
 * NEDEN ESLINT KURALI DEĞİL: `no-restricted-syntax` yalnız belirli AST
 * düğümlerine bakar ve JSX metin düğümünü (ekrana yazılan düz metni)
 * kapsaması için ayrı bir eklenti gerekir. Buradaki tarama dosyanın
 * HAM METNİNE bakıyor — dize, JSX metni, şablon dizesi, hepsi.
 *
 * TEST DOSYALARI DIŞARIDA ve sebebi ölçülebilir: bu dosyanın kendisi ve
 * `ogrenci-ozet-metni.test.ts` yasak kalıpları NEGATİF KONTROL olarak
 * içeriyor ("bu cümle ekranda GEÇMİYOR" diye). Onları da tarasaydık
 * nöbetçi kendi kendini kırardı.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { YASAK_KALIPLAR, yasakKaliplariBul, yorumlariAt } from './urun-dili';

const SRC = resolve(__dirname, '..');

/** Taranmayanlar: testler (negatif kontrol içerirler) ve listenin kendisi. */
function taranirMi(yol: string): boolean {
  if (/\.test\.tsx?$/.test(yol)) return false;
  if (/[/\\]urun-dili\.ts$/.test(yol)) return false;
  return /\.tsx?$/.test(yol);
}

function dosyalar(kok: string): string[] {
  return readdirSync(kok).flatMap((ad) => {
    const yol = join(kok, ad);
    if (statSync(yol).isDirectory()) return dosyalar(yol);
    return taranirMi(yol) ? [yol] : [];
  });
}

describe('ürün dili', () => {
  const hepsi = dosyalar(SRC);

  /**
   * ÖNCE TARAMANIN KENDİSİ ÖLÇÜLÜYOR.
   *
   * Sıfır dosya bulan bir tarama her zaman yeşil yanar ve hiçbir şey
   * ölçmez — bu deponun defalarca yakaladığı "ölü ölçüm". Yol yanlış
   * yazılırsa ya da uzantı süzgeci bozulursa burada kırmızı yanar.
   */
  it('tarama gerçekten dosya buluyor', () => {
    expect(hepsi.length).toBeGreaterThan(50);
    expect(hepsi.some((y) => y.endsWith('OgrenciPano.tsx'))).toBe(true);
    expect(hepsi.some((y) => y.endsWith('kod-yenileme-metni.ts'))).toBe(true);
    // Test dosyaları gerçekten dışarıda mı?
    expect(hepsi.some((y) => y.endsWith('.test.ts'))).toBe(false);
  });

  /**
   * ASIL ÖLÇÜM. Yorumlar atılıyor: kuralın GEREKÇESİNİ yazan yorum,
   * yasak kalıbı tırnak içinde anmak zorunda. Kullanıcı yorumu okumuyor.
   */
  it('hiçbir kaynak dosyada yasak kalıp yok', () => {
    const bulgular: string[] = [];

    for (const yol of hepsi) {
      const govde = yorumlariAt(readFileSync(yol, 'utf8'));
      for (const y of yasakKaliplariBul(govde)) {
        bulgular.push(`${yol.slice(SRC.length + 1)} → "${y.kalip}" (${y.neden})`);
      }
    }

    expect(bulgular).toEqual([]);
  });

  /**
   * POZİTİF KONTROL — nöbetçinin gerçekten ısırdığının kanıtı.
   *
   * Yukarıdaki ölçüm yalnız "bulgu yok" diyor; kalıp listesi boşalsa ya
   * da `yasakKaliplariBul` her zaman boş dizi döndürse O DA yeşil yanardı.
   * Burada bilerek kusurlu bir metin veriliyor.
   */
  it('yasak kalıp konulunca yakalanıyor', () => {
    const bulunan = yasakKaliplariBul('Bekleyen ödevin yok. Eline sağlık.');
    expect(bulunan).toHaveLength(1);
    expect(bulunan[0]?.kalip).toBe('eline sağlık');
  });

  /**
   * TÜRKÇE BÜYÜK HARF. JavaScript'in varsayılan `toLowerCase`'i "I"yı
   * "i" yapar; Türkçede "ı" olması gerekir. Bu depoda yaşanmış bir hata,
   * burada tek tek ölçülüyor.
   */
  it('büyük harfle yazılmış hâli de yakalanıyor', () => {
    expect(yasakKaliplariBul('ELİNE SAĞLIK')).toHaveLength(1);
    expect(yasakKaliplariBul('Aferin sana')).toHaveLength(1);
  });

  /**
   * ÇİZGİ: `Harika!` İŞİ niteliyor ve ÖĞRETMENİN kendi cümlesi
   * (`ewalu-puan.ts`, 100 puan). `Harikasın` ÇOCUĞU niteliyor.
   * Nöbetçi bu ikisini ayırmazsa öğretmenin metnini kırar.
   */
  it('işi niteleyen övgü serbest, çocuğu niteleyen yasak', () => {
    expect(
      yasakKaliplariBul('Harika! Konuyu gerçekten iyi kavramışsın.'),
    ).toHaveLength(0);
    expect(yasakKaliplariBul('Harikasın!')).toHaveLength(1);
  });

  /**
   * YORUM ATICININ KENDİSİ ÖLÇÜLÜYOR.
   *
   * Yorumları atmak taramayı GEVŞETİR; gevşemenin nerede durduğu
   * ölçülmezse nöbetçi sessizce hiçbir şey görmeyen bir şeye dönüşebilir.
   */
  it('yorum atıcı kodu ve dizeleri koruyor, yorumu atıyor', () => {
    // Yorum atılıyor — ama gövdedeki aynı cümle duruyor.
    expect(yorumlariAt('// Eline sağlık.\nconst a = "Eline sağlık.";')).toBe(
      '\nconst a = "Eline sağlık.";',
    );
    // Blok yorum da atılıyor, satır sayısı korunuyor.
    expect(yorumlariAt('/* Aferin\n   Bravo */\nx')).toBe('\n\nx');
    // Dize içindeki `//` bir yorum DEĞİL.
    expect(yorumlariAt("const u = 'https://sekizkyal.com/a'; // not")).toBe(
      "const u = 'https://sekizkyal.com/a'; ",
    );
    // JSX metni dize değil ama kod da değil — olduğu gibi kalmalı.
    expect(yorumlariAt('<p>Eline sağlık.</p>')).toBe('<p>Eline sağlık.</p>');
  });

  /**
   * GERÇEK DOSYADA GEVŞEMEDİĞİNİN KANITI.
   *
   * Yukarıdaki birim ölçümler uydurma parçalar üzerinde. Bu ölçüm
   * gerçek bir ekranın kullanıcıya görünen cümlesini, yorum atıldıktan
   * SONRA hâlâ orada buluyor — yani tarama o dosyanın gövdesini
   * gerçekten görüyor.
   */
  it('yorum atıldıktan sonra gerçek ekran metni hâlâ taranıyor', () => {
    const pano = yorumlariAt(
      readFileSync(resolve(SRC, 'features/ogrenci/OgrenciPano.tsx'), 'utf8'),
    );
    expect(pano).toContain('Yaklaşan ödev');
    expect(pano).toContain('Henüz puanlanmış ödevin yok.');
  });

  /**
   * `karne-sozu.ts`'teki liste BURAYA KOPYALANMADI ve kopyalanmamalı:
   * "ortalama" öğretmenin kendi sınıf ekranında meşru bir kelime.
   * Kopyalanırsa bu ölçüm kırmızı yanar.
   */
  it('konu karnesi listesi buraya sızmamış', () => {
    const kaliplar = YASAK_KALIPLAR.map((y) => y.kalip);
    for (const karneye_ait of ['ortalama', 'sıralama', 'sınıfın', 'yükseliyor']) {
      expect(kaliplar).not.toContain(karneye_ait);
    }
  });
});
