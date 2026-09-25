import { QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { queryClient } from '@/shared/api/queryClient'
import '@/shared/i18n'

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
}
