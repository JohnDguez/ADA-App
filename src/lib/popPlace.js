// Coloca un popover fijo junto a su botón y lo mantiene dentro de la pantalla.
// Horizontal: alinea a la izquierda del botón (o a su derecha con `alignRight`); si no cabe, alinea a su borde
// derecho; si tampoco, lo pega al margen. Vertical: debajo del botón; si no
// cabe y arriba hay más espacio, lo abre hacia arriba (`up`); si ninguno
// alcanza, se limita con `maxHeight` y hace scroll por dentro.
const GAP = 10
const EDGE = 16

export function placePopover(btn, pop, desiredW, alignRight = false) {
  const r = btn.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = Math.min(desiredW, vw - EDGE * 2)

  let left = alignRight ? r.right - w : r.left
  if (!alignRight && left + w > vw - EDGE) left = r.right - w
  if (alignRight && left < EDGE) left = r.left
  left = Math.max(EDGE, Math.min(left, vw - w - EDGE))
  const arrow = Math.max(18, Math.min(r.left + r.width / 2 - left, w - 18))

  const natural = pop ? pop.scrollHeight + 2 : 0
  const below = vh - r.bottom - GAP - EDGE
  const above = r.top - GAP - EDGE
  const up = natural > below && above > below
  const room = up ? above : below
  const h = Math.min(natural, room)
  const top = up ? r.top - GAP - h : r.bottom + GAP
  return { left, top, width: w, arrow, up, maxHeight: Math.max(room, 120), clamped: natural > room }
}
