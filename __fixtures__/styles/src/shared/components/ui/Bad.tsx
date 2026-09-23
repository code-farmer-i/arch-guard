import styles from './Bad.module.css'

export function Bad() {
  return (
    <div className={styles.card} style={{ color: '#ffffff', margin: 8 }}>
      <span className={styles.missing}>x</span>
    </div>
  )
}
