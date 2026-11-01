import { useTranslation } from 'react-i18next'
import { Crown, Plus, Repeat } from 'lucide-react'
import { intlLocale } from '../lib/utils'
import { formatPrice, getPremiumOffer } from '../lib/premiumOffer'
import { Modal } from './Modal'
import mk from './Modal.module.css'
import s from './PremiumThanksModal.module.css'

function formatDueDate(str) {
  if (!str) return '—'
  return new Date(str + 'T12:00:00').toLocaleDateString(intlLocale(), { day: 'numeric', month: 'long', year: 'numeric' })
}

// Agradecimiento al terminar de suscribirse (Modal único con ficha dorada).
// Ofrece registrar la suscripción como un pago recurrente ya rellenado y,
// desde v0.9.989, muestra ese pago (nombre, categoría, monto y primer cobro)
// para que se entienda qué se agrega.
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
          <div className={`${mk.pan} ${s.preview}`}>
            <div className={mk.lab}>{t('premiumThanks.previewTitle')}</div>
            <div className={s.item}>
              <span className={s.icon}><Repeat size={20} /></span>
              <div className={s.name}>
                <b>LunaPay Premium</b>
                <span>{t('premiumThanks.category')} · {t(info.plan === 'annual' ? 'premiumThanks.repeatsAnnual' : 'premiumThanks.repeatsMonthly')}</span>
              </div>
              <span className={s.amount}>{formatPrice(info.amount, getPremiumOffer().currency)}</span>
            </div>
            <div className={s.kv}>
              <span>{t(info.trial ? 'premiumThanks.firstCharge' : 'premiumThanks.nextRenewal')}</span>
              <b>{formatDueDate(info.firstDate)}</b>
            </div>
          </div>
          <div className={`${mk.note} ${mk.noteC}`}><b>{t('premiumThanks.question')}</b> {t('premiumThanks.hint')}</div>
        </>
      )}
    </Modal>
  )
}
