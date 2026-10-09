import { usePresence } from '../lib/usePresence'
import { useScrollLock } from '../lib/scrollLock'
import { useTranslation } from 'react-i18next'
import styles from './ModalSheet.module.css'

// Bottom sheet estándar de LunaPay para todos los avisos y confirmaciones
// (salir, descartar, borrar, nueva versión, código de invitación, calificar…).
// Sube desde abajo, velo oscuro con blur fuerte, ondas de luz azul detrás
// (aurora, sin gradiente radial) y botones rellenos.
//
//   <ModalSheet icon={SignOut} tone="danger" title="…" onBackdrop={fn}>
//     <ModalSheet.Text>descripción</ModalSheet.Text>
//     <SheetButton variant="danger" onClick={…}>Salir</SheetButton>
//     <SheetButton variant="soft" onClick={…}>Cancelar</SheetButton>
//   </ModalSheet>
//
// tone: 'accent' (azul, por defecto) | 'danger' (rojo, acciones destructivas).
export function ModalSheet({ icon: Icon, tone = 'accent', title, onBackdrop, children, zIndex, pulse = false, open = true }) {
  const { t } = useTranslation()
  // `open` (default true): con false se anima la salida y luego se desmonta;
  // así el padre puede dejarla siempre montada y solo cambiar `open`.
  const { render, closing } = usePresence(open)
  useScrollLock(open)
  if (!render) return null
  return (
    <div className={styles.overlay} style={zIndex ? { zIndex } : undefined}
      data-presence="overlay" data-closing={closing ? '' : undefined}
      onClick={e => e.target === e.currentTarget && onBackdrop?.()}>
      <div className={styles.waves} aria-hidden="true">
        <svg viewBox="0 0 340 240" preserveAspectRatio="none">
          <defs>
            <linearGradient id="sheetWaveA" x1="0" x2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
              <stop offset=".45" stopColor="var(--accent)" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="sheetWaveB" x1="0" x2="1">
              <stop offset="0" stopColor="var(--accent)" />
              <stop offset=".6" stopColor="var(--label-variable)" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M-20 150 C 50 70,110 190,180 110 S 300 60,370 120" fill="none" stroke="url(#sheetWaveA)" strokeWidth="34" strokeLinecap="round" />
          <path d="M-20 185 C 70 130,120 215,200 150 S 310 110,370 160" fill="none" stroke="url(#sheetWaveB)" strokeWidth="22" strokeLinecap="round" opacity=".75" />
          <path d="M-20 120 C 60 40,150 120,230 60 S 320 30,370 70" fill="none" stroke="url(#sheetWaveA)" strokeWidth="14" strokeLinecap="round" opacity=".6" />
        </svg>
      </div>
      <div className={styles.sheet} data-presence="panel" data-closing={closing ? '' : undefined} role="dialog" aria-modal="true" aria-label={title || t('buttons.close', { defaultValue: '' })}>
        <div className={styles.handle} />
        {Icon && (
          <div className={`${styles.icon} ${tone === 'danger' ? styles.iconDanger : ''} ${pulse ? styles.iconPulse : ''}`}>
            <Icon size={30} weight="regular" />
          </div>
        )}
        {title && <div className={styles.title}>{title}</div>}
        {children}
      </div>
    </div>
  )
}

ModalSheet.Text = function ModalSheetText({ children }) {
  return <div className={styles.text}>{children}</div>
}

// variant: 'primary' (azul) | 'danger' (rojo) | 'soft' (relleno suave neutro).
// Todos con relleno para que ninguno parezca "texto suelto".
export function SheetButton({ variant = 'primary', children, ...rest }) {
  const cls = variant === 'danger' ? styles.btnDanger : variant === 'soft' ? styles.btnSoft : styles.btnPrimary
  return <button type="button" className={`${styles.btn} ${cls}`} {...rest}>{children}</button>
}
