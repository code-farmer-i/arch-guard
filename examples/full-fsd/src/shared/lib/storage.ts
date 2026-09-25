import { STORAGE_KEYS } from '@/shared/config'

/** localStorage 的唯一落点（S38 callSites） */
export function readToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.token)
}

export function writeToken(token: string): void {
  localStorage.setItem(STORAGE_KEYS.token, token)
}
