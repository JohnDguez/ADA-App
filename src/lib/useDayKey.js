import { useEffect, useState } from 'react'
import { todayStr } from './utils'

// Día local actual ('YYYY-MM-DD') como estado de React: cambia solo cuando
// pasa la medianoche con la app abierta, o al volver a la app (primer plano /
// pestaña visible) después de que el día cambió. Sirve para que cálculos que
// dependen de "hoy" (como generar el estado de cuenta de una tarjeta al
// iniciar el día de corte) se vuelvan a ejecutar sin recargar la app.
export function useDayKey() {
  const [day, setDay] = useState(todayStr)

  useEffect(() => {
    const refresh = () => setDay(prev => {
      const now = todayStr()
      return now === prev ? prev : now
    })

    // Temporizador hasta unos segundos después de la próxima medianoche local.
    let timer
    function schedule() {
      const now = new Date()
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5)
      timer = setTimeout(() => { refresh(); schedule() }, Math.max(1000, next - now))
    }
    schedule()

    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return day
}
