import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { readToken } from '@/shared/lib/storage'
import { PATHS } from '@/shared/routes'

/** 登录守卫：只此一处（S42 声明的落点），目标来自 PATHS（D23 唯一出处） */
export function AuthGuard({ children }: { children: ReactNode }) {
  if (readToken() === null) return <Navigate to={PATHS.login} replace />
  return <>{children}</>
}
