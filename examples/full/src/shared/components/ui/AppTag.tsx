import type { ReactNode } from 'react'
import styles from './AppTag.module.css'

export function AppTag({ children }: { children: ReactNode }) {
  return <span className={styles.tag}>{children}</span>
}
