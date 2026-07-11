import { useState } from 'react'
import { Trophy, ChevronDown, ChevronUp, Check, HelpCircle, RotateCcw } from 'lucide-react'
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

export function HomePage({ payments, profile, spaceSwitcher, activeSpaceId, sharedSpaces, onOpenPremium, onSpaceReady, onAdd, onMarkPaid, onMarkUnpaid, onCaptureAmount, onEdit, onDelete, onPostpone, onAdvance, onGoSettings, notifications, unreadCount, onMarkAsRead, onMarkAllAsRead, onDeleteNotif, onClearAllNotifs, slideClass }) {
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

  const thisMonth  = now.getMonth()
  const thisYear   = now.getFullYear()
  const paidThisMonth = payments.filter(p => {
    if (!p.is_paid) return false
    const d = dateOf(p.due_date)
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear
  })
  const variableThisMonth = paidThisMonth.filter(p => p.is_variable).length
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
        <div className={slideClass}>

        {spaceSwitcher && <div style={{ padding: '0 16px' }}>{spaceSwitcher}</div>}

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
              <div style={{ minWidth: '100%', background: 'var(--surface)', borderRadius: 12, padding: '16px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--accent)', letterSpacing: '0.04em', marginBottom: 6 }}>
                  Pagos de este periodo
                </div>
                {pagarEsteCobro.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0 2px' }}>
                    <Trophy size={32} color="var(--paid)" strokeWidth={1.8} />
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>¡Sin pagos pendientes este periodo!</div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 32, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>{fmt(totalConocido)}</div>
                    <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text)', marginBottom: 12 }}>
                      {pagosFijosCount} pago{pagosFijosCount !== 1 ? 's' : ''} fijo{pagosFijosCount !== 1 ? 's' : ''} · periodo {periodRange(profile)}
                      {vencidos.length > 0 && <span style={{ color: 'var(--danger)' }}> · {vencidos.length} vencido{vencidos.length !== 1 ? 's' : ''}</span>}
                    </div>
                    <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                      <div style={{ width: `${pctPagado}%`, background: 'var(--paid)' }} />
                      <div style={{ width: `${100 - pctPagado}%`, background: 'var(--accent)' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, marginBottom: pendingVariableCount > 0 ? 12 : 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--paid)' }}>{fmt(pagadoMonto)} pagado</span>
                      <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text)' }}>{fmt(pendingAmt)} pendiente</span>
                    </div>
                    {pendingVariableCount > 0 && (
                      <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <HelpCircle size={14} color="var(--text)" />
                        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text)' }}>+ {pendingVariableCount} pago{pendingVariableCount !== 1 ? 's' : ''} variable{pendingVariableCount !== 1 ? 's' : ''} por confirmar</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Card 2 — Este mes */}
              <div style={{ minWidth: '100%', background: 'var(--surface)', borderRadius: 12, padding: '16px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--accent)', letterSpacing: '0.04em', marginBottom: 6 }}>
                  Por pagar este mes
                </div>
                <div style={{ fontSize: 32, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>{fmt(totalThisMonth)}</div>
                <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text)', marginBottom: 12 }}>
                  {paidThisMonth.length} pagado{paidThisMonth.length !== 1 ? 's' : ''}
                  {variableThisMonth > 0 && ` · ${variableThisMonth} variable${variableThisMonth !== 1 ? 's' : ''}`}
                </div>
                <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${pctPagadoMes}%`, background: 'var(--paid)' }} />
                  <div style={{ width: `${100 - pctPagadoMes}%`, background: 'var(--accent)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--paid)' }}>{fmt(paidThisMonthAmt)} pagado</span>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text)' }}>{fmt(pendingThisMonthAmt)} pendiente</span>
                </div>
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
              <PayRail payments={vencidos} cfg={profile} dotColor="var(--overdue-border)" dotTextColor="#fff" handlers={handlers} />
            </div>
          )}

          {/* Pagos del periodo (antes "Próximos a vencer" — se renombró porque
              puede haber pagos por vencer que en realidad son de OTRO periodo,
              y esta sección es específicamente la del periodo actual) */}
          <div data-coachmark="home-rail" style={{ marginTop: 20 }}>
            <SectionHead left="Pagos del periodo" right={`Periodo ${periodRange(profile)}`} />

            {delPeriodo.length === 0
              ? <Empty text="Sin pagos pendientes para este periodo" />
              : <PayRail payments={delPeriodo} cfg={profile} dotColor="var(--upcoming-border)" dotTextColor="var(--impact-warning-text)" handlers={handlers} />
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
                  <PayRail payments={upcoming} cfg={profile} dotColor="var(--accent)" dotTextColor="var(--bg)" handlers={handlers} />
                </div>
          )}
        </div>
        </>
        )}
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
