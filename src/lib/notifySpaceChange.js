import { supabase } from './supabase'

// Antes esta función vivía solo dentro de hooks/usePayments.js (Fase 5,
// v0.9.148) — se extrae aquí en v0.9.236 porque hooks/useSharedSpaces.js
// también necesita avisar cambios (alguien se une/sale/es expulsado, el
// dueño cambia permisos o configuración, elimina el espacio o borra sus
// datos) y no tenía forma de reusar la de usePayments.js sin duplicarla
// (esa versión no recibe spaceId como parámetro, lo toma de un closure
// atado a `activeSpaceId`). usePayments.js ahora envuelve esta función en
// vez de tener su propia copia — ver notifySpaceChange() ahí.
//
// Silenciosa a propósito: un aviso que no llega no debe tumbar la acción
// real, que ya se guardó/borró/actualizó bien del lado de la base de datos
// antes de llegar aquí.
export async function notifySpaceChange(spaceId, action, details = {}) {
  if (!spaceId) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await fetch('/api/notify-space-change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ spaceId, action, ...details }),
    })
  } catch (e) {
    // Silencioso a propósito — ver nota arriba
  }
}
