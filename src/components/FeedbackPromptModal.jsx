import { useTranslation } from 'react-i18next'
import { MessageCircle, ExternalLink } from 'lucide-react'
import { Modal } from './Modal'
import mk from './Modal.module.css'

// Popup que invita a los probadores alpha a dejar feedback (Jotform). Se
// dispara desde App.jsx: primera vez a los 8 días de creada la cuenta, y de
// nuevo cada 3 días si el usuario elige "Recordarme en 3 días" (ver
// lib/feedback.js). Deja de aparecer para siempre en cuanto da clic en
// "Dejar mi feedback" (profiles.feedback_submitted).
// Diseño nuevo (v0.9.984): <Modal layout="confirm">. Cerrar (✕, fondo o
// atrás) cuenta como "Recordarme en 3 días", así nunca queda sin re-agendar.
export function FeedbackPromptModal({ open, onGiveFeedback, onRemindLater }) {
  const { t } = useTranslation()
  return (
    <Modal open={open} onClose={onRemindLater} layout="confirm" icon={MessageCircle} width={440}
      title={t('feedbackPromptModal.title')} desc={t('feedbackPromptModal.subtitle')}
      actions={[
        { label: t('feedbackPromptModal.cta'), onClick: onGiveFeedback, icon: <ExternalLink size={16} /> },
        { label: t('feedbackPromptModal.remindLater'), onClick: onRemindLater, variant: 'soft' },
      ]}>
      <div className={`${mk.note} ${mk.noteC}`}>{t('feedbackPromptModal.hint')}</div>
    </Modal>
  )
}
