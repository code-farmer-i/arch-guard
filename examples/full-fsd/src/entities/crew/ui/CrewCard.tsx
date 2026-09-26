import { AppTag } from '@/shared/ui/app-tag'
import type { Crew } from '../model/types'

export function CrewCard({ crew }: { crew: Crew }) {
  return <AppTag>{crew.name}</AppTag>
}
