import { useSearchParams } from 'react-router-dom'

/**
 * 租户上下文的**唯一解析处**（R-110 声明的落点）：别处只许消费这个 hook 的结果。
 *
 * 为什么要它：租户 id 一个入口从 URL 取、另一个从 `user.tenant` 取、第三个忘了带 ——
 * 页面看起来一切正常，直到有人换租户发现串了数据。这里把"从哪儿拿租户"收成一处，
 * 换来源（子域 / token / cookie）只改这个文件。
 */
export function useTenantId(): string {
  const [searchParams] = useSearchParams()
  return searchParams.get('tenantId') ?? 'default'
}
