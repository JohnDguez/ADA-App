import { useEffect, useState } from 'react'

const RANGES = [
  { key: 'amanecer', from: 5, to: 11 },
  { key: 'mediodia', from: 11, to: 17 },
  { key: 'atardecer', from: 17, to: 20 },
  { key: 'noche', from: 20, to: 29 }, // 20-24 + 0-5 representado como 24-29
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
  // normaliza 0-4 a 24-28 para que caigan en el rango "noche" (20-29)
  const h = hour < 5 ? hour + 24 : hour
  const match = RANGES.find(r => h >= r.from && h < r.to)
  return match ? match.key : 'noche'
}

/**
 * Calcula la franja horaria actual del usuario (amanecer/mediodia/atardecer/noche)
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
