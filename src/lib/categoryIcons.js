import {
  UtensilsCrossed, Car, CreditCard, Home, Shield, Pill, Stethoscope, Wrench,
  Repeat, Zap, ShoppingCart, ShoppingBag, Gift, Gamepad2, Film, Music,
  Plane, Dumbbell, GraduationCap, Book, Baby, PawPrint, Scissors, Shirt,
  Smartphone, Wifi, Tv, Coffee, Fuel, Bus, Wallet, PiggyBank, Receipt,
  Building2, HeartPulse, Star, Tag,
} from 'lucide-react'

// Lista curada (no las 1000+ de Lucide) para el selector de ícono por
// categoría en SettingsCategoriesPage.jsx. Cada entrada guarda el NOMBRE del
// ícono (string) en profile.category_icons — el componente en sí se resuelve
// con getCategoryIcon() de este mismo archivo.
export const CATEGORY_ICON_OPTIONS = [
  'UtensilsCrossed', 'Car', 'CreditCard', 'Home', 'Shield', 'Pill', 'Stethoscope', 'Wrench',
  'Repeat', 'Zap', 'ShoppingCart', 'ShoppingBag', 'Gift', 'Gamepad2', 'Film', 'Music',
  'Plane', 'Dumbbell', 'GraduationCap', 'Book', 'Baby', 'PawPrint', 'Scissors', 'Shirt',
  'Smartphone', 'Wifi', 'Tv', 'Coffee', 'Fuel', 'Bus', 'Wallet', 'PiggyBank', 'Receipt',
  'Building2', 'HeartPulse', 'Star', 'Tag',
]

const ICON_MAP = {
  UtensilsCrossed, Car, CreditCard, Home, Shield, Pill, Stethoscope, Wrench,
  Repeat, Zap, ShoppingCart, ShoppingBag, Gift, Gamepad2, Film, Music,
  Plane, Dumbbell, GraduationCap, Book, Baby, PawPrint, Scissors, Shirt,
  Smartphone, Wifi, Tv, Coffee, Fuel, Bus, Wallet, PiggyBank, Receipt,
  Building2, HeartPulse, Star, Tag,
}

// Retorna el componente de ícono de Lucide asignado a una categoría, o null
// si el usuario no ha elegido ninguno todavía (se usa el punto de color como
// fallback en ese caso).
export function getCategoryIcon(cat, categoryIcons = {}) {
  const iconName = categoryIcons[cat]
  return iconName ? ICON_MAP[iconName] || null : null
}
