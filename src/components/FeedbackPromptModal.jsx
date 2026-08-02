import { useTranslation } from 'react-i18next'
import { MessageCircle, Crown, ExternalLink } from 'lucide-react'
import styles from './FeedbackPromptModal.module.css'

// Popup que invita a los probadores alpha a dejar feedback (Jotform) a
// cambio de 3 meses de Premium gratis. Se dispara desde App.jsx: primera
// vez a los 8 días de creada la cuenta, y de nuevo cada 3 días si el
// usuario elige "Recordarme en 3 días" (ver lib/feedback.js). Deja de
// aparecer para siempre en cuanto el usuario da clic en "Dejar mi
// feedback" (profiles.feedback_submitted).
//
// Tocar el fondo (overlay) cuenta como "Recordarme en 3 días", no como un
// cierre silencioso — así nunca queda sin re-agendar el siguiente intento.
export function FeedbackPromptModal({ open, onGiveFeedback, onRemindLater }) {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div onClick={onRemindLater} className={styles.overlay}>
      <div onClick={e => e.stopPropagation()} className={styles.panel}>
        <div className={styles.handle} />

        <div className={styles.iconCircle}>
          <MessageCircle size={22} color="var(--accent)" strokeWidth={2} />
        </div>

        <div className={styles.premiumPill}>
          <Crown size={13} fill="currentColor" />
          {t('feedbackPromptModal.premiumPill')}
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
