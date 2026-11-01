import { useTranslation } from 'react-i18next'
import { Crown, Plus } from 'lucide-react'
import { intlLocale } from '../lib/utils'
import { Modal } from './Modal'
import mk from './Modal.module.css'

function formatDueDate(str) {
  if (!str) return '—'
  return new Date(str + 'T12:00:00').toLocaleDateString(intlLocale(), { day: 'numeric', month: 'long', year: 'numeric' })
}

// Agradecimiento al terminar de suscribirse (diseño nuevo v0.9.984, Modal
// único con ficha dorada). Ofrece registrar la suscripción como un pago
// recurrente ya rellenado.
// info = { plan: 'monthly'|'annual', amount, firstDate: 'YYYY-MM-DD', trial }
export function PremiumThanksModal({ info, onClose, onAddPayment }) {
  const { t } = useTranslation()
  return (
    <Modal open={!!info} onClose={onClose} layout="confirm" icon={Crown} tone="gold" width={460}
      title={t('premiumThanks.title')} desc={t('premiumThanks.subtitle')}
      actions={[
        { label: t('premiumThanks.addPayment'), onClick: onAddPayment, variant: 'gold', icon: <Plus size={16} /> },
        { label: t('premiumThanks.later'), onClick: onClose, variant: 'soft' },
      ]}>
      {info && (
        <>
          <div className={mk.pan}>
            <div className={mk.kv}><span>{t('premiumThanks.planLine', { plan: t(`premiumPage.${info.plan}`) })}</span></div>
            <div className={mk.note}>{info.trial ? t('premiumThanks.trialLine', { date: formatDueDate(info.firstDate) }) : t('premiumThanks.activeLine', { date: formatDueDate(info.firstDate) })}</div>
          </div>
          <div className={`${mk.note} ${mk.noteC}`}><b>{t('premiumThanks.question')}</b> {t('premiumThanks.hint')}</div>
        </>
      )}
    </Modal>
  )
}
