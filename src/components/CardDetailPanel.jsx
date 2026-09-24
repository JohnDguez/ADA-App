import { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, MoreVertical, Pencil, Trash2, Loader2 } from 'lucide-react'
import { CreditCardVisual } from './CreditCardVisual'
import { Select } from './Select'
import { getCategoryLabel, fmt, getMonths, getMonthsShort } from '../lib/utils'
import { currentCycleSpend, currentCycleAbonos } from '../lib/cardStatements'
import styles from './CardDetailPanel.module.css'

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
export function CardDetailPanel({ card, payments, onBack, onEdit, onDelete, onPayNow, canEdit = true, canDelete = true, blocked }) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

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

  // \"Periodo actual\" aquí es el CICLO de esta tarjeta (desde su último
  // corte, o desde que se dio de alta si nunca se ha facturado) — no el
  // periodo de nómina del usuario, que es un concepto distinto. Reutiliza
  // el mismo criterio de ventana que \"Gastado en este corte\"
  // (cardStatements.js), aplicado a TODOS los pagos de la tarjeta, no solo
  // los de crédito.
  const cycleStart = card.kind === 'credit'
    ? (card.last_statement_cut ? new Date(card.last_statement_cut) : new Date(card.created_at))
    : null

  // Lo gastado en el ciclo en curso — antes se calculaba solo dentro del
  // JSX del chip; ahora también lo necesita "Debes en este periodo" (abajo).
  const cycleSpend = card.kind === 'credit'
    ? currentCycleSpend(card, cardPayments.filter(p => p.payment_method_id === card.id && p.payment_method_kind === 'credit' && p.is_paid))
    : 0

  // Lo ya adelantado en el ciclo en curso (v0.9.497, "Pagar ahora") — se
  // muestra junto a "Gastado en este corte" en la propia tarjeta.
  const cycleAbonos = card.kind === 'credit'
    ? currentCycleAbonos(card, cardPayments.filter(p => p.card_statement_for === card.id && !p.is_card_statement && p.is_paid))
    : 0

  const inView = useMemo(() => {
    const resolved = cardPayments.filter(p => p.is_paid)
    let filtered
    if (viewMode === 'periodo' && cycleStart) {
      filtered = resolved.filter(p => new Date(p.paid_at || p.due_date) > cycleStart)
    } else if (viewMode === 'periodo') {
      // Débito no tiene ciclo — \"Periodo actual\" cae de vuelta al mes de calendario en curso.
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
  // distinguir dirección, así que un abono ("Pagar ahora", v0.9.497) se
  // sumaba junto con las compras. "Pagado con esta tarjeta" es solo lo
  // GASTADO CON la tarjeta (`payment_method_id === card.id`), nunca lo
  // abonado A la tarjeta (`card_statement_for === card.id`).
  const spentInView = inView.filter(p => !p.is_postponed && p.payment_method_id === card.id).reduce((s, p) => s + Number(p.amount), 0)
  // "Debes en este periodo" (v0.9.500, pedido de Johnatan): mostrar gasto y
  // abono por separado obligaba al usuario a restar mentalmente para saber
  // cuánto debe de verdad. Solo tiene sentido como DEUDA en el CICLO EN
  // CURSO de una tarjeta de CRÉDITO — reutiliza `cycleSpend`/`cycleAbonos`
  // ya calculados arriba. En "Por mes", o para débito (que no acumula
  // deuda, el dinero ya salió al pagar), se muestra el total gastado tal
  // cual: un mes de calendario puede cruzar dos cortes, así que "lo que
  // debes de ese mes" no es un concepto real — el detalle completo sigue
  // disponible en la lista de abajo para quien quiera desglosarlo.
  const showOwedThisPeriod = card.kind === 'credit' && viewMode === 'periodo'
  const owedThisPeriod = Math.max(0, Math.round((cycleSpend - cycleAbonos) * 100) / 100)
  const total = showOwedThisPeriod ? owedThisPeriod : spentInView
  const owedOnCredit = card.kind === 'credit'
    ? cardPayments.filter(p => p.is_card_statement && !p.is_paid).reduce((s, p) => s + Number(p.amount), 0)
    : null

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
        <CreditCardVisual
          card={card}
          cycleSpendLabel={
            // FIX (v0.9.497): esta línea faltaba por completo en el
            // detalle — solo se veía en la lista de Mis tarjetas.
            card.kind === 'credit'
              ? [
                  t('cards.cycleSpend', { amount: fmt(cycleSpend) }),
                  cycleAbonos > 0 ? t('cards.alreadyAbonado', { amount: fmt(cycleAbonos) }) : null,
                ].filter(Boolean).join('\n')
              : null
          }
        />
      </div>

      {card.kind === 'credit' && onPayNow && (
        <button type="button" onClick={() => onPayNow(card)} className={`btn-primary ${styles.payNowButton}`}>
          {t('cards.payNow.button')}
        </button>
      )}

      {card.kind === 'credit' && (
        <div className={styles.pill}>
          <span>{t('cards.pendingCreditTotal')}</span>
          <b>{fmt(owedOnCredit)}</b>
        </div>
      )}
      <div className={styles.pill}>
        <span>{t(showOwedThisPeriod ? 'cards.detail.owedThisPeriod' : 'cards.detail.paidWithCard')}</span>
        <span className={styles.pillAmount}>{fmt(total)}</span>
      </div>

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
