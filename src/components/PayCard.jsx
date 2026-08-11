import { memo, useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { createPortal } from 'react-dom'
import { MoreVertical, Check, Pencil, Trash2, Clock, ChevronDown, ChevronUp, RotateCcw, FastForward, DollarSign, Eye, Users, PiggyBank } from 'lucide-react'
import { statusOf, daysDiff, dateOf, fmt, MONTHS_SHORT, getMonthsShort, periodLabel, periodCountLabel, RECUR_FREQ, getFrequencyLabel, installmentLabel, getCategoryLabel } from '../lib/utils'
import { showToast } from './Toast'
import { PaidByStack } from './PaidByStack'
import styles from './PayCard.module.css'

// statusInfo() no es un componente — usa el singleton i18n.t(), mismo
// criterio que greeting()/timeAgo()/getCategoryLabel() en otros archivos.
// Se llama siempre desde dentro de PayCardImpl, que ya usa useTranslation()
// para el resto de su texto, así que ya se re-renderiza solo al cambiar de
// idioma.
function statusInfo(p, cfg) {
  const s = statusOf(p, cfg)
  if (s === 'postponed') return { label: i18n.t('payCard.status.postponed'), color: 'var(--text)', status: s }
  if (s === 'paid')      return { label: p.is_installment ? installmentLabel(p) + ' ✓' : i18n.t('payCard.status.paid'), color: 'var(--paid)', status: s }
  if (s === 'paused')    return { label: i18n.t('payCard.status.paused'), color: 'var(--text)', status: s }
  const d = daysDiff(p.due_date)
  if (s === 'overdue') return { label: d === -1 ? i18n.t('payCard.status.overdueYesterday') : i18n.t('payCard.status.overdueDays', { count: Math.abs(d) }), color: 'var(--danger)', status: s }
  if (s === 'cobro') {
    if (d < 0) return { label: i18n.t('payCard.status.overdueDays', { count: Math.abs(d) }), color: 'var(--danger)', status: s }
    return { label: d === 0 ? i18n.t('payCard.status.dueToday') : i18n.t('payCard.status.dueInDays', { count: d }), color: 'var(--soon-color)', status: s }
  }
  if (d === 0) return { label: i18n.t('payCard.status.dueToday'),    color: 'var(--soon-color)', status: s }
  if (d === 1) return { label: i18n.t('payCard.status.dueTomorrow'), color: 'var(--soon-color)', status: s }
  return { label: i18n.t('payCard.status.dueInDays', { count: d }), color: 'var(--accent)', status: s }
}

// Estados cuyo texto NO depende de la cuenta regresiva de vencimiento (el
// riel ya comunica eso con el color/posición del punto) — estos SÍ se
// siguen mostrando aunque hideDueLabel esté activo, porque no tienen otra
// forma de comunicarse en el riel.
const STATUS_LABELS_ALWAYS_VISIBLE = ['postponed', 'paused']

// Timing de la animación de "marcar como pagado" — ver PayCard.module.css
// para las transiciones CSS que estos valores deben calzar.
const FILL_MS       = 350 // pintado de izquierda a derecha (y su reversa al cancelar un monto variable)
const LABEL_HOLD_MS = 450 // cuánto se queda "Pagado" + checkmark visible antes de deslizarse — cubre los 300ms que tarda en dibujarse el checkmark (ver .checkPath en PayCard.module.css) + una pausa corta para que se alcance a leer
const EXIT_MS       = 320 // deslizado + desvanecido + colapso de espacio
const ENTRY_MS      = 300 // "crecer" al aparecer una card nueva en la lista

function PayCardImpl({ payment: p, cfg, onMarkPaid, onRequestVariableAmount, onConfirmVariablePaid, onRequestNextPeriodConfirm, onMarkUnpaid, onCaptureAmount, onEdit, onAbonar, onSplit, onPayFromFund, fundBalance, onViewSource, onDelete, onPostpone, onAdvance, borderLeft, hideDate, hideDueLabel, railMode, permissions, initialLoad = true, confirmBeforePay, spaceMembers, onSelect, selected }) {
  const { t } = useTranslation()
  // Card de solo lectura — reflejo automático de una contribución a un
  // gasto de un Espacio Compartido (registrada por cualquier miembro desde
  // "Dividir entre miembros"). Nunca se captura a mano, así que no se puede
  // editar/eliminar/pagar desde aquí — la única acción es el ojo, que lleva
  // de vuelta al gasto real en su espacio. Se resuelve ANTES que el resto
  // del componente porque no comparte casi nada del render normal (sin fill
  // animation, sin menú, sin checkmark).
  if (p.is_contribution_reflection) {
    return (
      <div className={styles.cardOuter}>
        <div className={styles.cardWrapper}>
          <div
            onClick={onSelect ? () => onSelect(p.id) : undefined}
            className={`${styles.card} ${onSelect ? styles.cardSelectable : ''} ${selected ? styles.cardSelected : ''}`}
            style={{ borderLeft: `5px solid ${borderLeft || 'var(--border)'}` }}
          >
            <div className={styles.cardContentRow}>
              <div className={styles.infoSection}>
                <div className={styles.name}>{p.name}</div>
              </div>
              <div className={styles.amountSection}>
                <span className={styles.amountText}>{fmt(p.amount)}</span>
                <span className={styles.statusLabel} style={{ color: 'var(--paid)' }}>{t('payCard.status.paid')}</span>
              </div>
              <div className={styles.actionsSection}>
                <button onClick={() => onViewSource && onViewSource(p)} aria-label={t('homePage.viewInSharedSpace')} className={styles.menuTriggerButton}>
                  <Eye size={14} color="var(--text)" style={{ opacity: 0.6 }} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  // Los 2 menús flotantes (opciones y check) se renderizan vía portal
  // directo a document.body (ver más abajo) — desde v0.9.234 dejaron de
  // vivir dentro de .cardOuter porque un ancestro nuevo más arriba
  // (.contentSwipeWrap, el slide de Periodo actual/Próximo periodo) tiene
  // `overflow: hidden` y los recortaba al abrirse hacia arriba cerca del
  // principio de la lista. `menuPos`/`checkMenuPos` guardan la posición en
  // píxeles de viewport (position: fixed), calculada a partir del rect de
  // `.cardOuter` en el momento de abrir — mismo criterio que antes lograba
  // el CSS relativo (`top: 100%`/`bottom: 100%` de `.cardOuter`), solo que
  // ahora hay que calcularlo a mano porque el menú ya no es descendiente
  // de `.cardOuter` en el DOM real. `menuPortalRef` es un ref NUEVO, aparte
  // de `menuRef` — `menuRef` sigue apuntando a `.cardOuter` (se necesita
  // para medir su rect), pero ya no sirve para detectar clicks "afuera" del
  // menú de opciones una vez portalizado (`.contains()` sigue el DOM real,
  // no el árbol de React, así que un click DENTRO del menú portalizado ya
  // no cuenta como estar dentro de `.cardOuter`).
  const [menuPos, setMenuPos] = useState(null)
  const menuPortalRef = useRef(null)
  const [checkMenuOpen,    setCheckMenuOpen]    = useState(false)
  const checkMenuRef = useRef(null)
  const [checkMenuPos, setCheckMenuPos] = useState(null)

  // Fases de la animación de "marcar como pagado":
  // idle → filling → (waitingModal solo si es variable) → labeled → exiting
  // 'reversing' es el camino de vuelta cuando se cancela el modal de monto.
  const [phase, setPhase] = useState('idle')
  const wrapperRef = useRef(null)
  const timers = useRef([])

  useEffect(() => {
    return () => { timers.current.forEach(clearTimeout) }
  }, [])

  // "Crecer" al aparecer: espejo de collapseWrapper() (la salida al marcar
  // pagado), pero de 0 hacia su alto real — solo corre una vez, al montar,
  // y solo si esta card es genuinamente nueva (PayRail ya filtró la carga
  // inicial vía `initialLoad`, ver PayRail.jsx). El alto máximo (140px) es
  // un tope generoso, no el alto exacto — se limpia a `''` (auto) al
  // terminar, para no dejar ninguna card artificialmente topada después.
  useEffect(() => {
    if (initialLoad) return
    const el = wrapperRef.current
    if (!el) return
    el.style.maxHeight = '0px'
    el.style.opacity = '0'
    void el.offsetHeight // fuerza reflow para que la transición sí anime desde este valor
    requestAnimationFrame(() => {
      el.style.maxHeight = '140px'
      el.style.opacity = '1'
    })
    const t = setTimeout(() => {
      el.style.maxHeight = ''
      el.style.opacity = ''
    }, ENTRY_MS)
    timers.current.push(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function after(ms, fn) {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
  }

  // Colapsa el alto real de la card (medido en el momento) a 0, para que la
  // card de abajo suba suavemente en vez de saltar cuando esta se elimine
  // del arreglo. El -8px de marginBottom cancela el `gap: 8px` fijo de
  // `.dayItemsCol` en PayRail.module.css (el gap de flexbox no colapsa solo
  // por reducir el alto del hijo a 0) — si ese gap cambia de valor ahí, hay
  // que actualizarlo aquí también.
  function collapseWrapper() {
    const el = wrapperRef.current
    if (!el) return
    const h = el.offsetHeight
    el.style.maxHeight = `${h}px`
    el.style.marginBottom = '0px'
    void el.offsetHeight // fuerza reflow para que la transición sí anime desde este valor
    requestAnimationFrame(() => {
      el.style.maxHeight = '0px'
      el.style.marginBottom = '-8px'
    })
  }

  // Gate de confirmación para "Próximo periodo" — si esta card viene del
  // riel de "Pagos del próximo periodo" (confirmBeforePay), antes de
  // arrancar CUALQUIER camino de pago (nómina directa o el mini-menú de
  // Espacio Compartido) se pide confirmación explícita, para prevenir que
  // alguien pague por error un pago que en realidad vence hasta el
  // siguiente periodo, confundido de qué switch tiene activo. Mismo patrón
  // de Promise que ya usa onRequestVariableAmount — si se cancela, no pasa
  // nada (ni animación, ni menú, ni guardado).
  async function handleCheckButtonClick(e) {
    e?.stopPropagation()
    if (!canMarkPaid) { blocked(t('paymentsPage.actionMarkPayments')); return }
    if (phase !== 'idle') return
    if (confirmBeforePay && onRequestNextPeriodConfirm) {
      const confirmed = await onRequestNextPeriodConfirm(p)
      if (!confirmed) return
    }
    if (p.space_id && onSplit) {
      openCheckMenuAt()
      return
    }
    handleMarkPaidClick(e)
  }

  async function handleMarkPaidClick(e) {
    e?.stopPropagation()
    if (!canMarkPaid) { blocked(t('paymentsPage.actionMarkPayments')); return }
    if (phase !== 'idle') return
    setPhase('filling')
    after(FILL_MS, async () => {
      if (p.is_variable) {
        setPhase('waitingModal')
        const amount = await onRequestVariableAmount(p)
        if (amount == null) {
          setPhase('reversing')
          after(FILL_MS, () => setPhase('idle'))
        } else {
          setPhase('labeled')
          after(LABEL_HOLD_MS, () => {
            setPhase('exiting')
            collapseWrapper()
            after(EXIT_MS, () => onConfirmVariablePaid(p, amount))
          })
        }
      } else {
        setPhase('labeled')
        after(LABEL_HOLD_MS, () => {
          setPhase('exiting')
          collapseWrapper()
          after(EXIT_MS, () => onMarkPaid(p))
        })
      }
    })
  }
  const info      = statusInfo(p, cfg)
  const showLabel = !hideDueLabel || STATUS_LABELS_ALWAYS_VISIBLE.includes(info.status)
  const d         = dateOf(p.due_date)
  const isPending = !p.is_paid && !p.postponed && !p.paused
  const freqLabel = p.is_recurrent && p.recur_freq && !p.is_installment ? getFrequencyLabel(p.recur_freq) : null
  const instLabel = p.is_installment ? `Pago ${p.current_installment}/${p.total_installments}` : null
  // Fix real (v0.9.259, reportado por Johnatan): `contributed_amount` solo
  // suma `payment_contributions` (abonos de miembros) — el Fondo Compartido
  // NUNCA aparece ahí, vive en su propia columna `fund_amount` sobre
  // `payments`. Antes de este fix, un gasto cubierto SOLO por el Fondo no
  // mostraba ningún progreso en la card, aunque ya tuviera dinero puesto.
  const registradoTotal = Number(p.contributed_amount || 0) + Number(p.fund_amount || 0)

  // Sin `permissions` (modo personal, o dueño del espacio) todo permitido.
  // "Editar"/"Agregar monto" abren un modal que ya se bloquea por su cuenta
  // (PaymentModal/VariableAmountModal) — aquí solo se guardan los flags que
  // SÍ necesitan bloquearse en el momento, porque son acciones directas sin
  // modal de por medio.
  const canMarkPaid = !permissions || permissions.can_mark_paid
  const canEdit     = !permissions || permissions.can_edit
  const canDelete   = !permissions || permissions.can_delete
  function blocked(action) {
    showToast(t('paymentsPage.blockedAction', { action }))
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
    if (isPending && p.space_id && onSplit) count++ // Dividir entre miembros
    if (p.is_paid) count++ // Marcar no pagado
    return count
  }

  function openMenuAt() {
    const rect = menuRef.current.getBoundingClientRect()
    const estimatedHeight = menuItemCount() * 38 + 8
    // La barra de navegación inferior es `position: fixed` (bottom: 16px
    // + ~64px de alto ≈ 90px) — sin restar ese espacio, la cuenta decía
    // que el menú "cabía" contra el alto completo de la pantalla, aunque
    // en la práctica la barra lo tapara. Bug real reportado por Johnatan
    // (volvió a aparecer sin que la lógica en sí se hubiera roto).
    const BOTTOM_NAV_SAFE_AREA = 90
    const upward = rect.bottom + estimatedHeight > window.innerHeight - BOTTOM_NAV_SAFE_AREA
    setMenuPos({
      right: window.innerWidth - rect.right,
      top: upward ? null : rect.bottom + 4,
      bottom: upward ? window.innerHeight - rect.top + 4 : null,
    })
    setMenuOpen(true)
  }

  useEffect(() => {
    function handle(e) {
      if (menuRef.current && menuRef.current.contains(e.target)) return
      if (menuPortalRef.current && menuPortalRef.current.contains(e.target)) return
      setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [menuOpen])

  // Mini-menú del check en un pago PENDIENTE de un Espacio Compartido —
  // "Pagar de mi nómina" (como ya funciona hoy) vs "Pago compartido" (abre
  // Dividir). Existe para que la gente descubra que se puede dividir sin
  // tener que encontrar la opción enterrada en el menú de 3 puntos.
  function openCheckMenuAt() {
    const rect = menuRef.current.getBoundingClientRect()
    const itemCount = (onPayFromFund && fundBalance > 0) ? 3 : 2
    const estimatedHeight = itemCount * 38 + 8
    const BOTTOM_NAV_SAFE_AREA = 90
    const upward = rect.bottom + estimatedHeight > window.innerHeight - BOTTOM_NAV_SAFE_AREA
    setCheckMenuPos({
      right: window.innerWidth - rect.right,
      top: upward ? null : rect.bottom + 4,
      bottom: upward ? window.innerHeight - rect.top + 4 : null,
    })
    setCheckMenuOpen(true)
  }

  useEffect(() => {
    function handle(e) { if (checkMenuRef.current && !checkMenuRef.current.contains(e.target)) setCheckMenuOpen(false) }
    if (checkMenuOpen) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [checkMenuOpen])

  const contentHidden = phase === 'waitingModal' || phase === 'labeled' || phase === 'exiting'
  const fillActive    = phase === 'filling' || phase === 'waitingModal' || phase === 'labeled' || phase === 'exiting'

  return (
    <div ref={menuRef} className={styles.cardOuter}>
      <div ref={wrapperRef} className={styles.cardWrapper}>
      <div
        onClick={onSelect ? () => onSelect(p.id) : undefined}
        className={`${styles.card} ${phase === 'exiting' ? styles.cardExiting : ''} ${onSelect ? styles.cardSelectable : ''} ${selected ? styles.cardSelected : ''}`}
        style={{ borderLeft: railMode ? 'none' : `5px solid ${borderLeft || 'var(--border)'}` }}
      >
        <div className={`${styles.fillLayer} ${fillActive ? styles.fillLayerActive : ''}`} />
        <div className={`${styles.fillLabel} ${phase === 'labeled' || phase === 'exiting' ? styles.fillLabelVisible : ''}`}>
          <span>{p.is_installment && p.current_installment === p.total_installments ? t('payCard.allPaymentsDone') : t('payCard.status.paid')}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              className={`${styles.checkPath} ${phase === 'labeled' || phase === 'exiting' ? styles.checkPathDrawn : ''}`}
              d="M4 12.5l5.5 5.5L20 6.5"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className={`${styles.cardContentRow} ${contentHidden ? styles.cardContentHidden : ''}`}>
          {/* Info izquierda */}
          <div className={styles.infoSection}>
            <div className={styles.name}>
              {p.name}
            </div>
            <div className={styles.subtitle}>
              {p.space_id && isPending && registradoTotal > 0
                ? `${fmt(registradoTotal)} / ${fmt(p.amount)}`
                : hideDate ? getCategoryLabel(p.category) : `${getCategoryLabel(p.category)} · ${d.getDate()} ${getMonthsShort()[d.getMonth()]}`}
            </div>
            {p.space_id && isPending && registradoTotal > 0 && (
              <PaidByStack contributors={p.contributors} members={spaceMembers} fundAmount={p.fund_amount || 0} size={16} />
            )}
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
                  <DollarSign size={12} strokeWidth={2.5} /> {t('payCard.addAmount')}
                </button>
                <span className={styles.variableTag}>{t('payCard.variableTag')}</span>
              </div>
            ) : p.is_variable && !p.is_paid ? (
              <div className={styles.variableGroupTight}>
                <div className={styles.amountText}>{fmt(p.amount)}</div>
                <span className={styles.variableTag}>{t('payCard.variableTag')}</span>
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
                onClick={handleCheckButtonClick}
                disabled={phase !== 'idle'}
                className={styles.markPaidButton}
                aria-label={t('payCard.markPaidAriaLabel')}
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
              onClick={e => { e.stopPropagation(); menuOpen ? setMenuOpen(false) : openMenuAt() }}
              className={styles.menuTriggerButton}
              aria-label={t('payCard.menuTriggerAriaLabel')}
            >
              <MoreVertical size={15} color="var(--text)" />
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* Menú contextual — se renderiza vía portal directo a document.body
          (ver menuPos arriba), NO como descendiente normal de .cardOuter.
          Antes vivía dentro de .cardOuter (fuera de .cardWrapper, que tiene
          overflow:hidden para la animación de colapso/crecimiento) y eso
          bastaba — pero desde que existe .contentSwipeWrap (slide de
          Periodo actual/Próximo periodo, con SU PROPIO overflow:hidden más
          arriba en el árbol) ya no alcanza: cualquier ancestro con overflow
          hidden en cualquier nivel lo recorta. Un portal es la única forma
          de escapar de verdad, sin importar cuántos overflow:hidden haya
          arriba. */}
      {menuOpen && menuPos && createPortal(
        <div
          ref={menuPortalRef}
          className={styles.contextMenu}
          style={{
            position: 'fixed',
            right: menuPos.right,
            top: menuPos.top != null ? menuPos.top : 'auto',
            bottom: menuPos.bottom != null ? menuPos.bottom : 'auto',
          }}
        >
          {isPending && p.is_installment && onAbonar && <MenuItem icon={<DollarSign size={14}/>} label={t('payCard.menu.contribute')} onClick={() => { canMarkPaid ? onAbonar(p) : blocked(t('paymentsPage.actionRegisterContributions')); setMenuOpen(false) }} />}
          {isPending && !p.is_installment && <MenuItem icon={<Pencil size={14}/>} label={t('buttons.edit')} onClick={() => { onEdit(p); setMenuOpen(false) }} />}
          {isPending && p.is_variable && onCaptureAmount && <MenuItem icon={<DollarSign size={14}/>} label={p.amount ? t('payCard.editAmount') : t('payCard.addAmount')} onClick={() => { onCaptureAmount(p); setMenuOpen(false) }} />}
          {isPending && p.is_recurrent && !p.is_installment && <MenuItem icon={<Clock size={14}/>} label={t('payCard.menu.postpone')} onClick={() => { canEdit ? onPostpone(p) : blocked(t('payCard.actions.postponePayments')); setMenuOpen(false) }} />}
          {isPending && p.is_installment && onAdvance && <MenuItem icon={<FastForward size={14}/>} label={t('payCard.menu.advance')} onClick={() => { canEdit ? onAdvance(p) : blocked(t('payCard.actions.advancePayments')); setMenuOpen(false) }} />}
          {isPending && p.space_id && onSplit && <MenuItem icon={<Users size={14}/>} label={t('paymentsPage.menuSplit')} onClick={() => { canMarkPaid ? onSplit(p) : blocked(t('paymentsPage.actionRegisterContributions')); setMenuOpen(false) }} />}
          {p.is_paid && <MenuItem icon={<RotateCcw size={14}/>} label={t('payCard.menu.markUnpaid')} onClick={() => { canMarkPaid ? onMarkUnpaid(p.id) : blocked(t('paymentsPage.actionMarkPayments')); setMenuOpen(false) }} />}
          <MenuItem icon={<Trash2 size={14}/>} label={t('buttons.delete')} onClick={() => { canDelete ? onDelete(p.id) : blocked(t('paymentsPage.actionDeletePayments')); setMenuOpen(false) }} danger />
        </div>,
        document.body
      )}

      {/* Mini-menú del check ("Pagar de mi nómina" / "Pago compartido") —
          mismo motivo y misma solución que el de arriba: portal a
          document.body, con posición en píxeles (checkMenuPos). */}
      {checkMenuOpen && checkMenuPos && createPortal(
        <div
          ref={checkMenuRef}
          className={styles.contextMenu}
          style={{
            position: 'fixed',
            right: checkMenuPos.right,
            top: checkMenuPos.top != null ? checkMenuPos.top : 'auto',
            bottom: checkMenuPos.bottom != null ? checkMenuPos.bottom : 'auto',
          }}
        >
          <MenuItem icon={<Check size={14}/>} label={t('payCard.menu.payFromPayroll')} onClick={() => { setCheckMenuOpen(false); handleMarkPaidClick() }} />
          {onPayFromFund && fundBalance > 0 && (
            <MenuItem icon={<PiggyBank size={14}/>} label={t('paymentsPage.sharedFund')} onClick={() => { setCheckMenuOpen(false); onPayFromFund(p) }} />
          )}
          <MenuItem icon={<Users size={14}/>} label={t('payCard.menu.sharedPayment')} onClick={() => { setCheckMenuOpen(false); onSplit(p) }} />
        </div>,
        document.body
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
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const allItems  = [group, ...group._children]
  const paidItems = allItems.filter(p => p.is_paid)
  const totalPaid = paidItems.reduce((a, p) => a + Number(p.amount), 0)
  const freq      = group.recur_freq || 'monthly'
  const freqLabel = getFrequencyLabel(freq)
  const isPending = !group.is_paid && !group.postponed && !group.paused
  const countLabel = group.is_installment
    ? t('payCard.group.installmentsCount', { paid: paidItems.length, total: group.total_installments })
    : periodCountLabel(paidItems.length, freq) + ' ' + t('payCard.group.paidCount')

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
            const instLabel = p.is_installment ? t('paymentModal.editInstallment.badge', { current: p.current_installment, total: p.total_installments }) : periodLabel(p.due_date, freq)
            const bColor   = p.is_paid ? 'var(--paid)' : p.postponed ? 'var(--muted)' : overdue ? 'var(--danger)' : 'var(--soon-color)'
            const bLabel   = p.is_paid ? t('payCard.status.paid') : p.postponed ? t('payCard.status.postponed') : overdue ? t('payCard.status.overdue') : t('payCard.status.pending')
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

// v0.9.282 — React.memo: PayCard es el componente que más veces se repite
// en pantalla (cada pago pendiente/vencido/próximo es una instancia). Sin
// memo, CUALQUIER re-render de HomePage (swipe de tarjetas, abrir/cerrar el
// colapsable de pagados, animaciones) re-renderizaba TODAS las cards aunque
// sus props no hubieran cambiado. Con memo (comparación superficial
// default), una card solo se re-renderiza si SU pago (u otra prop) cambió
// de identidad. Requiere que quien la use no le pase objetos/funciones
// recreados en cada render — ver el useMemo de `handlers` en HomePage.jsx
// y el spread estable en PayRail.jsx (misma versión).
export const PayCard = memo(PayCardImpl)
