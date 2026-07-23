import { useRef, useEffect } from 'react'
import { dateOf, MONTHS_SHORT } from '../lib/utils'
import { PayCard } from './PayCard'
import styles from './PayRail.module.css'

// Riel vertical de pagos: una línea continua con un punto de fecha por DÍA
// (no por pago) — si caen 2+ pagos el mismo día, comparten el punto y se
// apilan debajo, en vez de repetir el número. Agrupados con un separador de
// mes (siempre antes del primer grupo del riel, y de nuevo cada vez que el
// mes realmente cambia — así nunca hay un día "huérfano" sin saber a qué mes
// pertenece, incluso si el periodo cruza dos meses).
//
// Tanto el punto de día como la línea usan la misma columna implícita — el
// separador de mes ya no lleva un punto propio (se probó y se sentía como un
// nodo de más); ahora es solo texto que se sienta sobre la misma línea
// vertical continua, sin interrumpirla.
//
// `dotColor`/`dotTextColor`: color del punto y su texto — se pasa una vez
// por sección (Vencidos / Periodo actual / Próximo periodo), igual que
// antes se pasaba `borderLeft` a cada `PayCard` de esa sección.
// `nextPeriodMode`: true solo cuando este riel es el de "Pagos del próximo
// periodo" en HomePage.jsx — se reenvía a cada PayCard como
// `confirmBeforePay`, para que el check pida confirmación antes de marcar
// pagado un pago que en realidad vence hasta el periodo siguiente (previene
// pagar por error algo del periodo equivocado si el usuario se confunde de
// switch activo). No afecta a Vencidos/Pagos del periodo actual.
export function PayRail({ payments, cfg, dotColor, dotTextColor, handlers, permissions, nextPeriodMode }) {
  // Detecta el primer render de ESTE riel — las cards que ya vienen desde
  // ahí no deben "crecer" al aparecer (se verían todas animando de golpe
  // al cargar la página). Solo las que se agregan DESPUÉS (un pago nuevo,
  // el siguiente periodo de un recurrente, etc.) cuentan como nuevas —
  // cada `PayCard` ya está `key`-eado por `p.id`, así que React monta una
  // instancia genuinamente nueva solo para un id que no existía antes; una
  // card que ya estaba solo se vuelve a renderizar, nunca se re-monta.
  const firstRenderRef = useRef(true)
  const initialLoad = firstRenderRef.current
  useEffect(() => { firstRenderRef.current = false }, [])

  // `payments` ya viene ordenado ascendente por due_date, así que agrupar
  // por igualdad consecutiva de la key es suficiente (no hace falta un Map).
  const groups = []
  payments.forEach(p => {
    const last = groups[groups.length - 1]
    if (last && last.key === p.due_date) last.items.push(p)
    else groups.push({ key: p.due_date, items: [p] })
  })

  let lastMonth = null

  return (
    <div className={styles.railWrapper}>
      <div className={styles.railLine} />
      {groups.map((g, gi) => {
        const d = dateOf(g.key)
        const month = d.getMonth()
        const showMonth = month !== lastMonth
        lastMonth = month

        return (
          <div key={g.key}>
            {showMonth && (
              <div className={gi === 0 ? styles.monthLabelWrapperFirst : styles.monthLabelWrapper}>
                <span className={styles.monthLabelText}>
                  {MONTHS_SHORT[month]}
                </span>
              </div>
            )}
            <div className={styles.dayGroup}>
              <div className={styles.dayDot} style={{ background: dotColor, color: dotTextColor }}>
                {d.getDate()}
              </div>
              <div className={styles.dayItemsCol}>
                {g.items.map(p => (
                  <PayCard key={p.id} payment={p} cfg={cfg} {...handlers} permissions={permissions} railMode hideDate hideDueLabel initialLoad={initialLoad} confirmBeforePay={nextPeriodMode} />
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
