/** 持久化 key（D08 与 index.html 的内联脚本对账）+ localStorage 的唯一落点（S38） */
export const STORAGE_KEYS = {
  theme: 'app.theme',
  token: 'app.token',
}

export function readToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.token)
}

export function writeToken(token: string): void {
  localStorage.setItem(STORAGE_KEYS.token, token)
}
