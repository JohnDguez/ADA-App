import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fmt, dateOf, MONTHS, MONTHS_SHORT } from '../lib/utils'

const CAT_COLORS = ['#1E6B45','#A06B12','#B83232','#2563A8','#7C3D9E','#5C5A55','#2D8B6F']

export function HistoryPage({ payments }) {
  const [selectedName, setSelectedName] = useState(null)
  const [monthsBack, setMonthsBack] = useState(6)

  const now = new Date()

  // Genera los últimos N meses
  function getMonths(n) {
    const months = []
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ month: d.getMonth(), year: d.getFullYear(), label: `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}` })
    }
    return months
  }

  const months = getMonths(monthsBack)

  // Nombres únicos de pagos pagados
  const paidPayments = payments.filter(p => p.is_paid)
  const names = [...new Set(paidPayments.map(p => p.name))].sort()

  // Filtra por nombre seleccionado
  const filtered = selectedName
    ? paidPayments.filter(p => p.name === selectedName)
    : paidPayments

  // Agrupa por mes
  function paymentsInMonth(month, year) {
    return filtered.filter(p => {
      const d = dateOf(p.due_date)
      return d.getMonth() === month && d.getFullYear() === year
    })
  }

  function totalInMonth(month, year) {
    return paymentsInMonth(month, year).filter(p => !p.is_variable).reduce((a, p) => a + Number(p.amount), 0)
  }

  const maxTotal = Math.max(...months.map(m => totalInMonth(m.month, m.year)), 1)
  const grandTotal = filtered.reduce((a, p) => a + Number(p.amount), 0)
  const avgMonthly = grandTotal / monthsBack

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ padding: '20px 16px 8px' }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#1A1915' }}>Historial</div>
        <div style={{ fontSize: 13, color: '#5C5A55', marginTop: 2 }}>Revisa tus pagos de los últimos meses</div>
      </div>

      {/* Filtro de concepto */}
      <div style={{ padding: '0 16px 8px', display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8 }}>
        <button onClick={() => setSelectedName(null)} style={{ padding: '6px 14px', borderRadius: 20, border: !selectedName ? '1.5px solid #1E6B45' : '0.5px solid #E4E2DC', background: !selectedName ? '#EAF4EE' : '#fff', color: !selectedName ? '#1E6B45' : '#5C5A55', fontSize: 12, fontWeight: !selectedName ? 600 : 400, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
          Todos
        </button>
        {names.map((n, i) => (
          <button key={n} onClick={() => setSelectedName(n === selectedName ? null : n)} style={{ padding: '6px 14px', borderRadius: 20, border: selectedName === n ? '1.5px solid #1E6B45' : '0.5px solid #E4E2DC', background: selectedName === n ? '#EAF4EE' : '#fff', color: selectedName === n ? '#1E6B45' : '#5C5A55', fontSize: 12, fontWeight: selectedName === n ? 600 : 400, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {n}
          </button>
        ))}
      </div>

      {/* Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 16px 8px' }}>
        <div style={{ background: '#fff', border: '0.5px solid #E4E2DC', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#5C5A55', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Total {monthsBack} meses</div>
          <div style={{ fontSize: 19, fontWeight: 600, color: '#1A1915' }}>{fmt(grandTotal)}</div>
        </div>
        <div style={{ background: '#fff', border: '0.5px solid #E4E2DC', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#5C5A55', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Promedio mensual</div>
          <div style={{ fontSize: 19, fontWeight: 600, color: '#1A1915' }}>{fmt(Math.round(avgMonthly))}</div>
        </div>
      </div>

      {/* Filtro de periodo */}
      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 6 }}>
        {[3, 6, 12].map(n => (
          <button key={n} onClick={() => setMonthsBack(n)} style={{ padding: '5px 12px', borderRadius: 20, border: monthsBack === n ? '1.5px solid #1E6B45' : '0.5px solid #E4E2DC', background: monthsBack === n ? '#EAF4EE' : '#fff', color: monthsBack === n ? '#1E6B45' : '#5C5A55', fontSize: 12, fontWeight: monthsBack === n ? 600 : 400, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
            {n} meses
          </button>
        ))}
      </div>

      {/* Gráfica de barras */}
      <div style={{ margin: '0 16px 12px', background: '#fff', border: '0.5px solid #E4E2DC', borderRadius: 12, padding: '16px 14px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#5C5A55', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Gasto mensual</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100 }}>
          {months.map((m, i) => {
            const total = totalInMonth(m.month, m.year)
            const heightPct = maxTotal > 0 ? (total / maxTotal) * 100 : 0
            const isCurrentMonth = m.month === now.getMonth() && m.year === now.getFullYear()
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                {total > 0 && <div style={{ fontSize: 9, color: '#5C5A55', textAlign: 'center' }}>{fmt(total).replace('$','')}</div>}
                <div style={{ width: '100%', height: `${Math.max(heightPct, total > 0 ? 4 : 0)}%`, background: isCurrentMonth ? '#1E6B45' : '#C5E0CF', borderRadius: '3px 3px 0 0', transition: 'height .3s', minHeight: total > 0 ? 4 : 0 }} />
                <div style={{ fontSize: 9, color: isCurrentMonth ? '#1E6B45' : '#5C5A55', fontWeight: isCurrentMonth ? 600 : 400, textAlign: 'center' }}>{m.label.split(' ')[0]}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Lista por mes */}
      {months.slice().reverse().map(m => {
        const items = paymentsInMonth(m.month, m.year)
        if (items.length === 0) return null
        const total = items.filter(p => !p.is_variable).reduce((a, p) => a + Number(p.amount), 0)
        return (
          <div key={`${m.month}-${m.year}`} style={{ margin: '0 16px 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#5C5A55', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{MONTHS[m.month]} {m.year}</span>
              {total > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: '#1A1915' }}>{fmt(total)}</span>}
            </div>
            <div style={{ background: '#fff', border: '0.5px solid #E4E2DC', borderRadius: 12, overflow: 'hidden' }}>
              {items.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < items.length - 1 ? '0.5px solid #F0EFE9' : 'none' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1915' }}>
                      {p.name}
                      {p.is_installment && <span style={{ fontSize: 10, color: '#5C5A55', marginLeft: 6 }}>Pago {p.current_installment}/{p.total_installments}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#5C5A55' }}>{p.category}</div>
                  </div>
                  {p.is_variable
                    ? <span style={{ fontSize: 11, color: '#A06B12', background: '#FEF3DC', padding: '2px 8px', borderRadius: 20 }}>Variable</span>
                    : <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1915' }}>{fmt(p.amount)}</span>
                  }
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 24px', fontSize: 13, color: '#5C5A55' }}>
          {selectedName ? `Sin pagos registrados para "${selectedName}"` : 'Sin pagos en este periodo'}
        </div>
      )}
    </div>
  )
}
