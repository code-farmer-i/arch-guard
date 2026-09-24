import { Helper } from './Helper'
import { CrewFilter } from '../../../features/crew-filter'
import { CrewCard } from '@/entities/crew'
import { Helper as AliasedHelper } from '@/pages/crews/ui/Helper'

export function CrewsPage() {
  return [Helper, CrewFilter, CrewCard, AliasedHelper]
}
