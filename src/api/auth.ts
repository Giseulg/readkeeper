import { createClient } from '@supabase/supabase-js'

const origin = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const auth = origin && key && import.meta.env.VITE_USE_MOCK === 'false'
  ? createClient(origin, key, { auth: { flowType: 'pkce' } }).auth
  : null

let accessToken: string | undefined
export function bearerToken() { return accessToken }
export function rememberToken(value?: string) { accessToken = value }
