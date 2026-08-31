import { describe, expect, it } from 'vitest';
import { BANT_NOKTALARI, bantAraligi, puanMesaji, varsayilanCumle } from './ewalu-puan';

/**
 * Aralık sınırı hatası SESSİZDİR: kod çalışır, test geçer, öğrenci yanlış
 * cümleyi görür. Bu yüzden sınırlar tek tek ölçülüyor.
 */
describe('puanMesaji', () => {
  it('her bandın sınırlarında doğru cümleyi veriyor', () => {
    // 100 tek başına bir bant
    expect(puanMesaji(100).cumle).toContain('tam puanla');

    // 85–99
    expect(puanMesaji(99).cumle).toContain('Çok iyi gidiyorsun');
    expect(puanMesaji(85).cumle).toContain('Çok iyi gidiyorsun');

    // 70–84
    expect(puanMesaji(84).cumle).toContain('İyi bir sonuç aldın');
    expect(puanMesaji(70).cumle).toContain('İyi bir sonuç aldın');

    // 50–69
    expect(puanMesaji(69).cumle).toContain('henüz tam oturmamış');
    expect(puanMesaji(50).cumle).toContain('henüz tam oturmamış');

    // 0–49
    expect(puanMesaji(49).cumle).toContain('Bu ödev seni zorlamış');
    expect(puanMesaji(0).cumle).toContain('Bu ödev seni zorlamış');
  });

  it('sınırın bir altı bir sonraki banda düşüyor', () => {
    // Kaymayı yakalayan asıl kontrol: 100→85, 85→84, 70→69, 50→49
    expect(puanMesaji(100).cumle).not.toEqual(puanMesaji(99).cumle);
    expect(puanMesaji(85).cumle).not.toEqual(puanMesaji(84).cumle);
    expect(puanMesaji(70).cumle).not.toEqual(puanMesaji(69).cumle);
    expect(puanMesaji(50).cumle).not.toEqual(puanMesaji(49).cumle);
  });

  it('85 ALTINDA kutlama pozu HİÇ çıkmıyor', () => {
    // Düzeltmenin asıl konusu bu: 20 alan öğrenciyi kutlayan ayı olmayacak.
    for (let p = 0; p < 85; p++) {
      expect(puanMesaji(p).poz).toBe('calisma');
    }
    for (let p = 85; p <= 100; p++) {
      expect(puanMesaji(p).poz).toBe('kutlama');
    }
  });

  it('beş bandın beşi de birbirinden farklı cümle veriyor', () => {
    const cumleler = [100, 90, 75, 60, 30].map((p) => puanMesaji(p).cumle);
    expect(new Set(cumleler).size).toBe(5);
  });

  it('her cümle bir sonraki adımı söylüyor', () => {
    // Yorum tek başına bir şey yaptırmaz; beş bandın beşi de eylem içeriyor.
    //
    // LİSTE GENİŞLEDİ, ÖLÇÜM GEVŞEMEDİ. Öğretmenin dil düzeltmesiyle üç
    // bant yeniden yazıldı ve iki yeni fiil geldi: "yeniden çöz" ve
    // "gözden geçir". Testin sorduğu şey aynı — "bu cümle öğrenciye bir
    // sonraki adımı söylüyor mu"; yalnız o adımın söylenebileceği fiiller
    // arttı. Eylemsiz bir cümle yazılırsa test yine kırılır.
    const eylem = /çalış|bak|incele|fark et|belirle|bul|çöz|gözden geçir/i;
    for (const p of [90, 75, 60, 30]) {
      expect(puanMesaji(p).cumle).toMatch(eylem);
    }
  });

  it('aralık dışı ve bozuk değerlerde çökmüyor', () => {
    expect(puanMesaji(-5).poz).toBe('calisma');
    expect(puanMesaji(120).poz).toBe('kutlama');
    expect(puanMesaji(Number.NaN).cumle).toContain('Bu ödev seni zorlamış');
    expect(puanMesaji(84.6).cumle).toContain('Çok iyi gidiyorsun'); // 85'e yuvarlanır
  });
});

/**
 * 0032 — öğretmenin yazdığı cümleler.
 *
 * Turun sözleşmesi: bugünkü beş cümle VARSAYILAN olarak kalır, öğretmen
 * yalnız değiştirdiği bandı ezer, istediği an geri döner. Aşağıdaki
 * ölçümler o sözleşmenin kod karşılığı.
 */
describe('puanMesaji — öğretmenin yazdığı cümleler', () => {
  it('ozel verilmezse bugünkü cümleler AYNEN çıkıyor', () => {
    // Turun en önemli güvencesi: ekrana hiç girilmezse hiçbir şey değişmez.
    for (const p of [100, 90, 75, 60, 30]) {
      expect(puanMesaji(p, undefined).cumle).toBe(puanMesaji(p).cumle);
      expect(puanMesaji(p, null).cumle).toBe(puanMesaji(p).cumle);
      expect(puanMesaji(p, {}).cumle).toBe(puanMesaji(p).cumle);
    }
  });

  it('yazılan cümle YALNIZ kendi bandını eziyor', () => {
    const ozel = { 50: 'Öğretmenin yazdığı cümle.' };
    expect(puanMesaji(60, ozel).cumle).toBe('Öğretmenin yazdığı cümle.');
    expect(puanMesaji(50, ozel).cumle).toBe('Öğretmenin yazdığı cümle.');
    // Komşu bantlar varsayılanda kalmalı — bir bandı değiştirmek
    // diğerlerini sessizce değiştirmemeli.
    expect(puanMesaji(49, ozel).cumle).toContain('Bu ödev seni zorlamış');
    expect(puanMesaji(70, ozel).cumle).toContain('İyi bir sonuç aldın');
  });

  it('ÖZEL CÜMLE POZU EZMİYOR — kutlama yalnız 85 ve üstü', () => {
    // Öğretmenin kendi kuralı. Ayar ekranı cümleyi açıyor, pozu değil:
    // 20 alan öğrenciye kutlayan ayı, cümle ne olursa olsun alay olurdu.
    const ozel = { 0: 'Harika iş!', 50: 'Süper!', 100: 'Yine iyi çalış.' };
    expect(puanMesaji(10, ozel).poz).toBe('calisma');
    expect(puanMesaji(60, ozel).poz).toBe('calisma');
    expect(puanMesaji(100, ozel).poz).toBe('kutlama');
  });

  it('boş ya da yalnız boşluktan oluşan cümle varsayılanı EZMİYOR', () => {
    // Sunucu bunu zaten reddediyor; buradaki savunma, bozuk bir yanıtın
    // Ewalu'yu sonuç kartında sessiz bırakmaması için.
    expect(puanMesaji(60, { 50: '' }).cumle).toContain('henüz tam oturmamış');
    expect(puanMesaji(60, { 50: '   ' }).cumle).toContain('henüz tam oturmamış');
  });

  it('tanımsız bant varsayılana düşüyor, çökmüyor', () => {
    // Sunucu yalnız beşli kümeyi döndürüyor ama istemci ona güvenmiyor.
    expect(puanMesaji(60, { 42: 'olmayan bant' }).cumle).toContain('henüz tam oturmamış');
  });

  it('varsayilanCumle her bant için kodda duran cümleyi veriyor', () => {
    // "Varsayılana dön" düğmesinin önizlemesi buradan besleniyor.
    for (const b of BANT_NOKTALARI) {
      const v = varsayilanCumle(b);
      expect(v).toBeTruthy();
      expect(puanMesaji(b).cumle).toBe(v);
    }
    expect(varsayilanCumle(42)).toBeNull();
  });

  it('bantAraligi ekranda okunur aralık veriyor', () => {
    expect(BANT_NOKTALARI).toEqual([100, 85, 70, 50, 0]);
    expect(bantAraligi(100)).toBe('100');
    expect(bantAraligi(85)).toBe('85–99');
    expect(bantAraligi(70)).toBe('70–84');
    expect(bantAraligi(50)).toBe('50–69');
    expect(bantAraligi(0)).toBe('0–49');
  });
});
