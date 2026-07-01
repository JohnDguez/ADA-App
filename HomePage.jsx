import { useState } from 'react'
import { PayCard } from '../components/PayCard'
import { PageHeader } from '../components/PageHeader'
import { NotificationsPanel } from '../components/NotificationsPanel'
import { fmt, cobroPeriod, nextCobroDate, getPagarEsteCobro, daysDiff, dateOf, MONTHS, MONTHS_SHORT } from '../lib/utils'

function periodRange(cfg) {
  const { start, end } = cobroPeriod(cfg)
  const sameMonth = start.getMonth() === end.getMonth()
  if (sameMonth) return `${start.getDate()} – ${end.getDate()} ${MONTHS[end.getMonth()]}`
  return `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}`
}

export function HomePage({ payments, profile, onAdd, onMarkPaid, onMarkUnpaid, onEdit, onDelete, onPostpone, onAdvance, onGoSettings, notifications, unreadCount, onMarkAsRead, onMarkAllAsRead, onDeleteNotif, onClearAllNotifs, slideClass }) {
  const [notifOpen, setNotifOpen] = useState(false)
  const [activeCard, setActiveCard] = useState(0)
  const [touchStartX, setTouchStartX] = useState(null)

  const now        = new Date()
  const { end }    = cobroPeriod(profile)
  const pagarEsteCobro = getPagarEsteCobro(payments, profile)
  const vencidos   = pagarEsteCobro.filter(p => daysDiff(p.due_date) < 0).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))
  const delPeriodo = pagarEsteCobro.filter(p => daysDiff(p.due_date) >= 0).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))
  const pendingAmt = pagarEsteCobro.filter(p => !p.is_variable).reduce((a, p) => a + Number(p.amount), 0)

  const thisMonth  = now.getMonth()
  const thisYear   = now.getFullYear()
  const paidThisMonth = payments.filter(p => {
    if (!p.is_paid) return false
    const d = dateOf(p.due_date)
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear
  })
  const variableThisMonth = paidThisMonth.filter(p => p.is_variable).length
  const totalThisMonth = payments.filter(p => {
    const d = dateOf(p.due_date)
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear && !p.paused
  }).reduce((a, p) => a + Number(p.amount), 0)

  const upcoming = payments.filter(p => {
    if (p.is_paid || p.paused || p.postponed) return false
    return dateOf(p.due_date) > end
  }).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date)).slice(0, 6)

  const handlers = { onMarkPaid, onMarkUnpaid, onEdit, onDelete, onPostpone, onAdvance }

  function handleNavigate() { window.scrollTo(0, 0) }

  return (
    <div style={{ paddingBottom: 120, background: 'var(--bg)', minHeight: '100vh' }}>

      <PageHeader
        profile={profile}
        unreadCount={unreadCount}
        onOpenNotifs={() => setNotifOpen(true)}
        onGoSettings={onGoSettings}
      />

      {/* Contenedor principal */}
      <div style={{ background: 'var(--bg)', borderRadius: '24px 24px 0 0', marginTop: -24, position: 'relative', zIndex: 10 }}>
        <div className={slideClass}>

        {/* Slider de métricas */}
        <div style={{ padding: '20px 16px 0', userSelect: 'none' }}>
          {/* Cards slider */}
          <div
            style={{ overflow: 'hidden', borderRadius: 16 }}
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
              <div style={{ minWidth: '100%', background: 'var(--accent)', borderRadius: 16, padding: '18px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Pagos de este periodo</div>
                <div style={{ fontSize: 38, fontWeight: 700, color: '#fff', letterSpacing: '-1px', lineHeight: 1, marginBottom: pendingAmt === 0 ? 6 : 14 }}>{fmt(pendingAmt)}</div>
                {pendingAmt === 0 && (
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 14 }}>¡Sin deudas pendientes!</div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '4px 10px', borderRadius: 20 }}>
                    {pagarEsteCobro.length} pago{pagarEsteCobro.length !== 1 ? 's' : ''}
                  </span>
                  {vencidos.length > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 600, background: 'var(--danger)', color: '#fff', padding: '4px 10px', borderRadius: 20 }}>
                      {vencidos.length} vencido{vencidos.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Card 2 — Este mes */}
              <div style={{ minWidth: '100%', background: 'var(--accent)', borderRadius: 16, padding: '18px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Por pagar este mes</div>
                <div style={{ fontSize: 38, fontWeight: 700, color: '#fff', letterSpacing: '-1px', lineHeight: 1, marginBottom: 14 }}>{fmt(totalThisMonth)}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '4px 10px', borderRadius: 20 }}>
                    {paidThisMonth.length} pagados
                  </span>
                  {variableThisMonth > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '4px 10px', borderRadius: 20 }}>
                      {variableThisMonth} pago{variableThisMonth !== 1 ? 's' : ''} variables
                    </span>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Dots indicadores */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
            {[0, 1].map(i => (
              <div
                key={i}
                onClick={() => setActiveCard(i)}
                style={{ width: activeCard === i ? 18 : 6, height: 6, borderRadius: 3, background: activeCard === i ? 'var(--accent)' : 'var(--border)', transition: 'all .25s', cursor: 'pointer' }}
              />
            ))}
          </div>
        </div>

        <div style={{ padding: '0 16px' }}>

          {/* Vencidos */}
          {vencidos.length > 0 && (
            <div style={{ marginTop: 25 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)', marginBottom: 10 }}>
                {vencidos.length} Pago{vencidos.length !== 1 ? 's' : ''} vencido{vencidos.length !== 1 ? 's' : ''} — Atención urgente
              </div>
              <div style={{ background: '#D9D9D9', borderRadius: 12, padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {vencidos.map(p => <PayCard key={p.id} payment={p} cfg={profile} {...handlers} borderLeft="#B10F17" />)}
              </div>
            </div>
          )}

          {/* Próximos a vencer */}
          <div style={{ marginTop: 20 }}>
            <SectionHead left="Próximos a vencer" right={`Periodo ${periodRange(profile)}`} />
            {delPeriodo.length === 0
              ? <Empty text="Sin pagos pendientes para este periodo" />
              : <div style={{ background: '#D9D9D9', borderRadius: 12, padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {delPeriodo.map(p => <PayCard key={p.id} payment={p} cfg={profile} {...handlers} borderLeft="#FAAC2F" />)}
                </div>
            }
          </div>

          {/* Próximos pagos */}
          {upcoming.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <SectionHead left="Próximos pagos" right="Próximo periodo" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {upcoming.map(p => <PayCard key={p.id} payment={p} cfg={profile} {...handlers} borderLeft="var(--accent)" />)}
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Panel de notificaciones */}
      <NotificationsPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkAsRead={onMarkAsRead}
        onMarkAllAsRead={onMarkAllAsRead}
        onDelete={onDeleteNotif}
        onClearAll={onClearAllNotifs}
        onNavigate={handleNavigate}
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
