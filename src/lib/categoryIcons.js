import {
  User, Users, Baby, Heart, HeartHandshake, Handshake, Smile, UserPlus, UserCheck, PersonStanding,
  Home, Sofa, Bed, Bath, Lamp, DoorOpen, Key, Trash2, Fan, Armchair, Bell,
  Smartphone, Laptop, Monitor, Tablet, Headphones, Wifi, Bluetooth, Printer, Keyboard, Mouse, Cpu, HardDrive, Battery, Router,
  Wallet, CreditCard, Banknote, PiggyBank, Receipt, ShoppingCart, ShoppingBag, Tag, Percent, TrendingUp, TrendingDown, Coins, Landmark, Building2, Gift, Package,
  Gamepad2, Dice5, Puzzle, PartyPopper, Ticket, Sparkles, Popcorn, Tv,
  Car, Bus, Train, Plane, Bike, Fuel, MapPin, Compass, Luggage, Ship, Anchor,
  UtensilsCrossed, Coffee, Pizza, Beef, Apple, Wine, Beer, Cookie, Soup, Cherry, Sandwich, Fish, IceCreamCone,
  Building, Church, School, Store, Factory, Warehouse,
  Palette, Brush, PenTool, Feather,
  Dumbbell, Trophy, Medal, Target, Award,
  Music, Music2, Music3, Music4, Mic, Radio, Volume2, Disc,
  Camera, Video, Image, Film, Aperture, Clapperboard,
  Leaf, Flower2, Sun, Moon, Cloud, CloudRain, Snowflake, Mountain, Waves, PawPrint, Bird, Bug, TreePine,
  Calculator, Atom, FlaskConical, Microscope, TestTube,
  Clock, Calendar, Timer, AlarmClock, Hourglass, CalendarDays,
  Wrench, Hammer, Ruler, Scissors, Paintbrush,
  Zap, Repeat, Shield, Pill, Stethoscope, MoreHorizontal,
} from 'lucide-react'

// Mapa único de nombre-de-ícono → componente. Todas las agrupaciones de abajo
// referencian nombres que viven aquí; el picker resuelve el componente real
// con getCategoryIcon().
const ICON_MAP = {
  User, Users, Baby, Heart, HeartHandshake, Handshake, Smile, UserPlus, UserCheck, PersonStanding,
  Home, Sofa, Bed, Bath, Lamp, DoorOpen, Key, Trash2, Fan, Armchair, Bell,
  Smartphone, Laptop, Monitor, Tablet, Headphones, Wifi, Bluetooth, Printer, Keyboard, Mouse, Cpu, HardDrive, Battery, Router,
  Wallet, CreditCard, Banknote, PiggyBank, Receipt, ShoppingCart, ShoppingBag, Tag, Percent, TrendingUp, TrendingDown, Coins, Landmark, Building2, Gift, Package,
  Gamepad2, Dice5, Puzzle, PartyPopper, Ticket, Sparkles, Popcorn, Tv,
  Car, Bus, Train, Plane, Bike, Fuel, MapPin, Compass, Luggage, Ship, Anchor,
  UtensilsCrossed, Coffee, Pizza, Beef, Apple, Wine, Beer, Cookie, Soup, Cherry, Sandwich, Fish, IceCreamCone,
  Building, Church, School, Store, Factory, Warehouse,
  Palette, Brush, PenTool, Feather,
  Dumbbell, Trophy, Medal, Target, Award,
  Music, Music2, Music3, Music4, Mic, Radio, Volume2, Disc,
  Camera, Video, Image, Film, Aperture, Clapperboard,
  Leaf, Flower2, Sun, Moon, Cloud, CloudRain, Snowflake, Mountain, Waves, PawPrint, Bird, Bug, TreePine,
  Calculator, Atom, FlaskConical, Microscope, TestTube,
  Clock, Calendar, Timer, AlarmClock, Hourglass, CalendarDays,
  Wrench, Hammer, Ruler, Scissors, Paintbrush,
  Zap, Repeat, Shield, Pill, Stethoscope, MoreHorizontal,
}

// Agrupado + con etiqueta en español para el buscador (busca por label, no
// por el nombre técnico del ícono en inglés).
export const CATEGORY_ICON_GROUPS = [
  { label: 'Familia y Gente', icons: [
    { name: 'User', label: 'Persona' }, { name: 'Users', label: 'Personas' }, { name: 'Baby', label: 'Bebé' },
    { name: 'Heart', label: 'Corazón' }, { name: 'HeartHandshake', label: 'Cuidado' }, { name: 'Handshake', label: 'Acuerdo' },
    { name: 'Smile', label: 'Sonrisa' }, { name: 'UserPlus', label: 'Agregar persona' }, { name: 'UserCheck', label: 'Persona confirmada' },
    { name: 'PersonStanding', label: 'Persona de pie' },
  ]},
  { label: 'Hogar y vida', icons: [
    { name: 'Home', label: 'Casa' }, { name: 'Sofa', label: 'Sillón' }, { name: 'Bed', label: 'Cama' },
    { name: 'Bath', label: 'Baño' }, { name: 'Lamp', label: 'Lámpara' }, { name: 'DoorOpen', label: 'Puerta' },
    { name: 'Key', label: 'Llave' }, { name: 'Trash2', label: 'Basura' }, { name: 'Fan', label: 'Ventilador' },
    { name: 'Armchair', label: 'Sillón' }, { name: 'Bell', label: 'Campana' },
  ]},
  { label: 'Tecnología', icons: [
    { name: 'Smartphone', label: 'Celular' }, { name: 'Laptop', label: 'Laptop' }, { name: 'Monitor', label: 'Monitor' },
    { name: 'Tablet', label: 'Tablet' }, { name: 'Headphones', label: 'Audífonos' }, { name: 'Wifi', label: 'Wifi' },
    { name: 'Bluetooth', label: 'Bluetooth' }, { name: 'Printer', label: 'Impresora' }, { name: 'Keyboard', label: 'Teclado' },
    { name: 'Mouse', label: 'Mouse' }, { name: 'Cpu', label: 'Procesador' }, { name: 'HardDrive', label: 'Disco duro' },
    { name: 'Battery', label: 'Batería' }, { name: 'Router', label: 'Router' },
  ]},
  { label: 'Finanzas y Compras', icons: [
    { name: 'Wallet', label: 'Cartera' }, { name: 'CreditCard', label: 'Tarjeta' }, { name: 'Banknote', label: 'Billete' },
    { name: 'PiggyBank', label: 'Alcancía' }, { name: 'Receipt', label: 'Recibo' }, { name: 'ShoppingCart', label: 'Carrito' },
    { name: 'ShoppingBag', label: 'Bolsa de compras' }, { name: 'Tag', label: 'Etiqueta' }, { name: 'Percent', label: 'Porcentaje' },
    { name: 'TrendingUp', label: 'Tendencia sube' }, { name: 'TrendingDown', label: 'Tendencia baja' }, { name: 'Coins', label: 'Monedas' },
    { name: 'Landmark', label: 'Banco' }, { name: 'Building2', label: 'Edificio' }, { name: 'Gift', label: 'Regalo' }, { name: 'Package', label: 'Paquete' },
  ]},
  { label: 'Ocio', icons: [
    { name: 'Gamepad2', label: 'Videojuegos' }, { name: 'Dice5', label: 'Dado' }, { name: 'Puzzle', label: 'Rompecabezas' },
    { name: 'PartyPopper', label: 'Fiesta' }, { name: 'Ticket', label: 'Boleto' }, { name: 'Sparkles', label: 'Brillos' },
    { name: 'Popcorn', label: 'Palomitas' }, { name: 'Tv', label: 'Televisión' },
  ]},
  { label: 'Transporte y Viajes', icons: [
    { name: 'Car', label: 'Auto' }, { name: 'Bus', label: 'Autobús' }, { name: 'Train', label: 'Tren' },
    { name: 'Plane', label: 'Avión' }, { name: 'Bike', label: 'Bicicleta' }, { name: 'Fuel', label: 'Gasolina' },
    { name: 'MapPin', label: 'Ubicación' }, { name: 'Compass', label: 'Brújula' }, { name: 'Luggage', label: 'Maleta' },
    { name: 'Ship', label: 'Barco' }, { name: 'Anchor', label: 'Ancla' },
  ]},
  { label: 'Comida y bebida', icons: [
    { name: 'UtensilsCrossed', label: 'Cubiertos' }, { name: 'Coffee', label: 'Café' }, { name: 'Pizza', label: 'Pizza' },
    { name: 'Beef', label: 'Carne' }, { name: 'Apple', label: 'Manzana' }, { name: 'Wine', label: 'Vino' },
    { name: 'Beer', label: 'Cerveza' }, { name: 'Cookie', label: 'Galleta' }, { name: 'Soup', label: 'Sopa' },
    { name: 'Cherry', label: 'Cereza' }, { name: 'Sandwich', label: 'Sándwich' }, { name: 'Fish', label: 'Pescado' },
    { name: 'IceCreamCone', label: 'Helado' },
  ]},
  { label: 'Lugares y edificios', icons: [
    { name: 'Building', label: 'Edificio' }, { name: 'Building2', label: 'Edificio 2' }, { name: 'Church', label: 'Iglesia' },
    { name: 'School', label: 'Escuela' }, { name: 'Store', label: 'Tienda' }, { name: 'Factory', label: 'Fábrica' },
    { name: 'Warehouse', label: 'Bodega' }, { name: 'Landmark', label: 'Monumento' },
  ]},
  { label: 'Artes', icons: [
    { name: 'Palette', label: 'Paleta' }, { name: 'Brush', label: 'Pincel' }, { name: 'PenTool', label: 'Pluma' }, { name: 'Feather', label: 'Pluma de ave' },
  ]},
  { label: 'Deportes', icons: [
    { name: 'Dumbbell', label: 'Pesas' }, { name: 'Trophy', label: 'Trofeo' }, { name: 'Medal', label: 'Medalla' },
    { name: 'Target', label: 'Objetivo' }, { name: 'Award', label: 'Premio' }, { name: 'Bike', label: 'Bicicleta' },
  ]},
  { label: 'Música y Sonido', icons: [
    { name: 'Music', label: 'Música' }, { name: 'Music2', label: 'Nota musical' }, { name: 'Music3', label: 'Nota musical 2' },
    { name: 'Music4', label: 'Nota musical 3' }, { name: 'Mic', label: 'Micrófono' }, { name: 'Radio', label: 'Radio' },
    { name: 'Volume2', label: 'Volumen' }, { name: 'Disc', label: 'Disco' },
  ]},
  { label: 'Foto y Video', icons: [
    { name: 'Camera', label: 'Cámara' }, { name: 'Video', label: 'Video' }, { name: 'Image', label: 'Imagen' },
    { name: 'Film', label: 'Película' }, { name: 'Aperture', label: 'Apertura' }, { name: 'Clapperboard', label: 'Claqueta' },
  ]},
  { label: 'Naturaleza', icons: [
    { name: 'Leaf', label: 'Hoja' }, { name: 'Flower2', label: 'Flor' }, { name: 'Sun', label: 'Sol' },
    { name: 'Moon', label: 'Luna' }, { name: 'Cloud', label: 'Nube' }, { name: 'CloudRain', label: 'Lluvia' },
    { name: 'Snowflake', label: 'Nieve' }, { name: 'Mountain', label: 'Montaña' }, { name: 'Waves', label: 'Olas' },
    { name: 'PawPrint', label: 'Mascota' }, { name: 'Bird', label: 'Pájaro' }, { name: 'Bug', label: 'Insecto' }, { name: 'TreePine', label: 'Árbol' },
  ]},
  { label: 'Matemáticas y ciencia', icons: [
    { name: 'Calculator', label: 'Calculadora' }, { name: 'Atom', label: 'Átomo' }, { name: 'FlaskConical', label: 'Matraz' },
    { name: 'Microscope', label: 'Microscopio' }, { name: 'TestTube', label: 'Tubo de ensayo' },
  ]},
  { label: 'Tiempo', icons: [
    { name: 'Clock', label: 'Reloj' }, { name: 'Calendar', label: 'Calendario' }, { name: 'Timer', label: 'Temporizador' },
    { name: 'AlarmClock', label: 'Alarma' }, { name: 'Hourglass', label: 'Reloj de arena' }, { name: 'CalendarDays', label: 'Días' },
  ]},
  { label: 'Herramientas', icons: [
    { name: 'Wrench', label: 'Llave inglesa' }, { name: 'Hammer', label: 'Martillo' }, { name: 'Ruler', label: 'Regla' },
    { name: 'Scissors', label: 'Tijeras' }, { name: 'Paintbrush', label: 'Brocha' },
  ]},
]

// Ícono por defecto de las 11 categorías fijas — se usa como fallback si el
// usuario todavía no eligió uno propio en category_icons.
export const DEFAULT_CATEGORY_ICONS = {
  'Servicios':     'Zap',
  'Suscripciones': 'Repeat',
  'Créditos':      'CreditCard',
  'Renta':         'Home',
  'Seguros':       'Shield',
  'Alimentación':  'UtensilsCrossed',
  'Transporte':    'Car',
  'Medicina':      'Pill',
  'Doctor':        'Stethoscope',
  'Mantenimiento': 'Wrench',
  'Otros':         'MoreHorizontal',
}

// Resuelve el componente de ícono para una categoría: primero lo que el
// usuario haya elegido (category_icons), si no hay, el default de la
// categoría fija (si aplica), si no hay nada, null (fallback al punto de color).
export function getCategoryIcon(cat, categoryIcons = {}) {
  const iconName = categoryIcons[cat] || DEFAULT_CATEGORY_ICONS[cat]
  return iconName ? ICON_MAP[iconName] || null : null
}

export function getIconComponent(name) {
  return ICON_MAP[name] || null
}
