import { ChatPage } from '@/modules/chat/views/ChatPage'
import { Card } from '@/shared/components/ui/Card'
import { crewOnly } from '@/shared/lib/crewOnly'

export default function CrewsPage() {
  return <Card label={crewOnly(String(ChatPage))} />
}
