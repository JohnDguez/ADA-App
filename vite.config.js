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
  },
})
