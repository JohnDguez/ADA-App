import { useEffect, useState } from 'react'
import { useTimeOfDay } from './useTimeOfDay'

// Cuánto esperar tras el primer render antes de precargar las 5 franjas
// que no se están mostrando — tiempo de sobra para que el LCP inicial ya
// haya pasado, sin arriesgar el crossfade (useTimeOfDay recalcula cada
// 60s, así que 3s de margen nunca alcanza a notarse en la práctica).
// Extraído tal cual de PageHeader.jsx (v0.9.356) al sacar esta lógica a
// hook compartido — mismo valor, mismo comentario original.
const PRELOAD_DELAY_MS = 3000

// Nombres tal cual Johnatan los subió a public/ — mismo mapa que usaba
// PageHeader.jsx antes de esta extracción.
export const HEADER_IMAGES = {
  amanecer_5_9:   '/amanecer_5_a_9.webp',
  amanecer_9_12:  '/amanecer_9_a_12.webp',
  tarde_12_5:     '/tarde_12_a_5.webp',
  atardecer_5_7:  '/atardecer_5_a_7.webp',
  anochecer_7_10: '/anochecer_7_a_10.webp',
  noche_10_5:     '/noche_10_a_5.webp',
}

/**
 * Calcula la franja horaria activa (useTimeOfDay) + qué franjas de
 * HEADER_IMAGES deben estar montadas para el crossfade, con la misma
 * precarga diferida que ya usaba PageHeader.jsx (solo la franja activa al
 * arrancar; el resto se agrega en segundo plano tras PRELOAD_DELAY_MS,
 * para no competir por ancho de banda con la carga inicial/LCP).
 *
 * Compartido entre PageHeader.jsx y NavRail.jsx (Regla 44) — un solo
 * cálculo/crossfade, no una instancia por consumidor.
 */
export function useHeaderBackground(timezone) {
  const timeOfDay = useTimeOfDay(timezone)
  const [mountedKeys, setMountedKeys] = useState(() => [timeOfDay])

  useEffect(() => {
    // Si la franja activa cambia antes de que termine el precargado (caso
    // raro, ver PRELOAD_DELAY_MS), asegura que esté montada de inmediato.
    setMountedKeys(prev => (prev.includes(timeOfDay) ? prev : [...prev, timeOfDay]))
  }, [timeOfDay])

  useEffect(() => {
    const timer = setTimeout(() => {
      setMountedKeys(Object.keys(HEADER_IMAGES))
    }, PRELOAD_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  return { timeOfDay, mountedKeys }
}
