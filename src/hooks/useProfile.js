import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULT_PROFILE = {
  name: '',
  currency: 'MXN',
  cobro_freq: 'weekly',
  cobro_weekday: 5,
  cobro_day1: 1,
  cobro_day2: 16,
  reminder_days: 3,
  salary_enabled: false,
  salary_amount: 0,
  avatar_url: null,
  is_premium: false,
  default_space_id: null,
  category_icons: {},
  category_colors: {},
  language: 'system',
}

// Columnas jsonb/array que la app siempre trata como objeto/arreglo iterable
// (Object.keys, indexOf, spread, etc.) en varios componentes — nunca deben
// llegar a esos consumidores como `null`. DEFAULT_PROFILE ya cubre el caso
// `undefined` (columna ausente en el select), pero un valor `null` explícito
// en la fila de Supabase SOBREESCRIBE el default en el spread `{ ...DEFAULT_PROFILE,
// ...data }` sin este saneo — causa real de un crash en Gastos/Recurrentes
// (getCategoryIcon/getCatColor reciben `categoryIcons=null` y truenan en
// `categoryIcons[cat]`, sin Error Boundary antes de esta sesión eso dejaba la
// app en blanco). Ver HISTORIAL.md para el detalle completo del bug.
function sanitizeProfile(data) {
  return {
    ...data,
    custom_categories: data.custom_categories ?? DEFAULT_PROFILE.custom_categories,
    category_icons: data.category_icons ?? DEFAULT_PROFILE.category_icons,
    category_colors: data.category_colors ?? DEFAULT_PROFILE.category_colors,
    coachmarks_seen: data.coachmarks_seen ?? {},
  }
}

export function useProfile(userId) {
  const [profile, setProfile] = useState(DEFAULT_PROFILE)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    if (!userId) return null
    const { data, error } = await supabase
      .from('profiles').select('*').eq('id', userId).single()
    if (!error && data) setProfile({ ...DEFAULT_PROFILE, ...sanitizeProfile(data) })
    setLoading(false)
    // Devuelve la fila cruda (no el estado ya mezclado con DEFAULT_PROFILE) —
    // quien llame y necesite un valor fresco de inmediato (ej. PremiumPage
    // esperando a que el webhook de Stripe actualice is_premium) puede
    // revisarlo sin depender de un re-render para leer el nuevo `profile`.
    return data || null
  }, [userId])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  async function updateProfile(updates) {
    const { data, error } = await supabase
      .from('profiles').update(updates).eq('id', userId).select().single()
    if (!error) setProfile(prev => ({ ...prev, ...sanitizeProfile(data) }))
    return { data, error }
  }

  async function uploadAvatar(file) {
    if (file.size > 2 * 1024 * 1024) return { error: { message: 'La imagen no puede superar 2 MB' } }
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) return { error: { message: 'Solo se permiten imágenes JPG, PNG o WebP' } }
    const ext = file.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadError) return { error: uploadError }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`
    await updateProfile({ avatar_url: urlWithCacheBust })
    return { url: urlWithCacheBust, error: null }
  }

  return { profile, loading, updateProfile, uploadAvatar }
}
