import styles from './CrewsTable.module.css'

export function CrewsTable({ rows }: { rows: string[] }) {
  return (
    <table className={styles.table}>
      <tbody>
        {rows.map((row) => (
          <tr key={row}>
            <td>{row}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
