import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULT_PROFILE = {
  name: '',
  currency: 'MXN',
  cobro_freq: 'weekly',
  cobro_weekday: 5,
  reminder_days: 3,
}

export function useProfile(userId) {
  const [profile, setProfile] = useState(DEFAULT_PROFILE)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (!error && data) setProfile({ ...DEFAULT_PROFILE, ...data })
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  async function updateProfile(updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()
    if (!error) setProfile(prev => ({ ...prev, ...data }))
    return { data, error }
  }

  return { profile, loading, updateProfile }
}
