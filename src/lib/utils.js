export const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
export const WEEKDAYS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
export const WEEKDAYS_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
export const CATEGORIES = ['Servicios','Suscripciones','Créditos','Renta','Seguros','Otros']

export function today() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function dateOf(str) {
  const d = new Date(str + 'T12:00:00')
  d.setHours(0, 0, 0, 0)
  return d
}

export function daysDiff(str) {
  return Math.round((dateOf(str) - today()) / 864e5)
}

export function fmt(n) {
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function nextCobroDate(cfg) {
  const t = today()
  if (cfg.cobro_freq === 'weekly') {
    const wd = cfg.cobro_weekday
    const td = t.getDay()
    let diff = wd - td
    if (diff < 0) diff += 7
    const d = new Date(t)
    d.setDate(t.getDate() + diff)
    return d
  }
  return t
}

export function isTodayCobro(cfg) {
  const nc = nextCobroDate(cfg)
  return nc.getTime() === today().getTime()
}

export function getPagarEsteCobro(payments, cfg) {
  const nc = nextCobroDate(cfg)
  const nextNext = new Date(nc)
  if (cfg.cobro_freq === 'weekly') nextNext.setDate(nc.getDate() + 7)
  return payments.filter(p => {
    if (p.is_paid) return false
    const vence = dateOf(p.due_date)
    return vence >= today() && vence < nextNext
  })
}

export function statusOf(p, cfg) {
  if (p.is_paid) return 'paid'
  const d = daysDiff(p.due_date)
  if (d < 0) return 'overdue'
  const nc = nextCobroDate(cfg)
  const nextNext = new Date(nc)
  if (cfg.cobro_freq === 'weekly') nextNext.setDate(nc.getDate() + 7)
  if (dateOf(p.due_date) < nextNext) return 'cobro'
  if (d <= 5) return 'soon'
  return 'ok'
}
