// Monedas de la app (v0.9.616). Solo cambian el símbolo que se muestra: los
// montos NO se convierten entre monedas (decisión de Johnatan).
//
// - La moneda PERSONAL vive en profiles.currency (se elige en el onboarding,
//   paso de periodo de cobro; sin valor por defecto para cuentas nuevas).
// - Cada espacio compartido tiene la suya en shared_spaces.currency (la
//   decide el dueño, independiente de su moneda personal).
// - `fmt()` y demás leen la moneda ACTIVA (la del espacio que se está viendo,
//   o la personal en "Personal"): App.jsx la fija con `setActiveCurrency`.
// El formato numérico (separadores) se queda igual para todas.
export const CURRENCIES = {
  MXN: { code: 'MXN', symbol: '$'   },
  USD: { code: 'USD', symbol: 'US$' },
  EUR: { code: 'EUR', symbol: '€'   },
  COP: { code: 'COP', symbol: '$'   },
  ARS: { code: 'ARS', symbol: '$'   },
  CLP: { code: 'CLP', symbol: '$'   },
  PEN: { code: 'PEN', symbol: 'S/'  },
}
export const CURRENCY_CODES = Object.keys(CURRENCIES)
// Solo respaldo cuando una fila vieja no trae moneda — NO es una moneda por
// defecto de cara al usuario (el onboarding exige elegirla).
export const DEFAULT_CURRENCY = 'MXN'

export function getCurrency(codeOrProfile) {
  const code = typeof codeOrProfile === 'string' ? codeOrProfile : codeOrProfile?.currency
  return CURRENCIES[code] || CURRENCIES[DEFAULT_CURRENCY]
}

let active = CURRENCIES[DEFAULT_CURRENCY]
export function setActiveCurrency(code) { active = getCurrency(code) }
export function getActiveCurrency() { return active }
// Sin argumentos: símbolo de la moneda activa (la del espacio en pantalla).
export function getCurrencySymbol(codeOrProfile) {
  return (codeOrProfile === undefined ? active : getCurrency(codeOrProfile)).symbol
}
