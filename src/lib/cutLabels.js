import { intlLocale } from './utils'

// Textos de fecha de corte compartidos por el aviso de Inicio, el distintivo
// de la tarjeta y el aviso del método de pago (v0.9.738).
function shortDate(date, weekday) {
  return new Intl.DateTimeFormat(intlLocale(), { weekday, day: 'numeric' }).format(date)
}

// "hoy" / "mañana" / "el martes 20" (frase para dentro de una oración).
export function cutWhen(date, daysLeft, t) {
  if (daysLeft <= 0) return t('cutNotice.today')
  if (daysLeft === 1) return t('cutNotice.tomorrow')
  return t('cutNotice.onDate', { date: shortDate(date, 'long') })
}

// "Corte hoy" / "Corte mañana" / "Corte el mar 20" (distintivo de la tarjeta).
export function cutBadgeLabel(date, daysLeft, t) {
  if (daysLeft <= 0) return t('cutNotice.badgeToday')
  if (daysLeft === 1) return t('cutNotice.badgeTomorrow')
  return t('cutNotice.badgeDate', { date: shortDate(date, 'short') })
}

export function cutDateLong(date) {
  return shortDate(date, 'long')
}

// "5 de noviembre" (vencimiento del pago, sin día de la semana).
export function dueDateLong(date) {
  return new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'long' }).format(date)
}

// "22 oct" (línea corta por tarjeta en el aviso con varias tarjetas).
export function dayMonthShort(date) {
  return new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short' }).format(date).replace('.', '')
}
