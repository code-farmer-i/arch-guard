import { createRoot } from 'react-dom/client'

import { App } from './App'
import { routes } from './router'

createRoot(document.getElementById('root') as HTMLElement).render(<App />)

export default routes
