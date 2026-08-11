/**
 * Renk tokenlarının tek doğruluk kaynağı.
 *
 * Bu dosyadaki değerler `src/styles/index.css` içindeki `@theme` bloğuyla
 * BİREBİR aynı olmak zorundadır; `tokens.test.ts` bunu her testte doğrular.
 * Böylece CSS ile TS arasında sessiz kayma olmaz.
 */

export const RENKLER = {
  ink: '#001737',
  'ink-soft': '#1b3260',
  paper: '#fbfaf7',
  surface: '#ffffff',
  muted: '#5d6577',
  line: '#e2e6ee',
  'line-soft': '#eef1f6',
  olive: '#4f5a3e',
  amber: '#8a6318',
  success: '#256b4c',
  warning: '#8a5510',
  danger: '#a72f26',
  link: '#1a4894',
  'success-bg': '#e6f2ec',
  'warning-bg': '#fdf2dd',
  'danger-bg': '#fbeae8',
  'info-bg': '#eaeff8',
} as const;

export type RenkAdi = keyof typeof RENKLER;

/**
 * WCAG AA uyumu için doğrulanması gereken ön plan / arka plan çiftleri.
 * `min`, WCAG 2.1'in ilgili eşiği:
 *   4.5 → normal metin
 *   3.0 → büyük metin (≥18.66px kalın / ≥24px) ve arayüz bileşeni sınırları
 */
export const KONTRAST_CIFTLERI: ReadonlyArray<{
  on: RenkAdi;
  arka: RenkAdi;
  min: number;
  aciklama: string;
}> = [
  { on: 'ink', arka: 'paper', min: 4.5, aciklama: 'Ana metin / sayfa zemini' },
  { on: 'ink', arka: 'surface', min: 4.5, aciklama: 'Ana metin / kart' },
  { on: 'muted', arka: 'paper', min: 4.5, aciklama: 'İkincil metin / sayfa zemini' },
  { on: 'muted', arka: 'surface', min: 4.5, aciklama: 'İkincil metin / kart' },
  { on: 'paper', arka: 'ink', min: 4.5, aciklama: 'Birincil buton yazısı' },
  { on: 'paper', arka: 'ink-soft', min: 4.5, aciklama: 'Birincil buton hover yazısı' },
  { on: 'paper', arka: 'olive', min: 4.5, aciklama: 'İkincil buton yazısı' },
  { on: 'paper', arka: 'danger', min: 4.5, aciklama: 'Tehlike butonu yazısı' },
  { on: 'link', arka: 'paper', min: 4.5, aciklama: 'Bağlantı / sayfa zemini' },
  { on: 'link', arka: 'surface', min: 4.5, aciklama: 'Bağlantı / kart' },
  { on: 'success', arka: 'success-bg', min: 4.5, aciklama: 'Başarı etiketi' },
  { on: 'warning', arka: 'warning-bg', min: 4.5, aciklama: 'Uyarı etiketi' },
  { on: 'danger', arka: 'danger-bg', min: 4.5, aciklama: 'Hata etiketi' },
  { on: 'amber', arka: 'surface', min: 4.5, aciklama: 'Altın aksan / kart' },
  { on: 'amber', arka: 'paper', min: 4.5, aciklama: 'Altın aksan / sayfa zemini' },
  { on: 'success', arka: 'surface', min: 4.5, aciklama: 'Başarı metni / kart' },
  { on: 'danger', arka: 'surface', min: 4.5, aciklama: 'Hata metni / kart' },
  { on: 'warning', arka: 'surface', min: 4.5, aciklama: 'Uyarı metni / kart' },
  { on: 'line', arka: 'surface', min: 1.2, aciklama: 'Kenarlık görünürlüğü (bilgi amaçlı)' },
];
