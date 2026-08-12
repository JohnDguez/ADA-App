// ── ErrorBoundary ────────────────────────────────────────────────────────────
// Red de seguridad para toda la app: si CUALQUIER componente truena durante
// el render, React desmonta el árbol completo por default — sin esto, eso se
// ve como pantalla en blanco total, sin ningún mensaje para el usuario ni
// forma de recuperarse sin cerrar y reabrir la app manualmente.
//
// Tiene que ser un componente de CLASE — componentDidCatch/getDerivedStateFromError
// no existen como Hook todavía, es la única forma de atrapar errores de render
// en React 18. Por ser de clase, no puede usar el hook useTranslation() — usa
// el singleton i18n.t() directo (mismo patrón que lib/patchNotes.js y
// lib/coachmarkSteps.js para texto fuera de un componente de función). i18n ya
// está inicializado con el idioma correcto antes de este punto (se importa en
// main.jsx antes de renderizar), así que ya refleja la preferencia guardada
// (profiles.language) o el idioma del sistema si es 'system'.
//
// No reintenta solo ni oculta el error: muestra una pantalla clara y da un
// botón para recargar. No manda el error a ningún servicio externo (la app no
// tiene uno configurado hoy) — el detalle técnico completo sí se deja en
// consola (console.error) para que Johnatan pueda revisarlo con DevTools si
// hace falta reportar el bug.
//
// EXCEPCIÓN (NUEVO): errores de "chunk" desincronizado. Con code-splitting
// (React.lazy, Regla 32) cada pantalla lazy es un archivo con hash propio.
// Si el navegador tenía una pestaña abierta (ej. en segundo plano en una
// tablet) y mientras tanto se subió un deploy nuevo, ese `import()` dinámico
// apunta a un archivo que Vercel ya no sirve con ese hash — la promesa
// rechaza y React lo trata como error de render, cayendo aquí. Este caso NO
// es un bug de la app: recargar la página (que trae el index.html/hashes
// actuales) lo resuelve solo, sin que el usuario tenga que darle "Recargar"
// a mano. `SESSION_FLAG` evita loop infinito si el reload no arregla nada
// (ej. sin internet) — solo se reintenta automático UNA vez por sesión de
// pestaña; si vuelve a pasar, se muestra la pantalla normal con el botón.
// La bandera se limpia en App.jsx al montar con éxito (ver ese archivo).
const CHUNK_ERROR_PATTERN = /fetch dynamically imported module|dynamically imported module|loading chunk|chunkloaderror/i
const SESSION_FLAG = 'lunapay-chunk-reload-attempted'

function isChunkLoadError(error) {
  const msg = (error && (error.message || error.toString())) || ''
  return CHUNK_ERROR_PATTERN.test(msg) || error?.name === 'ChunkLoadError'
}

import { Component } from 'react'
import { RefreshCw } from 'lucide-react'
import i18n from '../i18n'
import styles from './ErrorBoundary.module.css'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary atrapó un error de render:', error, info)

    if (isChunkLoadError(error) && !sessionStorage.getItem(SESSION_FLAG)) {
      sessionStorage.setItem(SESSION_FLAG, '1')
      window.location.reload()
    }
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className={styles.root}>
        <div className={styles.card}>
          <h1 className={styles.title}>{i18n.t('errorBoundary.title')}</h1>
          <p className={styles.message}>{i18n.t('errorBoundary.message')}</p>
          <button className={styles.reloadButton} onClick={this.handleReload}>
            <RefreshCw size={18} strokeWidth={2} />
            {i18n.t('errorBoundary.reload')}
          </button>
        </div>
      </div>
    )
  }
}
