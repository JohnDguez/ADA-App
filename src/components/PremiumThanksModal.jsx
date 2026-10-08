import { useTranslation } from 'react-i18next'
import { Crown as CrownDuotone } from '@phosphor-icons/react/dist/csr/Crown'
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle'
import { Plus } from 'lucide-react'
import { useBackClose } from '../lib/backNav'
import { intlLocale } from '../lib/utils'
import premium from '../pages/PremiumPage.module.css'
import styles from './PremiumThanksModal.module.css'

// Misma curva que el hero de PremiumPage.jsx (duplicada a propósito: es solo
// un string SVG).
const WAVE_PATH = 'M0,110 L0,20 C30,-19 60,38 95,38 C135,36 150,73 195,64 C238,58 255,101 300,80 L300,110 Z'

function formatDueDate(str) {
  if (!str) return '—'
  return new Date(str + 'T12:00:00').toLocaleDateString(intlLocale(), { day: 'numeric', month: 'long', year: 'numeric' })
}

// Pantalla de agradecimiento al terminar de suscribirse. Reusa el hero de
// PremiumPage (mismos tokens y animaciones) y ofrece registrar la
// suscripción como un pago recurrente ya rellenado.
// info = { plan: 'monthly'|'annual', amount, firstDate: 'YYYY-MM-DD', trial }
export function PremiumThanksModal({ info, onClose, onAddPayment }) {
  const { t } = useTranslation()
  useBackClose(!!info, onClose)
  if (!info) return null

  return (
    <div className={styles.screen}>
      <div className={premium.hero}>
        <div className={premium.heroGlow} aria-hidden="true" />
        <Sparkle weight="fill" size={16} className={`${premium.heroSparkle} ${premium.heroSparkle1}`} aria-hidden="true" />
        <Sparkle weight="fill" size={11} className={`${premium.heroSparkle} ${premium.heroSparkle2}`} aria-hidden="true" />
        <Sparkle weight="fill" size={9}  className={`${premium.heroSparkle} ${premium.heroSparkle3}`} aria-hidden="true" />
        <div className={premium.heroCrownWrap}>
          <CrownDuotone size={34} weight="duotone" color="var(--premium-gold-text)" />
        </div>
        <div className={premium.heroTitle}>{t('premiumThanks.title')}</div>
        <div className={premium.heroSubtitle}>{t('premiumThanks.subtitle')}</div>
        <svg className={premium.heroWave} viewBox="0 0 300 110" preserveAspectRatio="none" aria-hidden="true">
          <path d={WAVE_PATH} style={{ fill: 'var(--bg)' }} />
        </svg>
      </div>

      <div className={styles.body}>
        <div className={styles.summary}>
          <div className={styles.planName}>
            {t('premiumThanks.planLine', { plan: t(`premiumPage.${info.plan}`) })}
          </div>
          <div className={styles.planDetail}>
            {info.trial
              ? t('premiumThanks.trialLine', { date: formatDueDate(info.firstDate) })
              : t('premiumThanks.activeLine', { date: formatDueDate(info.firstDate) })}
          </div>
        </div>

        <div className={styles.question}>{t('premiumThanks.question')}</div>
        <div className={styles.questionHint}>{t('premiumThanks.hint')}</div>

        <button onClick={onAddPayment} className={styles.addButton}>
          <Plus size={16} /> {t('premiumThanks.addPayment')}
        </button>
        <button onClick={onClose} className={styles.laterButton}>{t('premiumThanks.later')}</button>
      </div>
    </div>
  )
}
