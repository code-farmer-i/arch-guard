import { AppTag } from '@/shared/components/ui/AppTag'
import styles from './CrewsTable.module.css'

export function CrewsTable({ rows }: { rows: string[] }) {
  return (
    <table className={styles.table}>
      <tbody>
        {rows.map((row) => (
          <tr key={row}>
            <td>
              <AppTag>{row}</AppTag>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
