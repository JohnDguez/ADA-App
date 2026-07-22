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
          Obtén 3 meses de Premium gratis
        </div>

        <div className={styles.title}>Cuéntanos cómo te ha ido con la app</div>
        <div className={styles.subtitle}>Tus comentarios son importantes para nosotros.</div>

        <button onClick={onGiveFeedback} className={styles.ctaButton}>
          <ExternalLink size={16} />
          Dejar mi feedback
        </button>
        <div className={styles.hint}>Se abrirá un formulario externo en una pestaña nueva.</div>

        <button onClick={onRemindLater} className={styles.remindButton}>
          Recordarme en 3 días
        </button>
      </div>
    </div>
  )
}
