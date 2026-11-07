// Sesión de Supabase con token VIGENTE (v0.9.1011).
//
// `supabase.auth.getSession()` devuelve la sesión guardada aunque su token ya
// venció (pasa cuando el WebView de Android estuvo en segundo plano y la
// renovación automática no corrió). El servidor entonces responde
// "Token inválido" y las compras de Google Play no se verifican. Aquí se
// renueva cuando falta menos de un minuto para que venza.
import { supabase } from './supabase'

export async function getFreshSession() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const expiresAtMs = (session.expires_at || 0) * 1000
  if (expiresAtMs - Date.now() > 60_000) return session
  const { data, error } = await supabase.auth.refreshSession()
  if (error || !data?.session) return session // sin red: se intenta con la que hay
  return data.session
}
