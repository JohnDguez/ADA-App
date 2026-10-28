import { useTranslation } from 'react-i18next'
import { MessageCircle, ExternalLink } from 'lucide-react'
import styles from './FeedbackPromptModal.module.css'
import dkp from './PaymentDesk.module.css'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { usePresence } from '../lib/usePresence'
import { useScrollLock } from '../lib/scrollLock'

// Popup que invita a los probadores alpha a dejar feedback (Jotform). Ya no
// promete Premium gratis (v0.9.868). En escritorio (≥1100px) usa el diálogo
// centrado de PaymentDesk; en móvil/tablet, la hoja inferior. Se dispara desde App.jsx: primera
// vez a los 8 días de creada la cuenta, y de nuevo cada 3 días si el
// usuario elige "Recordarme en 3 días" (ver lib/feedback.js). Deja de
// aparecer para siempre en cuanto el usuario da clic en "Dejar mi
// feedback" (profiles.feedback_submitted).
//
// Tocar el fondo (overlay) cuenta como "Recordarme en 3 días", no como un
// cierre silencioso — así nunca queda sin re-agendar el siguiente intento.
export function FeedbackPromptModal({ open, onGiveFeedback, onRemindLater }) {
  const { t } = useTranslation()
  const { render, closing } = usePresence(open)
  const isDesktop = useIsDesktop()
  useScrollLock(open)
  if (!render) return null

  return (
    <div onClick={onRemindLater} className={isDesktop ? `${dkp.overlay} ${styles.dOverlay}` : styles.overlay} data-presence="overlay" data-closing={closing ? '' : undefined}>
      <div onClick={e => e.stopPropagation()} className={isDesktop ? `${dkp.dialog} ${styles.dDialog}` : styles.panel} role={isDesktop ? 'dialog' : undefined} aria-modal={isDesktop ? 'true' : undefined} data-presence="panel" data-closing={closing ? '' : undefined}>
        {!isDesktop && <div className={styles.handle} />}

        <div className={styles.iconCircle}>
          <MessageCircle size={22} color="var(--accent)" strokeWidth={2} />
        </div>

        <div className={styles.title}>{t('feedbackPromptModal.title')}</div>
        <div className={styles.subtitle}>{t('feedbackPromptModal.subtitle')}</div>

        <button onClick={onGiveFeedback} className={styles.ctaButton}>
          <ExternalLink size={16} />
          {t('feedbackPromptModal.cta')}
        </button>
        <div className={styles.hint}>{t('feedbackPromptModal.hint')}</div>

        <button onClick={onRemindLater} className={styles.remindButton}>
          {t('feedbackPromptModal.remindLater')}
        </button>
      </div>
    </div>
  )
}
