import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { fmt } from '../lib/utils'
import { ConfirmDeleteModal } from './ConfirmDeleteModal'
import { getPlans, planIsActive, planRemaining, planFuture, planBilledUnpaid, planPaidAmount, plansRemainingTotal, nextCutPlansTotal, cuotaAmount } from '../lib/cardPlans'
import styles from './CardPlansPanel.module.css'

// Pantalla aparte de "Compras a meses" de una tarjeta (v0.9.587). Se abre desde
// el bento del detalle de la tarjeta (CardDetailPanel.jsx) — una sola fila ahí,
// la lista completa aquí, para que no alargue el detalle con muchas compras.
export function CardPlansPanel({ card, onBack, onSettle, onDelete }) {
  const { t } = useTranslation()
  const [deleting, setDeleting] = useState(null)
  const plans = getPlans(card)
  const active = plans.filter(planIsActive)
  const done = plans.filter(p => !planIsActive(p))

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button type="button" onClick={onBack} className={styles.iconButton} aria-label={t('goalDetailPanel.back')}>
          <ChevronLeft size={22} color="var(--text)" />
        </button>
        <div className={styles.headerTitle}>{t('cards.bento.plansTitle')}</div>
      </div>

      <div className={styles.pill}>
        <span>{t('cards.plans.totalDebt')}</span>
        <span className={styles.pillAmount}>{fmt(plansRemainingTotal(card))}</span>
      </div>
      {nextCutPlansTotal(card) > 0 && (
        <div className={styles.pill}>
          <span>{t('cards.plans.nextCut')}</span>
          <span className={styles.pillAmount}>{fmt(nextCutPlansTotal(card))}</span>
        </div>
      )}

      {active.length > 0 && <div className={styles.section}>{t('cards.plans.active')}</div>}
      {active.map(p => {
        const total = Number(p.total) || 1
        const paid = planPaidAmount(p)
        const billed = planBilledUnpaid(p)
        const future = planFuture(p)
        return (
          <div key={p.id} className={styles.plan}>
            <div className={styles.planTop}>
              <span className={styles.planName}>{p.name}</span>
              <span className={styles.planCuota}>{t('cards.plans.perMonth', { amount: fmt(cuotaAmount(p, Math.min(p.n, p.charged + 1))) })}</span>
            </div>
            <div className={styles.planMeta}>
              {p.charged > 0
                ? t('cards.plans.cuotaOf', { n: p.charged, total: p.n, amount: fmt(p.total) })
                : t('cards.plans.notStarted', { total: p.n, amount: fmt(p.total) })}
              {p.settled && ` · ${t('cards.plans.settledTag')}`}
            </div>
            <div className={styles.bar}>
              <i style={{ width: `${paid / total * 100}%`, background: 'var(--paid)' }} />
              <i style={{ width: `${billed / total * 100}%`, background: 'var(--accent)' }} />
            </div>
            <div className={styles.planBottom}>
              <span>{t('cards.plans.paid', { amount: fmt(paid) })}</span>
              <span>{t('cards.plans.remaining', { amount: fmt(planRemaining(p)) })}</span>
            </div>
            <div className={styles.actions}>
              {future > 0 && (
                <button type="button" className={styles.settleBtn} onClick={() => onSettle(p)}>
                  {t('cards.plans.settleButton', { amount: fmt(future) })}
                </button>
              )}
              <button type="button" className={styles.deleteBtn} onClick={() => setDeleting(p)}>
                {t('cards.plans.delete')}
              </button>
            </div>
          </div>
        )
      })}

      {done.length > 0 && <div className={styles.section}>{t('cards.plans.done')}</div>}
      {done.map(p => (
        <div key={p.id} className={styles.plan}>
          <div className={styles.planTop}>
            <span className={styles.planName}>{p.name}</span>
            <span className={styles.planCuota}>{fmt(p.total)}</span>
          </div>
          <div className={styles.planMeta}>{t('cards.plans.doneMeta', { n: p.n })}</div>
        </div>
      ))}

      {plans.length === 0 && <div className={styles.empty}>{t('cards.plans.empty')}</div>}

      <ConfirmDeleteModal
        open={!!deleting}
        title={t('cards.plans.deleteTitle')}
        message={t('cards.plans.deleteMessage', { name: deleting?.name || '' })}
        onConfirm={() => { const p = deleting; setDeleting(null); if (p) onDelete(p) }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
