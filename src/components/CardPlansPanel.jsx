import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { DeskSettingsHead, DeskPage } from './DeskSettingsHead'
import deskStyles from './SettingsDesk.module.css'
import dd from './CardDetailDesk.module.css'
import { fmt } from '../lib/utils'
import { ConfirmDeleteModal } from './ConfirmDeleteModal'
import { getPlans, planIsActive, planRemaining, planFuture, plansRemainingTotal, nextCutPlansTotal, cuotaAmount } from '../lib/cardPlans'
import { useIsMobile } from '../hooks/useIsMobile'
import { SubpageHeader } from './SubpageHeader'
import { Repeat as RepeatIcon } from '@phosphor-icons/react/dist/csr/Repeat'
import { Trash2 } from 'lucide-react'
import pm from './CardPlansMobile.module.css'
import home from '../pages/DeskHome.module.css'
import tb from '../pages/settings/SettingsCobroTab.module.css'

// Pantalla aparte de "Compras a meses" de una tarjeta (v0.9.587). Se abre desde
// el bento del detalle de la tarjeta (CardDetailPanel.jsx) — una sola fila ahí,
// la lista completa aquí, para que no alargue el detalle con muchas compras.
export function CardPlansPanel({ card, onBack, onSettle, onDelete, desk = false }) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [deleting, setDeleting] = useState(null)
  const plans = getPlans(card)
  const active = plans.filter(planIsActive)
  const done = plans.filter(p => !planIsActive(p))

  if (desk || !isMobile) {
    const confirm = (
      <ConfirmDeleteModal
        open={!!deleting}
        title={t('cards.plans.deleteTitle')}
        message={t('cards.plans.deleteMessage', { name: deleting?.name || '' })}
        onConfirm={() => { const p = deleting; setDeleting(null); if (p) onDelete(p) }}
        onCancel={() => setDeleting(null)}
      />
    )
    const title = `${t('cards.bento.plansTitle')} · ${card.alias || ''}`.replace(/ · $/, '')
    const body = (<>
        <div className={`${dd.sumRow} ${desk ? '' : dd.sumRowV}`}>
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
    </>)
    if (desk) {
      return (
        <DeskPage>
          <DeskSettingsHead
            title={title}
            description={t('cards.desk.plansDesc')}
            actions={<button type="button" className={`${deskStyles.btn} ${deskStyles.btnSoft}`} onClick={onBack}><ChevronLeft size={16} />{t('goalDetailPanel.back')}</button>}
          />
          {body}
        </DeskPage>
      )
    }
    // Tablet vertical (v0.9.953): página completa con botón de regreso.
    return (
      <div className={dd.swapA}>
        <header className={`${home.head} ${tb.headBar}`}>
          <div className={`${home.headText} ${tb.headRow}`}>
            <button type="button" className={tb.back} onClick={onBack} aria-label={t('goalDetailPanel.back')}><ChevronLeft size={20} /></button>
            <div>
              <div className={home.date}>{t('cards.desk.plansDesc')}</div>
              <h1 className={home.hello}>{title}</h1>
            </div>
          </div>
        </header>
        <div className={dd.swapB}>{body}</div>
      </div>
    )
  }

  if (isMobile && !desk) {
    return (
      <div className={pm.root}>
        <SubpageHeader icon={RepeatIcon} title={t('cards.bento.plansTitle')} onBack={onBack} accentColor="var(--label-variable)" />
        <div className={pm.hero}>
          <div>
            <small>{t('cards.plans.owed')}</small>
            <b className={pm.heroBig}>{fmt(plansRemainingTotal(card))}</b>
          </div>
          {nextCutPlansTotal(card) > 0 && (
            <div className={pm.heroR}>
              <small>{t('cards.plans.nextCutShort')}</small>
              <b>{fmt(nextCutPlansTotal(card))}</b>
            </div>
          )}
        </div>

        {active.length > 0 && <div className={pm.cap}>{t('cards.plans.active')} · {active.length}</div>}
        {active.map((p, i) => {
          const future = planFuture(p)
          const segs = Array.from({ length: p.n }, (_, k) => (k < p.paid ? 'var(--accent)' : k < p.charged ? 'var(--warning)' : null))
          return (
            <div key={p.id} className={pm.plan} style={{ '--n': Math.min(i, 8) }}>
              <div className={pm.top}>
                <span className={pm.name}>{p.name}</span>
                <span className={pm.amt}>{fmt(planRemaining(p))}</span>
              </div>
              <div className={pm.meta}>
                {p.charged > 0 ? t('cards.plans.cuotaN', { n: p.charged, total: p.n }) : t('cards.plans.startsNext')}
                {p.settled && ` · ${t('cards.plans.settledTag')}`}
              </div>
              <div className={`${pm.segs} ${p.n > 24 ? pm.segsTight : ''}`}>
                {segs.map((color, k) => <i key={k} style={color ? { background: color } : undefined} />)}
              </div>
              <div className={pm.foot}>
                <span>{t('cards.plans.perMonthLong', { amount: fmt(cuotaAmount(p, Math.min(p.n, p.charged + 1))) })}</span>
                <div className={pm.acts}>
                  {future > 0 && <button type="button" className={pm.settle} onClick={() => onSettle(p)}>{t('cards.plans.settleMenu', { amount: fmt(future) })}</button>}
                  <button type="button" className={pm.trash} aria-label={t('cards.plans.delete')} onClick={() => setDeleting(p)}><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          )
        })}

        {done.length > 0 && <div className={pm.cap}>{t('cards.plans.done')} · {done.length}</div>}
        {done.map(p => (
          <div key={p.id} className={pm.plan}>
            <div className={pm.top}>
              <span className={pm.name}>{p.name}</span>
              <span className={pm.amt}>{fmt(p.total)}</span>
            </div>
            <div className={pm.meta}>{t('cards.plans.doneMeta', { n: p.n })}</div>
          </div>
        ))}
        {plans.length === 0 && <div className={pm.empty}>{t('cards.plans.empty')}</div>}

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

  return null
}
