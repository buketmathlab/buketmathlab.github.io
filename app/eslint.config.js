import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', '../yeni'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    // Playwright betikleri: page.evaluate() gövdeleri Node'da değil,
    // tarayıcı içinde çalışır. Bu yüzden hem Node hem tarayıcı globalleri
    // geçerli — aksi hâlde `document` tanımsız görünüyor.
    //
    // BURASI ELLE SAYILAN BİR LİSTEYDİ VE İKİ KEZ TUZAK OLDU: 0025'te
    // `kabuk-denetimi.mjs`, Faz 9'da `tanitim-gorselleri.mjs` eklenince
    // `npm run lint` kırıldı — ikisinde de betiği yazdıktan sonra listeyi
    // güncellemeyi atlamışım. Liste artık kalıp.
    //
    // BİLİNÇLİ TAVİZ: `scripts/` altındaki saf Node betikleri de (varlık
    // hattı, PDF denetimi) tarayıcı globallerini almış oluyor; onlarda
    // yanlışlıkla yazılmış bir `document` artık yakalanmaz. Buna karşılık
    // tekrar eden ve yayına kadar giden bir kırılma kapanıyor — takas
    // bilerek bu yönde yapıldı.
    files: ['scripts/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
