import styles from './Bad.module.scss'

export function Bad() {
  return (
    <div className={styles.card}>
      <span className={styles.missing}>x</span>
    </div>
  )
}
