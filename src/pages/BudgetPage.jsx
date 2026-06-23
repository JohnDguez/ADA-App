import { fmt, nextCobroDate, getPagarEsteCobro, RECUR_FREQ } from '../lib/utils'
import { AlertTriangle, TrendingUp } from 'lucide-react'

const CAT_COLORS = ['#1E6B45','#A06B12','#B83232','#2563A8','#7C3D9E','#5C5A55']

export function BudgetPage({ payments, profile }) {
  const fixed = payments.filter(p => !p.is_variable)
  const total = fixed.reduce((a, p) => a + Number(p.amount), 0)
  const paid = fixed.filter(p => p.is_paid).reduce((a, p) => a + Number(p.amount), 0)
  const pct = total > 0 ? Math.round(paid / total * 100) : 0
  const barColor = pct >= 90 ? '#B83232' : pct >= 70 ? '#A06B12' : '#1E6B45'

  // Alerta de salario
  const salary = profile.salary_enabled ? Number(profile.salary_amount) : 0
  const pagarEsteCobro = getPagarEsteCobro(payments, profile)
  const cobroTotal = pagarEsteCobro.filter(p => !p.is_variable).reduce((a, p) => a + Number(p.amount), 0)
  const salaryPct = salary > 0 ? Math.round(cobroTotal / salary * 100) : 0
  const salaryAlert = salary > 0 && cobroTotal > salary * 0.8

  const cats = {}
  fixed.forEach(p => {
    if (!cats[p.category]) cats[p.category] = { total: 0, paid: 0 }
    cats[p.category].total += Number(p.amount)
    if (p.is_paid) cats[p.category].paid += Number(p.amount)
  })

  const cobroLabel = profile.cobro_freq === 'weekly'
    ? `este ${['domingo','lunes','martes','miércoles','jueves','viernes','sábado'][profile.cobro_weekday]}`
    : 'este periodo'

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ padding: '20px 16px 8px' }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#1A1915' }}>Presupuesto</div>
      </div>

      {/* Alerta salario */}
      {salary > 0 && (
        <div style={{ margin: '0 16px 8px', background: salaryAlert ? '#FCDEDE' : '#EAF4EE', border: `0.5px solid ${salaryAlert ? '#F5BABA' : '#C5E0CF'}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {salaryAlert
            ? <AlertTriangle size={16} color="#B83232" style={{ flexShrink: 0, marginTop: 1 }} />
            : <TrendingUp size={16} color="#1E6B45" style={{ flexShrink: 0, marginTop: 1 }} />
          }
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1915' }}>
              {salaryAlert ? 'Tus compromisos superan el 80% de tu ingreso' : 'Tus compromisos están bajo control'}
            </div>
            <div style={{ fontSize: 12, color: '#5C5A55', marginTop: 1 }}>
              Pagar {cobroLabel}: {fmt(cobroTotal)} de {fmt(salary)} ({salaryPct}% de tu ingreso)
            </div>
          </div>
        </div>
      )}

      {/* Resumen total */}
      <div style={{ margin: '0 16px', background: '#fff', border: '0.5px solid #E4E2DC', borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#5C5A55', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total comprometido</div>
        <div style={{ fontSize: 30, fontWeight: 600, color: '#1A1915', margin: '3px 0 12px' }}>{fmt(total)}</div>
        <div style={{ height: 8, background: '#EDEAE4', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 4, transition: 'width .4s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <span style={{ fontSize: 12, color: '#5C5A55' }}>Pagado: <strong style={{ color: '#1A1915' }}>{fmt(paid)}</strong></span>
          <span style={{ fontSize: 12, color: '#5C5A55' }}>{pct}%</span>
        </div>
      </div>

      {/* Siguiente cobro */}
      {pagarEsteCobro.length > 0 && (
        <>
          <div style={{ padding: '14px 16px 8px' }}>
            <h2 style={{ fontSize: 10, fontWeight: 600, color: '#5C5A55', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Compromisos {cobroLabel}
            </h2>
          </div>
          <div style={{ margin: '0 16px', background: '#fff', border: '0.5px solid #E4E2DC', borderRadius: 12, overflow: 'hidden' }}>
            {pagarEsteCobro.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderBottom: i < pagarEsteCobro.length - 1 ? '0.5px solid #F0EFE9' : 'none' }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1915' }}>{p.name}</span>
                {p.is_variable
                  ? <span style={{ fontSize: 11, color: '#A06B12', background: '#FEF3DC', padding: '2px 8px', borderRadius: 20 }}>Variable</span>
                  : <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1915' }}>{fmt(p.amount)}</span>
                }
              </div>
            ))}
            {cobroTotal > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: '#F7F6F3', borderTop: '0.5px solid #E4E2DC' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1915' }}>Total</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1E6B45' }}>{fmt(cobroTotal)}</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Por categoría */}
      <div style={{ padding: '14px 16px 8px' }}>
        <h2 style={{ fontSize: 10, fontWeight: 600, color: '#5C5A55', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Por categoria</h2>
      </div>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {Object.entries(cats).map(([name, v], i) => {
          const p = v.total > 0 ? Math.round(v.paid / v.total * 100) : 0
          return (
            <div key={name} style={{ background: '#fff', border: '0.5px solid #E4E2DC', borderRadius: 8, padding: '11px 13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1915' }}>{name}</span>
                <span style={{ fontSize: 12, color: '#5C5A55' }}>{fmt(v.paid)} / {fmt(v.total)}</span>
              </div>
              <div style={{ height: 4, background: '#EDEAE4', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${p}%`, background: CAT_COLORS[i % CAT_COLORS.length], borderRadius: 2 }} />
              </div>
            </div>
          )
        })}
        {Object.keys(cats).length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px', fontSize: 13, color: '#5C5A55' }}>
            Agrega pagos para ver el resumen por categoria
          </div>
        )}
      </div>
    </div>
  )
}
