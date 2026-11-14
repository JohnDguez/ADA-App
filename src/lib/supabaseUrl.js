// Deja la URL del proyecto de Supabase en su forma base (https://xxxx.supabase.co).
// Un valor pegado con espacios, con «/» al final o con «/rest/v1» hace que PostgREST responda
// PGRST125 («Invalid path specified in request URL») en cada consulta y la app no puede leer
// ni guardar nada (v0.9.1067: pasó con la variable de la compilación por aire).
export function normalizeSupabaseUrl(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/(rest|auth|storage|realtime)\/v1$/i, '')
    .replace(/\/+$/, '')
}
