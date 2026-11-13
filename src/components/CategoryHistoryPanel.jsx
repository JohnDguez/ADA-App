import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, MoreVertical, Pencil, FileDown, Check, Clock, Plus } from 'lucide-react'
import { getCategoryIcon } from '../lib/categoryIcons'
import { fmt, dateOf, cobroPeriod, getCatColor, getCategoryLabel, getMonths, getMonthsShort } from '../lib/utils'
import { groupByMonth } from '../lib/scheduled'
import { catInk } from '../lib/colorUtils'
import { supabase } from '../lib/supabase'
import { fetchHistoryRows, hasOlderHistory, HISTORY_MONTHS } from '../lib/categoryHistory'
import { LoadingDots } from './LoadingDots'
import { Bone } from './SkeletonLoader'
import { useScrollLock } from '../lib/scrollLock'
import r from './RecurrentDetailPanel.module.css'
import styles from './CategoryHistoryPanel.module.css'

const whole = n => fmt(n).replace(/\.\d+$/, '')

function fmtDateFull(value) {
  const d = new Date(value)
  return `${d.getDate()} ${getMonthsShort()[d.getMonth()]} ${d.getFullYear()}`
}

// Historial de una categoría (v0.9.1055) — vive en Ajustes › Categorías. Mismo
// diseño que el detalle de un recurrente (RecurrentDetailPanel): encabezado con
// ícono, total grande, dos mosaicos y lista. Pide aparte los últimos 6 meses de
// ESA categoría (cuenta personal), sin tocar el estado global de pagos: así una
// categoría sin gastos en el periodo actual también muestra su historial.
//
// Reglas: los meses se agrupan por FECHA DE PAGO y solo salen los que tienen
// pagos; los pospuestos no suman; los recurrentes y parcialidades se resumen en
// un mosaico que lleva a Recurrentes (no se mezclan con los pagos únicos); más
// allá de 6 meses se invita a exportar un reporte.
export function CategoryHistoryPanel({
  category, isCustom = false, profile, mobile = false,
  onBack, onEdit, onExport, onAddPayment,
}) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  useScrollLock(menuOpen)
  const menuRef = useRef(null)
  const [state, setState] = useState({ loading: true, error: false, paid: [], scheduled: [], older: false })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!menuOpen) return
    const handler = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler) }
  }, [menuOpen])

  const load = useCallback(async () => {
    const periodEnd = cobroPeriod(profile).end
    const endStr = `${periodEnd.getFullYear()}-${String(periodEnd.getMonth() + 1).padStart(2, '0')}-${String(periodEnd.getDate()).padStart(2, '0')}`
    // Pagado (personal + lo que me toca de mis espacios, ver categoryHistory.js)
    // y programados (únicos pendientes de la cuenta personal con fecha futura).
    const [paid, schedQ, older] = await Promise.all([
      fetchHistoryRows(profile.id, category, HISTORY_MONTHS),
      supabase.from('payments').select('id,name,amount,due_date,category')
        .eq('user_id', profile.id).is('space_id', null).eq('category', category)
        .or('is_master.is.null,is_master.eq.false')
        .eq('is_paid', false).eq('is_postponed', false).is('parent_id', null)
        .not('is_recurrent', 'is', true).not('is_installment', 'is', true)
        .gt('due_date', endStr).order('due_date', { ascending: true }),
      hasOlderHistory(profile.id, category, HISTORY_MONTHS),
    ])
    if (schedQ.error) throw schedQ.error
    return { paid, scheduled: schedQ.data || [], older }
  }, [category, profile])

  useEffect(() => {
    let alive = true
    setState(s => ({ ...s, loading: true, error: false }))
    load().then(
      data => { if (alive) setState({ loading: false, error: false, ...data }) },
      () => { if (alive) setState(s => ({ ...s, loading: false, error: true })) },
    )
    return () => { alive = false }
  }, [load, attempt])

  const { loading, error, paid, scheduled, older } = state
  const singles = useMemo(() => paid.filter(p => !p.parent_id), [paid])
  const recurring = useMemo(() => paid.filter(p => p.parent_id), [paid])
  const singlesTotal = singles.reduce((s, p) => s + Number(p.amount), 0)
  const recurringTotal = recurring.reduce((s, p) => s + Number(p.amount), 0)
  const grand = singlesTotal + recurringTotal
  const groups = useMemo(() => groupByMonth(singles, 'paid_at'), [singles])
  const months = getMonths()
  const isEmpty = !loading && !error && singles.length === 0 && recurring.length === 0 && scheduled.length === 0

  const CatIcon = getCategoryIcon(category, profile.category_icons)
  const catColor = getCatColor(category, profile.custom_categories, profile.category_colors)
  const label = isCustom ? category : getCategoryLabel(category)
  const big = loading ? <LoadingDots /> : <>{whole(grand)}<small>{fmt(grand).match(/\.\d+$/)?.[0] || ''}</small></>

  return (
    <div className={`${r.screen} ${r.desk} ${mobile ? r.mobile : ''}`} style={{ backgroundImage: `radial-gradient(70% 50% at 0% 0%, color-mix(in srgb, ${catColor} 30%, transparent), transparent 70%)` }}>
      <div className={r.header}>
        <button type="button" onClick={onBack} className={r.iconButton} aria-label={t('goalDetailPanel.back')}>
          <ChevronLeft size={22} color="var(--text)" />
        </button>
        <div className={r.headerIcon} style={{ background: catColor }}>
          {CatIcon ? <CatIcon size={15} color={catInk(catColor)} strokeWidth={2} /> : <span className={r.headerIconFallback} />}
        </div>
        <div className={r.headerTitle}>{label}</div>
        <div className={r.menuWrapper} ref={menuRef}>
          <button type="button" onClick={() => setMenuOpen(o => !o)} className={r.iconButton} aria-label={t('goalDetailPanel.moreOptions')}>
            <MoreVertical size={20} color="var(--text)" />
          </button>
          {menuOpen && (
            <div className={r.menu}>
              <button type="button" onClick={() => { setMenuOpen(false); onEdit() }} className={r.menuItem}>
                <span><Pencil size={14} /></span>{t('categoryHistory.menuEdit')}
              </button>
              <button type="button" onClick={() => { setMenuOpen(false); onExport() }} className={r.menuItem}>
                <span><FileDown size={14} /></span>{t('categoryHistory.menuExport')}
              </button>
            </div>
          )}
        </div>
      </div>

      {isEmpty ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon} style={{ background: 'var(--desk-chip)' }}>
            {CatIcon ? <CatIcon size={26} color="var(--text)" strokeWidth={1.8} /> : null}
          </div>
          <b>{t('categoryHistory.noPaymentsTitle')}</b>
          <p>{t('categoryHistory.noPaymentsText', { category: label })}</p>
          <button type="button" className={styles.cta} onClick={() => onAddPayment({ category })}><Plus size={16} strokeWidth={2.4} />{t('categoryHistory.addPayment')}</button>
        </div>
      ) : (
        <>
          <div className={r.dHero}>
            <div className={r.dTop}>
              <span>{t('categoryHistory.totalLabel', { count: HISTORY_MONTHS })}</span>
              <span>{t('categoryHistory.lastMonths', { count: HISTORY_MONTHS })}</span>
            </div>
            <div className={r.dBig}>{big}</div>
            <div className={r.dOf}>{loading ? '' : t('categoryHistory.singlesSub', { category: label, amount: whole(singlesTotal) })}</div>
            <div className={styles.tiles}>
              <div className={styles.tile}>
                <span>{t('categoryHistory.singlesTile')}</span>
                <b>{loading ? <LoadingDots /> : singles.length}</b>
              </div>
              <div className={styles.tile}>
                <span>{t('categoryHistory.recurringTile')}</span>
                <b>{loading ? <LoadingDots /> : whole(recurringTotal)}</b>
              </div>
            </div>
          </div>

          <div className={`${styles.body} ${!mobile ? 'scroll-y' : ''}`}>
            {loading ? (
              <div aria-busy="true">{[0, 1, 2, 3].map(i => <div key={i} className={r.historyRow}><Bone w="100%" h={40} r={12} /></div>)}</div>
            ) : error ? (
              <div className={styles.error}>
                <span>{t('categoryHistory.loadError')}</span>
                <button type="button" onClick={() => setAttempt(a => a + 1)}>{t('categoryHistory.retry')}</button>
              </div>
            ) : (
              <>
                {scheduled.length > 0 && (
                  <section>
                    <header className={styles.monthHead}><b>{t('categoryHistory.scheduledTitle')}</b><small>{scheduled.length}</small></header>
                    {scheduled.map(p => (
                      <div key={p.id} className={r.historyRow}>
                        <Clock size={16} color="var(--muted)" className={r.historyIcon} />
                        <div className={r.historyInfo}>
                          <div className={r.historyDate}>{fmtDateFull(dateOf(p.due_date))}</div>
                          <div className={r.historyNote}>{p.name}</div>
                        </div>
                        <div className={r.historyAmount}>{fmt(p.amount)}</div>
                      </div>
                    ))}
                  </section>
                )}
                {groups.map(g => (
                  <section key={g.key}>
                    <header className={styles.monthHead}>
                      <b>{months[g.month]} {g.year}</b>
                      <small>{t('categoryHistory.monthSummary', { count: g.items.length, total: whole(g.total) })}</small>
                    </header>
                    {g.items.map(p => (
                      <div key={p.id} className={r.historyRow}>
                        <Check size={16} color="var(--paid)" className={r.historyIcon} />
                        <div className={r.historyInfo}>
                          <div className={r.historyDate}>{fmtDateFull(p.paid_at)}</div>
                          <div className={r.historyNote}>{p.name}{p.shared ? ` · ${t('homePage.shared')}` : ''}</div>
                        </div>
                        <div className={r.historyAmount}>{fmt(p.amount)}</div>
                      </div>
                    ))}
                  </section>
                ))}
                {older && (
                  <button type="button" className={styles.older} onClick={onExport}>
                    <span>{t('categoryHistory.olderHint', { count: HISTORY_MONTHS })}</span>
                    <em>{t('categoryHistory.olderAction')}<ChevronRight size={14} strokeWidth={2.2} /></em>
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
