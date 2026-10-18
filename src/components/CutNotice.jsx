import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CreditCard, X } from 'lucide-react'
import { getBank } from '../lib/cardCatalog'
import { cutWhen, dueDateLong, dayMonthShort } from '../lib/cutLabels'
import styles from './CutNotice.module.css'

// Aviso de Inicio (v0.9.738, mockups confirmados con Johnatan): recuerda que
// una o más tarjetas de crédito hacen corte dentro del periodo de cobro del
// usuario. Sin montos. Una sola línea de título y una de apoyo; toda la
// tarjeta navega a Tarjetas. Se puede cerrar: se recuerda por periodo
// (`periodKey`) en localStorage, así vuelve a salir en el siguiente.
// Máximo de tarjetas con línea propia (v0.9.740); el resto se resume en "y N más".
const MAX_LINES = 3
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

  // Una sola tarjeta: se aclara cuándo vence el pago, porque cae en el periodo
  // siguiente y sin esto el aviso y el pago parecen no tener relación. Con
  // varias, una línea por tarjeta con su corte y su vencimiento (v0.9.740).
  const subtitle = cuts.length === 1 && first.dueDate
    ? t('cutNotice.dueOn', { date: dueDateLong(first.dueDate) })
    : cuts.length === 1 ? t('cutNotice.subtitle') : null
  const lines = cuts.length > 1 ? cuts.slice(0, MAX_LINES).map(c => {
    const b = getBank(c.card.bank)
    const name = c.card.alias || (b.id === 'otro' ? t('cards.otherBank') : b.name)
    const cut = c.daysLeft <= 0 ? t('cutNotice.lineCutToday') : t('cutNotice.lineCutDate', { date: dayMonthShort(c.cutDate) })
    const text = c.dueDate ? `${cut} · ${t('cutNotice.linePay', { date: dayMonthShort(c.dueDate) })}` : cut
    return { id: c.card.id, name, text }
  }) : []
  const extra = cuts.length - lines.length

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
          {subtitle && <div className={styles.sub}>{subtitle}</div>}
          {lines.length > 0 && (
            <div className={styles.lines}>
              {lines.map(l => (
                <div key={l.id} className={styles.line}>
                  <span className={styles.lineName}>{l.name}</span>
                  <span className={styles.lineText}>{l.text}</span>
                </div>
              ))}
              {extra > 0 && <div className={styles.lineMore}>{t('cutNotice.more', { count: extra })}</div>}
            </div>
          )}
        </div>
      </div>
      <button type="button" className={styles.close} onClick={close} aria-label={t('cutNotice.close')}>
        <X size={16} color="var(--muted)" />
      </button>
    </div>
  )
}
