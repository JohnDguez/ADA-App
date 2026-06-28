import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
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

export function PaymentsPage({ payments, profile, unreadCount, onOpenNotifs, onGoSettings, onMarkUnpaid, onDelete, onDeleteDirect }) {
  const now = new Date()

  const [monthsBack,  setMonthsBack]  = useState(3)
  const [selectedCat, setSelectedCat] = useState(null)
  const [catRange,    setCatRange]    = useState('mes')
  const [viewMonth,   setViewMonth]   = useState(now.getMonth())
  const [viewYear,    setViewYear]    = useState(now.getFullYear())
  const [openMenu,    setOpenMenu]    = useState(null) // { id, top, right }

  const paidPayments = payments.filter(p => p.is_paid)

  function paidInMonth(month, year, cat) {
    return paidPayments.filter(p => {
      const d = dateOf(p.due_date)
      return d.getMonth() === month && d.getFullYear() === year && (cat ? p.category === cat : true)
    })
  }

  // ── Gráfica ──────────────────────────────────────────────
  function getMonthsArray(n) {
    const arr = []
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      arr.push({ month: d.getMonth(), year: d.getFullYear() })
    }
    return arr
  }

  const chartMonths   = getMonthsArray(monthsBack)
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

  // ── Por categoría ─────────────────────────────────────────
  function getCatTotal(cat) {
    if (catRange === 'mes') {
      return paidInMonth(now.getMonth(), now.getFullYear(), cat).reduce((a, p) => a + Number(p.amount), 0)
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

  // ── Pagos realizados ──────────────────────────────────────
  function changeViewMonth(delta) {
    let m = viewMonth + delta, y = viewYear
    if (m > 11) { m = 0; y++ }
    if (m < 0)  { m = 11; y-- }
    setViewMonth(m); setViewYear(y)
  }

  // Filtros de mes y año
  const availableYears = [...new Set(paidPayments.map(p => dateOf(p.due_date).getFullYear()))].sort((a, b) => b - a)
  if (!availableYears.includes(viewYear)) availableYears.unshift(viewYear)

  const paidInView  = paidInMonth(viewMonth, viewYear).sort((a, b) => dateOf(b.due_date) - dateOf(a.due_date))
  const totalInView = paidInView.reduce((a, p) => a + Number(p.amount), 0)

  function handleMenuAction(action, payment) {
    setOpenMenu(null)
    if (action === 'unpaid') onMarkUnpaid && onMarkUnpaid(payment.id)
    if (action === 'delete') {
      // Pagos ya pagados: eliminar directamente sin lógica de parcialidades futuras
      if (payment.is_paid) {
        if (!window.confirm('¿Eliminar este pago del historial?')) return
        onDeleteDirect && onDeleteDirect(payment.id)
      } else {
        onDelete && onDelete(payment.id, payment)
      }
    }
  }

  return (
    <div style={{ paddingBottom: 120, background: 'var(--bg)', minHeight: '100vh' }} onClick={() => setOpenMenu(null)}>
      {/* Menú contextual flotante — fuera del overflow del contenedor */}
      {openMenu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: openMenu.top,
            right: openMenu.right,
            zIndex: 999,
            background: 'var(--surface)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            minWidth: 180,
            overflow: 'hidden',
          }}
        >
          {(() => {
            const p = payments.find(x => x.id === openMenu.id)
            if (!p) return null
            return (
              <>
                <button onClick={() => handleMenuAction('unpaid', p)} style={{ width: '100%', padding: '11px 14px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, fontWeight: 500, color: 'var(--text)', cursor: 'pointer', display: 'block', borderBottom: '0.5px solid var(--bg)' }}>
                  Marcar como no pagado
                </button>
                <button onClick={() => handleMenuAction('delete', p)} style={{ width: '100%', padding: '11px 14px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, fontWeight: 500, color: 'var(--danger)', cursor: 'pointer', display: 'block' }}>
                  Eliminar
                </button>
              </>
            )
          })()}
        </div>
      )}

      <PageHeader
        profile={profile}
        unreadCount={unreadCount}
        onOpenNotifs={onOpenNotifs}
        onGoSettings={onGoSettings}
      />

      <div style={{ background: 'var(--bg)', borderRadius: '24px 24px 0 0', marginTop: -24, position: 'relative', zIndex: 10, paddingTop: 20 }}>

        {/* Título */}
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Mis Gastos</div>
        </div>


        {/* ── BALANCE DEL PERIODO (solo si salary_enabled) ── */}
        {profile?.salary_enabled && profile?.salary_amount > 0 && (() => {
          const { start, end } = cobroPeriod(profile)
          const gastosPeriodo = paidPayments.filter(p => {
            const d = dateOf(p.due_date)
            return d >= start && d <= end
          })
          const totalGastos  = gastosPeriodo.reduce((a, p) => a + Number(p.amount), 0)
          const salario      = Number(profile.salary_amount)
          const disponible   = salario - totalGastos
          const pctGastos    = Math.min((totalGastos / salario) * 100, 100)
          const sobrePasado  = totalGastos > salario

          // Segmentos por categoría
          const segmentos = CATEGORIES
            .map(cat => ({
              cat,
              total: gastosPeriodo.filter(p => p.category === cat).reduce((a, p) => a + Number(p.amount), 0),
            }))
            .filter(s => s.total > 0)
            .sort((a, b) => b.total - a.total)

          return (
            <div style={{ margin: '0 16px 16px', background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
              {/* Cabecera */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Disponible este periodo</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: sobrePasado ? 'var(--danger)' : 'var(--paid)', lineHeight: 1 }}>
                    {sobrePasado ? '-' : ''}{fmt(Math.abs(disponible))}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>
                    {fmt(totalGastos)} <span style={{ fontWeight: 400 }}>/ {fmt(salario)}</span>
                  </div>
                  {sobrePasado && (
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--danger)' }}>Presupuesto excedido</div>
                  )}
                </div>
              </div>

              {/* Barra heatmap segmentada */}
              <div style={{ height: 12, borderRadius: 6, overflow: 'hidden', display: 'flex', background: 'var(--border)', marginBottom: 10 }}>
                {segmentos.map(({ cat, total }) => (
                  <div
                    key={cat}
                    style={{
                      height: '100%',
                      width: `${Math.min((total / salario) * 100, 100)}%`,
                      background: CAT_COLOR[cat] || 'var(--accent)',
                      flexShrink: 0,
                      transition: 'width .4s ease',
                    }}
                    title={`${cat}: ${fmt(total)}`}
                  />
                ))}
              </div>

              {/* Chips de categoría */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {segmentos.map(({ cat, total }) => (
                  <div key={cat} style={{
                    padding: '3px 10px',
                    borderRadius: 5,
                    fontSize: 11,
                    fontWeight: 500,
                    background: (CAT_COLOR[cat] || 'var(--accent)') + '22',
                    color: CAT_COLOR[cat] || 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: CAT_COLOR[cat] || 'var(--accent)', display: 'inline-block' }} />
                    {cat} {fmt(total)}
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Chips de categoría */}
        <div style={{ padding: '0 16px 15px', display: 'flex', gap: 6, overflowX: 'auto', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
          <FilterChip label="Todos" active={!selectedCat} onClick={() => setSelectedCat(null)} />
          {CATEGORIES.map(c => (
            <FilterChip key={c} label={c} active={selectedCat === c} onClick={() => setSelectedCat(selectedCat === c ? null : c)} />
          ))}
        </div>

        {/* Stats */}
        <div style={{ margin: '0 16px 12px', background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1.6 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', textTransform: 'none', marginBottom: 4 }}>
              Total {monthsBack} meses
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>{fmt(grandTotal)}</div>
          </div>
          <div style={{ width: 1, height: 40, background: 'var(--border)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              Promedio mensual
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>{fmt(Math.round(avgMonthly))}</div>
          </div>
        </div>

        {/* Selector de rango */}
        <div style={{ padding: '0 16px 10px', display: 'flex', gap: 6 }}>
          {[3, 6, 12].map(n => (
            <FilterChip key={n} label={`${n} meses`} active={monthsBack === n} onClick={() => setMonthsBack(n)} />
          ))}
        </div>

        {/* Gráfica */}
        <div style={{ margin: '0 16px 20px', background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '16px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>
            Gastos Mensuales
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
                    <div style={{ fontSize: 9, fontWeight: 700, color: isCurrent ? barColor : 'var(--text)', textAlign: 'center' }}>
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
                  <div style={{ fontSize: 9, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? barColor : 'var(--text)', textAlign: 'center' }}>
                    {MONTHS_SHORT[m.month]}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Por Categoría */}
        <div style={{ padding: '0 16px 20px' }}>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Por Categoría</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[{ id: 'mes', label: 'Mes Actual' }, { id: 'periodo', label: 'Periodo' }, { id: 'año', label: 'Año' }].map(o => (
              <FilterChip key={o.id} label={o.label} active={catRange === o.id} onClick={() => setCatRange(o.id)} />
            ))}
          </div>

          {catData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
              Sin gastos registrados
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {catData.map(({ cat, total }) => (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{cat}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{fmt(total)}</span>
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

        {/* ── Pagos realizados ── */}
        <div style={{ padding: '0 16px' }}>

          {/* Header sección */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Pagos</span>
          </div>

          {/* Filtros Mes y Año */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Filtros</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>Mes:</span>
              <select
                value={viewMonth}
                onChange={e => setViewMonth(Number(e.target.value))}
                style={{ padding: '5px 8px', borderRadius: 5, border: '0.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 500, fontFamily: 'DM Sans, sans-serif', outline: 'none', cursor: 'pointer' }}
              >
                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>Año:</span>
              <select
                value={viewYear}
                onChange={e => setViewYear(Number(e.target.value))}
                style={{ padding: '5px 8px', borderRadius: 5, border: '0.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 500, fontFamily: 'DM Sans, sans-serif', outline: 'none', cursor: 'pointer' }}
              >
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {paidInView.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
              Sin pagos realizados en {MONTHS[viewMonth]} {viewYear}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>
                  Total: <strong style={{ fontWeight: 700 }}>{fmt(totalInView)}</strong>
                </span>
              </div>
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                {paidInView.map((p, i) => {
                  const paidDate = p.paid_at ? new Date(p.paid_at) : dateOf(p.due_date)
                  const isLast   = i === paidInView.length - 1
                  const menuOpen = openMenu === p.id
                  return (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center',
                      padding: '10px 14px',
                      borderBottom: isLast ? 'none' : '0.5px solid var(--bg)',
                      borderLeft: '4px solid var(--paid)',
                      gap: 10,
                      position: 'relative',
                    }}>
                      {/* Fecha de pago */}
                      <div style={{ textAlign: 'center', minWidth: 28, flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{paidDate.getDate()}</div>
                        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase' }}>{MONTHS_SHORT[paidDate.getMonth()]}</div>
                      </div>
                      <div style={{ width: 1, height: 28, background: 'var(--border)', flexShrink: 0 }} />
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {p.name}
                          {p.is_installment && (
                            <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text)' }}>
                              {p.current_installment}/{p.total_installments}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: CAT_COLOR[p.category] || 'var(--text)', display: 'inline-block', flexShrink: 0 }} />
                          {p.category}
                          {p.is_recurrent && <span style={{ fontWeight: 400 }}>· Mensual</span>}
                        </div>
                      </div>
                      {/* Monto + etiqueta variable */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{fmt(p.amount)}</div>
                        {p.is_variable && (
                          <span style={{ fontSize: 9, background: '#6884A9', color: '#fff', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                            Variable
                          </span>
                        )}
                      </div>
                      {/* Tres puntos */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            const rect = e.currentTarget.getBoundingClientRect()
                            setOpenMenu(openMenu?.id === p.id ? null : { id: p.id, top: rect.bottom + 4, right: window.innerWidth - rect.right })
                          }}
                          style={{ background: 'none', border: 'none', padding: '4px', display: 'flex', alignItems: 'center', cursor: 'pointer', borderRadius: 4 }}
                        >
                          <MoreVertical size={16} color="var(--text)" strokeWidth={1.8} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 5,
        border: active ? 'none' : '0.5px solid var(--border)',
        background: active ? 'var(--accent)' : 'var(--surface)',
        color: active ? '#fff' : 'var(--text)',
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        fontFamily: 'DM Sans, sans-serif',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        transition: 'background .15s, color .15s',
      }}
    >
      {label}
    </button>
  )
}
