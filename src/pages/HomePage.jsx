import { useState, useRef, useEffect } from 'react'
import { ChevronDown, ChevronUp, Check, RotateCcw } from 'lucide-react'
import { PayCard } from '../components/PayCard'
import { PayRail } from '../components/PayRail'
import { PageHeader } from '../components/PageHeader'
import { NotificationsPanel } from '../components/NotificationsPanel'
import { NewSharedSpacePanel } from '../components/NewSharedSpacePanel'
import { fmt, cobroPeriod, nextCobroPeriod, getPagarEsteCobro, daysDiff, dateOf, dateToStr, MONTHS, MONTHS_SHORT } from '../lib/utils'

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

// Anillo de progreso circular — reemplaza la barra horizontal en las
// tarjetas "Pagos de este periodo" / "Por pagar este mes" (mockup
// confirmado con Johnatan). El sentido de barrido es intencional y NO es
// el típico de un progress ring (arriba → derecha, sentido horario): aquí
// empieza arriba y el primer tramo se dibuja hacia la IZQUIERDA (abajo por
// la izquierda, luego por abajo, luego sube por la derecha para cerrar) —
// así el hueco cuando falta poco por pagar cae del lado derecho, como en
// el boceto de Johnatan. Con path + arco SVG en vez de stroke-dasharray +
// rotate: da control explícito sobre el sentido (el truco de
// dasharray/rotate para invertir el sentido requiere combinar rotate con
// un espejo, mucho más propenso a errores).
function ProgressRing({ percent, size = 128, strokeWidth = 10, children }) {
  const r  = (size - strokeWidth) / 2
  const cx = size / 2
  const cy = size / 2
  const clamped = Math.max(0, Math.min(1, percent))
  let pathD = null
  if (clamped > 0 && clamped < 1) {
    const phi   = clamped * 360 * Math.PI / 180
    const start = { x: cx, y: cy - r }
    const end   = { x: cx - r * Math.sin(phi), y: cy - r * Math.cos(phi) }
    const largeArc = clamped > 0.5 ? 1 : 0
    // sweep-flag 0 = sentido antihorario en SVG, que es justo el que
    // produce el barrido "hacia la izquierda primero" descrito arriba.
    pathD = `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`
  }
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
        {clamped >= 1 ? (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--paid)" strokeWidth={strokeWidth} strokeLinecap="round" />
        ) : pathD ? (
          <path d={pathD} fill="none" stroke="var(--paid)" strokeWidth={strokeWidth} strokeLinecap="round" />
        ) : null}
      </svg>
      {/* padding horizontal + textAlign:center acotan el contenido a la zona
          segura del círculo (evita el desborde que Johnatan reportó cuando
          "$1,200.00 pagado" era más ancho que el propio anillo) */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 10px', textAlign: 'center' }}>
        {children}
      </div>
    </div>
  )
}

export function HomePage({ payments, profile, spaceSwitcher, activeSpaceHeader, activeSpaceId, sharedSpaces, spacePermissions, onOpenPremium, onSpaceReady, onAdd, onMarkPaid, onMarkUnpaid, onCaptureAmount, onEdit, onDelete, onPostpone, onAdvance, onGoSettings, notifications, unreadCount, onMarkAsRead, onMarkAllAsRead, onDeleteNotif, onClearAllNotifs, slideClass }) {
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

  const handlers = { onMarkPaid, onMarkUnpaid, onCaptureAmount, onEdit, onDelete, onPostpone, onAdvance }

  return (
    <div style={{ paddingBottom: 120, background: 'var(--bg)', minHeight: '100vh' }}>
      <PageHeader
        profile={profile}
        unreadCount={unreadCount}
        onOpenNotifs={() => setNotifOpen(true)}
        onGoSettings={onGoSettings}
      />

      <div style={{ background: 'var(--bg)', borderRadius: '24px 24px 0 0', marginTop: -24, position: 'relative', zIndex: 10 }}>
        {spaceSwitcher}

        {activeSpaceHeader}

        <div className={slideClass}>
        <div className={spaceJustChanged ? 'content-slide-up' : ''}>

        {activeSpaceId === 'new' ? (
          <div style={{ marginTop: 16 }}>
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
        {/* Tabs Periodo / Mes */}
        <div data-coachmark="home-metric-card" style={{ padding: '20px 16px 0', userSelect: 'none' }}>
          <div style={{ display: 'flex', background: 'var(--section-bg)', borderRadius: 5, padding: 3, marginBottom: 10 }}>
            <button
              onClick={() => setActiveCard(0)}
              style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 5, border: 'none', background: activeCard === 0 ? 'var(--accent)' : 'transparent', color: activeCard === 0 ? '#fff' : 'var(--text)', fontSize: 12, fontWeight: 500, fontFamily: 'DM Sans, sans-serif' }}
            >
              Periodo
            </button>
            <button
              onClick={() => setActiveCard(1)}
              style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 5, border: 'none', background: activeCard === 1 ? 'var(--accent)' : 'transparent', color: activeCard === 1 ? '#fff' : 'var(--text)', fontSize: 12, fontWeight: 500, fontFamily: 'DM Sans, sans-serif' }}
            >
              Mes
            </button>
          </div>

          <div
            style={{ overflow: 'hidden', borderRadius: 12 }}
            onTouchStart={e => setTouchStartX(e.touches[0].clientX)}
            onTouchEnd={e => {
              if (touchStartX === null) return
              const dx = e.changedTouches[0].clientX - touchStartX
              if (dx < -40) setActiveCard(1)
              if (dx > 40)  setActiveCard(0)
              setTouchStartX(null)
            }}
          >
            <div style={{ display: 'flex', transition: 'transform .3s cubic-bezier(0.25,0.46,0.45,0.94)', transform: `translateX(${activeCard * -100}%)` }}>

              {/* Card 1 — Periodo actual */}
              <div style={{ minWidth: '100%', background: 'var(--surface)', borderRadius: 12, padding: '20px 16px' }}>
                {pagarEsteCobro.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    <ProgressRing percent={1} size={140}>
                      <Check size={32} color="var(--paid)" strokeWidth={2.5} />
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginTop: 8, lineHeight: 1.3 }}>Sin pagos<br />pendientes</div>
                    </ProgressRing>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 14 }}>
                        Periodo {periodRange(profile)}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--accent)', marginBottom: 12 }}>Total de este periodo</div>
                      <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>{fmt(pagadoMonto)}</div>
                      {(pagadosFijosEstePeriodo > 0 || pagadosVariablesEstePeriodo > 0) && (
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                          {pagadosFijosEstePeriodo} pago{pagadosFijosEstePeriodo !== 1 ? 's' : ''} fijo{pagadosFijosEstePeriodo !== 1 ? 's' : ''}
                          {pagadosVariablesEstePeriodo > 0 && ` · ${pagadosVariablesEstePeriodo} variable${pagadosVariablesEstePeriodo !== 1 ? 's' : ''}`}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    <ProgressRing percent={pctPagado / 100} size={140}>
                      <span style={{ fontSize: 30, fontWeight: 700, color: 'var(--text)' }}>{pctPagado}%</span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--paid)', marginTop: 4 }}>{fmt(pagadoMonto)} pagado</span>
                      <div style={{ width: '55%', height: 1, background: 'var(--border)', margin: '3px 0' }} />
                      <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)' }}>{fmt(pendingAmt)} pendiente</span>
                    </ProgressRing>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 14 }}>
                        Periodo {periodRange(profile)}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--accent)', marginBottom: 12 }}>Total de este periodo</div>
                      <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>{fmt(totalConocido)}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                        {pagosFijosCount} pago{pagosFijosCount !== 1 ? 's' : ''} fijo{pagosFijosCount !== 1 ? 's' : ''}
                        {vencidos.length > 0 && <span style={{ color: 'var(--danger)' }}> · {vencidos.length} pago{vencidos.length !== 1 ? 's' : ''} vencido{vencidos.length !== 1 ? 's' : ''}</span>}
                      </div>
                      {pendingVariableCount > 0 && (
                        <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text)', marginTop: 10 }}>
                          {pendingVariableCount} pago{pendingVariableCount !== 1 ? 's' : ''} variable{pendingVariableCount !== 1 ? 's' : ''} por confirmar
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Card 2 — Este mes */}
              <div style={{ minWidth: '100%', background: 'var(--surface)', borderRadius: 12, padding: '20px 16px' }}>
                {pendingThisMonthAmt <= 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    <ProgressRing percent={1} size={140}>
                      <Check size={32} color="var(--paid)" strokeWidth={2.5} />
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginTop: 8, lineHeight: 1.3 }}>Sin pagos<br />pendientes</div>
                    </ProgressRing>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 14 }}>
                        {MONTHS[thisMonth]} {thisYear}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--accent)', marginBottom: 12 }}>Total de este mes</div>
                      <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>{fmt(paidThisMonthAmt)}</div>
                      {(paidFixedThisMonth > 0 || variableThisMonth > 0) && (
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                          {paidFixedThisMonth} pago{paidFixedThisMonth !== 1 ? 's' : ''} fijo{paidFixedThisMonth !== 1 ? 's' : ''}
                          {variableThisMonth > 0 && ` · ${variableThisMonth} variable${variableThisMonth !== 1 ? 's' : ''}`}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    <ProgressRing percent={pctPagadoMes / 100} size={140}>
                      <span style={{ fontSize: 30, fontWeight: 700, color: 'var(--text)' }}>{pctPagadoMes}%</span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--paid)', marginTop: 4 }}>{fmt(paidThisMonthAmt)} pagado</span>
                      <div style={{ width: '55%', height: 1, background: 'var(--border)', margin: '3px 0' }} />
                      <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)' }}>{fmt(pendingThisMonthAmt)} pendiente</span>
                    </ProgressRing>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 14 }}>
                        {MONTHS[thisMonth]} {thisYear}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--accent)', marginBottom: 12 }}>Total de este mes</div>
                      <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>{fmt(totalThisMonth)}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                        {paidThisMonth.length} pagado{paidThisMonth.length !== 1 ? 's' : ''}
                        {variableThisMonth > 0 && ` · ${variableThisMonth} variable${variableThisMonth !== 1 ? 's' : ''}`}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '0 16px' }}>

          {/* Colapsable de pagados — justo debajo de la card de métricas */}
          {pagadosEstePeriodo.length > 0 && (
            <div data-coachmark="home-paid-collapse" style={{ marginTop: 10 }}>
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
            <div style={{ marginTop: 25 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)', marginBottom: 10 }}>
                Vencidos
              </div>
              <PayRail payments={vencidos} cfg={profile} dotColor="var(--overdue-border)" dotTextColor="#fff" handlers={handlers} permissions={spacePermissions} />
            </div>
          )}

          {/* Pagos del periodo (antes "Próximos a vencer" — se renombró porque
              puede haber pagos por vencer que en realidad son de OTRO periodo,
              y esta sección es específicamente la del periodo actual) */}
          <div data-coachmark="home-rail" style={{ marginTop: 20 }}>
            <SectionHead left="Pagos del periodo" right={`Periodo ${periodRange(profile)}`} />

            {delPeriodo.length === 0
              ? <Empty text="Sin pagos pendientes para este periodo" />
              : <PayRail payments={delPeriodo} cfg={profile} dotColor="var(--upcoming-border)" dotTextColor="var(--impact-warning-text)" handlers={handlers} permissions={spacePermissions} />
            }
          </div>

          {/* Próximo periodo — toggle + filtro exacto al periodo */}
          <div style={{ marginTop: 20, marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Próximo periodo</span>
              <div onClick={toggleNextPeriod} style={{ cursor: 'pointer' }}>
                <div className="toggle-track" style={{ background: showNextPeriod ? 'var(--accent)' : 'var(--border)' }}>
                  <div className="toggle-thumb" style={{ left: showNextPeriod ? 19 : 3 }} />
                </div>
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)' }}>
              {nextPeriodRange(profile)}
            </span>
          </div>

          {showNextPeriod && (
            upcoming.length === 0
              ? <Empty text="Sin pagos registrados para el próximo periodo" />
              : <div style={{ marginTop: 8 }}>
                  <PayRail payments={upcoming} cfg={profile} dotColor="var(--accent)" dotTextColor="var(--bg)" handlers={handlers} permissions={spacePermissions} />
                </div>
          )}
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
    <div style={{ paddingBottom: 10, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{left}</span>
      {right && <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)' }}>{right}</span>}
    </div>
  )
}

function Empty({ text }) {
  return <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{text}</div>
}

// Resumen colapsable de pagos ya liquidados dentro del periodo actual — no
// es un segundo registro (ese sigue siendo PaymentsPage/"Pagos"), es solo un
// atajo de conveniencia para deshacer/revisar sin salir de Home. Se calcula
// con el mismo rango de fechas del periodo actual, así que se "reinicia"
// solo en cuanto cambia de periodo, sin lógica extra de limpieza.
function PaidCollapse({ payments, expanded, onToggle, onMarkUnpaid }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <button
        onClick={onToggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: 'none', borderRadius: 8, padding: '9px 12px', cursor: 'pointer' }}
      >
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--paid)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Check size={11} color="#fff" strokeWidth={3} />
        </div>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 400, color: 'var(--text)', textAlign: 'left' }}>
          {payments.length} pagado{payments.length !== 1 ? 's' : ''}
        </span>
        {expanded ? <ChevronUp size={15} color="var(--text)" /> : <ChevronDown size={15} color="var(--text)" />}
      </button>

      {expanded && (() => {
        const sorted = [...payments].sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
        return (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sorted.map(p => {
              const pd = new Date(p.paid_at)
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', borderRadius: 8, padding: '9px 12px' }}>
                  <div style={{ width: 28, textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.1 }}>{pd.getDate()}</div>
                    <div style={{ fontSize: 9, fontWeight: 500, color: 'var(--text)', textTransform: 'uppercase' }}>{MONTHS_SHORT[pd.getMonth()]}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text)' }}>{p.category}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{fmt(p.amount)}</span>
                  <button
                    onClick={() => onMarkUnpaid(p.id)}
                    style={{ width: 26, height: 26, borderRadius: '50%', background: 'none', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                  >
                    <RotateCcw size={11} color="var(--text)" />
                  </button>
                </div>
              )
            })}
          </div>
        )
      })()}
    </div>
  )
}
