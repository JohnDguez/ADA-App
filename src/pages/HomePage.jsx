import { useState } from 'react'
import { Plus, Bell, Settings, X, AlertCircle, Clock } from 'lucide-react'
import { PayCard } from '../components/PayCard'
import { NotificationsPanel } from '../components/NotificationsPanel'
import { fmt, cobroPeriod, nextCobroDate, getPagarEsteCobro, daysDiff, dateOf, MONTHS, MONTHS_SHORT } from '../lib/utils'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return '¡Buenos días!'
  if (h < 19) return '¡Buenas tardes!'
  return '¡Buenas noches!'
}

function periodRange(cfg) {
  const { start, end } = cobroPeriod(cfg)
  const sameMonth = start.getMonth() === end.getMonth()
  if (sameMonth) return `${start.getDate()} – ${end.getDate()} ${MONTHS[end.getMonth()]}`
  return `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}`
}

export function HomePage({ payments, profile, onAdd, onMarkPaid, onMarkUnpaid, onEdit, onDelete, onPostpone, onAdvance, onGoSettings, notifications, unreadCount, onMarkAsRead, onMarkAllAsRead, onDeleteNotif, onClearAllNotifs }) {
  const [notifOpen, setNotifOpen] = useState(false)

  const now = new Date()
  const dateStr = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

  const nc = nextCobroDate(profile)
  const { end } = cobroPeriod(profile)
  const pagarEsteCobro = getPagarEsteCobro(payments, profile)
  const vencidos = pagarEsteCobro.filter(p => daysDiff(p.due_date) < 0).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))
  const delPeriodo = pagarEsteCobro.filter(p => daysDiff(p.due_date) >= 0).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))

  const pendingAmt = pagarEsteCobro.filter(p => !p.is_variable).reduce((a, p) => a + Number(p.amount), 0)
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()
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
  const initials = (profile.name || 'U').slice(0, 2).toUpperCase()

  function handleNavigate(url) {
    // Por ahora solo scroll al top
    window.scrollTo(0, 0)
  }

  return (
    <div style={{ paddingBottom: 100, background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ background: 'url(/Header_bg.jpg) center/cover no-repeat', padding: '52px 20px 36px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="avatar" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.2)' }} />
              : <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)', border: '2px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff' }}>{initials}</div>
            }
            <div>
              <div style={{ fontSize: 14, fontWeight: 400, color: '#fff', lineHeight: 1.3 }}>{greeting()}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{profile.name || 'bienvenido'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                <IconBtn onClick={() => setNotifOpen(true)} icon={<Bell size={18} color="#fff" />} />
                {unreadCount > 0 && (
                  <div style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', border: '1.5px solid rgba(10,26,61,0.8)' }} />
                )}
              </div>
              <IconBtn onClick={onGoSettings} icon={<Settings size={18} color="#fff" />} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.5)', textAlign: 'right', marginTop: 15 }}>
              {dateStr.charAt(0).toUpperCase() + dateStr.slice(1)} · {timeStr}
            </div>
          </div>
        </div>
      </div>

      {/* Contenedor principal */}
      <div style={{ background: 'var(--bg)', borderRadius: '24px 24px 0 0', marginTop: -24, position: 'relative', zIndex: 10 }}>

        {/* Métricas */}
        <div style={{ display: 'flex', padding: '28px 20px 0' }}>
          <div style={{ flex: 1.6, paddingRight: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 6 }}>Pagos de este periodo</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--text)', letterSpacing: '-1px', lineHeight: 1 }}>{fmt(pendingAmt)}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8, display: 'flex', gap: 6 }}>
              <span>{pagarEsteCobro.length} pago{pagarEsteCobro.length !== 1 ? 's' : ''}</span>
              {vencidos.length > 0 && <span style={{ color: 'var(--danger)', fontWeight: 600 }}>· {vencidos.length} vencido{vencidos.length !== 1 ? 's' : ''}</span>}
            </div>
          </div>
          <div style={{ width: '0.5px', background: 'var(--border)', alignSelf: 'stretch', flexShrink: 0 }} />
          <div style={{ flex: 1, paddingLeft: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', marginBottom: 6 }}>Por pagar este mes</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px', lineHeight: 1 }}>{fmt(totalThisMonth)}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
              <span>{paidThisMonth.length} pagados</span>
              {variableThisMonth > 0 && <span style={{ color: 'var(--accent)', fontWeight: 500 }}> · {variableThisMonth} variables</span>}
            </div>
          </div>
        </div>

        <div style={{ padding: '0 16px' }}>

          {/* Vencidos */}
          {vencidos.length > 0 && (
            <div style={{ marginTop: 25 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)', marginBottom: 10 }}>
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

      {/* FAB */}
      <button onClick={onAdd} style={{ position: 'fixed', bottom: 100, right: 'calc(50% - 194px)', width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(47,140,250,0.4)', zIndex: 99, cursor: 'pointer' }}>
        <Plus size={22} color="#fff" strokeWidth={2.2} />
      </button>

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

function IconBtn({ onClick, icon }) {
  return (
    <button onClick={onClick} style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
      {icon}
    </button>
  )
}

function SectionHead({ left, right }) {
  return (
    <div style={{ paddingBottom: 10, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{left}</span>
      {right && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{right}</span>}
    </div>
  )
}

function Empty({ text }) {
  return <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: 'var(--muted)' }}>{text}</div>
}
