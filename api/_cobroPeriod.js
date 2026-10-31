// Periodo de cobro del lado del servidor (v0.9.966). Puerto fiel de
// cobroPeriod() de src/lib/utils.js (Regla 23: api/ es CommonJS y no importa
// módulos del frontend). Lo usan manage-shared-fund.js y manage-shared-goal.js
// para validar el disponible PERSONAL de quien aporta, y migrate-shared-funds.js
// con la configuración del ESPACIO (v0.9.967). Antes cada archivo
// tenía su propia copia y se habían desviado (sin meses cortos; la de metas,
// sin el caso mensual). Prefijo `_`: no cuenta como función de Vercel.
const { todayInTz } = require('./_tz')

function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d }

function clampedDate(y, m, d) {
  const first = new Date(y, m, 1)
  const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  return new Date(first.getFullYear(), first.getMonth(), Math.min(d, dim))
}

// 'near' sáb→vie y dom→lun; 'prev' al viernes; 'next' al lunes; otro valor = sin recorrer.
const SHIFT_DAYS = { near: { 6: -1, 0: 1 }, prev: { 6: -1, 0: -2 }, next: { 6: 2, 0: 1 } }
function shiftPayday(date, mode) {
  if (!SHIFT_DAYS[mode]) return date
  const delta = SHIFT_DAYS[mode][date.getDay()]
  return delta ? addDays(date, delta) : date
}

function cobroDatesAround(cfg, t) {
  const y = t.getFullYear(); const m = t.getMonth()
  const days = cfg.cobro_freq === 'biweekly'
    ? [cfg.cobro_day1 ?? 1, cfg.cobro_day2 ?? 16]
    : [cfg.cobro_day1 ?? 1]
  const out = []
  for (let k = -2; k <= 2; k++) {
    days.forEach(d => out.push(shiftPayday(clampedDate(y, m + k, d), cfg.cobro_weekend_shift)))
  }
  return out
    .sort((a, b) => a - b)
    .filter((d, i, arr) => i === 0 || d.getTime() !== arr[i - 1].getTime())
}

// `refDate` opcional (pruebas); por defecto, "hoy" en la zona del usuario.
function cobroPeriod(cfg, refDate) {
  const t = refDate || todayInTz(cfg.timezone)
  if (cfg.cobro_freq === 'weekly') {
    const wd = cfg.cobro_weekday ?? 5; const td = t.getDay()
    let diffNext = wd - td; if (diffNext <= 0) diffNext += 7
    const nextCobro = addDays(t, diffNext)
    return { start: addDays(nextCobro, -7), end: addDays(nextCobro, -1), nextCobro }
  }
  if (cfg.cobro_freq === 'biweekly' || cfg.cobro_freq === 'monthly') {
    const dates = cobroDatesAround(cfg, t)
    const start     = dates.filter(d => d <= t).pop()
    const nextCobro = dates.find(d => d > t)
    return { start, end: addDays(nextCobro, -1), nextCobro }
  }
  return { start: t, end: t, nextCobro: t }
}

// Ingreso fijo de UN periodo (v0.9.968), puerto fiel de periodSalary() de
// src/lib/utils.js: si el ingreso cambió "desde el próximo periodo", los
// periodos que empiezan antes de `salary_change_from` usan `salary_prev_amount`.
function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function periodSalary(cfg, periodStart) {
  if (!cfg || !cfg.salary_enabled) return 0
  const from = cfg.salary_change_from
  const ps = typeof periodStart === 'string' ? periodStart : periodStart && dateToStr(periodStart)
  if (from && cfg.salary_prev_amount != null && ps && ps < from) return Number(cfg.salary_prev_amount || 0)
  return Number(cfg.salary_amount || 0)
}

module.exports = { cobroPeriod, shiftPayday, periodSalary }
