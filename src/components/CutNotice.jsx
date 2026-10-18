import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CreditCard, X } from 'lucide-react'
import { getBank } from '../lib/cardCatalog'
import { cutWhen } from '../lib/cutLabels'
import styles from './CutNotice.module.css'

// Aviso de Inicio (v0.9.738, mockups confirmados con Johnatan): recuerda que
// una o más tarjetas de crédito hacen corte dentro del periodo de cobro del
// usuario. Sin montos. Una sola línea de título y una de apoyo; toda la
// tarjeta navega a Tarjetas. Se puede cerrar: se recuerda por periodo
// (`periodKey`) en localStorage, así vuelve a salir en el siguiente.
const DISMISS_KEY = 'lunapay-cut-notice-dismissed'
// Duración de la salida: igual a `.leaving` en CutNotice.module.css (Regla 30).
const LEAVE_MS = 250

function readDismissed() {
  try { return localStorage.getItem(DISMISS_KEY) } catch { return null /* sin almacenamiento: el aviso se muestra */ }
}

export function CutNotice({ cuts, periodKey, onOpen }) {
  const { t } = useTranslation()
  const [dismissedKey, setDismissedKey] = useState(readDismissed)
  const [leaving, setLeaving] = useState(false)

  if (!cuts.length || dismissedKey === periodKey) return null

  const first = cuts[0]
  const bank = getBank(first.card.bank)
  const cardName = first.card.alias || (bank.id === 'otro' ? t('cards.otherBank') : bank.name)
  const title = cuts.length === 1
    ? t('cutNotice.titleOne', { name: cardName, when: cutWhen(first.cutDate, first.daysLeft, t) })
    : t('cutNotice.titleMany', { count: cuts.length })

  function close(e) {
    e.stopPropagation()
    setLeaving(true)
    // Guardado diferido (Regla 26): se persiste cuando termina la animación.
    setTimeout(() => {
      try { localStorage.setItem(DISMISS_KEY, periodKey) } catch { /* sin almacenamiento: solo se oculta en esta sesión */ }
      setDismissedKey(periodKey)
    }, LEAVE_MS)
  }

  return (
    <div className={`${styles.wrap} ${leaving ? styles.leaving : ''}`}>
      <div
        role="button"
        tabIndex={0}
        className={styles.notice}
        onClick={onOpen}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      >
        <CreditCard size={22} color="var(--warn-tone)" className={styles.icon} />
        <div className={styles.texts}>
          <div className={styles.title}>{title}</div>
          <div className={styles.sub}>{t('cutNotice.subtitle')}</div>
        </div>
      </div>
      <button type="button" className={styles.close} onClick={close} aria-label={t('cutNotice.close')}>
        <X size={16} color="var(--muted)" />
      </button>
    </div>
  )
}
