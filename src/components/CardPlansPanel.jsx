import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, MoreVertical } from 'lucide-react'
import { DeskSettingsHead, DeskPage } from './DeskSettingsHead'
import deskStyles from './SettingsDesk.module.css'
import dd from './CardDetailDesk.module.css'
import { fmt } from '../lib/utils'
import { ConfirmDeleteModal } from './ConfirmDeleteModal'
import { getPlans, planIsActive, planRemaining, planFuture, plansRemainingTotal, nextCutPlansTotal, cuotaAmount } from '../lib/cardPlans'
import styles from './CardPlansPanel.module.css'
import { useScrollLock } from '../lib/scrollLock'

// Pantalla aparte de "Compras a meses" de una tarjeta (v0.9.587). Se abre desde
// el bento del detalle de la tarjeta (CardDetailPanel.jsx) — una sola fila ahí,
// la lista completa aquí, para que no alargue el detalle con muchas compras.
export function CardPlansPanel({ card, onBack, onSettle, onDelete, desk = false }) {
  const { t } = useTranslation()
  const [deleting, setDeleting] = useState(null)
  const [menuId, setMenuId] = useState(null)
  useScrollLock(menuId != null)
  const plans = getPlans(card)
  const active = plans.filter(planIsActive)
  const done = plans.filter(p => !planIsActive(p))

  if (desk) {
    const confirm = (
      <ConfirmDeleteModal
        open={!!deleting}
        title={t('cards.plans.deleteTitle')}
        message={t('cards.plans.deleteMessage', { name: deleting?.name || '' })}
        onConfirm={() => { const p = deleting; setDeleting(null); if (p) onDelete(p) }}
        onCancel={() => setDeleting(null)}
      />
    )
    return (
      <DeskPage>
        <DeskSettingsHead
          title={`${t('cards.bento.plansTitle')} · ${card.alias || ''}`.replace(/ · $/, '')}
          description={t('cards.desk.plansDesc')}
          actions={<button type="button" className={`${deskStyles.btn} ${deskStyles.btnSoft}`} onClick={onBack}><ChevronLeft size={16} />{t('goalDetailPanel.back')}</button>}
        />
        <div className={dd.sumRow}>
          <div className={deskStyles.fill}>
            <div className={dd.key}>{t('cards.plans.owed')}</div>
            <div className={dd.big}>{fmt(plansRemainingTotal(card))}</div>
          </div>
          <div className={deskStyles.fill}>
            <div className={dd.key}>{t('cards.plans.nextCutShort')}</div>
            <div className={dd.mid2v}>{fmt(nextCutPlansTotal(card))}</div>
          </div>
          <div className={deskStyles.fill}>
            <div className={dd.key}>{t('cards.plans.active')}</div>
            <div className={dd.mid2v}>{active.length}</div>
          </div>
        </div>
        {active.length > 0 && <div className={deskStyles.sec}>{t('cards.plans.active')}</div>}
        <div className={dd.pgrid}>
          {active.map(p => {
            const future = planFuture(p)
            const segs = Array.from({ length: p.n }, (_, i) => (i < p.paid ? 'var(--accent)' : i < p.charged ? 'var(--warning)' : null))
            return (
              <div key={p.id} className={`${deskStyles.fill} ${dd.plan}`}>
                <div className={dd.planTop}><span>{p.name}</span><span>{fmt(planRemaining(p))}</span></div>
                <div className={dd.planMeta}>
                  {p.charged > 0 ? t('cards.plans.cuotaN', { n: p.charged, total: p.n }) : t('cards.plans.startsNext')}
                  {p.settled && ` · ${t('cards.plans.settledTag')}`}
                </div>
                <div className={dd.segs}>{segs.map((color, i) => <i key={i} style={color ? { background: color } : undefined} />)}</div>
                <div className={dd.planBottom}><span>{t('cards.plans.perMonthLong', { amount: fmt(cuotaAmount(p, Math.min(p.n, p.charged + 1))) })}</span></div>
                <div className={dd.planActions}>
                  {future > 0 && <button type="button" className={`${deskStyles.btn} ${dd.soft}`} onClick={() => onSettle(p)}>{t('cards.plans.settleMenu', { amount: fmt(future) })}</button>}
                  <button type="button" className={`${deskStyles.btn} ${dd.danger}`} onClick={() => setDeleting(p)}>{t('cards.plans.delete')}</button>
                </div>
              </div>
            )
          })}
        </div>
        {done.length > 0 && <div className={deskStyles.sec}>{t('cards.plans.done')}</div>}
        <div className={dd.pgrid}>
          {done.map(p => (
            <div key={p.id} className={`${deskStyles.fill} ${dd.plan}`}>
              <div className={dd.planTop}><span>{p.name}</span><span>{fmt(p.total)}</span></div>
              <div className={dd.planMeta}>{t('cards.plans.doneMeta', { n: p.n })}</div>
            </div>
          ))}
        </div>
        {plans.length === 0 && <div className={`${deskStyles.fill} ${dd.empty}`}>{t('cards.plans.empty')}</div>}
        {confirm}
      </DeskPage>
    )
  }

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
