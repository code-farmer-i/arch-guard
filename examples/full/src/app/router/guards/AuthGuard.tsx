import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { PATHS } from '@/shared/config/paths'
import { readToken } from '@/shared/lib/storage'

/** 登录守卫：只此一处（S42 声明的落点），跳转目标来自 PATHS（D23 的唯一出处） */
export function AuthGuard({ children }: { children: ReactNode }) {
  if (readToken() === null) return <Navigate to={PATHS.login} replace />
  return <>{children}</>
}
