import { QueryClient } from '@tanstack/react-query'

// 合规：配置对象在装配层建（全应用一份）
export const queryClient = new QueryClient()
