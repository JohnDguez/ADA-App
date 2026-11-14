import { describe, it, expect } from 'vitest'
import { normalizeSupabaseUrl } from '../src/lib/supabaseUrl'

describe('normalizeSupabaseUrl', () => {
  it('deja intacta una URL base', () => {
    expect(normalizeSupabaseUrl('https://abc.supabase.co')).toBe('https://abc.supabase.co')
  })
  it('quita espacios, saltos de línea y barras finales', () => {
    expect(normalizeSupabaseUrl(' https://abc.supabase.co/\n')).toBe('https://abc.supabase.co')
    expect(normalizeSupabaseUrl('https://abc.supabase.co//')).toBe('https://abc.supabase.co')
  })
  it('quita /rest/v1 pegado por error', () => {
    expect(normalizeSupabaseUrl('https://abc.supabase.co/rest/v1/')).toBe('https://abc.supabase.co')
  })
})
