import { Plus, Bell } from 'lucide-react'
import { PayCard, GroupCard } from '../components/PayCard'
import { fmt, nextCobroDate, isTodayCobro, getPagarEsteCobro, statusOf, daysDiff, MONTHS, WEEKDAYS, groupPayments } from '../lib/utils'

export function HomePage({ payments, profile, onAdd, onMarkPaid, onEdit, onDelete, onPostpone }) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  const cobroLabel = profile.cobro_freq === 'weekly' ? WEEKDAYS[profile.cobro_weekday].toLowerCase() : 'día de cobro'

  const nc = nextCobroDate(profile)
  const isCobro = isTodayCobro(profile)
  const pagarEsteCobro = getPagarEsteCobro(payments, profile)

  const varReminders = payments.filter(p => {
    if (p.is_paid || !p.is_variable) return false
    const d = daysDiff(p.due_date)
    return d >= 0 && d <= (profile.reminder_days || 3)
  })

  const pending = payments.filter(p => !p.is_paid && !p.postponed)
  const paid = payments.filter(p => p.is_paid)
  const pendingAmt = pending.filter(p => !p.is_variable).reduce((a, p) => a + Number(p.amount), 0)
  const totalAmt = payments.filter(p => !p.is_variable).reduce((a, p) => a + Number(p.amount), 0)

  const upcoming = payments.filter(p => {
    const s = statusOf(p, profile)
    return !p.is_paid && !p.postponed && (s === 'ok' || s === 'soon')
  }).sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).slice(0, 4)

  const cobroGrouped = groupPayments(pagarEsteCobro)

  function renderItem(item, handlers) {
    if (item._isGroup) return <GroupCard key={item.id} group={item} cfg={profile} {...handlers} />
    return <PayCard key={item.id} payment={item} cfg={profile} {...handlers} />
  }

  const handlers = { onMarkPaid, onEdit, onDelete, onPostpone }

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ padding: '20px 16px 8px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#1A1915' }}>Hola, {profile.name || 'bienvenido'}</div>
          <div style={{ fontSize: 13, color: '#5C5A55', marginTop: 2 }}>{dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}</div>
        </div>
        <button onClick={onAdd} style={{ width: 36, height: 36, borderRadius: '50%', background: '#fff', border: '0.5px solid #E4E2DC', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2, cursor: 'pointer' }}>
          <Plus size={16} color="#1A1915" />
        </button>
      </div>

      {isCobro && pagarEsteCobro.length > 0 && (
        <div style={{ margin: '4px 16px 0', background: '#1E6B45', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Dia de cobro</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 2 }}>
            Hoy es {WEEKDAYS[nc.getDay()]} {nc.getDate()} de {MONTHS[nc.getMonth()]}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
            {pagarEsteCobro.length} pago{pagarEsteCobro.length !== 1 ? 's' : ''} que cubrir hoy
          </div>
        </div>
      )}

      {varReminders.length > 0 && !isCobro && (
        <div style={{ margin: '8px 16px 0', background: '#FEF3DC', border: '0.5px solid #F5D9A0', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <Bell size={16} color="#A06B12" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1915' }}>Recordatorio: {varReminders.map(r => r.name).join(', ')}</div>
            <div style={{ fontSize: 12, color: '#5C5A55', marginTop: 1 }}>
              {daysDiff(varReminders[0].due_date) === 0 ? 'Fecha estimada hoy' : `Vence en ${daysDiff(varReminders[0].due_date)} día${daysDiff(varReminders[0].due_date) !== 1 ? 's' : ''}`}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '8px 16px 0' }}>
        <div style={{ background: '#1E6B45', borderRadius: 12, padding: '13px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Por pagar</div>
          <div style={{ fontSize: 21, fontWeight: 600, color: '#fff' }}>{fmt(pendingAmt)}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: 1 }}>{pending.length} pago{pending.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ background: '#fff', border: '0.5px solid #E4E2DC', borderRadius: 12, padding: '13px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#5C5A55', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Este mes</div>
          <div style={{ fontSize: 21, fontWeight: 600, color: '#1A1915' }}>{fmt(totalAmt)}</div>
          <div style={{ fontSize: 12, color: '#5C5A55', marginTop: 1 }}>{paid.length} pagado{paid.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <SectionHead title={`Pagar este ${cobroLabel}`} />
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {cobroGrouped.length === 0
          ? <Empty text={`Sin pagos urgentes para este ${cobroLabel}`} />
          : cobroGrouped.map(item => renderItem(item, handlers))
        }
      </div>

      <SectionHead title="Proximamente" />
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {upcoming.length === 0
          ? <Empty text="Sin mas pagos proximos" />
          : upcoming.map(p => <PayCard key={p.id} payment={p} cfg={profile} {...handlers} />)
        }
      </div>
    </div>
  )
}

function SectionHead({ title }) {
  return <div style={{ padding: '16px 16px 8px' }}><h2 style={{ fontSize: 10, fontWeight: 600, color: '#5C5A55', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{title}</h2></div>
}

function Empty({ text }) {
  return <div style={{ textAlign: 'center', padding: '24px', fontSize: 13, color: '#5C5A55' }}>{text}</div>
}
