import { AppTag } from '@/shared/components/ui/AppTag'
import { formatCrewName } from '../lib/format'
import type { CrewRow } from '../model/types'
import styles from './CrewsTable.module.css'

export function CrewsTable({ rows }: { rows: CrewRow[] }) {
  return (
    <table className={styles.table}>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>
              <AppTag>{formatCrewName(row.name)}</AppTag>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
