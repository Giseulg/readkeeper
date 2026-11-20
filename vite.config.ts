import { fileURLToPath, URL } from 'node:url'
import target from './backend/app/production-target.json' with { type: 'json' }
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode, command }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
  const production = command === 'build' && (env.VERCEL_ENV === 'production' || (!env.VERCEL_ENV && mode === 'production'))
  const release = env.VERCEL_GIT_COMMIT_SHA || env.VITE_RELEASE_SHA || ''
  const authOrigin = env.SUPABASE_URL || env.VITE_SUPABASE_URL || (production ? target.authOrigin : undefined)
  const publicKey = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (production && (env.VITE_USE_MOCK !== 'false' || Boolean(env.VITE_API_BASE_URL)
      || authOrigin !== target.authOrigin
      || !publicKey?.startsWith('sb_publishable_') || !/^[0-9a-f]{40}$/.test(release))) {
    throw new Error('Production requires the project Supabase URL and publishable key, an empty API origin, VITE_USE_MOCK=false and release SHA.')
  }
  return {
    plugins: [react(), {
      name: 'reading-release',
      generateBundle() {
        if (production) this.emitFile({ type: 'asset', fileName: 'release.json',
          source: JSON.stringify({ release, apiPath: "/api/reading", authOrigin }) })
      },
    }],
    define: {
      'import.meta.env.VITE_RELEASE_SHA': JSON.stringify(production ? release : ''),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(authOrigin || ''),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(publicKey || ''),
    },
    server: { proxy: { '/api/reading': 'http://127.0.0.1:8000' } },
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  }
})
