import { CATEGORIES, dateToStr, today, addDays } from './utils'

// Convierte lo que el usuario DICTÓ ("gasté 250 en el súper ayer") en los
// campos de un pago: monto, nombre, fecha, categoría y si ya se pagó. Desde
// v0.9.606 también detecta el TIPO: `freq` (recurrente: "cada 2 meses") o
// `installments` (parcialidades: "a 12 meses"); si no dice nada, es único.
// Función pura (sin red ni IA): reglas simples para es/en. Siempre se revisa
// en el formulario antes de guardar, así que ante la duda deja el campo vacío
// o con el valor por defecto en vez de adivinar.

const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const MONTHS = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
}
const WEEKDAYS = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}

// Palabras-número en español (Android casi siempre devuelve dígitos, esto es
// el respaldo para "doscientos cincuenta").
const UNITS = { cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29 }
const TENS = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 }
const HUNDREDS = { cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900 }

function wordsToNumber(words) {
  let total = 0, current = 0, any = false
  for (const w of words) {
    if (w === 'y') continue
    if (w in UNITS) { current += UNITS[w]; any = true }
    else if (w in TENS) { current += TENS[w]; any = true }
    else if (w in HUNDREDS) { current += HUNDREDS[w]; any = true }
    else if (w === 'mil') { total += (current || 1) * 1000; current = 0; any = true }
    else return null
  }
  return any ? total + current : null
}

// Palabras que, pegadas a un número, lo vuelven una cantidad ("3 litros",
// "500 gramos") y no el monto. Sin esto "una coca de 3 litros a 68 pesos"
// se guardaba como 3 (v0.9.685).
const UNIT_AFTER = /^\s*(litros?|lts?|l|ml|mililitros?|kg|kilos?|kilogramos?|gr|gramos?|g|piezas?|pzas?|unidades?|botellas?|latas?|paquetes?|cajas?|metros?|m|cm|km|kilometros?|horas?|minutos?|dias?|semanas?|meses|mes|anos?|personas?|porciento|%|liters?|litres?|pounds?|lbs?|ounces?|oz|pieces?|bottles?|cans?|packs?|hours?|minutes?|days?|weeks?|months?|years?)\b/
const PESOS_AFTER = /^\s*(pesos|mxn|dolares|usd|bucks|dollars)/
const isUnitAfter = (rest) => UNIT_AFTER.test(strip(rest))

// "250", "1,250.50", "1250", "$250"
function findDigitAmount(text) {
  const re = /\$?\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?)/g
  const found = []
  let m
  while ((m = re.exec(text))) {
    const raw = m[1]
    const value = parseFloat(raw.includes(',') && /,\d{3}/.test(raw) ? raw.replace(/,/g, '') : raw.replace(',', '.'))
    if (!isNaN(value) && value > 0) {
      const rest = text.slice(m.index + m[0].length)
      found.push({ value, start: m.index, end: m.index + m[0].length, hint: /\$/.test(m[0]), unit: isUnitAfter(rest), pesos: PESOS_AFTER.test(strip(rest)) })
    }
  }
  if (!found.length) return null
  // Prefiere el que trae "$" o va pegado a "pesos"/"dolares"; si no, el primero
  // que no sea una cantidad con unidad. Si todos son cantidades, no hay monto.
  return found.find(f => f.hint || f.pesos) || found.find(f => !f.unit) || null
}

function findWordAmount(norm) {
  const tokens = norm.split(/\s+/)
  const cands = []
  for (let i = 0; i < tokens.length; i++) {
    for (let j = tokens.length; j > i; j--) {
      const slice = tokens.slice(i, j)
      const n = wordsToNumber(slice)
      if (n == null || n <= 0) continue
      const rest = tokens.slice(j).join(' ')
      const pesos = PESOS_AFTER.test(' ' + rest)
      // "una coca": un/una/uno solos son artículo, salvo que digan "pesos".
      if (slice.length === 1 && n === 1 && !pesos) continue
      if (isUnitAfter(rest) && !pesos) continue
      cands.push({ value: n, i, len: slice.length, pesos })
    }
  }
  if (!cands.length) return null
  cands.sort((a, b) => (b.pesos - a.pesos) || (b.len - a.len) || (a.i - b.i))
  return cands[0]
}

// Palabras que identifican la categoría de lo que se compró/pagó. Se busca
// por palabra completa (con plural: "refresco/refrescos", "taco/tacos") en
// lo dictado o escaneado, sin acentos ni guiones ("Coca-Cola" = "coca cola").
// Gana la PRIMERA categoría que coincida, así que el orden importa: las frases
// específicas ("agua embotellada", "uber eats") van antes que la palabra suelta
// ("agua", "uber") de otra categoría. Si nada coincide, queda "Otros".
const KEYWORDS = [
  ['Alimentación', [
    // bebidas
    'coca', 'coca cola', 'pepsi', 'sprite', 'fanta', 'refresco', 'soda', 'jugo', 'jumex', 'cerveza', 'chela', 'vino', 'tequila', 'whisky', 'vodka', 'ron', 'licor', 'bebida', 'leche', 'yogurt', 'cafe', 'capuchino', 'latte', 'starbucks', 'malteada', 'licuado', 'smoothie', 'gatorade', 'red bull', 'monster', 'electrolit', 'agua embotellada', 'agua purificada', 'agua de garrafon', 'garrafon', 'botella de agua', 'agua mineral', 'topochico',
    // comida preparada y antojos
    'comida', 'restaurante', 'fonda', 'taqueria', 'tacos', 'taco', 'torta', 'tortas', 'hamburguesa', 'hot dog', 'hotdog', 'pizza', 'sushi', 'pollo', 'carne', 'asada', 'carnitas', 'birria', 'mariscos', 'ceviche', 'aguachile', 'tamales', 'pozole', 'quesadilla', 'burrito', 'elote', 'esquites', 'helado', 'nieve', 'paleta', 'pastel', 'pan', 'dona', 'galletas', 'chocolate', 'dulces', 'chicles', 'papas', 'sabritas', 'frituras', 'botana', 'cacahuates', 'palomitas', 'snack', 'desayuno', 'almuerzo', 'comida corrida', 'cena', 'cafeteria', 'panaderia', 'carniceria', 'tortilleria', 'fruteria', 'verduleria', 'tienda', 'abarrotes', 'miscelanea',
    // despensa
    'super', 'supermercado', 'despensa', 'mandado', 'walmart', 'soriana', 'oxxo', 'seven eleven', '7 eleven', 'costco', 'sams', 'chedraui', 'heb', 'aurrera', 'bodega aurrera', 'la comer', 'city club', 'fruta', 'frutas', 'verdura', 'verduras', 'huevo', 'huevos', 'arroz', 'frijol', 'frijoles', 'azucar', 'harina', 'aceite de cocina', 'cereal', 'atun', 'sopa', 'jamon', 'queso', 'salchicha', 'mantequilla', 'tortillas', 'refrescos',
    // apps y cadenas
    'uber eats', 'rappi', 'didi food', 'mcdonalds', 'burger king', 'kfc', 'dominos', 'little caesars', 'subway', 'carls jr', 'vips', 'sanborns', 'cinepolis', 'cinemex',
    'groceries', 'grocery', 'restaurant', 'lunch', 'dinner', 'breakfast', 'coffee', 'soda', 'drink', 'beer', 'snacks', 'food', 'burger', 'fries', 'ice cream', 'milk', 'bread', 'juice', 'water bottle',
  ]],
  ['Transporte', ['gasolina', 'gasolinera', 'pemex', 'diesel', 'magna', 'gas del carro', 'uber', 'didi', 'cabify', 'indriver', 'taxi', 'camion', 'autobus', 'estacionamiento', 'caseta', 'peaje', 'pasaje', 'metro', 'metrobus', 'tarjeta de transporte', 'lavado de carro', 'autolavado', 'llanta', 'llantas', 'aceite del carro', 'cambio de aceite', 'refaccion', 'refacciones', 'bateria', 'verificacion', 'tenencia', 'licencia de manejo', 'multa', 'grua', 'vuelo', 'avion', 'camioneta', 'bicicleta', 'parking', 'fuel', 'gas station', 'bus', 'toll', 'car wash', 'oil change', 'tires', 'flight']],
  ['Suscripciones', ['netflix', 'spotify', 'disney', 'hbo', 'max', 'amazon prime', 'prime video', 'youtube', 'icloud', 'google one', 'suscripcion', 'subscription', 'apple music', 'apple tv', 'paramount', 'crunchyroll', 'twitch', 'xbox', 'game pass', 'playstation plus', 'ps plus', 'nintendo online', 'chatgpt', 'claude', 'canva', 'adobe', 'dropbox', 'notion', 'membresia', 'gimnasio', 'gym', 'membership']],
  ['Servicios', ['luz', 'agua', 'gas', 'gas lp', 'tanque de gas', 'internet', 'wifi', 'telefono', 'celular', 'recarga', 'saldo', 'telcel', 'att', 'movistar', 'cfe', 'telmex', 'izzi', 'totalplay', 'megacable', 'axtel', 'dish', 'sky', 'basura', 'predial', 'recibo', 'electricity', 'water', 'phone', 'utilities', 'electric bill']],
  ['Renta', ['renta', 'alquiler', 'mantenimiento del edificio', 'rent']],
  ['Seguros', ['seguro', 'seguros', 'poliza', 'insurance']],
  ['Medicina', ['farmacia', 'farmacias', 'similares', 'benavides', 'guadalajara farmacia', 'medicina', 'medicinas', 'medicamento', 'pastillas', 'pastilla', 'jarabe', 'paracetamol', 'ibuprofeno', 'aspirina', 'vitaminas', 'vitamina', 'suplemento', 'proteina', 'curitas', 'alcohol', 'tapabocas', 'cubrebocas', 'termometro', 'pharmacy', 'medicine', 'pills', 'vitamins']],
  ['Doctor', ['doctor', 'doctora', 'dentista', 'consulta', 'medico', 'hospital', 'clinica', 'laboratorio', 'analisis', 'estudios', 'radiografia', 'ultrasonido', 'terapia', 'psicologo', 'nutriologo', 'optica', 'lentes', 'oculista', 'veterinario', 'dentist', 'therapy', 'checkup', 'lab test']],
  ['Mantenimiento', ['mecanico', 'reparacion', 'plomero', 'electricista', 'herrero', 'carpintero', 'pintura', 'pintor', 'mantenimiento', 'taller', 'ferreteria', 'herramienta', 'herramientas', 'tornillos', 'clavos', 'cable', 'foco', 'focos', 'cemento', 'albanil', 'jardinero', 'fumigacion', 'limpieza', 'detergente', 'cloro', 'escoba', 'repair', 'maintenance', 'plumber', 'hardware']],
  ['Créditos', ['tarjeta', 'credito', 'prestamo', 'abono', 'hipoteca', 'financiamiento', 'mensualidad del carro', 'coppel', 'elektra', 'liverpool', 'mercado pago', 'nu', 'loan', 'credit card', 'mortgage']],
  ['Ahorro', ['ahorro', 'ahorros', 'fondo de emergencia', 'inversion', 'cetes', 'savings']],
]

// Palabra completa con plural simple: "taco" ↔ "tacos", "refresco" ↔ "refrescos"
const hasWord = (clean, w) => new RegExp(`(^|\\s)${w}(s|es)?(\\s|$)`).test(clean)

// Categorías PERSONALIZADAS (v0.9.687). El usuario les pone el nombre que
// quiera, así que se reconocen de 3 formas: (1) el nombre dicho tal cual
// ("regalos" ← "regalo", singular/plural), (2) cualquier palabra del nombre
// ("Gastos de cumpleaños" ← "cumpleaños"), y (3) por significado: si el nombre
// se parece a un tema conocido (Entretenimiento, Regalos, Ropa, Mascotas…) se
// usan las palabras de ese tema ("cine" → Entretenimiento).
const CUSTOM_GROUPS = [
  { names: ['entretenimiento', 'entertainment', 'ocio', 'diversion', 'salidas', 'salida', 'fun', 'cine', 'pasatiempo', 'hobbies', 'hobby'],
    words: ['cine', 'pelicula', 'peliculas', 'concierto', 'teatro', 'obra de teatro', 'boliche', 'bowling', 'karaoke', 'antro', 'bar', 'fiesta', 'parque', 'museo', 'feria', 'juego', 'videojuego', 'steam', 'entradas', 'show', 'evento', 'balneario', 'club', 'palomitas', 'movie', 'movies', 'concert', 'game', 'games', 'party'] },
  { names: ['regalo', 'regalos', 'cumpleanos', 'cumple', 'detalle', 'detalles', 'obsequio', 'aniversario', 'navidad', 'fiestas', 'gifts', 'gift', 'birthday', 'presents'],
    words: ['regalo', 'obsequio', 'detalle', 'flores', 'ramo', 'peluche', 'cumple', 'cumpleanos', 'felicitacion', 'pastel', 'globos', 'aniversario', 'navidad', 'posada', 'gift', 'present', 'birthday', 'flowers'] },
  { names: ['ropa', 'vestimenta', 'moda', 'clothes', 'clothing', 'calzado', 'outfit'],
    words: ['ropa', 'camisa', 'camiseta', 'playera', 'pantalon', 'jeans', 'vestido', 'falda', 'zapatos', 'zapato', 'tenis', 'sandalias', 'botas', 'chamarra', 'sudadera', 'calcetines', 'calzones', 'bolsa', 'cinturon', 'zara', 'shein', 'h&m', 'pull and bear', 'shirt', 'pants', 'shoes', 'dress', 'jacket'] },
  { names: ['mascota', 'mascotas', 'perro', 'perros', 'gato', 'gatos', 'pets', 'pet', 'dog', 'cat'],
    words: ['croquetas', 'alimento para perro', 'alimento para gato', 'veterinario', 'arena para gato', 'arena', 'correa', 'perro', 'gato', 'mascota', 'vacuna', 'collar', 'pet food', 'vet'] },
  { names: ['educacion', 'escuela', 'estudios', 'colegiatura', 'school', 'universidad', 'cursos', 'curso', 'education', 'libros', 'clases'],
    words: ['colegiatura', 'escuela', 'libro', 'libros', 'curso', 'cursos', 'utiles', 'uniforme', 'inscripcion', 'universidad', 'clase', 'clases', 'papeleria', 'cuaderno', 'mochila', 'tuition', 'school', 'book', 'books', 'course'] },
  { names: ['hogar', 'casa', 'home', 'mueble', 'muebles', 'decoracion', 'house'],
    words: ['mueble', 'muebles', 'cocina', 'decoracion', 'sabanas', 'colchon', 'lampara', 'electrodomestico', 'licuadora', 'microondas', 'cortinas', 'almohada', 'toallas', 'sillon', 'sala', 'comedor', 'furniture', 'decor'] },
  { names: ['tecnologia', 'electronica', 'tech', 'gadgets', 'computo', 'technology', 'electronics'],
    words: ['celular', 'laptop', 'computadora', 'audifonos', 'cargador', 'mouse', 'teclado', 'memoria usb', 'cable usb', 'pantalla', 'tablet', 'bocina', 'monitor', 'camara', 'smartwatch', 'phone', 'charger', 'headphones', 'keyboard'] },
  { names: ['viaje', 'viajes', 'vacaciones', 'travel', 'trip', 'turismo', 'paseo', 'paseos'],
    words: ['hotel', 'vuelo', 'airbnb', 'hospedaje', 'maleta', 'tour', 'renta de auto', 'pasaporte', 'visa', 'crucero', 'hostal', 'flight', 'luggage', 'vacation'] },
  { names: ['belleza', 'cuidado personal', 'personal', 'salon', 'spa', 'beauty', 'estetica', 'peluqueria', 'barberia', 'cuidado'],
    words: ['corte de pelo', 'corte', 'barberia', 'peluqueria', 'salon', 'estetica', 'manicure', 'pedicure', 'unas', 'shampoo', 'jabon', 'desodorante', 'crema', 'maquillaje', 'perfume', 'spa', 'masaje', 'depilacion', 'haircut', 'makeup', 'nails'] },
  { names: ['deporte', 'deportes', 'ejercicio', 'gym', 'gimnasio', 'fitness', 'sports', 'running'],
    words: ['gimnasio', 'gym', 'balon', 'cancha', 'raqueta', 'entrenador', 'proteina', 'carrera', 'natacion', 'yoga', 'pesas', 'bicicleta', 'sports', 'workout'] },
  { names: ['hijo', 'hijos', 'bebe', 'ninos', 'nino', 'kids', 'baby', 'familia', 'children'],
    words: ['panales', 'panal', 'formula', 'juguete', 'juguetes', 'biberon', 'carriola', 'pediatra', 'escuela', 'toys', 'diapers', 'baby'] },
]

const NAME_STOP = new Set(['gastos', 'gasto', 'pagos', 'pago', 'otros', 'otro', 'varios', 'cosas', 'mis', 'del', 'las', 'los', 'para', 'con', 'and', 'the', 'for', 'my'])
const stem = (w) => w.replace(/(es|s)$/, '')

function matchCustomCategory(clean, v) {
  const name = strip(v).replace(/[-_/]+/g, ' ').trim()
  if (!name) return false
  if (clean.includes(name)) return true
  const phraseStems = new Set(clean.split(' ').map(stem))
  const nameTokens = name.split(/[^a-z0-9&]+/).filter(t => t.length >= 3 && !NAME_STOP.has(t))
  // 2) alguna palabra del nombre aparece en lo dictado
  if (nameTokens.some(t => phraseStems.has(stem(t)))) return true
  // 3) por significado: el nombre se parece a un tema conocido
  const stems = nameTokens.map(stem)
  for (const g of CUSTOM_GROUPS) {
    if (g.names.some(n => stems.includes(stem(n)) || name.includes(n)) && g.words.some(w => hasWord(clean, w))) return true
  }
  // Nombres que significan comida o auto usan las palabras de esas categorías
  const FOOD = ['comida', 'comidas', 'restaurante', 'restaurantes', 'super', 'despensa', 'antojos', 'bebidas', 'alimentos', 'food', 'groceries', 'snacks', 'cafe']
  const CAR = ['carro', 'coche', 'auto', 'gasolina', 'vehiculo', 'moto', 'car']
  const bag = (cat) => KEYWORDS.find(k => k[0] === cat)[1]
  if (stems.some(t => FOOD.some(f => stem(f) === t)) && bag('Alimentación').some(w => hasWord(clean, w))) return true
  if (stems.some(t => CAR.some(f => stem(f) === t)) && bag('Transporte').some(w => hasWord(clean, w))) return true
  return false
}

export function guessCategory(norm, customCategories) {
  const clean = norm.replace(/[-_/]+/g, ' ').replace(/\s+/g, ' ')
  for (const c of customCategories || []) {
    const v = typeof c === 'string' ? c : c?.value
    if (v && matchCustomCategory(clean, v)) return v
  }
  for (const [cat, words] of KEYWORDS) {
    for (const w of words) {
      if (hasWord(clean, w)) return cat
    }
  }
  return null
}

const FUTURE_MARKERS = /\b(tengo que|voy a|debo|vence|vencera|hay que|tengo pendiente|manana|due|will|going to|have to|tomorrow)\b/

// Quita el fragmento [start,end) del texto y devuelve el resto
const cut = (s, start, end) => (s.slice(0, start) + ' ' + s.slice(end))

export function parseVoicePayment(rawText, { customCategories = [] } = {}) {
  const original = (rawText || '').trim()
  if (!original) return null
  let text = ' ' + original.replace(/\s+/g, ' ') + ' '
  let norm = strip(text)

  // --- Tipo de pago: frecuencia ("cada 2 meses") o parcialidades ("a 12 meses") ---
  // Se detecta y se quita ANTES de buscar monto y fecha para que su número no
  // se confunda con el monto.
  let freq = null, installments = null
  const NUMW = { dos: 2, tres: 3, cuatro: 4, seis: 6, nueve: 9, doce: 12, dieciocho: 18, veinticuatro: 24, two: 2, three: 3, six: 6, twelve: 12 }
  const num = (x) => (/^\d+$/.test(x) ? parseInt(x) : NUMW[x])
  const takeType = (re, fn) => {
    const m = norm.match(re)
    if (!m) return false
    fn(m)
    text = cut(text, m.index, m.index + m[0].length)
    norm = strip(text)
    return true
  }
  const NW = '(\\d{1,2}|dos|tres|cuatro|seis|nueve|doce|dieciocho|veinticuatro|two|three|six|twelve)'
  takeType(new RegExp('\\b(?:a|en|over|in) ' + NW + ' (?:meses|mensualidades|pagos|parcialidades|abonos|months|payments|installments)\\b'), (m) => { const n = num(m[1]); if (n >= 2) installments = n })
  if (!installments) {
    takeType(/\b(cada (?:2|dos) meses|bimestral(?:es)?|cada bimestre|every (?:2|two) months)\b/, () => { freq = 'bimonthly' })
      || takeType(/\b(cada (?:3|tres) meses|trimestral(?:es)?|every (?:3|three) months|quarterly)\b/, () => { freq = 'quarterly' })
      || takeType(/\b(cada (?:6|seis) meses|semestral(?:es)?|every (?:6|six) months)\b/, () => { freq = 'semiannual' })
      || takeType(/\b(cada ano|todos los anos|anual(?:es|mente)?|cada 12 meses|every year|yearly|annual(?:ly)?)\b/, () => { freq = 'annual' })
      || takeType(/\b(cada quincena|todas las quincenas|quincenal(?:es|mente)?|cada (?:14|15) dias|every (?:2|two) weeks|biweekly)\b/, () => { freq = 'biweekly' })
      || takeType(/\b(cada semana|todas las semanas|semanal(?:es|mente)?|cada 7 dias|every week|weekly)\b/, () => { freq = 'weekly' })
      || takeType(/\b(cada mes|todos los meses|mensual(?:es|mente)?|cada 1 mes|every month|monthly)\b/, () => { freq = 'monthly' })
  }

  // --- Fecha ---
  const now = today()
  let date = null
  const take = (re, fn) => {
    const m = norm.match(re)
    if (!m) return false
    const d = fn(m)
    if (!d) return false
    date = d
    text = cut(text, m.index, m.index + m[0].length)
    norm = strip(text)
    return true
  }
  take(/\b(antier|anteayer|day before yesterday)\b/, () => addDays(now, -2))
    || take(/\b(ayer|yesterday)\b/, () => addDays(now, -1))
    || take(/\bhace (\d{1,2}) (dias?|days?)\b/, (m) => addDays(now, -parseInt(m[1])))
    || take(/\b(hoy|today)\b/, () => now)
    || take(/\b(manana|tomorrow)\b/, () => addDays(now, 1))
    || take(/\b(?:el |on )?(\d{1,2})(?: de| of)? (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december)\b/, (m) => {
      const day = parseInt(m[1]); const month = MONTHS[m[2]]
      if (day < 1 || day > 31) return null
      let d = new Date(now.getFullYear(), month, day)
      if (d - now > 30 * 864e5) d = new Date(now.getFullYear() - 1, month, day) // "el 20 de diciembre" dicho en enero = el año pasado
      return d
    })
    || take(/\b(?:el |on |last |este |el pasado )?(domingo|lunes|martes|miercoles|jueves|viernes|sabado|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/, (m) => {
      const target = WEEKDAYS[m[1]]
      const diff = (now.getDay() - target + 7) % 7
      return addDays(now, -diff) // el más reciente (hoy cuenta)
    })

  // --- Monto ---
  let amount = null
  const digits = findDigitAmount(text)
  if (digits) {
    amount = digits.value
    text = cut(text, digits.start, digits.end)
  } else {
    const words = findWordAmount(norm.trim())
    if (words) {
      amount = words.value
      const toks = text.trim().split(/\s+/)
      toks.splice(words.i, words.len)
      text = ' ' + toks.join(' ') + ' '
    }
  }
  norm = strip(text)

  // --- ¿Ya se pagó? ---
  const future = FUTURE_MARKERS.test(norm) || (date && date > now)
  const paid = !future

  // --- Nombre: lo que sobra sin verbos, preposiciones ni "pesos" ---
  const noise = new Set(['gaste', 'gastamos', 'pague', 'pagamos', 'compre', 'compramos', 'pagado', 'pagar', 'spent', 'paid', 'bought', 'pay', 'ya', 'pesos', 'peso', 'mxn', 'dolares', 'dolar', 'usd', 'dollars', 'dollar', 'bucks', 'de', 'del', 'en', 'por', 'para', 'a', 'al', 'el', 'la', 'los', 'las', 'un', 'una', 'mi', 'mis', 'in', 'on', 'for', 'the', 'an', 'my', 'of', 'to', 'at', 'tengo', 'que', 'voy', 'debo', 'vence', 'con', 'me', 'cobraron', 'costo', 'cost', 'was', 'were', 'fue', 'son', 'es'])
  const nameTokens = []
  for (const tok of text.replace(/\$/g, ' ').trim().split(/\s+/)) {
    const clean = tok.replace(/[.,;:!?]/g, '')
    if (!clean || noise.has(strip(clean))) continue
    nameTokens.push(clean)
  }
  let name = nameTokens.join(' ').trim()
  if (name) name = name.charAt(0).toUpperCase() + name.slice(1)

  const category = guessCategory(strip(original), customCategories)

  return {
    amount,
    name,
    date: date ? dateToStr(date) : null,
    category: category && (CATEGORIES.includes(category) || customCategories.some(c => (typeof c === 'string' ? c : c?.value) === category)) ? category : null,
    paid: (freq || installments) ? false : paid,
    freq,
    installments,
  }
}
