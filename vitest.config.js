import { defineConfig } from 'vitest/config'

// Pruebas unitarias (v0.9.731): solo lógica pura de src/lib y api/_*.js.
// jsdom porque utils.js importa i18n, que toca localStorage/navigator.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    define: { __BUILD_SHA__: '"test"', __BUILD_DATE__: '"2026-01-01"' },
  },
})
