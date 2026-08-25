import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Genera archivos .js.map junto al build minificado — el navegador los
    // usa para traducir un error minificado (ej. "Cannot access 'P' before
    // initialization" o "Minified React error #310") de vuelta al nombre
    // real del archivo/función/variable, sin tener que correr la app en
    // local ni afectar la velocidad de carga para los usuarios (los
    // navegadores solo piden el .map cuando alguien abre las DevTools).
    sourcemap: true,
    rollupOptions: {
      output: {
        // Separa las dependencias NÚCLEO (react, supabase, i18n, lucide,
        // stripe) en su propio chunk "vendor": casi nunca cambian entre
        // deploys, así el navegador las conserva en caché aunque el código
        // de la app sí cambie. Es una LISTA BLANCA explícita, no "cualquier
        // node_modules" — jspdf/jspdf-autotable (~800KB, usadas solo por el
        // reporte PDF de "Exportar datos") y TODAS sus dependencias
        // transitivas (canvg, dompurify, etc., cada una en su propia
        // carpeta de node_modules) quedan fuera a propósito: con "cualquier
        // node_modules → vendor" (como era antes) esas dependencias
        // transitivas se colaban igual en el chunk eager aunque jspdf en sí
        // se excluyera por nombre. Al no asignarlas aquí, Rollup las agrupa
        // según el grafo real de imports — como solo se alcanzan vía
        // import() dinámico (lib/exportPdf.js), terminan en su propio chunk
        // async, descargado solo cuando alguien de verdad genera un PDF.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          const core = ['node_modules/react/', 'node_modules/react-dom', 'node_modules/react-i18next', 'node_modules/i18next', 'node_modules/lucide-react', 'node_modules/@supabase', 'node_modules/@stripe']
          if (core.some(lib => id.includes(lib))) return 'vendor'
          return undefined
        },
      },
    },
  },
})
