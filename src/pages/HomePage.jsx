import { Plus, Bell } from 'lucide-react'
import { PayCard } from '../components/PayCard'
import { fmt, cobroPeriod, nextCobroDate, isTodayCobro, getPagarEsteCobro, daysDiff, dateOf, MONTHS, WEEKDAYS } from '../lib/utils'

export function HomePage({ payments, profile, onAdd, onMarkPaid, onMarkUnpaid, onEdit, onDelete, onPostpone, onAdvance }) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  const cobroLabel = profile.cobro_freq === 'weekly' ? WEEKDAYS[profile.cobro_weekday].toLowerCase() : 'día de cobro'
  const nc = nextCobroDate(profile)
  const isCobro = isTodayCobro(profile)
  const pagarEsteCobro = getPagarEsteCobro(payments, profile)
  const vencidos = pagarEsteCobro.filter(p => daysDiff(p.due_date) < 0).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))
  const delPeriodo = pagarEsteCobro.filter(p => daysDiff(p.due_date) >= 0).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))

  const varReminders = payments.filter(p => {
    if (p.is_paid || !p.is_variable || p.paused) return false
    const d = daysDiff(p.due_date)
    return d >= 0 && d <= (profile.reminder_days || 3)
  })

  const pendingAmt = pagarEsteCobro.filter(p => !p.is_variable).reduce((a, p) => a + Number(p.amount), 0)

  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()
  const paidThisMonth = payments.filter(p => {
    if (!p.is_paid) return false
    const d = dateOf(p.due_date)
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear
  })
  const totalThisMonth = payments.filter(p => {
    const d = dateOf(p.due_date)
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear && !p.is_variable && !p.paused
  }).reduce((a, p) => a + Number(p.amount), 0)

  const { end } = cobroPeriod(profile)
  const upcoming = payments.filter(p => {
    if (p.is_paid || p.paused || p.postponed) return false
    return dateOf(p.due_date) > end
  }).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date)).slice(0, 5)

  const handlers = { onMarkPaid, onMarkUnpaid, onEdit, onDelete, onPostpone, onAdvance }

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Banner pre-alpha */}
      <div style={{ background: 'var(--text)', padding: '6px 16px', textAlign: 'center' }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>Pre-Alpha · Puede haber errores</span>
      </div>

      <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>Hola, {profile.name || 'bienvenido'}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}</div>
        </div>
        <button onClick={onAdd} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2, cursor: 'pointer' }}>
          <Plus size={16} color="var(--text)" />
        </button>
      </div>

      {isCobro && (
        <div style={{ margin: '4px 16px 0', background: 'var(--accent)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Dia de cobro</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 2 }}>Hoy es {WEEKDAYS[nc.getDay()]} {nc.getDate()} de {MONTHS[nc.getMonth()]}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{pagarEsteCobro.length} pago{pagarEsteCobro.length !== 1 ? 's' : ''} pendientes de cubrir</div>
        </div>
      )}

      {vencidos.length > 0 && (
        <div style={{ margin: '8px 16px 0', background: 'var(--danger-soft)', border: '0.5px solid var(--danger-border)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>
            {vencidos.length} pago{vencidos.length !== 1 ? 's' : ''} vencido{vencidos.length !== 1 ? 's' : ''} — atiéndelos lo antes posible
          </div>
        </div>
      )}

      {varReminders.length > 0 && (
        <div style={{ margin: '8px 16px 0', background: 'var(--warning-soft)', border: '0.5px solid var(--warning-border)', borderRadius: 'var(--radius)', padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <Bell size={16} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Recordatorio: {varReminders.map(r => r.name).join(', ')}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
              {daysDiff(varReminders[0].due_date) === 0 ? 'Fecha estimada hoy' : `Vence en ${daysDiff(varReminders[0].due_date)} día${daysDiff(varReminders[0].due_date) !== 1 ? 's' : ''}`}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '8px 16px 0' }}>
        <div style={{ background: vencidos.length > 0 ? 'var(--danger)' : 'var(--accent)', borderRadius: 'var(--radius)', padding: '13px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
            Pendientes al {nc.getDate()} {MONTHS[nc.getMonth()].slice(0,3)}
          </div>
          <div style={{ fontSize: 21, fontWeight: 600, color: '#fff' }}>{fmt(pendingAmt)}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: 1 }}>
            {pagarEsteCobro.length} pago{pagarEsteCobro.length !== 1 ? 's' : ''}
            {vencidos.length > 0 && ` · ${vencidos.length} vencido${vencidos.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '13px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Este mes</div>
          <div style={{ fontSize: 21, fontWeight: 600, color: 'var(--text)' }}>{fmt(totalThisMonth)}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{paidThisMonth.length} pagado{paidThisMonth.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {vencidos.length > 0 && (
        <>
          <SectionHead title="Vencidos — atención urgente" color="var(--danger)" />
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
            {vencidos.map(p => <PayCard key={p.id} payment={p} cfg={profile} {...handlers} />)}
          </div>
        </>
      )}

      <SectionHead title={`Pagar antes del ${cobroLabel} ${nc.getDate()} de ${MONTHS[nc.getMonth()]}`} />
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {delPeriodo.length === 0
          ? <Empty text="Sin pagos pendientes para este periodo" />
          : delPeriodo.map(p => <PayCard key={p.id} payment={p} cfg={profile} {...handlers} />)
        }
      </div>

      <SectionHead title="Proximamente" />
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {upcoming.length === 0
          ? <Empty text="Sin más pagos próximos" />
          : upcoming.map(p => <PayCard key={p.id} payment={p} cfg={profile} {...handlers} />)
        }
      </div>
    </div>
  )
}

function SectionHead({ title, color }) {
  return <div style={{ padding: '16px 16px 8px' }}><h2 className="section-head" style={{ color: color || 'var(--muted)' }}>{title}</h2></div>
}
function Empty({ text }) {
  return <div style={{ textAlign: 'center', padding: '20px', fontSize: 13, color: 'var(--muted)' }}>{text}</div>
}
