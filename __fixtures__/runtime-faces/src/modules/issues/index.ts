import { createService } from './model/service'

export const issuesHost = createService
export const createIssuesService = createService
export type IssuesService = typeof createService
