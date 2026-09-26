/** 租户上下文的**唯一解析处**（声明的落点）：别处只许消费这里的结果 */
export function tenantOf(searchParams: URLSearchParams): string {
  return searchParams.get('tenantId') ?? 'default'
}
