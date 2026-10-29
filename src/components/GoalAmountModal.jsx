import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import AmountInput from './AmountInput'
import { PaymentMethodField } from './PaymentMethodField'
import { AnchoredPop, useAnchor } from './AnchoredPop'
import { usePresence } from '../lib/usePresence'
import { useScrollLock } from '../lib/scrollLock'
import { useIsMobile } from '../hooks/useIsMobile'
import { getIconComponent } from '../lib/categoryIcons'
import { catInk } from '../lib/colorUtils'
import { fmt } from '../lib/utils'
import styles from './GoalAmountModal.module.css'

// Aportar / Retirar de una meta (mockups «Aportar/Retirar · Tablet y Móvil»).
// Tablet y escritorio: popover anclado al botón que lo abrió (Aportar o Retirar).
// Móvil, o sin ancla: hoja desde abajo. El estado (monto, método, guardado) vive
// en GoalDetailPanel; aquí solo se dibuja.
export function GoalAmountModal({ open, kind, goal, amount, setAmount, methodId, setMethodId, paymentMethods, onAddCard, saving, canConfirm, onConfirm, onClose }) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const anchorRef = useAnchor(open)
  const asPop = !isMobile && !!anchorRef.current
  // Se conserva el último tipo para que el contenido no cambie durante la animación de salida.
  const lastKind = useRef(kind)
  if (kind) lastKind.current = kind
  const k = kind || lastKind.current
  const withdraw = k === 'retirar'
  const sheet = usePresence(!!open && !asPop)
  useScrollLock(!!open && !asPop)
  if (!goal) return null

  const Icon = getIconComponent(goal.icon)
  const title = withdraw ? t('goalDetailPanel.withdrawTitle') : t('goalDetailPanel.contributeTitle')
  const hint = withdraw
    ? t('goalDetailPanel.availableHint', { amount: fmt(goal.currentAmount) })
    : t('goalDetailPanel.remainingHint', { amount: fmt(goal.remaining) })

  const head = (
    <div className={styles.head}>
      <i className={styles.icon} style={{ background: goal.color, color: catInk(goal.color) }}>{Icon && <Icon size={20} />}</i>
      <div className={styles.headText}>
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.sub}>{goal.name} · {fmt(goal.currentAmount)} / {fmt(goal.target_amount)}</div>
      </div>
      {!asPop && <button type="button" className={styles.close} onClick={onClose} aria-label={t('buttons.cancel')}><X size={16} /></button>}
    </div>
  )
  const body = (
    <>
      <div className={styles.field}>
        <label className="field-label">{withdraw ? t('goalDetailPanel.amountToWithdraw') : t('goalDetailPanel.amountToContribute')}</label>
        <AmountInput autoFocus value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
          onKeyDown={e => e.key === 'Enter' && onConfirm()} className={`field-input ${styles.amount}`} />
        <div className={styles.hint}>{hint}</div>
      </div>
      {!withdraw && paymentMethods && (
        <div className={styles.field}>
          <PaymentMethodField methods={paymentMethods.methods} value={methodId} onChange={setMethodId} onAddCard={onAddCard} allowCredit={false} />
        </div>
      )}
      <div className={styles.foot}>
        <button type="button" className={styles.cancel} onClick={onClose}>{t('buttons.cancel')}</button>
        <button type="button" className={`btn-primary ${styles.confirm}`} onClick={onConfirm} disabled={saving || !canConfirm}>
          {saving ? t('goalDetailPanel.saving') : t('goalDetailPanel.confirm')}
        </button>
      </div>
    </>
  )

  if (asPop) {
    return (
      <AnchoredPop open={!!open} onClose={onClose} anchorRef={anchorRef} width={360} label={title}>
        {head}
        {body}
      </AnchoredPop>
    )
  }
  if (!sheet.render) return null
  return createPortal(
    <div className={styles.overlay} data-presence="overlay" data-closing={sheet.closing ? '' : undefined}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.sheet} data-presence="panel" data-closing={sheet.closing ? '' : undefined} role="dialog" aria-modal="true" aria-label={title}>
        <div className={styles.handle} />
        {head}
        {body}
      </div>
    </div>,
    document.body,
  )
}
