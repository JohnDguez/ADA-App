import { useRef, useLayoutEffect, useState } from 'react'

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
      data-amount
      value={displayValue}
      onChange={handleChange}
    />
  )
}

// Monto principal del pago nuevo (v0.9.1080): se ve el fantasma «0.00» y los
// dígitos entran como PESOS (50 → 50; 50.5 → punto y decimales), como en Banamex;
// ya no se llena por la derecha en centavos (v0.9.608). Con el foco muestra lo que
// se escribe (con miles en vivo); al salir completa los centavos (50 → 50.00).
// Entrega/recibe el mismo número limpio de siempre ('50.5') o '' si está vacío.
const MAX_INT_DIGITS = 9

export function cleanTyped(text) {
  let r = text.replace(/[^\d.]/g, '')
  const dot = r.indexOf('.')
  if (dot !== -1) r = r.slice(0, dot + 1) + r.slice(dot + 1).replace(/\./g, '')
  const [intPart, dec] = r.split('.')
  let i = (intPart || '').replace(/^0+(?=\d)/, '').slice(0, MAX_INT_DIGITS)
  if (i === '' && dec !== undefined) i = '0'
  return dec === undefined ? i : i + '.' + dec.slice(0, 2)
}

// 50 → «50.00», 1500.5 → «1,500.50»; cero o vacío → ''.
export function withCents(value) {
  const n = parseFloat(value)
  if (!Number.isFinite(n) || n <= 0) return ''
  const [i, d] = n.toFixed(2).split('.')
  return formatAmount(i) + '.' + d
}

export function HeroAmountInput({ value, onChange, className, emptyClassName, ...rest }) {
  const inputRef = useRef(null)
  const [focused, setFocused] = useState(false)
  const raw = value != null ? String(value) : ''
  const text = focused ? formatAmount(raw) : withCents(raw)

  // El cursor siempre al final: no hay nada que editar a la mitad.
  useLayoutEffect(() => {
    const el = inputRef.current
    if (el && document.activeElement === el) el.setSelectionRange(text.length, text.length)
  })

  function handleChange(e) { onChange({ target: { value: cleanTyped(e.target.value) } }) }
  function toEnd(e) { const l = e.target.value.length; e.target.setSelectionRange(l, l) }

  // Ancho según el contenido (los separadores miden menos que un dígito).
  const shown = text || '0.00'
  const seps = (shown.match(/[,.']/g) || []).length
  return (
    <input
      {...rest}
      ref={inputRef}
      type="text"
      inputMode="decimal"
      data-amount
      placeholder="0.00"
      className={`${className || ''} ${text === '' ? emptyClassName || '' : ''}`}
      style={{ ...(rest.style || {}), width: `${shown.length - seps * 0.45 + 0.6}ch` }}
      value={text}
      onChange={handleChange}
      onFocus={e => { setFocused(true); toEnd(e) }}
      onBlur={() => setFocused(false)}
      onSelect={toEnd}
      onClick={toEnd}
    />
  )
}
