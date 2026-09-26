import { test } from 'node:test'

test('测试里写策略不受这条管', () => {
  const options = { retry: (count: number) => count < 2, backoff: 'linear' }
  if (options.retry(0)) throw new Error('unreachable')
})
