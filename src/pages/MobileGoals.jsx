import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Crown, PiggyBank, Target, Check, Loader2, Pointer } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { ChipMenu } from '../components/ChipMenu'
import { PaidByStack } from '../components/PaidByStack'
import { GoalCardSkeleton } from '../components/SkeletonLoader'
import { getIconComponent } from '../lib/categoryIcons'
import { fmt, getMonthsShort } from '../lib/utils'
import styles from './MobileGoals.module.css'

// Metas móvil (<768px, v0.9.910) — diseño aprobado con mockup. La lógica, el
// detalle y los modales siguen en GoalsPage.jsx: aquí solo se pinta lo que
// llega en `d` (mismo objeto que usa la versión de escritorio). Medidas en
// rem/clamp (Regla 54); las barras crecen desde 0 al montar (Regla 53).

function Money({ text }) {
  const i = text.lastIndexOf('.')
  return i < 0 ? text : <>{text.slice(0, i)}<small>{text.slice(i)}</small></>
}
function shortDate(iso) {
  const d = new Date(iso)
  return `${d.getDate()} ${getMonthsShort()[d.getMonth()]}`
}
function useGrown(key) {
  const [g, setG] = useState(false)
  useEffect(() => {
    setG(false)
    const raf = requestAnimationFrame(() => setG(true))
    return () => cancelAnimationFrame(raf)
  }, [key])
  return g
}

// Misma suma NETA por persona que usa la versión de escritorio.
function contributorsOf(goal, isShared) {
  if (!isShared) return []
  return Object.values(goal.transactions.reduce((acc, tx) => {
    acc[tx.user_id] = acc[tx.user_id] || { user_id: tx.user_id, amount: 0 }
    acc[tx.user_id].amount += tx.type === 'aporte' ? Number(tx.amount) : -Number(tx.amount)
    return acc
  }, {})).filter(c => c.amount > 0)
}

function GoalTile({ goal, index, grown, isShared, spaceMembers, onClick }) {
  const { t } = useTranslation()
  const Icon = getIconComponent(goal.icon) || PiggyBank
  const done = goal.is_completed
  const pct = done ? 100 : goal.percent
  const contributors = contributorsOf(goal, isShared)
  return (
    <button type="button" data-goal-id={goal.id} className={styles.goal} style={{ '--i': index }} onClick={onClick}>
      <div className={styles.gTop}>
        <i className={styles.gIcon} style={{ background: goal.color }}><Icon size={17} color="var(--on-color)" /></i>
        <b className={styles.gName} title={goal.name}>{goal.name}</b>
        {goal._syncing && <span className="sync-spinner" aria-label={t('sync.syncing')}><Loader2 size={14} /></span>}
        {!done && (goal.isOverdue
          ? <span className={`${styles.badge} ${styles.badgeLate}`}>{t('goalsPage.card.overdue')}</span>
          : <span className={styles.badge}>{goal.target_date ? t('goalsPage.card.daysRemaining', { count: goal.daysRemaining }) : t('deskGoals.noDeadline')}</span>)}
      </div>
      <div className={styles.gAmt}><Money text={fmt(goal.currentAmount)} /></div>
      <div className={styles.gSub}>{t('deskGoals.depositedOf', { amount: fmt(goal.target_amount), pct })}</div>
      <div className={styles.pb}><u style={{ width: grown ? `${pct}%` : '0%', background: goal.color }} /></div>
      <div className={styles.gFoot}>
        {done
          ? <span className={styles.doneTxt}><Check size={14} color="var(--paid)" />{t('goalsPage.card.completedOn', { date: goal.completed_at ? shortDate(goal.completed_at) : '' })}</span>
          : <span>{t('goalsPage.card.remaining', { amount: fmt(goal.remaining) })}</span>}
        {contributors.length > 0 && <PaidByStack contributors={contributors} members={spaceMembers} size={20} inline />}
      </div>
    </button>
  )
}

export function MobileGoals({ d }) {
  const { t } = useTranslation()
  const {
    goalsLoading, noGoalsAtAll, onAdd, isShared, spaceMembers, atFreeLimit, onOpenPremium,
    activeGoals, completedGoals, sortedGoals, sortBy, setSortBy, goalsView, setGoalsView,
    totalRestante, totalAhorrado, setSelectedGoalId,
  } = d
  const grown = useGrown(goalsView)
  const heroGrown = useGrown('hero')
  if (goalsLoading) return <div className={styles.root} data-coachmark="metas-resumen"><GoalCardSkeleton count={2} /></div>
  if (noGoalsAtAll) {
    return (
      <div className={styles.root} data-coachmark="metas-resumen">
        <EmptyState icon={PiggyBank} title={t('goalsPage.noGoalsAtAllTitle')} subtitle={t('goalsPage.noGoalsAtAllSubtitle')} onClick={onAdd} />
      </div>
    )
  }
  const totalTarget = activeGoals.reduce((s, g) => s + Number(g.target_amount || 0), 0)
  const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalAhorrado / totalTarget) * 100)) : 0
  const lastDone = [...completedGoals].sort((a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0))[0]
  const showing = goalsView === 'activas' ? sortedGoals : completedGoals
  const sortOptions = ['monto', 'nombre'].map(v => ({ value: v, label: t(`goalsPage.sortCriteria.${v}`) }))

  return (
    <div className={styles.root}>
      <section data-coachmark="metas-resumen" className={styles.card}>
        <div className={styles.label}>{t('goalsPage.totalRemaining')}</div>
        <div className={styles.bigNum}><Money text={fmt(totalRestante)} /></div>
        <div className={styles.track}><u style={{ width: heroGrown ? `${overallPct}%` : '0%' }} /></div>
        <div className={styles.sub}>{t('mobileGoals.overallPct', { pct: overallPct })}</div>
        <div className={styles.tiles}>
          <div className={styles.tile}>
            <span>{t('mobileGoals.savedTile')}</span>
            <b><Money text={fmt(totalAhorrado)} /></b>
            <em>{t('deskGoals.savedSub', { count: activeGoals.length })}</em>
          </div>
          <div className={styles.tile}>
            <span>{t('mobileGoals.doneTile')}</span>
            <b>{completedGoals.length}<small>/{activeGoals.length + completedGoals.length}</small></b>
            <em>{lastDone ? t('deskGoals.lastDone', { name: lastDone.name }) : t('deskGoals.noneDone')}</em>
          </div>
        </div>
      </section>

      <div className={styles.filterRow}>
        <div data-coachmark="metas-tabs" className={styles.chips}>
          <button type="button" aria-pressed={goalsView === 'activas'} className={`${styles.chip} ${goalsView === 'activas' ? styles.chipOn : ''}`} onClick={() => setGoalsView('activas')}>{t('goalsPage.tabs.active')}</button>
          <button type="button" aria-pressed={goalsView === 'cumplidas'} className={`${styles.chip} ${goalsView === 'cumplidas' ? styles.chipOn : ''}`} onClick={() => setGoalsView('cumplidas')}>{t('goalsPage.tabs.completed')}</button>
        </div>
        {goalsView === 'activas' && activeGoals.length > 1 && (
          <ChipMenu className={`${styles.chip} ${styles.chipSort}`} value={sortBy} onChange={setSortBy} options={sortOptions}
            label={t('goalsPage.sortBy', { criteria: t(`goalsPage.sortCriteria.${sortBy}`) })} ariaLabel={t('mobileGoals.sortAria')} />
        )}
      </div>

      <div key={goalsView} className={styles.list}>
        {showing.length === 0 ? (
          goalsView === 'activas'
            ? <EmptyState icon={PiggyBank} title={t('goalsPage.noActiveGoalsTitle')} subtitle={t('goalsPage.noActiveGoalsSubtitle')} onClick={onAdd} />
            : <EmptyState icon={Target} title={t('goalsPage.noCompletedGoalsTitle')} subtitle={t('goalsPage.noCompletedGoalsSubtitle')} />
        ) : (
          <div data-coachmark={goalsView === 'activas' ? 'metas-lista' : undefined} className={styles.grid}>
            {showing.map((g, i) => (
              <GoalTile key={g.id} goal={g} index={i} grown={grown} isShared={isShared} spaceMembers={spaceMembers} onClick={() => setSelectedGoalId(g.id)} />
            ))}
          </div>
        )}
        {showing.length > 0 && (
          <p className={styles.hint}><Pointer size={14} strokeWidth={1.9} />{t('mobileGoals.tapHint')}</p>
        )}
        {atFreeLimit && goalsView === 'activas' && (
          <div className={styles.premium}>
            <b>{t('goalsPage.premiumBanner.title')}</b>
            <p>{t('goalsPage.premiumBanner.text')}</p>
            <button type="button" onClick={onOpenPremium}><Crown size={15} fill="currentColor" /> {t('goalsPage.premiumBanner.button')}</button>
          </div>
        )}
      </div>
    </div>
  )
}
