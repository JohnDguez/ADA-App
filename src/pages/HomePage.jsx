import { useState, useRef, useEffect, useId } from 'react'
import { ChevronDown, ChevronUp, Check, RotateCcw } from 'lucide-react'
import { PayCard } from '../components/PayCard'
import { PayRail } from '../components/PayRail'
import { PageHeader } from '../components/PageHeader'
import { NotificationsPanel } from '../components/NotificationsPanel'
import { NewSharedSpacePanel } from '../components/NewSharedSpacePanel'
import { EmptyState } from '../components/EmptyState'
import { fmt, cobroPeriod, nextCobroPeriod, getPagarEsteCobro, daysDiff, dateOf, dateToStr, MONTHS, MONTHS_SHORT } from '../lib/utils'
import styles from './HomePage.module.css'

function periodRange(cfg) {
  const { start, end } = cobroPeriod(cfg)
  const sameMonth = start.getMonth() === end.getMonth()
  if (sameMonth) return `${start.getDate()} – ${end.getDate()} ${MONTHS[end.getMonth()]}`
  return `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}`
}

function nextPeriodRange(cfg) {
  const { start, end } = nextCobroPeriod(cfg)
  const sameMonth = start.getMonth() === end.getMonth()
  if (sameMonth) return `${start.getDate()} – ${end.getDate()} ${MONTHS[end.getMonth()]}`
  return `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}`
}

// Medio anillo tipo velocímetro — tercer rediseño de las tarjetas "Pagos de
// este periodo"/"Por pagar este mes" (los dos anteriores, anillo completo y
// tarjeta-relleno, no convencieron a Johnatan). Mockup confirmado con la
// referencia "Current balance" que trajo. El % se dibuja DENTRO del anillo,
// centrado a 55% de la altura (no más arriba — Johnatan lo pidió más al
// medio del hueco del arco). Track siempre semicírculo completo (180°, de
// izquierda a derecha pasando por arriba); el arco de progreso anima de 0%
// al valor real cada vez que el componente se monta (o cuando cambia
// `percent`, ej. al cambiar de espacio) — mockup confirmado con Johnatan:
// debe verse "llenarse" cada vez que se entra a la página, no aparecer ya
// lleno de golpe.
function HalfRing({ percent, width = 220, strokeWidth = 14 }) {
  const r  = (width - strokeWidth) / 2
  const cx = width / 2
  const cy = r + strokeWidth / 2
  const height = cy + strokeWidth / 2 + 2
  const target = Math.max(0, Math.min(1, percent))
  // Id único del degradado — hacen falta 2 HalfRing en el DOM a la vez
  // (tarjetas Periodo y Mes, una fuera de vista por el swipe), y los ids de
  // <defs> son globales al documento — sin esto, ambos anillos apuntarían
  // al MISMO degradado (el del que se definió primero).
  const gradId = useId()

  const [animated, setAnimated] = useState(0)
  useEffect(() => {
    let raf
    const t0 = performance.now()
    const duration = 900
    function frame(now) {
      const t = Math.min(1, (now - t0) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      setAnimated(target * eased)
      if (t < 1) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [target])

  const start = { x: cx - r, y: cy }
  const end   = { x: cx + r, y: cy }
  const trackD = `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`
  // Punto de la bolita: SIEMPRE en la punta real del progreso animado (no
  // solo cuando animated > 0) — así, en 0%, la bolita ya está en su lugar
  // de reposo (el inicio del anillo) en vez de aparecer de la nada.
  const angle = Math.PI - animated * Math.PI
  const dotPoint = { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) }
  let progressD = null
  if (animated > 0) {
    // Medio anillo: el barrido nunca pasa de 180°, así que este flag SIEMPRE
    // es 0 — a diferencia del anillo completo (360°), donde sí hacía falta
    // alternarlo pasado el 50%. Ponerlo en 1 aquí le pedía al SVG dibujar el
    // arco "por el otro lado" (por debajo de la línea base, fuera del
    // lienzo) — bug real que Johnatan encontró probando en su teléfono: solo
    // se veían las puntas redondeadas de stroke-linecap, sin la curva
    // conectándolas, porque el arco de en medio se dibujaba fuera de vista.
    const largeArc = 0
    // La línea llega hasta el centro exacto de la bolita — el "corte" que
    // los separa visualmente NO es un hueco angular (se probó y no
    // convenció), sino el borde de la propia bolita (ver <circle> abajo),
    // del color de fondo de la tarjeta, que tapa la unión.
    progressD = `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${dotPoint.x} ${dotPoint.y}`
  }
  return (
    <div className={styles.halfRingWrapper} style={{ width, height }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          {/* Excepción intencional a "nunca colores hardcodeados / sin
              degradados" — confirmado con Johnatan, replica el isotipo del
              logo de LunaPay (verde del anillo hacia azul de marca en la
              bolita). Documentado en CONTEXT.md junto con las demás
              excepciones fijas (Premium). */}
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--paid)" />
            <stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        <path d={trackD} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} strokeLinecap="round" />
        {progressD && <path d={progressD} fill="none" stroke={`url(#${gradId})`} strokeWidth={strokeWidth} strokeLinecap="round" />}
        {/* Bolita del isotipo — el borde del color de fondo de la tarjeta
            (var(--surface)) es lo que la hace verse "cortada" de la línea,
            en vez de un hueco angular (mockup confirmado con Johnatan). */}
        <circle cx={dotPoint.x} cy={dotPoint.y} r={strokeWidth * 0.65} fill="var(--accent)" stroke="var(--surface)" strokeWidth={3} />
      </svg>
      <div className={styles.halfRingPercentWrapper}>
        <span className={styles.halfRingPercentText}>{Math.round(animated * 100)}%</span>
      </div>
    </div>
  )
}

export function HomePage({ payments, profile, spaceSwitcher, activeSpaceHeader, activeSpaceId, sharedSpaces, spacePermissions, onOpenPremium, onSpaceReady, onAdd, onMarkPaid, onRequestVariableAmount, onConfirmVariablePaid, onMarkUnpaid, onCaptureAmount, onEdit, onAbonar, onDelete, onPostpone, onAdvance, onGoSettings, notifications, unreadCount, onMarkAsRead, onMarkAllAsRead, onDeleteNotif, onClearAllNotifs, slideClass }) {
  // Detecta un cambio REAL de espacio activo (no el primer montaje de la
  // página, que también dispararía un `key` remontado sin querer) — antes
  // se usaba `key={activeSpaceId}` para forzar el remontado del contenido,
  // pero eso se disparaba CADA VEZ que se entraba a la pestaña (Inicio ya
  // se monta de cero al cambiar de tab), sumándose sin querer a la
  // animación horizontal de cambio de pestaña y dando un efecto diagonal
  // raro (bug real que Johnatan encontró). Con este ref, la animación solo
  // se activa cuando el espacio cambia MIENTRAS la página ya está montada.
  const prevSpaceRef = useRef(activeSpaceId)
  const [spaceJustChanged, setSpaceJustChanged] = useState(false)
  useEffect(() => {
    if (prevSpaceRef.current !== activeSpaceId) {
      setSpaceJustChanged(true)
      prevSpaceRef.current = activeSpaceId
      const timer = setTimeout(() => setSpaceJustChanged(false), 300)
      return () => clearTimeout(timer)
    }
  }, [activeSpaceId])

  const [notifOpen,      setNotifOpen]      = useState(false)
  const [activeCard,     setActiveCard]     = useState(0)
  const [touchStartX,    setTouchStartX]    = useState(null)
  const [showNextPeriod, setShowNextPeriod] = useState(() =>
    localStorage.getItem('ada_show_next_period') !== 'false'
  )
  const [paidExpanded, setPaidExpanded] = useState(false)

  function toggleNextPeriod() {
    const next = !showNextPeriod
    setShowNextPeriod(next)
    localStorage.setItem('ada_show_next_period', String(next))
  }

  const now         = new Date()
  const { start, end } = cobroPeriod(profile)
  const { start: nextStart, end: nextEnd } = nextCobroPeriod(profile)

  const pagarEsteCobro = getPagarEsteCobro(payments, profile)
  const vencidos   = pagarEsteCobro.filter(p => daysDiff(p.due_date) < 0).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))
  const delPeriodo = pagarEsteCobro.filter(p => daysDiff(p.due_date) >= 0).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))
  // Un variable YA con monto capturado (ej. "Agregar monto" con el recibo en
  // mano) cuenta igual que uno fijo — ya se sabe cuánto va a costar. Solo el
  // que sigue sin monto es el que de verdad está "por confirmar".
  const pendingAmt = pagarEsteCobro.filter(p => !p.is_variable || p.amount > 0).reduce((a, p) => a + Number(p.amount), 0)
  const pendingVariableCount = pagarEsteCobro.filter(p => p.is_variable && !p.amount).length

  // Pagos ya pagados dentro del periodo actual — mismo criterio que
  // `gastosPeriodo`/`checkPeriodStart` en `PaymentsPage.jsx`: se filtra por
  // `paid_at` (el dinero cuenta cuando sale del bolsillo), NO por `due_date`.
  // Antes filtraba por due_date, lo que hacía que el total no coincidiera
  // con "Disponible este periodo" — corregido para que ambas pantallas
  // siempre cuadren, usando la misma fuente de verdad.
  const pagadosEstePeriodo = payments
    .filter(p => {
      if (!p.is_paid || p.is_master || !p.paid_at) return false
      const paidDate = dateOf(dateToStr(new Date(p.paid_at)))
      return paidDate >= start && paidDate <= end
    })
    .sort((a, b) => new Date(a.paid_at) - new Date(b.paid_at))
  const pagadoMonto = pagadosEstePeriodo.reduce((a, p) => a + Number(p.amount), 0)
  const totalConocido = pagadoMonto + pendingAmt
  const pctPagado = totalConocido > 0 ? Math.round((pagadoMonto / totalConocido) * 100) : 0
  const pagosFijosCount = pagarEsteCobro.filter(p => !p.is_variable || p.amount > 0).length + pagadosEstePeriodo.length
  // Solo para el estado "sin pagos pendientes" (pagarEsteCobro vacío): antes
  // no se mostraba nada de cuántos pagos hubo este periodo al marcarlos
  // todos como pagados — Johnatan pidió que sí se muestre, separando fijos
  // de variables (mismo criterio de "es variable" que el resto de la app).
  const pagadosFijosEstePeriodo     = pagadosEstePeriodo.filter(p => !p.is_variable).length
  const pagadosVariablesEstePeriodo = pagadosEstePeriodo.filter(p => p.is_variable).length

  const thisMonth  = now.getMonth()
  const thisYear   = now.getFullYear()
  const paidThisMonth = payments.filter(p => {
    if (!p.is_paid) return false
    const d = dateOf(p.due_date)
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear
  })
  const variableThisMonth = paidThisMonth.filter(p => p.is_variable).length
  // Igual que en el periodo — para el estado "sin pagos pendientes" de la
  // tarjeta Mes, cuántos de los ya pagados fueron fijos vs variables.
  const paidFixedThisMonth = paidThisMonth.length - variableThisMonth
  const paidThisMonthAmt  = paidThisMonth.reduce((a, p) => a + Number(p.amount), 0)
  const totalThisMonth = payments.filter(p => {
    const d = dateOf(p.due_date)
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear && !p.paused
  }).reduce((a, p) => a + Number(p.amount), 0)
  const pendingThisMonthAmt = Math.max(totalThisMonth - paidThisMonthAmt, 0)
  const pctPagadoMes = totalThisMonth > 0 ? Math.round((paidThisMonthAmt / totalThisMonth) * 100) : 0

  // Solo pagos DENTRO del próximo periodo (no todos los futuros)
  const upcoming = payments.filter(p => {
    if (p.is_paid || p.paused || p.postponed || p.is_master) return false
    const d = dateOf(p.due_date)
    return d >= nextStart && d <= nextEnd
  }).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))

  // Card 2 de la tarjeta de métricas — para usuarios con periodo de cobro
  // Mensual, "Mes" mostraba exactamente el mismo rango que "Periodo"
  // (redundante cuando el corte mensual es el día 1, ya que el periodo de
  // cobro completo coincide con el mes calendario). Para ellos la pestaña
  // pasa a llamarse "Próximo periodo" y muestra el periodo siguiente en vez de
  // repetir el actual — mismo diseño de tarjeta/anillo, solo cambia la
  // data. Como ese periodo aún no arranca, nada está "pagado" todavía: el
  // anillo se queda vacío (0%) y la fila de pagado/pendiente se reemplaza
  // por un solo total "programado" (decisión de Johnatan, para no mostrar
  // un confuso "$0.00 pagado"). Mismo criterio de pago fijo/variable ya
  // usado para `pendingAmt`/`pendingVariableCount` del periodo actual.
  const isMonthly = profile.cobro_freq === 'monthly'
  const nextMonthKnownTotal          = upcoming.filter(p => !p.is_variable || p.amount > 0).reduce((a, p) => a + Number(p.amount), 0)
  const nextMonthFixedCount          = upcoming.filter(p => !p.is_variable || p.amount > 0).length
  const nextMonthPendingVariableCount = upcoming.filter(p => p.is_variable && !p.amount).length

  const handlers = { onMarkPaid, onRequestVariableAmount, onConfirmVariablePaid, onMarkUnpaid, onCaptureAmount, onEdit, onAbonar, onDelete, onPostpone, onAdvance }

  return (
    <div className={styles.pageRoot}>
      <PageHeader
        profile={profile}
        unreadCount={unreadCount}
        onOpenNotifs={() => setNotifOpen(true)}
        onGoSettings={onGoSettings}
      />

      <div className={styles.roundedContentWrapper}>
        {spaceSwitcher}

        {activeSpaceHeader}

        <div className={slideClass}>
        <div className={spaceJustChanged ? 'content-slide-up' : ''}>

        {activeSpaceId === 'new' ? (
          <div className={styles.newSpacePanelWrapper}>
            <NewSharedSpacePanel
              profile={profile}
              sharedSpaces={sharedSpaces}
              onOpenPremium={onOpenPremium}
              onCreated={onSpaceReady}
              onJoined={onSpaceReady}
            />
          </div>
        ) : (
        <>
        {/* Tabs Periodo / Mes — switch deslizante real (track + thumb que se
            mueve), no 2 botones que solo cambian de color. Excepción
            consciente a "border-radius: 5 en todo" (mockup confirmado con
            Johnatan): los controles de 2 posiciones (switches/segmented
            controls) son la única categoría donde la forma de píldora
            aplica — es la convención universal para ese tipo de control,
            no una adopción general de curvas por el logo. Este es el
            patrón oficial a reusar en cualquier otro switch de 2
            posiciones que se agregue después (ej. futuros toggles en
            Ajustes) — no repetir el estilo viejo de 5px para eso. */}
        <div data-coachmark="home-metric-card" className={styles.metricCardSection}>
          <div className={styles.tabTrack}>
            <div className={styles.tabThumb} style={{ transform: `translateX(${activeCard * 100}%)` }} />
            <button
              onClick={() => setActiveCard(0)}
              className={`${styles.tabButton} ${activeCard === 0 ? styles.tabButtonActive : ''}`}
            >
              Periodo
            </button>
            <button
              onClick={() => setActiveCard(1)}
              className={`${styles.tabButton} ${activeCard === 1 ? styles.tabButtonActive : ''}`}
            >
              {isMonthly ? 'Próximo periodo' : 'Mes actual'}
            </button>
          </div>

          <div
            className={styles.cardSwipeWrapper}
            onTouchStart={e => setTouchStartX(e.touches[0].clientX)}
            onTouchEnd={e => {
              if (touchStartX === null) return
              const dx = e.changedTouches[0].clientX - touchStartX
              if (dx < -40) setActiveCard(1)
              if (dx > 40)  setActiveCard(0)
              setTouchStartX(null)
            }}
          >
            <div className={styles.cardSwipeTrack} style={{ transform: `translateX(${activeCard * -100}%)` }}>

              {/* Card 1 — Periodo actual. Medio anillo tipo gauge (mockup
                  confirmado con Johnatan, referencia "Current balance" que
                  trajo) — tercer rediseño de esta tarjeta. Orden dentro de
                  la tarjeta, de arriba a abajo: fecha (recuadro var(--bg),
                  efecto de "hueco"), anillo con el %, pagado/pendiente
                  PEGADO al anillo (explica directamente el % que se ve
                  arriba), luego título/monto/estatus (fijos, vencido,
                  variables — info administrativa, no directamente ligada
                  al anillo, por eso va después). */}
              <div className={styles.metricCard}>
                {pagarEsteCobro.length === 0 ? (
                  <>
                    <div className={styles.dateBadge}>
                      Periodo {periodRange(profile)}
                    </div>
                    <div className={styles.clearFloat} />
                    <HalfRing percent={1} />
                    <div className={styles.cardTitle}>Total de este periodo</div>
                    <div className={styles.cardAmount}>{fmt(pagadoMonto)}</div>
                    {(pagadosFijosEstePeriodo > 0 || pagadosVariablesEstePeriodo > 0) && (
                      <div className={styles.cardMeta}>
                        {pagadosFijosEstePeriodo} pago{pagadosFijosEstePeriodo !== 1 ? 's' : ''} fijo{pagadosFijosEstePeriodo !== 1 ? 's' : ''}
                        {pagadosVariablesEstePeriodo > 0 && ` · ${pagadosVariablesEstePeriodo} variable${pagadosVariablesEstePeriodo !== 1 ? 's' : ''}`}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className={styles.dateBadge}>
                      Periodo {periodRange(profile)}
                    </div>
                    <div className={styles.clearFloat} />
                    <HalfRing percent={pctPagado / 100} />
                    <div className={styles.cardPaidPendingRow}>
                      <span className={styles.cardPaidText}>{fmt(pagadoMonto)} pagado</span>
                      <span className={styles.cardPendingText}>{fmt(pendingAmt)} pendiente</span>
                    </div>
                    <div className={styles.cardTitle}>Total de este periodo</div>
                    <div className={styles.cardAmount}>{fmt(totalConocido)}</div>
                    <div className={styles.cardMeta}>
                      {pagosFijosCount} pago{pagosFijosCount !== 1 ? 's' : ''} fijo{pagosFijosCount !== 1 ? 's' : ''}
                      {vencidos.length > 0 && <span className={styles.cardMetaDanger}> · {vencidos.length} pago{vencidos.length !== 1 ? 's' : ''} vencido{vencidos.length !== 1 ? 's' : ''}</span>}
                    </div>
                    {pendingVariableCount > 0 && (
                      <div className={styles.cardVariableNote}>
                        {pendingVariableCount} pago{pendingVariableCount !== 1 ? 's' : ''} variable{pendingVariableCount !== 1 ? 's' : ''} por confirmar
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Card 2 — Este mes / Próximo periodo. Mismo tratamiento visual
                  que Card 1 en los 3 casos. */}
              <div className={styles.metricCard}>
                {isMonthly ? (
                  <>
                    <div className={styles.dateBadge}>
                      {nextPeriodRange(profile)}
                    </div>
                    <div className={styles.clearFloat} />
                    <HalfRing percent={0} />
                    <div className={styles.cardTitle}>Total del próximo periodo</div>
                    <div className={styles.cardAmount}>{fmt(nextMonthKnownTotal)}</div>
                    <div className={styles.cardMeta}>
                      {nextMonthFixedCount} pago{nextMonthFixedCount !== 1 ? 's' : ''} fijo{nextMonthFixedCount !== 1 ? 's' : ''}
                    </div>
                    {nextMonthPendingVariableCount > 0 && (
                      <div className={styles.cardVariableNote}>
                        {nextMonthPendingVariableCount} pago{nextMonthPendingVariableCount !== 1 ? 's' : ''} variable{nextMonthPendingVariableCount !== 1 ? 's' : ''} por confirmar
                      </div>
                    )}
                  </>
                ) : pendingThisMonthAmt <= 0 ? (
                  <>
                    <div className={styles.dateBadge}>
                      {MONTHS[thisMonth]} {thisYear}
                    </div>
                    <div className={styles.clearFloat} />
                    <HalfRing percent={1} />
                    <div className={styles.cardTitle}>Total de este mes</div>
                    <div className={styles.cardAmount}>{fmt(paidThisMonthAmt)}</div>
                    {(paidFixedThisMonth > 0 || variableThisMonth > 0) && (
                      <div className={styles.cardMeta}>
                        {paidFixedThisMonth} pago{paidFixedThisMonth !== 1 ? 's' : ''} fijo{paidFixedThisMonth !== 1 ? 's' : ''}
                        {variableThisMonth > 0 && ` · ${variableThisMonth} variable${variableThisMonth !== 1 ? 's' : ''}`}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className={styles.dateBadge}>
                      {MONTHS[thisMonth]} {thisYear}
                    </div>
                    <div className={styles.clearFloat} />
                    <HalfRing percent={pctPagadoMes / 100} />
                    <div className={styles.cardPaidPendingRow}>
                      <span className={styles.cardPaidText}>{fmt(paidThisMonthAmt)} pagado</span>
                      <span className={styles.cardPendingText}>{fmt(pendingThisMonthAmt)} pendiente</span>
                    </div>
                    <div className={styles.cardTitle}>Total de este mes</div>
                    <div className={styles.cardAmount}>{fmt(totalThisMonth)}</div>
                    <div className={styles.cardMeta}>
                      {paidThisMonth.length} pagado{paidThisMonth.length !== 1 ? 's' : ''}
                      {variableThisMonth > 0 && ` · ${variableThisMonth} variable${variableThisMonth !== 1 ? 's' : ''}`}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.contentPadding}>

          {/* Colapsable de pagados — justo debajo de la card de métricas */}
          {pagadosEstePeriodo.length > 0 && (
            <div data-coachmark="home-paid-collapse" className={styles.paidCollapseWrapper}>
              <PaidCollapse
                payments={pagadosEstePeriodo}
                expanded={paidExpanded}
                onToggle={() => setPaidExpanded(v => !v)}
                onMarkUnpaid={onMarkUnpaid}
              />
            </div>
          )}

          {/* Vencidos */}
          {vencidos.length > 0 && (
            <div className={styles.overdueSection}>
              <div className={styles.overdueTitle}>
                Vencidos
              </div>
              <PayRail payments={vencidos} cfg={profile} dotColor="var(--overdue-border)" dotTextColor="var(--overdue-text)" handlers={handlers} permissions={spacePermissions} />
            </div>
          )}

          {/* Pagos del periodo (antes "Próximos a vencer" — se renombró porque
              puede haber pagos por vencer que en realidad son de OTRO periodo,
              y esta sección es específicamente la del periodo actual) */}
          {/* v0.9.176 — un amigo de Johnatan probó la app sin ver el coach
              mark y no encontró cómo agregar un pago desde una sección vacía.
              El estado vacío ahora es un área tipo drop-zone (borde punteado,
              tocable) que abre onAdd directo, inspirado en el patrón de Budge.
              Cuando NO hay datos ni en este periodo ni en el próximo, la
              sección "Próximo periodo" completa (header + toggle) se oculta y
              esta única área cubre ambos casos — no tiene sentido un segundo
              bloque vacío debajo del primero. En cuanto cualquiera de los dos
              tenga datos, "Próximo periodo" vuelve a aparecer con su toggle. */}
          {(() => {
            const currentEmpty = delPeriodo.length === 0
            const nextEmpty     = upcoming.length === 0
            const mergeEmpty    = currentEmpty && nextEmpty

            return (
              <>
                <div data-coachmark="home-rail" className={styles.periodSection}>
                  <SectionHead left="Pagos del periodo" right={`Periodo ${periodRange(profile)}`} />

                  {currentEmpty
                    ? <EmptyState title="Sin pagos pendientes para este periodo" subtitle="Toca aquí o el botón + de abajo para añadir uno" onClick={onAdd} />
                    : <PayRail payments={delPeriodo} cfg={profile} dotColor="var(--upcoming-border)" dotTextColor="var(--impact-warning-text)" handlers={handlers} permissions={spacePermissions} />
                  }
                </div>

                {!mergeEmpty && (
                  <>
                    {/* Próximo periodo — toggle + filtro exacto al periodo */}
                    <div className={styles.nextPeriodSection}>
                      <div className={styles.nextPeriodHeader}>
                        <span className={styles.nextPeriodLabel}>Próximo periodo</span>
                        <div onClick={toggleNextPeriod} className={styles.toggleClickWrap}>
                          <div className="toggle-track" style={{ background: showNextPeriod ? 'var(--accent)' : 'var(--border)' }}>
                            <div className="toggle-thumb" style={{ left: showNextPeriod ? 19 : 3 }} />
                          </div>
                        </div>
                      </div>
                      <span className={styles.nextPeriodRangeText}>
                        {nextPeriodRange(profile)}
                      </span>
                    </div>

                    {showNextPeriod && (
                      nextEmpty
                        ? <EmptyState title="Sin pagos registrados para el próximo periodo" subtitle="Toca aquí o el botón + de abajo para añadir uno" onClick={onAdd} />
                        : <div className={styles.upcomingListWrapper}>
                            <PayRail payments={upcoming} cfg={profile} dotColor="var(--accent)" dotTextColor="var(--bg)" handlers={handlers} permissions={spacePermissions} />
                          </div>
                    )}
                  </>
                )}
              </>
            )
          })()}
        </div>
        </>
        )}
        </div>
        </div>
      </div>

      <NotificationsPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkAsRead={onMarkAsRead}
        onMarkAllAsRead={onMarkAllAsRead}
        onDelete={onDeleteNotif}
        onClearAll={onClearAllNotifs}
        onNavigate={() => window.scrollTo(0, 0)}
      />
    </div>
  )
}

function SectionHead({ left, right }) {
  return (
    <div className={styles.sectionHead}>
      <span className={styles.sectionHeadLeft}>{left}</span>
      {right && <span className={styles.sectionHeadRight}>{right}</span>}
    </div>
  )
}

// (Empty/EmptyState ahora vive en components/EmptyState.jsx — extraído en
// v0.9.176 para poder reutilizarlo fuera de Home)

// Timing de la animación de "marcar como no pagado" en PaidCollapse — mismo
// criterio que FILL_MS/LABEL_HOLD_MS/EXIT_MS en PayCard.jsx, pero en
// reversa: pinta de var(--upcoming-border) de derecha a izquierda, y sale
// deslizándose hacia la izquierda (el opuesto de cómo una card sale hacia
// la derecha al pagar).
const UNMARK_FILL_MS = 350
const UNMARK_HOLD_MS = 400
const UNMARK_EXIT_MS = 320

// Fila individual del colapsable de pagados — antes vivía inline dentro del
// .map() de PaidCollapse; se extrajo para poder darle su propia fase local
// de animación (idle → filling → labeled → exiting), igual patrón que ya
// usa PayCard.jsx para "marcar pagado": el guardado real (onMarkUnpaid) se
// dispara HASTA que la animación de salida terminó, nunca antes, para que
// la fila nunca desaparezca del arreglo (y se desmonte) a la mitad de su
// propia animación.
function PaidCollapseItem({ p, onMarkUnpaid }) {
  const [phase, setPhase] = useState('idle') // idle | filling | labeled | exiting
  const wrapperRef = useRef(null)
  const timers = useRef([])

  useEffect(() => {
    return () => { timers.current.forEach(clearTimeout) }
  }, [])

  function after(ms, fn) {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
  }

  function handleUndo(e) {
    e.stopPropagation()
    if (phase !== 'idle') return
    setPhase('filling')
    after(UNMARK_FILL_MS, () => {
      setPhase('labeled')
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
        after(UNMARK_EXIT_MS, () => onMarkUnpaid(p.id))
      })
    })
  }

  const contentHidden = phase === 'labeled' || phase === 'exiting'
  const fillActive    = phase === 'filling' || phase === 'labeled' || phase === 'exiting'
  const pd = new Date(p.paid_at)

  return (
    <div ref={wrapperRef} className={styles.paidCollapseItemWrapper}>
      <div className={`${styles.paidCollapseItem} ${phase === 'exiting' ? styles.paidCollapseItemExiting : ''}`}>
        <div className={`${styles.paidUnmarkFill} ${fillActive ? styles.paidUnmarkFillActive : ''}`} />
        <div className={`${styles.paidUnmarkLabel} ${phase === 'labeled' || phase === 'exiting' ? styles.paidUnmarkLabelVisible : ''}`}>
          Marcado como no pagado
        </div>
        <div className={`${styles.paidCollapseItemRow} ${contentHidden ? styles.paidCollapseItemRowHidden : ''}`}>
          <div className={styles.paidCollapseDate}>
            <div className={styles.paidCollapseDay}>{pd.getDate()}</div>
            <div className={styles.paidCollapseMonth}>{MONTHS_SHORT[pd.getMonth()]}</div>
          </div>
          <div className={styles.paidCollapseInfo}>
            <div className={styles.paidCollapseName}>{p.name}</div>
            <div className={styles.paidCollapseCategory}>{p.category}</div>
          </div>
          <span className={styles.paidCollapseAmount}>{fmt(p.amount)}</span>
          <button
            onClick={handleUndo}
            disabled={phase !== 'idle'}
            className={styles.paidCollapseUndoButton}
          >
            <RotateCcw size={11} color="var(--text)" />
          </button>
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
function PaidCollapse({ payments, expanded, onToggle, onMarkUnpaid }) {
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
          {payments.length} pagado{payments.length !== 1 ? 's' : ''}
        </span>
        {expanded ? <ChevronUp size={15} color="var(--text)" /> : <ChevronDown size={15} color="var(--text)" />}
      </button>

      {expanded && (() => {
        const sorted = [...payments].sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
        return (
          <div className={styles.paidCollapseList}>
            {sorted.map(p => (
              <PaidCollapseItem key={p.id} p={p} onMarkUnpaid={onMarkUnpaid} />
            ))}
          </div>
        )
      })()}
    </div>
  )
}
