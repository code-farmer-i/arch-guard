import { issuesClient } from '@/modules/issues/client'
import { Rightbar } from '@/app/layouts/Rightbar'
import { iso } from '@/shared/lib/iso'

export const client = [issuesClient, Rightbar, iso]
