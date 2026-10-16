import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'

// Configuración de ESLint (v0.9.731). Objetivo: atrapar errores reales
// (variables sin definir, hooks mal usados, catch vacíos sin explicación),
// no imponer estilo. Los avisos de `no-unused-vars` se dejan en "warn" para
// no bloquear el CI por código existente; `no-undef` y los errores de hooks
// sí son error.
export default [
  { ignores: ['dist/**', 'android/**', 'node_modules/**', 'api/node_modules/**', ] },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, __BUILD_SHA__: 'readonly', __BUILD_DATE__: 'readonly' },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true, caughtErrors: 'none', varsIgnorePattern: '^[A-Z_]' }],
      // Un catch vacío exige un comentario que diga por qué se ignora el error.
      'no-empty': ['error', { allowEmptyCatch: false }],
    },
  },
  {
    files: ['api/**/*.js', 'eslint.config.js', 'vite.config.js', 'capacitor.config.ts'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: { 'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }] },
  },
  {
    files: ['eslint.config.js', 'vite.config.js', 'src/**/*.test.js', 'tests/**/*.js'],
    languageOptions: { sourceType: 'module', globals: { ...globals.node } },
  },
  {
    files: ['public/sw.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.serviceworker } },
  },
]
