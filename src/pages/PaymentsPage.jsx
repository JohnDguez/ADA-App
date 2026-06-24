import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { PayCard, GroupCard } from '../components/PayCard'
import { dateOf, MONTHS, groupPayments } from '../lib/utils'

export function PaymentsPage({ payments, profile, onAdd, onMarkPaid, onMarkUnpaid, onEdit, onDelete, onPostpone, onAdvance }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())

  function changeMonth(d) {
    let m = month + d, y = year
    if (m > 11) { m = 0; y++ }
    if (m < 0) { m = 11; y-- }
    setMonth(m); setYear(y)
  }

  const inMonth = payments.filter(p => {
    const d = dateOf(p.due_date)
    return d.getMonth() === month && d.getFullYear() === year
  })
  const pending = inMonth.filter(p => !p.is_paid && !p.postponed).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))
  const paid = inMonth.filter(p => p.is_paid).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))
  const postponed = inMonth.filter(p => p.postponed).sort((a, b) => dateOf(a.due_date) - dateOf(b.due_date))
  const grouped = groupPayments(pending)
  const handlers = { onMarkPaid, onMarkUnpaid, onEdit, onDelete, onPostpone, onAdvance }

  function renderItem(item) {
    if (item._isGroup) return <GroupCard key={item.id} group={item} cfg={profile} {...handlers} />
    return <PayCard key={item.id} payment={item} cfg={profile} {...handlers} />
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ padding: '20px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>Pagos</div>
        <button onClick={onAdd} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Plus size={16} color="var(--text)" />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px' }}>
        <button onClick={() => changeMonth(-1)} style={{ background: 'none', border: 'none', padding: 6, display: 'flex', cursor: 'pointer' }}>
          <ChevronLeft size={18} color="var(--muted)" />
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{MONTHS[month]} {year}</span>
        <button onClick={() => changeMonth(1)} style={{ background: 'none', border: 'none', padding: 6, display: 'flex', cursor: 'pointer' }}>
          <ChevronRight size={18} color="var(--muted)" />
        </button>
      </div>

      <SectionHead title="Pendientes" />
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {grouped.length === 0 ? <Empty text="Sin pagos pendientes este mes" /> : grouped.map(item => renderItem(item))}
      </div>

      {postponed.length > 0 && (
        <>
          <SectionHead title="Pospuestos" />
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
            {postponed.map(p => <PayCard key={p.id} payment={p} cfg={profile} {...handlers} />)}
          </div>
        </>
      )}

      <SectionHead title="Pagados" />
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {paid.length === 0 ? <Empty text="Sin pagos registrados como pagados" /> : paid.map(p => <PayCard key={p.id} payment={p} cfg={profile} {...handlers} />)}
      </div>
    </div>
  )
}

function SectionHead({ title }) {
  return <div style={{ padding: '14px 16px 8px' }}><h2 className="section-head">{title}</h2></div>
}
function Empty({ text }) {
  return <div style={{ textAlign: 'center', padding: '20px', fontSize: 13, color: 'var(--muted)' }}>{text}</div>
}
