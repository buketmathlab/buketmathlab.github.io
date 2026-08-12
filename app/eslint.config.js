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
    files: [
      'scripts/erisilebilirlik-denetimi.mjs',
      'scripts/ekran-goruntuleri.mjs',
      'scripts/ekran-goruntuleri-ogrenci.mjs',
    ],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
