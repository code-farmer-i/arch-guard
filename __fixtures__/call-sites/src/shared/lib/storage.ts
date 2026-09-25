// 合规：本地存储的唯一落点（加密、版本迁移、隐私判断都在这一处做）
export function saveToken(token: string): void {
  localStorage.setItem('token', token)
}

export function readToken(): string | null {
  return localStorage.getItem('token')
}
