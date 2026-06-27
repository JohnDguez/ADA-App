import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fmt, dateOf, MONTHS, MONTHS_SHORT, CATEGORIES, cobroPeriod } from '../lib/utils'

const CAT_COLOR = {
  'Servicios':     'var(--cat-servicios)',
  'Suscripciones': 'var(--cat-suscripciones)',
  'Créditos':      'var(--cat-creditos)',
  'Renta':         'var(--cat-renta)',
  'Seguros':       'var(--cat-seguros)',
  'Alimentación':  'var(--cat-alimentacion)',
  'Otros':         'var(--cat-otros)',
}

export function PaymentsPage({ payments, profile }) {
  const now = new Date()

  const [monthsBack, setMonthsBack] = useState(3)
  const [selectedCat, setSelectedCat] = useState(null)
  const [catRange, setCatRange] = useState('mes')
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear, setViewYear]   = useState(now.getFullYear())

  const paidPayments = payments.filter(p => p.is_paid)

  function paidInMonth(month, year, cat) {
    return paidPayments.filter(p => {
      const d = dateOf(p.due_date)
      const matchMonth = d.getMonth() === month && d.getFullYear() === year
      const matchCat   = cat ? p.category === cat : true
      return matchMonth && matchCat
    })
  }

  function totalInMonth(month, year, cat) {
    return paidInMonth(month, year, cat).reduce((a, p) => a + Number(p.amount), 0)
  }

  // Bloque 1 — gráfica
  function getMonthsArray(n) {
    const arr = []
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      arr.push({ month: d.getMonth(), year: d.getFullYear() })
    }
    return arr
  }

  const chartMonths  = getMonthsArray(monthsBack)
  const chartFiltered = selectedCat ? paidPayments.filter(p => p.category === selectedCat) : paidPayments

  function chartTotalInMonth(month, year) {
    return chartFiltered
      .filter(p => { const d = dateOf(p.due_date); return d.getMonth() === month && d.getFullYear() === year })
      .reduce((a, p) => a + Number(p.amount), 0)
  }

  const chartTotals = chartMonths.map(m => chartTotalInMonth(m.month, m.year))
  const maxChart    = Math.max(...chartTotals, 1)
  const grandTotal  = chartTotals.reduce((a, b) => a + b, 0)
  const avgMonthly  = grandTotal / monthsBack

  // Bloque 2 — por categoría
  function getCatTotal(cat) {
    if (catRange === 'mes') {
      return totalInMonth(now.getMonth(), now.getFullYear(), cat)
    }
    if (catRange === 'periodo') {
      const { start, end } = cobroPeriod(profile)
      return paidPayments
        .filter(p => { const d = dateOf(p.due_date); return p.category === cat && d >= start && d <= end })
        .reduce((a, p) => a + Number(p.amount), 0)
    }
    return paidPayments
      .filter(p => { const d = dateOf(p.due_date); return p.category === cat && d.getFullYear() === now.getFullYear() })
      .reduce((a, p) => a + Number(p.amount), 0)
  }

  const catData = CATEGORIES
    .map(cat => ({ cat, total: getCatTotal(cat) }))
    .filter(d => d.total > 0)
    .sort((a, b) => b.total - a.total)

  const maxCat = Math.max(...catData.map(d => d.total), 1)

  // Bloque 3 — pagos del mes
  function changeViewMonth(delta) {
    let m = viewMonth + delta, y = viewYear
    if (m > 11) { m = 0; y++ }
    if (m < 0)  { m = 11; y-- }
    setViewMonth(m); setViewYear(y)
  }

  const paidInView  = paidInMonth(viewMonth, viewYear).sort((a, b) => dateOf(b.due_date) - dateOf(a.due_date))
  const totalInView = paidInView.reduce((a, p) => a + Number(p.amount), 0)

  return (
    <div style={{ paddingBottom: 120, background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Título */}
      <div style={{ padding: '20px 16px 12px' }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>Mis Gastos</div>
      </div>

      {/* ── BLOQUE 1: Gráfica ── */}
      <div style={{ padding: '0 16px 8px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        <CatChip label="Todos" active={!selectedCat} onClick={() => setSelectedCat(null)} />
        {CATEGORIES.map(c => (
          <CatChip key={c} label={c} active={selectedCat === c} onClick={() => setSelectedCat(selectedCat === c ? null : c)} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 16px 10px' }}>
        <StatCard label={`Total ${monthsBack} meses`} value={fmt(grandTotal)} />
        <StatCard label="Promedio mensual" value={fmt(Math.round(avgMonthly))} />
      </div>

      <div style={{ padding: '0 16px 10px', display: 'flex', gap: 6 }}>
        {[3, 6, 12].map(n => (
          <RangeChip key={n} label={`${n} meses`} active={monthsBack === n} onClick={() => setMonthsBack(n)} />
        ))}
      </div>

      <div style={{ margin: '0 16px 20px', background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 14px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
          Gastos mensuales
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100 }}>
          {chartMonths.map((m, i) => {
            const total     = chartTotals[i]
            const heightPct = (total / maxChart) * 100
            const isCurrent = m.month === now.getMonth() && m.year === now.getFullYear()
            const barColor  = selectedCat ? CAT_COLOR[selectedCat] : 'var(--accent)'
            const barMuted  = selectedCat ? (CAT_COLOR[selectedCat] + '55') : 'var(--accent-border)'
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                {total > 0 && (
                  <div style={{ fontSize: 9, color: isCurrent ? barColor : 'var(--muted)', fontWeight: 600, textAlign: 'center' }}>
                    {fmt(total)}
                  </div>
                )}
                <div style={{
                  width: '100%',
                  height: `${Math.max(heightPct, total > 0 ? 4 : 0)}%`,
                  background: isCurrent ? barColor : barMuted,
                  borderRadius: '3px 3px 0 0',
                  minHeight: total > 0 ? 4 : 0,
                  transition: 'height .3s',
                }} />
                <div style={{ fontSize: 9, color: isCurrent ? barColor : 'var(--muted)', fontWeight: isCurrent ? 600 : 400, textAlign: 'center' }}>
                  {MONTHS_SHORT[m.month]}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── BLOQUE 2: Por Categoría ── */}
      <div style={{ padding: '0 16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Por Categoría</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ id: 'mes', label: 'Mes actual' }, { id: 'periodo', label: 'Periodo' }, { id: 'año', label: 'Año' }].map(o => (
              <RangeChip key={o.id} label={o.label} active={catRange === o.id} onClick={() => setCatRange(o.id)} />
            ))}
          </div>
        </div>

        {catData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: 'var(--muted)' }}>
            Sin gastos registrados
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {catData.map(({ cat, total }) => (
              <div key={cat}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{cat}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{fmt(total)}</span>
                </div>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(total / maxCat) * 100}%`,
                    background: CAT_COLOR[cat] || 'var(--accent)',
                    borderRadius: 'var(--radius-full)',
                    transition: 'width .4s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── BLOQUE 3: Pagos realizados ── */}
      <div style={{ padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Pagos</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button onClick={() => changeViewMonth(-1)} style={{ background: 'none', border: 'none', padding: 4, display: 'flex', cursor: 'pointer' }}>
              <ChevronLeft size={18} color="var(--muted)" />
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', minWidth: 110, textAlign: 'center' }}>
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button onClick={() => changeViewMonth(1)} style={{ background: 'none', border: 'none', padding: 4, display: 'flex', cursor: 'pointer' }}>
              <ChevronRight size={18} color="var(--muted)" />
            </button>
          </div>
        </div>

        {paidInView.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: 'var(--muted)' }}>
            Sin pagos realizados en {MONTHS[viewMonth]}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Total: <strong style={{ color: 'var(--text)' }}>{fmt(totalInView)}</strong>
              </span>
            </div>
            <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              {paidInView.map((p, i) => {
                const d      = dateOf(p.due_date)
                const isLast = i === paidInView.length - 1
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center',
                    padding: '10px 14px',
                    borderBottom: isLast ? 'none' : '0.5px solid var(--bg)',
                    borderLeft: '4px solid var(--paid)',
                    gap: 10,
                  }}>
                    {/* Fecha */}
                    <div style={{ textAlign: 'center', minWidth: 28, flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{d.getDate()}</div>
                      <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase' }}>{MONTHS_SHORT[d.getMonth()]}</div>
                    </div>
                    <div style={{ width: 1, height: 28, background: 'var(--border)', flexShrink: 0 }} />
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {p.name}
                        {p.is_installment && (
                          <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400 }}>
                            {p.current_installment}/{p.total_installments}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: CAT_COLOR[p.category] || 'var(--muted)', display: 'inline-block', flexShrink: 0 }} />
                        {p.category}
                      </div>
                    </div>
                    {/* Monto */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{fmt(p.amount)}</div>
                      {p.is_variable && (
                        <span style={{ fontSize: 9, background: '#8B5CF6', color: '#fff', padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>
                          Variable
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
    </div>
  )
}

function CatChip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 'var(--radius-full)',
      border: active ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
      background: active ? 'var(--accent)' : 'var(--surface)',
      color: active ? '#fff' : 'var(--muted)',
      fontSize: 12, fontWeight: active ? 600 : 400,
      fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
      transition: 'background .15s, color .15s',
    }}>
      {label}
    </button>
  )
}

function RangeChip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 'var(--radius-full)',
      border: active ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
      background: active ? 'var(--accent-soft)' : 'var(--surface)',
      color: active ? 'var(--accent)' : 'var(--muted)',
      fontSize: 11, fontWeight: active ? 600 : 400,
      fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', whiteSpace: 'nowrap',
      transition: 'background .15s, color .15s',
    }}>
      {label}
    </button>
  )
}
