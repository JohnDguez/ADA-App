// Consejos de Inicio (v0.9.688). Se muestran de uno en uno cuando el periodo no
// tiene pagos pendientes. `kind`: 'reminder' (algo que se olvida) o 'feature'
// (función poco conocida). `action`: null | 'add' | 'addmenu' (menú del + con voz/escáner) | 'voice' | 'scan' | 'tab:<pestaña>' | 'settings:<sección>' — lo que
// hace el enlace de abajo; los textos viven en i18n (`tips.<id>`).
import { isVoiceSupported } from './voiceInput'
import { isTicketScanSupported } from './ticketScan'

export const TIPS = [
  { id: 'remToday', kind: 'reminder', action: 'addmenu' },
  { id: 'remFood', kind: 'reminder', action: 'addmenu' },
  { id: 'remChanged',   kind: 'reminder', action: 'tab:recurrents' },
  { id: 'remExtra',     kind: 'reminder', action: null },
  { id: 'remNext',      kind: 'reminder', action: null },
  { id: 'remCash', kind: 'reminder', action: 'addmenu' },
  { id: 'voice',        kind: 'feature',  action: 'voice' },
  { id: 'scan',         kind: 'feature',  action: 'scan' },
  { id: 'variable',     kind: 'feature',  action: null },
  { id: 'postpone',     kind: 'feature',  action: null },
  { id: 'pause',        kind: 'feature',  action: 'tab:recurrents' },
  { id: 'goals',        kind: 'feature',  action: 'tab:goals' },
  { id: 'shared',       kind: 'feature',  action: 'settings:sharedspace' },
  { id: 'export',       kind: 'feature',  action: 'settings:export' },
  { id: 'installments', kind: 'feature',  action: 'add' },
]

function available() {
  return TIPS.filter(t => (t.id !== 'voice' || isVoiceSupported()) && (t.id !== 'scan' || isTicketScanSupported()))
}

function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Baraja por sesión (vive mientras la app esté abierta): se recorren todos en
// orden aleatorio antes de repetir, y al barajar de nuevo el primero nunca es
// el último que se vio.
let deck = []
let pos = -1
let lastId = null

export function nextTip() {
  if (pos + 1 >= deck.length) {
    deck = shuffle(available())
    if (deck.length > 1 && deck[0].id === lastId) deck.push(deck.shift())
    pos = -1
  }
  pos += 1
  lastId = deck[pos].id
  return deck[pos]
}
