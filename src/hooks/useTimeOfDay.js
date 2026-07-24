import { useEffect, useState } from 'react'

// 6 franjas (antes 4) — una por imagen nueva del header, ver
// components/PageHeader.jsx → HEADER_IMAGES para el nombre de archivo de
// cada una.
const RANGES = [
  { key: 'amanecer_5_9',   from: 5,  to: 9 },
  { key: 'amanecer_9_12',  from: 9,  to: 12 },
  { key: 'tarde_12_5',     from: 12, to: 17 },
  { key: 'atardecer_5_7',  from: 17, to: 19 },
  { key: 'anochecer_7_10', from: 19, to: 22 },
  { key: 'noche_10_5',     from: 22, to: 29 }, // 22-24 + 0-5 representado como 24-29
]

function getHourInTimezone(timezone) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || undefined,
      hour: 'numeric',
      hourCycle: 'h23',
    })
    return parseInt(formatter.format(new Date()), 10)
  } catch {
    return new Date().getHours()
  }
}

function resolveTimeOfDay(hour) {
  // normaliza 0-4 a 24-28 para que caigan en el rango "noche_10_5" (22-29)
  const h = hour < 5 ? hour + 24 : hour
  const match = RANGES.find(r => h >= r.from && h < r.to)
  return match ? match.key : 'noche_10_5'
}

/**
 * Calcula la franja horaria actual del usuario (6 franjas, ver RANGES arriba)
 * usando el timezone guardado en su perfil (mismo campo que usan las notificaciones push).
 * Se recalcula cada minuto para detectar cambios de franja con la app abierta.
 */
export function useTimeOfDay(timezone) {
  const [timeOfDay, setTimeOfDay] = useState(() => resolveTimeOfDay(getHourInTimezone(timezone)))

  useEffect(() => {
    const update = () => setTimeOfDay(resolveTimeOfDay(getHourInTimezone(timezone)))
    update()
    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [timezone])

  return timeOfDay
}
