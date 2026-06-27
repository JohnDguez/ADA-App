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
}

export function useProfile(userId) {
  const [profile, setProfile] = useState(DEFAULT_PROFILE)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('profiles').select('*').eq('id', userId).single()
    if (!error && data) setProfile({ ...DEFAULT_PROFILE, ...data })
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  async function updateProfile(updates) {
    const { data, error } = await supabase
      .from('profiles').update(updates).eq('id', userId).select().single()
    if (!error) setProfile(prev => ({ ...prev, ...data }))
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
