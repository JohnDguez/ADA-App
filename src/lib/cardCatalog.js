// Catálogo de bancos y redes para Mis tarjetas (v0.9.486, entrega A).
// En `payment_methods.bank` se guarda el `id` (estable) — nunca el nombre,
// para poder corregir un nombre o un color sin tocar la base. Los colores
// viven como variables en index.css (`--bank-<id>`), no aquí (regla de
// colores: nunca hex en componentes). `darkText`: fondo claro, el texto de
// la tarjeta va oscuro para que se lea.
export const BANK_GROUPS = ['banks', 'digital', 'stores', 'other']

export const BANKS = [
  { id: 'bbva', name: 'BBVA', group: 'banks' },
  { id: 'santander', name: 'Santander', group: 'banks' },
  { id: 'banorte', name: 'Banorte', group: 'banks' },
  { id: 'banamex', name: 'Banamex', group: 'banks' },
  { id: 'hsbc', name: 'HSBC', group: 'banks' },
  { id: 'scotiabank', name: 'Scotiabank', group: 'banks' },
  { id: 'inbursa', name: 'Inbursa', group: 'banks' },
  { id: 'azteca', name: 'Banco Azteca', group: 'banks' },
  { id: 'bancoppel', name: 'BanCoppel', group: 'banks', darkText: true },
  { id: 'banregio', name: 'Banregio', group: 'banks' },
  { id: 'banbajio', name: 'BanBajío', group: 'banks' },
  { id: 'afirme', name: 'Afirme', group: 'banks' },
  { id: 'multiva', name: 'Multiva', group: 'banks' },
  { id: 'mifel', name: 'Mifel', group: 'banks' },
  { id: 'bienestar', name: 'Banco del Bienestar', group: 'banks' },
  { id: 'invex', name: 'Invex', group: 'banks' },
  { id: 'monex', name: 'Monex', group: 'banks' },
  { id: 'intercam', name: 'Intercam', group: 'banks' },
  { id: 'nu', name: 'Nu', group: 'digital' },
  { id: 'hey', name: 'Hey Banco', group: 'digital' },
  { id: 'mercadopago', name: 'Mercado Pago', group: 'digital' },
  { id: 'spin', name: 'Spin by OXXO', group: 'digital' },
  { id: 'klar', name: 'Klar', group: 'digital' },
  { id: 'stori', name: 'Stori', group: 'digital' },
  { id: 'openbank', name: 'Openbank', group: 'digital' },
  { id: 'uala', name: 'Ualá', group: 'digital' },
  { id: 'plata', name: 'Plata', group: 'digital' },
  { id: 'albo', name: 'Albo', group: 'digital' },
  { id: 'vexi', name: 'Vexi', group: 'digital' },
  { id: 'rappicard', name: 'RappiCard', group: 'digital' },
  { id: 'bankaool', name: 'Bankaool', group: 'digital' },
  { id: 'liverpool', name: 'Liverpool', group: 'stores' },
  { id: 'palacio', name: 'Palacio de Hierro', group: 'stores' },
  { id: 'sears', name: 'Sears', group: 'stores' },
  { id: 'suburbia', name: 'Suburbia', group: 'stores' },
  { id: 'coppel', name: 'Coppel', group: 'stores' },
  { id: 'otro', name: 'Otro banco', group: 'other' },
]

const BY_ID = Object.fromEntries(BANKS.map(b => [b.id, b]))

// Un id desconocido (ej. banco quitado del catálogo en el futuro) cae en
// "Otro banco" en vez de romper la tarjeta.
export function getBank(id) {
  return BY_ID[id] || BY_ID.otro
}

export function bankColorVar(id) {
  return `var(--bank-${getBank(id).id})`
}

export const NETWORKS = ['visa', 'mastercard', 'amex']
export const CARD_FORMS = ['physical', 'digital']
export const CARD_KINDS = ['credit', 'debit']
