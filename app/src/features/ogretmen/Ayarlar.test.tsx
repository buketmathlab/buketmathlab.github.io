import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Yol cwd'ye göre: vitest jsdom ortamında `import.meta.url` dosya şeması
// vermiyor, `fileURLToPath` patlıyor. Vitest `app/` dizininden koşuyor.
const oku = (y: string) => readFileSync(`src/${y}`, 'utf8');

/**
 * YORUMLAR AYIKLANIYOR. İlk yazılışta desen dosyanın KENDİ AÇIKLAMASINI
 * yakalıyordu: yorum `autoCapitalize="characters"` diye alıntı yapıyor.
 * Aynı tuzağa geri yükleme scriptinde de düşülmüştü — bir işareti hem
 * ayraç hem anlatı olarak kullanmak.
 */
const yorumsuz = (k: string) =>
  k.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');

const KAYNAK = yorumsuz(oku('features/ogretmen/Ayarlar.tsx'));
const SERVIS = yorumsuz(oku('services/supabase.ts'));

/**
 * Bu iki kusur ÖLÇÜLEREK bulundu ve ikisi de sessizce geri gelebilir.
 * Test kaynağı okuyor, çünkü korunan şey davranıştan çok bir SATIRIN
 * varlığı/yokluğu.
 */
describe('Ayarlar — PIN alanları', () => {
  it('hiçbir alanda autoCapitalize ÖZNİTELİĞİ yok', () => {
    // Giriş kutusundaki `autoCapitalize="characters"` iPad'de harfleri
    // büyütüp öğretmenin PIN'ini bozuyordu; giriş için regresyon testi
    // yazıldı, aynı güvence burada da olmalı.
    //
    expect(KAYNAK).not.toMatch(/autoCapitalize/i);
  });

  it('üç alan da type="password"', () => {
    expect(KAYNAK.match(/type="password"/g)).toHaveLength(3);
  });

  it('eski ve yeni PIN trim’leniyor', () => {
    // Giriş ve kurulum ekranları trim'liyor. Burası trim'lemezse başta/
    // sonda boşluklu bir PIN belirlenir ve ona sonradan hiç girilemez.
    expect(KAYNAK).toMatch(/eski\.trim\(\)/);
    expect(KAYNAK).toMatch(/yeni1\.trim\(\)/);
    expect(KAYNAK).toMatch(/yeni2\.trim\(\)/);
  });

  it('yanlış PIN oturumu DÜŞÜRMÜYOR', () => {
    // Sunucu "mevcut PIN doğru değil" için de 28000 fırlatıyor ve istemci
    // o kodu normalde "oturumun bitti" diye okuyup kullanıcıyı dışarı
    // atıyor. Bayrak kalkarsa PIN'ini yanlış yazan öğretmen yine sistemden
    // atılır.
    expect(KAYNAK).toMatch(/oturumDusurmesin:\s*true/);
  });
});

describe('rpc — 28000 muafiyeti', () => {
  it('bayrak varsayılan olarak KAPALI', () => {
    // Muafiyet yalnız istendiğinde açılmalı; varsayılan açık olsaydı
    // oturumu düşen kullanıcı hiçbir ekranda giriş ekranına dönmezdi.
    expect(SERVIS).toMatch(/hata\.code === '28000' && !secenek\.oturumDusurmesin/);
  });
});
