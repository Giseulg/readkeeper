import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { router } from '@/router'
import { LayoutModeSync } from '@/hooks/useMediaQuery'

export function ReaderApp() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
  }))
  return <QueryClientProvider client={queryClient}>
    <LayoutModeSync />
    <RouterProvider router={router} />
  </QueryClientProvider>
}
