import { useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './PaidByStack.module.css'

// "Pagado por" — muestra el avatar de quién pagó un gasto ya liquidado de un
// Espacio Compartido. Si un solo miembro puso el 100%, un avatar suelto; si
// se pagó vía "Dividir entre miembros", un stack superpuesto (uno por cada
// contribuyente distinto). Al tocar cualquier avatar del stack se abre un
// tooltip con su foto (o iniciales) + nombre — el tooltip se renderiza vía
// createPortal a document.body con position:fixed (mismo patrón ya
// establecido en PayCard.jsx v0.9.238 para sus menús flotantes), para que
// nunca quede recortado por algún ancestro con overflow:hidden — ej.
// `.contentSwipeWrap` en HomePage.jsx.
//
// Props:
//   contributors — arreglo `{ user_id, amount }` (viene de
//                  `payment.contributors`, armado en usePayments.js →
//                  fetchPayments)
//   members      — arreglo de miembros del espacio activo, con `.user_id` y
//                  `.profile.{name,avatar_url}` (viene de
//                  `sharedSpace.members`, useSharedSpaces.js)
//   size         — diámetro en px de cada avatar (default 24)
//   inline       — true para pegarlo al final de una línea de texto (ej. el
//                  colapsable de pagados de HomePage.jsx); false (default)
//                  para que se vea como su propio renglón, con margen arriba
//                  (ej. debajo de la categoría en PaymentsPage.jsx)
export function PaidByStack({ contributors, members, size = 24, inline = false }) {
  const [tooltip, setTooltip] = useState(null) // { entry, x, y } | null

  if (!contributors?.length || !members?.length) return null

  // Un avatar por miembro distinto — si por alguna razón hubiera 2 filas del
  // mismo user_id (no debería pasar), no se duplica el avatar.
  const seen = new Set()
  const entries = []
  for (const c of contributors) {
    if (seen.has(c.user_id)) continue
    seen.add(c.user_id)
    const member = members.find(m => m.user_id === c.user_id)
    entries.push({ userId: c.user_id, profile: member?.profile || null })
  }
  if (!entries.length) return null

  function openTooltip(e, entry) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({ entry, x: rect.left + rect.width / 2, y: rect.top })
  }

  return (
    <div className={inline ? styles.stackInline : styles.stack}>
      {entries.map((entry, i) => (
        <button
          key={entry.userId}
          type="button"
          onClick={e => openTooltip(e, entry)}
          className={styles.avatarButton}
          style={{ width: size, height: size, marginLeft: i === 0 ? 0 : -Math.round(size * 0.4), zIndex: entries.length - i }}
          aria-label={entry.profile?.name || 'Miembro del espacio'}
        >
          {entry.profile?.avatar_url ? (
            <img src={entry.profile.avatar_url} alt="" className={styles.avatarImg} />
          ) : (
            <span className={styles.avatarInitial} style={{ fontSize: Math.round(size * 0.42) }}>
              {(entry.profile?.name || '?').charAt(0).toUpperCase()}
            </span>
          )}
        </button>
      ))}

      {tooltip && createPortal(
        <>
          <div className={styles.tooltipOverlay} onClick={() => setTooltip(null)} />
          <div className={styles.tooltip} style={{ left: tooltip.x, top: tooltip.y }}>
            <div className={styles.tooltipAvatar}>
              {tooltip.entry.profile?.avatar_url ? (
                <img src={tooltip.entry.profile.avatar_url} alt="" className={styles.avatarImg} />
              ) : (
                <span className={styles.avatarInitial} style={{ fontSize: 15 }}>
                  {(tooltip.entry.profile?.name || '?').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span className={styles.tooltipName}>{tooltip.entry.profile?.name || 'Miembro del espacio'}</span>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
