import { dateOf, MONTHS_SHORT } from '../lib/utils'
import { PayCard } from './PayCard'

// Riel vertical de pagos: una línea continua con un punto de fecha por pago,
// agrupados con un separador de mes (siempre antes del primer pago del
// riel, y de nuevo cada vez que el mes realmente cambia — así nunca hay un
// día "huérfano" sin saber a qué mes pertenece, incluso si el periodo cruza
// dos meses).
//
// `dotColor`/`dotTextColor`: color del punto y su texto — se pasa una vez
// por sección (Vencidos / Periodo actual / Próximo periodo), igual que
// antes se pasaba `borderLeft` a cada `PayCard` de esa sección.
export function PayRail({ payments, cfg, dotColor, dotTextColor, handlers }) {
  let lastMonth = null

  return (
    <div style={{ position: 'relative', paddingLeft: 34 }}>
      <div style={{ position: 'absolute', left: 11, top: 6, bottom: 6, width: 2, background: 'var(--border)' }} />
      {payments.map((p, i) => {
        const d = dateOf(p.due_date)
        const month = d.getMonth()
        const showMonth = month !== lastMonth
        lastMonth = month

        return (
          <div key={p.id}>
            {showMonth && (
              <div style={{ paddingLeft: 2, margin: i === 0 ? '0 0 6px' : '14px 0 6px' }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {MONTHS_SHORT[month]}
                </span>
              </div>
            )}
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <div style={{
                position: 'absolute', left: -34, top: 2, width: 24, height: 24, borderRadius: '50%',
                background: dotColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 600, color: dotTextColor,
              }}>
                {d.getDate()}
              </div>
              <PayCard payment={p} cfg={cfg} {...handlers} railMode hideDate hideDueLabel />
            </div>
          </div>
        )
      })}
    </div>
  )
}
