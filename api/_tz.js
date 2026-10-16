// Fecha "de hoy" y fechas 'YYYY-MM-DD' en la zona horaria DEL USUARIO
// (profiles.timezone), no en la del servidor — Vercel corre en UTC, así que
// después de las 5 pm en Mazatlán el servidor ya está en "mañana" y el
// periodo de cobro / "disponible" se calculaba mal justo al cambiar de
// periodo (auditoría v0.9.717; mismo criterio que la Regla 22 del cliente y
// que getLocalDateStr() de send-notifications.js). Mismo default que ese
// archivo cuando el perfil no tiene zona guardada.
const DEFAULT_TZ = 'America/Mazatlan'

function partsInTz(date, timezone) {
  let tz = timezone || DEFAULT_TZ
  let parts
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  } catch (e) {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: DEFAULT_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  }
  const get = type => Number(parts.find(p => p.type === type).value)
  return { y: get('year'), m: get('month'), d: get('day') }
}

// 'YYYY-MM-DD' de un instante, visto en la zona del usuario (p. ej. paid_at, que es UTC).
function dateStrInTz(date, timezone) {
  const { y, m, d } = partsInTz(date, timezone)
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// Date a medianoche (hora del servidor) con el día de calendario que ya es
// "hoy" para el usuario — así getDate()/getMonth()/setDate() de cobroPeriod()
// siguen funcionando igual, solo que sobre el día correcto.
function todayInTz(timezone) {
  const { y, m, d } = partsInTz(new Date(), timezone)
  return new Date(y, m - 1, d)
}

module.exports = { todayInTz, dateStrInTz, DEFAULT_TZ }
