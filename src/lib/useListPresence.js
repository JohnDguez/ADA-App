import { useEffect, useRef, useState } from 'react'

// Entrada y salida suaves para filas de una lista (v0.9.976, DISENO.md §8).
// Devuelve la lista a dibujar: cada elemento con `_enter` (recién llegado:
// clase global `list-enter`) o `_exit` (ya no está en `items` pero se sigue
// dibujando `exitMs` con `list-exit` para que salga y colapse su espacio en
// vez de desaparecer de golpe). La primera carga y cada cambio de `resetKey`
// (cambiar de filtro, de mes o de espacio) NO animan fila por fila: ahí la
// lista entera ya tiene su propia transición.
// `exitMs` debe coincidir con la duración de `.list-exit` en index.css (Regla 30).
export const LIST_EXIT_MS = 280

export function useListPresence(items, keyOf = x => x.id, resetKey = '', exitMs = LIST_EXIT_MS) {
  const prevRef = useRef(null)          // items del último render confirmado
  const resetRef = useRef(resetKey)
  const [leaving, setLeaving] = useState([]) // [{ item, index }]
  const timers = useRef([])

  const isReset = prevRef.current === null || resetRef.current !== resetKey
  const prevKeys = isReset ? null : new Set(prevRef.current.map(keyOf))

  useEffect(() => {
    const prev = prevRef.current
    if (prev && resetRef.current === resetKey) {
      const now = new Set(items.map(keyOf))
      const gone = []
      prev.forEach((p, index) => { if (!now.has(keyOf(p))) gone.push({ item: p, index }) })
      if (gone.length) {
        setLeaving(l => [...l.filter(x => !gone.some(g => keyOf(g.item) === keyOf(x.item))), ...gone])
        const ids = gone.map(g => keyOf(g.item))
        const id = setTimeout(() => setLeaving(l => l.filter(x => !ids.includes(keyOf(x.item)))), exitMs)
        timers.current.push(id)
      }
    } else if (leaving.length) {
      setLeaving([])
    }
    prevRef.current = items
    resetRef.current = resetKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, resetKey])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const out = items.map(it => (prevKeys && !prevKeys.has(keyOf(it)) ? { ...it, _enter: true } : it))
  if (!isReset) {
    const present = new Set(items.map(keyOf))
    leaving
      .filter(l => !present.has(keyOf(l.item)))
      .sort((a, b) => a.index - b.index)
      .forEach(l => out.splice(Math.min(l.index, out.length), 0, { ...l.item, _exit: true }))
  }
  return out
}

export function listAnimClass(item) {
  return item._exit ? 'list-exit' : item._enter ? 'list-enter' : ''
}
