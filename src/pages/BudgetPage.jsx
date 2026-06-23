import { fmt } from '../lib/utils'

const CAT_COLORS = ['#1E6B45','#A06B12','#B83232','#2563A8','#7C3D9E','#5C5A55']

export function BudgetPage({ payments }) {
  const fixed = payments.filter(p => !p.is_variable)
  const total = fixed.reduce((a, p) => a + Number(p.amount), 0)
  const paid = fixed.filter(p => p.is_paid).reduce((a, p) => a + Number(p.amount), 0)
  const pct = total > 0 ? Math.round(paid / total * 100) : 0

  const cats = {}
  fixed.forEach(p => {
    if (!cats[p.category]) cats[p.category] = { total: 0, paid: 0 }
    cats[p.category].total += Number(p.amount)
    if (p.is_paid) cats[p.category].paid += Number(p.amount)
  })

  const barColor = pct >= 90 ? '#B83232' : pct >= 70 ? '#A06B12' : '#1E6B45'

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ padding: '20px 16px 8px' }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#1A1915' }}>Presupuesto</div>
      </div>

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
