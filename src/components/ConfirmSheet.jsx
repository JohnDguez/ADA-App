import { createPortal } from 'react-dom'
import { X as XIcon } from 'lucide-react'
import { usePresence } from '../lib/usePresence'
import { useScrollLock } from '../lib/scrollLock'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useTranslation } from 'react-i18next'
import styles from './ConfirmSheet.module.css'

// Pregunta corta con 2 respuestas, con el diseño NUEVO (v0.9.969, Regla 56 y
// 65). Reemplaza a ModalSheet (diseño anterior) en todo modal nuevo.
// Móvil y tablet: hoja sólida (--desk-card) con asa, título + ✕ redondo,
// texto y pie con los botones en píldora; sin "Cancelar" (cierran la ✕ y el
// fondo). Escritorio: el mismo contenido como diálogo centrado sólido.
// Siempre en un portal sobre el body (z 550), para quedar encima de la barra
// de navegación sin importar el contenedor desde donde se abre.
// `actions`: [{ label, onClick, variant: 'primary' | 'soft' | 'danger' }].
export function ConfirmSheet({ open, title, children, actions = [], onClose }) {
  const { t } = useTranslation()
  const isDesk = useIsDesktop()
  const { render, closing } = usePresence(open)
  useScrollLock(open)
  if (!render) return null
  const cls = { primary: styles.primary, soft: styles.soft, danger: styles.danger }
  return createPortal(
    <div className={`${styles.overlay} ${isDesk ? styles.desk : ''}`} data-presence="overlay" data-closing={closing ? '' : undefined}
      onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={title} data-presence="panel" data-closing={closing ? '' : undefined}>
        {!isDesk && <div className={styles.handle} />}
        <div className={styles.hd}>
          <h2>{title}</h2>
          <button type="button" className={styles.x} onClick={onClose} aria-label={t('buttons.close')}><XIcon size={17} /></button>
        </div>
        <div className={styles.body}>{children}</div>
        <div className={styles.ft}>
          {actions.map(a => (
            <button key={a.label} type="button" className={`${styles.btn} ${cls[a.variant || 'primary']}`} onClick={a.onClick}>{a.label}</button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
