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
