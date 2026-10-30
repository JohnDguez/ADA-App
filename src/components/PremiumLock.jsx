import { useTranslation } from 'react-i18next'
import { Crown } from 'lucide-react'
import styles from './PremiumLock.module.css'
import { usePremiumCta } from '../lib/premiumOffer'

// Candado visual reutilizable para cualquier función detrás de is_premium.
// Si isPremium es true, muestra `children` normal, sin ningún cambio.
// Si es false, dibuja `children` de fondo (borroso, solo de referencia visual)
// y encima el mensaje + CTA de upgrade. El botón llama a `onUpgradeClick`
// (típicamente abre PremiumPage) — is_premium en sí se sigue activando
// manualmente en Supabase mientras no exista un flujo de cobro real.
export function PremiumLock({
  isPremium,
  label,
  icon: Icon,
  message,
  ctaText,
  finePrint,
  onUpgradeClick,
  children,
}) {
  const { t } = useTranslation()
  const premiumCta = usePremiumCta()
  if (isPremium) return children

  return (
    <div className={styles.wrapper}>
      {label && (
        <div className={styles.label}>
          {Icon && <Icon size={14} />}
          {label}
        </div>
      )}

      <div className={styles.lockContainer}>
        <div className={styles.blurredContent}>
          {children}
        </div>

        <div className={styles.overlay}>
          <div className={styles.message}>
            {message}
          </div>

          <button
            onClick={onUpgradeClick}
            className={styles.ctaButton}
          >
            <Crown size={16} />
            {ctaText || premiumCta.cta}
          </button>

          {(finePrint || premiumCta.fine) && (
            <div className={styles.finePrint}>
              {finePrint || premiumCta.fine}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
