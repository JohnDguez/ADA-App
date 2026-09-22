// Lleva la vista a un pago y lo resalta un par de segundos (septiembre 2026,
// v0.9.480) — lo usa App.jsx al tocar una notificación de "no se pudo
// guardar un cambio". Busca el elemento por `data-payment-id` (PayCard,
// PaidCollapseItem de HomePage y las filas de Gastos lo llevan). Como el
// cambio de pestaña/espacio y la carga de datos tardan, reintenta cada
// 150ms hasta encontrarlo VISIBLE o agotar el tiempo — si el pago no está
// en pantalla (ej. dentro del colapsable de pagados cerrado, o fuera del
// filtro de fechas de Gastos) simplemente no resalta nada.
// La animación vive en index.css (`.payment-highlight`), con entrada y
// salida en el mismo keyframe (Regla 29); la clase se quita al terminar.
const FIRST_TRY_MS = 350 // cierre del panel + deslizamiento de la pestaña
const RETRY_MS = 150
const TIMEOUT_MS = 3000

export function highlightPaymentWhenVisible(paymentId) {
  if (!paymentId) return
  const started = Date.now()
  const selector = `[data-payment-id="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(paymentId) : paymentId}"]`

  function attempt() {
    const el = Array.from(document.querySelectorAll(selector)).find(e => e.getClientRects().length > 0)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.remove('payment-highlight')
      void el.offsetWidth // reinicia la animación si ya estaba resaltado
      el.classList.add('payment-highlight')
      el.addEventListener('animationend', () => el.classList.remove('payment-highlight'), { once: true })
      return
    }
    if (Date.now() - started < TIMEOUT_MS) setTimeout(attempt, RETRY_MS)
  }
  setTimeout(attempt, FIRST_TRY_MS)
}
