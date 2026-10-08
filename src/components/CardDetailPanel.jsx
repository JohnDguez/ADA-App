import { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, MoreVertical, Pencil, Trash2, Loader2, Users } from 'lucide-react'
import { CreditCardVisual } from './CreditCardVisual'
import { Select } from './Select'
import { getCategoryLabel, fmt, getMonths, getMonthsShort, today } from '../lib/utils'
import { cardDebt, cardCycleInfo } from '../lib/cardStatements'
import { getPlans, activePlansCount, plansRemainingTotal, nextCutPlansTotal } from '../lib/cardPlans'
import { CardPlansPanel } from './CardPlansPanel'
import { useBackClose } from '../lib/backNav'
import styles from './CardDetailPanel.module.css'

// Dona de "Por pagar" (v0.9.587): una vuelta = lo que se debe, repartido en estado
// de cuenta, ciclo en curso y planes por venir. Colores de la app (sin hex propios).
const DONUT_R = 26
const DONUT_C = 2 * Math.PI * DONUT_R
function DebtDonut({ debt, label }) {
  const parts = [
    [debt.statement, 'var(--warning)'],
    [debt.cycle, 'var(--accent)'],
    [debt.plans, 'var(--label-variable)'],
  ].filter(([v]) => v > 0)
  const total = parts.reduce((s, [v]) => s + v, 0)
  const GAP = parts.length > 1 ? 2 : 0
  let offset = 0
  return (
    <div className={styles.donutWrap}>
      <svg width="104" height="104" viewBox="0 0 64 64" role="img" aria-label={label}>
        <g transform="rotate(-90 32 32)" fill="none" strokeWidth="9">
          <circle cx="32" cy="32" r={DONUT_R} stroke="var(--border)" />
          {parts.map(([v, color], i) => {
            const len = Math.max(0, (v / total) * DONUT_C - GAP)
            const el = <circle key={i} cx="32" cy="32" r={DONUT_R} stroke={color} strokeDasharray={`${len} ${DONUT_C}`} strokeDashoffset={-offset} />
            offset += (v / total) * DONUT_C
            return el
          })}
        </g>
      </svg>
    </div>
  )
}

// Detalle de una tarjeta (v0.9.495, mockups confirmados con Johnatan).
// Tocar una tarjeta en Mis tarjetas navega DIRECTO aquí — reemplaza el
// comportamiento anterior de "abrirse en la propia pila con 4 botones"
// (entrega A, v0.9.486). Mismo patrón de header/menú que
// RecurrentDetailPanel.jsx (ChevronLeft + título + 3 puntos con
// Editar/Eliminar), para que las pantallas de detalle de la app se sientan
// iguales entre sí.
//
// El historial mezcla dos tipos de fila, ambos "de esta tarjeta":
// - Compras pagadas CON ella (`payment_method_id === card.id`).
// - Sus propios pagos de estado de cuenta (`card_statement_for === card.id`
//   — normalmente pagados en efectivo, por eso NO califican como
//   `payment_method_id === card.id`; se identifican aparte).
// Los pospuestos no cuentan en el total, mismo criterio que Gastos.
export function CardDetailPanel({ card, payments, onBack, onEdit, onDelete, onPayNow, onSettlePlan, onDeletePlan, spaceNames = {}, canEdit = true, canDelete = true, blocked }) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  // Pantalla aparte de compras a meses (v0.9.587)
  const [plansOpen, setPlansOpen] = useState(false)
  useBackClose(plansOpen, () => setPlansOpen(false))

  useEffect(() => {
    if (!menuOpen) return
    const handler = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [menuOpen])

  const cardPayments = useMemo(() => (payments || []).filter(p =>
    p.payment_method_id === card.id || p.card_statement_for === card.id
  ), [payments, card.id])

  const [viewMode, setViewMode] = useState('periodo') // 'periodo' | 'mes'
  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear, setViewYear] = useState(now.getFullYear())

  const oldestYear = cardPayments.reduce((min, p) => {
    const d = p.paid_at ? new Date(p.paid_at) : new Date(p.due_date)
    return Math.min(min, d.getFullYear())
  }, now.getFullYear())
  const availableYears = []
  for (let y = now.getFullYear(); y >= oldestYear; y--) availableYears.push(y)
  if (!availableYears.includes(viewYear)) availableYears.unshift(viewYear)

  // "Periodo actual" aquí es el CICLO de esta tarjeta (desde su último
  // corte, o desde que se dio de alta si nunca se ha facturado) — no el
  // periodo de nómina del usuario, que es un concepto distinto. Reutiliza
  // el mismo criterio de ventana que "Gastado en este corte"
  // (cardStatements.js), aplicado a TODOS los pagos de la tarjeta, no solo
  // los de crédito.
  const cycleStart = card.kind === 'credit'
    ? (card.last_statement_cut ? new Date(card.last_statement_cut) : new Date(card.created_at))
    : null

  // "Por pagar" (v0.9.502, pedido de Johnatan): antes eran 2 pastillas
  // aparte ("Por pagar en crédito" y "Debes en este periodo") que el
  // usuario percibía como la misma información repetida, y encima se
  // duplicaba una tercera vez en el chip de la propia tarjeta. Ahora es
  // UN solo número: lo ya facturado y sin pagar, más lo que llevas en el
  // ciclo en curso (`totalOwedOnCard`, cardStatements.js). El chip de la
  // tarjeta se quita por completo en esta pantalla — la pastilla de abajo
  // es la única fuente de esa cifra. "Debes" se evita a propósito (pedido
  // de Johnatan: se siente informal); se usa "Por pagar", como en las
  // apps de bancos.
  const debt = card.kind === 'credit' ? cardDebt(card, cardPayments) : null
  const totalOwed = debt ? debt.total : 0
  const hasPlans = card.kind === 'credit' && getPlans(card).length > 0
  const cycleInfo = card.kind === 'credit' ? cardCycleInfo(card, today()) : null

  const inView = useMemo(() => {
    const resolved = cardPayments.filter(p => p.is_paid)
    let filtered
    if (viewMode === 'periodo' && cycleStart) {
      filtered = resolved.filter(p => new Date(p.paid_at || p.due_date) > cycleStart)
    } else if (viewMode === 'periodo') {
      // Debito no tiene ciclo -- "Periodo actual" cae de vuelta al mes de calendario en curso.
      filtered = resolved.filter(p => {
        const d = new Date(p.paid_at || p.due_date)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
    } else {
      filtered = resolved.filter(p => {
        const d = new Date(p.paid_at || p.due_date)
        return d.getMonth() === viewMonth && d.getFullYear() === viewYear
      })
    }
    return filtered.sort((a, b) => new Date(b.paid_at || b.due_date) - new Date(a.paid_at || a.due_date))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardPayments, viewMode, viewMonth, viewYear])

  // FIX v0.9.499 (reportado por Johnatan): sumaba TODO el historial sin
  // distinguir direccion, asi que un abono ("Pagar ahora", v0.9.497) se
  // sumaba junto con las compras. "Pagado con esta tarjeta" es solo lo
  // GASTADO CON la tarjeta (payment_method_id === card.id), nunca lo
  // abonado A la tarjeta (card_statement_for === card.id). Esta pastilla
  // sigue siendo SIEMPRE el total gastado, sin importar el filtro
  // (v0.9.501) — "Por pagar" (arriba) es la deuda real, otra cosa.
  const total = inView.filter(p => !p.is_postponed && p.payment_method_id === card.id).reduce((s, p) => s + Number(p.amount), 0)

  const groups = useMemo(() => {
    const byMonth = new Map()
    for (const p of inView) {
      const d = new Date(p.paid_at || p.due_date)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!byMonth.has(key)) byMonth.set(key, { label: `${getMonths()[d.getMonth()]} ${d.getFullYear()}`, rows: [] })
      byMonth.get(key).rows.push(p)
    }
    return [...byMonth.values()]
  }, [inView])

  function handleDeleteClick() {
    setMenuOpen(false)
    if (!canDelete) { blocked?.(t('paymentsPage.actionDeletePayments')); return }
    onDelete()
  }

  if (plansOpen) {
    return (
      <CardPlansPanel
        card={card}
        onBack={() => window.history.back()}
        onSettle={plan => onSettlePlan?.(card, plan)}
        onDelete={plan => onDeletePlan?.(card, plan)}
      />
    )
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button type="button" onClick={onBack} className={styles.iconButton} aria-label={t('goalDetailPanel.back')}>
          <ChevronLeft size={22} color="var(--text)" />
        </button>
        <div className={styles.headerTitle}>{card.alias || t(`cards.kind.${card.kind}`)}</div>
        <div className={styles.menuWrapper} ref={menuRef}>
          <button type="button" onClick={() => setMenuOpen(o => !o)} className={styles.iconButton} aria-label={t('goalDetailPanel.moreOptions')}>
            {card._syncing ? <Loader2 size={20} color="var(--text)" className="sync-spinner" /> : <MoreVertical size={20} color="var(--text)" />}
          </button>
          {menuOpen && (
            <div className={styles.menu}>
              <button type="button" onClick={() => { setMenuOpen(false); if (!canEdit) { blocked?.(t('paymentsPage.actionEditPayments')); return }; onEdit() }} className={styles.menuItem}>
                <span><Pencil size={14} /></span>{t('buttons.edit')}
              </button>
              <button type="button" onClick={handleDeleteClick} className={`${styles.menuItem} ${styles.menuItemDanger}`}>
                <span><Trash2 size={14} /></span>{t('buttons.delete')}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={styles.preview}>
        {/* FIX v0.9.502 (reportado por Johnatan): el chip repetía la misma
            cifra que ya muestra la pastilla "Por pagar" de abajo — se
            quita por completo en esta pantalla. La lista de Mis tarjetas
            sí conserva su propio chip (ahí es la única fuente de esa
            cifra, sin pastillas alrededor). */}
        <CreditCardVisual card={card} />
      </div>

      {card.kind === 'credit' && onPayNow && (
        <button type="button" onClick={() => onPayNow(card)} className={`btn-primary ${styles.payNowButton}`}>
          {t('cards.payNow.button')}
        </button>
      )}

      {/* Resumen en bento (v0.9.587, variante B elegida por Johnatan): "Por pagar" con
          su dona (de dónde sale el número), lo pagado con la tarjeta, las compras a
          meses (abren su pantalla aparte) y el avance del ciclo. */}
      {card.kind === 'credit' ? (
        <div className={styles.bento}>
          <div className={`${styles.bCard} ${styles.bTall}`}>
            <div className={styles.bKey}>{t('cards.pendingCreditTotal')}</div>
            <div className={styles.bValue}>{fmt(totalOwed)}</div>
            <DebtDonut debt={debt} label={t('cards.bento.donutLabel')} />
            <div className={styles.legend}>
              {[
                ['statement', 'var(--warning)', t('cards.bento.statement')],
                ['cycle', 'var(--accent)', t('cards.bento.cycle')],
                ['plans', 'var(--label-variable)', t('cards.bento.plans')],
              ].filter(([k]) => debt[k] > 0).map(([k, color, label]) => (
                <div key={k} className={styles.legendRow}>
                  <span className={styles.legendDot} style={{ background: color }} />
                  <span>{label}</span>
                  <b>{fmt(debt[k])}</b>
                </div>
              ))}
              {debt.total <= 0 && <div className={styles.legendRow}><span>{t('cards.bento.noDebt')}</span></div>}
            </div>
          </div>

          <div className={`${styles.bCard} ${!hasPlans ? styles.bTall : ''}`}>
            <div className={styles.bKey}>{t('cards.detail.paidWithCard')}</div>
            <div className={styles.bValueSm}>{fmt(total)}</div>
          </div>

          {hasPlans && (
            <button type="button" onClick={() => setPlansOpen(true)} className={`${styles.bCard} ${styles.bButton}`}>
              <div className={styles.bKey}>{t('cards.bento.plansTitle')}</div>
              <div className={styles.bValueSm}>{fmt(plansRemainingTotal(card))}</div>
              <div className={styles.bSub}>
                {t('cards.bento.plansCount', { count: activePlansCount(card) })}
                {nextCutPlansTotal(card) > 0 && ` · ${t('cards.bento.nextCutPlans', { amount: fmt(nextCutPlansTotal(card)) })}`}
              </div>
              <ChevronRight size={16} className={styles.bChevron} />
            </button>
          )}

          {cycleInfo && (
            <div className={`${styles.bCard} ${styles.bWide}`}>
              <div className={styles.bKey}>
                {t('cards.bento.nextCut', { day: cycleInfo.nextCut.getDate(), month: getMonthsShort()[cycleInfo.nextCut.getMonth()].toLowerCase() })}
              </div>
              <div className={styles.cycleTrack}><i style={{ width: `${Math.round(cycleInfo.day / cycleInfo.total * 100)}%` }} /></div>
              <div className={styles.cycleRow}>
                <span>{t('cards.bento.cycleDay', { day: cycleInfo.day, total: cycleInfo.total })}</span>
                {cycleInfo.due && <span>{t('cards.bento.dueOn', { day: cycleInfo.due.getDate(), month: getMonthsShort()[cycleInfo.due.getMonth()].toLowerCase() })}</span>}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.pill}>
          <span>{t('cards.detail.paidWithCard')}</span>
          <span className={styles.pillAmount}>{fmt(total)}</span>
        </div>
      )}

      <div className={styles.filtersWrapper}>
        <div className={styles.viewModeRow}>
          {[['periodo', t('homePage.tabs.currentPeriod')], ['mes', t('paymentsPage.byMonth')]].map(([val, label]) => (
            <button key={val} onClick={() => setViewMode(val)}
              className={`${styles.viewModeButton} ${viewMode === val ? styles.viewModeButtonActive : ''}`}>
              {label}
            </button>
          ))}
        </div>
        {viewMode === 'mes' && (
          <div className={styles.monthYearRow}>
            <div className={styles.monthYearGroup}>
              <span className={styles.monthYearLabel}>{t('paymentsPage.monthLabel')}</span>
              <Select value={getMonths()[viewMonth]} onChange={name => setViewMonth(getMonths().indexOf(name))} options={getMonths()} />
            </div>
            <div className={styles.monthYearGroup}>
              <span className={styles.monthYearLabel}>{t('paymentsPage.yearLabel')}</span>
              <Select value={String(viewYear)} onChange={y => setViewYear(Number(y))} options={availableYears.map(String)} />
            </div>
          </div>
        )}
      </div>

      <div className={styles.historyList}>
        {groups.length === 0 && (
          <div className={styles.empty}>{t('cards.detail.noHistory')}</div>
        )}
        {groups.map(g => (
          <div key={g.label}>
            <div className={styles.monthLabel}>{g.label}</div>
            {g.rows.map(p => {
              const d = new Date(p.paid_at || p.due_date)
              // Estilo "como los bancos" (v0.9.497, pedido de Johnatan):
              // un ingreso es dinero que REDUCE lo que debes en esta
              // tarjeta — el estado de cuenta automático o un abono manual
              // (`card_statement_for === card.id`). Un gasto es una compra
              // hecha CON la tarjeta (`payment_method_id === card.id`).
              // Para débito, que no tiene estados de cuenta ni abonos,
              // todo cae del lado de gasto — mismo criterio, sin
              // necesidad de un caso especial.
              const isIncome = p.card_statement_for === card.id
              const label = p.is_card_statement
                ? t('cards.statementBadge')
                : isIncome
                  ? t('cards.detail.abono')
                  : getCategoryLabel(p.category)
              return (
                <div key={p.id} className={styles.row}>
                  <div className={styles.rowDate}>
                    <b>{d.getDate()}</b>
                    {getMonthsShort()[d.getMonth()]}
                  </div>
                  <div className={styles.rowMain}>
                    <div className={styles.rowName}>{p.name}</div>
                    <div className={styles.rowCat}>
                      {label}
                      {p.is_postponed && ` · ${t('payCard.status.postponed')}`}
                    </div>
                    {/* Solo los pagos hechos en un Espacio Compartido (su reflejo
                        personal trae `source_space_id`); los personales no llevan marca. */}
                    {p.source_space_id && (
                      <div className={styles.spaceTag}>
                        <Users size={11} />
                        <span>{spaceNames[p.source_space_id] || t('cards.detail.sharedSpaceFallback')}</span>
                      </div>
                    )}
                  </div>
                  <div className={`${styles.rowAmount} ${isIncome ? styles.rowAmountIncome : ''}`}>
                    {isIncome ? '+' : '−'}{fmt(p.amount)}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
