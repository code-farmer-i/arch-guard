import { createRoot } from 'react-dom/client'

import { App } from './App'
import { router } from './router'

createRoot(document.getElementById('root') as HTMLElement).render(<App />)

void router
