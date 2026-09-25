import type { ReactNode } from 'react'
import styles from './AppButton.module.css'

export function AppButton({ children }: { children: ReactNode }) {
  return <button className={styles.primary}>{children}</button>
}
