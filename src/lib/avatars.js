import { supabase } from './supabase'

// Galería de avatares preestablecidos — imágenes estáticas servidas desde
// public/avatars/ (Vite/Vercel las expone tal cual, sin pasar por Supabase
// Storage). Al elegir uno, simplemente se guarda su ruta en profiles.avatar_url,
// igual que ya se hace con la URL pública de una foto subida.
export const PRESET_AVATARS = [
  '/avatars/hombre-1.webp',
  '/avatars/hombre-2.webp',
  '/avatars/hombre-3.webp',
  '/avatars/hombre-4.webp',
  '/avatars/mujer-1.webp',
  '/avatars/mujer-2.webp',
  '/avatars/mujer-3.webp',
  '/avatars/mujer-4.webp',
]

const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Valida y sube una foto al bucket `avatars` (ruta `${userId}/avatar.ext`).
// Devuelve { url, error } con la URL pública (con cache-bust). NO toca
// `profiles`: quien llama decide cuándo guardar avatar_url (useProfile lo
// guarda al instante; el onboarding lo guarda al terminar).
export async function uploadAvatarFile(userId, file) {
  if (file.size > MAX_AVATAR_BYTES) return { error: { code: 'size', message: 'La imagen no puede superar 2 MB' } }
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) return { error: { code: 'type', message: 'Solo se permiten imágenes JPG, PNG o WebP' } }
  const ext = file.name.split('.').pop()
  const path = `${userId}/avatar.${ext}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
  if (error) return { error }
  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
  return { url: `${publicUrl}?t=${Date.now()}`, error: null }
}
