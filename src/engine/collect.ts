import { relative } from 'node:path'

import { disabledFactsCache, openFactsCache } from './facts-cache.js'
import { extractFacts, factInputOf } from './facts.js'
import type { Config, Diagnostic, Facts, FileRecord } from './types.js'
import { readText } from './util.js'

/**
 * 「读源码 → 提事实 → 缓存」这一步（编排里的第一个昂贵阶段，见 DESIGN §6.8）。
 *
 * 为什么单独成模块：① 它与编排无关，只跟"哪些文件要解析、缓存放哪"有关；
 * ② `runGuard` 有函数长度上限，而这段是内聚的一整步（当初 `git.ts`、`filters.ts` 也是因此抽出的）。
 *
 * 两件必须保留的语义：
 *   - **契约域内 + 域外都要解析**：前者判定用，后者只为依赖图完整（测试作为可达根、跨域 import 边）；
 *   - **staged 时内容取自 index**（pre-commit 检查的是"将提交的东西"，不是工作区）。
 */
export interface CollectedSources {
  texts: Map<string, string>
  facts: Map<string, Facts>
  cssTexts: Map<string, string>
  /** 缓存是否启用（`--no-cache` 时 false） */
  cacheEnabled: boolean
  cacheHits: number
  cacheMisses: number
}

export function collectSources(options: {
  config: Config
  records: FileRecord[]
  outside: FileRecord[]
  /** `--scope=staged` 时 index 里的内容（rel → 文本）；其它 scope 为 null */
  staged: Map<string, string> | null
  useCache: boolean
  notice: (diagnostic: Diagnostic) => void
}): CollectedSources {
  const { config, notice } = options
  const texts = new Map<string, string>()
  const facts = new Map<string, Facts>()
  const cssTexts = new Map<string, string>()

  const cache = options.useCache ? openFactsCache(config.root, notice) : disabledFactsCache()

  for (const record of [...options.records, ...options.outside]) {
    try {
      const text = options.staged?.get(record.rel) ?? readText(record.abs)
      texts.set(record.rel, text)
      if (record.kind === 'ts') {
        const cached = cache.get(record, text)
        if (cached) {
          // 绝对路径不进缓存语义（换机器/换目录后必须刷新），其余字段都由内容决定
          cached.file = record.abs
          facts.set(record.rel, cached)
        } else {
          const extracted = extractFacts(factInputOf(record, text))
          facts.set(record.rel, extracted)
          cache.set(record, text, extracted)
        }
      } else if (record.kind === 'css') cssTexts.set(record.rel, text)
    } catch (error) {
      notice({
        code: 'read-failed',
        text: `读取失败：${record.rel}（${(error as Error).message}）`,
      })
    }
  }
  cache.save()
  const stats = cache.stats()
  if (options.useCache && stats.hits + stats.misses > 0) {
    // 命中数必须自述：不然「缓存到底有没有生效、写在哪」只能靠猜
    const where = stats.path === null ? '(未落盘)' : relative(config.root, stats.path)
    notice({
      code: 'facts-cache',
      text:
        `facts 缓存 ${where}：命中 ${stats.hits}/${stats.hits + stats.misses}` +
        (stats.hits > 0 ? '（省下的就是解析）' : '（首次或缓存作废，本轮全量解析）'),
    })
  }

  return {
    texts,
    facts,
    cssTexts,
    cacheEnabled: options.useCache,
    cacheHits: stats.hits,
    cacheMisses: stats.misses,
  }
}
