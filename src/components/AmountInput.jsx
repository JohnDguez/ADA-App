import { useRef, useLayoutEffect } from 'react'

function groupInt(intStr) {
  const groups = []
  let s = intStr
  while (s.length > 3) {
    groups.unshift(s.slice(-3))
    s = s.slice(0, -3)
  }
  groups.unshift(s)
  return groups
}

function formatAmount(raw) {
  if (!raw) return ''
  const parts = raw.split('.')
  const groups = groupInt(parts[0] || '0')
  let intFormatted = groups[0]
  for (let i = 1; i < groups.length; i++) {
    const sep = i === groups.length - 1 ? ',' : "'"
    intFormatted += sep + groups[i]
  }
  if (parts.length > 1) return intFormatted + '.' + parts[1]
  if (raw.slice(-1) === '.') return intFormatted + '.'
  return intFormatted
}

function stripToRaw(formatted) {
  let cleaned = formatted.replace(/[^\d.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '')
  }
  const p = cleaned.split('.')
  if (p[1] !== undefined) cleaned = p[0] + '.' + p[1].slice(0, 2)
  return cleaned
}

// Input de monto con separador de miles (,) y millones (') en vivo mientras se escribe.
// Drop-in de <input type="number">: mismas props value/onChange (onChange recibe un
// evento con target.value = número limpio, sin separadores) — el resto de props
// (className, placeholder, autoFocus, onKeyDown, id, etc.) se reenvían tal cual.
export default function AmountInput({ value, onChange, ...rest }) {
  const inputRef = useRef(null)
  const pendingCursorRef = useRef(null)

  useLayoutEffect(() => {
    if (pendingCursorRef.current != null && inputRef.current) {
      inputRef.current.setSelectionRange(pendingCursorRef.current, pendingCursorRef.current)
      pendingCursorRef.current = null
    }
  })

  const displayValue = formatAmount(value != null ? String(value) : '')

  function handleChange(e) {
    const cursor = e.target.selectionStart
    const oldLen = e.target.value.length
    const raw = stripToRaw(e.target.value)
    const newLen = formatAmount(raw).length
    pendingCursorRef.current = Math.max(0, cursor + (newLen - oldLen))
    onChange({ target: { value: raw } })
  }

  return (
    <input
      {...rest}
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
    />
  )
}

// Monto "estilo app de banco" (v0.9.608): siempre se ve 0.00 y los dígitos
// entran por la derecha (1 → 0.01, 15 → 0.15, 1580 → 15.80). El valor que
// entrega/recibe sigue siendo el número limpio ('15.8') o '' si es cero.
const MAX_CENTS_DIGITS = 11

function toCents(value) {
  const n = parseFloat(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0
}

export function CentsAmountInput({ value, onChange, className, emptyClassName, ...rest }) {
  const inputRef = useRef(null)
  const cents = toCents(value)
  const text = formatAmount(String(Math.floor(cents / 100))) + '.' + String(cents % 100).padStart(2, '0')

  // El cursor siempre al final: no hay nada que editar a la mitad.
  useLayoutEffect(() => {
    const el = inputRef.current
    if (el && document.activeElement === el) el.setSelectionRange(text.length, text.length)
  })

  function handleChange(e) {
    const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_CENTS_DIGITS)
    const next = digits ? parseInt(digits, 10) : 0
    onChange({ target: { value: next ? (next / 100).toFixed(2) : '' } })
  }
  function toEnd(e) { const l = e.target.value.length; e.target.setSelectionRange(l, l) }

  // Ancho según el contenido (los separadores miden menos que un dígito).
  const seps = (text.match(/[,.']/g) || []).length
  return (
    <input
      {...rest}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      className={`${className || ''} ${cents === 0 ? emptyClassName || '' : ''}`}
      style={{ ...(rest.style || {}), width: `${text.length - seps * 0.45 + 0.6}ch` }}
      value={text}
      onChange={handleChange}
      onFocus={toEnd}
      onSelect={toEnd}
      onClick={toEnd}
    />
  )
}
