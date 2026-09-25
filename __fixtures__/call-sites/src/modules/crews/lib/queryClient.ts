import { QueryClient } from '@tanstack/react-query'

// 违规：域里自建配置对象（S38）—— 运行时会出现第二个缓存实例
export const crewsClient = new QueryClient()
