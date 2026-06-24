import { useState } from 'react'
import { Plus, Bell, Settings, X, AlertCircle, Clock } from 'lucide-react'
import { PayCard } from '../components/PayCard'
import { fmt, cobroPeriod, nextCobroDate, isTodayCobro, getPagarEsteCobro, daysDiff, dateOf, MONTHS, MONTHS_SHORT, WEEKDAYS } from '../lib/utils'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return '¡Buenos días!'
  if (h < 19) return '¡Buenas tardes!'
  return '¡Buenas noches!'
}

function periodRange(cfg) {
  const { start, end } = cobroPeriod(cfg)
  const sameMonth = start.getMonth() === end.getMonth()
  if (sameMonth) return `${start.getDate()} – ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`
  return `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} – ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`
}

export function HomePage({ payments, profile, onAdd, onMarkPaid, onMarkUnpaid, onEdit, onDelete, onPostpone, onAdvance, onGoSettings }) {
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifSeen, setNotifSeen] = useState(false)

  const now = new Date()
  const dateStr = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

  const nc = nextCobroDate(profile)
  const { end } = cobroPeriod(profile)
  const pagarEsteCobro = getPagarEsteCobro(payments, profile)
  const vencidos = pagarEsteCobro.filter(p => daysDiff(p.due_date) < 0).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))
  const delPeriodo = pagarEsteCobro.filter(p => daysDiff(p.due_date) >= 0).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))

  // Notificaciones activas
  const notifications = []
  vencidos.forEach(p => {
    notifications.push({ id: `v-${p.id}`, type: 'danger', title: `${p.name} vencido`, body: 'Revisar urgente' })
  })
  payments.filter(p => {
    if (p.is_paid || !p.is_variable || p.paused) return false
    const d = daysDiff(p.due_date)
    return d >= 0 && d <= (profile.reminder_days || 3)
  }).forEach(p => {
    const d = daysDiff(p.due_date)
    notifications.push({ id: `r-${p.id}`, type: 'warning', title: `Recordatorio: ${p.name}`, body: d === 0 ? 'Vence hoy' : `Vence en ${d} día${d !== 1 ? 's' : ''}` })
  })
  delPeriodo.filter(p => !p.is_variable && daysDiff(p.due_date) <= 2).forEach(p => {
    notifications.push({ id: `s-${p.id}`, type: 'warning', title: p.name, body: `Vence en ${daysDiff(p.due_date)} día${daysDiff(p.due_date) !== 1 ? 's' : ''}` })
  })
  const hasUnread = notifications.length > 0 && !notifSeen

  function openNotif() { setNotifOpen(true); setNotifSeen(true) }

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

  return (
    <div style={{ paddingBottom: 80, background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Header oscuro */}
      <div style={{
        background: 'linear-gradient(160deg, #020A1F 0%, #0A1A3D 60%, #0F2560 100%)',
        padding: '52px 20px 36px',
        position: 'relative',
      }}>
        {/* Fila: avatar+saludo a la izq, botones a la der */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          {/* Avatar + saludo */}
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

          {/* Botones + fecha abajo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {/* Campana con punto */}
              <div style={{ position: 'relative' }}>
                <IconBtn onClick={openNotif} icon={<Bell size={18} color="#fff" />} />
                {hasUnread && (
                  <div style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', border: '1.5px solid #0A1A3D' }} />
                )}
              </div>
              <IconBtn onClick={onGoSettings} icon={<Settings size={18} color="#fff" />} />
            </div>
            {/* Fecha y hora debajo de los botones */}
            <div style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.5)', textAlign: 'right' }}>
              {dateStr.charAt(0).toUpperCase() + dateStr.slice(1)} · {timeStr}
            </div>
          </div>
        </div>
      </div>

      {/* Contenedor principal — sube sobre el header, esquinas superiores redondeadas, de borde a borde */}
      <div style={{
        background: 'var(--bg)',
        borderRadius: '24px 24px 0 0',
        marginTop: -24,
        minHeight: 'calc(100vh - 160px)',
      }}>
        {/* Métricas — sin card, viven directo en el contenedor */}
        <div style={{ display: 'flex', gap: 0, padding: '24px 20px 0' }}>
          {/* Pendientes del periodo */}
          <div style={{ flex: 1.2, paddingRight: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 4 }}>Pagos de este periodo</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', letterSpacing: '-1px', lineHeight: 1 }}>{fmt(pendingAmt)}</div>
            <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)', marginTop: 6, display: 'flex', gap: 6 }}>
              <span>{pagarEsteCobro.length} pago{pagarEsteCobro.length !== 1 ? 's' : ''}</span>
              {vencidos.length > 0 && <span style={{ color: 'var(--danger)', fontWeight: 600 }}>· {vencidos.length} vencido{vencidos.length !== 1 ? 's' : ''}</span>}
            </div>
          </div>

          {/* Separador */}
          <div style={{ width: '0.5px', background: 'var(--border)', alignSelf: 'stretch', flexShrink: 0 }} />

          {/* Este mes */}
          <div style={{ flex: 1, paddingLeft: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 4 }}>Por pagar este mes</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px', lineHeight: 1 }}>{fmt(totalThisMonth)}</div>
            <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)', marginTop: 6 }}>
              <span>{paidThisMonth.length} pagados</span>
              {variableThisMonth > 0 && <span style={{ color: 'var(--accent)', fontWeight: 500 }}> · {variableThisMonth} variables</span>}
            </div>
          </div>
        </div>

        {/* Divisor */}
        <div style={{ height: '0.5px', background: 'var(--border)', margin: '20px 0 0' }} />

        {/* Listas de pagos */}
        <div style={{ padding: '0 16px' }}>

          {/* Vencidos */}
          {vencidos.length > 0 && (
            <>
              <div style={{ paddingTop: 16, paddingBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>
                  {vencidos.length} Pago{vencidos.length !== 1 ? 's' : ''} vencido{vencidos.length !== 1 ? 's' : ''} — Atención urgente
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {vencidos.map(p => <PayCard key={p.id} payment={p} cfg={profile} {...handlers} />)}
              </div>
            </>
          )}

          {/* Próximos a vencer en el periodo */}
          <SectionHead left="Próximos a vencer" right={`Periodo ${periodRange(profile)}`} />
          {delPeriodo.length === 0
            ? <Empty text="Sin pagos pendientes para este periodo" />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {delPeriodo.map(p => <PayCard key={p.id} payment={p} cfg={profile} {...handlers} />)}
              </div>
          }

          {/* Próximos pagos */}
          {upcoming.length > 0 && (
            <>
              <SectionHead left="Próximos pagos" right="Próximo periodo" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {upcoming.map(p => <PayCard key={p.id} payment={p} cfg={profile} {...handlers} />)}
              </div>
            </>
          )}
        </div>
      </div>

      {/* FAB */}
      <button onClick={onAdd} style={{
        position: 'fixed', bottom: 84, right: 'calc(50% - 194px)',
        width: 52, height: 52, borderRadius: '50%',
        background: 'var(--accent)', border: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 14px rgba(47,140,250,0.4)', zIndex: 99, cursor: 'pointer',
      }}>
        <Plus size={22} color="#fff" strokeWidth={2.2} />
      </button>

      {/* Panel de notificaciones */}
      {notifOpen && (
        <div onClick={e => e.target === e.currentTarget && setNotifOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(2,10,31,0.5)', zIndex: 200,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
          padding: '60px 16px 0',
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 340,
            boxShadow: '0 8px 32px rgba(2,10,31,0.2)', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '0.5px solid var(--border)' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Notificaciones</span>
              <button onClick={() => setNotifOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <X size={18} color="var(--muted)" />
              </button>
            </div>
            {notifications.length === 0
              ? <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>Sin notificaciones pendientes</div>
              : notifications.map(n => (
                <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderBottom: '0.5px solid var(--bg)' }}>
                  {n.type === 'danger'
                    ? <AlertCircle size={16} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
                    : <Clock size={16} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
                  }
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{n.body}</div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}

function IconBtn({ onClick, icon }) {
  return (
    <button onClick={onClick} style={{
      width: 40, height: 40, borderRadius: 12,
      background: 'rgba(255,255,255,0.1)',
      border: '0.5px solid rgba(255,255,255,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer',
    }}>
      {icon}
    </button>
  )
}

function SectionHead({ left, right }) {
  return (
    <div style={{ paddingTop: 20, paddingBottom: 10, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{left}</span>
      {right && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)' }}>{right}</span>}
    </div>
  )
}

function Empty({ text }) {
  return <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: 'var(--muted)' }}>{text}</div>
}
