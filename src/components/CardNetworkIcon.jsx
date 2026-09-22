import { siVisa, siMastercard, siAmericanexpress } from 'simple-icons'

// Ícono de la red de la tarjeta (v0.9.486). Lucide y Phosphor no traen
// marcas; Simple Icons sí (imports con nombre = solo estos 3 entran al
// bundle, tree-shaking). Se dibuja en `currentColor` — sobre la tarjeta
// hereda el color del texto de la tarjeta (blanco u oscuro según el banco),
// y en los selectores el del texto normal. Son marcas registradas: se usan
// solo para identificar la red, que es el uso que permiten.
const ICONS = { visa: siVisa, mastercard: siMastercard, amex: siAmericanexpress }

export function CardNetworkIcon({ network, size = 28, className }) {
  const icon = ICONS[network]
  if (!icon) return null
  return (
    <svg role="img" aria-label={icon.title} viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
      <path d={icon.path} />
    </svg>
  )
}
