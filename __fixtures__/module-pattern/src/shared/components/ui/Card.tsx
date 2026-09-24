import styles from './Card.module.scss'

/** 合规：组件样式用的就是方案声明的形态（`.module.scss`）—— 不报 */
export function Card() {
  return <div className={styles.card}>card</div>
}
