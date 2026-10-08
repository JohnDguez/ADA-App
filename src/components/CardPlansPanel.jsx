import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, MoreVertical } from 'lucide-react'
import { fmt } from '../lib/utils'
import { ConfirmDeleteModal } from './ConfirmDeleteModal'
import { getPlans, planIsActive, planRemaining, planFuture, plansRemainingTotal, nextCutPlansTotal, cuotaAmount } from '../lib/cardPlans'
import styles from './CardPlansPanel.module.css'

// Pantalla aparte de "Compras a meses" de una tarjeta (v0.9.587). Se abre desde
// el bento del detalle de la tarjeta (CardDetailPanel.jsx) — una sola fila ahí,
// la lista completa aquí, para que no alargue el detalle con muchas compras.
export function CardPlansPanel({ card, onBack, onSettle, onDelete }) {
  const { t } = useTranslation()
  const [deleting, setDeleting] = useState(null)
  const [menuId, setMenuId] = useState(null)
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

      <div className={styles.summary}>
        <div>
          <div className={styles.sKey}>{t('cards.plans.owed')}</div>
          <div className={styles.sValue}>{fmt(plansRemainingTotal(card))}</div>
        </div>
        {nextCutPlansTotal(card) > 0 && (
          <div className={styles.sSide}>
            <div className={styles.sKey}>{t('cards.plans.nextCutShort')}</div>
            <div className={styles.sSideValue}>{fmt(nextCutPlansTotal(card))}</div>
          </div>
        )}
      </div>

      {active.length > 0 && <div className={styles.section}>{t('cards.plans.active')}</div>}
      {active.map(p => {
        const future = planFuture(p)
        const segs = Array.from({ length: p.n }, (_, i) => (i < p.paid ? 'var(--accent)' : i < p.charged ? 'var(--warning)' : null))
        return (
          <div key={p.id} className={styles.plan}>
            <div className={styles.planTop}>
              <span className={styles.planName}>{p.name}</span>
              <div className={styles.menuWrapper}>
                <button type="button" className={styles.menuBtn} aria-label={t('cards.plans.options')} onClick={() => setMenuId(menuId === p.id ? null : p.id)}>
                  <MoreVertical size={18} />
                </button>
                {menuId === p.id && (
                  <>
                    <button type="button" className={styles.menuScrim} aria-label={t('goalDetailPanel.back')} onClick={() => setMenuId(null)} />
                    <div className={styles.menu}>
                      {future > 0 && (
                        <button type="button" className={styles.menuItem} onClick={() => { setMenuId(null); onSettle(p) }}>
                          {t('cards.plans.settleMenu', { amount: fmt(future) })}
                        </button>
                      )}
                      <button type="button" className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={() => { setMenuId(null); setDeleting(p) }}>
                        {t('cards.plans.delete')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className={styles.planMeta}>
              {p.charged > 0 ? t('cards.plans.cuotaN', { n: p.charged, total: p.n }) : t('cards.plans.startsNext')}
              {p.settled && ` · ${t('cards.plans.settledTag')}`}
            </div>
            <div className={`${styles.segs} ${p.n > 24 ? styles.segsTight : ''}`}>
              {segs.map((color, i) => <i key={i} style={color ? { background: color } : undefined} />)}
            </div>
            <div className={styles.planBottom}>
              <span>{t('cards.plans.perMonthLong', { amount: fmt(cuotaAmount(p, Math.min(p.n, p.charged + 1))) })}</span>
              <span className={styles.planLeft}>{fmt(planRemaining(p))}</span>
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
