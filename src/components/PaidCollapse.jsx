import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Check, RotateCcw, Eye, Loader2 } from 'lucide-react'
import { PaidByStack } from './PaidByStack'
import { getBank, bankColorVar } from '../lib/cardCatalog'
import { fmt, getMonthsShort, getCategoryLabel } from '../lib/utils'
import { kbdIf } from '../lib/a11y'
import { usePresence } from '../lib/usePresence'
import styles from './PaidCollapse.module.css'

// Timing de la animación de "marcar como no pagado" en PaidCollapse — mismo
// criterio que FILL_MS/LABEL_HOLD_MS/EXIT_MS en PayCard.jsx, pero en
// reversa: pinta de var(--upcoming-border) de derecha a izquierda, y sale
// deslizándose hacia la izquierda (el opuesto de cómo una card sale hacia
// la derecha al pagar).
const UNMARK_FILL_MS = 350
const UNMARK_HOLD_MS = 250
const UNMARK_EXIT_MS = 320

// Fila individual del colapsable de pagados — antes vivía inline dentro del
// .map() de PaidCollapse; se extrajo para poder darle su propia fase local
// de animación (idle → filling → labeled → exiting), igual patrón que ya
// usa PayCard.jsx para "marcar pagado": el guardado real (onMarkUnpaid) se
// dispara HASTA que la animación de salida terminó, nunca antes, para que
// la fila nunca desaparezca del arreglo (y se desmonte) a la mitad de su
// propia animación.
function PaidCollapseItem({ p, onMarkUnpaid, onKeep, onRelease, onViewSource, spaceMembers, onSelect, selected, paymentMethodsList = [] }) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState('idle') // idle | filling | labeled | exiting
  const wrapperRef = useRef(null)
  const timers = useRef([])

  useEffect(() => {
    return () => { timers.current.forEach(clearTimeout); onRelease?.(p.id) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function after(ms, fn) {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
  }

  // v0.9.745: el guardado sale en cuanto termina el pintado (antes esperaba a
  // que terminara TODA la animación). El cambio local se aplica al instante y
  // el pago reaparece en Pendientes mientras esta fila termina de salir:
  // `onKeep` pide al padre que siga dibujando esta fila (copia) aunque el
  // pago ya no esté en la lista de pagados, y `onRelease` lo suelta al final.
  function handleUndo(e) {
    e.stopPropagation()
    if (phase !== 'idle') return
    setPhase('filling')
    after(UNMARK_FILL_MS, () => {
      setPhase('labeled')
      onKeep?.(p)
      const saving = Promise.resolve(onMarkUnpaid(p.id)).catch(() => ({ failed: true }))
      after(UNMARK_HOLD_MS, () => {
        setPhase('exiting')
        const el = wrapperRef.current
        if (el) {
          const h = el.offsetHeight
          el.style.maxHeight = `${h}px`
          el.style.marginBottom = '0px'
          void el.offsetHeight // fuerza reflow para que la transición sí anime desde este valor
          requestAnimationFrame(() => {
            el.style.maxHeight = '0px'
            // -6px cancela el `gap: 6px` fijo de .paidCollapseList — mismo
            // criterio que collapseWrapper() en PayCard.jsx
            el.style.marginBottom = '-6px'
          })
        }
        after(UNMARK_EXIT_MS, async () => {
          const result = await saving
          // Si el guardado falló, la fila vuelve a su lugar (el hook ya
          // revirtió el pago y avisó).
          if (result?.failed) {
            const node = wrapperRef.current
            if (node) { node.style.maxHeight = ''; node.style.marginBottom = '' }
            setPhase('idle')
          }
          onRelease?.(p.id)
        })
      })
    })
  }

  const contentHidden = phase === 'labeled' || phase === 'exiting'
  const fillActive    = phase === 'filling' || phase === 'labeled' || phase === 'exiting'
  // Un pospuesto no tiene paid_at (nunca se marcó pagado de verdad) — se
  // usa postponed_at (fecha real en que se pospuso), con due_date como
  // último respaldo si por algo faltara.
  const pd = new Date(p.paid_at || p.postponed_at || p.due_date)

  return (
    <div ref={wrapperRef} className={styles.paidCollapseItemWrapper}>
      <div {...kbdIf(!!onSelect)}
        data-payment-id={p.id}
        onClick={onSelect ? () => onSelect(p.id) : undefined}
        className={`${styles.paidCollapseItem} ${phase === 'exiting' ? styles.paidCollapseItemExiting : ''} ${onSelect ? styles.paidCollapseItemSelectable : ''} ${selected ? styles.paidCollapseItemSelected : ''}`}
      >
        <div className={`${styles.paidUnmarkFill} ${fillActive ? styles.paidUnmarkFillActive : ''}`} />
        <div className={`${styles.paidUnmarkLabel} ${phase === 'labeled' || phase === 'exiting' ? styles.paidUnmarkLabelVisible : ''}`}>
          {t(p.is_postponed ? 'homePage.unpostponed' : 'homePage.markedUnpaid')}
        </div>
        <div className={`${styles.paidCollapseItemRow} ${contentHidden ? styles.paidCollapseItemRowHidden : ''}`}>
          <div className={styles.paidCollapseDate}>
            <div className={styles.paidCollapseDay}>{pd.getDate()}</div>
            <div className={styles.paidCollapseMonth}>{getMonthsShort()[pd.getMonth()]}</div>
          </div>
          <div className={styles.paidCollapseInfo}>
            <div className={styles.paidCollapseName}>{p.name}</div>
            <div className={styles.paidCollapseCategory}>
              {/* Pospuesto (agosto 2026) — reemplaza la categoría por la
                  etiqueta, mismo criterio que instLabel/freqLabel en
                  PayCard.jsx (un pago solo muestra UNA línea de contexto
                  aquí, nunca las 2 a la vez). Mockup confirmado con
                  Johnatan antes de código (Regla 8). */}
              {p.is_postponed ? (
                <span className={styles.paidCollapsePostponedTag}>{t('payCard.status.postponed')}</span>
              ) : (
                <>
                  {getCategoryLabel(p.category)}{p.is_contribution_reflection ? ` · ${t('homePage.shared')}` : ''}
                  {!p.is_contribution_reflection && (
                    <PaidByStack contributors={p.contributors} members={spaceMembers} fundAmount={p.fund_amount || 0} size={18} inline />
                  )}
                </>
              )}
            </div>
            {/* Método de pago (v0.9.492) — mismo hueco que faltaba en
                Gastos; aquí es la vista colapsada de "pagados" de Inicio. */}
            {!p.is_postponed && p.payment_method_kind && p.payment_method_kind !== 'cash' && (() => {
              const card = paymentMethodsList.find(m => m.id === p.payment_method_id)
              return (
                <div className={styles.paidCollapseMethod}>
                  <span className={styles.methodSwatch} style={{ '--swatch-color': card ? bankColorVar(card.bank) : 'var(--border-mid)' }} />
                  {card
                    ? `${getBank(card.bank).id === 'otro' ? t('cards.otherBank') : getBank(card.bank).name}${card.alias ? ` ${card.alias}` : ''}`
                    : t(p.payment_method_kind === 'credit' ? 'paymentMethod.deletedCredit' : 'paymentMethod.deletedDebit')}
                </div>
              )
            })()}
          </div>
          <span className={`${styles.paidCollapseAmount} ${p.is_postponed ? styles.paidCollapseAmountMuted : ''}`}>{fmt(p.amount)}</span>
          {p.is_contribution_reflection ? (
            <button
              onClick={e => { e.stopPropagation(); onViewSource && onViewSource(p) }}
              aria-label={t('homePage.viewInSharedSpace')}
              className={styles.paidCollapseUndoButton}
            >
              <Eye size={11} color="var(--text)" />
            </button>
          ) : p._syncing ? (
            // Sincronizando (v0.9.480) — ver PayCard.jsx, mismo criterio.
            <button type="button" disabled className={styles.paidCollapseUndoButton} aria-label={t('sync.syncing')}>
              <span className="sync-spinner"><Loader2 size={11} color="var(--text)" /></span>
            </button>
          ) : (
            <button
              onClick={handleUndo}
              disabled={phase !== 'idle'}
              aria-label={t('buttons.undo')}
              className={styles.paidCollapseUndoButton}
            >
              <RotateCcw size={11} color="var(--text)" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Resumen colapsable de pagos ya liquidados dentro del periodo actual — no
// es un segundo registro (ese sigue siendo PaymentsPage/"Pagos"), es solo un
// atajo de conveniencia para deshacer/revisar sin salir de Home. Se calcula
// con el mismo rango de fechas del periodo actual, así que se "reinicia"
// solo en cuanto cambia de periodo, sin lógica extra de limpieza.
export function PaidCollapse({ payments, expanded, onToggle, onMarkUnpaid, onViewSource, spaceMembers, onSelect, selectedId, paymentMethodsList = [] }) {
  const { t } = useTranslation()
  // Filas que ya no están pagadas pero siguen animando su salida (v0.9.745).
  const [leaving, setLeaving] = useState({})
  const { render: listRender, closing: listClosing } = usePresence(expanded, 260)
  const keepRow = row => setLeaving(prev => ({ ...prev, [row.id]: row }))
  const releaseRow = id => setLeaving(prev => { if (!(id in prev)) return prev; const { [id]: _gone, ...rest } = prev; return rest })
  return (
    <div className={styles.paidCollapseRoot}>
      <button
        onClick={onToggle}
        className={styles.paidCollapseToggle}
      >
        <div className={styles.paidCollapseCheckIcon}>
          <Check size={11} color="var(--pay-icon)" strokeWidth={3} />
        </div>
        <span className={styles.paidCollapseSummaryText}>
          {(() => {
            // Los pospuestos viven en esta lista pero NO están pagados —
            // se separan para que "19 pagados" no mienta (18 + 1 pospuesto).
            const postponed = payments.filter(p => p.is_postponed).length
            const paid = payments.length - postponed
            const parts = []
            if (paid > 0 || postponed === 0) parts.push(t('homePage.paidCount', { count: paid }))
            if (postponed > 0) parts.push(t('homePage.postponedCount', { count: postponed }))
            return parts.join(' · ')
          })()}
        </span>
        <ChevronDown size={15} color="var(--text)" className={`${styles.paidChevron} ${expanded ? styles.paidChevronOpen : ''}`} />
      </button>

      {listRender && (() => {
        // Bug real reportado por Johnatan con captura: un pago pospuesto
        // (is_postponed:true, sin paid_at) siempre caía hasta el fondo de
        // la lista sin importar su fecha real. Causa: este `sort` es un
        // SEGUNDO ordenamiento, independiente del que ya hace
        // `pagadosEstePeriodo` más arriba — este usaba `p.paid_at` directo,
        // y `new Date(null)` da el 1 de enero de 1970, así que en orden
        // descendente CUALQUIER pospuesto quedaba siempre al final. Se usa
        // `postponed_at` (fecha real de la acción), con due_date como
        // último respaldo.
        const merged = [...payments, ...Object.values(leaving).filter(l => !payments.some(x => x.id === l.id))]
        const sorted = merged.sort((a, b) => {
          const da = a.paid_at ? new Date(a.paid_at) : new Date(a.postponed_at || a.due_date)
          const db = b.paid_at ? new Date(b.paid_at) : new Date(b.postponed_at || b.due_date)
          return db - da
        })
        return (
          <div className={`${styles.paidCollapseAnim} ${listClosing ? styles.paidCollapseAnimOut : ''}`}>
          <div className={styles.paidCollapseList}>
            {sorted.map(p => (
              <PaidCollapseItem key={p.id} p={p} onMarkUnpaid={onMarkUnpaid} onKeep={keepRow} onRelease={releaseRow} onViewSource={onViewSource} spaceMembers={spaceMembers} onSelect={onSelect} selected={selectedId === p.id} paymentMethodsList={paymentMethodsList} />
            ))}
          </div>
          </div>
        )
      })()}
    </div>
  )
}
