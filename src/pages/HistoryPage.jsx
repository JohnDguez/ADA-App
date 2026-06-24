import { useState } from 'react'
import { fmt, dateOf, MONTHS, MONTHS_SHORT } from '../lib/utils'

export function HistoryPage({ payments }) {
  const [selectedName, setSelectedName] = useState(null)
  const [monthsBack, setMonthsBack] = useState(6)
  const now = new Date()

  function getMonths(n) {
    const months = []
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ month: d.getMonth(), year: d.getFullYear(), label: `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}` })
    }
    return months
  }

  const months = getMonths(monthsBack)
  const paidPayments = payments.filter(p => p.is_paid)
  const names = [...new Set(paidPayments.map(p => p.name))].sort()
  const filtered = selectedName ? paidPayments.filter(p => p.name === selectedName) : paidPayments

  function paymentsInMonth(month, year) {
    return filtered.filter(p => { const d = dateOf(p.due_date); return d.getMonth() === month && d.getFullYear() === year })
  }
  function totalInMonth(month, year) {
    return paymentsInMonth(month, year).reduce((a, p) => a + Number(p.amount), 0)
  }

  const maxTotal = Math.max(...months.map(m => totalInMonth(m.month, m.year)), 1)
  const grandTotal = filtered.reduce((a, p) => a + Number(p.amount), 0)
  const avgMonthly = grandTotal / monthsBack

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: '20px 16px 8px' }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>Historial</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>Revisa tus pagos de los últimos meses</div>
      </div>

      <div style={{ padding: '0 16px 8px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        <Chip label="Todos" active={!selectedName} onClick={() => setSelectedName(null)} />
        {names.map(n => <Chip key={n} label={n} active={selectedName === n} onClick={() => setSelectedName(n === selectedName ? null : n)} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 16px 8px' }}>
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Total {monthsBack} meses</div>
          <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--text)' }}>{fmt(grandTotal)}</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Promedio mensual</div>
          <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--text)' }}>{fmt(Math.round(avgMonthly))}</div>
        </div>
      </div>

      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 6 }}>
        {[3, 6, 12].map(n => <Chip key={n} label={`${n} meses`} active={monthsBack === n} onClick={() => setMonthsBack(n)} />)}
      </div>

      {/* Gráfica */}
      <div style={{ margin: '0 16px 12px', background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 14px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Gasto mensual</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100 }}>
          {months.map((m, i) => {
            const total = totalInMonth(m.month, m.year)
            const heightPct = maxTotal > 0 ? (total / maxTotal) * 100 : 0
            const isCurrent = m.month === now.getMonth() && m.year === now.getFullYear()
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                {total > 0 && <div style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'center' }}>{fmt(total).replace('$', '')}</div>}
                <div style={{ width: '100%', height: `${Math.max(heightPct, total > 0 ? 4 : 0)}%`, background: isCurrent ? 'var(--accent)' : 'var(--accent-border)', borderRadius: '3px 3px 0 0', minHeight: total > 0 ? 4 : 0 }} />
                <div style={{ fontSize: 9, color: isCurrent ? 'var(--accent)' : 'var(--muted)', fontWeight: isCurrent ? 600 : 400, textAlign: 'center' }}>{m.label.split(' ')[0]}</div>
              </div>
            )
          })}
        </div>
      </div>

      {months.slice().reverse().map(m => {
        const items = paymentsInMonth(m.month, m.year)
        if (!items.length) return null
        const total = items.reduce((a, p) => a + Number(p.amount), 0)
        return (
          <div key={`${m.month}-${m.year}`} style={{ margin: '0 16px 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{MONTHS[m.month]} {m.year}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{fmt(total)}</span>
            </div>
            <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              {items.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < items.length - 1 ? '0.5px solid var(--bg)' : 'none' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                      {p.name}
                      {p.is_installment && <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 6 }}>Pago {p.current_installment}/{p.total_installments}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.category}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{fmt(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 24px', fontSize: 13, color: 'var(--muted)' }}>
          {selectedName ? `Sin pagos registrados para "${selectedName}"` : 'Sin pagos en este periodo'}
        </div>
      )}
    </div>
  )
}

function Chip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: '6px 14px', borderRadius: 'var(--radius-full)', border: active ? '1.5px solid var(--accent)' : '0.5px solid var(--border)', background: active ? 'var(--accent-soft)' : 'var(--surface)', color: active ? 'var(--accent)' : 'var(--muted)', fontSize: 12, fontWeight: active ? 600 : 400, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
      {label}
    </button>
  )
}
