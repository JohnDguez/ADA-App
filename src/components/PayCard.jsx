import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Check, Pencil, Trash2, Clock, ChevronDown, ChevronUp, RotateCcw, FastForward, DollarSign } from 'lucide-react'
import { statusOf, daysDiff, dateOf, fmt, MONTHS_SHORT, periodLabel, periodCountLabel, RECUR_FREQ, installmentLabel } from '../lib/utils'
import { showToast } from './Toast'
import styles from './PayCard.module.css'

function statusInfo(p, cfg) {
  const s = statusOf(p, cfg)
  if (s === 'postponed') return { label: 'Pospuesto', color: 'var(--text)', status: s }
  if (s === 'paid')      return { label: p.is_installment ? installmentLabel(p) + ' ✓' : 'Pagado', color: 'var(--paid)', status: s }
  if (s === 'paused')    return { label: 'Pausado', color: 'var(--text)', status: s }
  const d = daysDiff(p.due_date)
  if (s === 'overdue') return { label: d === -1 ? 'Venció ayer' : `Venció hace ${Math.abs(d)} días`, color: 'var(--danger)', status: s }
  if (s === 'cobro') {
    if (d < 0) return { label: `Venció hace ${Math.abs(d)} días`, color: 'var(--danger)', status: s }
    return { label: d === 0 ? 'Vence hoy' : `Vence en ${d} día${d !== 1 ? 's' : ''}`, color: 'var(--soon-color)', status: s }
  }
  if (d === 0) return { label: 'Vence hoy',     color: 'var(--soon-color)', status: s }
  if (d === 1) return { label: 'Vence mañana',  color: 'var(--soon-color)', status: s }
  return { label: `Vence en ${d} días`, color: 'var(--accent)', status: s }
}

// Estados cuyo texto NO depende de la cuenta regresiva de vencimiento (el
// riel ya comunica eso con el color/posición del punto) — estos SÍ se
// siguen mostrando aunque hideDueLabel esté activo, porque no tienen otra
// forma de comunicarse en el riel.
const STATUS_LABELS_ALWAYS_VISIBLE = ['postponed', 'paused']

function useLongPress(callback, ms = 500) {
  const timerRef = useRef(null)
  function start(e) {
    e.preventDefault()
    const el = e.currentTarget
    timerRef.current = setTimeout(() => { callback(el); timerRef.current = null }, ms)
  }
  function stop()  { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null } }
  return { onMouseDown: start, onMouseUp: stop, onMouseLeave: stop, onTouchStart: start, onTouchEnd: stop, onTouchCancel: stop }
}

export function PayCard({ payment: p, cfg, onMarkPaid, onMarkUnpaid, onCaptureAmount, onEdit, onDelete, onPostpone, onAdvance, borderLeft, hideDate, hideDueLabel, railMode, permissions }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuUpward, setMenuUpward] = useState(false)
  const menuRef = useRef(null)
  const info      = statusInfo(p, cfg)
  const showLabel = !hideDueLabel || STATUS_LABELS_ALWAYS_VISIBLE.includes(info.status)
  const d         = dateOf(p.due_date)
  const isPending = !p.is_paid && !p.postponed && !p.paused
  const freqLabel = p.is_recurrent && p.recur_freq && !p.is_installment ? RECUR_FREQ[p.recur_freq] : null
  const instLabel = p.is_installment ? `Pago ${p.current_installment}/${p.total_installments}` : null

  // Sin `permissions` (modo personal, o dueño del espacio) todo permitido.
  // "Editar"/"Agregar monto" abren un modal que ya se bloquea por su cuenta
  // (PaymentModal/VariableAmountModal) — aquí solo se guardan los flags que
  // SÍ necesitan bloquearse en el momento, porque son acciones directas sin
  // modal de por medio.
  const canMarkPaid = !permissions || permissions.can_mark_paid
  const canEdit     = !permissions || permissions.can_edit
  const canDelete   = !permissions || permissions.can_delete
  function blocked(action) {
    showToast(`No tienes permitido ${action} en este Espacio Compartido.`)
  }

  // El menú tiene entre 2 y 5 ítems según el tipo de pago — se calcula
  // cuántos va a mostrar de verdad (mismas condiciones que el JSX de abajo)
  // para estimar su altura y decidir si cabe hacia abajo antes de abrirlo,
  // en vez de siempre abrir hacia abajo sin checar (bug real: se veía
  // cortado por el navbar cuando la tarjeta estaba cerca del fondo).
  function menuItemCount() {
    let count = 1 // Eliminar siempre aparece
    if (isPending) count++ // Editar
    if (isPending && p.is_variable && onCaptureAmount) count++
    if (isPending && p.is_recurrent && !p.is_installment) count++
    if (isPending && p.is_installment && onAdvance) count++
    if (p.is_paid) count++ // Marcar no pagado
    return count
  }

  function openMenuAt(target) {
    if (target) {
      const rect = target.getBoundingClientRect()
      const estimatedHeight = menuItemCount() * 38 + 8
      setMenuUpward(rect.bottom + estimatedHeight > window.innerHeight)
    }
    setMenuOpen(true)
  }

  const longPress = useLongPress(target => openMenuAt(target))

  useEffect(() => {
    function handle(e) { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    if (menuOpen) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [menuOpen])

  return (
    <div ref={menuRef} className={styles.cardWrapper}>
      <div
        {...longPress}
        className={styles.card}
        style={{ borderLeft: railMode ? 'none' : `5px solid ${borderLeft || 'var(--border)'}` }}
      >
        {/* Info izquierda */}
        <div className={styles.infoSection}>
          <div className={styles.name}>
            {p.name}
          </div>
          <div className={styles.subtitle}>
            {hideDate ? p.category : `${p.category} · ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`}
          </div>
          {freqLabel && (
            <div className={styles.freqLabel}>{freqLabel}</div>
          )}
          {instLabel && (
            <div className={styles.instLabel}>{instLabel}</div>
          )}
        </div>

        {/* Monto + estado */}
        <div className={styles.amountSection}>
          {p.is_variable && !p.is_paid && !p.amount ? (
            <div className={styles.variableGroup}>
              <button
                onClick={e => { e.stopPropagation(); onCaptureAmount && onCaptureAmount(p) }}
                className={styles.captureButton}
              >
                <DollarSign size={12} strokeWidth={2.5} /> Agregar monto
              </button>
              <span className={styles.variableTag}>Pago variable</span>
            </div>
          ) : p.is_variable && !p.is_paid ? (
            <div className={styles.variableGroupTight}>
              <div className={styles.amountText}>{fmt(p.amount)}</div>
              <span className={styles.variableTag}>Pago variable</span>
            </div>
          ) : (
            <div className={styles.amountText}>{fmt(p.amount)}</div>
          )}
          {showLabel && <div className={styles.statusLabel} style={{ color: info.color }}>{info.label}</div>}
        </div>

        {/* Botones derecha */}
        <div className={styles.actionsSection}>
          {isPending && (
            <button
              onClick={e => { e.stopPropagation(); canMarkPaid ? onMarkPaid(p) : blocked('marcar pagos') }}
              className={styles.markPaidButton}
              style={{ background: canMarkPaid ? 'var(--paid)' : 'var(--border)' }}
            >
              <Check size={18} color={canMarkPaid ? 'var(--pay-icon)' : 'var(--muted)'} strokeWidth={2.5} />
            </button>
          )}
          {p.is_paid && (
            <div className={styles.paidIndicator}>
              <Check size={18} color="var(--pay-icon)" strokeWidth={2.5} />
            </div>
          )}
          <button
            onClick={e => { e.stopPropagation(); menuOpen ? setMenuOpen(false) : openMenuAt(e.currentTarget) }}
            className={styles.menuTriggerButton}
          >
            <MoreVertical size={15} color="var(--text)" />
          </button>
        </div>
      </div>

      {/* Menú contextual */}
      {menuOpen && (
        <div
          className={styles.contextMenu}
          style={{
            top: menuUpward ? 'auto' : '100%',
            bottom: menuUpward ? '100%' : 'auto',
            marginTop: menuUpward ? 0 : 4,
            marginBottom: menuUpward ? 4 : 0,
          }}
        >
          {isPending && <MenuItem icon={<Pencil size={14}/>} label="Editar" onClick={() => { onEdit(p); setMenuOpen(false) }} />}
          {isPending && p.is_variable && onCaptureAmount && <MenuItem icon={<DollarSign size={14}/>} label={p.amount ? 'Editar monto' : 'Agregar monto'} onClick={() => { onCaptureAmount(p); setMenuOpen(false) }} />}
          {isPending && p.is_recurrent && !p.is_installment && <MenuItem icon={<Clock size={14}/>} label="Posponer" onClick={() => { canEdit ? onPostpone(p) : blocked('posponer pagos'); setMenuOpen(false) }} />}
          {isPending && p.is_installment && onAdvance && <MenuItem icon={<FastForward size={14}/>} label="Adelantar pago" onClick={() => { canEdit ? onAdvance(p) : blocked('adelantar pagos'); setMenuOpen(false) }} />}
          {p.is_paid && <MenuItem icon={<RotateCcw size={14}/>} label="Marcar no pagado" onClick={() => { canMarkPaid ? onMarkUnpaid(p.id) : blocked('marcar pagos'); setMenuOpen(false) }} />}
          <MenuItem icon={<Trash2 size={14}/>} label="Eliminar" onClick={() => { canDelete ? onDelete(p.id) : blocked('eliminar pagos'); setMenuOpen(false) }} danger />
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button onClick={onClick} className={`${styles.menuItem} ${danger ? styles.menuItemDanger : ''}`}>
      <span>{icon}</span>{label}
    </button>
  )
}

export function GroupCard({ group, cfg, onMarkPaid, onMarkUnpaid, onEdit, onDelete, onPostpone, onAdvance }) {
  const [expanded, setExpanded] = useState(false)
  const allItems  = [group, ...group._children]
  const paidItems = allItems.filter(p => p.is_paid)
  const totalPaid = paidItems.reduce((a, p) => a + Number(p.amount), 0)
  const freq      = group.recur_freq || 'monthly'
  const freqLabel = RECUR_FREQ[freq] || ''
  const isPending = !group.is_paid && !group.postponed && !group.paused
  const countLabel = group.is_installment
    ? `${paidItems.length}/${group.total_installments} pagos`
    : periodCountLabel(paidItems.length, freq) + ' pagadas'

  return (
    <div className={styles.groupCard}>
      <div className={styles.groupHeader}>
        <div className={styles.groupInfo}>
          <div className={styles.groupName}>{group.name}</div>
          <div className={styles.groupFreq}>{freqLabel}</div>
          {paidItems.length > 0 && <div className={styles.groupCountLabel}>{countLabel}</div>}
        </div>
        <div className={styles.groupAmountSection}>
          {totalPaid > 0 && <span className={styles.groupAmountText}>{fmt(totalPaid)}</span>}
        </div>
        <div className={styles.groupActions}>
          {isPending && (
            <button onClick={() => onMarkPaid(group)} className={styles.groupMarkPaidButton}>
              <Check size={18} color="var(--pay-icon)" strokeWidth={2.5} />
            </button>
          )}
          <button onClick={() => setExpanded(v => !v)} className={styles.groupExpandButton}>
            {expanded ? <ChevronUp size={15} color="var(--text)" /> : <ChevronDown size={15} color="var(--text)" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className={styles.groupExpandedList}>
          {allItems.map((p, i) => {
            const overdue  = daysDiff(p.due_date) < 0 && !p.is_paid
            const isPend   = !p.is_paid && !p.postponed
            const isLast   = i === allItems.length - 1
            const instLabel = p.is_installment ? `Pago ${p.current_installment}/${p.total_installments}` : periodLabel(p.due_date, freq)
            const bColor   = p.is_paid ? 'var(--paid)' : p.postponed ? 'var(--muted)' : overdue ? 'var(--danger)' : 'var(--soon-color)'
            const bLabel   = p.is_paid ? 'Pagado' : p.postponed ? 'Pospuesto' : overdue ? 'Vencido' : 'Pendiente'
            return (
              <div key={p.id} className={`${styles.groupItemRow} ${!isLast ? styles.groupItemRowBordered : ''}`}>
                <div className={styles.groupItemDot} style={{ background: overdue ? 'var(--danger)' : p.is_paid ? 'var(--border-mid)' : 'var(--paid)' }} />
                <span className={styles.groupItemLabel}>{instLabel}</span>
                {p.amount > 0 && <span className={styles.groupItemAmount}>{fmt(p.amount)}</span>}
                <span className={styles.groupItemStatus} style={{ color: bColor }}>{bLabel}</span>
                {isPend && (
                  <button onClick={() => onMarkPaid(p)} className={styles.groupItemMarkPaidButton}>
                    <Check size={12} color="var(--pay-icon)" strokeWidth={2.5} />
                  </button>
                )}
                {p.is_paid && (
                  <button onClick={() => onMarkUnpaid(p.id)} className={styles.groupItemUndoButton}>
                    <RotateCcw size={10} color="var(--text)" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
