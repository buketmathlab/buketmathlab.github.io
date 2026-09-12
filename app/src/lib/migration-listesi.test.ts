/**
 * DEFTERİN İKİ SÖZLEŞMESİ
 *
 * Bu turun konusu "elle tutulan kayıt kayar". Defterin kendisi de bir
 * kayıt — o da kayabilir. Buradaki iki test tam olarak bunu engelliyor.
 *
 * 1. Depo listesi dizinle birebir mi (üretmeyi unutan yakalanır).
 * 2. 0041 ve sonrasındaki her migration KENDİ ADINI deftere yazıyor mu.
 *
 * İkincisi asıl olan: unutulursa defter sessizce eksik kalır ve ekran
 * "veritabanınız güncel" der — yani defter, tam da işe yarayacağı anda
 * yalan söyler. Bir kaydın en tehlikeli hâli yok olması değil, yanlış
 * olmasıdır.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MIGRATION_LISTESI } from './migration-listesi';
// Test ÜRETİCİYİ ÇAĞIRIYOR. Listeyi burada yeniden türetseydik,
// üreticinin kendi kusurlarını ölçemezdik.
import { migrationlariOku as oku, dosyaMetni as uret } from '../../scripts/migration-listesi.mjs';

const MIGRATION_DIZINI = resolve(process.cwd(), '../supabase/migrations');

/** Defter 0041'de kuruldu; kendini kaydetme kuralı oradan itibaren geçerli. */
const DEFTER_BASLANGICI = '0041';

describe('migration listesi', () => {
  it('üretilmiş dosya, dizinin bugünkü hâliyle birebir', () => {
    const dizinden = oku(MIGRATION_DIZINI);

    // Hata mesajı ne yapılacağını söylesin: kırmızı bir test, çözümü de
    // göstermezse insanı oyalar.
    expect(
      MIGRATION_LISTESI.map((m) => m.dosya),
      'migration-listesi.ts geride kalmış — `npm run migration-listesi` çalıştırın',
    ).toEqual(dizinden.map((m) => m.dosya));

    expect(MIGRATION_LISTESI.map((m) => m.no)).toEqual(dizinden.map((m) => m.no));
  });

  it('üretici, dosyanın kendisini birebir yeniden üretiyor', () => {
    // Üretilmiş dosya elle "düzeltilmiş" olabilir; o zaman yukarıdaki
    // liste testi geçse bile dosyanın geri kalanı üreticiden ayrışır.
    const diskte = readFileSync(resolve(process.cwd(), 'src/lib/migration-listesi.ts'), 'utf8');
    expect(diskte).toBe(uret(oku(MIGRATION_DIZINI)));
  });

  it('numaralar benzersiz ve boşluksuz artıyor', () => {
    // İki dosya aynı numarayı taşısaydı defterde biri ötekini gizlerdi.
    const numaralar = MIGRATION_LISTESI.map((m) => Number(m.no));
    expect(new Set(numaralar).size).toBe(numaralar.length);
    numaralar.forEach((n, i) => expect(n).toBe(i + 1));
  });
});

describe('defter sözleşmesi', () => {
  // DİZİNDEN okunuyor, üretilmiş listeden DEĞİL. Üretilmiş listeden
  // okusaydı, yeni eklenmiş bir migration liste tazelenene kadar hiç
  // denetlenmezdi — yani kuralın en çok gerektiği an, yeni dosyanın
  // yazıldığı an, kapsam dışında kalırdı. (Ölçüldü: sahte bir 0042
  // eklendiğinde bu test sessiz kalıyordu.)
  const defterliler = oku(MIGRATION_DIZINI).filter(
    (m) => m.no >= DEFTER_BASLANGICI,
  );

  it('kuralın uygulandığı en az bir migration var', () => {
    // Bu olmadan aşağıdaki test boş bir dizide dönüp bedavaya yeşil kalırdı.
    expect(defterliler.length).toBeGreaterThan(0);
  });

  for (const { no, dosya } of defterliler) {
    it(`${no} kendi adını deftere yazıyor`, () => {
      const metin = readFileSync(resolve(MIGRATION_DIZINI, dosya), 'utf8');
      expect(
        metin,
        `${dosya} deftere kendini kaydetmiyor — sonuna ` +
          `\`select public._migration_kaydet('${no}');\` ekleyin`,
      ).toMatch(new RegExp(`_migration_kaydet\\(\\s*'${no}'\\s*\\)`));
    });
  }

  it('defterden önceki migrationlar kuralı taşımıyor', () => {
    // Kural 0041'de doğdu; 0040 ve öncesine geriye dönük kayıt satırı
    // eklemek, çalışmadıkları hâlde çalışmış gibi görünmelerine yol açardı.
    const oncekiler = MIGRATION_LISTESI.filter((m) => m.no < DEFTER_BASLANGICI);
    for (const m of oncekiler) {
      const metin = readFileSync(resolve(MIGRATION_DIZINI, m.dosya), 'utf8');
      expect(metin, `${m.dosya} deftere yazıyor — oysa defterden önce`).not.toMatch(
        /_migration_kaydet\(/,
      );
    }
  });
});
