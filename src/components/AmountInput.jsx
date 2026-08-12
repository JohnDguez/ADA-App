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
