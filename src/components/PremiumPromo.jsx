import { Crown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import styles from './PremiumPromo.module.css'

/**
 * Anuncio de Premium para usuarios gratuitos (v0.9.814, tablet/escritorio).
 * variant="side"  → tarjeta oscura en la barra lateral de escritorio
 *                   (DeskSidebar.jsx, v0.9.819).
 * variant="strip" → franja entre el selector de espacio y las pestañas en
 *                   tablet (el CSS la oculta fuera de 768–1099px).
 * Colores: tokens del hero de Premium (fijos en ambos temas).
 */
export function PremiumPromo({ variant = 'side', onOpen }) {
  const { t } = useTranslation()
  return (
    <div className={`${styles.root} ${variant === 'strip' ? styles.strip : styles.side}`}>
      {variant === 'strip' && <div className={styles.crown}><Crown size={18} strokeWidth={2} color="var(--premium-hero-ink)" /></div>}
      <div className={styles.text}>
        <div className={styles.title}>{t(variant === 'strip' ? 'premiumPromo.stripTitle' : 'premiumPromo.cardTitle')}</div>
        <div className={styles.sub}>{t(variant === 'strip' ? 'premiumPromo.stripSub' : 'premiumPromo.cardSub')}</div>
      </div>
      <button type="button" className={styles.cta} onClick={onOpen}>{t('premiumPromo.cta')}</button>
    </div>
  )
}
