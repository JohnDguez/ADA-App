import { Plus, Bell, Settings } from 'lucide-react'
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
  const now = new Date()
  const dateStr = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

  const nc = nextCobroDate(profile)
  const { end } = cobroPeriod(profile)
  const pagarEsteCobro = getPagarEsteCobro(payments, profile)
  const vencidos = pagarEsteCobro.filter(p => daysDiff(p.due_date) < 0).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))
  const delPeriodo = pagarEsteCobro.filter(p => daysDiff(p.due_date) >= 0).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))

  const varReminders = payments.filter(p => {
    if (p.is_paid || !p.is_variable || p.paused) return false
    const d = daysDiff(p.due_date)
    return d >= 0 && d <= (profile.reminder_days || 3)
  })

  // Monto pendiente del periodo
  const pendingAmt = pagarEsteCobro.filter(p => !p.is_variable).reduce((a, p) => a + Number(p.amount), 0)

  // Este mes
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

  // Próximamente
  const upcoming = payments.filter(p => {
    if (p.is_paid || p.paused || p.postponed) return false
    return dateOf(p.due_date) > end
  }).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date)).slice(0, 6)

  const handlers = { onMarkPaid, onMarkUnpaid, onEdit, onDelete, onPostpone, onAdvance }
  const initials = (profile.name || 'U').slice(0, 2).toUpperCase()

  return (
    <div style={{ paddingBottom: 80, background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Header con gradiente oscuro */}
      <div style={{
        background: 'linear-gradient(160deg, #020A1F 0%, #0A1A3D 60%, #0F2560 100%)',
        padding: '52px 20px 28px',
        position: 'relative',
      }}>
        {/* Fila superior */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          {/* Avatar + saludo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="avatar" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.2)' }} />
              : <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent)', border: '2px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600, color: '#fff' }}>{initials}</div>
            }
            <div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: 400 }}>{greeting()}</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#fff' }}>{profile.name || 'bienvenido'}</div>
            </div>
          </div>
          {/* Íconos */}
          <div style={{ display: 'flex', gap: 8 }}>
            <IconBtn onClick={() => {}} icon={<Bell size={18} color="#fff" />} />
            <IconBtn onClick={onGoSettings} icon={<Settings size={18} color="#fff" />} />
          </div>
        </div>

        {/* Fecha y hora */}
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 6, paddingLeft: 60 }}>
          {dateStr.charAt(0).toUpperCase() + dateStr.slice(1)} · {timeStr}
        </div>
      </div>

      {/* Cards de resumen — encimadas sobre el header */}
      <div style={{ margin: '-1px 16px 0', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '0.5px solid var(--border)', padding: '16px', boxShadow: '0 2px 12px rgba(2,10,31,0.08)' }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {/* Pendientes */}
          <div style={{ flex: 1, paddingRight: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, marginBottom: 4 }}>Pagos de este periodo</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: vencidos.length > 0 ? 'var(--danger)' : 'var(--text)', letterSpacing: '-0.5px' }}>{fmt(pendingAmt)}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span>{pagarEsteCobro.length} pago{pagarEsteCobro.length !== 1 ? 's' : ''}</span>
              {vencidos.length > 0 && <span style={{ color: 'var(--danger)', fontWeight: 600 }}>· {vencidos.length} vencido{vencidos.length !== 1 ? 's' : ''}</span>}
            </div>
          </div>

          {/* Separador */}
          <div style={{ width: '0.5px', background: 'var(--border)', alignSelf: 'stretch', margin: '0 16px 0 0' }} />

          {/* Este mes */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, marginBottom: 4 }}>Por pagar este mes</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px' }}>{fmt(totalThisMonth)}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <span>{paidThisMonth.length} pagados</span>
              {variableThisMonth > 0 && <span style={{ color: 'var(--accent)', fontWeight: 500 }}>· {variableThisMonth} variables</span>}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>

        {/* Vencidos */}
        {vencidos.length > 0 && (
          <>
            <div style={{ paddingTop: 20, paddingBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)' }}>
                {vencidos.length} Pago{vencidos.length !== 1 ? 's' : ''} vencido{vencidos.length !== 1 ? 's' : ''} — Atención urgente
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {vencidos.map(p => <PayCard key={p.id} payment={p} cfg={profile} {...handlers} />)}
            </div>
          </>
        )}

        {/* Próximos a vencer en el periodo */}
        <div style={{ paddingTop: 20, paddingBottom: 8, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Próximos a vencer</span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Periodo {periodRange(profile)}</span>
        </div>
        {delPeriodo.length === 0
          ? <Empty text="Sin pagos pendientes para este periodo" />
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {delPeriodo.map(p => <PayCard key={p.id} payment={p} cfg={profile} {...handlers} />)}
            </div>
        }

        {/* Próximos pagos */}
        {upcoming.length > 0 && (
          <>
            <div style={{ paddingTop: 20, paddingBottom: 8, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Próximos pagos</span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>Próximo periodo</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upcoming.map(p => <PayCard key={p.id} payment={p} cfg={profile} {...handlers} />)}
            </div>
          </>
        )}
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
    </div>
  )
}

function IconBtn({ onClick, icon }) {
  return (
    <button onClick={onClick} style={{
      width: 38, height: 38, borderRadius: '50%',
      background: 'rgba(255,255,255,0.1)',
      border: '0.5px solid rgba(255,255,255,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer',
    }}>
      {icon}
    </button>
  )
}

function Empty({ text }) {
  return <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: 'var(--muted)' }}>{text}</div>
}
