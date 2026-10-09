// Moneda de la app. Hoy todo es MXN ($); queda centralizado para cuando haya
// soporte real de moneda (profiles.currency): solo hay que ampliar CURRENCIES
// y que `getCurrency(profile)` lea la preferencia del usuario.
export const CURRENCIES = {
  MXN: { code: 'MXN', symbol: '$' },
}
export const DEFAULT_CURRENCY = 'MXN'

export function getCurrency(profile) {
  return CURRENCIES[profile?.currency] || CURRENCIES[DEFAULT_CURRENCY]
}
export function getCurrencySymbol(profile) {
  return getCurrency(profile).symbol
}
